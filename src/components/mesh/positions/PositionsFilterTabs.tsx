/**
 * Positions Filter Tabs (MeshDocs/meshv3v4flow/09 §3.2, canvas C1).
 * Filters positions list by: All · In range · Out of range · Idle · Closed.
 */
import { cn } from '@/lib/utils';
import type { CoverageStatus } from '@/lib/mesh/positions/coverage';

export type PositionFilter = 'all' | CoverageStatus;

export interface FilterCount {
  all: number;
  'in-range': number;
  'out-of-range': number;
  idle: number;
  closed: number;
}

export function PositionsFilterTabs({
  active,
  onChange,
  counts,
}: {
  active: PositionFilter;
  onChange: (filter: PositionFilter) => void;
  counts: FilterCount;
}) {
  const tabs: Array<{ id: PositionFilter; label: string; dot?: string; count: number }> = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'in-range', label: 'In range', dot: 'bg-emerald-400', count: counts['in-range'] },
    { id: 'out-of-range', label: 'Out of range', dot: 'bg-amber-400', count: counts['out-of-range'] },
    { id: 'idle', label: 'Idle', dot: 'bg-amber-500', count: counts.idle },
    { id: 'closed', label: 'Closed', count: counts.closed },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] pb-3">
      {tabs.map(t => {
        const selected = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition outline-none',
              selected
                ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/20'
                : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200',
            )}
          >
            {t.dot && <span className={cn('h-2 w-2 rounded-full', t.dot)} aria-hidden />}
            <span>{t.label}</span>
            <span
              className={cn(
                'rounded-md px-1.5 py-0.5 font-mono text-[10px]',
                selected ? 'bg-white/15 text-white' : 'bg-white/[0.04] text-zinc-500',
              )}
            >
              {t.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

