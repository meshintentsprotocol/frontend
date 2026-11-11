/**
 * Position Row for desktop table (MeshDocs/meshv3v4flow/04 §4, canvas C1).
 * Expandable row showing pair, strategy, value, range bar, status, and quick manage link.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TokenAvatar } from '@/components/mesh/pools/shared';
import { EngineBadge } from '@/components/mesh/kit';
import { RangeBar } from './RangeBar';
import { coverageBadge } from '@/lib/mesh/positions/coverage';
import { formatNumber, formatSatsCompact, formatUnits, formatUsd, shortHex } from '@/lib/mesh/format';
import type { PositionRow as PositionRowModel } from '@/lib/mesh/positions/viewModel';

export function PositionRow({ row }: { row: PositionRowModel }) {
  const [expanded, setExpanded] = useState(false);
  const badge = coverageBadge(row.status);

  return (
    <>
      <tr className="border-b border-white/[0.06] hover:bg-white/[0.02] transition-colors group">
        {/* Expand Toggle & Pair */}
        <td className="py-4 pl-4 pr-3">
          <div className="flex items-center gap-3">
            {row.children.length > 0 ? (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                aria-label={expanded ? 'Collapse position' : 'Expand position'}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition"
              >
                {expanded ? (
                  <ChevronDown className="h-4 w-4" aria-hidden />
                ) : (
                  <ChevronRight className="h-4 w-4" aria-hidden />
                )}
              </button>
            ) : (
              <span className="w-6" />
            )}
            <div className="flex items-center gap-2.5">
              <span className="flex -space-x-1.5" aria-hidden>
                <TokenAvatar info="BCH" size={24} />
                <TokenAvatar info={row.tokenSymbol} size={24} />
              </span>
              <div>
                <Link
                  to={row.url}
                  className="font-heading text-sm font-semibold text-white group-hover:text-emerald-400 transition"
                >
                  {row.pairLabel}
                </Link>
                <div className="text-[11px] text-zinc-500 font-mono">
                  {shortHex(row.id, 6, 4)}
                </div>
              </div>
            </div>
          </div>
        </td>

        {/* Strategy & Engine */}
        <td className="py-4 px-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-200">{row.strategyName}</span>
            <EngineBadge engine={row.engine} />
          </div>
          <div className="text-[11px] text-zinc-500">
            {row.poolsCount} {row.engine === 'v4' ? 'bins' : 'pools'}
          </div>
        </td>

        {/* Value */}
        <td className="py-4 px-3">
          <div className="font-mono text-sm font-semibold text-white">
            {formatSatsCompact(row.valueSats)}
          </div>
          <div className="text-[11px] text-zinc-400">
            {row.valueUsd !== null ? formatUsd(row.valueUsd) : '—'}
          </div>
        </td>

        {/* Fees 7d */}
        <td className="py-4 px-3">
          <div className="font-mono text-sm font-semibold text-emerald-400">
            {formatSatsCompact(row.fees7dSats)}
          </div>
          <div className="text-[11px] text-zinc-500">
            {row.fees7dUsd !== null ? formatUsd(row.fees7dUsd) : '—'}
          </div>
        </td>

        {/* Range Bar */}
        <td className="py-4 px-3">
          <RangeBar
            minPrice={row.minPrice}
            maxPrice={row.maxPrice}
            marketPrice={row.marketPrice}
            symbol={row.tokenSymbol}
          />
        </td>

        {/* Status */}
        <td className="py-4 px-3">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold border',
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
        </td>

        {/* Manage Action */}
        <td className="py-4 pl-3 pr-4 text-right">
          <Link
            to={row.url}
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition"
          >
            Manage <ExternalLink className="h-3 w-3" aria-hidden />
          </Link>
        </td>
      </tr>

      {/* Expanded Children Rows */}
      {expanded && row.children.length > 0 && (
        <tr className="bg-black/40 border-b border-white/[0.06]">
          <td colSpan={7} className="py-3 px-6">
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                {row.engine === 'v4' ? 'Active Discrete Bins' : 'Member Covenant Pools'}
              </div>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {row.children.map(child => (
                  <div
                    key={child.id}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-white/[0.04] bg-white/[0.02]"
                  >
                    <div>
                      <div className="text-xs font-medium text-white">{child.name}</div>
                      <div className="text-[10px] text-zinc-400">
                        {child.role && <span className="mr-2 text-zinc-500">{child.role}</span>}
                        {child.priceText && <span>{child.priceText}</span>}
                      </div>
                    </div>
                    <div className="text-right font-mono text-xs">
                      {child.sats > 0n && (
                        <div className="text-emerald-400">{formatSatsCompact(child.sats)}</div>
                      )}
                      {child.tokens && child.tokens > 0n && (
                        <div className="text-sky-300">
                          {formatNumber(Number(child.tokens), 0)} {child.tokenSymbol}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
