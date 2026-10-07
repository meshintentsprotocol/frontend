/**
 * Typed client for the meshserver admin console API (/api/v1/admin, see
 * meshserver src/api/routes/adminOps.ts) plus the legacy admin routes still
 * used for route control, refunds and the solver cycle.
 *
 * Amounts are base-unit strings; asset '0x' is BCH (sats). Every request,
 * reads included, sends x-admin-key; errors throw AdminApiError with the
 * server's message.
 */
import type { Pool, PoolEvent, PoolStatus, StrategySummary, IdleItem, LpSummary } from '@/lib/mesh/meshApi';

export class AdminApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// ── Shared ───────────────────────────────────────────────────────────────────

export type Severity = 'info' | 'success' | 'warn' | 'error';
export type EventCategory = 'intent' | 'fill' | 'refund' | 'pool' | 'strategy' | 'recycle' | 'twap' | 'route' | 'balancer' | 'system';
export type FillMethod = 'MESH_POOL' | 'CAULDRON' | 'SOLVER_INVENTORY' | 'SPLIT';
export type IntentKind = 'limit' | 'dutch' | 'twap';
export type IntentStatus =
  | 'awaiting_funding' | 'active' | 'scheduled' | 'underfunded' | 'expired' | 'expired_unfunded'
  | 'refund_pending' | 'filled' | 'refunded' | 'cancelled' | 'closed_external';

export interface EventRef { kind: 'intent' | 'pool' | 'strategy' | 'twap' | 'lp' | 'tx' | 'route' | 'system'; id: string }

export interface OpsEvent {
  id: string; seq: number; at: number; type: string; category: EventCategory; severity: Severity;
  subject: EventRef; related?: EventRef[]; summary: string; data?: Record<string, any>;
}

export interface FillLeg {
  venue: 'mesh' | 'cauldron' | 'solver';
  address?: string; ownerPkh?: string; contract?: string; strategy?: string;
  assetIn: string; assetOut: string; amountIn: string; amountOut: string;
}

export interface FillRecord {
  txid: string; method: FillMethod; routeKind?: string; filler: string;
  amountIn: string; required: string; gross: string; makerPaid: string;
  totalSurplus: string; userBonus: string; protocolShare: string; protocolPaid: string; frontendPaid: string; solverProfit: string;
  feeSats: string; latencySec: number | null;
  sources: { mesh: string; cauldron: string; solver: string };
  legs: FillLeg[]; reason?: string;
  /** rebuilt from the intent and pool ledger (fill made before records were kept): surplus unknown */
  derived?: boolean;
  /** filled by another party */
  external?: boolean;
}

export interface IntentView {
  id: string; intentId: string; type: 'dutch' | 'limit'; kind: IntentKind; intentType: string; status: IntentStatus;
  makerAddress: string; makerPkh?: string; contractAddress: string; contractName?: string; constructorArgs?: string[];
  fundingOutpoint?: string; sellToken: string; buyToken: string; sellAmount: string; buyAmount: string; minAmountOut: string;
  startBuyAmount?: string; endBuyAmount?: string; createdAt: number; expiryTimestamp: number; covenantDeadline: number; refundEligibleAt: number;
  startTime?: number; duration?: number; isSpent: boolean;
  fillTxid?: string; fillMethod?: FillMethod; fillSources?: { mesh: string; cauldron: string; solver: string };
  refundTxid?: string; closedTxid?: string; lastFillError?: string; lastRefundError?: string; unfillableSince?: number;
  explorerUrl?: string; userSurplusShareBps?: number; frontendPkh?: string; twapOrderId?: string; twapSliceIndex?: number;
  fundedAt?: number; filledAt?: number; funded?: boolean; fundedAmount?: string; fundingSats?: string;
  fillAttempts: number; refundAttempts: number; updatedAt?: number; fill?: FillRecord;
}

const asset = (a: string) => (a === 'BCH' ? '0x' : a);
/** Sell / buy asset of an intent view as '0x' | category. */
export const sellAsset = (i: Pick<IntentView, 'sellToken'>) => asset(i.sellToken);
export const buyAsset = (i: Pick<IntentView, 'buyToken'>) => asset(i.buyToken);

