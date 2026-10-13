/**
 * The steps of a cross-chain transfer as the processing dialog draws them. Pure: a record and, while this page is
 * the one signing, the local signing state go in; a list of steps comes out.
 *
 * Signing steps come from what the page is doing (it knows whether an approval was needed). Everything after the
 * burn comes from the server's record, so the list is right after a reload and on another device too.
 */
import { explorerTxUrl } from './cctpChains';
import type { BridgeStep } from './flows';
import type { ActivityItem, ActivityPhase, BchSwapRecord, CctpChain, SolanaSwap, Transfer, TransferStatus } from './types';

export type StepState = 'done' | 'active' | 'pending' | 'attention' | 'failed';

export interface DialogStep {
    key: string;
    label: string;
    state: StepState;
    note?: string;
    link?: string;
}

/** What the page itself is doing for a transfer: the signatures. */
export interface Operation {
    /** Known once the server has created the transfer. */
    id?: string;
    src: string;
    dst: string;
    amount: string;
    steps: BridgeStep[];
    step: BridgeStep;
    done: BridgeStep[];
    busy: boolean;
    error?: string;
    startedAt: number;
}

const ORDER: Record<TransferStatus, number> = {
    CREATED: 0, BURN_SUBMITTED: 1, BURN_CONFIRMED: 2, ATTESTED: 3, MINT_SUBMITTED: 4, COMPLETED: 5, COMPLETED_EXTERNAL: 5, FAILED: -1, EXPIRED: -1,
};

const SIGN_LABEL = (src?: CctpChain): Record<Exclude<BridgeStep, 'create'>, string> => ({
    approve: 'Approve USDC',
    burn: `Send USDC on ${src?.name ?? 'the source chain'}`,
    fee: 'Pay the service fee',
});

export function transferSteps(t: Transfer | undefined, ctx: { op?: Operation | null; src?: CctpChain; dst?: CctpChain }): DialogStep[] {
    const { src, dst } = ctx;
    const op = ctx.op && (!t || !ctx.op.id || ctx.op.id === t.id) ? ctx.op : undefined;
    const labels = SIGN_LABEL(src);
    const steps: DialogStep[] = [];
    const at = t ? ORDER[t.status] : 0;
    const hasFee = !!t?.protocolFee && t.protocolFee !== '0';
    const feeSeparate = hasFee && src?.kind === 'evm';

    // ── signatures ──
    if (op && op.steps.some(s => s !== 'create')) {
        for (const s of op.steps) {
            if (s === 'create') continue;
            const done = op.done.includes(s);
            steps.push({
                key: s, label: labels[s],
                state: done ? 'done' : op.step === s && op.error ? 'failed' : op.step === s && op.busy ? 'active' : 'pending',
                note: !done && op.step === s && op.error ? op.error : undefined,
                link: s === 'burn' ? t?.links.burn : s === 'fee' && t?.feeTxHash && src ? explorerTxUrl(src, t.feeTxHash) : undefined,
            });
        }
    } else if (op && !t) {
        steps.push({ key: 'create', label: 'Preparing the transfer', state: op.error ? 'failed' : 'active', note: op.error });
    } else if (t) {
        steps.push({
            key: 'burn', label: labels.burn, link: t.links.burn,
            state: t.burnTxHash ? 'done' : t.status === 'CREATED' ? 'attention' : 'pending',
            note: !t.burnTxHash && t.status === 'CREATED' ? 'Waiting for your signature' : undefined,
        });
        if (feeSeparate) {
            const paid = t.feeStatus === 'paid';
            const sent = !!t.feeTxHash && t.feeStatus === 'pending';
            steps.push({
                key: 'fee', label: labels.fee, link: t.feeTxHash && src ? explorerTxUrl(src, t.feeTxHash) : undefined,
                state: paid || t.feeStatus === 'unpaid' ? 'done' : sent ? 'active' : t.burnTxHash ? 'attention' : 'pending',
                note: paid ? undefined : t.feeStatus === 'unpaid' ? 'Delivered without it' : sent ? 'Confirming' : t.burnTxHash ? 'Not sent yet. The delivery waits for it.' : undefined,
            });
        }
    }

    // ── what the server does ──
    const held = !!t && t.status === 'ATTESTED' && t.feeStatus === 'awaiting';
    steps.push({ key: 'confirm', label: `Confirming on ${src?.name ?? 'the source chain'}`, state: at >= 2 ? 'done' : at === 1 ? 'active' : 'pending' });
    steps.push({ key: 'attest', label: 'Circle attestation', state: at >= 3 ? 'done' : at === 2 ? 'active' : 'pending' });
    steps.push({
        key: 'deliver', label: `Delivering on ${dst?.name ?? 'the destination chain'}`, link: t?.links.mint,
        state: at === 5 ? 'done' : held ? 'attention' : at >= 3 ? 'active' : 'pending',
        note: held ? 'Waiting for the service fee'
            : t?.status === 'COMPLETED_EXTERNAL' ? 'Delivered outside this app'
            : at === 5 && t?.display.received ? `${t.display.received} USDC arrived` : undefined,
    });

    // ── a transfer that ended badly stops at its first unfinished step ──
    if (t && (t.status === 'FAILED' || t.status === 'EXPIRED')) {
        // The fee is never why a transfer fails (an unpaid fee holds it instead), so the mark goes past it.
        const first = steps.find(s => s.state !== 'done' && s.key !== 'fee') ?? steps.find(s => s.state !== 'done');
        if (first) {
            first.state = 'failed';
            first.note = t.status === 'EXPIRED' ? 'Not signed in time. Nothing was sent.' : (t.failReason ?? 'The transfer failed');
        }
        for (const s of steps) if (s !== first && s.state !== 'done') s.state = 'pending';
    }
    return steps;
}

