/**
 * walletStore — the one place that knows which BCH wallet is active, and how
 * each wallet looks (its colour and the name the user gave it).
 *
 * It is a module-level store read through useSyncExternalStore, so every
 * component sees the same value and a switch made anywhere (the header, the
 * wallet panel, the swap card) reaches the whole app at once. It also follows
 * other tabs through the `storage` event.
 *
 * Wallet ids: 'main' for the built-in wallet, or an external wallet's id from
 * ExternalBCHWalletProvider. Looks are keyed by 'main' or by the wallet's
 * address, so a wallet keeps its colour when it is reconnected.
 */

import { useSyncExternalStore } from 'react';

export const MAIN_WALLET_ID = 'main';

const ACTIVE_KEY = 'active_bch_wallet_id';
const LOOKS_KEY = 'bch_wallet_looks_v1';

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

interface State {
    activeId: string;
    looks: Record<string, WalletLook>;
}

function read(): State {
    let activeId = MAIN_WALLET_ID;
    let looks: Record<string, WalletLook> = {};
    try {
        activeId = localStorage.getItem(ACTIVE_KEY) || MAIN_WALLET_ID;
        const raw = JSON.parse(localStorage.getItem(LOOKS_KEY) ?? '{}');
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) looks = raw;
    } catch { /* private mode, or a damaged value: start clean */ }
    return { activeId, looks };
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
        if (e.key === ACTIVE_KEY || e.key === LOOKS_KEY) set(read());
    });
}

export function getActiveWalletId(): string {
    return state.activeId;
}

export function setActiveWalletId(id: string) {
    if (id === state.activeId) return;
    try { localStorage.setItem(ACTIVE_KEY, id); } catch { /* non-fatal */ }
    set({ ...state, activeId: id });
}

export function setWalletLook(key: string, look: WalletLook) {
    const merged = { ...state.looks[key], ...look };
    if (!merged.name) delete merged.name;
    const looks = { ...state.looks, [key]: merged };
    try { localStorage.setItem(LOOKS_KEY, JSON.stringify(looks)); } catch { /* non-fatal */ }
    set({ ...state, looks });
}

/** The colour a wallet shows when the user has not picked one: stable for a given key. */
export function defaultWalletColor(key: string): string {
    if (key === MAIN_WALLET_ID) return WALLET_COLORS[0].hex;
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    return WALLET_COLORS[1 + (h % (WALLET_COLORS.length - 1))].hex;
}

export function useActiveWalletId(): string {
    return useSyncExternalStore(subscribe, () => state.activeId, () => MAIN_WALLET_ID);
}

export function useWalletLooks(): Record<string, WalletLook> {
    return useSyncExternalStore(subscribe, () => state.looks, () => state.looks);
}
