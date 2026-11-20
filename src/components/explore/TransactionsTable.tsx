import { useEffect, useRef, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChainFilter } from '@/pages/ExplorePage';
import { ArrowRight, ChevronLeft, ChevronRight, Clock, ExternalLink, ArrowUpDown } from 'lucide-react';
import { BCHOrder } from '@/types';
import axios from 'axios';
import {
    BCH_MESH_SERVER_URL,
    CASHTOKEN_RELAYER_URL,
    CROSS_CHAIN_RELAYER_URL,
} from '@/lib/config';
import { PriceService } from '@/lib/pyth';
import { marketSymbolFor } from '@/lib/marketData';
import { logoForSymbol } from '@/lib/tokenLogos';
import { resolveTokenIconUri } from '@/lib/tokenIcons';
import { BcmrClient } from '@/lib/bcmr';
import { CauldronService } from '@/lib/cauldron';

// ============================================================================
// Token & Chain icon maps
// ============================================================================
const CHAIN_ICONS: Record<string, string> = {
    'Bitcoin Cash': '/logos/bitcoin-cash-bch-logo.svg',
    'Solana': '/logos/solana.svg',
    'Movement': '/logos/movement.svg',
    'EVM': '/logos/ethereum-eth-logo.svg',
    'Monero': '/logos/monero.svg',
};

const iconFor = (symbol: string): string | undefined => logoForSymbol(symbol) ?? undefined;

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
    chain: 'Movement' | 'Solana' | 'Bitcoin Cash' | 'EVM' | 'Monero';
    txHash?: string;
    explorerUrl?: string;
    type: string;
    status: string;
    network?: 'mainnet' | 'chipnet';
}

const getOrdersKey = (network: string) => `bch_orders_${network}`;
const ITEMS_PER_PAGE = 10;

function getTimeAgo(timestamp: number): string {
    const ts = timestamp > 1e12 ? timestamp : timestamp * 1000;
    const diff = Date.now() - ts;
    if (diff < 60000) return `${Math.max(1, Math.floor(diff / 1000))}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
}

interface CashTokenInfo { symbol: string; icon?: string; decimals: number; usd: number }

/**
 * Symbol, decimals, logo and USD price (per whole token) for CashToken categories,
 * resolved like the Tokens tab: BCMR first, then the Cauldron list, then the shared
 * symbol logo map; the identicon fallback comes from resolveTokenIconUri.
 */
async function cashTokenInfo(categories: string[], isMainnet: boolean): Promise<Map<string, CashTokenInfo>> {
    const cats = [...new Set(categories.filter(c => c && c !== '0x' && c.toUpperCase() !== 'BCH').map(c => c.toLowerCase()))];
    const out = new Map<string, CashTokenInfo>();
    if (!cats.length) return out;
    const [bcmr, listed] = await Promise.all([
        BcmrClient.getMany(cats, isMainnet).catch(() => ({} as Record<string, null>)),
        CauldronService.getTopCashTokens(200, isMainnet).catch(() => []),
    ]);
    const byId = new Map(listed.map(t => [t.token_id.toLowerCase(), t]));
    for (const c of cats) {
        const b = bcmr[c] ?? null;
        const l = byId.get(c);
        const m = l ? CauldronService.metadataOf(l, b) : null;
        const symbol = b?.symbol || m?.symbol || `${c.slice(0, 6)}…`;
        out.set(c, {
            symbol,
            decimals: b?.decimals ?? m?.decimals ?? 0,
            icon: resolveTokenIconUri(b?.icon ?? m?.iconRaw ?? logoForSymbol(symbol), c),
            usd: l?.price_now_usd ?? 0,
        });
    }
    return out;
}

/** Server intent status → table label. */
const INTENT_STATUS: Record<string, string> = {
    filled: 'Completed', active: 'Active', awaiting_funding: 'Awaiting funding', underfunded: 'Underfunded',
    scheduled: 'Scheduled', expired: 'Expired', refund_pending: 'Refund pending', refunded: 'Refunded',
    cancelled: 'Cancelled', closed_external: 'Closed',
};

/** USD per unit from the live price map; 0 when the symbol has no live price. */
function getUsdPrice(symbol: string, usd: Record<string, number>): number {
    const market = marketSymbolFor(symbol);
    return market ? usd[market] ?? 0 : 0;
}

function getChainFromSwapType(swapType: string): 'Movement' | 'Solana' | 'Bitcoin Cash' | 'EVM' | 'Monero' {
    const s = swapType.toLowerCase();
    if (s.includes('mov')) return 'Movement';
    if (s.includes('sol')) return 'Solana';
    if (s.includes('eth') || s.includes('bsc') || s.includes('evm') || s.includes('sepolia')) return 'EVM';
    if (s.includes('xmr') || s.includes('monero')) return 'Monero';
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
            : `https://chipnet.imaginary.cash/tx/${order.txid}`;
    }
    if (order.contractAddress) {
        return isMainnet
            ? `https://blockchair.com/bitcoin-cash/address/${order.contractAddress}`
            : `https://chipnet.chaingraph.cash/address/${order.contractAddress}`;
    }
    return undefined;
}

