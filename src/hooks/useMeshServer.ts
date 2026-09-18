import { useState, useEffect, useCallback, useRef } from 'react';

const MESH_BASE = import.meta.env.VITE_MESH_SERVER_URL ?? 'https://bchmesh-production.up.railway.app';

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

export const DEFAULT_DEMO_POSITIONS: MeshPosition[] = [
  // 1. BCH / pUSD — Dynamic Pyth Oracle Spot Tracking
  {
    txid:             '924aa5af7145a8d03e5029791df5360158b552024b89e35129bd73e266d8c061',
    vout:             0,
    address:          'bchtest:pdhlx033sj4g70w76uzc9q7a4h774g8a9vclsk32pxj92g72n39g6jvd83er3',
    contractType:     'OracleStrategyCovenant',
    reserveSats:      '845000000', // 8.45 BCH
    tokenCategoryIn:  '0x',        // BCH
    tokenCategoryOut: 'dfe50223c8d5cba8dcef8dff6d92b61deb88a8ba44947367f2b746487b56039b', // pUSD
    tokenAmountIn:    '0',
    tokenAmountOut:   '274118',   // 2,741.18 pUSD
    priceNum:         32440,
    priceDen:         100,
    feeBps:           30,
    curveType:        1,
    rangeLow:         310,
    rangeHigh:        345,
    earnedFeeSats:    '2840000',
    lastSeenBlock:    220100,
    isMock:           true,
  },
  // 2. BCH / pUSD — Fixed Price Range
  {
    txid:             '0aa1249c71495f479f3cdf329b731893faef88cd63e5651b05c058db5cbf3e6c',
    vout:             0,
    address:          'bchtest:p03dccv6s99mhjv9csxhn9058qclx00a75xvg7vujfl5x0x70cxg6l5p0x77c',
    contractType:     'StrategyCovenant',
    reserveSats:      '450000000', // 4.50 BCH
    tokenCategoryIn:  '0x',
    tokenCategoryOut: 'dfe50223c8d5cba8dcef8dff6d92b61deb88a8ba44947367f2b746487b56039b', // pUSD
    tokenAmountIn:    '0',
    tokenAmountOut:   '145980',
    priceNum:         32440,
    priceDen:         100,
    feeBps:           25,
    curveType:        0,
    rangeLow:         320,
    rangeHigh:        330,
    earnedFeeSats:    '1520000',
    lastSeenBlock:    220100,
    isMock:           true,
  },
  // 3. USDC / USDT — Stable-to-Stable Tight Peg Spread (Screenshot Match)
  {
    txid:             '74b2f15a3a789de40f6c21e05d985a219bc0192e1058204652ba74f9d0c64112',
    vout:             0,
    address:          'bchtest:pq0m63a23s78vcl000x9s937xmq8c7849s5a21k00p239vcs9288s7k210m34',
    contractType:     'StrategyCovenant',
    reserveSats:      '78300000', // 0.783 BCH
    tokenCategoryIn:  'usdc_cashtoken_category',
    tokenCategoryOut: 'usdt_cashtoken_category',
    tokenAmountIn:    '2537899',  // 253.7899 USDC
    tokenAmountOut:   '2544578',  // 254.4578 USDT
    priceNum:         100,
    priceDen:         100,
    feeBps:           4,
    curveType:        0,
    rangeLow:         0.999,
    rangeHigh:        1.001,
    earnedFeeSats:    '0',
    lastSeenBlock:    220100,
    isMock:           true,
  },
  // 4. BCH / mUSD — Fixed Rate Yield Pool
  {
    txid:             '4c8e79b29a174df61280cae9185a2b00192e850462bb74e891c641120f5c21e0',
    vout:             0,
    address:          'bchtest:p0289s5a21k00p239vcs9288s7k210m34pq0m63a23s78vcl000x9s937xmq8c',
    contractType:     'StrategyCovenant',
    reserveSats:      '375000000', // 3.75 BCH
    tokenCategoryIn:  '0x',
    tokenCategoryOut: '900224219a164daab2f4b4b248a3794ef64a3ef5a92a5efcfafcfa1396b2aa6d', // mUSD
    tokenAmountIn:    '0',
    tokenAmountOut:   '121556',
    priceNum:         32415,
    priceDen:         100,
    feeBps:           30,
    curveType:        0,
    rangeLow:         315,
    rangeHigh:        335,
    earnedFeeSats:    '980000',
    lastSeenBlock:    220100,
    isMock:           true,
  },
  // 5. BCH / mUSD — Dutch Decay Auction
  {
    txid:             '1e5a8f4c29b74052e0462bb74e891c641120f5c21e04c8e79b29a174df61280c',
    vout:             0,
    address:          'bchtest:p78vcl000x9s937xmq8c0289s5a21k00p239vcs9288s7k210m34pq0m63a23s',
    contractType:     'DutchDecayStrategyCovenant',
    reserveSats:      '210000000', // 2.10 BCH
    tokenCategoryIn:  '0x',
    tokenCategoryOut: '900224219a164daab2f4b4b248a3794ef64a3ef5a92a5efcfafcfa1396b2aa6d', // mUSD
    tokenAmountIn:    '0',
    tokenAmountOut:   '68124',
    priceNum:         33000,
    priceDen:         100,
    feeBps:           25,
    curveType:        2,
    rangeLow:         300,
    rangeHigh:        330,
    earnedFeeSats:    '540000',
    lastSeenBlock:    220100,
    duration:         604800, // 7 days
    isMock:           true,
  },
  // 6. BCH / USDC — Deep Concentration Spot Oracle
  {
    txid:             '8f2b0174cae9185a2b00192e850462bb74e891c641120f5c21e04c8e79b29a17',
    vout:             0,
    address:          'bchtest:pq5a21k00p239vcs9288s7k210m34pq0m63a23s78vcl000x9s937xmq8c0289',
    contractType:     'OracleStrategyCovenant',
    reserveSats:      '1250000000', // 12.50 BCH
    tokenCategoryIn:  '0x',
    tokenCategoryOut: 'usdc_cashtoken_category',
    tokenAmountIn:    '0',
    tokenAmountOut:   '405500',
    priceNum:         32440,
    priceDen:         100,
    feeBps:           5,
    curveType:        1,
    rangeLow:         322,
    rangeHigh:        327,
    earnedFeeSats:    '4200000',
    lastSeenBlock:    220100,
    isMock:           true,
  },
  // 7. BCH / FUR — Multi-Pair Recycling Covenant (High-Yield Volatile)
  {
    txid:             '3d7e891c641120f5c21e04c8e79b29a178f2b0174cae9185a2b00192e850462b',
    vout:             0,
    address:          'bchtest:pvcs9288s7k210m34pq0m63a23s78vcl000x9s937xmq8c0289pq5a21k00p239',
    contractType:     'MultiPairRecyclingCovenant',
    reserveSats:      '520000000', // 5.20 BCH
    tokenCategoryIn:  '0x',
    tokenCategoryOut: 'c74f5192e1a4ef4f6479a95786a347db7e94a8ad07efcfafcfba1396b2aa6d1b', // FUR
    tokenAmountIn:    '0',
    tokenAmountOut:   '250640',
    priceNum:         4820,
    priceDen:         100,
    feeBps:           50,
    curveType:        3,
    rangeLow:         40,
    rangeHigh:        60,
    earnedFeeSats:    '1850000',
    lastSeenBlock:    220100,
    isMock:           true,
  },
  // 8. BCH / WBTC — Dutch Auction Liquidating Strategy
  {
    txid:             '6a178f2b0174cae9185a2b00192e850462bb74e891c641120f5c21e04c8e79b2',
    vout:             0,
    address:          'bchtest:pm63a23s78vcl000x9s937xmq8c0289pq5a21k00p239pvcs9288s7k210m34pq0',
    contractType:     'DutchDecayStrategyCovenant',
    reserveSats:      '185000000', // 1.85 BCH
    tokenCategoryIn:  '0x',
    tokenCategoryOut: 'wbtc_cashtoken_category',
    tokenAmountIn:    '0',
    tokenAmountOut:   '632',
    priceNum:         342,
    priceDen:         100000,
    feeBps:           30,
    curveType:        2,
    rangeLow:         0.003,
    rangeHigh:        0.004,
    earnedFeeSats:    '610000',
    lastSeenBlock:    220100,
    isMock:           true,
  },
  // 9. BCH / pUSD — Out-of-Range Old Strategy (Empty reserve / Needs Rebalance)
  {
    txid:             '921b06f54f09d00d91ac41f12d057ff8212e29092970793b938702c47cd259f1',
    vout:             0,
    address:          'bchtest:pdwqcpn95ajlfk6kxmu3f89s5a87qglpxxvc29sk95g8n78a0qggsn8m25er3',
    contractType:     'StrategyCovenant',
    reserveSats:      '0', // 0 BCH
    tokenCategoryIn:  '0x',
    tokenCategoryOut: 'dfe50223c8d5cba8dcef8dff6d92b61deb88a8ba44947367f2b746487b56039b', // pUSD
    tokenAmountIn:    '0',
    tokenAmountOut:   '0',
    priceNum:         27500,
    priceDen:         100,
    feeBps:           30,
    curveType:        0,
    rangeLow:         270,
    rangeHigh:        280,
    earnedFeeSats:    '320000',
    lastSeenBlock:    220050,
    isMock:           true,
  },
];