/** One line under the dialog title. */
export function transferHeadline(t: Transfer | undefined, op?: Operation | null): string {
    if (op?.error && (!t || !t.burnTxHash)) return 'Not sent';
    if (!t) return 'Preparing';
    switch (t.status) {
        case 'CREATED': return op?.busy ? 'Waiting for signatures' : 'Waiting for your signature';
        case 'BURN_SUBMITTED': return 'Confirming on the source chain';
        case 'BURN_CONFIRMED': return 'Waiting for Circle\'s attestation';
        case 'ATTESTED': return t.feeStatus === 'awaiting' ? 'Waiting for the service fee' : 'Delivering';
        case 'MINT_SUBMITTED': return 'Delivering';
        case 'COMPLETED': case 'COMPLETED_EXTERNAL': return 'Delivered';
        case 'FAILED': return 'Failed';
        case 'EXPIRED': return 'Expired';
    }
}

/** What the page itself is doing for a Solana swap (SwapOperation in context.ts). */
export interface SwapProgress {
    stage: 'create' | 'sign' | 'landing' | 'done' | 'failed';
    busy: boolean;
    error?: string;
}

/**
 * The steps of a Solana swap. While this page signs, they follow its stage; otherwise the server's record. A
 * swap that was created and never signed cannot be signed later: Jupiter's transaction is handed out once.
 */
