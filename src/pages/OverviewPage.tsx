import { usePortfolio } from '@/hooks/usePortfolio';
import { useWDK } from '@/context/WDKProvider';
import { PortfolioChart } from '@/components/portfolio/PortfolioChart';
import { PortfolioTokens } from '@/components/portfolio/PortfolioTokens';
import { PortfolioActivity } from '@/components/portfolio/PortfolioActivity';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, MoreHorizontal, ChevronUp, ArrowDownUp, Check, Gift, Trophy, Activity, Wallet } from 'lucide-react';
import { ConnectWalletButton } from '@/components/connect-wallet-button';
import { SendModal } from '@/components/portfolio/SendModal';
import { ReceiveModal } from '@/components/portfolio/ReceiveModal';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { notifyToast as toast } from '@/lib/notify-toast';

// ============================================================================
// Overview Page — /overview
// ============================================================================
// Dedicated overview dashboard aggregating total net worth, balance chart,
// multi-chain wallet status, token holdings, activity feed, and quick actions.

export function OverviewPage() {
    const { tokens, totalValue, chartData, loading, isRefetching, isConnected } = usePortfolio({ pollingMs: 30000 });
    const wdk = useWDK();
    const [copied, setCopied] = useState(false);
    const [showMore, setShowMore] = useState(false);

    const primaryAddress = wdk.evmAddress || wdk.solanaAddress || wdk.bchAddress || null;
    const activeAddress = primaryAddress
        ? `${primaryAddress.slice(0, 6)}...${primaryAddress.slice(-4)}`
        : 'Not connected';

    const copyPrimaryAddress = () => {
        if (!primaryAddress) return;
        navigator.clipboard.writeText(primaryAddress);
        setCopied(true);
        toast.success('Address copied');
        setTimeout(() => setCopied(false), 1500);
    };

    const connectedChains = [
        wdk.evmAddress && { color: 'bg-blue-500', icon: '/logos/ethereum-eth-logo.svg', label: 'ETH' },
        wdk.bchAddress && { color: 'bg-emerald-500', icon: '/logos/bitcoin-cash-bch-logo.svg', label: 'BCH' },
        wdk.solanaAddress && { color: 'bg-purple-500', icon: '/assets/solanaLogo.png', label: 'SOL' },
        wdk.btcAddress && { color: 'bg-orange-500', icon: '/logos/bitcoin-btc-logo.svg', label: 'BTC' },
    ].filter(Boolean) as { color: string; icon: string | null; label: string }[];

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

                    <h2 className="text-xl font-semibold text-foreground relative z-10">
                        Connect a wallet <span className="text-muted-foreground font-normal">to view your overview</span>
                    </h2>
                    <div className="mt-4 relative z-10 w-[200px]">
                        <ConnectWalletButton className="w-full text-base h-12 rounded-xl" />
                    </div>
                </div>
            )}

            {/* Top Identity Row */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-emerald-500 to-purple-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                        <Activity className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-xl text-foreground">{activeAddress}</span>
                        {primaryAddress && (
                            <button onClick={copyPrimaryAddress} className="text-muted-foreground hover:text-foreground transition-colors" title="Copy address">
                                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                            </button>
                        )}
                    </div>
                </div>

                {/* Connected chains chip */}
                {connectedChains.length > 0 && (
                    <div className="flex items-center gap-2">
                        <div className="px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-sm font-medium flex items-center gap-2">
                            <div className="flex -space-x-1.5">
                                {connectedChains.map((c, i) => (
                                    <div key={i} className={`h-5 w-5 rounded-full border-2 border-[#0A0A0A] overflow-hidden flex items-center justify-center ${c.icon ? 'bg-black' : c.color}`}>
                                        {c.icon
                                            ? <img src={c.icon} alt={c.label} className="w-3 h-3 object-contain" />
                                            : <span className="text-[8px] text-white font-bold">{c.label}</span>}
                                    </div>
                                ))}
                            </div>
                            {connectedChains.length} {connectedChains.length === 1 ? 'chain' : 'chains'}
                        </div>
                    </div>
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
                            changePercentage24h={tokens[0]?.change24h || 1.04}
                        />
                    )}

                    {/* Tabs for Tokens / Activity */}
                    <Tabs defaultValue="tokens" className="w-full pt-8 border-t border-white/[0.06]">
                        <TabsList className="bg-transparent border-0 p-0 h-auto gap-6 justify-start w-full border-b border-transparent">
                            <TabsTrigger
                                value="tokens"
                                className="px-0 py-2 border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none text-muted-foreground hover:text-foreground text-base font-semibold"
                            >
                                Tokens
                            </TabsTrigger>
                            <TabsTrigger
                                value="activity"
                                className="px-0 py-2 border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none text-muted-foreground hover:text-foreground text-base font-semibold"
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

                            <TabsContent value="activity" className="m-0">
                                <PortfolioActivity />
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>

                {/* Right Column: Quick Actions Widget */}
                <div className="lg:col-span-1">
                    <div className="sticky top-28 grid grid-cols-2 gap-3">
                        <SendModal />
                        <ReceiveModal />
                        <Link to="/mesh" className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] transition-colors group">
                            <div className="text-emerald-400 group-hover:scale-110 transition-transform"><Wallet className="h-5 w-5" /></div>
                            <span className="text-sm font-medium text-foreground">Mesh LP</span>
                        </Link>
                        <button
                            onClick={() => setShowMore(v => !v)}
                            className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] transition-colors group"
                        >
                            <div className="text-muted-foreground group-hover:text-foreground transition-colors">
                                {showMore ? <ChevronUp className="h-5 w-5" /> : <MoreHorizontal className="h-5 w-5" />}
                            </div>
                            <span className="text-sm font-medium text-foreground">{showMore ? 'Less' : 'More'}</span>
                        </button>

                        {showMore && (
                            <>
                                <Link to="/portfolio/referral" className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] transition-colors group">
                                    <div className="text-emerald-400 group-hover:scale-110 transition-transform"><Gift className="h-5 w-5" /></div>
                                    <span className="text-sm font-medium text-foreground">Referral</span>
                                </Link>
                                <Link to="/portfolio/points" className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] transition-colors group">
                                    <div className="text-emerald-400 group-hover:scale-110 transition-transform"><Trophy className="h-5 w-5" /></div>
                                    <span className="text-sm font-medium text-foreground">Points</span>
                                </Link>
                            </>
                        )}

                        <div className="col-span-2 mt-4 p-5 rounded-2xl bg-black/40 border border-white/[0.05] backdrop-blur-md flex justify-between items-center text-sm">
                            <div className="flex flex-col">
                                <span className="text-muted-foreground">Active Mesh Pools</span>
                                <span className="text-xl font-medium text-foreground mt-1">3 Grids</span>
                            </div>
                            <div className="flex flex-col text-right">
                                <span className="text-muted-foreground">Accrued LP Fees</span>
                                <span className="text-xl font-medium text-emerald-400 mt-1">0.0042 BCH</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default OverviewPage;
