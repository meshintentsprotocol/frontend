/**
 * OrdersHub — the one Orders & History board.
 *
 * Swaps, limit orders, TWAP orders and bridges in a single list, split into what is
 * still open and what is over, narrowed by kind and sorted. It replaces the four
 * boards there used to be (the limit history, the TWAP queue, the bridge history and
 * the wallet's two order tabs), and is shown in three places:
 *
 *   the header's history icon   in a popup (components/bch-swap/OrdersPopup)
 *   the swap page               docked beside the card, when that setting is on
 *   the wallet panel            its Orders tab (variant="embedded")
 */

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ArrowDownWideNarrow, RefreshCw } from 'lucide-react';
import { useBCHSwapOptional } from '@/context/BCHSwapContext';
import { useSwapServerOptional } from '@/swap-server/context';
import { secondsLeft } from '@/swap-server/steps';
import { EmptyState } from '@/components/common/EmptyState';
import { Pager, usePagination } from '@/components/common/Pager';
import { walletUi } from '@/lib/walletUi';
import { cn } from '@/lib/utils';
import { OrderRow } from './OrderRow';
import { useOrders } from './useOrders';
import { countByKind, filterOrders, sortOrders, type OrderFilter, type OrderItem, type OrderSort } from './model';

const FILTERS: { value: OrderFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'swap', label: 'Swaps' },
    { value: 'limit', label: 'Limit' },
    { value: 'twap', label: 'TWAP' },
    { value: 'bridge', label: 'Bridge' },
];

const SORTS: { value: OrderSort; label: string }[] = [
    { value: 'newest', label: 'Newest first' },
    { value: 'oldest', label: 'Oldest first' },
    { value: 'status', label: 'Needs attention first' },
    { value: 'pair', label: 'By pair' },
];

const EMPTY_HINT: Record<OrderFilter, string> = {
    all: 'Swap, place a limit or TWAP order, or bridge USDC to see it here.',
    swap: 'Make a swap to see it here.',
    limit: 'Place a limit order to see it here.',
    twap: 'Place a TWAP order to see its slices here.',
    bridge: 'Send USDC from one chain to another to see it here.',
};

type Tab = 'open' | 'history';

