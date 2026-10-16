import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SlidersHorizontal, Waves, Boxes, Zap, Play, Wallet, Undo2, Server, ShieldCheck, Database, Cpu, Merge, HeartPulse } from 'lucide-react';
import { useAdmin } from '../AdminContext';
import { useAdminAction, useOverview, useRefunds, useSystem, useEvents } from '../hooks';
import {
  PageHeader, Section, QueryState, KpiTile, KeyValue, Pill, ConfirmAction, DataTable, Hash, adminUrl, TimeAgo, AddressLink,
  IntentStatusBadge, KindBadge, duration,
} from '../kit';
import { Amount, AssetMapList, AssetPair } from '../assets';
import { EventFeed } from '../EventFeed';
import { sellAsset, buyAsset, type IntentView, type RouteFlags, type SolverCycleReport } from '../api';
import { cn } from '@/lib/utils';

type RouteKey = 'meshEnabled' | 'cauldronEnabled' | 'solverEnabled';
const ROUTES: Array<{ key: RouteKey; label: string; icon: typeof Waves; detail: string }> = [
  { key: 'meshEnabled', label: 'Mesh pools', icon: Waves, detail: 'LP pools (MeshPoolV3). Pausing stops intents filling against Mesh liquidity.' },
  { key: 'cauldronEnabled', label: 'Cauldron AMM', icon: Boxes, detail: 'Cauldron pools as a source, alone or in split fills.' },
  { key: 'solverEnabled', label: 'Solver inventory', icon: Zap, detail: 'Fills from the solver wallet\'s own BCH / tokens.' },
];

function RouteCard({ r, flags }: { r: (typeof ROUTES)[number]; flags: RouteFlags }) {
  const { api } = useAdmin();
  const [reason, setReason] = useState('');
  const on = flags[r.key];
  const toggle = useAdminAction((v: { enabled: boolean; reason: string }) => api.setRoutes({ [r.key]: v.enabled, reason: v.reason || undefined }),
    { label: r.label, success: (_x, v) => `${r.label} ${v.enabled ? 'resumed' : 'paused'}` });
  const Icon = r.icon;
  return (
    <div className={cn('rounded-xl border p-4 space-y-3', on ? 'border-emerald-400/20 bg-emerald-500/[0.03]' : 'border-amber-400/30 bg-amber-500/[0.05]')}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-white"><Icon className="w-4 h-4" aria-hidden />{r.label}</span>
        <Pill tone={on ? 'emerald' : 'amber'} dot>{on ? 'Routing' : 'Paused'}</Pill>
      </div>
      <p className="text-xs text-zinc-500 leading-relaxed">{r.detail}</p>
      {on && (
        <>
          <label htmlFor={`reason-${r.key}`} className="sr-only">Reason</label>
          <input id={`reason-${r.key}`} value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (shown in alerts and the event log)"
            className="w-full h-8 px-3 rounded-lg bg-white/[0.03] border border-white/[0.08] text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/50" />
        </>
      )}
      {on
        ? <ConfirmAction label="Pause route" tone="warn" pending={toggle.isPending} title={`Pause ${r.label}?`}
            description="The solver stops using this source for new fills until it is resumed. Intents keep their deadlines and refund normally."
            onConfirm={() => toggle.run({ enabled: false, reason })} />
        : <ConfirmAction label="Resume route" tone="primary" pending={toggle.isPending} title={`Resume ${r.label}?`}
            description="The solver uses this source again from its next cycle." onConfirm={() => toggle.run({ enabled: true, reason: '' })} />}
    </div>
  );
}

function CycleResult({ r }: { r: SolverCycleReport }) {
  return (
    <div className="rounded-xl border border-white/[0.07] p-3 space-y-2 text-xs">
      <div className="flex flex-wrap gap-2">
        <Pill tone="sky">{r.planned} planned</Pill><Pill tone="emerald">{r.filled.length} filled</Pill>
        <Pill tone={r.failed.length ? 'rose' : 'zinc'}>{r.failed.length} failed</Pill><Pill tone={r.unfillable.length ? 'amber' : 'zinc'}>{r.unfillable.length} no route</Pill>
      </div>
      {[...r.filled.map(x => ({ id: x.intentId, text: `${x.method} · ${x.txid.slice(0, 12)}…`, tone: 'text-emerald-300' })),
        ...r.failed.map(x => ({ id: x.intentId, text: `${x.method} failed: ${x.error}`, tone: 'text-rose-300' })),
        ...r.unfillable.map(x => ({ id: x.intentId, text: x.reason, tone: 'text-amber-300' }))].map((x, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2"><Hash value={x.id} to={adminUrl.intent(x.id)} copy={false} /><span className={x.tone}>{x.text}</span></div>
        ))}
    </div>
  );
}

