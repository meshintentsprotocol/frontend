/**
 * App settings — small user preferences persisted to localStorage.
 *
 * Holds the default Dutch-auction duration used to seed new market swaps, the
 * wallet auto-lock timeout and the hide-balances preference. Kept as an object
 * so more preferences can be added without changing the storage shape.
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

export interface AppSettings {
    /** Default Dutch-auction duration for new market swaps, in seconds. */
    defaultAuctionDuration: number;
    /** Minutes of inactivity before the wallet session locks. */
    autoLockMinutes: number;
    /** Mask balances in the wallet popup. */
    hideBalances: boolean;
}

const DEFAULTS: AppSettings = {
    defaultAuctionDuration: AUCTION_DURATION.default,
    autoLockMinutes: AUTO_LOCK_MINUTES_DEFAULT,
    hideBalances: false,
};

function clampAuction(seconds: number): number {
    if (!Number.isFinite(seconds)) return AUCTION_DURATION.default;
    return Math.min(AUCTION_DURATION.max, Math.max(AUCTION_DURATION.min, Math.round(seconds)));
}

function validAutoLock(minutes: unknown): number {
    return AUTO_LOCK_MINUTES_OPTIONS.includes(minutes as number) ? (minutes as number) : AUTO_LOCK_MINUTES_DEFAULT;
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

/** Persist a partial settings update. */
export function saveAppSettings(patch: Partial<AppSettings>): void {
    try {
        const next: AppSettings = { ...getAppSettings(), ...patch };
        next.defaultAuctionDuration = clampAuction(next.defaultAuctionDuration);
        next.autoLockMinutes = validAutoLock(next.autoLockMinutes);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
        /* storage unavailable — non-fatal */
    }
}