export function swapSteps(s: SolanaSwap | undefined, op?: SwapProgress | null): DialogStep[] {
    const status = s?.status;
    const stage = op?.stage;
    // How far it got: 0 nothing, 1 created, 2 signed and handed to Jupiter, 3 landed.
    const reached = status === 'COMPLETED' ? 3 : status === 'SUBMITTED' || stage === 'landing' ? 2 : stage === 'sign' || status === 'CREATED' ? 1 : status ? 2 : 0;
    // A swap the server has handed to Jupiter may still land, whatever went wrong on this page afterwards.
    const pageFailed = stage === 'failed' && status !== 'SUBMITTED' && status !== 'COMPLETED';
    const bad = status === 'FAILED' || status === 'EXPIRED' || pageFailed;
    // A failure before the record says SUBMITTED happened at the step the page was on.
    const failedAt = !bad ? -1 : status === 'EXPIRED' ? 1 : status === 'FAILED' ? (s?.signature ? 2 : 1) : s ? 1 : 0;
    const note = status === 'EXPIRED' ? 'Not signed in time. Nothing was sent.' : (s?.failReason ?? op?.error ?? 'The swap did not go through');
    const state = (i: number): StepState => {
        if (bad) return i < failedAt ? 'done' : i === failedAt ? 'failed' : 'pending';
        if (i < reached) return 'done';
        if (i > reached) return 'pending';
        // Nobody is signing an unsigned record that this page did not just create.
        return i === 1 && !op?.busy ? 'attention' : 'active';
    };
    const out = s?.display.outAmount ?? undefined;
    return [
        { key: 'create', label: 'Preparing the swap', state: state(0), note: failedAt === 0 ? note : undefined },
        {
            key: 'sign', label: 'Sign in your wallet', state: state(1),
            note: failedAt === 1 ? note : state(1) === 'attention' ? 'This swap was not signed. Start a new one from the card.' : undefined,
        },
        { key: 'landing', label: 'Landing on Solana', state: state(2), link: s?.links.tx, note: failedAt === 2 ? note : undefined },
        {
            key: 'done', label: 'Received', state: !bad && reached === 3 ? 'done' : 'pending',
            note: !bad && reached === 3 && out ? `${out} ${s?.display.outSymbol ?? ''} arrived`.trim() : undefined,
        },
    ];
}

export function swapHeadline(s: SolanaSwap | undefined, op?: SwapProgress | null): string {
    if (s?.status === 'COMPLETED') return 'Completed';
    if (s?.status === 'EXPIRED') return 'Expired';
    if (s?.status === 'SUBMITTED') return 'Landing on Solana';
    if (s?.status === 'FAILED' || op?.stage === 'failed') return 'Failed';
    if (op?.stage === 'landing') return 'Landing on Solana';
    if (op?.stage === 'sign') return 'Signing';
    if (s?.status === 'CREATED' && !op?.busy) return 'Not signed';
    return 'Preparing';
}

export interface BchOperation {
    id?: string;
    stage: 'init' | 'deposit' | 'confirming' | 'processing' | 'done' | 'failed';
    busy: boolean;
    error?: string;
    sell: { symbol: string; display: string };
    buy: { symbol: string; display: string };
    result?: BchSwapRecord;
}

