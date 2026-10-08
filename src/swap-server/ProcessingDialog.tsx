/**
 * The pop-up card for one cross-chain transfer: what was sent, each step, and what the user can do next.
 *
 * It only shows; closing it stops nothing. Signatures come from the provider's operation, everything after the
 * burn from the server's record, polled while the dialog is open. The same dialog opens from a history row, so a
 * transfer started on another device (or before a reload) reads the same.
 */
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, Check, Circle, ExternalLink, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TokenChainIcon } from '@/components/common/TokenChainIcon';
import { cn } from '@/lib/utils';
import { localChain } from './cctpChains';
import { feeIsDue } from './flows';
import { useSwapServer } from './context';
import { formatCountdown, transferHeadline, transferSteps, type DialogStep, type Operation } from './steps';
import { USDC_ICON } from './tokens';
import type { CctpChain, Transfer } from './types';

const FINAL = new Set(['COMPLETED', 'COMPLETED_EXTERNAL', 'FAILED', 'EXPIRED']);

function StepIcon({ state }: { state: DialogStep['state'] }) {
    const base = 'h-6 w-6 rounded-full flex items-center justify-center shrink-0 border';
    if (state === 'done') return <div className={cn(base, 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400')}><Check className="h-3.5 w-3.5" /></div>;
    if (state === 'active') return <div className={cn(base, 'bg-blue-500/10 border-blue-500/30 text-blue-400')}><Loader2 className="h-3.5 w-3.5 animate-spin" /></div>;
    if (state === 'attention') return <div className={cn(base, 'bg-amber-500/10 border-amber-500/30 text-amber-400')}><AlertTriangle className="h-3.5 w-3.5" /></div>;
    if (state === 'failed') return <div className={cn(base, 'bg-red-500/10 border-red-500/30 text-red-400')}><X className="h-3.5 w-3.5" /></div>;
    return <div className={cn(base, 'border-white/10 text-white/20')}><Circle className="h-2 w-2 fill-current" /></div>;
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
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] px-4 py-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <TokenChainIcon tokenIcon={USDC_ICON} tokenName="USDC" chain={src ? localChain(src.key)?.tokenChain : null} size="md" />
                    <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">{sent} USDC</div>
                        <div className="text-xs text-white/50 truncate">{src?.name ?? ''}</div>
                    </div>
                </div>
                <ArrowRight className="h-4 w-4 text-white/40 shrink-0" />
                <div className="flex items-center gap-2.5 min-w-0 justify-end">
                    <div className="min-w-0 text-right">
                        <div className="text-sm font-semibold text-white">{receive ? `${delivered ? '' : '≈ '}${receive} USDC` : '…'}</div>
                        <div className="text-xs text-white/50 truncate">{dst?.name ?? ''}</div>
                    </div>
                    <TokenChainIcon tokenIcon={USDC_ICON} tokenName="USDC" chain={dst ? localChain(dst.key)?.tokenChain : null} size="md" />
                </div>
            </div>

            <ol className="space-y-3">
                {steps.map(s => (
                    <li key={s.key} className="flex items-start gap-3">
                        <StepIcon state={s.state} />
                        <div className="min-w-0 flex-1 pt-0.5">
                            <div className="flex items-center justify-between gap-2">
                                <span className={cn('text-sm', s.state === 'pending' ? 'text-white/40' : 'text-white/90', s.state === 'active' && 'font-medium')}>{s.label}</span>
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

export function ProcessingDialog() {
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

    return (
        <Dialog open={dialog.open} onOpenChange={open => { if (!open) ctx.hideDialog(); }}>
            <DialogContent className="sm:max-w-[440px] gap-4">
                <DialogHeader>
                    <DialogTitle>USDC bridge</DialogTitle>
                    <DialogDescription>{transferHeadline(transfer, op)}</DialogDescription>
                </DialogHeader>

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
