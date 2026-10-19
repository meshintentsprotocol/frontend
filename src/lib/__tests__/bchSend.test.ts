import { describe, it, expect, vi } from 'vitest';
import { encodeCashAddress } from '@bitauth/libauth';
import { placeholderP2PKHUnlocker, type Utxo } from 'cashscript';
import { buildAndSendBch, checkRecipientAddress } from '../bchSend';
import type { MeshSigner } from '../mesh/signer';

describe('bchSend', () => {
    const dummyPayload = new Uint8Array(20).fill(1);
    const plainAddress = encodeCashAddress({ prefix: 'bchtest', type: 'p2pkh', payload: dummyPayload }).address;
    const tokenAddress = encodeCashAddress({ prefix: 'bchtest', type: 'p2pkhWithTokens', payload: dummyPayload }).address;

    const recipientPayload = new Uint8Array(20).fill(2);
    const recipientPlain = encodeCashAddress({ prefix: 'bchtest', type: 'p2pkh', payload: recipientPayload }).address;
    const recipientToken = encodeCashAddress({ prefix: 'bchtest', type: 'p2pkhWithTokens', payload: recipientPayload }).address;

    const mockSigner: MeshSigner = {
        kind: 'local',
        network: 'chipnet',
        provider: {} as any,
        address: plainAddress,
        tokenAddress: tokenAddress,
        lockingBytecode: new Uint8Array(25),
        pkh: '0101010101010101010101010101010101010101',
        unsignedInputPadding: 0,
        getUtxos: vi.fn(),
        p2pkhUnlocker: vi.fn().mockImplementation(() => placeholderP2PKHUnlocker(plainAddress)),
        dockUnlocker: vi.fn(),
        send: vi.fn().mockResolvedValue('mock-txid-abcdef'),
    };

    it('validates recipient address correctly', () => {
        expect(checkRecipientAddress(plainAddress).isValid).toBe(true);
        expect(checkRecipientAddress(plainAddress).isTokenAware).toBe(false);

        expect(checkRecipientAddress(tokenAddress).isValid).toBe(true);
        expect(checkRecipientAddress(tokenAddress).isTokenAware).toBe(true);

        expect(checkRecipientAddress('invalid-address').isValid).toBe(false);
    });

    it('refuses plain recipient address when sending CashTokens', async () => {
        await expect(
            buildAndSendBch(
                mockSigner,
                recipientPlain,
                { category: '00'.repeat(32), amount: 100n },
                'Send CashToken'
            )
        ).rejects.toThrow('CashToken sends require a token-aware recipient address (starts with z)');
    });

    it('refuses invalid recipient address when sending BCH sats', async () => {
        await expect(
            buildAndSendBch(
                mockSigner,
                'not-an-address',
                { sats: 5000n },
                'Send BCH'
            )
        ).rejects.toThrow('Invalid recipient address');
    });

    it('refuses sats below dust limit', async () => {
        await expect(
            buildAndSendBch(
                mockSigner,
                recipientPlain,
                { sats: 200n },
                'Send BCH'
            )
        ).rejects.toThrow('Amount is below dust limit (546 sats)');
    });

    it('sends BCH sats using plain UTXOs and returns txid', async () => {
        const utxos: Utxo[] = [
            {
                txid: '11'.repeat(32),
                vout: 0,
                satoshis: 100_000n,
            },
        ];
        vi.mocked(mockSigner.getUtxos).mockResolvedValueOnce(utxos);

        const txid = await buildAndSendBch(
            mockSigner,
            recipientPlain,
            { sats: 10_000n },
            'Send BCH test'
        );

        expect(txid).toBe('mock-txid-abcdef');
        expect(mockSigner.send).toHaveBeenCalledTimes(1);
    });

    it('sends max BCH sats by absorbing all plain UTXOs minus fee', async () => {
        const utxos: Utxo[] = [
            {
                txid: '22'.repeat(32),
                vout: 0,
                satoshis: 50_000n,
            },
            {
                txid: '33'.repeat(32),
                vout: 1,
                satoshis: 30_000n,
            },
        ];
        vi.mocked(mockSigner.getUtxos).mockResolvedValueOnce(utxos);

        const txid = await buildAndSendBch(
            mockSigner,
            recipientPlain,
            { sats: 0n },
            'Send max BCH',
            { sendMax: true }
        );

        expect(txid).toBe('mock-txid-abcdef');
    });

    it('sends CashTokens with token change and fee balance', async () => {
        const category = 'aa'.repeat(32);
        const utxos: Utxo[] = [
            {
                txid: '44'.repeat(32),
                vout: 0,
                satoshis: 1000n,
                token: { category, amount: 500n },
            },
            {
                txid: '55'.repeat(32),
                vout: 0,
                satoshis: 50_000n,
            },
        ];
        vi.mocked(mockSigner.getUtxos).mockResolvedValueOnce(utxos);

        const txid = await buildAndSendBch(
            mockSigner,
            recipientToken,
            { category, amount: 200n },
            'Send CashTokens'
        );

        expect(txid).toBe('mock-txid-abcdef');
    });
});
