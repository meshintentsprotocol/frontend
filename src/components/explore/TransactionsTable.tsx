import { useEffect, useRef, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChainFilter } from '@/pages/ExplorePage';
import { useSwap } from '@/context/SwapContext';
import { ArrowRight, ChevronLeft, ChevronRight, Clock, ExternalLink, ArrowUpDown } from 'lucide-react';
import { BCHOrder } from '@/types';
import axios from 'axios';

// ============================================================================
// Token & Chain icon maps
// ============================================================================
const CHAIN_ICONS: Record<string, string> = {
    'Bitcoin Cash': '/logos/bitcoin-cash-bch-logo.svg',
    'Solana': '/logos/solana.svg',
    'Movement': '/logos/movement.svg',
};

const TOKEN_ICONS: Record<string, string> = {
    'BCH': '/logos/bitcoin-cash-bch-logo.svg',
    'SOL': '/logos/solana.svg',
    'MOVE': '/logos/movement.svg',
    'USDC': '/logos/usd-coin-usdc-logo.svg',
    'USDT': '/logos/usd-coin-usdc-logo.svg',
    'USDC.e': 'https://raw.githubusercontent.com/kitelabs-io/mvmt-tokens/main/logos/USDC.png',
    'USDT.e': 'https://raw.githubusercontent.com/kitelabs-io/mvmt-tokens/main/logos/USDT.png',
};

interface ExplorerTx {
    id: string;
    timestamp: number;
    sellToken: string;
    sellIcon?: string;
    sellAmount: number;
    buyToken: string;
    buyIcon?: string;
    buyAmount: number;
    usdValue: number;
    wallet: string;
    chain: 'Movement' | 'Solana' | 'Bitcoin Cash';
    txHash?: string;
    explorerUrl?: string;
    type: string;
    status: string;
    network?: 'mainnet' | 'chipnet';
}

const getOrdersKey = (network: string) => `bch_orders_${network}`;
const ITEMS_PER_PAGE = 10;

function getTimeAgo(timestamp: number): string {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
}

function getChainFromSwapType(swapType: string): 'Movement' | 'Solana' | 'Bitcoin Cash' {
    if (swapType.includes('mov')) return 'Movement';
    if (swapType.includes('sol')) return 'Solana';
    return 'Bitcoin Cash';
}

