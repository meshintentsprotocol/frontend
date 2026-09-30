import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers } from 'lucide-react';
import type { Pool } from '@/lib/mesh/meshApi';
import { traderTokenPerBch } from '@/lib/mesh/pool';
import { formatNumber, formatPct, formatSatsCompact } from '@/lib/mesh/format';
import {
  EmptyState, PoolPairLabel, PoolStatusBadge, SatsValue, poolUrl, tokenAmount, useTokenInfo, type TokenInfo,
} from './shared';

/** What the pool holds: its reserve and what it has received so far. */
export function PoolReserves({ pool, token }: { pool: Pool; token: TokenInfo }) {
  const sellBch = pool.side === 'SELL_BCH';
  const reserve = sellBch ? formatSatsCompact(pool.reserves.sats) : tokenAmount(pool.reserves.tokens, token, 2);
  const received = sellBch
    ? BigInt(pool.reserves.tokens) > 0n ? `+ ${tokenAmount(pool.reserves.tokens, token, 2)} received` : null
    : BigInt(pool.reserves.sats) > 1000n ? `+ ${formatSatsCompact(BigInt(pool.reserves.sats) - 1000n)} received` : null;
  return (
    <div className="font-mono">
      <div className="text-zinc-200">{reserve}</div>
      {received && <div className="text-[11px] text-zinc-500">{received}</div>}
    </div>
  );
}

/** Trader-facing price after the pool fee, as "1 BCH = X TOKEN". */
export function PoolPrice({ pool, token }: { pool: Pool; token: TokenInfo }) {
  if (!token.known) return <span className="text-zinc-500 text-xs">—</span>;
  const p = traderTokenPerBch(pool, token.decimals);
  return (
    <div className="font-mono">
      <div className="text-zinc-200">{formatNumber(p, 4)}</div>
      <div className="text-[11px] text-zinc-500">{token.symbol} per BCH</div>
    </div>
  );
}

export function PoolsTable({ pools, bchUsd, loading, empty, showOwner = false }: {
  pools: Pool[]; bchUsd?: number | null; loading?: boolean; empty?: React.ReactNode; showOwner?: boolean;
}) {
  const navigate = useNavigate();
  const { get } = useTokenInfo(pools.map(p => p.tokenCategory));
  if (!loading && pools.length === 0) {
    return <>{empty ?? <EmptyState icon={<Layers className="w-8 h-8" />} title="No pools" />}</>;
  }
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm min-w-[860px]">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500 border-b border-white/5">
            <th className="px-2 py-3 font-medium">Pool</th>
            <th className="px-2 py-3 font-medium">Trader price</th>
            <th className="px-2 py-3 font-medium">Fee</th>
            <th className="px-2 py-3 font-medium">Reserves</th>
            <th className="px-2 py-3 font-medium">Value</th>
            <th className="px-2 py-3 font-medium">Volume 7d</th>
            <th className="px-2 py-3 font-medium">Fees 7d</th>
            <th className="px-2 py-3 font-medium" title="Fees of the last 7 days, annualised, over the current value. An estimate, not a promise.">Fee APR (est.)</th>
            <th className="px-2 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {pools.map(pool => {
            const token = get(pool.tokenCategory);
            return (
              <tr key={pool.address} onClick={() => navigate(poolUrl(pool))}
                className="border-b border-white/[0.04] hover:bg-white/[0.03] cursor-pointer transition-colors">
                <td className="px-2 py-3">
                  <PoolPairLabel token={token} side={pool.side} />
                  {showOwner && <div className="text-[10px] text-zinc-600 font-mono mt-0.5">LP {pool.ownerAddress.split(':')[1]?.slice(0, 10)}…</div>}
                </td>
                <td className="px-2 py-3"><PoolPrice pool={pool} token={token} /></td>
                <td className="px-2 py-3 font-mono text-zinc-300">{(pool.feeBps / 100).toFixed(2)}%</td>
                <td className="px-2 py-3"><PoolReserves pool={pool} token={token} /></td>
                <td className="px-2 py-3"><SatsValue sats={pool.valueSats} bchUsd={bchUsd} className="text-zinc-200" /></td>
                <td className="px-2 py-3 font-mono text-zinc-300">{formatSatsCompact(pool.stats.volume7dSats)}</td>
                <td className="px-2 py-3 font-mono text-emerald-400">{formatSatsCompact(pool.stats.fees7dSats)}</td>
                <td className="px-2 py-3 font-mono text-zinc-300">{formatPct(pool.stats.feeApr7dPct)}</td>
                <td className="px-2 py-3"><PoolStatusBadge status={pool.status} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {loading && pools.length === 0 && <div className="py-10 text-center text-xs text-zinc-500">Loading pools…</div>}
    </div>
  );
}
