/**
 * How a previewed position spreads its deposit: one bar per pool at its price
 * ("1 BCH = P tokens"), BCH bids and token asks, valued in BCH, with the market
 * price marked. Shows what the chosen shape (spot / curve / bid-ask) does.
 */
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { StrategyPoolPreview } from '@/lib/mesh/meshApi';
import { formatNumber } from '@/lib/mesh/format';

const BID = '#34d399';
const ASK = '#f59e0b';

export interface DistributionBar { tokenPerBch: number; bch: number; side: 'bid' | 'ask'; role: string }

/** Bars for the pools of a preview that trade `token` against BCH (other pools are left out). */
export function distributionBars(pools: StrategyPoolPreview[], token: string, decimals: number): DistributionBar[] {
  const out: DistributionBar[] = [];
  for (const p of pools) {
    const m = p.market?.[0];
    if (!m || typeof m.satsPerToken !== 'number' || !(m.satsPerToken > 0) || m.asset !== token) continue;
    const tokenPerBch = 1e8 / (m.satsPerToken * 10 ** decimals);
    const bch = p.deposit.token ? (Number(p.deposit.token.amount) * m.satsPerToken) / 1e8 : Number(p.deposit.sats) / 1e8;
    out.push({ tokenPerBch, bch, side: m.side === 'sells' ? 'ask' : 'bid', role: p.role });
  }
  return out.sort((a, b) => a.tokenPerBch - b.tokenPerBch);
}

export function RangeDistribution({ pools, token, decimals, symbol, market }: {
  pools: StrategyPoolPreview[]; token: string; decimals: number; symbol: string; market: number | null;
}) {
  const bars = distributionBars(pools, token, decimals);
  if (bars.length < 2) return null;
  const bidTotal = bars.filter(b => b.side === 'bid').reduce((a, b) => a + b.bch, 0);
  const askTotal = bars.filter(b => b.side === 'ask').reduce((a, b) => a + b.bch, 0);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] text-neutral-400">
        <span className="font-semibold uppercase tracking-wider">Liquidity by price</span>
        <span className="flex gap-3 font-mono">
          <span><span className="inline-block w-2 h-2 rounded-sm mr-1" style={{ background: BID }} />BCH {formatNumber(bidTotal, 4)}</span>
          <span><span className="inline-block w-2 h-2 rounded-sm mr-1" style={{ background: ASK }} />{symbol} ≈ {formatNumber(askTotal, 4)} BCH</span>
        </span>
      </div>
      <div className="h-40 rounded-xl bg-black/40 border border-neutral-800 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bars} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="tokenPerBch" tick={{ fill: '#71717a', fontSize: 10 }} tickFormatter={v => formatNumber(Number(v), 2)} />
            <YAxis tick={{ fill: '#71717a', fontSize: 10 }} width={48} tickFormatter={v => formatNumber(Number(v), 3)} />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              contentStyle={{ background: '#0c0c10', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11 }}
              labelFormatter={v => `1 BCH = ${formatNumber(Number(v), 4)} ${symbol}`}
              formatter={(v: number, _n, item: any) => [`${formatNumber(v, 6)} BCH`, item?.payload?.side === 'ask' ? `${item.payload.role} · sells ${symbol}` : `${item?.payload?.role} · buys ${symbol}`]}
            />
            {market ? <ReferenceLine x={bars.reduce((a, b) => (Math.abs(b.tokenPerBch - market) < Math.abs(a.tokenPerBch - market) ? b : a)).tokenPerBch} stroke="#a1a1aa" strokeDasharray="3 3" label={{ value: 'market', fill: '#a1a1aa', fontSize: 10, position: 'top' }} /> : null}
            <Bar dataKey="bch" isAnimationActive={false} radius={[3, 3, 0, 0]}>
              {bars.map((b, i) => <Cell key={i} fill={b.side === 'bid' ? BID : ASK} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
