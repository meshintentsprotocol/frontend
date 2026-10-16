import { useNavigate, useParams, Link } from 'react-router-dom';
import { Layers, UserCircle, Recycle, ExternalLink, GitBranch } from 'lucide-react';
import { useStrategies, useStrategy, useLps, useLp, useIdle } from '../hooks';
import {
  PageHeader, Section, QueryState, Segmented, useUrlState, DataTable, TimeAgo, Hash, adminUrl, Pill, KpiTile, KeyValue,
  AddressLink, KindBadge, MethodBadge, IntentStatusBadge, type Tone,
} from '../kit';
import { Amount, AssetPair, AssetMapList, useAssets } from '../assets';
import { StrategyMetricsPanel } from '@/components/mesh/strategies/StrategyMetricsPanel';
import { EventFeed } from '../EventFeed';
import { DailyPoolChart } from '../charts';
import { PoolStatus, poolAssets } from './PoolPages';
import { sellAsset, buyAsset, type AdminLp, type AdminPool, type FillRow, type IntentView } from '../api';
import type { StrategySummary, IdleItem } from '@/lib/mesh/meshApi';
import { TEMPLATE_META, TemplateIcon, templateName } from '@/components/mesh/ui/defi';
import { formatSatsCompact } from '@/lib/mesh/format';
import { cn } from '@/lib/utils';

// ── Shared tables ────────────────────────────────────────────────────────────

function PoolTable({ pools }: { pools: AdminPool[] }) {
  const nav = useNavigate();
  return (
    <DataTable<AdminPool>
      rows={pools} rowKey={p => p.address} onRowClick={p => nav(adminUrl.pool(p.address))}
      rowClassName={p => (p.status === 'closed' ? 'opacity-60' : undefined)}
      columns={[
        { key: 'addr', header: 'Pool', cell: p => <Hash value={p.address} to={adminUrl.pool(p.address)} /> },
        { key: 'pair', header: 'Sells → buys', cell: p => { const a = poolAssets(p); return <AssetPair sell={a.gives} buy={a.takes} size={14} />; } },
        { key: 'role', header: 'Role', cell: p => <span className="text-xs text-zinc-400">{p.v3?.modeName === 'mirror' ? 'recycling' : p.pairRole?.toLowerCase() ?? '—'}</span>, hideBelow: 'md' },
        { key: 'value', header: 'Value', align: 'right', cell: p => <span className="font-mono text-xs">{formatSatsCompact(p.valueSats)}</span> },
        { key: 'fills', header: 'Fills', align: 'right', cell: p => <span className="font-mono text-xs">{p.stats.fillCount}</span>, hideBelow: 'sm' },
        { key: 'status', header: 'Status', cell: p => <PoolStatus status={p.status} /> },
      ]}
      empty={<div className="py-6 text-center text-xs text-zinc-500">No pools.</div>}
    />
  );
}

function FillTable({ fills }: { fills: FillRow[] }) {
  const nav = useNavigate();
  return (
    <DataTable<FillRow>
      rows={fills} rowKey={r => r.intentId} onRowClick={r => nav(adminUrl.intent(r.intentId))}
      columns={[
        { key: 'when', header: 'Filled', cell: r => <TimeAgo at={r.filledAt} /> },
        { key: 'intent', header: 'Intent', cell: r => <Hash value={r.intentId} to={adminUrl.intent(r.intentId)} head={10} tail={4} /> },
        { key: 'kind', header: 'Kind', cell: r => <KindBadge kind={r.kind} />, hideBelow: 'md' },
        { key: 'pair', header: 'Pair', cell: r => <AssetPair sell={r.sellToken} buy={r.buyToken} size={14} /> },
        { key: 'route', header: 'Route', cell: r => <MethodBadge method={r.fill.method} /> },
        { key: 'got', header: 'Maker got', align: 'right', cell: r => r.fill.makerPaid ? <Amount asset={r.buyToken} value={r.fill.makerPaid} /> : <span className="text-zinc-600 text-xs">n/a</span>, hideBelow: 'sm' },
      ]}
      empty={<div className="py-6 text-center text-xs text-zinc-500">No intent fills used this liquidity yet.</div>}
    />
  );
}

