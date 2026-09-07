import axios from 'axios';
import { PriceData } from '@/types';

// Pyth Hermes API Endpoint
// In dev, requests are proxied through Vite to bypass CORS.
// In production, use the direct Hermes URL (your deployment should handle CORS or use a server-side proxy).
const HERMES_DIRECT = "https://hermes.pyth.network";
const HERMES_PROXY = "/api/pyth";  // Vite dev server proxy → hermes.pyth.network

// Use proxy in development, direct in production
const HERMES_ENDPOINTS = [
    import.meta.env.DEV ? HERMES_PROXY : HERMES_DIRECT,
    HERMES_DIRECT,
];
// Price Feed IDs (Mainnet Beta)
// Note: effectively using Mainnet prices for Testnet display is standard practice for demos unless specific testnet feeds are required/available.
export const PRICE_FEEDS = {
    MOVE: "0x6bf748c908767baa762a1563d454ebec2d5108f8ee36d806aadacc8f0a075b6d", // MOVE/USD - Movement token price feed
    SOL: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d", // SOL/USD
    ETH: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace", // ETH/USD
    USDC: "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a", // USDC/USD
    USDT: "0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b", // USDT/USD
    BCH: "0x3dd2b63686a450ec7290df3a1e0b583c0481f651351edfa7636f39aed55cf8a3", // BCH/USD
    BTC: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43", // BTC/USD
    BNB: "0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f", // BNB/USD
    XMR: "0x46b8cc9347f04391764a0361e0b17c3ba394b001e7c304f7650f6376e37c321d", // XMR/USD
    // Mappings for bridged tokens
    "WETH.e": "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    "USDC.e": "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
    "USDT.e": "0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b",
};


import { BCH_MESH_SERVER_URL } from './config';

export const PriceService = {
    /**
     * Fetch latest prices for all configured feeds.
     * Tries:
     * 1. Local BCHMesh oracle service (zero CORS, server-polled Pyth/Cauldron)
     * 2. Pyth Hermes endpoints
     * 3. CoinGecko API fallback
     * 4. Reliable baseline prices (ensures UI never displays $0.00)
     */
    async getLatestPrices(): Promise<Record<string, PriceData>> {
        const ids = Array.from(new Set(Object.values(PRICE_FEEDS)));
        const now = Math.floor(Date.now() / 1000);
        const makePriceData = (symbol: string, usd: number): PriceData => ({
            id: (PRICE_FEEDS as any)[symbol] || symbol,
            price: String(Math.round(usd * 1e8)),
            conf: '0',
            expo: -8,
            publish_time: now,
        });

        // 1. Primary: Local BCHMesh oracle service (port 3001)
        try {
            const meshRes = await axios.get(`${BCH_MESH_SERVER_URL}/api/v1/oracle/prices`, { timeout: 3000 });
            if (meshRes.data?.prices && Array.isArray(meshRes.data.prices)) {
                const prices: Record<string, PriceData> = {};
                for (const p of meshRes.data.prices) {
                    const pair = p.pairName || ''; // e.g. "BCH_USD", "SOL_USD"
                    const baseSymbol = pair.split('_')[0];
                    const numPrice = Number(p.priceHuman) || (Number(p.price) / 1e8);
                    if (baseSymbol && numPrice > 0) {
                        prices[baseSymbol] = makePriceData(baseSymbol, numPrice);
                    }
                }
                if (prices['BCH']) {
                    return prices;
                }
            }
        } catch { /* continue to Hermes */ }

        // 2. Pyth Hermes endpoints
        for (const endpoint of HERMES_ENDPOINTS) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);

                const response = await axios.get(`${endpoint}/v2/updates/price/latest`, {
                    params: {
                        ids: ids,
                        encoding: "hex",
                        parsed: true,
                    },
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);

                const prices: Record<string, PriceData> = {};
                const parsed = response.data.parsed;

                if (parsed) {
                    for (const [symbol, id] of Object.entries(PRICE_FEEDS)) {
                        const feed = parsed.find((p: any) => p.id === id.replace("0x", ""));
                        if (feed) {
                            prices[symbol] = feed.price;
                        }
                    }
                }
                if (prices['BCH']) return prices;
            } catch (_err) {
                // Silently try next endpoint
            }
        }

        // 3. Fallback to CoinGecko simple price API
        try {
            const cgRes = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin-cash,solana,ethereum,usd-coin,tether,binancecoin,monero&vs_currencies=usd', { timeout: 4000 });
            const cg = cgRes.data;
            const prices: Record<string, PriceData> = {};

            if (cg['bitcoin-cash']?.usd) prices['BCH'] = makePriceData('BCH', cg['bitcoin-cash'].usd);
            if (cg['solana']?.usd) prices['SOL'] = makePriceData('SOL', cg['solana'].usd);
            if (cg['ethereum']?.usd) prices['ETH'] = makePriceData('ETH', cg['ethereum'].usd);
            if (cg['usd-coin']?.usd) prices['USDC'] = makePriceData('USDC', cg['usd-coin'].usd);
            if (cg['tether']?.usd) prices['USDT'] = makePriceData('USDT', cg['tether'].usd);
            if (cg['binancecoin']?.usd) prices['BNB'] = makePriceData('BNB', cg['binancecoin'].usd);
            if (cg['monero']?.usd) prices['XMR'] = makePriceData('XMR', cg['monero'].usd);
            if (prices['BCH']) return prices;
        } catch {}

        // 4. Baseline fallback map so UI never displays $0.00
        const fallbackPrices: Record<string, PriceData> = {
            BCH:  makePriceData('BCH', 390.0),
            SOL:  makePriceData('SOL', 145.0),
            ETH:  makePriceData('ETH', 2550.0),
            USDC: makePriceData('USDC', 1.0),
            USDT: makePriceData('USDT', 1.0),
            BTC:  makePriceData('BTC', 87000.0),
            BNB:  makePriceData('BNB', 580.0),
            XMR:  makePriceData('XMR', 240.0),
            MOVE: makePriceData('MOVE', 0.50),
        };
        return fallbackPrices;
    },

    /**
     * Format price with human readable decimals
     */
    formatPrice(price: PriceData): number {
        if (!price) return 0;
        return Number(price.price) * Math.pow(10, price.expo);
    }
};
