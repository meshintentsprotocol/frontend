/**
 * Typed client for the meshserver pool API (/api/v1/pools, /lps, /stats).
 *
 * Amounts are strings of base units (sats or token units). Errors are thrown as
 * MeshApiError with the server's status and message — never swallowed.
 * Pure module (base URL passed in) so live scripts can use it from node.
 */
import type { PoolParams, PoolSide } from './pool';

export type PoolStatus = 'active' | 'exhausted' | 'closed';
export type PoolEventType = 'DEPOSIT' | 'FILL' | 'WITHDRAW' | 'REPRICE';

export interface PoolStatsJson {
  volume24hSats: string; volume7dSats: string; volumeAllSats: string;
  fees24hSats: string; fees7dSats: string; feesAllSats: string;
  fillCount: number; fills24h: number;
  deposited: { sats: string; tokens: string };
  withdrawn: { sats: string; tokens: string };
  netDepositedSats: string;
  pnlSats: string;
  feeApr7dPct: number | null;
}

export interface Pool {
  address: string;
  tokenAddress: string;
  contractName: 'StrategyCovenantV2';
  constructorArgs: string[];
  ownerPkh: string;
  ownerAddress: string;
  side: PoolSide;
  tokenCategory: string;
  tokenCategoryIn: string;
  tokenCategoryOut: string;
  priceNum: number;
  priceDen: number;
  feeBps: number;
  satsPerToken: string;
  traderSatsPerToken: string;
  status: PoolStatus;
  pairName?: string;
  bundleId?: string;
  pairRole?: 'FORWARD' | 'REVERSE' | 'STANDALONE';
  predecessor?: string;
  successor?: string;
  reserves: { sats: string; tokens: string };
  availableOut: string;
  valueSats: string;
  priceSource: 'cauldron' | 'pool';
  marketSatsPerToken: string;
  utxos: Array<{ txid: string; vout: number; sats: string; tokens: string; valid: boolean }>;
  stats: PoolStatsJson;
  registeredAt: number;
  createdAt: number;
  lastFillAt: number | null;
  lastActivityAt: number | null;
  lastSyncAt: number;
}

export interface PoolEvent {
  txid: string;
  type: PoolEventType;
  height: number;
  time: number;
  confirmed: boolean;
  deltaSats: string;
  deltaTokens: string;
  amountIn?: string;
  amountOut?: string;
  lpEdge?: string;
  balanceAfter: { sats: string; tokens: string };
  intentId?: string;
  makerPkh?: string;
  fillMethod?: string;
  external?: boolean;
  successor?: string;
  predecessor?: string;
  // present on cross-pool activity rows
  address?: string;
  side?: PoolSide;
  tokenCategory?: string;
}

export interface PoolPreview {
  address: string;
  tokenAddress: string;
  lockingBytecode: string;
  contractName: 'StrategyCovenantV2';
  constructorArgs: string[];
  artifactHash: string;
  side: PoolSide;
  tokenCategory: string;
  satsPerToken: string;
  traderSatsPerToken: string;
  minFunding: { sats: string; tokens: string; note: string };
  registered: boolean;
}

export interface PairSummary {
  pair: string;
  tokenCategory: string;
  poolCount: number;
  activePools: number;
  lpCount: number;
  tvlSats: string;
  volume24hSats: string;
  volume7dSats: string;
  fees24hSats: string;
  fees7dSats: string;
  bestBid: { satsPerToken: string; address: string } | null;
  bestAsk: { satsPerToken: string; address: string } | null;
  bidDepthSats: string;
  askDepthTokens: string;
}

export interface LpSummary {
  rank?: number;
  ownerPkh: string;
  ownerAddress: string;
  poolCount: number;
  activePools: number;
  pairs: string[];
  tvlSats: string;
  volume24hSats: string;
  volume7dSats: string;
  volumeAllSats: string;
  fees7dSats: string;
  feesAllSats: string;
  pnlSats: string;
  fillCount: number;
  firstSeenAt: number | null;
  lastFillAt: number | null;
}

export interface LpDetail {
  lp: LpSummary;
  pools: Pool[];
  activity: PoolEvent[];
  daily: Array<{ day: number; volumeSats: string; feesSats: string; fills: number }>;
}

export interface MarketRef {
  token: string;
  cauldron: { satsPerToken: string; bchReserve: string; tokenReserve: string; poolAddress: string } | null;
  mesh: { bestBid: { satsPerToken: string; address: string } | null; bestAsk: { satsPerToken: string; address: string } | null };
  bchUsd: number | null;
}