export function OrdersHub({ variant = 'board', filter: wanted, className, style }: {
    variant?: 'board' | 'embedded';
    /** The kind to show; the board follows it when it changes (the swap card's Swap / Limit / TWAP tabs). */
    filter?: OrderFilter | null;
    className?: string;
    style?: CSSProperties;
}) {
    const embedded = variant === 'embedded';
    const { items, refresh, loading, twapError } = useOrders();
    const swap = useBCHSwapOptional();
    const server = useSwapServerOptional();

    const [tab, setTab] = useState<Tab>('open');
    const [filter, setFilter] = useState<OrderFilter>(wanted ?? 'all');
    const [sort, setSort] = useState<OrderSort>('newest');
    const [busyId, setBusyId] = useState<string | null>(null);
    useEffect(() => { if (wanted) setFilter(wanted); }, [wanted]);

    const open = useMemo(() => items.filter(i => i.open), [items]);
    const history = useMemo(() => items.filter(i => !i.open), [items]);
    const inTab = tab === 'open' ? open : history;
    const counts = useMemo(() => countByKind(inTab), [inTab]);
    const shown = useMemo(() => sortOrders(filterOrders(inTab, filter), sort), [inTab, filter, sort]);
    const { page, pageCount, setPage, pageItems } = usePagination(shown, embedded ? 6 : 8, `${tab}:${filter}:${sort}`);

    // One clock for every timer in the list, running only while something is counting.
    const [now, setNow] = useState(() => Date.now());
    const counting = open.some(i => i.bch || i.server?.phase === 'awaiting_signature');
    useEffect(() => {
        if (!counting) return;
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, [counting]);

    // Safety net only — live updates come over the relayer WebSocket.
    const refreshBch = swap?.refreshOrders;
    useEffect(() => {
        void refreshBch?.();
        const t = setInterval(() => { void refreshBch?.(); }, 60_000);
        return () => clearInterval(t);
    }, [refreshBch]);

    const run = (id: string, work?: (id: string) => Promise<void>) => async () => {
        if (!work) return;
        setBusyId(id);
        try { await work(id); } finally { setBusyId(null); }
    };

    const openItem = (item: OrderItem) => {
        if (item.source === 'server') server?.showDialog(item.id, item.server!.kind);
        else walletUi.openOrder({ source: item.source, id: item.id });
    };

    const serverBusy = !!server?.signing;
    const tabButton = (value: Tab, label: string, count: number) => (
        <button
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
                'relative py-3 text-sm font-semibold transition-colors',
                tab === value ? 'text-white' : 'text-white/40 hover:text-white/75',
            )}
        >
            {label} <span className="tabular-nums text-white/45">({count})</span>
            {tab === value && <span className="absolute inset-x-0 bottom-[-1px] h-[2px] rounded-full bg-emerald-400" />}
        </button>
    );

    return (
        <section
            aria-label="Orders and history"
            data-orders-hub={variant}
            className={cn('flex min-h-0 flex-col', embedded ? 'flex-1' : 'lg-panel overflow-hidden rounded-3xl', className)}
            style={style}
        >
            {/* ── open / history, sort, refresh ── */}
            <div className={cn('flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.07]', embedded ? 'mx-3' : 'px-4')}>
                <div role="tablist" aria-label="Orders" className="flex gap-5">
                    {tabButton('open', 'Open', open.length)}
                    {tabButton('history', 'History', history.length)}
                </div>
                <div className="flex items-center gap-1">
                    <label className="relative flex items-center">
                        <ArrowDownWideNarrow className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-white/45" />
                        <span className="sr-only">Sort orders</span>
                        {/* A native select on purpose: a portalled menu would count as a click outside the wallet popup. */}
                        <select
                            value={sort}
                            onChange={e => setSort(e.target.value as OrderSort)}
                            className="h-8 max-w-[150px] cursor-pointer appearance-none rounded-lg bg-transparent pl-7 pr-2 text-[11px] font-semibold text-white/70 outline-none transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:bg-white/[0.06]"
                        >
                            {SORTS.map(s => <option key={s.value} value={s.value} className="bg-[#111] text-white">{s.label}</option>)}
                        </select>
                    </label>
                    <button type="button" onClick={refresh} title="Refresh" aria-label="Refresh orders"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-white/[0.06] hover:text-emerald-400">
                        <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                    </button>
                </div>
            </div>

            {/* ── kind ── */}
            <div role="tablist" aria-label="Order kind" className={cn('flex shrink-0 gap-1.5 overflow-x-auto py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', embedded ? 'px-3' : 'px-4')}>
                {FILTERS.map(f => (
                    <button
                        key={f.value}
                        type="button"
                        role="tab"
                        aria-selected={filter === f.value}
                        onClick={() => setFilter(f.value)}
                        className={cn(
                            'flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold transition-colors',
                            filter === f.value
                                ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                                : 'border-white/[0.07] bg-white/[0.03] text-white/55 hover:bg-white/[0.07] hover:text-white',
                        )}
                    >
                        {f.label}
                        <span className={cn('tabular-nums', filter === f.value ? 'text-emerald-300/70' : 'text-white/35')}>{counts[f.value]}</span>
                    </button>
                ))}
            </div>

            {/* ── the list ── */}
            {shown.length === 0 ? (
                <EmptyState
                    size={embedded ? 'sm' : 'md'}
                    title={tab === 'open' ? 'Nothing open' : 'No history yet'}
                    hint={twapError && filter === 'twap' ? `TWAP orders could not be read (${twapError}).` : EMPTY_HINT[filter]}
                />
            ) : (
                <div className="min-h-0 flex-1 overflow-y-auto lg-scroll" data-orders-list>
                    {pageItems.map(item => (
                        <OrderRow
                            key={item.key}
                            item={item}
                            compact={embedded}
                            nowSec={Math.floor(now / 1000)}
                            busyId={busyId ?? (serverBusy && item.source === 'server' ? item.id : null)}
                            secondsLeft={item.server && server ? secondsLeft(item.server, server.rowsReceivedAt, now) : undefined}
                            onOpen={openItem}
                            onClaim={swap ? id => void run(id, swap.claimOrder)() : undefined}
                            onCancel={swap ? id => void run(id, swap.cancelSameChainOrder)() : undefined}
                            onRefund={swap ? id => void run(id, swap.requestRefund)() : undefined}
                            onSign={server ? id => void server.resume(id) : undefined}
                            onPayFee={server ? id => void server.sendFee(id) : undefined}
                        />
                    ))}
                </div>
            )}
            <Pager page={page} pageCount={pageCount} onPage={setPage} className="shrink-0 border-t border-white/[0.07] py-2" />
        </section>
    );
}
