/**
 * A row of small single-choice chips: fee tiers, bin steps, strength, gap
 * presets. Wraps to two rows on narrow screens.
 */
import { cn } from '@/lib/utils';

export interface TierOption<V extends string> { value: V; label: string; hint?: string; disabled?: boolean }

export function TierChips<V extends string>({ value, options, onChange, label, className, mono = true }: {
  value: V | null | undefined;
  options: Array<TierOption<V>>;
  onChange: (v: V) => void;
  label: string;
  className?: string;
  mono?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('flex flex-wrap gap-1.5 rounded-xl border border-white/[0.06] bg-black/40 p-1', className)}>
      {options.map(o => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            title={o.hint}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex min-h-[40px] min-w-[64px] flex-1 flex-col items-center justify-center rounded-lg px-2 py-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-40',
              on ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-zinc-200',
            )}
          >
            <span className={cn('text-xs font-semibold', mono && 'font-mono')}>{o.label}</span>
            {o.hint && <span className="hidden text-[10px] text-zinc-500 sm:block">{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}
