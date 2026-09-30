/**
 * usePrices — single source of truth for token USD prices.
 *
 * Price and 24h change both come from the BCHMesh server's aggregated feed
 * (/api/v1/prices), shared across every consumer via the app-wide QueryClient.
 * Stale entries are dropped, so a token without a live price is simply absent.
 */

import { useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { MarketService, type SpotPrice } from '@/lib/marketData';
import { readPersisted } from '@/lib/persist';

export interface TokenPrice {
    /** USD price */
    price: number;
    /** 24h change percentage (0 when no source reports one) */
    change24h: number;
    /** Venues that produced this price (coinbase, okx, kraken, pyth, …) */
    sources: string[];
}

export type PriceMap = Record<string, TokenPrice>;

const PRICES_KEY = ['prices', 'mesh'] as const;
/** Matches the server's PRICE_STALE_MS. */
const PRICE_MAX_AGE_MS = 5 * 60_000;

type SpotMap = Record<string, SpotPrice>;

export function usePrices() {
    const query = useQuery<SpotMap>({
        queryKey: PRICES_KEY,
        queryFn: async () => {
            const spot = await MarketService.getPrices();
            // Empty means the server has nothing yet — throw so react-query keeps
            // the previous prices rather than blanking every USD value.
            if (Object.keys(spot).length === 0) throw new Error('Mesh server returned no prices');
            return spot;
        },
        staleTime: 10_000,
        refetchInterval: 15_000,
        placeholderData: keepPreviousData,
        initialData: () => readPersisted<SpotMap>([...PRICES_KEY])?.data,
        initialDataUpdatedAt: () => readPersisted([...PRICES_KEY])?.updatedAt,
    });

    const prices = useMemo<PriceMap>(() => {
        const merged: PriceMap = {};
        const now = Date.now();
        for (const [symbol, p] of Object.entries(query.data ?? {})) {
            // `stale` is judged at fetch time; a persisted snapshot can outlive it.
            if (p.stale || !(p.price > 0) || now - p.updatedAt > PRICE_MAX_AGE_MS) continue;
            merged[symbol] = { price: p.price, change24h: p.change24h ?? 0, sources: p.sources };
        }
        return merged;
    }, [query.data]);

    return {
        prices,
        isLoading: query.isLoading,
        isFetching: query.isFetching,
        refetch: () => { query.refetch(); },
    };
}