function getExplorerUrl(order: BCHOrder, network: 'mainnet' | 'chipnet'): string | undefined {
    if (order.explorerUrl) return order.explorerUrl;
    const isMainnet = network === 'mainnet';
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

function TxTokenIcon({ symbol, icon }: { symbol: string; icon?: string }) {
    const url = icon || TOKEN_ICONS[symbol];
    return (
        <div className="h-7 w-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
            {url ? (
                <img src={url} alt={symbol} className="h-5 w-5 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
                <span className="text-[9px] font-bold text-muted-foreground">{symbol?.[0] || '?'}</span>
            )}
        </div>
    );
}

function statusColor(status: string): string {
    const s = status.toLowerCase();
    if (s === 'completed' || s === 'claimed' || s === 'filled') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (s === 'pending') return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    if (s === 'claimable') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    if (s === 'failed' || s === 'cancelled') return 'bg-red-500/10 text-red-400 border-red-500/20';
    return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
}

export function TransactionsTable({ activeChain, refreshTrigger }: { activeChain: ChainFilter, refreshTrigger: number }) {
    const { fetchOrderHistory } = useSwap();
    const fetchOrderHistoryRef = useRef(fetchOrderHistory);
    fetchOrderHistoryRef.current = fetchOrderHistory;

    const [transactions, setTransactions] = useState<ExplorerTx[]>([]);
    const [initialLoading, setInitialLoading] = useState(true);
    const [isRefetching, setIsRefetching] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    const crossChainRelayerUrl = import.meta.env.VITE_CROSS_CHAIN_RELAYER_URL || 'https://cross-chain-relayer-production-a93e.up.railway.app';

    useEffect(() => {
        let isMounted = true;
        const loadOrders = async () => {
            setIsRefetching(true);
            const allTxs: ExplorerTx[] = [];

            // 1. Movement swap history
            try {
                const history = await fetchOrderHistoryRef.current();
                if (isMounted) {
                    const moveTxs = history.map((order: any, idx: number): ExplorerTx => {
                        const sellSym = order.sellToken?.symbol || order.sell_token || 'MOVE';
                        const buySym = order.buyToken?.symbol || order.buy_token || 'USDC';
                        const mockUsdPrice = sellSym === 'MOVE' ? 0.8 : sellSym === 'SOL' ? 150 : sellSym === 'BCH' ? 250 : 1;
                        const st = order.status === 'completed' || order.status === 'filled' || order.status === 'FILLED' ? 'Completed' : order.status || 'Pending';
                        return {
                            id: order.id || order.nonce || order.orderId || `move-${sellSym}-${buySym}-${order.createdAt || order.timestamp || Date.now()}-${idx}`,
                            timestamp: order.createdAt || order.timestamp || Date.now(),
                            sellToken: sellSym,
                            sellIcon: order.sellToken?.icon || TOKEN_ICONS[sellSym],
                            sellAmount: Number(order.sellAmount || order.sell_amount) || 0,
                            buyToken: buySym,
                            buyIcon: order.buyToken?.icon || TOKEN_ICONS[buySym],
                            buyAmount: Number(order.buyAmount || order.buy_amount) || 0,
                            usdValue: (Number(order.sellAmount || order.sell_amount) || 0) * mockUsdPrice,
                            wallet: order.maker ? `${order.maker.slice(0, 6)}...${order.maker.slice(-4)}` : 'Unknown',
                            chain: 'Movement',
                            txHash: order.txid || order.fulfillTxId || order.order_hash,
                            explorerUrl: order.order_hash ? `https://explorer.movementlabs.xyz/txn/${order.order_hash}?network=testnet` : undefined,
                            type: 'Intent Swap',
                            status: st,
                        };
                    });
                    allTxs.push(...moveTxs);
                }
            } catch (e) { console.error("Failed to fetch Movement txs", e); }

            // 2. BCH orders from localStorage — both networks
            const bchNetworks: Array<'chipnet' | 'mainnet'> = ['chipnet', 'mainnet'];
            bchNetworks.forEach(net => {
                try {
                    const saved = localStorage.getItem(getOrdersKey(net));
                    if (!saved) return;
                    const bchOrders: BCHOrder[] = JSON.parse(saved);
                    const bchTxs = bchOrders.map((order): ExplorerTx => {
                        const sellSym = order.sellToken?.symbol || '?';
                        const buySym = order.buyToken?.symbol || '?';
                        const mockUsdPrice = sellSym === 'BCH' ? 250 : sellSym === 'SOL' ? 150 : sellSym === 'MOVE' ? 0.8 : 1;
                        const statusMap: Record<string, string> = { pending: 'Pending', filled: 'Completed', claimed: 'Claimed', claimable: 'Claimable', cancelled: 'Failed', expired: 'Expired' };
                        return {
                            id: `${net}_${order.id}`,
                            timestamp: order.createdAt,
                            sellToken: sellSym,
                            sellIcon: order.sellToken?.icon || TOKEN_ICONS[sellSym],
                            sellAmount: order.sellAmount,
                            buyToken: buySym,
                            buyIcon: order.buyToken?.icon || TOKEN_ICONS[buySym],
                            buyAmount: order.buyAmount,
                            usdValue: order.sellAmount * mockUsdPrice,
                            wallet: order.contractAddress ? `${order.contractAddress.slice(0, 10)}...` : 'Local',
                            chain: getChainFromSwapType(order.swapType),
                            txHash: order.txid || order.fillTxid,
                            explorerUrl: getExplorerUrl(order, net),
                            type: order.swapType === 'same-chain' ? 'CashToken' : 'Cross-Chain',
                            status: statusMap[order.status] || order.status,
                            network: net,
                        };
                    });
                    allTxs.push(...bchTxs);
                } catch (e) { console.error(`Failed to load BCH ${net} orders`, e); }
            });

            // 3. Cross-chain relayer orders
            try {
                const res = await axios.get(`${crossChainRelayerUrl}/orders`);
                const { active = [], completed = [] } = res.data;
                const relayerOrders = [...active, ...completed];
                const ccTxs = relayerOrders.map((intent: any): ExplorerTx => {
                    const dir = (intent.direction || '').toLowerCase();
                    const isBchSell = dir.startsWith('bch_');
                    const isSolSell = dir.startsWith('sol_');
                    const isMovSell = dir.startsWith('mov_');

                    const sellSym = isBchSell ? 'BCH' : isSolSell ? 'SOL' : isMovSell ? 'MOVE' : '?';
                    const buySym = dir.endsWith('_bch') ? 'BCH' : dir.endsWith('_sol') ? 'SOL' : dir.endsWith('_mov') ? 'MOVE' : '?';

                    const chain: ExplorerTx['chain'] = isBchSell ? 'Bitcoin Cash' : isSolSell ? 'Solana' : 'Movement';

                    let status = 'Pending';
                    if (intent.status === 'SOURCE_LOCKED') status = 'Locked';
                    else if (intent.status === 'DEST_FILLED') status = 'Filled';
                    else if (intent.status === 'DEST_CLAIMED') status = 'Claimable';
                    else if (intent.status === 'COMPLETED') status = 'Completed';

                    const sourceId = intent.bchContractAddress || intent.solanaEscrowPda || intent.movementEscrowId;
                    let explorerUrl: string | undefined;
                    if (sourceId) {
                        if (isBchSell) explorerUrl = sourceId.startsWith('bchtest:') ? `https://chipnet.chaingraph.cash/address/${sourceId}` : `https://chipnet.chaingraph.cash/tx/${sourceId}`;
                        else if (isSolSell) explorerUrl = `https://explorer.solana.com/tx/${sourceId}?cluster=devnet`;
                        else explorerUrl = `https://explorer.movementnetwork.xyz/txn/${sourceId}?network=testnet`;
                    }

                    const mockUsdPrice = sellSym === 'BCH' ? 250 : sellSym === 'SOL' ? 150 : sellSym === 'MOVE' ? 0.8 : 1;

                    return {
                        id: intent.id,
                        timestamp: intent.createdAt ? intent.createdAt * 1000 : Date.now(),
                        sellToken: sellSym,
                        sellIcon: TOKEN_ICONS[sellSym],
                        sellAmount: Number(intent.sellAmount) / 1e8 || 0,
                        buyToken: buySym,
                        buyIcon: TOKEN_ICONS[buySym],
                        buyAmount: Number(intent.buyAmount) / 1e8 || 0,
                        usdValue: (Number(intent.sellAmount) / 1e8 || 0) * mockUsdPrice,
                        wallet: intent.makerAddress ? `${intent.makerAddress.slice(0, 8)}...` : 'Relayer',
                        chain,
                        txHash: sourceId,
                        explorerUrl,
                        type: 'HTLC Swap',
                        status,
                    };
                });
                allTxs.push(...ccTxs);
            } catch (e) { console.error("Failed to fetch cross-chain orders", e); }

            // Deduplicate by id
            const seen = new Set<string>();
            const deduped = allTxs.filter(tx => {
                if (seen.has(tx.id)) return false;
                seen.add(tx.id);
                return true;
            });

            deduped.sort((a, b) => b.timestamp - a.timestamp);
            if (isMounted) {
                setTransactions(deduped);
                setInitialLoading(false);
                setIsRefetching(false);
            }
        };

        loadOrders();
        return () => { isMounted = false; };
    }, [refreshTrigger]);

    // Apply chain filter
    const filteredTxs = transactions.filter(tx => activeChain === 'All' || tx.chain === activeChain);

    // Pagination
    const totalPages = Math.max(1, Math.ceil(filteredTxs.length / ITEMS_PER_PAGE));
    const clampedPage = Math.min(currentPage, totalPages);
    const paginatedTxs = filteredTxs.slice((clampedPage - 1) * ITEMS_PER_PAGE, clampedPage * ITEMS_PER_PAGE);

    // Page number range
    const getPageNumbers = (): number[] => {
        const pages: number[] = [];
        const start = Math.max(1, clampedPage - 2);
        const end = Math.min(totalPages, clampedPage + 2);
        for (let i = start; i <= end; i++) pages.push(i);
        return pages;
    };

    const showSkeleton = initialLoading && transactions.length === 0;

    return (
        <div className="rounded-xl border border-white/[0.08] bg-black/40 backdrop-blur-md overflow-hidden relative">
            {isRefetching && !initialLoading && (
                <div className="absolute top-0 left-0 right-0 h-0.5 overflow-hidden z-10">
                    <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent animate-loading-bar" />
                </div>
            )}
            <>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-white/[0.02] border-b border-white/[0.06]">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="text-muted-foreground text-xs font-semibold w-[90px] pl-4">Time</TableHead>
                                    <TableHead className="text-muted-foreground text-xs font-semibold">Type</TableHead>
                                    <TableHead className="text-muted-foreground text-xs font-semibold">
                                        <div className="flex items-center gap-1">Token Pair <ArrowUpDown className="h-3 w-3" /></div>
                                    </TableHead>
                                    <TableHead className="text-muted-foreground text-xs font-semibold text-right">USD Value</TableHead>
                                    <TableHead className="text-muted-foreground text-xs font-semibold text-right">Sold</TableHead>
                                    <TableHead className="text-muted-foreground text-xs font-semibold text-right">Received</TableHead>
                                    <TableHead className="text-muted-foreground text-xs font-semibold">Chain</TableHead>
                                    <TableHead className="text-muted-foreground text-xs font-semibold">Status</TableHead>
                                    <TableHead className="text-muted-foreground text-xs font-semibold text-right w-[50px] pr-4">Tx</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {showSkeleton ? (
                                    Array.from({ length: 6 }).map((_, i) => (
                                        <TableRow key={`skeleton-${i}`} className="border-white/[0.06]">
                                            {Array.from({ length: 9 }).map((__, j) => (
                                                <TableCell key={j} className={cn(j === 0 && "pl-4", j === 8 && "pr-4 text-right")}>
                                                    <div className={cn("h-4 bg-white/[0.04] rounded animate-pulse", j === 8 ? "w-4 ml-auto" : j === 2 ? "w-32" : "w-16", (j === 3 || j === 4 || j === 5) && "ml-auto")} />
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))
                                ) : paginatedTxs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                                            <Clock className="h-6 w-6 mx-auto mb-2 opacity-50" />
                                            No transactions found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedTxs.map((tx) => (
                                        <TableRow key={tx.id} className="hover:bg-white/[0.02] border-white/[0.06] transition-colors group">
                                            {/* Time */}
                                            <TableCell className="text-muted-foreground text-sm font-medium pl-4">
                                                {getTimeAgo(tx.timestamp)}
                                            </TableCell>

                                            {/* Type */}
                                            <TableCell>
                                                <Badge variant="outline" className={cn("text-[10px] py-0 border-white/10 font-medium", tx.type === 'HTLC Swap' ? 'text-purple-400' : tx.type === 'CashToken' ? 'text-emerald-400' : 'text-blue-400')}>
                                                    {tx.type}
                                                </Badge>
                                            </TableCell>

                                            {/* Token Pair — Uniswap style */}
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center -space-x-2">
                                                        <TxTokenIcon symbol={tx.sellToken} icon={tx.sellIcon} />
                                                        <TxTokenIcon symbol={tx.buyToken} icon={tx.buyIcon} />
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-sm font-bold text-foreground">{tx.sellToken}</span>
                                                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                                        <span className="text-sm font-bold text-emerald-400">{tx.buyToken}</span>
                                                    </div>
                                                </div>
                                            </TableCell>

                                            {/* USD Value */}
                                            <TableCell className="text-right font-medium text-emerald-400">
                                                ${tx.usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </TableCell>

                                            {/* Sold */}
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <span className="font-semibold text-red-400/80">{tx.sellAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
                                                    <span className="text-xs text-muted-foreground">{tx.sellToken}</span>
                                                </div>
                                            </TableCell>

                                            {/* Received */}
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <span className="font-semibold text-emerald-400/80">{tx.buyAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
                                                    <span className="text-xs text-muted-foreground">{tx.buyToken}</span>
                                                </div>
                                            </TableCell>

                                            {/* Chain */}
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-1.5">
                                                        {CHAIN_ICONS[tx.chain] && (
                                                            <img src={CHAIN_ICONS[tx.chain]} alt={tx.chain} className="h-4 w-4 rounded-full object-contain" />
                                                        )}
                                                        <span className="text-xs text-muted-foreground">
                                                            {tx.chain === 'Bitcoin Cash' ? 'BCH' : tx.chain}
                                                        </span>
                                                    </div>
                                                    {tx.network && (
                                                        <span className={cn(
                                                            "text-[9px] font-semibold px-1.5 py-0.5 rounded-full border w-fit",
                                                            tx.network === 'mainnet'
                                                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                                : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                                                        )}>
                                                            {tx.network === 'mainnet' ? 'Mainnet' : 'Testnet'}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>

                                            {/* Status */}
                                            <TableCell>
                                                <Badge variant="outline" className={cn("text-[10px] py-0", statusColor(tx.status))}>
                                                    {tx.status}
                                                </Badge>
                                            </TableCell>

                                            {/* Explorer Link */}
                                            <TableCell className="text-right pr-4">
                                                {(tx.explorerUrl || tx.txHash) && (
                                                    <a
                                                        href={tx.explorerUrl || (
                                                            tx.network === 'mainnet'
                                                                ? `https://blockchair.com/bitcoin-cash/transaction/${tx.txHash}`
                                                                : `https://chipnet.chaingraph.cash/tx/${tx.txHash}`
                                                        )}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-muted-foreground hover:text-emerald-400 transition-colors"
                                                    >
                                                        <ExternalLink className="h-4 w-4" />
                                                    </a>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {!showSkeleton && totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
                            <div className="text-xs text-muted-foreground">
                                Showing {(clampedPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(clampedPage * ITEMS_PER_PAGE, filteredTxs.length)} of {filteredTxs.length}
                            </div>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                    disabled={clampedPage <= 1}
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                {getPageNumbers().map(n => (
                                    <Button
                                        key={n}
                                        variant={n === clampedPage ? "default" : "ghost"}
                                        size="icon"
                                        className={cn("h-8 w-8 text-xs", n === clampedPage ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30" : "text-muted-foreground hover:text-foreground")}
                                        onClick={() => setCurrentPage(n)}
                                    >
                                        {n}
                                    </Button>
                                ))}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                    disabled={clampedPage >= totalPages}
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </>
        </div>
    );
}
