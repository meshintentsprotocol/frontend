/**
 * Market & liquidity health (V3 upgrades).
 *
 *   /admin/market     per pool token: the mid and its source, Cauldron against
 *                     the Mesh mid, the suggestion guard, the sampled history and
 *                     the pair's depth on the bin grid
 *   /admin/liquidity  how usable the pools' liquidity is: UTXOs per pool, the
 *                     extra ones and the bytes they cost, dust the router skips,
 *                     pools priced through the market, and how that moves over time
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart as LineIcon, HeartPulse, RefreshCw, AlertTriangle, Layers, Gauge } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAdmin } from '../AdminContext';
import { useAdminAction, useLiquidity, useMarket } from '../hooks';
import {
  PageHeader, Section, QueryState, KpiTile, KeyValue, Pill, DataTable, Hash, adminUrl, TimeAgo, Segmented, ConfirmAction, duration, useUrlState,
} from '../kit';
import { AssetPair, useAssets } from '../assets';
import type { LiquidityTotals, MarketRow, PoolHealth } from '../api';
import { DepthChart } from '@/components/mesh/pools/DepthChart';
import { formatNumber, formatSatsCompact } from '@/lib/mesh/format';
import { cn } from '@/lib/utils';

const axis = { stroke: '#52525b', fontSize: 10, tickLine: false, axisLine: false } as const;
const tooltip = {
  contentStyle: { background: '#0b0d12', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 11 },
  labelStyle: { color: '#a1a1aa' }, itemStyle: { padding: 0 },
};
const legend = { wrapperStyle: { fontSize: 11, color: '#a1a1aa', paddingTop: 6 }, iconSize: 8 } as const;
const when = (t: number) => new Date(t * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const pct = (bps: number | null | undefined) => (bps === null || bps === undefined ? '—' : `${bps > 0 ? '+' : ''}${(bps / 100).toFixed(2)}%`);
const price = (v: number | null | undefined) => (v === null || v === undefined ? '—' : formatNumber(v, v >= 100 ? 2 : 6));

// ── Market ───────────────────────────────────────────────────────────────────

function GuardPill({ r, max }: { r: MarketRow; max: number }) {
  const c = r.midCheck;
  if (!c || c.divergenceBps === null) return <Pill tone="zinc" title={`${c?.samples ?? 0} samples in the window; 3 are needed to judge`}>learning</Pill>;
  return c.ok
    ? <Pill tone="emerald" dot title={`${pct(c.divergenceBps)} from the median of the last ${Math.round(c.windowSec / 60)} min`}>ok · {(c.divergenceBps / 100).toFixed(1)}%</Pill>
    : <Pill tone="rose" dot title={`more than ${(max / 100).toFixed(1)}% from the median: suggestions are refused`}>refusing · {(c.divergenceBps / 100).toFixed(1)}%</Pill>;
}

function MidHistoryChart({ r, height = 220 }: { r: MarketRow; height?: number }) {
  if (r.series.length < 2) return <p className="text-xs text-zinc-500 py-6 text-center">Not enough samples yet: one is taken every few minutes.</p>;
  return (
    <div style={{ height }} role="img" aria-label="Sampled market mid: Cauldron and Mesh">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={r.series} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tickFormatter={t => new Date(t * 1000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} {...axis} />
          <YAxis domain={['auto', 'auto']} width={64} tickFormatter={v => price(Number(v))} {...axis} />
          <Tooltip {...tooltip} labelFormatter={v => when(Number(v))} formatter={(v: number, n: string) => [`${price(v)} sats/unit`, n]} />
          <Legend {...legend} />
          <Line type="monotone" dataKey="cauldron" name="Cauldron" stroke="#38bdf8" strokeWidth={1.75} dot={false} connectNulls isAnimationActive={false} />
          <Line type="monotone" dataKey="mesh" name="Mesh mid" stroke="#34d399" strokeWidth={1.75} strokeDasharray="4 3" dot={false} connectNulls isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MarketPage() {
  const [hours, setHours] = useState('24');
  const q = useMarket(Number(hours));
  const [picked, setPicked] = useState<string | null>(null);
  const { get } = useAssets(q.data?.tokens.map(t => t.token) ?? []);
  return (
    <>
      <PageHeader title="Market & mids" icon={<LineIcon className="w-5 h-5 text-sky-300" />}
        description="The market price every pool token is judged against: where it comes from, how Cauldron and Mesh agree, and whether the suggestion guard would refuse it. New positions are centred on this price." />
      <QueryState q={q} rows={8}>
        {d => {
          const refusing = d.tokens.filter(t => t.midCheck && !t.midCheck.ok);
          const shown = d.tokens.find(t => t.token === picked) ?? d.tokens[0] ?? null;
          const info = shown ? get(shown.token) : null;
          return (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
                <KpiTile label="Tokens followed" value={d.tokens.length} sub={`${d.sampler.samples} samples kept`} />
                <KpiTile label="Guard refusing" value={refusing.length} tone={refusing.length ? 'rose' : 'emerald'} sub={`over ${(d.guard.maxDivergenceBps / 100).toFixed(1)}% from the ${Math.round(d.guard.windowSec / 60)} min median`} />
                <KpiTile label="Sampler" value={d.sampler.stalled ? 'Stalled' : d.sampler.running ? 'Running' : 'Off'} tone={d.sampler.stalled ? 'amber' : d.sampler.running ? 'emerald' : 'zinc'}
                  sub={d.sampler.intervalSec ? `every ${duration(d.sampler.intervalSec)}` : undefined} />
                <KpiTile label="Last round" value={d.sampler.lastTickAt ? <TimeAgo at={d.sampler.lastTickAt} className="text-xl text-white" /> : '—'} />
                <KpiTile label="Through the market" value={d.tokens.reduce((a, t) => a + (t.throughMarketPools ?? 0), 0)} sub="pools, from the liquidity report" to="/admin/liquidity" />
                <KpiTile label="Widest Cauldron/Mesh gap" value={pct(d.tokens.reduce<number | null>((a, t) => (t.cauldronVsMeshBps !== null && (a === null || Math.abs(t.cauldronVsMeshBps) > Math.abs(a)) ? t.cauldronVsMeshBps : a), null))} />
              </div>

              <Section title="Pool tokens" description="Click a row for its price history and depth. Prices are sats per token base unit."
                actions={<Segmented label="History" value={hours} onChange={setHours} options={[{ value: '6', label: '6 h' }, { value: '24', label: '24 h' }, { value: '168', label: '7 d' }]} />}>
                <DataTable<MarketRow>
                  rows={d.tokens} rowKey={t => t.token} onRowClick={t => setPicked(t.token)}
                  rowClassName={t => (shown?.token === t.token ? 'bg-white/[0.03]' : undefined)}
                  columns={[
                    { key: 'tok', header: 'Token', cell: t => <span className="inline-flex items-center gap-2"><AssetPair sell={t.token} buy="0x" size={14} /><span className="text-xs text-zinc-300">{t.symbol ?? get(t.token).symbol}</span></span> },
                    { key: 'mid', header: 'Mid', align: 'right', cell: t => <span className="font-mono text-xs text-white">{price(t.midSatsPerToken)}</span> },
                    { key: 'src', header: 'Source', cell: t => <Pill tone={t.midSource === 'cauldron' ? 'sky' : t.midSource ? 'emerald' : 'zinc'}>{t.midSource ?? 'none'}</Pill>, hideBelow: 'sm' },
                    { key: 'cauldron', header: 'Cauldron', align: 'right', cell: t => <span className="font-mono text-xs text-zinc-400">{price(t.cauldron ? Number(t.cauldron.satsPerToken) : null)}</span>, hideBelow: 'md' },
                    { key: 'mesh', header: 'Mesh bid / ask', align: 'right', cell: t => <span className="font-mono text-xs text-zinc-400">{price(t.mesh.bestBid ? Number(t.mesh.bestBid.satsPerToken) : null)} / {price(t.mesh.bestAsk ? Number(t.mesh.bestAsk.satsPerToken) : null)}</span>, hideBelow: 'lg' },
                    { key: 'gap', header: 'Cauldron vs Mesh', align: 'right', cell: t => <span className={cn('font-mono text-xs', Math.abs(t.cauldronVsMeshBps ?? 0) > 300 ? 'text-amber-300' : 'text-zinc-400')}>{pct(t.cauldronVsMeshBps)}</span>, hideBelow: 'md' },
                    { key: 'guard', header: 'Suggestion guard', cell: t => <GuardPill r={t} max={d.guard.maxDivergenceBps} /> },
                    { key: 'through', header: 'Through mkt', align: 'right', cell: t => <span className={cn('font-mono text-xs', t.throughMarketPools ? 'text-rose-300' : 'text-zinc-500')}>{t.throughMarketPools ?? '—'}</span>, hideBelow: 'lg' },
                    { key: 'last', header: 'Last sample', cell: t => <TimeAgo at={t.lastSampleAt} />, hideBelow: 'xl' },
                  ]}
                  empty={<div className="py-6 text-center text-xs text-zinc-500">No pool tokens yet.</div>}
                />
              </Section>

              {shown && info && (
                <div className="grid gap-5 xl:grid-cols-2">
                  <Section title={`${shown.symbol ?? info.symbol} price, last ${Number(hours) >= 168 ? '7 days' : `${hours} h`}`} icon={<LineIcon className="w-4 h-4 text-sky-300" />}
                    description={shown.midCheck?.recentMedian ? `Median of the last ${Math.round(shown.midCheck.windowSec / 60)} min: ${price(shown.midCheck.recentMedian)} (${shown.midCheck.samples} samples)` : 'The guard needs 3 samples in its window before it judges.'}>
                    <MidHistoryChart r={shown} />
                  </Section>
                  <Section title="Depth on the bin grid" icon={<Layers className="w-4 h-4 text-emerald-300" />}>
                    <DepthChart token={shown.token} decimals={shown.decimals ?? info.decimals} symbol={shown.symbol ?? info.symbol} />
                  </Section>
                </div>
              )}
            </>
          );
        }}
      </QueryState>
    </>
  );
}

// ── Liquidity health ─────────────────────────────────────────────────────────

function HealthHistoryChart({ rows, height = 200 }: { rows: LiquidityTotals[]; height?: number }) {
  if (rows.length < 2) return <p className="text-xs text-zinc-500 py-6 text-center">One row is kept per hour; the trend shows from the second hour.</p>;
  return (
    <div style={{ height }} role="img" aria-label="UTXOs per pool, extra UTXOs and pools through the market, hourly">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis dataKey="at" type="number" domain={['dataMin', 'dataMax']} tickFormatter={t => new Date(t * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} {...axis} />
          <YAxis yAxisId="l" allowDecimals {...axis} />
          <YAxis yAxisId="r" orientation="right" allowDecimals={false} {...axis} />
          <Tooltip {...tooltip} labelFormatter={v => when(Number(v))} />
          <Legend {...legend} />
          <Line yAxisId="l" type="monotone" dataKey="utxosPerPool" name="UTXOs per pool" stroke="#34d399" strokeWidth={1.75} dot={false} isAnimationActive={false} />
          <Line yAxisId="r" type="monotone" dataKey="extraUtxos" name="Extra UTXOs" stroke="#fbbf24" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <Line yAxisId="r" type="monotone" dataKey="dustUtxos" name="Too small to route" stroke="#a1a1aa" strokeDasharray="4 3" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <Line yAxisId="r" type="monotone" dataKey="throughMarketPools" name="Through the market" stroke="#fb7185" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function PoolHealthTable({ rows, empty }: { rows: PoolHealth[]; empty: string }) {
  const nav = useNavigate();
  return (
    <DataTable<PoolHealth>
      rows={rows} rowKey={p => p.address} onRowClick={p => nav(adminUrl.pool(p.address))}
      columns={[
        { key: 'addr', header: 'Pool', cell: p => <Hash value={p.address} to={adminUrl.pool(p.address)} copy={false} head={8} tail={4} /> },
        { key: 'pair', header: 'Sells → buys', cell: p => <AssetPair sell={p.reserve} buy={p.accepts[0] ?? '0x'} size={14} />, hideBelow: 'sm' },
        { key: 'mode', header: 'Type', cell: p => <Pill tone={p.mode === 2 ? 'violet' : 'zinc'}>{p.mode === 2 ? 'recycling' : p.mode === 1 ? 'fixed' : 'to owner'}</Pill>, hideBelow: 'md' },
        { key: 'utxos', header: 'UTXOs', align: 'right', cell: p => <span className={cn('font-mono text-xs', p.utxos > 2 ? 'text-amber-300' : 'text-zinc-300')}>{p.utxos} <span className="text-zinc-600">({p.routable} routable)</span></span> },
        { key: 'extra', header: 'Extra bytes / sweep', align: 'right', cell: p => <span className="font-mono text-xs text-zinc-400">{p.extraBytes ? `${formatNumber(p.extraBytes, 0)} B` : '—'}</span>, hideBelow: 'md' },
        { key: 'dust', header: 'Unroutable', align: 'right', cell: p => <span className={cn('font-mono text-xs', p.dustUtxos ? 'text-zinc-300' : 'text-zinc-600')}>{p.dustUtxos ? formatSatsCompact(p.dustValueSats) : '—'}</span>, hideBelow: 'lg' },
        { key: 'through', header: 'Market', cell: p => (p.throughMarket.length
          ? <Pill tone="rose" title={p.throughMarket.map(t => `${t.side} by ${(t.bps / 100).toFixed(2)}%`).join(', ')}>{p.throughMarket[0]!.side === 'buys-above-market' ? 'buys above' : 'sells below'} {(p.throughMarket[0]!.bps / 100).toFixed(1)}%</Pill>
          : <span className="text-xs text-zinc-600">ok</span>) },
        { key: 'value', header: 'Value', align: 'right', cell: p => <span className="font-mono text-xs">{formatSatsCompact(p.valueSats)}</span>, hideBelow: 'sm' },
        { key: 'owner', header: 'LP', cell: p => <Hash value={p.ownerPkh} to={adminUrl.lp(p.ownerPkh)} copy={false} head={6} tail={4} />, hideBelow: 'xl' },
        { key: 'strategy', header: 'Strategy', cell: p => p.strategy ? <Hash value={p.strategy} to={adminUrl.strategy(p.strategy)} copy={false} head={10} tail={3} /> : <span className="text-zinc-600 text-xs">—</span>, hideBelow: 'xl' },
      ]}
      empty={<div className="py-6 text-center text-xs text-zinc-500">{empty}</div>}
    />
  );
}

export function LiquidityHealthPage() {
  const { api } = useAdmin();
  const q = useLiquidity();
  const [f, set] = useUrlState({ view: 'fragmented' });
  const view = (['fragmented', 'through', 'dust', 'all'].includes(f.view) ? f.view : 'fragmented') as 'fragmented' | 'through' | 'dust' | 'all';
  const refresh = useAdminAction(() => api.liquidity(true), { label: 'Liquidity report', success: r => `Report refreshed: ${r.latest?.totals.activePools ?? 0} pools` });
  return (
    <>
      <PageHeader title="Liquidity health" icon={<HeartPulse className="w-5 h-5 text-emerald-300" />}
        description="How much of the pools' liquidity the router can actually use. Each partial fill of a recycling pool opens a new UTXO at its mirror; every UTXO is one more ~1 KB input to fill through, and one below the routing minimum is skipped. This page tracks that over time, which is what decides whether a V3.1 merge path is worth building."
        actions={<ConfirmAction label="Refresh now" icon={<RefreshCw className="w-3.5 h-3.5" />} pending={refresh.isPending}
          title="Recompute the liquidity report?" description="Prices every live pool now instead of waiting for the next 5-minute report." onConfirm={() => refresh.run(undefined)} />} />
      <QueryState q={q} rows={8}>
        {d => {
          if (!d.latest) return <p className="text-sm text-zinc-400">The first report is computed a few seconds after the server starts.</p>;
          const t = d.latest.totals;
          const pools = d.latest.pools;
          const lists = {
            fragmented: pools.filter(p => p.utxos > 1),
            through: pools.filter(p => p.throughMarket.length),
            dust: pools.filter(p => p.dustUtxos),
            all: pools,
          };
          return (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
                <KpiTile label="Active V3 pools" value={t.activePools} sub={`${t.mirrorPools} recycling`} />
                <KpiTile label="UTXOs per pool" value={t.utxosPerPool.toFixed(2)} tone={t.utxosPerPool > 1.5 ? 'amber' : 'emerald'} sub={`${t.utxos} UTXOs · max ${t.maxUtxosAtOnePool} at one`} />
                <KpiTile label="Fragmented pools" value={t.multiUtxoPools} sub="more than one UTXO" tone={t.multiUtxoPools ? 'amber' : undefined} />
                <KpiTile label="Extra UTXOs" value={t.extraUtxos} sub={t.avgExtraUtxoSats !== null ? `avg ${formatSatsCompact(String(t.avgExtraUtxoSats))}` : 'none'} />
                <KpiTile label="Extra bytes" value={`${formatNumber(t.extraBytes / 1000, 1)} KB`} sub={`to sweep every pool · ${d.latest.bytesPerPoolInput} B each`} />
                <KpiTile label="Too small to route" value={formatSatsCompact(t.dustValueSats)} sub={`${t.dustUtxos} UTXO(s) < ${formatSatsCompact(d.latest.minRouteBinSats)}`} tone={t.dustUtxos ? 'amber' : undefined} />
                <KpiTile label="Through the market" value={t.throughMarketPools} tone={t.throughMarketPools ? 'rose' : 'emerald'} sub={formatSatsCompact(t.throughMarketValueSats)} />
                <KpiTile label="Report" value={<TimeAgo at={t.at} className="text-xl text-white" />} sub="every 5 min" />
              </div>

              <div className="grid gap-5 xl:grid-cols-3">
                <Section title="Over time" icon={<Gauge className="w-4 h-4 text-emerald-300" />} description={`One row per hour, ${d.history.length} kept (7 days at most).`} className="xl:col-span-2">
                  <HealthHistoryChart rows={d.history} />
                </Section>
                <Section title="Reading it" icon={<AlertTriangle className="w-4 h-4 text-amber-300" />}>
                  <KeyValue rows={[
                    ['UTXOs per pool', 'Near 1 is healthy. A steady climb means mirror fragments are piling up faster than LPs recycle them.'],
                    ['Extra bytes', 'What fragments add to fills that sweep whole pools. At 1 sat/byte this is also sats.'],
                    ['Too small to route', 'Liquidity no trader can reach until its LP recycles or withdraws (Idle & recycle flags it as dust).'],
                    ['Through the market', 'Arbitrage takes these first. Their LPs see a warning on the pool page.'],
                  ]} />
                </Section>
              </div>

              <Section title="Pools"
                actions={<Segmented label="Show" value={view} onChange={v => set({ view: v })} options={[
                  { value: 'fragmented', label: 'Fragmented', count: lists.fragmented.length },
                  { value: 'through', label: 'Through the market', count: lists.through.length },
                  { value: 'dust', label: 'Unroutable dust', count: lists.dust.length },
                  { value: 'all', label: 'All', count: lists.all.length },
                ]} />}>
                <PoolHealthTable rows={lists[view]} empty={view === 'fragmented' ? 'Every pool holds one UTXO.' : view === 'through' ? 'No pool is priced through the market.' : view === 'dust' ? 'No pool UTXO is below the routing minimum.' : 'No active V3 pools.'} />
              </Section>
            </>
          );
        }}
      </QueryState>
    </>
  );
}
