import { usePortfolio } from '@/hooks/usePortfolio';
import { useWDK } from '@/context/WDKProvider';
import { useWallets, shortAddress } from '@/hooks/useWallets';
import { useActiveAccounts, type ActiveAccount } from '@/hooks/useActiveAccounts';
import { PortfolioChart } from '@/components/portfolio/PortfolioChart';
import { PortfolioTokens } from '@/components/portfolio/PortfolioTokens';
import { PortfolioActivity } from '@/components/portfolio/PortfolioActivity';
import { PortfolioNfts } from '@/components/portfolio/PortfolioNfts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, ArrowDownUp, Check, Gift, Trophy, Zap, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { ConnectWalletButton } from '@/components/connect-wallet-button';
import { SendModal } from '@/components/portfolio/SendModal';
import { ReceiveModal } from '@/components/portfolio/ReceiveModal';
import { Link } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { notifyToast as toast } from '@/lib/notify-toast';
import { useMeshLp, useMeshSigner, useMeshStats } from '@/hooks/useMesh';
// ============================================================================
// Portfolio Page — /portfolio
// ============================================================================
// A unified dashboard inspired by Uniswap's wallet/portfolio view.
// It aggregates balances across Movement, Solana, and BCH.

// Quick-action tile — uniform from phone (4-up) to the sidebar (3-up), so nothing is displaced.
const QUICK_TILE = 'group flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/[0.05] bg-white/[0.03] p-3 text-center transition-colors hover:bg-white/[0.06]';
const QUICK_ICON = 'h-5 w-5 text-primary transition-transform group-hover:scale-110';
const QUICK_LABEL = 'text-[11px] font-medium text-foreground';

