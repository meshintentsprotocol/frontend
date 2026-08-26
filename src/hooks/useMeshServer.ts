import { useState, useEffect, useCallback, useRef } from 'react';

const MESH_BASE = import.meta.env.VITE_MESH_SERVER_URL ?? 'http://localhost:3001';

// ── Mesh Server API types ─────────────────────────────────────────────────────

export interface MeshPosition {
  txid:             string;
  vout:             number;
  address:          string;
  contractType:     'StrategyCovenant' | 'OracleStrategyCovenant' | 'MultiPairRecyclingCovenant' | 'DutchDecayStrategyCovenant';
  ownerPkh?:        string;
  reserveSats:      string;  // bigint as string
  tokenCategoryIn:  string;
  tokenCategoryOut: string;
  tokenAmountIn:    string;
  tokenAmountOut?:   string;
  priceNum:         number;
  priceDen:         number;
  feeBps:           number;
  curveType:        number; // 0=fixed 1=oracle 2=dutch 3=multi
  rangeLow:         number;
  rangeHigh:        number;
  earnedFeeSats:    string;
  lastSeenBlock:    number;
  startTime?:       number;
  duration?:        number;
  floorPriceNum?:   number;
  oraclePkHex?:     string;
  pairId?:          number;
  spreadBps?:       number;
  /** True when this is a seeded demo position — not a real on-chain UTXO owned by this wallet */
  isMock?:          boolean;
}

export interface MeshPriceEntry {
  pairName:       string;
  price:          string;
  priceHuman:     string;
  fetchedAt:      number;
  source:         'pyth' | 'cauldron' | 'bmr';
  poolAddress?:   string;
  poolReserveIn?:  string;
  poolReserveOut?: string;
}

export interface MeshStats {
  strategies: number;
  intents:    number;
}

export interface ServerHealth {
  ok:      boolean;
  latency: number;
}

export interface OrderbookLevel {
  price:       string;
  amountBch:   string;
  amountToken: string;
  utxoCount:   number;
  utxoIds:     string[];
}

export interface OrderbookDepthData {
  pair:      string;
  timestamp: number;
  bids:      OrderbookLevel[];
  asks:      OrderbookLevel[];
  spread:    { bestBid: string | null; bestAsk: string | null; spreadBps: number };
}

export interface RebalanceInstruction {
  action: 'DOCK' | 'SHIP';
  txid?: string;
  vout?: number;
  priceNum: number;
  priceDen: number;
  feeBps: number;
  reserveSats: string;
}

export interface RebalanceQuoteResponse {
  ownerPkh: string;
  instructions: RebalanceInstruction[];
  dockCount: number;
  shipCount: number;
  estimatedBytes: number;
  estimatedFeeSats: string;
  estimatedUsdFee: string;
}

export interface RebalanceRequestPayload {
  ownerPkh: string;
  targetCenterPrice: number;
  gridSpacingPct: number;
  numPositions: number;
  tokenCategoryIn: string;
  tokenCategoryOut: string;
  feeBps?: number;
}

// ── Helper ────────────────────────────────────────────────────────────────────

async function meshFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${MESH_BASE}${path}`, options);
  if (!res.ok) throw new Error(`MeshServer ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ── Main hook ─────────────────────────────────────────────────────────────────

export function useMeshServer(pollIntervalMs = 10_000) {
  const [positions, setPositions]   = useState<MeshPosition[]>([]);
  const [prices, setPrices]         = useState<MeshPriceEntry[]>([]);
  const [stats, setStats]           = useState<MeshStats | null>(null);
  const [health, setHealth]         = useState<ServerHealth>({ ok: false, latency: 0 });
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    const t0 = Date.now();
    try {
      const [posRes, priceRes] = await Promise.allSettled([
        meshFetch<{ positions: MeshPosition[]; stats?: MeshStats }>('/api/v1/positions'),
        meshFetch<{ prices: MeshPriceEntry[] }>('/api/v1/oracle/prices'),
      ]);

      if (posRes.status === 'fulfilled') {
        // Tag positions that have no local deployment record as mock/demo entries
        const LOCAL_POS_KEY = 'bch_mesh_user_positions';
        let localMap: Record<string, any> = {};
        try { localMap = JSON.parse(localStorage.getItem(LOCAL_POS_KEY) ?? '{}'); } catch {}
        const tagged = (posRes.value.positions ?? []).map(p => ({
          ...p,
          isMock: !localMap[p.txid],
        }));
        setPositions(tagged);
        if (posRes.value.stats) setStats(posRes.value.stats);
      }
      if (priceRes.status === 'fulfilled') setPrices(priceRes.value.prices ?? []);

      setHealth({ ok: true, latency: Date.now() - t0 });
      setError(null);
    } catch (e: any) {
      setHealth({ ok: false, latency: 0 });
      setError(e.message ?? 'Failed to reach MeshServer');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
    timerRef.current = setInterval(() => { void fetchAll(); }, pollIntervalMs);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchAll, pollIntervalMs]);

  /** Get a specific price by pair name */
  const getPrice = useCallback((pairName: string): MeshPriceEntry | undefined => {
    return prices.find(p => p.pairName === pairName);
  }, [prices]);

  /** BCH/USD in human-readable USD (from Pyth or BMR) */
  const bchUsdPrice = (): number => {
    const p = prices.find(e => e.pairName === 'BCH_USD');
    return p ? parseFloat(p.priceHuman) : 0;
  };

  /** pUSD/BCH rate from Cauldron pool (sats per pUSD unit × 1e-8) */
  const pusdBchPrice = (): number => {
    const p = prices.find(e => e.pairName === 'pUSD_BCH');
    return p ? parseFloat(p.priceHuman) : 0;
  };

  /** Fetch CLOB orderbook depth for a pair e.g. "BCH-pUSD" */
  const fetchOrderbook = useCallback(async (pair: string): Promise<OrderbookDepthData | null> => {
    try {
      return await meshFetch<OrderbookDepthData>(`/api/v1/orderbook?pair=${pair}`);
    } catch {
      return null;
    }
  }, []);

  /** Fetch positions owned by specific owner PKH */
  const fetchOwnerPositions = useCallback(async (ownerPkh: string): Promise<MeshPosition[]> => {
    try {
      const data = await meshFetch<{ positions: MeshPosition[] }>(`/api/v1/positions/${ownerPkh}`);
      return data.positions ?? [];
    } catch {
      return [];
    }
  }, []);

  /** Request bulk rebalancing quote */
  const requestRebalanceQuote = useCallback(async (payload: RebalanceRequestPayload): Promise<RebalanceQuoteResponse> => {
    return meshFetch<RebalanceQuoteResponse>('/api/v1/rebalance/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }, []);

  /** Register a newly deployed strategy position with MeshServer */
  const registerPosition = useCallback(async (payload: any): Promise<boolean> => {
    try {
      await meshFetch('/api/v1/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return true;
    } catch (e) {
      console.warn('[MeshServer] Failed to register position:', e);
      return false;
    }
  }, []);

  return {
    positions, prices, stats, health, loading, error,
    refresh: fetchAll,
    getPrice, bchUsdPrice, pusdBchPrice, fetchOrderbook,
    fetchOwnerPositions, requestRebalanceQuote, registerPosition,
  };
}
