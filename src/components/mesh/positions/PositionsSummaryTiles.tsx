/**
 * Positions Summary Tiles (MeshDocs/meshv3v4flow/09 §3.2, canvas C1).
 * Displays total value locked, 7d fees, in-range percentage, and active position count.
 */
import { formatSatsCompact, formatUsd } from '@/lib/mesh/format';
import type { PositionsSummary } from '@/lib/mesh/positions/viewModel';

export function PositionsSummaryTiles({ summary }: { summary: PositionsSummary }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Total Value */}
      <div className="p-4 rounded-2xl border border-white/[0.08] bg-white/[0.02]">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Value in pools</div>
        <div className="mt-1 font-mono text-xl font-bold text-white">
          {formatSatsCompact(summary.totalValueSats)}
        </div>
        <div className="mt-0.5 text-xs text-zinc-400">
          {summary.totalValueUsd !== null ? formatUsd(summary.totalValueUsd) : '—'}
        </div>
      </div>

      {/* 7d Fees */}
      <div className="p-4 rounded-2xl border border-white/[0.08] bg-white/[0.02]">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Fees (7d)</div>
        <div className="mt-1 font-mono text-xl font-bold text-emerald-400">
          {formatSatsCompact(summary.fees7dSats)}
        </div>
        <div className="mt-0.5 text-xs text-zinc-400">
          {summary.fees7dUsd !== null ? formatUsd(summary.fees7dUsd) : '—'}
        </div>
      </div>

      {/* In Range % */}
      <div className="p-4 rounded-2xl border border-white/[0.08] bg-white/[0.02]">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">In range</div>
        <div className="mt-1 font-mono text-xl font-bold text-white">
          {summary.inRangePct !== null ? `${summary.inRangePct}%` : '—'}
        </div>
        <div className="mt-0.5 text-xs text-zinc-400">
          {summary.inRangeCount} of {summary.totalActive} active
        </div>
      </div>

      {/* Active Positions */}
      <div className="p-4 rounded-2xl border border-white/[0.08] bg-white/[0.02]">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Active positions</div>
        <div className="mt-1 font-mono text-xl font-bold text-white">
          {summary.totalActive}
        </div>
        <div className="mt-0.5 text-xs text-zinc-400">
          V4 bins + V3 covenants
        </div>
      </div>
    </div>
  );
}

