/**
 * Bitfinex HTTP Pricing Client (Tether WDK Pricing compatible)
 *
 * Implements direct HTTP market rate fetching using the Bitfinex Public API v2
 * (as specified in Tether WDK Price Rates / Bitfinex HTTP Client docs).
 * Connects directly in the browser via public CORS endpoints without API keys.
 *
 * Bitfinex symbols:
 * - BCH:  tBCHN:USD
 * - BTC:  tBTCUSD
 * - ETH:  tETHUSD
 * - SOL:  tSOLUSD
 * - XMR:  tXMRUSD
 * - USDT: tUSTUSD
 * - USDC: tUDCUSD
 */

import type { SpotPrice, MarketRow } from './marketData';

const BITFINEX_PUBLIC_API = 'https://api-pub.bitfinex.com/v2';

const BITFINEX_PAIRS: Record<string, string> = {
    'tBCHN:USD': 'BCH',
    'tBTCUSD': 'BTC',
    'tETHUSD': 'ETH',
    'tSOLUSD': 'SOL',
    'tXMRUSD': 'XMR',
    'tUSTUSD': 'USDT',
    'tUDCUSD': 'USDC',
};

export async function fetchBitfinexPrices(timeoutMs = 5000): Promise<Record<string, SpotPrice>> {
    const symbols = Object.keys(BITFINEX_PAIRS).join(',');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(`${BITFINEX_PUBLIC_API}/tickers?symbols=${symbols}`, {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' },
        });

        if (!res.ok) throw new Error(`Bitfinex HTTP ${res.status}`);
        const rows = await res.json() as Array<[string, number, number, number, number, number, number, number, ...any[]]>;
        if (!Array.isArray(rows)) throw new Error('Malformed Bitfinex tickers payload');

        const now = Date.now();
        const prices: Record<string, SpotPrice> = {
            USDC: { price: 1.0, change24h: 0, sources: ['peg'], updatedAt: now, stale: false },
            USDT: { price: 1.0, change24h: 0, sources: ['peg'], updatedAt: now, stale: false },
        };

        for (const row of rows) {
            const sym = row[0];
            const marketSymbol = BITFINEX_PAIRS[sym];
            if (!marketSymbol) continue;

            const lastPrice = Number(row[7]);
            const dailyChangePct = Number(row[6]) * 100; // Bitfinex relative change is a fraction (e.g. -0.05 -> -5%)

            if (Number.isFinite(lastPrice) && lastPrice > 0) {
                prices[marketSymbol] = {
                    price: lastPrice,
                    change24h: Number.isFinite(dailyChangePct) ? dailyChangePct : null,
                    sources: ['bitfinex'],
                    updatedAt: now,
                    stale: false,
                };
            }
        }

        // For symbols not traded on Bitfinex (e.g. MOVE, BNB), fetch via DefiLlama public endpoint
        if (!prices.MOVE || !prices.BNB) {
            try {
                const llamaRes = await fetch(
                    'https://coins.llama.fi/prices/current/coingecko:movement,coingecko:binancecoin',
                    { signal: controller.signal }
                );
                if (llamaRes.ok) {
                    const llamaData = await llamaRes.json();
                    const coins = llamaData?.coins ?? {};
                    if (coins['coingecko:movement']?.price) {
                        prices['MOVE'] = {
                            price: coins['coingecko:movement'].price,
                            change24h: 0,
                            sources: ['defillama'],
                            updatedAt: now,
                            stale: false,
                        };
                    }
                    if (coins['coingecko:binancecoin']?.price) {
                        prices['BNB'] = {
                            price: coins['coingecko:binancecoin'].price,
                            change24h: 0,
                            sources: ['defillama'],
                            updatedAt: now,
                            stale: false,
                        };
                    }
                }
            } catch {
                // Secondary non-blocking fallback
            }
        }

        return prices;
    } finally {
        clearTimeout(timer);
    }
}

const BITFINEX_NAMES: Record<string, string> = {
    BCH: 'Bitcoin Cash', BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana',
    XMR: 'Monero', USDT: 'Tether', USDC: 'USD Coin',
};

/**
 * Build partial MarketRow objects from Bitfinex tickers.
 * Provides price, change24h, volume, high24h, low24h — but NOT marketCap, fdv, change1h,
 * or supply stats (Bitfinex doesn't serve those).
 */
export async function fetchBitfinexMarkets(timeoutMs = 5000): Promise<Record<string, MarketRow>> {
    const symbols = Object.keys(BITFINEX_PAIRS).join(',');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(`${BITFINEX_PUBLIC_API}/tickers?symbols=${symbols}`, {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' },
        });

        if (!res.ok) throw new Error(`Bitfinex HTTP ${res.status}`);
        const rows = await res.json() as Array<[string, ...number[]]>;
        if (!Array.isArray(rows)) throw new Error('Malformed Bitfinex tickers payload');

        const now = Date.now();
        const markets: Record<string, MarketRow> = {};

        for (const row of rows) {
            const sym = row[0] as string;
            const marketSymbol = BITFINEX_PAIRS[sym];
            if (!marketSymbol) continue;

            const lastPrice = Number(row[7]);
            const dailyChangePct = Number(row[6]) * 100;
            const volume = Number(row[8]);
            const high = Number(row[9]);
            const low = Number(row[10]);

            if (Number.isFinite(lastPrice) && lastPrice > 0) {
                markets[marketSymbol] = {
                    symbol: marketSymbol,
                    name: BITFINEX_NAMES[marketSymbol] ?? marketSymbol,
                    image: null,
                    price: lastPrice,
                    change24h: Number.isFinite(dailyChangePct) ? dailyChangePct : null,
                    change1h: null,
                    marketCap: null,
                    fdv: null,
                    volume24h: Number.isFinite(volume) && volume > 0 ? volume * lastPrice : null,
                    sources: ['bitfinex'],
                    updatedAt: now,
                    stale: false,
                };
            }
        }

        return markets;
    } finally {
        clearTimeout(timer);
    }
}
