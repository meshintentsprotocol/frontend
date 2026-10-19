// OLD — retired 2026-10-19, kept until the clean-up. Not part of the live app. See devrel-agent-context/walletuidocs/connect/old-code.md.
/**
 * /adminpool — operator view of every registered Mesh pool (including closed
 * ones), from the public pool API. Read-only apart from "sync", which only
 * re-reads a pool from chain.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { meshApi, useInvalidateMesh, useMeshHealth, useMeshPools, useMeshPoolStream, useMeshStats } from '@/hooks/useMesh';
import type { Pool, PoolStatus } from '@/lib/mesh/meshApi';
import { formatSatsCompact, formatUsd, satsToUsd, shortHex, timeAgo } from '@/lib/mesh/format';
import { Panel, PoolPairLabel, PoolStatusBadge, StatTile, lpUrl, poolUrl, useTokenInfo } from '@/components/mesh/pools/shared';
import { PoolReserves } from '@/components/mesh/pools/PoolsTable';

export function AdminPoolPage() {
  const stats = useMeshStats();
  const health = useMeshHealth();
  const pools = useMeshPools({ status: 'all', sort: 'recent', limit: 500 });
  const invalidate = useInvalidateMesh();
  useMeshPoolStream();
  const [status, setStatus] = useState<'all' | PoolStatus>('all');
  const [search, setSearch] = useState('');
  const [syncing, setSyncing] = useState<string | null>(null);
  const all = pools.data?.pools ?? [];
  const { get } = useTokenInfo(all.map(p => p.tokenCategory));

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter(p => (status === 'all' || p.status === status)
      && (!q || p.address.toLowerCase().includes(q) || p.ownerPkh.includes(q) || p.ownerAddress.toLowerCase().includes(q) || p.tokenCategory.includes(q) || get(p.tokenCategory).symbol.toLowerCase().includes(q)));
  }, [all, status, search, get]);

  const count = (s: PoolStatus) => all.filter(p => p.status === s).length;
  const s = stats.data;

  async function sync(p: Pool) {
    setSyncing(p.address);
    try { await meshApi.sync(p.address); invalidate(); toast.success('Re-read from chain'); }
    catch (e: any) { toast.error('Sync failed', { description: e?.message }); }
    finally { setSyncing(null); }
  }

  return (
    <div className="container mx-auto py-6 px-4 md:px-8 max-w-[1300px] space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Mesh pools — operator view</h1>
          <p className="text-xs text-zinc-400 mt-1">Every registered StrategyCovenantV2 pool, from the server's chain-derived pool ledger. {health.data ? `Server: ${health.data.network}.` : 'Server unreachable.'}</p>
        </div>
        <Button variant="outline" size="sm" className="rounded-xl" onClick={() => invalidate()}><RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', pools.isFetching && 'animate-spin')} />Refresh</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatTile label="Pools" value={String(all.length)} sub={`${count('active')} active · ${count('exhausted')} need withdraw · ${count('closed')} closed`} />
        <StatTile label="TVL (active)" value={s ? formatSatsCompact(s.tvlSats) : '—'} sub={s ? formatUsd(satsToUsd(s.tvlSats, s.bchUsd)) : undefined} />
        <StatTile label="LPs" value={s ? String(s.lpCount) : '—'} />
        <StatTile label="Pool fills" value={s ? String(s.poolFillsTotal) : '—'} sub={s ? `${s.poolFills24h} in 24h` : undefined} />
        <StatTile label="Avg fill time" value={s?.avgFillLatencySec != null ? `${s.avgFillLatencySec}s` : '—'} sub="funding → fill" />
      </div>

      <Panel title="Pools" action={
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="address, owner, token" className="pl-8 h-8 w-56 text-xs bg-black/40 border-white/10" />
          </div>
          <div className="flex gap-1 p-1 rounded-lg bg-black/40 border border-white/[0.06]">
            {(['all', 'active', 'exhausted', 'closed'] as const).map(v => (
              <button key={v} type="button" onClick={() => setStatus(v)} className={cn('px-2.5 py-1 rounded-md text-[11px] font-semibold capitalize', status === v ? 'bg-white/10 text-white' : 'text-zinc-500')}>{v}</button>
            ))}
          </div>
        </div>
      }>
        {pools.isError ? <div className="text-xs text-amber-300">{(pools.error as Error).message}</div> : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-xs min-w-[1000px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-zinc-500 border-b border-white/5">
                  <th className="px-2 py-2 font-medium">Pool</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Reserves</th>
                  <th className="px-2 py-2 font-medium">UTXOs</th>
                  <th className="px-2 py-2 font-medium">Fills · volume</th>
                  <th className="px-2 py-2 font-medium">LP fees</th>
                  <th className="px-2 py-2 font-medium">Owner</th>
                  <th className="px-2 py-2 font-medium">Lineage</th>
                  <th className="px-2 py-2 font-medium">Last activity</th>
                  <th className="px-2 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {shown.map(p => {
                  const t = get(p.tokenCategory);
                  const stranded = p.utxos.filter(u => !u.valid).length;
                  return (
                    <tr key={p.address} className="border-b border-white/[0.04] align-top">
                      <td className="px-2 py-2.5">
                        <Link to={poolUrl(p)} className="block hover:opacity-80"><PoolPairLabel token={t} side={p.side} size={20} /></Link>
                        <div className="font-mono text-[10px] text-zinc-600 mt-1">{shortHex(p.address, 10, 6)} · {(p.feeBps / 100).toFixed(2)}% · {p.priceNum}/{p.priceDen}</div>
                      </td>
                      <td className="px-2 py-2.5"><PoolStatusBadge status={p.status} /></td>
                      <td className="px-2 py-2.5"><PoolReserves pool={p} token={t} /></td>
                      <td className="px-2 py-2.5 font-mono text-zinc-300">{p.utxos.length}{stranded > 0 && <span className="text-amber-400"> ({stranded} below min)</span>}</td>
                      <td className="px-2 py-2.5 font-mono text-zinc-300">{p.stats.fillCount} · {formatSatsCompact(p.stats.volumeAllSats)}</td>
                      <td className="px-2 py-2.5 font-mono text-emerald-400">{formatSatsCompact(p.stats.feesAllSats)}</td>
                      <td className="px-2 py-2.5"><Link to={lpUrl(p.ownerPkh)} className="font-mono text-zinc-300 hover:underline">{shortHex(p.ownerAddress, 6, 4)}</Link></td>
                      <td className="px-2 py-2.5 text-[10px] text-zinc-400">
                        {p.predecessor && <div>from <Link to={poolUrl(p.predecessor)} className="underline font-mono">{shortHex(p.predecessor, 6, 4)}</Link></div>}
                        {p.successor && <div>to <Link to={poolUrl(p.successor)} className="underline font-mono">{shortHex(p.successor, 6, 4)}</Link></div>}
                        {p.bundleId && <div className="font-mono text-zinc-600">{p.bundleId} · {p.pairRole}</div>}
                      </td>
                      <td className="px-2 py-2.5 text-zinc-400">{timeAgo(p.lastActivityAt)}</td>
                      <td className="px-2 py-2.5"><Button size="sm" variant="outline" className="h-7 rounded-lg text-[11px]" disabled={syncing === p.address} onClick={() => sync(p)}>
                        <RefreshCw className={cn('w-3 h-3', syncing === p.address && 'animate-spin')} />
                      </Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {shown.length === 0 && <div className="py-10 text-center text-xs text-zinc-500">{pools.isLoading ? 'Loading…' : 'No pools match.'}</div>}
          </div>
        )}
      </Panel>
    </div>
  );
}

export default AdminPoolPage;