// ── Main hook ─────────────────────────────────────────────────────────────────

export function useMeshServer(pollIntervalMs = 10_000) {
  const [positions, setPositions]   = useState<MeshPosition[]>(DEFAULT_DEMO_POSITIONS);
  const [prices, setPrices]         = useState<MeshPriceEntry[]>([
    { pairName: 'BCH_USD', price: '324.40', priceHuman: '324.40', fetchedAt: Date.now(), source: 'pyth' },
    { pairName: 'pUSD_BCH', price: '0.00308', priceHuman: '0.00308', fetchedAt: Date.now(), source: 'cauldron' },
  ]);
  const [stats, setStats]           = useState<MeshStats | null>({ strategies: 9, intents: 4 });
  const [health, setHealth]         = useState<ServerHealth>({ ok: true, latency: 12 });
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    const t0 = Date.now();
    try {
      const [posRes, priceRes] = await Promise.allSettled([
        meshFetch<{ positions: MeshPosition[]; stats?: MeshStats }>('/api/v1/positions'),
        meshFetch<{ prices: MeshPriceEntry[] }>('/api/v1/oracle/prices'),
      ]);

      if (posRes.status === 'fulfilled' && posRes.value.positions && posRes.value.positions.length > 0) {
        const LOCAL_POS_KEY = 'bch_mesh_user_positions';
        let localMap: Record<string, any> = {};
        try { localMap = JSON.parse(localStorage.getItem(LOCAL_POS_KEY) ?? '{}'); } catch {}
        const tagged = (posRes.value.positions ?? []).map(p => ({
          ...p,
          isMock: !localMap[p.txid],
        }));
        setPositions(tagged);
        if (posRes.value.stats) setStats(posRes.value.stats);
      } else if (positions.length === 0) {
        setPositions(DEFAULT_DEMO_POSITIONS);
      }

      if (priceRes.status === 'fulfilled' && priceRes.value.prices) {
        setPrices(priceRes.value.prices);
      }

      setHealth({ ok: true, latency: Date.now() - t0 });
      setError(null);
    } catch (e: any) {
      setHealth({ ok: false, latency: 0 });
      setError(e.message ?? 'Failed to reach MeshServer');
    } finally {
      setLoading(false);
    }
  }, [positions.length]);

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
