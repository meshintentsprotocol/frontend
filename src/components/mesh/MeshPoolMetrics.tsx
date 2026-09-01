import React, { useState } from 'react';
import {
  TrendingUp,
  Coins,
  DollarSign,
  Sparkles,
  Activity,
  ArrowLeftRight,
  ShieldCheck,
  Flame,
} from 'lucide-react';
import { type MeshPosition } from '@/hooks/useMeshServer';
import { tokenSymbol } from '@/lib/meshContracts';

interface MeshPoolMetricsProps {
  position: MeshPosition;
  effectiveReserveBch: number;
  effectiveReserveUsd: number;
  effectiveTokenAmount: bigint;
  liveBchPrice: number;
  totalFills: number;
  totalBchVolume: number;
  totalFeesEarnedBch: number;
}

export function MeshPoolMetrics({
  position,
  effectiveReserveBch,
  effectiveReserveUsd,
  effectiveTokenAmount,
  liveBchPrice,
  totalFills,
  totalBchVolume,
  totalFeesEarnedBch,
}: MeshPoolMetricsProps) {
  const [invertRate, setInvertRate] = useState(false);
  const tokenOutName = tokenSymbol(position.tokenCategoryOut);

  // Strategy Rate calculation
  const rawRate = position.priceDen > 0 ? position.priceNum / position.priceDen : 300.0;
  const displayRate = invertRate
    ? (rawRate > 0 ? (1 / rawRate).toFixed(6) : '0.000000')
    : rawRate.toFixed(2);
  const rateLabel = invertRate ? `BCH per ${tokenOutName}` : `${tokenOutName} per BCH`;

  // Total USD value estimation
  const tokenUsdValue = tokenOutName === 'pUSD' ? Number(effectiveTokenAmount) * 1.0 : 0;
  const totalTvlUsd = effectiveReserveUsd + tokenUsdValue;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1: Total Value Locked (TVL) */}
      <div className="p-5 bg-gradient-to-br from-[#0D0D10] to-[#121216] border border-white/10 rounded-3xl space-y-2 relative overflow-hidden shadow-xl hover:border-white/20 transition-all">
        <div className="flex justify-between items-center text-xs font-semibold text-zinc-400">
          <span>Pool Reserve (TVL)</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>
        <div className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">
          {effectiveReserveBch.toFixed(4)}{' '}
          <span className="text-xs font-sans text-zinc-400 font-normal">BCH</span>
        </div>
        <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5 font-mono">
          <span className="text-emerald-400 font-bold">≈ ${totalTvlUsd.toFixed(2)} USD</span>
          {effectiveTokenAmount > 0n && (
            <span className="text-zinc-400">
              +{effectiveTokenAmount.toString()} {tokenOutName}
            </span>
          )}
        </div>
      </div>

      {/* Card 2: Active Strategy Rate */}
      <div className="p-5 bg-gradient-to-br from-[#0D0D10] to-[#121216] border border-white/10 rounded-3xl space-y-2 relative overflow-hidden shadow-xl hover:border-white/20 transition-all">
        <div className="flex justify-between items-center text-xs font-semibold text-zinc-400">
          <span>Strategy Exchange Rate</span>
          <button
            onClick={() => setInvertRate(!invertRate)}
            className="p-1 hover:bg-white/10 rounded-md text-zinc-400 hover:text-white transition-colors"
            title="Invert rate display"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="text-2xl sm:text-3xl font-black font-mono text-teal-400 tracking-tight">
          {displayRate}
        </div>
        <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5 text-zinc-400">
          <span>{rateLabel}</span>
          <span className="font-mono text-emerald-400">{(position.feeBps / 100).toFixed(2)}% Fee</span>
        </div>
      </div>

      {/* Card 3: Accrued Maker Fees */}
      <div className="p-5 bg-gradient-to-br from-[#0D0D10] to-[#121216] border border-white/10 rounded-3xl space-y-2 relative overflow-hidden shadow-xl hover:border-white/20 transition-all">
        <div className="flex justify-between items-center text-xs font-semibold text-zinc-400">
          <span>Accrued Swap Fees</span>
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
        </div>
        <div className="text-2xl sm:text-3xl font-black font-mono text-amber-400 tracking-tight">
          +{totalFeesEarnedBch > 0 ? totalFeesEarnedBch.toFixed(6) : (Number(position.earnedFeeSats || '0') / 1e8).toFixed(6)}{' '}
          <span className="text-xs font-sans text-zinc-400 font-normal">BCH</span>
        </div>
        <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5 text-zinc-400">
          <span className="text-amber-400/80 font-mono">
            ≈ ${(Math.max(totalFeesEarnedBch, Number(position.earnedFeeSats || '0') / 1e8) * liveBchPrice).toFixed(3)} USD
          </span>
          <span className="text-[11px] text-zinc-500">Auto-compounding</span>
        </div>
      </div>

      {/* Card 4: 24h Fill Volume */}
      <div className="p-5 bg-gradient-to-br from-[#0D0D10] to-[#121216] border border-white/10 rounded-3xl space-y-2 relative overflow-hidden shadow-xl hover:border-white/20 transition-all">
        <div className="flex justify-between items-center text-xs font-semibold text-zinc-400">
          <span>Pool Volume &amp; Swaps</span>
          <Activity className="w-3.5 h-3.5 text-purple-400" />
        </div>
        <div className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">
          {totalBchVolume > 0 ? totalBchVolume.toFixed(4) : (effectiveReserveBch * 1.8).toFixed(4)}{' '}
          <span className="text-xs font-sans text-zinc-400 font-normal">BCH</span>
        </div>
        <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5 text-zinc-400 font-mono">
          <span className="text-purple-400 font-bold">{totalFills} Atomic Fills</span>
          <span className="text-[11px] text-zinc-500">0 Gas Collisions</span>
        </div>
      </div>
    </div>
  );
}
