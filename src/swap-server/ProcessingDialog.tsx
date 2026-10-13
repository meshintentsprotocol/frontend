/**
 * The pop-up card for one cross-chain transfer: what was sent, each step, and what the user can do next.
 *
 * It only shows; closing it stops nothing. Signatures come from the provider's operation, everything after the
 * burn from the server's record, polled while the dialog is open. The same dialog opens from a history row, so a
 * transfer started on another device (or before a reload) reads the same.
 */
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, Check, Circle, Clock, Copy, ExternalLink, Loader2, QrCode, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TokenChainIcon } from '@/components/common/TokenChainIcon';
import { Chameleon, type ChamMood } from '@/components/wallet/Chameleon';
import { notifyToast } from '@/lib/notify-toast';
import { cn } from '@/lib/utils';
import { localChain } from './cctpChains';
import { canSelfMint, feeIsDue } from './flows';
import { useSwapServer } from './context';
import { bchSwapHeadline, bchSwapSteps, formatCountdown, swapHeadline, swapSteps, transferHeadline, transferSteps, type BchOperation, type DialogStep, type Operation, type SwapProgress } from './steps';
import { USDC_ICON } from './tokens';
import type { BchSwapRecord, CctpChain, SolanaSwap, Transfer } from './types';

const FINAL = new Set(['COMPLETED', 'COMPLETED_EXTERNAL', 'FAILED', 'EXPIRED']);

/** Cham beside the title: tail turning while it runs, tongue out when it lands, a head shake when it fails. */
function ProgressCham({ status, failed }: { status?: string; failed?: boolean }) {
    const bad = failed || status === 'FAILED' || status === 'EXPIRED';
    const mood: ChamMood = bad ? 'error' : status?.startsWith('COMPLETED') ? 'happy' : 'busy';
    return <Chameleon key={mood} size={78} mood={mood} tone={bad ? '#f87171' : undefined} className="-mt-1 h-auto w-14 shrink-0 text-white/35 sm:w-[78px]" />;
}

