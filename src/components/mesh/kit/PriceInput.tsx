/**
 * "1 BCH = [P] TOKEN" with the reverse price, the token's price against the
 * market, and quick ±% chips. Chips move the token's price: +2% = the token
 * 2% dearer than the market (fewer tokens per BCH).
 */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { bchPerToken, formatPriceInput, parsePrice, priceAtPct, signedPct, vsMarketPct } from '@/lib/mesh/create/price';

export function PriceInput({
  id, label, value, onChange, symbol, decimals, midSatsPerUnit, chips = [-5, -2, -1, 0, 1, 2, 5], hint, error, accent, className, compact,
}: {
  id: string;
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  symbol: string;
  decimals: number;
  midSatsPerUnit?: number | null;
  /** token-price offsets in percent; [] hides the row */
  chips?: number[];
  hint?: ReactNode;
  error?: string | null;
  /** label colour for a side: 'bch' (buys the token), 'token' (sells it) */
  accent?: 'bch' | 'token';
  className?: string;
  compact?: boolean;
}) {
  const p = parsePrice(value);
  const vs = vsMarketPct(value, decimals, midSatsPerUnit);
  const hasMarket = !!midSatsPerUnit && midSatsPerUnit > 0;
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5 rounded-2xl border bg-white/[0.02] p-3.5', error ? 'border-rose-400/40' : 'border-white/[0.06]', className)}>
      <label htmlFor={id} className={cn('text-[11px] font-medium', accent === 'bch' ? 'text-emerald-300' : accent === 'token' ? 'text-cyan-300' : 'text-zinc-400')}>{label}</label>
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="shrink-0 text-xs text-zinc-400">1 BCH =</span>
        <input
          id={id}
          value={value}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          aria-invalid={!!error}
          onChange={e => {
            const v = e.target.value.replace(',', '.');
            if (/^\d*\.?\d*$/.test(v)) onChange(v);
          }}
          className={cn('w-full min-w-0 border-b border-white/10 bg-transparent font-mono font-bold text-white outline-none focus:border-emerald-400/60', compact ? 'text-lg' : 'text-xl')}
        />
        <span className="shrink-0 text-xs text-zinc-400">{symbol}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[11px]">
        {p > 0 && <span className="text-zinc-400">1 {symbol} = {formatPriceInput(bchPerToken(p))} BCH</span>}
        {vs !== null && (
          <span className={cn(Math.abs(vs) < 0.05 ? 'text-sky-300' : 'text-zinc-300')}>
            {symbol} price {signedPct(vs)} vs market
          </span>
        )}
      </div>
      {hasMarket && chips.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-0.5" role="group" aria-label={`Set ${symbol} price against the market`}>
          {chips.map(d => (
            <button key={d} type="button" onClick={() => onChange(formatPriceInput(priceAtPct(midSatsPerUnit!, decimals, d)))}
              className="rounded-md border border-white/10 px-1.5 py-1 font-mono text-[10px] text-zinc-400 outline-none hover:border-white/25 hover:text-white focus-visible:ring-2 focus-visible:ring-emerald-400">
              {d === 0 ? 'Market' : `${d > 0 ? '+' : '−'}${Math.abs(d)}%`}
            </button>
          ))}
        </div>
      )}
      {hint && <p className="text-[11px] text-zinc-400">{hint}</p>}
      {error && <p className="text-[11px] text-rose-300">{error}</p>}
    </div>
  );
}
