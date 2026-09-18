import React from 'react';
import {
  type LeaderboardSwap,
  type Timeframe,
  MOCK_NETWORK_DISTRIBUTION,
  MOCK_TOP_MOVERS,
  getAvatarGradient,
  formatCompactUsd,
} from '@/lib/meshLeaderboardData';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, ArrowUp, Repeat } from 'lucide-react';

interface MeshLeaderboardSidebarProps {
  swaps: LeaderboardSwap[];
  timeframe: Timeframe;
}

export function MeshLeaderboardSidebar({ swaps, timeframe }: MeshLeaderboardSidebarProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* 1. Volume by Network Card */}
      <div className="bg-[#0b0c10] border border-white/8 rounded-3xl p-5 sm:p-6 space-y-5 shadow-xl">
        <h3 className="text-base font-bold text-white font-heading">
          Volume by network
        </h3>

        <div className="flex flex-col items-center justify-center py-2 space-y-4">
          {/* Donut Chart Ring */}
          <div className="relative w-36 h-36 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              {/* Background ring */}
              <path
                className="text-white/10"
                strokeWidth="4"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              {/* Foreground mainnet ring (100%) */}
              <path
                className="text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                strokeDasharray="100, 100"
                strokeWidth="4"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>

            {/* Inner Center Label */}
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-base font-black font-mono text-white">
                $1.9B
              </span>
              <span className="text-[10px] text-zinc-400 font-mono">
                Volume, {timeframe}
              </span>
            </div>
          </div>

          {/* Network Breakdown Legend */}
          <div className="w-full space-y-2 pt-1 border-t border-white/5">
            {MOCK_NETWORK_DISTRIBUTION.map((item) => (
              <div
                key={item.network}
                className="flex items-center justify-between text-xs font-mono"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-zinc-300">{item.network}</span>
                </div>
                <span className="text-zinc-400 font-semibold">{item.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Latest Swaps Feed */}
      <div className="bg-[#0b0c10] border border-white/8 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white font-heading">
            Latest swaps
          </h3>
          <span className="text-[11px] font-mono text-zinc-400">
            Fee earned
          </span>
        </div>

        <div className="space-y-3 divide-y divide-white/[0.04]">
          {swaps.slice(0, 5).map((swap) => (
            <div key={swap.id} className="pt-3 first:pt-0 space-y-1.5">
              <div className="flex items-center justify-between">
                {/* Swap Pair Badge */}
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px] font-bold">
                    <Repeat className="w-3 h-3" />
                  </div>
                  <span className="text-xs font-bold text-white font-mono">
                    {swap.pair}
                  </span>
                </div>

                {/* Fee Earned Pill */}
                <div className="text-xs font-mono font-bold text-emerald-400">
                  +${swap.feeEarnedUsd.toFixed(2)}
                </div>
              </div>

              {/* Amounts & Timestamps */}
              <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
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

      {/* 3. Top Movers Card */}
      <div className="bg-[#0b0c10] border border-white/8 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
        <h3 className="text-base font-bold text-white font-heading">
          Top movers, {timeframe}
        </h3>

        <div className="space-y-3">
          {MOCK_TOP_MOVERS.map((mover) => (
            <div
              key={mover.address}
              onClick={() => navigate(`/mesh/provider/${mover.fullAddress}`)}
              className="flex items-center justify-between p-2.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded-full flex-shrink-0 border border-white/10"
                  style={{ background: getAvatarGradient(mover.fullAddress) }}
                />
                <div className="font-mono text-xs text-zinc-200 hover:text-blue-400 transition-colors">
                  {mover.address}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-zinc-400 font-medium">
                  {formatCompactUsd(mover.volumeUsd)}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-0.5 font-mono">
                  <ArrowUp className="w-3 h-3" />
                  {mover.rankDelta}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
