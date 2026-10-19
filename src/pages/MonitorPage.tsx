// OLD — retired 2026-10-19, kept until the clean-up. Not part of the live app. See devrel-agent-context/walletuidocs/connect/old-code.md.
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDistanceToNow, format } from 'date-fns';
import axios from 'axios';
import { TOKENS } from '@/components/intent-swap/forms/TokenSelector';
import { ALL_BCH_SWAP_TOKENS } from '@/components/bch-swap/BCHTokenSelector';
import { useSwap } from '@/context/SwapContext';
import { ArrowRight, ExternalLink, RefreshCw, Layers, Zap, Globe, Clock, CheckCircle2, XCircle, BoxSelect } from 'lucide-react';
import { shortenAddr } from '@/lib/utils';
import { BCHOrder } from '@/types';

// ============================================================================
// Types & Normalization
// ============================================================================

type UnifiedOrderStatus = 'PENDING' | 'LOCKED' | 'DEST_FILLED' | 'CLAIMABLE' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
type OrderCategory = 'ALL' | 'SAME_CHAIN' | 'CROSS_CHAIN' | 'LOCAL';

interface UnifiedOrder {
    id: string;
    source: 'CASHTOKEN' | 'CROSSCHAIN' | 'LOCAL';
    swapType: string;
    orderType: string;
    status: UnifiedOrderStatus;

    makerAddress: string;
    recipientAddress?: string;

    sellToken: any;
    buyToken: any;
    sellAmountRaw: string;
    buyAmountRaw: string;
    sellAmountFormatted: string;
    buyAmountFormatted: string;

    createdAt: number;
    updatedAt: number;
    expiryTime?: number;

    sourceTxId?: string;
    destTxId?: string;
    sourceExplorerUrl?: string;
    destExplorerUrl?: string;

    rawIntent: any;
}

// ============================================================================
// Chain & Token icon constants
// ============================================================================
const CHAIN_ICONS: Record<string, string> = {
    bch: '/logos/bitcoin-cash-bch-logo.svg',
    solana: '/assets/solanaLogo.png',
    movement: 'https://raw.githubusercontent.com/kitelabs-io/mvmt-tokens/main/logos/MOVE.png',
};

const BCH_ORDERS_KEY = 'bch_swap_orders';