// ── Overview ─────────────────────────────────────────────────────────────────

export interface Alert { severity: 'error' | 'warn' | 'info'; code: string; title: string; detail: string; link?: string }
export interface RouteFlags { meshEnabled: boolean; solverEnabled: boolean; cauldronEnabled: boolean; lastUpdated: number; reason?: string }
/** A snapshot the server refreshes in the background. With `error` set, the numbers are from the last read that worked (`readAt`). */
export interface SolverWallet { ready: boolean; address: string | null; balanceSats: string | null; utxoCount: number; tokenUtxos: number; tokens: Record<string, string>; error: string | null; readAt?: number | null; readMs?: number | null; failures?: number }
export interface FillWindow { count: number; byMethod: Partial<Record<FillMethod, number>>; bchVolumeSats: string }
export interface Latency { count: number; avgSec: number | null; medianSec: number | null; p90Sec: number | null; maxSec: number | null }
export type AssetMap = Record<string, string>;
export interface Surplus { total: AssetMap; userBonus: AssetMap; protocolPaid: AssetMap; frontendPaid: AssetMap; solverProfit: AssetMap }
export interface IntentProblems { unfillable: number; failing: number; refund_failed: number; underfunded: number }

export interface Overview {
  network: 'chipnet' | 'mainnet'; now: number; startedAt: number; uptimeSec: number;
  chain: { mtp: number; finalLocktime: number; lagSec: number };
  solver: SolverWallet;
  routes: RouteFlags;
  intents: { total: number; byStatus: Record<string, number>; byKind: Record<string, number>; problems: IntentProblems; open: number; fillableNow: number; refundableNow: number };
  fills: { h24: FillWindow; d7: FillWindow; all: FillWindow; latency: Latency; surplus: Surplus; networkFeeSats: string; byVenue: Record<string, { legs: number; fills: number }> };
  refunds: { sweeper: Record<string, any>; refundedTotal: number; failing: number; refundableNow: number };
  pools: {
    activePools: number; totalPools: number; lpCount: number; tvlSats: string; volume24hSats: string; fees24hSats: string;
    poolFills24h: number; poolFillsTotal: number; intentFills24h: number; avgFillLatencySec: number | null; bchUsd: number | null;
    active: number; exhausted: number; closed: number; v3: number; v2: number; dirty: number; mirror: number;
  };
  strategies: { total: number; active: number; byTemplate: Record<string, number>; recycled: number; rebalanced: number; valueSats: string };
  twap: { total: number; byStatus: Record<string, number> };
  events: { h24: EventCounts; hourly: Array<{ hour: number; total: number } & Partial<Record<EventCategory, number>>>; latestSeq: number };
  series: {
    hourly: Array<{ t: number; created: number; filled: number; refunded: number }>;
    daily: Array<{ t: number; created: number; filled: number; refunded: number; bchVolumeSats: string } & Record<FillMethod, number>>;
  };
  /** the Mesh Balancer bot, as last reported (2026-10-06+) */
  balancer?: { seen: boolean; online: boolean; state: BalancerState | null; enabled: boolean; dryRun: boolean; profit24hSats: string; trades24h: number; balanceSats: string | null };
  alerts: Alert[];
  ws: { clients: number };
}

export interface EventCounts { byCategory: Record<string, number>; bySeverity: Record<string, number>; byType: Record<string, number>; total: number }

// ── Lists ────────────────────────────────────────────────────────────────────

export interface IntentList {
  total: number;
  counts: { byStatus: Record<string, number>; byKind: Record<string, number>; byMethod: Record<string, number>; problems: IntentProblems };
  intents: IntentView[];
}

export interface IntentDetail {
  intent: IntentView;
  fill: FillRecord | null;
  milestones: Array<{ at: number | null; type: string; label: string; detail?: string; txid?: string }>;
  events: OpsEvent[];
  refund: { eligible: boolean; covenantDeadline: number; chainMtp: number; refundEligibleAt?: number; refundAttempts: number; lastRefundError?: string };
  twap: TwapOrder | null;
  poolEvents: Array<{ pool: string; ownerPkh: string; strategy?: string; version: string; type: string; txid: string; time: number; amountIn?: string; amountOut?: string; recycledTo?: string }>;
  actions: { retry: boolean; refund: boolean };
}

