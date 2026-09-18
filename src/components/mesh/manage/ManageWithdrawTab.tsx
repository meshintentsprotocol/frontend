import React, { useState } from 'react';
import {
  ArrowDownToLine,
  Loader2,
} from 'lucide-react';
import { type MeshPosition } from '@/hooks/useMeshServer';
import { tokenSymbol } from '@/lib/meshContracts';
import { ConnectWalletButton } from '@/components/connect-wallet-button';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ManageWithdrawTabProps {
  position: MeshPosition;
  isConnected: boolean;
  isDrained: boolean;
  effectiveReserveSats: bigint;
  effectiveTokenAmount: bigint;
  liveBchPrice: number;
  isDocking: boolean;
  onDock: (percent: number) => Promise<void>;
}

export function ManageWithdrawTab({
  position,
  isConnected,
  isDrained,
  effectiveReserveSats,
  effectiveTokenAmount,
  liveBchPrice,
  isDocking,
  onDock,
}: ManageWithdrawTabProps) {
  const [dockPercent, setDockPercent] = useState<number>(100);

  const tokenOutName = tokenSymbol(position.tokenCategoryOut);

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

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-white">Unilateral Position Withdrawal</h4>
          <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-mono">
            0% Penalty
          </span>
        </div>
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
              type="button"
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
          <span>Returning BCH to Wallet:</span>
          <span className="text-white font-bold font-mono">
            {withdrawAmountBch} BCH (~${(parseFloat(withdrawAmountBch) * liveBchPrice).toFixed(2)})
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
        <div className="flex justify-between text-zinc-500 text-[11px] pt-1.5 border-t border-white/5">
          <span>Remaining Reserve in Pool:</span>
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
  );
}

export default ManageWithdrawTab;
