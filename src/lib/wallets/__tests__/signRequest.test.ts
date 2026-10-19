import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    runSignRequest,
    getPendingSign,
    cancelPendingForWallet,
    WalletSignError,
    _resetPendingSignForTest,
    classifyError,
} from '../signRequest';

describe('signRequest runner', () => {
    beforeEach(() => {
        _resetPendingSignForTest();
        vi.useRealTimers();
    });

    it('successfully executes request and clears pending state', async () => {
        const promise = runSignRequest({
            walletId: 'w-1',
            walletLabel: 'Cashonize',
            exec: async (signal) => {
                expect(getPendingSign()?.walletId).toBe('w-1');
                expect(signal.aborted).toBe(false);
                return 'tx-hash-123';
            },
        });

        const result = await promise;
        expect(result).toBe('tx-hash-123');
        expect(getPendingSign()).toBeNull();
    });

    it('rejects concurrent second signing request', async () => {
        let resolveFirst: (v: string) => void = () => {};
        const first = runSignRequest({
            walletId: 'w-1',
            walletLabel: 'Cashonize',
            exec: () => new Promise(res => { resolveFirst = res; }),
        });

        await expect(
            runSignRequest({
                walletId: 'w-2',
                walletLabel: 'Paytaca',
                exec: async () => 'tx-2',
            })
        ).rejects.toThrowError('Finish or cancel the request open in Cashonize first');

        resolveFirst('done');
        await first;
        expect(getPendingSign()).toBeNull();
    });

    it('supports user cancellation', async () => {
        const promise = runSignRequest({
            walletId: 'w-1',
            walletLabel: 'Cashonize',
            exec: (signal) => new Promise((_, reject) => {
                signal.addEventListener('abort', () => reject(new Error('aborted')));
            }),
        });

        const pending = getPendingSign();
        expect(pending).not.toBeNull();
        pending?.cancel();

        await expect(promise).rejects.toThrowError(WalletSignError);
        expect(getPendingSign()).toBeNull();
    });

    it('cancels pending request when wallet disconnects', async () => {
        const promise = runSignRequest({
            walletId: 'w-1',
            walletLabel: 'Cashonize',
            exec: (signal) => new Promise((_, reject) => {
                signal.addEventListener('abort', () => reject(new Error('aborted')));
            }),
        });

        cancelPendingForWallet('w-1', 'session-gone');
        await expect(promise).rejects.toThrowError();
        expect(getPendingSign()).toBeNull();
    });

    it('handles timeout properly', async () => {
        vi.useFakeTimers();

        const promise = runSignRequest({
            walletId: 'w-1',
            walletLabel: 'Cashonize',
            timeoutMs: 1000,
            exec: () => new Promise(() => {}), // never resolves
        });

        vi.advanceTimersByTime(1100);

        await expect(promise).rejects.toThrowError('Cashonize did not answer in 5 minutes');
        expect(getPendingSign()).toBeNull();
    });

    it('classifies errors correctly into WalletSignError kinds', () => {
        expect(classifyError(new Error('User rejected the transaction'), 'Cashonize').kind).toBe('rejected');
        expect(classifyError({ code: 4001, message: 'User denied transaction signature' }, 'Metamask').kind).toBe('rejected');
        expect(classifyError({ code: 5100, message: 'Unsupported method' }, 'Phantom').kind).toBe('unsupported');
        expect(classifyError({ code: 6000, message: 'User disconnected' }, 'Cashonize').kind).toBe('session-gone');
        expect(classifyError(new Error('Missing or invalid. Record was recently deleted'), 'Cashonize').kind).toBe('session-gone');
        expect(classifyError(new Error('Chain mismatch / wrong network'), 'Wallet').kind).toBe('wrong-network');
    });
});
