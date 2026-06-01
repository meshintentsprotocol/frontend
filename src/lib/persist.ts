/**
 * Lightweight localStorage persistence for TanStack Query.
 *
 * Avoids the extra `@tanstack/query-*-persist-*` packages: a single cache
 * subscription mirrors successful balance/price queries to localStorage, and
 * `readPersisted()` feeds them back as `initialData` so a reloaded page (or a
 * freshly opened wallet popup) shows last-known values instantly and then
 * revalidates in the background.
 *
 * Only JSON-safe query results are persisted — balance hooks deliberately
 * return numbers/strings (no bigint) so this stays a plain JSON round-trip.
 */

import type { QueryClient } from '@tanstack/react-query';

const PREFIX = 'rq_cache_v1_';

// Only queries whose first key segment is one of these are mirrored to storage.
const PERSIST_ROOTS = ['prices', 'evm-balances', 'sol-balances', 'btc-balance', 'bch-balance', 'bch-tokens'];

// Drop persisted entries older than this — a very stale balance is worse than
// a brief skeleton.
const MAX_AGE_MS = 10 * 60_000;

interface PersistedEntry<T> {
    data: T;
    updatedAt: number;
}

/** Read a persisted query result by its exact query key. */
export function readPersisted<T>(queryKey: readonly unknown[]): PersistedEntry<T> | undefined {
    try {
        const raw = localStorage.getItem(PREFIX + JSON.stringify(queryKey));
        if (!raw) return undefined;
        const parsed = JSON.parse(raw) as PersistedEntry<T>;
        if (!parsed || typeof parsed.updatedAt !== 'number') return undefined;
        if (Date.now() - parsed.updatedAt > MAX_AGE_MS) return undefined;
        return parsed;
    } catch {
        return undefined;
    }
}

/** Subscribe to the query cache and mirror whitelisted successful results. */
export function attachPersistence(queryClient: QueryClient): void {
    queryClient.getQueryCache().subscribe((event) => {
        const query = event?.query;
        if (!query || query.state.status !== 'success' || query.state.data === undefined) return;

        const root = Array.isArray(query.queryKey) ? query.queryKey[0] : undefined;
        if (typeof root !== 'string' || !PERSIST_ROOTS.includes(root)) return;

        try {
            localStorage.setItem(
                PREFIX + JSON.stringify(query.queryKey),
                JSON.stringify({ data: query.state.data, updatedAt: query.state.dataUpdatedAt }),
            );
        } catch {
            /* quota exceeded or non-serializable — non-fatal */
        }
    });
}