export default function PortfolioPage() {
    const { tokens, totalValue, change24h, chartData, loading, isRefetching, isConnected } = usePortfolio({ pollingMs: 30000, scope: 'active' });
    const activeAccounts = useActiveAccounts();
    const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

    // Mesh pool stats for the connected wallet (from the server's pool ledger)
    const meshWallet = useMeshSigner();
    const meshLp = useMeshLp(meshWallet.pkh ?? undefined);
    const meshStats = useMeshStats();
    const totalMeshPools = meshLp.data?.lp.activePools ?? 0;
    const accruedFeeBch = Number(meshLp.data?.lp.feesAllSats ?? 0) / 1e8;
    const liveBchPrice = meshStats.data?.bchUsd ?? null;

    const accountsList = useMemo(() => {
        return [
            activeAccounts.bch,
            activeAccounts.evm,
            activeAccounts.solana,
            activeAccounts.btc,
        ].filter(Boolean) as ActiveAccount[];
    }, [activeAccounts]);

    const copyAddress = (addr: string) => {
        navigator.clipboard.writeText(addr);
        setCopiedAddress(addr);
        toast.success('Address copied');
        setTimeout(() => setCopiedAddress(null), 1500);
    };

    return (
        <div className="container mx-auto p-4 md:p-8 max-w-[1000px] mt-6 relative">
            {isRefetching && !loading && (
                <div className="absolute top-0 left-0 right-0 h-0.5 overflow-hidden z-10">
                    <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent animate-loading-bar" />
                </div>
            )}

            {/* Action Banner (if NOT connected) */}
            {!isConnected && (
                <div className="mb-8 w-full p-6 md:p-8 rounded-2xl bg-gradient-to-r from-[#FF007A]/10 to-[#9900FF]/10 border border-primary/20 flex flex-col items-center text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/20 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2" />

                    <h2 className="text-xl font-semibold text-foreground relative z-10">Connect a wallet <span className="text-muted-foreground font-normal">to view your portfolio</span></h2>
                    <div className="mt-4 relative z-10 w-[200px]">
                        <ConnectWalletButton className="w-full text-base h-12 rounded-xl" />
                    </div>
                </div>
            )}

            {/* Top Identity Row: one chip per active account (P4) */}
            <div className="flex flex-wrap items-center gap-2.5 mb-8">
                {accountsList.length > 0 ? (
                    accountsList.map(acc => {
                        const isCopied = copiedAddress === acc.address;
                        return (
                            <div
                                key={`${acc.family}-${acc.address}`}
                                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs transition-colors hover:bg-white/[0.07]"
                            >
                                <span
                                    className="h-2 w-2 rounded-full flex-shrink-0"
                                    style={{ background: acc.color }}
                                />
                                <span className="font-bold uppercase tracking-wider text-white/50 text-[10px]">
                                    {acc.family}
                                </span>
                                <span className="font-semibold text-white/80">
                                    {acc.label}
                                </span>
                                <span className="font-mono text-white/45 text-[11px]">
                                    {shortAddress(acc.address, 6, 4)}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => copyAddress(acc.address)}
                                    className="text-white/40 hover:text-white transition-colors ml-0.5"
                                    title="Copy address"
                                >
                                    {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                                </button>
                            </div>
                        );
                    })
                ) : (
                    <div className="text-sm font-semibold text-white/60">Not connected</div>
                )}
            </div>

            {/* Layout Grid: Left (Chart + Tabs) & Right (Quick Actions) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left Column: Main Content */}
                <div className="lg:col-span-2 flex flex-col space-y-8">
                    {/* Chart */}
                    {loading ? (
                        <div className="flex flex-col w-full">
                            <div className="mb-8 space-y-3">
                                <div className="h-12 w-48 bg-white/[0.05] rounded animate-pulse" />
                                <div className="h-5 w-32 bg-white/[0.04] rounded animate-pulse" />
                            </div>
                            <div className="h-[240px] sm:h-[300px] w-full mt-4 rounded-xl bg-white/[0.03] animate-pulse" />
                            <div className="flex items-center gap-2 mt-6">
                                {['1D', '1W', '1M', '1Y'].map(r => (
                                    <div key={r} className="h-7 w-12 rounded-full bg-white/[0.04] animate-pulse" />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <PortfolioChart
                            data={chartData}
                            totalValue={totalValue}
                            changePercentage24h={change24h}
                        />
                    )}

                    {/* Tabs for Tokens / Activity */}
                    <Tabs defaultValue="tokens" className="w-full pt-8 border-t border-white/[0.06]">
                        <TabsList className="bg-transparent border-0 p-0 h-auto gap-6 justify-start w-full border-b border-transparent">
                            <TabsTrigger
                                value="tokens"
                                className="px-0 py-2 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none text-muted-foreground hover:text-foreground text-base"
                            >
                                Tokens
                            </TabsTrigger>
                            <TabsTrigger
                                value="mesh-nfts"
                                className="px-0 py-2 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none text-muted-foreground hover:text-foreground text-base"
                            >
                                Mesh NFTs
                            </TabsTrigger>
                            <TabsTrigger
                                value="activity"
                                className="px-0 py-2 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none text-muted-foreground hover:text-foreground text-base"
                            >
                                Activity
                            </TabsTrigger>
                        </TabsList>

                        <div className="mt-8">
                            <TabsContent value="tokens" className="m-0">
                                {loading ? (
                                    <div className="w-full">
                                        <div className="mb-4 space-y-2">
                                            <div className="h-6 w-24 bg-white/[0.05] rounded animate-pulse" />
                                            <div className="h-3 w-16 bg-white/[0.04] rounded animate-pulse" />
                                        </div>
                                        <div className="rounded-2xl border border-white/[0.08] bg-black/40 backdrop-blur-md overflow-hidden divide-y divide-white/[0.04]">
                                            {Array.from({ length: 4 }).map((_, i) => (
                                                <div key={i} className="flex items-center justify-between px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 rounded-full bg-white/[0.04] animate-pulse" />
                                                        <div className="space-y-1.5">
                                                            <div className="h-3.5 w-28 bg-white/[0.04] rounded animate-pulse" />
                                                            <div className="h-2.5 w-12 bg-white/[0.03] rounded animate-pulse" />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1.5 text-right">
                                                        <div className="h-3.5 w-20 bg-white/[0.04] rounded animate-pulse ml-auto" />
                                                        <div className="h-2.5 w-14 bg-white/[0.03] rounded animate-pulse ml-auto" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <PortfolioTokens tokens={tokens} />
                                )}
                            </TabsContent>

                            <TabsContent value="mesh-nfts" className="m-0">
                                <PortfolioNfts />
                            </TabsContent>

                            <TabsContent value="activity" className="m-0">
                                <PortfolioActivity />
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>

                {/* Right Column: Quick Actions Widget */}
                <div className="lg:col-span-1">
                    <div className="grid grid-cols-1 gap-4 lg:sticky lg:top-28">
                        {/* Actions — a fixed grid that stays tidy from phone to sidebar */}
                        <div className="grid grid-cols-4 gap-2 lg:grid-cols-3">
                            <SendModal>
                                <button className={QUICK_TILE}>
                                    <ArrowUpRight className={QUICK_ICON} />
                                    <span className={QUICK_LABEL}>Send</span>
                                </button>
                            </SendModal>
                            <ReceiveModal>
                                <button className={QUICK_TILE}>
                                    <ArrowDownLeft className={QUICK_ICON} />
                                    <span className={QUICK_LABEL}>Receive</span>
                                </button>
                            </ReceiveModal>
                            <Link to="/trade" className={QUICK_TILE}>
                                <ArrowDownUp className={QUICK_ICON} />
                                <span className={QUICK_LABEL}>Swap</span>
                            </Link>
                            <Link to="/portfolio/referral" className={QUICK_TILE}>
                                <Gift className={QUICK_ICON} />
                                <span className={QUICK_LABEL}>Referral</span>
                            </Link>
                            <Link to="/portfolio/points" className={QUICK_TILE}>
                                <Trophy className={QUICK_ICON} />
                                <span className={QUICK_LABEL}>Points</span>
                            </Link>
                        </div>

                        {/* ── Mesh LP Stats Card ── */}
                        <div className="space-y-4 rounded-2xl border border-emerald-500/10 bg-black/40 p-5 backdrop-blur-md">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
                                    <Zap className="h-4 w-4 text-emerald-400" />
                                    Active Mesh Pools
                                </div>
                                <Link
                                    to="/mesh/positions"
                                    className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                                >
                                    View all →
                                </Link>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <div className="text-xs text-zinc-500">Grids</div>
                                    <div className="text-2xl font-black font-mono text-white">
                                        {totalMeshPools}
                                    </div>
                                    <div className="text-[11px] text-zinc-500">Active covenant positions</div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-xs text-zinc-500">Accrued LP Fees</div>
                                    <div className="text-2xl font-black font-mono text-emerald-400">
                                        {accruedFeeBch.toFixed(6)} BCH
                                    </div>
                                    <div className="text-[11px] text-zinc-500">
                                        {liveBchPrice ? `≈ $${(accruedFeeBch * liveBchPrice).toFixed(2)}` : 'fees earned by your pools'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