export interface FillRow {
  intentId: string; kind: IntentKind; owner: string; ownerPkh?: string; sellToken: string; buyToken: string;
  sellAmount: string; minAmountOut: string; filledAt: number | null; createdAt: number; bchVolumeSats: string | null; twapOrderId?: string;
  fill: FillRecord;
}

export interface LpFillAgg { ownerPkh: string; legs: number; fills: number; pools: number; strategies: string[]; gave: AssetMap; received: AssetMap; lastFillAt: number | null }

export interface FillAggregates {
  count: number; derived: number; external: number; bchVolumeSats: string; networkFeeSats: string;
  byMethod: Record<string, { count: number; bchVolumeSats: string }>;
  byVenue: Record<string, { legs: number; fills: number }>;
  byFiller: Record<string, { fills: number; feeSats: string; solverProfit: AssetMap }>;
  surplus: Surplus; latency: Latency; byLp: LpFillAgg[];
}

export interface FillList { total: number; aggregates: FillAggregates; externalPoolFills: number; fills: FillRow[] }

export interface Trader {
  owner: string; ownerPkh?: string; intents: number; filled: number; refunded: number; open: number; kinds: Record<string, number>;
  fillRatePct: number | null; bchVolumeSats: string; twapOrders: number; firstAt: number; lastAt: number;
}

export type AdminPool = Pool & { version: 'V2' | 'V3'; dirty: boolean; eventCount: number };
export interface PoolList { total: number; counts: { byStatus: Record<string, number>; byVersion: Record<string, number>; byMode: Record<string, number> }; tvlSats: string; pools: AdminPool[] }

export type AdminLp = LpSummary & {
  v3Pools: number; mirrorPools: number; strategies: number;
  intentFills: { fills: number; legs: number; gave: AssetMap; received: AssetMap } | null;
  lastActivityAt: number | null;
};

export interface LpDetail {
  lp: LpSummary | null; pools: AdminPool[]; strategies: StrategySummary[]; idle: IdleItem[];
  fills: { aggregates: LpFillAgg | null; recent: FillRow[] };
  intents: IntentList; activity: PoolEvent[];
  daily: Array<{ day: number; volumeSats: string; feesSats: string; fills: number }>;
  events: OpsEvent[];
}

export interface StrategyList {
  total: number;
  byTemplate: Record<string, { count: number; active: number; valueSats: string; feesAllSats: string; fills: number }>;
  strategies: StrategySummary[];
}

export interface StrategyDetail {
  strategy: StrategySummary; pools: AdminPool[];
  lineage: { replaces: string[]; replacedBy: string | null; recycledFrom: string[]; recycledInto: string[] };
  fills: FillRow[]; activity: PoolEvent[];
  daily: Array<{ day: number; volumeSats: string; feesSats: string; fills: number }>;
  events: OpsEvent[];
}

export interface IdleAll {
  thresholds: { staleSec: number; offMidBps: number; dustSats: string };
  totalValueSats: string;
  byKind: Record<string, { count: number; valueSats: string }>;
  owners: Array<{ ownerPkh: string; count: number; valueSats: string }>;
  items: Array<IdleItem & { ownerPkh: string }>;
  computedAt: number;
}

export interface TwapOrder {
  orderId: string; status: 'COMPLETED' | 'PARTIALLY_FILLED' | 'REFUNDED' | 'AWAITING_FUNDING' | 'RUNNING';
  creatorAddress: string; creatorPkh?: string; tokenIn: string; tokenOut: string;
  numSlices: number; slicesFilled: number; slicesRefunded: number; slicesCompleted: number; totalAmountIn: string;
  slices: IntentView[]; createdAt?: number; lastFilledAt?: number | null;
}

