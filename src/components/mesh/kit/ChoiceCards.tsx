/**
 * Large single-choice cards (goals, presets, proceeds, sides, start-with):
 * a radio group of real buttons, the chosen one outlined in emerald.
 */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface ChoiceOption<V extends string> {
  value: V;
  title: ReactNode;
  line?: ReactNode;
  /** small text under the line ("Best for most pairs") */
  note?: ReactNode;
  /** top-right badge (engine, "Suggested") */
  badge?: ReactNode;
  /** a small picture above the title (shape bars) */
  art?: ReactNode;
  disabled?: boolean;
}

const COLS = { 1: 'grid-cols-1', 2: 'grid-cols-1 sm:grid-cols-2', 3: 'grid-cols-1 sm:grid-cols-3', 4: 'grid-cols-2 lg:grid-cols-4', 5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5' } as const;

export function ChoiceCards<V extends string>({ value, options, onChange, label, columns = 2, size = 'md', className }: {
  value: V | null | undefined;
  options: Array<ChoiceOption<V>>;
  onChange: (v: V) => void;
  label: string;
  columns?: keyof typeof COLS;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('grid gap-2.5', COLS[columns], className)}>
      {options.map(o => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex min-h-[44px] flex-col gap-1.5 rounded-2xl border text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-40',
              size === 'sm' ? 'p-3' : 'p-4',
              on ? 'border-emerald-400/60 bg-emerald-500/[0.08] shadow-[0_0_0_1px_rgba(52,211,153,0.15)]' : 'border-white/[0.08] bg-white/[0.02] hover:border-white/20',
            )}
          >
            {o.art}
            <span className="flex w-full items-start justify-between gap-2">
              <span className={cn('font-heading font-semibold text-white', size === 'sm' ? 'text-[13px]' : 'text-[15px]')}>{o.title}</span>
              {o.badge}
            </span>
            {o.line && <span className={cn('leading-relaxed text-zinc-300', size === 'sm' ? 'text-[11px]' : 'text-xs')}>{o.line}</span>}
            {o.note && <span className="text-[11px] text-zinc-400">{o.note}</span>}
          </button>
        );
      })}
    </div>
  );
}
