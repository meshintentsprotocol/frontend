/**
 * Admin console — the Mesh Balancer bot (meshserver src/balancer).
 *
 * The bot is a separate service that fills Mesh V3 pools against Cauldron, or
 * against each other, when their prices cross. It pushes its state to the Mesh
 * server; these pages read it back and edit the settings the bot pulls with
 * each heartbeat: overview, trades, one trade, opportunities, wallet, settings.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  Scale, ArrowLeftRight, Radar, Wallet, Settings2, Coins, Activity, Timer, Pause, Play, ScanLine, Split, Wifi, WifiOff, ShieldCheck, FlaskConical,
} from 'lucide-react';
import { useAdmin } from '../AdminContext';
import {
  useAdminAction, useBalancer, useBalancerConfig, useBalancerOpportunities, useBalancerTrade, useBalancerTrades, useBalancerWallet, useEvents,
} from '../hooks';
import {
  PageHeader, Section, QueryState, KpiTile, KeyValue, Pill, DataTable, Pager, Segmented, SearchBox, useUrlState, ConfirmAction, ActionButton,
  Hash, TxLink, AddressLink, TimeAgo, adminUrl, SplitBar, EmptyBlock, type Tone,
} from '../kit';
import { Amount, useAssets, symbolOf } from '../assets';
import { EventFeed } from '../EventFeed';
import type {
  BalancerConfig, BalancerConfigPatch, BalancerKind, BalancerOpportunity, BalancerState, BalancerStatus, BalancerTrade, BalancerTradeResult, BalancerTxPart,
} from '../api';
import { formatSatsCompact } from '@/lib/mesh/format';
import { cn } from '@/lib/utils';

// ── Shared ───────────────────────────────────────────────────────────────────

const KIND: Record<BalancerKind, { label: string; tone: Tone; color: string; detail: string }> = {
  'cauldron-buy': { label: 'Cauldron → Mesh', tone: 'sky', color: '#38bdf8', detail: 'Buys the token from Cauldron and sells it to a Mesh pool that pays more.' },
  'cauldron-sell': { label: 'Mesh → Cauldron', tone: 'violet', color: '#a78bfa', detail: 'Takes the token from a Mesh pool and sells it to Cauldron for more.' },
  'mesh-cross': { label: 'Mesh ↔ Mesh', tone: 'emerald', color: '#34d399', detail: 'Takes the token from one Mesh pool and sells it to another that pays more.' },
};
const STATE: Record<BalancerState, { label: string; tone: Tone }> = {
  running: { label: 'Trading', tone: 'emerald' }, 'dry-run': { label: 'Dry run', tone: 'sky' }, paused: { label: 'Paused', tone: 'amber' },
  'idle-no-funds': { label: 'Out of funds', tone: 'amber' }, error: { label: 'Error', tone: 'rose' }, stopped: { label: 'Stopped', tone: 'zinc' },
};
const RESULT: Record<BalancerTradeResult, { label: string; tone: Tone; detail: string }> = {
  confirmed: { label: 'Confirmed', tone: 'emerald', detail: 'In a block' },
  indexed: { label: 'Indexed', tone: 'cyan', detail: 'The server has read it from the chain; it is not in a block yet' },
  mempool: { label: 'Broadcast', tone: 'sky', detail: 'The node accepted the transaction' },
  rejected: { label: 'Rejected', tone: 'rose', detail: 'The node refused the transaction' },
  'dry-run': { label: 'Dry run', tone: 'zinc', detail: 'Built and not sent' },
};
const REASON: Record<string, string> = {
  'below-minimum': 'Below minimum profit', 'dust-rule': 'Too small for the covenant', paused: 'Bot paused', 'dry-run': 'Dry run', 'no-utxo': 'No wallet UTXO',
  'daily-cap': 'Daily cap reached', denied: 'On a deny list', 'mode-off': 'Mode switched off', 'build-failed': 'Pool moved before the build',
};

const KindBadge = ({ kind }: { kind: BalancerKind }) => <Pill tone={KIND[kind]?.tone ?? 'zinc'} title={KIND[kind]?.detail}>{KIND[kind]?.label ?? kind}</Pill>;
const ResultBadge = ({ result }: { result: BalancerTradeResult }) => <Pill tone={RESULT[result]?.tone ?? 'zinc'} title={RESULT[result]?.detail} dot>{RESULT[result]?.label ?? result}</Pill>;

function Sats({ value, signed, className }: { value: string | null | undefined; signed?: boolean; className?: string }) {
  if (value === null || value === undefined) return <span className="text-zinc-600">—</span>;
  const v = BigInt(value);
  return <span className={cn('font-mono text-xs tabular-nums', signed ? (v > 0n ? 'text-emerald-300' : v < 0n ? 'text-rose-300' : 'text-zinc-400') : 'text-zinc-200', className)}>{signed && v > 0n ? '+' : ''}{formatSatsCompact(v)}</span>;
}

/** Online / state pill for the page headers. */
function BotStatePill({ s }: { s: BalancerStatus }) {
  if (!s.heartbeat) return <Pill tone="zinc" dot>Never connected</Pill>;
  if (!s.online) return <Pill tone="rose" dot>Offline</Pill>;
  const st = STATE[s.heartbeat.state] ?? { label: s.heartbeat.state, tone: 'zinc' as Tone };
  return <Pill tone={st.tone} dot>{st.label}</Pill>;
}