export interface MeshNetworkStats {
  strategies: number;
  intents: number;
  activeStrategies: number;
  activeIntents: number;
  pairsIndexed: number;
  activePools: number;
  totalPools: number;
  lpCount: number;
  tvlSats: string;
  volume24hSats: string;
  fees24hSats: string;
  poolFills24h: number;
  poolFillsTotal: number;
  intentFills24h: number;
  avgFillLatencySec: number | null;
  bchUsd: number | null;
}

export interface RegisterItem extends PoolParams {
  txid: string;
  vout: number;
  pairName?: string;
  bundleId?: string;
  pairRole?: 'FORWARD' | 'REVERSE' | 'STANDALONE';
}

export interface RegisterResult {
  success: boolean;
  pools: Pool[];
  results: Array<{ index: number; status: number; address?: string; error?: string }>;
  error?: string;
}

export class MeshApiError extends Error {
  constructor(readonly status: number, message: string, readonly body?: unknown) { super(message); }
}

export interface PoolListQuery {
  pair?: string;
  owner?: string;
  status?: 'active' | 'exhausted' | 'closed' | 'all' | string;
  sort?: 'value' | 'volume' | 'fees' | 'recent' | 'created';
  limit?: number;
  offset?: number;
}

export function createMeshApi(baseUrl: string, fetchImpl: typeof fetch = (...a) => fetch(...a)) {
  const base = baseUrl.replace(/\/+$/, '');

  async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown, okStatuses: number[] = []): Promise<T> {
    let res: Response;
    try {
      res = await fetchImpl(`${base}${path}`, {
        method,
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (e: any) {
      throw new MeshApiError(0, `Mesh server unreachable (${base}): ${e?.message ?? e}`);
    }
    const text = await res.text();
    let data: any = undefined;
    try { data = text ? JSON.parse(text) : undefined; } catch { /* non-JSON error page */ }
    if (!res.ok && !okStatuses.includes(res.status)) {
      throw new MeshApiError(res.status, data?.error ?? data?.message ?? `HTTP ${res.status}`, data);
    }
    return data as T;
  }

  const enc = encodeURIComponent;
  const qs = (q: Record<string, unknown>) => {
    const p = Object.entries(q).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}=${enc(String(v))}`);
    return p.length ? `?${p.join('&')}` : '';
  };

  return {
    baseUrl: base,
    preview: (params: PoolParams) => call<PoolPreview>('POST', '/api/v1/pools/preview', params),
    /** 201 all registered · 207 some failed (see results) · 4xx all failed. 207 does not throw. */
    register: (items: RegisterItem[]) => call<RegisterResult>('POST', '/api/v1/pools', { pools: items }, [207]),
    list: (q: PoolListQuery = {}) => call<{ total: number; count: number; pools: Pool[] }>('GET', `/api/v1/pools${qs(q as any)}`),
    pairs: () => call<{ pairs: PairSummary[] }>('GET', '/api/v1/pools/pairs'),
    marketRef: (token: string) => call<MarketRef>('GET', `/api/v1/pools/market-ref${qs({ token })}`),
    recentActivity: (q: { limit?: number; type?: PoolEventType } = {}) =>
      call<{ count: number; events: Array<PoolEvent & { ownerPkh?: string }> }>('GET', `/api/v1/pools/activity${qs(q)}`),
    byOutpoint: (txid: string, vout: number) => call<{ address: string }>('GET', `/api/v1/pools/by-outpoint/${txid}/${vout}`),
    get: (address: string) => call<{ pool: Pool; bundle: string[] }>('GET', `/api/v1/pools/${enc(address)}`),
    activity: (address: string, q: { limit?: number; before?: number } = {}) =>
      call<{ address: string; count: number; total: number; events: PoolEvent[] }>('GET', `/api/v1/pools/${enc(address)}/activity${qs(q)}`),
    sync: (address: string) => call<{ pool: Pool }>('POST', `/api/v1/pools/${enc(address)}/sync`),
    lps: (q: { sort?: 'tvl' | 'volume' | 'fees' | 'pnl'; limit?: number } = {}) => call<{ count: number; lps: LpSummary[] }>('GET', `/api/v1/lps${qs(q)}`),
    lp: (owner: string) => call<LpDetail>('GET', `/api/v1/lps/${enc(owner)}`),
    stats: () => call<MeshNetworkStats>('GET', '/api/v1/stats'),
    orderbook: (pair: string) => call<any>('GET', `/api/v1/orderbook${qs({ pair })}`),
  };
}

export type MeshApi = ReturnType<typeof createMeshApi>;

/** WebSocket URL of the server's unified stream. */
export function meshWsUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '').replace(/^http/, 'ws') + '/ws';
}