export function OperationsPage() {
  const { api } = useAdmin();
  const o = useOverview();
  const sys = useSystem();
  const routeEvents = useEvents({ category: 'route,system', limit: 20 });
  const walletEvents = useEvents({ subject: 'solver-wallet', limit: 5 });
  const consolidate = useAdminAction(() => api.consolidateSolver(), {
    label: 'Consolidation', success: r => (r.result ? `Merged ${r.result.inputs} UTXOs into ${r.result.sats} sats (fee ${r.result.fee})` : r.message),
  });
  const [last, setLast] = useState<SolverCycleReport | null>(null);
  const cycle = useAdminAction(() => api.runSolverCycle(), {
    label: 'Solver cycle', success: r => { setLast(r); return `Cycle: ${r.filled.length} filled, ${r.failed.length} failed, ${r.unfillable.length} no route`; },
  });
  return (
    <>
      <PageHeader title="Routing & solver" icon={<SlidersHorizontal className="w-5 h-5 text-amber-300" />}
        description="Turn liquidity sources on and off, run a solver cycle on demand, and check the solver wallet." />
      <QueryState q={o} rows={6}>
        {d => (
          <>
            <Section title="Liquidity routes" description={d.routes.reason ? `Last reason: ${d.routes.reason} · changed ${new Date(d.routes.lastUpdated).toLocaleString()}` : `Last change ${new Date(d.routes.lastUpdated).toLocaleString()}`}>
              <div className="grid gap-3 md:grid-cols-3">{ROUTES.map(r => <RouteCard key={r.key} r={r} flags={d.routes} />)}</div>
            </Section>
            <div className="grid gap-5 lg:grid-cols-2">
              <Section title="Solver wallet" icon={<Wallet className="w-4 h-4 text-emerald-300" />}>
                <KeyValue rows={[
                  ['Status', <Pill tone={d.solver.ready ? 'emerald' : 'rose'} dot>{d.solver.ready ? 'Ready' : 'Not ready'}</Pill>],
                  ['Address', <AddressLink address={d.solver.address} />],
                  ['BCH', d.solver.balanceSats !== null ? <Amount asset="0x" value={d.solver.balanceSats} /> : <span className="text-rose-300">{d.solver.error}</span>],
                  ['Tokens', <AssetMapList map={d.solver.tokens} empty="None" />],
                  ['UTXOs', <span className="font-mono">{d.solver.utxoCount} ({d.solver.tokenUtxos} token)</span>],
                  ['Fillable now', <span className="font-mono">{d.intents.fillableNow} intents</span>],
                  sys.data?.liquidity ? ['Consolidation', <span className="text-xs text-zinc-400">automatic every 10 min while above {sys.data.liquidity.consolidateAboveUtxos} UTXOs</span>] : null,
                ]} />
                <div className="mt-4 space-y-3">
                  <ConfirmAction label="Consolidate now" icon={<Merge className="w-3.5 h-3.5" />} pending={consolidate.isPending} disabled={!d.solver.ready}
                    title="Merge the solver wallet's small UTXOs?"
                    description="Every fill through a V3 pool leaves a 546-sat pad UTXO in the wallet. This merges up to 100 of the smallest BCH UTXOs into one, in a transaction to itself. Fills running at the same time pass over the UTXOs it holds."
                    onConfirm={() => consolidate.run(undefined)} />
                  <QueryState q={walletEvents} rows={2}>{e => e.events.length ? <EventFeed events={e.events} compact /> : <p className="text-xs text-zinc-600">No consolidations yet.</p>}</QueryState>
                </div>
              </Section>
              <Section title="Run a solver cycle" icon={<Play className="w-4 h-4 text-emerald-300" />} description="Plans and fills every fillable intent now instead of waiting for the next scheduled cycle.">
                <div className="space-y-3">
                  <ConfirmAction label="Run cycle now" tone="primary" icon={<Play className="w-3.5 h-3.5" />} pending={cycle.isPending}
                    title="Run a solver cycle?" description="The solver plans every fillable intent and broadcasts fills with its wallet, exactly like a scheduled cycle."
                    onConfirm={() => cycle.run(undefined)} />
                  {last && <CycleResult r={last} />}
                  {sys.data && (
                    <KeyValue className="pt-2" rows={[
                      ['Schedule', `every ${duration(Math.round(sys.data.solver.scanIntervalMs / 1000))}`],
                      ['Route policy', sys.data.routing.policy],
                      ['Mesh preference', `${sys.data.routing.meshPreferenceBps} bps`],
                      ['Protocol surplus share', `${Number(sys.data.routing.protocolSurplusShareBps) / 100}%`],
                      ['Max fill legs', sys.data.routing.maxFillLegs],
                      ['Max attempts', sys.data.routing.maxFillAttempts],
                    ]} />
                  )}
                </div>
              </Section>
            </div>
            <Section title="Routing & admin events"><QueryState q={routeEvents} rows={4}>{e => <EventFeed events={e.events} />}</QueryState></Section>
          </>
        )}
      </QueryState>
    </>
  );
}

