import { describe, it, expect } from 'vitest';
import { formatCountdown, rowStatusLabel, secondsLeft, transferHeadline, transferSteps, type Operation } from '../steps';
import type { ActivityItem, CctpChain, SwapServerConfig, Transfer } from '../types';
import fixtures from './fixtures.json';

/** The dialog's step list for records as the server really returns them, at every point of a transfer. */
const config = fixtures.config as unknown as SwapServerConfig;
const chain = (key: string) => config.cctp.chains.find(c => c.key === key) as CctpChain;
const BASE = chain('base-sepolia'), ARC = chain('arc-testnet'), SOLANA = chain('solana-devnet');
const created = fixtures.created.transfer as unknown as Transfer;           // Base → Arc, fee 0.01, unsigned
const completed = fixtures.completedTransfer as unknown as Transfer;
const HASH = '0x' + 'ab'.repeat(32);

const t = (over: Partial<Transfer>): Transfer => ({ ...created, ...over });
const op = (over: Partial<Operation> = {}): Operation => ({
    id: created.id, src: 'base-sepolia', dst: 'arc-testnet', amount: '1', steps: ['approve', 'burn', 'fee'], step: 'approve', done: [], busy: true, startedAt: 0, ...over,
});
const states = (record: Transfer | undefined, o?: Operation | null, src = BASE, dst = ARC) =>
    transferSteps(record, { op: o, src, dst }).map(s => `${s.key}:${s.state}`).join(' ');
const step = (record: Transfer | undefined, key: string, o?: Operation | null, src = BASE, dst = ARC) =>
    transferSteps(record, { op: o, src, dst }).find(s => s.key === key)!;

describe('while this page is signing', () => {
    it('before the server has answered there is one step', () => {
        const o = op({ id: undefined, steps: ['create'], step: 'create' });
        expect(states(undefined, o)).toBe('create:active confirm:pending attest:pending deliver:pending');
        expect(transferHeadline(undefined, o)).toBe('Preparing');
    });

    it('each signature is active in turn', () => {
        expect(states(created, op())).toBe('approve:active burn:pending fee:pending confirm:pending attest:pending deliver:pending');
        expect(states(created, op({ step: 'burn', done: ['approve'] }))).toBe('approve:done burn:active fee:pending confirm:pending attest:pending deliver:pending');
        expect(states(t({ status: 'BURN_SUBMITTED', burnTxHash: HASH }), op({ step: 'fee', done: ['approve', 'burn'] })))
            .toBe('approve:done burn:done fee:active confirm:active attest:pending deliver:pending');
        expect(transferHeadline(created, op())).toBe('Waiting for signatures');
    });

    it('only the steps this transfer needs are listed', () => {
        expect(states(created, op({ steps: ['create', 'burn'], step: 'burn' }))).toBe('burn:active confirm:pending attest:pending deliver:pending');
    });

    it('a refused signature marks its step and says why', () => {
        const o = op({ step: 'burn', done: ['approve'], busy: false, error: 'Insufficient funds for gas' });
        expect(states(created, o)).toBe('approve:done burn:failed fee:pending confirm:pending attest:pending deliver:pending');
        expect(step(created, 'burn', o).note).toBe('Insufficient funds for gas');
        expect(transferHeadline(created, o)).toBe('Not sent');
    });

    it('a transfer that could not even be created shows the reason', () => {
        const o = op({ id: undefined, steps: ['create'], step: 'create', busy: false, error: 'Insufficient USDC on Base Sepolia' });
        expect(step(undefined, 'create', o)).toMatchObject({ state: 'failed', note: 'Insufficient USDC on Base Sepolia' });
    });

    it('the signing state of another transfer is not shown on this one', () => {
        expect(states(created, op({ id: 'someone-else' }))).toBe(states(created, null));
    });
});

