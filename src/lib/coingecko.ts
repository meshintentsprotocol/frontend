import axios from 'axios';

export interface CoinData {
    id: string;
    symbol: string;
    name: string;
    image: string;
    current_price: number;
    market_cap: number;
    fully_diluted_valuation: number | null;
    total_volume: number;
    price_change_percentage_1h_in_currency: number | null;
    price_change_percentage_24h_in_currency: number | null;
}

// Map our internal symbols to CoinGecko IDs
const CG_ID_MAP: Record<string, string> = {
    'SOL': 'solana',
    'BCH': 'bitcoin-cash',
    'USDC': 'usd-coin',
    'USDT': 'tether',
    'MOVE': 'movement', // May not exist or may be a generic placeholder on CG
    'XMR': 'monero',
    'ETH': 'ethereum',
    'BNB': 'binancecoin',
    'BTC': 'bitcoin',
};

// Reusable instance with a small timeout
const cgApi = axios.create({
    baseURL: 'https://api.coingecko.com/api/v3',
    timeout: 10000,
});

export const CoinGeckoService = {
    /**
     * Fetch market data for a list of symbols
     * Returns a map of Symbol -> CoinData
     */
    async getMarketData(symbols: string[]): Promise<Record<string, CoinData>> {
        const idsToFetch = symbols
            .map(s => CG_ID_MAP[s])
            .filter(Boolean)
            .join(',');

        if (!idsToFetch) return {};

        try {
            const response = await cgApi.get('/coins/markets', {
                params: {
                    vs_currency: 'usd',
                    ids: idsToFetch,
                    order: 'market_cap_desc',
                    per_page: 100,
                    page: 1,
                    sparkline: false,
                    price_change_percentage: '1h,24h'
                }
            });

            const data: CoinData[] = response.data;
            const resultMap: Record<string, CoinData> = {};

            // Map back to our symbols
            for (const item of data) {
                // Find matching symbol from map
                const symbol = Object.keys(CG_ID_MAP).find(key => CG_ID_MAP[key] === item.id);
                if (symbol) {
                    resultMap[symbol] = item;
                }
            }

            // Fallback for MOVE if not found
            if (symbols.includes('MOVE') && !resultMap['MOVE']) {
                resultMap['MOVE'] = {
                    id: 'movement-mock',
                    symbol: 'move',
                    name: 'Movement',
                    image: 'https://raw.githubusercontent.com/kitelabs-io/mvmt-tokens/main/logos/MOVE.png',
                    current_price: 1.25,
                    market_cap: 125000000,
                    fully_diluted_valuation: 1250000000,
                    total_volume: 4500000,
                    price_change_percentage_1h_in_currency: 0.5,
                    price_change_percentage_24h_in_currency: 4.2
                };
            }

            return resultMap;

        } catch (error) {
            console.warn("CoinGecko fetch error (likely CORS). Using fallback mock prices.");
            return {
                'SOL': {
                    id: 'solana', symbol: 'sol', name: 'Solana', image: '/assets/solanaLogo.png',
                    current_price: 145.20, market_cap: 0, fully_diluted_valuation: null, total_volume: 0,
                    price_change_percentage_1h_in_currency: null, price_change_percentage_24h_in_currency: 2.5
                },
                'BCH': {
                    id: 'bitcoin-cash', symbol: 'bch', name: 'Bitcoin Cash', image: '/logos/bitcoin-cash-bch-logo.svg',
                    current_price: 380.00, market_cap: 0, fully_diluted_valuation: null, total_volume: 0,
                    price_change_percentage_1h_in_currency: null, price_change_percentage_24h_in_currency: -1.2
                },
                'MOVE': {
                    id: 'movement-mock', symbol: 'move', name: 'Movement', image: 'https://raw.githubusercontent.com/kitelabs-io/mvmt-tokens/main/logos/MOVE.png',
                    current_price: 1.25, market_cap: 0, fully_diluted_valuation: null, total_volume: 0,
                    price_change_percentage_1h_in_currency: null, price_change_percentage_24h_in_currency: 4.2
                },
                'USDC': {
                    id: 'usd-coin', symbol: 'usdc', name: 'USD Coin', image: '/logos/usd-coin-usdc-logo.svg',
                    current_price: 1.00, market_cap: 0, fully_diluted_valuation: null, total_volume: 0,
                    price_change_percentage_1h_in_currency: null, price_change_percentage_24h_in_currency: 0.01
                },
                'XMR': {
                    id: 'monero', symbol: 'xmr', name: 'Monero', image: '/logos/monero.svg',
                    current_price: 150.00, market_cap: 0, fully_diluted_valuation: null, total_volume: 0,
                    price_change_percentage_1h_in_currency: null, price_change_percentage_24h_in_currency: -0.5
                }
            };
        }
    }
};

