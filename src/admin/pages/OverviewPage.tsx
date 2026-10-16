import { Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, AlertTriangle, XCircle, Info, ArrowRight, Zap, Waves, Layers, Users, Timer, Undo2, Wallet, Route, Activity, ArrowDownUp,
} from 'lucide-react';
import { useOverview, useFills, useEvents } from '../hooks';
import {
  PageHeader, Section, KpiTile, QueryState, Pill, SplitBar, METHOD_META, duration, DataTable, MethodBadge, KindBadge, TimeAgo,
  adminUrl, Hash, type Tone,
} from '../kit';
import { AssetMapList, AssetPair, Amount } from '../assets';
import { DailyFlowChart, HourlyEventsChart, HourlyIntentChart } from '../charts';
import { EventFeed } from '../EventFeed';
import type { Alert, FillRow, Overview } from '../api';
import { formatNumber, formatSatsCompact, formatUsd, satsToUsd } from '@/lib/mesh/format';
import { cn } from '@/lib/utils';

const ALERT_STYLE: Record<Alert['severity'], { icon: typeof Info; cls: string }> = {
  error: { icon: XCircle, cls: 'border-rose-500/30 bg-rose-500/[0.06] text-rose-200' },
  warn: { icon: AlertTriangle, cls: 'border-amber-500/30 bg-amber-500/[0.06] text-amber-200' },
  info: { icon: Info, cls: 'border-sky-500/25 bg-sky-500/[0.05] text-sky-200' },
};

function Alerts({ alerts }: { alerts: Alert[] }) {
  if (!alerts.length) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] px-4 py-3 text-sm text-emerald-200">
        <span className="w-2 h-2 rounded-full bg-emerald-400" aria-hidden /> All systems normal: no alerts.
      </div>
    );
  }
  const order = { error: 0, warn: 1, info: 2 };
  return (
    <div className="grid gap-2 md:grid-cols-2" role="list" aria-label="Alerts">
      {[...alerts].sort((a, b) => order[a.severity] - order[b.severity]).map(a => {
        const s = ALERT_STYLE[a.severity];
        const Icon = s.icon;
        const body = (
          <>
            <Icon className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{a.title}</div>
              <div className="text-xs opacity-75 break-words">{a.detail}</div>
            </div>
            {a.link && <ArrowRight className="w-4 h-4 opacity-60 shrink-0 mt-0.5" aria-hidden />}
          </>
        );
        return a.link
          ? <Link key={a.code} to={a.link} role="listitem" className={cn('flex items-start gap-3 rounded-xl border px-4 py-3 hover:brightness-125 transition', s.cls)}>{body}</Link>
          : <div key={a.code} role="listitem" className={cn('flex items-start gap-3 rounded-xl border px-4 py-3', s.cls)}>{body}</div>;
      })}
    </div>
  );
}

