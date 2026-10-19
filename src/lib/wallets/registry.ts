/**
 * Central registry for external wallets across all supported chain families.
 * Phase 0: Foundation
 */

import { useSyncExternalStore } from 'react';
import { notifyToast } from '@/lib/notify-toast';
import {
    ChainFamily,
    AppNetwork,
    ExternalWallet,
    MAX_EXTERNAL_WALLETS,
} from './types';

export const REGISTRY_STORAGE_KEY = 'ext_wallets_v2';
export const LEGACY_STORAGE_KEY = 'ext_bch_wallets';

export class WalletLimitError extends Error {
    constructor(message = `Maximum of ${MAX_EXTERNAL_WALLETS} external wallets reached.`) {
        super(message);
        this.name = 'WalletLimitError';
    }
}

export type SessionCloser = (wallet: ExternalWallet) => void | Promise<void>;

const sessionClosers = new Set<SessionCloser>();

/** Register a callback invoked when an existing session is closed / replaced */
export function registerSessionCloser(closer: SessionCloser): () => void {
    sessionClosers.add(closer);
    return () => {
        sessionClosers.delete(closer);
    };
}

async function notifySessionClosed(wallet: ExternalWallet) {
    for (const closer of sessionClosers) {
        try {
            await closer(wallet);
        } catch (e) {
            console.warn('[WalletRegistry] Error closing session for wallet', wallet.id, e);
        }
    }
}

/** Normalize an address for identity comparison */
export function normalizeAddress(address: string, family: ChainFamily): string {
    const trimmed = address.trim();
    if (family === 'bch') {
        return trimmed.replace(/^(bitcoincash|bchtest|bchreg):/i, '').toLowerCase();
    }
    if (family === 'evm') {
        return trimmed.toLowerCase();
    }
    return trimmed;
}

/** Compute the unique identity key for a wallet: family + network + normalized address */
export function walletIdentity(family: ChainFamily, network: AppNetwork, address: string): string {
    return `${family}:${network}:${normalizeAddress(address, family)}`;
}

interface LegacyBCHWallet {
    id: string;
    source: string;
    label: string;
    address: string;
    connected: boolean;
    sessionTopic?: string;
}

