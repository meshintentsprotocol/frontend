import { describe, it, expect } from 'vitest';
import type { Token } from '@/types';
import { ALL_BCH_SWAP_TOKENS, MAINNET_SWAP_TOKENS, BCH_TOKENS, ETH_TOKENS, SOLANA_TOKENS, MOVEMENT_TOKENS, XMR_TOKENS, BASE_TOKENS } from '@/components/bch-swap/BCHTokenSelector';
import { isEvmChain } from '@/lib/evmChains';
import { pusdToken } from '@/lib/pusd';
import { resolveRoute, cctpChainOf, jupiterMintOf, NATIVE_SOL_MINT } from '../routing';
import { cctpTokens, withCctpTokens, pairAfterSelect, tokenKey } from '../tokens';
import type { SwapServerConfig } from '../types';
import fixtures from './fixtures.json';

/**
 * Routing against the real rows of the token selector and a /config recorded from the running server.
 * The point of most of these: a pair goes to an existing flow, to the swap server, or nowhere. It never falls
 * into the BCH CashToken executor by accident.
 */
const config = fixtures.config as unknown as SwapServerConfig;
const testnet = { isMainnet: false, config };
const mainnet = { isMainnet: true, config };

const find = (list: Token[], chain: string, symbol: string) => {
    const t = list.find(x => x.chain === chain && x.symbol === symbol);
    if (!t) throw new Error(`no ${symbol} on ${chain}`);
    return t;
};
const BCH = BCH_TOKENS[0];
const PUSD = pusdToken(false);
const ETH = find(ETH_TOKENS, 'ethereum', 'ETH');
const USDC_ETH = find(ETH_TOKENS, 'ethereum', 'USDC');
const USDT_ETH = find(ETH_TOKENS, 'ethereum', 'USDT');
const SOL = find(SOLANA_TOKENS, 'solana', 'SOL');
const USDC_SOL = find(SOLANA_TOKENS, 'solana', 'USDC');
const MOVE = find(MOVEMENT_TOKENS, 'movement', 'MOVE');
const XMR = XMR_TOKENS[0];
const merged = withCctpTokens(ALL_BCH_SWAP_TOKENS, config, false);
const USDC_BASE = find(merged, 'base', 'USDC');
const USDC_ARC = find(merged, 'arc', 'USDC');
const JUP: Token = { symbol: 'JUP', name: 'Jupiter', icon: '', decimals: 6, type: 'spl-token', chain: 'solana', address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', swapServer: { product: 'jupiter', verified: true } };
const USDC_MAINNET: Token = { symbol: 'USDC', name: 'USD Coin', icon: '', decimals: 6, type: 'spl-token', chain: 'solana', address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', swapServer: { product: 'jupiter', verified: true } };

/** detectSwapType, as in BCHSwapContext.tsx: the last line is the fallthrough this module guards. */
function detectSwapType(sellChain?: string, buyChain?: string): string {
    if (sellChain === 'bch' && buyChain === 'bch') return 'same-chain';
    if (sellChain === 'bch' && buyChain === 'solana') return 'bch-to-sol';
    if (sellChain === 'solana' && buyChain === 'bch') return 'sol-to-bch';
    if (sellChain === 'bch' && buyChain === 'movement') return 'bch-to-mov';
    if (sellChain === 'movement' && buyChain === 'bch') return 'mov-to-bch';
    if (sellChain === 'solana' && buyChain === 'movement') return 'sol-to-mov';
    if (sellChain === 'movement' && buyChain === 'solana') return 'mov-to-sol';
    if (sellChain === 'bch' && buyChain === 'xmr') return 'bch-to-xmr';
    if (sellChain === 'xmr' && buyChain === 'bch') return 'xmr-to-bch';
    if (isEvmChain(sellChain) && buyChain === 'bch') return 'eth-to-bch';
    if (sellChain === 'bch' && isEvmChain(buyChain)) return 'bch-to-eth';
    return 'FALLTHROUGH';
}

describe('pairs an existing flow owns are left alone', () => {
    it.each([
        ['BCH → pUSD', BCH, PUSD], ['pUSD → BCH', PUSD, BCH], ['BCH → SOL', BCH, SOL], ['SOL → BCH', SOL, BCH],
        ['USDC (Solana) → BCH', USDC_SOL, BCH], ['BCH → MOVE', BCH, MOVE], ['MOVE → SOL', MOVE, SOL], ['BCH → XMR', BCH, XMR],
        ['ETH → BCH', ETH, BCH], ['BCH → USDC (Sepolia)', BCH, USDC_ETH],
    ])('%s', (_name, sell, buy) => {
        expect(resolveRoute(sell, buy, testnet)).toBeNull();
        expect(resolveRoute(sell, buy, mainnet)).toBeNull();
        expect(resolveRoute(sell, buy, { isMainnet: false })).toBeNull();   // the swap server being down changes nothing for them
    });

    it('a CashToken without a chain is BCH, as the card has always treated it', () => {
        const ct: Token = { symbol: 'FURU', name: 'Furu', icon: '', decimals: 2, type: 'abc', categoryId: 'abc' };
        expect(resolveRoute(BCH, ct, testnet)).toBeNull();
        expect(resolveRoute(ct, BCH, mainnet)).toBeNull();
    });

    it('agrees with detectSwapType on every pair of static rows: null exactly where it has an executor', () => {
        let handled = 0, guarded = 0;
        for (const list of [ALL_BCH_SWAP_TOKENS, MAINNET_SWAP_TOKENS]) {
            for (const sell of list) for (const buy of list) {
                const existing = detectSwapType(sell.chain, buy.chain) !== 'FALLTHROUGH';
                const route = resolveRoute(sell, buy, { isMainnet: list === MAINNET_SWAP_TOKENS, config });
                if (existing) { expect(route, `${tokenKey(sell)} → ${tokenKey(buy)}`).toBeNull(); handled++; }
                else { expect(route, `${tokenKey(sell)} → ${tokenKey(buy)}`).not.toBeNull(); guarded++; }
            }
        }
        expect(handled).toBeGreaterThan(100);
        expect(guarded).toBeGreaterThan(100);   // every one of these used to reach the CashToken executor
    });
});

describe('cross-chain USDC, testnet mode', () => {
    it('the two static USDC rows already route: Sepolia ↔ Solana devnet', () => {
        expect(resolveRoute(USDC_ETH, USDC_SOL, testnet)).toMatchObject({ kind: 'usdc-cctp', src: { key: 'eth-sepolia' }, dst: { key: 'solana-devnet' } });
        expect(resolveRoute(USDC_SOL, USDC_ETH, testnet)).toMatchObject({ kind: 'usdc-cctp', src: { key: 'solana-devnet' }, dst: { key: 'eth-sepolia' } });
    });

    it('every ordered pair of the six USDC rows is a route', () => {
        const rows = merged.filter(t => cctpChainOf(t, config));
        expect(rows.map(t => t.chain).sort()).toEqual(['arbitrum', 'arc', 'base', 'ethereum', 'optimism', 'solana']);
        let n = 0;
        for (const a of rows) for (const b of rows) {
            const r = resolveRoute(a, b, testnet);
            if (a === b) expect(r).toMatchObject({ kind: 'unsupported', reason: 'Pick USDC on two different chains.' });
            else { expect(r?.kind, `${a.chain} → ${b.chain}`).toBe('usdc-cctp'); n++; }
        }
        expect(n).toBe(30);
    });

    it('a row is matched by its address, not by its symbol', () => {
        expect(cctpChainOf({ ...USDC_ETH, address: '0x0000000000000000000000000000000000000001' }, config)).toBeUndefined();
        expect(cctpChainOf({ ...USDC_ETH, address: USDC_ETH.address!.toLowerCase() }, config)?.key).toBe('eth-sepolia');
        expect(cctpChainOf(USDT_ETH, config)).toBeUndefined();
        expect(cctpChainOf(USDC_SOL, config)?.key).toBe('solana-devnet');
        expect(cctpChainOf({ ...USDC_SOL, address: USDC_SOL.address!.toLowerCase() }, config)).toBeUndefined();   // Solana addresses are case-sensitive
    });

    it('a route the operator closed is not offered', () => {
        const closed = { ...config, cctp: { ...config.cctp, closedRoutes: ['base-sepolia>arc-testnet'] } };
        expect(resolveRoute(USDC_BASE, USDC_ARC, { isMainnet: false, config: closed })).toMatchObject({ kind: 'unsupported', reason: 'Base Sepolia → Arc Testnet is temporarily closed.' });
        expect(resolveRoute(USDC_ARC, USDC_BASE, { isMainnet: false, config: closed })?.kind).toBe('usdc-cctp');
    });

    it('a chain the operator closed drops out of /config, so its row is no longer a CCTP row', () => {
        const without = { ...config, cctp: { ...config.cctp, chains: config.cctp.chains.filter(c => c.key !== 'arc-testnet') } };
        expect(resolveRoute(USDC_BASE, USDC_ARC, { isMainnet: false, config: without })?.kind).toBe('unsupported');
    });

    it('a bridge-only row with anything else is refused, with the chain named', () => {
        for (const other of [BCH, PUSD, ETH, SOL, MOVE, XMR]) {
            expect(resolveRoute(USDC_ARC, other, testnet)).toEqual({ kind: 'unsupported', reason: 'USDC on Arc Testnet can only be sent to USDC on another chain.' });
            expect(resolveRoute(other, USDC_BASE, testnet)).toEqual({ kind: 'unsupported', reason: 'USDC on Base Sepolia can only be sent to USDC on another chain.' });
        }
    });

    it('without /config a USDC pair is blocked with the reason, never guessed', () => {
        expect(resolveRoute(USDC_ETH, USDC_SOL, { isMainnet: false })).toEqual({ kind: 'unsupported', reason: 'The USDC bridge cannot be reached right now.' });
    });
});

describe('pairs nobody can execute are blocked instead of falling into the CashToken path', () => {
    it.each([
        ['ETH → SOL', ETH, SOL], ['USDC → USDT on Sepolia', USDC_ETH, USDT_ETH], ['ETH → MOVE', ETH, MOVE], ['MOVE → MOVE-USDC', MOVE, find(MOVEMENT_TOKENS, 'movement', 'USDC')],
        ['XMR → SOL', XMR, SOL], ['ETH (Base) → ETH', find(BASE_TOKENS, 'base', 'ETH'), ETH],
    ])('%s', (_name, sell, buy) => {
        expect(detectSwapType(sell.chain, buy.chain)).toBe('FALLTHROUGH');
        expect(resolveRoute(sell, buy, testnet)).toEqual({ kind: 'unsupported', reason: 'This pair is not available.' });
    });

    it('SOL → USDC on Solana in testnet mode says where it is available', () => {
        expect(resolveRoute(SOL, USDC_SOL, testnet)).toEqual({ kind: 'unsupported', reason: 'Solana swaps are available in Mainnet mode.' });
    });
});

describe('mainnet mode', () => {
    it('two Solana mainnet tokens go to Jupiter; the static SOL row is the native mint', () => {
        expect(resolveRoute(SOL, JUP, mainnet)).toEqual({ kind: 'sol-jupiter', inputMint: NATIVE_SOL_MINT, outputMint: JUP.address });
        expect(resolveRoute(USDC_MAINNET, SOL, mainnet)).toEqual({ kind: 'sol-jupiter', inputMint: USDC_MAINNET.address, outputMint: NATIVE_SOL_MINT });
        expect(jupiterMintOf(SOL, config)).toBe(config.solana.nativeMint);
    });

    it('the static devnet USDC row is not a mainnet token', () => {
        expect(jupiterMintOf(USDC_SOL, config)).toBeUndefined();
        expect(resolveRoute(SOL, USDC_SOL, mainnet)?.kind).toBe('unsupported');
    });

    it('the same token on both sides is refused', () => {
        expect(resolveRoute(JUP, { ...JUP }, mainnet)).toEqual({ kind: 'unsupported', reason: 'Pick two different tokens.' });
    });

    it('cross-chain USDC points at testnet mode', () => {
        expect(resolveRoute(USDC_ETH, USDC_SOL, mainnet)).toEqual({ kind: 'unsupported', reason: 'Cross-chain USDC is available in Testnet mode.' });
        expect(resolveRoute(USDC_ARC, USDC_BASE, mainnet)).toEqual({ kind: 'unsupported', reason: 'Cross-chain USDC is available in Testnet mode.' });
    });

    it('a Jupiter token never pairs with BCH through an old flow', () => {
        expect(resolveRoute(JUP, BCH, mainnet)?.kind).toBe('unsupported');
        expect(resolveRoute(BCH, USDC_MAINNET, mainnet)?.kind).toBe('unsupported');
    });
});

describe('token rows', () => {
    it('one USDC row per chain of /config, under the right Token.chain, with the server\'s address', () => {
        const rows = cctpTokens(config);
        expect(rows).toHaveLength(config.cctp.chains.length);
        expect(Object.fromEntries(rows.map(r => [r.swapServer!.chainKey, r.chain]))).toEqual({
            'eth-sepolia': 'ethereum', 'op-sepolia': 'optimism', 'arb-sepolia': 'arbitrum', 'base-sepolia': 'base', 'arc-testnet': 'arc', 'solana-devnet': 'solana',
        });
        for (const r of rows) {
            expect(r).toMatchObject({ symbol: 'USDC', decimals: 6 });
            expect(r.address).toBe(config.cctp.chains.find(c => c.key === r.swapServer!.chainKey)!.usdc);
            expect(r.disabled).toBeUndefined();
        }
        expect(cctpTokens(undefined)).toEqual([]);
    });

    it('a chain this build cannot sign for is left out', () => {
        const extra = { ...config, cctp: { ...config.cctp, chains: [...config.cctp.chains, { ...config.cctp.chains[0], key: 'mars-testnet', name: 'Mars' }] } };
        expect(cctpTokens(extra).some(r => r.swapServer!.chainKey === 'mars-testnet')).toBe(false);
    });

    it('merging: placeholders replaced, Arc added, the two live static rows kept as they are', () => {
        expect(find(ALL_BCH_SWAP_TOKENS, 'base', 'USDC').disabled).toBe(true);
        for (const chain of ['base', 'arbitrum', 'optimism']) {
            const row = find(merged, chain, 'USDC');
            expect(row.disabled).toBeUndefined();
            expect(row.swapServer?.product).toBe('cctp');
            expect(merged.filter(t => t.chain === chain && t.symbol === 'USDC')).toHaveLength(1);
        }
        expect(USDC_ARC.swapServer?.chainKey).toBe('arc-testnet');
        expect(find(merged, 'ethereum', 'USDC')).toBe(USDC_ETH);
        expect(find(merged, 'solana', 'USDC')).toBe(USDC_SOL);
        expect(find(merged, 'base', 'ETH').disabled).toBe(true);          // only USDC opens up on these chains
        expect(merged).toHaveLength(ALL_BCH_SWAP_TOKENS.length + 1);
        expect(ALL_BCH_SWAP_TOKENS.some(t => t.chain === 'arc')).toBe(false);   // the static list is not touched
    });

    it('no merge in mainnet mode or without /config', () => {
        expect(withCctpTokens(MAINNET_SWAP_TOKENS, config, true)).toBe(MAINNET_SWAP_TOKENS);
        expect(withCctpTokens(ALL_BCH_SWAP_TOKENS, undefined, false)).toBe(ALL_BCH_SWAP_TOKENS);
    });

    it('token identity is the address or category, never the symbol alone', () => {
        expect(tokenKey(USDC_BASE)).not.toBe(tokenKey(USDC_ARC));
        expect(tokenKey(USDC_MAINNET)).not.toBe(tokenKey(USDC_SOL));
        expect(tokenKey(PUSD)).toBe(`bch:${PUSD.categoryId}`);
        expect(tokenKey(BCH)).toBe('bch:BCH');
    });
});

describe('what the other side becomes after a pick', () => {
    const ctx = { tokens: merged, config, isMainnet: false };

    it('picking a bridge-only row while the other side is not bridgeable: the other side becomes USDC elsewhere', () => {
        expect(pairAfterSelect(USDC_ARC, PUSD, ctx).other).toBe(USDC_ETH);        // Ethereum first
        expect(pairAfterSelect(USDC_ARC, BCH, ctx).other).toBe(USDC_ETH);
        expect(resolveRoute(USDC_ARC, pairAfterSelect(USDC_ARC, BCH, ctx).other!, testnet)?.kind).toBe('usdc-cctp');
    });

    it('picking the chain the other side is already on moves the other side', () => {
        expect(pairAfterSelect(USDC_BASE, { ...USDC_BASE }, ctx).other).toBe(USDC_ETH);
        const picked = find(merged, 'optimism', 'USDC');
        expect(pairAfterSelect(picked, picked, ctx).other).toBe(USDC_ETH);
    });

    it('a valid bridge pair is left alone', () => {
        expect(pairAfterSelect(USDC_ARC, USDC_BASE, ctx)).toEqual({});
        expect(pairAfterSelect(USDC_ARC, USDC_SOL, ctx)).toEqual({});
        expect(pairAfterSelect(USDC_ETH, USDC_SOL, ctx)).toEqual({});
    });

    it('picking something else while the other side holds a bridge-only row asks the caller to reset it', () => {
        expect(pairAfterSelect(BCH, USDC_ARC, ctx)).toEqual({ reset: true });
        expect(pairAfterSelect(SOL, USDC_BASE, ctx)).toEqual({ reset: true });
    });

    it('the static USDC rows keep their BCH flows: no pairing is forced on them', () => {
        expect(pairAfterSelect(USDC_ETH, BCH, ctx)).toEqual({});
        expect(pairAfterSelect(BCH, USDC_SOL, ctx)).toEqual({});
    });

    it('nothing happens in mainnet mode or without /config', () => {
        expect(pairAfterSelect(USDC_ARC, BCH, { ...ctx, isMainnet: true })).toEqual({});
        expect(pairAfterSelect(USDC_ARC, BCH, { ...ctx, config: undefined })).toEqual({});
    });
});
