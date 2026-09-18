import React from 'react';
import { type LeaderboardProvider, formatCompactUsd, getAvatarGradient } from '@/lib/meshLeaderboardData';
import { useNavigate } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface MeshVolumeRaceChartProps {
  providers: LeaderboardProvider[];
}

export function MeshVolumeRaceChart({ providers }: MeshVolumeRaceChartProps) {
  const navigate = useNavigate();

  // Find max volume to normalize scale (round up to clean number like 300M)
  const maxVolume = Math.max(...providers.map((p) => p.volumeUsd), 300_000_000);
  const scaleMax = 300_000_000;

  // Take top 8 providers for the bubble race
  const topRaceProviders = providers.slice(0, 8);

  const ticks = [0, 75_000_000, 150_000_000, 225_000_000, 300_000_000];

  return (
    <div className="w-full bg-[#002bdc] rounded-2xl p-4 sm:p-6 border border-blue-400/20 shadow-inner overflow-hidden">
      <div className="relative pt-12 pb-6 px-2 sm:px-6">
        {/* Horizontal Axis Line */}
        <div className="w-full h-0.5 bg-blue-300/30 relative">
          {/* Axis Ticks & Labels */}
          {ticks.map((tickVal) => {
            const pct = (tickVal / scaleMax) * 100;
            return (
              <div
                key={tickVal}
                className="absolute top-0 flex flex-col items-center -translate-x-1/2"
                style={{ left: `${pct}%` }}
              >
                <div className="w-0.5 h-2 bg-blue-300/40" />
                <span className="text-[10px] sm:text-xs font-mono text-blue-200/80 mt-1.5 whitespace-nowrap">
                  {tickVal === 0 ? '$0' : formatCompactUsd(tickVal)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Bubbles / Avatars positioned along the axis */}
        <TooltipProvider>
          {topRaceProviders.map((provider, index) => {
            const pct = Math.min(Math.max((provider.volumeUsd / scaleMax) * 100, 4), 96);
            // Stagger vertical offsets slightly to prevent overlaps
            const yOffsets = [-24, -36, -20, -32, -26, -38, -22, -34];
            const yOffset = yOffsets[index % yOffsets.length];

            return (
              <div
                key={provider.address}
                className="absolute -translate-x-1/2 flex flex-col items-center cursor-pointer group transition-all duration-300 hover:z-30"
                style={{
                  left: `${pct}%`,
                  top: `calc(50% + ${yOffset}px)`,
                }}
                onClick={() => navigate(`/mesh/provider/${provider.address}`)}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative flex flex-col items-center">
                      {/* Callout Tag */}
                      <div className="opacity-0 group-hover:opacity-100 transition-all duration-200 -translate-y-1 group-hover:-translate-y-2 mb-1 px-2 py-0.5 rounded bg-black/80 text-[10px] font-mono text-white whitespace-nowrap border border-white/20 shadow-lg pointer-events-none">
                        {provider.shortAddress} - {formatCompactUsd(provider.volumeUsd)}
                      </div>

                      {/* Avatar Circle */}
                      <div
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-white shadow-md flex items-center justify-center transition-transform duration-200 group-hover:scale-125 ${
                          index === 0 ? 'ring-2 ring-yellow-400/80 w-9 h-9 sm:w-10 sm:h-10' : ''
                        }`}
                        style={{ background: getAvatarGradient(provider.address) }}
                      >
                        <span className="text-[10px] font-bold text-white shadow-sm">
                          #{provider.rank}
                        </span>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="bg-zinc-950 text-white border-zinc-800 p-2.5 space-y-1 font-mono text-xs">
                    <div className="font-bold text-emerald-400">Rank #{provider.rank}</div>
                    <div className="text-zinc-300">{provider.address}</div>
                    <div className="text-white">Volume: {formatCompactUsd(provider.volumeUsd)}</div>
                    <div className="text-zinc-400">APY: {provider.apyPct.toFixed(1)}%</div>
                  </TooltipContent>
                </Tooltip>
              </div>
            );
          })}
        </TooltipProvider>
      </div>
    </div>
  );
}
