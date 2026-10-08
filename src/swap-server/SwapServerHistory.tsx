/**
 * The wallet's swap-server records on the trade page, in the shape of the order history next to it: an Open tab
 * and a History tab, one row per transfer. The rows are the server's GET /activity, so they survive a reload,
 * a cleared browser and a change of device.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, BoxSelect, ChevronRight, ExternalLink, RefreshCw, Timer } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TokenChainIcon } from '@/components/common/TokenChainIcon';
import { cn } from '@/lib/utils';
import { localChain } from './cctpChains';
import { useSwapServer, useSwapServerOptional } from './context';
import { formatCountdown, PHASE_CLASS, rowStatusLabel, secondsLeft } from './steps';
import { USDC_ICON } from './tokens';
import type { ActivityItem } from './types';

function formatTime(ts: number) {
    return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const chainOf = (key: string) => (key === 'solana' ? 'solana' : localChain(key)?.tokenChain ?? null);

/**
 * One record. Clicking the row opens the processing dialog on that record; the arrow button at its end does the
 * same for the keyboard, so the row itself is not a control with other controls inside it.
 */
export function ActivityRow({ item, left, busy, onOpen, onSign, onPayFee }: {
    item: ActivityItem; left?: number; busy?: boolean; onOpen?: () => void; onSign?: () => void; onPayFee?: () => void;
}) {
    const sell = `${item.sell.display ?? '?'} ${item.sell.symbol ?? ''}`.trim();
    const buy = `${item.buy.estimated && !item.terminal ? '≈ ' : ''}${item.buy.display ?? '?'} ${item.buy.symbol ?? ''}`.trim();
    const route = item.kind === 'transfer' ? `${item.sell.chainName} → ${item.buy.chainName}` : 'Solana';
    const expired = left === 0;
    return (
        <div
            onClick={onOpen}
            className={cn('flex items-center justify-between py-3 lg:py-3.5 px-3 lg:px-4 border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] transition-colors', onOpen && 'cursor-pointer')}
        >
            <div className="flex items-center gap-2.5 lg:gap-3 flex-1 min-w-0">
                <div className="flex items-center -space-x-2 flex-shrink-0">
                    <TokenChainIcon tokenIcon={item.sell.icon ?? USDC_ICON} tokenName={item.sell.symbol} chain={chainOf(item.sell.chain)} size="sm" />
                    <TokenChainIcon tokenIcon={item.buy.icon ?? USDC_ICON} tokenName={item.buy.symbol} chain={chainOf(item.buy.chain)} size="sm" />
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-1.5 lg:gap-2 mb-0.5 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">{sell}</span>
                        <ArrowRight className="h-3 w-3 lg:h-3.5 lg:w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm font-semibold text-foreground">{buy}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="secondary" className="text-[10px] lg:text-xs px-1 lg:px-1.5 py-0 h-3.5 lg:h-4 bg-sky-500/10 text-sky-400 border-sky-500/20">
                            {item.kind === 'transfer' ? 'Bridge' : 'Swap'}
                        </Badge>
                        <Badge variant="outline" className={cn('text-xs px-1.5 py-0', PHASE_CLASS[item.phase])}>{rowStatusLabel(item)}</Badge>
                        <span className="text-xs text-muted-foreground truncate">{route}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs lg:text-sm text-muted-foreground">{formatTime(item.createdAt)}</span>
                        {item.phase === 'awaiting_signature' && left !== undefined && (
                            <span className={cn('flex items-center gap-0.5 text-xs tabular-nums', expired ? 'text-red-400' : 'text-amber-400/80')}>
                                <Timer className="h-2.5 w-2.5 flex-shrink-0" />
                                {expired ? 'time ran out' : `sign within ${formatCountdown(left)}`}
                            </span>
                        )}
                        {item.fee && item.phase !== 'awaiting_signature' && (
                            <span className="text-xs text-muted-foreground">fee {item.fee.display} {item.fee.symbol}{item.fee.status === 'paid' ? '' : ` (${item.fee.status === 'awaiting' ? 'not received' : item.fee.status})`}</span>
                        )}
                    </div>
                    {item.failReason && <p className="text-xs text-red-300/80 mt-0.5 break-words">{item.failReason}</p>}
                </div>
            </div>

            <div className="flex items-center gap-1 ml-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                {item.phase === 'awaiting_signature' && !expired && onSign && (
                    <Button size="sm" className="h-7 lg:h-8 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium" onClick={onSign} disabled={busy}>Sign</Button>
                )}
                {item.phase === 'action_needed' && onPayFee && (
                    <Button size="sm" className="h-7 lg:h-8 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium" onClick={onPayFee} disabled={busy}>Pay fee</Button>
                )}
                {(item.links.destination ?? item.links.source) && (
                    <a
                        href={item.links.destination ?? item.links.source} target="_blank" rel="noopener noreferrer"
                        title={item.links.destination ? 'View the delivery' : 'View the source transaction'}
                        className="h-7 w-7 lg:h-8 lg:w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-emerald-400 hover:bg-white/[0.04]"
                    >
                        <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                )}
                {onOpen && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 lg:h-8 lg:w-8 text-muted-foreground hover:text-emerald-400" onClick={onOpen} title="Show the steps" aria-label={`Show the steps of ${sell} to ${buy}`}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>
    );
}

