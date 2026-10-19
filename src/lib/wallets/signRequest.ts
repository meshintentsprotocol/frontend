/**
 * Universal signing-request runner for all external wallets.
 * Enforces single in-flight request, 5-minute timeout, cancellation,
 * and unified error classification.
 *
 * Phase 0: Foundation
 */

import { useSyncExternalStore } from 'react';

export type SignErrorKind =
    | 'rejected'
    | 'timeout'
    | 'session-gone'
    | 'wrong-network'
    | 'unsupported'
    | 'cancelled'
    | 'failed';

export class WalletSignError extends Error {
    kind: SignErrorKind;
    walletLabel: string;
    override cause?: unknown;

    constructor(kind: SignErrorKind, walletLabel: string, message?: string, cause?: unknown) {
        const defaultMsg = userFacingMessage(kind, walletLabel, message);
        super(defaultMsg);
        this.name = 'WalletSignError';
        this.kind = kind;
        this.walletLabel = walletLabel;
        this.cause = cause;
    }
}

export function userFacingMessage(kind: SignErrorKind, walletLabel: string, customMsg?: string): string {
    switch (kind) {
        case 'rejected':
            return `You declined in ${walletLabel}`;
        case 'timeout':
            return `${walletLabel} did not answer in 5 minutes`;
        case 'session-gone':
            return `${walletLabel} is no longer connected. Connect it again.`;
        case 'wrong-network':
            return `${walletLabel} is on the other network`;
        case 'unsupported':
            return `${walletLabel} can't do this`;
        case 'cancelled':
            return 'Request cancelled';
        case 'failed':
            return customMsg || `Signing failed in ${walletLabel}`;
    }
}

export interface PendingSign {
    walletId: string;
    walletLabel: string;
    startedAt: number;
    cancel: (reason?: string) => void;
}

interface InternalPendingSign extends PendingSign {
    abortController: AbortController;
}

let currentPending: InternalPendingSign | null = null;
const listeners = new Set<() => void>();

function notify() {
    for (const l of listeners) l();
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export function getPendingSign(): PendingSign | null {
    return currentPending;
}

const getNullSnapshot = () => null;

export function usePendingSign(): PendingSign | null {
    return useSyncExternalStore(subscribe, getPendingSign, getNullSnapshot);
}

/** Cancel any pending sign request for a specific wallet (e.g. on disconnect or account switch) */
export function cancelPendingForWallet(walletId: string, kind: SignErrorKind = 'cancelled'): void {
    if (currentPending && currentPending.walletId === walletId) {
        currentPending.cancel(userFacingMessage(kind, currentPending.walletLabel));
    }
}

/** Classify unknown caught errors into a WalletSignError */
export function classifyError(err: unknown, walletLabel: string): WalletSignError {
    if (err instanceof WalletSignError) return err;

    const msg = (err instanceof Error ? err.message : String(err || '')).toLowerCase();
    const code = (err as any)?.code;

    // 4001: EIP-1193 user rejected, 5000: WC user rejected
    if (code === 4001 || code === 5000 || /reject|denied|user cancel|cancelled by user/i.test(msg)) {
        return new WalletSignError('rejected', walletLabel, undefined, err);
    }

    if (code >= 5100 && code <= 5103 || /unsupported|not supported/i.test(msg)) {
        return new WalletSignError('unsupported', walletLabel, undefined, err);
    }

    if (
        code === 6000 ||
        /no matching key|session topic doesn't exist|missing or invalid|record was recently deleted|session is not active|not active|no longer connected/i.test(msg)
    ) {
        return new WalletSignError('session-gone', walletLabel, undefined, err);
    }

    if (/wrong network|other network|chain mismatch/i.test(msg)) {
        return new WalletSignError('wrong-network', walletLabel, undefined, err);
    }

    return new WalletSignError('failed', walletLabel, (err instanceof Error ? err.message : undefined), err);
}

export interface RunSignOptions<T> {
    walletId: string;
    walletLabel: string;
    timeoutMs?: number; // default: 5 min (300,000 ms)
    exec: (signal: AbortSignal) => Promise<T>;
}

export async function runSignRequest<T>(opts: {
    walletId: string;
    walletLabel: string;
    timeoutMs?: number;
    exec: (signal: AbortSignal) => Promise<T>;
}): Promise<T> {
    const { walletId, walletLabel, timeoutMs = 300_000, exec } = opts;

    if (currentPending) {
        throw new WalletSignError(
            'failed',
            walletLabel,
            `Finish or cancel the request open in ${currentPending.walletLabel} first`
        );
    }

    const abortController = new AbortController();
    let isCancelled = false;
    let cancelReason = '';

    const cancel = (reason?: string) => {
        isCancelled = true;
        cancelReason = reason || '';
        abortController.abort();
    };

    const pendingRecord: InternalPendingSign = {
        walletId,
        walletLabel,
        startedAt: Date.now(),
        cancel,
        abortController,
    };

    currentPending = pendingRecord;
    notify();

    let timeoutId: any = null;

    try {
        const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
                abortController.abort();
                reject(new WalletSignError('timeout', walletLabel));
            }, timeoutMs);
        });

        const execPromise = exec(abortController.signal);

        return await Promise.race([execPromise, timeoutPromise]);
    } catch (err: unknown) {
        if (isCancelled) {
            throw new WalletSignError('cancelled', walletLabel, cancelReason || undefined);
        }
        if (err instanceof WalletSignError) {
            throw err;
        }
        throw classifyError(err, walletLabel);
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
        if (currentPending === pendingRecord) {
            currentPending = null;
            notify();
        }
    }
}

/** For tests: clear current pending */
export function _resetPendingSignForTest() {
    currentPending = null;
    notify();
}
