/**
 * Mesh action buttons (design system: Button, BigButton).
 *
 * - BigButton: the full-width 56 px pill at the bottom of a money-in flow, with
 *   the emerald glow. One per screen. A disabled one says why in its label.
 * - ActionButton: primary / outline / ghost buttons for everything else.
 */
import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BigButton({ children, onClick, disabled, loading, variant = 'primary', className, testId }: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'outline';
  className?: string;
  testId?: string;
}) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled || loading} aria-busy={loading || undefined} data-testid={testId}
      className={cn(
        'inline-flex h-14 w-full items-center justify-center gap-2 rounded-full px-6 text-base font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed motion-reduce:transition-none',
        variant === 'primary'
          ? 'bg-emerald-400 text-zinc-950 shadow-[0_0_24px_-6px_rgba(16,185,129,0.6)] hover:bg-emerald-300 disabled:bg-zinc-800 disabled:text-zinc-400 disabled:shadow-none'
          : 'border border-white/15 text-white hover:bg-white/[0.06] disabled:opacity-50',
        className,
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />}
      {children}
    </button>
  );
}

export function ActionButton({ children, onClick, disabled, loading, variant = 'primary', size = 'md', className, type = 'button', testId, ...rest }: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'outline' | 'ghost';
  size?: 'sm' | 'md';
  className?: string;
  type?: 'button' | 'submit';
  testId?: string;
  'aria-label'?: string;
}) {
  return (
    <button
      type={type} onClick={onClick} disabled={disabled || loading} aria-busy={loading || undefined} data-testid={testId} aria-label={rest['aria-label']}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed motion-reduce:transition-none',
        size === 'sm' ? 'h-9 px-3 text-xs' : 'h-11 px-5 text-sm',
        variant === 'primary' && 'bg-emerald-400 text-zinc-950 hover:bg-emerald-300 disabled:bg-zinc-800 disabled:text-zinc-400',
        variant === 'outline' && 'border border-white/15 text-white hover:bg-white/[0.06] disabled:opacity-50',
        variant === 'ghost' && 'text-zinc-300 hover:bg-white/[0.06] hover:text-white disabled:opacity-50',
        className,
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />}
      {children}
    </button>
  );
}

/** A text link styled button ("Use V3 pools instead", "Set separately"). */
export function LinkButton({ children, onClick, className, disabled }: { children: ReactNode; onClick?: () => void; className?: string; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={cn('rounded text-xs font-semibold text-emerald-300 underline-offset-2 outline-none hover:text-emerald-200 hover:underline focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-40', className)}>
      {children}
    </button>
  );
}