function StepIcon({ state }: { state: DialogStep['state'] }) {
    const base = 'h-6 w-6 rounded-full flex items-center justify-center shrink-0 border';
    if (state === 'done') return <div className={cn(base, 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400')}><Check className="h-3.5 w-3.5" /></div>;
    if (state === 'active') return <div className={cn(base, 'bg-blue-500/10 border-blue-500/30 text-blue-400')}><Loader2 className="h-3.5 w-3.5 animate-spin" /></div>;
    if (state === 'attention') return <div className={cn(base, 'bg-amber-500/10 border-amber-500/30 text-amber-400')}><AlertTriangle className="h-3.5 w-3.5" /></div>;
    if (state === 'failed') return <div className={cn(base, 'bg-red-500/10 border-red-500/30 text-red-400')}><X className="h-3.5 w-3.5" /></div>;
    return <div className={cn(base, 'border-white/10 text-white/20')}><Circle className="h-2 w-2 fill-current" /></div>;
}

function StepList({ steps }: { steps: DialogStep[] }) {
    return (
        <ol className="space-y-3">
            {steps.map(s => (
                <li key={s.key} className="flex items-start gap-3">
                    <StepIcon state={s.state} />
                    <div className="min-w-0 flex-1 pt-0.5">
                        <div className="flex items-start justify-between gap-2">
                            <span className={cn('min-w-0 break-words text-[13px] sm:text-sm', s.state === 'pending' ? 'text-white/40' : 'text-white/90', s.state === 'active' && 'font-medium')}>{s.label}</span>
                            {s.link && (
                                <a href={s.link} target="_blank" rel="noopener noreferrer" className="text-xs text-white/40 hover:text-emerald-400 inline-flex items-center gap-1 shrink-0">
                                    View <ExternalLink className="h-3 w-3" />
                                </a>
                            )}
                        </div>
                        {s.note && (
                            <p className={cn('text-xs mt-0.5 break-words', s.state === 'failed' ? 'text-red-300/90' : s.state === 'attention' ? 'text-amber-300/90' : 'text-white/50')}>{s.note}</p>
                        )}
                    </div>
                </li>
            ))}
        </ol>
    );
}

/** The body of the swap dialog: what goes in, what comes out, and the steps. */
export function SwapProgressView({ swap, op, sell, buy }: {
    swap?: SolanaSwap; op?: SwapProgress | null;
    sell: { symbol: string; display: string; icon?: string }; buy: { symbol: string; display: string; icon?: string };
}) {
    const delivered = !!swap?.display.outAmount;
    return (
        <div className="space-y-4">
            <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    <TokenChainIcon tokenIcon={sell.icon ?? ''} tokenName={sell.symbol} chain="solana" size="md" />
                    <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">{sell.display} {sell.symbol}</div>
                        <div className="text-xs text-white/50">Solana</div>
                    </div>
                </div>
                <ArrowRight className="h-4 w-4 text-white/40 shrink-0" />
                <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                    <div className="min-w-0 text-right">
                        <div className="text-sm font-semibold text-white truncate">{delivered ? '' : '≈ '}{buy.display} {buy.symbol}</div>
                        <div className="text-xs text-white/50">Solana</div>
                    </div>
                    <TokenChainIcon tokenIcon={buy.icon ?? ''} tokenName={buy.symbol} chain="solana" size="md" />
                </div>
            </div>
            <StepList steps={swapSteps(swap, op)} />
        </div>
    );
}

/** The body of the dialog, apart from the dialog shell: also what the tests render. */
export function TransferProgress({ transfer, op, src, dst, secondsLeft }: {
    transfer?: Transfer; op?: Operation | null; src?: CctpChain; dst?: CctpChain; secondsLeft?: number;
}) {
    const steps = transferSteps(transfer, { op, src, dst });
    const sent = transfer?.display.grossAmount ?? op?.amount ?? '';
    const receive = transfer ? (transfer.display.received ?? transfer.display.expectedReceive) : undefined;
    const delivered = !!transfer?.display.received;
    return (
        <div className="space-y-4">
            <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    <TokenChainIcon tokenIcon={USDC_ICON} tokenName="USDC" chain={src ? localChain(src.key)?.tokenChain : null} size="md" />
                    <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">{sent} USDC</div>
                        <div className="text-xs text-white/50 truncate">{src?.name ?? ''}</div>
                    </div>
                </div>
                <ArrowRight className="h-4 w-4 text-white/40 shrink-0" />
                <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                    <div className="min-w-0 text-right">
                        <div className="truncate text-sm font-semibold text-white">{receive ? `${delivered ? '' : '≈ '}${receive} USDC` : '…'}</div>
                        <div className="text-xs text-white/50 truncate">{dst?.name ?? ''}</div>
                    </div>
                    <TokenChainIcon tokenIcon={USDC_ICON} tokenName="USDC" chain={dst ? localChain(dst.key)?.tokenChain : null} size="md" />
                </div>
            </div>

            <StepList steps={steps} />

            {transfer?.status === 'CREATED' && secondsLeft !== undefined && !op?.busy && (
                <p className="text-xs text-amber-300/80">
                    {secondsLeft > 0 ? `Not sent yet. This transfer can be signed for another ${formatCountdown(secondsLeft)}.` : 'The time to sign this transfer has run out.'}
                </p>
            )}
            {transfer && (transfer.feeStatus === 'paid' || transfer.feeStatus === 'pending' || transfer.feeStatus === 'awaiting') && transfer.protocolFee && transfer.protocolFee !== '0' && (
                <p className="text-xs text-white/40">
                    Service fee {transfer.display.protocolFee} USDC{transfer.feeStatus === 'paid' ? ', paid' : ''}.
                    {transfer.expectedFee !== '0' && ` Network fee about ${transfer.display.expectedFee} USDC.`}
                </p>
            )}
        </div>
    );
}

const SWAP_FINAL = new Set(['COMPLETED', 'FAILED', 'EXPIRED']);

function SwapDialog() {
    const ctx = useSwapServer();
    const { dialog, swapOperation } = ctx;
    const id = dialog.id ?? swapOperation?.id ?? null;
    const op = swapOperation && (dialog.id === null || swapOperation.id === dialog.id) ? swapOperation : null;

    // Reading the record is also what makes the server settle it from the chain.
    const record = useQuery({
        queryKey: ['swap-server', 'sol-swap', id],
        queryFn: ({ signal }) => ctx.api.getSolSwap(id!, { signal }),
        enabled: dialog.open && !!id,
        refetchInterval: q => (q.state.data && SWAP_FINAL.has(q.state.data.status) ? false : 3_000),
        staleTime: 1_000, retry: 1,
    });
    // The page's own result is at least as new as the last poll.
    const swap = id ? (op?.result && SWAP_FINAL.has(op.result.status) ? op.result : record.data) : undefined;
    const row = ctx.rows.find(r => r.id === id);

    const over = (!!swap && SWAP_FINAL.has(swap.status)) || (op?.stage === 'failed' && swap?.status !== 'SUBMITTED');
    const refresh = ctx.refresh;
    useEffect(() => { if (over) refresh(); }, [over, refresh]);

    const d = swap?.display;
    const sell = { symbol: d?.inSymbol ?? op?.sell.symbol ?? row?.sell.symbol ?? '', display: d?.inAmount ?? op?.sell.display ?? row?.sell.display ?? '…', icon: row?.sell.icon };
    const buy = { symbol: d?.outSymbol ?? op?.buy.symbol ?? row?.buy.symbol ?? '', display: d?.outAmount ?? d?.quotedOutAmount ?? op?.buy.display ?? row?.buy.display ?? '…', icon: row?.buy.icon };
    const busy = !!op?.busy;

    return (
        <Dialog open={dialog.open} onOpenChange={open => { if (!open) ctx.hideDialog(); }}>
            <DialogContent className="max-h-[calc(100dvh-24px)] w-[calc(100vw-24px)] max-w-[440px] gap-3 overflow-y-auto overflow-x-hidden rounded-xl p-4 sm:gap-4 sm:p-6">
                <div className="flex min-w-0 items-start justify-between gap-2 pr-6">
                    <DialogHeader className="min-w-0 text-left">
                        <DialogTitle>Solana swap</DialogTitle>
                        <DialogDescription>{swapHeadline(swap, op)}</DialogDescription>
                    </DialogHeader>
                    <ProgressCham status={swap?.status} failed={op?.stage === 'failed' && swap?.status !== 'SUBMITTED'} />
                </div>
                <SwapProgressView swap={swap} op={op} sell={sell} buy={buy} />
                <div className="flex flex-col gap-2">
                    <Button variant="outline" className="w-full" onClick={ctx.hideDialog}>{over ? 'Done' : 'Close'}</Button>
                    {!over && (
                        <p className="text-xs text-white/40 text-center">
                            {busy && op?.stage !== 'landing' ? 'Keep this page open until your wallet has finished signing.' : 'You can close this. The swap stays in your history.'}
                        </p>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

const BCH_FINAL = new Set(['SUCCESS', 'REFUNDED', 'FAILED', 'EXPIRED']);

function BchSwapDialog() {
    const ctx = useSwapServer();
    const { dialog, bchOperation } = ctx;
    const id = dialog.id ?? bchOperation?.id ?? null;
    const op = bchOperation && (dialog.id === null || bchOperation.id === dialog.id) ? bchOperation : null;

    const record = useQuery({
        queryKey: ['swap-server', 'bch-swap', id],
        queryFn: ({ signal }) => ctx.api.getBchSwap(id!, { signal }),
        enabled: dialog.open && !!id,
        refetchInterval: q => (q.state.data && BCH_FINAL.has(q.state.data.status) ? false : 3_000),
        staleTime: 1_000,
        retry: 1,
    });

    const swap = id ? (op?.result && BCH_FINAL.has(op.result.status) ? op.result : record.data) : undefined;
    const over = (!!swap && BCH_FINAL.has(swap.status)) || (op?.stage === 'failed' && swap?.status !== 'SUCCESS');
    const refresh = ctx.refresh;
    useEffect(() => { if (over) refresh(); }, [over, refresh]);

    // Countdown calculation
    const [now, setNow] = useState(() => Date.now());
    const isPending = swap?.status === 'PENDING_DEPOSIT' || !swap?.status;
    useEffect(() => {
        if (!dialog.open || !isPending) return;
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, [dialog.open, isPending]);

    const deadlineMs = swap?.deadline ? new Date(swap.deadline).getTime() : 0;
    const secondsRemaining = deadlineMs > 0 ? Math.max(0, Math.floor((deadlineMs - now) / 1000)) : undefined;

    const [copiedAddr, setCopiedAddr] = useState(false);
    const [copiedAmount, setCopiedAmount] = useState(false);
    const [showQr, setShowQr] = useState(true);
    const [txHashInput, setTxHashInput] = useState('');
    const [submittingTx, setSubmittingTx] = useState(false);

    const copyText = (text: string, type: 'addr' | 'amount') => {
        navigator.clipboard.writeText(text);
        if (type === 'addr') {
            setCopiedAddr(true);
            setTimeout(() => setCopiedAddr(false), 2000);
            notifyToast.success('Deposit address copied');
        } else {
            setCopiedAmount(true);
            setTimeout(() => setCopiedAmount(false), 2000);
            notifyToast.success('Amount copied');
        }
    };

    const handleManualTxSubmit = async () => {
        if (!swap?.id || !txHashInput.trim() || submittingTx) return;
        setSubmittingTx(true);
        try {
            await ctx.api.submitBchDepositTx(swap.id, txHashInput.trim());
            notifyToast.success('Deposit transaction submitted for monitoring');
            setTxHashInput('');
            void record.refetch();
        } catch (err: any) {
            notifyToast.error('Failed to submit transaction', { description: err.message });
        } finally {
            setSubmittingTx(false);
        }
    };

    const sell = {
        symbol: swap?.fromToken.symbol ?? op?.sell.symbol ?? 'BCH',
        display: swap?.amountInFormatted ?? op?.sell.display ?? '…',
        chain: swap?.fromToken.chain ?? 'bch',
        icon: swap?.fromToken.icon,
    };
    const buy = {
        symbol: swap?.toToken.symbol ?? op?.buy.symbol ?? 'USDC',
        display: swap?.expectedOutFormatted ?? op?.buy.display ?? '…',
        chain: swap?.toToken.chain ?? 'base',
        icon: swap?.toToken.icon,
    };

    const isBad = swap?.status === 'FAILED' || swap?.status === 'EXPIRED' || op?.stage === 'failed';

    return (
        <Dialog open={dialog.open} onOpenChange={open => { if (!open) ctx.hideDialog(); }}>
            <DialogContent className="max-h-[calc(100dvh-24px)] w-[calc(100vw-24px)] max-w-[460px] gap-3 overflow-y-auto overflow-x-hidden rounded-xl p-4 sm:gap-4 sm:p-6">
                <div className="flex min-w-0 items-start justify-between gap-2 pr-6">
                    <DialogHeader className="min-w-0 text-left">
                        <DialogTitle>Bitcoin Cash Cross-Chain</DialogTitle>
                        <DialogDescription>{bchSwapHeadline(swap, op)}</DialogDescription>
                    </DialogHeader>
                    <ProgressCham status={swap?.status} failed={isBad} />
                </div>

                <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                        <TokenChainIcon tokenIcon={sell.icon ?? ''} tokenName={sell.symbol} chain={sell.chain as any} size="md" />
                        <div className="min-w-0">
                            <div className="text-sm font-semibold text-white truncate">{sell.display} {sell.symbol}</div>
                            <div className="text-xs text-white/50 capitalize">{sell.chain}</div>
                        </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-white/40 shrink-0" />
                    <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                        <div className="min-w-0 text-right">
                            <div className="text-sm font-semibold text-white truncate">{swap?.status === 'SUCCESS' ? '' : '≈ '}{buy.display} {buy.symbol}</div>
                            <div className="text-xs text-white/50 capitalize">{buy.chain}</div>
                        </div>
                        <TokenChainIcon tokenIcon={buy.icon ?? ''} tokenName={buy.symbol} chain={buy.chain as any} size="md" />
                    </div>
                </div>

                {/* Deposit Address Box when pending */}
                {swap && (swap.status === 'PENDING_DEPOSIT' || !swap.status) && (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3 sm:p-4 space-y-3">
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-emerald-400 uppercase tracking-wider">Deposit Instructions</span>
                            {secondsRemaining !== undefined && (
                                <span className="flex items-center gap-1 text-white/60 font-mono">
                                    <Clock className="h-3 w-3 text-emerald-400" />
                                    {formatCountdown(secondsRemaining)}
                                </span>
                            )}
                        </div>

                        {showQr && swap.depositAddress && (
                            <div className="flex justify-center p-2">
                                <div className="rounded-2xl bg-white p-3 shadow-lg">
                                    <QRCodeSVG value={swap.depositAddress} size={150} level="M" />
                                </div>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-[11px] font-medium text-white/60">Single-use Deposit Address</label>
                            <div className="flex items-center justify-between gap-2 rounded-lg bg-black/40 border border-white/10 px-3 py-2">
                                <span className="font-mono text-xs text-white/90 break-all select-all">{swap.depositAddress}</span>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-white/70 hover:text-white hover:bg-white/10 shrink-0"
                                    onClick={() => copyText(swap.depositAddress, 'addr')}
                                >
                                    {copiedAddr ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                                </Button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1">
                            <span className="text-white/60">Amount to send:</span>
                            <div className="flex items-center gap-1">
                                <span className="font-mono font-semibold text-white">{swap.amountInFormatted} {swap.fromToken.symbol}</span>
                                <button
                                    className="text-white/40 hover:text-white"
                                    onClick={() => copyText(swap.amountInFormatted, 'amount')}
                                    title="Copy amount"
                                >
                                    {copiedAmount ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                                </button>
                            </div>
                        </div>

                        {swap.depositMemo && (
                            <div className="flex items-center justify-between text-xs pt-0.5">
                                <span className="text-amber-400 font-medium">Required Memo:</span>
                                <span className="font-mono font-bold text-amber-300">{swap.depositMemo}</span>
                            </div>
                        )}

                        {/* Optional Manual Tx Hash Input */}
                        <div className="pt-2 border-t border-white/10">
                            <details className="text-xs group">
                                <summary className="cursor-pointer text-white/50 hover:text-white/80 py-1 select-none">
                                    Already sent? Paste deposit tx hash
                                </summary>
                                <div className="mt-2 flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="0x... or bch txid"
                                        value={txHashInput}
                                        onChange={e => setTxHashInput(e.target.value)}
                                        className="min-w-0 flex-1 rounded bg-black/40 border border-white/10 px-2.5 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-emerald-500"
                                    />
                                    <Button
                                        size="sm"
                                        className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3"
                                        disabled={!txHashInput.trim() || submittingTx}
                                        onClick={handleManualTxSubmit}
                                    >
                                        {submittingTx ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Submit'}
                                    </Button>
                                </div>
                            </details>
                        </div>
                    </div>
                )}

                {/* Stepper Progress */}
                <StepList steps={bchSwapSteps(swap, op)} />

                {op?.error && <p className="text-sm text-red-300/90 break-words">{op.error}</p>}

                <div className="flex flex-col gap-2 pt-2">
                    <Button variant="outline" className="w-full" onClick={ctx.hideDialog}>
                        {over ? 'Done' : 'Close'}
                    </Button>
                    {!over && (
                        <p className="text-xs text-white/40 text-center">
                            You can close this. The swap is monitored continuously and saved to your history.
                        </p>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

export function ProcessingDialog() {
    const kind = useSwapServer().dialog.kind;
    if (kind === 'swap') return <SwapDialog />;
    if (kind === 'bch') return <BchSwapDialog />;
    return <TransferDialog />;
}

function TransferDialog() {
    const ctx = useSwapServer();
    const { dialog, operation } = ctx;
    // A dialog opened without a record follows the operation this page is running.
    const id = dialog.id ?? operation?.id ?? null;
    const op = operation && (dialog.id === null || operation.id === dialog.id) ? operation : null;

    const record = useQuery({
        queryKey: ['swap-server', 'transfer', id],
        queryFn: ({ signal }) => ctx.api.getTransfer(id!, { signal }),
        enabled: dialog.open && !!id,
        refetchInterval: q => (q.state.data && FINAL.has(q.state.data.status) ? false : 3_000),
        staleTime: 1_000, retry: 1,
    });
    const transfer = id ? record.data : undefined;
    const src = ctx.chain(transfer?.src ?? op?.src ?? '');
    const dst = ctx.chain(transfer?.dst ?? op?.dst ?? '');

    // Countdown for an unsigned transfer, from the moment the record arrived.
    const [now, setNow] = useState(() => Date.now());
    const counting = dialog.open && transfer?.status === 'CREATED';
    useEffect(() => {
        if (!counting) return;
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, [counting]);
    const left = transfer?.expiresInSec !== undefined ? Math.max(0, Math.round(transfer.expiresInSec - (now - record.dataUpdatedAt) / 1000)) : undefined;

    // The list behind the dialog polls more slowly: tell it the moment this record is over.
    const finished = !!transfer && FINAL.has(transfer.status);
    const refresh = ctx.refresh;
    useEffect(() => { if (finished) refresh(); }, [finished, refresh]);

    const busy = !!op?.busy;
    const canSign = !!transfer && transfer.status === 'CREATED' && !busy && (left === undefined || left > 0);
    const canPayFee = !!transfer && !!src && !busy && feeIsDue(transfer, src);
    const over = !!transfer && FINAL.has(transfer.status);
    // The clock only has to be coarse here: the offer appears minutes after the attestation, not seconds.
    const minting = ctx.minting?.id === id ? ctx.minting : null;
    const canMint = !!transfer && !busy && !minting?.busy
        && canSelfMint(transfer, dst, { relayEnabled: ctx.config?.cctp.relayEnabled ?? true, now: Math.max(now, record.dataUpdatedAt) });
    const waiting = dialog.open && !!transfer && transfer.status === 'ATTESTED' && !canMint;
    useEffect(() => {
        if (!waiting) return;
        const t = setInterval(() => setNow(Date.now()), 15_000);
        return () => clearInterval(t);
    }, [waiting]);

    return (
        <Dialog open={dialog.open} onOpenChange={open => { if (!open) ctx.hideDialog(); }}>
            <DialogContent className="max-h-[calc(100dvh-24px)] w-[calc(100vw-24px)] max-w-[440px] gap-3 overflow-y-auto overflow-x-hidden rounded-xl p-4 sm:gap-4 sm:p-6">
                <div className="flex min-w-0 items-start justify-between gap-2 pr-6">
                    <DialogHeader className="min-w-0 text-left">
                        <DialogTitle>USDC bridge</DialogTitle>
                        <DialogDescription>{transferHeadline(transfer, op)}</DialogDescription>
                    </DialogHeader>
                    <ProgressCham status={transfer?.status} failed={!!op?.error && !transfer} />
                </div>

                <TransferProgress transfer={transfer} op={op} src={src} dst={dst} secondsLeft={left} />

                {op?.error && !transfer && <p className="text-sm text-red-300/90 break-words">{op.error}</p>}

                <div className="flex flex-col gap-2">
                    {canSign && (
                        <Button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white" onClick={() => void ctx.resume(transfer!.id)}>
                            Sign and send
                        </Button>
                    )}
                    {canPayFee && (
                        <Button className="w-full bg-amber-600 hover:bg-amber-500 text-white" onClick={() => void ctx.sendFee(transfer!.id)}>
                            Send the service fee ({transfer!.display.protocolFee} USDC)
                        </Button>
                    )}
                    {(canMint || minting?.busy) && (
                        <div className="space-y-1">
                            <Button variant="outline" className="w-full border-sky-500/30 text-sky-300 hover:bg-sky-500/10" disabled={!!minting?.busy} onClick={() => void ctx.selfMint(transfer!.id)}>
                                {minting?.busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Delivering…</> : 'Deliver it myself'}
                            </Button>
                            <p className="text-xs text-white/40 text-center">
                                {ctx.config?.cctp.relayEnabled === false ? 'Automatic delivery is switched off right now.' : 'The automatic delivery is taking longer than usual.'}
                                {' '}Your wallet sends the delivery on {dst?.name ?? 'the destination chain'} and pays its network fee there.
                            </p>
                        </div>
                    )}
                    {minting?.error && <p className="text-xs text-red-300/90 break-words">{minting.error}</p>}
                    <Button variant="outline" className="w-full" onClick={ctx.hideDialog}>{over ? 'Done' : 'Close'}</Button>
                    {!over && (
                        <p className="text-xs text-white/40 text-center">
                            {busy ? 'Keep this page open until your wallet has finished signing.' : 'You can close this. The transfer carries on and stays in your history.'}
                        </p>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
