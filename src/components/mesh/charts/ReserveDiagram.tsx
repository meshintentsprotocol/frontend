/**
 * One BCH reserve that 2–3 tokens can buy from (multi-pair, canvas B3): the
 * reserve on one side, each token's market on the other, joined by arrows.
 * Stacked on phones.
 */
import { ArrowDown, ArrowRight } from 'lucide-react';
import { TokenAvatar, type TokenInfo } from '@/components/mesh/pools/shared';
import { cn } from '@/lib/utils';

export interface ReserveRow { key: string; info: TokenInfo | null; priceText: string; vsText?: string | null }

export function ReserveDiagram({ reserveText, rows, className }: { reserveText: string | null; rows: ReserveRow[]; className?: string }) {
  return (
    <div className={cn('flex flex-col items-stretch gap-3 rounded-2xl border border-white/[0.06] bg-black/35 p-4 sm:flex-row sm:items-center', className)}
      role="img" aria-label={`One BCH reserve${reserveText ? ` of ${reserveText}` : ''} that ${rows.length} tokens can buy from`}>
      <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.06] px-4 py-3 sm:w-48">
        <TokenAvatar info="BCH" size={30} />
        <div className="min-w-0">
          <div className="text-[11px] text-emerald-300">BCH reserve</div>
          <div className="truncate font-mono text-sm font-semibold text-white">{reserveText || 'set on the next step'}</div>
        </div>
      </div>
      <div className="flex justify-center text-zinc-500 sm:hidden" aria-hidden><ArrowDown className="h-4 w-4" /></div>
      <ul className="min-w-0 flex-1 space-y-2">
        {rows.map(r => (
          <li key={r.key} className="flex min-w-0 items-center gap-2">
            <ArrowRight className="hidden h-4 w-4 shrink-0 text-zinc-500 sm:block" aria-hidden />
            <div className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <span className="flex min-w-0 items-center gap-2">
                {r.info ? <TokenAvatar info={r.info} size={22} /> : <span className="h-[22px] w-[22px] rounded-full border border-dashed border-white/20" />}
                <span className="truncate text-sm font-semibold text-white">{r.info?.symbol ?? 'Choose a token'}</span>
              </span>
              <span className="flex flex-col items-end">
                <span className="font-mono text-xs text-zinc-200">{r.priceText}</span>
                {r.vsText && <span className="font-mono text-[10px] text-zinc-500">{r.vsText}</span>}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
