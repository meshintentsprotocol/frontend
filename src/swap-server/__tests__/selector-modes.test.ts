import { describe, it, expect } from 'vitest';
import { tokenSupportsMode, pairAfterSelect, withCctpTokens, withBchTokens } from '../tokens';
import { resolveRoute } from '../routing';
import { BCH_TOKENS, ALL_BCH_SWAP_TOKENS } from '@/components/bch-swap/BCHTokenSelector';
import type { SwapServerConfig } from '../types';
import fixtures from './fixtures.json';
const config = fixtures.config as unknown as SwapServerConfig;
const rows = withCctpTokens(ALL_BCH_SWAP_TOKENS, config, false);
const ctx = { tokens: rows, config, isMainnet: false };
const bch = BCH_TOKENS[0];

describe('swap-type filters', () => {
    it('lists all six CCTP chains and no BCH in the CCTP view', () => {
        const cctp = rows.filter(t => tokenSupportsMode(t, 'cctp', ctx));
        expect(new Set(cctp.map(t => t.chain)).size).toBe(6);
        expect(cctp.some(t => t.chain === 'bch')).toBe(false);
    });
    it('chooses USDC on a different chain even for an existing static USDC row', () => {
        const picked = rows.find(t => t.chain === 'ethereum' && t.symbol === 'USDC')!;
        const pair = pairAfterSelect(picked, bch, { ...ctx, mode: 'cctp' });
        expect(resolveRoute(picked, pair.other!, ctx)?.kind).toBe('usdc-cctp');
    });
    it('separates CashTokens and mainnet Solana swaps from CCTP', () => {
        expect(tokenSupportsMode(bch, 'cashtokens', ctx)).toBe(true);
        expect(tokenSupportsMode(bch, 'solana', ctx)).toBe(false);
        expect(tokenSupportsMode(rows.find(t => t.chain === 'arc')!, 'cashtokens', ctx)).toBe(false);
    });
    it('never offers NEAR as a supported chain', () => {
        const near = { ...bch, chain: 'near' as const };
        expect(tokenSupportsMode(near, 'all', ctx)).toBe(false);
        expect(withBchTokens([], [{ chain: 'near', assetId: 'wrap.near', symbol: 'NEAR', name: 'NEAR', decimals: 24 }], true)).toEqual([]);
    });
});
