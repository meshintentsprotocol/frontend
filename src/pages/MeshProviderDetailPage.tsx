import React, { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  MOCK_LEADERBOARD_PROVIDERS,
  MOCK_LEADERBOARD_SWAPS,
  type Timeframe,
  formatUsd,
  getAvatarGradient,
} from '@/lib/meshLeaderboardData';
import { MeshProviderPerformanceChart } from '@/components/mesh/leaderboard/MeshProviderPerformanceChart';
import {
  ArrowLeft,
  Copy,
  Check,
  ExternalLink,
  Search,
  Repeat,
  Layers,
  Inbox,
  ArrowUp,
  HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { notifyToast as toast } from '@/lib/notify-toast';
import { useMeshServer } from '@/hooks/useMeshServer';

const TIMEFRAMES: Timeframe[] = ['7D', '1M', '3M', '6M', 'All'];

export function MeshProviderDetailPage() {
  const { address } = useParams<{ address: string }>();
  const [timeframe, setTimeframe] = useState<Timeframe>('1M');
  const [copied, setCopied] = useState(false);
  const [positionSearch, setPositionSearch] = useState('');
  const [swapSearch, setSwapSearch] = useState('');

  const { positions } = useMeshServer(12_000);

  // Find provider from dataset or fallback to synthesized provider
  const provider = useMemo(() => {
    if (!address) return MOCK_LEADERBOARD_PROVIDERS[0];
    const found = MOCK_LEADERBOARD_PROVIDERS.find(
      (p) => p.address.toLowerCase() === address.toLowerCase()
    );
    if (found) return found;

    return {
      rank: 1,
      rankDelta: 1,
      address,
      shortAddress: `${address.slice(0, 6)}...${address.slice(-4)}`,
      avatarSeed: address,
      volumeUsd: 288412185.68,
      sharedLiquidityUsd: 0,
      putableLiquidityUsd: 0,
      feesUsd: 3161.11,
      apyPct: 88.38,
      positionsCount: 0,
      network: 'BCH Chipnet',
      history: [],
    };
  }, [address]);

  // Provider-specific positions (if owner match or mock)
  const providerPositions = useMemo(() => {
    if (!address) return [];
    return positions.filter(
      (p) =>
        p.address.toLowerCase().includes(address.toLowerCase()) ||
        p.ownerPkh?.toLowerCase().includes(address.toLowerCase())
    );
  }, [positions, address]);

  // Provider swaps feed
  const providerSwaps = useMemo(() => {
    return MOCK_LEADERBOARD_SWAPS.filter((s) => {
      if (!swapSearch.trim()) return true;
      return (
        s.pair.toLowerCase().includes(swapSearch.toLowerCase()) ||
        s.tokenInSymbol.toLowerCase().includes(swapSearch.toLowerCase()) ||
        s.tokenOutSymbol.toLowerCase().includes(swapSearch.toLowerCase())
      );
    });
  }, [swapSearch]);

  const handleCopy = () => {
    if (provider?.address) {
      navigator.clipboard.writeText(provider.address);
      setCopied(true);
      toast.success('Address copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 md:px-8 max-w-[1240px] space-y-8">
      {/* Top Breadcrumb Navigation */}
      <div>
        <Link
          to="/mesh?tab=leaderboard"
          className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Leaderboard</span>
        </Link>
      </div>

      {/* Hero / Identity Section */}
      <div className="w-full bg-[#0038ff] rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-2xl border border-blue-400/20 space-y-6">
        {/* Background glow */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-400/20 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Identity Info */}
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-white/40 shadow-xl flex-shrink-0"
              style={{ background: getAvatarGradient(provider.address) }}
            />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight">
                  {provider.shortAddress}
                </h1>
                <button
                  onClick={handleCopy}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white"
                  title="Copy address"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-blue-200">
                <span className="truncate max-w-[260px] sm:max-w-md">{provider.address}</span>
                <a
                  href={`https://chipnet.imaginary.cash/address/${provider.address}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-200 hover:text-white"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>

          {/* Timeframe Selector Pills */}
          <div className="bg-black/20 backdrop-blur-md p-1 rounded-full border border-white/10 flex items-center gap-1 self-start md:self-auto">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3.5 py-1 text-xs sm:text-sm font-semibold rounded-full transition-all duration-200 ${
                  timeframe === tf
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-blue-100/80 hover:text-white hover:bg-white/10'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Key Metrics Grid */}
        <TooltipProvider>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4 pt-4 border-t border-white/10">
            {/* 1. Rank */}
            <div className="space-y-1">
              <div className="text-xs text-blue-200 font-medium">Rank</div>
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded bg-yellow-400 text-black text-xs font-black font-mono">
                  #{provider.rank}
                </span>
                {provider.rankDelta > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[11px] font-bold font-mono flex items-center">
                    +{provider.rankDelta}
                  </span>
                )}
              </div>
            </div>

            {/* 2. Putable Liquidity */}
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-blue-200 font-medium">
                <span>Putable liquidity</span>
                <HelpCircle className="w-3 h-3 text-blue-300/70" />
              </div>
              <div className="text-lg font-bold font-mono text-white">
                {provider.putableLiquidityUsd > 0
                  ? formatUsd(provider.putableLiquidityUsd)
                  : '—'}
              </div>
            </div>

            {/* 3. Shared Liquidity */}
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-blue-200 font-medium">
                <span>Shared liquidity</span>
                <HelpCircle className="w-3 h-3 text-blue-300/70" />
              </div>
              <div className="text-lg font-bold font-mono text-white">
                ${provider.sharedLiquidityUsd.toFixed(0)}
              </div>
            </div>

            {/* 4. Volume */}
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-blue-200 font-medium">
                <span>Volume, {timeframe}</span>
                <HelpCircle className="w-3 h-3 text-blue-300/70" />
              </div>
              <div className="text-lg font-bold font-mono text-white">
                {formatUsd(provider.volumeUsd)}
              </div>
            </div>

            {/* 5. Fees */}
            <div className="space-y-1">
              <div className="text-xs text-blue-200 font-medium">Fees, {timeframe}</div>
              <div className="text-lg font-bold font-mono text-white">
                {formatUsd(provider.feesUsd)}
              </div>
            </div>

            {/* 6. APY */}
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-blue-200 font-medium">
                <span>APY, {timeframe}</span>
                <HelpCircle className="w-3 h-3 text-blue-300/70" />
              </div>
              <div className="text-lg font-bold font-mono text-emerald-300">
                {provider.apyPct.toFixed(2)}%
              </div>
            </div>

            {/* 7. Positions */}
            <div className="space-y-1">
              <div className="text-xs text-blue-200 font-medium">Positions</div>
              <div className="text-lg font-bold font-mono text-white">
                {providerPositions.length > 0
                  ? providerPositions.length
                  : provider.positionsCount}
              </div>
            </div>
          </div>
        </TooltipProvider>
      </div>

      {/* Performance Chart Section */}
      <MeshProviderPerformanceChart provider={provider} timeframe={timeframe} />

      {/* Bottom 2-Column Grid: Open Positions & Swaps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Open Positions */}
        <div className="bg-[#0b0c10] border border-white/8 rounded-3xl p-5 sm:p-7 space-y-6 shadow-xl flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white font-heading">
              Open positions
            </h3>

            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by token..."
                  value={positionSearch}
                  onChange={(e) => setPositionSearch(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 bg-white/5 border border-white/10 rounded-full text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-zinc-300 font-mono">
                All networks
              </div>
            </div>
          </div>

          {/* Positions Content or Empty State */}
          {providerPositions.length > 0 ? (
            <div className="space-y-3 pt-2">
              {providerPositions.map((pos) => (
                <div
                  key={`${pos.txid}-${pos.vout}`}
                  className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Layers className="w-5 h-5 text-blue-400" />
                    <div>
                      <div className="text-xs font-bold text-white font-mono">
                        {pos.contractType}
                      </div>
                      <div className="text-[11px] text-zinc-400 font-mono">
                        {pos.txid.slice(0, 10)}...:{pos.vout}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-bold text-emerald-400 font-mono">
                      {(Number(pos.reserveSats) / 1e8).toFixed(4)} BCH
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono">
                      Fee: {pos.feeBps / 100}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-500">
                <Inbox className="w-8 h-8 stroke-[1.5]" />
              </div>
              <div className="text-sm font-semibold text-zinc-400">
                No open positions for this wallet yet.
              </div>
              <Link to="/mesh?tab=create">
                <Button className="rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-5 h-8">
                  Create position
                </Button>
              </Link>
            </div>
          )}

          <div />
        </div>

        {/* Right Column: Swaps Activity Feed */}
        <div className="bg-[#0b0c10] border border-white/8 rounded-3xl p-5 sm:p-7 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white font-heading">
                Swaps
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 text-xs font-mono font-bold">
                {providerSwaps.length * 4}
              </span>
            </div>

            <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-zinc-300 font-mono">
              All tokens
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by token..."
              value={swapSearch}
              onChange={(e) => setSwapSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 bg-white/5 border border-white/10 rounded-full text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="space-y-3 divide-y divide-white/[0.04] max-h-[380px] overflow-y-auto pr-1">
            {providerSwaps.map((swap) => (
              <div key={swap.id} className="pt-3 first:pt-0 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px] font-bold">
                      <Repeat className="w-3 h-3" />
                    </div>
                    <span className="text-xs font-bold text-white font-mono">
                      {swap.pair}
                    </span>
                  </div>

                  <div className="text-xs font-mono font-bold text-white">
                    ${swap.totalUsd.toLocaleString()}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono">
                  <div>
                    <span className="text-emerald-400">
                      +{swap.tokenInAmount.toLocaleString()} {swap.tokenInSymbol}
                    </span>{' '}
                    <span className="text-zinc-500">
                      (${swap.tokenInUsd.toLocaleString()})
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-zinc-500">
                    <span>15 Sep 15:21</span>
                    <ExternalLink className="w-3 h-3 hover:text-white cursor-pointer" />
                  </div>
                </div>

                <div className="text-[11px] font-mono text-zinc-400">
                  <span className="text-zinc-400">
                    -{swap.tokenOutAmount.toLocaleString()} {swap.tokenOutSymbol}
                  </span>{' '}
                  <span className="text-zinc-500">
                    (${swap.tokenOutUsd.toLocaleString()})
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MeshProviderDetailPage;
