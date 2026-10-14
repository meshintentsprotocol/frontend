/**
 * Typed client for the swap server's operator API (arc-cctp/cctp-swap-server, src/adminRoutes.ts).
 *
 * One server, two products: cross-chain USDC through Circle CCTP (/admin/cctp/*) and Solana swaps through
 * Jupiter (/admin/solana/*). Every request sends x-admin-key. Amounts are base-unit strings; the server adds a
 * `display` object with the human-readable values.
 */
import type { BchSwapRecord, BchToken } from '@/swap-server/types';

export class SwapApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export type Section = 'cctp' | 'solana' | 'lend' | 'system' | 'bch';
export type Severity = 'info' | 'success' | 'warn' | 'error';

export interface SwapEvent {
  seq: number; at: number; section: Section; type: string; severity: Severity; summary: string;
  subject?: { kind: 'transfer' | 'swap' | 'chain' | 'settings' | 'token'; id: string };
  data?: Record<string, unknown>;
}

export interface Alert { severity: 'error' | 'warn'; section: Section; text: string }
export interface HourBucket { t: number; created: number; completed: number; failed: number }

// ── cross-chain USDC ─────────────────────────────────────────────────────────

export type TransferStatus = 'CREATED' | 'BURN_SUBMITTED' | 'BURN_CONFIRMED' | 'ATTESTED' | 'MINT_SUBMITTED' | 'COMPLETED' | 'COMPLETED_EXTERNAL' | 'FAILED' | 'EXPIRED';

export interface Transfer {
  id: string; origin: 'api' | 'track'; src: string; dst: string; srcDomain: number; dstDomain: number;
  sender: string; recipient: string; recipientTokenAccount?: string;
  amount: string; grossAmount?: string; protocolFee?: string; feeRecipient?: string; feeTxHash?: string;
  feeStatus?: 'none' | 'pending' | 'paid' | 'unpaid' | 'awaiting'; feePaidAt?: number; relayCost?: { amount: string; symbol: string };
  speed: 'fast' | 'standard'; maxFee: string; feeBps: number; expectedFee: string; expectedReceive: string;
  status: TransferStatus; burnTxHash?: string; nonce?: string; message?: string; attestation?: string;
  mintTxHash?: string; mintTxHashes?: string[]; feeExecuted?: string; received?: string;
  failCount: number; retryAfter?: number; lastError?: string; failReason?: string;
  createdAt: number; updatedAt: number; burnSubmittedAt?: number; burnConfirmedAt?: number; attestedAt?: number; mintSubmittedAt?: number; completedAt?: number;
  display: { amount: string; grossAmount: string; protocolFee: string; expectedFee: string; expectedReceive: string; received?: string };
  links: { burn?: string; mint?: string };
  selfMint?: { chain: string; contract: string; method: string; message: string; attestation: string };
}

export interface CctpSettings {
  paused: boolean; pauseReason?: string; relayEnabled: boolean; fastEnabled: boolean;
  minTransferUsdc: number; maxTransferUsdc: number; feeBufferPct: number; disabledChains: string[]; disabledRoutes: string[];
  feeBps: number; feeMinUsdc: number; feeMaxUsdc: number; gasFeeUsdc: Record<string, number>; feeEnforced: boolean;
}

export interface RelayerBalance { chain: string; name: string; kind: string; relayer?: string; amount?: string; symbol?: string; usdc?: string; low?: boolean; error?: string; at: number }

export interface ChainRow {
  key: string; name: string; kind: 'evm' | 'solana'; domain: number; chainId?: number; usdc: string;
  fastSource: boolean; standardEtaSec: number; fastEtaSec?: number; open: boolean; rpcHost: string; relayer?: RelayerBalance;
}

export interface CctpStats {
  total: number; byStatus: Record<string, number>; active: number; awaitingBurn: number; completed: number; failed: number; expired: number;
  successRate: number | null; volume: string; received: string; fees: string;
  last24h: { created: number; completed: number; failed: number; volume: string };
  timingSec: { burnToConfirmed: number | null; confirmedToAttested: number | null; attestedToMinted: number | null; total: number | null };
  byRoute: Array<{ route: string; src: string; dst: string; count: number; completed: number; failed: number; volume: string; medianSec: number | null }>;
  stuck: string[]; retrying: number; hourly: HourBucket[];
}

// ── Solana swaps ─────────────────────────────────────────────────────────────

export type SwapStatus = 'CREATED' | 'SUBMITTED' | 'COMPLETED' | 'FAILED' | 'EXPIRED';

