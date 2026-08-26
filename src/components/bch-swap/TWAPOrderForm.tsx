import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Clock, Layers, ShieldCheck, Sparkles, TrendingUp,
  AlertTriangle, Loader2, ArrowRight, Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Token, TwapQuoteResponse } from '@/types';
import { useTWAP } from '@/hooks/useTWAP';
import { ConnectWalletButton } from '@/components/connect-wallet-button';
import { cashAddressToLockingBytecode, binToHex } from '@bitauth/libauth';
import { toast } from 'sonner';

import { usePrices } from '@/hooks/usePrices';

interface TWAPOrderFormProps {
  sellToken: Token;
  buyToken: Token;
  sellAmount: string;
  onSellAmountChange: (val: string) => void;
  onOrderPlaced?: () => void;
  userAddress: string;
  userPkh: string;
  isConnected?: boolean;
  sellBalance?: number | null;
}

function derivePkhFromAddress(address: string): string {
  if (!address) return '';
  try {
    const decoded = cashAddressToLockingBytecode(address);
    if (typeof decoded !== 'string') {
      if (decoded.bytecode.length === 25) {
        return binToHex(decoded.bytecode.slice(3, 23));
      } else if (decoded.bytecode.length === 23) {
        return binToHex(decoded.bytecode.slice(2, 22));
      } else {
        return binToHex(decoded.bytecode.slice(3, 23));
      }
    }
  } catch (e) {
    console.warn('[TWAP] PKH derivation error:', e);
  }
  return '';
}

const SLICE_PRESETS = [
  { value: 5, label: '5' },
  { value: 10, label: '10' },
  { value: 20, label: '20' },
  { value: 50, label: '50' },
];

const INTERVAL_PRESETS = [
  { value: 60, label: '1m' },
  { value: 300, label: '5m' },
  { value: 900, label: '15m' },
  { value: 3600, label: '1h' },
];

