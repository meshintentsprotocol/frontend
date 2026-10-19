import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ethers } from 'ethers';
import { _resetPendingSignForTest } from '../signRequest';

const mockEip1193 = {
    request: vi.fn(async ({ method, params }: any) => {
        if (method === 'eth_chainId') return '0xaa36a7'; // 11155111 in hex
        if (method === 'eth_accounts') return ['0x3333333333333333333333333333333333333333'];
        if (method === 'eth_estimateGas') return '0xc350'; // 50000
        if (method === 'eth_getTransactionCount') return '0x5'; // 5
        if (method === 'eth_blockNumber') return '0x1';
        if (method === 'eth_maxPriorityFeePerGas') return '0x3b9aca00'; // 1 gwei
        if (method === 'eth_gasPrice') return '0x77359400'; // 2 gwei
        if (method === 'eth_sendTransaction') return '0x9999999999999999999999999999999999999999999999999999999999999999';
        if (method === 'eth_getTransactionByHash') return {
            hash: '0x9999999999999999999999999999999999999999999999999999999999999999',
            type: 2,
            from: '0x3333333333333333333333333333333333333333',
            to: '0x2222222222222222222222222222222222222222',
            nonce: '0x5',
            gasLimit: '0x100000',
            maxFeePerGas: '0xb2d05e00',
            maxPriorityFeePerGas: '0x3b9aca00',
            value: '0x3e8',
            input: '0x',
            chainId: '0xaa36a7',
            blockNumber: '0x1',
            blockHash: '0x' + '11'.repeat(32),
            transactionIndex: '0x0',
            r: '0x' + '11'.repeat(32),
            s: '0x' + '22'.repeat(32),
            v: '0x1c',
            yParity: '0x1',
        };
        if (method === 'eth_getBlockByNumber') return {
            hash: '0x' + '11'.repeat(32),
            parentHash: '0x' + '22'.repeat(32),
            number: '0x1',
            baseFeePerGas: '0x3b9aca00',
            timestamp: '0x1',
            difficulty: '0x1',
            nonce: '0x0000000000000000',
            gasLimit: '0x100000',
            gasUsed: '0x1000',
            miner: '0x3333333333333333333333333333333333333333',
            extraData: '0x',
            transactions: [],
        };
        return null;
    }),
};

vi.mock('../appkitBridge', () => ({
    getAppKitEvmProvider: vi.fn(async () => mockEip1193),
    switchAppKitNetwork: vi.fn(async () => true),
}));

import {
    createLocalEvmSender,
    createAppKitEvmSender,
} from '../evmSender';

describe('evmSender', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        _resetPendingSignForTest();
    });

    describe('LocalEvmSender', () => {
        it('estimates gas, calls onRequested with nonce before signing, calls onHash, and broadcasts', async () => {
            const requestedLog: any[] = [];
            const hashLog: string[] = [];

            const mockProvider = {
                estimateGas: vi.fn(async () => 50_000n),
                getTransactionCount: vi.fn(async () => 7),
                getFeeData: vi.fn(async () => ({
                    maxFeePerGas: 2_000_000_000n,
                    maxPriorityFeePerGas: 1_000_000_000n,
                })),
                broadcastTransaction: vi.fn(async () => {}),
                waitForTransaction: vi.fn(async () => ({ status: 1 })),
            };

            const mockSigner = {
                getAddress: vi.fn(async () => '0xLocalSigner1111111111111111111111111111'),
                signTransaction: vi.fn(async () => '0x02f8aabbccdd'),
                provider: mockProvider,
            };

            const sender = createLocalEvmSender(
                () => mockSigner as any,
                '0xLocalSigner1111111111111111111111111111'
            );

            expect(sender.kind).toBe('local');
            expect(sender.address).toBe('0xLocalSigner1111111111111111111111111111');

            const sent = await sender.send(11155111, {
                to: '0xRecipient22222222222222222222222222222',
                data: '0x1234',
                value: 100n,
            }, {
                onRequested: (r) => { requestedLog.push(r); },
                onHash: (h) => { hashLog.push(h); },
            });

            expect(requestedLog).toEqual([{ nonce: 7, from: '0xLocalSigner1111111111111111111111111111' }]);
            expect(hashLog.length).toBe(1);
            expect(mockProvider.broadcastTransaction).toHaveBeenCalled();

            await sent.wait();
            expect(mockProvider.waitForTransaction).toHaveBeenCalledWith(sent.hash, 1, 180_000);
        });
    });

    describe('AppKitEvmSender', () => {
        it('switches network, calls onRequested before sendTransaction, calls onHash after', async () => {
            const requestedLog: any[] = [];
            const hashLog: string[] = [];

            const sender = createAppKitEvmSender('0x3333333333333333333333333333333333333333');
            expect(sender.kind).toBe('appkit');

            const sent = await sender.send(11155111, {
                to: '0x2222222222222222222222222222222222222222',
                data: '0x',
                value: 1000n,
            }, {
                onRequested: (r) => { requestedLog.push(r); },
                onHash: (h) => { hashLog.push(h); },
            });

            expect(requestedLog).toEqual([{ nonce: 5, from: '0x3333333333333333333333333333333333333333' }]);
            expect(hashLog).toEqual([sent.hash]);
            expect(sent.hash).toBe('0x9999999999999999999999999999999999999999999999999999999999999999');
        });
    });
});