export interface SolanaSwap {
  id: string; taker: string; receiver?: string; inputMint: string; outputMint: string;
  inAmount: string; quotedOutAmount: string; minOutAmount: string; slippageBps: number; feeBps: number; feeMint?: string;
  router: string; gasless: boolean; requestId: string; inUsdValue?: number; inSymbol?: string; outSymbol?: string;
  referralFeeBps?: number; referralAccount?: string; feeCollected?: { mint: string; total: string; ours: string };
  status: SwapStatus; signature?: string; inAmountSpent?: string; outAmount?: string; jupiterCode?: number; failReason?: string;
  createdAt: number; updatedAt: number; submittedAt?: number; completedAt?: number; terminal: boolean;
  display: { inAmount?: string; quotedOutAmount?: string; minOutAmount?: string; outAmount?: string; inSymbol?: string; outSymbol?: string };
  links: { tx?: string };
}

export interface SolanaSettings {
  paused: boolean; pauseReason?: string; stocksEnabled: boolean; allowUnverified: boolean;
  maxSlippageBps: number; defaultSlippageBps: number; maxSwapUsd: number; minStockLiquidityUsd: number; referralFeeBps: number;
  stocksFeeBps: number | null; stablesFeeBps: number | null; referralAccount: string; blockedMints: string[];
}

export interface SolanaStats {
  total: number; byStatus: Record<string, number>; active: number; submitted: number; completed: number; failed: number; expired: number;
  successRate: number | null; volumeUsd: number; gasless: number;
  last24h: { created: number; completed: number; failed: number; volumeUsd: number };
  medianLandSec: number | null;
  byPair: Array<{ pair: string; inputMint: string; outputMint: string; inSymbol?: string; outSymbol?: string; count: number; completed: number; failed: number; volumeUsd: number }>;
  byRouter: Record<string, number>; failReasons: Array<{ reason: string; count: number }>; hourly: HourBucket[];
}

export interface JupiterStatus {
  requests: number; errors: number; rateLimited: number; lastError?: string; lastErrorAt?: number; lastOkAt?: number; lastLatencyMs?: number;
  rps: number; apiKey: boolean; queueMs: number; baseUrl: string; referralAccount: string | null;
}

export interface CatalogStatus { ready: boolean; tokens: number; ageSec?: number; stocks: number; issuers: Record<string, number> }

export interface TokenView {
  mint: string; symbol: string; name: string; icon?: string; decimals: number; verified: boolean; suspicious: boolean; tags: string[];
  isStock: boolean; stockIssuer?: string; hasFreezeAuthority: boolean; usdPrice?: number; priceChange24h?: number; volume24h?: number; liquidity?: number; mcap?: number; holderCount?: number;
}

// ── shared ───────────────────────────────────────────────────────────────────

export interface SwapOverview {
  network: { cctp: string; solana: string }; uptimeSec: number; alerts: Alert[];
  cctp: { settings: CctpSettings; stats: CctpStats; chains: ChainRow[]; balancesAgeSec?: number };
  solana: { settings: SolanaSettings; stats: SolanaStats; enabled: boolean; network: string; jupiter: JupiterStatus; catalog: CatalogStatus; rpcHost: string };
  events: { h24: Record<Severity, number>; recent: SwapEvent[] };
}

export interface BchSettings {
  enabled: boolean;
  paused: boolean;
  pauseReason?: string;
  feeBps: number;
  feeRecipientNear: string;
  minSwapUsd: number;
  maxSwapUsd: number;
}

export interface AllSettings { cctp: CctpSettings; solana: SolanaSettings; bch?: BchSettings; updatedAt: number }
export interface SettingsView {
  settings: AllSettings;
  env: { referralAccount: string | null; chains: Array<{ key: string; name: string }>; defaults: { minTransferUsdc: number; maxTransferUsdc: number; feeBufferPct: number; maxSlippageBps: number } };
  history: SwapEvent[];
}
export interface SettingsPatch { cctp?: Partial<CctpSettings>; solana?: Partial<SolanaSettings>; bch?: Partial<BchSettings>; note?: string }

export interface SystemInfo {
  uptimeSec: number; node: string; memoryMb: number; port: number; dataDir: string; secrets: string[];
  cctp: { network: string; irisBaseUrl: string; worker: Record<string, number>; limits: Record<string, number>; watchdog: Record<string, number> };
  solana: { enabled: boolean; jupiter: JupiterStatus; catalog: CatalogStatus; rpcHost: string; orderTtlSec: number; landTimeoutSec: number; tokenRefreshMin: number };
}

// ── profits and treasury ─────────────────────────────────────────────────────

