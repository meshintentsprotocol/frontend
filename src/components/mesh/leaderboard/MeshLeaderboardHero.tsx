import React from 'react';
import { type Timeframe, type LeaderboardGlobalStats, formatCompactUsd } from '@/lib/meshLeaderboardData';
import { Button } from '@/components/ui/button';
import { PlusCircle, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface MeshLeaderboardHeroProps {
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  stats: LeaderboardGlobalStats;
  onCreatePosition: () => void;
}

const TIMEFRAMES: Timeframe[] = ['7D', '1M', '3M', '6M', 'All'];

export function MeshLeaderboardHero({
  timeframe,
  onTimeframeChange,
  stats,
  onCreatePosition,
}: MeshLeaderboardHeroProps) {
  return (
    <div className="w-full bg-[#0038ff] rounded-3xl p-6 sm:p-8 md:p-10 text-white relative overflow-hidden shadow-2xl border border-blue-400/20">
      {/* Background radial glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-400/20 rounded-full blur-3xl pointer-events-none -mr-32 -mt-32" />
      <div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 space-y-8">
        {/* Top Header Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-2 font-heading">
              Leaderboard
            </h1>
            <p className="text-blue-100 text-sm sm:text-base font-normal max-w-xl">
              Top liquidity providers across all supported networks, ranked by swap volume.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Timeframe selector pills */}
            <div className="bg-black/20 backdrop-blur-md p-1 rounded-full border border-white/10 flex items-center gap-1">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  onClick={() => onTimeframeChange(tf)}
                  className={`px-3 py-1 text-xs sm:text-sm font-semibold rounded-full transition-all duration-200 ${
                    timeframe === tf
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-blue-100/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>

            {/* Create position CTA */}
            <Button
              onClick={onCreatePosition}
              className="h-10 px-5 rounded-full bg-white text-blue-900 hover:bg-blue-50 font-bold text-sm flex items-center gap-2 shadow-lg shadow-black/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <PlusCircle className="w-4 h-4 text-blue-700" />
              <span>Create position</span>
            </Button>
          </div>
        </div>

        {/* Global Key Metrics Row */}
        <TooltipProvider>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6 pt-2 border-t border-white/10">
            {/* Metric 1: Total volume */}
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-blue-200 font-medium">
                <span>Total volume</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3.5 h-3.5 text-blue-300/70 hover:text-white cursor-pointer" />
                  </TooltipTrigger>
                  <TooltipContent className="bg-zinc-900 border-zinc-700 text-white text-xs max-w-xs">
                    Sum of all token swaps settled through Mesh liquidity covenants in the selected timeframe.
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="text-xl sm:text-2xl lg:text-3xl font-bold font-mono tracking-tight text-white">
                {formatCompactUsd(stats.totalVolumeUsd)}
              </div>
            </div>

            {/* Metric 2: Total putable liquidity */}
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-blue-200 font-medium">
                <span>Total putable liquidity</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3.5 h-3.5 text-blue-300/70 hover:text-white cursor-pointer" />
                  </TooltipTrigger>
                  <TooltipContent className="bg-zinc-900 border-zinc-700 text-white text-xs max-w-xs">
                    Maximum liquidity available for instant fills right now across all active provider covenants.
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="text-xl sm:text-2xl lg:text-3xl font-bold font-mono tracking-tight text-white">
                {formatCompactUsd(stats.totalPutableLiquidityUsd)}
              </div>
            </div>

            {/* Metric 3: Total shared liquidity */}
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-blue-200 font-medium">
                <span>Total shared liquidity</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3.5 h-3.5 text-blue-300/70 hover:text-white cursor-pointer" />
                  </TooltipTrigger>
                  <TooltipContent className="bg-zinc-900 border-zinc-700 text-white text-xs max-w-xs">
                    Shared liquidity across multi-asset cross pools and multi-token covenant trees.
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="text-xl sm:text-2xl lg:text-3xl font-bold font-mono tracking-tight text-white">
                {formatCompactUsd(stats.totalSharedLiquidityUsd)}
              </div>
            </div>

            {/* Metric 4: Liquidity providers */}
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-blue-200 font-medium">
                <span>Liquidity providers</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3.5 h-3.5 text-blue-300/70 hover:text-white cursor-pointer" />
                  </TooltipTrigger>
                  <TooltipContent className="bg-zinc-900 border-zinc-700 text-white text-xs max-w-xs">
                    Unique maker wallets currently operating Strategy Covenants on BCH Mesh.
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="text-xl sm:text-2xl lg:text-3xl font-bold font-mono tracking-tight text-white">
                {stats.liquidityProvidersCount.toLocaleString()}
              </div>
            </div>

            {/* Metric 5: Top APY */}
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-blue-200 font-medium">
                <span>Top APY</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3.5 h-3.5 text-blue-300/70 hover:text-white cursor-pointer" />
                  </TooltipTrigger>
                  <TooltipContent className="bg-zinc-900 border-zinc-700 text-white text-xs max-w-xs">
                    Highest annualized return generated by an active covenant in the selected timeframe.
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="text-xl sm:text-2xl lg:text-3xl font-bold font-mono tracking-tight text-emerald-300">
                {stats.topApyPct.toLocaleString()}%
              </div>
            </div>
          </div>
        </TooltipProvider>
      </div>
    </div>
  );
}
