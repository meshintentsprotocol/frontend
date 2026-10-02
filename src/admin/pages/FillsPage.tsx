import { useNavigate } from 'react-router-dom';
import { Zap, Timer, Coins, Users } from 'lucide-react';
import { useFills } from '../hooks';
import {
  PageHeader, Section, QueryState, Segmented, SearchBox, useUrlState, DataTable, Pager, KindBadge, MethodBadge, VenueBadge,
  TimeAgo, Hash, adminUrl, KpiTile, SplitBar, METHOD_META, duration, AddressLink, Pill,
} from '../kit';
import { Amount, AssetPair, AssetMapList } from '../assets';
import type { FillRow, LpFillAgg } from '../api';
import { formatSatsCompact } from '@/lib/mesh/format';

const LIMIT = 50;

export function FillsPage() {
  const nav = useNavigate();
  const [f, set] = useUrlState({ method: '', venue: '', kind: '', lp: '', pool: '', q: '', offset: '0' });
  const q = useFills({ ...f, limit: LIMIT, offset: Number(f.offset) });

  return (
    <>
      <PageHeader title="Fills" icon={<Zap className="w-5 h-5 text-emerald-300" />}
        description="Every intent this server filled: which route, which Mesh pools (and the LPs behind them), Cauldron pools or solver inventory supplied it, and how the surplus was split." />
      <QueryState q={q} rows={10}>
        {d => {
          const a = d.aggregates;
          return (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiTile label="Fills" value={a.count} sub={`${a.derived} rebuilt from ledger · ${d.externalPoolFills} pool fills by others`} icon={<Zap className="w-4 h-4" />} tone="emerald" />
                <KpiTile label="BCH-side volume" value={formatSatsCompact(a.bchVolumeSats)} sub="token↔token fills not counted" icon={<Coins className="w-4 h-4" />} />
                <KpiTile label="Latency" value={duration(a.latency.medianSec)} sub={`median · avg ${duration(a.latency.avgSec)} · p90 ${duration(a.latency.p90Sec)}`} icon={<Timer className="w-4 h-4" />} />
                <KpiTile label="Network fees" value={formatSatsCompact(a.networkFeeSats)} sub="paid by the solver" />
              </div>

              <div className="grid gap-5 lg:grid-cols-3">
                <Section title="By route">
                  <SplitBar parts={(Object.keys(METHOD_META) as Array<keyof typeof METHOD_META>).map(m => ({ label: METHOD_META[m].label, value: a.byMethod[m]?.count ?? 0, color: METHOD_META[m].color }))} />
                  <dl className="mt-4 space-y-1.5 text-xs">
                    {Object.entries(a.byMethod).map(([m, v]) => (
                      <div key={m} className="flex items-center justify-between"><dt><MethodBadge method={m} /></dt><dd className="font-mono text-zinc-300">{v.count} · {formatSatsCompact(v.bchVolumeSats)}</dd></div>
                    ))}
                  </dl>
                </Section>
                <Section title="By source" description="A split fill counts once per source it used.">
                  <SplitBar parts={[
                    { label: 'Mesh', value: a.byVenue.mesh?.fills ?? 0, color: '#34d399' },
                    { label: 'Cauldron', value: a.byVenue.cauldron?.fills ?? 0, color: '#38bdf8' },
                    { label: 'Solver', value: a.byVenue.solver?.fills ?? 0, color: '#fbbf24' },
                  ]} />
                  <dl className="mt-4 space-y-1.5 text-xs">
                    {Object.entries(a.byVenue).map(([v, x]) => (
                      <div key={v} className="flex items-center justify-between"><dt><VenueBadge venue={v} /></dt><dd className="font-mono text-zinc-300">{x.fills} fills · {x.legs} legs</dd></div>
                    ))}
                  </dl>
                </Section>
                <Section title="Fillers" description="Wallets that built and broadcast fills.">
                  <ul className="space-y-3">
                    {Object.entries(a.byFiller).map(([w, x]) => (
                      <li key={w} className="rounded-lg border border-white/[0.06] p-2.5 space-y-1">
                        <div className="flex items-center justify-between gap-2">{w === 'external' ? <Pill tone="rose">Other solvers</Pill> : <AddressLink address={w} />}<span className="font-mono text-xs text-zinc-300">{x.fills} fills</span></div>
                        <div className="text-[11px] text-zinc-500 flex items-center justify-between gap-2">fees <Amount asset="0x" value={x.feeSats} muted /></div>
                        {Object.keys(x.solverProfit).length > 0 && <div className="text-[11px] text-zinc-500 flex items-start justify-between gap-2">kept <AssetMapList map={x.solverProfit} /></div>}
                      </li>
                    ))}
                  </ul>
                </Section>
              </div>

              <div className="grid gap-5 xl:grid-cols-5">
                <Section title="LPs that supplied fills" icon={<Users className="w-4 h-4 text-emerald-300" />} className="xl:col-span-3" description="Mesh pool legs per liquidity provider: what their pools gave and took.">
                  <DataTable<LpFillAgg>
                    rows={a.byLp} rowKey={r => r.ownerPkh} onRowClick={r => nav(adminUrl.lp(r.ownerPkh))}
                    columns={[
                      { key: 'lp', header: 'LP', cell: r => <Hash value={r.ownerPkh} to={adminUrl.lp(r.ownerPkh)} /> },
                      { key: 'fills', header: 'Fills', align: 'right', cell: r => <span className="font-mono text-xs">{r.fills}</span> },
                      { key: 'legs', header: 'Pool legs', align: 'right', cell: r => <span className="font-mono text-xs">{r.legs}</span>, hideBelow: 'sm' },
                      { key: 'pools', header: 'Pools used', align: 'right', cell: r => <span className="font-mono text-xs">{r.pools}</span>, hideBelow: 'md' },
                      { key: 'gave', header: 'Gave', align: 'right', cell: r => <AssetMapList map={r.gave} /> },
                      { key: 'took', header: 'Took', align: 'right', cell: r => <AssetMapList map={r.received} />, hideBelow: 'md' },
                      { key: 'last', header: 'Last', cell: r => <TimeAgo at={r.lastFillAt} />, hideBelow: 'lg' },
                    ]}
                    empty={<div className="py-6 text-center text-xs text-zinc-500">No Mesh pool has filled an intent yet.</div>}
                  />
                </Section>
                <Section title="Surplus by asset" className="xl:col-span-2">
                  <dl className="space-y-3 text-xs">
                    {([['Total', a.surplus.total], ['Maker bonus', a.surplus.userBonus], ['Protocol', a.surplus.protocolPaid], ['Frontends', a.surplus.frontendPaid], ['Kept by solver', a.surplus.solverProfit]] as const).map(([k, m]) => (
                      <div key={k} className="flex items-start justify-between gap-3"><dt className="text-zinc-500">{k}</dt><dd><AssetMapList map={m} /></dd></div>
                    ))}
                  </dl>
                </Section>
              </div>

              <Section title="Fill log" description={`${d.total} fills`}
                actions={<SearchBox value={f.q} onChange={v => set({ q: v })} placeholder="Intent id, maker, txid" className="w-56" />}>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-3">
                    <Segmented label="Route" value={f.method} onChange={v => set({ method: v })} options={[{ value: '', label: 'Any route' }, ...Object.entries(METHOD_META).map(([k, m]) => ({ value: k, label: m.label }))]} />
                    <Segmented label="Source" value={f.venue} onChange={v => set({ venue: v })} options={[{ value: '', label: 'Any source' }, { value: 'mesh', label: 'Mesh' }, { value: 'cauldron', label: 'Cauldron' }, { value: 'solver', label: 'Solver' }]} />
                    <Segmented label="Kind" value={f.kind} onChange={v => set({ kind: v })} options={[{ value: '', label: 'All kinds' }, { value: 'limit', label: 'Limit' }, { value: 'dutch', label: 'Dutch' }, { value: 'twap', label: 'TWAP' }]} />
                  </div>
                  {(f.lp || f.pool) && (
                    <div className="flex gap-3 text-xs">
                      {f.lp && <button type="button" onClick={() => set({ lp: '' })} className="text-emerald-300 hover:underline">LP {f.lp.slice(0, 12)}… ✕</button>}
                      {f.pool && <button type="button" onClick={() => set({ pool: '' })} className="text-emerald-300 hover:underline">Pool {f.pool.slice(0, 18)}… ✕</button>}
                    </div>
                  )}
                  <DataTable<FillRow>
                    rows={d.fills} rowKey={r => r.intentId} onRowClick={r => nav(adminUrl.intent(r.intentId))}
                    columns={[
                      { key: 'when', header: 'Filled', cell: r => <TimeAgo at={r.filledAt} /> },
                      { key: 'intent', header: 'Intent', cell: r => <Hash value={r.intentId} to={adminUrl.intent(r.intentId)} head={10} tail={4} /> },
                      { key: 'kind', header: 'Kind', cell: r => <KindBadge kind={r.kind} />, hideBelow: 'md' },
                      { key: 'pair', header: 'Pair', cell: r => <AssetPair sell={r.sellToken} buy={r.buyToken} size={16} /> },
                      { key: 'route', header: 'Route', cell: r => <MethodBadge method={r.fill.method} /> },
                      { key: 'legs', header: 'Sources', cell: r => <span className="flex flex-wrap gap-1">{[...new Set(r.fill.legs.map(l => l.venue))].map(v => <VenueBadge key={v} venue={v} />)}</span>, hideBelow: 'lg' },
                      { key: 'sold', header: 'Sold', align: 'right', cell: r => <Amount asset={r.sellToken} value={r.sellAmount} muted />, hideBelow: 'md' },
                      { key: 'got', header: 'Maker got', align: 'right', cell: r => r.fill.makerPaid ? <Amount asset={r.buyToken} value={r.fill.makerPaid} /> : <span className="text-zinc-600 text-xs">n/a</span> },
                      { key: 'surplus', header: 'Surplus', align: 'right', cell: r => r.fill.totalSurplus ? <Amount asset={r.buyToken} value={r.fill.totalSurplus} muted /> : <span className="text-zinc-600 text-xs">—</span>, hideBelow: 'xl' },
                      { key: 'lat', header: 'Latency', align: 'right', cell: r => <span className="font-mono text-xs text-zinc-400">{duration(r.fill.latencySec)}</span>, hideBelow: 'lg' },
                    ]}
                  />
                  <Pager offset={Number(f.offset)} limit={LIMIT} total={d.total} onChange={o => set({ offset: String(o) })} />
                </div>
              </Section>
            </>
          );
        }}
      </QueryState>
    </>
  );
}
