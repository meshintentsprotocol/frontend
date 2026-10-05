/**
 * App settings — small user preferences persisted to localStorage.
 *
 * Holds trading defaults (auction duration, max slippage), the wallet
 * auto-lock timeout, the hide-balances preference, which toast levels are
 * muted, and which wallets have confirmed a recovery-phrase backup. Kept as an
 * object so more preferences can be added without changing the storage shape.
 */

const STORAGE_KEY = 'intent_app_settings_v1';

export const AUCTION_DURATION = {
    min: 5,
    max: 300,
    step: 1,
    default: 60,
};

/** Quick-select presets shown alongside the duration slider (seconds). */
export const AUCTION_DURATION_PRESETS = [15, 30, 60, 120, 300];

/** Human-friendly label for a duration in seconds — e.g. 45 -> "45s", 90 -> "1m 30s", 300 -> "5m". */
export function formatAuctionDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

/** Inactivity timeouts offered for the wallet auto-lock (minutes). */
export const AUTO_LOCK_MINUTES_OPTIONS = [5, 15, 30, 60];
const AUTO_LOCK_MINUTES_DEFAULT = 15;

/** Max-slippage choices in basis points (100 = 1%). */
export const SLIPPAGE_BPS_PRESETS = [50, 100, 200, 500];
const SLIPPAGE_BPS_DEFAULT = 100;

/** Toast levels a user may mute. Errors always show. */
export const MUTABLE_TOAST_LEVELS = ['success', 'info', 'warning'] as const;
export type MutableToastLevel = typeof MUTABLE_TOAST_LEVELS[number];

export interface AppSettings {
    /** Default Dutch-auction duration for new market swaps, in seconds. */
    defaultAuctionDuration: number;
    /** Minutes of inactivity before the wallet session locks. */
    autoLockMinutes: number;
    /** Mask balances in the wallet popup. */
    hideBalances: boolean;
    /** Default max slippage for orders that take one (TWAP slices), in bps. */
    defaultSlippageBps: number;
    /** Toast levels that are recorded in the Notifications panel but not popped up. */
    mutedToasts: MutableToastLevel[];
    /** Wallets (by EVM address, lower-case) whose owner confirmed a recovery-phrase backup. */
    backedUpWallets: string[];
}

const DEFAULTS: AppSettings = {
    defaultAuctionDuration: AUCTION_DURATION.default,
    autoLockMinutes: AUTO_LOCK_MINUTES_DEFAULT,
    hideBalances: false,
    defaultSlippageBps: SLIPPAGE_BPS_DEFAULT,
    mutedToasts: [],
    backedUpWallets: [],
};

function clampAuction(seconds: number): number {
    if (!Number.isFinite(seconds)) return AUCTION_DURATION.default;
    return Math.min(AUCTION_DURATION.max, Math.max(AUCTION_DURATION.min, Math.round(seconds)));
}

function validAutoLock(minutes: unknown): number {
    return AUTO_LOCK_MINUTES_OPTIONS.includes(minutes as number) ? (minutes as number) : AUTO_LOCK_MINUTES_DEFAULT;
}

function validSlippage(bps: unknown): number {
    return SLIPPAGE_BPS_PRESETS.includes(bps as number) ? (bps as number) : SLIPPAGE_BPS_DEFAULT;
}

function validMuted(levels: unknown): MutableToastLevel[] {
    return Array.isArray(levels) ? MUTABLE_TOAST_LEVELS.filter(l => levels.includes(l)) : [];
}

function validWallets(ids: unknown): string[] {
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
}

/** Read all settings, falling back to defaults for anything missing/invalid. */
export function getAppSettings(): AppSettings {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...DEFAULTS };
        const parsed = JSON.parse(raw) as Partial<AppSettings>;
        return {
            defaultAuctionDuration: clampAuction(parsed.defaultAuctionDuration ?? DEFAULTS.defaultAuctionDuration),
            autoLockMinutes: validAutoLock(parsed.autoLockMinutes),
            hideBalances: parsed.hideBalances === true,
            defaultSlippageBps: validSlippage(parsed.defaultSlippageBps),
            mutedToasts: validMuted(parsed.mutedToasts),
            backedUpWallets: validWallets(parsed.backedUpWallets),
        };
    } catch {
        return { ...DEFAULTS };
    }
}

/** Convenience reader for the default auction duration (seconds). */
export function getDefaultAuctionDuration(): number {
    return getAppSettings().defaultAuctionDuration;
}

/** Wallet auto-lock timeout in milliseconds. */
export function getAutoLockMs(): number {
    return getAppSettings().autoLockMinutes * 60 * 1000;
}

/** True when toasts of this level should not pop up. Errors are never muted. */
export function isToastMuted(level: 'success' | 'error' | 'info' | 'warning'): boolean {
    return level !== 'error' && getAppSettings().mutedToasts.includes(level);
}

/** True once this wallet's owner has confirmed they backed up the recovery phrase. */
export function isWalletBackedUp(walletId: string | null | undefined): boolean {
    return !!walletId && getAppSettings().backedUpWallets.includes(walletId.toLowerCase());
}

export function markWalletBackedUp(walletId: string): void {
    const id = walletId.toLowerCase();
    const current = getAppSettings().backedUpWallets;
    if (!current.includes(id)) saveAppSettings({ backedUpWallets: [...current, id] });
}

/** Persist a partial settings update. */
export function saveAppSettings(patch: Partial<AppSettings>): void {
    try {
        const next: AppSettings = { ...getAppSettings(), ...patch };
        next.defaultAuctionDuration = clampAuction(next.defaultAuctionDuration);
        next.autoLockMinutes = validAutoLock(next.autoLockMinutes);
        next.defaultSlippageBps = validSlippage(next.defaultSlippageBps);
        next.mutedToasts = validMuted(next.mutedToasts);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
        /* storage unavailable — non-fatal */
    }
}
