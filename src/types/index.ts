// Token Types
export interface Token {
    symbol: string;
    name: string;
    icon: string;
    decimals: number;
    type: string;
    chain?: 'bch' | 'solana' | 'ethereum' | 'bsc' | 'base' | 'arbitrum' | 'optimism' | 'arc' | 'movement' | 'xmr';
    categoryId?: string;  // BCH CashToken category ID (hex)
    address?: string;     // Token mint or smart contract address
    priceUsd?: number;    // Cauldron price in USD (for CashTokens)
    priceSats?: number;   // Cauldron price in sats (for CashTokens)
    disabled?: boolean;   // true = not selectable (chain not yet deployed)
    comingSoon?: boolean; // shows "Soon" badge
    /** Set on tokens that come from the swap server (src/swap-server): they trade only through that server. */
    swapServer?: {
        product: 'cctp' | 'jupiter';
        chainKey?: string;     // cctp: the server's chain key, e.g. 'base-sepolia'
        verified?: boolean;    // jupiter: on Jupiter's verified list
        suspicious?: boolean;  // jupiter: flagged by Jupiter
        isStock?: boolean;     // jupiter: a tokenized stock
    };
}

// Oracle Types
export interface PriceData {
    id: string;
    price: string;
    conf: string;
    expo: number;
    publish_time: number;
}

// Swap Types
export interface SwapParams {
    sellToken: string; // e.g. "0x1::aptos_coin::AptosCoin"
    buyToken: string;
    sellAmount: number;
    buyAmount: number; // Minimum receive
    slippage: number; // %
    sellDecimals: number; // Token decimals for sell token
    buyDecimals: number; // Token decimals for buy token
    duration?: number; // Optional duration in seconds
    isLimitOrder?: boolean; // If true, treat as fixed price limit order
}

export type BCHSwapType = 'same-chain' | 'bch-to-sol' | 'sol-to-bch' | 'bch-to-mov' | 'mov-to-bch' | 'sol-to-mov' | 'mov-to-sol' | 'bch-to-xmr' | 'xmr-to-bch' | 'eth-to-bch' | 'bch-to-eth';
export type BCHOrderType = 'market' | 'limit' | 'twap';

export interface BCHSwapParams {
    sellToken: Token;
    buyToken: Token;
    sellAmount: number;
    buyAmount: number;
    swapType: BCHSwapType;
    orderType: BCHOrderType;
    duration?: number;     // Dutch auction duration (seconds)
    expiryTime?: number;   // Limit order expiry (unix timestamp)
    twap?: {
        numSlices: number;
        intervalSec: number;
        maxPricePerUnit?: string;
    };
    xmr?: {
        viewKey: string;
        spendKey: string;
    };
}

// ── TWAP Interfaces ─────────────────────────────────────────────────────────
// Shapes returned by the Mesh server's /api/v1/twap routes: a TWAP order is N
// Dutch-auction slice intents, each filled or refunded on its own.

/** One slice: the server's intent view (the fields the UI uses). */
export interface TwapSliceView {
    intentId:          string;
    status:            string;   // awaiting_funding | funded | filled | refunded | refund_pending | …
    sellAmount:        string;
    minAmountOut:      string;
    startBuyAmount?:   string;
    endBuyAmount?:     string;
    startTime?:        number;
    /** Unix seconds: when the slice intent was created. */
    createdAt?:        number;
    duration?:         number;
    refundEligibleAt:  number;
    fillTxid?:         string;
    fillMethod?:       string;
    fillSources?:      { mesh: string; cauldron: string; solver: string };
    refundTxid?:       string;
    explorerUrl?:      string;
    lastFillError?:    string;
    twapSliceIndex?:   number;
}

export interface TwapOrderRecord {
    orderId:          string;
    status:           'AWAITING_FUNDING' | 'RUNNING' | 'COMPLETED' | 'PARTIALLY_FILLED' | 'REFUNDED';
    creatorAddress:   string;
    creatorPkh:       string;
    tokenIn:          string;
    tokenOut:         string;
    numSlices:        number;
    slicesFilled:     number;
    slicesRefunded:   number;
    totalAmountIn:    string;
    slices:           TwapSliceView[];
    /** Only in the submit response. */
    intervalSec?:     number;
    sliceWindowSec?:  number;
    funding?:         Array<{ to: string; satoshis: string; token?: { category: string; amount: string } }>;
}

/**
 * Order status.
 *
 * `expired` and `abandoned` mirror the CashToken relayer's own states and are easy
 * to get wrong, so note what they mean:
 *
 *   expired    Past its fill window; the relayer has attempted the refund but it
 *              has not broadcast yet, and it keeps retrying. **Not terminal** — the
 *              order still becomes `refunded`. Treating it as final leaves the user
 *              looking at "Expired" while their money is on its way back.
 *   abandoned  Created, handed a covenant address, and never funded before the
 *              relayer's funding deadline. Terminal; nothing will ever arrive.
 *   failed     Repeated execution failures. The covenant is still FUNDED and the
 *              relayer is still retrying on backoff, so this is not terminal either.
 */
export type BCHOrderStatus =
    | 'pending' | 'source_locked' | 'proving' | 'claimable' | 'claimed'
    | 'filled' | 'cancelled' | 'expired' | 'refunded' | 'failed' | 'abandoned'
    | 'unknown';   // relayer no longer has a record of it (see notes on 404 handling)

