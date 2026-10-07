/**
 * /mesh?tab=pools — "Pools & Strategies": a compact network banner, then one
 * panel that routes between pairs, all pools and all strategies (?view=).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layers, PlusCircle, Trophy, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMeshHealth, useMeshPairs, useMeshPools, useMeshPoolStream, useMeshStats, useStrategies } from '@/hooks/useMesh';
import type { PairSummary } from '@/lib/mesh/meshApi';
import { formatNumber, formatSatsCompact, formatUsd, satsToUsd } from '@/lib/mesh/format';
import { tokenPerBchFromSatsPerUnit } from '@/lib/mesh/pool';
import { Pager, usePagination } from '@/components/common/Pager';
import { StrategyCard, strategyTokens } from '@/components/mesh/strategies/StrategyCard';
import { EmptyState, PoolPairLabel, useTokenInfo } from './shared';
import { PoolsTable } from './PoolsTable';

const PAIRS_PER_PAGE = 10;
const POOLS_PER_PAGE = 10;
const STRATEGIES_PER_PAGE = 9;

export function MeshNetworkHero({ onTab }: { onTab: (t: 'positions' | 'leaderboard' | 'create') => void }) {
  const stats = useMeshStats();
  const health = useMeshHealth();
  const s = stats.data;
  const usd = (sats?: string) => (s ? formatUsd(satsToUsd(sats ?? '0', s.bchUsd)) : '—');
  const ghost = 'h-9 px-3 rounded-xl border-white/15 bg-white/[0.06] hover:bg-white/15 text-white font-semibold text-xs';
  return (
    <div className="w-full rounded-2xl sm:rounded-3xl p-4 sm:p-5 text-white relative overflow-hidden shadow-2xl border border-white/[0.08] bg-[radial-gradient(120%_120%_at_100%_0%,rgba(16,185,129,0.14),transparent_55%),linear-gradient(180deg,#0d1016,#08090c)] space-y-4">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-heading truncate">Pools &amp; Strategies</h1>
            <HealthPill health={health} className="lg:hidden" />
          </div>
          <p className="hidden sm:block text-xs text-zinc-400 mt-1 max-w-xl">
            Liquidity on Bitcoin Cash in covenants only you can withdraw. Solvers route orders to your pools at your prices and fee.
          </p>
        </div>
        <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-2 shrink-0">
          <HealthPill health={health} className="hidden lg:flex" />
          <Button onClick={() => onTab('positions')} variant="outline" className={ghost}><Layers className="w-3.5 h-3.5 mr-1.5 shrink-0" />My pools</Button>
          <Button onClick={() => onTab('leaderboard')} variant="outline" className={ghost}><Trophy className="w-3.5 h-3.5 mr-1.5 shrink-0 text-yellow-300" />Leaders</Button>
          <Button onClick={() => onTab('create')} className="h-9 px-3 sm:px-4 rounded-xl font-bold text-xs shadow-[0_0_24px_-6px_rgba(16,185,129,0.6)]"><PlusCircle className="w-3.5 h-3.5 mr-1.5 shrink-0" />New</Button>
        </div>
      </div>
      <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 pt-3 border-t border-white/10 font-mono">
        <HeroStat label="Total value locked" value={s ? formatSatsCompact(s.tvlSats) : '—'} sub={`${usd(s?.tvlSats)} · ${s?.activePools ?? 0} active pools`} />
        <HeroStat label="24h volume" value={s ? formatSatsCompact(s.volume24hSats) : '—'} sub={`${usd(s?.volume24hSats)} · ${s?.poolFills24h ?? 0} fills`} />
        <HeroStat label="24h LP fees" value={s ? formatSatsCompact(s.fees24hSats) : '—'} sub={usd(s?.fees24hSats)} accent="text-emerald-300" />
        <HeroStat label="Avg fill time" value={s?.avgFillLatencySec != null ? `${s.avgFillLatencySec}s` : '—'} sub={`${s?.lpCount ?? 0} LPs · last 50 fills`} accent="text-cyan-200" />
      </div>
    </div>
  );
}

function HealthPill({ health, className }: { health: ReturnType<typeof useMeshHealth>; className?: string }) {
  return (
    <div className={cn('flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[11px] font-semibold font-mono shrink-0 whitespace-nowrap',
      health.data ? 'bg-emerald-500/10 border-emerald-400/25 text-emerald-200' : 'bg-red-500/20 border-red-500/30 text-red-200', className)}>
      {health.data ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
      {health.data ? `${health.data.network} · ${health.data.latencyMs}ms` : health.isLoading ? 'connecting…' : 'offline'}
    </div>
  );
}

function HeroStat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] sm:text-[11px] text-zinc-400 font-medium font-sans">{label}</div>
      <div className={cn('text-base sm:text-xl font-bold truncate leading-tight', accent ?? 'text-white')}>{value}</div>
      {sub && <div className="text-[10px] sm:text-[11px] text-zinc-500 truncate">{sub}</div>}
    </div>
  );
}

export function PairsTable({ pairs, bchUsd, onProvide }: { pairs: PairSummary[]; bchUsd?: number | null; onProvide: (token: string) => void }) {
  const { get } = useTokenInfo(pairs.map(p => p.tokenCategory));
  if (pairs.length === 0) return <div className="py-10 text-center text-xs text-zinc-500">No pools yet — create the first one.</div>;
  const price = (satsPerToken: string | undefined, decimals: number) => satsPerToken ? formatNumber(tokenPerBchFromSatsPerUnit(satsPerToken, decimals), 4) : '—';
  return (
    <>
      {/* small screens: one card per pair */}
      <div className="md:hidden space-y-2">
        {pairs.map(p => {
          const t = get(p.tokenCategory);
          return (
            <div key={p.pair} className="p-3 rounded-2xl bg-black/30 border border-white/[0.06] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <PoolPairLabel token={t} showSide={false} size={24} />
                <Button size="sm" variant="outline" className="rounded-lg text-xs h-8 shrink-0" onClick={() => onProvide(p.tokenCategory)}>Provide</Button>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-xs font-mono">
                <PairCell label="TVL"><span className="text-zinc-200">{formatSatsCompact(p.tvlSats)}</span><span className="text-[11px] text-zinc-500"> · {formatUsd(satsToUsd(p.tvlSats, bchUsd))}</span></PairCell>
                <PairCell label="Volume 24h"><span className="text-zinc-300">{formatSatsCompact(p.volume24hSats)}</span></PairCell>
                <PairCell label="Sell token → BCH"><span className="text-emerald-300">{price(p.bestBid?.satsPerToken, t.decimals)}</span><span className="text-[10px] text-zinc-500"> {t.symbol}/BCH</span></PairCell>
                <PairCell label="Buy token ← BCH"><span className="text-cyan-300">{price(p.bestAsk?.satsPerToken, t.decimals)}</span><span className="text-[10px] text-zinc-500"> {t.symbol}/BCH</span></PairCell>
              </div>
              <div className="text-[10px] text-zinc-500 font-mono">{p.activePools} pools · {p.lpCount} LPs</div>
            </div>
          );
        })}
      </div>
      <div className="hidden md:block overflow-x-auto -mx-2">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500 border-b border-white/5">
              <th className="px-2 py-3 font-medium">Pair</th>
              <th className="px-2 py-3 font-medium">Pools · LPs</th>
              <th className="px-2 py-3 font-medium">TVL</th>
              <th className="px-2 py-3 font-medium">Volume 24h</th>
              <th className="px-2 py-3 font-medium" title="Best rate for a trader selling tokens for BCH (from BCH-selling pools), after fee">Sell token → BCH</th>
              <th className="px-2 py-3 font-medium" title="Best rate for a trader buying tokens with BCH (from token-selling pools), after fee">Buy token ← BCH</th>
              <th className="px-2 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {pairs.map(p => {
              const t = get(p.tokenCategory);
              return (
                <tr key={p.pair} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-2 py-3"><PoolPairLabel token={t} showSide={false} /></td>
                  <td className="px-2 py-3 font-mono text-zinc-300">{p.activePools} · {p.lpCount}</td>
                  <td className="px-2 py-3 font-mono text-zinc-200">{formatSatsCompact(p.tvlSats)}<div className="text-[11px] text-zinc-500">{formatUsd(satsToUsd(p.tvlSats, bchUsd))}</div></td>
                  <td className="px-2 py-3 font-mono text-zinc-300">{formatSatsCompact(p.volume24hSats)}</td>
                  <td className="px-2 py-3 font-mono text-emerald-300">{price(p.bestBid?.satsPerToken, t.decimals)}<div className="text-[10px] text-zinc-500">{t.symbol} per BCH</div></td>
                  <td className="px-2 py-3 font-mono text-cyan-300">{price(p.bestAsk?.satsPerToken, t.decimals)}<div className="text-[10px] text-zinc-500">{t.symbol} per BCH</div></td>
                  <td className="px-2 py-3 text-right"><Button size="sm" variant="outline" className="rounded-lg text-xs" onClick={() => onProvide(p.tokenCategory)}>Provide liquidity</Button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PairCell({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0 truncate"><div className="text-[10px] uppercase tracking-wide text-zinc-500 font-sans mb-0.5">{label}</div>{children}</div>;
}

type View = 'pairs' | 'pools' | 'strategies';
const VIEWS: ReadonlyArray<readonly [View, string, string]> = [['pairs', 'Pairs', 'Pairs'], ['pools', 'All pools', 'Pools'], ['strategies', 'All strategies', 'Strategies']];

export function MeshPoolsOverview({ onTab }: { onTab: (t: 'positions' | 'leaderboard' | 'create', token?: string) => void }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get('view');
  const view: View = raw === 'pools' || raw === 'strategies' ? raw : 'pairs';
  const setView = (v: View) => setSearchParams(v === 'pairs' ? { tab: 'pools' } : { tab: 'pools', view: v });

  const stats = useMeshStats();
  const bchUsd = stats.data?.bchUsd;
  const [status, setStatus] = useState<'active' | 'all'>('active');

  const pairs = useMeshPairs();
  const pairPages = usePagination(pairs.data?.pairs ?? [], PAIRS_PER_PAGE);

  // pools are paged by the server
  const [poolPage, setPoolPage] = useState(1);
  useEffect(() => { setPoolPage(1); }, [status]);
  const pools = useMeshPools({ status, sort: 'value', limit: POOLS_PER_PAGE, offset: (poolPage - 1) * POOLS_PER_PAGE }, { enabled: view === 'pools' });
  const poolPageCount = Math.max(1, Math.ceil((pools.data?.total ?? 0) / POOLS_PER_PAGE));

  const strategies = useStrategies(view === 'strategies' ? undefined : null);
  const shownStrategies = useMemo(() => (strategies.data?.strategies ?? [])
    .filter(s => status === 'all' || s.status !== 'closed')
    .sort((a, b) => Number(BigInt(b.valueSats) - BigInt(a.valueSats))), [strategies.data, status]);
  const strategyPages = usePagination(shownStrategies, STRATEGIES_PER_PAGE, status);
  const { get: infoOf } = useTokenInfo(useMemo(() => shownStrategies.flatMap(strategyTokens), [shownStrategies]));
  useMeshPoolStream();

  const count = view === 'pairs' ? pairs.data?.pairs.length : view === 'pools' ? pools.data?.total : strategies.data ? shownStrategies.length : undefined;

  return (
    <div className="space-y-4 sm:space-y-6">
      <MeshNetworkHero onTab={onTab} />
      <div className="p-3 sm:p-6 bg-[#0c0c10] border border-white/[0.08] rounded-2xl sm:rounded-3xl shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="grid grid-cols-3 sm:flex gap-1 p-1 rounded-xl bg-black/40 border border-white/[0.06]" role="tablist" aria-label="Pools and strategies">
            {VIEWS.map(([k, label, short]) => (
              <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)}
                className={cn('px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors', view === k ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300')}>
                <span className="sm:hidden">{short}</span><span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-3">
            <span className="text-[11px] text-zinc-500 font-mono">{count ?? '—'} {view}</span>
            {view !== 'pairs' && (
              <div className="flex gap-1 p-1 rounded-lg bg-black/40 border border-white/[0.06]">
                {(['active', 'all'] as const).map(s => (
                  <button key={s} type="button" onClick={() => setStatus(s)} className={cn('px-3 py-1 rounded-md text-[11px] font-semibold', status === s ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300')}>
                    {s === 'active' ? 'Active' : 'Including closed'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {view === 'pairs' && (
          <>
            {pairs.isError ? <div className="text-xs text-amber-300">Could not load pairs: {(pairs.error as Error).message}</div>
              : <PairsTable pairs={pairPages.pageItems} bchUsd={bchUsd} onProvide={t => onTab('create', t)} />}
            <Pager page={pairPages.page} pageCount={pairPages.pageCount} onPage={pairPages.setPage} />
          </>
        )}
        {view === 'pools' && (
          <>
            {pools.isError ? <div className="text-xs text-amber-300">Could not load pools: {(pools.error as Error).message}</div>
              : <PoolsTable pools={pools.data?.pools ?? []} bchUsd={bchUsd} loading={pools.isLoading} showOwner />}
            <Pager page={Math.min(poolPage, poolPageCount)} pageCount={poolPageCount} onPage={setPoolPage} />
          </>
        )}
        {view === 'strategies' && (
          <>
            {strategies.isError ? <div className="text-xs text-amber-300">Could not load strategies: {(strategies.error as Error).message}</div>
              : strategies.isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                  {[0, 1, 2].map(i => <div key={i} className="h-[260px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02]" />)}
                </div>
              ) : shownStrategies.length === 0 ? <EmptyState icon={<Layers className="w-8 h-8" />} title="No strategies" />
                : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                    {strategyPages.pageItems.map(s => <StrategyCard key={s.id} s={s} infoOf={infoOf} bchUsd={bchUsd} />)}
                  </div>
                )}
            <Pager page={strategyPages.page} pageCount={strategyPages.pageCount} onPage={strategyPages.setPage} />
          </>
        )}
      </div>
    </div>
  );
}
