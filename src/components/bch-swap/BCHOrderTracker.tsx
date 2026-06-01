import { useEffect, useState } from 'react';
import { useBCHSwap } from '@/context/BCHSwapContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle2, XCircle, ExternalLink, RefreshCw, ArrowRight, Loader2, RotateCcw, AlertTriangle } from 'lucide-react';
import { BCHOrder } from '@/types';

// ============================================================================
// BCH Order Tracker — Shows pending and completed BCH swap orders
// ============================================================================

function OrderRow({ order, onRefund, isRefunding }: { order: BCHOrder; onRefund?: (id: string) => void; isRefunding?: boolean }) {
    const statusConfig: Record<string, { icon: React.ReactNode; badge: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
        pending: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin text-yellow-400" />, badge: 'default', label: 'Pending' },
        claimable: { icon: <CheckCircle2 className="h-3.5 w-3.5 text-blue-400 animate-pulse" />, badge: 'default', label: 'Claim Ready' },
        claimed: { icon: <CheckCircle2 className="h-3.5 w-3.5 text-teal-400" />, badge: 'secondary', label: 'Claimed' },
        filled: { icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />, badge: 'secondary', label: 'Filled' },
        cancelled: { icon: <XCircle className="h-3.5 w-3.5 text-red-400" />, badge: 'destructive', label: 'Cancelled' },
        expired: { icon: <Clock className="h-3.5 w-3.5 text-muted-foreground" />, badge: 'outline', label: 'Expired' },
        refunded: { icon: <RotateCcw className="h-3.5 w-3.5 text-orange-400" />, badge: 'outline', label: 'Refunded' },
        failed: { icon: <AlertTriangle className="h-3.5 w-3.5 text-red-400" />, badge: 'destructive', label: 'Failed' },
    };

    const config = statusConfig[order.status] || statusConfig.pending;
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
                    <div className="flex items-center gap-2 mt-0.5">
                        {swapTypeBadge[order.swapType]}
                        <span className="text-[10px] text-muted-foreground">{timeAgo}</span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Badge variant={config.badge} className="text-[10px]">{config.label}</Badge>
                {order.status === 'failed' && onRefund && (order.swapType === 'bch-to-sol' || order.swapType === 'sol-to-bch') && (
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
                {(() => {
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
    const { pendingOrders, completedOrders, refreshOrders, requestRefund, isLoading } = useBCHSwap();
    const [refundingId, setRefundingId] = useState<string | null>(null);

    const handleRefund = async (orderId: string) => {
        setRefundingId(orderId);
        try { await requestRefund(orderId); } finally { setRefundingId(null); }
    };

    // Auto-poll for order status updates every 30s when there are pending orders
    useEffect(() => {
        if (pendingOrders.length === 0) return;
        const interval = setInterval(refreshOrders, 30000);
        return () => clearInterval(interval);
    }, [pendingOrders.length, refreshOrders]);

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
                                onRefund={handleRefund}
                                isRefunding={refundingId === order.id}
                            />
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