function SubNav() {
  // the sidebar carries the routes; on phones a compact row saves a trip to the menu
  const nav = useNavigate();
  const here = typeof window !== 'undefined' ? window.location.pathname : '';
  const tabs: Array<[string, string, typeof Scale]> = [
    ['/admin/balancer', 'Overview', Scale], ['/admin/balancer/trades', 'Trades', ArrowLeftRight], ['/admin/balancer/opportunities', 'Opportunities', Radar],
    ['/admin/balancer/wallet', 'Wallet', Wallet], ['/admin/balancer/settings', 'Settings', Settings2],
  ];
  return (
    <div className="lg:hidden -mx-1 flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Balancer bot">
      {tabs.map(([to, label, Icon]) => {
        const active = to === '/admin/balancer' ? here === to : here.startsWith(to);
        return (
          <button key={to} type="button" role="tab" aria-selected={active} onClick={() => nav(to)}
            className={cn('shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border', active ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-200' : 'border-white/[0.07] text-zinc-400')}>
            <Icon className="w-3.5 h-3.5" aria-hidden />{label}
          </button>
        );
      })}
    </div>
  );
}

function NotConnected({ s }: { s: BalancerStatus }) {
  if (s.heartbeat) return null;
  return (
    <Section title="The bot has not connected to this server yet" icon={<WifiOff className="w-4 h-4 text-zinc-400" />}>
      <ol className="list-decimal pl-5 space-y-1.5 text-xs text-zinc-400 leading-relaxed">
        <li>{s.ingestEnabled ? <>This server accepts the bot: <span className="font-mono text-zinc-300">BALANCER_API_KEY</span> is set.</> : <>Set <span className="font-mono text-zinc-300">BALANCER_API_KEY</span> on this server and restart it. Until then it refuses the bot&apos;s heartbeats.</>}</li>
        <li>Give the bot the same key, this server&apos;s URL in <span className="font-mono text-zinc-300">BALANCER_MESH_API_URL</span>, and its own Electrum server.</li>
        <li>Start it with <span className="font-mono text-zinc-300">npm run balancer</span>. Without <span className="font-mono text-zinc-300">BALANCER_PRIVATE_KEY_WIF</span> it only scans and reports.</li>
      </ol>
    </Section>
  );
}

const axis = { stroke: '#52525b', fontSize: 10, tickLine: false, axisLine: false } as const;
const tooltip = { contentStyle: { background: '#0b0d12', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 11 }, labelStyle: { color: '#a1a1aa' }, cursor: { fill: 'rgba(255,255,255,0.03)' } };
const dayLabel = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

// ── Overview ─────────────────────────────────────────────────────────────────

export function BalancerOverviewPage() {
  const q = useBalancer();
  const nav = useNavigate();
  const { api } = useAdmin();
  const events = useEvents({ category: 'balancer', limit: 12 });
  const pause = useAdminAction((reason: string) => api.pauseBalancer(reason || undefined), { label: 'Pause', success: () => 'Mesh Balancer paused' });
  const resume = useAdminAction(() => api.resumeBalancer(), { label: 'Resume', success: () => 'Mesh Balancer resumed' });
  const scan = useAdminAction(() => api.balancerCommand('scan-now'), { label: 'Scan', success: () => 'Scan requested' });

  return (
    <>
      <PageHeader title="Mesh Balancer" icon={<Scale className="w-5 h-5 text-emerald-300" />}
        description="The bot that fills Mesh pools against Cauldron, or against each other, when their prices cross. One atomic transaction per trade; the spread stays in the bot wallet."
        actions={q.data && (
          <div className="flex flex-wrap items-center gap-2">
            <BotStatePill s={q.data} />
            <ActionButton icon={<ScanLine className="w-3.5 h-3.5" />} onClick={() => scan.run(undefined)} pending={scan.isPending} disabled={!q.data.online}>Scan now</ActionButton>
            {q.data.config.enabled
              ? <ConfirmAction label="Pause bot" tone="warn" icon={<Pause className="w-3.5 h-3.5" />} pending={pause.isPending} title="Pause the Mesh Balancer?"
                  description="The bot stops scanning and trading from its next heartbeat (within about 15 seconds). It keeps reporting, and nothing changes for user orders."
                  onConfirm={() => pause.run('')} />
              : <ConfirmAction label="Resume bot" tone="primary" icon={<Play className="w-3.5 h-3.5" />} pending={resume.isPending} title="Resume the Mesh Balancer?"
                  description={q.data.config.dryRun ? 'It resumes in dry run: it builds trades and reports them, and broadcasts nothing.' : 'It resumes live trading from its next heartbeat.'}
                  onConfirm={() => resume.run(undefined)} />}
          </div>
        )} />
      <SubNav />
      <QueryState q={q} rows={8}>
        {s => {
          const hb = s.heartbeat; const sum = s.summary;
          const tried = sum.h24.trades + sum.h24.rejected;
          const daily = sum.daily.map(d => ({ ...d, profit: Number(d.profitSats), label: dayLabel(d.day) }));
          return (
            <>
              <NotConnected s={s} />
              {s.config.dryRun && hb && (
                <div className="rounded-xl border border-sky-400/25 bg-sky-500/[0.06] px-4 py-3 text-xs text-sky-100 flex items-start gap-2.5">
                  <FlaskConical className="w-4 h-4 shrink-0 mt-0.5 text-sky-300" aria-hidden />
                  <span><b>Dry run.</b> The bot finds crossings and builds the transactions, and broadcasts nothing. Profit figures below count only real trades. Switch it off in Settings to trade.</span>
                </div>
              )}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiTile label="Profit 24h" value={<Sats value={sum.h24.profitSats} signed className="text-xl" />} sub={`7d ${formatSatsCompact(sum.d7.profitSats)} · all ${formatSatsCompact(sum.all.profitSats)}`} icon={<Coins className="w-4 h-4" />} tone="emerald" />
                <KpiTile label="Trades 24h" value={sum.h24.trades} sub={`${sum.h24.rejected} rejected${tried ? ` · ${Math.round((sum.h24.trades / tried) * 100)}% landed` : ''} · ${sum.all.trades} all time`} icon={<ArrowLeftRight className="w-4 h-4" />} to="/admin/balancer/trades" />
                <KpiTile label="Crossings open now" value={s.openCount} sub={`${sum.opportunities.seen24h} seen in 24h · ${sum.opportunities.taken24h} taken`} icon={<Radar className="w-4 h-4" />} to="/admin/balancer/opportunities" />
                <KpiTile label="Wallet" value={hb?.wallet.balanceSats != null ? formatSatsCompact(hb.wallet.balanceSats) : '—'} sub={hb?.wallet.address ? `${hb.wallet.utxoCount} UTXOs` : 'no key: scan only'} icon={<Wallet className="w-4 h-4" />} to="/admin/balancer/wallet" />
              </div>

              <div className="grid gap-5 lg:grid-cols-3">
                <Section title="Daily profit" description="Real trades, last 14 days, sats" className="lg:col-span-2">
                  <div style={{ height: 220 }} role="img" aria-label="Daily profit in sats and trades landed, last 14 days">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={daily} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                        <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis dataKey="label" {...axis} interval="preserveStartEnd" />
                        <YAxis yAxisId="p" {...axis} width={56} tickFormatter={v => formatSatsCompact(Math.round(v)).replace(' sats', '')} />
                        <YAxis yAxisId="n" orientation="right" allowDecimals={false} {...axis} width={24} />
                        <Tooltip {...tooltip} formatter={(v: number, n: string) => [n === 'Profit' ? formatSatsCompact(Math.round(v)) : v, n]} />
                        <Legend wrapperStyle={{ fontSize: 11, color: '#a1a1aa', paddingTop: 6 }} iconSize={8} />
                        <Bar yAxisId="p" dataKey="profit" name="Profit" fill="#34d399" radius={[3, 3, 0, 0]} maxBarSize={22} />
                        <Line yAxisId="n" type="monotone" dataKey="trades" name="Trades" stroke="#e4e4e7" strokeWidth={1.5} dot={false} />
                        <Line yAxisId="n" type="monotone" dataKey="rejected" name="Rejected" stroke="#fb7185" strokeDasharray="4 3" strokeWidth={1.5} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </Section>
                <Section title="By kind" description="All real trades">
                  <SplitBar parts={(Object.keys(KIND) as BalancerKind[]).map(k => ({ label: KIND[k].label, value: sum.byKind[k]?.trades ?? 0, color: KIND[k].color }))} />
                  <dl className="mt-4 space-y-2 text-xs">
                    {(Object.keys(KIND) as BalancerKind[]).map(k => (
                      <div key={k} className="flex items-center justify-between gap-2"><dt><KindBadge kind={k} /></dt><dd className="text-right"><span className="font-mono text-zinc-300">{sum.byKind[k]?.trades ?? 0}</span> · <Sats value={sum.byKind[k]?.profitSats ?? '0'} signed /></dd></div>
                    ))}
                  </dl>
                </Section>
              </div>

              <div className="grid gap-5 lg:grid-cols-3">
                <Section title="Health" icon={<Activity className="w-4 h-4 text-emerald-300" />}>
                  {hb ? (
                    <KeyValue rows={[
                      ['Heartbeat', <span className="inline-flex items-center gap-1.5">{s.online ? <Wifi className="w-3.5 h-3.5 text-emerald-300" /> : <WifiOff className="w-3.5 h-3.5 text-rose-300" />}<TimeAgo at={s.lastHeartbeatAt} unit="ms" /></span>],
                      ['State', <Pill tone={STATE[hb.state]?.tone ?? 'zinc'} dot>{STATE[hb.state]?.label ?? hb.state}</Pill>],
                      hb.error ? ['Error', <span className="text-rose-300 break-words">{hb.error}</span>] : null,
                      ['Electrum', <Pill tone={hb.electrumOk ? 'emerald' : 'rose'} dot>{hb.electrumOk ? 'Connected' : 'Unreachable'}</Pill>],
                      ['Cauldron indexer', <Pill tone={hb.cauldronOk ? 'emerald' : 'amber'} dot>{hb.cauldronOk ? 'Reachable' : 'Failing'}</Pill>],
                      ['Watching', `${hb.poolsWatched} pool UTXOs · ${hb.tokensWatched} tokens`],
                      ['Cycle', `${hb.lastCycleMs} ms · every ${Math.round(s.config.cycleMs / 1000)}s · ${hb.cycles} run`],
                      ['Settings applied', hb.configVersion === s.config.version ? `v${hb.configVersion}` : <span className="text-amber-300">v{hb.configVersion}, v{s.config.version} pending</span>],
                      ['Started', <TimeAgo at={hb.startedAt} unit="ms" />],
                      ['Build', <span className="font-mono">{hb.build} · {hb.network}</span>],
                    ]} />
                  ) : <EmptyBlock title="No heartbeat yet" />}
                </Section>
                <Section title="Effect on Mesh" icon={<Timer className="w-4 h-4 text-sky-300" />}>
                  <KeyValue rows={[
                    ['Volume 24h', <Sats value={sum.h24.volumeSats} />],
                    ['Network fees 24h', <Sats value={sum.h24.feeSats} />],
                    ['Build → broadcast', sum.latencyMs.median !== null ? `${sum.latencyMs.median} ms median · ${sum.latencyMs.max} ms max` : '—'],
                    ['Lost to other bots 24h', <span className={sum.opportunities.lostToExternal24h ? 'text-amber-300' : undefined}>{sum.opportunities.lostToExternal24h}</span>],
                    ['Solver requotes caused', <span title="A user fill that had to requote because the bot spent the pool first" className={sum.requotesCaused ? 'text-amber-300' : undefined}>{sum.requotesCaused}</span>],
                    ['Trades that lost money', <span className={sum.negativeTrades ? 'text-rose-300 font-semibold' : undefined}>{sum.negativeTrades}</span>],
                    ['Dry-run builds', sum.dryRunTrades],
                  ]} />
                </Section>
                <Section title="Top pools by profit">
                  {sum.byPool.length === 0 ? <div className="text-xs text-zinc-600">No trades yet</div> : (
                    <ul className="space-y-2">
                      {sum.byPool.slice(0, 6).map(p => (
                        <li key={p.key} className="flex items-center justify-between gap-2 text-xs">
                          <Hash value={p.key} to={adminUrl.pool(p.key)} head={14} tail={6} copy={false} />
                          <span className="shrink-0"><span className="font-mono text-zinc-400">{p.trades}×</span> <Sats value={p.profitSats} signed /></span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
              </div>

              <Section title="Recent trades" actions={<ActionButton onClick={() => nav('/admin/balancer/trades')}>All trades</ActionButton>}>
                <TradesTable rows={s.recentTrades} />
              </Section>
              <Section title="Bot events" description="Starts, stops, settings changes, trades and rejections">
                <EventFeed events={events.data?.events ?? []} compact empty="No bot events yet" />
              </Section>
            </>
          );
        }}
      </QueryState>
    </>
  );
}

// ── Trades ───────────────────────────────────────────────────────────────────

function TokenAmount({ token, value }: { token: string; value: string }) {
  return <Amount asset={token} value={value} muted />;
}

function TradesTable({ rows }: { rows: BalancerTrade[] }) {
  const nav = useNavigate();
  return (
    <DataTable<BalancerTrade>
      rows={rows} rowKey={r => r.id} onRowClick={r => nav(adminUrl.balancerTrade(r.id))}
      rowClassName={r => (r.result === 'rejected' ? 'bg-rose-500/[0.03]' : undefined)}
      columns={[
        { key: 'when', header: 'When', cell: r => <TimeAgo at={r.at} unit="ms" /> },
        { key: 'kind', header: 'Kind', cell: r => <KindBadge kind={r.kind} /> },
        { key: 'amount', header: 'Token moved', align: 'right', cell: r => <TokenAmount token={r.token} value={r.tokenAmount} />, hideBelow: 'sm' },
        { key: 'pools', header: 'Mesh pools', cell: r => <span className="flex flex-col gap-0.5">{r.pools.map(p => <Hash key={p.outpoint} value={p.address} to={adminUrl.pool(p.address)} head={12} tail={5} copy={false} />)}</span>, hideBelow: 'lg' },
        { key: 'volume', header: 'BCH side', align: 'right', cell: r => <Sats value={r.bchReceived} />, hideBelow: 'md' },
        { key: 'net', header: 'Profit', align: 'right', cell: r => (r.result === 'rejected' ? <span className="text-zinc-600 text-xs">—</span> : <Sats value={r.realisedNetSats} signed />) },
        { key: 'fee', header: 'Fee', align: 'right', cell: r => <Sats value={r.feeSats} className="text-zinc-500" />, hideBelow: 'xl' },
        { key: 'result', header: 'Result', cell: r => <ResultBadge result={r.result} /> },
        { key: 'tx', header: 'Tx', cell: r => <TxLink txid={r.txid || null} />, hideBelow: 'md' },
      ]}
      empty={<EmptyBlock title="No trades yet">Trades appear here as soon as the bot builds one, including dry runs.</EmptyBlock>}
    />
  );
}

const LIMIT = 50;

export function BalancerTradesPage() {
  const [f, set] = useUrlState({ kind: '', result: '', q: '', offset: '0' });
  const q = useBalancerTrades({ ...f, limit: LIMIT, offset: Number(f.offset) });
  const status = useBalancer();
  const sum = status.data?.summary;
  return (
    <>
      <PageHeader title="Balancer trades" icon={<ArrowLeftRight className="w-5 h-5 text-emerald-300" />} crumbs={[{ label: 'Mesh Balancer', to: '/admin/balancer' }, { label: 'Trades' }]}
        description="Every transaction the bot built: what it moved, between which pools, what it cost and what the wallet kept. Rejected broadcasts and dry runs are listed too." />
      <SubNav />
      {sum && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiTile label="Profit, all time" value={<Sats value={sum.all.profitSats} signed className="text-xl" />} sub={`${sum.all.trades} trades`} tone="emerald" />
          <KpiTile label="Volume, all time" value={formatSatsCompact(sum.all.volumeSats)} sub="BCH side of each trade" />
          <KpiTile label="Network fees" value={formatSatsCompact(sum.all.feeSats)} sub="paid by the bot wallet" />
          <KpiTile label="Rejected" value={sum.all.rejected} sub={sum.all.trades + sum.all.rejected ? `${Math.round((sum.all.rejected / (sum.all.trades + sum.all.rejected)) * 100)}% of broadcasts` : 'none yet'} tone={sum.all.rejected ? 'amber' : undefined} />
        </div>
      )}
      <Section title="Trade log" description={q.data ? `${q.data.total} trades` : undefined}
        actions={<SearchBox value={f.q} onChange={v => set({ q: v, offset: '0' })} placeholder="Txid, pool, LP, token" className="w-full sm:w-56" />}>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <Segmented label="Kind" value={f.kind} onChange={v => set({ kind: v, offset: '0' })} options={[{ value: '', label: 'All kinds' }, ...(Object.keys(KIND) as BalancerKind[]).map(k => ({ value: k, label: KIND[k].label }))]} />
            <Segmented label="Result" value={f.result} onChange={v => set({ result: v, offset: '0' })} options={[{ value: '', label: 'Any result' }, ...(Object.keys(RESULT) as BalancerTradeResult[]).map(k => ({ value: k, label: RESULT[k].label }))]} />
          </div>
          <QueryState q={q} rows={8}>
            {d => (
              <>
                <TradesTable rows={d.trades} />
                <Pager offset={Number(f.offset)} limit={LIMIT} total={d.total} onChange={o => set({ offset: String(o) })} />
              </>
            )}
          </QueryState>
        </div>
      </Section>
    </>
  );
}

const PART: Record<BalancerTxPart['role'], { label: string; tone: Tone }> = {
  'mesh-pool': { label: 'Mesh pool', tone: 'emerald' }, 'cauldron-pool': { label: 'Cauldron pool', tone: 'sky' }, wallet: { label: 'Bot wallet', tone: 'amber' },
  proceeds: { label: 'Proceeds', tone: 'violet' }, change: { label: 'Bot change', tone: 'amber' }, pad: { label: 'Dust pad', tone: 'zinc' },
};

function TxParts({ title, parts }: { title: string; parts: BalancerTxPart[] }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">{title}</div>
      {parts.length === 0 ? <div className="text-xs text-zinc-600">Not built</div> : (
        <ul className="space-y-1.5">
          {parts.map(p => (
            <li key={p.index} className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.015] px-2.5 py-2 text-xs min-w-0">
              <span className="w-5 shrink-0 font-mono text-zinc-600">{p.index}</span>
              <Pill tone={PART[p.role]?.tone ?? 'zinc'}>{PART[p.role]?.label ?? p.role}</Pill>
              <span className="min-w-0 flex-1 truncate">{p.address ? <AddressLink address={p.address} to={p.role === 'mesh-pool' ? adminUrl.pool(p.address) : undefined} /> : <span className="text-zinc-600">set by the pool</span>}</span>
              <span className="shrink-0 text-right">
                <Sats value={p.sats} />
                {p.token && <div><Amount asset={p.token.category} value={p.token.amount} muted /></div>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function BalancerTradeDetailPage() {
  const { id = '' } = useParams();
  const q = useBalancerTrade(decodeURIComponent(id));
  const { get } = useAssets(q.data ? [q.data.trade.token] : []);
  return (
    <>
      <PageHeader title="Balancer trade" icon={<ArrowLeftRight className="w-5 h-5 text-emerald-300" />}
        crumbs={[{ label: 'Mesh Balancer', to: '/admin/balancer' }, { label: 'Trades', to: '/admin/balancer/trades' }, { label: decodeURIComponent(id) }]} />
      <QueryState q={q} rows={8}>
        {({ trade: t, events }) => {
          const sym = symbolOf(get, t.token);
          const diff = BigInt(t.realisedNetSats) - BigInt(t.plannedNetSats);
          return (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <KindBadge kind={t.kind} /><ResultBadge result={t.result} />
                <span className="text-xs text-zinc-500"><TimeAgo at={t.at} unit="ms" /></span>
              </div>
              {t.error && <div className="rounded-xl border border-rose-400/25 bg-rose-500/[0.06] px-4 py-3 text-xs text-rose-100 break-words"><b>Rejected by the node:</b> {t.error}</div>}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiTile label={t.result === 'dry-run' ? 'Would have kept' : 'Wallet kept'} value={<Sats value={t.realisedNetSats} signed className="text-xl" />} sub="wallet out − wallet in" tone="emerald" />
                <KpiTile label={`${sym} moved`} value={<Amount asset={t.token} value={t.tokenAmount} />} sub={`received ${formatSatsCompact(t.bchReceived)} · paid ${formatSatsCompact(t.bchPaid)}`} />
                <KpiTile label="Costs" value={formatSatsCompact(BigInt(t.feeSats) + BigInt(t.carrierSats))} sub={`fee ${t.feeSats} · carrier ${t.carrierSats}`} />
                <KpiTile label="Size" value={`${t.sizeBytes} B`} sub={`${t.inputs.length} in · ${t.outputs.length} out · ${t.latencyMs} ms to build`} />
              </div>
              <div className="grid gap-5 lg:grid-cols-3">
                <Section title="Accounting" className="lg:col-span-1">
                  <KeyValue rows={[
                    ['BCH received', <Sats value={t.bchReceived} />],
                    ['BCH paid', <Sats value={t.bchPaid} />],
                    ['Spread', <Sats value={(BigInt(t.bchReceived) - BigInt(t.bchPaid)).toString()} signed />],
                    ['Network fee', <Sats value={t.feeSats} />],
                    ['Token carrier', <Sats value={t.carrierSats} />],
                    ['Estimated profit', <Sats value={t.plannedNetSats} signed />],
                    ['Actual profit', <Sats value={t.realisedNetSats} signed />],
                    ['Estimate error', <span className={cn('font-mono text-xs', diff < 0n ? 'text-amber-300' : 'text-zinc-400')}>{diff >= 0n ? '+' : ''}{diff.toString()} sats</span>],
                    ['Transaction', <TxLink txid={t.txid || null} />],
                    t.indexedAt ? ['Read from the chain', <TimeAgo at={t.indexedAt} unit="ms" />] : null,
                    // trades recorded before the three states have a time and no block height: the server had read them, no more is known
                    t.confirmedAt ? [t.height ? 'In a block' : 'Seen on chain', <span><TimeAgo at={t.confirmedAt} unit="ms" />{t.height ? ` · height ${t.height}` : ''}</span>] : null,
                  ]} />
                </Section>
                <Section title="Mesh pools" className="lg:col-span-2" description="Each pool was filled at its own posted price and fee.">
                  <ul className="space-y-2">
                    {t.pools.map(p => (
                      <li key={p.outpoint} className="rounded-xl border border-white/[0.06] p-3 text-xs space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Hash value={p.address} to={adminUrl.pool(p.address)} head={16} tail={8} />
                          <Pill tone={p.role === 'buys-token' ? 'emerald' : 'cyan'}>{p.role === 'buys-token' ? `Bought ${sym}` : `Sold ${sym}`}</Pill>
                        </div>
                        <div className="flex flex-wrap gap-x-5 gap-y-1 text-zinc-500">
                          <span>Price <span className="font-mono text-zinc-300">{p.satsPerToken.toFixed(4)}</span> sats / unit</span>
                          <span>LP <Hash value={p.ownerPkh} to={adminUrl.lp(p.ownerPkh)} copy={false} /></span>
                          {p.strategy && <span>Strategy <Hash value={p.strategy} to={adminUrl.strategy(p.strategy)} head={12} tail={4} copy={false} /></span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </Section>
              </div>
              <Section title="Transaction layout" description="Each pool is recreated at its own input index; a pool's proceeds sit at its index plus the input count.">
                <div className="grid gap-5 md:grid-cols-2">
                  <TxParts title="Inputs" parts={t.inputs} />
                  <TxParts title="Outputs" parts={t.outputs} />
                </div>
              </Section>
              <Section title="Events"><EventFeed events={events} compact empty="No events for this trade" /></Section>
            </>
          );
        }}
      </QueryState>
    </>
  );
}

// ── Opportunities ────────────────────────────────────────────────────────────

function OpportunityTable({ rows, live }: { rows: BalancerOpportunity[]; live?: boolean }) {
  const nav = useNavigate();
  return (
    <DataTable<BalancerOpportunity>
      rows={rows} rowKey={r => r.id} onRowClick={r => (r.tradeId ? nav(adminUrl.balancerTrade(r.tradeId)) : nav(adminUrl.pool(r.pools[0]?.address ?? '')))}
      columns={[
        ...(live ? [] : [{ key: 'when', header: 'Seen', cell: (r: BalancerOpportunity) => <TimeAgo at={r.at} unit="ms" /> }]),
        { key: 'kind', header: 'Kind', cell: r => <KindBadge kind={r.kind} /> },
        { key: 'pools', header: 'Mesh pools', cell: r => <span className="flex flex-col gap-0.5">{r.pools.map(p => <Hash key={p.outpoint} value={p.address} to={adminUrl.pool(p.address)} head={12} tail={5} copy={false} />)}</span>, hideBelow: 'md' },
        { key: 'prices', header: 'Pool vs other side', align: 'right', hideBelow: 'lg', cell: r => <span className="font-mono text-xs text-zinc-400">{r.pools[0]?.satsPerToken.toFixed(2)} <span className="text-zinc-600">vs</span> {r.counterSatsPerToken.toFixed(2)}</span> },
        { key: 'size', header: 'Size', align: 'right', cell: r => <Amount asset={r.token} value={r.tokenAmount} muted />, hideBelow: 'sm' },
        { key: 'gross', header: 'Spread', align: 'right', cell: r => <Sats value={r.grossSats} />, hideBelow: 'md' },
        { key: 'net', header: 'Est. profit', align: 'right', cell: r => <Sats value={r.netSats} signed /> },
        { key: 'decision', header: 'Decision', cell: r => (r.decision === 'taken' ? <Pill tone="emerald" dot>Taken</Pill> : <Pill tone="zinc" title={r.detail}>{REASON[r.reason ?? ''] ?? r.reason ?? 'Skipped'}</Pill>) },
      ]}
      empty={<EmptyBlock title={live ? 'No prices cross right now' : 'Nothing recorded yet'}>{live ? 'Every Mesh pool is inside the Cauldron price and no two pools cross.' : 'A crossing is recorded once when it appears, and again if the decision changes.'}</EmptyBlock>}
    />
  );
}

export function BalancerOpportunitiesPage() {
  const [f, set] = useUrlState({ kind: '', decision: '', reason: '', offset: '0' });
  const q = useBalancerOpportunities({ ...f, limit: LIMIT, offset: Number(f.offset) });
  const status = useBalancer();
  const o = status.data?.summary.opportunities;
  const reasons = Object.entries(o?.skipReasons ?? {}).sort((a, b) => b[1] - a[1]);
  const palette = ['#fbbf24', '#38bdf8', '#a78bfa', '#fb7185', '#a1a1aa', '#34d399', '#f59e0b', '#22d3ee', '#c084fc'];
  return (
    <>
      <PageHeader title="Balancer opportunities" icon={<Radar className="w-5 h-5 text-emerald-300" />} crumbs={[{ label: 'Mesh Balancer', to: '/admin/balancer' }, { label: 'Opportunities' }]}
        description="Every place a Mesh pool's price crosses Cauldron or another Mesh pool: what is open now, what the bot took, and why it left the rest." />
      <SubNav />
      {o && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiTile label="Open now" value={status.data!.openCount} sub="in the bot's last scan" icon={<Radar className="w-4 h-4" />} tone="emerald" />
          <KpiTile label="Seen 24h" value={o.seen24h} sub={`${o.taken24h} taken`} />
          <KpiTile label="Skipped 24h" value={o.seen24h - o.taken24h} sub={reasons[0] ? `mostly: ${REASON[reasons[0][0]] ?? reasons[0][0]}` : 'none'} />
          <KpiTile label="Lost to other bots 24h" value={o.lostToExternal24h} sub="someone else filled a flagged pool" tone={o.lostToExternal24h ? 'amber' : undefined} />
        </div>
      )}
      <QueryState q={q} rows={8}>
        {d => (
          <>
            <Section title="Open now" description={`${d.open.length} crossing${d.open.length === 1 ? '' : 's'} in the last scan`}>
              <OpportunityTable rows={d.open} live />
            </Section>
            <div className="grid gap-5 lg:grid-cols-3">
              <Section title="Why crossings were skipped" description="Last 24 hours" className="lg:col-span-1">
                <SplitBar parts={reasons.map(([k, n], i) => ({ label: REASON[k] ?? k, value: n, color: palette[i % palette.length]! }))} />
                <dl className="mt-4 space-y-1.5 text-xs">
                  {reasons.map(([k, n]) => <div key={k} className="flex items-center justify-between gap-2"><dt className="text-zinc-400">{REASON[k] ?? k}</dt><dd className="font-mono text-zinc-300">{n}</dd></div>)}
                </dl>
              </Section>
              <Section title="Filled by someone else" description="A fill by another party on a pool the bot had flagged" className="lg:col-span-2">
                {d.lost.length === 0 ? <div className="text-xs text-zinc-600">None recorded</div> : (
                  <ul className="space-y-1.5">
                    {d.lost.slice(0, 12).map(l => (
                      <li key={l.txid} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <Hash value={l.address} to={adminUrl.pool(l.address)} head={14} tail={6} copy={false} />
                        <span className="flex items-center gap-3"><TxLink txid={l.txid} /><span className="text-zinc-500"><TimeAgo at={l.at} unit="ms" /></span></span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>
            <Section title="History" description={`${d.total} recorded`}>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-3">
                  <Segmented label="Kind" value={f.kind} onChange={v => set({ kind: v, offset: '0' })} options={[{ value: '', label: 'All kinds' }, ...(Object.keys(KIND) as BalancerKind[]).map(k => ({ value: k, label: KIND[k].label }))]} />
                  <Segmented label="Decision" value={f.decision} onChange={v => set({ decision: v, reason: '', offset: '0' })} options={[{ value: '', label: 'Any' }, { value: 'taken', label: 'Taken' }, { value: 'skipped', label: 'Skipped' }]} />
                </div>
                <OpportunityTable rows={d.opportunities} />
                <Pager offset={Number(f.offset)} limit={LIMIT} total={d.total} onChange={x => set({ offset: String(x) })} />
              </div>
            </Section>
          </>
        )}
      </QueryState>
    </>
  );
}

// ── Wallet ───────────────────────────────────────────────────────────────────

export function BalancerWalletPage() {
  const q = useBalancerWallet();
  const { api } = useAdmin();
  const [count, setCount] = useState('10');
  const [sats, setSats] = useState('50000');
  const split = useAdminAction((v: { count: number; sats: number }) => api.balancerCommand('split-utxos', v), { label: 'Split UTXOs', success: () => 'Split requested; the bot runs it with its next heartbeat' });
  const field = 'h-8 w-28 px-3 rounded-lg bg-white/[0.03] border border-white/[0.08] text-xs font-mono text-zinc-100 focus:outline-none focus:border-emerald-400/50';
  return (
    <>
      <PageHeader title="Balancer wallet" icon={<Wallet className="w-5 h-5 text-emerald-300" />} crumbs={[{ label: 'Mesh Balancer', to: '/admin/balancer' }, { label: 'Wallet' }]}
        description="The Mesh Balancer wallet pays only network fees and token carriers: each trade funds itself. Profit collects here and is moved out by hand." />
      <SubNav />
      <QueryState q={q} rows={6}>
        {d => {
          const w = d.wallet;
          const history = d.history.map(h => ({ at: h.at, sats: Number(h.sats), utxos: h.utxos }));
          const low = w?.balanceSats != null && BigInt(w.balanceSats) < BigInt(d.lowBalanceSats);
          const tokens = Object.entries(w?.tokens ?? {});
          return (
            <>
              {!w?.address && <Section title="No wallet key loaded"><p className="text-xs text-zinc-400 leading-relaxed">The bot is running without <span className="font-mono text-zinc-300">BALANCER_PRIVATE_KEY_WIF</span> (or has not connected), so it scans and reports only. Create the Mesh Balancer key on the machine that runs the bot, put it in the bot&apos;s environment only, and fund the address shown here once it appears.</p></Section>}
              {tokens.length > 0 && <div className="rounded-xl border border-amber-400/25 bg-amber-500/[0.06] px-4 py-3 text-xs text-amber-100"><b>Tokens in the wallet.</b> An atomic trade leaves none behind, so these came from a trade that did not balance or from a deposit. Check the latest trades.</div>}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiTile label="Balance" value={w?.balanceSats != null ? formatSatsCompact(w.balanceSats) : '—'} sub={low ? 'low: top up for fees' : `alert below ${formatSatsCompact(d.lowBalanceSats)}`} tone={low ? 'amber' : 'emerald'} icon={<Coins className="w-4 h-4" />} />
                <KpiTile label="UTXOs" value={w?.utxoCount ?? 0} sub="one is spent per trade" />
                <KpiTile label="Token kinds held" value={tokens.length} sub={tokens.length ? 'should be zero' : 'as expected'} tone={tokens.length ? 'amber' : undefined} />
                <KpiTile label="Bot" value={d.online ? 'Online' : 'Offline'} sub="as of the last heartbeat" tone={d.online ? 'emerald' : 'rose'} />
              </div>
              <div className="grid gap-5 lg:grid-cols-3">
                <Section title="Address" className="lg:col-span-1">
                  <KeyValue rows={[
                    ['Name', 'Mesh Balancer'],
                    ['Address', w?.address ? <AddressLink address={w.address} /> : <span className="text-zinc-600">—</span>],
                    ['Fund with', 'BCH only, several small UTXOs'],
                    ['Key lives in', "the bot's environment only"],
                  ]} />
                  {tokens.length > 0 && (
                    <dl className="mt-4 space-y-1.5 text-xs">{tokens.map(([c, v]) => <div key={c} className="flex items-center justify-between gap-2"><dt><Hash value={c} copy={false} /></dt><dd><Amount asset={c} value={v} /></dd></div>)}</dl>
                  )}
                </Section>
                <Section title="Balance history" description="Sampled from heartbeats; every change is a point" className="lg:col-span-2">
                  {history.length < 2 ? <div className="text-xs text-zinc-600 py-8 text-center">Not enough samples yet</div> : (
                    <div style={{ height: 200 }} role="img" aria-label="Bot wallet balance in sats over time">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                          <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                          <XAxis dataKey="at" type="number" domain={['dataMin', 'dataMax']} {...axis} tickFormatter={v => new Date(v).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit' })} />
                          <YAxis {...axis} width={64} domain={['auto', 'auto']} tickFormatter={v => formatSatsCompact(Math.round(v)).replace(' sats', '')} />
                          <Tooltip {...tooltip} labelFormatter={v => new Date(Number(v)).toLocaleString()} formatter={(v: number) => [formatSatsCompact(Math.round(v)), 'Balance']} />
                          <Line type="stepAfter" dataKey="sats" stroke="#34d399" strokeWidth={1.5} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </Section>
              </div>
              <Section title="Split into fee UTXOs" icon={<Split className="w-4 h-4 text-emerald-300" />}
                description="Each trade spends one wallet UTXO and returns it as change. Several small UTXOs let trades run back to back without waiting for that change.">
                <div className="flex flex-wrap items-end gap-3">
                  <label className="text-[11px] text-zinc-500 space-y-1"><span className="block">UTXOs</span><input className={field} inputMode="numeric" value={count} onChange={e => setCount(e.target.value.replace(/\D/g, ''))} /></label>
                  <label className="text-[11px] text-zinc-500 space-y-1"><span className="block">Sats each</span><input className={field} inputMode="numeric" value={sats} onChange={e => setSats(e.target.value.replace(/\D/g, ''))} /></label>
                  <ConfirmAction label="Split wallet" tone="primary" icon={<Split className="w-3.5 h-3.5" />} pending={split.isPending} disabled={!d.online || !w?.address || !count || !sats}
                    title={`Split the wallet into ${count} UTXOs of ${sats} sats?`}
                    description="The bot sends one transaction from its wallet to its own address. Funds never leave the wallet; only the network fee is spent."
                    onConfirm={() => split.run({ count: Number(count), sats: Number(sats) })} />
                </div>
                {d.commands.length > 0 && (
                  <ul className="mt-4 space-y-1.5 text-xs">
                    {d.commands.map(c => (
                      <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-zinc-400"><TimeAgo at={c.at} unit="ms" /> · {String(c.args?.count)} × {String(c.args?.sats)} sats</span>
                        <span className="flex items-center gap-2"><Pill tone={c.status === 'done' ? 'emerald' : c.status === 'failed' ? 'rose' : 'sky'} dot>{c.status}</Pill>{c.message && <span className="text-zinc-500 break-all">{c.message}</span>}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
              <Section title="UTXOs" description={w?.utxos ? `${w.utxos.length} shown` : undefined}>
                <DataTable
                  rows={w?.utxos ?? []} rowKey={u => `${u.txid}:${u.vout}`}
                  columns={[
                    { key: 'out', header: 'Outpoint', cell: u => <span className="inline-flex items-center gap-1"><TxLink txid={u.txid} /><span className="font-mono text-xs text-zinc-600">:{u.vout}</span></span> },
                    { key: 'sats', header: 'Sats', align: 'right', cell: u => <Sats value={u.sats} /> },
                    { key: 'token', header: 'Token', align: 'right', cell: u => (u.token ? <Amount asset={u.token.category} value={u.token.amount} /> : <span className="text-zinc-600 text-xs">—</span>) },
                  ]}
                  empty={<EmptyBlock title="No UTXOs">Fund the Mesh Balancer address to let it pay network fees.</EmptyBlock>}
                />
              </Section>
            </>
          );
        }}
      </QueryState>
    </>
  );
}

// ── Settings ─────────────────────────────────────────────────────────────────

function Toggle({ label, detail, on, onChange, disabled }: { label: string; detail: ReactNode; on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-white/[0.05] last:border-0">
      <div className="min-w-0"><div className="text-sm font-medium text-zinc-100">{label}</div><div className="text-xs text-zinc-500 leading-relaxed mt-0.5">{detail}</div></div>
      <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
        className={cn('relative shrink-0 h-6 w-11 rounded-full border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 disabled:opacity-40',
          on ? 'bg-emerald-500/30 border-emerald-400/40' : 'bg-white/[0.04] border-white/10')}>
        <span className={cn('absolute top-0.5 h-[18px] w-[18px] rounded-full transition-all duration-150', on ? 'left-[22px] bg-emerald-300' : 'left-0.5 bg-zinc-500')} />
      </button>
    </div>
  );
}

export function BalancerSettingsPage() {
  const q = useBalancerConfig();
  const { api } = useAdmin();
  const save = useAdminAction((p: BalancerConfigPatch & { note?: string }) => api.setBalancerConfig(p), { label: 'Settings', success: r => `Saved as v${r.config.version}; the bot applies it with its next heartbeat` });
  const [draft, setDraft] = useState<BalancerConfig | null>(null);
  const [note, setNote] = useState('');
  const server = q.data?.config;
  // adopt the server's settings on load and whenever a save lands; keep unsaved edits otherwise
  useEffect(() => { if (server && (!draft || draft.version !== server.version)) setDraft(server); }, [server?.version]);

  const field = 'h-8 w-36 px-3 rounded-lg bg-white/[0.03] border border-white/[0.08] text-xs font-mono text-zinc-100 focus:outline-none focus:border-emerald-400/50';
  const area = 'w-full min-h-[72px] px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-xs font-mono text-zinc-100 focus:outline-none focus:border-emerald-400/50';
  const lines = (s: string) => s.split(/[\s,]+/).map(x => x.trim()).filter(Boolean);

  return (
    <>
      <PageHeader title="Balancer settings" icon={<Settings2 className="w-5 h-5 text-emerald-300" />} crumbs={[{ label: 'Mesh Balancer', to: '/admin/balancer' }, { label: 'Settings' }]}
        description="Held on this server and pulled by the bot with every heartbeat, so a change takes effect within about 15 seconds. Every change is logged." />
      <SubNav />
      <QueryState q={q} rows={6}>
        {d => {
          if (!draft) return null;
          const c = draft;
          const dirty = JSON.stringify({ ...c, version: 0, updatedAt: 0, note: '' }) !== JSON.stringify({ ...d.config, version: 0, updatedAt: 0, note: '' });
          const goingLive = d.config.dryRun && !c.dryRun;
          const patch: BalancerConfigPatch & { note?: string } = {
            enabled: c.enabled, dryRun: c.dryRun, modes: c.modes, minProfitSats: c.minProfitSats || '0', dailyCapSats: c.dailyCapSats || null,
            cycleMs: c.cycleMs, denyTokens: c.denyTokens, denyPools: c.denyPools, note: note || undefined,
          };
          return (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <Pill tone="zinc">Settings v{d.config.version}</Pill>
                {d.appliedVersion === null ? <Pill tone="zinc">Bot not connected</Pill> : d.appliedVersion === d.config.version ? <Pill tone="emerald" dot>Applied by the bot</Pill> : <Pill tone="amber" dot>Bot still on v{d.appliedVersion}</Pill>}
                {d.config.updatedAt > 0 && <span>changed <TimeAgo at={d.config.updatedAt} unit="ms" /></span>}
              </div>
              <div className="grid gap-5 lg:grid-cols-2">
                <Section title="Running" icon={<ShieldCheck className="w-4 h-4 text-emerald-300" />}>
                  <Toggle label="Enabled" on={c.enabled} onChange={v => setDraft({ ...c, enabled: v })} detail="Off pauses scanning and trading. The bot keeps sending heartbeats." />
                  <Toggle label="Dry run" on={c.dryRun} onChange={v => setDraft({ ...c, dryRun: v })} detail="On: find crossings, build the transactions, report them, and broadcast nothing. Off: trade for real." />
                </Section>
                <Section title="What it trades">
                  <Toggle label="Mesh ↔ Cauldron" on={c.modes.cauldron} onChange={v => setDraft({ ...c, modes: { ...c.modes, cauldron: v } })} detail="Fill a Mesh pool against Cauldron when the pool's price is through Cauldron's." />
                  <Toggle label="Mesh ↔ Mesh" on={c.modes.meshCross} onChange={v => setDraft({ ...c, modes: { ...c.modes, meshCross: v } })} detail="Fill one Mesh pool from another when one buys a token for more than the other sells it." />
                  <Toggle label="Same-owner crossings" on={c.modes.sameOwner} disabled={!c.modes.meshCross} onChange={v => setDraft({ ...c, modes: { ...c.modes, sameOwner: v } })} detail="Also cross two pools that belong to one LP. Off skips them." />
                </Section>
                <Section title="Limits">
                  <div className="space-y-4">
                    <label className="flex flex-wrap items-center justify-between gap-3 text-xs"><span><span className="block text-sm font-medium text-zinc-100">Minimum profit</span><span className="text-zinc-500">Sats the wallet must keep after fee and carrier, checked on the built transaction.</span></span>
                      <input className={field} inputMode="numeric" value={c.minProfitSats} onChange={e => setDraft({ ...c, minProfitSats: e.target.value.replace(/\D/g, '') })} aria-label="Minimum profit in sats" /></label>
                    <label className="flex flex-wrap items-center justify-between gap-3 text-xs"><span><span className="block text-sm font-medium text-zinc-100">Daily volume cap</span><span className="text-zinc-500">Sats of BCH-side volume per UTC day. Empty means no cap. There is no per-trade maximum.</span></span>
                      <input className={field} inputMode="numeric" placeholder="no cap" value={c.dailyCapSats ?? ''} onChange={e => setDraft({ ...c, dailyCapSats: e.target.value.replace(/\D/g, '') || null })} aria-label="Daily volume cap in sats" /></label>
                    <label className="flex flex-wrap items-center justify-between gap-3 text-xs"><span><span className="block text-sm font-medium text-zinc-100">Scan every</span><span className="text-zinc-500">Milliseconds between scans (1,000 to 300,000).</span></span>
                      <input className={field} inputMode="numeric" value={String(c.cycleMs)} onChange={e => setDraft({ ...c, cycleMs: Number(e.target.value.replace(/\D/g, '') || 0) })} aria-label="Scan interval in milliseconds" /></label>
                  </div>
                </Section>
                <Section title="Deny lists" description="One per line. The bot ignores these; other bots on chain are not bound by them.">
                  <div className="space-y-3">
                    <label className="block text-[11px] text-zinc-500 space-y-1"><span>Token categories (64 hex)</span>
                      <textarea className={area} value={c.denyTokens.join('\n')} onChange={e => setDraft({ ...c, denyTokens: lines(e.target.value) })} spellCheck={false} /></label>
                    <label className="block text-[11px] text-zinc-500 space-y-1"><span>Pool addresses</span>
                      <textarea className={area} value={c.denyPools.join('\n')} onChange={e => setDraft({ ...c, denyPools: lines(e.target.value) })} spellCheck={false} /></label>
                  </div>
                </Section>
              </div>
              <Section title="Save">
                <div className="flex flex-wrap items-center gap-3">
                  <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note for the event log (optional)" aria-label="Note for the event log"
                    className="h-8 flex-1 min-w-[200px] px-3 rounded-lg bg-white/[0.03] border border-white/[0.08] text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-400/50" />
                  <ActionButton onClick={() => { setDraft(d.config); setNote(''); }} disabled={!dirty}>Discard</ActionButton>
                  <ConfirmAction label={dirty ? 'Save settings' : 'No changes'} tone={goingLive ? 'warn' : 'primary'} pending={save.isPending} disabled={!dirty}
                    title={goingLive ? 'Switch off dry run and trade for real?' : 'Save these settings?'}
                    description={goingLive ? 'The bot will broadcast real transactions from its next heartbeat, spending its wallet for network fees. Each trade is still atomic and checked for profit before it is sent.' : 'The bot applies them with its next heartbeat. The change is recorded in the event log.'}
                    onConfirm={() => { save.run(patch); setNote(''); }} />
                </div>
              </Section>
              <Section title="Change history"><EventFeed events={d.history} compact empty="No settings changes yet" /></Section>
            </>
          );
        }}
      </QueryState>
    </>
  );
}
