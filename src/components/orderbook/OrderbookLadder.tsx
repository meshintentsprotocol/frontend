/**
 * Order book for one BCH/token pair, built from live StrategyCovenantV2 pools:
 *   asks = token-selling pools (trader buys tokens), cheapest first
 *   bids = BCH-selling pools (trader sells tokens), best first
 * Prices are what a trader gets after each pool's fee.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layers, Activity, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useMeshHealth, useMeshPairs, useMeshPools, useMeshStats } from '@/hooks/useMesh';
import { useTokenInfo, poolUrl } from '@/components/mesh/pools/shared';
import type { Pool } from '@/lib/mesh/meshApi';
import { traderTokenPerBch } from '@/lib/mesh/pool';
import { formatNumber, formatSatsCompact, formatUnits, shortHex } from '@/lib/mesh/format';

interface Row { pool: Pool; price: number; liquidity: string; depthPct: number }

export function OrderbookLadder() {
  const pairs = useMeshPairs();
  const health = useMeshHealth();
  const stats = useMeshStats();
  const [token, setToken] = useState<string | null>(null);
  const pools = useMeshPools({ pair: token ?? undefined, status: 'active' }, { enabled: !!token, refetchMs: 10_000 });
  const { get } = useTokenInfo((pairs.data?.pairs ?? []).map(p => p.tokenCategory));

  useEffect(() => {
    if (!token && pairs.data?.pairs.length) setToken(pairs.data.pairs[0]!.tokenCategory);
  }, [pairs.data, token]);

  const info = get(token ?? undefined);
  const { bids, asks } = useMemo(() => {
    const list = pools.data?.pools ?? [];
    const rows = (side: Pool['side']) => list.filter(p => p.side === side).map(p => ({
      pool: p,
      price: info.known ? traderTokenPerBch(p, info.decimals) : 0,
      liquidity: p.availableOut,
    }));
    const withDepth = (rs: Omit<Row, 'depthPct'>[], total: bigint) =>
      rs.map(r => ({ ...r, depthPct: total > 0n ? Number((BigInt(r.liquidity) * 100n) / total) : 0 }));
    // BCH priced in tokens: BCH-selling pools are asks (cheapest first),
    // token-selling pools are bids for BCH (highest first).
    const a = rows('SELL_BCH').sort((x, y) => x.price - y.price);
    const b = rows('SELL_TOKEN').sort((x, y) => y.price - x.price);
    const sum = (rs: typeof a) => rs.reduce((s, r) => s + BigInt(r.liquidity), 0n);
    return { bids: withDepth(b, sum(b)), asks: withDepth(a, sum(a)) };
  }, [pools.data, info.known, info.decimals]);

  const bestBid = bids[0]?.price;
  const bestAsk = asks[0]?.price;
  const spreadPct = bestBid && bestAsk ? ((bestAsk - bestBid) / bestBid) * 100 : null;

  return (
    <div className="w-full max-w-[1100px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0D0D0E]/80 backdrop-blur-xl border border-white/10 p-5 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400"><Layers className="w-6 h-6" /></div>
          <div>
            <h2 className="font-heading font-bold text-xl text-white">Order book — BCH / {token ? info.symbol : '…'}</h2>
            <div className="text-xs text-zinc-400 flex items-center gap-2 mt-0.5">
              <span>Live StrategyCovenantV2 pools; prices after each pool's fee</span>
              {health.data
                ? <span className="px-2 py-0.5 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {health.data.network} · {health.data.latencyMs}ms</span>
                : <span className="text-amber-400 text-[11px]">Mesh server offline</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center p-1 bg-white/[0.04] border border-white/10 rounded-xl">
            {(pairs.data?.pairs ?? []).map(p => (
              <button key={p.tokenCategory} onClick={() => setToken(p.tokenCategory)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${token === p.tokenCategory ? 'bg-emerald-500 text-black' : 'text-zinc-400 hover:text-white'}`}>
                BCH-{get(p.tokenCategory).symbol}
              </button>
            ))}
          </div>
          <button onClick={() => { void pools.refetch(); void pairs.refetch(); }} className="p-2 text-zinc-400 hover:text-white bg-white/5 rounded-xl border border-white/10" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${pools.isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="bg-[#0D0D0E]/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="grid grid-cols-4 px-6 py-3 bg-white/[0.02] border-b border-white/10 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          <span>{info.symbol} per BCH</span>
          <span className="text-right">Available</span>
          <span className="text-center">Pool</span>
          <span className="text-right">Depth</span>
        </div>
        {!token || (bids.length === 0 && asks.length === 0) ? (
          <div className="py-12 text-center text-xs text-zinc-500">{pairs.isLoading || pools.isLoading ? 'Loading…' : 'No active pools for this pair.'}</div>
        ) : (
          <>
            <Ladder rows={[...asks].reverse()} tone="red" label="asks" symbol={info.symbol} decimals={info.decimals} />
            <div className="px-6 py-3 bg-white/[0.04] border-y border-white/10 flex justify-between items-center text-xs font-bold font-mono">
              <div className="flex items-center gap-2 text-emerald-400"><Activity className="w-4 h-4" />
                SPREAD: {spreadPct === null ? '—' : `${spreadPct.toFixed(2)}%`}
              </div>
              <div className="text-zinc-400 font-sans font-normal">{(pools.data?.pools ?? []).length} active pools{stats.data?.bchUsd ? ` · BCH $${stats.data.bchUsd.toFixed(2)}` : ''}</div>
            </div>
            <Ladder rows={bids} tone="green" label="bids" symbol={info.symbol} decimals={info.decimals} />
          </>
        )}
      </div>
    </div>
  );
}

function Ladder({ rows, tone, label, symbol, decimals }: { rows: Row[]; tone: 'red' | 'green'; label: string; symbol: string; decimals: number }) {
  if (rows.length === 0) return <div className="px-6 py-4 text-xs text-zinc-600">No {label}</div>;
  return (
    <div className="divide-y divide-white/5 font-mono text-xs">
      {rows.map(r => (
        <Link key={r.pool.address} to={poolUrl(r.pool)} className="grid grid-cols-4 px-6 py-3.5 hover:bg-white/[0.04] transition-colors relative items-center">
          <div className={`absolute top-0 bottom-0 right-0 pointer-events-none ${tone === 'red' ? 'bg-red-500/10' : 'bg-emerald-500/10'}`} style={{ width: `${r.depthPct}%` }} />
          <span className={`font-bold relative z-10 ${tone === 'red' ? 'text-red-400' : 'text-emerald-400'}`}>{formatNumber(r.price, 4)}</span>
          <span className="text-right text-zinc-200 relative z-10">
            {r.pool.side === 'SELL_BCH' ? formatSatsCompact(r.liquidity) : `${formatUnits(r.liquidity, decimals)} ${symbol}`}
          </span>
          <span className="text-center text-zinc-400 relative z-10">{shortHex(r.pool.address, 6, 4)} · {(r.pool.feeBps / 100).toFixed(2)}%</span>
          <div className="flex justify-end items-center relative z-10">
            <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
              <div className={`h-full ${tone === 'red' ? 'bg-red-500/70' : 'bg-emerald-500/70'}`} style={{ width: `${r.depthPct}%` }} />
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
