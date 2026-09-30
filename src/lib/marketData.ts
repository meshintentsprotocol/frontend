// ============================================================================
// Market data — every USD price, 24h change, market stat and chart in the app
// comes from the BCHMesh server, which aggregates Coinbase / OKX / Kraken (and
// Pyth when keyed) server-side and caches CoinGecko facts. The browser never
// calls a price vendor directly, and nothing here invents a number: a missing
// price is `null`/absent and the UI shows "–".
// Server routes: /api/v1/prices, /api/v1/market[/:symbol[/chart]], /tokens/:id/history
// ============================================================================

import { BCH_MESH_SERVER_URL } from './config';

export type ChartRange = '1H' | '1D' | '1W' | '1M' | '1Y' | 'ALL';
export interface ChartPoint { time: number; price: number }

export interface SpotPrice {
    price: number;
    /** Percent; null when no source reports it */
    change24h: number | null;
    sources: string[];
    updatedAt: number;
    stale: boolean;
}

export interface MarketRow extends SpotPrice {
    symbol: string;
    name: string;
    image: string | null;
    marketCap: number | null;
    fdv: number | null;
    volume24h: number | null;
    change1h: number | null;
}

export interface MarketInfo {
    name: string;
    description: string;
    image: string | null;
    homepage: string | null;
    explorers: string[];
    marketCap: number | null;
    fdv: number | null;
    volume24h: number | null;
    high24h: number | null;
    low24h: number | null;
    ath: number | null;
    atl: number | null;
    change1h: number | null;
    change7d: number | null;
    circulatingSupply: number | null;
    totalSupply: number | null;
}

export interface MarketDetail {
    symbol: string;
    price: number | null;
    change24h: number | null;
    sources: string[];
    stale: boolean;
    info: MarketInfo | null;
}

export interface TokenHistoryPoint { time: number; priceSats: number; price: number | null }

/** Symbols the server prices. */
export const MARKET_SYMBOLS = ['BCH', 'BTC', 'ETH', 'SOL', 'BNB', 'XMR', 'MOVE', 'USDC', 'USDT'] as const;

/**
 * Map a display/bridged symbol to the market symbol that prices it:
 * "USDC (MOVE)" → USDC, "WETH.e" → ETH, "USDT.b" → USDT. Null if unpriced.
 */
export function marketSymbolFor(symbol: string | null | undefined): string | null {
    if (!symbol) return null;
    let s = symbol.toUpperCase().replace(/\s*\(.*\)\s*$/, '').replace(/\.(E|B)$/, '').trim();
    if (s === 'WETH') s = 'ETH';
    if (s === 'WBTC') s = 'BTC';
    if (s === 'WBNB') s = 'BNB';
    return (MARKET_SYMBOLS as readonly string[]).includes(s) ? s : null;
}

async function getJson<T>(path: string, timeoutMs = 8000): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(`${BCH_MESH_SERVER_URL}${path}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
        return await res.json() as T;
    } finally {
        clearTimeout(timer);
    }
}

// Spot prices are read by many components at once — share one request.
const SPOT_TTL_MS = 10_000;
let spotCache: { at: number; value: Record<string, SpotPrice> } | null = null;
let spotInflight: Promise<Record<string, SpotPrice>> | null = null;

export const MarketService = {
    /** Live spot prices keyed by market symbol (stale entries included, flagged). */
    async getPrices(): Promise<Record<string, SpotPrice>> {
        if (spotCache && Date.now() - spotCache.at < SPOT_TTL_MS) return spotCache.value;
        if (spotInflight) return spotInflight;
        spotInflight = getJson<{ prices: Record<string, SpotPrice> }>('/api/v1/prices', 5000)
            .then(body => {
                const value = body.prices ?? {};
                spotCache = { at: Date.now(), value };
                return value;
            })
            .finally(() => { spotInflight = null; });
        return spotInflight;
    },

    /** Price + table stats (mcap / FDV / volume / 1h) for every market symbol. */
    async getMarkets(): Promise<Record<string, MarketRow>> {
        const body = await getJson<{ markets: MarketRow[] }>('/api/v1/market');
        return Object.fromEntries((body.markets ?? []).map(m => [m.symbol, m]));
    },

    async getMarket(symbol: string): Promise<MarketDetail> {
        return getJson<MarketDetail>(`/api/v1/market/${encodeURIComponent(symbol)}`, 12_000);
    },

    async getChart(symbol: string, range: ChartRange): Promise<ChartPoint[]> {
        const body = await getJson<{ points: ChartPoint[] }>(`/api/v1/market/${encodeURIComponent(symbol)}/chart?range=${range}`, 12_000);
        return body.points ?? [];
    },

    /** Cauldron trade history for a CashToken, per whole token, USD aligned to BCH/USD at each point. */
    async getTokenHistory(category: string, range: ChartRange, isMainnet: boolean): Promise<TokenHistoryPoint[]> {
        const network = isMainnet ? 'mainnet' : 'chipnet';
        const body = await getJson<{ points: TokenHistoryPoint[] }>(`/tokens/${category}/history?network=${network}&range=${range}`, 12_000);
        return body.points ?? [];
    },
};

// ── Formatting ──────────────────────────────────────────────────────────────

/** Compact USD for large numbers (1.2M, 45K); "-" when unknown. */
export function formatCompactNumber(num: number | null | undefined): string {
    if (num === null || num === undefined || !Number.isFinite(num)) return '-';
    if (num === 0) return '$0.00';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: 'compact',
        maximumFractionDigits: 2,
    }).format(num);
}

/** Standard USD amount; "-" when unknown. */
export function formatCurrency(num: number | null | undefined): string {
    if (num === null || num === undefined || !Number.isFinite(num)) return '-';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(num);
}
