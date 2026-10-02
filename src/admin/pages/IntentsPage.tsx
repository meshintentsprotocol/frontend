import { useNavigate } from 'react-router-dom';
import { ArrowDownUp, AlertTriangle } from 'lucide-react';
import { useIntents } from '../hooks';
import {
  PageHeader, Section, QueryState, Segmented, SearchBox, useUrlState, DataTable, Pager, IntentStatusBadge, KindBadge, MethodBadge,
  TimeAgo, Hash, adminUrl, Pill, KpiTile,
} from '../kit';
import { Amount, AssetPair } from '../assets';
import { sellAsset, buyAsset, type IntentView } from '../api';

const LIMIT = 50;
const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'active,scheduled', label: 'Live' },
  { value: 'awaiting_funding', label: 'Awaiting funding' },
  { value: 'expired,refund_pending,underfunded', label: 'Refund due' },
  { value: 'filled', label: 'Filled' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'cancelled,closed_external,expired_unfunded', label: 'Other closed' },
];

function Problem({ i }: { i: IntentView }) {
  const open = !['filled', 'refunded', 'cancelled', 'closed_external', 'expired_unfunded'].includes(i.status);
  if (i.refundAttempts > 0 && i.status !== 'refunded') return <Pill tone="rose" title={i.lastRefundError}>Refund failing ×{i.refundAttempts}</Pill>;
  if (open && i.fillAttempts > 0) return <Pill tone="rose" title={i.lastFillError}>Fill failing ×{i.fillAttempts}</Pill>;
  if (open && i.unfillableSince) return <Pill tone="amber" title={i.lastFillError}>No route</Pill>;
  if (i.status === 'underfunded') return <Pill tone="amber">Underfunded</Pill>;
  return null;
}

