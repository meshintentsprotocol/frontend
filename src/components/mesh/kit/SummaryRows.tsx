/**
 * Label on the left, value on the right: reviews and details.
 */
import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface SummaryRow {
  label: ReactNode;
  value: ReactNode;
  hint?: string;
  strong?: boolean;
  tone?: 'default' | 'good' | 'warn' | 'bad' | 'muted';
  key?: string;
}

const TONE = { default: 'text-zinc-200', good: 'text-emerald-300', warn: 'text-amber-300', bad: 'text-rose-300', muted: 'text-zinc-400' } as const;

export function SummaryRows({ rows, className }: { rows: Array<SummaryRow | null | false | undefined>; className?: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <dl className={cn('divide-y divide-white/[0.04]', className)}>
        {rows.filter((r): r is SummaryRow => !!r).map((r, i) => (
          <div key={r.key ?? i} className="flex items-start justify-between gap-4 py-2 text-sm">
            <dt className="flex items-center gap-1 text-zinc-400">
              {r.label}
              {r.hint && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" aria-label={r.hint} className="rounded-full text-zinc-500 outline-none hover:text-zinc-300 focus-visible:ring-2 focus-visible:ring-emerald-400">
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">{r.hint}</TooltipContent>
                </Tooltip>
              )}
            </dt>
            <dd className={cn('min-w-0 text-right font-mono text-[13px] tabular-nums', r.strong ? 'font-semibold text-white' : TONE[r.tone ?? 'default'])}>{r.value}</dd>
          </div>
        ))}
      </dl>
    </TooltipProvider>
  );
}
