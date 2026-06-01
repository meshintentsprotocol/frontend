import { useQuery } from '@tanstack/react-query';
import { CoinGeckoService_extended, CG_ID_MAP, type ChartPoint } from '@/lib/coingecko';
import { CauldronService } from '@/lib/cauldron';
import { PriceService } from '@/lib/pyth';

export type TimeRange = '1H' | '1D' | '1W' | '1M' | '1Y' | 'ALL';

const RANGE_TO_CG_DAYS: Record<TimeRange, number | 'max'> = {
    '1H':  0.042,   // ~1 hour worth of data
    '1D':  1,
    '1W':  7,
    '1M':  30,
    '1Y':  365,
    'ALL': 'max',
};

const RANGE_TO_CAULDRON_PERIOD: Record<TimeRange, '1h' | '24h' | '7d' | '30d' | '365d' | 'all'> = {
    '1H':  '1h',
    '1D':  '24h',
    '1W':  '7d',
    '1M':  '30d',
    '1Y':  '365d',
    'ALL': 'all',
};

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
                const period = RANGE_TO_CAULDRON_PERIOD[range];
                const [history, pythPrices] = await Promise.all([
                    CauldronService.getPriceHistory(tokenId, period, isMainnet),
                    PriceService.getLatestPrices(),
                ]);

                const bchPrice = pythPrices['BCH']
                    ? PriceService.formatPrice(pythPrices['BCH'])
                    : 0;

                if (history.length === 0) return [];

                return history.map(p => ({
                    time: p.timestamp * 1000,  // ensure ms for chart
                    price: (p.price_sats / 1e8) * bchPrice,
                }));
            }

            // Cross-chain: CoinGecko
            const cgId = CG_ID_MAP[tokenId.toUpperCase()];
            if (!cgId) return [];

            const days = RANGE_TO_CG_DAYS[range];
            return CoinGeckoService_extended.getMarketChart(cgId, days);
        },
        staleTime: 2 * 60_000,   // 2 minutes — chart data doesn't need to be real-time
        retry: 1,
    });
}