export interface SystemInfo {
  network: string; port: number; node: string; pid: number; startedAt: number; uptimeSec: number;
  memory: { rssMb: number; heapUsedMb: number; heapTotalMb: number };
  chain: { mtp: number; finalLocktime: number; lagSec: number; height?: number | null; lastReadAt?: number | null; failedReads?: number };
  /** The loops that must keep running, and what watches them (absent on a server from before the stall alerts). */
  scanner?: { running: boolean; sweeping: boolean; intervalMs: number; sweeps: number; lastSweepAt: number | null; lastSweepMs: number; readsInLastSweep: number; errorsInLastSweep: number; unreadableSweeps: number; stalled: boolean };
  solverLoop?: { running: boolean; startedAt: number | null; cycles: number; lastCycleAt: number | null; lastCycleMs: number; lastFillAt: number | null; stalled: boolean };
  electrum?: { reconnects: number; reconnectsLast10Min: number };
  alerts?: { webhookConfigured: boolean; raised: Array<{ code: string; title: string; detail: string; since: number }> };
  orders?: { unfunded: number; clients: number; limitPerClient: number; limitTotal: number; archiveWatched: number; restoredFromArchive: number };
  security: { adminKeyConfigured: boolean; oracleSigning: boolean; oraclePubkey: string | null; treasuryPkh: string | null; trustProxy?: number | string | false };
  routing: { policy: string; meshPreferenceBps: string; protocolSurplusShareBps: string; protocolTakeCapBps: string; maxFillAttempts: number; maxFillLegs: number; v2Pools: boolean; flags: RouteFlags };
  solver: { scanIntervalMs: number; maxFillSats: string; minProfitSats: string; minProfitBps: number; maxSlippageBps: number; feePerByte: string; refund: Record<string, any> };
  idle: { staleSec: number; offMidBps: number; dustSats: string };
  store: { intents: number; pools: number; strategies: number; events: number; eventSeq: number; cauldronTokens: number | null; wsClients: number };
  persistence: Array<{ name: string; bytes: number | null; modifiedAt: number | null }>;
}

export interface RefundsReport {
  sweeper: Record<string, any>;
  summary: { totalOpen: number; totalRefundableNow: number; totalUnfillable: number; totalRefunded: number };
  refundableNow: IntentView[]; awaitingDeadline: IntentView[]; recentlyRefunded: IntentView[];
}

export interface SolverCycleReport { planned: number; filled: Array<{ intentId: string; method: string; txid: string }>; failed: Array<{ intentId: string; method: string; error: string }>; unfillable: Array<{ intentId: string; reason: string }> }

// ── Mesh Balancer bot (meshserver src/balancer/types.ts) ──────────────────────

export type BalancerKind = 'cauldron-buy' | 'cauldron-sell' | 'mesh-cross';
export type BalancerState = 'running' | 'paused' | 'dry-run' | 'idle-no-funds' | 'error' | 'stopped';
export type BalancerTradeResult = 'mempool' | 'confirmed' | 'rejected' | 'dry-run';

