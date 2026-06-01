import axios from 'axios';
import { PriceData } from '@/types';

// Pyth Hermes API Endpoint
const HERMES_URL = "https://hermes.pyth.network";

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

export const PriceService = {
    /**
     * Fetch latest prices for all configured feeds
     */
    async getLatestPrices(): Promise<Record<string, PriceData>> {
        try {
            const ids = Array.from(new Set(Object.values(PRICE_FEEDS)));
            console.log("Fetching Pyth prices for IDs:", ids);

            const response = await axios.get(`${HERMES_URL}/v2/updates/price/latest`, {
                params: {
                    ids: ids,
                    encoding: "hex",
                    parsed: true,
                }
            });

            const prices: Record<string, PriceData> = {};

            // Map response back to symbols
            // Map response back to symbols
            const parsed = response.data.parsed;
            // console.log("Pyth response parsed:", parsed);

            if (parsed) {
                // Determine which ID belongs to which symbol
                for (const [symbol, id] of Object.entries(PRICE_FEEDS)) {
                    const feed = parsed.find((p: any) => p.id === id.replace("0x", ""));
                    if (feed) {
                        prices[symbol] = feed.price;
                    } else {
                        console.warn(`No price feed found for ${symbol} (ID: ${id})`);
                    }
                }
            }
            console.log("Processed prices:", prices);
            return prices;

        } catch (error) {
            console.error("Failed to fetch Pyth prices:", error);
            return {};
        }
    },

    /**
     * Format price with human readable decimals
     */
    formatPrice(price: PriceData): number {
        if (!price) return 0;
        return Number(price.price) * Math.pow(10, price.expo);
    }
};
