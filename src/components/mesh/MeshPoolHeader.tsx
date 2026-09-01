import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
  Plus,
  ArrowLeftRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { type MeshPosition } from '@/hooks/useMeshServer';
import { tokenSymbol, getTokenMetadata } from '@/lib/meshContracts';
import { notifyToast as toast } from '@/lib/notify-toast';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MeshPoolHeaderProps {
  position: MeshPosition;
  isRefreshing: boolean;
  onRefresh: () => void;
  isDrained: boolean;
  onOpenAddLiquidity?: () => void;
}

const COVENANT_META: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string }
> = {
  StrategyCovenant: {
    label: 'Fixed Rate',
    icon: TrendingUp,
    color: 'text-emerald-400 border-emerald-500/30',
    bg: 'bg-emerald-500/10',
  },
  OracleStrategyCovenant: {
    label: 'Oracle Spot',
    icon: Activity,
    color: 'text-teal-400 border-teal-500/30',
    bg: 'bg-teal-500/10',
  },
  DutchDecayStrategyCovenant: {
    label: 'Dutch Decay',
    icon: RotateCcw,
    color: 'text-amber-400 border-amber-500/30',
    bg: 'bg-amber-500/10',
  },
  MultiPairRecyclingCovenant: {
    label: 'Mode 4 Mesh',
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
  onOpenAddLiquidity,
}: MeshPoolHeaderProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState<string | null>(null);

  const tokenOutName = tokenSymbol(position.tokenCategoryOut);
  const baseMeta = getTokenMetadata('BCH');
  const quoteMeta = getTokenMetadata(tokenOutName);

  const meta = COVENANT_META[position.contractType] || COVENANT_META.StrategyCovenant!;
  const MetaIcon = meta.icon;
  const feePct = (position.feeBps / 100).toFixed(2);
  const addressShort = `${position.address.slice(0, 6)}...${position.address.slice(-4)}`;

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
      {/* ─── Breadcrumb Navigation (Matching Uniswap) ─── */}
      <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400">
        <Link
          to="/mesh"
          className="hover:text-white transition-colors flex items-center gap-1.5"
        >
          <span>Pools</span>
        </Link>
        <span className="text-zinc-600">›</span>
        <span className="text-white font-bold">
          BCH / {tokenOutName}
        </span>
      </div>

      {/* ─── Main Uniswap Title Row & Action Buttons ─── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        {/* Left Side: Overlapping Token Circles & Badges */}
        <div className="space-y-3">
          <div className="flex items-center gap-3.5">
            {/* Overlapping Token Circles */}
            <div className="flex -space-x-2 relative shrink-0">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 border-2 border-[#050505] flex items-center justify-center shadow-lg overflow-hidden z-[2]">
                <img
                  src={baseMeta.icon || '/logos/bitcoin-cash-bch-logo.svg'}
                  alt="BCH"
                  className="w-7 h-7 object-contain"
                />
              </div>
              <div className="w-10 h-10 rounded-full bg-cyan-500/20 border-2 border-[#050505] flex items-center justify-center font-mono font-black text-sm text-cyan-300 shadow-lg z-[1]">
                {tokenOutName.slice(0, 3)}
              </div>
            </div>

            {/* Pair Name & Swap Direction Icon */}
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                BCH /{tokenOutName}
              </h1>
              <button
                onClick={() => navigate(`/trade?from=BCH&to=${tokenOutName}`)}
                className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
                title="Swap tokens"
              >
                <ArrowLeftRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Badges Strip (Matching Uniswap: Network, Strategy, Fee, Address) */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            {/* Network Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/5 text-zinc-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Bitcoin Cash Chipnet</span>
            </div>

            {/* Strategy Pill */}
            <div
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-semibold',
                meta.color,
                meta.bg
              )}
            >
              <MetaIcon className="w-3.5 h-3.5" />
              <span>{meta.label}</span>
            </div>

            {/* Fee Tier Badge */}
            <div className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/5 text-zinc-300 font-semibold">
              {feePct}%
            </div>

            {/* P2SH32 Address Chip with Copy & Explorer */}
            <div className="flex items-center gap-1 bg-white/[0.04] border border-white/5 rounded-lg px-2 py-0.5">
              <span className="text-zinc-400 text-[11px]">{addressShort}</span>
              <button
                onClick={() => copyText(position.address, 'Covenant Address')}
                className="p-1 hover:text-white text-zinc-500 transition-colors"
                title="Copy Address"
              >
                {copied === 'Covenant Address' ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: CTAs matching Uniswap Screenshot (Swap & Add Liquidity) */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Refresh button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 text-zinc-400 hover:text-white transition-all disabled:opacity-50"
            title="Refresh pool metrics"
          >
            <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
          </button>

          {/* Share button */}
          <button
            onClick={handleShare}
            className="p-2.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 text-zinc-400 hover:text-white transition-all"
            title="Share pool"
          >
            <Share2 className="w-4 h-4" />
          </button>

          {/* Swap Button (Matching Uniswap style) */}
          <Button
            onClick={() => navigate(`/trade?from=BCH&to=${tokenOutName}`)}
            className="h-11 px-6 rounded-2xl bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-indigo-500/20 hover:from-pink-500/30 hover:to-indigo-500/30 border border-pink-500/30 text-pink-300 hover:text-white font-bold text-sm flex items-center gap-2 shadow-lg transition-all"
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span>Swap</span>
          </Button>

          {/* Add Liquidity Button */}
          <Button
            onClick={onOpenAddLiquidity}
            className="h-11 px-6 rounded-2xl bg-emerald-400 hover:bg-emerald-300 text-black font-bold text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add liquidity</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default MeshPoolHeader;