function TxTokenIcon({ symbol, icon }: { symbol: string; icon?: string }) {
    const url = icon || iconFor(symbol);
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
    if (s === 'completed' || s === 'claimed' || s === 'filled' || s === 'active') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (s === 'pending' || s === 'locked' || s === 'awaiting funding' || s === 'scheduled' || s === 'underfunded') return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    if (s === 'claimable') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    if (s === 'refunded' || s === 'refund pending') return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    if (s === 'failed' || s === 'cancelled' || s === 'expired' || s === 'closed') return 'bg-red-500/10 text-red-400 border-red-500/20';
    return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
}

function typeBadgeColor(type: string): string {
    const t = type.toLowerCase();
    if (t.includes('dutch') || t.includes('market')) return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
    if (t.includes('limit')) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    if (t.includes('twap')) return 'text-violet-400 bg-violet-500/10 border-violet-500/20';
    if (t.includes('htlc')) return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
    if (t.includes('cashtoken')) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (t.includes('stark') || t.includes('zk') || t.includes('evm')) return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
    return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
}

export function TransactionsTable({ activeChain, refreshTrigger }: { activeChain: ChainFilter, refreshTrigger: number }) {
    const [transactions, setTransactions] = useState<ExplorerTx[]>([]);
    const [initialLoading, setInitialLoading] = useState(true);
    const [isRefetching, setIsRefetching] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    const meshServerUrl = BCH_MESH_SERVER_URL;
    const crossChainRelayerUrl = CROSS_CHAIN_RELAYER_URL || 'https://cross-chain-relayer-production-a93e.up.railway.app';

    useEffect(() => {
        let isMounted = true;
        const loadOrders = async () => {
            setIsRefetching(true);
            const allTxs: ExplorerTx[] = [];
            const spot = await PriceService.getLatestPrices();
            const usd: Record<string, number> = Object.fromEntries(
                Object.entries(spot).map(([sym, p]) => [sym, PriceService.formatPrice(p)]),
            );

            // 1. BCHMesh intents: limit, Dutch (market) and TWAP slices, CashTokens and BCH
            try {
                const [meshRes, health] = await Promise.all([
                    axios.get(`${meshServerUrl}/intents`, { timeout: 6000 }),
                    axios.get(`${meshServerUrl}/health`, { timeout: 4000 }).catch(() => null),
                ]);
                const { active = [], completed = [] } = meshRes.data || {};
                const meshIntents: any[] = [...active, ...completed];
                const meshNetwork: 'mainnet' | 'chipnet' = health?.data?.network === 'mainnet' ? 'mainnet' : 'chipnet';

                // Amounts are base units; symbols, decimals and logos come from BCMR and the
                // Cauldron list, like the Tokens tab.
                const tokens = await cashTokenInfo(
                    meshIntents.flatMap(i => [i.sellToken, i.buyToken]),
                    meshNetwork === 'mainnet',
                );
                const info = (t?: string) => (!t || t.toUpperCase() === 'BCH' || t === '0x'
                    ? { symbol: 'BCH', icon: iconFor('BCH'), decimals: 8, usd: getUsdPrice('BCH', usd) }
                    : tokens.get(t.toLowerCase()) ?? { symbol: `${t.slice(0, 6)}…`, icon: undefined, decimals: 0, usd: 0 });
                const slicesPerTwap = new Map<string, number>();
                for (const i of meshIntents) if (i.twapOrderId) slicesPerTwap.set(i.twapOrderId, (slicesPerTwap.get(i.twapOrderId) ?? 0) + 1);

                const meshTxs = meshIntents.map((item: any): ExplorerTx => {
                    const sellInfo = info(item.sellToken);
                    const buyInfo = info(item.buyToken);
                    const sellAmount = Number(item.sellAmount ?? 0) / 10 ** sellInfo.decimals;
                    // filled: what the maker actually received; otherwise the order's minimum
                    const got = item.fillSources
                        ? Number(item.fillSources.mesh ?? 0) + Number(item.fillSources.cauldron ?? 0) + Number(item.fillSources.solver ?? 0)
                        : 0;
                    const buyAmount = (item.status === 'filled' && got > 0 ? got : Number(item.minAmountOut ?? item.buyAmount ?? 0)) / 10 ** buyInfo.decimals;

                    const labelType = item.twapOrderId
                        ? `TWAP ${(item.twapSliceIndex ?? 0) + 1}/${slicesPerTwap.get(item.twapOrderId) ?? '?'}`
                        : item.type === 'dutch' ? 'Dutch Market' : 'Limit Order';
                    const usdVal = sellAmount * sellInfo.usd || buyAmount * buyInfo.usd || 0;

                    const txHash = item.fillTxid || item.refundTxid || undefined;
                    const walletStr = item.makerAddress || item.contractAddress || meshNetwork;
                    const displayWallet = walletStr.length > 12 ? `${walletStr.slice(0, 8)}...${walletStr.slice(-4)}` : walletStr;

                    return {
                        id: `mesh_${item.intentId || item.id}`,
                        timestamp: item.createdAt ? (item.createdAt > 1e12 ? item.createdAt : item.createdAt * 1000) : Date.now(),
                        sellToken: sellInfo.symbol,
                        sellIcon: sellInfo.icon,
                        sellAmount,
                        buyToken: buyInfo.symbol,
                        buyIcon: buyInfo.icon,
                        buyAmount,
                        usdValue: usdVal,
                        wallet: displayWallet,
                        chain: 'Bitcoin Cash',
                        txHash,
                        explorerUrl: item.explorerUrl || (item.contractAddress
                            ? (meshNetwork === 'mainnet' ? `https://blockchair.com/bitcoin-cash/address/${item.contractAddress}` : `https://chipnet.imaginary.cash/address/${item.contractAddress}`)
                            : undefined),
                        type: labelType,
                        status: INTENT_STATUS[item.status] ?? item.status ?? 'Active',
                        network: meshNetwork,
                    };
                });
                allTxs.push(...meshTxs);
            } catch (e) {
                console.warn('[TransactionsTable] Failed to fetch BCHMesh intents:', e);
            }

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
                        const usdPrice = getUsdPrice(sellSym, usd);
                        const statusMap: Record<string, string> = { pending: 'Pending', filled: 'Completed', claimed: 'Claimed', claimable: 'Claimable', cancelled: 'Failed', expired: 'Expired' };
                        return {
                            id: `${net}_${order.id}`,
                            timestamp: order.createdAt,
                            sellToken: sellSym,
                            sellIcon: order.sellToken?.icon || iconFor(sellSym),
                            sellAmount: order.sellAmount,
                            buyToken: buySym,
                            buyIcon: order.buyToken?.icon || iconFor(buySym),
                            buyAmount: order.buyAmount,
                            usdValue: order.sellAmount * usdPrice,
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
                } catch (e) { console.warn(`Failed to load BCH ${net} orders`, e); }
            });

            // 4. Cross-chain relayer orders
            try {
                const res = await axios.get(`${crossChainRelayerUrl}/orders`, { timeout: 6000 });
                const { active = [], completed = [] } = res.data || {};
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

                    const usdPrice = getUsdPrice(sellSym, usd);

                    return {
                        id: `cc_${intent.id}`,
                        timestamp: intent.createdAt ? (intent.createdAt > 1e12 ? intent.createdAt : intent.createdAt * 1000) : Date.now(),
                        sellToken: sellSym,
                        sellIcon: iconFor(sellSym),
                        sellAmount: Number(intent.sellAmount) / 1e8 || 0,
                        buyToken: buySym,
                        buyIcon: iconFor(buySym),
                        buyAmount: Number(intent.buyAmount) / 1e8 || 0,
                        usdValue: (Number(intent.sellAmount) / 1e8 || 0) * usdPrice,
                        wallet: intent.makerAddress ? `${intent.makerAddress.slice(0, 8)}...` : 'Relayer',
                        chain,
                        txHash: sourceId,
                        explorerUrl,
                        type: 'HTLC Swap',
                        status,
                    };
                });
                allTxs.push(...ccTxs);
            } catch (e) { console.warn("Failed to fetch cross-chain orders", e); }

            // Deduplicate by txHash or id
            const seen = new Set<string>();
            const deduped = allTxs.filter(tx => {
                const key = tx.txHash || tx.id;
                if (seen.has(key)) return false;
                seen.add(key);
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
    }, [refreshTrigger, meshServerUrl, crossChainRelayerUrl]);

    // Apply chain filter
    const filteredTxs = transactions.filter(tx => {
        if (activeChain === 'All') return true;
        return tx.chain === activeChain;
    });

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
                                            <Badge variant="outline" className={cn("text-[10px] py-0 font-medium", typeBadgeColor(tx.type))}>
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
                                            {tx.usdValue > 0
                                                ? `$${tx.usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                                : <span className="text-muted-foreground">-</span>}
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
                                                            : `https://chipnet.imaginary.cash/tx/${tx.txHash}`
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

