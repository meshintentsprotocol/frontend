/**
 * Mobile Position Card (MeshDocs/meshv3v4flow/04 §4, canvas C1).
 * Stacked card representation for mobile screens (< 1024px).
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TokenAvatar, useTokenInfo } from '@/components/mesh/pools/shared';
import { EngineBadge } from '@/components/mesh/kit';
import { RangeBar } from './RangeBar';
import { coverageBadge } from '@/lib/mesh/positions/coverage';
import { formatNumber, formatSatsCompact, formatUnits, formatUsd, shortHex } from '@/lib/mesh/format';
import type { PositionRow as PositionRowModel } from '@/lib/mesh/positions/viewModel';

export function PositionCard({ row }: { row: PositionRowModel }) {
  const [expanded, setExpanded] = useState(false);
  const badge = coverageBadge(row.status);
  const { get: tokenInfo } = useTokenInfo([row.tokenCat]);

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c10] p-4 space-y-3">
      {/* Header: Pair, Engine & Status */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex -space-x-1.5" aria-hidden>
            <TokenAvatar info="BCH" size={28} />
            <TokenAvatar info={tokenInfo(row.tokenCat)} size={28} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <Link to={row.url} className="font-heading text-sm font-semibold text-white">
                {row.pairLabel}
              </Link>
              <EngineBadge engine={row.engine} />
            </div>
            <div className="text-[11px] text-zinc-500 font-mono">
              {row.strategyName} · {shortHex(row.id, 6, 4)}
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold border',
            badge.tone === 'emerald' && 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
            badge.tone === 'amber' && 'bg-amber-500/10 text-amber-300 border-amber-500/20',
            badge.tone === 'zinc' && 'bg-zinc-800 text-zinc-400 border-zinc-700',
          )}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              badge.tone === 'emerald' && 'bg-emerald-400',
              badge.tone === 'amber' && 'bg-amber-400',
              badge.tone === 'zinc' && 'bg-zinc-500',
            )}
            aria-hidden
          />
          {badge.label}
        </span>
      </div>

      {/* Metrics: Value & Fees */}
      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/[0.04]">
        <div>
          <div className="text-[10px] text-zinc-500 font-medium">Position Value</div>
          <div className="font-mono text-sm font-bold text-white">
            {formatSatsCompact(row.valueSats)}
          </div>
          <div className="text-[10px] text-zinc-400">
            {row.valueUsd !== null ? formatUsd(row.valueUsd) : '—'}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-zinc-500 font-medium">Fees (7d)</div>
          <div className="font-mono text-sm font-bold text-emerald-400">
            {formatSatsCompact(row.fees7dSats)}
          </div>
          <div className="text-[10px] text-zinc-400">
            {row.fees7dUsd !== null ? formatUsd(row.fees7dUsd) : '—'}
          </div>
        </div>
      </div>

      {/* Range Bar */}
      <div>
        <div className="text-[10px] text-zinc-500 font-medium mb-1">Range & Market</div>
        <RangeBar
          minPrice={row.minPrice}
          maxPrice={row.maxPrice}
          marketPrice={row.marketPrice}
          symbol={row.tokenSymbol}
          className="max-w-none w-full"
        />
      </div>

      {/* Expanded Breakdown */}
      {row.children.length > 0 && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition"
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            <span>{row.poolsCount} {row.engine === 'v4' ? 'bins' : 'pools'} breakdown</span>
          </button>

          {expanded && (
            <div className="mt-2 space-y-1.5 pl-2 border-l border-white/[0.08]">
              {row.children.map(child => (
                <div key={child.id} className="flex items-center justify-between text-xs py-1">
                  <span className="text-zinc-300">{child.name}</span>
                                    <span className="font-mono text-right">
                    {child.sats > 0n && <span className="block text-emerald-400">{formatSatsCompact(child.sats)}</span>}
                    {child.tokens !== undefined && child.tokens > 0n && <span className="block text-sky-300">{formatUnits(child.tokens, child.tokenDecimals ?? 0)} {child.tokenSymbol}</span>}
                    {child.sats === 0n && !child.tokens && <span className="text-zinc-500">-</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Manage Action */}
      <div className="pt-2">
        <Link
          to={row.url}
          className="flex items-center justify-center gap-1.5 w-full rounded-xl bg-white/[0.04] hover:bg-white/[0.08] py-2 text-xs font-semibold text-emerald-400 transition"
        >
          Manage Position <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