export function MonitorPage() {
    const { relayerUrl: cashtokenRelayerUrl } = useSwap();
    const crossChainRelayerUrl = import.meta.env.VITE_CROSS_CHAIN_RELAYER_URL || 'https://cross-chain-relayer-production-a93e.up.railway.app';

    const [orders, setOrders] = useState<UnifiedOrder[]>([]);
    const [health, setHealth] = useState<{ cashtoken?: any; crosschain?: any }>({});
    const [isLoading, setIsLoading] = useState(false);
    const [, setLastUpdated] = useState<Date>(new Date());

    const [activeTab, setActiveTab] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');
    const [categoryFilter, setCategoryFilter] = useState<OrderCategory>('ALL');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');

    // ============================================================================
    // Data Fetching & Normalization
    // ============================================================================

    const fetchAllData = async () => {
        setIsLoading(true);
        try {
            // 1. Fetch Health
            const [healthCT, healthCC] = await Promise.allSettled([
                axios.get(`${cashtokenRelayerUrl}/health`),
                axios.get(`${crossChainRelayerUrl}/health`)
            ]);

            setHealth({
                cashtoken: healthCT.status === 'fulfilled' ? healthCT.value.data : null,
                crosschain: healthCC.status === 'fulfilled' ? healthCC.value.data : null
            });

            // 2. Fetch Orders from relayers
            const [intentsCT, ordersCC] = await Promise.allSettled([
                axios.get(`${cashtokenRelayerUrl}/intents`),
                axios.get(`${crossChainRelayerUrl}/orders`)
            ]);

            let unified: UnifiedOrder[] = [];

            // Process CashToken Orders
            if (intentsCT.status === 'fulfilled' && intentsCT.value.data) {
                const { active = [], completed = [] } = intentsCT.value.data;
                const processCashToken = (intent: any, isCompleted: boolean): UnifiedOrder => {
                    const sToken = findTokenInRegistries(intent.sell_token_type) || { symbol: 'UNK', decimals: 8, icon: '' };
                    const bToken = findTokenInRegistries(intent.buy_token_type) || { symbol: 'UNK', decimals: 8, icon: '' };

                    let status: UnifiedOrderStatus = isCompleted ? (intent.success ? 'COMPLETED' : 'FAILED') : 'PENDING';
                    if (!isCompleted && intent.end_time && (Date.now() / 1000) > intent.end_time) status = 'EXPIRED';

                    return {
                        id: intent.id || `ct_${intent.timestamp}`,
                        source: 'CASHTOKEN',
                        swapType: 'same-chain',
                        orderType: intent.intent_type === 'DUTCH_AUCTION' ? 'market' : 'limit',
                        status,
                        makerAddress: intent.maker_address || 'Unknown',
                        sellToken: sToken,
                        buyToken: bToken,
                        sellAmountRaw: intent.sell_amount,
                        buyAmountRaw: intent.buy_amount || intent.start_buy_amount || '0',
                        sellAmountFormatted: formatTokenAmount(intent.sell_amount, sToken.decimals),
                        buyAmountFormatted: formatTokenAmount(intent.buy_amount || intent.start_buy_amount, bToken.decimals),
                        createdAt: intent.timestamp,
                        updatedAt: intent.timestamp,
                        expiryTime: intent.end_time ? intent.end_time * 1000 : undefined,
                        sourceTxId: intent.hash,
                        sourceExplorerUrl: intent.hash ? `https://chipnet.chaingraph.cash/tx/${intent.hash}` : undefined,
                        rawIntent: intent
                    };
                };

                unified = [
                    ...unified,
                    ...active.map((i: any) => processCashToken(i, false)),
                    ...completed.map((i: any) => processCashToken(i.intent || i, true))
                ];
            }

            // Process CrossChain Orders from relayer
            if (ordersCC.status === 'fulfilled' && ordersCC.value.data) {
                const { active = [], completed = [] } = ordersCC.value.data;
                const processCrossChain = (intent: any, isCompleted: boolean = false): UnifiedOrder => {
                    const sToken = resolveCrossChainToken(intent.direction, 'SELL');
                    const bToken = resolveCrossChainToken(intent.direction, 'BUY');

                    let status: UnifiedOrderStatus = 'PENDING';
                    if (isCompleted) {
                        status = 'COMPLETED';
                    } else if (intent.status === 'SOURCE_LOCKED') status = 'LOCKED';
                    else if (intent.status === 'DEST_FILLED') status = 'DEST_FILLED';
                    else if (intent.status === 'DEST_CLAIMED') status = 'CLAIMABLE';
                    else if (intent.status === 'COMPLETED') status = 'COMPLETED';

                    if (status !== 'COMPLETED' && intent.sourceTimelock && (Date.now() / 1000) > intent.sourceTimelock) {
                        status = 'EXPIRED';
                    }

                    return {
                        id: intent.id,
                        source: 'CROSSCHAIN',
                        swapType: intent.direction?.toLowerCase().replace(/_/g, '-') || 'cross-chain',
                        orderType: 'limit',
                        status,
                        makerAddress: intent.makerAddress || 'Unknown',
                        recipientAddress: intent.recipientAddress,
                        sellToken: sToken,
                        buyToken: bToken,
                        sellAmountRaw: intent.sellAmount,
                        buyAmountRaw: intent.buyAmount,
                        sellAmountFormatted: formatTokenAmount(intent.sellAmount, sToken?.decimals || 8),
                        buyAmountFormatted: formatTokenAmount(intent.buyAmount, bToken?.decimals || 8),
                        createdAt: intent.createdAt ? intent.createdAt * 1000 : Date.now(),
                        updatedAt: intent.updatedAt ? intent.updatedAt * 1000 : Date.now(),
                        expiryTime: intent.sourceTimelock ? intent.sourceTimelock * 1000 : undefined,
                        sourceTxId: intent.bchContractAddress || intent.solanaEscrowPda || intent.movementEscrowId,
                        destTxId: intent.destFillTx || intent.destClaimTx,
                        sourceExplorerUrl: buildExplorerUrl(intent.direction, 'SOURCE', intent),
                        destExplorerUrl: buildExplorerUrl(intent.direction, 'DEST', intent),
                        rawIntent: intent
                    };
                };

                unified = [
                    ...unified,
                    ...active.map((i: any) => processCrossChain(i, false)),
                    ...completed.map((i: any) => processCrossChain(i, true))
                ];
            }

            // 3. Pull local BCH orders from localStorage
            try {
                const saved = localStorage.getItem(BCH_ORDERS_KEY);
                if (saved) {
                    const bchOrders: BCHOrder[] = JSON.parse(saved);
                    const localOrders = bchOrders.map((order): UnifiedOrder => {
                        let status: UnifiedOrderStatus = 'PENDING';
                        if (order.status === 'filled' || order.status === 'claimed') status = 'COMPLETED';
                        else if (order.status === 'claimable') status = 'CLAIMABLE';
                        else if (order.status === 'cancelled') status = 'FAILED';
                        else if (order.status === 'expired') status = 'EXPIRED';

                        const sourceChain = getSourceChain(order.swapType);
                        const destChain = getDestChain(order.swapType);

                        return {
                            id: `local_${order.id}`,
                            source: 'LOCAL',
                            swapType: order.swapType,
                            orderType: order.orderType || 'market',
                            status,
                            makerAddress: order.contractAddress || 'Local Wallet',
                            sellToken: order.sellToken || { symbol: '?', decimals: 8, icon: '' },
                            buyToken: order.buyToken || { symbol: '?', decimals: 8, icon: '' },
                            sellAmountRaw: String(order.sellAmount),
                            buyAmountRaw: String(order.buyAmount),
                            sellAmountFormatted: String(order.sellAmount),
                            buyAmountFormatted: Number(order.buyAmount).toFixed(4),
                            createdAt: order.createdAt,
                            updatedAt: order.createdAt,
                            sourceTxId: order.txid,
                            destTxId: order.fillTxid,
                            sourceExplorerUrl: buildLocalExplorerUrl(order, 'source'),
                            destExplorerUrl: buildLocalExplorerUrl(order, 'dest'),
                            rawIntent: order,
                        };
                    });

                    // Deduplicate — skip local if relayer already has the same intent
                    const existingIds = new Set(unified.map(o => o.rawIntent?.id));
                    const uniqueLocal = localOrders.filter(lo => !existingIds.has(lo.rawIntent?.intentId));
                    unified = [...unified, ...uniqueLocal];
                }
            } catch { /* non-fatal */ }

            unified.sort((a, b) => b.createdAt - a.createdAt);
            setOrders(unified);
            setLastUpdated(new Date());

        } catch (e) {
            console.error("Monitor fetch error:", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
        const interval = setInterval(fetchAllData, 8000);
        return () => clearInterval(interval);
    }, []);

    // ============================================================================
    // Utility Helpers
    // ============================================================================

    const findTokenInRegistries = (idOrSymbol: string) => {
        if (!idOrSymbol) return null;
        if (idOrSymbol.toLowerCase() === 'bch' || idOrSymbol === '') return ALL_BCH_SWAP_TOKENS.find(t => t.symbol === 'BCH');

        let found = TOKENS.find(t => t.type === idOrSymbol);
        if (found) return found;

        found = ALL_BCH_SWAP_TOKENS.find(t =>
            t.categoryId === idOrSymbol ||
            t.address === idOrSymbol ||
            stripHex(t.categoryId || '') === stripHex(idOrSymbol)
        );
        return found;
    };

    const resolveCrossChainToken = (direction: string, side: 'SELL' | 'BUY') => {
        if (!direction) return { symbol: 'UNK', decimals: 8, icon: '' };

        const isBchSell = direction.startsWith('BCH_');
        const isSolSell = direction.startsWith('SOL_');
        const isMovSell = direction.startsWith('MOV_');

        if (side === 'SELL') {
            if (isBchSell) return ALL_BCH_SWAP_TOKENS.find(t => t.symbol === 'BCH') || { symbol: 'BCH', decimals: 8, icon: CHAIN_ICONS.bch };
            if (isSolSell) return ALL_BCH_SWAP_TOKENS.find(t => t.symbol === 'SOL') || { symbol: 'SOL', decimals: 9, icon: CHAIN_ICONS.solana };
            if (isMovSell) return ALL_BCH_SWAP_TOKENS.find(t => t.symbol === 'MOVE') || { symbol: 'MOVE', decimals: 8, icon: CHAIN_ICONS.movement };
        } else {
            if (direction.endsWith('_BCH')) return ALL_BCH_SWAP_TOKENS.find(t => t.symbol === 'BCH') || { symbol: 'BCH', decimals: 8, icon: CHAIN_ICONS.bch };
            if (direction.endsWith('_SOL')) return ALL_BCH_SWAP_TOKENS.find(t => t.symbol === 'SOL') || { symbol: 'SOL', decimals: 9, icon: CHAIN_ICONS.solana };
            if (direction.endsWith('_MOV')) return ALL_BCH_SWAP_TOKENS.find(t => t.symbol === 'MOVE') || { symbol: 'MOVE', decimals: 8, icon: CHAIN_ICONS.movement };
        }
        return { symbol: 'UNK', decimals: 8, icon: '' };
    };

    const stripHex = (s: string) => s.startsWith('0x') ? s.slice(2) : s;

    const formatTokenAmount = (raw: string | number, decimals: number = 8) => {
        if (!raw) return '0.00';
        const val = Number(raw) / Math.pow(10, decimals);
        if (isNaN(val)) return '0.00';
        return val.toLocaleString(undefined, { maximumFractionDigits: val < 0.01 ? 6 : 4 });
    };

    const getSourceChain = (swapType: string): string => {
        if (swapType.startsWith('bch')) return 'bch';
        if (swapType.startsWith('sol')) return 'solana';
        if (swapType.startsWith('mov')) return 'movement';
        return 'bch';
    };

    const getDestChain = (swapType: string): string => {
        if (swapType.endsWith('bch') || swapType === 'same-chain') return 'bch';
        if (swapType.endsWith('sol')) return 'solana';
        if (swapType.endsWith('mov')) return 'movement';
        return 'bch';
    };

    const buildExplorerUrl = (direction: string, leg: 'SOURCE' | 'DEST', intent: any): string | undefined => {
        if (!direction) return undefined;

        if (leg === 'SOURCE') {
            const id = intent.bchContractAddress || intent.solanaEscrowPda || intent.movementEscrowId;
            if (!id) return undefined;

            if (direction.startsWith('BCH_')) {
                // BCH contract addresses need /address/ not /tx/
                return id.startsWith('bchtest:') || id.startsWith('bitcoincash:')
                    ? `https://chipnet.chaingraph.cash/address/${id}`
                    : `https://chipnet.chaingraph.cash/tx/${id}`;
            }
            if (direction.startsWith('SOL_')) return `https://explorer.solana.com/tx/${id}?cluster=devnet`;
            if (direction.startsWith('MOV_')) return `https://explorer.movementnetwork.xyz/txn/${id}?network=testnet`;
        } else {
            const id = intent.destFillTx || intent.destClaimTx;
            if (!id) return undefined;

            if (direction.endsWith('_BCH')) {
                return id.startsWith('bchtest:') || id.startsWith('bitcoincash:')
                    ? `https://chipnet.chaingraph.cash/address/${id}`
                    : `https://chipnet.chaingraph.cash/tx/${id}`;
            }
            if (direction.endsWith('_SOL')) return `https://explorer.solana.com/tx/${id}?cluster=devnet`;
            if (direction.endsWith('_MOV')) return `https://explorer.movementnetwork.xyz/txn/${id}?network=testnet`;
        }
        return undefined;
    };

    const buildLocalExplorerUrl = (order: BCHOrder, leg: 'source' | 'dest'): string | undefined => {
        if (leg === 'source') {
            if (order.explorerUrl) return order.explorerUrl;
            if (order.contractAddress) return `https://chipnet.chaingraph.cash/address/${order.contractAddress}`;
            if (order.txid) return `https://chipnet.chaingraph.cash/tx/${order.txid}`;
            return undefined;
        } else {
            if (order.destExplorerUrl) return order.destExplorerUrl;
            if (!order.fillTxid) return undefined;

            if (order.swapType === 'bch-to-sol') return `https://explorer.solana.com/tx/${order.fillTxid}?cluster=devnet`;
            if (order.swapType === 'bch-to-mov') return `https://explorer.movementnetwork.xyz/txn/${order.fillTxid}?network=testnet`;
            if (order.swapType === 'sol-to-bch') return `https://chipnet.chaingraph.cash/tx/${order.fillTxid}`;
            if (order.swapType === 'mov-to-bch') return `https://chipnet.chaingraph.cash/tx/${order.fillTxid}`;
            return `https://chipnet.chaingraph.cash/tx/${order.fillTxid}`;
        }
    };

    // ============================================================================
    // Filtering Logic
    // ============================================================================

    const filteredOrders = orders.filter(order => {
        if (activeTab === 'ACTIVE' && (order.status === 'COMPLETED' || order.status === 'FAILED' || order.status === 'EXPIRED')) return false;
        if (activeTab === 'HISTORY' && (order.status !== 'COMPLETED' && order.status !== 'FAILED' && order.status !== 'EXPIRED')) return false;

        if (categoryFilter === 'SAME_CHAIN' && order.source !== 'CASHTOKEN') return false;
        if (categoryFilter === 'CROSS_CHAIN' && order.source !== 'CROSSCHAIN') return false;
        if (categoryFilter === 'LOCAL' && order.source !== 'LOCAL') return false;

        if (statusFilter !== 'ALL' && order.status !== statusFilter) return false;

        return true;
    });

    // ============================================================================
    // Render Helpers
    // ============================================================================

    const renderTypeBadge = (order: UnifiedOrder) => {
        if (order.source === 'LOCAL') {
            const swapLabels: Record<string, string> = {
                'same-chain': 'CashToken',
                'bch-to-sol': 'BCH → SOL',
                'sol-to-bch': 'SOL → BCH',
                'bch-to-mov': 'BCH → MOVE',
                'mov-to-bch': 'MOVE → BCH',
            };
            const label = swapLabels[order.swapType] || order.swapType;
            const isCross = order.swapType !== 'same-chain';
            return (
                <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className={`text-[10px] py-0 ${isCross ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                        {isCross ? <Globe className="h-3 w-3 mr-1" /> : <Zap className="h-3 w-3 mr-1" />}
                        {label}
                    </Badge>
                    <Badge variant="outline" className="bg-teal-500/10 text-teal-400 border-teal-500/20 text-[10px] py-0">
                        Local
                    </Badge>
                </div>
            );
        }

        if (order.source === 'CASHTOKEN') {
            return (
                <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] py-0">
                        <Zap className="h-3 w-3 mr-1" />
                        Same-Chain
                    </Badge>
                    <Badge variant="outline" className="bg-zinc-800 text-zinc-300 border-zinc-700 text-[10px] py-0">
                        {order.orderType === 'limit' ? 'Limit' : 'Auction'}
                    </Badge>
                </div>
            );
        } else {
            let color = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            let label = order.swapType.toUpperCase();
            if (label.includes('MOV')) color = 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
            else if (label.includes('SOL')) color = 'bg-purple-500/10 text-purple-400 border-purple-500/20';

            return (
                <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className={`${color} text-[10px] py-0`}>
                        <Globe className="h-3 w-3 mr-1" />
                        {label.replace(/-/g, ' → ')}
                    </Badge>
                    <Badge variant="outline" className="bg-zinc-800 text-zinc-300 border-zinc-700 text-[10px] py-0">
                        HTLC
                    </Badge>
                </div>
            );
        }
    };

    const renderStatusBadge = (status: UnifiedOrderStatus) => {
        switch (status) {
            case 'PENDING': return <Badge variant="outline" className="bg-zinc-500/10 text-zinc-400 border-zinc-500/20"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
            case 'LOCKED': return <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20"><Layers className="h-3 w-3 mr-1 animate-pulse" /> Locked</Badge>;
            case 'DEST_FILLED': return <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20"><Layers className="h-3 w-3 mr-1" /> Filled (Waiting Claim)</Badge>;
            case 'CLAIMABLE': return <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse"><Zap className="h-3 w-3 mr-1" /> Claimable</Badge>;
            case 'COMPLETED': return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20"><CheckCircle2 className="h-3 w-3 mr-1" /> Completed</Badge>;
            case 'FAILED': return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20"><XCircle className="h-3 w-3 mr-1" /> Failed</Badge>;
            case 'EXPIRED': return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20"><Clock className="h-3 w-3 mr-1" /> Expired</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    const getChainIcon = (swapType: string, leg: 'source' | 'dest'): string | null => {
        const st = swapType.toLowerCase();
        if (leg === 'source') {
            if (st.startsWith('bch') || st === 'same-chain') return CHAIN_ICONS.bch;
            if (st.startsWith('sol')) return CHAIN_ICONS.solana;
            if (st.startsWith('mov')) return CHAIN_ICONS.movement;
        } else {
            if (st.endsWith('bch') || st === 'same-chain') return CHAIN_ICONS.bch;
            if (st.endsWith('sol')) return CHAIN_ICONS.solana;
            if (st.endsWith('mov')) return CHAIN_ICONS.movement;
        }
        return null;
    };

    const safePrice = (buyFormatted: string, sellFormatted: string): string => {
        const b = parseFloat(buyFormatted.replace(/,/g, ''));
        const s = parseFloat(sellFormatted.replace(/,/g, ''));
        if (!s || isNaN(b) || isNaN(s)) return '—';
        return (b / s).toFixed(4);
    };

    return (
        <div className="w-full space-y-6">

            {/* Header & Network Health */}
            <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-heading bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                        Protocol Monitor
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Real-time observer for all Intent Protocol network relayers
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-zinc-900/50 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs font-mono">
                        <span className="text-zinc-500 uppercase">CashTokens</span>
                        {health.cashtoken ? (
                            <span className="flex items-center gap-1.5 text-emerald-400"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> ONLINE ({health.cashtoken.activeIntents} Active)</span>
                        ) : (
                            <span className="flex items-center gap-1.5 text-red-500"><div className="w-2 h-2 rounded-full bg-red-500" /> OFFLINE</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 bg-zinc-900/50 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs font-mono">
                        <span className="text-zinc-500 uppercase">Cross-Chain</span>
                        {health.crosschain ? (
                            <span className="flex items-center gap-1.5 text-emerald-400"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> ONLINE</span>
                        ) : (
                            <span className="flex items-center gap-1.5 text-red-500"><div className="w-2 h-2 rounded-full bg-red-500" /> OFFLINE</span>
                        )}
                    </div>

                    <Button variant="outline" size="icon" onClick={fetchAllData} disabled={isLoading} className="bg-zinc-900/50 border-zinc-800 h-8 w-8 text-zinc-400 hover:text-white">
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* Filtering & Layout */}
            <Card className="border-white/5 bg-zinc-950/50 overflow-hidden shadow-2xl backdrop-blur-xl">
                <CardHeader className="border-b border-white/5 pb-4 bg-zinc-900/20">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-[300px]">
                            <TabsList className="grid w-full grid-cols-2 bg-zinc-900/80">
                                <TabsTrigger value="ACTIVE" className="data-[state=active]:bg-zinc-800">Active Orders</TabsTrigger>
                                <TabsTrigger value="HISTORY" className="data-[state=active]:bg-zinc-800">History</TabsTrigger>
                            </TabsList>
                        </Tabs>

                        <div className="flex items-center gap-3">
                            <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as any)}>
                                <SelectTrigger className="w-[150px] h-9 bg-zinc-900/80 border-zinc-800 text-xs text-muted-foreground focus:ring-0">
                                    <SelectValue placeholder="Network" />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-900 border-zinc-800">
                                    <SelectItem value="ALL">All Sources</SelectItem>
                                    <SelectItem value="SAME_CHAIN">Same-Chain (BCH)</SelectItem>
                                    <SelectItem value="CROSS_CHAIN">Cross-Chain (HTLC)</SelectItem>
                                    <SelectItem value="LOCAL">My Orders (Local)</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-[150px] h-9 bg-zinc-900/80 border-zinc-800 text-xs text-muted-foreground focus:ring-0">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-900 border-zinc-800">
                                    <SelectItem value="ALL">All Statuses</SelectItem>
                                    <SelectItem value="PENDING">Pending</SelectItem>
                                    <SelectItem value="LOCKED">Locked</SelectItem>
                                    <SelectItem value="DEST_FILLED">Dest Filled</SelectItem>
                                    <SelectItem value="CLAIMABLE">Claimable</SelectItem>
                                    <SelectItem value="COMPLETED">Completed</SelectItem>
                                    <SelectItem value="FAILED">Failed</SelectItem>
                                    <SelectItem value="EXPIRED">Expired</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-zinc-900/30">
                                <TableRow className="border-white/5 hover:bg-transparent">
                                    <TableHead className="w-[160px] text-xs font-semibold text-zinc-400">Created At</TableHead>
                                    <TableHead className="text-xs font-semibold text-zinc-400">Trade</TableHead>
                                    <TableHead className="text-xs font-semibold text-zinc-400">Details</TableHead>
                                    <TableHead className="text-xs font-semibold text-zinc-400">Status</TableHead>
                                    <TableHead className="text-right text-xs font-semibold text-zinc-400">Explorers</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredOrders.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                                            <div className="flex flex-col items-center gap-2">
                                                <BoxSelect className="h-10 w-10 text-zinc-700" strokeWidth={0.5} />
                                                {isLoading ? 'Loading intent networks...' : 'No orders found matching criteria.'}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredOrders.map((order) => {
                                        const now = Date.now();
                                        const isExpired = order.expiryTime && now > order.expiryTime;
                                        const isCompleted = order.status === 'COMPLETED' || order.status === 'FAILED';
                                        const sourceChainIcon = getChainIcon(order.swapType, 'source');
                                        const destChainIcon = getChainIcon(order.swapType, 'dest');

                                        return (
                                            <TableRow key={order.id} className="border-white/5 hover:bg-white/[0.02] transition-colors group">
                                                {/* CREATED */}
                                                <TableCell className="align-top py-4">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-sm font-medium text-zinc-200">
                                                            {order.createdAt ? formatDistanceToNow(order.createdAt, { addSuffix: true }) : 'Unknown'}
                                                        </span>
                                                        <span className="text-xs text-zinc-500 font-mono">
                                                            {order.createdAt ? format(order.createdAt, 'MMM dd, HH:mm:ss') : '--'}
                                                        </span>
                                                    </div>
                                                </TableCell>

                                                {/* TRADE CONFIG */}
                                                <TableCell className="align-top py-4">
                                                    <div className="flex flex-col gap-2">
                                                        {renderTypeBadge(order)}
                                                        <div className="flex items-center gap-1.5 bg-zinc-900/50 w-fit px-2.5 py-1.5 rounded-md border border-zinc-800">
                                                            {/* Sell token with chain badge */}
                                                            <div className="relative flex-shrink-0">
                                                                <div className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden">
                                                                    {order.sellToken?.icon ? <img src={order.sellToken.icon} className="w-4 h-4 object-contain" /> : <span className="text-[7px] text-zinc-500">{order.sellToken?.symbol?.[0]}</span>}
                                                                </div>
                                                                {sourceChainIcon && (
                                                                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-zinc-950 border border-zinc-700 flex items-center justify-center overflow-hidden">
                                                                        <img src={sourceChainIcon} className="w-2 h-2 object-contain" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <span className="text-xs font-medium text-zinc-300">{order.sellAmountFormatted} {order.sellToken?.symbol}</span>
                                                            <ArrowRight className="w-3 h-3 text-zinc-600 mx-0.5" />
                                                            {/* Buy token with chain badge */}
                                                            <div className="relative flex-shrink-0">
                                                                <div className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden">
                                                                    {order.buyToken?.icon ? <img src={order.buyToken.icon} className="w-4 h-4 object-contain" /> : <span className="text-[7px] text-zinc-500">{order.buyToken?.symbol?.[0]}</span>}
                                                                </div>
                                                                {destChainIcon && (
                                                                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-zinc-950 border border-zinc-700 flex items-center justify-center overflow-hidden">
                                                                        <img src={destChainIcon} className="w-2 h-2 object-contain" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <span className="text-xs font-medium text-zinc-300">{order.buyAmountFormatted} {order.buyToken?.symbol}</span>
                                                        </div>
                                                    </div>
                                                </TableCell>

                                                {/* DETAILS */}
                                                <TableCell className="align-top py-4">
                                                    <div className="flex flex-col gap-1.5">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs text-zinc-500 w-12">Price:</span>
                                                            <span className="text-xs font-mono text-emerald-400">
                                                                {safePrice(order.buyAmountFormatted, order.sellAmountFormatted)} {order.buyToken?.symbol}/{order.sellToken?.symbol}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-baseline gap-2">
                                                            <span className="text-[10px] text-zinc-500 uppercase w-12">Maker:</span>
                                                            <span className="text-xs font-mono text-zinc-400" title={order.makerAddress}>
                                                                {shortenAddr(order.makerAddress)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </TableCell>

                                                {/* STATUS */}
                                                <TableCell className="align-top py-4">
                                                    <div className="flex flex-col gap-2 items-start">
                                                        {renderStatusBadge(order.status)}
                                                        {!isCompleted && order.expiryTime && !isNaN(order.expiryTime) && (
                                                            <div className={`text-[10px] font-mono flex items-center gap-1 px-1.5 py-0.5 rounded border ${isExpired ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                                                                <Clock className="w-2.5 h-2.5" />
                                                                {isExpired ? 'Expired' : `Expires in ${formatDistanceToNow(order.expiryTime)}`}
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>

                                                {/* EXPLORERS */}
                                                <TableCell className="text-right align-top py-4">
                                                    <div className="flex flex-col gap-2 items-end">
                                                        {order.sourceExplorerUrl ? (
                                                            <a href={order.sourceExplorerUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 bg-blue-500/5 px-2 py-1 rounded-md transition-colors border border-transparent hover:border-blue-500/20">
                                                                <span className="font-mono">Source Tx</span>
                                                                <ExternalLink className="w-3 h-3" />
                                                            </a>
                                                        ) : (
                                                            <span className="text-xs text-zinc-700 font-mono px-2 py-1">No Source Tx</span>
                                                        )}

                                                        {order.source !== 'CASHTOKEN' && (
                                                            order.destExplorerUrl ? (
                                                                <a href={order.destExplorerUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 bg-purple-500/5 px-2 py-1 rounded-md transition-colors border border-transparent hover:border-purple-500/20">
                                                                    <span className="font-mono">Dest Tx</span>
                                                                    <ExternalLink className="w-3 h-3" />
                                                                </a>
                                                            ) : (
                                                                <span className="text-xs text-zinc-700 font-mono px-2 py-1">No Dest Tx</span>
                                                            )
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
