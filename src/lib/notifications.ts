/**
 * Notification store backing the wallet's Notifications panel.
 *
 * Plain localStorage logic with no React in it. It used to live inside
 * `components/wallet/WalletPopup.tsx`, which made `notify-toast.ts` import a
 * component module — and once WalletPopup itself started using `notifyToast`, that
 * became a genuine import cycle (notify-toast → WalletPopup → notify-toast). Cycles
 * like that resolve to `undefined` at module-init depending on evaluation order, so
 * the store lives here instead and both sides import from it.
 *
 * Notifications are namespaced per network: chipnet and mainnet activity should not
 * appear in the same list.
 */

import { ChainFamily, AppNetwork } from './wallets/types';
import { getWalletContext, WalletAmbientContext } from './wallets/ambient';
import { isConnected, norm } from './wallets/visibility';

const NOTIF_BASE_KEY = 'intent_notifications';
const getNotifKey = (network: string) => `${NOTIF_BASE_KEY}_${network}`;
const getNotifSeenKey = (network: string) => `${NOTIF_BASE_KEY}_seen_${network}`;

/** Cap on stored notifications — the panel shows a rolling window, not history. */
const MAX_STORED = 100;

export interface StoredNotification {
    id: string;
    type: 'success' | 'error' | 'info' | 'warning';
    family?: ChainFamily;
    network?: AppNetwork | string;
    wallet?: string;
    message: string;
    description?: string;
    timestamp: number;
}

export interface NotificationTag {
    family?: ChainFamily;
    network?: AppNetwork | string;
    wallet?: string;
}

// Module-level network tracker — kept in sync by setNotifNetwork() wrapper.
let _activeNetwork = 'chipnet';
export function setNotifNetwork(network: string) { _activeNetwork = network; }

/** Record a notification for the wallet panel. Called alongside every toast. */
export function pushNotification(
    type: StoredNotification['type'],
    message: string,
    description?: string,
    tag?: NotificationTag
) {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        const ctx = getWalletContext();
        const family: ChainFamily = tag?.family || 'bch';
        const network = tag?.network || _activeNetwork || ctx.network;
        const wallet = tag?.wallet || ctx.active[family] || ctx.builtIn[family] || undefined;

        const key = getNotifKey(network);
        const raw = localStorage.getItem(key);
        const list: StoredNotification[] = raw ? JSON.parse(raw) : [];

        const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        list.unshift({
            id,
            type,
            family,
            network,
            wallet,
            message,
            description,
            timestamp: Date.now(),
        });

        localStorage.setItem(key, JSON.stringify(list.slice(0, MAX_STORED)));
    } catch { /* non-fatal: notifications are not load-bearing */ }
}

/** Read notifications filtered by whether the wallet is currently connected on this network */
export function readNotifications(network: string, customCtx?: WalletAmbientContext): StoredNotification[] {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    try {
        const raw = localStorage.getItem(getNotifKey(network));
        const list: StoredNotification[] = raw ? JSON.parse(raw) : [];
        const ctx = customCtx || getWalletContext();

        return list.filter(n => isConnected(n, ctx));
    } catch {
        return [];
    }
}

export function clearNotifications(network: string) {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try { localStorage.removeItem(getNotifKey(network)); } catch { /* non-fatal */ }
}

/** Delete all notifications belonging to a forgotten wallet address across all networks */
export function forgetWalletNotifications(address: string, family: ChainFamily = 'bch') {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const targetNorm = norm(address, family);
    const networks = ['chipnet', 'mainnet', 'testnet'];

    for (const net of networks) {
        try {
            const key = getNotifKey(net);
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const list: StoredNotification[] = JSON.parse(raw);
            const filtered = list.filter(n => {
                if (!n.wallet) return true; // keep legacy untagged records
                return norm(n.wallet, n.family || family) !== targetNorm;
            });
            localStorage.setItem(key, JSON.stringify(filtered));
        } catch { /* non-fatal */ }
    }
}

/** Mark all current notifications as seen (called while the panel is viewed). */
export function markNotificationsSeen(network: string) {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try { localStorage.setItem(getNotifSeenKey(network), String(Date.now())); } catch { /* non-fatal */ }
}

/** True when there is at least one notification newer than the last view for connected wallets. */
export function hasUnseenNotifications(network: string): boolean {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    try {
        const list = readNotifications(network);
        if (!list.length) return false;
        const seenAt = Number(localStorage.getItem(getNotifSeenKey(network)) || 0);
        return list.some(n => n.timestamp > seenAt);
    } catch {
        return false;
    }
}
