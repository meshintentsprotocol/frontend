import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  TrendingUp,
  Activity,
  RotateCcw,
  Layers,
  Sparkles,
  Share2,
} from 'lucide-react';
import { type MeshPosition } from '@/hooks/useMeshServer';
import { tokenSymbol } from '@/lib/meshContracts';
import { notifyToast as toast } from '@/lib/notify-toast';

interface MeshPoolHeaderProps {
  position: MeshPosition;
  isRefreshing: boolean;
  onRefresh: () => void;
  isDrained: boolean;
}

const COVENANT_META: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string }
> = {
  StrategyCovenant: {
    label: 'Fixed Rate Strategy',
    icon: TrendingUp,
    color: 'text-emerald-400 border-emerald-500/30',
    bg: 'bg-emerald-500/10',
  },
  OracleStrategyCovenant: {
    label: 'Oracle Spot Curve',
    icon: Activity,
    color: 'text-teal-400 border-teal-500/30',
    bg: 'bg-teal-500/10',
  },
  DutchDecayStrategyCovenant: {
    label: 'Dutch Decay Auction',
    icon: RotateCcw,
    color: 'text-amber-400 border-amber-500/30',
    bg: 'bg-amber-500/10',
  },
  MultiPairRecyclingCovenant: {
    label: 'Mode 4 Multi-Market Mesh',
    icon: Layers,
    color: 'text-purple-400 border-purple-500/30',
    bg: 'bg-purple-500/10',
  },
};

export function MeshPoolHeader({
  position,
  isRefreshing,
  onRefresh,
  isDrained,
}: MeshPoolHeaderProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState<string | null>(null);

  const tokenOutName = tokenSymbol(position.tokenCategoryOut);
  const meta = COVENANT_META[position.contractType] || COVENANT_META.StrategyCovenant;
  const MetaIcon = meta.icon;
  const feePct = (position.feeBps / 100).toFixed(2);

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`Copied ${label} to clipboard`);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `BCH / ${tokenOutName} Pool on BCHMesh`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      copyText(window.location.href, 'Pool URL');
    }
  };

  return (
    <div className="space-y-4">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <button
          onClick={() => navigate('/mesh')}
          className="hover:text-white transition-colors flex items-center gap-1.5 font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Pools</span>
        </button>
        <span className="text-zinc-600">/</span>
        <span className="text-white font-medium">BCH / {tokenOutName}</span>
        <span className="text-zinc-600">/</span>
        <span className="text-zinc-400 font-mono text-[11px]">{feePct}% Tier</span>
      </div>

      {/* Main Header Card */}
      <div className="p-6 bg-gradient-to-r from-[#0C0C0F] via-[#111116] to-[#0C0C0F] border border-white/10 rounded-3xl backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
          {/* Token Info & Badges */}
          <div className="flex items-center gap-4">
            {/* Overlapping Token Avatars */}
            <div className="flex items-center -space-x-3.5 relative">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 border-2 border-[#0C0C0F] flex items-center justify-center text-emerald-400 font-black text-base shadow-xl z-10">
                ₿
              </div>
              <div className="w-12 h-12 rounded-full bg-teal-500/20 border-2 border-[#0C0C0F] flex items-center justify-center text-teal-400 font-black text-xs shadow-xl">
                {tokenOutName === 'pUSD' ? '$' : 'CT'}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  BCH / {tokenOutName}
                </h1>
                
                {/* Fee Tier Badge */}
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-white/[0.06] border border-white/10 text-zinc-300">
                  {feePct}%
                </span>

                {/* Covenant Strategy Archetype */}
                <span className={`px-3 py-0.5 rounded-full text-xs font-bold border ${meta.color} ${meta.bg} flex items-center gap-1.5 shadow-sm`}>
                  <MetaIcon className="w-3.5 h-3.5" />
                  <span>{meta.label}</span>
                </span>

                {/* Live Status Indicator */}
                {isDrained ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    <span>Drained</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Live on Chipnet</span>
                  </span>
                )}
              </div>

              {/* Covenant Address & Outpoint */}
              <div className="flex items-center gap-3 text-xs text-zinc-400 mt-2 flex-wrap font-mono">
                <div className="flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-lg border border-white/5">
                  <span className="text-zinc-500 font-sans">Covenant:</span>
                  <span className="text-zinc-300">{position.address.slice(0, 14)}…{position.address.slice(-6)}</span>
                  <button
                    onClick={() => copyText(position.address, 'Covenant Address')}
                    className="text-zinc-500 hover:text-white transition-colors"
                  >
                    {copied === 'Covenant Address' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-lg border border-white/5">
                  <span className="text-zinc-500 font-sans">UTXO:</span>
                  <span className="text-zinc-300">{position.txid.slice(0, 8)}…:{position.vout}</span>
                  <button
                    onClick={() => copyText(`${position.txid}:${position.vout}`, 'Outpoint')}
                    className="text-zinc-500 hover:text-white transition-colors"
                  >
                    {copied === 'Outpoint' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 w-full lg:w-auto justify-end">
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="px-3.5 py-2 bg-white/[0.04] hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white flex items-center gap-1.5 transition-all shadow-sm"
              title="Sync on-chain UTXO state"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-teal-400' : ''}`} />
              <span className="hidden sm:inline">Sync Chain</span>
            </button>

            <button
              onClick={handleShare}
              className="p-2 bg-white/[0.04] hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white transition-all shadow-sm"
              title="Share pool"
            >
              <Share2 className="w-4 h-4" />
            </button>

            <a
              href={`https://chipnet.chaingraph.cash/tx/${position.txid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 transition-all shadow-sm"
            >
              <span>Explorer</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
