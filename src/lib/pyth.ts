import { PriceData } from '@/types';
import { MarketService, MARKET_SYMBOLS } from './marketData';

// Legacy price interface kept for its many callers. Despite the file name, prices
// no longer come from the browser hitting Pyth Hermes (public Hermes answers 401):
// they come from the BCHMesh server's aggregated feed (see lib/marketData.ts),
// which uses Pyth only when the server has a key.
//
// Keys of this map are the symbols callers may look up; values are the Pyth feed
// ids, kept for reference. Bridged aliases resolve to their underlying asset.
export const PRICE_FEEDS = {
    MOVE: "0x6bf748c908767baa762a1563d454ebec2d5108f8ee36d806aadacc8f0a075b6d",
    SOL: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
    ETH: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    USDC: "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
    USDT: "0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b",
    BCH: "0x3dd2b63686a450ec7290df3a1e0b583c0481f651351edfa7636f39aed55cf8a3",
    BTC: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
    BNB: "0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f",
    XMR: "0x46b8cc9347f04391764a0361e0b17c3ba394b001e7c304f7650f6376e37c321d",
    "WETH.e": "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    "USDC.e": "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
    "USDT.e": "0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b",
};

const ALIASES: Record<string, string> = { 'WETH.e': 'ETH', 'USDC.e': 'USDC', 'USDT.e': 'USDT' };

function toPriceData(symbol: string, usd: number, updatedAt: number): PriceData {
    return {
        id: (PRICE_FEEDS as Record<string, string>)[symbol] ?? symbol,
        price: String(Math.round(usd * 1e8)),
        conf: '0',
        expo: -8,
        publish_time: Math.floor(updatedAt / 1000),
    };
}

export const PriceService = {
    /**
     * Latest fresh USD prices from the mesh server, keyed by symbol.
     * Stale or unavailable symbols are omitted — callers must treat a missing
     * key as "unknown", never substitute a constant. Resolves `{}` if the
     * server is unreachable.
     */
    async getLatestPrices(): Promise<Record<string, PriceData>> {
        let spot;
        try {
            spot = await MarketService.getPrices();
        } catch {
            return {};
        }
        const out: Record<string, PriceData> = {};
        for (const symbol of MARKET_SYMBOLS) {
            const p = spot[symbol];
            if (p && !p.stale && p.price > 0) out[symbol] = toPriceData(symbol, p.price, p.updatedAt);
        }
        for (const [alias, base] of Object.entries(ALIASES)) {
            if (out[base]) out[alias] = { ...out[base], id: (PRICE_FEEDS as Record<string, string>)[alias] };
        }
        return out;
    },

    /** Human-readable USD from a PriceData entry (0 when absent). */
    formatPrice(price: PriceData): number {
        if (!price) return 0;
        return Number(price.price) * Math.pow(10, price.expo);
    }
};