describe('from the record alone: after a reload, or on another device', () => {
    it('unsigned: the burn waits for a signature, nothing else has started', () => {
        expect(states(created)).toBe('burn:attention fee:pending confirm:pending attest:pending deliver:pending');
        expect(step(created, 'burn').note).toBe('Waiting for your signature');
        expect(transferHeadline(created)).toBe('Waiting for your signature');
    });

    it('burned, fee never sent: the fee asks for attention while the transfer moves on', () => {
        const r = t({ status: 'BURN_CONFIRMED', burnTxHash: HASH, feeStatus: 'pending' });
        expect(states(r)).toBe('burn:done fee:attention confirm:done attest:active deliver:pending');
        expect(step(r, 'fee').note).toContain('Not sent yet');
    });

    it('fee sent and being checked', () => {
        const r = t({ status: 'BURN_CONFIRMED', burnTxHash: HASH, feeStatus: 'pending', feeTxHash: HASH });
        expect(step(r, 'fee')).toMatchObject({ state: 'active', note: 'Confirming', link: `https://sepolia.basescan.org/tx/${HASH}` });
    });

    it('held for the fee: delivery says what it waits for', () => {
        const r = t({ status: 'ATTESTED', burnTxHash: HASH, feeStatus: 'awaiting' });
        expect(states(r)).toBe('burn:done fee:attention confirm:done attest:done deliver:attention');
        expect(step(r, 'deliver').note).toBe('Waiting for the service fee');
        expect(transferHeadline(r)).toBe('Waiting for the service fee');
    });

    it('each server status moves one step forward', () => {
        const paid = { burnTxHash: HASH, feeStatus: 'paid' as const };
        expect(states(t({ ...paid, status: 'BURN_SUBMITTED' }))).toBe('burn:done fee:done confirm:active attest:pending deliver:pending');
        expect(states(t({ ...paid, status: 'BURN_CONFIRMED' }))).toBe('burn:done fee:done confirm:done attest:active deliver:pending');
        expect(states(t({ ...paid, status: 'ATTESTED' }))).toBe('burn:done fee:done confirm:done attest:done deliver:active');
        expect(states(t({ ...paid, status: 'MINT_SUBMITTED' }))).toBe('burn:done fee:done confirm:done attest:done deliver:active');
        expect(transferHeadline(t({ ...paid, status: 'BURN_CONFIRMED' }))).toBe('Waiting for Circle\'s attestation');
    });

    it('a transfer the server really completed: every step done, with what arrived and both links', () => {
        const src = chain(completed.src), dst = chain(completed.dst);
        const steps = transferSteps(completed, { src, dst });
        expect(steps.every(s => s.state === 'done')).toBe(true);
        expect(steps.find(s => s.key === 'deliver')!.note).toBe(`${completed.display.received} USDC arrived`);
        expect(steps.find(s => s.key === 'burn')!.link).toBe(completed.links.burn);
        expect(steps.find(s => s.key === 'deliver')!.link).toBe(completed.links.mint);
        expect(transferHeadline(completed)).toBe('Delivered');
    });

    it('delivered without the fee is still delivered', () => {
        expect(step(t({ status: 'COMPLETED', burnTxHash: HASH, feeStatus: 'unpaid', received: '989871' }), 'fee')).toMatchObject({ state: 'done', note: 'Delivered without it' });
    });

    it('minted by someone else', () => {
        expect(step(t({ status: 'COMPLETED_EXTERNAL', burnTxHash: HASH, feeStatus: 'paid' }), 'deliver')).toMatchObject({ state: 'done', note: 'Delivered outside this app' });
    });

    it('a Solana source has no separate fee step: the fee is inside the burn', () => {
        const r = t({ src: 'solana-devnet', status: 'BURN_SUBMITTED', burnTxHash: 'sig', feeStatus: 'pending' });
        expect(states(r, null, SOLANA, ARC)).toBe('burn:done confirm:active attest:pending deliver:pending');
    });

    it('a transfer with no fee has no fee step', () => {
        expect(states(t({ protocolFee: '0', feeStatus: 'none' }))).toBe('burn:attention confirm:pending attest:pending deliver:pending');
    });
});

describe('a transfer that ended badly', () => {
    it('expired: nothing was sent, and it says so', () => {
        const r = t({ status: 'EXPIRED' });
        expect(states(r)).toBe('burn:failed fee:pending confirm:pending attest:pending deliver:pending');
        expect(step(r, 'burn').note).toBe('Not signed in time. Nothing was sent.');
        expect(transferHeadline(r)).toBe('Expired');
    });

    it('failed after the burn was reported: the step that failed carries the reason, not the fee step', () => {
        const r = t({ status: 'FAILED', burnTxHash: HASH, feeStatus: 'pending', failReason: 'burn transaction not found on Base Sepolia' });
        expect(states(r)).toBe('burn:done fee:pending confirm:failed attest:pending deliver:pending');
        expect(step(r, 'confirm').note).toBe('burn transaction not found on Base Sepolia');
    });

    it('failed at delivery', () => {
        const r = t({ status: 'FAILED', burnTxHash: HASH, feeStatus: 'paid', failReason: 'stopped by an operator' });
        // the record no longer says how far it got, so the first step the server owns takes the mark
        expect(transferSteps(r, { src: BASE, dst: ARC }).filter(s => s.state === 'failed')).toHaveLength(1);
        expect(transferHeadline(r)).toBe('Failed');
    });
});

describe('rows and countdowns', () => {
    const row = (over: Partial<ActivityItem>) => ({ ...(fixtures.activity.items[0] as unknown as ActivityItem), ...over });

    it('an unsigned record counts down from when the answer arrived, whatever the browser clock says', () => {
        expect(secondsLeft({ expiresInSec: 3600 }, 1_000_000, 1_000_000)).toBe(3600);
        expect(secondsLeft({ expiresInSec: 3600 }, 1_000_000, 1_090_000)).toBe(3510);
        expect(secondsLeft({ expiresInSec: 30 }, 1_000_000, 1_090_000)).toBe(0);
        expect(secondsLeft({}, 1_000_000, 1_090_000)).toBeUndefined();
    });

    it('formats a countdown', () => {
        expect(formatCountdown(59)).toBe('0:59');
        expect(formatCountdown(125)).toBe('2:05');
        expect(formatCountdown(3600)).toBe('1h 0m');
        expect(formatCountdown(0)).toBe('0:00');
    });

    it('a row in progress says which step it is on', () => {
        expect(rowStatusLabel(row({ phase: 'processing', status: 'BURN_SUBMITTED' }))).toBe('Confirming');
        expect(rowStatusLabel(row({ phase: 'processing', status: 'BURN_CONFIRMED' }))).toBe('Attesting');
        expect(rowStatusLabel(row({ phase: 'processing', status: 'MINT_SUBMITTED' }))).toBe('Delivering');
        expect(rowStatusLabel(row({ phase: 'awaiting_signature', status: 'CREATED' }))).toBe('Needs signature');
        expect(rowStatusLabel(row({ phase: 'action_needed', status: 'ATTESTED' }))).toBe('Fee needed');
        expect(rowStatusLabel(row({ phase: 'completed', status: 'COMPLETED' }))).toBe('Completed');
    });
});
