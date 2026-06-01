/**
 * Shared TanStack Query client.
 *
 * One client at the app root gives every consumer request de-duplication,
 * caching, stale-while-revalidate and retry/backoff for free. Balance and
 * price hooks key off this single instance, so the wallet popup, portfolio
 * page and send modal all share one set of in-flight requests.
 */

import { QueryClient } from '@tanstack/react-query';
import { attachPersistence } from './persist';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Balance/price hooks override these where they need to be tighter.
            staleTime: 20_000,
            gcTime: 5 * 60_000,
            retry: 2,
            retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 8_000),
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            // Pause polling while the tab is hidden — saves RPC/API load.
            refetchIntervalInBackground: false,
        },
    },
});

attachPersistence(queryClient);
