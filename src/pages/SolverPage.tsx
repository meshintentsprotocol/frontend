// OLD — retired 2026-10-19, kept until the clean-up. Not part of the live app. See devrel-agent-context/walletuidocs/connect/old-code.md.
import { useState, useEffect, useCallback } from 'react';
import { ExternalLink, RefreshCw, Wallet, ArrowRightLeft, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import axios from 'axios';

const BCH_SOLANA_RELAYER_URL = import.meta.env.VITE_CROSS_CHAIN_RELAYER_URL || 'https://cross-chain-relayer-production-a93e.up.railway.app';

const CHAIN_ICONS: Record<string, string> = {
    bch: '/logos/bitcoin-cash-bch-logo.svg',
    solana: '/assets/solanaLogo.png',
    movement: 'https://raw.githubusercontent.com/kitelabs-io/mvmt-tokens/main/logos/MOVE.png',
};

const DIRECTION_LABELS: Record<string, { from: string; to: string; fromChain: string; toChain: string }> = {
    BCH_TO_SOL: { from: 'BCH', to: 'SOL', fromChain: 'bch', toChain: 'solana' },
    SOL_TO_BCH: { from: 'SOL', to: 'BCH', fromChain: 'solana', toChain: 'bch' },
    BCH_TO_MOV: { from: 'BCH', to: 'MOVE', fromChain: 'bch', toChain: 'movement' },
    MOV_TO_BCH: { from: 'MOVE', to: 'BCH', fromChain: 'movement', toChain: 'bch' },
};

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    PENDING: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', icon: <Clock className="w-3 h-3" /> },
    SOURCE_LOCKED: { bg: 'bg-blue-500/10', text: 'text-blue-400', icon: <Clock className="w-3 h-3" /> },
    DEST_FILLED: { bg: 'bg-purple-500/10', text: 'text-purple-400', icon: <TrendingDown className="w-3 h-3" /> },
    DEST_CLAIMED: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', icon: <TrendingUp className="w-3 h-3" /> },
    COMPLETED: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', icon: <CheckCircle className="w-3 h-3" /> },
    FAILED: { bg: 'bg-red-500/10', text: 'text-red-400', icon: <XCircle className="w-3 h-3" /> },
};

function getExplorerLink(direction: string, type: 'fill' | 'claim', intent: any): string | undefined {
    const dir = DIRECTION_LABELS[direction];
    if (!dir) return undefined;

    if (type === 'fill') {
        const tx = intent.destFillTx;
        if (!tx) return undefined;
        if (dir.toChain === 'solana') return `https://explorer.solana.com/tx/${tx}?cluster=devnet`;
        if (dir.toChain === 'bch') return `https://chipnet.chaingraph.cash/tx/${tx}`;
        if (dir.toChain === 'movement') return `https://explorer.movementnetwork.xyz/txn/${tx}?network=testnet`;
    }

    if (type === 'claim') {
        const tx = intent.sourceClaimTx;
        if (!tx) return undefined;
        if (dir.fromChain === 'bch') return `https://chipnet.chaingraph.cash/tx/${tx}`;
        if (dir.fromChain === 'solana') return `https://explorer.solana.com/tx/${tx}?cluster=devnet`;
        if (dir.fromChain === 'movement') return `https://explorer.movementnetwork.xyz/txn/${tx}?network=testnet`;
    }

    return undefined;
}

function formatAmount(raw: string | number, decimals: number): string {
    const n = Number(raw) / Math.pow(10, decimals);
    if (n === 0) return '0';
    if (n < 0.0001) return n.toExponential(2);
    return n.toFixed(Math.min(decimals, 6));
}

