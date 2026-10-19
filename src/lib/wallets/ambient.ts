/**
 * Ambient wallet context — module-level state tracking active network,
 * active wallet addresses, and connected wallet addresses per chain family.
 *
 * Used by non-React services (ActivityService, NotificationService, toast notifications)
 * to tag records with the active wallet and filter visible data.
 *
 * Phase 3: Balances, history and notifications follow the wallet
 */

import { AppNetwork, ChainFamily } from './types';

export interface WalletAmbientContext {
    network: AppNetwork;
    active: Record<ChainFamily, string | null>;
    builtIn: Record<ChainFamily, string | null>;
    connectedAddresses: Record<ChainFamily, string[]>;
}

const DEFAULT_CONTEXT: WalletAmbientContext = {
    network: 'testnet',
    active: {
        bch: null,
        evm: null,
        solana: null,
        btc: null,
    },
    builtIn: {
        bch: null,
        evm: null,
        solana: null,
        btc: null,
    },
    connectedAddresses: {
        bch: [],
        evm: [],
        solana: [],
        btc: [],
    },
};

let currentContext: WalletAmbientContext = { ...DEFAULT_CONTEXT };
const listeners = new Set<(ctx: WalletAmbientContext) => void>();

export function getWalletContext(): WalletAmbientContext {
    return currentContext;
}

export function setWalletContext(patch: Partial<WalletAmbientContext>): void {
    currentContext = {
        ...currentContext,
        ...patch,
        active: { ...currentContext.active, ...(patch.active || {}) },
        builtIn: { ...currentContext.builtIn, ...(patch.builtIn || {}) },
        connectedAddresses: { ...currentContext.connectedAddresses, ...(patch.connectedAddresses || {}) },
    };
    for (const listener of listeners) {
        try {
            listener(currentContext);
        } catch { /* ignore */ }
    }
}

export function subscribeWalletContext(listener: (ctx: WalletAmbientContext) => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** Thin wrapper for backward compatibility with notifications setNotifNetwork */
export function setNotifNetwork(network: 'chipnet' | 'mainnet' | AppNetwork): void {
    const net: AppNetwork = (network === 'mainnet') ? 'mainnet' : 'testnet';
    setWalletContext({ network: net });
}

/** For tests: reset ambient context */
export function _resetAmbientContextForTest(initial?: Partial<WalletAmbientContext>): void {
    currentContext = {
        network: 'testnet',
        active: { bch: null, evm: null, solana: null, btc: null },
        builtIn: { bch: null, evm: null, solana: null, btc: null },
        connectedAddresses: { bch: [], evm: [], solana: [], btc: [] },
        ...initial,
    };
}