export interface WalletBalance { chain: string; name: string; usdc?: string; native?: string; symbol?: string; error?: string }
export interface TreasuryWallet {
  id: string; kind: 'evm' | 'solana'; address: string; label: string; origin: 'generated' | 'external';
  active: boolean; archived: boolean; createdAt: number; hasKey: boolean; balances: WalletBalance[];
}
export interface ReferralTokenAccount { mint: string; symbol?: string; decimals?: number; address: string; exists: boolean; balance: string }
export interface ReferralStatus { account?: string; exists: boolean; partner?: string; name?: string; tokenAccounts: ReferralTokenAccount[]; error?: string }
export interface ProfitStats {
  cctp: {
    paid: string; paidCount: number; unpaid: string; unpaidCount: number; awaiting: string; awaitingCount: number;
    last24h: { paid: string; count: number }; byChain: Array<{ chain: string; count: number; fees: string }>;
    relayCost: Record<string, number>; relayed: number;
  };
  solana: { swapsWithFee: number; estimatedUsd: number; last24h: { estimatedUsd: number; count: number }; byMint: Array<{ mint: string; count: number; total: string; ours: string }> };
  daily: Array<{ day: number; cctpFees: string; cctpCount: number; solanaUsd: number; solanaCount: number }>;
}
export interface ProfitsView {
  stats: ProfitStats;
  bchStats?: {
    totalSwaps: number;
    successfulSwaps: number;
    totalVolumeUsd: number;
    totalProfitUsd: number;
  };
  margins: {
    cctp: Pick<CctpSettings, 'feeBps' | 'feeMinUsdc' | 'feeMaxUsdc' | 'gasFeeUsdc' | 'feeEnforced'>;
    solana: { referralFeeBps: number; stocksFeeBps: number | null; stablesFeeBps: number | null; referralAccount: string | null };
    bch?: { feeBps: number; feeRecipientNear: string; minSwapUsd: number; maxSwapUsd: number };
  };
  collecting: { evm: boolean; solanaCctp: boolean; jupiter: boolean; bch?: boolean };
  treasury: TreasuryWallet[];
  referral: ReferralStatus;
  history: SwapEvent[];
}

// ── lending ──
/** A loan as the swap server's /lend API describes it. Amounts are base-unit strings. */
export interface LendLoan {
  ref: string; provider: string; phase: string;
  status: { operation: string; state: string; confirmations: number | null; requiredConfirmations: number | null };
  collateral: { asset: string; chain: string; decimals: number; amount: string };
  borrow: { asset: string; chain: string; decimals: number; amount: string; destination: string };
  refundDestination: string;
  deposit: { amount: string; targets: { chain: string; address: string; amount: string; feeAmount: string }[]; expiresAt: number | null; detectedAt: number | null };
  repayment: { debt: string; targets: { chain: string; address: string; amount: string; feeAmount: string }[] };
  position: { collateral: string; borrowed: string; interest: string; totalDebt: string };
  ltvBps: number; liquidationThresholdBps: number; liquidationPrice: number; borrowApy: number; createdAt: number; updatedAt: number;
}
export interface LendSettings { paused: boolean; pauseReason: string; maxBorrowUsd: number; warnLtvBps: number }
export interface LendOverview {
  total: number; active: number; byPhase: Record<string, number>; collateralUsd: number; debtUsd: number; averageLtvBps: number;
  atRisk: LendLoan[]; settings: LendSettings; provider: { name: string; lastOkAt: number | null; lastError: string | null };
}
export interface LendLoanRecord { ref: string; loanId: string; view: LendLoan; addresses: string[]; history: { at: number; phase: string; state: string }[]; createdAt: number; updatedAt: number }

export interface AdminLendUserSummary {
  profileId: string;
  primaryAddress: string;
  wallets: { address: string; chain: string; addedAt: number }[];
  createdAt: number;
  lastSeenAt: number;
  notes?: string;
  portfolio?: {
    suppliedUsd: number;
    borrowedUsd: number;
    netValueUsd: number;
    netApy: number;
    healthFactor: number | null;
    healthPct: number;
    suppliedCount: number;
    borrowedCount: number;
  };
  loansCount: number;
}

export interface AdminLendUsersResponse {
  total: number;
  offset: number;
  limit: number;
  stats: {
    totalUsers: number;
    activeBorrowers: number;
    totalSuppliedUsd: number;
    totalBorrowedUsd: number;
    atRiskCount: number;
  };
  users: AdminLendUserSummary[];
}

