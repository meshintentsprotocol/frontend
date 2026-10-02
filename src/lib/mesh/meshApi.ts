/**
 * Typed client for the meshserver pool API (/api/v1/pools, /lps, /stats,
 * /strategies). V2 (StrategyCovenantV2) and V3 (MeshPoolV3) pools share the
 * pool routes; V3 pools carry a `v3` block.
 *
 * Amounts are strings of base units (sats or token units). Errors are thrown as
 * MeshApiError with the server's status and message — never swallowed.
 * Pure module (base URL passed in) so live scripts can use it from node.
 */
import type { PoolParams, PoolSide } from './pool';
import type { V3ParamsJson } from './v3/v3Pool';

export type PoolStatus = 'active' | 'exhausted' | 'closed';
export type PoolEventType = 'DEPOSIT' | 'FILL' | 'WITHDRAW' | 'REPRICE' | 'RECYCLE';
export type PoolContractName = 'StrategyCovenantV2' | 'MeshPoolV3';

/** V3 params as the server returns them, with per-asset trader prices and proceeds destinations. */
export interface V3Info extends Omit<V3ParamsJson, 'slots'> {
  modeName: 'owner' | 'fixed' | 'mirror';
  proceedsAddress?: string;
  constructorArgs: string[];
  slots: Array<{
    index: number; cat: string; num: string; den: string; rNum: string; rDen: string;
    traderOutPerIn: string;
    proceeds: { kind: 'owner' } | { kind: 'fixed'; lockingBytecode: string } | { kind: 'mirror'; address: string; lockingBytecode: string };
  }>;
}

export interface AssetStatsJson {
  asset: string; fills: number; proceeds: string; proceedsValueSats: string;
  volume24hSats: string; volume7dSats: string; volumeAllSats: string;
  fees24hSats: string; fees7dSats: string; feesAllSats: string;
}

export interface PoolStatsJson {
  volume24hSats: string; volume7dSats: string; volumeAllSats: string;
  fees24hSats: string; fees7dSats: string; feesAllSats: string;
  fillCount: number; fills24h: number;
  deposited: { sats: string; tokens: string };
  withdrawn: { sats: string; tokens: string };
  netDepositedSats: string;
  pnlSats: string;
  feeApr7dPct: number | null;
  proceedsValueSats?: string;       // V3: value of everything paid out as proceeds
  byAsset?: AssetStatsJson[];       // V3: per accepted asset
}

