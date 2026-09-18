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
  onOpenManage?: () => void;
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
  onOpenManage,
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
      {/* ─── Breadcrumb Navigation ─── */}
      <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400">
        <Link
          to="/mesh?tab=pools"
          className="hover:text-white transition-colors flex items-center gap-1.5"
        >
          <span>Pools</span>
        </Link>
        <span className="text-zinc-600">›</span>
        <span className="text-white font-bold">
          BCH / {tokenOutName}
        </span>
      </div>

      {/* ─── Main Aqua Electric Blue Hero Banner ─── */}
      <div className="w-full bg-[#0038ff] rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-2xl border border-blue-400/20">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-400/20 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          {/* Left Side: Overlapping Token Circles & Badges */}
          <div className="space-y-3">
            <div className="flex items-center gap-3.5">
              {/* Overlapping Token Circles */}
              <div className="flex -space-x-2 relative shrink-0">
                <div className="w-12 h-12 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center shadow-lg overflow-hidden z-[2] backdrop-blur-md">
                  <img
                    src={baseMeta.icon || '/logos/bitcoin-cash-bch-logo.svg'}
                    alt="BCH"
                    className="w-8 h-8 object-contain"
                  />
                </div>
                <div className="w-12 h-12 rounded-full bg-blue-900/60 border-2 border-white/40 flex items-center justify-center font-mono font-black text-sm text-cyan-200 shadow-lg z-[1] backdrop-blur-md">
                  {tokenOutName.slice(0, 3)}
                </div>
              </div>

              {/* Pair Name & Swap Direction Icon */}
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-heading tracking-tight">
                  BCH / {tokenOutName}
                </h1>
                <button
                  onClick={() => navigate(`/trade?from=BCH&to=${tokenOutName}`)}
                  className="p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-colors"
                  title="Swap tokens"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Badges Strip (Network, Strategy, Fee, Address) */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              {/* Network Badge */}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/20 border border-white/15 text-blue-100">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm" />
                <span>Bitcoin Cash Chipnet</span>
              </div>

              {/* Strategy Pill */}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-white font-semibold">
                <MetaIcon className="w-3.5 h-3.5 text-blue-200" />
                <span>{meta.label}</span>
              </div>

              {/* Fee Tier Badge */}
              <div className="px-3 py-1 rounded-full bg-black/20 border border-white/15 text-blue-100 font-semibold">
                {feePct}% fee
              </div>

              {/* Address Chip with Copy */}
              <div className="flex items-center gap-1.5 bg-black/20 border border-white/15 rounded-full px-3 py-1">
                <span className="text-blue-200 text-[11px]">{addressShort}</span>
                <button
                  onClick={() => copyText(position.address, 'Covenant Address')}
                  className="p-0.5 hover:text-white text-blue-300 transition-colors"
                  title="Copy Address"
                >
                  {copied === 'Covenant Address' ? (
                    <Check className="w-3 h-3 text-emerald-300" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right Side: Action CTAs */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Refresh button */}
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-blue-100 hover:text-white transition-all disabled:opacity-50"
              title="Refresh pool metrics"
            >
              <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
            </button>

            {/* Share button */}
            <button
              onClick={handleShare}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-blue-100 hover:text-white transition-all"
              title="Share pool"
            >
              <Share2 className="w-4 h-4" />
            </button>

            {/* Swap Button */}
            <Button
              onClick={() => navigate(`/trade?from=BCH&to=${tokenOutName}`)}
              variant="outline"
              className="h-10 px-5 rounded-full border-white/20 bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all hover:scale-105"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-blue-200" />
              <span>Swap</span>
            </Button>

            {/* Manage Position Button (Top-up / Withdraw / Rebalance) */}
            <Button
              onClick={onOpenManage || onOpenAddLiquidity}
              className="h-10 px-4 sm:px-5 rounded-full bg-white text-blue-900 hover:bg-blue-50 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-black/20 transition-all hover:scale-105"
            >
              <Zap className="w-4 h-4 text-blue-700" />
              <span>Manage</span>
              <span className="hidden sm:inline px-1.5 py-0.5 rounded bg-blue-100 text-blue-900 text-[10px] font-mono font-bold">
                &lt; $0.01
              </span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MeshPoolHeader;
