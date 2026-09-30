/**
 * Price ladder: every buy / sell level a set of pools quotes for one token,
 * on a horizontal "tokens per BCH" axis, with the market price for reference.
 */
import React from 'react';
import { cn } from '@/lib/utils';
import type { PriceLevel } from '@/lib/mesh/v3/v3Display';
import { formatNumber } from '@/lib/mesh/format';

export function PriceLadder({ levels, market, symbol, className }: { levels: PriceLevel[]; market?: number | null; symbol: string; className?: string }) {
  const values = [...levels.map(l => l.tokenPerBch), ...(market ? [market] : [])].filter(v => Number.isFinite(v) && v > 0);
  if (values.length === 0) return null;
  const lo = Math.min(...values); const hi = Math.max(...values);
  const pad = (hi - lo) * 0.08 || hi * 0.02;
  const min = lo - pad; const max = hi + pad;
  const x = (v: number) => `${((v - min) / (max - min)) * 100}%`;
  const sorted = [...levels].sort((a, b) => a.tokenPerBch - b.tokenPerBch);

  return (
    <div className={cn('space-y-2', className)}>
      <div className="relative h-24 rounded-xl bg-black/30 border border-white/[0.06] overflow-hidden">
        <div className="absolute inset-x-3 top-1/2 h-px bg-white/10" />
        {market ? (
          <div className="absolute top-1 bottom-1 w-px bg-sky-400/70" style={{ left: x(market) }}>
            <span className="absolute -top-0.5 left-1 text-[9px] font-mono text-sky-300 whitespace-nowrap">market {formatNumber(market, 2)}</span>
          </div>
        ) : null}
        {sorted.map((l, i) => (
          <div key={`${l.address}-${l.kind}-${i}`} className="absolute" style={{ left: x(l.tokenPerBch), top: l.kind === 'buy' ? '58%' : '18%' }}
            title={`${l.kind === 'buy' ? 'Buys' : 'Sells'} ${symbol} at 1 BCH = ${formatNumber(l.tokenPerBch, 4)}${l.fromMirror ? ' (after recycling)' : ''}${l.role ? ` · ${l.role}` : ''}`}>
            <div className={cn('w-2.5 h-2.5 -ml-1.5 rounded-full border',
              l.kind === 'buy' ? 'bg-emerald-400 border-emerald-300' : 'bg-rose-400 border-rose-300',
              l.fromMirror && 'bg-transparent border-dashed')} />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-zinc-500">
        <span className="font-mono">{formatNumber(min > 0 ? min : lo, 2)} {symbol}/BCH</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" />buys {symbol}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400" />sells {symbol}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full border border-dashed border-zinc-400" />after recycling</span>
        </span>
        <span className="font-mono">{formatNumber(max, 2)} {symbol}/BCH</span>
      </div>
    </div>
  );
}