export interface Pool {
  address: string;
  tokenAddress: string;
  contractName: PoolContractName;
  constructorArgs: string[];
  v3?: V3Info;
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
  // V3
  asset?: string;
  slot?: number;
  recycledTo?: string;
  proceedsLock?: string;
  from?: string;
  legs?: Array<{ asset: string; slot: number; amountIn: string; amountOut: string; lpEdge: string; proceedsLock: string; proceedsVout: number }>;
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

export interface TokenPairSummary { give: string; take: string; address: string; outPerIn: string; depth: string; feeBps: number }

export interface PoolPreviewV3 {
  address: string;
  tokenAddress: string;
  lockingBytecode: string;
  contractName: 'MeshPoolV3';
  constructorArgs: string[];
  artifactHash: string;
  v3: V3Info;
  minFunding: { sats: string; tokens: string; note: string };
  registered: boolean;
}

export interface RegisterItemV3 {
  v3: V3ParamsJson;
  txid: string;
  vout: number;
  pairName?: string;
  bundleId?: string;
  pairRole?: 'FORWARD' | 'REVERSE' | 'STANDALONE';
}

// ── Strategies ───────────────────────────────────────────────────────────────

/** One template parameter (server units: sats per token base unit, base-unit amounts). */
export interface TemplateField {
  key: string;
  label: string;
  type: 'token' | 'price' | 'rate' | 'amount' | 'int' | 'bps' | 'enum' | 'tokenList';
  asset?: string | { field: string; map: Record<string, string> };
  rate?: { give: string; take: string };
  required: boolean;
  min?: number; max?: number; default?: string | number;
  options?: Array<{ value: string; label: string }>;
  help: string;
}

export interface StrategyTemplate {
  id: string; name: string; summary: string; params: Record<string, string>;
  // present on servers with the field schema (2026-10-02+)
  category?: string; recycles?: boolean; deposit?: string; earns?: string; risk?: string; fields?: TemplateField[];
}

/** Market context for one token (prices: sats per token base unit). */
export interface MarketContext {
  token: string;
  symbol: string | null; decimals: number | null; icon: string | null;
  cauldron: { satsPerToken: string; bchReserve: string; tokenReserve: string; poolAddress: string } | null;
  mesh: { bestBid: { satsPerToken: string; address: string } | null; bestAsk: { satsPerToken: string; address: string } | null };
  midSatsPerToken: number | null;
  midSource: 'cauldron' | 'mesh-mid' | 'mesh-bid' | 'mesh-ask' | null;
  bchUsd: number | null;
  tokenUsd: number | null;
}

export interface StrategySuggestion {
  template: string;
  market: Record<string, MarketContext>;
  params: Record<string, unknown> | null;
  reason?: string;
}

/** A slot's price against the market mid. */
export interface SlotMarket {
  asset: string; side: 'buys' | 'sells' | 'swaps';
  satsPerToken?: number; midSatsPerToken?: number | null; vsMidBps: number | null;
  reverseSatsPerToken?: number; reverseVsMidBps?: number | null;
  gives?: string; reservePerUnit?: number;
}

export interface StrategyPoolPreview {
  role: string;
  contractName: 'MeshPoolV3';
  address: string;
  tokenAddress: string;
  lockingBytecode: string;
  fundTo: string;
  deposit: { sats: string; token?: { category: string; amount: string } };
  v3: V3Info;
  market?: SlotMarket[];
  registered: boolean;
}

export interface StrategyPreview {
  template: string;
  pools: StrategyPoolPreview[];
  totals: { sats: string; tokens: Record<string, string> };
  market?: Record<string, MarketContext>;
}

export interface StrategyIdleFlag { kinds: IdleKind[]; items: string[]; reasons: string[]; valueSats: string }

export interface StrategySummary {
  id: string; template: string; ownerPkh: string; txid: string; createdAt: number;
  params: Record<string, unknown>; replaces?: string; replacedBy?: string; recycledFrom?: string[];
  status: PoolStatus;
  poolCount: number; activePools: number;
  valueSats: string; volume24hSats: string; volume7dSats: string;
  feesAllSats: string; fees7dSats: string; pnlSats: string; fillCount: number;
  pools: Array<{ address: string; role: string; status: PoolStatus }>;
  // 2026-10-02+
  inventory?: { sats: string; tokens: Record<string, string> };
  /** null before 24 h of history */
  feeApr7dPct?: number | null;
  lastFillAt?: number | null;
  lastActivityAt?: number | null;
  /** owner listings only */
  idle?: StrategyIdleFlag | null;
}

export interface RebalancePlan {
  strategy: string;
  close: ClosePlan[];
  open: StrategyPoolPreview[];
  market?: Record<string, MarketContext>;
  available: { sats: string; tokens: Record<string, string> };
  needs: { sats: string; tokens: Record<string, string> };
  shortfall: Record<string, string>;
  note: string;
}

export interface ClosePlan {
  address: string; contractName: PoolContractName; constructorArgs?: string[];
  utxos: Array<{ txid: string; vout: number; sats: string; tokens: string; category: string | null }>;
}

// ── Recycle ──────────────────────────────────────────────────────────────────

export type IdleKind = 'wallet' | 'stale' | 'one-sided' | 'dust';

export interface IdleItem {
  id: string; kind: IdleKind; reason: string; valueSats: string;
  pools?: string[]; strategy?: string; asset?: string; amount?: string; token?: string;
  lastFillAt?: number | null; vsMidBps?: number | null;
}

export interface IdleReport {
  owner: string; count: number; totalValueSats: string; items: IdleItem[];
  thresholds: { staleAfterSec: number; offMidBps: number; dustSats: string };
}

export interface RecyclePlan {
  owner: string;
  items: IdleItem[];
  close: ClosePlan[];
  open: Array<{ template: 'recycling-pair'; params: Record<string, unknown>; part: number; pools: StrategyPoolPreview[] }>;
  freed: { sats: string; tokens: Record<string, string> };
  fromWallet: { sats: string; tokens: Record<string, string> };
  toWallet: { sats: string; tokens: Record<string, string> };
  needs: { sats: string; tokens: Record<string, string> };
  spreadBps: number; feeBps: number;
  notes: string[];
  recycledFrom: string[];
  note: string;
}

export interface StrategyInput { template: string; ownerPkh: string; params: Record<string, unknown> }

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
    previewV3: (v3: V3ParamsJson) => call<PoolPreviewV3>('POST', '/api/v1/pools/preview', { contractName: 'MeshPoolV3', v3 }),
    /** 201 all registered · 207 some failed (see results) · 4xx all failed. 207 does not throw. */
    register: (items: RegisterItem[]) => call<RegisterResult>('POST', '/api/v1/pools', { pools: items }, [207]),
    registerV3: (items: RegisterItemV3[]) =>
      call<RegisterResult>('POST', '/api/v1/pools', { pools: items.map(i => ({ contractName: 'MeshPoolV3', ...i })) }, [207]),
    list: (q: PoolListQuery = {}) => call<{ total: number; count: number; pools: Pool[] }>('GET', `/api/v1/pools${qs(q as any)}`),
    pairs: () => call<{ pairs: PairSummary[]; tokenPairs?: TokenPairSummary[] }>('GET', '/api/v1/pools/pairs'),
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
    // strategies
    templates: () => call<{ templates: StrategyTemplate[]; limits?: Record<string, number> }>('GET', '/api/v1/strategies/templates'),
    /** Market context + suggested params. `tokens` for multi-pair, `tokenA`/`tokenB` for stable-pair. */
    suggest: (q: { template: string; token?: string; tokens?: string[]; tokenA?: string; tokenB?: string }) =>
      call<StrategySuggestion>('GET', `/api/v1/strategies/suggest${qs({ ...q, tokens: q.tokens?.join(',') })}`),
    previewStrategy: (input: StrategyInput) => call<StrategyPreview>('POST', '/api/v1/strategies/preview', input),
    registerStrategy: (input: StrategyInput & { txid: string; replaces?: string; part?: number; recycledFrom?: string[] }) =>
      call<{ strategy: StrategySummary }>('POST', '/api/v1/strategies', input),
    // recycle
    idle: (owner: string) => call<IdleReport>('GET', `/api/v1/recycle/idle${qs({ owner })}`),
    recyclePlan: (body: { owner: string; items?: string[]; spreadBps?: number; feeBps?: number }) =>
      call<RecyclePlan>('POST', '/api/v1/recycle/plan', body),
    strategies: (owner?: string) => call<{ count: number; strategies: StrategySummary[] }>('GET', `/api/v1/strategies${qs({ owner })}`),
    strategy: (id: string) => call<{ strategy: StrategySummary; pools: Pool[] }>('GET', `/api/v1/strategies/${enc(id)}`),
    rebalancePlan: (id: string, body: { template?: string; params?: Record<string, unknown> }) =>
      call<RebalancePlan>('POST', `/api/v1/strategies/${enc(id)}/rebalance-plan`, body),
  };
}

export type MeshApi = ReturnType<typeof createMeshApi>;

/** WebSocket URL of the server's unified stream. */
export function meshWsUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '').replace(/^http/, 'ws') + '/ws';
}