export function IntentsPage() {
  const nav = useNavigate();
  const [f, set] = useUrlState({ status: '', kind: '', method: '', problem: '', q: '', owner: '', token: '', twap: '', offset: '0', sort: 'created' });
  const q = useIntents({ ...f, limit: LIMIT, offset: Number(f.offset) });
  const c = q.data?.counts;

  return (
    <>
      <PageHeader title="Intents" icon={<ArrowDownUp className="w-5 h-5 text-cyan-300" />}
        description="Every limit, Dutch and TWAP-slice intent the server tracks, from creation to fill or refund." />
      {c && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiTile label="Fill failing" value={c.problems.failing} tone={c.problems.failing ? 'rose' : undefined} icon={<AlertTriangle className="w-4 h-4" />}
            sub="open, broadcast failed" to="/admin/intents?problem=failing" />
          <KpiTile label="No route" value={c.problems.unfillable} tone={c.problems.unfillable ? 'amber' : undefined} sub="refunded at deadline if unchanged" to="/admin/intents?problem=unfillable" />
          <KpiTile label="Refund failing" value={c.problems.refund_failed} tone={c.problems.refund_failed ? 'rose' : undefined} sub="maker funds still locked" to="/admin/intents?problem=refund_failed" />
          <KpiTile label="Underfunded" value={c.problems.underfunded} sub="funding below the order" to="/admin/intents?problem=underfunded" />
        </div>
      )}
      <Section
        title="All intents"
        description={q.data ? `${q.data.total} matching` : undefined}
        actions={<SearchBox value={f.q} onChange={v => set({ q: v })} placeholder="Intent id, txid, address, TWAP id" className="w-64" />}>
        <div className="space-y-3">
          <Segmented label="Status" value={f.status} onChange={v => set({ status: v })} options={STATUS_OPTIONS.map(o => ({
            ...o, count: o.value === '' ? Object.values(c?.byStatus ?? {}).reduce((a, b) => a + b, 0) : o.value === 'open' ? undefined : o.value.split(',').reduce((a, s) => a + (c?.byStatus[s] ?? 0), 0),
          }))} />
          <div className="flex flex-wrap items-center gap-3">
            <Segmented label="Kind" value={f.kind} onChange={v => set({ kind: v })} options={[
              { value: '', label: 'All kinds' }, { value: 'limit', label: 'Limit', count: c?.byKind.limit ?? 0 },
              { value: 'dutch', label: 'Dutch', count: c?.byKind.dutch ?? 0 }, { value: 'twap', label: 'TWAP', count: c?.byKind.twap ?? 0 },
            ]} />
            <Segmented label="Route" value={f.method} onChange={v => set({ method: v })} options={[
              { value: '', label: 'Any route' }, { value: 'MESH_POOL', label: 'Mesh', count: c?.byMethod.MESH_POOL ?? 0 },
              { value: 'CAULDRON', label: 'Cauldron', count: c?.byMethod.CAULDRON ?? 0 }, { value: 'SOLVER_INVENTORY', label: 'Solver', count: c?.byMethod.SOLVER_INVENTORY ?? 0 },
              { value: 'SPLIT', label: 'Split', count: c?.byMethod.SPLIT ?? 0 },
            ]} />
            <Segmented label="Sort" value={f.sort} onChange={v => set({ sort: v })} options={[{ value: 'created', label: 'Newest' }, { value: 'updated', label: 'Last change' }, { value: 'amount', label: 'Size' }]} />
          </div>
          {(f.owner || f.token || f.twap || f.problem) && (
            <div className="flex flex-wrap gap-2 text-xs">
              {f.problem && <button type="button" onClick={() => set({ problem: '' })} className="text-amber-300 hover:underline">Problem: {f.problem} ✕</button>}
              {f.owner && <button type="button" onClick={() => set({ owner: '' })} className="text-emerald-300 hover:underline">Owner {f.owner.slice(0, 16)}… ✕</button>}
              {f.token && <button type="button" onClick={() => set({ token: '' })} className="text-emerald-300 hover:underline">Token {f.token.slice(0, 10)}… ✕</button>}
              {f.twap && <button type="button" onClick={() => set({ twap: '' })} className="text-violet-300 hover:underline">TWAP {f.twap.slice(0, 10)}… ✕</button>}
            </div>
          )}
          <QueryState q={q} rows={10}>
            {d => (
              <>
                <DataTable<IntentView>
                  rows={d.intents} rowKey={r => r.intentId} onRowClick={r => nav(adminUrl.intent(r.intentId))}
                  columns={[
                    { key: 'created', header: 'Created', cell: r => <TimeAgo at={r.createdAt} /> },
                    { key: 'id', header: 'Intent', cell: r => <Hash value={r.intentId} to={adminUrl.intent(r.intentId)} head={10} tail={4} /> },
                    { key: 'kind', header: 'Kind', cell: r => <KindBadge kind={r.kind} slice={r.twapSliceIndex} /> },
                    { key: 'pair', header: 'Pair', cell: r => <AssetPair sell={sellAsset(r)} buy={buyAsset(r)} size={16} /> },
                    { key: 'sell', header: 'Sells', align: 'right', cell: r => <Amount asset={sellAsset(r)} value={r.sellAmount} />, hideBelow: 'md' },
                    { key: 'min', header: 'Min out', align: 'right', cell: r => <Amount asset={buyAsset(r)} value={r.minAmountOut} muted />, hideBelow: 'lg' },
                    { key: 'status', header: 'Status', cell: r => <IntentStatusBadge status={r.status} /> },
                    { key: 'route', header: 'Route', cell: r => <MethodBadge method={r.fillMethod} />, hideBelow: 'sm' },
                    { key: 'problem', header: 'Attention', cell: r => <Problem i={r} />, hideBelow: 'md' },
                    { key: 'maker', header: 'Maker', cell: r => <Hash value={r.makerAddress} to={`/admin/intents?owner=${encodeURIComponent(r.makerPkh ?? r.makerAddress)}`} copy={false} />, hideBelow: 'xl' },
                  ]}
                />
                <Pager offset={Number(f.offset)} limit={LIMIT} total={d.total} onChange={o => set({ offset: String(o) })} />
              </>
            )}
          </QueryState>
        </div>
      </Section>
    </>
  );
}
