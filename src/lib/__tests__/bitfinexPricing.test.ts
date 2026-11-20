import { describe, it, expect, vi } from 'vitest';
import { fetchBitfinexPrices } from '../bitfinexPricing';

describe('fetchBitfinexPrices', () => {
    it('fetches and maps Bitfinex ticker prices properly', async () => {
        const mockRows = [
            ['tBCHN:USD', 188.94, 272, 190.2, 146, -16.33, -0.0795, 189.5, 311, 206, 139],
            ['tBTCUSD', 58400, 3, 58450, 6, -3200, -0.053, 58420, 2200, 62000, 57000],
            ['tETHUSD', 1600, 1200, 1603, 380, -140, -0.082, 1602.5, 28000, 1770, 1580],
            ['tSOLUSD', 67.5, 2300, 67.6, 3900, -5, -0.068, 67.55, 43000, 73, 67],
            ['tUSTUSD', 1.0, 1000, 1.0, 1000, 0, 0, 1.0001, 1000, 1.01, 0.99],
            ['tUDCUSD', 1.0, 1000, 1.0, 1000, 0, 0, 0.9999, 1000, 1.01, 0.99],
        ];

        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
            if (url.includes('bitfinex')) {
                return {
                    ok: true,
                    json: async () => mockRows,
                } as any;
            }
            if (url.includes('llama')) {
                return {
                    ok: true,
                    json: async () => ({
                        coins: {
                            'coingecko:movement': { price: 0.55 },
                            'coingecko:binancecoin': { price: 580 },
                        },
                    }),
                } as any;
            }
            return { ok: false } as any;
        });

        try {
            const prices = await fetchBitfinexPrices();
            expect(prices.BCH.price).toBe(189.5);
            expect(prices.BCH.sources).toEqual(['bitfinex']);
            expect(prices.BTC.price).toBe(58420);
            expect(prices.ETH.price).toBe(1602.5);
            expect(prices.SOL.price).toBe(67.55);
            expect(prices.USDT.price).toBe(1.0001);
            expect(prices.USDC.price).toBe(0.9999);
            expect(prices.MOVE.price).toBe(0.55);
            expect(prices.BNB.price).toBe(580);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
});
