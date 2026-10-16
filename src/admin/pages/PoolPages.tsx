import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Waves, RefreshCw, ExternalLink } from 'lucide-react';
import { useAdmin } from '../AdminContext';
import { useAdminAction, usePools, useEvents } from '../hooks';
import {
  PageHeader, Section, QueryState, Segmented, SearchBox, useUrlState, DataTable, TimeAgo, Hash, adminUrl, Pill, KpiTile, KeyValue,
  ConfirmAction, AddressLink, TxLink, type Tone,
} from '../kit';
import { Amount, AssetPair } from '../assets';
import { EventFeed } from '../EventFeed';
import type { AdminPool } from '../api';
import type { PoolEvent } from '@/lib/mesh/meshApi';
import { formatSatsCompact } from '@/lib/mesh/format';
import { RecyclePill } from '@/components/mesh/ui/defi';

const STATUS_TONE: Record<string, Tone> = { active: 'emerald', exhausted: 'amber', closed: 'zinc' };
const STATUS_LABEL: Record<string, string> = { active: 'Active', exhausted: 'Needs withdraw', closed: 'Closed' };

export function PoolStatus({ status }: { status: string }) {
  return <Pill tone={STATUS_TONE[status] ?? 'zinc'} dot>{STATUS_LABEL[status] ?? status}</Pill>;
}

/** The asset a pool sells (its reserve) and the one it buys. */
export function poolAssets(p: AdminPool): { gives: string; takes: string } {
  if (p.v3) return { gives: p.v3.reserve, takes: p.v3.slots[0]?.cat ?? '0x' };
  return { gives: p.tokenCategoryOut, takes: p.tokenCategoryIn };
}

function ModeBadge({ p }: { p: AdminPool }) {
  if (!p.v3) return <Pill tone="zinc">V2</Pill>;
  if (p.v3.modeName === 'mirror') return <RecyclePill />;
  return <Pill tone={p.v3.modeName === 'fixed' ? 'sky' : 'zinc'}>{p.v3.modeName === 'fixed' ? 'Fixed payout' : 'Pays owner'}</Pill>;
}

