/**
 * One order in the board, whatever kind it is: the pair with its chain badges, what
 * it is and how it stands, where it runs, when, and what the user can do about it.
 * The display the USDC bridge rows introduced, now shared by swaps, limit orders and TWAP.
 *
 * Clicking the row opens the order's step card; the arrow at its end does the same
 * for the keyboard, so the row itself is not a control with other controls inside it.
 */

import { ArrowRight, ChevronRight, ExternalLink, RotateCcw, Timer, XCircle, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TokenChainIcon } from '@/components/common/TokenChainIcon';
import { cn } from '@/lib/utils';
import { formatCountdown } from '@/swap-server/steps';
import {
    KIND_CLASS, KIND_LABEL, TONE_CLASS, bchOrderCancellable, bchOrderClaimable, bchOrderRefundable, bchOrderTimer,
    type OrderItem,
} from './model';

export interface OrderRowActions {
    onOpen?: (item: OrderItem) => void;
    onClaim?: (id: string) => void;
    onCancel?: (id: string) => void;
    onRefund?: (id: string) => void;
    onSign?: (id: string) => void;
    onPayFee?: (id: string) => void;
}

function formatTime(ts: number) {
    return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const NOTE_TONE = { amber: 'text-amber-400/85', red: 'text-red-300/85', muted: 'text-white/45' } as const;

export function OrderRow({ item, nowSec, busyId, secondsLeft, compact, ...actions }: OrderRowActions & {
    item: OrderItem;
    /** The list's clock, for timers. */
    nowSec: number;
    /** The order an action is running on, if any. */
    busyId?: string | null;
    /** Seconds left to sign a swap-server record. */
    secondsLeft?: number;
    /** Tighter, for the wallet panel. */
    compact?: boolean;
}) {
    const { onOpen } = actions;
    const order = item.bch;
    const server = item.server;
    const busy = busyId === item.id;
    const timer = order ? bchOrderTimer(order, nowSec) : null;
    const expired = secondsLeft === 0;
    const sell = `${item.sell.amount} ${item.sell.symbol}`.trim();
    const buy = `${item.buyApprox ? '≈ ' : ''}${item.buy.amount} ${item.buy.symbol}`.trim();
    const link = item.links[item.links.length - 1];
    const pct = item.progress ? Math.round((item.progress.done / Math.max(1, item.progress.total)) * 100) : 0;

    return (
        <div
            onClick={onOpen ? () => onOpen(item) : undefined}
            data-order-row={item.kind}
            className={cn(
                'flex items-center justify-between gap-2 border-b border-white/[0.05] transition-colors last:border-b-0 hover:bg-white/[0.03]',
                compact ? 'px-3 py-2.5' : 'px-3 py-3 lg:px-4 lg:py-3.5',
                onOpen && 'cursor-pointer',
            )}
        >
            <div className="flex min-w-0 flex-1 items-center gap-2.5 lg:gap-3">
                <div className="flex flex-shrink-0 items-center -space-x-2">
                    <TokenChainIcon tokenIcon={item.sell.icon ?? ''} tokenName={item.sell.symbol} chain={item.sell.chain} size="sm" />
                    <TokenChainIcon tokenIcon={item.buy.icon ?? ''} tokenName={item.buy.symbol} chain={item.buy.chain} size="sm" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                        <span className="text-sm font-semibold text-white">{sell}</span>
                        <ArrowRight className="h-3 w-3 flex-shrink-0 text-white/40" />
                        <span className="text-sm font-semibold text-white">{buy}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className={cn('h-4 px-1.5 py-0 text-[10px]', KIND_CLASS[item.kind])}>{KIND_LABEL[item.kind]}</Badge>
                        <Badge variant="outline" title={item.status.hint} className={cn('px-1.5 py-0 text-[11px]', TONE_CLASS[item.status.tone], item.status.tone === 'action' && 'animate-pulse')}>
                            {item.status.label}
                        </Badge>
                        <span className="truncate text-xs text-white/45">{item.route}</span>
                    </div>

                    {item.progress && (
                        <div className="mt-1.5 flex items-center gap-2">
                            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.08]" role="progressbar" aria-valuemin={0} aria-valuemax={item.progress.total} aria-valuenow={item.progress.done}>
                                <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-[width] duration-500" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="shrink-0 text-[11px] tabular-nums text-white/55">
                                {item.progress.done} / {item.progress.total} filled{item.progress.refunded ? ` · ${item.progress.refunded} refunded` : ''}
                            </span>
                        </div>
                    )}

                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        {item.createdAt > 0 && <span className="text-xs text-white/45">{formatTime(item.createdAt)}</span>}
                        {timer && (
                            <span className={cn('flex items-center gap-0.5 text-xs tabular-nums', NOTE_TONE[timer.tone])}>
                                <Timer className="h-2.5 w-2.5 flex-shrink-0" />{timer.text}
                            </span>
                        )}
                        {server?.kind === 'transfer' && server.phase === 'awaiting_signature' && secondsLeft !== undefined && (
                            <span className={cn('flex items-center gap-0.5 text-xs tabular-nums', expired ? 'text-red-400' : 'text-amber-400/85')}>
                                <Timer className="h-2.5 w-2.5 flex-shrink-0" />
                                {expired ? 'time ran out' : `sign within ${formatCountdown(secondsLeft)}`}
                            </span>
                        )}
                        {item.note && item.note.tone !== 'red' && <span className={cn('text-xs', NOTE_TONE[item.note.tone])}>{item.note.text}</span>}
                    </div>
                    {item.note?.tone === 'red' && <p className="mt-0.5 break-words text-xs text-red-300/85">{item.note.text}</p>}
                </div>
            </div>

            <div className="flex flex-shrink-0 items-center gap-1" onClick={e => e.stopPropagation()}>
                {order && bchOrderClaimable(order) && actions.onClaim && (
                    <Button size="sm" className="h-7 gap-1 bg-gradient-to-r from-blue-600 to-violet-600 text-xs font-medium text-white shadow-lg shadow-blue-500/25 hover:from-blue-500 hover:to-violet-500 lg:h-8"
                        onClick={() => actions.onClaim!(order.id)} disabled={busy} title="Claim tokens on the destination chain">
                        <Zap className="h-3 w-3" />{busy ? 'Claiming…' : 'Claim'}
                    </Button>
                )}
                {order && bchOrderCancellable(order) && actions.onCancel && (
                    <Button size="sm" variant="outline" className="h-7 gap-1 border-red-500/40 text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 lg:h-8"
                        onClick={() => actions.onCancel!(order.id)} disabled={busy} title="Cancel this order now and reclaim your funds, without waiting for the expiry">
                        <XCircle className={cn('h-3 w-3', busy && 'animate-spin')} />{busy ? '…' : 'Cancel'}
                    </Button>
                )}
                {order && bchOrderRefundable(order, nowSec) && actions.onRefund && (
                    <Button size="sm" variant="outline" className="h-7 gap-1 border-orange-500/40 text-xs font-medium text-orange-400 hover:bg-orange-500/10 hover:text-orange-300 lg:h-8"
                        onClick={() => actions.onRefund!(order.id)} disabled={busy} title="Recover your locked funds after the timelock expires">
                        <RotateCcw className={cn('h-3 w-3', busy && 'animate-spin')} />{busy ? '…' : 'Refund'}
                    </Button>
                )}
                {server?.kind === 'transfer' && server.phase === 'awaiting_signature' && !expired && actions.onSign && (
                    <Button size="sm" className="h-7 bg-emerald-600 text-xs font-medium text-white hover:bg-emerald-500 lg:h-8" onClick={() => actions.onSign!(server.id)} disabled={busy}>Sign</Button>
                )}
                {server?.kind === 'transfer' && server.phase === 'action_needed' && actions.onPayFee && (
                    <Button size="sm" className="h-7 bg-amber-600 text-xs font-medium text-white hover:bg-amber-500 lg:h-8" onClick={() => actions.onPayFee!(server.id)} disabled={busy}>Pay fee</Button>
                )}
                {link && (
                    <a href={link.href} target="_blank" rel="noopener noreferrer" title={`View the ${link.label.toLowerCase()} transaction`} aria-label={`View the ${link.label.toLowerCase()} transaction`}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white/40 hover:bg-white/[0.05] hover:text-emerald-400 lg:h-8 lg:w-8">
                        <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                )}
                {onOpen && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-white/40 hover:text-emerald-400 lg:h-8 lg:w-8" onClick={() => onOpen(item)} title="Show the steps" aria-label={`Show the steps of ${sell} to ${buy}`}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>
    );
}
