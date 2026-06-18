import { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownLeft, RefreshCw, Navigation, Globe, Copy, Check, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/coingecko';
import { ActivityService } from '@/lib/activity';
import { BCHOrder } from '@/types';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

const getOrdersKey = (network: string) => `bch_orders_${network}`;

const TOKEN_ICONS: Record<string, string> = {
    'BCH': '/logos/bitcoin-cash-bch-logo.svg',
    'SOL': '/assets/solanaLogo.png',
    'MOVE': 'https://raw.githubusercontent.com/kitelabs-io/mvmt-tokens/main/logos/MOVE.png',
    'USDC': '/logos/usd-coin-usdc-logo.svg',
    'USDT': '/logos/usd-coin-usdc-logo.svg',
};

interface MergedActivity {
    id: string;
    type: 'send' | 'receive' | 'swap' | 'bridge';
    title: string;
    subtitle: string;
    valueUsd: number;
    timestamp: number;
    explorerUrl?: string;
    sellIcon?: string;
    buyIcon?: string;
    network?: 'mainnet' | 'chipnet';
    // Extra detail for popup
    status?: BCHOrder['status'];
    txid?: string;
    fillTxid?: string;
    intentId?: string;
    contractAddress?: string;
    destExplorerUrl?: string;
    expiryTime?: number;
    swapType?: string;
    direction?: string;
    sellSymbol?: string;
    buySymbol?: string;
    sellAmount?: number;
    buyAmount?: number;
}

function getExplorerUrl(order: BCHOrder, network: 'mainnet' | 'chipnet'): string | undefined {
    const isMainnet = network === 'mainnet';
    // Refunded orders: the polling code stores the refund tx on destExplorerUrl / fillTxid.
    // Prefer that so the link goes to the refund transaction, not the original funding tx.
    if (order.status === 'refunded') {
        if (order.destExplorerUrl) return order.destExplorerUrl;
        if (order.fillTxid) {
            return isMainnet
                ? `https://blockchair.com/bitcoin-cash/transaction/${order.fillTxid}`
                : `https://chipnet.chaingraph.cash/tx/${order.fillTxid}`;
        }
    }
    if (order.explorerUrl) return order.explorerUrl;
    if (order.txid) {
        if (order.swapType.includes('sol')) {
            return isMainnet
                ? `https://explorer.solana.com/tx/${order.txid}`
                : `https://explorer.solana.com/tx/${order.txid}?cluster=devnet`;
        }
        if (order.swapType.includes('mov')) {
            return isMainnet
                ? `https://explorer.movementlabs.xyz/txn/${order.txid}?network=mainnet`
                : `https://explorer.movementnetwork.xyz/txn/${order.txid}?network=testnet`;
        }
        return isMainnet
            ? `https://blockchair.com/bitcoin-cash/transaction/${order.txid}`
            : `https://chipnet.chaingraph.cash/tx/${order.txid}`;
    }
    if (order.contractAddress) {
        return isMainnet
            ? `https://blockchair.com/bitcoin-cash/address/${order.contractAddress}`
            : `https://chipnet.chaingraph.cash/address/${order.contractAddress}`;
    }
    return undefined;
}

// ── Transaction detail popup ─────────────────────────────────────────────────

function CopyableHash({ label, value }: { label: string; value: string }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };
    return (
        <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-white/35 font-medium">{label}</span>
            <div className="flex items-center gap-1.5 font-mono text-xs text-white/70">
                <span className="truncate">{value.slice(0, 16)}…{value.slice(-8)}</span>
                <button onClick={copy} className="flex-shrink-0 text-white/30 hover:text-white/70 transition-colors">
                    {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                </button>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status?: BCHOrder['status'] }) {
    if (!status) return null;
    const map: Record<BCHOrder['status'], { label: string; cls: string }> = {
        pending:   { label: 'Pending',   cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20' },
        source_locked: { label: 'Source Locked', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
        proving:   { label: 'Proving',   cls: 'bg-purple-500/15 text-purple-400 border-purple-500/20' },
        claimable: { label: 'Claimable', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
        claimed:   { label: 'Claimed',   cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
        filled:    { label: 'Filled',    cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
        cancelled: { label: 'Cancelled', cls: 'bg-red-500/15 text-red-400 border-red-500/20' },
        expired:   { label: 'Expired',   cls: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20' },
        refunded:  { label: 'Refunded',  cls: 'bg-orange-500/15 text-orange-400 border-orange-500/20' },
        failed:    { label: 'Failed',    cls: 'bg-red-500/15 text-red-400 border-red-500/20' },
    };
    const { label, cls } = map[status];
    return (
        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', cls)}>{label}</span>
    );
}

function TxDetailDialog({ tx, onClose }: { tx: MergedActivity; onClose: () => void }) {
    const typeColors: Record<string, string> = {
        receive: 'text-emerald-400',
        send:    'text-orange-400',
        swap:    'text-blue-400',
        bridge:  'text-purple-400',
    };

    const formatTs = (ts: number) =>
        new Date(ts).toLocaleString(undefined, {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
        });

    return (
        <DialogContent className="max-w-sm p-0 overflow-hidden bg-[#0a0a0a]/98 backdrop-blur-2xl border-white/10 rounded-2xl shadow-2xl shadow-black/80">
            <DialogTitle className="sr-only">Transaction details</DialogTitle>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-2.5">
                    <div className={cn(
                        'h-9 w-9 rounded-full flex items-center justify-center',
                        tx.type === 'receive' ? 'bg-emerald-500/10' :
                        tx.type === 'swap'    ? 'bg-blue-500/10' :
                        tx.type === 'send'    ? 'bg-orange-500/10' :
                                               'bg-purple-500/10'
                    )}>
                        {tx.type === 'receive' && <ArrowDownLeft className="h-4 w-4 text-emerald-400" />}
                        {tx.type === 'send'    && <Navigation className="h-4 w-4 text-orange-400 -rotate-90" />}
                        {tx.type === 'swap'    && <RefreshCw className="h-4 w-4 text-blue-400" />}
                        {tx.type === 'bridge'  && <Globe className="h-4 w-4 text-purple-400" />}
                    </div>
                    <div>
                        <p className={cn('text-sm font-semibold capitalize', typeColors[tx.type])}>
                            {tx.type === 'bridge' ? 'Cross-chain Swap' : tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                        </p>
                        <p className="text-[10px] text-white/35">{formatTs(tx.timestamp)}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {tx.network && (
                        <span className={cn(
                            'text-[10px] font-semibold px-1.5 py-0.5 rounded-full border',
                            tx.network === 'mainnet'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                        )}>
                            {tx.network === 'mainnet' ? 'Mainnet' : 'Testnet'}
                        </span>
                    )}
                    <StatusBadge status={tx.status} />
                </div>
            </div>

            {/* Swap amounts */}
            {(tx.type === 'swap' || tx.type === 'bridge') && tx.sellSymbol && tx.buySymbol && (
                <div className="px-5 py-4 border-b border-white/[0.06]">
                    <div className="flex items-center justify-between">
                        {/* Sell side */}
                        <div className="flex items-center gap-2">
                            {tx.sellIcon && <img src={tx.sellIcon} className="h-8 w-8 rounded-full bg-white/[0.04]" />}
                            <div>
                                <p className="text-xs text-white/35 uppercase tracking-wide">Sold</p>
                                <p className="text-base font-bold text-white">{tx.sellAmount ?? '—'} <span className="text-white/60 font-medium text-sm">{tx.sellSymbol}</span></p>
                            </div>
                        </div>
                        <ArrowUpRight className="h-4 w-4 text-white/20 flex-shrink-0" />
                        {/* Buy side */}
                        <div className="flex items-center gap-2 text-right">
                            <div>
                                <p className="text-xs text-white/35 uppercase tracking-wide">Received</p>
                                <p className="text-base font-bold text-emerald-400">{tx.buyAmount != null ? tx.buyAmount.toFixed(4) : '—'} <span className="text-emerald-400/60 font-medium text-sm">{tx.buySymbol}</span></p>
                            </div>
                            {tx.buyIcon && <img src={tx.buyIcon} className="h-8 w-8 rounded-full bg-white/[0.04]" />}
                        </div>
                    </div>
                    {tx.valueUsd > 0 && (
                        <p className="text-[11px] text-white/30 text-center mt-2">≈ {formatCurrency(tx.valueUsd)}</p>
                    )}
                </div>
            )}

            {/* Meta fields */}
            <div className="px-5 py-4 space-y-3 border-b border-white/[0.06]">
                {tx.direction && (
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] uppercase tracking-wider text-white/35 font-medium">Direction</span>
                        <span className="text-xs text-white/70 font-mono">{tx.direction.replace(/_/g, ' → ')}</span>
                    </div>
                )}
                {tx.swapType && (
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] uppercase tracking-wider text-white/35 font-medium">Swap Type</span>
                        <span className="text-xs text-white/70">{tx.swapType}</span>
                    </div>
                )}
                {tx.expiryTime && (
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] uppercase tracking-wider text-white/35 font-medium">Expiry</span>
                        <span className="text-xs text-white/70">{formatTs(tx.expiryTime * 1000)}</span>
                    </div>
                )}
                {tx.txid && <CopyableHash label="Tx ID" value={tx.txid} />}
                {tx.fillTxid && <CopyableHash label="Fill Tx ID" value={tx.fillTxid} />}
                {tx.contractAddress && <CopyableHash label="Contract Address" value={tx.contractAddress} />}
                {tx.intentId && <CopyableHash label="Intent ID" value={tx.intentId} />}
            </div>

            {/* Explorer links */}
            <div className="px-5 py-4 flex gap-2">
                {tx.explorerUrl && (
                    <a
                        href={tx.explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] text-xs font-medium text-white/70 hover:text-white transition-colors"
                    >
                        <ExternalLink className="h-3.5 w-3.5" />
                        {tx.destExplorerUrl ? 'Source Chain' : 'Explorer'}
                    </a>
                )}
                {tx.destExplorerUrl && (
                    <a
                        href={tx.destExplorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] text-xs font-medium text-white/70 hover:text-white transition-colors"
                    >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Dest Chain
                    </a>
                )}
                {!tx.explorerUrl && !tx.destExplorerUrl && (
                    <p className="text-xs text-white/25 text-center w-full py-2">No explorer link available</p>
                )}
            </div>
        </DialogContent>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PortfolioActivity() {
    const [activities, setActivities] = useState<MergedActivity[]>([]);
    const [selected, setSelected] = useState<MergedActivity | null>(null);

    useEffect(() => {
        const loadAll = () => {
            const merged: MergedActivity[] = [];

            // 1. ActivityService records (send/receive)
            try {
                const records = ActivityService.getHistory();
                records.forEach(tx => {
                    merged.push({
                        id: tx.id,
                        type: tx.type,
                        title: tx.type === 'swap' ? `Swapped ${tx.assetIn} for ${tx.assetOut}` :
                            tx.type === 'receive' ? `Received ${tx.asset}` :
                                tx.type === 'send' ? `Sent ${tx.asset}` :
                                    `Bridged ${tx.asset}`,
                        subtitle: tx.type === 'swap' ? `${tx.amountIn} ${tx.assetIn} → ${tx.amountOut} ${tx.assetOut}` : `${tx.amount} ${tx.asset}`,
                        valueUsd: tx.valueUsd,
                        timestamp: tx.timestamp,
                        explorerUrl: tx.explorerUrl,
                    });
                });
            } catch { /* non-fatal */ }

            // 2. BCH swap orders — read both networks so switching network shows all history
            const networksToRead: Array<'chipnet' | 'mainnet'> = ['chipnet', 'mainnet'];
            networksToRead.forEach(net => {
                try {
                    const saved = localStorage.getItem(getOrdersKey(net));
                    if (!saved) return;
                    const bchOrders: BCHOrder[] = JSON.parse(saved);
                    bchOrders.forEach(order => {
                        const sellSym = order.sellToken?.symbol || '?';
                        const buySym = order.buyToken?.symbol || '?';
                        const isCross = order.swapType !== 'same-chain';
                        const mockUsdPrice = sellSym === 'BCH' ? 250 : sellSym === 'SOL' ? 150 : sellSym === 'MOVE' ? 0.8 : 1;
                        const statusLabel = order.status === 'filled' || order.status === 'claimed' ? '✓'
                            : order.status === 'pending' ? '⏳'
                            : order.status === 'claimable' ? '🎯'
                            : order.status === 'refunded' ? '↩'
                            : '';
                        const titlePrefix = order.status === 'refunded'
                            ? `${statusLabel} Refunded`
                            : `${statusLabel} Swapped`;
                        merged.push({
                            id: `bch_${net}_${order.id}`,
                            type: isCross ? 'bridge' : 'swap',
                            title: `${titlePrefix} ${sellSym} for ${buySym}`,
                            subtitle: `${order.sellAmount} ${sellSym} → ${Number(order.buyAmount).toFixed(4)} ${buySym}`,
                            valueUsd: order.sellAmount * mockUsdPrice,
                            timestamp: order.createdAt,
                            explorerUrl: getExplorerUrl(order, net),
                            sellIcon: order.sellToken?.icon || TOKEN_ICONS[sellSym],
                            buyIcon: order.buyToken?.icon || TOKEN_ICONS[buySym],
                            network: net,
                            status: order.status,
                            txid: order.txid,
                            fillTxid: order.fillTxid,
                            intentId: order.intentId,
                            contractAddress: order.contractAddress,
                            destExplorerUrl: order.destExplorerUrl,
                            expiryTime: order.expiryTime,
                            swapType: order.swapType,
                            direction: order.claimData?.direction,
                            sellSymbol: sellSym,
                            buySymbol: buySym,
                            sellAmount: order.sellAmount,
                            buyAmount: Number(order.buyAmount),
                        });
                    });
                } catch { /* non-fatal */ }
            });

            // Sort by time desc and dedupe
            const seen = new Set<string>();
            const deduped = merged.filter(a => {
                if (seen.has(a.id)) return false;
                seen.add(a.id);
                return true;
            });
            deduped.sort((a, b) => b.timestamp - a.timestamp);
            setActivities(deduped);
        };

        loadAll();
        window.addEventListener('activity_history_updated', loadAll);
        // Also poll every 5s for new BCH orders
        const interval = setInterval(loadAll, 5000);
        return () => {
            window.removeEventListener('activity_history_updated', loadAll);
            clearInterval(interval);
        };
    }, []);

    const formatTime = (ts: number) => {
        const date = new Date(ts);
        const now = new Date();
        const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

        if (diffHours < 24) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    if (activities.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground bg-white/[0.02] rounded-2xl border border-white/[0.05]">
                No recent activity. Make your first swap or transfer!
            </div>
        );
    }

    return (
        <div className="w-full">
            <div className="mb-4">
                <h2 className="text-xl font-semibold text-foreground">Recent Activity</h2>
                <p className="text-sm text-muted-foreground mt-1">Swaps, sends, receives, and cross-chain bridges</p>
            </div>

            <div className="flex flex-col gap-2">
                {activities.map((tx) => (
                    <div
                        key={tx.id}
                        onClick={() => setSelected(tx)}
                        className="flex items-center justify-between p-4 rounded-xl transition-colors border border-transparent hover:bg-white/[0.04] hover:border-white/[0.05] cursor-pointer group"
                    >
                        <div className="flex items-center gap-4">
                            <div className={cn(
                                "h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0",
                                tx.type === 'receive' ? "bg-emerald-500/10 text-emerald-500" :
                                    tx.type === 'swap' ? "bg-blue-500/10 text-blue-500" :
                                        tx.type === 'send' ? "bg-orange-500/10 text-orange-500" :
                                            "bg-purple-500/10 text-purple-500"
                            )}>
                                {tx.type === 'receive' && <ArrowDownLeft className="h-5 w-5" />}
                                {tx.type === 'send' && <Navigation className="h-5 w-5 -rotate-90" />}
                                {tx.type === 'swap' && <RefreshCw className="h-5 w-5" />}
                                {tx.type === 'bridge' && <Globe className="h-5 w-5" />}
                            </div>
                            <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    {(tx.type === 'swap' || tx.type === 'bridge') && (tx.sellIcon || tx.buyIcon) && (
                                        <div className="flex -space-x-1.5 mr-1">
                                            {tx.sellIcon && <img src={tx.sellIcon} className="w-4 h-4 rounded-full border border-zinc-800" />}
                                            {tx.buyIcon && <img src={tx.buyIcon} className="w-4 h-4 rounded-full border border-zinc-800" />}
                                        </div>
                                    )}
                                    <span className="font-medium text-foreground">{tx.title}</span>
                                    {tx.network && (
                                        <span className={cn(
                                            "text-[10px] font-semibold px-1.5 py-0.5 rounded-full border",
                                            tx.network === 'mainnet'
                                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                                        )}>
                                            {tx.network === 'mainnet' ? 'Mainnet' : 'Testnet'}
                                        </span>
                                    )}
                                    {tx.status && <StatusBadge status={tx.status} />}
                                </div>
                                <span className="text-xs text-muted-foreground mt-0.5 font-mono">{tx.subtitle}</span>
                            </div>
                        </div>

                        <div className="flex flex-col items-end flex-shrink-0 ml-4">
                            <span className="text-sm font-medium text-foreground">{formatCurrency(tx.valueUsd)}</span>
                            <span className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                {formatTime(tx.timestamp)}
                                <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {activities.length >= 10 && (
                <div className="mt-4 flex justify-center sm:justify-start">
                    <button
                        onClick={() => ActivityService.clearHistory()}
                        className="text-sm text-red-500/80 hover:text-red-500 font-medium transition-colors"
                    >
                        Clear History
                    </button>
                </div>
            )}

            {/* Transaction detail dialog */}
            <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}>
                {selected && <TxDetailDialog tx={selected} onClose={() => setSelected(null)} />}
            </Dialog>
        </div>
    );
}
