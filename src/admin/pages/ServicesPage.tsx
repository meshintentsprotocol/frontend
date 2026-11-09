/**
 * Services: is every backend this app talks to up, on the right network, and
 * reachable from the browser? One row per setting the frontend reads (testnet,
 * mainnet and shared), plus the outside APIs it depends on.
 */
import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, Network, RefreshCw, Server, ExternalLink } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { ProbeRow, ProbeStatus } from '@/lib/services/probe';
import { DataTable, KpiTile, PageHeader, Pill, Section, Segmented, ago, useNow, type Column, type Tone } from '../kit';
import { useServiceProbes } from '../serviceProbes';
import { cn } from '@/lib/utils';

const STATUS: Record<ProbeStatus, { tone: Tone; label: string; hint: string }> = {
    live: { tone: 'emerald', label: 'Live', hint: 'Answers, and reports the expected network' },
    degraded: { tone: 'amber', label: 'Degraded', hint: 'Answers, but its readiness check failed' },
    mismatch: { tone: 'rose', label: 'Wrong network', hint: 'Answers, but reports a different network or has mainnet off' },
    reachable: { tone: 'amber', label: 'Reachable', hint: 'Answers, but the browser cannot read the reply (CORS) or it is not JSON' },
    down: { tone: 'rose', label: 'Down', hint: 'No answer, an error, or timed out' },
    unset: { tone: 'zinc', label: 'Not set', hint: 'Nothing configured for this setting' },
};

const GROUPS = [
    { key: 'testnet', title: 'Testnet', description: 'Chipnet, Solana devnet and EVM testnets: what Testnet mode uses.' },
    { key: 'mainnet', title: 'Mainnet', description: 'What Mainnet mode uses. Real funds.' },
    { key: 'shared', title: 'Shared', description: 'Used in both modes.' },
] as const;

type Filter = 'all' | 'problems' | 'services';

function StatusPill({ row }: { row: ProbeRow }) {
    const { endpoint: e, result: r } = row;
    const meta = r.status === 'unset' && e.optional ? { ...STATUS.unset, label: 'Not set (optional)' } : STATUS[r.status];
    return <Pill tone={r.warning ? 'amber' : meta.tone} dot title={meta.hint}>{meta.label}</Pill>;
}

const isProblem = ({ endpoint: e, result: r }: ProbeRow) =>
    !!r.warning || !(r.status === 'live' || (r.status === 'unset' && e.optional));