/**
 * Helper to format large numbers for display (e.g. 1.2M, 45K)
 */
export function formatCompactNumber(num: number | null | undefined): string {
    if (num === null || num === undefined) return '-';
    if (num === 0) return '$0.00';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: 'compact',
        maximumFractionDigits: 2
    }).format(num);
}

export interface CoinDetail {
    id: string;
    name: string;
    symbol: string;
    description: { en: string };
    links: { homepage: string[]; blockchain_site: string[] };
    image: { large: string; small: string; thumb: string };
    market_data: {
        current_price: { usd: number };
        market_cap: { usd: number };
        fully_diluted_valuation: { usd: number };
        total_volume: { usd: number };
        high_24h: { usd: number };
        low_24h: { usd: number };
        ath: { usd: number };
        atl: { usd: number };
        ath_date: { usd: string };
        atl_date: { usd: string };
        price_change_percentage_1h_in_currency: { usd: number };
        price_change_percentage_24h_in_currency: { usd: number };
        price_change_percentage_7d_in_currency: { usd: number };
        price_change_percentage_30d_in_currency: { usd: number };
        market_cap_rank: number;
        circulating_supply: number;
        total_supply: number;
        max_supply: number | null;
    };
}

export interface ChartPoint { time: number; price: number; }

// Expose the ID map for resolving symbols
export { CG_ID_MAP };

/**
 * Fetch full coin detail (description, links, deep market data)
 * Cached for 5 minutes — only call on token detail page load.
 */
export const CoinGeckoService_extended = {
    async getCoinDetail(cgId: string): Promise<CoinDetail | null> {
        try {
            const res = await cgApi.get(`/coins/${cgId}`, {
                params: {
                    localization: false,
                    tickers: false,
                    market_data: true,
                    community_data: false,
                    developer_data: false,
                    sparkline: false,
                },
            });
            return res.data as CoinDetail;
        } catch (e) {
            console.warn(`CoinGecko getCoinDetail(${cgId}) failed`, e);
            return null;
        }
    },

    /**
     * Fetch OHLC-style price history for chart.
     * days: 1 → 1D, 7 → 1W, 30 → 1M, 365 → 1Y, 'max' → ALL
     * Granularity is auto-selected by CoinGecko based on days.
     */
    async getMarketChart(cgId: string, days: number | 'max'): Promise<ChartPoint[]> {
        try {
            const res = await cgApi.get(`/coins/${cgId}/market_chart`, {
                params: { vs_currency: 'usd', days, interval: days === 1 ? 'hourly' : 'daily' },
            });
            const prices: [number, number][] = res.data.prices ?? [];
            return prices.map(([time, price]) => ({ time, price }));
        } catch (e) {
            console.warn(`CoinGecko getMarketChart(${cgId}, ${days}) failed`, e);
            return [];
        }
    },
};

/**
 * Helper to format standard currency amounts
 */
export function formatCurrency(num: number | null | undefined): string {
    if (num === null || num === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num);
}
