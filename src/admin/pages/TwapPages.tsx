import { useNavigate, useParams } from 'react-router-dom';
import { Repeat, Users } from 'lucide-react';
import { useTwap, useTwaps, useTraders } from '../hooks';
import {
  PageHeader, Section, QueryState, Segmented, useUrlState, DataTable, TimeAgo, Hash, adminUrl, Pill, Progress, KpiTile,
  IntentStatusBadge, MethodBadge, KeyValue, AddressLink, type Tone,
} from '../kit';
import { Amount, AssetPair } from '../assets';
import { EventFeed } from '../EventFeed';
import { sellAsset, buyAsset, type IntentView, type Trader, type TwapOrder } from '../api';
import { formatSatsCompact } from '@/lib/mesh/format';

const TWAP_TONE: Record<TwapOrder['status'], Tone> = { RUNNING: 'sky', AWAITING_FUNDING: 'zinc', COMPLETED: 'emerald', PARTIALLY_FILLED: 'amber', REFUNDED: 'violet' };
const TWAP_LABEL: Record<TwapOrder['status'], string> = { RUNNING: 'Running', AWAITING_FUNDING: 'Awaiting funding', COMPLETED: 'Completed', PARTIALLY_FILLED: 'Partially filled', REFUNDED: 'Refunded' };
const cat = (t: string) => (t === 'BCH' ? '0x' : t);

export function TwapStatus({ status }: { status: TwapOrder['status'] }) {
  return <Pill tone={TWAP_TONE[status] ?? 'zinc'} dot>{TWAP_LABEL[status] ?? status}</Pill>;
}

export function TwapListPage() {
  const nav = useNavigate();
  const [f, set] = useUrlState({ status: '' });
  const q = useTwaps({ status: f.status });
  return (
    <>
      <PageHeader title="TWAP orders" icon={<Repeat className="w-5 h-5 text-violet-300" />}
        description="Orders split into time-sliced Dutch intents. Each slice fills or refunds on its own; progress comes from the slice intents." />
      <QueryState q={q} rows={8}>
        {d => (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {(['RUNNING', 'AWAITING_FUNDING', 'COMPLETED', 'PARTIALLY_FILLED', 'REFUNDED'] as const).map(s => (
                <KpiTile key={s} label={TWAP_LABEL[s]} value={d.byStatus[s] ?? 0} tone={(d.byStatus[s] ?? 0) ? TWAP_TONE[s] : undefined} />
              ))}
            </div>
            <Section title="Orders" description={`${d.total} orders`}>
              <div className="space-y-3">
                <Segmented label="Status" value={f.status} onChange={v => set({ status: v })}
                  options={[{ value: '', label: 'All' }, ...(Object.keys(TWAP_LABEL) as Array<TwapOrder['status']>).map(s => ({ value: s, label: TWAP_LABEL[s], count: d.byStatus[s] ?? 0 }))]} />
                <DataTable<TwapOrder>
                  rows={d.orders} rowKey={o => o.orderId} onRowClick={o => nav(adminUrl.twap(o.orderId))}
                  columns={[
                    { key: 'created', header: 'Created', cell: o => <TimeAgo at={o.createdAt} /> },
                    { key: 'id', header: 'Order', cell: o => <Hash value={o.orderId} to={adminUrl.twap(o.orderId)} /> },
                    { key: 'pair', header: 'Pair', cell: o => <AssetPair sell={cat(o.tokenIn)} buy={cat(o.tokenOut)} size={16} /> },
                    { key: 'total', header: 'Total', align: 'right', cell: o => <Amount asset={cat(o.tokenIn)} value={o.totalAmountIn} />, hideBelow: 'md' },
                    { key: 'progress', header: 'Filled', cell: o => <Progress value={o.slicesFilled} max={o.numSlices} tone={o.slicesRefunded ? 'amber' : 'emerald'} /> },
                    { key: 'refunded', header: 'Refunded', align: 'right', cell: o => <span className="font-mono text-xs text-zinc-400">{o.slicesRefunded}</span>, hideBelow: 'lg' },
                    { key: 'status', header: 'Status', cell: o => <TwapStatus status={o.status} /> },
                    { key: 'maker', header: 'Maker', cell: o => <Hash value={o.creatorAddress} copy={false} />, hideBelow: 'xl' },
                    { key: 'last', header: 'Last fill', cell: o => <TimeAgo at={o.lastFilledAt} />, hideBelow: 'lg' },
                  ]}
                  empty={<div className="py-6 text-center text-xs text-zinc-500">No TWAP orders.</div>}
                />
              </div>
            </Section>
          </>
        )}
      </QueryState>
    </>
  );
}

