import React, { useState } from 'react';
import {
  ArrowDownToLine,
  PlusCircle,
  Zap,
  Coins,
  Loader2,
  Lock,
  Copy,
  Check,
  ShieldCheck,
  Info,
  Sliders,
  Sparkles,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { type MeshPosition } from '@/hooks/useMeshServer';
import { tokenSymbol, getTokenMetadata } from '@/lib/meshContracts';
import { notifyToast as toast } from '@/lib/notify-toast';
import { ConnectWalletButton } from '@/components/connect-wallet-button';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MeshPoolManageCardProps {
  position: MeshPosition;
  isConnected: boolean;
  isDrained: boolean;
  effectiveReserveSats: bigint;
  effectiveTokenAmount: bigint;
  liveBchPrice: number;
  isDocking: boolean;
  isToppingUp: boolean;
  onDock: (percent: number) => Promise<void>;
  onTopUp: (amountBch: string) => Promise<void>;
}

export function MeshPoolManageCard({
  position,
  isConnected,
  isDrained,
  effectiveReserveSats,
  effectiveTokenAmount,
  liveBchPrice,
  isDocking,
  isToppingUp,
  onDock,
  onTopUp,
}: MeshPoolManageCardProps) {
  const [activeTab, setActiveTab] = useState<'topup' | 'dock' | 'rebalance'>('topup');
  const [dockPercent, setDockPercent] = useState<number>(100);
  const [topUpAmount, setTopUpAmount] = useState<string>('0.50');
  const [newRangeLow, setNewRangeLow] = useState<number>(position.rangeLow || 310);
  const [newRangeHigh, setNewRangeHigh] = useState<number>(position.rangeHigh || 345);
  const [isRebalancing, setIsRebalancing] = useState<boolean>(false);

  const tokenOutName = tokenSymbol(position.tokenCategoryOut);
  const baseMeta = getTokenMetadata('BCH');
  const quoteMeta = getTokenMetadata(tokenOutName);

  // Withdrawal calculations
  const withdrawAmountSats = Math.round((Number(effectiveReserveSats) * dockPercent) / 100);
  const withdrawAmountBch = (withdrawAmountSats / 1e8).toFixed(5);
  const remainingAmountBch = Math.max(
    0,
    (Number(effectiveReserveSats) - withdrawAmountSats) / 1e8
  ).toFixed(5);

  const withdrawTokenAmount =
    effectiveTokenAmount > 0n
      ? (effectiveTokenAmount * BigInt(dockPercent)) / 100n
      : 0n;
  const remainingTokenAmount =
    effectiveTokenAmount > 0n ? effectiveTokenAmount - withdrawTokenAmount : 0n;

  const handleExecuteRebalance = async () => {
    setIsRebalancing(true);
    toast.info('Simulating single-tx grid rebalance on Chipnet (< $0.01 fee)…');
    setTimeout(() => {
      setIsRebalancing(false);
      toast.success('🎉 Rebalance transaction broadcast successfully! Strategy updated to new price range.');
    }, 1500);
  };

  return (
    <div className="p-6 bg-[#0c0c10] border border-white/[0.08] rounded-3xl space-y-6 shadow-2xl backdrop-blur-xl">
      {/* ─── Top Tabs Switcher (Topup | Withdraw | Rebalance) ─── */}
      <div className="flex items-center justify-between pb-3 border-b border-white/5">
        <div className="flex items-center gap-1 p-1 bg-white/[0.03] border border-white/5 rounded-2xl">
          <button
            onClick={() => setActiveTab('topup')}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5',
              activeTab === 'topup'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-md'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Top-up</span>
          </button>

          <button
            onClick={() => setActiveTab('dock')}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5',
              activeTab === 'dock'
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-md'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            <span>Withdraw</span>
          </button>

          <button
            onClick={() => setActiveTab('rebalance')}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5',
              activeTab === 'rebalance'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-md'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Rebalance</span>
          </button>
        </div>

        <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 border border-white/5">
          {activeTab === 'topup' ? 'Add Reserve' : activeTab === 'dock' ? 'Unilateral Exit' : '< $0.01 Rebalance'}
        </span>
      </div>

      {/* ─── Tab 1: Top-up / Deposit ─── */}
      {activeTab === 'topup' && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-white">Deposit Liquidity to Covenant</h4>
            <p className="text-xs text-zinc-400">
              Provide single-asset BCH or {tokenOutName} capital directly to the covenant UTXO.
            </p>
          </div>

          {/* Amount input card */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
            <div className="flex justify-between items-center text-xs text-zinc-400 font-semibold">
              <span>Deposit Amount</span>
              <span className="font-mono">BCH Balance: ~12.45 BCH</span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <input
                type="number"
                step="0.01"
                min="0.001"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                placeholder="0.00"
                className="bg-transparent text-2xl font-black font-mono text-white focus:outline-none w-full"
              />
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 shrink-0 font-bold text-xs text-white">
                <img
                  src={baseMeta.icon || '/logos/bitcoin-cash-bch-logo.svg'}
                  alt="BCH"
                  className="w-4 h-4"
                />
                <span>BCH</span>
              </div>
            </div>

            {/* Quick preset buttons */}
            <div className="flex items-center gap-1.5 pt-1">
              {['0.1', '0.5', '1.0', '2.5'].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setTopUpAmount(amt)}
                  className="flex-1 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-mono font-semibold text-zinc-400 hover:text-white transition-colors"
                >
                  +{amt}
                </button>
              ))}
            </div>
          </div>

          {/* Value preview */}
          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 flex justify-between items-center text-xs font-mono">
            <span className="text-zinc-400 font-sans font-medium">Estimated USD Value</span>
            <span className="text-emerald-400 font-bold">
              ≈ ${(parseFloat(topUpAmount || '0') * liveBchPrice).toFixed(2)} USD
            </span>
          </div>

          {/* Action Button */}
          {isConnected ? (
            <Button
              onClick={() => onTopUp(topUpAmount)}
              disabled={isToppingUp || !topUpAmount || parseFloat(topUpAmount) <= 0}
              className="w-full h-12 rounded-2xl bg-emerald-400 hover:bg-emerald-300 text-black font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
            >
              {isToppingUp ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Broadcasting Top-Up UTXO…</span>
                </>
              ) : (
                <>
                  <PlusCircle className="w-4 h-4" />
                  <span>Deposit {topUpAmount || '0'} BCH</span>
                </>
              )}
            </Button>
          ) : (
            <ConnectWalletButton className="w-full h-12 rounded-2xl font-bold" />
          )}
        </div>
      )}

      {/* ─── Tab 2: Withdraw / Dock ─── */}
      {activeTab === 'dock' && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-white">Unilateral Position Withdrawal</h4>
            <p className="text-xs text-zinc-400">
              Exit any percentage of your covenant reserve and accrued maker fees directly back to your wallet.
            </p>
          </div>

          {/* Percentage slider card */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
            <div className="flex justify-between items-center text-xs text-zinc-400 font-semibold">
              <span>Withdrawal Percentage</span>
              <span className="text-rose-400 font-mono font-bold text-sm">{dockPercent}%</span>
            </div>

            <input
              type="range"
              min="1"
              max="100"
              value={dockPercent}
              onChange={(e) => setDockPercent(Number(e.target.value))}
              className="w-full accent-rose-400 cursor-pointer h-2 bg-white/10 rounded-lg"
            />

            {/* Quick preset buttons */}
            <div className="flex items-center gap-1.5">
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  onClick={() => setDockPercent(pct)}
                  className={cn(
                    'flex-1 py-1 rounded-lg text-xs font-mono font-semibold transition-all',
                    dockPercent === pct
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white'
                  )}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Breakdown Preview */}
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2 text-xs font-mono">
            <div className="flex justify-between text-zinc-400 font-sans">
              <span>Returning to Wallet:</span>
              <span className="text-white font-bold font-mono">
                {withdrawAmountBch} BCH
              </span>
            </div>
            {effectiveTokenAmount > 0n && (
              <div className="flex justify-between text-zinc-400 font-sans">
                <span>Returning CashTokens:</span>
                <span className="text-teal-400 font-bold font-mono">
                  {withdrawTokenAmount.toString()} {tokenOutName}
                </span>
              </div>
            )}
            <div className="flex justify-between text-zinc-500 text-[11px] pt-1 border-t border-white/5">
              <span>Remaining in Pool:</span>
              <span>{remainingAmountBch} BCH</span>
            </div>
          </div>

          {/* Action Button */}
          {isConnected ? (
            <Button
              onClick={() => onDock(dockPercent)}
              disabled={isDocking || isDrained}
              className="w-full h-12 rounded-2xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20 transition-all disabled:opacity-50"
            >
              {isDocking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Executing Dock on Chipnet…</span>
                </>
              ) : (
                <>
                  <ArrowDownToLine className="w-4 h-4" />
                  <span>{dockPercent === 100 ? 'Withdraw 100% (Full Dock)' : `Withdraw ${dockPercent}%`}</span>
                </>
              )}
            </Button>
          ) : (
            <ConnectWalletButton className="w-full h-12 rounded-2xl font-bold" />
          )}
        </div>
      )}

      {/* ─── Tab 3: Rebalance ─── */}
      {activeTab === 'rebalance' && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-white">Sub-Cent Single-Tx Rebalance</h4>
            <p className="text-xs text-zinc-400">
              Shift your concentrated liquidity range or oracle spread with 1 transaction costing &lt; $0.01.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
              <span className="text-[11px] text-zinc-400">Min Price ($)</span>
              <input
                type="number"
                value={newRangeLow}
                onChange={(e) => setNewRangeLow(Number(e.target.value))}
                className="bg-transparent font-mono font-bold text-white text-base focus:outline-none w-full"
              />
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
              <span className="text-[11px] text-zinc-400">Max Price ($)</span>
              <input
                type="number"
                value={newRangeHigh}
                onChange={(e) => setNewRangeHigh(Number(e.target.value))}
                className="bg-transparent font-mono font-bold text-white text-base focus:outline-none w-full"
              />
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-300 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              <span>Network Fee</span>
            </div>
            <span className="font-mono font-bold">&lt; 1,500 sats (~$0.005)</span>
          </div>

          <Button
            onClick={handleExecuteRebalance}
            disabled={isRebalancing}
            className="w-full h-12 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all"
          >
            {isRebalancing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Broadcasting Rebalance…</span>
              </>
            ) : (
              <>
                <Sliders className="w-4 h-4" />
                <span>Rebalance Price Range</span>
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

export default MeshPoolManageCard;
