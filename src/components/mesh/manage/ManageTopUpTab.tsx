import React, { useState } from 'react';
import {
  PlusCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { type MeshPosition } from '@/hooks/useMeshServer';
import { tokenSymbol, getTokenMetadata } from '@/lib/meshContracts';
import { ConnectWalletButton } from '@/components/connect-wallet-button';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ManageTopUpTabProps {
  position: MeshPosition;
  isConnected: boolean;
  liveBchPrice: number;
  isToppingUp: boolean;
  onTopUp: (amountBch: string) => Promise<void>;
}

export function ManageTopUpTab({
  position,
  isConnected,
  liveBchPrice,
  isToppingUp,
  onTopUp,
}: ManageTopUpTabProps) {
  const [topUpAmount, setTopUpAmount] = useState<string>('0.50');

  const tokenOutName = tokenSymbol(position.tokenCategoryOut);
  const baseMeta = getTokenMetadata('BCH');

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h4 className="text-sm font-bold text-white">Deposit Liquidity to Covenant</h4>
        <p className="text-xs text-zinc-400">
          Provide single-asset BCH or {tokenOutName} capital directly to the covenant UTXO.
        </p>
      </div>

      {/* Asset Selection (BCH vs Quote CashToken) */}
      <div className="flex bg-black/50 p-1 rounded-2xl border border-white/5 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setTopUpAmount('0.50')}
          className="flex-1 py-2 rounded-xl bg-white/10 text-white font-bold flex items-center justify-center gap-1.5 shadow-sm"
        >
          <img src="/logos/bitcoin-cash-bch-logo.svg" alt="BCH" className="w-4 h-4" />
          <span>Deposit BCH</span>
        </button>
        {tokenOutName !== 'BCH' && (
          <button
            type="button"
            onClick={() => setTopUpAmount('150')}
            className="flex-1 py-2 rounded-xl text-zinc-400 hover:text-white flex items-center justify-center gap-1.5 transition-colors"
          >
            <div className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-[9px] flex items-center justify-center font-bold">
              {tokenOutName.slice(0, 2)}
            </div>
            <span>Deposit {tokenOutName}</span>
          </button>
        )}
      </div>

      {/* Amount input card */}
      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
        <div className="flex justify-between items-center text-xs text-zinc-400 font-semibold">
          <span>Deposit Amount</span>
          <button
            type="button"
            onClick={() => setTopUpAmount('2.50')}
            className="font-mono text-emerald-400 hover:underline"
          >
            Wallet: ~4.25 BCH (Max)
          </button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <input
            type="number"
            step="0.01"
            min="0.001"
            value={topUpAmount}
            onChange={(e) => setTopUpAmount(e.target.value)}
            placeholder="0.00"
            className="bg-transparent text-2xl font-black font-mono text-white focus:outline-none w-full min-w-0"
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
              type="button"
              onClick={() => setTopUpAmount(amt)}
              className={cn(
                'flex-1 py-1 rounded-lg text-xs font-mono font-semibold transition-all',
                topUpAmount === amt
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white'
              )}
            >
              +{amt}
            </button>
          ))}
        </div>
      </div>

      {/* Value preview & Additive UTXO Notice */}
      <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2 text-xs font-mono">
        <div className="flex justify-between items-center text-zinc-400 font-sans">
          <span>Estimated USD Value</span>
          <span className="text-emerald-400 font-bold">
            ≈ ${(parseFloat(topUpAmount || '0') * liveBchPrice).toFixed(2)} USD
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 pt-1.5 border-t border-white/5">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Additive UTXO: Merged automatically on next swap fill.</span>
        </div>
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
  );
}

export default ManageTopUpTab;