export function RefundsPage() {
  const { api } = useAdmin();
  const nav = useNavigate();
  const q = useRefunds();
  const sweep = useAdminAction(() => api.sweepRefunds(), { label: 'Refund sweep', success: r => r.message });
  const table = (rows: IntentView[], empty: string, when: 'deadline' | 'updated') => (
    <DataTable<IntentView>
      rows={rows} rowKey={i => i.intentId} onRowClick={i => nav(adminUrl.intent(i.intentId))}
      columns={[
        { key: 'id', header: 'Intent', cell: i => <Hash value={i.intentId} to={adminUrl.intent(i.intentId)} head={10} tail={4} /> },
        { key: 'kind', header: 'Kind', cell: i => <KindBadge kind={i.kind} slice={i.twapSliceIndex} />, hideBelow: 'sm' },
        { key: 'pair', header: 'Pair', cell: i => <AssetPair sell={sellAsset(i)} buy={buyAsset(i)} size={14} /> },
        { key: 'amt', header: 'Locked', align: 'right', cell: i => <Amount asset={sellAsset(i)} value={i.fundedAmount ?? i.sellAmount} />, hideBelow: 'md' },
        { key: 'status', header: 'Status', cell: i => <IntentStatusBadge status={i.status} /> },
        { key: 'when', header: when === 'deadline' ? 'Refund from' : 'Refunded', cell: i => when === 'deadline'
          ? <span className="text-xs text-zinc-400 tabular-nums">{new Date(i.refundEligibleAt * 1000).toLocaleString()}</span> : <TimeAgo at={i.updatedAt} /> },
        { key: 'err', header: 'Last error', cell: i => <span className="text-xs text-rose-300/80 truncate max-w-[220px] inline-block">{i.lastRefundError ?? ''}</span>, hideBelow: 'lg' },
      ]}
      empty={<div className="py-6 text-center text-xs text-zinc-500">{empty}</div>}
    />
  );
  return (
    <>
      <PageHeader title="Refunds" icon={<Undo2 className="w-5 h-5 text-amber-300" />}
        description="Funded intents that did not fill are returned to the maker through the covenant's cancel path once chain time passes their deadline."
        actions={<ConfirmAction label="Sweep refunds now" tone="warn" icon={<Undo2 className="w-3.5 h-3.5" />} pending={sweep.isPending}
          title="Run a refund sweep?" description="Refunds every intent past its covenant deadline now, instead of waiting for the next block or timer." onConfirm={() => sweep.run(undefined)} />} />
      <QueryState q={q} rows={8}>
        {d => (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <KpiTile label="Refundable now" value={d.summary.totalRefundableNow} tone={d.summary.totalRefundableNow ? 'amber' : undefined} />
              <KpiTile label="Open intents" value={d.summary.totalOpen} />
              <KpiTile label="No route" value={d.summary.totalUnfillable} />
              <KpiTile label="Refunded total" value={d.summary.totalRefunded} tone="violet" />
              <KpiTile label="Last sweep" value={d.sweeper.lastRunAt ? <TimeAgo at={d.sweeper.lastRunAt} unit="ms" className="text-xl text-white" /> : '—'} sub={d.sweeper.lastTrigger ? `trigger: ${d.sweeper.lastTrigger}` : undefined} />
            </div>
            <Section title="Refundable now" description="Past the covenant deadline and still locked.">{table(d.refundableNow, 'Nothing to refund.', 'deadline')}</Section>
            <Section title="Waiting for their deadline" description="Open intents; they refund automatically if they do not fill.">{table(d.awaitingDeadline, 'No open intents.', 'deadline')}</Section>
            <Section title="Recently refunded">{table(d.recentlyRefunded, 'No refunds yet.', 'updated')}</Section>
            <Section title="Sweeper">
              <KeyValue rows={[
                ['Refunded / failed', <span className="font-mono">{d.sweeper.totalRefunded ?? 0} / {d.sweeper.totalFailed ?? 0}</span>],
                ['Interval', `${Math.round((d.sweeper.refundIntervalMs ?? 0) / 1000)}s, plus every new block`],
                ['By trigger', <span className="flex flex-wrap gap-1">{Object.entries(d.sweeper.byTrigger ?? {}).map(([k, v]) => <Pill key={k}>{k} {String(v)}</Pill>)}</span>],
                ['Chain time', <span className="tabular-nums">{d.sweeper.chainMtp ? new Date(d.sweeper.chainMtp * 1000).toLocaleString() : '—'}</span>],
              ]} />
            </Section>
          </>
        )}
      </QueryState>
    </>
  );
}