const IDLE_TONE: Record<string, Tone> = { wallet: 'sky', stale: 'amber', 'one-sided': 'violet', dust: 'zinc' };
const IDLE_LABEL: Record<string, string> = { wallet: 'In wallet', stale: 'Stale', 'one-sided': 'One-sided', dust: 'Dust' };

function IdleTable({ items, showOwner }: { items: Array<IdleItem & { ownerPkh?: string }>; showOwner?: boolean }) {
  return (
    <DataTable<IdleItem & { ownerPkh?: string }>
      rows={items} rowKey={i => `${i.ownerPkh ?? ''}:${i.id}`}
      columns={[
        { key: 'kind', header: 'Kind', cell: i => <Pill tone={IDLE_TONE[i.kind] ?? 'zinc'}>{IDLE_LABEL[i.kind] ?? i.kind}</Pill> },
        { key: 'reason', header: 'Why', cell: i => <span className="text-xs text-zinc-300">{i.reason}</span> },
        { key: 'value', header: 'Value', align: 'right', cell: i => <span className="font-mono text-xs">{formatSatsCompact(i.valueSats)}</span> },
        ...(showOwner ? [{ key: 'owner', header: 'LP', cell: (i: IdleItem & { ownerPkh?: string }) => i.ownerPkh ? <Hash value={i.ownerPkh} to={adminUrl.lp(i.ownerPkh)} copy={false} /> : null, hideBelow: 'md' as const }] : []),
        { key: 'strategy', header: 'Strategy', cell: i => i.strategy ? <Hash value={i.strategy} to={adminUrl.strategy(i.strategy)} copy={false} head={10} tail={3} /> : <span className="text-zinc-600 text-xs">—</span>, hideBelow: 'lg' },
        { key: 'pools', header: 'Pools', cell: i => <span className="flex flex-wrap gap-1">{(i.pools ?? []).slice(0, 3).map(a => <Hash key={a} value={a} to={adminUrl.pool(a)} copy={false} head={6} tail={3} />)}{(i.pools?.length ?? 0) > 3 && <span className="text-[10px] text-zinc-500">+{i.pools!.length - 3}</span>}</span>, hideBelow: 'xl' },
      ]}
      empty={<div className="py-6 text-center text-xs text-zinc-500">Nothing idle: all liquidity is priced to fill.</div>}
    />
  );
}

function Lineage({ s }: { s: StrategySummary }) {
  return (
    <span className="flex flex-wrap gap-1">
      {s.replaces && <Pill tone="sky" title={`rebalanced from ${s.replaces}`}>rebalance</Pill>}
      {s.recycledFrom?.length ? <Pill tone="violet" title={s.recycledFrom.join(', ')}>recycled</Pill> : null}
      {s.replacedBy && <Pill tone="zinc" title={`replaced by ${s.replacedBy}`}>replaced</Pill>}
    </span>
  );
}

