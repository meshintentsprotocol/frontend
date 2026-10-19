import { describe, it, expect, beforeEach } from 'vitest';
import {
    addWallet,
    removeWallet,
    getAllWallets,
    visibleWallets,
    walletIdentity,
    normalizeAddress,
    WalletLimitError,
    _resetRegistryForTest,
    REGISTRY_STORAGE_KEY,
    LEGACY_STORAGE_KEY,
    registerSessionCloser,
} from '../registry';
import { ExternalWallet } from '../types';

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

describe('wallet registry', () => {
    beforeEach(() => {
        mockStorage.clear();
        _resetRegistryForTest([]);
    });

    it('normalizes addresses properly per family', () => {
        expect(normalizeAddress('bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a', 'bch'))
            .toBe('qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a');
        expect(normalizeAddress('bchtest:qr6m7j9njldwwz4hp543vdjj9hz6eawq75hs42vdql', 'bch'))
            .toBe('qr6m7j9njldwwz4hp543vdjj9hz6eawq75hs42vdql');
        expect(normalizeAddress('0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B', 'evm'))
            .toBe('0xab5801a7d398351b8be11c439e05c5b3259aec9b');
        expect(normalizeAddress('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', 'solana'))
            .toBe('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM');
    });

    it('computes wallet identity consistently', () => {
        const id1 = walletIdentity('bch', 'mainnet', 'bitcoincash:qp3wjpa3tjlj042z2wv7hahsldgwhwy0rq9sywjpyy');
        const id2 = walletIdentity('bch', 'mainnet', 'qp3wjpa3tjlj042z2wv7hahsldgwhwy0rq9sywjpyy');
        expect(id1).toBe(id2);

        const idEvm1 = walletIdentity('evm', 'mainnet', '0x1234ABCD');
        const idEvm2 = walletIdentity('evm', 'mainnet', '0x1234abcd');
        expect(idEvm1).toBe(idEvm2);
    });

    it('adds wallets up to MAX_EXTERNAL_WALLETS and enforces limit', () => {
        for (let i = 0; i < 5; i++) {
            const w: ExternalWallet = {
                id: `wc-${i}`,
                source: 'walletconnect',
                family: 'bch',
                network: 'mainnet',
                label: `Wallet ${i}`,
                address: `bitcoincash:qwallet${i}`,
                connectedAt: Date.now(),
            };
            addWallet(w);
        }

        expect(getAllWallets()).toHaveLength(5);

        const extra: ExternalWallet = {
            id: 'wc-extra',
            source: 'walletconnect',
            family: 'bch',
            network: 'mainnet',
            label: 'Extra',
            address: 'bitcoincash:qextra',
            connectedAt: Date.now(),
        };

        expect(() => addWallet(extra)).toThrowError(WalletLimitError);
    });

    it('de-duplicates existing wallet with same identity and closes old session', () => {
        const closed: string[] = [];
        const unregister = registerSessionCloser(w => {
            closed.push(w.id);
        });

        const w1: ExternalWallet = {
            id: 'wc-1',
            source: 'walletconnect',
            family: 'bch',
            network: 'mainnet',
            label: 'Cashonize',
            address: 'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
            sessionTopic: 'topic-1',
            connectedAt: 1000,
        };
        addWallet(w1);
        expect(getAllWallets()).toHaveLength(1);

        const w2: ExternalWallet = {
            id: 'wc-2',
            source: 'walletconnect',
            family: 'bch',
            network: 'mainnet',
            label: 'Cashonize New',
            address: 'qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a', // same address without prefix
            sessionTopic: 'topic-2',
            connectedAt: 2000,
        };
        addWallet(w2);

        expect(getAllWallets()).toHaveLength(1);
        expect(getAllWallets()[0].id).toBe('wc-2');
        expect(getAllWallets()[0].sessionTopic).toBe('topic-2');
        expect(closed).toContain('wc-1');

        unregister();
    });

    it('filters visibleWallets by network', () => {
        addWallet({
            id: 'bch-main',
            source: 'walletconnect',
            family: 'bch',
            network: 'mainnet',
            label: 'Mainnet Wallet',
            address: 'bitcoincash:qmain',
            connectedAt: 1000,
        });

        addWallet({
            id: 'bch-test',
            source: 'walletconnect',
            family: 'bch',
            network: 'testnet',
            label: 'Testnet Wallet',
            address: 'bchtest:qtest',
            connectedAt: 2000,
        });

        expect(visibleWallets('mainnet')).toHaveLength(1);
        expect(visibleWallets('mainnet')[0].id).toBe('bch-main');

        expect(visibleWallets('testnet')).toHaveLength(1);
        expect(visibleWallets('testnet')[0].id).toBe('bch-test');
    });

    it('removes wallet and notifies session closer', () => {
        const closed: string[] = [];
        const unregister = registerSessionCloser(w => {
            closed.push(w.id);
        });

        addWallet({
            id: 'w-1',
            source: 'walletconnect',
            family: 'bch',
            network: 'mainnet',
            label: 'Wallet 1',
            address: 'bitcoincash:qaddr1',
            connectedAt: 1000,
        });

        removeWallet('w-1');
        expect(getAllWallets()).toHaveLength(0);
        expect(closed).toContain('w-1');

        unregister();
    });

    it('migrates legacy ext_bch_wallets and removes old key', () => {
        const legacyData = [
            {
                id: 'leg-1',
                source: 'walletconnect',
                label: 'Cashonize Legacy',
                address: 'bchtest:qr6m7j9njldwwz4hp543vdjj9hz6eawq75hs42vdql',
                connected: true,
                sessionTopic: 'leg-topic-1',
            },
            {
                id: 'leg-2',
                source: 'wizardconnect', // Should be dropped
                label: 'Paytaca Old',
                address: 'bchtest:qpold',
                connected: true,
            },
            {
                id: 'leg-3',
                source: 'extension',
                label: 'Cham Extension',
                address: 'bitcoincash:qpmain',
                connected: true,
            }
        ];
        mockStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacyData));

        // Trigger load
        _resetRegistryForTest();
        // Force reload by re-reading storage
        const all = getAllWallets();
        expect(mockStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
        expect(all).toHaveLength(2);
        expect(all.find(w => w.id === 'leg-1')?.network).toBe('testnet');
        expect(all.find(w => w.id === 'leg-3')?.network).toBe('mainnet');
        expect(all.find(w => w.id === 'leg-2')).toBeUndefined();
    });

    it('handles damaged JSON in storage gracefully', () => {
        mockStorage.setItem(REGISTRY_STORAGE_KEY, 'not-valid-json{{{');
        _resetRegistryForTest();
        expect(getAllWallets()).toEqual([]);

        mockStorage.setItem(LEGACY_STORAGE_KEY, '{invalid legacy json');
        _resetRegistryForTest();
        expect(getAllWallets()).toEqual([]);
    });
});
