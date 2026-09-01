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
} from 'lucide-react';
import { type MeshPosition } from '@/hooks/useMeshServer';
import { tokenSymbol } from '@/lib/meshContracts';
import { notifyToast as toast } from '@/lib/notify-toast';
import { ConnectWalletButton } from '@/components/connect-wallet-button';

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
  const [activeTab, setActiveTab] = useState<'dock' | 'topup'>('dock');
  const [dockPercent, setDockPercent] = useState<number>(100);
  const [topUpAmount, setTopUpAmount] = useState<string>('0.005');
  const [copiedAddr, setCopiedAddr] = useState(false);

  const tokenOutName = tokenSymbol(position.tokenCategoryOut);

  // Withdrawal calculation
  const withdrawAmountSats = Math.round((Number(effectiveReserveSats) * dockPercent) / 100);
  const withdrawAmountBch = (withdrawAmountSats / 1e8).toFixed(6);
  const remainingAmountBch = Math.max(
    0,
    (Number(effectiveReserveSats) - withdrawAmountSats) / 1e8
  ).toFixed(6);

  const withdrawTokenAmount =
    effectiveTokenAmount > 0n
      ? (effectiveTokenAmount * BigInt(dockPercent)) / 100n
      : 0n;
  const remainingTokenAmount =
    effectiveTokenAmount > 0n ? effectiveTokenAmount - withdrawTokenAmount : 0n;

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(position.address);
    setCopiedAddr(true);
    toast.success('Covenant address copied to clipboard');
    setTimeout(() => setCopiedAddr(false), 2000);
  };

  return (
    <div className="bg-gradient-to-br from-[#0D0D10] to-[#121216] border border-white/10 rounded-3xl p-6 shadow-2xl backdrop-blur-xl space-y-6">
      {/* Header & Tab Switcher */}
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <div className="flex items-center gap-1.5 p-1 bg-black/40 border border-white/5 rounded-2xl">
          <button
            onClick={() => setActiveTab('dock')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'dock'
                ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-400 border border-emerald-500/30 shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            <span>Withdraw / Dock</span>
          </button>
          <button
            onClick={() => setActiveTab('topup')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'topup'
                ? 'bg-gradient-to-r from-teal-500/20 to-cyan-500/20 text-teal-400 border border-teal-500/30 shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Top-up Deposit</span>
          </button>
        </div>

        <span className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hidden sm:inline-block">
          {activeTab === 'dock' ? '100% Unilateral Exit' : 'Auto-Compounding'}
        </span>
      </div>

      {/* ── Tab 1: Dock / Withdraw ──────────────────────────────────── */}
      {activeTab === 'dock' && (
        <div className="space-y-5">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>Unilateral Position Exit</span>
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Withdraw any portion of your BCH reserve and earned maker fees directly back to your wallet in 1 Bitcoin Cash transaction.
            </p>
          </div>

          {/* Percentage Slider & Quick Select */}
          <div className="space-y-3 pt-1">
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-400 font-semibold">Withdrawal Percentage:</span>
              <span className="font-mono font-black text-emerald-400 text-lg">{dockPercent}%</span>
            </div>

            <input
              type="range"
              min="1"
              max="100"
              value={dockPercent}
              onChange={(e) => setDockPercent(Number(e.target.value))}
              disabled={isDrained || !isConnected}
              className="w-full h-2.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-400 disabled:opacity-40"
            />

            <div className="grid grid-cols-4 gap-2 pt-1">
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  onClick={() => setDockPercent(pct)}
                  disabled={isDrained || !isConnected}
                  className={`py-2 text-xs font-mono font-bold rounded-xl border transition-all ${
                    dockPercent === pct
                      ? 'bg-emerald-500 text-black border-emerald-400 shadow-md'
                      : 'bg-white/[0.02] border-white/10 text-zinc-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-30'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Withdrawal Breakdown Card */}
          <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-2.5 text-xs">
            <div className="flex justify-between text-zinc-400">
              <span>Withdrawing to wallet:</span>
              <span className="font-mono font-bold text-white">
                {withdrawAmountBch} BCH{' '}
                <span className="text-zinc-500 font-normal">
                  (≈ ${(Number(withdrawAmountBch) * liveBchPrice).toFixed(2)})
                </span>
              </span>
            </div>

            {effectiveTokenAmount > 0n && (
              <div className="flex justify-between text-zinc-400">
                <span>Withdrawing CashTokens:</span>
                <span className="font-mono font-bold text-teal-400">
                  {withdrawTokenAmount.toString()} {tokenOutName}
                </span>
              </div>
            )}

            <div className="flex justify-between text-zinc-400">
              <span>Remaining in covenant:</span>
              <span className="font-mono text-zinc-300">
                {remainingAmountBch} BCH{' '}
                {effectiveTokenAmount > 0n ? `+ ${remainingTokenAmount} ${tokenOutName}` : ''}
              </span>
            </div>

            <div className="flex justify-between text-zinc-500 pt-2 border-t border-white/5 text-[11px]">
              <span>Est. Network Miner Fee:</span>
              <span className="font-mono text-emerald-400">&lt; 0.00001 BCH (&lt; $0.01)</span>
            </div>
          </div>

          {/* Execution Button */}
          {!isConnected ? (
            <ConnectWalletButton className="w-full py-3.5 text-xs font-bold" />
          ) : position.isMock ? (
            <div className="w-full py-3.5 px-4 bg-zinc-900 border border-zinc-700/40 rounded-xl flex items-center justify-center gap-2 text-zinc-500 text-xs font-semibold">
              <Lock className="w-4 h-4 text-zinc-500" />
              <span>Demo Position — Deploy your own pool to unlock live docking</span>
            </div>
          ) : (
            <button
              onClick={() => onDock(dockPercent)}
              disabled={isDocking || isDrained}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-black font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
            >
              {isDocking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Broadcasting Dock Signature…</span>
                </>
              ) : isDrained ? (
                <span>Position Already Drained</span>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-black" />
                  <span>
                    {dockPercent === 100
                      ? 'Dock 100% (Close Position)'
                      : `Dock ${dockPercent}% (${withdrawAmountBch} BCH)`}
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* ── Tab 2: Top Up / Deposit ─────────────────────────────────── */}
      {activeTab === 'topup' && (
        <div className="space-y-5">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>Top-Up Pool Reserve</span>
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Add BCH directly to this covenant to increase market making depth and earn larger fee yields per block.
            </p>
          </div>

          {/* Quick Presets */}
          <div className="space-y-2">
            <span className="text-xs text-zinc-400 font-semibold">Deposit Presets:</span>
            <div className="grid grid-cols-4 gap-2">
              {['0.001', '0.005', '0.01', '0.05'].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setTopUpAmount(amt)}
                  className={`py-2 text-xs font-mono font-bold rounded-xl border transition-all ${
                    topUpAmount === amt
                      ? 'bg-teal-500 text-black border-teal-400 shadow-md'
                      : 'bg-white/[0.02] border-white/10 text-zinc-400 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  {amt} BCH
                </button>
              ))}
            </div>
          </div>

          {/* Custom Input */}
          <div className="space-y-2">
            <span className="text-xs text-zinc-400 font-semibold">Or Enter Custom BCH Amount:</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.001"
                min="0.0001"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                placeholder="0.005"
                className="flex-1 px-4 py-3 bg-white/[0.04] border border-white/10 rounded-xl text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-teal-500 transition-colors"
              />
              <button
                onClick={() => onTopUp(topUpAmount)}
                disabled={isToppingUp || !isConnected}
                className="px-6 py-3 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-black font-bold text-xs rounded-xl shadow-lg shadow-teal-500/20 transition-all flex items-center gap-1.5 whitespace-nowrap"
              >
                {isToppingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coins className="w-4 h-4" />}
                <span>Deposit</span>
              </button>
            </div>
          </div>

          {/* Direct Covenant Deposit Info */}
          <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-2 text-xs">
            <span className="text-zinc-400 font-semibold">Direct Deposit Address:</span>
            <div className="flex items-center justify-between font-mono text-[11px] text-zinc-300 bg-black/40 p-2.5 rounded-xl border border-white/5">
              <span className="truncate pr-2">{position.address}</span>
              <button
                onClick={handleCopyAddress}
                className="text-zinc-400 hover:text-white shrink-0"
              >
                {copiedAddr ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[11px] text-zinc-500 leading-normal">
              Any satoshis sent to this address become part of the covenant reserve automatically upon block confirmation.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