/** Migrate from legacy ext_bch_wallets if present */
function migrateLegacy(): ExternalWallet[] | null {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
        const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (!raw) return null;

        const legacyList: unknown = JSON.parse(raw);
        if (!Array.isArray(legacyList)) {
            localStorage.removeItem(LEGACY_STORAGE_KEY);
            return null;
        }

        const migrated: ExternalWallet[] = [];
        for (const item of legacyList) {
            if (!item || typeof item !== 'object') continue;
            const w = item as Partial<LegacyBCHWallet>;
            if (!w.address || typeof w.address !== 'string') continue;

            // WizardConnect rows from the old store are dropped (they had no real session)
            if (w.source === 'wizardconnect') continue;

            const trimmed = w.address.trim().toLowerCase();
            const network: AppNetwork = trimmed.startsWith('bchtest:')
                ? 'testnet'
                : 'mainnet';

            migrated.push({
                id: w.id || `migrated-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                source: (w.source === 'extension' ? 'extension' : 'walletconnect'),
                family: 'bch',
                network,
                label: w.label || 'BCH Wallet',
                address: w.address,
                sessionTopic: w.sessionTopic,
                connectedAt: Date.now(),
            });
        }

        localStorage.removeItem(LEGACY_STORAGE_KEY);
        return migrated;
    } catch {
        try { localStorage.removeItem(LEGACY_STORAGE_KEY); } catch { /* ignore */ }
        return null;
    }
}

function loadFromStorage(): ExternalWallet[] {
    if (typeof window === 'undefined' || !window.localStorage) return [];

    let current: ExternalWallet[] = [];
    let hasV2 = false;

    // First check if v2 storage exists
    try {
        const raw = localStorage.getItem(REGISTRY_STORAGE_KEY);
        if (raw !== null) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                current = parsed.filter(w => w && typeof w === 'object' && w.id && w.address && w.family && w.network);
                hasV2 = true;
            }
        }
    } catch {
        /* damaged JSON in v2 */
    }

    // If legacy key exists, migrate it and remove it
    if (localStorage.getItem(LEGACY_STORAGE_KEY) !== null) {
        const migrated = migrateLegacy();
        if (migrated && migrated.length > 0) {
            const existingIdentities = new Set(current.map(w => walletIdentity(w.family, w.network, w.address)));
            for (const mw of migrated) {
                const ident = walletIdentity(mw.family, mw.network, mw.address);
                if (!existingIdentities.has(ident) && current.length < MAX_EXTERNAL_WALLETS) {
                    current.push(mw);
                    existingIdentities.add(ident);
                }
            }
            saveToStorage(current);
            return current;
        }
    }

    if (hasV2) {
        return current;
    }

    return current;
}

function saveToStorage(wallets: ExternalWallet[]) {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(wallets));
    } catch {
        /* non-fatal in private mode or quota exceeded */
    }
}

// ── In-Memory Store & Subscription ──────────────────────────────────────────

let currentWallets: ExternalWallet[] = loadFromStorage();
const listeners = new Set<() => void>();

function notify() {
    for (const listener of listeners) {
        listener();
    }
}

let visibleCache: Record<AppNetwork, ExternalWallet[] | undefined> = {
    mainnet: undefined,
    testnet: undefined,
};

function clearVisibleCache() {
    visibleCache = { mainnet: undefined, testnet: undefined };
}

function update(next: ExternalWallet[]) {
    currentWallets = next;
    clearVisibleCache();
    saveToStorage(next);
    notify();
}

if (typeof window !== 'undefined') {
    window.addEventListener('storage', e => {
        if (e.key === REGISTRY_STORAGE_KEY) {
            currentWallets = loadFromStorage();
            clearVisibleCache();
            notify();
        }
    });
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

// ── Public Store API ────────────────────────────────────────────────────────

export function getAllWallets(): ExternalWallet[] {
    return currentWallets;
}

export function visibleWallets(network: AppNetwork): ExternalWallet[] {
    if (!visibleCache[network]) {
        visibleCache[network] = currentWallets.filter(w => w.network === network);
    }
    return visibleCache[network]!;
}

export function findWalletById(id: string): ExternalWallet | undefined {
    return currentWallets.find(w => w.id === id);
}

/**
 * Add a new external wallet to the registry.
 * - If a wallet with the same identity (family + network + normalized address) exists:
 *   replaces it, triggers session closer for the old session, and toasts notification.
 * - Otherwise:
 *   checks MAX_EXTERNAL_WALLETS limit and throws WalletLimitError if exceeded.
 */
export function addWallet(wallet: ExternalWallet): void {
    const targetIdentity = walletIdentity(wallet.family, wallet.network, wallet.address);
    const existingIndex = currentWallets.findIndex(
        w => walletIdentity(w.family, w.network, w.address) === targetIdentity
    );

    if (existingIndex >= 0) {
        const oldWallet = currentWallets[existingIndex];
        const next = [...currentWallets];
        next[existingIndex] = wallet;
        update(next);

        // Notify session closers to disconnect the old session
        notifySessionClosed(oldWallet);

        try {
            notifyToast.info(`${wallet.label} was already connected; using the new connection.`);
        } catch { /* ignore in non-browser environment */ }
        return;
    }

    if (currentWallets.length >= MAX_EXTERNAL_WALLETS) {
        throw new WalletLimitError();
    }

    update([...currentWallets, wallet]);
}

export function removeWallet(id: string): void {
    const existing = currentWallets.find(w => w.id === id);
    if (!existing) return;

    update(currentWallets.filter(w => w.id !== id));
    notifySessionClosed(existing);
}

export function updateWallet(id: string, patch: Partial<ExternalWallet>): void {
    const index = currentWallets.findIndex(w => w.id === id);
    if (index === -1) return;

    const next = [...currentWallets];
    next[index] = { ...next[index], ...patch };
    update(next);
}

export function clearAllWallets(): void {
    const old = [...currentWallets];
    update([]);
    for (const w of old) {
        notifySessionClosed(w);
    }
}

/** Hook to observe all external wallets */
export function useExternalWallets(): ExternalWallet[] {
    return useSyncExternalStore(subscribe, getAllWallets, () => []);
}

/** Hook to observe wallets filtered by current network */
export function useVisibleWallets(network: AppNetwork): ExternalWallet[] {
    return useSyncExternalStore(
        subscribe,
        () => visibleWallets(network),
        () => []
    );
}

/** For tests: reload or reset in-memory state */
export function _resetRegistryForTest(initial?: ExternalWallet[]) {
    clearVisibleCache();
    if (initial !== undefined) {
        currentWallets = initial;
        saveToStorage(initial);
    } else {
        currentWallets = loadFromStorage();
    }
    notify();
}