export function PoolsPage() {
  const nav = useNavigate();
  const [f, set] = useUrlState({ version: '', status: '', mode: '', q: '', owner: '', strategy: '' });
  const q = usePools({ version: f.version, status: f.status, mode: f.mode, q: f.q, owner: f.owner, strategy: f.strategy });
  return (
    <>
      <PageHeader title="Pools" icon={<Waves className="w-5 h-5 text-sky-300" />}
        description="Every registered Mesh pool, V3 and retired V2, active or closed, with reserves, value, fills and ledger sync state." />
      <QueryState q={q} rows={10}>
        {d => (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <KpiTile label="TVL (matching, active)" value={formatSatsCompact(d.tvlSats)} tone="emerald" />
              <KpiTile label="Active" value={d.counts.byStatus.active ?? 0} />
              <KpiTile label="Needs withdraw" value={d.counts.byStatus.exhausted ?? 0} tone={(d.counts.byStatus.exhausted ?? 0) ? 'amber' : undefined} />
              <KpiTile label="Recycling (mirror)" value={d.counts.byMode.mode2 ?? 0} tone="violet" />
              <KpiTile label="V3 / V2" value={`${d.counts.byVersion.V3 ?? 0} / ${d.counts.byVersion.V2 ?? 0}`} />
            </div>
            <Section title="All pools" description={`${d.total} matching`}
              actions={<SearchBox value={f.q} onChange={v => set({ q: v })} placeholder="Address or strategy id" className="w-56" />}>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-3">
                  <Segmented label="Status" value={f.status} onChange={v => set({ status: v })} options={[
                    { value: '', label: 'All' }, { value: 'active', label: 'Active', count: d.counts.byStatus.active ?? 0 },
                    { value: 'exhausted', label: 'Needs withdraw', count: d.counts.byStatus.exhausted ?? 0 }, { value: 'closed', label: 'Closed', count: d.counts.byStatus.closed ?? 0 },
                  ]} />
                  <Segmented label="Version" value={f.version} onChange={v => set({ version: v })} options={[{ value: '', label: 'Any version' }, { value: 'V3', label: 'V3' }, { value: 'V2', label: 'V2 (retired)' }]} />
                  <Segmented label="Proceeds" value={f.mode} onChange={v => set({ mode: v })} options={[{ value: '', label: 'Any proceeds' }, { value: '0', label: 'To owner' }, { value: '1', label: 'Fixed' }, { value: '2', label: 'Recycling' }]} />
                </div>
                {(f.owner || f.strategy) && (
                  <div className="flex gap-3 text-xs">
                    {f.owner && <button type="button" onClick={() => set({ owner: '' })} className="text-emerald-300 hover:underline">Owner {f.owner.slice(0, 12)}… ✕</button>}
                    {f.strategy && <button type="button" onClick={() => set({ strategy: '' })} className="text-emerald-300 hover:underline">Strategy {f.strategy} ✕</button>}
                  </div>
                )}
                <DataTable<AdminPool>
                  rows={d.pools} rowKey={p => p.address} onRowClick={p => nav(adminUrl.pool(p.address))}
                  rowClassName={p => (p.status === 'closed' ? 'opacity-60' : undefined)}
                  columns={[
                    { key: 'addr', header: 'Pool', cell: p => <Hash value={p.address} to={adminUrl.pool(p.address)} /> },
                    { key: 'pair', header: 'Sells → buys', cell: p => { const a = poolAssets(p); return <AssetPair sell={a.gives} buy={a.takes} size={16} />; } },
                    { key: 'mode', header: 'Type', cell: p => <ModeBadge p={p} />, hideBelow: 'md' },
                    { key: 'reserve', header: 'Reserve', align: 'right', cell: p => <Amount asset={poolAssets(p).gives} value={poolAssets(p).gives === '0x' ? p.reserves.sats : p.reserves.tokens} /> },
                    { key: 'value', header: 'Value', align: 'right', cell: p => <span className="font-mono text-xs">{formatSatsCompact(p.valueSats)}</span>, hideBelow: 'sm' },
                    { key: 'fee', header: 'Fee', align: 'right', cell: p => <span className="font-mono text-xs text-zinc-400">{(p.feeBps / 100).toFixed(2)}%</span>, hideBelow: 'lg' },
                    { key: 'fills', header: 'Fills', align: 'right', cell: p => <span className="font-mono text-xs">{p.stats.fillCount}</span>, hideBelow: 'md' },
                    { key: 'owner', header: 'LP', cell: p => <Hash value={p.ownerPkh} to={adminUrl.lp(p.ownerPkh)} copy={false} head={6} tail={4} />, hideBelow: 'lg' },
                    { key: 'strategy', header: 'Strategy', cell: p => p.bundleId ? <Hash value={p.bundleId} to={adminUrl.strategy(p.bundleId)} copy={false} head={10} tail={3} /> : <span className="text-zinc-600 text-xs">—</span>, hideBelow: 'xl' },
                    { key: 'status', header: 'Status', cell: p => <span className="inline-flex items-center gap-1"><PoolStatus status={p.status} />{p.dirty && <Pill tone="amber" title="UTXO set changed; history not re-read yet">sync</Pill>}
                      {p.throughMarket?.length ? <Pill tone="rose" title={p.throughMarket.map(t => `${t.side} by ${(t.bps / 100).toFixed(2)}%`).join(', ')}>through mkt</Pill> : null}
                      {p.utxos.filter(u => u.valid).length > 1 && <Pill tone="zinc" title="liquidity split across several UTXOs: each is a separate input to fill through">{p.utxos.filter(u => u.valid).length} UTXOs</Pill>}</span> },
                    { key: 'last', header: 'Last fill', cell: p => <TimeAgo at={p.lastFillAt} />, hideBelow: 'xl' },
                  ]}
                />
              </div>
            </Section>
          </>
        )}
      </QueryState>
    </>
  );
}

const EVENT_TONE: Record<string, Tone> = { FILL: 'emerald', DEPOSIT: 'sky', WITHDRAW: 'zinc', REPRICE: 'amber', RECYCLE: 'violet' };