export interface AdminLendUserDetail {
  profile: {
    profileId: string;
    primaryAddress: string;
    wallets: { address: string; chain: string; addedAt: number }[];
    createdAt: number;
    lastSeenAt: number;
    notes?: string;
  };
  portfolio: {
    profileId: string;
    supplied: { asset: string; poolId: string; amount: string; usd: number; apy: number; interest: string }[];
    borrowed: { asset: string; poolId: string; amount: string; usd: number; apy: number; interest: string }[];
    suppliedUsd: number;
    borrowedUsd: number;
    healthPct: number;
    healthFactor: number | null;
    netApy: number;
    netValueUsd: number;
    netInterestUsd: number;
    borrowable: Record<string, string>;
    wallet: Record<string, string>;
  };
  loans: LendLoan[];
  events?: SwapEvent[];
}

export type Query = Record<string, string | number | undefined | null>;

export function createSwapAdminApi(baseUrl: string, getKey: () => string) {
  const base = baseUrl.replace(/\/+$/, '');
  const qs = (q: Query = {}) => {
    const p = Object.entries(q).filter(([, v]) => v !== undefined && v !== null && v !== '');
    return p.length ? '?' + new URLSearchParams(p.map(([k, v]) => [k, String(v)])).toString() : '';
  };
  async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown, key = getKey()): Promise<T> {
    const headers: Record<string, string> = { 'x-admin-key': key };
    if (body !== undefined) headers['content-type'] = 'application/json';
    let res: Response;
    try { res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }); }
    catch { throw new SwapApiError(0, `Swap server unreachable at ${base}`); }
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
    if (!res.ok) throw new SwapApiError(res.status, json?.error ?? `${res.status} ${res.statusText}`);
    return json as T;
  }
  const get = <T>(path: string, q?: Query) => call<T>('GET', path + qs(q));
  const post = <T>(path: string, body: unknown = {}) => call<T>('POST', path, body);
  const id = encodeURIComponent;

  return {
    base,
    checkKey: (key: string) => call<{ ok: true }>('GET', '/admin/auth/check', undefined, key),
    overview: () => get<SwapOverview>('/admin/overview'),
    events: (q?: Query) => get<{ total: number; latestSeq: number; events: SwapEvent[] }>('/admin/events', q),
    note: (text: string, section?: Section) => post<{ event: SwapEvent }>('/admin/events/note', { text, section }),
    settings: () => get<SettingsView>('/admin/settings'),
    setSettings: (patch: SettingsPatch) => post<{ settings: AllSettings; changed: string[] }>('/admin/settings', patch),
    resetSettings: (section: 'cctp' | 'solana' | 'bch') => post<{ settings: AllSettings }>('/admin/settings/reset', { section }),
    system: () => get<SystemInfo>('/admin/system'),
    // lending
    lendOverview: () => get<LendOverview>('/admin/lend/overview'),
    lendLoans: (q?: Query) => get<{ total: number; offset: number; limit: number; loans: LendLoan[] }>('/admin/lend/loans', q),
    lendLoan: (ref: string) => get<LendLoanRecord>(`/admin/lend/loans/${id(ref)}`),
    refreshLendLoan: (ref: string) => post<LendLoanRecord>(`/admin/lend/loans/${id(ref)}/refresh`),
    setLendSettings: (patch: Record<string, unknown>) => post<{ changed: string[]; settings: LendSettings }>('/admin/lend/settings', patch),
    lendUsers: (q?: Query) => get<AdminLendUsersResponse>('/admin/lend/users', q),
    lendUser: (profileId: string) => get<AdminLendUserDetail>(`/admin/lend/users/${id(profileId)}`),
    trackLendUser: (addressOrProfileId: string) => post<AdminLendUserDetail>('/admin/lend/users/track', { addressOrProfileId }),
    setLendUserNotes: (profileId: string, notes: string) => post<{ profileId: string; notes: string }>(`/admin/lend/users/${id(profileId)}/notes`, { notes }),
    // cross-chain USDC
    transfers: (q?: Query) => get<{ total: number; offset: number; limit: number; byStatus: Record<string, number>; transfers: Transfer[] }>('/admin/cctp/transfers', q),
    transfer: (tid: string) => get<{ transfer: Transfer; events: SwapEvent[] }>(`/admin/cctp/transfers/${id(tid)}`),
    balances: (fresh = false) => get<{ balances: RelayerBalance[]; ageSec?: number }>('/admin/cctp/balances', { fresh: fresh ? 1 : undefined }),
    pauseCctp: (reason?: string) => post<{ paused: boolean }>('/admin/cctp/pause', { reason }),
    resumeCctp: () => post<{ paused: boolean }>('/admin/cctp/resume'),
    setChain: (key: string, open: boolean) => post<{ chain: string; open: boolean }>(`/admin/cctp/chains/${id(key)}`, { open }),
    setRoute: (src: string, dst: string, open: boolean) => post<{ route: string; open: boolean }>('/admin/cctp/routes', { src, dst, open }),
    retryTransfer: (tid: string) => post<Transfer>(`/admin/cctp/transfers/${id(tid)}/retry`),
    failTransfer: (tid: string, reason?: string) => post<Transfer>(`/admin/cctp/transfers/${id(tid)}/fail`, { reason }),
    reopenTransfer: (tid: string) => post<Transfer>(`/admin/cctp/transfers/${id(tid)}/reopen`),
    trackBurn: (src: string, txHash: string) => post<Transfer>('/admin/cctp/track', { src, txHash }),
    // Solana swaps
    swaps: (q?: Query) => get<{ total: number; offset: number; limit: number; byStatus: Record<string, number>; swaps: SolanaSwap[] }>('/admin/solana/swaps', q),
    swap: (sid: string) => get<{ swap: SolanaSwap; tokens: { input: TokenView | null; output: TokenView | null }; events: SwapEvent[] }>(`/admin/solana/swaps/${id(sid)}`),
    recheckSwap: (sid: string) => post<SolanaSwap>(`/admin/solana/swaps/${id(sid)}/recheck`),
    pauseSolana: (reason?: string) => post<{ paused: boolean }>('/admin/solana/pause', { reason }),
    resumeSolana: () => post<{ paused: boolean }>('/admin/solana/resume'),
    refreshTokens: () => post<CatalogStatus>('/admin/solana/tokens/refresh'),
    blockToken: (mint: string, blocked: boolean) => post<{ blockedMints: Array<{ mint: string; symbol?: string; name?: string }> }>('/admin/solana/tokens/block', { mint, blocked }),
    blockedTokens: () => get<{ blockedMints: Array<{ mint: string; symbol?: string; name?: string }> }>('/admin/solana/tokens/blocked'),
    // profits, treasury wallets, Jupiter referral account
    profits: (fresh = false) => get<ProfitsView>('/admin/profits', { fresh: fresh ? 1 : undefined }),
    createWallet: (w: { kind: 'evm' | 'solana'; label?: string; address?: string }) => post<{ wallet: TreasuryWallet }>('/admin/treasury/wallets', w),
    activateWallet: (wid: string) => post<{ wallet: TreasuryWallet }>(`/admin/treasury/wallets/${id(wid)}/activate`),
    archiveWallet: (wid: string) => post<{ wallet: TreasuryWallet }>(`/admin/treasury/wallets/${id(wid)}/archive`),
    createReferral: (name: string) => post<{ account: string; signature: string }>('/admin/solana/referral/create', { name }),
    addReferralAccounts: (mint?: string) => post<{ status: ReferralStatus }>('/admin/solana/referral/token-accounts', { mint }),
    claimReferral: () => post<{ signatures: string[] }>('/admin/solana/referral/claim'),
    // public catalog routes (no key needed), used by the token browser
    tokens: (q?: Query) => get<{ total: number; offset: number; limit: number; tokens: TokenView[] }>('/solana/tokens', q),
    stocks: (q?: Query) => get<{ total: number; offset: number; limit: number; issuers: Record<string, number>; tokens: TokenView[] }>('/solana/stocks', q),
    searchTokens: (q: string) => get<{ tokens: TokenView[] }>('/solana/tokens/search', { q }),
    // Bitcoin Cash cross-chain swaps (1Click NEAR Intents)
    bchSwaps: (q?: Query) => get<{ swaps: BchSwapRecord[]; count: number }>('/bch/swaps', q),
    bchSwap: (sid: string) => get<BchSwapRecord>(`/bch/swaps/${id(sid)}`),
    bchTokens: (chain?: string) => get<{ tokens: BchToken[]; count: number }>('/bch/tokens', { chain }),
    bchQuote: (q: { fromAsset: string; toAsset: string; amount: string; fromChain?: string; toChain?: string }) => get<any>('/bch/quote', q),
    submitBchDepositTx: (sid: string, txHash: string) => post<BchSwapRecord>(`/bch/swaps/${id(sid)}/deposit-tx`, { txHash }),
    pauseBch: (reason?: string) => post<{ changed: string[]; settings: AllSettings }>('/admin/settings', { bch: { paused: true, pauseReason: reason }, note: 'BCH pause from admin console' }),
    resumeBch: () => post<{ changed: string[]; settings: AllSettings }>('/admin/settings', { bch: { paused: false, pauseReason: '' }, note: 'BCH resume from admin console' }),
  };
}

export type SwapAdminApi = ReturnType<typeof createSwapAdminApi>;
