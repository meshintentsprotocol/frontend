import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Pool, PoolEvent } from '@/lib/mesh/meshApi';
import { explorerTx, formatSatsCompact, formatUnits, shortHex, timeAgo } from '@/lib/mesh/format';
import type { BchNetwork } from '@/lib/mesh/signer';
import { EmptyState, poolUrl, tokenAmount, type TokenInfo } from './shared';

const TYPE_STYLE: Record<PoolEvent['type'], string> = {
  DEPOSIT: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  FILL: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  WITHDRAW: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
  REPRICE: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
  RECYCLE: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
};

/** What happened, in words, from the pool's point of view. */
function describe(e: PoolEvent, pool: Pick<Pool, 'side'>, token: TokenInfo): React.ReactNode {
  const sats = (v?: string) => formatSatsCompact(v ?? '0');
  const tok = (v?: string) => tokenAmount(v ?? '0', token);
  if (e.type === 'FILL') {
    return pool.side === 'SELL_BCH'
      ? <>Bought <b>{tok(e.amountIn)}</b> for <b>{sats(e.amountOut)}</b></>
      : <>Sold <b>{tok(e.amountOut)}</b> for <b>{sats(e.amountIn)}</b></>;
  }
  const parts = [BigInt(e.deltaSats) !== 0n ? sats(e.deltaSats.replace('-', '')) : null, BigInt(e.deltaTokens) !== 0n ? tok(e.deltaTokens.replace('-', '')) : null].filter(Boolean).join(' + ');
  if (e.type === 'DEPOSIT') return <>Deposited {parts}{e.predecessor && <> from <Link className="underline" to={poolUrl(e.predecessor)}>previous pool</Link></>}</>;
  if (e.type === 'REPRICE') return <>Moved to <Link className="underline" to={poolUrl(e.successor!)}>new pool</Link> ({parts})</>;
  return <>Withdrew {parts}</>;
}

export function PoolActivityTable({ pool, events, token, network, loading }: {
  pool: Pool; events: PoolEvent[]; token: TokenInfo; network: BchNetwork; loading?: boolean;
}) {
  if (!loading && events.length === 0) return <EmptyState icon={<Activity className="w-7 h-7" />} title="No activity yet" />;
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-xs min-w-[640px]">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wide text-zinc-500 border-b border-white/5">
            <th className="px-2 py-2 font-medium">When</th>
            <th className="px-2 py-2 font-medium">Type</th>
            <th className="px-2 py-2 font-medium">Details</th>
            <th className="px-2 py-2 font-medium">LP fee</th>
            <th className="px-2 py-2 font-medium">Balance after</th>
            <th className="px-2 py-2 font-medium">Tx</th>
          </tr>
        </thead>
        <tbody>
          {events.map(e => (
            <tr key={`${e.txid}-${e.type}`} className="border-b border-white/[0.04]">
              <td className="px-2 py-2.5 text-zinc-400 whitespace-nowrap" title={new Date(e.time * 1000).toLocaleString()}>
                {timeAgo(e.time)}{!e.confirmed && <span className="ml-1 text-amber-400">· pending</span>}
              </td>
              <td className="px-2 py-2.5"><span className={cn('px-2 py-0.5 rounded-full border text-[10px] font-semibold', TYPE_STYLE[e.type])}>{e.type}</span></td>
              <td className="px-2 py-2.5 text-zinc-300">
                {describe(e, pool, token)}
                {e.type === 'FILL' && (
                  <div className="text-[10px] text-zinc-500 mt-0.5">
                    {e.external ? 'external filler' : e.intentId ? `intent ${e.intentId.slice(0, 18)}` : 'Mesh solver'}
                    {e.makerPkh && <> · trader {e.makerPkh.slice(0, 8)}…</>}
                  </div>
                )}
              </td>
              <td className="px-2 py-2.5 font-mono text-emerald-400">
                {e.type === 'FILL' && e.lpEdge ? (pool.side === 'SELL_BCH' ? formatSatsCompact(e.lpEdge) : BigInt(e.lpEdge) > 0n ? tokenAmount(e.lpEdge, token) : '< 1 unit') : '—'}
              </td>
              <td className="px-2 py-2.5 font-mono text-zinc-400 whitespace-nowrap">
                {formatSatsCompact(e.balanceAfter.sats)}{BigInt(e.balanceAfter.tokens) > 0n && <> · {formatUnits(e.balanceAfter.tokens, token.decimals)} {token.symbol}</>}
              </td>
              <td className="px-2 py-2.5">
                <a href={explorerTx(network, e.txid)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-zinc-400 hover:text-white">
                  {shortHex(e.txid, 6, 4)}<ExternalLink className="w-3 h-3" />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Pool value over time (sats), from each event's balance-after, with tokens
 * valued at the pool's reference rate (market when available).
 */
export function PoolValueChart({ pool, events, token }: { pool: Pool; events: PoolEvent[]; token: TokenInfo }) {
  const rate = Number(pool.marketSatsPerToken) || 0;
  const data = useMemo(() => [...events].sort((a, b) => a.time - b.time).map(e => ({
    t: e.time * 1000,
    value: Number(e.balanceAfter.sats) + Number(e.balanceAfter.tokens) * rate,
    sats: Number(e.balanceAfter.sats),
    tokens: Number(e.balanceAfter.tokens),
    type: e.type,
  })), [events, rate]);
  if (data.length < 2) {
    return <div className="h-56 flex items-center justify-center text-xs text-zinc-500">The chart appears after the pool's second event.</div>;
  }
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="poolValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} scale="time" tick={{ fill: '#71717a', fontSize: 10 }}
            tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit' })} />
          <YAxis tick={{ fill: '#71717a', fontSize: 10 }} width={64} tickFormatter={(v) => formatSatsCompact(Math.round(v))} />
          <Tooltip
            contentStyle={{ background: '#0c0c10', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11 }}
            labelFormatter={(v) => new Date(v as number).toLocaleString()}
            formatter={(_v, _n, item: any) => {
              const d = item.payload;
              return [`${formatSatsCompact(Math.round(d.value))} (${formatSatsCompact(d.sats)} + ${formatUnits(BigInt(d.tokens), token.decimals)} ${token.symbol})`, d.type];
            }}
          />
          <Area type="stepAfter" dataKey="value" stroke="#34d399" strokeWidth={2} fill="url(#poolValue)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
