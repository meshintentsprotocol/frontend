/**
 * LP metrics of a strategy (server estimates): against simply holding the
 * deposits, the share of trading that came from arbitrage, time the market spent
 * inside the range, and what the position would be worth if the market moved.
 */
import type { StrategyMetrics } from '@/lib/mesh/meshApi';
import { formatNumber, formatSatsCompact } from '@/lib/mesh/format';
import { cn } from '@/lib/utils';

const signed = (sats: number | string) => {
  const n = Number(sats);
  return `${n > 0 ? '+' : ''}${formatSatsCompact(String(Math.round(n)))}`;
};
const tone = (n: number) => (n > 0 ? 'text-emerald-300' : n < 0 ? 'text-rose-300' : 'text-neutral-300');

export function StrategyMetricsPanel({ m, symbol, decimals, feesSats }: { m: StrategyMetrics; symbol: string; decimals: number; feesSats?: string }) {
  const tpb = (satsPerToken: number) => 1e8 / (satsPerToken * 10 ** decimals);
  const vsHold = Number(m.vsHoldSats);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label="Against holding" value={signed(m.vsHoldSats)} sub={m.vsHoldPct !== null ? `${m.vsHoldPct > 0 ? '+' : ''}${m.vsHoldPct.toFixed(2)}% of ${formatSatsCompact(m.holdValueSats)}` : 'no deposits recorded'} className={tone(vsHold)} />
        <Tile label="Time in range" value={m.timeInRange?.pct !== null && m.timeInRange?.pct !== undefined ? `${m.timeInRange.pct}%` : '—'} sub={m.timeInRange?.samples ? `${m.timeInRange.samples} market samples` : 'no market samples yet'} />
        <Tile label="From arbitrage" value={m.arbitrage.arbitrageVolumePct !== null ? `${m.arbitrage.arbitrageVolumePct}%` : '—'} sub={`${m.arbitrage.arbitrageFills} of ${m.arbitrage.fills} fills`} />
        <Tile label="Range" value={m.range ? `${formatNumber(tpb(m.range.high), 2)} – ${formatNumber(tpb(m.range.low), 2)}` : '—'} sub={`${symbol} per BCH`} />
      </div>

      {m.stress && (
        <div className="rounded-xl border border-neutral-800 overflow-hidden">
          <div className="px-3 py-2 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider bg-black/30">If the market moved</div>
          <table className="w-full text-xs font-mono">
            <thead className="text-neutral-500">
              <tr><th className="text-left px-3 py-1.5 font-normal">Move</th><th className="text-right px-3 font-normal">1 BCH =</th><th className="text-right px-3 font-normal">Position</th><th className="text-right px-3 font-normal">Holding it</th><th className="text-right px-3 font-normal">Difference</th><th className="text-right px-3 font-normal" title="What fees and bin gaps must have earned for the position to match holding at this price">Fees needed</th></tr>
            </thead>
            <tbody>
              {m.stress.rows.map(r => (
                <tr key={r.move} className="border-t border-neutral-900">
                  <td className="px-3 py-1.5 text-neutral-300">{r.move < 1 ? '−' : '+'}{Math.round(Math.abs(r.move - 1) * 100)}%</td>
                  <td className="px-3 text-right text-neutral-400">{formatNumber(tpb(r.satsPerToken), 2)} {symbol}</td>
                  <td className="px-3 text-right text-neutral-200">{formatSatsCompact(String(r.positionSats))}</td>
                  <td className="px-3 text-right text-neutral-400">{formatSatsCompact(String(r.holdSats))}</td>
                  <td className={cn('px-3 text-right', tone(r.vsHoldSats))}>{signed(r.vsHoldSats)}</td>
                  <td className="px-3 text-right">{(() => {
                    const need = r.feesNeededSats ?? Math.max(0, -r.vsHoldSats);
                    if (!need) return <span className="text-emerald-300">—</span>;
                    const covered = feesSats !== undefined && BigInt(feesSats) >= BigInt(need);
                    return <span className={covered ? 'text-emerald-300' : 'text-zinc-300'} title={covered ? 'Fees earned so far already cover it' : undefined}>{formatSatsCompact(String(need))}</span>;
                  })()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-3 py-2 text-[10px] text-neutral-600">Pools the move crosses convert at their own price, as arbitrage would take them. "Fees needed" is what fees and bin gaps must earn for the position to match holding at that price{feesSats !== undefined ? ` (earned so far: ${formatSatsCompact(feesSats)})` : ''}. Estimates, not a promise.</p>
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, sub, className }: { label: string; value: string; sub?: string; className?: string }) {
  return (
    <div className="p-3 rounded-xl bg-black/40 border border-neutral-800">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className={cn('text-base font-mono font-semibold mt-1', className ?? 'text-neutral-100')}>{value}</div>
      {sub && <div className="text-[10px] text-neutral-500 mt-0.5">{sub}</div>}
    </div>
  );
}
