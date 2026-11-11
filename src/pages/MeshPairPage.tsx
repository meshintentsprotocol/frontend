/**
 * /mesh/pair/:token — Dedicated Pair Page (MeshDocs/meshv3v4flow/09 §3.4, canvas E2).
 * Shows pair market prices (both ways), 24h/7d volume and TVL, liquidity depth chart,
 * recent pool activity, and "Provide liquidity" entry point.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Loader2, PlusCircle, TrendingUp, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMarketRef, useMeshPairs, usePairDepth, useRecentPoolFills, useMeshStats } from '@/hooks/useMesh';
import { TokenAvatar, useTokenInfo } from '@/components/mesh/pools/shared';
import { DepthChart } from '@/components/mesh/pools/DepthChart';
import { meshPaths, tokenParam } from '@/lib/mesh/routes';
import { formatNumber, formatSatsCompact, formatUsd, satsToUsd, shortHex, timeAgo } from '@/lib/mesh/format';
import { tokenPerBchFromSatsPerUnit } from '@/lib/mesh/pool';
import { bchPerToken, formatPrice } from '@/lib/mesh/create/price';
import { explorerTx } from '@/lib/mesh/format';
import { useNetwork } from '@/components/mesh/create/usePairInfo';

export function MeshPairPage() {
  const { token: rawToken } = useParams<{ token: string }>();
  const token = tokenParam(rawToken) ?? '';
  const navigate = useNavigate();
  const network = useNetwork();
  const stats = useMeshStats();
  const bchUsd = stats.data?.bchUsd ?? null;

  const [tab, setTab] = useState<'depth' | 'activity'>('depth');

  const { get: getToken } = useTokenInfo([token]);
  const info = getToken(token);

  const pairsQ = useMeshPairs();
  const depthQ = usePairDepth(token);
  const fillsQ = useRecentPoolFills(50);
  const marketQ = useMarketRef(token);

  const pairData = useMemo(() => {
    return (pairsQ.data?.pairs ?? []).find(p => p.tokenCategory.toLowerCase() === token.toLowerCase());
  }, [pairsQ.data, token]);

  const marketTpb = marketQ.data?.cauldron
    ? Number(tokenPerBchFromSatsPerUnit(marketQ.data.cauldron.satsPerToken, info.decimals))
    : pairData?.bestBidSatsPerToken
      ? Number(tokenPerBchFromSatsPerUnit(pairData.bestBidSatsPerToken, info.decimals))
      : null;

  const pairFills = useMemo(() => {
    return (fillsQ.data?.activity ?? []).filter(
      e => (e as any).tokenCategory?.toLowerCase() === token.toLowerCase() || (e as any).details?.token === token,
    );
  }, [fillsQ.data, token]);

  if (!token) {
    return (
      <div className="container mx-auto py-12 max-w-[1200px] text-center">
        <h2 className="text-xl font-bold text-white">Invalid token category</h2>
        <Link to={meshPaths.pools()} className="mt-4 inline-flex items-center gap-2 text-xs text-emerald-400">
          <ArrowLeft className="h-4 w-4" /> Back to Pools
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-4 sm:py-6 px-4 md:px-8 max-w-[1200px] space-y-6">
      {/* Back button */}
      <div>
        <Link
          to={meshPaths.pools()}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white transition"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Pools & Pairs
        </Link>
      </div>

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div className="flex items-center gap-3">
          <span className="flex -space-x-2" aria-hidden>
            <TokenAvatar info="BCH" size={40} />
            <TokenAvatar info={info} size={40} />
          </span>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              BCH / {info.symbol}
            </h1>
            <div className="flex items-center gap-2 text-xs text-zinc-400 mt-1">
              <span className="font-mono text-zinc-500">{shortHex(token, 8, 6)}</span>
              {marketTpb && (
                <>
                  <span>·</span>
                  <span className="font-mono text-emerald-400">1 BCH = {formatPrice(marketTpb)} {info.symbol}</span>
                  <span className="text-zinc-500">({formatPrice(bchPerToken(marketTpb))} BCH / {info.symbol})</span>
                </>
              )}
            </div>
          </div>
        </div>

        <Button
          onClick={() => navigate(meshPaths.create('range', { token, step: 2 }))}
          className="rounded-xl font-bold bg-emerald-500 hover:bg-emerald-400 text-black shrink-0"
        >
          <PlusCircle className="w-4 h-4 mr-1.5" /> Provide liquidity
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl border border-white/[0.08] bg-white/[0.02]">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Total Value Locked</div>
          <div className="mt-1 font-mono text-xl font-bold text-white">
            {pairData ? formatSatsCompact(pairData.tvlSats) : '—'}
          </div>
          <div className="mt-0.5 text-xs text-zinc-400">
            {pairData && bchUsd ? formatUsd(satsToUsd(pairData.tvlSats, bchUsd)) : '—'}
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-white/[0.08] bg-white/[0.02]">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Volume (24h)</div>
          <div className="mt-1 font-mono text-xl font-bold text-white">
            {pairData ? formatSatsCompact(pairData.volume24hSats) : '—'}
          </div>
          <div className="mt-0.5 text-xs text-zinc-400">
            {pairData && bchUsd ? formatUsd(satsToUsd(pairData.volume24hSats, bchUsd)) : '—'}
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-white/[0.08] bg-white/[0.02]">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Volume (7d)</div>
          <div className="mt-1 font-mono text-xl font-bold text-emerald-400">
            {pairData ? formatSatsCompact(pairData.volume7dSats) : '—'}
          </div>
          <div className="mt-0.5 text-xs text-zinc-400">
            {pairData ? `${pairData.fillCount7d} fills this week` : '—'}
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-white/[0.08] bg-white/[0.02]">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Active Pools</div>
          <div className="mt-1 font-mono text-xl font-bold text-white">
            {pairData ? `${pairData.poolCount} pools` : '—'}
          </div>
          <div className="mt-0.5 text-xs text-zinc-400">
            {pairData?.lpsCount ?? 1} liquidity providers
          </div>
        </div>
      </div>

      {/* Tabs: Liquidity Depth vs Activity */}
      <div className="rounded-3xl border border-white/[0.08] bg-[#0c0c10] p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3">
          <button
            type="button"
            onClick={() => setTab('depth')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              tab === 'depth' ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Market Depth & Bins
          </button>
          <button
            type="button"
            onClick={() => setTab('activity')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              tab === 'activity' ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Recent Fills ({pairFills.length})
          </button>
        </div>

        {tab === 'depth' && (
          <div className="space-y-4">
            <div className="text-xs text-zinc-400">
              Aggregated liquidity across discrete bins and V3 covenants for <span className="text-white font-medium">BCH / {info.symbol}</span>.
            </div>
            {depthQ.isLoading ? (
              <div className="py-20 text-center text-xs text-zinc-500">
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-emerald-400" />
                Loading market depth…
              </div>
            ) : depthQ.data ? (
              <DepthChart depth={depthQ.data} symbol={info.symbol} decimals={info.decimals} />
            ) : (
              <div className="py-12 text-center text-xs text-zinc-500">
                No depth data available for this pair.
              </div>
            )}
          </div>
        )}

        {tab === 'activity' && (
          <div className="space-y-3">
            {pairFills.length === 0 ? (
              <div className="py-12 text-center text-xs text-zinc-500">
                No recent fills recorded on this pair.
              </div>
            ) : (
              <div className="space-y-2">
                {pairFills.map((f: any, idx: number) => (
                  <div
                    key={`${f.txid ?? idx}`}
                    className="flex items-center justify-between p-3 rounded-2xl border border-white/[0.04] bg-white/[0.02] text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-semibold">Fill</span>
                      <span className="font-mono text-zinc-400">{shortHex(f.txid, 6, 4)}</span>
                      <a
                        href={explorerTx(network, f.txid)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-zinc-500 hover:text-zinc-300"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <div className="text-right font-mono text-xs text-zinc-300">
                      {f.time ? timeAgo(f.time) : 'Recent'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default MeshPairPage;
