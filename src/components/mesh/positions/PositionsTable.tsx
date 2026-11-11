/**
 * Positions Table for desktop screens (≥ 1024px) (MeshDocs/meshv3v4flow/04 §4).
 */
import { PositionRow } from './PositionRow';
import type { PositionRow as PositionRowModel } from '@/lib/mesh/positions/viewModel';

export function PositionsTable({ rows }: { rows: PositionRowModel[] }) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-white/[0.08] bg-[#0c0c10]">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-white/[0.08] text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            <th className="py-3.5 pl-4 pr-3">Pair</th>
            <th className="py-3.5 px-3">Strategy</th>
            <th className="py-3.5 px-3">Value</th>
            <th className="py-3.5 px-3">Fees (7d)</th>
            <th className="py-3.5 px-3">Range & Price</th>
            <th className="py-3.5 px-3">Status</th>
            <th className="py-3.5 pl-3 pr-4 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <PositionRow key={`${row.kind}-${row.id}`} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
