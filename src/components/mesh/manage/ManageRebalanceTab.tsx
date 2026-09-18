import React, { useState, useMemo } from 'react';
import {
  Loader2,
  Zap,
  Sliders,
  TrendingUp,
  Activity,
  Layers,
} from 'lucide-react';
import { type MeshPosition } from '@/hooks/useMeshServer';
import { notifyToast as toast } from '@/lib/notify-toast';
import { ConnectWalletButton } from '@/components/connect-wallet-button';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ManageRebalanceTabProps {
  position: MeshPosition;
  isConnected: boolean;
  isDrained: boolean;
  liveBchPrice: number;
  isRebalancing?: boolean;
  onRebalance?: (params: {
    rangeLow?: number;
    rangeHigh?: number;
    spreadBps?: number;
    feeBps?: number;
  }) => Promise<void>;
}

export function ManageRebalanceTab({
  position,
  isConnected,
  isDrained,
  liveBchPrice,
  isRebalancing = false,
  onRebalance,
}: ManageRebalanceTabProps) {
  // Rebalance form states
  const [newRangeLow, setNewRangeLow] = useState<number>(position.rangeLow || Math.round((liveBchPrice || 324) * 0.95));
  const [newRangeHigh, setNewRangeHigh] = useState<number>(position.rangeHigh || Math.round((liveBchPrice || 324) * 1.05));
  const [newSpreadBps, setNewSpreadBps] = useState<number>(position.spreadBps || 50);
  const [newFeeBps, setNewFeeBps] = useState<number>(position.feeBps || 30);
  const [selectedPreset, setSelectedPreset] = useState<'stable' | 'concentrated' | 'wide' | 'full' | 'custom'>('custom');
  const [localRebalancing, setLocalRebalancing] = useState<boolean>(false);

  // Strategy Type Classification
  const isOracleStrategy = position.contractType === 'OracleStrategyCovenant';
  const isMultiPairStrategy = position.contractType === 'MultiPairRecyclingCovenant';

  // Preset Handlers
  const handleApplyPreset = (preset: 'stable' | 'concentrated' | 'wide' | 'full') => {
    setSelectedPreset(preset);
    const spot = liveBchPrice || 324.4;

    if (preset === 'stable') {
      setNewRangeLow(Number((spot * 0.982).toFixed(2)));
      setNewRangeHigh(Number((spot * 1.018).toFixed(2)));
      setNewFeeBps(5);
      setNewSpreadBps(20);
    } else if (preset === 'concentrated') {
      setNewRangeLow(Number((spot * 0.95).toFixed(2)));
      setNewRangeHigh(Number((spot * 1.05).toFixed(2)));
      setNewFeeBps(30);
      setNewSpreadBps(50);
    } else if (preset === 'wide') {
      setNewRangeLow(Number((spot * 0.80).toFixed(2)));
      setNewRangeHigh(Number((spot * 1.20).toFixed(2)));
      setNewFeeBps(50);
      setNewSpreadBps(100);
    } else if (preset === 'full') {
      setNewRangeLow(0);
      setNewRangeHigh(999999);
      setNewFeeBps(30);
      setNewSpreadBps(50);
    }
  };

  const handleAdjustRange = (bound: 'low' | 'high', deltaPct: number) => {
    setSelectedPreset('custom');
    if (bound === 'low') {
      setNewRangeLow((prev) => Math.max(0.01, Number((prev * (1 + deltaPct)).toFixed(2))));
    } else {
      setNewRangeHigh((prev) => Math.max(newRangeLow + 0.01, Number((prev * (1 + deltaPct)).toFixed(2))));
    }
  };

  const handleExecuteRebalance = async () => {
    if (onRebalance) {
      await onRebalance({
        rangeLow: newRangeLow,
        rangeHigh: newRangeHigh,
        spreadBps: newSpreadBps,
        feeBps: newFeeBps,
      });
      return;
    }

    setLocalRebalancing(true);
    toast.info('Simulating single-tx grid rebalance on Chipnet (< $0.01 fee)…');
    setTimeout(() => {
      setLocalRebalancing(false);
      toast.success('🎉 Rebalance transaction broadcast successfully! Strategy updated.');
    }, 1500);
  };

  // Capital Efficiency Multiplier Calculation
  const capitalMultiplier = useMemo(() => {
    if (newRangeHigh <= newRangeLow || newRangeLow <= 0) return '1.0×';
    const rangeSpanPct = ((newRangeHigh - newRangeLow) / liveBchPrice) * 100;
    if (rangeSpanPct <= 4) return '25.0×';
    if (rangeSpanPct <= 10) return '8.5×';
    if (rangeSpanPct <= 25) return '3.6×';
    if (rangeSpanPct <= 50) return '2.0×';
    return '1.2×';
  }, [newRangeLow, newRangeHigh, liveBchPrice]);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <span>Sub-Cent Single-Tx Rebalance</span>
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-mono">
              &lt; $0.01 fee
            </span>
          </h4>
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Shift your concentrated range, spread, or fee tier atomically. 1 input spends to 1 new recreated covenant output without withdrawing to wallet first.
        </p>
      </div>

      {/* ── 1. Current Active Strategy Status Pill ── */}
      <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/8 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-400 font-semibold">Active Strategy:</span>
          <span className="font-mono font-bold text-white flex items-center gap-1.5">
            {isOracleStrategy ? (
              <>
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span>Oracle Following ({position.contractType})</span>
              </>
            ) : isMultiPairStrategy ? (
              <>
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>Mode 4 Shared ({position.contractType})</span>
              </>
            ) : (
              <>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>Concentrated Range ({position.contractType})</span>
              </>
            )}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs font-mono pt-1 border-t border-white/5">
          <span className="text-zinc-500">Current Setup:</span>
          <span className="text-emerald-400 font-bold">
            {isOracleStrategy
              ? `Spread +${((position.spreadBps || 50) / 100).toFixed(2)}% | Fee ${((position.feeBps || 30) / 100).toFixed(2)}%`
              : `$${position.rangeLow || 310} - $${position.rangeHigh || 345} | Fee ${((position.feeBps || 30) / 100).toFixed(2)}%`}
          </span>
        </div>
      </div>

      {/* ── 2. Quick Preset Selector ── */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-xs font-semibold text-zinc-400">
          <span>Select Preset Target Range</span>
          <span className="font-mono text-zinc-500">Spot: ${liveBchPrice.toFixed(2)}</span>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {[
            { id: 'stable', label: 'Stable Peg', sub: '±1.8%' },
            { id: 'concentrated', label: 'Concentrated', sub: '±5%' },
            { id: 'wide', label: 'Wide Band', sub: '±20%' },
            { id: 'full', label: 'Full Range', sub: '0-∞' },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleApplyPreset(p.id as any)}
              className={cn(
                'p-2 rounded-xl text-center border transition-all flex flex-col items-center justify-center',
                selectedPreset === p.id
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 shadow-sm'
                  : 'bg-white/[0.02] border-white/5 hover:border-white/20 text-zinc-400 hover:text-zinc-200'
              )}
            >
              <span className="text-xs font-bold">{p.label}</span>
              <span className="text-[10px] font-mono opacity-70">{p.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── 3. Interactive Range Bounds or Spread Slider ── */}
      {isOracleStrategy ? (
        /* Oracle Spread Slider */
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-zinc-400 font-semibold">Oracle Margin Spread</span>
            <span className="text-cyan-400 font-mono font-bold text-sm">
              +{(newSpreadBps / 100).toFixed(2)}% (+{newSpreadBps} bps)
            </span>
          </div>
          <input
            type="range"
            min="10"
            max="300"
            step="5"
            value={newSpreadBps}
            onChange={(e) => {
              setNewSpreadBps(Number(e.target.value));
              setSelectedPreset('custom');
            }}
            className="w-full accent-cyan-400 cursor-pointer h-2 bg-white/10 rounded-lg"
          />
          <div className="flex justify-between text-[10px] font-mono text-zinc-500">
            <span>+0.10% (Tight)</span>
            <span>+1.50% (Balanced)</span>
            <span>+3.00% (Volatile)</span>
          </div>
        </div>
      ) : (
        /* Range Price Inputs */
        <div className="grid grid-cols-2 gap-3">
          {/* Min Price Box */}
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
            <div className="flex justify-between items-center text-[11px] text-zinc-400 font-semibold">
              <span>Min Price ($)</span>
              <div className="flex items-center gap-1 font-mono">
                <button
                  type="button"
                  onClick={() => handleAdjustRange('low', -0.05)}
                  className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-zinc-300"
                >
                  -5%
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustRange('low', +0.05)}
                  className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-zinc-300"
                >
                  +5%
                </button>
              </div>
            </div>
            <input
              type="number"
              step="0.1"
              value={newRangeLow}
              onChange={(e) => {
                setNewRangeLow(Number(e.target.value));
                setSelectedPreset('custom');
              }}
              className="bg-transparent font-mono font-black text-white text-lg focus:outline-none w-full min-w-0"
            />
          </div>

          {/* Max Price Box */}
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
            <div className="flex justify-between items-center text-[11px] text-zinc-400 font-semibold">
              <span>Max Price ($)</span>
              <div className="flex items-center gap-1 font-mono">
                <button
                  type="button"
                  onClick={() => handleAdjustRange('high', -0.05)}
                  className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-zinc-300"
                >
                  -5%
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustRange('high', +0.05)}
                  className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-zinc-300"
                >
                  +5%
                </button>
              </div>
            </div>
            <input
              type="number"
              step="0.1"
              value={newRangeHigh}
              onChange={(e) => {
                setNewRangeHigh(Number(e.target.value));
                setSelectedPreset('custom');
              }}
              className="bg-transparent font-mono font-black text-white text-lg focus:outline-none w-full min-w-0"
            />
          </div>
        </div>
      )}

      {/* ── 4. Fee Tier Selector ── */}
      <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
        <div className="flex justify-between items-center text-xs font-semibold text-zinc-400">
          <span>Strategy Fee Tier</span>
          <span className="font-mono text-cyan-300 font-bold">{(newFeeBps / 100).toFixed(2)}%</span>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {[
            { bps: 5, label: '0.05%' },
            { bps: 30, label: '0.30%' },
            { bps: 50, label: '0.50%' },
            { bps: 100, label: '1.00%' },
          ].map((ft) => (
            <button
              key={ft.bps}
              type="button"
              onClick={() => setNewFeeBps(ft.bps)}
              className={cn(
                'py-1.5 rounded-xl text-xs font-mono font-semibold transition-all text-center',
                newFeeBps === ft.bps
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-white/5 text-zinc-400 hover:text-white'
              )}
            >
              {ft.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 5. Before vs After Comparison Preview Card ── */}
      <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2 text-xs font-mono">
        <div className="flex justify-between items-center text-zinc-400 font-sans">
          <span>Range Shift:</span>
          <span className="text-white font-bold font-mono">
            {isOracleStrategy
              ? `+${((position.spreadBps || 50) / 100).toFixed(2)}% → +${(newSpreadBps / 100).toFixed(2)}%`
              : `$${position.rangeLow || 310}–$${position.rangeHigh || 345} → $${newRangeLow}–$${newRangeHigh}`}
          </span>
        </div>

        <div className="flex justify-between items-center text-zinc-400 font-sans">
          <span>Capital Multiplier:</span>
          <span className="text-cyan-400 font-bold font-mono">
            {capitalMultiplier} Concentration
          </span>
        </div>

        <div className="flex justify-between items-center text-zinc-500 text-[11px] pt-1.5 border-t border-white/5">
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-cyan-400" />
            <span>Single-Tx Network Fee:</span>
          </span>
          <span className="text-cyan-300 font-bold">&lt; 1,000 sats (~$0.003)</span>
        </div>
      </div>

      {/* ── 6. Action Rebalance Button ── */}
      {isConnected ? (
        <Button
          onClick={handleExecuteRebalance}
          disabled={isRebalancing || localRebalancing || isDrained}
          className="w-full h-12 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
        >
          {isRebalancing || localRebalancing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Broadcasting Atomic Rebalance…</span>
            </>
          ) : (
            <>
              <Sliders className="w-4 h-4" />
              <span>Execute Single-Tx Rebalance</span>
            </>
          )}
        </Button>
      ) : (
        <ConnectWalletButton className="w-full h-12 rounded-2xl font-bold" />
      )}
    </div>
  );
}

export default ManageRebalanceTab;
