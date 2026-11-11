/**
 * Unified Position Shell (MeshDocs/meshv3v4flow/09 §3.3, canvas D1).
 * Standard detail layout for V4 positions, V3 strategies, and standalone pools.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Gem, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TokenAvatar, type TokenInfo } from '@/components/mesh/pools/shared';
import { EngineBadge } from '@/components/mesh/kit';
import { coverageBadge, type CoverageStatus } from '@/lib/mesh/positions/coverage';
import { formatSatsCompact, formatUsd, shortHex } from '@/lib/mesh/format';
import { meshPaths } from '@/lib/mesh/routes';
import { ManagePanel, type ManageActions, type ManageCapabilities } from './ManagePanel';

export interface PositionShellProps {
  id: string;
  engine: 'v4' | 'v3';
  pairLabel: string;
  tokenInfo: TokenInfo | string;
  strategyName: string;
  status: CoverageStatus;
  isOwner: boolean;
  valueSats: bigint;
  valueUsd?: number | null;
  feesSats?: bigint;
  feesUsd?: number | null;
  activeUnitsCount: number;
  totalUnitsCount: number;
  capabilities?: ManageCapabilities;
  actions?: ManageActions;
  children: ReactNode;
}

export function PositionShell({
  id,
  engine,
  pairLabel,
  tokenInfo,
  strategyName,
  status,
  isOwner,
  valueSats,
  valueUsd,
  feesSats = 0n,
  feesUsd,
  activeUnitsCount,
  totalUnitsCount,
  capabilities,
  actions,
  children,
}: PositionShellProps) {
  const badge = coverageBadge(status);
  const unitName = engine === 'v4' ? 'bins' : 'pools';

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          to={meshPaths.positions()}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white transition"
        >
          <ArrowLeft className="h-4 w-4" /> Back to My positions
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div className="flex items-center gap-3">
          <span className="flex -space-x-2" aria-hidden>
            <TokenAvatar info="BCH" size={36} />
            <TokenAvatar info={tokenInfo} size={36} />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">{pairLabel}</h1>
              <EngineBadge engine={engine} />
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border',
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
            <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400">
              <span>{strategyName}</span>
              <span>·</span>
              <span className="font-mono text-zinc-500">{shortHex(id, 8, 6)}</span>
              {engine === 'v4' && (
                <span className="inline-flex items-center gap-1 text-[11px] text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
                  <Gem className="h-3 w-3" /> NFT Custody
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Key Numbers Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl border border-white/[0.08] bg-white/[0.02]">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Position Value</div>
          <div className="mt-1 font-mono text-xl font-bold text-white">{formatSatsCompact(valueSats)}</div>
          <div className="mt-0.5 text-xs text-zinc-400">{valueUsd !== null && valueUsd !== undefined ? formatUsd(valueUsd) : '—'}</div>
        </div>

        <div className="p-4 rounded-2xl border border-white/[0.08] bg-white/[0.02]">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Fees Earned</div>
          <div className="mt-1 font-mono text-xl font-bold text-emerald-400">{formatSatsCompact(feesSats)}</div>
          <div className="mt-0.5 text-xs text-zinc-400">{feesUsd !== null && feesUsd !== undefined ? formatUsd(feesUsd) : '—'}</div>
        </div>

        <div className="p-4 rounded-2xl border border-white/[0.08] bg-white/[0.02]">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Active Units</div>
          <div className="mt-1 font-mono text-xl font-bold text-white">
            {activeUnitsCount} / {totalUnitsCount}
          </div>
          <div className="mt-0.5 text-xs text-zinc-400">
            {engine === 'v4' ? 'Funded discrete bins' : 'Active covenant pools'}
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-white/[0.08] bg-white/[0.02]">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Custody</div>
          <div className="mt-1 font-sans text-sm font-semibold text-white">
            {engine === 'v4' ? 'CashToken NFT' : 'Smart Covenant'}
          </div>
          <div className="mt-0.5 text-xs text-zinc-400">
            {isOwner ? 'Controlled by this wallet' : 'View only'}
          </div>
        </div>
      </div>

      {/* Main Grid: Content + Manage Panel */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {children}
        </div>
        <div>
          <ManagePanel
            engine={engine}
            isOwner={isOwner}
            capabilities={capabilities}
            actions={actions}
            className="sticky top-20"
          />
        </div>
      </div>
    </div>
  );
}

