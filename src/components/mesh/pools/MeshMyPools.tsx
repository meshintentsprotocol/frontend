import React, { useEffect, useState } from 'react';
import { Droplets, Layers, PlusCircle, Wallet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { meshApi, useInvalidateMesh, useMeshLp, useMeshPools, useMeshPoolStream, useMeshSigner, useMeshStats, useStrategies } from '@/hooks/useMesh';
import { describePending, loadPending, registerPending, removePending, type PendingRegistration } from '@/lib/mesh/pendingRegistrations';
import { formatSatsCompact, formatUsd, satsToUsd, shortHex } from '@/lib/mesh/format';
import { EmptyState, Panel, StatTile } from './shared';
import { PoolsTable } from './PoolsTable';
import { V2MigrationPanel } from '@/components/mesh/v3/V2MigrationPanel';
import { MyStrategies } from '@/components/mesh/strategies/MyStrategies';
import { Pager, usePagination } from '@/components/common/Pager';

/** The two lists on the positions page; kept in the URL as ?view=. */
export type PositionsView = 'strategies' | 'pools';
const POOLS_PER_PAGE = 10;

/** Pools funded in this browser whose registration did not complete. */
export function PendingRegistrationsBanner() {
  const [pending, setPending] = useState<PendingRegistration[]>(() => loadPending());
  const [busy, setBusy] = useState<string | null>(null);
  const invalidate = useInvalidateMesh();
  useEffect(() => { const t = setInterval(() => setPending(loadPending()), 5_000); return () => clearInterval(t); }, []);
  if (pending.length === 0) return null;
  async function retry(p: PendingRegistration) {
    setBusy(p.txid);
    try {
      await registerPending(meshApi, p);
      removePending(p.txid);
      setPending(loadPending());
      invalidate();
      toast.success('Pool registered');
    } catch (e: any) {
      toast.error('Still not registered', { description: e?.message });
    } finally { setBusy(null); }
  }
  return (
    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2">
      <div className="text-sm font-semibold text-amber-200">Funded pools waiting for registration</div>
      <p className="text-[11px] text-amber-100/80">These covenants are funded on-chain (your funds are safe there), but the Mesh server has not indexed them yet, so solvers can't route to them.</p>
      {pending.map(p => (
        <div key={p.txid} className="flex items-center justify-between gap-3 text-xs">
          <span className="font-mono text-amber-100">{describePending(p)} · tx {shortHex(p.txid)}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-7 rounded-lg text-[11px]" onClick={() => { removePending(p.txid); setPending(loadPending()); }}>Dismiss</Button>
            <Button size="sm" className="h-7 rounded-lg text-[11px]" disabled={busy === p.txid} onClick={() => retry(p)}>
              {busy === p.txid ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Retry registration'}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function MeshMyPools({ view, onView, onCreateNew }: { view: PositionsView; onView: (view: PositionsView) => void; onCreateNew: () => void }) {
  const wallet = useMeshSigner();
  const stats = useMeshStats();
  const [status, setStatus] = useState<'active,exhausted' | 'all'>('active,exhausted');
  const mine = useMeshPools({ owner: wallet.pkh ?? undefined, status, sort: 'value' }, { enabled: !!wallet.pkh });
  const lp = useMeshLp(wallet.pkh ?? undefined);
  const strategies = useStrategies(wallet.pkh ?? null);
  useMeshPoolStream();
  const bchUsd = stats.data?.bchUsd;
  const summary = lp.data?.lp;
  const myStrategies = strategies.data?.strategies ?? [];
  // pools that belong to a strategy are shown under Strategies, not here
  const standalonePools = (mine.data?.pools ?? []).filter(p => p.contractName !== 'StrategyCovenantV2');
  const poolPages = usePagination(standalonePools, POOLS_PER_PAGE, status);
  const views = [
    { id: 'strategies', label: 'Strategies', icon: Layers, count: myStrategies.filter(s => s.status !== 'closed').length },
    { id: 'pools', label: 'Pools', icon: Droplets, count: standalonePools.length },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">My pools</h1>
          <p className="text-xs text-zinc-400 mt-1">
            {wallet.address ? <>Pools owned by <span className="font-mono">{shortHex(wallet.address, 8, 6)}</span> ({wallet.label})</> : 'Connect a wallet to see your pools.'}
          </p>
        </div>
        <Button onClick={onCreateNew} className="rounded-xl font-bold"><PlusCircle className="w-4 h-4 mr-1.5" />New pool</Button>
      </div>

      <PendingRegistrationsBanner />

      {!wallet.pkh ? (
        <Panel><EmptyState icon={<Wallet className="w-8 h-8" />} title="No wallet connected">{wallet.unavailable}</EmptyState></Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile label="Value in pools" value={summary ? formatSatsCompact(summary.tvlSats) : '—'} sub={summary ? formatUsd(satsToUsd(summary.tvlSats, bchUsd)) : undefined} />
            <StatTile label="Fees earned" value={summary ? formatSatsCompact(summary.feesAllSats) : '—'} accent="text-emerald-400" sub={summary ? `7d ${formatSatsCompact(summary.fees7dSats)}` : undefined} />
            <StatTile label="Volume 7d" value={summary ? formatSatsCompact(summary.volume7dSats) : '—'} sub={summary ? `${summary.fillCount} fills all time` : undefined} />
            <StatTile label="P&L vs holding" value={summary ? `${BigInt(summary.pnlSats) >= 0n ? '+' : ''}${formatSatsCompact(summary.pnlSats)}` : '—'}
              accent={summary && BigInt(summary.pnlSats) < 0n ? 'text-rose-400' : 'text-emerald-400'} sub={summary ? `${summary.activePools} active of ${summary.poolCount}` : undefined} />
          </div>
          <V2MigrationPanel pools={mine.data?.pools ?? []} />
          <div className="flex w-fit gap-1 rounded-xl border border-white/[0.06] bg-black/40 p-1" role="tablist" aria-label="Positions">
            {views.map(({ id, label, icon: Icon, count }) => (
              <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => onView(id)}
                className={cn('flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors', view === id ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300')}>
                <Icon className="h-3.5 w-3.5" />{label} <span className="font-mono text-zinc-500">{count}</span>
              </button>
            ))}
          </div>
          {view === 'strategies' ? (
            <MyStrategies owner={wallet.pkh} strategies={myStrategies} bchUsd={bchUsd} loading={strategies.isLoading} onCreateNew={onCreateNew} />
          ) : (
          <Panel title="Pools" action={
            <div className="flex gap-1 p-1 rounded-lg bg-black/40 border border-white/[0.06]">
              {([['active,exhausted', 'Open'], ['all', 'Including closed']] as const).map(([s, l]) => (
                <button key={s} type="button" onClick={() => setStatus(s)} className={cn('px-3 py-1 rounded-md text-[11px] font-semibold', status === s ? 'bg-white/10 text-white' : 'text-zinc-500')}>{l}</button>
              ))}
            </div>
          }>
            {mine.isError
              ? <div className="text-xs text-amber-300">Could not load pools: {(mine.error as Error).message}</div>
              : <PoolsTable pools={poolPages.pageItems} bchUsd={bchUsd} loading={mine.isLoading}
                  empty={<EmptyState title="You have no pools yet">Create a pool to start earning fees on Mesh fills. <button className="underline" onClick={onCreateNew}>Create one</button></EmptyState>} />}
            <Pager page={poolPages.page} pageCount={poolPages.pageCount} onPage={poolPages.setPage} className="mt-4" />
          </Panel>
          )}
        </>
      )}
    </div>
  );
}