export interface BalancerConfig {
  enabled: boolean; dryRun: boolean;
  modes: { cauldron: boolean; meshCross: boolean; sameOwner: boolean };
  minProfitSats: string; dailyCapSats: string | null;
  denyTokens: string[]; denyPools: string[]; cycleMs: number; version: number; updatedAt: number; note?: string;
}
export interface BalancerPoolRef { address: string; ownerPkh: string; strategy?: string; role: 'buys-token' | 'sells-token'; satsPerToken: number; outpoint: string }
export interface BalancerOpportunity {
  id: string; key: string; at: number; kind: BalancerKind; token: string; pools: BalancerPoolRef[]; counterSatsPerToken: number;
  tokenAmount: string; bchReceived: string; bchPaid: string; grossSats: string; costSats: string; netSats: string;
  decision: 'taken' | 'skipped'; reason?: string; detail?: string; tradeId?: string;
}
export interface BalancerTxPart { index: number; role: 'mesh-pool' | 'cauldron-pool' | 'wallet' | 'proceeds' | 'change' | 'pad'; address?: string; sats: string; token?: { category: string; amount: string } }
export interface BalancerTrade {
  id: string; at: number; kind: BalancerKind; token: string; pools: BalancerPoolRef[]; tokenAmount: string; bchReceived: string; bchPaid: string;
  txid: string; sizeBytes: number; feeSats: string; carrierSats: string; plannedNetSats: string; realisedNetSats: string; latencyMs: number;
  result: BalancerTradeResult; error?: string; confirmedAt?: number; inputs: BalancerTxPart[]; outputs: BalancerTxPart[];
}
export interface BalancerWallet { address: string | null; balanceSats: string | null; utxoCount: number; tokens: Record<string, string>; utxos?: Array<{ txid: string; vout: number; sats: string; token?: { category: string; amount: string } }> }
export interface BalancerHeartbeat {
  at: number; state: BalancerState; error?: string; build: string; network: string; startedAt: number; cycles: number; lastCycleMs: number;
  poolsWatched: number; tokensWatched: number; electrumOk: boolean; cauldronOk: boolean; wallet: BalancerWallet; configVersion: number;
}
export interface BalancerWindow { trades: number; rejected: number; profitSats: string; feeSats: string; volumeSats: string }
export interface BalancerGroup { key: string; trades: number; profitSats: string; volumeSats: string }
export interface BalancerSummary {
  h24: BalancerWindow; d7: BalancerWindow; all: BalancerWindow; dryRunTrades: number;
  byKind: Record<BalancerKind, { trades: number; profitSats: string; volumeSats: string }>;
  byToken: BalancerGroup[]; byPool: BalancerGroup[]; byLp: BalancerGroup[];
  daily: Array<{ day: number; trades: number; rejected: number; profitSats: string; volumeSats: string }>;
  opportunities: { seen24h: number; taken24h: number; skipReasons: Record<string, number>; lostToExternal24h: number };
  latencyMs: { median: number | null; max: number | null };
  negativeTrades: number; requotesCaused: number;
}
export interface BalancerCommand { id: string; type: 'scan-now' | 'split-utxos'; at: number; args?: Record<string, unknown>; status: 'pending' | 'sent' | 'done' | 'failed'; message?: string }
export interface BalancerStatus {
  online: boolean; ingestEnabled: boolean; lastHeartbeatAt: number | null; heartbeat: BalancerHeartbeat | null; config: BalancerConfig; openCount: number;
  summary: BalancerSummary; recentTrades: BalancerTrade[]; commands: BalancerCommand[];
}
export interface BalancerOpportunityList { total: number; opportunities: BalancerOpportunity[]; open: BalancerOpportunity[]; lost: Array<{ at: number; address: string; txid: string; key: string }> }
export interface BalancerWalletView { online: boolean; wallet: BalancerWallet | null; lowBalanceSats: string; history: Array<{ at: number; sats: string; utxos: number }>; commands: BalancerCommand[] }
export type BalancerConfigPatch = Partial<Omit<BalancerConfig, 'modes' | 'version' | 'updatedAt'>> & { modes?: Partial<BalancerConfig['modes']> };

export type Query = Record<string, string | number | undefined | null>;

// ── Client ───────────────────────────────────────────────────────────────────