function StrategyTable({ rows }: { rows: StrategySummary[] }) {
  const nav = useNavigate();
  return (
    <DataTable<StrategySummary>
      rows={rows} rowKey={s => s.id} onRowClick={s => nav(adminUrl.strategy(s.id))}
      rowClassName={s => (s.status === 'closed' ? 'opacity-60' : undefined)}
      columns={[
        { key: 'tpl', header: 'Template', cell: s => <span className="inline-flex items-center gap-2"><TemplateIcon id={s.template} className="w-7 h-7 rounded-lg" /><span className="text-xs font-medium text-zinc-100">{templateName(s.template)}</span></span> },
        { key: 'id', header: 'Strategy', cell: s => <Hash value={s.id} to={adminUrl.strategy(s.id)} head={12} tail={3} />, hideBelow: 'md' },
        { key: 'owner', header: 'LP', cell: s => <Hash value={s.ownerPkh} to={adminUrl.lp(s.ownerPkh)} copy={false} head={6} tail={4} />, hideBelow: 'lg' },
        { key: 'pools', header: 'Pools', align: 'right', cell: s => <span className="font-mono text-xs">{s.activePools}/{s.poolCount}</span> },
        { key: 'value', header: 'Value', align: 'right', cell: s => <span className="font-mono text-xs">{formatSatsCompact(s.valueSats)}</span> },
        { key: 'fees', header: 'Fees', align: 'right', cell: s => <span className="font-mono text-xs text-emerald-300">{formatSatsCompact(s.feesAllSats)}</span>, hideBelow: 'sm' },
        { key: 'fills', header: 'Fills', align: 'right', cell: s => <span className="font-mono text-xs">{s.fillCount}</span>, hideBelow: 'md' },
        { key: 'apr', header: 'APR 7d', align: 'right', cell: s => <span className="font-mono text-xs">{s.feeApr7dPct === null || s.feeApr7dPct === undefined ? '—' : `${s.feeApr7dPct.toFixed(1)}%`}</span>, hideBelow: 'lg' },
        { key: 'hold', header: 'vs holding', align: 'right', cell: s => { const v = s.metrics?.vsHoldPct; return <span className={cn('font-mono text-xs', v === null || v === undefined ? 'text-zinc-600' : v >= 0 ? 'text-emerald-300' : 'text-rose-300')}>{v === null || v === undefined ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(2)}%`}</span>; }, hideBelow: 'lg' },
        { key: 'arb', header: 'Arb share', align: 'right', cell: s => <span className="font-mono text-xs text-zinc-400" title="share of volume from the Mesh Balancer or outside builders">{s.metrics?.arbitrage.arbitrageVolumePct === null || s.metrics?.arbitrage.arbitrageVolumePct === undefined ? '—' : `${s.metrics.arbitrage.arbitrageVolumePct}%`}</span>, hideBelow: 'xl' },
        { key: 'range', header: 'In range', align: 'right', cell: s => <span className="font-mono text-xs text-zinc-400">{s.metrics?.timeInRange?.pct === null || s.metrics?.timeInRange?.pct === undefined ? '—' : `${s.metrics.timeInRange.pct}%`}</span>, hideBelow: 'xl' },
        { key: 'lineage', header: 'Lineage', cell: s => <Lineage s={s} />, hideBelow: 'xl' },
        { key: 'status', header: 'Status', cell: s => <PoolStatus status={s.status} /> },
        { key: 'created', header: 'Created', cell: s => <TimeAgo at={s.createdAt} />, hideBelow: 'xl' },
      ]}
      empty={<div className="py-6 text-center text-xs text-zinc-500">No strategies.</div>}
    />
  );
}

// ── Strategies ───────────────────────────────────────────────────────────────

export function StrategiesPage() {
  const [f, set] = useUrlState({ template: '', status: '', lineage: '', owner: '' });
  const q = useStrategies(f);
  return (
    <>
      <PageHeader title="Strategies" icon={<Layers className="w-5 h-5 text-emerald-300" />}
        description="Every strategy deployed from a template, with its pools, value, fees, and how it was born: deployed, rebalanced or recycled from idle liquidity." />
      <QueryState q={q} rows={8}>
        {d => (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 xl:grid-cols-9 gap-3">
              {Object.keys(TEMPLATE_META).map(t => {
                const x = d.byTemplate[t];
                return (
                  <button key={t} type="button" onClick={() => set({ template: f.template === t ? '' : t })} aria-pressed={f.template === t}
                    className={cn('text-left rounded-xl border p-3 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50',
                      f.template === t ? 'border-emerald-400/40 bg-emerald-500/[0.06]' : 'border-white/[0.07] bg-white/[0.015] hover:border-white/20')}>
                    <div className="flex items-center gap-2"><TemplateIcon id={t} className="w-7 h-7 rounded-lg" /><span className="text-[11px] font-medium text-zinc-300 leading-tight">{templateName(t)}</span></div>
                    <div className="mt-2 font-mono text-lg text-white">{x?.active ?? 0}<span className="text-xs text-zinc-500">/{x?.count ?? 0}</span></div>
                    <div className="text-[10px] text-zinc-500 truncate">{formatSatsCompact(x?.valueSats ?? '0')} · {x?.fills ?? 0} fills</div>
                  </button>
                );
              })}
            </div>
            <Section title="All strategies" description={`${d.total} matching`}>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-3">
                  <Segmented label="Status" value={f.status} onChange={v => set({ status: v })} options={[{ value: '', label: 'Any status' }, { value: 'active', label: 'Active' }, { value: 'exhausted', label: 'Needs withdraw' }, { value: 'closed', label: 'Closed' }]} />
                  <Segmented label="Lineage" value={f.lineage} onChange={v => set({ lineage: v })} options={[{ value: '', label: 'Any origin' }, { value: 'recycled', label: 'Recycled' }, { value: 'rebalanced', label: 'Rebalanced' }, { value: 'replaced', label: 'Replaced' }]} />
                </div>
                {(f.template || f.owner) && (
                  <div className="flex gap-3 text-xs">
                    {f.template && <button type="button" onClick={() => set({ template: '' })} className="text-emerald-300 hover:underline">{templateName(f.template)} ✕</button>}
                    {f.owner && <button type="button" onClick={() => set({ owner: '' })} className="text-emerald-300 hover:underline">LP {f.owner.slice(0, 12)}… ✕</button>}
                  </div>
                )}
                <StrategyTable rows={d.strategies} />
              </div>
            </Section>
          </>
        )}
      </QueryState>
    </>
  );
}

export function StrategyDetailPage() {
  const { id = '' } = useParams();
  const q = useStrategy(id);
  return (
    <QueryState q={q} rows={10}>
      {d => {
        const s = d.strategy;
        const l = d.lineage;
        return (
          <>
            <PageHeader crumbs={[{ label: 'Strategies', to: '/admin/strategies' }, { label: s.id }]}
              title={<span className="flex items-center gap-2.5">{templateName(s.template)}<span className="font-mono text-sm text-zinc-500">{s.id}</span></span>}
              icon={<TemplateIcon id={s.template} />}
              description={<span className="inline-flex flex-wrap items-center gap-2"><PoolStatus status={s.status} /><Lineage s={s} /></span>}
              actions={<Link to={`/mesh/strategy/${encodeURIComponent(s.id)}`} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border border-white/10 text-zinc-200 hover:bg-white/[0.07]">Public page <ExternalLink className="w-3 h-3" /></Link>} />
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
              <KpiTile label="Value" value={formatSatsCompact(s.valueSats)} tone="emerald" />
              <KpiTile label="Pools" value={`${s.activePools}/${s.poolCount}`} sub="active / total" />
              <KpiTile label="Fills" value={s.fillCount} />
              <KpiTile label="Volume 7d" value={formatSatsCompact(s.volume7dSats)} />
              <KpiTile label="Fees" value={formatSatsCompact(s.feesAllSats)} sub={`7d ${formatSatsCompact(s.fees7dSats)}`} />
              <KpiTile label="P&L" value={formatSatsCompact(s.pnlSats)} tone={s.pnlSats.startsWith('-') ? 'rose' : 'emerald'} />
              <KpiTile label="Fee APR 7d" value={s.feeApr7dPct === null || s.feeApr7dPct === undefined ? '—' : `${s.feeApr7dPct.toFixed(1)}%`} sub="after 24 h of history" />
            </div>
            <div className="grid gap-5 xl:grid-cols-3">
              <Section title="Position">
                <KeyValue rows={[
                  ['LP', <Hash value={s.ownerPkh} to={adminUrl.lp(s.ownerPkh)} />],
                  ['Deploy tx', <Hash value={s.txid} />],
                  ['Created', new Date(s.createdAt * 1000).toLocaleString()],
                  ['Last fill', <TimeAgo at={s.lastFillAt} />],
                  s.inventory ? ['Holds', <span className="flex flex-col"><Amount asset="0x" value={s.inventory.sats} /><AssetMapList map={s.inventory.tokens} empty="" /></span>] : null,
                ]} />
                <details className="mt-4">
                  <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300">Template params</summary>
                  <pre className="mt-2 rounded-lg bg-black/40 border border-white/[0.06] p-3 text-[11px] font-mono text-zinc-400 whitespace-pre-wrap break-all">{JSON.stringify(s.params, null, 2)}</pre>
                </details>
              </Section>
              <Section title="Lineage" icon={<GitBranch className="w-4 h-4 text-violet-300" />} description="How this position came to be and where it went.">
                <KeyValue rows={[
                  ['Rebalanced from', l.replaces.length ? <span className="flex flex-col gap-1">{l.replaces.map(r => <Hash key={r} value={r} to={adminUrl.strategy(r)} head={12} tail={3} />)}</span> : '—'],
                  ['Replaced by', l.replacedBy ? <Hash value={l.replacedBy} to={adminUrl.strategy(l.replacedBy)} head={12} tail={3} /> : '—'],
                  ['Recycled from', l.recycledFrom.length ? <span className="flex flex-col gap-1">{l.recycledFrom.map(r => <Hash key={r} value={r} to={r.startsWith('stg-') ? adminUrl.strategy(r) : undefined} head={14} tail={3} />)}</span> : '—'],
                  ['Recycled into', l.recycledInto.length ? <span className="flex flex-col gap-1">{l.recycledInto.map(r => <Hash key={r} value={r} to={adminUrl.strategy(r)} head={12} tail={3} />)}</span> : '—'],
                ]} />
              </Section>
              <Section title="Daily activity, 30 days"><DailyPoolChart daily={d.daily} height={170} /></Section>
            </div>
            {s.metrics && <StrategyMetricsSection s={s} pools={d.pools} />}
            <Section title="Member pools" description="The pools it registered plus the mirror pools they recycle into."><PoolTable pools={d.pools} /></Section>
            <div className="grid gap-5 xl:grid-cols-2">
              <Section title="Intent fills" description="Intents this strategy's pools helped fill."><FillTable fills={d.fills} /></Section>
              <Section title="Events"><EventFeed events={d.events} /></Section>
            </div>
          </>
        );
      }}
    </QueryState>
  );
}

/** The LP's view of the position (server estimates): against holding, arbitrage share, time in range, stress table. */
function StrategyMetricsSection({ s, pools }: { s: StrategySummary; pools: AdminPool[] }) {
  const token = [...new Set(pools.flatMap(p => (p.v3 ? [p.v3.reserve, ...p.v3.slots.map(x => x.cat)] : [])))].find(c => c !== '0x') ?? '';
  const { get } = useAssets([token]);
  const info = token ? get(token) : null;
  return (
    <Section title="LP metrics" description="Estimates: what the LP sees on the position page.">
      <StrategyMetricsPanel m={s.metrics!} symbol={info?.symbol ?? 'tokens'} decimals={info?.decimals ?? 0} feesSats={s.feesAllSats} />
    </Section>
  );
}

// ── LPs ──────────────────────────────────────────────────────────────────────

export function LpsPage() {
  const nav = useNavigate();
  const q = useLps();
  return (
    <>
      <PageHeader title="Liquidity providers" icon={<UserCircle className="w-5 h-5 text-emerald-300" />}
        description="Everyone who owns Mesh pools: TVL, pools and strategies, fees and P&L, and the intent fills their pools supplied." />
      <Section title="LPs" description={q.data ? `${q.data.total} providers` : undefined}>
        <QueryState q={q} rows={8}>
          {d => (
            <DataTable<AdminLp>
              rows={d.lps} rowKey={l => l.ownerPkh} onRowClick={l => nav(adminUrl.lp(l.ownerPkh))}
              columns={[
                { key: 'lp', header: 'LP', cell: l => <span className="flex flex-col"><Hash value={l.ownerPkh} to={adminUrl.lp(l.ownerPkh)} /><span className="text-[10px] text-zinc-600 font-mono truncate max-w-[180px]">{l.ownerAddress}</span></span> },
                { key: 'tvl', header: 'TVL', align: 'right', cell: l => <span className="font-mono text-xs text-emerald-300">{formatSatsCompact(l.tvlSats)}</span> },
                { key: 'pools', header: 'Pools', align: 'right', cell: l => <span className="font-mono text-xs">{l.activePools}/{l.poolCount}</span> },
                { key: 'mirror', header: 'Recycling', align: 'right', cell: l => <span className="font-mono text-xs">{l.mirrorPools}</span>, hideBelow: 'lg' },
                { key: 'stg', header: 'Strategies', align: 'right', cell: l => <span className="font-mono text-xs">{l.strategies}</span>, hideBelow: 'sm' },
                { key: 'vol', header: 'Volume 7d', align: 'right', cell: l => <span className="font-mono text-xs">{formatSatsCompact(l.volume7dSats)}</span>, hideBelow: 'md' },
                { key: 'fees', header: 'Fees', align: 'right', cell: l => <span className="font-mono text-xs">{formatSatsCompact(l.feesAllSats)}</span>, hideBelow: 'md' },
                { key: 'pnl', header: 'P&L', align: 'right', cell: l => <span className={cn('font-mono text-xs', l.pnlSats.startsWith('-') ? 'text-rose-300' : 'text-emerald-300')}>{formatSatsCompact(l.pnlSats)}</span>, hideBelow: 'lg' },
                { key: 'fills', header: 'Intent fills', align: 'right', cell: l => <span className="font-mono text-xs">{l.intentFills?.fills ?? 0}</span>, hideBelow: 'sm' },
                { key: 'last', header: 'Last activity', cell: l => <TimeAgo at={l.lastActivityAt} />, hideBelow: 'xl' },
              ]}
            />
          )}
        </QueryState>
      </Section>
    </>
  );
}

export function LpDetailPage() {
  const { owner = '' } = useParams();
  const nav = useNavigate();
  const q = useLp(owner);
  return (
    <QueryState q={q} rows={10}>
      {d => {
        const lp = d.lp;
        const idleValue = d.idle.reduce((a, i) => a + BigInt(i.valueSats), 0n);
        return (
          <>
            <PageHeader crumbs={[{ label: 'LPs', to: '/admin/lps' }, { label: owner }]}
              title={<span className="font-mono text-base sm:text-lg break-all">{owner}</span>} icon={<UserCircle className="w-5 h-5 text-emerald-300 shrink-0" />}
              description={lp ? <AddressLink address={lp.ownerAddress} /> : 'No pools for this owner'} />
            {lp && (
              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
                <KpiTile label="TVL" value={formatSatsCompact(lp.tvlSats)} tone="emerald" />
                <KpiTile label="Pools" value={`${lp.activePools}/${lp.poolCount}`} />
                <KpiTile label="Strategies" value={d.strategies.length} />
                <KpiTile label="Fills" value={lp.fillCount} sub={`${d.fills.aggregates?.fills ?? 0} intent fills`} />
                <KpiTile label="Fees" value={formatSatsCompact(lp.feesAllSats)} />
                <KpiTile label="P&L" value={formatSatsCompact(lp.pnlSats)} tone={lp.pnlSats.startsWith('-') ? 'rose' : 'emerald'} />
                <KpiTile label="Idle" value={formatSatsCompact(idleValue)} sub={`${d.idle.length} item(s)`} tone={d.idle.length ? 'amber' : undefined} />
              </div>
            )}
            {d.idle.length > 0 && (
              <Section title="Idle liquidity" icon={<Recycle className="w-4 h-4 text-amber-300" />} description="Only the LP can recycle (the server never signs): they see a banner on My pools.">
                <IdleTable items={d.idle} />
              </Section>
            )}
            <div className="grid gap-5 xl:grid-cols-3">
              <Section title="Strategies" className="xl:col-span-2"><StrategyTable rows={d.strategies} /></Section>
              <Section title="Daily activity, 30 days"><DailyPoolChart daily={d.daily} height={170} /></Section>
            </div>
            <Section title="Pools"><PoolTable pools={d.pools} /></Section>
            <div className="grid gap-5 xl:grid-cols-2">
              <Section title="Intent fills supplied" description={d.fills.aggregates ? undefined : 'None yet'}>
                {d.fills.aggregates && (
                  <div className="mb-3 grid grid-cols-2 gap-3 text-xs">
                    <div><div className="text-zinc-500 mb-1">Pools gave</div><AssetMapList map={d.fills.aggregates.gave} /></div>
                    <div><div className="text-zinc-500 mb-1">Pools took</div><AssetMapList map={d.fills.aggregates.received} /></div>
                  </div>
                )}
                <FillTable fills={d.fills.recent} />
              </Section>
              <Section title="Intents placed" description="Intents where this address is the maker.">
                <DataTable<IntentView>
                  rows={d.intents.intents} rowKey={i => i.intentId} onRowClick={i => nav(adminUrl.intent(i.intentId))}
                  columns={[
                    { key: 'c', header: 'Created', cell: i => <TimeAgo at={i.createdAt} /> },
                    { key: 'k', header: 'Kind', cell: i => <KindBadge kind={i.kind} /> },
                    { key: 'p', header: 'Pair', cell: i => <AssetPair sell={sellAsset(i)} buy={buyAsset(i)} size={14} /> },
                    { key: 's', header: 'Status', cell: i => <IntentStatusBadge status={i.status} /> },
                  ]}
                  empty={<div className="py-6 text-center text-xs text-zinc-500">No intents from this address.</div>}
                />
              </Section>
            </div>
            <Section title="Events"><EventFeed events={d.events} /></Section>
          </>
        );
      }}
    </QueryState>
  );
}

// ── Idle ─────────────────────────────────────────────────────────────────────

export function IdlePage() {
  const nav = useNavigate();
  const q = useIdle();
  return (
    <>
      <PageHeader title="Idle & recycle" icon={<Recycle className="w-5 h-5 text-violet-300" />}
        description="Liquidity that is not earning: pools priced far from the market with no recent fill, ranges stuck on one side, and dust. LPs recycle it in one signature from My pools." />
      <QueryState q={q} rows={8}>
        {d => (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <KpiTile label="Idle value" value={formatSatsCompact(d.totalValueSats)} tone={d.items.length ? 'amber' : 'emerald'} sub={`${d.items.length} items · ${d.owners.length} LPs`} />
              {(['stale', 'one-sided', 'dust', 'wallet'] as const).map(k => (
                <KpiTile key={k} label={IDLE_LABEL[k]!} value={d.byKind[k]?.count ?? 0} sub={formatSatsCompact(d.byKind[k]?.valueSats ?? '0')} tone={(d.byKind[k]?.count ?? 0) ? IDLE_TONE[k] : undefined} />
              ))}
            </div>
            <p className="text-[11px] text-zinc-500">
              Rules: stale = no fill for {Math.round(d.thresholds.staleSec / 86400)} days and ≥ {(d.thresholds.offMidBps / 100).toFixed(1)}% off the mid on the side that can't fill;
              dust ≤ {d.thresholds.dustSats} sats. Wallet proceeds need the LP's wallet and are not scanned here. Computed <TimeAgo at={d.computedAt} />.
            </p>
            <div className="grid gap-5 xl:grid-cols-4">
              <Section title="By LP">
                <ul className="space-y-1">
                  {d.owners.map(o => (
                    <li key={o.ownerPkh}>
                      <button type="button" onClick={() => nav(adminUrl.lp(o.ownerPkh))} className="w-full flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-white/[0.03] text-left">
                        <Hash value={o.ownerPkh} copy={false} head={6} tail={4} />
                        <span className="text-xs font-mono text-zinc-300">{formatSatsCompact(o.valueSats)} <span className="text-zinc-600">· {o.count}</span></span>
                      </button>
                    </li>
                  ))}
                  {!d.owners.length && <li className="text-xs text-zinc-500">No LP has idle liquidity.</li>}
                </ul>
              </Section>
              <Section title="Idle items" className="xl:col-span-3"><IdleTable items={d.items} showOwner /></Section>
            </div>
          </>
        )}
      </QueryState>
    </>
  );
}