export function TWAPOrderForm({
  sellToken,
  buyToken,
  sellAmount,
  onSellAmountChange,
  onOrderPlaced,
  userAddress,
  userPkh,
  isConnected = true,
  sellBalance = null,
}: TWAPOrderFormProps) {
  const [numSlices, setNumSlices] = useState<number>(10);
  const [intervalSec, setIntervalSec] = useState<number>(60);
  const [limitProtection, setLimitProtection] = useState<boolean>(false);
  const [maxPriceLimit, setMaxPriceLimit] = useState<string>('');

  const { prices } = usePrices();
  const sellTokenPrice = prices[sellToken.symbol]?.price || (sellToken.symbol === 'BCH' ? 380 : 1.0);
  const buyTokenPrice = prices[buyToken.symbol]?.price || 1.0;

  const { fetchQuote, submitOrder, currentQuote, quoteLoading, loading } = useTWAP();

  const isSellBCH = sellToken.chain === 'bch' && (sellToken.symbol === 'BCH' || sellToken.type === 'native');
  const isBuyBCH = buyToken.chain === 'bch' && (buyToken.symbol === 'BCH' || buyToken.type === 'native');

  const tokenIn = isSellBCH 
    ? '0x' 
    : (sellToken.categoryId || (sellToken.type && sellToken.type !== 'native' ? sellToken.type : 'dfe50223c8d5cba8dcef8dff6d92b61deb88a8ba44947367f2b746487b56039b'));

  const tokenOut = isBuyBCH 
    ? '0x' 
    : (buyToken.categoryId || (buyToken.type && buyToken.type !== 'native' ? buyToken.type : 'dfe50223c8d5cba8dcef8dff6d92b61deb88a8ba44947367f2b746487b56039b'));

  const side: 'BUY' | 'SELL' = isSellBCH ? 'SELL' : 'BUY';

  // Trigger quote fetching when parameters change
  useEffect(() => {
    if (!sellAmount || Number(sellAmount) <= 0) return;
    const decimals = sellToken.decimals ?? (isSellBCH ? 8 : 0);
    const baseUnits = Math.round(Number(sellAmount) * Math.pow(10, decimals));
    fetchQuote({
      tokenIn,
      tokenOut,
      totalAmountIn: baseUnits.toString(),
      numSlices,
      intervalSec,
      maxPricePerUnit: limitProtection && maxPriceLimit ? maxPriceLimit : undefined,
    });
  }, [sellAmount, numSlices, intervalSec, limitProtection, maxPriceLimit, tokenIn, tokenOut, sellToken.decimals, isSellBCH, fetchQuote]);

  const sliceSize = useMemo(() => {
    if (!sellAmount || Number(sellAmount) <= 0) return '0';
    return (Number(sellAmount) / numSlices).toFixed(Math.min(sellToken.decimals || 4, 6));
  }, [sellAmount, numSlices, sellToken.decimals]);

  const totalDurationFormatted = useMemo(() => {
    const totalSec = (numSlices - 1) * intervalSec;
    if (totalSec < 60) return `${totalSec}s`;
    if (totalSec < 3600) return `${Math.round(totalSec / 60)} mins`;
    return `${(totalSec / 3600).toFixed(1)} hrs`;
  }, [numSlices, intervalSec]);

  const handlePlaceTwap = async () => {
    const effectivePkh = userPkh || derivePkhFromAddress(userAddress);
    if (!userAddress || !effectivePkh) {
      toast.error('Connect your BCH wallet first to submit TWAP orders');
      return;
    }
    if (!sellAmount || Number(sellAmount) <= 0) {
      toast.error('Enter a valid sell amount');
      return;
    }
    if (sellBalance !== null && Number(sellAmount) > sellBalance) {
      toast.error(`Insufficient ${sellToken.symbol} balance`);
      return;
    }

    const decimals = sellToken.decimals ?? (isSellBCH ? 8 : 0);
    const baseUnits = Math.round(Number(sellAmount) * Math.pow(10, decimals));

    const res = await submitOrder({
      creatorPkh: effectivePkh,
      creatorAddress: userAddress,
      side,
      tokenIn,
      tokenOut,
      totalAmountIn: baseUnits.toString(),
      numSlices,
      intervalSec,
      maxPricePerUnit: limitProtection && maxPriceLimit ? maxPriceLimit : undefined,
    });

    if (res) {
      toast.success(
        `TWAP Order Created! ${numSlices} slices of ${sliceSize} ${sellToken.symbol} every ${intervalSec}s`,
        { duration: 6000 }
      );
      onOrderPlaced?.();
    }
  };

  return (
    <div className="space-y-4 pt-1">
      {/* ── 1. Slices Configuration ── */}
      <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <label className="text-zinc-400 font-semibold flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            Number of Slices
          </label>
          <span className="font-mono text-zinc-300 font-bold">{numSlices} slices</span>
        </div>

        {/* Slice Presets */}
        <div className="grid grid-cols-4 gap-1.5">
          {SLICE_PRESETS.map(preset => (
            <button
              key={preset.value}
              type="button"
              onClick={() => setNumSlices(preset.value)}
              className={cn(
                "py-1.5 rounded-xl text-xs font-mono font-bold transition-all border",
                numSlices === preset.value
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-sm"
                  : "bg-white/[0.02] border-white/5 text-zinc-400 hover:text-white hover:bg-white/[0.05]"
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 2. Interval Duration Configuration ── */}
      <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <label className="text-zinc-400 font-semibold flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            Execution Interval
          </label>
          <span className="font-mono text-zinc-300 font-bold">{intervalSec}s per slice</span>
        </div>

        {/* Interval Presets */}
        <div className="grid grid-cols-4 gap-1.5">
          {INTERVAL_PRESETS.map(preset => (
            <button
              key={preset.value}
              type="button"
              onClick={() => setIntervalSec(preset.value)}
              className={cn(
                "py-1.5 rounded-xl text-xs font-mono font-bold transition-all border",
                intervalSec === preset.value
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-sm"
                  : "bg-white/[0.02] border-white/5 text-zinc-400 hover:text-white hover:bg-white/[0.05]"
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 3. TWAP Live Breakdown Card ── */}
      <div className="p-4 bg-gradient-to-br from-emerald-500/[0.06] via-teal-500/[0.03] to-transparent border border-emerald-500/20 rounded-2xl space-y-2.5 text-xs">
        <div className="flex items-center justify-between pb-2 border-b border-emerald-500/10">
          <span className="text-zinc-400 font-medium">Pyth Oracle Price</span>
          <span className="font-mono font-bold text-emerald-400">
            ${sellTokenPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} USD / {sellToken.symbol}
          </span>
        </div>

        <div className="flex items-center justify-between pb-2 border-b border-emerald-500/10">
          <span className="text-zinc-400 font-medium">Slice Size</span>
          <div className="text-right">
            <span className="font-mono font-bold text-white block">
              {sliceSize} {sellToken.symbol}
            </span>
            <span className="font-mono text-[10px] text-zinc-400 block">
              ~${(Number(sliceSize) * sellTokenPrice).toFixed(2)} USD
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pb-2 border-b border-emerald-500/10">
          <span className="text-zinc-400 font-medium">Estimated Duration</span>
          <span className="font-mono font-bold text-emerald-400">
            {totalDurationFormatted}
          </span>
        </div>

        <div className="flex items-center justify-between pb-2 border-b border-emerald-500/10">
          <span className="text-zinc-400 font-medium">Est. Price Impact Savings</span>
          <span className="font-mono font-bold text-emerald-300 inline-flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            ~{currentQuote?.priceImpactSavingsPct || '1.15'}%
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-zinc-400 font-medium">Total Value & Fees</span>
          <span className="font-mono text-zinc-300 text-right block">
            ~${(Number(sellAmount || 0) * sellTokenPrice).toFixed(2)} USD ({numSlices * 1000} sats fee)
          </span>
        </div>
      </div>

      {/* ── 4. Submit CTA Button ── */}
      {!isConnected ? (
        <ConnectWalletButton className="w-full h-14 rounded-2xl" />
      ) : !sellAmount || Number(sellAmount) <= 0 ? (
        <Button className="w-full h-14 text-base font-semibold rounded-2xl bg-white/[0.04] text-white/40 hover:bg-white/[0.04]" disabled>
          Enter an amount
        </Button>
      ) : sellBalance !== null && Number(sellAmount) > sellBalance ? (
        <Button className="w-full h-14 text-base font-semibold rounded-2xl bg-red-500/15 text-red-300 hover:bg-red-500/15" disabled>
          Insufficient {sellToken.symbol} balance
        </Button>
      ) : (
        <Button
          className="w-full h-14 text-base font-semibold bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 rounded-2xl shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all font-heading"
          onClick={handlePlaceTwap}
          disabled={loading || quoteLoading}
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Submitting TWAP Order…</>
          ) : (
            <>
              <Clock className="w-4 h-4 mr-2" />
              Place TWAP · {numSlices} Slices ({intervalSec}s)
            </>
          )}
        </Button>
      )}
    </div>
  );
}
