import { useEffect, useState } from 'react';
import { useBCHSwap } from '@/context/BCHSwapContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { statusMeta } from '@/lib/orderStatus';
import { Button } from '@/components/ui/button';
import { Clock, XCircle, ExternalLink, RefreshCw, ArrowRight, RotateCcw, Zap } from 'lucide-react';
import { BCHOrder } from '@/types';

// ============================================================================
// BCH Order Tracker — Shows pending and completed BCH swap orders
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
    // Shared status metadata — see OrderStatusBadge.tsx.
    const config = statusMeta(order.status);
    const timeAgo = getTimeAgo(order.createdAt);

    const swapTypeBadge: Record<string, React.ReactNode> = {
        'same-chain': <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Same Chain</Badge>,
        'bch-to-sol': <Badge variant="outline" className="text-[10px] bg-gradient-to-r from-emerald-500/10 to-purple-500/10 text-blue-400 border-blue-500/20">BCH → SOL</Badge>,
        'sol-to-bch': <Badge variant="outline" className="text-[10px] bg-gradient-to-r from-purple-500/10 to-emerald-500/10 text-blue-400 border-blue-500/20">SOL → BCH</Badge>,
        'bch-to-mov': <Badge variant="outline" className="text-[10px] bg-gradient-to-r from-emerald-500/10 to-yellow-500/10 text-yellow-400 border-yellow-500/20">BCH → MOVE</Badge>,
        'mov-to-bch': <Badge variant="outline" className="text-[10px] bg-gradient-to-r from-yellow-500/10 to-emerald-500/10 text-yellow-400 border-yellow-500/20">MOVE → BCH</Badge>,
        'eth-to-bch': <Badge variant="outline" className="text-[10px] bg-gradient-to-r from-blue-500/10 to-emerald-500/10 text-blue-400 border-blue-500/20">ETH → BCH</Badge>,
        'bch-to-eth': <Badge variant="outline" className="text-[10px] bg-gradient-to-r from-emerald-500/10 to-blue-500/10 text-blue-400 border-blue-500/20">BCH → ETH</Badge>,
    };

    return (
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
                {config.icon}
                <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium">
                        <span>{order.sellAmount} {order.sellToken?.symbol || '?'}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span>{Number(order.buyAmount).toFixed(4)} {order.buyToken?.symbol || '?'}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {swapTypeBadge[order.swapType]}
                        <span className="text-[10px] text-muted-foreground">{timeAgo}</span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Badge variant="outline" title={config.hint} className={cn("text-[10px]", config.cls)}>{config.label}</Badge>
                {(order.status === 'claimable' || (order.claimData?.secret && (order.status === 'pending' || order.status === 'proving' || (order.status === 'claimed' && order.destExplorerUrl?.includes('relayer-claim-submitted'))))) && onClaim && (
                    <Button
                        size="sm"
                        variant="default"
                        className="h-6 px-2.5 text-[10px] gap-1 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-semibold shadow-md shadow-blue-500/20 animate-pulse"
                        onClick={() => onClaim(order.id)}
                        disabled={isClaiming}
                        title="Claim your tokens on the destination chain"
                    >
                        <Zap className={`h-3 w-3 ${isClaiming ? 'animate-spin' : ''}`} />
                        {isClaiming ? 'Claiming...' : 'Claim'}
                    </Button>
                )}
                {order.swapType === 'same-chain' && order.orderType === 'limit' && order.status === 'pending' && onCancel && (
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-[10px] gap-1 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        onClick={() => onCancel(order.id)}
                        disabled={isCancelling}
                        title="Cancel this order now and reclaim your funds — no need to wait for expiry"
                    >
                        <XCircle className={`h-3 w-3 ${isCancelling ? 'animate-spin' : ''}`} />
                        {isCancelling ? '...' : 'Cancel'}
                    </Button>
                )}
                {(order.status === 'failed' || order.status === 'expired' || (order.status === 'pending' && order.expiryTime && Date.now() / 1000 > order.expiryTime)) && onRefund && (order.swapType === 'bch-to-sol' || order.swapType === 'sol-to-bch' || order.swapType === 'bch-to-eth' || order.swapType === 'eth-to-bch') && (
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-[10px] gap-1 text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                        onClick={() => onRefund(order.id)}
                        disabled={isRefunding}
                        title="Recover locked funds after timelock expires"
                    >
                        <RotateCcw className={`h-3 w-3 ${isRefunding ? 'animate-spin' : ''}`} />
                        {isRefunding ? '...' : 'Refund'}
                    </Button>
                )}
                {/* Transaction Finality Links */}
                {order.txLinks && order.txLinks.length > 0 ? (
                    <div className="flex items-center gap-1.5">
                        {order.txLinks.map((link, idx) => (
                            <a
                                key={idx}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-emerald-400 bg-muted/40 px-1.5 py-0.5 rounded transition-colors"
                                title={link.title}
                            >
                                <span>{link.title || `Tx ${idx + 1}`}</span>
                                <ExternalLink className="h-3 w-3" />
                            </a>
                        ))}
                    </div>
                ) : (() => {
                    const explorerHref = (order.status === 'refunded' || order.status === 'failed')
                        ? (order.destExplorerUrl
                            || (order.fillTxid && order.swapType === 'sol-to-bch'
                                ? `https://explorer.solana.com/tx/${order.fillTxid}?cluster=devnet`
                                : order.fillTxid
                                    ? `https://chipnet.chaingraph.cash/tx/${order.fillTxid}`
                                    : undefined)
                            || order.explorerUrl)
                        : (order.explorerUrl
                            || (order.txid ? `https://chipnet.chaingraph.cash/tx/${order.txid}` : undefined));
                    return explorerHref ? (
                        <a
                            href={explorerHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                            title={order.status === 'refunded' ? 'View refund transaction' : 'View transaction'}
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                    ) : null;
                })()}
            </div>
        </div>
    );
}

function getTimeAgo(timestamp: number): string {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
}

export function BCHOrderTracker() {
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

    // Poll faster (8s) when any pending order is an active cross-chain swap
    const hasActiveZK = pendingOrders.some(o =>
        ['eth-to-bch', 'bch-to-eth', 'bch-to-sol', 'sol-to-bch'].includes(o.swapType) &&
        ['pending', 'source_locked', 'proving', 'claimable'].includes(o.status)
    );
    useEffect(() => {
        if (pendingOrders.length === 0) return;
        const ms = hasActiveZK ? 5000 : 30000;
        const interval = setInterval(refreshOrders, ms);
        return () => clearInterval(interval);
    }, [pendingOrders.length, hasActiveZK, refreshOrders]);

    const allOrders = [...pendingOrders, ...completedOrders].slice(0, 10);

    return (
        <Card className="border-muted">
            <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Orders
                        {pendingOrders.length > 0 && (
                            <Badge variant="default" className="text-[10px] h-5 px-1.5">
                                {pendingOrders.length}
                            </Badge>
                        )}
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={refreshOrders}
                        disabled={isLoading}
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {allOrders.length === 0 ? (
                    <div className="text-center py-6 text-sm text-muted-foreground">
                        <p>No orders yet.</p>
                        <p className="text-xs mt-1">Your BCH swap history will appear here.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {allOrders.map(order => (
                            <OrderRow
                                key={order.id}
                                order={order}
                                onClaim={claimOrder}
                                isClaiming={isLoading && refundingId !== order.id && cancellingId !== order.id}
                                onRefund={handleRefund}
                                isRefunding={refundingId === order.id}
                                onCancel={handleCancel}
                                isCancelling={cancellingId === order.id}
                            />
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
