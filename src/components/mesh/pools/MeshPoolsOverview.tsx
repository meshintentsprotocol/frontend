import React, { useState } from 'react';
import { Layers, PlusCircle, Trophy, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMeshHealth, useMeshPairs, useMeshPools, useMeshPoolStream, useMeshStats } from '@/hooks/useMesh';
import type { PairSummary } from '@/lib/mesh/meshApi';
import { formatNumber, formatSatsCompact, formatUsd, satsToUsd } from '@/lib/mesh/format';
import { tokenPerBchFromSatsPerUnit } from '@/lib/mesh/pool';
import { Panel, PoolPairLabel, useTokenInfo } from './shared';
import { PoolsTable } from './PoolsTable';

export function MeshNetworkHero({ onTab }: { onTab: (t: 'positions' | 'leaderboard' | 'create') => void }) {
  const stats = useMeshStats();
  const health = useMeshHealth();
  const s = stats.data;
  const usd = (sats?: string) => (s ? formatUsd(satsToUsd(sats ?? '0', s.bchUsd)) : '—');
  return (
    <div className="w-full rounded-3xl p-6 sm:p-8 md:p-10 text-white relative overflow-hidden shadow-2xl border border-white/[0.08] bg-[radial-gradient(120%_120%_at_100%_0%,rgba(16,185,129,0.14),transparent_55%),linear-gradient(180deg,#0d1016,#08090c)] space-y-6">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />
      <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight font-heading">Pools &amp; Liquidity</h1>
          <p className="text-xs sm:text-sm md:text-base text-zinc-400 max-w-2xl leading-relaxed">
            Liquidity strategies on Bitcoin Cash. Your funds stay in covenants only you can withdraw; solvers route orders to your pools and the covenant enforces your prices and fee on every fill. Recycling pools keep the proceeds working inside Mesh.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold font-mono',
            health.data ? 'bg-emerald-500/10 border-emerald-400/25 text-emerald-200' : 'bg-red-500/20 border-red-500/30 text-red-200')}>
            {health.data ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {health.data ? `${health.data.network} · ${health.data.latencyMs}ms` : health.isLoading ? 'connecting…' : 'Mesh server offline'}
          </div>
          <Button onClick={() => onTab('positions')} variant="outline" className="h-10 px-4 rounded-full border-white/20 bg-white/10 hover:bg-white/20 text-white font-bold text-xs">
            <Layers className="w-3.5 h-3.5 mr-1.5" />My pools
          </Button>
          <Button onClick={() => onTab('leaderboard')} variant="outline" className="h-10 px-4 rounded-full border-white/20 bg-white/10 hover:bg-white/20 text-white font-bold text-xs">
            <Trophy className="w-3.5 h-3.5 mr-1.5 text-yellow-300" />Leaderboard
          </Button>
          <Button onClick={() => onTab('create')} className="h-10 px-5 rounded-full font-bold text-xs shadow-[0_0_24px_-6px_rgba(16,185,129,0.6)]">
            <PlusCircle className="w-4 h-4 mr-1.5" />New position
          </Button>
        </div>
      </div>
      <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-4 pt-6 border-t border-white/10 font-mono">
        <HeroStat label="Total value locked" value={s ? formatSatsCompact(s.tvlSats) : '—'} sub={`${usd(s?.tvlSats)} · ${s?.activePools ?? 0} active pools`} />
        <HeroStat label="24h volume" value={s ? formatSatsCompact(s.volume24hSats) : '—'} sub={`${usd(s?.volume24hSats)} · ${s?.poolFills24h ?? 0} pool fills`} />
        <HeroStat label="24h LP fees" value={s ? formatSatsCompact(s.fees24hSats) : '—'} sub={usd(s?.fees24hSats)} accent="text-emerald-300" />
        <HeroStat label="Avg fill time" value={s?.avgFillLatencySec != null ? `${s.avgFillLatencySec}s` : '—'} sub={`${s?.lpCount ?? 0} LPs · funding → fill, last 50`} accent="text-cyan-200" />
      </div>
    </div>
  );
}

function HeroStat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="space-y-1 min-w-0">
      <div className="text-[11px] text-zinc-400 font-medium font-sans">{label}</div>
      <div className={cn('text-2xl sm:text-3xl font-bold truncate', accent ?? 'text-white')}>{value}</div>
      {sub && <div className="text-[11px] text-zinc-500 truncate">{sub}</div>}
    </div>
  );
}

export function PairsTable({ pairs, bchUsd, onProvide }: { pairs: PairSummary[]; bchUsd?: number | null; onProvide: (token: string) => void }) {
  const { get } = useTokenInfo(pairs.map(p => p.tokenCategory));
  if (pairs.length === 0) return <div className="py-10 text-center text-xs text-zinc-500">No pools yet — create the first one.</div>;
  const price = (satsPerToken: string | undefined, decimals: number) => satsPerToken ? formatNumber(tokenPerBchFromSatsPerUnit(satsPerToken, decimals), 4) : '—';
  return (
    <div className="overflow-x-auto -mx-2">
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
              <tr key={p.pair} className="border-b border-white/[0.04]">
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
  );
}

export function MeshPoolsOverview({ onTab }: { onTab: (t: 'positions' | 'leaderboard' | 'create', token?: string) => void }) {
  const stats = useMeshStats();
  const pairs = useMeshPairs();
  const [status, setStatus] = useState<'active' | 'all'>('active');
  const pools = useMeshPools({ status, sort: 'value' });
  useMeshPoolStream();
  return (
    <div className="space-y-8">
      <MeshNetworkHero onTab={onTab} />
      <Panel title="Pairs">
        {pairs.isError ? <div className="text-xs text-amber-300">Could not load pairs: {(pairs.error as Error).message}</div>
          : <PairsTable pairs={pairs.data?.pairs ?? []} bchUsd={stats.data?.bchUsd} onProvide={(t) => onTab('create', t)} />}
      </Panel>
      <Panel title="All pools" action={
        <div className="flex gap-1 p-1 rounded-lg bg-black/40 border border-white/[0.06]">
          {(['active', 'all'] as const).map(s => (
            <button key={s} type="button" onClick={() => setStatus(s)} className={cn('px-3 py-1 rounded-md text-[11px] font-semibold', status === s ? 'bg-white/10 text-white' : 'text-zinc-500')}>
              {s === 'active' ? 'Active' : 'Including closed'}
            </button>
          ))}
        </div>
      }>
        <PoolsTable pools={pools.data?.pools ?? []} bchUsd={stats.data?.bchUsd} loading={pools.isLoading} showOwner />
      </Panel>
    </div>
  );
}
