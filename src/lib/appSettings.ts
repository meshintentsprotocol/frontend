/**
 * App settings — small user preferences persisted to localStorage.
 *
 * Currently holds the default Dutch-auction duration used to seed new market
 * swaps. Kept as an object so more preferences can be added without changing
 * the storage shape.
 */

const STORAGE_KEY = 'intent_app_settings_v1';

export const AUCTION_DURATION = {
    min: 60,
    max: 3600,
    step: 60,
    default: 3600,
};

export interface AppSettings {
    /** Default Dutch-auction duration for new market swaps, in seconds. */
    defaultAuctionDuration: number;
}

const DEFAULTS: AppSettings = {
    defaultAuctionDuration: AUCTION_DURATION.default,
};

function clampAuction(seconds: number): number {
    if (!Number.isFinite(seconds)) return AUCTION_DURATION.default;
    return Math.min(AUCTION_DURATION.max, Math.max(AUCTION_DURATION.min, Math.round(seconds)));
}

/** Read all settings, falling back to defaults for anything missing/invalid. */
export function getAppSettings(): AppSettings {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...DEFAULTS };
        const parsed = JSON.parse(raw) as Partial<AppSettings>;
        return {
            defaultAuctionDuration: clampAuction(parsed.defaultAuctionDuration ?? DEFAULTS.defaultAuctionDuration),
        };
    } catch {
        return { ...DEFAULTS };
    }
}

/** Convenience reader for the default auction duration (seconds). */
export function getDefaultAuctionDuration(): number {
    return getAppSettings().defaultAuctionDuration;
}

/** Persist a partial settings update. */
export function saveAppSettings(patch: Partial<AppSettings>): void {
    try {
        const next: AppSettings = { ...getAppSettings(), ...patch };
        next.defaultAuctionDuration = clampAuction(next.defaultAuctionDuration);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
        /* storage unavailable — non-fatal */
    }
}