function formatTime(ts: number): string {
    if (!ts || ts < 1000000) return '—';
    const d = new Date(ts > 1e12 ? ts : ts * 1000);
    return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

interface SolverData {
    wallets: Record<string, any>;
    financials: { filled: Record<string, number>; claimed: Record<string, number> };
    intents: { active: any[]; completed: any[] };
    stats: { totalActive: number; totalCompleted: number; totalFailed: number };
}

export function SolverPage() {
    const [data, setData] = useState<SolverData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<'active' | 'completed' | 'failed'>('active');

    const fetchData = useCallback(async () => {
        try {
            const res = await axios.get(`${BCH_SOLANA_RELAYER_URL}/solver`);
            setData(res.data);
            setError(null);
        } catch (e: any) {
            setError(e.message || 'Failed to fetch solver data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 8000);
        return () => clearInterval(interval);
    }, [fetchData]);

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
    );

    if (error || !data) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <AlertTriangle className="w-12 h-12 text-red-400" />
            <p className="text-muted-foreground">{error || 'Failed to load solver data'}</p>
            <p className="text-xs text-muted-foreground/60">Ensure the relayer is running at {BCH_SOLANA_RELAYER_URL}</p>
            <button onClick={fetchData} className="px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-lg text-sm hover:bg-emerald-500/20 transition-colors">
                Retry
            </button>
        </div>
    );

    const allIntents = tab === 'active' ? data.intents.active :
        tab === 'failed' ? data.intents.completed.filter(i => i.status === 'FAILED') :
            data.intents.completed.filter(i => i.status !== 'FAILED');

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <Wallet className="w-6 h-6 text-emerald-400" />
                        Solver Dashboard
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">Relayer wallets, balances, and settlement flows</p>
                </div>
                <button onClick={fetchData}
                    className="flex items-center gap-2 px-3 py-2 bg-white/[0.04] border border-white/[0.06] rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-emerald-500/30 transition-all"
                >
                    <RefreshCw className="w-4 h-4" /> Refresh
                </button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Active" value={data.stats.totalActive} color="text-blue-400" />
                <StatCard label="Completed" value={data.stats.totalCompleted - data.stats.totalFailed} color="text-emerald-400" />
                <StatCard label="Failed" value={data.stats.totalFailed} color="text-red-400" />
                <StatCard label="Total" value={data.stats.totalActive + data.stats.totalCompleted} color="text-foreground" />
            </div>

            {/* Wallet Balances */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(data.wallets).map(([chain, wallet]) => (
                    <div key={chain} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 hover:border-white/[0.1] transition-colors">
                        <div className="flex items-center gap-3 mb-4">
                            <img src={CHAIN_ICONS[chain]} className="w-8 h-8 rounded-full" alt={chain} />
                            <div>
                                <div className="font-semibold text-foreground capitalize">{chain === 'movement' ? 'Movement' : chain.toUpperCase()}</div>
                                <div className="text-xs text-muted-foreground font-mono">{wallet.address?.slice(0, 12)}...{wallet.address?.slice(-6)}</div>
                            </div>
                            <a href={wallet.explorer} target="_blank" rel="noopener noreferrer"
                                className="ml-auto text-muted-foreground hover:text-emerald-400 transition-colors">
                                <ExternalLink className="w-4 h-4" />
                            </a>
                        </div>
                        <div className="space-y-1">
                            {chain === 'movement' ? (
                                wallet.balances?.length > 0 ? wallet.balances.map((b: any) => (
                                    <div key={b.symbol} className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">{b.symbol}</span>
                                        <span className="text-foreground font-mono">{b.balance?.toFixed(4)}</span>
                                    </div>
                                )) : <div className="text-sm text-muted-foreground/60">No balances found</div>
                            ) : (
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">{chain.toUpperCase()}</span>
                                    <span className="text-foreground font-mono">{typeof wallet.balance === 'number' ? wallet.balance.toFixed(6) : '—'}</span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Financials — Filled vs Claimed */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                    <ArrowRightLeft className="w-5 h-5 text-emerald-400" />
                    Settlement Flows
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {['bch', 'sol', 'move'].map(chain => (
                        <div key={chain} className="space-y-2">
                            <div className="flex items-center gap-2">
                                <img src={CHAIN_ICONS[chain === 'sol' ? 'solana' : chain === 'move' ? 'movement' : chain]} className="w-5 h-5 rounded-full" alt={chain} />
                                <span className="font-medium text-foreground">{chain.toUpperCase()}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <TrendingDown className="w-4 h-4 text-red-400" />
                                <span className="text-muted-foreground">Filled out:</span>
                                <span className="text-red-400 font-mono ml-auto">{data.financials.filled[chain]?.toFixed(6) || '0'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <TrendingUp className="w-4 h-4 text-emerald-400" />
                                <span className="text-muted-foreground">Claimed in:</span>
                                <span className="text-emerald-400 font-mono ml-auto">{data.financials.claimed[chain]?.toFixed(6) || '0'}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Intent List */}
            <div>
                {/* Tabs */}
                <div className="flex gap-1 mb-4 bg-white/[0.02] p-1 rounded-lg w-fit border border-white/[0.06]">
                    {(['active', 'completed', 'failed'] as const).map(t => (
                        <button key={t} onClick={() => setTab(t)}
                            className={cn(
                                "px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize",
                                tab === t ? "bg-emerald-500/20 text-emerald-400" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {t} ({t === 'active' ? data.intents.active.length :
                                t === 'failed' ? data.intents.completed.filter(i => i.status === 'FAILED').length :
                                    data.intents.completed.filter(i => i.status !== 'FAILED').length})
                        </button>
                    ))}
                </div>

                {allIntents.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground bg-white/[0.02] rounded-xl border border-white/[0.06]">
                        No {tab} intents
                    </div>
                ) : (
                    <div className="space-y-3">
                        {allIntents.map((intent: any) => {
                            const dir = DIRECTION_LABELS[intent.direction] || { from: '?', to: '?', fromChain: '', toChain: '' };
                            const st = STATUS_STYLES[intent.status] || STATUS_STYLES.PENDING;
                            const fillLink = getExplorerLink(intent.direction, 'fill', intent);
                            const claimLink = getExplorerLink(intent.direction, 'claim', intent);
                            const sellDec = dir.from === 'SOL' ? 9 : 8;
                            const buyDec = dir.to === 'SOL' ? 9 : 8;

                            return (
                                <div key={intent.id}
                                    className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 hover:border-white/[0.1] transition-colors"
                                >
                                    {/* Row 1: Direction + Status */}
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-1.5">
                                                <img src={CHAIN_ICONS[dir.fromChain]} className="w-5 h-5 rounded-full" alt="" />
                                                <span className="font-medium text-foreground">{dir.from}</span>
                                                <span className="text-muted-foreground mx-1">→</span>
                                                <img src={CHAIN_ICONS[dir.toChain]} className="w-5 h-5 rounded-full" alt="" />
                                                <span className="font-medium text-foreground">{dir.to}</span>
                                            </div>
                                            <span className={cn("px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1", st.bg, st.text)}>
                                                {st.icon} {intent.status}
                                            </span>
                                            {intent.fillRetries > 0 && (
                                                <span className="text-xs text-orange-400">Retries: {intent.fillRetries}</span>
                                            )}
                                        </div>
                                        <span className="text-xs text-muted-foreground font-mono">{intent.id}</span>
                                    </div>

                                    {/* Row 2: Amounts */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                                        <div>
                                            <span className="text-muted-foreground text-xs block">Sell</span>
                                            <span className="text-red-400 font-mono">{formatAmount(intent.sellAmount, sellDec)} {dir.from}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground text-xs block">Buy</span>
                                            <span className="text-emerald-400 font-mono">{formatAmount(intent.buyAmount, buyDec)} {dir.to}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground text-xs block">Created</span>
                                            <span className="text-foreground/80">{formatTime(intent.createdAt)}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground text-xs block">Updated</span>
                                            <span className="text-foreground/80">{formatTime(intent.updatedAt)}</span>
                                        </div>
                                    </div>

                                    {/* Row 3: Fill / Claim tx links */}
                                    <div className="flex flex-wrap gap-2 text-xs">
                                        {intent.destFillTx && (
                                            <a href={fillLink} target="_blank" rel="noopener noreferrer"
                                                className="flex items-center gap-1 px-2 py-1 rounded bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors"
                                            >
                                                <TrendingDown className="w-3 h-3" />
                                                Fill on {dir.to}: {intent.destFillTx.slice(0, 10)}...
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        )}
                                        {intent.sourceClaimTx && (
                                            <a href={claimLink} target="_blank" rel="noopener noreferrer"
                                                className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                            >
                                                <TrendingUp className="w-3 h-3" />
                                                Claim on {dir.from}: {intent.sourceClaimTx.slice(0, 10)}...
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        )}
                                        {intent.bchContractAddress && (
                                            <a href={`https://chipnet.chaingraph.cash/address/${intent.bchContractAddress}`} target="_blank" rel="noopener noreferrer"
                                                className="flex items-center gap-1 px-2 py-1 rounded bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-colors"
                                            >
                                                HTLC: {intent.bchContractAddress.slice(0, 18)}...
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        )}
                                        {intent.solanaEscrowPda && (
                                            <a href={`https://explorer.solana.com/address/${intent.solanaEscrowPda}?cluster=devnet`} target="_blank" rel="noopener noreferrer"
                                                className="flex items-center gap-1 px-2 py-1 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                                            >
                                                Escrow: {intent.solanaEscrowPda.slice(0, 10)}...
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        )}
                                        {intent.movementEscrowId && (
                                            <span className="flex items-center gap-1 px-2 py-1 rounded bg-white/[0.04] text-muted-foreground">
                                                Movement Escrow #{intent.movementEscrowId}
                                            </span>
                                        )}
                                    </div>

                                    {/* Fail reason */}
                                    {intent.failReason && (
                                        <div className="mt-2 flex items-center gap-2 text-xs text-red-400 bg-red-500/5 rounded px-3 py-1.5">
                                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                                            {intent.failReason}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 text-center">
            <div className={cn("text-2xl font-bold", color)}>{value}</div>
            <div className="text-xs text-muted-foreground mt-1">{label}</div>
        </div>
    );
}
