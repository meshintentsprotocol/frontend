/**
 * Portfolio valuation history store.
 *
 * Saves real hourly valuation snapshots ({ t, totalUsd }) in localStorage,
 * keyed by active account addresses and network.
 * Keeps up to 30 days of data (max 720 points).
 * Replaces fake/invented chart data (decision A6).
 *
 * Phase 4: Portfolio
 */

export interface PortfolioHistoryPoint {
    t: number;
    totalUsd: number;
}

const MAX_POINTS = 720; // 30 days * 24 hours
const MIN_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Generate a stable storage key for a set of active addresses on a network.
 */
export function getHistoryKey(network: string, addresses: string[]): string {
    const clean = addresses
        .map(a => a.trim().toLowerCase())
        .filter(Boolean)
        .sort();
    return `portfolio_history_${network.toLowerCase()}_${clean.join('_')}`;
}

/**
 * Read saved history points for an active account set.
 */
export function getPortfolioHistory(network: string, addresses: string[]): PortfolioHistoryPoint[] {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    if (!addresses.length) return [];

    try {
        const key = getHistoryKey(network, addresses);
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed.filter(p => typeof p.t === 'number' && typeof p.totalUsd === 'number');
        }
        return [];
    } catch {
        return [];
    }
}

/**
 * Record a new valuation snapshot if at least 1 hour has passed since the last one.
 * Returns the updated history list.
 */
export function recordPortfolioPoint(
    network: string,
    addresses: string[],
    totalUsd: number,
    nowMs: number = Date.now()
): PortfolioHistoryPoint[] {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    if (!addresses.length) return [];
    if (!Number.isFinite(totalUsd) || totalUsd < 0) return [];

    const key = getHistoryKey(network, addresses);
    let list = getPortfolioHistory(network, addresses);

    const last = list[list.length - 1];
    if (!last || nowMs - last.t >= MIN_INTERVAL_MS) {
        list.push({ t: nowMs, totalUsd });
        if (list.length > MAX_POINTS) {
            list = list.slice(-MAX_POINTS);
        }
        try {
            localStorage.setItem(key, JSON.stringify(list));
        } catch { /* storage full / non-fatal */ }
    }

    return list;
}
