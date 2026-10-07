/**
 * /mesh?tab=leaderboard — providers ranked from pool history, next to the
 * latest pool fills. On small screens the two share one panel (?view=fills).
 */
import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ExternalLink, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMeshLps, useMeshPoolStream, useMeshSigner, useMeshStats, useRecentPoolFills } from '@/hooks/useMesh';
import { explorerTx, formatSatsCompact, formatUsd, satsToUsd, shortHex, timeAgo } from '@/lib/mesh/format';
import { Pager, usePagination } from '@/components/common/Pager';
import { useSmallScreen } from '@/components/mesh/ui/ManageDock';
import { EmptyState, Panel, PanelTabs, StatTile, lpUrl, poolUrl, tokenAmount, useTokenInfo } from './shared';

type Sort = 'tvl' | 'volume' | 'fees' | 'pnl';
const SORTS: Array<[Sort, string]> = [['tvl', 'TVL'], ['volume', 'Volume 7d'], ['fees', 'Fees'], ['pnl', 'P&L']];
const VIEWS = [['providers', 'Providers'], ['fills', 'Recent pool fills']] as const;
const PROVIDERS_PER_PAGE = 10;
const FILLS_PER_PAGE = 6;

export function MeshLeaderboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get('view') === 'fills' ? 'fills' : 'providers';
  const setView = (v: 'providers' | 'fills') => setSearchParams(v === 'fills' ? { tab: 'leaderboard', view: v } : { tab: 'leaderboard' });
  const small = useSmallScreen();
  const [sort, setSort] = useState<Sort>('tvl');
  const lps = useMeshLps(sort);
  const stats = useMeshStats();
  const recent = useRecentPoolFills(30);
  const wallet = useMeshSigner();
  const navigate = useNavigate();
  useMeshPoolStream();
  const s = stats.data;
  const bchUsd = s?.bchUsd;
  const { get } = useTokenInfo((recent.data?.events ?? []).map(e => e.tokenCategory));
  const list = lps.data?.lps ?? [];
  const lpPages = usePagination(list, PROVIDERS_PER_PAGE, sort);
  const fillPages = usePagination(recent.data?.events ?? [], FILLS_PER_PAGE);

  const sortTabs = (
    <div className="flex gap-1 p-1 rounded-lg bg-black/40 border border-white/[0.06] overflow-x-auto">
      {SORTS.map(([k, l]) => (
        <button key={k} type="button" onClick={() => setSort(k)} className={cn('flex-1 sm:flex-none px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap', sort === k ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300')}>{l}</button>
      ))}
    </div>
  );

  const providers = (
    <>
      {list.length === 0 && !lps.isLoading ? <EmptyState icon={<Trophy className="w-7 h-7" />} title="No liquidity providers yet" /> : (
        <>
          {/* small screens: one card per provider */}
          <div className="md:hidden space-y-2">
            {lpPages.pageItems.map(lp => {
              const pnl = BigInt(lp.pnlSats);
              const me = wallet.pkh === lp.ownerPkh;
              return (
                <Link key={lp.ownerPkh} to={lpUrl(lp.ownerPkh)} className={cn('block p-3 rounded-2xl bg-black/30 border border-white/[0.06] active:bg-white/[0.04] space-y-2.5', me && 'border-emerald-500/30 bg-emerald-500/[0.04]')}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] font-mono text-xs font-bold text-zinc-300">{lp.rank}</span>
                      <span className="font-mono text-sm text-zinc-200 truncate">{shortHex(lp.ownerAddress, 8, 6)}</span>
                      {me && <span className="text-[10px] text-emerald-400 font-semibold">you</span>}
                    </div>
                    <span className="text-[11px] font-mono text-zinc-500 shrink-0">{lp.activePools}/{lp.poolCount} pools</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs font-mono">
                    <Cell label="TVL"><span className="text-zinc-200">{formatSatsCompact(lp.tvlSats)}</span></Cell>
                    <Cell label="Vol 7d"><span className="text-zinc-300">{formatSatsCompact(lp.volume7dSats)}</span></Cell>
                    <Cell label="Fees"><span className="text-emerald-400">{formatSatsCompact(lp.feesAllSats)}</span></Cell>
                    <Cell label="P&L"><span className={pnl >= 0n ? 'text-emerald-400' : 'text-rose-400'}>{pnl >= 0n ? '+' : ''}{formatSatsCompact(lp.pnlSats)}</span></Cell>
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="hidden md:block overflow-x-auto -mx-2">
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
                {lpPages.pageItems.map(lp => {
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
        </>
      )}
      <Pager page={lpPages.page} pageCount={lpPages.pageCount} onPage={lpPages.setPage} />
    </>
  );

  const fills = (
    <>
      {(recent.data?.events ?? []).length === 0 ? <div className="py-8 text-center text-xs text-zinc-500">No fills yet</div> : (
        <div className="space-y-2">
          {fillPages.pageItems.map(e => {
            const t = get(e.tokenCategory);
            const sellBch = e.side === 'SELL_BCH';
            return (
              <div key={`${e.txid}-${e.address}`} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-xs space-y-1">
                <div className="flex justify-between gap-2">
                  <Link to={poolUrl(e.address!)} className="font-semibold text-zinc-200 hover:underline truncate">BCH / {t.symbol}</Link>
                  <span className="text-zinc-500 shrink-0">{timeAgo(e.time)}</span>
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
      <Pager page={fillPages.page} pageCount={fillPages.pageCount} onPage={fillPages.setPage} />
    </>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <Trophy className="w-6 h-6 sm:w-7 sm:h-7 text-yellow-400 shrink-0" />
        <div className="min-w-0">
          <h1 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight">LP leaderboard</h1>
          <p className="text-[11px] sm:text-xs text-zinc-400">Liquidity providers ranked from on-chain pool history. Fees are what each LP earned over its own zero-fee price.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <StatTile label="Liquidity providers" value={s ? String(s.lpCount) : '—'} sub={s ? `${s.activePools} active pools` : undefined} />
        <StatTile label="Total value locked" value={s ? formatSatsCompact(s.tvlSats) : '—'} sub={s ? formatUsd(satsToUsd(s.tvlSats, bchUsd)) : undefined} />
        <StatTile label="Volume 24h" value={s ? formatSatsCompact(s.volume24hSats) : '—'} sub={s ? `${s.poolFills24h} pool fills` : undefined} />
        <StatTile label="LP fees 24h" value={s ? formatSatsCompact(s.fees24hSats) : '—'} accent="text-emerald-400" sub={s ? formatUsd(satsToUsd(s.fees24hSats, bchUsd)) : undefined} />
      </div>

      {small ? (
        <Panel className="p-3 sm:p-6" title={<PanelTabs tabs={VIEWS} value={view} onChange={setView} />}>
          {view === 'providers' ? <>{sortTabs}{providers}</> : fills}
        </Panel>
      ) : (
        <div className="grid grid-cols-12 gap-6 items-start">
          <Panel className="col-span-8" title="Providers" action={sortTabs}>{providers}</Panel>
          <Panel className="col-span-4" title="Recent pool fills">{fills}</Panel>
        </div>
      )}
    </div>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0 truncate"><div className="text-[10px] uppercase tracking-wide text-zinc-500 font-sans mb-0.5">{label}</div>{children}</div>;
}
