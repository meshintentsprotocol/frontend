import { describe, it, expect } from 'vitest';
import { resolveActive } from '../resolveActive';
import { MAIN_WALLET_ID } from '../../walletStore';

describe('resolveActive', () => {
    const candidates = [
        { id: 'ext-old', connectedAt: 1000 },
        { id: 'ext-new', connectedAt: 2000 },
    ];

    it('keeps current when current is still a candidate', () => {
        const result = resolveActive('bch', 'ext-old', candidates, false);
        expect(result).toBe('ext-old');
    });

    it('keeps current when current is main and builtIn is available', () => {
        const result = resolveActive('bch', MAIN_WALLET_ID, candidates, true);
        expect(result).toBe(MAIN_WALLET_ID);
    });

    it('falls back to main when builtIn is available and current was disconnected', () => {
        const result = resolveActive('bch', 'disconnected-id', candidates, true);
        expect(result).toBe(MAIN_WALLET_ID);
    });

    it('falls back to most recently connected external wallet when builtIn is unavailable', () => {
        const result = resolveActive('bch', 'disconnected-id', candidates, false);
        expect(result).toBe('ext-new');
    });

    it('picks newest external wallet for EVM where builtIn is never available', () => {
        const result = resolveActive('evm', null, candidates, false);
        expect(result).toBe('ext-new');
    });

    it('returns null when no candidates exist and builtIn is unavailable', () => {
        const result = resolveActive('bch', 'some-id', [], false);
        expect(result).toBeNull();
    });

    it('returns null when current is null and no candidates exist', () => {
        const result = resolveActive('solana', null, [], false);
        expect(result).toBeNull();
    });
});
