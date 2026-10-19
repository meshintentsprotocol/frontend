import { describe, it, expect } from 'vitest';
import { resolveActiveAccounts } from '../useActiveAccounts';
import { ExternalWallet } from '@/lib/wallets/types';

describe('resolveActiveAccounts', () => {
    const builtIn = {
        isInitialized: true,
        bchAddress: 'bchtest:qp3wjpa3tjlj042z2wv7hahsldgwhwy0rq9sywjpyy',
        evmAddress: '0x1111111111111111111111111111111111111111',
        solanaAddress: 'SolanaAddress1111111111111111111111111111',
        btcAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
    };

    const externalWallets: ExternalWallet[] = [
        {
            id: 'wiz-1',
            family: 'bch',
            source: 'wizardconnect',
            network: 'testnet',
            label: 'Paytaca Mobile',
            address: 'bchtest:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
            connectedAt: Date.now(),
        },
    ];

    it('returns built-in accounts when activeIds are main or null', () => {
        const accounts = resolveActiveAccounts({
            network: 'testnet',
            activeIds: { bch: 'main', evm: null, solana: null, btc: null },
            builtIn,
            externalWallets: [],
            looks: {},
        });

        expect(accounts.bch?.kind).toBe('main');
        expect(accounts.bch?.address).toBe(builtIn.bchAddress);
        expect(accounts.evm?.kind).toBe('main');
        expect(accounts.evm?.address).toBe(builtIn.evmAddress);
        expect(accounts.solana?.kind).toBe('main');
        expect(accounts.solana?.address).toBe(builtIn.solanaAddress);
        expect(accounts.btc?.kind).toBe('main');
        expect(accounts.btc?.address).toBe(builtIn.btcAddress);
    });

    it('returns external BCH account when an external BCH wallet is active', () => {
        const accounts = resolveActiveAccounts({
            network: 'testnet',
            activeIds: { bch: 'wiz-1', evm: null, solana: null, btc: null },
            builtIn,
            externalWallets,
            looks: {},
        });

        expect(accounts.bch?.kind).toBe('wizardconnect');
        expect(accounts.bch?.walletId).toBe('wiz-1');
        expect(accounts.bch?.address).toBe(externalWallets[0].address);
        // Built-in accounts for other chains are preserved
        expect(accounts.evm?.kind).toBe('main');
        expect(accounts.evm?.address).toBe(builtIn.evmAddress);
        expect(accounts.solana?.kind).toBe('main');
        expect(accounts.btc?.kind).toBe('main');
    });

    it('falls back to built-in when external wallet is on a different network', () => {
        const accounts = resolveActiveAccounts({
            network: 'mainnet',
            activeIds: { bch: 'wiz-1', evm: null, solana: null, btc: null },
            builtIn,
            externalWallets,
            looks: {},
        });

        expect(accounts.bch?.kind).toBe('main');
        expect(accounts.bch?.address).toBe(builtIn.bchAddress);
    });

    it('returns empty accounts when built-in is locked and no external wallet is connected', () => {
        const accounts = resolveActiveAccounts({
            network: 'testnet',
            activeIds: { bch: 'main', evm: null, solana: null, btc: null },
            builtIn: {
                isInitialized: false,
                bchAddress: null,
                evmAddress: null,
                solanaAddress: null,
                btcAddress: null,
            },
            externalWallets: [],
            looks: {},
        });

        expect(accounts.bch).toBeUndefined();
        expect(accounts.evm).toBeUndefined();
        expect(accounts.solana).toBeUndefined();
        expect(accounts.btc).toBeUndefined();
    });
});