/**
 * Statuses that are done forever — safe to stop polling.
 *
 * Everything else is derived from this rather than listed separately: two
 * hand-written lists of the same concept drift, and a status missing from one of
 * them either stops polling an order that is still moving or polls a settled one
 * forever. Both happened.
 */
export const TERMINAL_ORDER_STATUSES: ReadonlySet<BCHOrderStatus> = new Set<BCHOrderStatus>([
    'filled', 'claimed', 'cancelled', 'refunded', 'abandoned',
    // The relayer has no record of it (aged out of its 500-entry ring buffer), so
    // there is nothing left to poll — even though it is not a settlement as such.
    'unknown',
]);

export const isTerminalOrderStatus = (s: BCHOrderStatus): boolean =>
    TERMINAL_ORDER_STATUSES.has(s);

/**
 * Split orders into still-in-flight and settled.
 *
 * Derived from TERMINAL_ORDER_STATUSES so the two sets cannot disagree. The
 * previous inline form — `status === 'pending' || status === 'claimable'` — was
 * copied to five call sites and filed `expired`, `failed`, `source_locked` and
 * `proving` under "completed", even though all four are orders still moving.
 */
export function splitOrders(orders: BCHOrder[]): { pending: BCHOrder[]; completed: BCHOrder[] } {
    const pending: BCHOrder[] = [];
    const completed: BCHOrder[] = [];
    for (const o of orders) (isTerminalOrderStatus(o.status) ? completed : pending).push(o);
    return { pending, completed };
}

export interface TxLink {
    title: string;
    url: string;
    txid?: string;
    type?: 'creation' | 'fill' | 'refund' | 'claim';
}

export interface BCHOrder {
    id: string;
    /** BCH address of the wallet that placed the order. Missing on orders saved before wallets could be switched. */
    wallet?: string;
    swapType: BCHSwapType;
    orderType: BCHOrderType;
    sellToken: Token;
    buyToken: Token;
    sellAmount: number;
    buyAmount: number;
    status: BCHOrderStatus;
    contractAddress?: string;  // For same-chain covenant swaps
    tokenAddress?: string;     // Token-aware address for funding
    txid?: string;
    fillTxid?: string;         // TXID of the fill transaction
    refundTxid?: string;       // TXID of the relayer's cancel() refund
    cancelTxid?: string;       // TXID of the maker's cancelEarly()
    explorerUrl?: string;      // Link to block explorer (source chain)
    destExplorerUrl?: string;  // Link to block explorer (destination chain)
    txLinks?: TxLink[];        // Multiple finality links (e.g. waterfall legs)
    intentId?: string;         // For cross-chain relayer
    createdAt: number;
    expiryTime?: number;       // Unix timestamp (seconds) when limit order expires
    duration?: number;         // Dutch auction total duration (seconds)
    /** Covenant the meshserver deployed and its exact constructor args (V2 intents). */
    contractName?: string;
    constructorArgs?: string[];

    // ── Relayer-reported detail (CashToken same-chain orders) ────────────────
    /**
     * Unix seconds. The covenant's real fill deadline, which is NOT the expiry the
     * maker picked: `tx.locktime` is MTP-shifted by ~2h, so a "1H" limit order is
     * actually fillable for ~3h on-chain. Surfacing both avoids the surprise.
     */
    fillableUntil?: number;
    /** Unix seconds. When the permissionless cancel() refund becomes broadcastable. */
    refundableFrom?: number;
    /** Unix seconds. Timelock of the source chain HTLC (used to determine refund eligibility). */
    sourceTimelock?: number;
    /** Why an open order has not filled yet, categorised by the relayer. */
    lastSkipCategory?: 'unprofitable_spread' | 'slippage_too_high' | 'insufficient_capital'
        | 'no_pool' | 'quote_error' | 'other';
    lastSkipReason?: string;
    /** Which route the solver used / intends to use. */
    routeType?: string;
    claimData?: {
        hashlock?: string;
        secret?: string;
        solanaEscrowPda?: string;
        bchContractAddress?: string;
        movementEscrowId?: string;
        destFillTx?: string;
        destTimelock?: number;
        direction?: string;            // e.g. 'BCH_TO_SOL', 'SOL_TO_BCH', 'ETH_TO_BCH', 'BCH_TO_ETH'
        solMaker?: string;
        xmrDepositAddress?: string;
        xmrSpendKeyParam?: string;
        evmEscrowId?: string;          // STARK escrow ID on Sepolia (ETH→BCH)
        starkCovenantAddress?: string; // StarkVerifierFRIPhaseB P2SH32 address (BCH→ETH)
        evmRecipient?: string;         // User EVM address (BCH→ETH)
        sourceTimelock?: number;       // Unix ts of covenant/escrow timelock (refund eligibility)
        bchCovenantTimelock?: number;  // Alias for sourceTimelock used by BCH→EVM path
        pendingRefundTx?: string;      // Base64 unsigned Solana refund tx prebuilt by server
        refundTx?: string;             // Txid/sig once the refund is confirmed
        escrowTxHash?: string;         // On-chain HTLC creation tx hash (Movement / Solana)
        /** Present when selling a CashToken (PUSD etc.) — passed to solver for covenant verification */
        bchToken?: { category: string; amount: string };
    };
}
