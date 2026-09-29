import { useState, useEffect, useCallback, useTransition } from 'react';
import { 
    Activity, 
    ArrowUpRight, 
    CheckCircle2, 
    Clock, 
    ExternalLink, 
    Filter, 
    Flame, 
    Layers, 
    Play, 
    RefreshCw, 
    Search, 
    ShieldCheck, 
    TrendingUp, 
    Wallet, 
    XCircle, 
    Zap, 
    ArrowRight, 
    ChevronDown, 
    ChevronUp,
    Database,
    Sparkles,
    Coins,
    BarChart3,
    Cpu,
    Check,
    Copy,
    Info,
    X,
    Eye,
    Power,
    PauseCircle,
    PlayCircle,
    Sliders,
    AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { BCH_MESH_SERVER_URL } from '@/lib/config';
import { shortenAddr } from '@/lib/utils';
import axios from 'axios';

export interface RouteFlags {
    meshEnabled: boolean;
    solverEnabled: boolean;
    cauldronEnabled: boolean;
    lastUpdated: number;
    reason?: string;
}

export interface QuoteTestResult {
    tokenIn: string;
    tokenOut: string;
    sellAmount: string;
    buyAmount: string;
    amountIn: string;
    amountOut: string;
    feeBps: number;
    routeType: string;
    meshPct?: number;
    cauldronPct?: number;
    routeReason?: string;
    source?: string;
    fillable: boolean;
    error?: string;
    network?: string;
}

interface SwapItem {
    id: string;
    intentId: string;
    intentTxid: string;
    fillTxid?: string;
    route: 'CAULDRON_AMM' | 'SOLVER_ROUTE' | 'MESH_POOL' | 'WATERFALL_BLENDED';
    orderType: 'LIMIT' | 'MARKET' | 'DUTCH';
    makerAddress: string;
    contractAddress: string;
    status: 'FILLED' | 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'FAILED' | 'REJECTED';
    
    tokenInSymbol: string;
    tokenInCategory: string;
    amountInRaw: string;
    amountInFormatted: string;

    tokenOutSymbol: string;
    tokenOutCategory: string;
    amountOutRaw: string;
    amountOutFormatted: string;
    minAmountOutRaw: string;

    effectivePrice: string;
    
    totalSurplusSats: string;
    userBonusSats: string;
    protocolSurplusSats: string;
    frontendSurplusSats: string;
    solverProfitSats: string;
    solverProfitUsd: string;
    minerFeeSats: string;

    createdAt: number;
    filledAt?: number;
    explorerUrl?: string;
    failureReason?: string;
    routingDetails?: {
        meshSharePercent: number;
        cauldronSharePercent: number;
        meshOutput: string;
        cauldronOutput: string;
        blendedOutput: string;
    };
}

interface OverviewStats {
    totalSwaps: number;
    filledSwaps: number;
    pendingSwaps: number;
    failedSwaps: number;
    totalVolumeBch: string;
    totalVolumeUsd: string;
    totalSolverProfitSats: string;
    totalSolverProfitBch: string;
    totalSolverProfitUsd: string;
    totalProtocolSurplusSats: string;
    totalUserBonusSats: string;
    avgFillLatencySec: number;
    routeDistribution: {
        meshCount: number;
        solverCount: number;
        cauldronCount: number;
        blendedCount: number;
        meshPercent: number;
        solverPercent: number;
        cauldronPercent: number;
        blendedPercent: number;
    };
    tokensTraded: Array<{
        symbol: string;
        category: string;
        volumeBch: string;
        volumeUsd: string;
        swapsCount: number;
    }>;
}

interface SolverStatus {
    address: string;
    balanceBch: string;
    balanceSats: string;
    utxoCount: number;
    tokenUtxosCount: number;
    protocolTreasuryPkh: string;
    activeIntentsWatched: number;
    strategyPoolsActive?: number;
}

export interface MeshPoolFill {
    id: string;
    txid: string;
    fillTxid?: string;
    amountInSats?: string;
    amountIn?: string;
    tokenAmountIn: string;
    tokenAmountOut: string;
    feeSats: string;
    timestamp: number;
    explorerUrl: string;
}

export interface MeshPoolItem {
    id: string;
    txid: string;
    vout: number;
    address: string;
    contractType: string;
    pair: string;
    tokenCategoryIn: string;
    tokenCategoryOut: string;
    symbolIn: string;
    symbolOut: string;
    reserveSats: string;
    reserveBch: string;
    reserveUsd: string;
    tokenAmountIn: string;
    tokenAmountOut: string;
    ownerPkh: string;
    curveType: number;
    curveName: string;
    feeBps: number;
    spreadBps: number;
    priceNum: number;
    priceDen: number;
    rangeLow: number;
    rangeHigh: number;
    earnedFeeSats: string;
    earnedFeeBch: string;
    isSpent: boolean;
    fillsCount: number;
    fills: MeshPoolFill[];
    explorerUrl: string;
    addressExplorerUrl: string;
}

export interface CauldronTokenInfo {
    categoryId: string;
    symbol: string;
    name: string;
    decimals: number;
    tvlSats: string;
    priceSats: string;
    priceUsd?: number;
    poolAddress?: string;
    reserveTokens?: string;
    reserveBchSats?: string;
    verified?: boolean;
}

export function AdminPage() {
    const [stats, setStats] = useState<OverviewStats | null>(null);
    const [swaps, setSwaps] = useState<SwapItem[]>([]);
    const [meshPools, setMeshPools] = useState<MeshPoolItem[]>([]);
    const [cauldronTokens, setCauldronTokens] = useState<CauldronTokenInfo[]>([]);
    const [expandedPoolId, setExpandedPoolId] = useState<string | null>(null);
    const [poolStatusFilter, setPoolStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DEPLETED'>('ALL');
    const [poolSearchTerm, setPoolSearchTerm] = useState('');
    const [tokenSearchTerm, setTokenSearchTerm] = useState('');
    const [solverInfo, setSolverInfo] = useState<SolverStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isTriggering, setIsTriggering] = useState(false);
    const [triggerMessage, setTriggerMessage] = useState<string | null>(null);

    const [routeFlags, setRouteFlags] = useState<RouteFlags | null>(null);
    const [isUpdatingRoute, setIsUpdatingRoute] = useState(false);
    
    // Live Route Tester State
    const [quoteTestIn, setQuoteTestIn] = useState('BCH');
    const [quoteTestOut, setQuoteTestOut] = useState('dfe50223c8d5cba8dcef8dff6d92b61deb88a8ba44947367f2b746487b56039b');
    const [quoteTestAmount, setQuoteTestAmount] = useState('0.05');
    const [quoteTestResult, setQuoteTestResult] = useState<QuoteTestResult | null>(null);
    const [isTestingQuote, setIsTestingQuote] = useState(false);

    // Filters
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'FILLED' | 'ACTIVE' | 'EXPIRED'>('ALL');
    const [routeFilter, setRouteFilter] = useState<'ALL' | 'CAULDRON_AMM' | 'SOLVER_ROUTE' | 'MESH_POOL' | 'WATERFALL_BLENDED'>('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSwap, setSelectedSwap] = useState<SwapItem | null>(null);
    const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(15);
    const [countdown, setCountdown] = useState<number>(15);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const baseUrl = BCH_MESH_SERVER_URL.replace(/\/$/, '');

    const fetchData = useCallback(async (showRefreshing = false) => {
        if (showRefreshing) setIsRefreshing(true);
        try {
            const [statsRes, swapsRes, solverRes, poolsRes, routesRes, cauldronRes] = await Promise.allSettled([
                axios.get(`${baseUrl}/api/v1/admin/stats`),
                axios.get(`${baseUrl}/api/v1/admin/swaps?limit=100`),
                axios.get(`${baseUrl}/api/v1/admin/solver`),
                axios.get(`${baseUrl}/api/v1/admin/mesh-pools`),
                axios.get(`${baseUrl}/api/v1/admin/routes/status`),
                axios.get(`${baseUrl}/api/v1/admin/cauldron`),
            ]);

            if (statsRes.status === 'fulfilled' && statsRes.value.data?.data) {
                setStats(statsRes.value.data.data);
            }

            if (swapsRes.status === 'fulfilled' && swapsRes.value.data?.swaps) {
                setSwaps(swapsRes.value.data.swaps);
            }

            if (solverRes.status === 'fulfilled' && solverRes.value.data?.solver) {
                setSolverInfo(solverRes.value.data.solver);
            }

            if (poolsRes.status === 'fulfilled' && poolsRes.value.data?.pools) {
                setMeshPools(poolsRes.value.data.pools);
            }

            if (routesRes.status === 'fulfilled' && routesRes.value.data?.routes) {
                setRouteFlags(routesRes.value.data.routes);
            }

            if (cauldronRes.status === 'fulfilled' && cauldronRes.value.data?.tokens) {
                setCauldronTokens(cauldronRes.value.data.tokens);
            }
            setCountdown(15);
        } catch (err) {
            console.error('Failed to load admin data:', err);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [baseUrl]);

    const handleToggleRoute = async (route: 'mesh' | 'solver' | 'cauldron', enable: boolean) => {
        setIsUpdatingRoute(true);
        setTriggerMessage(null);
        try {
            let endpoint: string;
            let label: string;
            if (route === 'mesh') {
                endpoint = enable
                    ? `${baseUrl}/api/v1/admin/routes/resume-mesh`
                    : `${baseUrl}/api/v1/admin/routes/pause-mesh`;
                label = 'Mesh Pool Route';
            } else if (route === 'solver') {
                endpoint = enable
                    ? `${baseUrl}/api/v1/admin/routes/resume-solver`
                    : `${baseUrl}/api/v1/admin/routes/pause-solver`;
                label = 'Solver Route';
            } else {
                endpoint = enable
                    ? `${baseUrl}/api/v1/admin/routes/resume-cauldron`
                    : `${baseUrl}/api/v1/admin/routes/pause-cauldron`;
                label = 'Cauldron AMM Route';
            }
            
            const res = await axios.post(endpoint, { reason: `Operator toggled via Admin UI` });
            if (res.data?.success && res.data?.routes) {
                setRouteFlags(res.data.routes);
                setTriggerMessage(`✅ ${label} is now ${enable ? 'ACTIVE (Enabled)' : 'PAUSED (Disabled)'}`);
            }
        } catch (err: any) {
            setTriggerMessage(`❌ Route toggle failed: ${err.response?.data?.error || err.message}`);
        } finally {
            setIsUpdatingRoute(false);
        }
    };

    const handleRunQuoteTest = async () => {
        setIsTestingQuote(true);
        setQuoteTestResult(null);
        try {
            const amountInSats = quoteTestIn === 'BCH' 
                ? Math.round(parseFloat(quoteTestAmount) * 1e8).toString()
                : quoteTestAmount;

            const res = await axios.post(`${baseUrl}/router/quote`, {
                sellToken: quoteTestIn,
                buyToken: quoteTestOut,
                sellAmount: amountInSats,
                network: 'chipnet',
            });

            setQuoteTestResult(res.data);
        } catch (err: any) {
            const errorMsg = err.response?.data?.error || err.message || 'Quote calculation failed';
            setQuoteTestResult({
                tokenIn: quoteTestIn,
                tokenOut: quoteTestOut,
                sellAmount: quoteTestAmount,
                buyAmount: '0',
                amountIn: quoteTestAmount,
                amountOut: '0',
                feeBps: 0,
                routeType: 'REJECTED_PAUSED',
                fillable: false,
                error: errorMsg,
                routeReason: errorMsg,
            });
        } finally {
            setIsTestingQuote(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (autoRefreshInterval <= 0) return;
        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    fetchData(false);
                    return autoRefreshInterval;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [fetchData, autoRefreshInterval]);

    const handleTriggerMatch = async () => {
        setIsTriggering(true);
        setTriggerMessage(null);
        try {
            const res = await axios.post(`${baseUrl}/api/v1/admin/trigger-match`);
            if (res.data?.success) {
                setTriggerMessage(`✅ Match cycle triggered: Found ${res.data.matchesFound} match(es)`);
                await fetchData(true);
            }
        } catch (err: any) {
            setTriggerMessage(`❌ Trigger failed: ${err.message}`);
        } finally {
            setIsTriggering(false);
            setTimeout(() => setTriggerMessage(null), 5000);
        }
    };

    const copyToClipboard = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    // Filtered swaps
    const filteredSwaps = swaps.filter((s) => {
        if (statusFilter !== 'ALL') {
            if (statusFilter === 'ACTIVE' && s.status !== 'ACTIVE' && s.status !== 'PENDING') return false;
            if (statusFilter === 'FILLED' && s.status !== 'FILLED') return false;
            if (statusFilter === 'EXPIRED' && s.status !== 'EXPIRED') return false;
        }
        if (routeFilter !== 'ALL' && s.route !== routeFilter) return false;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            return (
                s.makerAddress.toLowerCase().includes(term) ||
                s.id.toLowerCase().includes(term) ||
                (s.fillTxid && s.fillTxid.toLowerCase().includes(term)) ||
                s.tokenInSymbol.toLowerCase().includes(term) ||
                s.tokenOutSymbol.toLowerCase().includes(term)
            );
        }
        return true;
    });

    // Filtered Mesh Pools
    const filteredMeshPools = meshPools.filter((p) => {
        if (poolStatusFilter === 'ACTIVE' && p.isSpent) return false;
        if (poolStatusFilter === 'DEPLETED' && !p.isSpent) return false;
        if (poolSearchTerm) {
            const term = poolSearchTerm.toLowerCase();
            return (
                p.pair.toLowerCase().includes(term) ||
                p.symbolIn.toLowerCase().includes(term) ||
                p.symbolOut.toLowerCase().includes(term) ||
                p.address.toLowerCase().includes(term) ||
                p.txid.toLowerCase().includes(term)
            );
        }
        return true;
    });

    const getRouteBadge = (route: string) => {
        switch (route) {
            case 'CAULDRON_AMM':
                return (
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 flex items-center gap-1 font-mono text-[11px] py-0.5">
                        <Flame className="w-3 h-3 text-emerald-400" /> Cauldron AMM
                    </Badge>
                );
            case 'SOLVER_ROUTE':
                return (
                    <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 flex items-center gap-1 font-mono text-[11px] py-0.5">
                        <Zap className="w-3 h-3 text-amber-400" /> Solver Route
                    </Badge>
                );
            case 'MESH_POOL':
                return (
                    <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 flex items-center gap-1 font-mono text-[11px] py-0.5">
                        <Layers className="w-3 h-3 text-blue-400" /> Mesh Pool
                    </Badge>
                );
            case 'WATERFALL_BLENDED':
                return (
                    <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/30 flex items-center gap-1 font-mono text-[11px] py-0.5">
                        <Sparkles className="w-3 h-3 text-purple-400" /> Waterfall Blended
                    </Badge>
                );
            default:
                return (
                    <Badge variant="outline" className="text-zinc-400 text-[11px]">
                        {route}
                    </Badge>
                );
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'FILLED':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" /> Filled
                    </span>
                );
            case 'ACTIVE':
            case 'PENDING':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse">
                        <Activity className="w-3 h-3" /> Active
                    </span>
                );
            case 'EXPIRED':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Clock className="w-3 h-3" /> Expired
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
                        {status}
                    </span>
                );
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] text-zinc-100 pb-20 pt-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
            
            {/* Header Title & Actions */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/10 pb-6">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                            <Cpu className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-heading font-black tracking-tight text-white flex items-center gap-2">
                                Protocol Admin & Swap Flow Analyzer
                                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] font-mono uppercase tracking-wider">
                                    Live Chipnet
                                </Badge>
                            </h1>
                            <p className="text-sm text-zinc-400 mt-0.5">
                                Real-time intent lifecycle monitoring, execution routing & solver profit analytics
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Trigger match button */}
                    <Button 
                        onClick={handleTriggerMatch} 
                        disabled={isTriggering}
                        className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-xs h-9 px-3.5 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all"
                    >
                        {isTriggering ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                        ) : (
                            <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
                        )}
                        Trigger Solver Match
                    </Button>

                    {/* Refresh button */}
                    <Button 
                        variant="outline" 
                        onClick={() => fetchData(true)}
                        disabled={isRefreshing}
                        className="border-white/10 hover:bg-white/5 text-zinc-300 text-xs h-9 px-3 rounded-xl"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
                        Sync Data
                    </Button>

                    {/* Auto-refresh interval selector & live countdown */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-zinc-400">
                        <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-emerald-400" />
                            {autoRefreshInterval > 0 && (
                                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                    {countdown}s
                                </span>
                            )}
                        </div>
                        <select 
                            value={autoRefreshInterval} 
                            onChange={(e) => {
                                const val = Number(e.target.value);
                                setAutoRefreshInterval(val);
                                setCountdown(val);
                            }}
                            aria-label="Auto-refresh interval"
                            className="bg-transparent border-none text-zinc-200 text-xs focus:outline-none cursor-pointer"
                        >
                            <option value={15} className="bg-zinc-900">15s Poll (Default)</option>
                            <option value={5} className="bg-zinc-900">5s Poll</option>
                            <option value={30} className="bg-zinc-900">30s Poll</option>
                            <option value={60} className="bg-zinc-900">60s Poll</option>
                            <option value={0} className="bg-zinc-900">Off</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Notification alert banner */}
            {triggerMessage && (
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-emerald-500/30 text-sm text-zinc-200 flex items-center justify-between animate-in fade-in">
                    <div className="flex items-center gap-2">
                        <Info className="w-4 h-4 text-emerald-400" />
                        <span>{triggerMessage}</span>
                    </div>
                    <button onClick={() => setTriggerMessage(null)} className="text-zinc-400 hover:text-white">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Live Solver Health Bar */}
            {solverInfo && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-zinc-950 via-zinc-900/60 to-zinc-950 border border-white/10 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="text-xs text-zinc-400 font-mono flex items-center gap-2">
                                <span>SOLVER WALLET:</span>
                                <span className="text-zinc-200 font-semibold">{shortenAddr(solverInfo.address)}</span>
                                <button 
                                    onClick={() => copyToClipboard(solverInfo.address, 'solver-addr')}
                                    className="text-zinc-500 hover:text-white transition-colors"
                                >
                                    {copiedKey === 'solver-addr' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                </button>
                                <a 
                                    href={`https://chipnet.imaginary.cash/address/${solverInfo.address}`} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="text-cyan-400 hover:text-cyan-300"
                                >
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>
                            <div className="text-sm font-semibold text-white mt-0.5">
                                Gas Balance: <span className="text-emerald-400 font-mono">{solverInfo.balanceBch} BCH</span> <span className="text-zinc-500 text-xs">({solverInfo.balanceSats} sats)</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-6 text-xs text-zinc-400">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                            <span>Active Intents Watched: <strong className="text-white font-mono">{solverInfo.activeIntentsWatched}</strong></span>
                        </div>
                        <div className="hidden sm:block border-l border-white/10 h-6" />
                        <div>
                            <span>Mesh Pools Active: <strong className="text-white font-mono">{solverInfo.strategyPoolsActive}</strong></span>
                        </div>
                        <div className="hidden sm:block border-l border-white/10 h-6" />
                        <div>
                            <span>Pure BCH UTXOs: <strong className="text-white font-mono">{solverInfo.utxoCount}</strong></span>
                        </div>
                    </div>
                </div>
            )}

            {/* Live Routing Engine & Venue Circuit Breakers */}
            <div className="p-5 rounded-2xl bg-zinc-950/90 border border-white/10 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
                            <Sliders className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-heading font-bold text-white flex flex-wrap items-center gap-2">
                                Execution Routing Circuit Breakers & Venue Pause Toggles
                                {routeFlags?.meshEnabled && routeFlags?.solverEnabled && routeFlags?.cauldronEnabled ? (
                                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-mono">
                                        All 3 Routes Active
                                    </Badge>
                                ) : routeFlags?.meshEnabled && routeFlags?.solverEnabled && !routeFlags?.cauldronEnabled ? (
                                    <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-[10px] font-mono">
                                        Mesh + Solver (Cauldron Paused)
                                    </Badge>
                                ) : routeFlags?.cauldronEnabled && !routeFlags?.meshEnabled && !routeFlags?.solverEnabled ? (
                                    <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px] font-mono">
                                        Cauldron Only (Mesh + Solver Paused)
                                    </Badge>
                                ) : !routeFlags?.meshEnabled && !routeFlags?.solverEnabled && !routeFlags?.cauldronEnabled ? (
                                    <Badge className="bg-red-500/20 text-red-400 border-red-500/40 text-[10px] font-mono animate-pulse">
                                        ⚠️ All Routes Paused
                                    </Badge>
                                ) : (
                                    <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/30 text-[10px] font-mono">
                                        Partial Routes Active
                                    </Badge>
                                )}
                            </h3>
                            <p className="text-xs text-zinc-400">
                                Control real-time solver order routing per venue without service redeployment
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-[11px] text-zinc-500 font-mono">
                            Updated: {routeFlags?.lastUpdated ? new Date(routeFlags.lastUpdated).toLocaleTimeString() : 'Live'}
                        </span>
                    </div>
                </div>

                {/* Route Venue Toggles Grid — 3 routes */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Mesh Pool Route Toggle Card */}
                    <div className={`p-4 rounded-xl border transition-all ${
                        routeFlags?.meshEnabled !== false 
                            ? 'bg-blue-950/20 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                            : 'bg-zinc-900/40 border-red-500/30 opacity-80'
                    }`}>
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${routeFlags?.meshEnabled !== false ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'}`}>
                                    <Layers className="w-4 h-4" />
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-white flex items-center gap-2">
                                        <span>Mesh Pool Route</span>
                                        {routeFlags?.meshEnabled !== false ? (
                                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Active
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-[10px] text-red-400 font-mono">
                                                <span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Paused
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-[11px] text-zinc-400 mt-0.5">
                                        Zero-inventory on-chain covenant LP fills
                                    </div>
                                </div>
                            </div>

                            <Button
                                size="sm"
                                disabled={isUpdatingRoute}
                                onClick={() => handleToggleRoute('mesh', routeFlags?.meshEnabled === false)}
                                className={`h-8 text-xs font-semibold px-3 rounded-lg transition-all ${
                                    routeFlags?.meshEnabled !== false
                                        ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40'
                                        : 'bg-emerald-500 hover:bg-emerald-600 text-black'
                                }`}
                            >
                                {routeFlags?.meshEnabled !== false ? (
                                    <><PauseCircle className="w-3.5 h-3.5 mr-1" /> Pause</>
                                ) : (
                                    <><PlayCircle className="w-3.5 h-3.5 mr-1 fill-current" /> Resume</>
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Solver Route Toggle Card */}
                    <div className={`p-4 rounded-xl border transition-all ${
                        routeFlags?.solverEnabled !== false 
                            ? 'bg-amber-950/20 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]' 
                            : 'bg-zinc-900/40 border-red-500/30 opacity-80'
                    }`}>
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${routeFlags?.solverEnabled !== false ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                                    <Zap className="w-4 h-4" />
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-white flex items-center gap-2">
                                        <span>Solver Route</span>
                                        {routeFlags?.solverEnabled !== false ? (
                                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Active
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-[10px] text-red-400 font-mono">
                                                <span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Paused
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-[11px] text-zinc-400 mt-0.5">
                                        JIT inventory fills via solver wallet
                                    </div>
                                </div>
                            </div>

                            <Button
                                size="sm"
                                disabled={isUpdatingRoute}
                                onClick={() => handleToggleRoute('solver', routeFlags?.solverEnabled === false)}
                                className={`h-8 text-xs font-semibold px-3 rounded-lg transition-all ${
                                    routeFlags?.solverEnabled !== false
                                        ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40'
                                        : 'bg-emerald-500 hover:bg-emerald-600 text-black'
                                }`}
                            >
                                {routeFlags?.solverEnabled !== false ? (
                                    <><PauseCircle className="w-3.5 h-3.5 mr-1" /> Pause</>
                                ) : (
                                    <><PlayCircle className="w-3.5 h-3.5 mr-1 fill-current" /> Resume</>
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Cauldron AMM Route Toggle Card */}
                    <div className={`p-4 rounded-xl border transition-all ${
                        routeFlags?.cauldronEnabled !== false 
                            ? 'bg-emerald-950/20 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                            : 'bg-zinc-900/40 border-red-500/30 opacity-80'
                    }`}>
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${routeFlags?.cauldronEnabled !== false ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                    <Flame className="w-4 h-4" />
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-white flex items-center gap-2">
                                        <span>Cauldron AMM Route</span>
                                        {routeFlags?.cauldronEnabled !== false ? (
                                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Active
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-[10px] text-red-400 font-mono">
                                                <span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Paused
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-[11px] text-zinc-400 mt-0.5">
                                        Decentralised CPMM pool fallback (0.3% fee)
                                    </div>
                                </div>
                            </div>

                            <Button
                                size="sm"
                                disabled={isUpdatingRoute}
                                onClick={() => handleToggleRoute('cauldron', routeFlags?.cauldronEnabled === false)}
                                className={`h-8 text-xs font-semibold px-3 rounded-lg transition-all ${
                                    routeFlags?.cauldronEnabled !== false
                                        ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40'
                                        : 'bg-emerald-500 hover:bg-emerald-600 text-black'
                                }`}
                            >
                                {routeFlags?.cauldronEnabled !== false ? (
                                    <><PauseCircle className="w-3.5 h-3.5 mr-1" /> Pause</>
                                ) : (
                                    <><PlayCircle className="w-3.5 h-3.5 mr-1 fill-current" /> Resume</>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Live Quote & Route Tester Accordion */}
                <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                            <Zap className="w-3.5 h-3.5 text-amber-400" />
                            <span>Live Route Simulator & Quote Verifier</span>
                        </div>
                        <div className="text-[11px] text-zinc-500">
                            Tests solver route selection and output under current pause state
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                        <div>
                            <label className="text-[10px] uppercase font-mono text-zinc-500">Sell Token</label>
                            <select
                                value={quoteTestIn}
                                onChange={(e) => setQuoteTestIn(e.target.value)}
                                className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                            >
                                <option value="BCH">BCH (Native)</option>
                                <option value="dfe50223c8d5cba8dcef8dff6d92b61deb88a8ba44947367f2b746487b56039b">PUSDTEST</option>
                                <option value="370610ebb9f242cb06aab907297e59fec033b000a647d6f59bf579cf4fef4e70">TEST2</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] uppercase font-mono text-zinc-500">Buy Token</label>
                            <select
                                value={quoteTestOut}
                                onChange={(e) => setQuoteTestOut(e.target.value)}
                                className="w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                            >
                                <option value="dfe50223c8d5cba8dcef8dff6d92b61deb88a8ba44947367f2b746487b56039b">PUSDTEST (Cauldron + Mesh)</option>
                                <option value="370610ebb9f242cb06aab907297e59fec033b000a647d6f59bf579cf4fef4e70">TEST2 (Cauldron Pool)</option>
                                <option value="BCH">BCH (Native)</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] uppercase font-mono text-zinc-500">Amount In</label>
                            <Input
                                value={quoteTestAmount}
                                onChange={(e) => setQuoteTestAmount(e.target.value)}
                                placeholder="0.05"
                                className="mt-1 bg-zinc-900 border-white/10 text-xs text-white h-8"
                            />
                        </div>

                        <div className="flex items-end">
                            <Button
                                onClick={handleRunQuoteTest}
                                disabled={isTestingQuote}
                                className="w-full h-8 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs rounded-lg transition-all"
                            >
                                {isTestingQuote ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                                ) : (
                                    <Zap className="w-3.5 h-3.5 mr-1" />
                                )}
                                Test Route Quote
                            </Button>
                        </div>
                    </div>

                    {/* Quote Test Result Display */}
                    {quoteTestResult && (
                        <div className={`p-3 rounded-lg border text-xs font-mono transition-all ${
                            quoteTestResult.fillable 
                                ? 'bg-emerald-950/30 border-emerald-500/30 text-zinc-200' 
                                : 'bg-red-950/30 border-red-500/30 text-red-300'
                        }`}>
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2 mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold">Result:</span>
                                    {quoteTestResult.fillable ? (
                                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                                            Fillable Route Found
                                        </Badge>
                                    ) : (
                                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">
                                            Route Rejected / Paused
                                        </Badge>
                                    )}
                                    <span className="text-zinc-400 text-[11px]">Route: {quoteTestResult.routeType}</span>
                                </div>

                                <div className="flex items-center gap-3 text-[11px]">
                                    {quoteTestResult.meshPct !== undefined && (
                                        <span className="text-blue-400">Mesh: {quoteTestResult.meshPct}%</span>
                                    )}
                                    {quoteTestResult.cauldronPct !== undefined && (
                                        <span className="text-emerald-400">Cauldron: {quoteTestResult.cauldronPct}%</span>
                                    )}
                                    {quoteTestResult.feeBps !== undefined && (
                                        <span className="text-zinc-400">Fee: {quoteTestResult.feeBps / 100}%</span>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                    <span className="text-zinc-400">Output Delivered: </span>
                                    <strong className="text-white text-sm">{quoteTestResult.buyAmount || quoteTestResult.amountOut}</strong>
                                </div>
                                <div className="text-[11px] text-zinc-400 italic">
                                    {quoteTestResult.routeReason || quoteTestResult.error}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Top KPI Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Total Volume */}
                <Card className="bg-zinc-950/80 border-white/10 shadow-md">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-zinc-400 text-xs flex items-center justify-between">
                            <span>TOTAL TRADING VOLUME</span>
                            <TrendingUp className="w-4 h-4 text-emerald-400" />
                        </CardDescription>
                        <CardTitle className="text-2xl font-mono font-bold text-white">
                            ${stats?.totalVolumeUsd || '0.00'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 text-xs text-zinc-400 font-mono">
                        <span className="text-emerald-400 font-semibold">{stats?.totalVolumeBch || '0.0000'} BCH</span> volume settled
                    </CardContent>
                </Card>

                {/* 2. Solver Realized Profit */}
                <Card className="bg-zinc-950/80 border-white/10 shadow-md">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-zinc-400 text-xs flex items-center justify-between">
                            <span>REALIZED SOLVER PROFIT</span>
                            <Coins className="w-4 h-4 text-emerald-400" />
                        </CardDescription>
                        <CardTitle className="text-2xl font-mono font-bold text-emerald-400 flex items-center gap-1.5">
                            +${stats?.totalSolverProfitUsd || '0.00'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 text-xs text-zinc-400 font-mono flex items-center justify-between">
                        <span>{stats?.totalSolverProfitBch || '0.000000'} BCH</span>
                        <span className="text-zinc-500">({stats?.totalSolverProfitSats || '0'} sats)</span>
                    </CardContent>
                </Card>

                {/* 3. User Surplus Delivered */}
                <Card className="bg-zinc-950/80 border-white/10 shadow-md">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-zinc-400 text-xs flex items-center justify-between">
                            <span>USER SURPLUS BONUS</span>
                            <Sparkles className="w-4 h-4 text-cyan-400" />
                        </CardDescription>
                        <CardTitle className="text-2xl font-mono font-bold text-cyan-400">
                            {stats?.totalUserBonusSats || '0'} sats
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 text-xs text-zinc-400">
                        Extra payout passed to makers vs limit
                    </CardContent>
                </Card>

                {/* 4. Route Distribution — Tri-Route Segmented Bar */}
                <Card className="bg-zinc-950/80 border-white/10 shadow-md">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-zinc-400 text-xs flex items-center justify-between">
                            <span>ROUTE DISTRIBUTION</span>
                            <Layers className="w-4 h-4 text-purple-400" />
                        </CardDescription>
                        <CardTitle className="text-sm font-mono font-bold text-white flex flex-wrap items-center gap-2">
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                                <span className="text-emerald-400">{stats?.routeDistribution?.cauldronPercent ?? 0}%</span>
                                <span className="text-zinc-500 font-normal">AMM</span>
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                                <span className="text-amber-400">{stats?.routeDistribution?.solverPercent ?? 0}%</span>
                                <span className="text-zinc-500 font-normal">Solver</span>
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                                <span className="text-blue-400">{stats?.routeDistribution?.meshPercent ?? 0}%</span>
                                <span className="text-zinc-500 font-normal">Mesh</span>
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 text-xs text-zinc-500 space-y-2">
                        {/* Segmented progress bar */}
                        <div className="w-full bg-zinc-800 rounded-full h-2.5 overflow-hidden flex gap-px">
                            <div
                                className="bg-emerald-400 h-full rounded-l-full transition-all"
                                style={{ width: `${stats?.routeDistribution?.cauldronPercent ?? 0}%` }}
                                title={`Cauldron AMM: ${stats?.routeDistribution?.cauldronCount ?? 0} fills`}
                            />
                            <div
                                className="bg-amber-400 h-full transition-all"
                                style={{ width: `${stats?.routeDistribution?.solverPercent ?? 0}%` }}
                                title={`Solver Route: ${stats?.routeDistribution?.solverCount ?? 0} fills`}
                            />
                            <div
                                className="bg-blue-400 h-full transition-all"
                                style={{ width: `${stats?.routeDistribution?.meshPercent ?? 0}%` }}
                                title={`Mesh Pool: ${stats?.routeDistribution?.meshCount ?? 0} fills`}
                            />
                            <div
                                className="bg-purple-400 h-full rounded-r-full transition-all"
                                style={{ width: `${stats?.routeDistribution?.blendedPercent ?? 0}%` }}
                                title={`Blended: ${stats?.routeDistribution?.blendedCount ?? 0} fills`}
                            />
                        </div>
                        <div className="flex justify-between font-mono text-[10px]">
                            <span>{stats?.routeDistribution?.cauldronCount ?? 0} AMM fills</span>
                            <span>{stats?.routeDistribution?.solverCount ?? 0} Solver fills</span>
                            <span>{stats?.routeDistribution?.meshCount ?? 0} Mesh fills</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Tabs: 1. Swaps Flow Analyzer, 2. Mesh Pools & Fills, 3. Token Volume Breakdown, 4. Solver & Liquidity Config */}
            <Tabs defaultValue="swaps" className="space-y-6">
                <TabsList className="bg-zinc-900/80 border border-white/10 p-1 rounded-xl flex flex-wrap">
                    <TabsTrigger value="swaps" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-xs">
                        <Activity className="w-3.5 h-3.5 mr-1.5" /> Live Swaps Flow ({filteredSwaps.length})
                    </TabsTrigger>
                    <TabsTrigger value="liquidity" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-xs">
                        <Wallet className="w-3.5 h-3.5 mr-1.5 text-emerald-400" /> Solver, Mesh & Cauldron Balances ({cauldronTokens.length} Tokens)
                    </TabsTrigger>
                    <TabsTrigger value="mesh-pools" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-xs">
                        <Layers className="w-3.5 h-3.5 mr-1.5 text-blue-400" /> Active Mesh Pools & Fills ({meshPools.length})
                    </TabsTrigger>
                    <TabsTrigger value="tokens" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-xs">
                        <BarChart3 className="w-3.5 h-3.5 mr-1.5" /> Token Volume Analytics
                    </TabsTrigger>
                    <TabsTrigger value="solver" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-xs">
                        <Database className="w-3.5 h-3.5 mr-1.5" /> System & Covenant Health
                    </TabsTrigger>
                </TabsList>

                {/* TAB 1: Live Swaps Flow Analyzer */}
                <TabsContent value="swaps" className="space-y-4">
                    {/* Filter and Search Bar */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 rounded-2xl bg-zinc-950/70 border border-white/10">
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Status Filter */}
                            <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-white/5 text-xs">
                                {(['ALL', 'FILLED', 'ACTIVE', 'EXPIRED'] as const).map((st) => (
                                    <button
                                        key={st}
                                        onClick={() => setStatusFilter(st)}
                                        className={`px-2.5 py-1 rounded-lg transition-all font-medium ${
                                            statusFilter === st 
                                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                                : 'text-zinc-400 hover:text-white'
                                        }`}
                                    >
                                        {st}
                                    </button>
                                ))}
                            </div>

                            {/* Route Filter */}
                            <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-white/5 text-xs">
                                {(
                                    [
                                        { key: 'ALL', label: 'All Routes' },
                                        { key: 'CAULDRON_AMM', label: 'Cauldron AMM' },
                                        { key: 'SOLVER_ROUTE', label: 'Solver Route' },
                                        { key: 'MESH_POOL', label: 'Mesh Pool' },
                                    ] as const
                                ).map((rt) => (
                                    <button
                                        key={rt.key}
                                        onClick={() => setRouteFilter(rt.key as any)}
                                        className={`px-2.5 py-1 rounded-lg transition-all font-medium ${
                                            routeFilter === rt.key 
                                                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                                                : 'text-zinc-400 hover:text-white'
                                        }`}
                                    >
                                        {rt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Search Input */}
                        <div className="relative w-full md:w-72">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <Input
                                placeholder="Search by address, TXID, token..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 h-9 bg-zinc-900 border-white/10 text-xs rounded-xl text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-500"
                            />
                        </div>
                    </div>

                    {/* Swaps Table */}
                    <div className="rounded-2xl border border-white/10 bg-zinc-950 overflow-hidden shadow-xl">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-white/10 bg-zinc-900/60 text-zinc-400 font-mono uppercase tracking-wider">
                                        <th className="py-3.5 px-4 font-semibold">Age / Time</th>
                                        <th className="py-3.5 px-4 font-semibold">Pair & Amount In</th>
                                        <th className="py-3.5 px-4 font-semibold">Direction & Out</th>
                                        <th className="py-3.5 px-4 font-semibold">Route Execution</th>
                                        <th className="py-3.5 px-4 font-semibold">Maker Address</th>
                                        <th className="py-3.5 px-4 font-semibold">Solver Profit</th>
                                        <th className="py-3.5 px-4 font-semibold">Status</th>
                                        <th className="py-3.5 px-4 font-semibold text-right">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={8} className="py-12 text-center text-zinc-500">
                                                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-400 mb-2" />
                                                Loading protocol swaps...
                                            </td>
                                        </tr>
                                    ) : filteredSwaps.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="py-12 text-center text-zinc-500">
                                                No swaps found matching selected filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredSwaps.map((s) => (
                                            <tr 
                                                key={s.id} 
                                                className="hover:bg-white/[0.02] transition-colors group cursor-pointer"
                                                onClick={() => setSelectedSwap(s)}
                                            >
                                                {/* Timestamp */}
                                                <td className="py-3.5 px-4 font-mono text-zinc-400">
                                                    <div>{new Date(s.createdAt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                                                    <div className="text-[10px] text-zinc-600">{new Date(s.createdAt * 1000).toLocaleDateString([], { month: 'short', day: 'numeric' })}</div>
                                                </td>

                                                {/* In Amount */}
                                                <td className="py-3.5 px-4">
                                                    <div className="font-semibold text-white flex items-center gap-1.5 font-mono">
                                                        <span>{s.amountInFormatted}</span>
                                                        <span className="text-zinc-400 text-[11px]">{s.tokenInSymbol}</span>
                                                    </div>
                                                    <div className="text-[10px] text-zinc-500 uppercase font-mono">
                                                        {s.orderType} ORDER
                                                    </div>
                                                </td>

                                                {/* Out Amount */}
                                                <td className="py-3.5 px-4">
                                                    <div className="font-semibold text-emerald-400 flex items-center gap-1.5 font-mono">
                                                        <ArrowRight className="w-3 h-3 text-zinc-600 shrink-0" />
                                                        <span>{s.amountOutFormatted}</span>
                                                        <span className="text-zinc-400 text-[11px]">{s.tokenOutSymbol}</span>
                                                    </div>
                                                    {s.effectivePrice && s.effectivePrice !== '0' && (
                                                        <div className="text-[10px] text-zinc-500 font-mono">
                                                            @{s.effectivePrice} rate
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Route */}
                                                <td className="py-3.5 px-4">
                                                    {getRouteBadge(s.route)}
                                                </td>

                                                {/* Maker */}
                                                <td className="py-3.5 px-4 font-mono text-zinc-300">
                                                    <div className="flex items-center gap-1.5">
                                                        <span>{shortenAddr(s.makerAddress)}</span>
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                copyToClipboard(s.makerAddress, `maker-${s.id}`);
                                                            }}
                                                            className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-white transition-opacity"
                                                        >
                                                            {copiedKey === `maker-${s.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                                        </button>
                                                    </div>
                                                </td>

                                                {/* Solver Profit */}
                                                <td className="py-3.5 px-4 font-mono">
                                                    {s.status === 'FILLED' ? (
                                                        <div>
                                                            <span className="text-emerald-400 font-semibold">+{s.solverProfitSats || '0'} sats</span>
                                                            <div className="text-[10px] text-zinc-500">+${s.solverProfitUsd || '0.00'}</div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-zinc-600">-</span>
                                                    )}
                                                </td>

                                                {/* Status */}
                                                <td className="py-3.5 px-4">
                                                    {getStatusBadge(s.status)}
                                                </td>

                                                {/* Action / Inspect */}
                                                <td className="py-3.5 px-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-7 px-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg text-xs"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedSwap(s);
                                                            }}
                                                        >
                                                            <Eye className="w-3.5 h-3.5 mr-1" /> Inspect
                                                        </Button>
                                                        {s.explorerUrl && (
                                                            <a 
                                                                href={s.explorerUrl} 
                                                                target="_blank" 
                                                                rel="noreferrer"
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="text-zinc-500 hover:text-emerald-400 transition-colors p-1"
                                                            >
                                                                <ExternalLink className="w-3.5 h-3.5" />
                                                            </a>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </TabsContent>

                {/* TAB 2: Active Mesh Pools & Liquidity Analysis */}
                <TabsContent value="mesh-pools" className="space-y-6">
                    {/* Top Stats Overview for Mesh Pools */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="bg-zinc-950/80 border-white/10 shadow-md">
                            <CardHeader className="pb-2">
                                <CardDescription className="text-zinc-400 text-xs flex items-center justify-between">
                                    <span>DEPLOYED MESH POOLS</span>
                                    <Layers className="w-4 h-4 text-blue-400" />
                                </CardDescription>
                                <CardTitle className="text-2xl font-mono font-bold text-white">
                                    {meshPools.length}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0 text-xs text-zinc-400">
                                <span className="text-emerald-400 font-semibold">{meshPools.filter(p => !p.isSpent).length} Active</span> with available liquidity
                            </CardContent>
                        </Card>

                        <Card className="bg-zinc-950/80 border-white/10 shadow-md">
                            <CardHeader className="pb-2">
                                <CardDescription className="text-zinc-400 text-xs flex items-center justify-between">
                                    <span>TOTAL POOL RESERVES</span>
                                    <Coins className="w-4 h-4 text-emerald-400" />
                                </CardDescription>
                                <CardTitle className="text-2xl font-mono font-bold text-emerald-400">
                                    {(meshPools.reduce((acc, p) => acc + parseFloat(p.reserveBch || '0'), 0)).toFixed(4)} BCH
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0 text-xs text-zinc-400 font-mono">
                                ≈ ${(meshPools.reduce((acc, p) => acc + parseFloat(p.reserveUsd || '0'), 0)).toFixed(2)} USD value
                            </CardContent>
                        </Card>

                        <Card className="bg-zinc-950/80 border-white/10 shadow-md">
                            <CardHeader className="pb-2">
                                <CardDescription className="text-zinc-400 text-xs flex items-center justify-between">
                                    <span>TOTAL FILLS PASSED</span>
                                    <Zap className="w-4 h-4 text-amber-400" />
                                </CardDescription>
                                <CardTitle className="text-2xl font-mono font-bold text-amber-400">
                                    {meshPools.reduce((acc, p) => acc + (p.fillsCount || 0), 0)}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0 text-xs text-zinc-400">
                                Intent swaps matched against mesh covenants
                            </CardContent>
                        </Card>

                        <Card className="bg-zinc-950/80 border-white/10 shadow-md">
                            <CardHeader className="pb-2">
                                <CardDescription className="text-zinc-400 text-xs flex items-center justify-between">
                                    <span>ACCRUED LP FEES</span>
                                    <Sparkles className="w-4 h-4 text-purple-400" />
                                </CardDescription>
                                <CardTitle className="text-2xl font-mono font-bold text-purple-400">
                                    {meshPools.reduce((acc, p) => acc + BigInt(p.earnedFeeSats || '0'), 0n).toString()} sats
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0 text-xs text-zinc-400 font-mono">
                                Earned from dynamic curve spreads
                            </CardContent>
                        </Card>
                    </div>

                    {/* Filter & Search Bar for Mesh Pools */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 rounded-2xl bg-zinc-950/70 border border-white/10">
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-white/5 text-xs">
                                {(['ALL', 'ACTIVE', 'DEPLETED'] as const).map((st) => (
                                    <button
                                        key={st}
                                        onClick={() => setPoolStatusFilter(st)}
                                        className={`px-2.5 py-1 rounded-lg transition-all font-medium ${
                                            poolStatusFilter === st 
                                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                                                : 'text-zinc-400 hover:text-white'
                                        }`}
                                    >
                                        {st === 'ALL' ? 'All Pools' : st === 'ACTIVE' ? 'Active Liquidity' : 'Depleted / Spent'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="relative w-full md:w-80">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <Input
                                placeholder="Search by pair, token, covenant address..."
                                value={poolSearchTerm}
                                onChange={(e) => setPoolSearchTerm(e.target.value)}
                                className="pl-9 h-9 bg-zinc-900 border-white/10 text-xs rounded-xl text-zinc-200 placeholder:text-zinc-600 focus:border-blue-500"
                            />
                        </div>
                    </div>

                    {/* Deployed Mesh Pools Cards / Table */}
                    <div className="space-y-4">
                        {filteredMeshPools.length === 0 ? (
                            <div className="p-12 text-center rounded-2xl border border-white/10 bg-zinc-950 text-zinc-500 font-mono text-xs">
                                No deployed mesh pools found matching query.
                            </div>
                        ) : (
                            filteredMeshPools.map((pool) => {
                                const isExpanded = expandedPoolId === pool.id;
                                return (
                                    <div 
                                        key={pool.id} 
                                        className={`rounded-2xl border transition-all ${
                                            isExpanded 
                                                ? 'bg-zinc-900/90 border-blue-500/40 shadow-xl ring-1 ring-blue-500/20' 
                                                : 'bg-zinc-950/80 border-white/10 hover:border-white/20'
                                        } overflow-hidden`}
                                    >
                                        {/* Main Pool Header Summary */}
                                        <div 
                                            className="p-4 cursor-pointer flex flex-col lg:flex-row lg:items-center justify-between gap-4 select-none"
                                            onClick={() => setExpandedPoolId(isExpanded ? null : pool.id)}
                                        >
                                            <div className="flex items-start sm:items-center gap-3">
                                                <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                                                    <Layers className="w-5 h-5" />
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="font-heading font-bold text-white text-base">
                                                            {pool.pair}
                                                        </span>
                                                        <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-[10px] font-mono py-0">
                                                            {pool.curveName || 'Concentrated'}
                                                        </Badge>
                                                        {pool.isSpent ? (
                                                            <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700 text-[10px] py-0">
                                                                Depleted
                                                            </Badge>
                                                        ) : (
                                                            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] py-0">
                                                                Active Pool
                                                            </Badge>
                                                        )}
                                                        <Badge variant="outline" className="text-zinc-400 text-[10px] font-mono py-0">
                                                            {pool.fillsCount} {pool.fillsCount === 1 ? 'fill' : 'fills'} passed
                                                        </Badge>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
                                                        <span>Covenant: {shortenAddr(pool.address)}</span>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                copyToClipboard(pool.address, `cov_${pool.id}`);
                                                            }}
                                                            className="text-zinc-500 hover:text-white transition-colors"
                                                            title="Copy Covenant Address"
                                                        >
                                                            {copiedKey === `cov_${pool.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                                        </button>
                                                        {pool.addressExplorerUrl && (
                                                            <a 
                                                                href={pool.addressExplorerUrl} 
                                                                target="_blank" 
                                                                rel="noreferrer"
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="text-zinc-500 hover:text-blue-400 transition-colors"
                                                            >
                                                                <ExternalLink className="w-3 h-3" />
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Pool Reserves & Parameters Metric Grid */}
                                            <div className="flex flex-wrap items-center gap-6 text-xs font-mono">
                                                <div>
                                                    <div className="text-[10px] text-zinc-500 uppercase">BCH Reserve</div>
                                                    <div className="font-bold text-emerald-400 text-sm">
                                                        {pool.reserveBch} BCH
                                                    </div>
                                                    <div className="text-[10px] text-zinc-500">
                                                        {pool.reserveSats} sats
                                                    </div>
                                                </div>

                                                <div>
                                                    <div className="text-[10px] text-zinc-500 uppercase">{pool.symbolOut || 'Token'} Reserve</div>
                                                    <div className="font-bold text-white text-sm">
                                                        {pool.tokenAmountOut || '0'}
                                                    </div>
                                                    <div className="text-[10px] text-zinc-500">
                                                        Category: {pool.tokenCategoryOut ? shortenAddr(pool.tokenCategoryOut) : 'N/A'}
                                                    </div>
                                                </div>

                                                <div>
                                                    <div className="text-[10px] text-zinc-500 uppercase">Fee / Spread</div>
                                                    <div className="text-zinc-200">
                                                        Fee: <span className="text-cyan-400 font-semibold">{pool.feeBps / 100}%</span>
                                                    </div>
                                                    <div className="text-[10px] text-zinc-500">
                                                        Spread: {pool.spreadBps / 100}%
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-8 border-white/10 text-xs bg-zinc-900 hover:bg-zinc-800 text-zinc-200"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            copyToClipboard(JSON.stringify(pool, null, 2), `json_${pool.id}`);
                                                        }}
                                                    >
                                                        {copiedKey === `json_${pool.id}` ? (
                                                            <><Check className="w-3 h-3 mr-1 text-emerald-400" /> Copied JSON</>
                                                        ) : (
                                                            <><Copy className="w-3 h-3 mr-1" /> Copy Specs</>
                                                        )}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 px-2 text-zinc-400 hover:text-white"
                                                    >
                                                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expanded Section: Covenant Details & Full Fills History */}
                                        {isExpanded && (
                                            <div className="border-t border-white/10 p-5 bg-black/40 space-y-6">
                                                {/* Parameter Details Cards */}
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
                                                    <div className="p-3 rounded-xl bg-zinc-900/80 border border-white/5 space-y-1">
                                                        <div className="text-zinc-500 text-[10px] uppercase">UTXO Outpoint</div>
                                                        <div className="text-zinc-200 break-all flex items-center justify-between">
                                                            <span>{pool.txid}:{pool.vout}</span>
                                                            <a 
                                                                href={pool.explorerUrl} 
                                                                target="_blank" 
                                                                rel="noreferrer" 
                                                                className="text-zinc-500 hover:text-blue-400 ml-1 inline-flex shrink-0"
                                                            >
                                                                <ExternalLink className="w-3 h-3" />
                                                            </a>
                                                        </div>
                                                    </div>

                                                    <div className="p-3 rounded-xl bg-zinc-900/80 border border-white/5 space-y-1">
                                                        <div className="text-zinc-500 text-[10px] uppercase">Owner / Creator PKH</div>
                                                        <div className="text-zinc-200 break-all">{pool.ownerPkh || 'N/A'}</div>
                                                    </div>

                                                    <div className="p-3 rounded-xl bg-zinc-900/80 border border-white/5 space-y-1">
                                                        <div className="text-zinc-500 text-[10px] uppercase">Price Ratio & Bounds</div>
                                                        <div className="text-cyan-400 font-semibold">
                                                            {pool.priceNum}/{pool.priceDen} (Ratio: {(pool.priceNum / (pool.priceDen || 1)).toFixed(6)})
                                                        </div>
                                                        <div className="text-[10px] text-zinc-500">
                                                            Range: {pool.rangeLow} ➔ {pool.rangeHigh}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Fills Passed Section */}
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <Zap className="w-4 h-4 text-blue-400" />
                                                            <h4 className="text-sm font-heading font-bold text-white uppercase tracking-wider">
                                                                Fills Passed Through This Mesh Pool ({pool.fills.length})
                                                            </h4>
                                                        </div>
                                                        {pool.fills.length > 0 && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-7 text-[11px] font-mono border-white/10 bg-zinc-900 hover:bg-zinc-800 text-zinc-300"
                                                                onClick={() => copyToClipboard(JSON.stringify(pool.fills, null, 2), `fills_${pool.id}`)}
                                                            >
                                                                {copiedKey === `fills_${pool.id}` ? (
                                                                    <><Check className="w-3 h-3 mr-1 text-emerald-400" /> Fills Copied</>
                                                                ) : (
                                                                    <><Copy className="w-3 h-3 mr-1" /> Copy All Fills JSON</>
                                                                )}
                                                            </Button>
                                                        )}
                                                    </div>

                                                    {pool.fills.length === 0 ? (
                                                        <div className="p-6 rounded-xl bg-zinc-900/50 border border-white/5 text-center text-zinc-500 font-mono text-xs">
                                                            No fills have passed through this specific covenant outpoint yet. The solver will automatically split or route fills into this pool when incoming order prices match this pool's curve parameters.
                                                        </div>
                                                    ) : (
                                                        <div className="rounded-xl border border-white/10 bg-zinc-950 overflow-hidden">
                                                            <div className="overflow-x-auto">
                                                                <table className="w-full text-left text-xs border-collapse">
                                                                    <thead>
                                                                        <tr className="border-b border-white/10 bg-zinc-900/80 text-zinc-400 font-mono text-[11px] uppercase">
                                                                            <th className="py-2.5 px-3">Fill TXID</th>
                                                                            <th className="py-2.5 px-3">Amount In</th>
                                                                            <th className="py-2.5 px-3">Tokens Out</th>
                                                                            <th className="py-2.5 px-3">Fee Accrued</th>
                                                                            <th className="py-2.5 px-3 text-right">Time & Explorer</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-white/5 font-mono text-zinc-300">
                                                                        {pool.fills.map((f, idx) => (
                                                                            <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                                                                                <td className="py-2.5 px-3">
                                                                                    <div className="flex items-center gap-1.5">
                                                                                        <span className="font-semibold text-white">{shortenAddr(f.txid)}</span>
                                                                                        <button
                                                                                            onClick={() => copyToClipboard(f.txid, `ftx_${idx}`)}
                                                                                            className="text-zinc-500 hover:text-white transition-colors"
                                                                                        >
                                                                                            {copiedKey === `ftx_${idx}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                                                                        </button>
                                                                                    </div>
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-emerald-400 font-semibold">
                                                                                    {f.amountInSats ? `${f.amountInSats} sats` : `${f.amountIn} BCH`}
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-white font-semibold">
                                                                                    {f.tokenAmountOut}
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-purple-400 font-semibold">
                                                                                    +{f.feeSats} sats
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-right">
                                                                                    <div className="flex items-center justify-end gap-2 text-zinc-400">
                                                                                        <span>{new Date(f.timestamp * 1000).toLocaleTimeString()}</span>
                                                                                        {f.explorerUrl && (
                                                                                            <a
                                                                                                href={f.explorerUrl}
                                                                                                target="_blank"
                                                                                                rel="noreferrer"
                                                                                                className="text-zinc-500 hover:text-blue-400 transition-colors"
                                                                                            >
                                                                                                <ExternalLink className="w-3.5 h-3.5" />
                                                                                            </a>
                                                                                        )}
                                                                                    </div>
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </TabsContent>

                {/* TAB 3: Token Volume Analytics */}
                <TabsContent value="tokens" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {stats?.tokensTraded?.map((tok) => (
                            <Card key={tok.symbol} className="bg-zinc-950 border-white/10 shadow-lg">
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                                            <span>{tok.symbol}</span>
                                            <Badge variant="outline" className="text-[10px] font-mono text-zinc-400">
                                                {tok.swapsCount} Swaps
                                            </Badge>
                                        </CardTitle>
                                        <Coins className="w-4 h-4 text-emerald-400" />
                                    </div>
                                    <CardDescription className="text-xs text-zinc-400 font-mono truncate">
                                        {tok.category}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="pt-2">
                                    <div className="flex justify-between items-baseline">
                                        <div className="text-2xl font-bold font-mono text-emerald-400">
                                            ${tok.volumeUsd}
                                        </div>
                                        <div className="text-xs text-zinc-400 font-mono">
                                            {tok.volumeBch} BCH
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                {/* TAB 3: System & Covenant Health */}
                <TabsContent value="solver" className="space-y-4">
                    <Card className="bg-zinc-950 border-white/10 shadow-lg">
                        <CardHeader>
                            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                                <Cpu className="w-5 h-5 text-cyan-400" />
                                BCH Solver Covenant Configuration
                            </CardTitle>
                            <CardDescription className="text-xs text-zinc-400">
                                Solver node parameters, protocol treasury, and fee structure
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-xs font-mono text-zinc-300">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-3.5 rounded-xl bg-zinc-900 border border-white/5 space-y-1.5">
                                    <div className="text-zinc-500 uppercase text-[10px]">Protocol Treasury PKH</div>
                                    <div className="text-emerald-400 font-semibold break-all">{solverInfo?.protocolTreasuryPkh || '0x...'}</div>
                                    <div className="text-[10px] text-zinc-500">Receives 50% of trade surplus on Dutch auctions</div>
                                </div>
                                <div className="p-3.5 rounded-xl bg-zinc-900 border border-white/5 space-y-1.5">
                                    <div className="text-zinc-500 uppercase text-[10px]">Solver Node Endpoint</div>
                                    <div className="text-cyan-400 font-semibold break-all">{baseUrl}</div>
                                    <div className="text-[10px] text-zinc-500">WebSocket / REST solver relayer</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 4: Solver Balance, Mesh Balance & Cauldron Liquidity */}
                <TabsContent value="liquidity" className="space-y-6 animate-in fade-in-50">
                    {/* Top 3 Metric Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* 1. Solver Gas & Wallet Balance */}
                        <Card className="bg-zinc-950 border-white/10 shadow-lg">
                            <CardHeader className="pb-2">
                                <CardDescription className="text-xs text-zinc-400 flex items-center justify-between font-mono">
                                    <span className="flex items-center gap-1.5">
                                        <ShieldCheck className="w-4 h-4 text-cyan-400" />
                                        SOLVER GAS & INVENTORY
                                    </span>
                                    <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 text-[10px]">
                                        15s Polling
                                    </Badge>
                                </CardDescription>
                                <CardTitle className="text-2xl font-mono font-bold text-white mt-1">
                                    {solverInfo?.balanceBch || '0.0000'} <span className="text-sm font-normal text-zinc-400">BCH</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-xs font-mono text-zinc-300 pt-0">
                                <div className="text-zinc-500 text-[11px]">
                                    Raw: <span className="text-emerald-400 font-semibold">{solverInfo?.balanceSats || '0'}</span> satoshis
                                </div>
                                <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-white/5 space-y-1">
                                    <div className="flex justify-between text-[11px]">
                                        <span className="text-zinc-500">Pure BCH UTXOs (Gas):</span>
                                        <span className="text-white font-semibold">{solverInfo?.utxoCount ?? 0}</span>
                                    </div>
                                    <div className="flex justify-between text-[11px]">
                                        <span className="text-zinc-500">Token UTXOs (Inventory):</span>
                                        <span className="text-white font-semibold">{solverInfo?.tokenUtxosCount ?? 0}</span>
                                    </div>
                                    <div className="flex justify-between text-[11px]">
                                        <span className="text-zinc-500">Active Intents Watched:</span>
                                        <span className="text-cyan-400 font-semibold">{solverInfo?.activeIntentsWatched ?? 0}</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[11px]">
                                    <span className="text-zinc-500">Address:</span>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-zinc-300 font-mono">{shortenAddr(solverInfo?.address || 'bchtest:...')}</span>
                                        {solverInfo?.address && (
                                            <>
                                                <button 
                                                    onClick={() => copyToClipboard(solverInfo.address, 'solver-bal-addr')} 
                                                    className="text-zinc-500 hover:text-white"
                                                    title="Copy address"
                                                >
                                                    {copiedKey === 'solver-bal-addr' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                                </button>
                                                <a 
                                                    href={`https://chipnet.imaginary.cash/address/${solverInfo.address}`} 
                                                    target="_blank" 
                                                    rel="noreferrer"
                                                    className="text-cyan-400 hover:text-cyan-300"
                                                    title="View on Explorer"
                                                >
                                                    <ExternalLink className="w-3 h-3" />
                                                </a>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 2. Mesh Strategy LP Covenants Balance */}
                        <Card className="bg-zinc-950 border-white/10 shadow-lg">
                            <CardHeader className="pb-2">
                                <CardDescription className="text-xs text-zinc-400 flex items-center justify-between font-mono">
                                    <span className="flex items-center gap-1.5">
                                        <Layers className="w-4 h-4 text-blue-400" />
                                        MESH LP STRATEGY TVL
                                    </span>
                                    <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-[10px]">
                                        Zero-Inventory
                                    </Badge>
                                </CardDescription>
                                <CardTitle className="text-2xl font-mono font-bold text-white mt-1">
                                    {meshPools.reduce((acc, p) => acc + Number(p.reserveBch || 0), 0).toFixed(4)} <span className="text-sm font-normal text-zinc-400">BCH</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-xs font-mono text-zinc-300 pt-0">
                                <div className="text-zinc-500 text-[11px]">
                                    ≈ <span className="text-cyan-400 font-semibold">${meshPools.reduce((acc, p) => acc + Number(p.reserveUsd || 0), 0).toFixed(2)} USD</span> in LP covenants
                                </div>
                                <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-white/5 space-y-1">
                                    <div className="flex justify-between text-[11px]">
                                        <span className="text-zinc-500">Active Strategy Pools:</span>
                                        <span className="text-emerald-400 font-semibold">{meshPools.filter(p => !p.isSpent).length} pools</span>
                                    </div>
                                    <div className="flex justify-between text-[11px]">
                                        <span className="text-zinc-500">Total LP Fees Earned:</span>
                                        <span className="text-white font-semibold">
                                            {meshPools.reduce((acc, p) => acc + Number(p.earnedFeeBch || 0), 0).toFixed(6)} BCH
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-[11px]">
                                        <span className="text-zinc-500">Historical Fills Routed:</span>
                                        <span className="text-white font-semibold">{meshPools.reduce((acc, p) => acc + p.fillsCount, 0)} fills</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[11px]">
                                    <span className="text-zinc-500">Covenant Types:</span>
                                    <span className="text-zinc-300">Oracle & Multi-Pair Recycled</span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 3. Cauldron AMM Testnet Liquidity */}
                        <Card className="bg-zinc-950 border-white/10 shadow-lg">
                            <CardHeader className="pb-2">
                                <CardDescription className="text-xs text-zinc-400 flex items-center justify-between font-mono">
                                    <span className="flex items-center gap-1.5">
                                        <Flame className="w-4 h-4 text-emerald-400" />
                                        CAULDRON AMM LIQUIDITY
                                    </span>
                                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
                                        Chipnet Testnet
                                    </Badge>
                                </CardDescription>
                                <CardTitle className="text-2xl font-mono font-bold text-emerald-400 mt-1">
                                    {(cauldronTokens.reduce((acc, t) => acc + Number(t.tvlSats || 0), 0) / 1e8).toFixed(4)} <span className="text-sm font-normal text-zinc-400">BCH</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-xs font-mono text-zinc-300 pt-0">
                                <div className="text-zinc-500 text-[11px]">
                                    Total Cauldron Pool Liquidity across <span className="text-white font-semibold">{cauldronTokens.length}</span> tokens
                                </div>
                                <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-white/5 space-y-1">
                                    <div className="flex justify-between text-[11px]">
                                        <span className="text-zinc-500">Active Testnet Tokens:</span>
                                        <span className="text-emerald-400 font-semibold">{cauldronTokens.length} Tokens</span>
                                    </div>
                                    <div className="flex justify-between text-[11px]">
                                        <span className="text-zinc-500">Fee Tier Standard:</span>
                                        <span className="text-white font-semibold">0.30% (30 bps)</span>
                                    </div>
                                    <div className="flex justify-between text-[11px]">
                                        <span className="text-zinc-500">Auto-Refreshed:</span>
                                        <span className="text-emerald-400 font-semibold">Every 15 Seconds</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[11px]">
                                    <span className="text-zinc-500">AMM Engine:</span>
                                    <span className="text-zinc-300">Constant Product CPMM</span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Cauldron Testnet Tokens & Pools Registry Table */}
                    <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-zinc-950/80 border border-white/10">
                            <div>
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    <Flame className="w-4 h-4 text-emerald-400" />
                                    Cauldron Chipnet Testnet Tokens & AMM Pool Liquidity
                                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-mono">
                                        {cauldronTokens.length} Active Tokens
                                    </Badge>
                                </h3>
                                <p className="text-xs text-zinc-400 mt-0.5">
                                    Live reserves, prices, TVL and contract pool addresses for all CashTokens registered on Cauldron testnet
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative w-full sm:w-64">
                                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500" />
                                    <Input
                                        placeholder="Search symbol, category, address..."
                                        value={tokenSearchTerm}
                                        onChange={(e) => setTokenSearchTerm(e.target.value)}
                                        className="h-8 pl-8 text-xs bg-zinc-900 border-white/10 rounded-xl"
                                    />
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => fetchData(true)}
                                    disabled={isRefreshing}
                                    className="h-8 px-2.5 text-xs border-white/10 hover:bg-white/5 text-zinc-300"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
                                </Button>
                            </div>
                        </div>

                        {/* Tokens List Table */}
                        <div className="rounded-2xl bg-zinc-950 border border-white/10 overflow-hidden shadow-xl">
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs font-mono text-left">
                                    <thead className="bg-zinc-900/90 text-zinc-400 uppercase text-[10px] border-b border-white/10">
                                        <tr>
                                            <th className="p-3.5">Token / Symbol</th>
                                            <th className="p-3.5">Category ID</th>
                                            <th className="p-3.5">Spot Price</th>
                                            <th className="p-3.5">Cauldron Pool TVL</th>
                                            <th className="p-3.5">Pool Address</th>
                                            <th className="p-3.5 text-right">Simulator</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 text-zinc-300">
                                        {cauldronTokens
                                            .filter(t => {
                                                if (!tokenSearchTerm) return true;
                                                const term = tokenSearchTerm.toLowerCase();
                                                return (
                                                    t.symbol.toLowerCase().includes(term) ||
                                                    t.name.toLowerCase().includes(term) ||
                                                    t.categoryId.toLowerCase().includes(term) ||
                                                    (t.poolAddress && t.poolAddress.toLowerCase().includes(term))
                                                );
                                            })
                                            .map((tok) => {
                                                const tvlBch = (Number(tok.tvlSats || 0) / 1e8).toFixed(4);
                                                const priceBch = (Number(tok.priceSats || 0) / 1e8).toFixed(6);
                                                return (
                                                    <tr key={tok.categoryId} className="hover:bg-white/[0.02] transition-colors">
                                                        <td className="p-3.5">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center font-bold text-emerald-400 text-xs">
                                                                    {tok.symbol.slice(0, 3)}
                                                                </div>
                                                                <div>
                                                                    <div className="font-bold text-white text-xs">{tok.symbol}</div>
                                                                    <div className="text-[10px] text-zinc-500">{tok.name || 'CashToken'} • {tok.decimals} Decimals</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-3.5">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-zinc-300 truncate max-w-[140px]" title={tok.categoryId}>
                                                                    {tok.categoryId.slice(0, 8)}...{tok.categoryId.slice(-6)}
                                                                </span>
                                                                <button 
                                                                    onClick={() => copyToClipboard(tok.categoryId, `cat-${tok.categoryId}`)} 
                                                                    className="text-zinc-500 hover:text-white"
                                                                    title="Copy Category ID"
                                                                >
                                                                    {copiedKey === `cat-${tok.categoryId}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                                                </button>
                                                                <a 
                                                                    href={`https://chipnet.chaingraph.cash/token/${tok.categoryId}`} 
                                                                    target="_blank" 
                                                                    rel="noreferrer"
                                                                    className="text-cyan-400 hover:text-cyan-300"
                                                                    title="View CashToken on Explorer"
                                                                >
                                                                    <ExternalLink className="w-3 h-3" />
                                                                </a>
                                                            </div>
                                                        </td>
                                                        <td className="p-3.5">
                                                            <div>
                                                                <span className="text-emerald-400 font-semibold">{tok.priceSats || '0'} sats</span>
                                                                {tok.priceUsd ? (
                                                                    <div className="text-[10px] text-zinc-500">${tok.priceUsd.toFixed(4)} USD</div>
                                                                ) : (
                                                                    <div className="text-[10px] text-zinc-500">{priceBch} BCH</div>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="p-3.5">
                                                            <div>
                                                                <span className="text-white font-semibold">{tvlBch} BCH</span>
                                                                <div className="text-[10px] text-zinc-500">{tok.tvlSats} sats</div>
                                                            </div>
                                                        </td>
                                                        <td className="p-3.5">
                                                            {tok.poolAddress ? (
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-zinc-300 truncate max-w-[140px]" title={tok.poolAddress}>
                                                                        {shortenAddr(tok.poolAddress)}
                                                                    </span>
                                                                    <button 
                                                                        onClick={() => copyToClipboard(tok.poolAddress!, `pool-${tok.categoryId}`)} 
                                                                        className="text-zinc-500 hover:text-white"
                                                                        title="Copy Pool Address"
                                                                    >
                                                                        {copiedKey === `pool-${tok.categoryId}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                                                    </button>
                                                                    <a 
                                                                        href={`https://chipnet.imaginary.cash/address/${tok.poolAddress}`} 
                                                                        target="_blank" 
                                                                        rel="noreferrer"
                                                                        className="text-cyan-400 hover:text-cyan-300"
                                                                        title="View Pool on Explorer"
                                                                    >
                                                                        <ExternalLink className="w-3 h-3" />
                                                                    </a>
                                                                </div>
                                                            ) : (
                                                                <span className="text-zinc-600">Dynamic CPMM</span>
                                                            )}
                                                        </td>
                                                        <td className="p-3.5 text-right">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => {
                                                                    setQuoteTestIn('BCH');
                                                                    setQuoteTestOut(tok.categoryId);
                                                                    setQuoteTestAmount('0.01');
                                                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                                                }}
                                                                className="h-6 px-2 text-[10px] border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 rounded-lg"
                                                            >
                                                                Test Quote
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        {cauldronTokens.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="p-8 text-center text-zinc-500">
                                                    Loading Cauldron Chipnet Tokens Registry...
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Deep Swap Inspector Modal */}
            <Dialog open={!!selectedSwap} onOpenChange={(open) => !open && setSelectedSwap(null)}>
                <DialogContent className="max-w-2xl bg-[#0a0a0a] border border-white/15 text-zinc-100 p-6 rounded-2xl shadow-2xl">
                    <DialogHeader>
                        <div className="flex items-center justify-between">
                            <DialogTitle className="text-xl font-heading font-black text-white flex items-center gap-2">
                                <Zap className="w-5 h-5 text-emerald-400" />
                                Swap Lifecycle Analysis
                            </DialogTitle>
                            {selectedSwap && getStatusBadge(selectedSwap.status)}
                        </div>
                        <DialogDescription className="text-xs text-zinc-400 font-mono">
                            Intent ID: {selectedSwap?.id}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedSwap && (
                        <div className="space-y-5 pt-2 text-xs">
                            {/* Execution Route Card */}
                            <div className="p-4 rounded-xl bg-zinc-900/80 border border-white/10 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-zinc-400 font-medium">Executed Routing Path</span>
                                    {getRouteBadge(selectedSwap.route)}
                                </div>

                                {/* Flow Diagram */}
                                <div className="flex items-center justify-between p-3 rounded-lg bg-black/50 border border-white/5">
                                    <div className="text-center">
                                        <div className="text-[10px] text-zinc-500 uppercase">Input Amount</div>
                                        <div className="font-mono font-bold text-white text-sm">
                                            {selectedSwap.amountInFormatted} {selectedSwap.tokenInSymbol}
                                        </div>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-emerald-400 animate-pulse" />
                                    <div className="text-center">
                                        <div className="text-[10px] text-zinc-500 uppercase">Output Received</div>
                                        <div className="font-mono font-bold text-emerald-400 text-sm">
                                            {selectedSwap.amountOutFormatted} {selectedSwap.tokenOutSymbol}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Financial Accounting Breakdown */}
                            <div className="p-4 rounded-xl bg-zinc-900/80 border border-white/10 space-y-2.5">
                                <div className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                                    Financial Settlement & Profit Matrix
                                </div>
                                <div className="space-y-1.5 font-mono text-zinc-300">
                                    <div className="flex justify-between">
                                        <span className="text-zinc-500">Solver Realized Profit:</span>
                                        <span className="text-emerald-400 font-bold">+{selectedSwap.solverProfitSats} sats (+${selectedSwap.solverProfitUsd})</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-zinc-500">User Surplus Share:</span>
                                        <span className="text-cyan-400">+{selectedSwap.userBonusSats} sats</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-zinc-500">Protocol Treasury Fee:</span>
                                        <span>{selectedSwap.protocolSurplusSats} sats</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-zinc-500">Miner Gas Fee:</span>
                                        <span className="text-zinc-400">{selectedSwap.minerFeeSats} sats</span>
                                    </div>
                                </div>
                            </div>

                            {/* Routing Diagnostics & Unfilled Reason Analysis */}
                            <div className="p-4 rounded-xl bg-zinc-900/90 border border-white/10 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                                        <Info className="w-3.5 h-3.5 text-cyan-400" />
                                        Lifecycle Diagnostics & Route Evaluation
                                    </span>
                                    <Badge variant="outline" className="text-[10px] font-mono text-zinc-400">
                                        {selectedSwap.status === 'FILLED' ? 'Executed On-Chain' : 'Active in Solver Scanner'}
                                    </Badge>
                                </div>
                                
                                <div className="p-3 rounded-lg bg-black/60 border border-white/5 font-mono text-[11px] text-zinc-300 space-y-1.5 leading-relaxed">
                                    {selectedSwap.status === 'FILLED' ? (
                                        <p className="text-emerald-400">
                                            ✅ <strong>Fill Confirmed:</strong> Intent executed via{' '}
                                            {selectedSwap.route === 'CAULDRON_AMM'
                                                ? '🔥 Cauldron AMM — direct decentralised pool swap with 0.3% treasury fee output'
                                                : selectedSwap.route === 'SOLVER_ROUTE'
                                                ? '⚡ Solver Route — JIT inventory fill by solver wallet advancing tokens'
                                                : selectedSwap.route === 'MESH_POOL'
                                                ? '🔷 Mesh Pool — zero-inventory BCH covenant strategy match'
                                                : '🌊 Waterfall Blended — split execution across Mesh + Cauldron venues'
                                            }. Atomic transaction verified on-chain.
                                        </p>
                                    ) : (
                                        <div className="space-y-1">
                                            <p className="text-amber-400">
                                                ⏳ <strong>Pending Solver Match:</strong> Intent is live in the solver mempool scanner.
                                            </p>
                                            <p className="text-zinc-400">
                                                • <strong>Minimum Floor:</strong> Requires at least{' '}
                                                <span className="text-zinc-200">{selectedSwap.minAmountOutRaw}</span>{' '}
                                                units of {selectedSwap.tokenOutSymbol}.
                                            </p>
                                            <p className="text-zinc-400">
                                                • <strong>Route Waterfall:</strong> Solver checks Mesh Pool depth ➔ Solver Inventory ➔ Cauldron AMM fallback in sequence.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Addresses & On-Chain Keys */}
                            <div className="space-y-2 font-mono text-[11px]">
                                <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900 border border-white/5">
                                    <span className="text-zinc-500">Maker Address:</span>
                                    <span className="text-zinc-300 truncate max-w-[320px]">{selectedSwap.makerAddress}</span>
                                </div>
                                <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900 border border-white/5">
                                    <span className="text-zinc-500">Covenant P2SH32:</span>
                                    <span className="text-zinc-300 truncate max-w-[320px]">{selectedSwap.contractAddress}</span>
                                </div>
                                {selectedSwap.fillTxid && (
                                    <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900 border border-emerald-500/20">
                                        <span className="text-emerald-400">Fill TXID:</span>
                                        <a 
                                            href={selectedSwap.explorerUrl} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="text-emerald-400 hover:underline flex items-center gap-1"
                                        >
                                            <span className="truncate max-w-[280px]">{selectedSwap.fillTxid}</span>
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    </div>
                                )}
                            </div>

                            {/* Actions & Copy Buttons */}
                            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-white/10">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => copyToClipboard(JSON.stringify({
                                        intentId: selectedSwap.id,
                                        status: selectedSwap.status,
                                        route: selectedSwap.route,
                                        orderType: selectedSwap.orderType,
                                        makerAddress: selectedSwap.makerAddress,
                                        contractAddress: selectedSwap.contractAddress,
                                        input: {
                                            symbol: selectedSwap.tokenInSymbol,
                                            category: selectedSwap.tokenInCategory,
                                            amountRaw: selectedSwap.amountInRaw,
                                            amountFormatted: selectedSwap.amountInFormatted,
                                        },
                                        output: {
                                            symbol: selectedSwap.tokenOutSymbol,
                                            category: selectedSwap.tokenOutCategory,
                                            minAmountOutRaw: selectedSwap.minAmountOutRaw,
                                            amountOutRaw: selectedSwap.amountOutRaw,
                                            amountFormatted: selectedSwap.amountOutFormatted,
                                            effectivePrice: selectedSwap.effectivePrice,
                                        },
                                        economics: {
                                            solverProfitSats: selectedSwap.solverProfitSats,
                                            solverProfitUsd: selectedSwap.solverProfitUsd,
                                            userBonusSats: selectedSwap.userBonusSats,
                                            protocolSurplusSats: selectedSwap.protocolSurplusSats,
                                            minerFeeSats: selectedSwap.minerFeeSats,
                                        },
                                        fillTxid: selectedSwap.fillTxid,
                                        createdAt: selectedSwap.createdAt,
                                        explorerUrl: selectedSwap.explorerUrl,
                                        routingDetails: selectedSwap.routingDetails,
                                    }, null, 2), `json-${selectedSwap.id}`)}
                                    className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 text-xs rounded-xl h-8 px-3"
                                >
                                    {copiedKey === `json-${selectedSwap.id}` ? (
                                        <>
                                            <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                                            Copied Full Debug JSON!
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-3.5 h-3.5 mr-1.5" />
                                            Copy Full Transaction & Analysis Data
                                        </>
                                    )}
                                </Button>

                                <div className="flex items-center gap-2">
                                    <Button 
                                        variant="outline" 
                                        onClick={() => setSelectedSwap(null)}
                                        className="border-white/10 hover:bg-white/5 text-xs rounded-xl h-8"
                                    >
                                        Close
                                    </Button>
                                    {selectedSwap.explorerUrl && (
                                        <Button 
                                            asChild
                                            className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-xs rounded-xl h-8"
                                        >
                                            <a href={selectedSwap.explorerUrl} target="_blank" rel="noreferrer">
                                                View On Chipnet Explorer <ExternalLink className="w-3 h-3 ml-1.5" />
                                            </a>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default AdminPage;
