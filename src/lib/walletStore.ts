/**
 * walletStore — the one place that knows which wallet is active per chain family,
 * and how each wallet looks (its colour and the name the user gave it).
 *
 * It is a module-level store read through useSyncExternalStore, so every
 * component sees the same value and a switch made anywhere reaches the whole app.
 * It also follows other tabs through the `storage` event.
 *
 * Phase 0: Foundation
 */

import { useSyncExternalStore } from 'react';
import { ChainFamily } from './wallets/types';

export const MAIN_WALLET_ID = 'main';

export const ACTIVE_KEY_V2 = 'active_wallet_ids_v2';
export const LEGACY_ACTIVE_KEY = 'active_bch_wallet_id';
export const LOOKS_KEY = 'bch_wallet_looks_v1';

/** Colours a wallet can be given. Hex values, used through inline styles. */
export const WALLET_COLORS = [
    { id: 'emerald', hex: '#10b981' },
    { id: 'sky', hex: '#38bdf8' },
    { id: 'violet', hex: '#a78bfa' },
    { id: 'amber', hex: '#f59e0b' },
    { id: 'rose', hex: '#fb7185' },
    { id: 'teal', hex: '#2dd4bf' },
    { id: 'orange', hex: '#fb923c' },
    { id: 'fuchsia', hex: '#e879f9' },
] as const;

export interface WalletLook {
    /** Hex colour. */
    color?: string;
    /** Name the user chose; the wallet's own label is used when empty. */
    name?: string;
}

export type ActiveWalletIds = {
    bch: string | null;
    evm: string | null;
    solana: string | null;
    btc: string | null;
};

const DEFAULT_ACTIVE_IDS: ActiveWalletIds = {
    bch: MAIN_WALLET_ID,
    evm: null,
    solana: null,
    btc: null,
};

interface State {
    activeIds: ActiveWalletIds;
    looks: Record<string, WalletLook>;
}

function read(): State {
    let activeIds: ActiveWalletIds = { ...DEFAULT_ACTIVE_IDS };
    let looks: Record<string, WalletLook> = {};

    if (typeof window === 'undefined' || !window.localStorage) {
        return { activeIds, looks };
    }

    try {
        const rawActive = localStorage.getItem(ACTIVE_KEY_V2);
        if (rawActive) {
            const parsed = JSON.parse(rawActive);
            if (parsed && typeof parsed === 'object') {
                activeIds = {
                    bch: parsed.bch !== undefined ? parsed.bch : MAIN_WALLET_ID,
                    evm: parsed.evm ?? null,
                    solana: parsed.solana ?? null,
                    btc: parsed.btc ?? null,
                };
            }
        } else {
            // Migrate from legacy active_bch_wallet_id
            const legacyBch = localStorage.getItem(LEGACY_ACTIVE_KEY);
            if (legacyBch) {
                activeIds.bch = legacyBch;
                try {
                    localStorage.setItem(ACTIVE_KEY_V2, JSON.stringify(activeIds));
                    localStorage.removeItem(LEGACY_ACTIVE_KEY);
                } catch { /* non-fatal */ }
            }
        }

        const rawLooks = JSON.parse(localStorage.getItem(LOOKS_KEY) ?? '{}');
        if (rawLooks && typeof rawLooks === 'object' && !Array.isArray(rawLooks)) {
            looks = rawLooks;
        }
    } catch {
        /* private mode, or a damaged value: start clean */
    }

    return { activeIds, looks };
}

let state: State = read();
const listeners = new Set<() => void>();

function set(next: State) {
    state = next;
    for (const l of listeners) l();
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

if (typeof window !== 'undefined') {
    window.addEventListener('storage', e => {
        if (e.key === ACTIVE_KEY_V2 || e.key === LEGACY_ACTIVE_KEY || e.key === LOOKS_KEY) {
            set(read());
        }
    });
}

export function getActiveWalletId(family: ChainFamily = 'bch'): string | null {
    return state.activeIds[family] ?? null;
}

export function getActiveWalletIds(): ActiveWalletIds {
    return { ...state.activeIds };
}

export function setActiveWalletId(id: string | null, family: ChainFamily = 'bch') {
    if (id === state.activeIds[family]) return;
    const activeIds: ActiveWalletIds = { ...state.activeIds, [family]: id };
    if (typeof window !== 'undefined' && window.localStorage) {
        try {
            localStorage.setItem(ACTIVE_KEY_V2, JSON.stringify(activeIds));
        } catch { /* non-fatal */ }
    }
    set({ ...state, activeIds });
}

export function setWalletLook(key: string, look: WalletLook) {
    const merged = { ...state.looks[key], ...look };
    if (!merged.name) delete merged.name;
    const looks = { ...state.looks, [key]: merged };
    if (typeof window !== 'undefined' && window.localStorage) {
        try {
            localStorage.setItem(LOOKS_KEY, JSON.stringify(looks));
        } catch { /* non-fatal */ }
    }
    set({ ...state, looks });
}

export function forgetLook(key: string) {
    if (!state.looks[key]) return;
    const looks = { ...state.looks };
    delete looks[key];
    if (typeof window !== 'undefined' && window.localStorage) {
        try {
            localStorage.setItem(LOOKS_KEY, JSON.stringify(looks));
        } catch { /* non-fatal */ }
    }
    set({ ...state, looks });
}

/** The colour a wallet shows when the user has not picked one: stable for a given key. */
export function defaultWalletColor(key: string): string {
    if (key === MAIN_WALLET_ID) return WALLET_COLORS[0].hex;
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    return WALLET_COLORS[1 + (h % (WALLET_COLORS.length - 1))].hex;
}

export function useActiveWalletId(family: ChainFamily = 'bch'): string | null {
    return useSyncExternalStore(
        subscribe,
        () => state.activeIds[family] ?? null,
        () => (family === 'bch' ? MAIN_WALLET_ID : null)
    );
}

export function useWalletLooks(): Record<string, WalletLook> {
    return useSyncExternalStore(subscribe, () => state.looks, () => state.looks);
}

/** For tests: reset state and storage */
export function _resetWalletStoreForTest(initialActive?: Partial<ActiveWalletIds>) {
    state = {
        activeIds: { ...DEFAULT_ACTIVE_IDS, ...initialActive },
        looks: {},
    };
    if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(ACTIVE_KEY_V2);
        localStorage.removeItem(LEGACY_ACTIVE_KEY);
        localStorage.removeItem(LOOKS_KEY);
    }
    for (const l of listeners) l();
}
