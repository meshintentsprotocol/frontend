import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight, ExternalLink, Layers, Link2, ShieldCheck } from 'lucide-react';
import { MeshPositionStateBadge } from '@/components/mesh/MeshPositionStateBadge';

export interface MeshPoolBundleCardProps {
  bundleId?: string;
  pairRole?: 'FORWARD' | 'REVERSE' | 'STANDALONE';
  reverseAddress?: string;
  pairName?: string;
  symbolIn?: string;
  symbolOut?: string;
  className?: string;
}

export const MeshPoolBundleCard: React.FC<MeshPoolBundleCardProps> = ({
  bundleId,
  pairRole = 'STANDALONE',
  reverseAddress,
  pairName,
  symbolIn = 'BCH',
  symbolOut = 'pUSD',
  className = '',
}) => {
  if (!bundleId && (!reverseAddress || reverseAddress === '0x' + '00'.repeat(32))) {
    return null;
  }

  const isForward = pairRole === 'FORWARD';
  const roleLabel = isForward ? 'Forward Leg' : pairRole === 'REVERSE' ? 'Reverse Leg' : 'Paired Loop';
  const roleBadgeColor = isForward
    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    : 'bg-blue-500/10 text-blue-400 border-blue-500/20';

  return (
    <div
      className={`p-5 rounded-2xl bg-[#0c0c10]/90 border border-white/10 backdrop-blur-xl relative overflow-hidden space-y-3 shadow-xl ${className}`}
    >
      <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-cyan-500/5 to-purple-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Mesh Multi-Leg Bundle
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono font-semibold ${roleBadgeColor}`}>
                {roleLabel}
              </span>
            </div>
            {bundleId && (
              <p className="text-[10px] text-zinc-400 font-mono">
                Bundle ID: <span className="text-zinc-300">{bundleId.slice(0, 10)}…{bundleId.slice(-6)}</span>
              </p>
            )}
          </div>
        </div>

        <MeshPositionStateBadge state="LINKED" size="sm" />
      </div>

      {/* Loop Visualization */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-xs">
        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">This Strategy</div>
          <div className="flex items-center gap-1.5 text-white font-semibold">
            <span className="text-emerald-400">{symbolIn}</span>
            <span className="text-zinc-600">→</span>
            <span className="text-cyan-400">{symbolOut}</span>
          </div>
          <div className="text-[10px] text-zinc-400">Role: {pairRole}</div>
        </div>

        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Linked Complement</div>
          <div className="flex items-center gap-1.5 text-white font-semibold">
            <span className="text-cyan-400">{symbolOut}</span>
            <span className="text-zinc-600">→</span>
            <span className="text-emerald-400">{symbolIn}</span>
          </div>
          <div className="text-[10px] text-zinc-400">
            {reverseAddress && reverseAddress !== '0x' + '00'.repeat(32) ? (
              <span className="truncate block max-w-[180px]" title={reverseAddress}>
                {reverseAddress.slice(0, 12)}…{reverseAddress.slice(-6)}
              </span>
            ) : (
              'Auto-recycling route'
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
