/**
 * Limit-order expiry: the limits the Mesh server enforces, and the picker's arithmetic.
 *
 * The server accepts a limit order lasting 60 s to 7 days (meshserver createIntent,
 * MIN_DURATION_SEC / MAX_DURATION_SEC). The app asks for at least 5 minutes: shorter
 * orders mostly expire before the first solver cycle sees them.
 */

export const EXPIRY_MIN_SECONDS = 5 * 60;
export const EXPIRY_MAX_SECONDS = 7 * 24 * 3600;

export type ExpiryUnit = 'minutes' | 'hours' | 'days';

export const UNIT_SECONDS: Record<ExpiryUnit, number> = { minutes: 60, hours: 3600, days: 86400 };

export const EXPIRY_PRESETS: ReadonlyArray<{ seconds: number; label: string }> = [
    { seconds: 3600, label: '1H' },
    { seconds: 6 * 3600, label: '6H' },
    { seconds: 86400, label: '1D' },
    { seconds: 3 * 86400, label: '3D' },
    { seconds: EXPIRY_MAX_SECONDS, label: '7D' },
];

export const DEFAULT_EXPIRY_SECONDS = 86400;

export type ExpiryCheck = { ok: true; seconds: number } | { ok: false; error: string };

/** A custom expiry typed as a number and a unit. */
export function checkExpiry(amount: string, unit: ExpiryUnit): ExpiryCheck {
    const v = amount.trim();
    if (!v) return { ok: false, error: 'Enter how long the order should stay open' };
    if (!/^\d*\.?\d*$/.test(v) || !/\d/.test(v)) return { ok: false, error: 'Enter a number' };
    const seconds = Math.round(Number(v) * UNIT_SECONDS[unit]);
    if (seconds < EXPIRY_MIN_SECONDS) return { ok: false, error: 'At least 5 minutes' };
    if (seconds > EXPIRY_MAX_SECONDS) return { ok: false, error: 'At most 7 days' };
    return { ok: true, seconds };
}

/** The largest amount of `unit` that still fits (for the input's max attribute). */
export const maxInUnit = (unit: ExpiryUnit): number => EXPIRY_MAX_SECONDS / UNIT_SECONDS[unit];

/** "1 day 2 hours", "45 minutes", "7 days". At most two parts. */
export function describeDuration(seconds: number): string {
    const parts: string[] = [];
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.round((seconds % 3600) / 60);
    const p = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
    if (d) parts.push(p(d, 'day'));
    if (h) parts.push(p(h, 'hour'));
    if (m && parts.length < 2 && !d) parts.push(p(m, 'minute'));
    return parts.slice(0, 2).join(' ') || p(Math.max(1, Math.round(seconds / 60)), 'minute');
}

/** "Thu 14:32" (or "Oct 29, 14:32" when more than a week out). Local time. */
export function formatExpiryAt(unixSec: number, nowMs = Date.now()): string {
    const d = new Date(unixSec * 1000);
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    const sameDay = new Date(nowMs).toDateString() === d.toDateString();
    if (sameDay) return `today ${time}`;
    const day = (unixSec * 1000 - nowMs) < 6 * 86400_000
        ? d.toLocaleDateString(undefined, { weekday: 'short' })
        : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `${day} ${time}`;
}
