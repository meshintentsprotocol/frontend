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

const NOTIF_BASE_KEY = 'intent_notifications';
const getNotifKey = (network: string) => `${NOTIF_BASE_KEY}_${network}`;
const getNotifSeenKey = (network: string) => `${NOTIF_BASE_KEY}_seen_${network}`;

/** Cap on stored notifications — the panel shows a rolling window, not history. */
const MAX_STORED = 50;

// Module-level network tracker — kept in sync by WalletPopup via setNotifNetwork().
// pushNotification() is called from non-React code paths that have no access to the
// WDK context, so the active network has to be ambient.
let _activeNetwork = 'chipnet';
export function setNotifNetwork(network: string) { _activeNetwork = network; }

export interface StoredNotification {
    id: string;
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
    description?: string;
    timestamp: number;
}

/** Record a notification for the wallet panel. Called alongside every toast. */
export function pushNotification(
    type: StoredNotification['type'], message: string, description?: string,
) {
    try {
        const key = getNotifKey(_activeNetwork);
        const raw = localStorage.getItem(key);
        const list: StoredNotification[] = raw ? JSON.parse(raw) : [];
        list.unshift({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type,
            message,
            description,
            timestamp: Date.now(),
        });
        localStorage.setItem(key, JSON.stringify(list.slice(0, MAX_STORED)));
    } catch { /* non-fatal: notifications are not load-bearing */ }
}

export function readNotifications(network: string): StoredNotification[] {
    try {
        const raw = localStorage.getItem(getNotifKey(network));
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export function clearNotifications(network: string) {
    try { localStorage.removeItem(getNotifKey(network)); } catch { /* non-fatal */ }
}

/** Mark all current notifications as seen (called while the panel is viewed). */
export function markNotificationsSeen(network: string) {
    try { localStorage.setItem(getNotifSeenKey(network), String(Date.now())); } catch { /* non-fatal */ }
}

/** True when there is at least one notification newer than the last view. */
export function hasUnseenNotifications(network: string): boolean {
    try {
        const list = readNotifications(network);
        if (!list.length) return false;
        const seenAt = Number(localStorage.getItem(getNotifSeenKey(network)) || 0);
        return list.some(n => n.timestamp > seenAt);
    } catch {
        return false;
    }
}
