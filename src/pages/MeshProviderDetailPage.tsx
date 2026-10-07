/**
 * /mesh/provider/:owner — one liquidity provider (pkh or P2PKH cashaddr):
 * aggregates, daily volume/fees, pools and recent activity, all from the
 * server's pool ledger.
 */
import React from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, ArrowLeft, Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useMeshLp, useMeshPoolStream, useMeshSigner, useMeshStats } from '@/hooks/useMesh';
import { explorerAddress, explorerTx, formatSatsCompact, formatUsd, satsToUsd, shortHex, timeAgo } from '@/lib/mesh/format';
import { Pager, usePagination } from '@/components/common/Pager';
import { Panel, PanelTabs, StatTile, poolUrl, tokenAmount, useTokenInfo } from '@/components/mesh/pools/shared';
import { PoolsTable } from '@/components/mesh/pools/PoolsTable';

const VIEWS = [['pools', 'Pools'], ['activity', 'Recent activity']] as const;
const POOLS_PER_PAGE = 10;
const EVENTS_PER_PAGE = 12;

export function MeshProviderDetailPage() {
  const { address: raw } = useParams();
  const owner = raw ? decodeURIComponent(raw) : undefined;
  const lp = useMeshLp(owner);
  const stats = useMeshStats();
  const wallet = useMeshSigner();
  useMeshPoolStream();
  const d = lp.data;
  const { get } = useTokenInfo((d?.activity ?? []).map(e => e.tokenCategory));
  const bchUsd = stats.data?.bchUsd;
  // ?view=activity shows the activity list instead of the pools
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get('view') === 'activity' ? 'activity' : 'pools';
  const setView = (v: 'pools' | 'activity') => setSearchParams(v === 'activity' ? { view: v } : {}, { replace: true });
  const poolPages = usePagination(d?.pools ?? [], POOLS_PER_PAGE);
  const eventPages = usePagination(d?.activity ?? [], EVENTS_PER_PAGE);

  if (lp.isLoading) return <div className="py-28 text-center text-zinc-400 text-sm"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />Loading provider…</div>;
  if (!d) {
    return (
      <div className="container mx-auto max-w-lg py-16">
        <Panel>
          <div className="text-center space-y-3 py-6">
            <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
            <h2 className="text-xl font-bold text-white">{(lp.error as any)?.status === 404 ? 'No pools for this provider' : 'Could not load the provider'}</h2>
            <Link to="/mesh?tab=leaderboard" className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-300 hover:text-white"><ArrowLeft className="w-4 h-4" />Leaderboard</Link>
          </div>
        </Panel>
      </div>
    );
  }

  const s = d.lp;
  const pnl = BigInt(s.pnlSats);
  const chart = d.daily.map(x => ({ day: new Date(x.day * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), volume: Number(x.volumeSats), fees: Number(x.feesSats), fills: x.fills }));

  return (
    <div className="container mx-auto py-4 sm:py-6 px-4 md:px-8 max-w-[1200px] space-y-4 sm:space-y-6">
      <Link to="/mesh?tab=leaderboard" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300"><ArrowLeft className="w-3.5 h-3.5" />Leaderboard</Link>
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
          Liquidity provider {wallet.pkh === s.ownerPkh && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">you</span>}
        </h1>
        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-zinc-400 font-mono">
          <a href={explorerAddress(wallet.network, s.ownerAddress)} target="_blank" rel="noreferrer" className="hover:text-white min-w-0 break-all">{s.ownerAddress}</a>
          <button type="button" onClick={() => { void navigator.clipboard.writeText(s.ownerAddress); toast.success('Copied'); }}><Copy className="w-3 h-3" /></button>
          {s.firstSeenAt && <span className="font-sans text-zinc-500">· first pool {timeAgo(s.firstSeenAt)}</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <StatTile label="Value in pools" value={formatSatsCompact(s.tvlSats)} sub={`${formatUsd(satsToUsd(s.tvlSats, bchUsd))} · ${s.activePools}/${s.poolCount} pools active`} />
        <StatTile label="Volume 7d" value={formatSatsCompact(s.volume7dSats)} sub={`all time ${formatSatsCompact(s.volumeAllSats)} · ${s.fillCount} fills`} />
        <StatTile label="Fees earned" value={formatSatsCompact(s.feesAllSats)} accent="text-emerald-400" sub={`7d ${formatSatsCompact(s.fees7dSats)}`} />
        <StatTile label="P&L vs holding" value={`${pnl >= 0n ? '+' : ''}${formatSatsCompact(s.pnlSats)}`} accent={pnl >= 0n ? 'text-emerald-400' : 'text-rose-400'} sub="at today's price" />
      </div>

      <Panel title="Daily volume and fees" action={<span className="text-[11px] text-zinc-500">last 30 days, sats</span>}>
        <div className="h-40 sm:h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: '#71717a', fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#71717a', fontSize: 10 }} width={64} tickFormatter={(v) => formatSatsCompact(Math.round(v))} />
              <Tooltip contentStyle={{ background: '#0c0c10', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11 }}
                formatter={(v: number, n: string) => [formatSatsCompact(Math.round(v)), n === 'volume' ? 'Volume' : 'LP fees']} />
              <Bar dataKey="volume" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="fees" fill="#34d399" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel className="p-3 sm:p-6" title={<PanelTabs tabs={VIEWS} value={view} onChange={setView} />}
        action={<span className="text-[11px] text-zinc-500 font-mono">{view === 'pools' ? `${d.pools.length} pools` : `${d.activity.length} events`}</span>}>
        {view === 'pools' && (
          <>
            <PoolsTable pools={poolPages.pageItems} bchUsd={bchUsd} />
            <Pager page={poolPages.page} pageCount={poolPages.pageCount} onPage={poolPages.setPage} />
          </>
        )}
        {view === 'activity' && (d.activity.length === 0 ? <div className="py-6 text-center text-xs text-zinc-500">No activity</div> : (
          <>
            <div className="divide-y divide-white/[0.04]">
              {eventPages.pageItems.map(e => {
                const t = get(e.tokenCategory);
                return (
                  <div key={`${e.address}-${e.txid}-${e.type}`} className="grid grid-cols-[auto_1fr_auto] sm:grid-cols-[5rem_5rem_8rem_1fr_auto] items-center gap-x-3 gap-y-1 py-2.5 text-xs">
                    <span className="font-semibold text-zinc-300 sm:order-2">{e.type}</span>
                    <Link to={poolUrl(e.address!)} className="text-zinc-300 hover:underline truncate sm:order-3">BCH / {t.symbol}</Link>
                    <span className="text-zinc-500 whitespace-nowrap text-right sm:text-left sm:order-1">{timeAgo(e.time)}</span>
                    <span className="col-span-2 sm:col-span-1 font-mono text-zinc-400 truncate sm:order-4">
                      {e.type === 'FILL'
                        ? e.side === 'SELL_BCH' ? `${tokenAmount(e.amountIn ?? '0', t)} → ${formatSatsCompact(e.amountOut ?? '0')}` : `${formatSatsCompact(e.amountIn ?? '0')} → ${tokenAmount(e.amountOut ?? '0', t)}`
                        : `${formatSatsCompact(e.deltaSats)}${BigInt(e.deltaTokens) !== 0n ? ` · ${tokenAmount(e.deltaTokens, t)}` : ''}`}
                    </span>
                    <a href={explorerTx(wallet.network, e.txid)} target="_blank" rel="noreferrer" className="font-mono text-zinc-500 hover:text-white text-right sm:order-5">{shortHex(e.txid)}</a>
                  </div>
                );
              })}
            </div>
            <Pager page={eventPages.page} pageCount={eventPages.pageCount} onPage={eventPages.setPage} />
          </>
        ))}
      </Panel>
    </div>
  );
}

export default MeshProviderDetailPage;