/** Intent lifecycle at a glance: where every intent is right now. */
function Pipeline({ o }: { o: Overview }) {
  const s = o.intents.byStatus;
  const stages: Array<{ label: string; n: number; tone: Tone; to: string }> = [
    { label: 'Awaiting funding', n: s.awaiting_funding ?? 0, tone: 'zinc', to: '/admin/intents?status=awaiting_funding' },
    { label: 'Scheduled', n: s.scheduled ?? 0, tone: 'sky', to: '/admin/intents?status=scheduled' },
    { label: 'Active', n: s.active ?? 0, tone: 'sky', to: '/admin/intents?status=active' },
    { label: 'Expired · refund due', n: (s.expired ?? 0) + (s.refund_pending ?? 0) + (s.underfunded ?? 0), tone: 'amber', to: '/admin/intents?status=expired,refund_pending,underfunded' },
    { label: 'Filled', n: s.filled ?? 0, tone: 'emerald', to: '/admin/intents?status=filled' },
    { label: 'Refunded', n: s.refunded ?? 0, tone: 'violet', to: '/admin/intents?status=refunded' },
    { label: 'Other closed', n: (s.cancelled ?? 0) + (s.closed_external ?? 0) + (s.expired_unfunded ?? 0), tone: 'zinc', to: '/admin/intents?status=cancelled,closed_external,expired_unfunded' },
  ];
  const max = Math.max(1, ...stages.map(x => x.n));
  const bar: Record<Tone, string> = { zinc: 'bg-zinc-500/60', sky: 'bg-sky-400/70', amber: 'bg-amber-400/70', emerald: 'bg-emerald-400/70', violet: 'bg-violet-400/70', rose: 'bg-rose-400/70', cyan: 'bg-cyan-400/70' };
  return (
    <ul className="space-y-1.5">
      {stages.map(st => (
        <li key={st.label}>
          <Link to={st.to} className="grid grid-cols-[140px_1fr_48px] items-center gap-3 rounded-md px-1 py-1 hover:bg-white/[0.03]">
            <span className="text-xs text-zinc-400 truncate">{st.label}</span>
            <span className="h-2 rounded-full bg-white/[0.04] overflow-hidden"><span className={cn('block h-full rounded-full', bar[st.tone])} style={{ width: `${(st.n / max) * 100}%` }} /></span>
            <span className="text-right text-xs font-mono tabular-nums text-zinc-200">{st.n}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function RecentFills() {
  const q = useFills({ limit: 8 });
  const nav = useNavigate();
  return (
    <QueryState q={q} rows={4}>
      {d => (
        <DataTable<FillRow>
          rows={d.fills} rowKey={r => r.intentId} onRowClick={r => nav(adminUrl.intent(r.intentId))}
          columns={[
            { key: 'when', header: 'Filled', cell: r => <TimeAgo at={r.filledAt} /> },
            { key: 'pair', header: 'Pair', cell: r => <AssetPair sell={r.sellToken} buy={r.buyToken} size={16} /> },
            { key: 'kind', header: 'Kind', cell: r => <KindBadge kind={r.kind} />, hideBelow: 'md' },
            { key: 'route', header: 'Route', cell: r => <MethodBadge method={r.fill.method} /> },
            { key: 'paid', header: 'Maker got', align: 'right', cell: r => r.fill.makerPaid ? <Amount asset={r.buyToken} value={r.fill.makerPaid} /> : <span className="text-zinc-600 text-xs">—</span>, hideBelow: 'sm' },
            { key: 'lat', header: 'Latency', align: 'right', cell: r => <span className="text-xs font-mono text-zinc-400">{duration(r.fill.latencySec)}</span>, hideBelow: 'lg' },
          ]}
          empty={<div className="text-xs text-zinc-500 py-6 text-center">No fills yet.</div>}
        />
      )}
    </QueryState>
  );
}

function RecentEvents() {
  const q = useEvents({ limit: 10 });
  return <QueryState q={q} rows={5}>{d => <EventFeed events={d.events} compact />}</QueryState>;
}

export function OverviewPage() {
  const q = useOverview();
  return (
    <>
      <PageHeader title="Overview" icon={<LayoutDashboard className="w-5 h-5 text-emerald-300" />}
        description="Live state of intents, fills, liquidity and operations. Every number comes from the server's persisted records." />
      <QueryState q={q} rows={8}>
        {o => {
          const usd = (sats: string) => formatUsd(satsToUsd(sats, o.pools.bchUsd));
          const venues = o.fills.byVenue;
          return (
            <>
              <Alerts alerts={o.alerts} />

              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
                <KpiTile label="Open intents" value={o.intents.open} sub={`${o.intents.fillableNow} fillable now`} icon={<ArrowDownUp className="w-4 h-4" />} to="/admin/intents?status=open" />
                <KpiTile label="Fills 24h" value={o.fills.h24.count} sub={`${formatSatsCompact(o.fills.h24.bchVolumeSats)} BCH side`} icon={<Zap className="w-4 h-4" />} tone="emerald" to="/admin/fills" />
                <KpiTile label="Fill latency" value={duration(o.fills.latency.medianSec)} sub={`median · p90 ${duration(o.fills.latency.p90Sec)}`} icon={<Timer className="w-4 h-4" />} />
                <KpiTile label="Problems" value={o.intents.problems.failing + o.intents.problems.refund_failed}
                  sub={`${o.intents.problems.unfillable} no route · ${o.intents.refundableNow} refundable`} icon={<AlertTriangle className="w-4 h-4" />}
                  tone={o.intents.problems.failing + o.intents.problems.refund_failed ? 'rose' : undefined} to="/admin/intents?problem=failing" />
                <KpiTile label="Mesh TVL" value={formatSatsCompact(o.pools.tvlSats)} sub={usd(o.pools.tvlSats)} icon={<Waves className="w-4 h-4" />} tone="emerald" to="/admin/pools" />
                <KpiTile label="Pools" value={`${o.pools.active}/${o.pools.totalPools}`} sub={`${o.pools.mirror} recycling · ${o.pools.exhausted} need withdraw`} icon={<Waves className="w-4 h-4" />} to="/admin/pools" />
                <KpiTile label="Strategies" value={`${o.strategies.active}/${o.strategies.total}`} sub={`${o.strategies.recycled} recycled · ${o.strategies.rebalanced} rebalanced`} icon={<Layers className="w-4 h-4" />} to="/admin/strategies" />
                <KpiTile label="LPs" value={o.pools.lpCount} sub={`vol 24h ${formatSatsCompact(o.pools.volume24hSats)}`} icon={<Users className="w-4 h-4" />} to="/admin/lps" />
              </div>

              {(o.liquidity || o.market) && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KpiTile label="Through the market" value={o.liquidity?.throughMarketPools ?? '—'} tone={o.liquidity?.throughMarketPools ? 'rose' : 'emerald'}
                    sub={o.liquidity ? `${formatSatsCompact(o.liquidity.throughMarketValueSats)} arbitrage can take` : 'first report pending'} icon={<AlertTriangle className="w-4 h-4" />} to="/admin/liquidity" />
                  <KpiTile label="UTXOs per pool" value={o.liquidity ? o.liquidity.utxosPerPool.toFixed(2) : '—'} tone={(o.liquidity?.utxosPerPool ?? 1) > 1.5 ? 'amber' : undefined}
                    sub={o.liquidity ? `${o.liquidity.extraUtxos} extra · ${formatNumber(o.liquidity.extraBytes / 1000, 1)} KB to sweep` : undefined} icon={<Waves className="w-4 h-4" />} to="/admin/liquidity" />
                  <KpiTile label="Too small to route" value={o.liquidity ? formatSatsCompact(o.liquidity.dustValueSats) : '—'} sub={o.liquidity ? `${o.liquidity.dustUtxos} pool UTXO(s)` : undefined} to="/admin/liquidity?view=dust" />
                  <KpiTile label="Market guard" value={o.market ? (o.market.refused ? `${o.market.refused} refusing` : 'ok') : '—'} tone={o.market?.refused ? 'rose' : o.market?.sampler.stalled ? 'amber' : 'emerald'}
                    sub={o.market ? `${o.market.tokens} tokens · sampler ${o.market.sampler.stalled ? 'stalled' : o.market.sampler.running ? 'running' : 'off'}` : undefined} icon={<Activity className="w-4 h-4" />} to="/admin/market" />
                </div>
              )}

              <div className="grid gap-5 xl:grid-cols-3">
                <Section title="Fill flow, 14 days" icon={<Activity className="w-4 h-4 text-emerald-300" />} description="Fills per day by route, with intents created and refunded." className="xl:col-span-2">
                  <DailyFlowChart daily={o.series.daily} />
                </Section>
                <Section title="Intent pipeline" icon={<ArrowDownUp className="w-4 h-4 text-cyan-300" />} description="Every intent by current status. Click a stage to open it."
                  actions={<Link to="/admin/intents" className="text-xs text-zinc-400 hover:text-white">All intents →</Link>}>
                  <Pipeline o={o} />
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {Object.entries(o.intents.byKind).map(([k, n]) => <Pill key={k} tone={k === 'twap' ? 'violet' : k === 'dutch' ? 'sky' : 'cyan'}>{k} {n}</Pill>)}
                  </div>
                </Section>
              </div>

              <div className="grid gap-5 lg:grid-cols-3">
                <Section title="Who filled" icon={<Zap className="w-4 h-4 text-emerald-300" />} description="All-time fills by route and by liquidity source.">
                  <div className="space-y-5">
                    <SplitBar parts={(Object.keys(METHOD_META) as Array<keyof typeof METHOD_META>).map(m => ({ label: METHOD_META[m].label, value: o.fills.all.byMethod[m] ?? 0, color: METHOD_META[m].color }))} />
                    <SplitBar parts={[
                      { label: 'Mesh pool legs', value: venues.mesh?.legs ?? 0, color: '#34d399' },
                      { label: 'Cauldron legs', value: venues.cauldron?.legs ?? 0, color: '#38bdf8' },
                      { label: 'Solver legs', value: venues.solver?.legs ?? 0, color: '#fbbf24' },
                    ]} />
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div><div className="text-[10px] text-zinc-500 uppercase">24h</div><div className="font-mono text-sm text-white">{o.fills.h24.count}</div></div>
                      <div><div className="text-[10px] text-zinc-500 uppercase">7d</div><div className="font-mono text-sm text-white">{o.fills.d7.count}</div></div>
                      <div><div className="text-[10px] text-zinc-500 uppercase">All</div><div className="font-mono text-sm text-white">{o.fills.all.count}</div></div>
                    </div>
                  </div>
                </Section>
                <Section title="Surplus split" icon={<Layers className="w-4 h-4 text-violet-300" />} description="Positive slippage captured on fills, by buy asset.">
                  <dl className="space-y-3 text-xs">
                    {([['Total surplus', o.fills.surplus.total], ['To makers (bonus)', o.fills.surplus.userBonus], ['Protocol treasury', o.fills.surplus.protocolPaid], ['Frontends', o.fills.surplus.frontendPaid], ['Kept by solver', o.fills.surplus.solverProfit]] as const).map(([k, m]) => (
                      <div key={k} className="flex items-start justify-between gap-3"><dt className="text-zinc-500">{k}</dt><dd className="text-right"><AssetMapList map={m} /></dd></div>
                    ))}
                    <div className="flex items-start justify-between gap-3 pt-2 border-t border-white/[0.05]"><dt className="text-zinc-500">Network fees paid</dt><dd><Amount asset="0x" value={o.fills.networkFeeSats} /></dd></div>
                  </dl>
                </Section>
                <Section title="Solver & routes" icon={<Route className="w-4 h-4 text-amber-300" />}
                  actions={<Link to="/admin/operations" className="text-xs text-zinc-400 hover:text-white">Operate →</Link>}>
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-1.5">
                      <Pill tone={o.routes.meshEnabled ? 'emerald' : 'amber'} dot>Mesh {o.routes.meshEnabled ? 'on' : 'paused'}</Pill>
                      <Pill tone={o.routes.cauldronEnabled ? 'emerald' : 'amber'} dot>Cauldron {o.routes.cauldronEnabled ? 'on' : 'paused'}</Pill>
                      <Pill tone={o.routes.solverEnabled ? 'emerald' : 'amber'} dot>Solver {o.routes.solverEnabled ? 'on' : 'paused'}</Pill>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs text-zinc-400"><Wallet className="w-3.5 h-3.5" />Solver wallet</span>
                        <Pill tone={o.solver.ready ? 'emerald' : 'rose'} dot>{o.solver.ready ? 'Ready' : 'Not ready'}</Pill>
                      </div>
                      <Hash value={o.solver.address} />
                      <div className="text-lg font-mono text-white">{o.solver.balanceSats !== null ? <Amount asset="0x" value={o.solver.balanceSats} /> : <span className="text-xs text-zinc-500">{o.solver.error ?? '—'}</span>}</div>
                      <AssetMapList map={o.solver.tokens} empty="No token inventory" />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <Link to="/admin/refunds" className="rounded-lg border border-white/[0.06] p-2 hover:bg-white/[0.03]">
                        <div className="text-zinc-500 flex items-center gap-1"><Undo2 className="w-3 h-3" />Refunded</div>
                        <div className="font-mono text-white">{o.refunds.refundedTotal}</div>
                      </Link>
                      <Link to="/admin/twap" className="rounded-lg border border-white/[0.06] p-2 hover:bg-white/[0.03]">
                        <div className="text-zinc-500">TWAP orders</div>
                        <div className="font-mono text-white">{o.twap.total} <span className="text-zinc-500 text-[10px]">{o.twap.byStatus.RUNNING ?? 0} running</span></div>
                      </Link>
                    </div>
                  </div>
                </Section>
              </div>

              <div className="grid gap-5 xl:grid-cols-2">
                <Section title="Intents per hour" description="Created, filled and refunded, last 24 hours."><HourlyIntentChart hourly={o.series.hourly} /></Section>
                <Section title="Events per hour" description={`${o.events.h24.total} events in 24 h · ${o.events.h24.bySeverity.error ?? 0} errors · ${o.events.h24.bySeverity.warn ?? 0} warnings`}
                  actions={<Link to="/admin/events" className="text-xs text-zinc-400 hover:text-white">Event log →</Link>}>
                  <HourlyEventsChart hourly={o.events.hourly} />
                </Section>
              </div>

              <div className="grid gap-5 xl:grid-cols-5">
                <Section title="Latest fills" className="xl:col-span-3" actions={<Link to="/admin/fills" className="text-xs text-zinc-400 hover:text-white">All fills →</Link>}><RecentFills /></Section>
                <Section title="Latest events" className="xl:col-span-2" actions={<Link to="/admin/events" className="text-xs text-zinc-400 hover:text-white">All →</Link>}><RecentEvents /></Section>
              </div>
            </>
          );
        }}
      </QueryState>
    </>
  );
}
