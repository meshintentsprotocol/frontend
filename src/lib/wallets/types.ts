/**
 * Core wallet types for multi-chain wallet connection.
 * Phase 0: Foundation
 */

export type ChainFamily = 'bch' | 'evm' | 'solana' | 'btc';
export type AppNetwork = 'mainnet' | 'testnet'; // the app's mode; testnet = chipnet / Sepolias / devnet / BTC testnet
export const AppNetwork = {
    MAINNET: 'mainnet' as const,
    TESTNET: 'testnet' as const,
    CHIPNET: 'testnet' as const,
} as const;
export type ExternalSource = 'walletconnect' | 'wizardconnect' | 'extension' | 'appkit'; // appkit: EVM / Solana / Bitcoin (P6-P8)

export interface ExternalWallet {
    /** Unique identifier: 'wc-<uuid>' | 'wiz-<uuid>' | 'ext-<uuid>' | 'appkit-<family>' */
    id: string;
    source: ExternalSource;
    family: ChainFamily;
    network: AppNetwork;
    /** From the session (peer metadata / walletName), never hardcoded */
    label: string;
    /** Sanitised URL (https: or data:image/) */
    icon?: string;
    /** bch: cashaddr with prefix; evm: checksummed 0x; solana: base58; btc: bech32/legacy */
    address: string;
    /** EVM only: approved chain ids */
    chains?: number[];
    /** WalletConnect session topic */
    sessionTopic?: string;
    /** Timestamp when connected (ms) */
    connectedAt: number;
}

export const MAX_EXTERNAL_WALLETS = 5;

/** Maps the app's BCH network switch to the unified AppNetwork */
export const appNetworkOf = (bchNetwork: 'mainnet' | 'chipnet'): AppNetwork =>
    bchNetwork === 'mainnet' ? 'mainnet' : 'testnet';
