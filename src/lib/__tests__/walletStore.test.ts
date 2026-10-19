import { describe, it, expect, beforeEach } from 'vitest';
import {
    getActiveWalletId,
    setActiveWalletId,
    setWalletLook,
    forgetLook,
    _resetWalletStoreForTest,
    MAIN_WALLET_ID,
    ACTIVE_KEY_V2,
    LEGACY_ACTIVE_KEY,
} from '../walletStore';

class MemoryStorage {
    private store = new Map<string, string>();
    getItem(key: string) { return this.store.get(key) ?? null; }
    setItem(key: string, val: string) { this.store.set(key, String(val)); }
    removeItem(key: string) { this.store.delete(key); }
    clear() { this.store.clear(); }
}

const mockStorage = new MemoryStorage();
(globalThis as any).window = {
    localStorage: mockStorage,
    addEventListener: () => {},
    removeEventListener: () => {},
};
(globalThis as any).localStorage = mockStorage;

describe('walletStore', () => {
    beforeEach(() => {
        mockStorage.clear();
        _resetWalletStoreForTest();
    });

    it('defaults BCH to main and others to null', () => {
        expect(getActiveWalletId('bch')).toBe(MAIN_WALLET_ID);
        expect(getActiveWalletId('evm')).toBeNull();
        expect(getActiveWalletId('solana')).toBeNull();
        expect(getActiveWalletId('btc')).toBeNull();
    });

    it('sets and gets active wallet per family independently', () => {
        setActiveWalletId('wc-bch-1', 'bch');
        setActiveWalletId('appkit-evm-1', 'evm');
        setActiveWalletId('appkit-sol-1', 'solana');

        expect(getActiveWalletId('bch')).toBe('wc-bch-1');
        expect(getActiveWalletId('evm')).toBe('appkit-evm-1');
        expect(getActiveWalletId('solana')).toBe('appkit-sol-1');
        expect(getActiveWalletId('btc')).toBeNull();

        // Nullify BCH
        setActiveWalletId(null, 'bch');
        expect(getActiveWalletId('bch')).toBeNull();
        expect(getActiveWalletId('evm')).toBe('appkit-evm-1');
    });

    it('saves and forgets looks by key', () => {
        setWalletLook('0x123', { name: 'My Wallet', color: '#10b981' });
        forgetLook('0x123');
        // Looks can be cleared
        forgetLook('non-existent');
    });
});
