/**
 * Borrow & supply: the shapes the pages work with.
 *
 * `Market`, `LendQuote` and `LoanView` are what the swap server's /lend/* API returns (see
 * arc-cctp/cctp-swap-server/src/lend/types.ts): amounts are decimal strings of base units (satoshis, 6-decimal
 * USDC), limits are basis points, rates are plain percents. The demo provider produces the same shapes, so a page
 * cannot tell a demo loan from a real one except by `provider`.
 */

export interface Market {
    poolId: string;
    asset: string;
    chain: string;
    name: string;
    decimals: number;
    priceUsd: number;
    /** Percent per year, e.g. 4.68. */
    supplyApy: number;
    borrowApy: number;
    /** 0 to 100. */
    utilization: number;
    availableLiquidity: string;
    totalSupply: string;
    totalDebt: string;
    maxLtvBps: number;
    liquidationThresholdBps: number;
    liquidationBonusBps: number;
    activationFeeBps: number;
    frozen: boolean;
}

export interface QuoteRequest {
    collateralAsset: string;
    borrowAsset: string;
    collateralAmount: string;
    borrowAmount: string;
    /** Safety buffer under the pool's maximum LTV, in bps. */
    ltvBufferBps?: number;
}

export interface LendQuote {
    collateral: { asset: string; chain: string; amount: string; usd: number };
    borrow: { asset: string; chain: string; amount: string; usd: number };
    ltvBps: number;
    maxLtvBps: number;
    liquidationThresholdBps: number;
    activationFee: string;
    /** What is owed the moment the loan opens: the amount borrowed plus the activation fee. */
    openingDebt: string;
    borrowApy: number;
    /** Price of the collateral asset, in USD, at which the loan can be liquidated. */
    liquidationPrice: number;
    collateralPrice: number;
    errors: string[];
}

export interface CreateLoanRequest extends QuoteRequest {
    /** Where the borrowed funds are sent. */
    borrowDestination: string;
    /** Where the collateral returns after repayment. */
    refundDestination: string;
    depositWindowMinutes?: number;
}

export type LoanPhase = 'awaiting_deposit' | 'confirming' | 'active' | 'repaying' | 'closed' | 'expired' | 'failed' | 'liquidated';
export const OPEN_PHASES: LoanPhase[] = ['awaiting_deposit', 'confirming', 'active', 'repaying'];

export interface LoanTarget { chain: string; address: string; amount: string; feeAmount: string }

export interface LoanView {
    ref: string;
    provider: 'liquidium' | 'demo';
    phase: LoanPhase;
    status: { operation: string; state: string; confirmations: number | null; requiredConfirmations: number | null };
    collateral: { asset: string; chain: string; decimals: number; amount: string };
    borrow: { asset: string; chain: string; decimals: number; amount: string; destination: string };
    refundDestination: string;
    deposit: { amount: string; targets: LoanTarget[]; expiresAt: number | null; detectedAt: number | null };
    repayment: { debt: string; targets: LoanTarget[] };
    position: { collateral: string; borrowed: string; interest: string; totalDebt: string };
    ltvBps: number;
    liquidationThresholdBps: number;
    liquidationPrice: number;
    borrowApy: number;
    createdAt: number;
    updatedAt: number;
}

// ── Advanced mode: one account that supplies and borrows across pools ──

export interface Position {
    asset: string;
    /** Base units. */
    amount: string;
    usd: number;
    apy: number;
    /** Interest earned (supplied) or accrued (borrowed), base units. */
    interest: string;
}

export interface Portfolio {
    supplied: Position[];
    borrowed: Position[];
    suppliedUsd: number;
    borrowedUsd: number;
    /** 0 to 100. 100 is no debt; 0 is the liquidation point. */
    healthPct: number;
    netApy: number;
    netValueUsd: number;
    netInterestUsd: number;
    /** Wallet balances available to supply, base units by asset. */
    wallet: Record<string, string>;
    /** What can still be borrowed of each asset, base units. */
    borrowable: Record<string, string>;
}

export interface AdvancedReceipt { asset: string; amount: string; usd: number; etaMinutes: number; txid: string }

/** How Simple-mode fees and timings are described next to the form. */
export interface ChainInfo { confirmations: number; minutes: number; networkFee: string }

export const CHAIN_INFO: Record<string, ChainInfo> = {
    BTC: { confirmations: 4, minutes: 40, networkFee: '~0.000002 BTC' },
    ETH: { confirmations: 64, minutes: 15, networkFee: '~0.21 USDC' },
    ICP: { confirmations: 1, minutes: 1, networkFee: '~0.0001 ICP' },
};