const bytes = (n: number | null) => (n === null ? 'missing' : n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${(n / 1e3).toFixed(1)} kB`);

export function SystemPage() {
  const q = useSystem();
  const { serverUrl, keySource } = useAdmin();
  return (
    <>
      <PageHeader title="System" icon={<Server className="w-5 h-5 text-zinc-300" />} description="Server configuration, thresholds, persistence and process health. No secrets are exposed." />
      <QueryState q={q} rows={8}>
        {s => (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
              <KpiTile label="Network" value={s.network} />
              <KpiTile label="Uptime" value={duration(s.uptimeSec)} sub={`since ${new Date(s.startedAt * 1000).toLocaleString()}`} />
              <KpiTile label="Memory" value={`${s.memory.rssMb} MB`} sub={`heap ${s.memory.heapUsedMb}/${s.memory.heapTotalMb} MB`} icon={<Cpu className="w-4 h-4" />} />
              <KpiTile label="Chain lag" value={duration(s.chain.lagSec)} tone={s.chain.lagSec > 3600 ? 'amber' : undefined} sub="covenant time behind wall clock" />
              <KpiTile label="Events stored" value={s.store.events} sub={`seq ${s.store.eventSeq}`} />
              <KpiTile label="WS clients" value={s.store.wsClients} />
            </div>
            <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
              <Section title="Security" icon={<ShieldCheck className="w-4 h-4 text-emerald-300" />}>
                <KeyValue rows={[
                  ['Admin API key', <Pill tone={s.security.adminKeyConfigured ? 'emerald' : 'amber'} dot>{s.security.adminKeyConfigured ? 'Configured' : 'Not set: actions disabled'}</Pill>],
                  ['This browser', keySource === 'none' ? 'no key' : 'key saved locally'],
                  ['Oracle signing', <Pill tone={s.security.oracleSigning ? 'emerald' : 'zinc'} dot>{s.security.oracleSigning ? 'Enabled' : 'No key'}</Pill>],
                  s.security.oraclePubkey ? ['Oracle pubkey', <Hash value={s.security.oraclePubkey} />] : null,
                  ['Treasury PKH', s.security.treasuryPkh ? <Hash value={s.security.treasuryPkh} /> : <span className="text-amber-300">not set (solver keeps protocol share)</span>],
                  ['Server', <span className="font-mono">{serverUrl}</span>],
                ]} />
              </Section>
              <Section title="Routing & solver">
                <KeyValue rows={[
                  ['Policy', s.routing.policy],
                  ['Mesh preference', `${s.routing.meshPreferenceBps} bps`],
                  ['Protocol surplus share', `${Number(s.routing.protocolSurplusShareBps) / 100}%`],
                  ['Protocol take cap', `${s.routing.protocolTakeCapBps} bps`],
                  ['V2 pools', s.routing.v2Pools ? 'routed' : 'retired'],
                  ['Max fill sats', <Amount asset="0x" value={s.solver.maxFillSats} />],
                  ['Min profit', `${s.solver.minProfitSats} sats / ${s.solver.minProfitBps} bps`],
                  ['Max slippage', `${s.solver.maxSlippageBps} bps`],
                  ['Fee rate', `${s.solver.feePerByte} sat/byte`],
                ]} />
              </Section>
              <Section title="Thresholds & store">
                <KeyValue rows={[
                  ['Idle: stale after', duration(s.idle.staleSec)],
                  ['Idle: off mid', `${s.idle.offMidBps / 100}%`],
                  ['Idle: dust', `${s.idle.dustSats} sats`],
                  ['Intents', s.store.intents], ['Pools', s.store.pools], ['Strategies', s.store.strategies],
                  ['Cauldron tokens', s.store.cauldronTokens ?? '—'],
                  ['Node', `${s.node} · pid ${s.pid}`],
                ]} />
              </Section>
              {s.liquidity && (
                <Section title="Liquidity & market guard" icon={<HeartPulse className="w-4 h-4 text-emerald-300" />} description="Routing limits and the guard on the price new positions are centred on.">
                  <KeyValue rows={[
                    ['Pools per fill', `up to ${s.liquidity.maxFillLegs}`],
                    ['Routing minimum', `${s.liquidity.minRouteBinSats} sats per pool UTXO`],
                    ['Bytes per pool input', `~${s.liquidity.bytesPerPoolInput} (with its outputs)`],
                    ['Mid samples', `every ${duration(s.liquidity.midSampleSec)} · ${s.liquidity.sampler.tokens} tokens, ${s.liquidity.sampler.samples} kept`],
                    ['Mid sampler', <Pill tone={s.liquidity.sampler.stalled ? 'amber' : s.liquidity.sampler.running ? 'emerald' : 'zinc'} dot>{s.liquidity.sampler.stalled ? 'Stalled' : s.liquidity.sampler.running ? 'Running' : 'Off'}</Pill>],
                    ['Suggestion guard', `refuses a mid over ${(s.liquidity.midDivergenceBps / 100).toFixed(1)}% from the ${duration(s.liquidity.midGuardWindowSec)} median`],
                    ['Solver consolidation', `above ${s.liquidity.consolidateAboveUtxos} UTXOs`],
                  ]} />
                </Section>
              )}
              {s.scanner && s.solverLoop && (
                <Section title="Loops & chain" description="What must keep running. A stall here raises an alert.">
                  <KeyValue rows={[
                    ['Scanner', <Pill tone={s.scanner.stalled ? 'rose' : 'emerald'} dot>{s.scanner.stalled ? 'Stalled' : s.scanner.sweeping ? 'Sweeping' : 'Running'}</Pill>],
                    ['Last sweep', <span><TimeAgo at={s.scanner.lastSweepAt} /> · took {(s.scanner.lastSweepMs / 1000).toFixed(1)} s</span>],
                    ['Chain reads in it', <span className={cn(s.scanner.errorsInLastSweep > 0 && 'text-amber-300')}>{s.scanner.readsInLastSweep} ({s.scanner.errorsInLastSweep} failed)</span>],
                    ['Solver loop', <Pill tone={s.solverLoop.stalled ? 'rose' : 'emerald'} dot>{s.solverLoop.stalled ? 'Stalled' : s.solverLoop.running ? 'Filling' : 'Running'}</Pill>],
                    ['Last cycle', <TimeAgo at={s.solverLoop.lastCycleAt} />],
                    ['Last fill', <TimeAgo at={s.solverLoop.lastFillAt} />],
                    ['Chain tip read', <TimeAgo at={s.chain.lastReadAt} />],
                    s.electrum?.using ? ['Chain server', <span className="font-mono">{s.electrum.using}{s.electrum.onBackup && <Pill tone="amber" className="ml-2">backup</Pill>}{(s.electrum.servers?.length ?? 1) > 1 && !s.electrum.onBackup && <span className="text-zinc-500 font-sans"> · {s.electrum.servers!.length - 1} in reserve</span>}</span>] : null,
                    s.electrum ? ['Connection reopened', `${s.electrum.reconnects} times (${s.electrum.reconnectsLast10Min} in 10 min)`] : null,
                    s.alerts ? ['Alert webhook', s.alerts.webhookConfigured ? 'configured' : <span className="text-zinc-500">not set: alerts show in this console only</span>] : null,
                    s.orders ? ['Unfunded orders', `${s.orders.unfunded} of ${s.orders.limitTotal} · ${s.orders.archiveWatched} archived and watched`] : null,
                  ]} />
                </Section>
              )}
            </div>
            <Section title="Persistence" icon={<Database className="w-4 h-4 text-zinc-400" />} description="State files in the server's data directory.">
              <DataTable
                rows={s.persistence} rowKey={f => f.name}
                columns={[
                  { key: 'n', header: 'File', cell: f => <span className="font-mono text-xs">{f.name}</span> },
                  { key: 'b', header: 'Size', align: 'right', cell: f => <span className={cn('font-mono text-xs', f.bytes === null && 'text-amber-300')}>{bytes(f.bytes)}</span> },
                  { key: 'm', header: 'Written', cell: f => <TimeAgo at={f.modifiedAt} /> },
                ]} />
            </Section>
          </>
        )}
      </QueryState>
    </>
  );
}
