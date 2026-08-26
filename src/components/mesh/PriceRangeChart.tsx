import React, { useState } from 'react';
import { Plus, Minus, RotateCcw, Info } from 'lucide-react';

interface PriceRangeChartProps {
  currentPrice: number;
  minPrice: number;
  maxPrice: number;
  onMinPriceChange?: (val: number) => void;
  onMaxPriceChange?: (val: number) => void;
  quoteSymbol?: string;
  baseSymbol?: string;
}

export function PriceRangeChart({
  currentPrice = 0.000399201,
  minPrice = 0.000274,
  maxPrice = 0.000582,
  onMinPriceChange,
  onMaxPriceChange,
  quoteSymbol = 'WETH',
  baseSymbol = 'USDC',
}: PriceRangeChartProps) {
  const [timeline, setTimeline] = useState<'7d' | '1m' | '3m' | '6m' | 'All'>('3m');
  const [zoom, setZoom] = useState(1);

  const minPct = Math.round(((minPrice - currentPrice) / currentPrice) * 100);
  const maxPct = Math.round(((maxPrice - currentPrice) / currentPrice) * 100);

  // Generate simulated chart bars for visual depth
  const bars = [
    12, 18, 25, 30, 45, 60, 80, 110, 140, 95, 70, 85, 120, 160, 200,
    180, 150, 130, 170, 210, 250, 220, 190, 140, 100, 75, 50, 40, 30, 20, 15
  ];

  return (
    <div className="w-full bg-[#0D0D0E]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5 md:p-6 shadow-2xl relative overflow-hidden">
      {/* Top Header Row */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <div className="text-xs font-semibold text-zinc-400 tracking-wider uppercase flex items-center gap-1.5">
            Opening price <span className="text-white font-medium">{baseSymbol} $1</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl md:text-3xl font-mono font-bold text-white tracking-tight">
              {currentPrice.toFixed(9)}
            </span>
            <span className="text-sm font-semibold text-zinc-400">{quoteSymbol}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 mt-1">
            <span>Market price</span>
            <Info className="w-3.5 h-3.5 text-zinc-500" />
            <span className="font-mono text-zinc-300">{currentPrice.toFixed(9)} {quoteSymbol}</span>
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1" />
          </div>
        </div>

        {/* Controls: Timeline & Denomination */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center p-1 bg-white/[0.04] border border-white/10 rounded-xl">
            {(['7d', '1m', '3m', '6m', 'All'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeline(t)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                  timeline === t
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex items-center p-1 bg-white/[0.04] border border-white/10 rounded-xl">
            <button className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white/10 text-white shadow-sm">
              {quoteSymbol}
            </button>
            <button className="px-2.5 py-1 text-xs font-semibold rounded-lg text-zinc-400 hover:text-zinc-200">
              {baseSymbol}
            </button>
            <button className="px-2.5 py-1 text-xs font-semibold rounded-lg text-zinc-400 hover:text-zinc-200">
              USD
            </button>
          </div>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="relative h-[220px] w-full bg-[#050506]/60 border border-white/5 rounded-xl p-4 flex flex-col justify-between overflow-hidden">
        {/* Zoom Controls Overlay */}
        <div className="absolute top-3 left-3 z-20 flex items-center gap-1 bg-[#111113]/90 border border-white/10 p-1 rounded-xl shadow-lg backdrop-blur-md">
          <button
            onClick={() => setZoom(z => Math.min(z + 0.2, 2))}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            title="Zoom in"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(z => Math.max(z - 0.2, 0.6))}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            title="Zoom out"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            title="Reset zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Max Price Bound Line */}
        <div className="relative w-full border-b border-dashed border-emerald-500/60 flex items-center justify-between z-10 my-2">
          <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
            Max price +{maxPct > 0 ? maxPct : 45}%
          </span>
          <span className="text-xs font-mono font-bold text-emerald-400">
            {maxPrice.toFixed(6)} {quoteSymbol}
          </span>
        </div>

        {/* Center / Opening Price Line */}
        <div className="relative w-full border-b border-blue-500/80 flex items-center justify-between z-10 shadow-[0_0_8px_rgba(59,130,246,0.5)] my-2">
          <span className="text-[11px] font-bold text-white bg-blue-600 px-2.5 py-0.5 rounded shadow">
            Opening price
          </span>
          <span className="text-xs font-mono font-bold text-blue-400">
            {currentPrice.toFixed(6)} {quoteSymbol}
          </span>
        </div>

        {/* Min Price Bound Line */}
        <div className="relative w-full border-b border-dashed border-emerald-500/60 flex items-center justify-between z-10 my-2">
          <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
            Min price {minPct}%
          </span>
          <span className="text-xs font-mono font-bold text-emerald-400">
            {minPrice.toFixed(6)} {quoteSymbol}
          </span>
        </div>

        {/* Range Fill Region */}
        <div className="absolute inset-x-0 top-[20%] bottom-[20%] bg-gradient-to-b from-emerald-500/10 via-emerald-500/5 to-emerald-500/10 pointer-events-none" />

        {/* Simulated Bar Graph at Bottom */}
        <div className="absolute bottom-0 inset-x-0 h-16 flex items-end justify-between px-2 gap-1 opacity-40 pointer-events-none">
          {bars.map((h, i) => (
            <div
              key={i}
              className="flex-1 bg-white/20 hover:bg-emerald-400 transition-all rounded-t-sm"
              style={{ height: `${(h / 250) * 100}%` }}
            />
          ))}
        </div>
      </div>

      {/* Bottom Date Labels */}
      <div className="flex justify-between items-center text-[11px] text-zinc-500 font-mono mt-2 px-1">
        <span>Jun 2026</span>
        <span>Jul 2026</span>
        <span>Aug 2026</span>
      </div>
    </div>
  );
}
