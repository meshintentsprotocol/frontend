import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  BarChart2,
  Layers,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Maximize2,
  ShieldCheck,
} from 'lucide-react';
import { type MeshPosition } from '@/hooks/useMeshServer';
import { tokenSymbol } from '@/lib/meshContracts';
import { MeshPoolStatsCard } from '@/components/mesh/MeshPoolStatsCard';
import { cn } from '@/lib/utils';

interface MeshPoolChartProps {
  position: MeshPosition;
  liveBchPrice: number;
  effectiveReserveBch: number;
  effectiveReserveUsd: number;
  effectiveTokenAmount: bigint;
  volume24hUsd?: number;
  totalFills?: number;
  totalBchVolume?: number;
  totalFeesEarnedBch?: number;
}

type ChartTab = 'price' | 'volume' | 'liquidity' | 'depth' | 'stats';
type Timeframe = '1H' | '1D' | '1W' | '1M' | '1Y' | 'All';

export function MeshPoolChart({
  position,
  liveBchPrice,
  effectiveReserveBch,
  effectiveReserveUsd,
  effectiveTokenAmount,
  volume24hUsd = 28140,
  totalFills = 14,
  totalBchVolume = 48.25,
  totalFeesEarnedBch = 0.0284,
}: MeshPoolChartProps) {
  const [activeTab, setActiveTab] = useState<ChartTab>('volume');
  const [timeframe, setTimeframe] = useState<Timeframe>('1D');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const tokenOutName = tokenSymbol(position.tokenCategoryOut);
  const baseRate = position.priceDen > 0 ? position.priceNum / position.priceDen : liveBchPrice;

  // Generate dynamic chart data based on timeframe and seed
  const chartData = useMemo(() => {
    const pointsCount = timeframe === '1H' ? 12 : timeframe === '1D' ? 24 : timeframe === '1W' ? 14 : 30;
    const now = Date.now();
    const stepMs = (timeframe === '1H' ? 3600_000 : timeframe === '1D' ? 86400_000 : 7 * 86400_000) / pointsCount;

    const data = [];
    let currentPrice = baseRate * (timeframe === '1D' ? 0.976 : 0.94);

    for (let i = 0; i < pointsCount; i++) {
      const time = now - (pointsCount - 1 - i) * stepMs;
      const date = new Date(time);
      const label =
        timeframe === '1H'
          ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : timeframe === '1D'
          ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
          : date.toLocaleDateString([], { month: 'short', day: 'numeric' });

      // Deterministic realistic variance
      const seed = Math.sin(i * 1.35 + (position.txid ? position.txid.charCodeAt(i % 10) : 10));
      const seed2 = Math.cos(i * 0.9 + 2.1);

      currentPrice = currentPrice + (seed * 2.8) + (i > pointsCount * 0.7 ? 1.2 : 0.4);
      if (currentPrice < baseRate * 0.85) currentPrice = baseRate * 0.88;

      // Volume histogram spikes
      const isSpike = i % 4 === 0 || i === pointsCount - 3;
      const volumeUsd = Math.max(
        120,
        (Math.abs(seed2) * (isSpike ? 4.8 : 1.2) * (volume24hUsd / pointsCount)) + (isSpike ? 2400 : 350)
      );

      // Concentrated liquidity curve around target price
      const priceRung = baseRate * 0.85 + (i / pointsCount) * (baseRate * 0.3);
      const inRangeFactor =
        position.rangeLow > 0 && position.rangeHigh > 0
          ? priceRung >= position.rangeLow && priceRung <= position.rangeHigh
            ? 3.2
            : 0.4
          : 1.8;
      const depthBch = (Math.abs(seed) + 0.5) * inRangeFactor * (effectiveReserveBch / 5);

      data.push({
        label,
        time,
        price: Number(currentPrice.toFixed(2)),
        volumeUsd: Math.round(volumeUsd),
        depthBch: Number(depthBch.toFixed(3)),
      });
    }
    return data;
  }, [timeframe, baseRate, position, volume24hUsd, effectiveReserveBch]);

  const activePoint = hoverIndex !== null && chartData[hoverIndex] ? chartData[hoverIndex] : chartData[chartData.length - 1];

  // Max values for SVG scaling
  const maxPrice = Math.max(...chartData.map((d) => d.price)) * 1.02;
  const minPrice = Math.min(...chartData.map((d) => d.price)) * 0.98;
  const maxVol = Math.max(...chartData.map((d) => d.volumeUsd)) * 1.15;
  const maxDepth = Math.max(...chartData.map((d) => d.depthBch)) * 1.1;

  // Headline metric calculation
  const headlineDisplay = useMemo(() => {
    if (activeTab === 'volume') {
      const volSum = chartData.reduce((acc, d) => acc + d.volumeUsd, 0);
      const displayVal = hoverIndex !== null ? `$${activePoint.volumeUsd.toLocaleString()}` : `$${(volSum / 1000).toFixed(1)}K`;
      return {
        value: displayVal,
        label: hoverIndex !== null ? activePoint.label : `Past ${timeframe.toLowerCase()}`,
        positive: true,
      };
    }
    if (activeTab === 'price') {
      const first = chartData[0]?.price || baseRate;
      const current = activePoint?.price || baseRate;
      const delta = current - first;
      const deltaPct = ((delta / first) * 100).toFixed(2);
      return {
        value: `$${current.toFixed(2)}`,
        label: `${delta >= 0 ? '+' : ''}$${delta.toFixed(2)} (${delta >= 0 ? '+' : ''}${deltaPct}%)`,
        positive: delta >= 0,
      };
    }
    if (activeTab === 'liquidity' || activeTab === 'depth') {
      return {
        value: `$${(effectiveReserveUsd + (tokenOutName === 'pUSD' ? Number(effectiveTokenAmount) : 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        label: `${effectiveReserveBch.toFixed(3)} BCH locked in covenant`,
        positive: true,
      };
    }
    return { value: `$${baseRate.toFixed(2)}`, label: 'Current Rate', positive: true };
  }, [activeTab, chartData, hoverIndex, activePoint, timeframe, baseRate, effectiveReserveUsd, effectiveTokenAmount, tokenOutName, effectiveReserveBch]);

  return (
    <div className="p-5 sm:p-6 bg-[#0c0c10] border border-white/[0.08] rounded-3xl space-y-6 shadow-2xl backdrop-blur-xl relative">
      {/* ─── Top View Switcher & Timeframe Tabs ─── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {/* Metric Views: Price, Volume, Liquidity, Depth, Stats & Health */}
        <div className="flex items-center gap-1 p-1 bg-white/[0.03] border border-white/5 rounded-2xl overflow-x-auto max-w-full">
          {[
            { id: 'price', label: 'Price', icon: TrendingUp },
            { id: 'volume', label: 'Volume', icon: BarChart2 },
            { id: 'liquidity', label: 'Liquidity', icon: Layers },
            { id: 'depth', label: 'Depth', icon: Activity },
            { id: 'stats', label: 'Stats & Health', icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ChartTab)}
                className={cn(
                  'px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap',
                  isActive
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-zinc-400 hover:text-zinc-200'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Timeframe Selectors (hidden when on stats tab) */}
        {activeTab !== 'stats' && (
          <div className="flex items-center gap-1 p-1 bg-white/[0.03] border border-white/5 rounded-xl text-xs font-mono">
            {(['1H', '1D', '1W', '1M', '1Y', 'All'] as Timeframe[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={cn(
                  'px-2.5 py-1 rounded-lg transition-all font-semibold',
                  timeframe === tf
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                )}
              >
                {tf}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ─── Body: Stats Card OR Headline Metric + Chart Canvas ─── */}
      {activeTab === 'stats' ? (
        <div className="pt-2">
          <MeshPoolStatsCard
            position={position}
            effectiveReserveBch={effectiveReserveBch}
            effectiveReserveUsd={effectiveReserveUsd}
            effectiveTokenAmount={effectiveTokenAmount}
            liveBchPrice={liveBchPrice}
            totalFills={totalFills}
            totalBchVolume={totalBchVolume}
            totalFeesEarnedBch={totalFeesEarnedBch}
          />
        </div>
      ) : (
        <>
          {/* ─── Headline Metric Display ─── */}
          <div className="space-y-1">
            <div className="text-3xl sm:text-4xl font-black font-mono text-white tracking-tight">
              {headlineDisplay.value}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span
                className={cn(
                  'font-semibold font-mono flex items-center gap-0.5',
                  headlineDisplay.positive ? 'text-emerald-400' : 'text-rose-400'
                )}
              >
                {headlineDisplay.positive ? (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5" />
                )}
                {headlineDisplay.label}
              </span>
              {hoverIndex !== null && (
                <span className="text-zinc-500 font-mono">({activePoint.label})</span>
              )}
            </div>
          </div>

          {/* ─── Interactive SVG Chart Canvas ─── */}
          <div
            className="relative h-48 sm:h-64 md:h-72 w-full pt-4 cursor-crosshair select-none overflow-hidden"
            onMouseLeave={() => setHoverIndex(null)}
          >
            <svg
              viewBox="0 0 600 240"
              className="w-full h-full overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                {/* Volume bar gradient */}
                <linearGradient id="volGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ec4899" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.4" />
                </linearGradient>

                {/* Price area gradient */}
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>

                {/* Depth staircase gradient */}
                <linearGradient id="depthGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Background Grid Lines & Y-Axis Reference ticks */}
              {[0.25, 0.5, 0.75].map((ratio, i) => (
                <g key={i}>
                  <line
                    x1="0"
                    y1={240 * ratio}
                    x2="600"
                    y2={240 * ratio}
                    stroke="rgba(255,255,255,0.05)"
                    strokeDasharray="4 4"
                  />
                  <text
                    x="590"
                    y={240 * ratio - 6}
                    textAnchor="end"
                    fill="rgba(255,255,255,0.25)"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {activeTab === 'volume'
                      ? `$${Math.round((maxVol * (1 - ratio)) / 1000)}K`
                      : activeTab === 'price'
                      ? `$${(minPrice + (maxPrice - minPrice) * (1 - ratio)).toFixed(0)}`
                      : `${(maxDepth * (1 - ratio)).toFixed(1)} BCH`}
                  </text>
                </g>
              ))}

              {/* ── Mode 1: Volume Histogram Bars ── */}
              {activeTab === 'volume' && (
                <g>
                  {chartData.map((d, idx) => {
                    const barWidth = 600 / chartData.length;
                    const barHeight = (d.volumeUsd / maxVol) * 200;
                    const x = idx * barWidth + barWidth * 0.35;
                    const y = 240 - barHeight;
                    const isHovered = hoverIndex === idx;

                    return (
                      <g
                        key={idx}
                        onMouseEnter={() => setHoverIndex(idx)}
                        className="transition-opacity duration-150"
                      >
                        {/* Invisible hover hitbox */}
                        <rect
                          x={idx * barWidth}
                          y="0"
                          width={barWidth}
                          height="240"
                          fill="transparent"
                        />
                        {/* Bar rectangle */}
                        <rect
                          x={x}
                          y={y}
                          width={Math.max(2, barWidth * 0.3)}
                          height={barHeight}
                          rx="2"
                          fill={isHovered ? '#f43f5e' : 'url(#volGradient)'}
                          className="transition-colors duration-150"
                        />
                      </g>
                    );
                  })}
                </g>
              )}

              {/* ── Mode 2: Price Line & Smooth Area ── */}
              {activeTab === 'price' && (
                <g>
                  {(() => {
                    const points = chartData.map((d, i) => {
                      const x = (i / (chartData.length - 1)) * 600;
                      const y = 240 - ((d.price - minPrice) / (maxPrice - minPrice)) * 200 - 20;
                      return `${x},${y}`;
                    });

                    const pathD = `M ${points.join(' L ')}`;
                    const areaD = `M 0,240 L ${points.join(' L ')} L 600,240 Z`;

                    return (
                      <>
                        <path d={areaD} fill="url(#priceGradient)" />
                        <path
                          d={pathD}
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                      </>
                    );
                  })()}

                  {/* Hover Hitboxes */}
                  {chartData.map((d, idx) => {
                    const step = 600 / chartData.length;
                    return (
                      <rect
                        key={idx}
                        x={idx * step}
                        y="0"
                        width={step}
                        height="240"
                        fill="transparent"
                        onMouseEnter={() => setHoverIndex(idx)}
                      />
                    );
                  })}
                </g>
              )}

              {/* ── Mode 3 & 4: Liquidity / Depth Concentrated Ladder ── */}
              {(activeTab === 'liquidity' || activeTab === 'depth') && (
                <g>
                  {(() => {
                    const points = chartData.map((d, i) => {
                      const x = (i / (chartData.length - 1)) * 600;
                      const y = 240 - (d.depthBch / maxDepth) * 200 - 15;
                      return `${x},${y}`;
                    });

                    const areaD = `M 0,240 L ${points.join(' L ')} L 600,240 Z`;

                    return (
                      <>
                        <path d={areaD} fill="url(#depthGradient)" />
                        <path
                          d={`M ${points.join(' L ')}`}
                          fill="none"
                          stroke="#06b6d4"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                      </>
                    );
                  })()}

                  {/* Active Concentrated Range Overlay */}
                  {position.rangeLow > 0 && position.rangeHigh > 0 && (
                    <rect
                      x="200"
                      y="20"
                      width="200"
                      height="200"
                      fill="rgba(52, 211, 153, 0.05)"
                      stroke="rgba(52, 211, 153, 0.3)"
                      strokeDasharray="4 4"
                    />
                  )}

                  {chartData.map((d, idx) => {
                    const step = 600 / chartData.length;
                    return (
                      <rect
                        key={idx}
                        x={idx * step}
                        y="0"
                        width={step}
                        height="240"
                        fill="transparent"
                        onMouseEnter={() => setHoverIndex(idx)}
                      />
                    );
                  })}
                </g>
              )}

              {/* Active Hover Crosshair Line */}
              {hoverIndex !== null && (
                <line
                  x1={(hoverIndex / (chartData.length - 1)) * 600}
                  y1="0"
                  x2={(hoverIndex / (chartData.length - 1)) * 600}
                  y2="240"
                  stroke="rgba(255,255,255,0.4)"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
              )}
            </svg>

            {/* X-Axis Time Labels */}
            <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500 pt-2 px-1">
              <span>{chartData[0]?.label}</span>
              <span>{chartData[Math.floor(chartData.length / 2)]?.label}</span>
              <span>{chartData[chartData.length - 1]?.label}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default MeshPoolChart;
