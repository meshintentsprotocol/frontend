import { useEffect } from 'react';
import { useBCHSwapOptional } from '@/context/BCHSwapContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, ExternalLink, RefreshCw, ArrowRight } from 'lucide-react';
import { BCHOrder } from '@/types';
import { cn } from '@/lib/utils';
import { statusMeta } from '@/lib/orderStatus';

// ============================================================================
// Wallet Orders Tab — Reuses BCHOrderTracker logic in popup layout
// Uses useBCHSwapOptional to safely handle pages without BCHSwapProvider
// ============================================================================

function getTimeAgo(timestamp: number): string {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
}

function OrderRow({ order, onClaim, isClaiming }: { order: BCHOrder; onClaim?: (id: string) => void; isClaiming?: boolean }) {
    // Shared status metadata — see OrderStatusBadge.tsx.
    const config = statusMeta(order.status);
    const swapLabels: Record<string, string> = {
        'same-chain': 'Same Chain',
        'bch-to-sol': 'BCH → SOL',
        'sol-to-bch': 'SOL → BCH',
        'bch-to-mov': 'BCH → MOVE',
        'mov-to-bch': 'MOVE → BCH',
        'eth-to-bch': 'ETH → BCH',
        'bch-to-eth': 'BCH → ETH',
    };

    const sellIcon = order.sellToken?.icon;
    const buyIcon = order.buyToken?.icon;

    return (
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
            <div className="flex items-center gap-2.5 min-w-0">
                {/* Token pair icons */}
                <div className="flex items-center -space-x-1 flex-shrink-0">
                    <div className="h-5 w-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden z-[1]">
                        {sellIcon ? (
                            <img src={sellIcon} alt={order.sellToken?.symbol} className="h-3.5 w-3.5 object-contain" />
                        ) : (
                            <span className="text-[7px] font-bold text-muted-foreground">{order.sellToken?.symbol?.[0] || '?'}</span>
                        )}
                    </div>
                    <div className="h-5 w-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                        {buyIcon ? (
                            <img src={buyIcon} alt={order.buyToken?.symbol} className="h-3.5 w-3.5 object-contain" />
                        ) : (
                            <span className="text-[7px] font-bold text-muted-foreground">{order.buyToken?.symbol?.[0] || '?'}</span>
                        )}
                    </div>
                </div>
                {config.icon}
                <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-medium">
                        <span>{order.sellAmount} {order.sellToken?.symbol || '?'}</span>
                        <ArrowRight className="h-2.5 w-2.5 text-muted-foreground flex-shrink-0" />
                        <span>{Number(order.buyAmount).toFixed(4)} {order.buyToken?.symbol || '?'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[9px] text-muted-foreground">{swapLabels[order.swapType]}</span>
                        <span className="text-[9px] text-muted-foreground">• {getTimeAgo(order.createdAt)}</span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
                <Badge variant="outline" title={config.hint} className={cn('text-[9px] h-4 px-1.5', config.cls)}>{config.label}</Badge>
                {(order.status === 'claimable' || (order.claimData?.secret && (order.status === 'pending' || order.status === 'proving' || (order.status === 'claimed' && order.destExplorerUrl?.includes('relayer-claim-submitted'))))) && onClaim && (
                    <Button
                        size="sm"
                        variant="default"
                        className="h-5 px-2 text-[9px] gap-1 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-semibold shadow-sm animate-pulse"
                        onClick={() => onClaim(order.id)}
                        disabled={isClaiming}
                    >
                        {isClaiming ? '...' : 'Claim'}
                    </Button>
                )}
                {(() => {
                    // Refunded orders: point at the refund tx (lives on destExplorerUrl/fillTxid), not the funding tx.
                    const explorerHref = order.status === 'refunded'
                        ? (order.destExplorerUrl
                            || (order.fillTxid ? `https://chipnet.chaingraph.cash/tx/${order.fillTxid}` : undefined)
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
                            <ExternalLink className="h-3 w-3" />
                        </a>
                    ) : null;
                })()}
            </div>
        </div>
    );
}

export function WalletOrdersTab() {
    const swapCtx = useBCHSwapOptional();

    const pendingOrders = swapCtx?.pendingOrders || [];
    const completedOrders = swapCtx?.completedOrders || [];
    const refreshOrders = swapCtx?.refreshOrders || (() => Promise.resolve());
    const claimOrder = swapCtx?.claimOrder;
    const isLoading = swapCtx?.isLoading || false;

    useEffect(() => {
        if (pendingOrders.length === 0) return;
        // Safety net only — live updates come over the relayer WebSocket.
        const interval = setInterval(refreshOrders, 60000);
        return () => clearInterval(interval);
    }, [pendingOrders.length, refreshOrders]);

    const allOrders = [...pendingOrders, ...completedOrders].slice(0, 15);

    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between px-1 py-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    {pendingOrders.length > 0 ? `${pendingOrders.length} Active` : 'Orders'}
                </span>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                    onClick={() => refreshOrders()}
                    disabled={isLoading}
                >
                    <RefreshCw className={`h-3 w-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {allOrders.length === 0 ? (
                <div className="text-center py-10">
                    <Clock className="h-8 w-8 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">No orders yet</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {swapCtx ? 'Your swap orders will appear here' : 'Navigate to BCH Swap to create orders'}
                    </p>
                </div>
            ) : (
                <div className="space-y-1">
                    {allOrders.map(order => (
                        <OrderRow key={order.id} order={order} onClaim={claimOrder} isClaiming={isLoading} />
                    ))}
                </div>
            )}
        </div>
    );
}