export function createAdminApi(baseUrl: string, getKey: () => string) {
  const base = baseUrl.replace(/\/+$/, '') + '/api/v1/admin';
  const qs = (q: Query = {}) => {
    const p = Object.entries(q).filter(([, v]) => v !== undefined && v !== null && v !== '');
    return p.length ? '?' + new URLSearchParams(p.map(([k, v]) => [k, String(v)])).toString() : '';
  };
  async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    headers['x-admin-key'] = getKey();
    const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
    if (!res.ok) throw new AdminApiError(res.status, json?.error ?? json?.result?.error ?? `${res.status} ${res.statusText}`);
    return json as T;
  }
  const get = <T>(path: string, q?: Query) => call<T>('GET', path + qs(q));
  const post = <T>(path: string, body: unknown = {}) => call<T>('POST', path, body);

  return {
    base,
    overview: () => get<Overview>('/overview'),
    events: (q?: Query) => get<{ events: OpsEvent[]; total: number; latestSeq: number; categories: EventCategory[]; counts24h: EventCounts }>('/events', q),
    intents: (q?: Query) => get<IntentList>('/intents', q),
    intent: (id: string) => get<IntentDetail>(`/intents/${encodeURIComponent(id)}`),
    fills: (q?: Query) => get<FillList>('/fills', q),
    traders: (q?: Query) => get<{ total: number; traders: Trader[] }>('/traders', q),
    pools: (q?: Query) => get<PoolList>('/pools', q),
    lps: () => get<{ total: number; lps: AdminLp[] }>('/lps'),
    lp: (owner: string) => get<LpDetail>(`/lps/${encodeURIComponent(owner)}`),
    strategies: (q?: Query) => get<StrategyList>('/strategies', q),
    strategy: (id: string) => get<StrategyDetail>(`/strategies/${encodeURIComponent(id)}`),
    idle: () => get<IdleAll>('/idle'),
    twaps: (q?: Query) => get<{ total: number; byStatus: Record<string, number>; orders: TwapOrder[] }>('/twap', q),
    twap: (id: string) => get<{ order: TwapOrder; events: OpsEvent[] }>(`/twap/${encodeURIComponent(id)}`),
    system: () => get<SystemInfo>('/system'),
    refunds: () => get<RefundsReport>('/refunds'),
    routes: () => get<{ routes: RouteFlags }>('/routes/status'),
    poolEvents: (address: string) => fetch(baseUrl.replace(/\/+$/, '') + `/api/v1/pools/${encodeURIComponent(address)}/activity`).then(r => r.json() as Promise<{ events: PoolEvent[] }>),
    // auth
    checkKey: (key: string) => fetch(base + '/auth/check', { headers: { 'x-admin-key': key } }).then(async r => {
      if (r.ok) return true;
      const j = await r.json().catch(() => null);
      throw new AdminApiError(r.status, j?.error ?? `${r.status}`);
    }),
    // actions
    retryIntent: (id: string) => post<{ intent: IntentView }>(`/intents/${encodeURIComponent(id)}/retry`),
    refundIntent: (id: string) => post<{ result: { status: string; txid?: string; error?: string }; intent: IntentView }>(`/intents/${encodeURIComponent(id)}/refund`),
    resyncPool: (address: string) => post<{ pool: Pool }>(`/pools/${encodeURIComponent(address)}/resync`),
    note: (text: string, subject?: string) => post<{ event: OpsEvent }>('/events/note', { text, subject }),
    setRoutes: (flags: Partial<Pick<RouteFlags, 'meshEnabled' | 'solverEnabled' | 'cauldronEnabled'>> & { reason?: string }) => post<{ routes: RouteFlags }>('/routes/control', flags),
    runSolverCycle: () => post<SolverCycleReport & { success: boolean }>('/trigger-match'),
    // Mesh Balancer bot
    balancer: () => get<BalancerStatus>('/balancer'),
    balancerTrades: (q?: Query) => get<{ total: number; trades: BalancerTrade[] }>('/balancer/trades', q),
    balancerTrade: (id: string) => get<{ trade: BalancerTrade; events: OpsEvent[] }>(`/balancer/trades/${encodeURIComponent(id)}`),
    balancerOpportunities: (q?: Query) => get<BalancerOpportunityList>('/balancer/opportunities', q),
    balancerWallet: () => get<BalancerWalletView>('/balancer/wallet'),
    balancerConfig: () => get<{ config: BalancerConfig; appliedVersion: number | null; history: OpsEvent[] }>('/balancer/config'),
    setBalancerConfig: (patch: BalancerConfigPatch & { note?: string }) => post<{ config: BalancerConfig }>('/balancer/config', patch),
    pauseBalancer: (reason?: string) => post<{ config: BalancerConfig }>('/balancer/pause', { reason }),
    resumeBalancer: () => post<{ config: BalancerConfig }>('/balancer/resume'),
    balancerCommand: (type: BalancerCommand['type'], args: Record<string, unknown> = {}) => post<{ command: BalancerCommand }>('/balancer/command', { type, ...args }),
    sweepRefunds: () => post<{ message: string; results: Array<{ intentId: string; refundTxid: string | null; status: string; error: string | null }> }>('/refunds/sweep'),
  };
}

export type AdminApi = ReturnType<typeof createAdminApi>;
export type { PoolStatus };
