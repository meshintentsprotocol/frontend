import { describe, it, expect } from 'vitest';
import type { Token } from '@/types';
import type { BchToken, SwapServerConfig } from '../types';
import { withBchTokens, withCctpTokens, tokenKey, tokensInMode, pairAfterSelect, mergeTokenCatalog } from '../tokens';
import { resolveRoute } from '../routing';
import { bchWalletAddress } from '../walletAddresses';
import { withJupiterTokens } from '../solana';
import { BCH_TOKENS, ALL_BCH_SWAP_TOKENS } from '@/components/bch-swap/BCHTokenSelector';
import fixtures from './fixtures.json';
import mainnet from './fixtures.mainnet.json';

const config = fixtures.config as unknown as SwapServerConfig;
const main = { ...mainnet.config, bch: { enabled: true, paused: false, network: 'mainnet' } } as unknown as SwapServerConfig;
const bch = BCH_TOKENS[0];
const cash: Token = { symbol: 'TEST', name: 'CashToken', icon: '', decimals: 2, type: 'category', chain: 'bch', categoryId: 'abcd' };
const base: BchToken = { symbol: 'USDC', name: 'USD Coin', decimals: 6, chain: 'base', assetId: 'nep141:base-usdc.omft.near', contractAddress: main.cctp.chains.find(c => c.key === 'base')!.usdc };