const columns: Column<ProbeRow>[] = [
    {
        key: 'name', header: 'Endpoint',
        cell: ({ endpoint: e }) => (
            <div className="min-w-[180px]">
                <div className="flex items-center gap-1.5 text-zinc-100">
                    {e.label}
                    {e.kind === 'dependency' && <span className="rounded bg-white/[0.05] px-1 py-px text-[9px] uppercase tracking-wider text-zinc-500">external</span>}
                </div>
                <div className="text-[11px] text-zinc-500">{e.purpose}</div>
            </div>
        ),
    },
    { key: 'status', header: 'Status', cell: row => <StatusPill row={row} /> },
    { key: 'reports', header: 'Reports', cell: ({ result: r }) => <span className="font-mono text-xs text-zinc-300">{r.reported ?? '—'}</span>, hideBelow: 'md' },
    {
        key: 'latency', header: 'Latency', align: 'right', hideBelow: 'sm',
        cell: ({ result: r }) => r.latencyMs == null ? <span className="text-zinc-600">—</span>
            : <span className={cn('font-mono text-xs tabular-nums', r.latencyMs > 3000 ? 'text-amber-300' : 'text-zinc-300')}>{r.latencyMs} ms</span>,
    },
    {
        key: 'url', header: 'URL / setting', hideBelow: 'lg',
        cell: ({ endpoint: e }) => (
            <div className="max-w-[340px]">
                {e.url
                    ? <a href={e.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all font-mono text-[11px] text-zinc-400 hover:text-emerald-300" onClick={ev => ev.stopPropagation()}>{e.url}<ExternalLink className="h-3 w-3 shrink-0" /></a>
                    : <span className="text-[11px] text-zinc-600">—</span>}
                <div className="font-mono text-[10px] text-zinc-600">{e.var ? `${e.var}${e.source !== e.var ? ` · ${e.source}` : ''}` : 'built in'}</div>
            </div>
        ),
    },
    {
        key: 'note', header: 'Note',
        cell: ({ result: r }) => (
            <div className="max-w-[300px] text-xs">
                {r.warning && <div className="text-amber-300">{r.warning}</div>}
                {(r.detail || r.error) && <div className={r.status === 'live' ? 'text-zinc-500' : 'text-zinc-300'}>{r.detail ?? r.error}</div>}
            </div>
        ),
    },
];

export function ServicesPage() {
    const q = useServiceProbes();
    const qc = useQueryClient();
    const now = useNow(5000);
    const [filter, setFilter] = useState<Filter>('all');
    const data = q.data;

    const byGroup = useMemo(() => {
        const rows = data?.rows ?? [];
        const keep = (r: ProbeRow) => filter === 'all' || (filter === 'problems' ? isProblem(r) : r.endpoint.kind === 'service');
        // services first, then outside dependencies; problems on top within each
        const sorted = rows.filter(keep).sort((a, b) =>
            (a.endpoint.kind === b.endpoint.kind ? 0 : a.endpoint.kind === 'service' ? -1 : 1)
            || Number(isProblem(b)) - Number(isProblem(a)));
        return GROUPS.map(g => ({ ...g, rows: sorted.filter(r => r.endpoint.group === g.key) }));
    }, [data, filter]);

    const s = data?.summary;
    const localWarnings = (data?.rows ?? []).filter(r => r.result.warning).length;
    const servicesLive = (data?.rows ?? []).filter(r => r.endpoint.kind === 'service' && r.result.status === 'live').length;
    const servicesTotal = (data?.rows ?? []).filter(r => r.endpoint.kind === 'service' && r.result.status !== 'unset').length;
    const latencies = (data?.rows ?? []).map(r => r.result.latencyMs).filter((n): n is number => typeof n === 'number');
    const median = latencies.length ? [...latencies].sort((a, b) => a - b)[Math.floor(latencies.length / 2)] : undefined;

    return (
        <>
            <PageHeader
                title="Services"
                icon={<Network className="w-5 h-5 text-emerald-300" />}
                description="Every server and outside API this build of the app is configured to use, checked from your browser: up, on the right network, ready."
                actions={
                    <button type="button" onClick={() => qc.invalidateQueries({ queryKey: ['admin', 'service-probes'] })}
                        title={q.isFetching ? 'A check is running' : undefined}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.06]">
                        <RefreshCw className={cn('h-3.5 w-3.5', q.isFetching && 'animate-spin')} /> Check now
                    </button>
                }
            />

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                <KpiTile label="Servers live" loading={!data} value={`${servicesLive} / ${servicesTotal}`} tone={servicesLive === servicesTotal ? 'emerald' : 'rose'} icon={<Server className="w-4 h-4" />} />
                <KpiTile label="Need attention" loading={!data} value={s?.problems ?? 0} tone={s?.problems ? 'amber' : 'emerald'} icon={<AlertTriangle className="w-4 h-4" />}
                    sub={s ? `${s.down} down · ${s.mismatch} wrong network · ${s.degraded} degraded` : undefined} />
                <KpiTile label="Endpoints live" loading={!data} value={`${s?.live ?? 0} / ${s?.total ?? 0}`} icon={<Activity className="w-4 h-4" />} sub="servers and outside APIs" />
                <KpiTile label="Median latency" loading={!data} value={median != null ? `${median} ms` : '—'} sub="from this browser" />
                <KpiTile label="Last check" loading={!data} value={data ? ago(Math.floor(data.checkedAt / 1000), now) : '—'} sub={q.isFetching ? 'checking now…' : 'every 30 s or more (console poll setting)'} />
            </div>

            {localWarnings > 0 && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-500/[0.07] px-4 py-3 text-sm text-amber-200">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{localWarnings} setting{localWarnings === 1 ? '' : 's'} point at localhost, but this page is not running locally. Visitors cannot reach those; set the production URLs in the deploy's environment.</span>
                </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
                <Segmented label="Show" value={filter} onChange={v => setFilter(v as Filter)}
                    options={[{ value: 'all', label: 'All' }, { value: 'problems', label: 'Needs attention' }, { value: 'services', label: 'Our servers' }]} />
                <p className="text-[11px] text-zinc-500">
                    Run the same check from a terminal, and start or stop the servers: <span className="font-mono text-zinc-400">node devrel-agent-context/deployscritps/stack/stack.mjs status</span>
                </p>
            </div>

            {q.error && !data && (
                <Section><p className="text-sm text-rose-300">The checks could not run: {(q.error as Error).message}</p></Section>
            )}

            {byGroup.map(g => (
                <Section key={g.key} title={g.title} description={g.description}
                    actions={data ? <GroupCounts rows={data.rows.filter(r => r.endpoint.group === g.key)} /> : undefined}>
                    <DataTable columns={columns} rows={g.rows} rowKey={r => r.endpoint.id} loading={!data}
                        rowClassName={r => (isProblem(r) ? 'bg-rose-500/[0.025]' : undefined)}
                        empty={<p className="py-6 text-center text-xs text-zinc-500">{filter === 'problems' ? 'Nothing needs attention here.' : 'No endpoints.'}</p>} />
                </Section>
            ))}
        </>
    );
}

function GroupCounts({ rows }: { rows: ProbeRow[] }) {
    const live = rows.filter(r => r.result.status === 'live').length;
    const bad = rows.filter(isProblem).length;
    return (
        <div className="flex items-center gap-1.5">
            <Pill tone="emerald" dot>{live} live</Pill>
            {bad > 0 && <Pill tone="rose" dot>{bad} need attention</Pill>}
        </div>
    );
}
