/**
 * The create flow's step list: a vertical list beside the form on wide
 * screens, a "Step 2 of 3" bar with progress on narrow ones.
 */
import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StepState = 'done' | 'current' | 'todo';

export interface StepItem {
  key: string;
  label: string;
  /** one line under the label: what was chosen, or what the step asks for */
  sub?: ReactNode;
  state: StepState;
  /** done steps can be reopened */
  onSelect?: () => void;
}

function Marker({ index, state }: { index: number; state: StepState }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold',
        state === 'current' && 'bg-emerald-400 text-zinc-950',
        state === 'done' && 'bg-emerald-500/15 text-emerald-300',
        state === 'todo' && 'border border-white/15 text-zinc-400',
      )}
    >
      {state === 'done' ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
    </span>
  );
}

/** Vertical step list (desktop). */
export function StepList({ steps, className }: { steps: StepItem[]; className?: string }) {
  return (
    <ol className={cn('flex flex-col gap-1', className)} aria-label="Steps">
      {steps.map((s, i) => {
        const body = (
          <>
            <Marker index={i} state={s.state} />
            <span className="flex min-w-0 flex-col gap-0.5 text-left">
              <span className={cn('text-sm font-semibold', s.state === 'current' ? 'text-white' : 'text-zinc-300')}>{s.label}</span>
              {s.sub !== undefined && (
                <span className={cn('truncate text-xs', s.state === 'current' ? 'text-emerald-300' : 'text-zinc-400')}>{s.sub}</span>
              )}
            </span>
          </>
        );
        return (
          <li key={s.key} aria-current={s.state === 'current' ? 'step' : undefined}>
            {s.onSelect && s.state === 'done' ? (
              <button type="button" onClick={s.onSelect}
                className="flex w-full items-start gap-3 rounded-xl p-3 outline-none transition-colors hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-emerald-400">
                {body}
              </button>
            ) : (
              <div className={cn('flex items-start gap-3 rounded-xl p-3', s.state === 'current' && 'bg-emerald-500/10')}>{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Compact "Step 2 of 3 · Range and shape" with a progress bar (phones and tablets). */
export function StepBar({ steps, className }: { steps: StepItem[]; className?: string }) {
  const current = Math.max(0, steps.findIndex(s => s.state === 'current'));
  const pct = ((current + 1) / Math.max(1, steps.length)) * 100;
  const step = steps[current];
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="font-semibold text-white">{step?.label}</span>
        <span className="font-mono text-zinc-400">Step {current + 1} of {steps.length}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-white/[0.08]" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={current + 1} aria-label="Progress">
        <div className="h-full rounded-full bg-emerald-400 transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