export function bchSwapSteps(record: BchSwapRecord | undefined, op?: BchOperation | null): DialogStep[] {
    const status = record?.status;
    const isBad = status === 'FAILED' || status === 'EXPIRED' || status === 'REFUNDED' || !!op?.error;
    const fromSymbol = record?.fromToken.symbol ?? op?.sell.symbol ?? 'Token';
    const toSymbol = record?.toToken.symbol ?? op?.buy.symbol ?? 'Token';

    const depositState: StepState = (!record && op?.busy)
        ? 'active'
        : (!record && op?.error)
            ? 'failed'
            : (status === 'PENDING_DEPOSIT' || !status)
                ? 'attention'
                : 'done';

    const confirmState: StepState = (!record || status === 'PENDING_DEPOSIT')
        ? 'pending'
        : status === 'KNOWN_DEPOSIT_TX'
            ? 'active'
            : 'done';

    const solverState: StepState = (status === 'SUCCESS' || status === 'REFUNDED')
        ? 'done'
        : status === 'PROCESSING'
            ? 'active'
            : (isBad && status !== 'PENDING_DEPOSIT' && status !== 'KNOWN_DEPOSIT_TX')
                ? 'failed'
                : 'pending';

    const settleState: StepState = status === 'SUCCESS'
        ? 'done'
        : status === 'REFUNDED'
            ? 'attention'
            : (status === 'FAILED' || status === 'EXPIRED')
                ? 'failed'
                : 'pending';

    return [
        {
            key: 'deposit',
            label: `Deposit ${fromSymbol} to generated address`,
            state: depositState,
            note: status === 'PENDING_DEPOSIT' ? 'Send exact amount to single-use address' : undefined,
        },
        {
            key: 'confirm',
            label: 'Deposit confirmed on blockchain',
            state: confirmState,
            link: record?.depositExplorerUrl,
            note: status === 'KNOWN_DEPOSIT_TX' ? 'Mempool detection confirmed' : undefined,
        },
        {
            key: 'solver',
            label: '1Click solver network executing intent',
            state: solverState,
            note: status === 'PROCESSING' ? 'Decentralized solvers filling cross-chain intent' : undefined,
        },
        {
            key: 'settle',
            label: `Delivered ${toSymbol} to recipient`,
            state: settleState,
            link: record?.settleExplorerUrl,
            note: status === 'SUCCESS'
                ? `${record?.expectedOutFormatted ?? ''} ${toSymbol} delivered`.trim()
                : status === 'REFUNDED'
                    ? `Refunded back to origin: ${record?.refundTo}`
                    : (status === 'FAILED' || status === 'EXPIRED')
                        ? (record?.failureReason ?? 'Swap could not be fulfilled')
                        : undefined,
        },
    ];
}

export function bchSwapHeadline(record: BchSwapRecord | undefined, op?: BchOperation | null): string {
    if (record?.status === 'SUCCESS') return 'Swap completed';
    if (record?.status === 'REFUNDED') return 'Swap refunded';
    if (record?.status === 'FAILED') return 'Swap failed';
    if (record?.status === 'EXPIRED') return 'Deposit window expired';
    if (record?.status === 'PROCESSING') return 'Solvers executing swap';
    if (record?.status === 'KNOWN_DEPOSIT_TX') return 'Deposit confirmed';
    if (record?.status === 'PENDING_DEPOSIT') return 'Waiting for deposit';
    if (op?.error) return 'Error';
    if (op?.busy) return 'Preparing deposit address';
    return 'Bitcoin Cash swap';
}


export const PHASE_LABEL: Record<ActivityPhase, string> = {
    awaiting_signature: 'Needs signature',
    processing: 'In progress',
    action_needed: 'Fee needed',
    completed: 'Completed',
    failed: 'Failed',
    expired: 'Expired',
};

/** Tailwind classes of a status pill, in the palette the order history uses. */
export const PHASE_CLASS: Record<ActivityPhase, string> = {
    awaiting_signature: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    processing: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    action_needed: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    failed: 'bg-red-500/10 text-red-400 border-red-500/20',
    expired: 'bg-white/[0.04] text-muted-foreground border-white/[0.08]',
};

/** A finer label for a row that is in progress: which step it is on. */
export function rowStatusLabel(i: ActivityItem): string {
    if (i.kind === 'swap' && i.phase === 'awaiting_signature') return 'Not signed';
    if (i.phase !== 'processing' || i.kind !== 'transfer') return PHASE_LABEL[i.phase];
    switch (i.status) {
        case 'BURN_SUBMITTED': return 'Confirming';
        case 'BURN_CONFIRMED': return 'Attesting';
        default: return 'Delivering';
    }
}

/** Seconds left on an unsigned record, counted from the moment the server's answer arrived. */
export function secondsLeft(i: Pick<ActivityItem, 'expiresInSec'>, receivedAt: number, now: number): number | undefined {
    if (i.expiresInSec === undefined) return undefined;
    return Math.max(0, Math.round(i.expiresInSec - (now - receivedAt) / 1000));
}

export function formatCountdown(sec: number): string {
    const m = Math.floor(sec / 60), s = sec % 60;
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}:${String(s).padStart(2, '0')}`;
}
