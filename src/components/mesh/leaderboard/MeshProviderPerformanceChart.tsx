import React, { useState } from 'react';
import { type LeaderboardProvider, type Timeframe, formatUsd } from '@/lib/meshLeaderboardData';

interface MeshProviderPerformanceChartProps {
  provider: LeaderboardProvider;
  timeframe: Timeframe;
}

export function MeshProviderPerformanceChart({
  provider,
  timeframe,
}: MeshProviderPerformanceChartProps) {
  const [activeSeries, setActiveSeries] = useState<{
    volume: boolean;
    fees: boolean;
    apy: boolean;
    sharedLiq: boolean;
  }>({
    volume: true,
    fees: true,
    apy: true,
    sharedLiq: true,
  });

  const history = provider.history && provider.history.length > 0 ? provider.history : [
    { date: 'Aug 23', volumeUsd: 8500000, feesUsd: 120, apyPct: 45.2, sharedLiquidityUsd: 120000 },
    { date: 'Aug 26', volumeUsd: 14200000, feesUsd: 210, apyPct: 52.8, sharedLiquidityUsd: 180000 },
    { date: 'Aug 30', volumeUsd: 42300000, feesUsd: 480, apyPct: 68.4, sharedLiquidityUsd: 250000 },
    { date: 'Sep 2', volumeUsd: 28100000, feesUsd: 350, apyPct: 71.0, sharedLiquidityUsd: 290000 },
    { date: 'Sep 6', volumeUsd: 78900000, feesUsd: 920, apyPct: 82.5, sharedLiquidityUsd: 310000 },
    { date: 'Sep 9', volumeUsd: 51200000, feesUsd: 610, apyPct: 84.1, sharedLiquidityUsd: 310000 },
    { date: 'Sep 13', volumeUsd: 89600000, feesUsd: 1100, apyPct: 91.2, sharedLiquidityUsd: 340000 },
    { date: 'Sep 16', volumeUsd: 102400000, feesUsd: 1320, apyPct: 96.5, sharedLiquidityUsd: 350000 },
  ];

  return (
    <div className="bg-[#0b0c10] border border-white/8 rounded-3xl p-5 sm:p-7 space-y-6 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-lg font-bold text-white font-heading">
          Performance
        </h3>

        {/* Toggleable Metric Legends */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs font-mono">
          {/* Volume */}
          <button
            onClick={() => setActiveSeries((s) => ({ ...s, volume: !s.volume }))}
            className={`flex items-center gap-2 cursor-pointer transition-opacity ${
              activeSeries.volume ? 'opacity-100' : 'opacity-40'
            }`}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span className="text-zinc-400">Volume, {timeframe}</span>
            <span className="text-white font-bold">{formatUsd(provider.volumeUsd)}</span>
          </button>

          {/* Fees */}
          <button
            onClick={() => setActiveSeries((s) => ({ ...s, fees: !s.fees }))}
            className={`flex items-center gap-2 cursor-pointer transition-opacity ${
              activeSeries.fees ? 'opacity-100' : 'opacity-40'
            }`}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
            <span className="text-zinc-400">Fees, {timeframe}</span>
            <span className="text-white font-bold">{formatUsd(provider.feesUsd)}</span>
          </button>

          {/* APY */}
          <button
            onClick={() => setActiveSeries((s) => ({ ...s, apy: !s.apy }))}
            className={`flex items-center gap-2 cursor-pointer transition-opacity ${
              activeSeries.apy ? 'opacity-100' : 'opacity-40'
            }`}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span className="text-zinc-400">APY, {timeframe}</span>
            <span className="text-emerald-400 font-bold">{provider.apyPct.toFixed(2)}%</span>
          </button>

          {/* Shared Liquidity */}
          <button
            onClick={() => setActiveSeries((s) => ({ ...s, sharedLiq: !s.sharedLiq }))}
            className={`flex items-center gap-2 cursor-pointer transition-opacity ${
              activeSeries.sharedLiq ? 'opacity-100' : 'opacity-40'
            }`}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-400" />
            <span className="text-zinc-400">Shared liquidity</span>
            <span className="text-white font-bold">${provider.sharedLiquidityUsd.toFixed(0)}</span>
          </button>
        </div>
      </div>

      {/* SVG Canvas Chart */}
      <div className="relative w-full h-80 pt-4 pb-2">
        {/* Average APY horizontal dotted reference line */}
        {activeSeries.apy && (
          <div className="absolute top-10 left-0 right-12 border-b border-dashed border-emerald-500/50 flex items-center justify-end">
            <span className="text-[10px] font-mono text-emerald-400 bg-[#0b0c10] px-1.5 -translate-y-2">
              avg: {provider.apyPct.toFixed(2)}%
            </span>
          </div>
        )}

        {/* Right axis scale labels */}
        <div className="absolute right-0 top-6 bottom-10 flex flex-col justify-between text-[10px] font-mono text-zinc-500 text-right">
          <span>100%</span>
          <span>80%</span>
          <span>60%</span>
          <span>40%</span>
          <span>20%</span>
          <span>0%</span>
          <span className="text-orange-400">$500</span>
          <span className="text-orange-400">$0</span>
          <span className="text-zinc-400">$400K</span>
          <span className="text-zinc-400">$200K</span>
          <span className="text-zinc-400">$0</span>
        </div>

        {/* SVG Graphic with Bars and Trend Curve */}
        <div className="w-[calc(100%-48px)] h-full">
          <svg className="w-full h-full" viewBox="0 0 800 280" preserveAspectRatio="none">
            {/* Grid Lines */}
            <line x1="0" y1="40" x2="800" y2="40" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
            <line x1="0" y1="90" x2="800" y2="90" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
            <line x1="0" y1="140" x2="800" y2="140" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
            <line x1="0" y1="190" x2="800" y2="190" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
            <line x1="0" y1="240" x2="800" y2="240" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />

            {/* 1. Volume Bars (Blue) */}
            {activeSeries.volume &&
              history.map((pt, i) => {
                const x = 50 + i * 95;
                const barHeight = Math.min((pt.volumeUsd / 110_000_000) * 80, 80);
                const y = 140 - barHeight;
                return (
                  <rect
                    key={`vol-${i}`}
                    x={x}
                    y={y}
                    width="18"
                    height={barHeight}
                    rx="3"
                    className="fill-blue-500 hover:fill-blue-400 transition-colors"
                  />
                );
              })}

            {/* 2. Fees Bars (Orange) */}
            {activeSeries.fees &&
              history.map((pt, i) => {
                const x = 50 + i * 95;
                const barHeight = Math.min((pt.feesUsd / 1500) * 35, 35);
                const y = 190 - barHeight;
                return (
                  <rect
                    key={`fee-${i}`}
                    x={x}
                    y={y}
                    width="18"
                    height={barHeight}
                    rx="3"
                    className="fill-orange-500 hover:fill-orange-400 transition-colors"
                  />
                );
              })}

            {/* 3. Shared Liquidity Bottom Area Curve (Dark Gray) */}
            {activeSeries.sharedLiq && (
              <path
                d="M 50 250 Q 150 210, 250 250 T 450 220 T 650 250 T 750 210 L 750 260 L 50 260 Z"
                fill="none"
                stroke="rgba(161, 161, 170, 0.4)"
                strokeWidth="2"
              />
            )}

            {/* 4. APY Green Smooth Line */}
            {activeSeries.apy && (
              <path
                d="M 50 120 C 150 115, 250 100, 350 90 C 450 80, 550 70, 650 60 C 700 50, 750 45, 780 40"
                fill="none"
                stroke="#10b981"
                strokeWidth="3"
                strokeLinecap="round"
              />
            )}
          </svg>
        </div>

        {/* Date Labels on X Axis */}
        <div className="w-[calc(100%-48px)] flex justify-between px-6 pt-2 text-[11px] font-mono text-zinc-500">
          <span>Aug, 23</span>
          <span>Aug, 30</span>
          <span>Sep, 6</span>
          <span>Sep, 13</span>
        </div>
      </div>
    </div>
  );
}
