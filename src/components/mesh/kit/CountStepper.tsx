/**
 * A − n + stepper for rungs and steps, kept inside its limits.
 */
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export function CountStepper({ label, value, min, max, onChange, className }: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  className?: string;
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)));
  const btn = 'flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 text-zinc-200 outline-none transition hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-40';
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-[11px] font-medium text-zinc-400">{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" className={btn} aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => set(value - 1)}>
          <Minus className="h-4 w-4" />
        </button>
        <output className="min-w-[3ch] text-center font-mono text-xl font-bold text-white" aria-live="polite">{value}</output>
        <button type="button" className={btn} aria-label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => set(value + 1)}>
          <Plus className="h-4 w-4" />
        </button>
        <span className="text-[11px] text-zinc-500">{min} to {max}</span>
      </div>
    </div>
  );
}
