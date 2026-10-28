/**
 * One status word for pools, strategies and positions, the same everywhere
 * (MeshDocs/meshv3v4flow/03 §0.4): a dot and the word, never colour alone.
 */
import { cn } from '@/lib/utils';

export type PositionStatus =
  | 'in-range' | 'out-of-range' | 'idle' | 'through-market' | 'closed' | 'pending' | 'active' | 'needs-withdraw';

const STYLE: Record<PositionStatus, { label: string; cls: string; dot: string }> = {
  'in-range': { label: 'In range', cls: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300', dot: 'bg-emerald-400' },
  active: { label: 'Active', cls: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300', dot: 'bg-emerald-400' },
  'out-of-range': { label: 'Out of range', cls: 'border-amber-500/30 bg-amber-500/10 text-amber-300', dot: 'bg-amber-400' },
  idle: { label: 'Idle', cls: 'border-amber-500/30 bg-amber-500/10 text-amber-300', dot: 'bg-amber-400' },
  pending: { label: 'Pending registration', cls: 'border-amber-500/30 bg-amber-500/10 text-amber-300', dot: 'bg-amber-400 animate-pulse motion-reduce:animate-none' },
  'needs-withdraw': { label: 'Needs withdraw', cls: 'border-amber-500/30 bg-amber-500/10 text-amber-300', dot: 'bg-amber-400' },
  'through-market': { label: 'Through market', cls: 'border-rose-400/30 bg-rose-500/10 text-rose-300', dot: 'bg-rose-400' },
  closed: { label: 'Closed', cls: 'border-zinc-500/25 bg-zinc-500/10 text-zinc-400', dot: 'bg-zinc-500' },
};

export function PositionStatusPill({ status, label, className, title }: { status: PositionStatus; label?: string; className?: string; title?: string }) {
  const s = STYLE[status];
  return (
    <span title={title} className={cn('inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold', s.cls, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} aria-hidden />
      {label ?? s.label}
    </span>
  );
}

export const positionStatusLabel = (s: PositionStatus) => STYLE[s].label;
