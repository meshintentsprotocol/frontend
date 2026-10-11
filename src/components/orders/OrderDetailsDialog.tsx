/**
 * The pop-up card for one BCH order or one TWAP order: what goes in, what comes out,
 * each step, and what the user can do next. The card the USDC bridge has
 * (swap-server/ProcessingDialog), for CashToken swaps, limit orders and TWAP.
 *
 * It only shows; closing it stops nothing. It opens when an order is placed and from
 * any row of the board, through lib/walletUi.ts.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, Check, Circle, ExternalLink, Loader2, RotateCcw, X, XCircle, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TokenChainIcon } from '@/components/common/TokenChainIcon';
import { Chameleon, type ChamMood } from '@/components/wallet/Chameleon';
import { useBCHSwapOptional } from '@/context/BCHSwapContext';
import { useWalletUi, walletUi } from '@/lib/walletUi';
import { cn } from '@/lib/utils';
import type { DialogStep } from '@/swap-server/steps';
import { useOrders } from './useOrders';
import {
    KIND_CLASS, KIND_LABEL, TONE_CLASS, bchOrderCancellable, bchOrderClaimable, bchOrderHeadline, bchOrderRefundable,
    bchOrderSteps, twapHeadline, twapSteps, type OrderItem, type OrderTone,
} from './model';

function StepIcon({ state }: { state: DialogStep['state'] }) {
    const base = 'h-6 w-6 rounded-full flex items-center justify-center shrink-0 border';
    if (state === 'done') return <div className={cn(base, 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400')}><Check className="h-3.5 w-3.5" /></div>;
    if (state === 'active') return <div className={cn(base, 'bg-blue-500/10 border-blue-500/30 text-blue-400')}><Loader2 className="h-3.5 w-3.5 animate-spin" /></div>;
    if (state === 'attention') return <div className={cn(base, 'bg-amber-500/10 border-amber-500/30 text-amber-400')}><AlertTriangle className="h-3.5 w-3.5" /></div>;
    if (state === 'failed') return <div className={cn(base, 'bg-red-500/10 border-red-500/30 text-red-400')}><X className="h-3.5 w-3.5" /></div>;
    return <div className={cn(base, 'border-white/10 text-white/20')}><Circle className="h-2 w-2 fill-current" /></div>;
}

/** The steps of an order, top to bottom. Also what the tests render. */
export function OrderStepList({ steps }: { steps: DialogStep[] }) {
    return (
        <ol className="space-y-3">
            {steps.map(s => (
                <li key={s.key} className="flex items-start gap-3">
                    <StepIcon state={s.state} />
                    <div className="min-w-0 flex-1 pt-0.5">
                        <div className="flex items-start justify-between gap-2">
                            <span className={cn('min-w-0 break-words text-[13px] sm:text-sm', s.state === 'pending' ? 'text-white/40' : 'text-white/90', s.state === 'active' && 'font-medium')}>{s.label}</span>
                            {s.link && (
                                <a href={s.link} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 text-xs text-white/40 hover:text-emerald-400">
                                    View <ExternalLink className="h-3 w-3" />
                                </a>
                            )}
                        </div>
                        {s.note && (
                            <p className={cn('mt-0.5 break-words text-xs', s.state === 'failed' ? 'text-red-300/90' : s.state === 'attention' ? 'text-amber-300/90' : 'text-white/50')}>{s.note}</p>
                        )}
                    </div>
                </li>
            ))}
        </ol>
    );
}

const CHAM: Record<OrderTone, ChamMood> = { action: 'idle', waiting: 'busy', progress: 'busy', failed: 'error', refunded: 'idle', done: 'happy', idle: 'idle' };
const CHAM_TONE: Partial<Record<OrderTone, string>> = { failed: '#f87171', refunded: '#fb923c', waiting: '#fbbf24' };

/** What goes in and what comes out, with Cham showing how it is going. */
export function OrderSummary({ item }: { item: OrderItem }) {
    return (
        <div className="lg-well flex min-w-0 items-center justify-between gap-2 rounded-xl px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
                <TokenChainIcon tokenIcon={item.sell.icon ?? ''} tokenName={item.sell.symbol} chain={item.sell.chain} size="md" />
                <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{item.sell.amount} {item.sell.symbol}</div>
                    <div className="text-xs text-white/50">You send</div>
                </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-white/40" />
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                <div className="min-w-0 text-right">
                    <div className="truncate text-sm font-semibold text-white">{item.buyApprox ? '≈ ' : ''}{item.buy.amount} {item.buy.symbol}</div>
                    <div className="text-xs text-white/50">{item.buyApprox ? 'You receive' : 'Received'}</div>
                </div>
                <TokenChainIcon tokenIcon={item.buy.icon ?? ''} tokenName={item.buy.symbol} chain={item.buy.chain} size="md" />
            </div>
        </div>
    );
}