function Empty({ title, hint }: { title: string; hint: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-10 text-center flex-1">
            <div className="relative opacity-30 mb-3">
                <BoxSelect className="h-16 w-16 lg:h-20 lg:w-20 text-muted-foreground" strokeWidth={0.5} />
            </div>
            <h3 className="text-sm lg:text-base font-semibold text-foreground mb-1">{title}</h3>
            <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
    );
}

export function SwapServerHistory() {
    const ctx = useSwapServer();
    const { rows, rowsReceivedAt, operation } = ctx;
    const open = rows.filter(r => !r.terminal);
    const history = rows.filter(r => r.terminal);
    const [tab, setTab] = useState<'open' | 'history'>('open');

    // One clock for every countdown in the list.
    const [now, setNow] = useState(() => Date.now());
    const counting = open.some(r => r.phase === 'awaiting_signature');
    useEffect(() => {
        if (!counting) return;
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, [counting]);

    const busy = !!operation?.busy;
    const row = (item: ActivityItem) => (
        <ActivityRow
            key={item.id} item={item} busy={busy}
            left={secondsLeft(item, rowsReceivedAt, now)}
            onOpen={() => ctx.showDialog(item.id)}
            onSign={() => void ctx.resume(item.id)}
            onPayFee={() => void ctx.sendFee(item.id)}
        />
    );
    const what = ctx.isMainnet ? 'Solana swaps' : 'USDC transfers';
    const hint = ctx.isMainnet ? 'Swap two Solana tokens to see it here.' : 'Send USDC from one chain to another to see it here.';

    return (
        <Card className="w-full rounded-3xl border border-muted/50 bg-card/80 backdrop-blur-sm shadow-lg overflow-hidden flex flex-col" style={{ height: 'var(--swap-card-height, auto)', minHeight: '480px' }}>
            <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
                <Tabs value={tab} onValueChange={v => setTab(v as 'open' | 'history')} className="w-full h-full flex flex-col">
                    <div className="border-b border-white/[0.06] px-4 flex items-center justify-between">
                        <TabsList className="bg-transparent gap-6 h-auto p-0 justify-start">
                            {(['open', 'history'] as const).map(v => (
                                <TabsTrigger
                                    key={v} value={v}
                                    className="px-0 py-2.5 border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none text-sm text-muted-foreground"
                                >
                                    {v === 'open' ? `In progress (${open.length})` : `History (${history.length})`}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                        <Button variant="ghost" size="icon" className="h-7 w-7 lg:h-8 lg:w-8 text-muted-foreground hover:text-emerald-400" onClick={ctx.refresh} title="Refresh">
                            <RefreshCw className={cn('h-3.5 w-3.5 lg:h-4 lg:w-4', ctx.rowsLoading && 'animate-spin')} />
                        </Button>
                    </div>
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <TabsContent value="open" className="mt-0 flex-1 flex flex-col overflow-hidden data-[state=inactive]:hidden">
                            {open.length === 0
                                ? <Empty title={`No ${what} in progress`} hint={hint} />
                                : <div className="flex-1 overflow-y-auto green-scroll">{open.map(row)}</div>}
                        </TabsContent>
                        <TabsContent value="history" className="mt-0 flex-1 flex flex-col overflow-hidden data-[state=inactive]:hidden">
                            {history.length === 0
                                ? <Empty title={`No ${what} yet`} hint={hint} />
                                : <div className="flex-1 overflow-y-auto green-scroll">{history.map(row)}</div>}
                        </TabsContent>
                    </div>
                </Tabs>
            </CardContent>
        </Card>
    );
}

/**
 * The trade page's history slot. With nothing of ours to show it renders its children (the existing order
 * history) and nothing else. Once the wallet has swap-server records, or the card's pair is one of ours, two
 * pills let the user switch, and the panel follows the pair by itself.
 */
export function TradeHistorySlot({ children }: { children: ReactNode }) {
    const ctx = useSwapServerOptional();
    const activate = ctx?.activate;
    useEffect(() => { activate?.(); }, [activate]);
    if (!ctx || (ctx.rows.length === 0 && !ctx.pairRouted && !ctx.operation)) return <>{children}</>;
    const ours = ctx.historyOurs;
    const label = ctx.isMainnet ? 'Solana' : 'Bridge';
    const pill = (active: boolean) => cn(
        'px-3 py-1 rounded-full text-xs font-semibold border transition-colors',
        active ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-white/[0.03] text-white/60 border-white/[0.06] hover:text-white hover:bg-white/[0.06]',
    );
    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 px-1">
                <button type="button" className={pill(!ours)} onClick={() => ctx.setHistoryView('orders')}>Orders</button>
                <button type="button" className={pill(ours)} onClick={() => ctx.setHistoryView('swap-server')}>
                    {label}{ctx.openCount > 0 ? ` (${ctx.openCount})` : ''}
                </button>
            </div>
            {ours ? <SwapServerHistory /> : children}
        </div>
    );
}
