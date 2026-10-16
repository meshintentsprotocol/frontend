/**
 * The bins of a V4 position on the price grid: one column per bin, split into
 * the BCH it holds (buys tokens at its bid) and the tokens it holds (sells at
 * its ask), valued in sats. The market price is marked. A bin that a trade
 * pushed across flips in place, so a column can hold both.
 */
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { formatNumber, formatSatsCompact, formatUnits } from '@/lib/mesh/format';
import { tokenPerBch } from '@/lib/mesh/v4/display';
import type { V4BinView } from '@/lib/mesh/v4/types';

const BIN_MIN_SATS = 1000;

interface Col { k: number; bid: number; ask: number; bchSats: number; tokenSats: number; sats: string; tokens: string; empty: boolean }

export function BinStrip({ bins, decimals, symbol, market, activity }: {
  bins: V4BinView[]; decimals: number; symbol: string;
  /** market price, tokens per BCH */
  market: number | null;
  /** fills per bin (from the activity), shown on hover */
  activity?: Map<number, { buys: number; sells: number }>;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const cols = useMemo((): Col[] => bins.map(b => {
    const tokens = Number(b.tokens), sats = Number(b.sats);
    const tokenSats = tokens * b.bid.satsPerUnit;
    // the 1,000 sats every bin keeps are not liquidity
    const bchSats = Math.max(0, sats - BIN_MIN_SATS);
    return {
      k: b.index, bid: tokenPerBch(b.bid.satsPerUnit, decimals), ask: tokenPerBch(b.ask.satsPerUnit, decimals),
      bchSats, tokenSats, sats: b.sats, tokens: b.tokens, empty: b.utxos.length === 0,
    };
  }).sort((a, b) => a.bid - b.bid), [bins, decimals]);
  const max = Math.max(1, ...cols.map(c => c.bchSats + c.tokenSats));
  // the market sits between the last column whose bid is below it and the next
  const marketAt = market ? cols.findIndex(c => c.ask >= market) : -1;
  const s = sel !== null ? cols.find(c => c.k === sel) : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] text-zinc-400">
        <span className="font-semibold uppercase tracking-wider">Bins</span>
        <span className="flex gap-3 font-mono">
          <span><span className="inline-block w-2 h-2 rounded-sm mr-1 bg-emerald-400" />BCH (buys {symbol})</span>
          <span><span className="inline-block w-2 h-2 rounded-sm mr-1 bg-amber-400" />{symbol} (sells)</span>
        </span>
      </div>
      <div className="relative h-36 rounded-xl bg-black/40 border border-white/[0.06] p-2 flex items-end gap-[3px]" role="list" aria-label="Bins by price">
        {cols.map((c, i) => {
          const total = c.bchSats + c.tokenSats;
          const h = (total / max) * 100;
          return (
            <button
              key={c.k}
              type="button"
              role="listitem"
              onClick={() => setSel(sel === c.k ? null : c.k)}
              title={`Bin ${c.k}: buys at ${formatNumber(c.bid, 4)}, sells at ${formatNumber(c.ask, 4)} ${symbol}/BCH · ${formatSatsCompact(c.sats)} + ${formatUnits(c.tokens, decimals)} ${symbol}`}
              className={cn('relative flex-1 min-w-[4px] h-full flex flex-col justify-end rounded-sm outline-none', sel === c.k && 'ring-1 ring-white/60', i === marketAt && 'ml-2')}
            >
              {i === marketAt && <span className="absolute -left-[6px] top-0 bottom-0 border-l border-dashed border-zinc-400" aria-label="market" />}
              {c.empty ? <span className="h-[2px] bg-zinc-700 rounded-sm" /> : (
                <span className="flex flex-col justify-end w-full" style={{ height: `${Math.max(h, 2)}%` }}>
                  {c.tokenSats > 0 && <span className="bg-amber-400/90 rounded-t-sm" style={{ flexGrow: c.tokenSats }} />}
                  {c.bchSats > 0 && <span className={cn('bg-emerald-400/90', c.tokenSats > 0 ? '' : 'rounded-t-sm')} style={{ flexGrow: c.bchSats }} />}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] font-mono text-zinc-500 px-1">
        <span>{cols[0] ? formatNumber(cols[0].ask, 2) : ''} {symbol}/BCH</span>
        {market ? <span className="text-zinc-400">market {formatNumber(market, 2)}</span> : null}
        <span>{cols.length ? formatNumber(cols[cols.length - 1]!.bid, 2) : ''}</span>
      </div>
      {s && (
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[11px] grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
          <div><div className="text-zinc-500">Bin</div><div className="text-white">#{s.k}</div></div>
          <div><div className="text-zinc-500">Buys / sells at</div><div className="text-white">{formatNumber(s.bid, 4)} / {formatNumber(s.ask, 4)}</div></div>
          <div><div className="text-zinc-500">Holds</div><div className="text-white">{formatSatsCompact(s.sats)} + {formatUnits(s.tokens, decimals)} {symbol}</div></div>
          <div><div className="text-zinc-500">Fills</div><div className="text-white">{activity?.get(s.k) ? `${activity.get(s.k)!.buys} bought · ${activity.get(s.k)!.sells} sold` : '—'}</div></div>
        </div>
      )}
    </div>
  );
}
