import { useEffect, useState, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { OrderStatusBadge } from './OrderStatusBadge';
import { ExternalLink, Clock, XCircle, BoxSelect, RefreshCw, Zap, ArrowRight, ChevronLeft, ChevronRight, RotateCcw, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBCHSwap } from '@/context/BCHSwapContext';
import { BCHOrder, Token } from '@/types';

const ITEMS_PER_PAGE = 8;

// ============================================================================
// Chain icon mapping
// ============================================================================
const CHAIN_ICONS: Record<string, string> = {
    bch: '/logos/bitcoin-cash-bch-logo.svg',
    solana: '/assets/solanaLogo.png',
    movement: 'https://raw.githubusercontent.com/kitelabs-io/mvmt-tokens/main/logos/MOVE.png',
    eth: '/logos/ethereum-eth-logo.svg',
};

function getChainIcon(chain?: string): string | null {
    if (!chain) return null;
    return CHAIN_ICONS[chain] || null;
}

function getChainFromSwapType(swapType: string, side: 'sell' | 'buy'): string | null {
    const map: Record<string, [string, string]> = {
        'same-chain': ['bch', 'bch'],
        'bch-to-sol': ['bch', 'solana'],
        'sol-to-bch': ['solana', 'bch'],
        'bch-to-mov': ['bch', 'movement'],
        'mov-to-bch': ['movement', 'bch'],
        'eth-to-bch': ['eth', 'bch'],
        'bch-to-eth': ['bch', 'eth'],
    };
    const pair = map[swapType];
    return pair ? pair[side === 'sell' ? 0 : 1] : null;
}

// ============================================================================
// Helpers
// ============================================================================
function formatTime(ts: number) {
    const d = new Date(ts);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function shortenTx(tx?: string) {
    if (!tx) return '';
    return `${tx.slice(0, 8)}…${tx.slice(-6)}`;
}

/** Shared renderer — see OrderStatusBadge.tsx. Was a 10-case switch that called
 *  `expired` a final state and had no case for `abandoned`. */
function statusBadge(status: BCHOrder['status']) {
    return <OrderStatusBadge status={status} className="text-xs lg:text-xs" />;
}

function swapTypeBadge(order: BCHOrder) {
    if (order.swapType === 'same-chain') return null;
    const labels: Record<string, string> = {
        'bch-to-sol': 'BCH → SOL',
        'sol-to-bch': 'SOL → BCH',
        'bch-to-mov': 'BCH → MOVE',
        'mov-to-bch': 'MOVE → BCH',
        'eth-to-bch': 'ETH → BCH',
        'bch-to-eth': 'BCH → ETH',
    };
    const label = labels[order.swapType] || order.swapType;
    const isMove = order.swapType.includes('mov');
    const isEth = order.swapType.includes('eth');
    return (
        <Badge variant="secondary" className={`text-xs lg:text-xs px-1.5 py-0 ${isMove ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : isEth ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-violet-500/10 text-violet-400 border-violet-500/20'}`}>
            {label}
        </Badge>
    );
}

// ============================================================================
// Token icon with chain badge — larger on desktop
// ============================================================================
function TokenIcon({ token, chain }: { token?: Token; chain?: string | null }) {
    const iconUrl = token?.icon;
    const chainIcon = chain ? getChainIcon(chain) : null;
    const fallback = token?.symbol?.[0] || '?';

    return (
        <div className="relative flex-shrink-0">
            <div className="h-7 w-7 lg:h-8 lg:w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                {iconUrl ? (
                    <img src={iconUrl} alt={token?.symbol} className="h-5 w-5 lg:h-5.5 lg:w-5.5 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : null}
                {!iconUrl && <span className="text-[10px] lg:text-xs font-bold text-muted-foreground">{fallback}</span>}
            </div>
            {chainIcon && (
                <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 lg:h-4 lg:w-4 rounded-full bg-[#0A0A0A] border border-white/10 flex items-center justify-center overflow-hidden">
                    <img src={chainIcon} alt={chain || ''} className="h-2 w-2 lg:h-2.5 lg:w-2.5 object-contain" />
                </div>
            )}
        </div>
    );
}

// ============================================================================
// Elapsed / countdown timer for open orders
// ============================================================================
function formatDuration(seconds: number): string {
    if (seconds <= 0) return '0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

// BCH's Median-Time-Past lags real wall-clock time by ~2h, and the covenant's
// cancel() requires tx.time >= expiryTime — so the trustless auto-refund the
// bot broadcasts on the maker's behalf can't actually go out until MTP catches
// up to expiryTime, even though real-world expiry already passed.
// See cashtoken-relayer/docs/unfilled-orders.md §2.
const MTP_LAG_SECONDS = 7200;

function ElapsedTimer({ order }: { order: BCHOrder }) {
    const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

    useEffect(() => {
        const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
        return () => clearInterval(t);
    }, []);

    const createdSec = Math.floor(order.createdAt / 1000);

    // Limit order: countdown to expiry, then countdown to the auto-refund
    // (the relayer broadcasts cancel() on its own once MTP catches up).
    if (order.orderType === 'limit' && order.expiryTime) {
        const remaining = order.expiryTime - now;
        if (remaining > 0) {
            return (
                <span className="flex items-center gap-0.5 text-xs tabular-nums text-amber-400/80">
                    <Timer className="h-2.5 w-2.5 flex-shrink-0" />
                    expires in {formatDuration(remaining)}
                </span>
            );
        }
        const refundEta = order.expiryTime + MTP_LAG_SECONDS - now;
        if (refundEta > 0) {
            return (
                <span className="flex items-center gap-0.5 text-xs tabular-nums text-red-400" title="BCH's median-time-past lags real time by ~2h — the trustless refund can't broadcast until MTP catches up to your order's expiry">
                    <Timer className="h-2.5 w-2.5 flex-shrink-0" />
                    refund in ~{formatDuration(refundEta)}
                </span>
            );
        }
        return (
            <span className="flex items-center gap-0.5 text-xs tabular-nums text-red-400 animate-pulse">
                <Timer className="h-2.5 w-2.5 flex-shrink-0" />
                refunding…
            </span>
        );
    }

    // Dutch auction: show elapsed / total duration progress
    if (order.orderType === 'market' && order.duration) {
        const elapsed = Math.min(now - createdSec, order.duration);
        const remaining = order.duration - elapsed;
        const pct = Math.min(100, Math.round((elapsed / order.duration) * 100));
        const isEnding = remaining <= 60;
        return (
            <span className={`flex items-center gap-0.5 text-xs tabular-nums ${isEnding ? 'text-orange-400' : 'text-muted-foreground'}`}>
                <Timer className="h-2.5 w-2.5 flex-shrink-0" />
                {formatDuration(elapsed)} / {formatDuration(order.duration)}
                <span className="text-[10px] opacity-60">({pct}%)</span>
            </span>
        );
    }

    // Fallback: show elapsed since creation
    const elapsed = now - createdSec;
    return (
        <span className="flex items-center gap-0.5 text-xs text-muted-foreground tabular-nums">
            <Clock className="h-2.5 w-2.5 flex-shrink-0" />
            {formatDuration(elapsed)} elapsed
        </span>
    );
}

/** Human phrasing for the relayer's skip categories. */
const SKIP_REASON_LABEL: Record<string, string> = {
    unprofitable_spread:  'Waiting for a better price',
    slippage_too_high:    'Pool too thin right now',
    insufficient_capital: 'Waiting on solver liquidity',
    no_pool:              'No liquidity pool for this token',
    quote_error:          'Could not price this route',
    other:                'Waiting for a solver',
};

function formatWhen(unixSec: number): string {
    return new Date(unixSec * 1000).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

/**
 * Detail the relayer already reports and nothing used to display.
 *
 * `fillableUntil` matters because it is NOT the expiry the maker chose. The
 * covenant compares against `tx.locktime`, which is MTP-shifted by ~2h, so a "1H"
 * limit order is really fillable for ~3h on-chain. Showing only the chosen expiry
 * made that a surprise. `lastSkipReason` answers "why hasn't this filled yet?",
 * which previously showed as a bare "pending".
 */
function OrderDetail({ order }: { order: BCHOrder }) {
    const isOpen = order.status === 'pending' || order.status === 'failed';
    const skip = order.lastSkipCategory ? SKIP_REASON_LABEL[order.lastSkipCategory] : undefined;

    const rows: Array<{ label: string; value: string; title?: string }> = [];
    if (isOpen && order.fillableUntil) {
        rows.push({
            label: 'Fillable until',
            value: formatWhen(order.fillableUntil),
            title: 'The covenant keeps accepting fills until this time — later than the expiry you chose, because the chain compares against median-time-past.',
        });
    }
    if (isOpen && order.refundableFrom) {
        rows.push({
            label: 'Refundable from',
            value: formatWhen(order.refundableFrom),
            title: 'If it never fills, your funds can be reclaimed from this time.',
        });
    }

    if (!rows.length && !skip) return null;

    return (
        <div className="mt-1 flex flex-col gap-0.5">
            {skip && isOpen && (
                <span className="text-[11px] text-amber-400/80" title={order.lastSkipReason}>
                    {skip}
                </span>
            )}
            {rows.map(r => (
                <span key={r.label} className="text-[11px] text-muted-foreground/70" title={r.title}>
                    {r.label}: <span className="tabular-nums">{r.value}</span>
                </span>
            ))}
        </div>
    );
}

// ============================================================================
// Order Row — responsive sizing for large screens
// ============================================================================
function OrderRow({ order, onClaim, isClaiming, onRefund, isRefunding, onCancel, isCancelling }: {
    order: BCHOrder;
    onClaim?: (id: string) => void;
    isClaiming?: boolean;
    onRefund?: (id: string) => void;
    isRefunding?: boolean;
    onCancel?: (id: string) => void;
    isCancelling?: boolean;
}) {
    const sourceExplorerUrl = order.explorerUrl
        || (order.txid ? `https://chipnet.chaingraph.cash/tx/${order.txid}` : undefined)
        || (order.contractAddress ? `https://chipnet.chaingraph.cash/address/${order.contractAddress}` : undefined);

    const refundExplorerUrl = order.status === 'refunded'
        ? (order.destExplorerUrl
            || (order.fillTxid && order.swapType === 'sol-to-bch'
                ? `https://explorer.solana.com/tx/${order.fillTxid}?cluster=devnet`
                : order.fillTxid
                    ? `https://chipnet.chaingraph.cash/tx/${order.fillTxid}`
                    : undefined))
        : undefined;

    const destExplorerUrl = refundExplorerUrl || (order.destExplorerUrl
        || (order.fillTxid && order.swapType === 'bch-to-sol'
            ? `https://explorer.solana.com/tx/${order.fillTxid}?cluster=devnet`
            : order.fillTxid && order.swapType === 'bch-to-mov'
                ? `https://explorer.movementnetwork.xyz/txn/${order.fillTxid}?network=testnet`
                : order.fillTxid && order.swapType === 'bch-to-eth'
                    ? `https://sepolia.etherscan.io/tx/${order.fillTxid}`
                    : order.fillTxid && order.swapType === 'eth-to-bch'
                        ? `https://chipnet.imaginary.cash/tx/${order.fillTxid}`
                        : order.fillTxid
                            ? `https://chipnet.chaingraph.cash/tx/${order.fillTxid}`
                            : undefined));

    const sellChain = getChainFromSwapType(order.swapType, 'sell') || order.sellToken?.chain;
    const buyChain = getChainFromSwapType(order.swapType, 'buy') || order.buyToken?.chain;

    return (
        <div className="flex items-center justify-between py-3 lg:py-3.5 px-3 lg:px-4 border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] transition-colors">
            <div className="flex items-center gap-2.5 lg:gap-3 flex-1 min-w-0">
                {/* Token pair icons */}
                <div className="flex items-center -space-x-2 flex-shrink-0">
                    <TokenIcon token={order.sellToken} chain={sellChain} />
                    <TokenIcon token={order.buyToken} chain={buyChain} />
                </div>

                <div className="min-w-0">
                    <div className="flex items-center gap-1.5 lg:gap-2 mb-0.5 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">
                            {order.sellAmount} {order.sellToken?.symbol || '?'}
                        </span>
                        <ArrowRight className="h-3 w-3 lg:h-3.5 lg:w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm font-semibold text-foreground">
                            {Number(order.buyAmount).toFixed(4)} {order.buyToken?.symbol || '?'}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="secondary" className="text-[10px] lg:text-xs px-1 lg:px-1.5 py-0 h-3.5 lg:h-4">
                            {order.orderType === 'limit' ? 'Limit' : 'Market'}
                        </Badge>
                        {swapTypeBadge(order)}
                        {statusBadge(order.status)}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs lg:text-sm text-muted-foreground">
                            {formatTime(order.createdAt)}
                        </span>
                        {order.status === 'pending' && (
                            <ElapsedTimer order={order} />
                        )}
                    </div>
                    <OrderDetail order={order} />
                </div>
            </div>

            <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                {order.status === 'claimable' && onClaim && order.claimData?.secret && (
                    <Button
                        size="sm"
                        variant="default"
                        className="h-7 lg:h-8 gap-1 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-xs lg:text-xs font-medium shadow-lg shadow-blue-500/25 animate-pulse"
                        onClick={() => onClaim(order.id)}
                        disabled={isClaiming}
                    >
                        <Zap className="h-3 w-3 lg:h-3.5 lg:w-3.5" />
                        {isClaiming ? '...' : 'Claim'}
                    </Button>
                )}

                {order.swapType === 'same-chain' && order.orderType === 'limit' && order.status === 'pending' && onCancel && (
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-7 lg:h-8 gap-1 border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 text-xs font-medium"
                        onClick={() => onCancel(order.id)}
                        disabled={isCancelling}
                        title="Cancel this order now and reclaim your funds — no need to wait for expiry"
                    >
                        <XCircle className={`h-3 w-3 lg:h-3.5 lg:w-3.5 ${isCancelling ? 'animate-spin' : ''}`} />
                        {isCancelling ? '...' : 'Cancel'}
                    </Button>
                )}

                {order.status === 'failed' && onRefund && (order.swapType === 'bch-to-sol' || order.swapType === 'sol-to-bch') && (
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-7 lg:h-8 gap-1 border-orange-500/50 text-orange-400 hover:bg-orange-500/10 hover:text-orange-300 text-xs font-medium"
                        onClick={() => onRefund(order.id)}
                        disabled={isRefunding}
                        title="Recover your locked funds after the timelock expires"
                    >
                        <RotateCcw className={`h-3 w-3 lg:h-3.5 lg:w-3.5 ${isRefunding ? 'animate-spin' : ''}`} />
                        {isRefunding ? '...' : 'Refund'}
                    </Button>
                )}

                {order.status === 'refunded' && refundExplorerUrl && (
                    <a
                        href={refundExplorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 lg:p-1.5 rounded-md hover:bg-white/[0.06] text-orange-400/70 hover:text-orange-400 transition-colors"
                        title="View refund transaction"
                    >
                        <ExternalLink className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                    </a>
                )}

                {sourceExplorerUrl && order.status !== 'filled' && order.status !== 'claimed' && order.status !== 'refunded' && (
                    <a
                        href={sourceExplorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 lg:p-1.5 rounded-md hover:bg-white/[0.06] text-muted-foreground hover:text-emerald-400 transition-colors"
                        title="View on Explorer"
                    >
                        <ExternalLink className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                    </a>
                )}

                {(order.status === 'filled' || order.status === 'claimed') && (sourceExplorerUrl || destExplorerUrl) && (
                    <div className="flex items-center gap-2">
                        {sourceExplorerUrl && (
                            <a href={sourceExplorerUrl} target="_blank" rel="noopener noreferrer"
                                className="text-xs lg:text-sm text-muted-foreground hover:text-emerald-400 transition-colors flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/[0.04]">
                                Source <ExternalLink className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                            </a>
                        )}
                        {destExplorerUrl && (
                            <a href={destExplorerUrl} target="_blank" rel="noopener noreferrer"
                                className="text-xs lg:text-sm text-muted-foreground hover:text-emerald-400 transition-colors flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/[0.04]">
                                Dest <ExternalLink className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                            </a>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ============================================================================
// Pagination Component
// ============================================================================
function Pagination({ current, total, onChange }: { current: number; total: number; onChange: (page: number) => void }) {
    if (total <= 1) return null;

    const pages: (number | '...')[] = [];
    if (total <= 5) {
        for (let i = 1; i <= total; i++) pages.push(i);
    } else {
        pages.push(1);
        if (current > 3) pages.push('...');
        for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
        if (current < total - 2) pages.push('...');
        pages.push(total);
    }

    return (
        <div className="flex items-center justify-center gap-1 py-2.5 px-3 border-t border-white/[0.06] bg-card/50 backdrop-blur-sm">
            <Button
                variant="ghost" size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-emerald-400 disabled:opacity-30"
                disabled={current === 1}
                onClick={() => onChange(current - 1)}
            >
                <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            {pages.map((p, i) =>
                p === '...' ? (
                    <span key={`dots-${i}`} className="text-xs text-muted-foreground px-1">…</span>
                ) : (
                    <button
                        key={p}
                        onClick={() => onChange(p)}
                        className={`h-7 min-w-[28px] rounded-md text-sm font-medium transition-colors ${p === current
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]'
                            }`}
                    >
                        {p}
                    </button>
                )
            )}
            <Button
                variant="ghost" size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-emerald-400 disabled:opacity-30"
                disabled={current === total}
                onClick={() => onChange(current + 1)}
            >
                <ChevronRight className="h-3.5 w-3.5" />
            </Button>
        </div>
    );
}

// ============================================================================
// Empty State
// ============================================================================
function EmptyState({ message }: { message: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-10 text-center flex-1">
            <div className="relative opacity-30 mb-3">
                <BoxSelect className="h-16 w-16 lg:h-20 lg:w-20 text-muted-foreground" strokeWidth={0.5} />
            </div>
            <h3 className="text-sm lg:text-base font-semibold text-foreground mb-1">{message}</h3>
            <p className="text-xs text-muted-foreground">
                Create a limit order or market swap to get started.
            </p>
        </div>
    );
}

// ============================================================================
// Green-themed scrollbar styles (inline)
// ============================================================================
const greenScrollStyle: React.CSSProperties = {};
const greenScrollCSS = `
.green-scroll::-webkit-scrollbar { width: 6px; }
.green-scroll::-webkit-scrollbar-track { background: transparent; }
.green-scroll::-webkit-scrollbar-thumb { background: rgba(16, 185, 129, 0.3); border-radius: 3px; }
.green-scroll::-webkit-scrollbar-thumb:hover { background: rgba(16, 185, 129, 0.5); }
.green-scroll { scrollbar-width: thin; scrollbar-color: rgba(16, 185, 129, 0.3) transparent; }
`;

// ============================================================================
// Main Component
// ============================================================================
export function LimitOrderHistory() {
    const { pendingOrders, completedOrders, refreshOrders, claimOrder, requestRefund, cancelSameChainOrder, isLoading } = useBCHSwap();
    const [refundingId, setRefundingId] = useState<string | null>(null);
    const [cancellingId, setCancellingId] = useState<string | null>(null);

    const handleRefund = async (orderId: string) => {
        setRefundingId(orderId);
        try { await requestRefund(orderId); } finally { setRefundingId(null); }
    };
    const handleCancel = async (orderId: string) => {
        setCancellingId(orderId);
        try { await cancelSameChainOrder(orderId); } finally { setCancellingId(null); }
    };
    const [openPage, setOpenPage] = useState(1);
    const [historyPage, setHistoryPage] = useState(1);

    useEffect(() => {
        refreshOrders();
        // Safety net only — live updates come over the relayer WebSocket.
        const interval = setInterval(() => { refreshOrders(); }, 60000);
        return () => clearInterval(interval);
    }, [refreshOrders]);

    const openCount = pendingOrders.length;
    const claimableCount = pendingOrders.filter(o => o.status === 'claimable').length;
    const historyCount = completedOrders.length;

    // Sort and paginate open orders
    const sortedOpen = [...pendingOrders].sort((a, b) => {
        if (a.status === 'claimable' && b.status !== 'claimable') return -1;
        if (a.status !== 'claimable' && b.status === 'claimable') return 1;
        return b.createdAt - a.createdAt;
    });
    const openTotalPages = Math.max(1, Math.ceil(sortedOpen.length / ITEMS_PER_PAGE));
    const pagedOpen = sortedOpen.slice((openPage - 1) * ITEMS_PER_PAGE, openPage * ITEMS_PER_PAGE);

    const sortedHistory = [...completedOrders].sort((a, b) => b.createdAt - a.createdAt);
    const historyTotalPages = Math.max(1, Math.ceil(sortedHistory.length / ITEMS_PER_PAGE));
    const pagedHistory = sortedHistory.slice((historyPage - 1) * ITEMS_PER_PAGE, historyPage * ITEMS_PER_PAGE);

    return (
        <>
            <style>{greenScrollCSS}</style>
            <Card className="w-full rounded-3xl border border-muted/50 bg-card/80 backdrop-blur-sm shadow-lg overflow-hidden flex flex-col" style={{ height: 'var(--swap-card-height, auto)', minHeight: '480px' }}>
                <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
                    <Tabs defaultValue="open" className="w-full h-full flex flex-col">
                        {/* Tab header — compact, no extra top padding */}
                        <div className="border-b border-white/[0.06] px-4 flex items-center justify-between">
                            <TabsList className="bg-transparent gap-6 h-auto p-0 justify-start">
                                <TabsTrigger
                                    value="open"
                                    className="px-0 py-2.5 border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none text-muted-foreground hover:text-foreground text-sm font-semibold"
                                >
                                    Orders ({openCount})
                                    {claimableCount > 0 && (
                                        <span className="ml-1.5 inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold animate-pulse">
                                            {claimableCount}
                                        </span>
                                    )}
                                </TabsTrigger>
                                <TabsTrigger
                                    value="history"
                                    className="px-0 py-2.5 border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none text-muted-foreground hover:text-foreground text-sm font-semibold"
                                >
                                    History ({historyCount})
                                </TabsTrigger>
                            </TabsList>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 lg:h-8 lg:w-8 text-muted-foreground hover:text-emerald-400"
                                onClick={() => refreshOrders()}
                                disabled={isLoading}
                            >
                                <RefreshCw className={`h-3.5 w-3.5 lg:h-4 lg:w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>

                        {/* Scrollable content area */}
                        <div className="flex-1 flex flex-col overflow-hidden">
                            <TabsContent value="open" className="mt-0 flex-1 flex flex-col overflow-hidden data-[state=inactive]:hidden">
                                {openCount === 0 ? (
                                    <EmptyState message="No open orders" />
                                ) : (
                                    <>
                                        <div className="flex-1 overflow-y-auto green-scroll">
                                            {pagedOpen.map(order => (
                                                <OrderRow
                                                    key={order.id}
                                                    order={order}
                                                    onClaim={claimOrder}
                                                    isClaiming={isLoading && refundingId !== order.id}
                                                    onRefund={handleRefund}
                                                    isRefunding={refundingId === order.id}
                                                    onCancel={handleCancel}
                                                    isCancelling={cancellingId === order.id}
                                                />
                                            ))}
                                        </div>
                                        <Pagination current={openPage} total={openTotalPages} onChange={setOpenPage} />
                                    </>
                                )}
                            </TabsContent>

                            <TabsContent value="history" className="mt-0 flex-1 flex flex-col overflow-hidden data-[state=inactive]:hidden">
                                {historyCount === 0 ? (
                                    <EmptyState message="No order history" />
                                ) : (
                                    <>
                                        <div className="flex-1 overflow-y-auto green-scroll">
                                            {pagedHistory.map(order => (
                                                <OrderRow
                                                    key={order.id}
                                                    order={order}
                                                    onRefund={handleRefund}
                                                    isRefunding={refundingId === order.id}
                                                />
                                            ))}
                                        </div>
                                        <Pagination current={historyPage} total={historyTotalPages} onChange={setHistoryPage} />
                                    </>
                                )}
                            </TabsContent>
                        </div>
                    </Tabs>
                </CardContent>
            </Card>
        </>
    );
}
