import { describe, it, expect } from 'vitest';
import { normalizeSwapServer } from '@/lib/relayers';
import { holdingChains, holdingsFrom } from '../useHoldings';
import type { ActivityItem, ChainBalance, SolanaBalance, SwapServerConfig } from '../types';
import testnet from './fixtures.json';
import mainnet from './fixtures.mainnet.json';

/** The swap server's rows in the portfolio, the wallet's token list and the explore feed. */
const testnetConfig = testnet.config as unknown as SwapServerConfig;
const mainnetConfig = mainnet.config as unknown as SwapServerConfig;
const items = testnet.activity.items as unknown as ActivityItem[];

const bal = (chain: string, display: string): ChainBalance => ({ chain, owner: 'x', usdc: String(Math.round(Number(display) * 1e6)), display, native: '0', nativeDecimals: 18, nativeSymbol: 'ETH' });
const sol = (over: Partial<SolanaBalance>): SolanaBalance => ({ mint: 'Mint1111111111111111111111111111111111111111', native: false, amount: '1', decimals: 6, display: '1', verified: true, isStock: false, ...over });

describe('which chains are asked for a USDC balance', () => {
    it('this mode\'s chains, minus the ones the portfolio reads itself', () => {
        expect(holdingChains(testnetConfig, false).map(c => c.key).sort()).toEqual(['arb-sepolia', 'arc-testnet', 'base-sepolia', 'op-sepolia']);
        expect(holdingChains(mainnetConfig, true).map(c => c.key).sort()).toEqual(['arbitrum', 'arc', 'base', 'ethereum', 'optimism']);
    });
    it('none from a server on the other network, none without a config', () => {
        expect(holdingChains(testnetConfig, true)).toEqual([]);
        expect(holdingChains(mainnetConfig, false)).toEqual([]);
        expect(holdingChains(undefined, false)).toEqual([]);
    });
});

describe('portfolio rows', () => {
    it('one USDC row per chain with a balance, named after the chain', () => {
        const rows = holdingsFrom(testnetConfig, [bal('base-sepolia', '3.96'), bal('arc-testnet', '0'), bal('nowhere', '5')], [], { isMainnet: false, usdcPrice: 1 });
        expect(rows).toEqual([{ symbol: 'USDC (Base Sepolia)', name: 'USD Coin on Base Sepolia', chain: 'Base Sepolia', icon: '/logos/usd-coin-usdc-logo.svg', decimals: 6, balance: 3.96, price: 1, valueUsd: 3.96, change24h: 0 }]);
    });
    it('Solana tokens only in Mainnet mode, without the three the portfolio already shows', () => {
        const held = [
            sol({ mint: 'So11111111111111111111111111111111111111112', native: true, symbol: 'SOL', display: '2' }),
            sol({ mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC', display: '10' }),
            sol({ mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', symbol: 'JUP', name: 'Jupiter', display: '100', usdPrice: 0.5, usdValue: 50 }),
            sol({ mint: 'Empty11111111111111111111111111111111111111', symbol: 'ZERO', display: '0' }),
        ];
        expect(holdingsFrom(mainnetConfig, [], held, { isMainnet: false, usdcPrice: 1 })).toEqual([]);
        const rows = holdingsFrom(mainnetConfig, [], held, { isMainnet: true, usdcPrice: 1 });
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ symbol: 'JUP', chain: 'Solana', balance: 100, price: 0.5, valueUsd: 50 });
    });
    it('a Solana token never takes a symbol other screens look up alone', () => {
        const rows = holdingsFrom(mainnetConfig, [], [sol({ symbol: 'USDT', display: '3' }), sol({ mint: 'Fake111111111111111111111111111111111111111', symbol: 'usdc', display: '3' })], { isMainnet: true, usdcPrice: 1 });
        expect(rows.map(r => r.symbol)).toEqual(['USDT (SOL)', 'usdc (SOL)']);
    });
    it('a token Jupiter does not know is listed by its mint and adds nothing to the total', () => {
        const [row] = holdingsFrom(mainnetConfig, [], [sol({ mint: 'Unknown1111111111111111111111111111111111111', display: '7' })], { isMainnet: true, usdcPrice: 1 });
        expect(row).toMatchObject({ symbol: 'Unkn…1111', name: 'Unknown token', balance: 7, price: 0, valueUsd: 0 });
    });
});

describe('explore rows', () => {
    it('every recorded transfer maps to a row with both sides, a status and its own link', () => {
        for (const i of items) {
            const tx = normalizeSwapServer(i);
            expect(tx).toMatchObject({ id: i.id, source: 'cctp', sellToken: 'USDC', buyToken: 'USDC', sellAmount: i.sell.display, makerAddress: i.owner });
            expect(tx.direction).toBe(`${i.sell.chainName} → ${i.buy.chainName}`);
            expect(tx.createdAt).toBeLessThan(1e11);   // seconds, like the other sources
            expect(tx.explorerUrl).toBe(i.links.destination ?? i.links.source);
            expect(tx.fillTxid).toBeUndefined();
        }
        const done = items.find(i => i.phase === 'completed')!;
        expect(normalizeSwapServer(done).status).toBe('COMPLETED');
    });
    it('a swap is a jupiter row on Solana', () => {
        const swap = { ...items[0], kind: 'swap', product: 'jupiter', phase: 'processing', sell: { ...items[0].sell, symbol: 'SOL' }, buy: { ...items[0].buy, symbol: undefined } } as unknown as ActivityItem;
        expect(normalizeSwapServer(swap)).toMatchObject({ source: 'jupiter', direction: 'Solana', status: 'ACTIVE', sellToken: 'SOL', buyToken: 'TOKEN' });
    });
});
