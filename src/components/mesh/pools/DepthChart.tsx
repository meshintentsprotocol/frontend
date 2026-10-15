/**
 * Depth of a BCH pair on the canonical bin grid (GET /pools/depth): every LP's
 * pools at the same price level form one bin. BCH bids and token asks are
 * valued in BCH; the market level is marked. Each pool still belongs to its own
 * LP — a bin is only how the liquidity is shown.
 */
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { usePairDepth } from '@/hooks/useMesh';
import { formatNumber } from '@/lib/mesh/format';
import { cn } from '@/lib/utils';

const STEPS = [10, 25, 50, 100];

export function DepthChart({ token, decimals, symbol }: { token: string; decimals: number; symbol: string }) {
  const [step, setStep] = useState(100);
  const depth = usePairDepth(token, step);
  const tpb = (satsPerToken: number) => 1e8 / (satsPerToken * 10 ** decimals);
  const rows = (depth.data?.levels ?? []).map(l => {
    const price = Number(l.satsPerToken);
    return {
      index: l.index,
      tokenPerBch: tpb(price),
      bids: Number(l.bidSats) / 1e8,
      asks: (Number(l.askTokens) * price) / 1e8,
      pools: l.pools, lps: l.lps,
    };
  }).sort((a, b) => a.tokenPerBch - b.tokenPerBch);
  const active = depth.data?.activeIndex ?? null;
  const activeRow = active === null ? null : rows.reduce<(typeof rows)[number] | null>((a, r) => (!a || Math.abs(r.index - active) < Math.abs(a.index - active) ? r : a), null);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Depth by price level</span>
        <div className="flex gap-1">
          {STEPS.map(s => (
            <button key={s} onClick={() => setStep(s)}
              className={cn('px-2 py-0.5 rounded-md text-[10px] font-mono border transition-colors',
                s === step ? 'border-emerald-500/50 text-emerald-300 bg-emerald-500/10' : 'border-neutral-800 text-neutral-500 hover:text-neutral-300')}>
              {s / 100}%
            </button>
          ))}
        </div>
      </div>
      <div className="h-44 rounded-xl bg-black/40 border border-neutral-800 p-2">
        {depth.isError ? (
          <p className="text-[11px] text-neutral-500 p-3">Depth is not available from this Mesh server yet.</p>
        ) : rows.length === 0 ? (
          <p className="text-[11px] text-neutral-500 p-3">{depth.isLoading ? 'Loading depth…' : `No ${symbol} liquidity on the grid yet.`}</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="tokenPerBch" tick={{ fill: '#71717a', fontSize: 10 }} tickFormatter={v => formatNumber(Number(v), 2)} />
              <YAxis tick={{ fill: '#71717a', fontSize: 10 }} width={48} tickFormatter={v => formatNumber(Number(v), 3)} />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                contentStyle={{ background: '#0c0c10', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11 }}
                labelFormatter={(v, items: any) => `1 BCH = ${formatNumber(Number(v), 4)} ${symbol} · ${items?.[0]?.payload?.lps ?? 0} LP(s), ${items?.[0]?.payload?.pools ?? 0} pool(s)`}
                formatter={(v: number, name: string) => [`${formatNumber(v, 6)} BCH`, name === 'bids' ? `Bids (buy ${symbol})` : `Asks (sell ${symbol})`]}
              />
              {activeRow && <ReferenceLine x={activeRow.tokenPerBch} stroke="#a1a1aa" strokeDasharray="3 3" label={{ value: 'market', fill: '#a1a1aa', fontSize: 10, position: 'top' }} />}
              <Bar dataKey="bids" stackId="d" fill="#34d399" isAnimationActive={false} />
              <Bar dataKey="asks" stackId="d" fill="#f59e0b" isAnimationActive={false} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <p className="text-[10px] text-neutral-600">Pools at the same price are grouped for display; each still belongs to its own LP. Pools worth less than {formatNumber(Number(depth.data?.minBinSats ?? 5000), 0)} sats are not shown or routed.</p>
    </div>
  );
}