export function OrderDetailsDialog() {
    const ref = useWalletUi().order;
    const { items, asset, isMainnet } = useOrders();
    const swap = useBCHSwapOptional();
    const [busy, setBusy] = useState(false);

    const item = ref ? items.find(i => i.source === ref.source && i.id === ref.id) : undefined;

    // The steps of an open order carry clocks.
    const [now, setNow] = useState(() => Date.now());
    const ticking = !!item?.open && !!item.bch;
    useEffect(() => {
        if (!ticking) return;
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, [ticking]);
    const nowSec = Math.floor(now / 1000);

    const order = item?.bch;
    const steps = !item ? []
        : order ? bchOrderSteps(order, { isMainnet, nowSec })
        : item.twap ? twapSteps(item.twap, asset, t => new Date(t * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
        : [];
    const headline = order ? bchOrderHeadline(order) : item?.twap ? twapHeadline(item.twap) : '';

    const run = (work: (id: string) => Promise<void>) => async () => {
        if (!order) return;
        setBusy(true);
        try { await work(order.id); } finally { setBusy(false); }
    };

    return (
        <Dialog open={!!ref} onOpenChange={o => { if (!o) walletUi.closeOrder(); }}>
            <DialogContent className="lg-panel max-h-[calc(100dvh-24px)] w-[calc(100vw-24px)] max-w-[460px] gap-3 overflow-y-auto overflow-x-hidden rounded-xl bg-transparent p-4 sm:gap-4 sm:rounded-xl sm:p-5 lg-scroll" data-order-card>
                {!item ? (
                    <DialogHeader>
                        <DialogTitle>Order</DialogTitle>
                        <DialogDescription>Looking for this order…</DialogDescription>
                    </DialogHeader>
                ) : (
                    <>
                        <div className="flex min-w-0 items-start justify-between gap-2 pr-6">
                            <DialogHeader className="min-w-0 space-y-1.5 text-left">
                                <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
                                    {item.kind === 'twap' ? 'TWAP order' : item.kind === 'limit' ? 'Limit order' : 'Swap'}
                                    <Badge variant="outline" className={cn('h-4 px-1.5 py-0 text-[10px]', KIND_CLASS[item.kind])}>{KIND_LABEL[item.kind]}</Badge>
                                    <Badge variant="outline" className={cn('px-1.5 py-0 text-[11px]', TONE_CLASS[item.status.tone])}>{item.status.label}</Badge>
                                </DialogTitle>
                                <DialogDescription className="text-xs text-white/55">{headline}</DialogDescription>
                                <p className="text-[11px] text-white/35">{item.route}</p>
                            </DialogHeader>
                            <Chameleon size={84} mood={CHAM[item.status.tone]} tone={CHAM_TONE[item.status.tone]} className="-mt-1 h-auto w-14 shrink-0 text-white/35 sm:w-[84px]" />
                        </div>

                        <OrderSummary item={item} />

                        {item.progress && (
                            <div className="flex items-center gap-2">
                                <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-[width] duration-500"
                                        style={{ width: `${Math.round((item.progress.done / Math.max(1, item.progress.total)) * 100)}%` }} />
                                </div>
                                <span className="shrink-0 text-xs tabular-nums text-white/60">
                                    {item.progress.done} / {item.progress.total} filled{item.progress.refunded ? ` · ${item.progress.refunded} refunded` : ''}
                                </span>
                            </div>
                        )}

                        <div className={cn(item.twap && item.twap.slices.length > 6 && 'max-h-[280px] overflow-y-auto pr-1 lg-scroll')}>
                            <OrderStepList steps={steps} />
                        </div>

                        <div className="flex flex-col gap-2">
                            {order && swap && bchOrderClaimable(order) && (
                                <Button className="w-full gap-1.5 bg-gradient-to-r from-blue-600 to-violet-600 text-white hover:from-blue-500 hover:to-violet-500" disabled={busy} onClick={run(swap.claimOrder)}>
                                    <Zap className="h-4 w-4" /> {busy ? 'Claiming…' : 'Claim'}
                                </Button>
                            )}
                            {order && swap && bchOrderCancellable(order) && (
                                <Button variant="outline" className="w-full gap-1.5 border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300" disabled={busy} onClick={run(swap.cancelSameChainOrder)}>
                                    <XCircle className="h-4 w-4" /> {busy ? 'Cancelling…' : 'Cancel and reclaim'}
                                </Button>
                            )}
                            {order && swap && bchOrderRefundable(order, nowSec) && (
                                <Button variant="outline" className="w-full gap-1.5 border-orange-500/40 text-orange-400 hover:bg-orange-500/10 hover:text-orange-300" disabled={busy} onClick={run(swap.requestRefund)}>
                                    <RotateCcw className="h-4 w-4" /> {busy ? 'Requesting…' : 'Refund'}
                                </Button>
                            )}
                            <Button variant="outline" className="w-full" onClick={walletUi.closeOrder}>{item.open ? 'Close' : 'Done'}</Button>
                            {item.open && (
                                <p className="text-center text-xs text-white/40">
                                    {item.twap ? 'You can close this. Slices keep filling on chain and stay in your history.' : 'You can close this. The order carries on and stays in your history.'}
                                </p>
                            )}
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
