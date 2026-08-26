/**
 * usePrices — single source of truth for token USD prices.
 *
 * Price comes from Pyth (high-frequency, no strict rate limit); the 24h change
 * comes from CoinGecko (Pyth carries no change figure). Both are independent
 * queries so a CoinGecko rate-limit never blocks price display, and both are
 * shared/de-duplicated across every consumer via the app-wide QueryClient.
 */

import { useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { PriceService } from '@/lib/pyth';
import { CoinGeckoService } from '@/lib/coingecko';
import { readPersisted } from '@/lib/persist';

export interface TokenPrice {
    /** USD price (Pyth). */
    price: number;
    /** 24h change percentage (CoinGecko). */
    change24h: number;
}

export type PriceMap = Record<string, TokenPrice>;

const PYTH_KEY = ['prices', 'pyth'] as const;
const CG_KEY = ['prices', 'coingecko'] as const;

// Symbols we need a 24h change figure for.
const CG_SYMBOLS = ['SOL', 'BCH', 'BTC', 'USDC', 'USDT', 'ETH', 'BNB', 'XMR'];

type PythPrices = Record<string, number>;
type ChangeMap = Record<string, number>;

export function usePrices() {
    const pyth = useQuery<PythPrices>({
        queryKey: PYTH_KEY,
        queryFn: async () => {
            const raw = await PriceService.getLatestPrices();
            const out: PythPrices = {};
            for (const [symbol, data] of Object.entries(raw)) {
                out[symbol] = PriceService.formatPrice(data);
            }
            // Empty means the Pyth request failed — throw so react-query keeps
            // the previous prices rather than zeroing every token's USD value.
            if (Object.keys(out).length === 0) {
                throw new Error('Pyth returned no prices');
            }
            return out;
        },
        staleTime: 10_000,
        refetchInterval: 15_000,
        placeholderData: keepPreviousData,
        initialData: () => readPersisted<PythPrices>([...PYTH_KEY])?.data,
        initialDataUpdatedAt: () => readPersisted([...PYTH_KEY])?.updatedAt,
    });

    const coingecko = useQuery<ChangeMap>({
        queryKey: CG_KEY,
        queryFn: async () => {
            const market = await CoinGeckoService.getMarketData(CG_SYMBOLS);
            const out: ChangeMap = {};
            for (const [symbol, data] of Object.entries(market)) {
                out[symbol] = data.price_change_percentage_24h_in_currency ?? 0;
            }
            return out;
        },
        staleTime: 60_000,
        refetchInterval: 60_000,
        placeholderData: keepPreviousData,
        initialData: () => readPersisted<ChangeMap>([...CG_KEY])?.data,
        initialDataUpdatedAt: () => readPersisted([...CG_KEY])?.updatedAt,
    });

    const prices = useMemo<PriceMap>(() => {
        const pythData = pyth.data ?? {};
        const changeData = coingecko.data ?? {};
        const merged: PriceMap = {};
        
        // Static fallback defaults so UI components never render $0.00 for known symbols when Pyth is loading/offline
        const defaults: Record<string, number> = {
            BCH: 380.0,
            BTC: 65000.0,
            ETH: 3200.0,
            SOL: 140.0,
            MOVE: 0.50,
            USDC: 1.0,
            USDT: 1.0,
            PUSDTEST: 1.0,
            PUSD: 1.0,
            fUSD: 1.0,
            sUSD: 1.0,
        };

        const allSymbols = new Set([...Object.keys(pythData), ...Object.keys(changeData), ...Object.keys(defaults)]);
        for (const symbol of allSymbols) {
            merged[symbol] = {
                price: pythData[symbol] ?? defaults[symbol] ?? 0,
                change24h: changeData[symbol] ?? 0,
            };
        }
        return merged;
    }, [pyth.data, coingecko.data]);

    return {
        prices,
        isLoading: pyth.isLoading,
        isFetching: pyth.isFetching || coingecko.isFetching,
        refetch: () => {
            pyth.refetch();
            coingecko.refetch();
        },
    };
}
