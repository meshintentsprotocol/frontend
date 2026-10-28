/**
 * A large amount input with its asset, balance, Max and USD value — the /borrow
 * card, for Mesh deposits. Percent buttons (25/50/75/Max) are optional.
 */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { TokenAvatar, type TokenInfo } from '@/components/mesh/pools/shared';

export function AmountCard({
  id, label, asset, value, onChange, readOnly, balance, onFraction, usd, hint, footer, error, className, linkedNote,
}: {
  id: string;
  label: ReactNode;
  asset: TokenInfo | 'BCH';
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  /** formatted balance text ("0.8210") */
  balance?: string | null;
  /** 25 / 50 / 75 / 100 % of the balance (the parent does the exact math) */
  onFraction?: (fraction: number) => void;
  usd?: string | null;
  hint?: ReactNode;
  footer?: ReactNode;
  error?: string | null;
  className?: string;
  /** e.g. "filled in from the range": shown under the amount */
  linkedNote?: ReactNode;
}) {
  const symbol = asset === 'BCH' ? 'BCH' : asset.symbol;
  return (
    <div className={cn('rounded-3xl border bg-white/[0.035] p-4 sm:p-5', error ? 'border-rose-400/40' : 'border-white/[0.07]', className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
        <label htmlFor={id} className="font-medium text-zinc-200">{label}</label>
        {balance !== undefined && balance !== null && (
          <span className="flex items-center gap-1.5 text-xs text-zinc-400">
            Balance <span className="font-mono text-zinc-300">{balance}</span>
            {onFraction && (
              <span className="ml-1 flex items-center gap-1">
                {[0.25, 0.5, 0.75, 1].map(f => (
                  <button key={f} type="button" onClick={() => onFraction(f)}
                    className="rounded-md px-1.5 py-0.5 font-semibold text-emerald-300 outline-none hover:bg-emerald-500/10 focus-visible:ring-2 focus-visible:ring-emerald-400">
                    {f === 1 ? 'Max' : `${f * 100}%`}
                  </button>
                ))}
              </span>
            )}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <input
          id={id}
          value={value}
          readOnly={readOnly}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          aria-invalid={!!error}
          onChange={e => {
            const v = e.target.value.replace(',', '.');
            if (/^\d*\.?\d*$/.test(v)) onChange?.(v);
          }}
          className="h-12 w-full min-w-0 bg-transparent font-mono text-3xl font-semibold tabular-nums text-white outline-none placeholder:text-zinc-600 sm:text-4xl"
        />
        <span className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-white/10 bg-zinc-900 pl-1.5 pr-3 text-[15px] font-semibold text-white">
          <TokenAvatar info={asset} size={28} />
          {symbol}
        </span>
      </div>
      <div className="mt-1 min-h-[20px] text-sm tabular-nums text-zinc-500">
        {usd}{usd && linkedNote ? ' · ' : ''}{linkedNote}
      </div>
      {hint && <p className="mt-1 text-xs text-zinc-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-rose-300">{error}</p>}
      {footer}
    </div>
  );
}
