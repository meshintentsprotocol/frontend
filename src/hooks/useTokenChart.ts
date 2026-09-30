import { useQuery } from '@tanstack/react-query';
import { MarketService, marketSymbolFor, type ChartPoint, type ChartRange } from '@/lib/marketData';

export type TimeRange = ChartRange;

/**
 * USD price history for the token detail chart, served by the mesh server:
 *   CashToken  → Cauldron trade history, USD aligned to BCH/USD at each point
 *   otherwise  → exchange candles (Kraken / OKX)
 * Points without a USD value (BCH/USD unavailable) are dropped.
 */
export function useTokenChart(
    tokenId: string,
    isCashToken: boolean,
    range: TimeRange,
    isMainnet: boolean
) {
    return useQuery<ChartPoint[]>({
        queryKey: ['token-chart', tokenId, isCashToken, range, isMainnet],
        queryFn: async () => {
            if (isCashToken) {
                const history = await MarketService.getTokenHistory(tokenId, range, isMainnet);
                return history
                    .filter((p): p is { time: number; priceSats: number; price: number } => p.price !== null && p.price > 0)
                    .map(p => ({ time: p.time, price: p.price }));
            }
            const symbol = marketSymbolFor(tokenId);
            if (!symbol) return [];
            return MarketService.getChart(symbol, range);
        },
        staleTime: 60_000,
        retry: 1,
    });
}
