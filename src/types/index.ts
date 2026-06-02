// Token Types
export interface Token {
    symbol: string;
    name: string;
    icon: string;
    decimals: number;
    type: string;
    chain?: 'bch' | 'solana' | 'ethereum' | 'bsc' | 'base' | 'arbitrum' | 'optimism' | 'movement' | 'xmr';
    categoryId?: string;  // BCH CashToken category ID (hex)
    address?: string;     // Token mint or smart contract address
    priceUsd?: number;    // Cauldron price in USD (for CashTokens)
    priceSats?: number;   // Cauldron price in sats (for CashTokens)
    disabled?: boolean;   // true = not selectable (chain not yet deployed)
    comingSoon?: boolean; // shows "Soon" badge
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

// BCH Swap Types
export type BCHSwapType = 'same-chain' | 'bch-to-sol' | 'sol-to-bch' | 'bch-to-mov' | 'mov-to-bch' | 'bch-to-xmr' | 'xmr-to-bch' | 'eth-to-bch' | 'bch-to-eth';
export type BCHOrderType = 'market' | 'limit';

export interface BCHSwapParams {
    sellToken: Token;
    buyToken: Token;
    sellAmount: number;
    buyAmount: number;
    swapType: BCHSwapType;
    orderType: BCHOrderType;
    duration?: number;     // Dutch auction duration (seconds)
    expiryTime?: number;   // Limit order expiry (unix timestamp)
    xmr?: {
        viewKey: string;
        spendKey: string;
    };
}

export interface BCHOrder {
    id: string;
    swapType: BCHSwapType;
    orderType: BCHOrderType;
    sellToken: Token;
    buyToken: Token;
    sellAmount: number;
    buyAmount: number;
    status: 'pending' | 'source_locked' | 'proving' | 'claimable' | 'claimed' | 'filled' | 'cancelled' | 'expired' | 'refunded' | 'failed';
    contractAddress?: string;  // For same-chain covenant swaps
    tokenAddress?: string;     // Token-aware address for funding
    txid?: string;
    fillTxid?: string;         // TXID of the fill transaction
    explorerUrl?: string;      // Link to block explorer (source chain)
    destExplorerUrl?: string;  // Link to block explorer (destination chain)
    intentId?: string;         // For cross-chain relayer
    createdAt: number;
    expiryTime?: number;       // Unix timestamp (seconds) when limit order expires
    duration?: number;         // Dutch auction total duration (seconds)
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
    };
}
