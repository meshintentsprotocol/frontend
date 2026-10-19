import { describe, it, expect } from 'vitest';
import { norm, isConnected, isActive, WalletTaggedRecord } from '../visibility';
import { WalletAmbientContext } from '../ambient';

describe('visibility rules', () => {
    const plainAddress = 'bitcoincash:qp3wjpa3tjlj042z2wv7hahsldgwhwy0rq9sywjpyy';
    const otherAddress = 'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a';

    const mockCtx: WalletAmbientContext = {
        network: 'testnet',
        active: {
            bch: 'bchtest:qp3wjpa3tjlj042z2wv7hahsldgwhwy0rq9sywjpyy',
            evm: '0x1111111111111111111111111111111111111111',
            solana: null,
            btc: null,
        },
        builtIn: {
            bch: 'bchtest:qp3wjpa3tjlj042z2wv7hahsldgwhwy0rq9sywjpyy',
            evm: '0x1111111111111111111111111111111111111111',
            solana: null,
            btc: null,
        },
        connectedAddresses: {
            bch: [
                'bchtest:qp3wjpa3tjlj042z2wv7hahsldgwhwy0rq9sywjpyy',
                'bchtest:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
            ],
            evm: ['0x1111111111111111111111111111111111111111'],
            solana: [],
            btc: [],
        },
    };

    describe('norm', () => {
        it('normalizes BCH addresses consistently', () => {
            const n1 = norm('bitcoincash:qp3wjpa3tjlj042z2wv7hahsldgwhwy0rq9sywjpyy', 'bch');
            const n2 = norm('qp3wjpa3tjlj042z2wv7hahsldgwhwy0rq9sywjpyy', 'bch');
            expect(n1).toBe(n2);
        });

        it('normalizes EVM addresses to lowercase', () => {
            expect(norm('0xAbCdEf1234', 'evm')).toBe('0xabcdef1234');
        });
    });

    describe('isConnected', () => {
        it('returns true when record wallet is in connectedAddresses on same network', () => {
            const rec: WalletTaggedRecord = {
                family: 'bch',
                network: 'testnet',
                wallet: 'bchtest:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
            };
            expect(isConnected(rec, mockCtx)).toBe(true);
        });

        it('returns false when network does not match', () => {
            const rec: WalletTaggedRecord = {
                family: 'bch',
                network: 'mainnet',
                wallet: 'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
            };
            expect(isConnected(rec, mockCtx)).toBe(false);
        });

        it('returns false when wallet is disconnected', () => {
            const rec: WalletTaggedRecord = {
                family: 'bch',
                network: 'testnet',
                wallet: 'bchtest:qz0000000000000000000000000000000000000000',
            };
            expect(isConnected(rec, mockCtx)).toBe(false);
        });

        it('attributes legacy untagged records to built-in wallet', () => {
            const legacyRec: WalletTaggedRecord = {
                network: 'testnet',
            };
            expect(isConnected(legacyRec, mockCtx)).toBe(true);
        });
    });

    describe('isActive', () => {
        it('returns true for active wallet on matching network', () => {
            const rec: WalletTaggedRecord = {
                family: 'bch',
                network: 'testnet',
                wallet: 'bchtest:qp3wjpa3tjlj042z2wv7hahsldgwhwy0rq9sywjpyy',
            };
            expect(isActive(rec, mockCtx)).toBe(true);
        });

        it('returns false for connected but non-active wallet', () => {
            const rec: WalletTaggedRecord = {
                family: 'bch',
                network: 'testnet',
                wallet: 'bchtest:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
            };
            expect(isActive(rec, mockCtx)).toBe(false);
        });

        it('attributes legacy untagged records to built-in wallet', () => {
            const legacyRec: WalletTaggedRecord = {
                network: 'testnet',
            };
            expect(isActive(legacyRec, mockCtx)).toBe(true);
        });
    });
});
