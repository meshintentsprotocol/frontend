import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ExternalLink, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMeshLps, useMeshPoolStream, useMeshSigner, useMeshStats, useRecentPoolFills } from '@/hooks/useMesh';
import { explorerTx, formatSatsCompact, formatUsd, satsToUsd, shortHex, timeAgo } from '@/lib/mesh/format';
import { EmptyState, Panel, StatTile, lpUrl, poolUrl, tokenAmount, useTokenInfo } from './shared';

type Sort = 'tvl' | 'volume' | 'fees' | 'pnl';
const SORTS: Array<[Sort, string]> = [['tvl', 'TVL'], ['volume', 'Volume 7d'], ['fees', 'Fees'], ['pnl', 'P&L']];

export function MeshLeaderboard() {
  const [sort, setSort] = useState<Sort>('tvl');
  const lps = useMeshLps(sort);
  const stats = useMeshStats();
  const recent = useRecentPoolFills(20);
  const wallet = useMeshSigner();
  const navigate = useNavigate();
  useMeshPoolStream();
  const s = stats.data;
  const bchUsd = s?.bchUsd;
  const { get } = useTokenInfo((recent.data?.events ?? []).map(e => e.tokenCategory));
  const list = lps.data?.lps ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Trophy className="w-7 h-7 text-yellow-400" />
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">LP leaderboard</h1>
          <p className="text-xs text-zinc-400">Liquidity providers ranked from on-chain pool history. Fees are what each LP earned over its own zero-fee price.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Liquidity providers" value={s ? String(s.lpCount) : '—'} sub={s ? `${s.activePools} active pools` : undefined} />
        <StatTile label="Total value locked" value={s ? formatSatsCompact(s.tvlSats) : '—'} sub={s ? formatUsd(satsToUsd(s.tvlSats, bchUsd)) : undefined} />
        <StatTile label="Volume 24h" value={s ? formatSatsCompact(s.volume24hSats) : '—'} sub={s ? `${s.poolFills24h} pool fills` : undefined} />
        <StatTile label="LP fees 24h" value={s ? formatSatsCompact(s.fees24hSats) : '—'} accent="text-emerald-400" sub={s ? formatUsd(satsToUsd(s.fees24hSats, bchUsd)) : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <Panel className="lg:col-span-8" title="Providers" action={
          <div className="flex gap-1 p-1 rounded-lg bg-black/40 border border-white/[0.06]">
            {SORTS.map(([k, l]) => (
              <button key={k} type="button" onClick={() => setSort(k)} className={cn('px-2.5 py-1 rounded-md text-[11px] font-semibold', sort === k ? 'bg-white/10 text-white' : 'text-zinc-500')}>{l}</button>
            ))}
          </div>
        }>
          {list.length === 0 && !lps.isLoading ? <EmptyState icon={<Trophy className="w-7 h-7" />} title="No liquidity providers yet" /> : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500 border-b border-white/5">
                    <th className="px-2 py-3 font-medium">#</th>
                    <th className="px-2 py-3 font-medium">LP</th>
                    <th className="px-2 py-3 font-medium">Pools</th>
                    <th className="px-2 py-3 font-medium">TVL</th>
                    <th className="px-2 py-3 font-medium">Volume 7d</th>
                    <th className="px-2 py-3 font-medium">Fees (all)</th>
                    <th className="px-2 py-3 font-medium" title="Value now + withdrawals − deposits, at today's price">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(lp => {
                    const pnl = BigInt(lp.pnlSats);
                    const me = wallet.pkh === lp.ownerPkh;
                    return (
                      <tr key={lp.ownerPkh} onClick={() => navigate(lpUrl(lp.ownerPkh))}
                        className={cn('border-b border-white/[0.04] hover:bg-white/[0.03] cursor-pointer', me && 'bg-emerald-500/[0.04]')}>
                        <td className="px-2 py-3 font-mono text-zinc-500">{lp.rank}</td>
                        <td className="px-2 py-3 font-mono text-zinc-200">{shortHex(lp.ownerAddress, 8, 6)}{me && <span className="ml-2 text-[10px] text-emerald-400 font-sans font-semibold">you</span>}</td>
                        <td className="px-2 py-3 font-mono text-zinc-300">{lp.activePools}/{lp.poolCount}</td>
                        <td className="px-2 py-3 font-mono text-zinc-200">{formatSatsCompact(lp.tvlSats)}</td>
                        <td className="px-2 py-3 font-mono text-zinc-300">{formatSatsCompact(lp.volume7dSats)}</td>
                        <td className="px-2 py-3 font-mono text-emerald-400">{formatSatsCompact(lp.feesAllSats)}</td>
                        <td className={cn('px-2 py-3 font-mono', pnl >= 0n ? 'text-emerald-400' : 'text-rose-400')}>{pnl >= 0n ? '+' : ''}{formatSatsCompact(lp.pnlSats)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel className="lg:col-span-4" title="Recent pool fills">
          {(recent.data?.events ?? []).length === 0 ? <div className="py-8 text-center text-xs text-zinc-500">No fills yet</div> : (
            <div className="space-y-2">
              {recent.data!.events.map(e => {
                const t = get(e.tokenCategory);
                const sellBch = e.side === 'SELL_BCH';
                return (
                  <div key={`${e.txid}-${e.address}`} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-xs space-y-1">
                    <div className="flex justify-between">
                      <Link to={poolUrl(e.address!)} className="font-semibold text-zinc-200 hover:underline">BCH / {t.symbol}</Link>
                      <span className="text-zinc-500">{timeAgo(e.time)}</span>
                    </div>
                    <div className="text-zinc-400">
                      {sellBch
                        ? <>Pool bought {tokenAmount(e.amountIn ?? '0', t)} for {formatSatsCompact(e.amountOut ?? '0')}</>
                        : <>Pool sold {tokenAmount(e.amountOut ?? '0', t)} for {formatSatsCompact(e.amountIn ?? '0')}</>}
                    </div>
                    <a href={explorerTx(wallet.network, e.txid)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-[10px] text-zinc-500 hover:text-zinc-300">
                      {shortHex(e.txid)} <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