export function PoolDetailPage() {
  const { address = '' } = useParams();
  const { api, interval } = useAdmin();
  const pools = usePools({ q: address });
  const activity = useQuery({ queryKey: ['admin', 'pool-activity', address], queryFn: () => api.poolEvents(address), refetchInterval: interval(2), placeholderData: keepPreviousData });
  const events = useEvents({ subject: address, limit: 100 });
  const resync = useAdminAction((a: string) => api.resyncPool(a), { label: 'Resync', success: () => 'Pool re-read from chain' });
  const p = pools.data?.pools.find(x => x.address === address);

  return (
    <QueryState q={pools} rows={8}>
      {() => !p ? <div className="text-sm text-zinc-400">Pool {address} is not registered on this server.</div> : (
        <>
          <PageHeader crumbs={[{ label: 'Pools', to: '/admin/pools' }, { label: address }]}
            title={<span className="font-mono text-base sm:text-lg break-all">{p.address}</span>} icon={<Waves className="w-5 h-5 text-sky-300 shrink-0" />}
            description={<span className="inline-flex flex-wrap items-center gap-2"><PoolStatus status={p.status} /><ModeBadge p={p} /><AssetPair sell={poolAssets(p).gives} buy={poolAssets(p).takes} /></span>}
            actions={
              <>
                <Link to={`/mesh/pool/${encodeURIComponent(p.address)}`} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border border-white/10 text-zinc-200 hover:bg-white/[0.07]">Public page <ExternalLink className="w-3 h-3" /></Link>
                <ConfirmAction label="Resync from chain" icon={<RefreshCw className="w-3.5 h-3.5" />} pending={resync.isPending}
                  title="Resync this pool?" description="Re-reads the pool's UTXOs and transaction history from the chain and rebuilds its ledger and status."
                  onConfirm={() => resync.run(p.address)} />
              </>
            } />
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
            <KpiTile label="Value" value={formatSatsCompact(p.valueSats)} tone="emerald" />
            <KpiTile label="Fills" value={p.stats.fillCount} sub={`${p.stats.fills24h} in 24h`} />
            <KpiTile label="Volume 7d" value={formatSatsCompact(p.stats.volume7dSats)} />
            <KpiTile label="Fees all" value={formatSatsCompact(p.stats.feesAllSats)} />
            <KpiTile label="P&L" value={formatSatsCompact(p.stats.pnlSats)} tone={p.stats.pnlSats.startsWith('-') ? 'rose' : 'emerald'} />
            <KpiTile label="Fee APR 7d" value={p.stats.feeApr7dPct === null ? '—' : `${p.stats.feeApr7dPct.toFixed(1)}%`} />
          </div>
          <div className="grid gap-5 xl:grid-cols-3">
            <Section title="Pool">
              <KeyValue rows={[
                ['Contract', <span className="font-mono">{p.contractName} · {p.version}</span>],
                ['LP', <Hash value={p.ownerPkh} to={adminUrl.lp(p.ownerPkh)} />],
                ['Owner address', <AddressLink address={p.ownerAddress} />],
                p.bundleId ? ['Strategy', <Hash value={p.bundleId} to={adminUrl.strategy(p.bundleId)} head={12} tail={4} />] : null,
                p.pairRole ? ['Role', p.pairRole.toLowerCase()] : null,
                ['Reserve', <span className="flex flex-col"><Amount asset="0x" value={p.reserves.sats} />{p.reserves.tokens !== '0' && <Amount asset={poolAssets(p).gives} value={p.reserves.tokens} />}</span>],
                ['Fee', `${(p.feeBps / 100).toFixed(2)}%`],
                ['Registered', new Date(p.registeredAt * 1000).toLocaleString()],
                ['Ledger', <span>{p.eventCount} events · synced <TimeAgo at={p.lastSyncAt} />{p.dirty && <span className="text-amber-300"> · out of sync</span>}</span>],
                p.predecessor ? ['Replaced', <Hash value={p.predecessor} to={adminUrl.pool(p.predecessor)} />] : null,
                p.successor ? ['Moved to', <Hash value={p.successor} to={adminUrl.pool(p.successor)} />] : null,
              ]} />
            </Section>
            <Section title={p.v3 ? 'Accepted assets' : 'Price'} className="xl:col-span-2">
              {p.v3 ? (
                <DataTable
                  rows={p.v3.slots} rowKey={s => String(s.index)}
                  columns={[
                    { key: 'i', header: 'Slot', cell: s => <span className="font-mono text-xs">{s.index}</span> },
                    { key: 'asset', header: 'Takes', cell: s => <AssetPair sell={s.cat} buy={p.v3!.reserve} size={14} /> },
                    { key: 'rate', header: 'Trader out per in', align: 'right', cell: s => <span className="font-mono text-xs">{s.traderOutPerIn}</span> },
                    { key: 'proceeds', header: 'Proceeds go to', cell: s => s.proceeds.kind === 'mirror' ? <Hash value={s.proceeds.address} to={adminUrl.pool(s.proceeds.address)} /> : <span className="text-xs text-zinc-400">{s.proceeds.kind === 'owner' ? 'owner wallet' : 'fixed script'}</span> },
                  ]} />
              ) : (
                <KeyValue rows={[['Sats per token', <span className="font-mono">{p.satsPerToken}</span>], ['Trader price', <span className="font-mono">{p.traderSatsPerToken}</span>], ['Market', <span className="font-mono">{p.marketSatsPerToken}</span>]]} />
              )}
              <div className="mt-4">
                <div className="text-[11px] text-zinc-500 mb-2">UTXOs</div>
                <ul className="space-y-1">
                  {p.utxos.map(u => (
                    <li key={`${u.txid}:${u.vout}`} className="flex flex-wrap items-center gap-2 text-xs">
                      <TxLink txid={u.txid} /><span className="text-zinc-600">:{u.vout}</span>
                      <Amount asset="0x" value={u.sats} muted />{u.tokens !== '0' && <Amount asset={poolAssets(p).gives} value={u.tokens} muted />}
                      {!u.valid && <Pill tone="amber">stranded</Pill>}
                    </li>
                  ))}
                  {!p.utxos.length && <li className="text-xs text-zinc-600">No unspent outputs.</li>}
                </ul>
              </div>
            </Section>
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <Section title="Ledger activity" description="From the pool's on-chain history.">
              <QueryState q={activity} rows={5}>
                {a => (
                  <DataTable<PoolEvent>
                    rows={a.events} rowKey={e => `${e.txid}:${e.type}`}
                    columns={[
                      { key: 't', header: 'When', cell: e => <TimeAgo at={e.time} /> },
                      { key: 'type', header: 'Event', cell: e => <Pill tone={EVENT_TONE[e.type] ?? 'zinc'}>{e.type.toLowerCase()}</Pill> },
                      { key: 'in', header: 'In', align: 'right', cell: e => e.amountIn ? <Amount asset={e.asset ?? poolAssets(p).takes} value={e.amountIn} muted /> : <span className="text-zinc-600 text-xs">—</span>, hideBelow: 'sm' },
                      { key: 'out', header: 'Out', align: 'right', cell: e => e.amountOut ? <Amount asset={poolAssets(p).gives} value={e.amountOut} /> : <span className="text-zinc-600 text-xs">—</span> },
                      { key: 'intent', header: 'Intent', cell: e => e.intentId ? <Hash value={e.intentId} to={adminUrl.intent(e.intentId)} head={8} tail={3} copy={false} /> : <span className="text-zinc-600 text-xs">{e.external ? 'external' : '—'}</span>, hideBelow: 'md' },
                      { key: 'tx', header: 'Tx', cell: e => <TxLink txid={e.txid} />, hideBelow: 'lg' },
                    ]}
                    empty={<div className="py-6 text-center text-xs text-zinc-500">No ledger events.</div>}
                  />
                )}
              </QueryState>
            </Section>
            <Section title="Events"><QueryState q={events} rows={5}>{e => <EventFeed events={e.events} />}</QueryState></Section>
          </div>
        </>
      )}
    </QueryState>
  );
}
