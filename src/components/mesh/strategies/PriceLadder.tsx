/**
 * Price ladder: every buy / sell level a set of pools quotes for one token,
 * on a horizontal "tokens per BCH" axis, with the market price for reference.
 * Styled with the Mesh Finance Neo-Brutalist Technical Wireframe aesthetic.
 */
import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import type { PriceLevel } from '@/lib/mesh/v3/v3Display';
import { formatNumber } from '@/lib/mesh/format';
import { Repeat } from 'lucide-react';

export function PriceLadder({
  levels,
  market,
  symbol,
  className,
}: {
  levels: PriceLevel[];
  market?: number | null;
  symbol: string;
  className?: string;
}) {
  const [activeLevel, setActiveLevel] = useState<PriceLevel | null>(null);

  const values = [...levels.map(l => l.tokenPerBch), ...(market ? [market] : [])].filter(
    v => Number.isFinite(v) && v > 0
  );
  if (values.length === 0) return null;

  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo) * 0.1 || hi * 0.03;
  const min = Math.max(0.0001, lo - pad);
  const max = hi + pad;
  const x = (v: number) => `${Math.max(2, Math.min(98, ((v - min) / (max - min)) * 100))}%`;
  const sorted = [...levels].sort((a, b) => a.tokenPerBch - b.tokenPerBch);

  // Mid calculation for % difference
  const vsMidPct = (val: number) => {
    if (!market || market <= 0) return null;
    // In tokens per BCH: more tokens per BCH means cheaper BCH / cheaper token?
    // Price of 1 token in BCH = 1 / val.
    // % diff in price = (market / val - 1) * 100
    const pct = ((market / val) - 1) * 100;
    return pct;
  };

  return (
    <div className={cn('space-y-3 font-mono select-none', className)}>
      {/* Chart Canvas */}
      <div className="relative h-28 rounded-xl bg-black/40 border border-neutral-800 p-3 overflow-hidden">
        {/* Architectural Grid lines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293715_1px,transparent_1px),linear-gradient(to_bottom,#1f293715_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

        {/* Reticles at corners */}
        <div className="absolute top-1 left-1 text-[8px] text-neutral-600">+</div>
        <div className="absolute top-1 right-1 text-[8px] text-neutral-600">+</div>
        <div className="absolute bottom-1 left-1 text-[8px] text-neutral-600">+</div>
        <div className="absolute bottom-1 right-1 text-[8px] text-neutral-600">+</div>

        {/* Central Baseline Axis */}
        <div className="absolute inset-x-3 top-1/2 h-[1px] bg-neutral-700/60" />

        {/* Market Mid Reference Line */}
        {market ? (
          <div
            className="absolute top-0 bottom-0 w-[1.5px] bg-sky-400/80 z-10 transition-all pointer-events-none"
            style={{ left: x(market) }}
          >
            <div className="absolute top-1 -translate-x-1/2 px-1.5 py-0.5 rounded bg-sky-950/90 border border-sky-500/40 text-[8px] font-semibold text-sky-300 whitespace-nowrap shadow-xs">
              MID {formatNumber(market, 2)}
            </div>
          </div>
        ) : null}

        {/* Level Points / Bins */}
        {sorted.map((l, i) => {
          const isBuy = l.kind === 'buy';
          const isSelected = activeLevel === l;
          const diff = vsMidPct(l.tokenPerBch);

          return (
            <div
              key={`${l.address}-${l.kind}-${i}`}
              className="absolute z-20 cursor-pointer group"
              style={{
                left: x(l.tokenPerBch),
                top: isBuy ? '62%' : '18%',
              }}
              onMouseEnter={() => setActiveLevel(l)}
              onMouseLeave={() => setActiveLevel(null)}
              onClick={() => setActiveLevel(isSelected ? null : l)}
            >
              {/* Vertical connector to baseline */}
              <div
                className={cn(
                  'absolute left-1/2 w-[1px] -translate-x-1/2 transition-opacity',
                  isBuy ? 'bottom-full h-3 bg-emerald-500/30' : 'top-full h-3 bg-rose-500/30',
                  isSelected && 'opacity-100'
                )}
              />

              {/* Tactical marker */}
              <div
                className={cn(
                  'relative -ml-2 -mt-2 w-4 h-4 rounded-md flex items-center justify-center transition-all duration-150',
                  isBuy
                    ? l.fromMirror
                      ? 'border border-dashed border-emerald-400/80 bg-emerald-950/40 text-emerald-300'
                      : 'bg-emerald-500 border border-emerald-400 text-black shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                    : l.fromMirror
                      ? 'border border-dashed border-rose-400/80 bg-rose-950/40 text-rose-300'
                      : 'bg-rose-500 border border-rose-400 text-white shadow-[0_0_8px_rgba(244,63,94,0.4)]',
                  isSelected && 'scale-125 ring-2 ring-white/50 z-30'
                )}
              >
                {l.fromMirror ? (
                  <Repeat className="w-2.5 h-2.5 stroke-[2.5]" />
                ) : (
                  <span className="text-[7px] font-black uppercase">{isBuy ? 'B' : 'A'}</span>
                )}
              </div>

              {/* Offset Tag */}
              {diff !== null && (
                <div
                  className={cn(
                    'absolute left-1/2 -translate-x-1/2 text-[8px] whitespace-nowrap transition-opacity font-mono pointer-events-none',
                    isBuy ? 'top-3.5 text-emerald-400/80' : 'bottom-3.5 text-rose-400/80',
                    isSelected ? 'opacity-100 font-bold' : 'opacity-0 group-hover:opacity-100'
                  )}
                >
                  {diff > 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Active Level Inspector Strip (Visible on hover/select) */}
      {activeLevel ? (
        <div className="p-2.5 rounded-lg bg-neutral-900/90 border border-neutral-700/80 text-[11px] flex flex-wrap items-center justify-between gap-3 animate-in fade-in-50 duration-150">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'px-1.5 py-0.5 rounded text-[9px] font-bold uppercase',
                activeLevel.kind === 'buy'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              )}
            >
              {activeLevel.kind === 'buy' ? 'BUY BID' : 'SELL ASK'}
            </span>
            <span className="text-white font-semibold">
              1 BCH = {formatNumber(activeLevel.tokenPerBch, 4)} {symbol}
            </span>
            {activeLevel.fromMirror && (
              <span className="text-amber-400 text-[10px] flex items-center gap-1">
                <Repeat className="w-3 h-3" /> Mirror Recycle Pool
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-neutral-400 text-[10px]">
            <span>
              Trader gets:{' '}
              <span className="text-neutral-200">
                {formatNumber(activeLevel.traderTokenPerBch, 4)}
              </span>
            </span>
            {activeLevel.role && (
              <span className="text-neutral-500 capitalize">Role: {activeLevel.role}</span>
            )}
          </div>
        </div>
      ) : null}

      {/* Axis Scale and Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] text-neutral-400 pt-0.5">
        <span className="font-mono text-neutral-500">
          MIN: {formatNumber(min > 0 ? min : lo, 2)} {symbol}
        </span>

        {/* Legend Chips */}
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded bg-emerald-500" />
            <span className="text-neutral-300">Buy (Bid)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded bg-rose-500" />
            <span className="text-neutral-300">Sell (Ask)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded border border-dashed border-emerald-400 flex items-center justify-center">
              <Repeat className="w-1.5 h-1.5 text-emerald-400" />
            </span>
            <span className="text-neutral-300">Recycled Mirror</span>
          </span>
        </div>

        <span className="font-mono text-neutral-500">
          MAX: {formatNumber(max, 2)} {symbol}
        </span>
      </div>
    </div>
  );
}

export default PriceLadder;
