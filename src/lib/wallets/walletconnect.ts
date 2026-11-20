/**
 * WalletConnect v2 client singleton & helpers for BCH.
 * Phase 0: Foundation
 */

import { AppNetwork, ExternalWallet } from './types';
import {
    getAllWallets,
    removeWallet,
    updateWallet,
    findWalletById,
    addWallet,
} from './registry';
import { cancelPendingForWallet } from './signRequest';

const DEFAULT_DEV_PROJECT_ID = '46eab391b8e623fe273e8b3ed7d45e18';

export function getWalletConnectProjectId(): string {
    const envId = (import.meta as any).env?.VITE_WC_PROJECT_ID;
    if (envId) return envId;
    if ((import.meta as any).env?.DEV) {
        console.warn('[WalletConnect] VITE_WC_PROJECT_ID is not set; using fallback dev project id.');
        return DEFAULT_DEV_PROJECT_ID;
    }
    // A production build without its own Reown project shares the dev id: its domain
    // allow-list and quotas are not ours, so wallets may refuse to pair. Say so loudly.
    console.error('[WalletConnect] VITE_WC_PROJECT_ID is not set in this production build; falling back to the dev project id. Set it to the Reown project that allow-lists this domain.');
    return DEFAULT_DEV_PROJECT_ID;
}

export function getBchChain(network: AppNetwork): string {
    return network === 'mainnet' ? 'bch:bitcoincash' : 'bch:bchtest';
}

export function getBchRequiredNamespaces(network: AppNetwork) {
    const chain = getBchChain(network);
    return {
        bch: {
            chains: [chain],
            methods: ['bch_getAddresses', 'bch_signTransaction', 'bch_signMessage', 'bch_sendTransaction'],
            events: ['addressesChanged', 'accountsChanged'],
        },
    };
}

declare global {
    interface Window {
        __wcBchClient?: any;
        __wcBchClientPending?: Promise<any>;
        __wcBchListenersAttached?: boolean;
    }
}

/** Attach global listeners once per page lifetime */
export function attachGlobalListeners(client: any): void {
    if (typeof window === 'undefined') return;
    if (window.__wcBchListenersAttached) return;
    window.__wcBchListenersAttached = true;

    client.on('session_delete', (event: { topic: string }) => {
        const matching = getAllWallets().find(w => w.sessionTopic === event.topic);
        if (matching) {
            cancelPendingForWallet(matching.id, 'session-gone');
            removeWallet(matching.id);
        }
    });

    client.on('session_expire', (event: { topic: string }) => {
        const matching = getAllWallets().find(w => w.sessionTopic === event.topic);
        if (matching) {
            cancelPendingForWallet(matching.id, 'session-gone');
            removeWallet(matching.id);
        }
    });

    client.on('session_update', (event: { topic: string; params: { namespaces: any } }) => {
        const matching = getAllWallets().find(w => w.sessionTopic === event.topic);
        if (matching && event.params?.namespaces?.bch) {
            const accounts: string[] = event.params.namespaces.bch.accounts || [];
            if (accounts.length > 0) {
                const address = accounts[0].split(':').slice(2).join(':');
                if (address && address !== matching.address) {
                    cancelPendingForWallet(matching.id, 'session-gone');
                    updateWallet(matching.id, { address });
                }
            }
        }
    });

    client.on('session_event', (event: { topic: string; params: { event: { name: string; data: any }; chainId: string } }) => {
        const matching = getAllWallets().find(w => w.sessionTopic === event.topic);
        if (!matching) return;

        if (event.params?.event?.name === 'accountsChanged') {
            const data = event.params.event.data;
            const newAccounts: string[] = Array.isArray(data) ? data : [];
            if (newAccounts.length > 0) {
                const newAddress = newAccounts[0].split(':').slice(2).join(':');
                if (newAddress && newAddress !== matching.address) {
                    cancelPendingForWallet(matching.id, 'session-gone');
                    // Treat as new account/wallet with de-duplication rules
                    addWallet({
                        ...matching,
                        address: newAddress,
                        connectedAt: Date.now(),
                    });
                }
            }
        }
    });
}

/** Prune dead sessions that the relay no longer knows about after a 5 second grace period */
export function schedulePruneOnLoad(client: any): void {
    if (typeof window === 'undefined') return;
    setTimeout(() => {
        try {
            const liveTopics = new Set<string>((client.session.getAll() || []).map((s: any) => s.topic));
            const wcWallets = getAllWallets().filter(w => w.source === 'walletconnect' && w.sessionTopic);
            for (const w of wcWallets) {
                if (w.sessionTopic && !liveTopics.has(w.sessionTopic)) {
                    removeWallet(w.id);
                }
            }
        } catch (e) {
            console.warn('[WalletConnect] Error pruning stale sessions:', e);
        }
    }, 5000);
}

/** Get or initialize the BCH WalletConnect SignClient singleton */
export async function getWCBchClient(): Promise<any> {
    if (typeof window === 'undefined') {
        throw new Error('WalletConnect client requires a browser window environment.');
    }

    if (window.__wcBchClient) return window.__wcBchClient;
    if (window.__wcBchClientPending) return window.__wcBchClientPending;

    const isLocalhost = window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';
    const safeUrl = isLocalhost ? 'https://bchintents.com' : window.location.origin;

    const mod = await import('@walletconnect/sign-client');
    const SignClient = mod.SignClient ?? (mod as any).default;

    window.__wcBchClientPending = SignClient.init({
        projectId: getWalletConnectProjectId(),
        customStoragePrefix: 'cham-bch',
        metadata: {
            name: 'BCH Intents Protocol',
            description: 'Intent-based cross-chain swaps on Bitcoin Cash',
            url: safeUrl,
            icons: [`${window.location.origin}/assets/pwa-512x512.png`],
        },
    }).then((client: any) => {
        window.__wcBchClient = client;
        delete window.__wcBchClientPending;
        attachGlobalListeners(client);
        schedulePruneOnLoad(client);
        return client;
    });

    return window.__wcBchClientPending;
}

/** Connect BCH over WalletConnect v2 */
export async function connectBch(network: AppNetwork): Promise<{ uri: string; approval: () => Promise<any> }> {
    const client = await getWCBchClient();
    const { uri, approval } = await client.connect({
        requiredNamespaces: getBchRequiredNamespaces(network),
    });

    return { uri: uri || '', approval };
}
