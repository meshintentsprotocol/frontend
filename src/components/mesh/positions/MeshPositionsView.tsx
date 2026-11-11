/**
 * Unified Mesh Positions View (/mesh/positions) (MeshDocs/meshv3v4flow/09 §3.2, canvas C1).
 * Merges V4 discrete bins, V3 strategy covenants, and standalone pools into one list.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlusCircle, Wallet, Layers, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMeshPools, useMeshSigner, useMeshStats, useStrategies, useIdle } from '@/hooks/useMesh';
import { useV4Held } from '@/hooks/useMeshV4';
import { useTokenInfo } from '@/components/mesh/pools/shared';
import { meshPaths } from '@/lib/mesh/routes';
import { shortHex } from '@/lib/mesh/format';
import { buildPositionsViewModel } from '@/lib/mesh/positions/viewModel';
import { PositionsSummaryTiles } from './PositionsSummaryTiles';
import { PositionsFilterTabs, type FilterCount, type PositionFilter } from './PositionsFilterTabs';
import { PositionsTable } from './PositionsTable';
import { PositionCard } from './PositionCard';
import { PendingRegistrationsBanner } from '@/components/mesh/pools/MeshMyPools';
import { RecycleDialog } from '@/components/mesh/strategies/RecycleDialog';

export function MeshPositionsView() {
  const navigate = useNavigate();
  const wallet = useMeshSigner();
  const stats = useMeshStats();
  const bchUsd = stats.data?.bchUsd ?? null;

  const [filter, setFilter] = useState<PositionFilter>('all');
  const [recycleOpen, setRecycleOpen] = useState(false);

  // Queries
  const v3Q = useStrategies(wallet.pkh ?? null);
  const v4Q = useV4Held(wallet.signer?.tokenAddress ?? null);
  const poolsQ = useMeshPools(
    { owner: wallet.pkh ?? undefined, status: 'all', sort: 'value' },
    { enabled: !!wallet.pkh },
  );
  const idleQ = useIdle(wallet.pkh ?? null);

  // Collect all token categories to load symbols and decimals
  const tokenCats = useMemo(() => {
    const set = new Set<string>();
    for (const v4 of v4Q.data?.positions ?? []) {
      if (v4.commitment.tokenCat) set.add(v4.commitment.tokenCat.toLowerCase());
    }
    for (const s of v3Q.data?.strategies ?? []) {
      const cat = (s.params?.token as string) || (s.params?.token1 as string) || (s.params?.tokenA as string);
      if (cat && cat !== '0x') set.add(cat.toLowerCase());
    }
    for (const p of poolsQ.data?.pools ?? []) {
      if (p.v3?.reserve && p.v3.reserve !== '0x') set.add(p.v3.reserve.toLowerCase());
      for (const slot of p.v3?.slots ?? []) {
        if (slot.cat && slot.cat !== '0x') set.add(slot.cat.toLowerCase());
      }
    }
    return Array.from(set);
  }, [v4Q.data, v3Q.data, poolsQ.data]);

  const { get: getToken } = useTokenInfo(tokenCats);

  // Standalone pools are those not tied to a strategy
  const standalonePools = useMemo(() => {
    return (poolsQ.data?.pools ?? []).filter(p => p.contractName !== 'StrategyCovenantV2');
  }, [poolsQ.data]);

  // Build unified view model
  const { rows, summary } = useMemo(() => {
    return buildPositionsViewModel({
      v4Positions: v4Q.data?.positions ?? [],
      v3Strategies: v3Q.data?.strategies ?? [],
      standalonePools,
      tokenInfo: cat => {
        const info = getToken(cat);
        return { symbol: info.symbol || 'Token', decimals: info.decimals || 8 };
      },
      bchUsd,
      idleStrategyIds: idleQ.data?.idleStrategies?.map(i => i.strategyId) ?? [],
    });
  }, [v4Q.data, v3Q.data, standalonePools, getToken, bchUsd, idleQ.data]);

  // Counts for filter tabs
  const counts: FilterCount = useMemo(() => {
    const c: FilterCount = {
      all: rows.length,
      'in-range': 0,
      'out-of-range': 0,
      idle: 0,
      closed: 0,
    };
    for (const r of rows) {
      if (r.status === 'in-range') c['in-range']++;
      else if (r.status === 'out-of-range') c['out-of-range']++;
      else if (r.status === 'idle') c.idle++;
      else if (r.status === 'closed') c.closed++;
    }
    return c;
  }, [rows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    if (filter === 'all') return rows;
    return rows.filter(r => r.status === filter);
  }, [rows, filter]);

  const isLoading = v3Q.isLoading || v4Q.isLoading || poolsQ.isLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">My positions</h1>
          <p className="text-xs text-zinc-400 mt-1">
            {wallet.address ? (
              <>
                Positions owned by <span className="font-mono text-zinc-200">{shortHex(wallet.address, 8, 6)}</span> ({wallet.label})
              </>
            ) : (
              'Connect a wallet to view and manage your positions.'
            )}
          </p>
        </div>
        <Button onClick={() => navigate(meshPaths.create())} className="rounded-xl font-bold bg-emerald-500 hover:bg-emerald-400 text-black">
          <PlusCircle className="w-4 h-4 mr-1.5" />New position
        </Button>
      </div>

      <PendingRegistrationsBanner />

      {/* Idle Banner if there are idle strategies */}
      {counts.idle > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25">
          <div>
            <div className="text-sm font-semibold text-amber-200">
              {counts.idle} {counts.idle === 1 ? 'position has' : 'positions have'} idle funds waiting to trade
            </div>
            <p className="text-xs text-amber-100/80">
              Recycling automatically opens orders on the opposite side to keep your liquidity working.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setRecycleOpen(true)}
            className="rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs"
          >
            Recycle idle funds
          </Button>
        </div>
      )}

      {/* Connect Wallet State */}
      {!wallet.pkh ? (
        <div className="rounded-3xl border border-white/[0.08] bg-[#0c0c10] p-12 text-center">
          <Wallet className="w-10 h-10 text-zinc-500 mx-auto mb-3" />
          <h2 className="text-base font-semibold text-white">No wallet connected</h2>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1 mb-4">
            Connect your wallet to see your Mesh V4 discrete bin positions and V3 covenants.
          </p>
        </div>
      ) : (
        <>
          {/* Summary Tiles */}
          <PositionsSummaryTiles summary={summary} />

          {/* Filter Tabs */}
          <PositionsFilterTabs active={filter} onChange={setFilter} counts={counts} />

          {/* Loading or Rows */}
          {isLoading && rows.length === 0 ? (
            <div className="py-20 text-center text-sm text-zinc-400">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400 mx-auto mb-2" />
              Loading your positions…
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="rounded-3xl border border-white/[0.08] bg-[#0c0c10] p-12 text-center">
              <Layers className="w-10 h-10 text-zinc-500 mx-auto mb-3" />
              <h2 className="text-base font-semibold text-white">
                {filter === 'all' ? 'No positions yet' : `No positions are ${filter.replace('-', ' ')}`}
              </h2>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1 mb-4">
                {filter === 'all'
                  ? 'Create a range, grid, or custom pool to start earning fees across market price swings.'
                  : 'Check your other filter tabs or create a new position.'}
              </p>
              {filter === 'all' && (
                <Button onClick={() => navigate(meshPaths.create())} className="rounded-xl font-bold bg-emerald-500 hover:bg-emerald-400 text-black">
                  <PlusCircle className="w-4 h-4 mr-1.5" />Create position
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table View (≥ 1024px) */}
              <div className="hidden lg:block">
                <PositionsTable rows={filteredRows} />
              </div>

              {/* Mobile Card View (< 1024px) */}
              <div className="grid gap-3 lg:hidden sm:grid-cols-2">
                {filteredRows.map(row => (
                  <PositionCard key={`${row.kind}-${row.id}`} row={row} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Recycle Dialog */}
      {wallet.pkh && (
        <RecycleDialog
          open={recycleOpen}
          onOpenChange={setRecycleOpen}
          ownerPkh={wallet.pkh}
        />
      )}
    </div>
  );
}