export function TwapDetailPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const q = useTwap(id);
  return (
    <QueryState q={q} rows={8}>
      {({ order: o, events }) => (
        <>
          <PageHeader crumbs={[{ label: 'TWAP orders', to: '/admin/twap' }, { label: o.orderId }]}
            title={<span className="font-mono text-lg break-all">{o.orderId}</span>} icon={<Repeat className="w-5 h-5 text-violet-300 shrink-0" />}
            description={<span className="inline-flex flex-wrap items-center gap-2"><TwapStatus status={o.status} /><AssetPair sell={cat(o.tokenIn)} buy={cat(o.tokenOut)} /></span>} />
          <div className="grid gap-5 lg:grid-cols-3">
            <Section title="Order">
              <KeyValue rows={[
                ['Total', <Amount asset={cat(o.tokenIn)} value={o.totalAmountIn} icon />],
                ['Slices', <Progress value={o.slicesFilled} max={o.numSlices} label="slices filled" />],
                ['Refunded slices', <span className="font-mono">{o.slicesRefunded}</span>],
                ['Maker', <AddressLink address={o.creatorAddress} to={`/admin/intents?owner=${encodeURIComponent(o.creatorPkh ?? o.creatorAddress)}`} />],
              ]} />
            </Section>
            <Section title="Slices" className="lg:col-span-2">
              <DataTable<IntentView>
                rows={o.slices} rowKey={s => s.intentId} onRowClick={s => nav(adminUrl.intent(s.intentId))}
                columns={[
                  { key: 'n', header: '#', cell: s => <span className="font-mono text-xs">{(s.twapSliceIndex ?? 0) + 1}</span> },
                  { key: 'win', header: 'Window', cell: s => <span className="text-xs text-zinc-400 tabular-nums">{s.startTime ? new Date(s.startTime * 1000).toLocaleTimeString() : '—'}</span> },
                  { key: 'sell', header: 'Sells', align: 'right', cell: s => <Amount asset={sellAsset(s)} value={s.sellAmount} /> },
                  { key: 'got', header: 'Maker got', align: 'right', cell: s => s.fill?.makerPaid ? <Amount asset={buyAsset(s)} value={s.fill.makerPaid} /> : <span className="text-zinc-600 text-xs">—</span>, hideBelow: 'md' },
                  { key: 'status', header: 'Status', cell: s => <IntentStatusBadge status={s.status} /> },
                  { key: 'route', header: 'Route', cell: s => <MethodBadge method={s.fillMethod} /> },
                ]}
              />
            </Section>
          </div>
          <Section title="Events"><EventFeed events={events} /></Section>
        </>
      )}
    </QueryState>
  );
}

export function TradersPage() {
  const nav = useNavigate();
  const q = useTraders();
  return (
    <>
      <PageHeader title="Traders" icon={<Users className="w-5 h-5 text-cyan-300" />} description="Everyone who has placed an intent: activity, kinds, outcomes and BCH-side volume." />
      <Section title="Makers" description={q.data ? `${q.data.total} traders` : undefined}>
        <QueryState q={q} rows={8}>
          {d => (
            <DataTable<Trader>
              rows={d.traders} rowKey={t => t.ownerPkh ?? t.owner} onRowClick={t => nav(`/admin/intents?owner=${encodeURIComponent(t.ownerPkh ?? t.owner)}`)}
              columns={[
                { key: 'who', header: 'Trader', cell: t => <AddressLink address={t.owner} /> },
                { key: 'n', header: 'Intents', align: 'right', cell: t => <span className="font-mono text-xs">{t.intents}</span> },
                { key: 'kinds', header: 'Kinds', cell: t => <span className="flex gap-1">{Object.entries(t.kinds).map(([k, n]) => <Pill key={k} tone={k === 'twap' ? 'violet' : k === 'dutch' ? 'sky' : 'cyan'}>{k} {n}</Pill>)}</span>, hideBelow: 'md' },
                { key: 'filled', header: 'Filled', align: 'right', cell: t => <span className="font-mono text-xs text-emerald-300">{t.filled}</span> },
                { key: 'refunded', header: 'Refunded', align: 'right', cell: t => <span className="font-mono text-xs text-violet-300">{t.refunded}</span>, hideBelow: 'sm' },
                { key: 'open', header: 'Open', align: 'right', cell: t => <span className="font-mono text-xs">{t.open}</span>, hideBelow: 'sm' },
                { key: 'rate', header: 'Fill rate', align: 'right', cell: t => <span className="font-mono text-xs">{t.fillRatePct === null ? '—' : `${t.fillRatePct}%`}</span>, hideBelow: 'md' },
                { key: 'vol', header: 'BCH volume', align: 'right', cell: t => <span className="font-mono text-xs">{formatSatsCompact(t.bchVolumeSats)}</span>, hideBelow: 'lg' },
                { key: 'last', header: 'Last active', cell: t => <TimeAgo at={t.lastAt} /> },
              ]}
            />
          )}
        </QueryState>
      </Section>
    </>
  );
}
