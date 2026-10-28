/**
 * A pill switch between two or three modes (Simple / Advanced, V4 / V3),
 * the same control /borrow uses.
 */
import { cn } from '@/lib/utils';

export function SegmentedSwitch<V extends string>({ value, options, onChange, label, size = 'md', className }: {
  value: V;
  options: Array<{ value: V; label: string; disabled?: boolean }>;
  onChange: (v: V) => void;
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1', className)}>
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-full font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-40',
            size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm',
            o.value === value ? 'bg-white text-zinc-950' : 'text-zinc-400 hover:text-white',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