describe('catalog and route regressions', () => {
    it('does not merge catalog tokens by symbol or leak mainnet assets into testnet', () => {
        const test = withCctpTokens(tokensInMode(ALL_BCH_SWAP_TOKENS, false), config, false);
        expect(withBchTokens(test, [base], false)).toBe(test);
        const wrong = { ...base, contractAddress: '0x1111111111111111111111111111111111111111' };
        const rows = withBchTokens(withCctpTokens([], main, true), [wrong], true);
        expect(rows.filter(t => t.chain === 'base')).toHaveLength(2);
    });
    it('does not overwrite an existing contract just because its symbol is USDC', () => {
        const token: Token = { symbol: 'USDC', name: 'Other contract', icon: '', decimals: 6, chain: 'base', type: 'erc20', network: 'mainnet', address: '0x1111111111111111111111111111111111111111' };
        const rows = withCctpTokens([token], main, true).filter(t => t.chain === 'base');
        expect(rows).toHaveLength(2);
        expect(rows).toContain(token);
    });
    it('preserves CCTP before and after 1Click enrichment, and both capabilities can route', () => {
        const rows = withBchTokens(withCctpTokens([], main, true), [base], true);
        const src = rows.find(t => t.chain === 'base')!, dst = rows.find(t => t.chain === 'arc')!;
        expect(src.swapServer?.product).toBe('cctp');
        expect(resolveRoute(src, dst, { isMainnet: true, config: main })?.kind).toBe('usdc-cctp');
        expect(resolveRoute(bch, src, { isMainnet: true, config: main })?.kind).toBe('bch-crosschain');
        expect(resolveRoute(bch, dst, { isMainnet: true, config: main })?.kind).toBe('unsupported');
    });
    it('preserves Jupiter capability through the complete mainnet enrichment pipeline', () => {
        const mint = main.solana.nativeMint;
        const rows = withBchTokens(withCctpTokens(withJupiterTokens([], [{ mint, symbol: 'SOL', name: 'Solana', decimals: 9, verified: true, suspicious: false, tags: [], isStock: false }], true), main, true), [{ assetId: 'nep141:sol.omft.near', symbol: 'SOL', name: 'Solana', chain: 'sol', decimals: 9 }], true);
        const sol = rows.find(t => t.address === mint)!;
        expect(sol.swapServer?.product).toBe('jupiter');
        expect(sol.swapServer?.assetId).toBe('nep141:sol.omft.near');
        expect(rows.filter(t => t.address === mint)).toHaveLength(1);
    });
    it('keeps valid CCTP choices and replaces a non-bridge counterpart with verified USDC', () => {
        const rows = withCctpTokens(tokensInMode(ALL_BCH_SWAP_TOKENS, false), config, false);
        const arc = rows.find(t => t.chain === 'arc')!, eth = rows.find(t => t.chain === 'ethereum' && t.symbol === 'USDC')!;
        const ctx = { tokens: rows, config, isMainnet: false };
        expect(pairAfterSelect(arc, eth, ctx)).toEqual({});
        const other = pairAfterSelect(arc, bch, ctx).other!;
        expect(resolveRoute(arc, other, ctx)?.kind).toBe('usdc-cctp');
    });
    it('never converts a CashToken into native BCH on an external route', () => {
        const external = withBchTokens([], [base], true)[0];
        expect(resolveRoute(cash, external, { isMainnet: true, config: main })?.kind).toBe('unsupported');
        const catalogBch = withBchTokens([bch], [{ assetId: 'nep141:bch.omft.near', symbol: 'BCH', name: 'Bitcoin Cash', chain: 'bch', decimals: 8 }], true)[0];
        expect(resolveRoute(catalogBch, cash, { isMainnet: true, config: main })).toBeNull();
        expect(tokenKey(catalogBch)).toBe(tokenKey(bch));
    });
    it('keeps metadata refreshes and same-symbol tokens distinct by address/category', () => {
        const a = { ...cash, symbol: 'SAME' }, b = { ...a, categoryId: 'dcba' };
        const rows = mergeTokenCatalog([a, b], [{ ...a, name: 'Resolved', icon: 'ipfs://logo' }]);
        expect(rows).toHaveLength(2);
        expect(rows.find(t => t.categoryId === a.categoryId)?.name).toBe('Resolved');
        expect(tokenKey({ ...a, categoryId: undefined, chain: 'solana', address: 'ABC' })).not.toBe(tokenKey({ ...a, categoryId: undefined, chain: 'solana', address: 'abc' }));
    });
    it('removes NEAR from catalogs and rejects it even if an old selection persists', () => {
        const near = { ...base, chain: 'near', assetId: 'nep141:wrap.near' };
        expect(withBchTokens([], [near], true)).toEqual([]);
        const token: Token = { ...cash, categoryId: undefined, chain: 'near', address: 'wrap.near' };
        expect(tokensInMode([token], true)).toEqual([]);
        expect(resolveRoute(bch, token, { isMainnet: true, config: main })?.kind).toBe('unsupported');
    });
    it('uses HTLC only on testnet and requires a catalog capability for mainnet cross-chain', () => {
        const sol: Token = { symbol: 'SOL', name: 'Solana', decimals: 9, icon: '', type: 'native', chain: 'solana' };
        expect(resolveRoute(bch, sol, { isMainnet: false, config })).toBeNull();
        expect(resolveRoute(bch, sol, { isMainnet: true, config: main })?.kind).toBe('unsupported');
    });
    it('honors product availability and never enables 1Click in testnet mode', () => {
        const external = withBchTokens([], [base], true)[0];
        expect(resolveRoute(bch, external, { isMainnet: false, config })?.kind).toBe('unsupported');
        expect(resolveRoute(bch, external, { isMainnet: true, config: { ...main, bch: { ...main.bch!, enabled: false } } })?.kind).toBe('unsupported');
    });
});

describe('1Click user addresses', () => {
    const wallets = { bchMainnet: 'bitcoincash:qexample', evm: '0xexample', solana: 'solana-user' };
    it('uses Solana for both sol aliases instead of the EVM fallback', () => {
        expect(bchWalletAddress('sol', wallets)).toBe(wallets.solana);
        expect(bchWalletAddress('solana', wallets)).toBe(wallets.solana);
        expect(bchWalletAddress('sol', { evm: wallets.evm })).toBeNull();
    });
    it('does not use a Chipnet BCH address, a NEAR fee account or an unknown chain', () => {
        expect(bchWalletAddress('bch', { bchMainnet: 'bchtest:qexample' })).toBeNull();
        expect(bchWalletAddress('bch', wallets)).toBe(wallets.bchMainnet);
        expect(bchWalletAddress('near', wallets)).toBeNull();
        expect(bchWalletAddress('unknown', wallets)).toBeNull();
    });
});
