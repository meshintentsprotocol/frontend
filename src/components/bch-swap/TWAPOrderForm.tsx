import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Clock, Layers, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Token } from '@/types';
import { useTWAP, pkhOfAddress, type SliceQuote } from '@/hooks/useTWAP';
import { ConnectWalletButton } from '@/components/connect-wallet-button';
import { toast } from 'sonner';
import { usePrices } from '@/hooks/usePrices';

/**
 * TWAP: the order is split into N Dutch-auction slice intents on the Mesh
 * server. Slice k opens k·interval after the first and is filled (Mesh pools,
 * Cauldron, solver) at no less than its minimum, or refunded when its window
 * ends. All slices are funded in one transaction.
 */
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

// The server accepts 1..48 slices and each slice's BCH side >= 10,000 sats. Slices are
// spaced in chain time, which moves about one block (~10 min) at a time, so shorter
// intervals would not actually spread the slices out.
const SLICE_PRESETS = [2, 5, 10, 20];
const INTERVAL_PRESETS = [
  { value: 600, label: '10m' },
  { value: 1800, label: '30m' },
  { value: 3600, label: '1h' },
  { value: 14400, label: '4h' },
];
const SLIPPAGE_PRESETS = [50, 100, 200, 500]; // bps
const MIN_SLICE_SATS = 10_000;

const toBase = (v: string, decimals: number) => Math.floor(Number(v || 0) * Math.pow(10, decimals));
const fromBase = (v: string | number, decimals: number) => Number(v) / Math.pow(10, decimals);

export function TWAPOrderForm({
  sellToken,
  buyToken,
  sellAmount,
  onOrderPlaced,
  userAddress,
  userPkh,
  isConnected = true,
  sellBalance = null,
}: TWAPOrderFormProps) {
  const [numSlices, setNumSlices] = useState<number>(5);
  const [intervalSec, setIntervalSec] = useState<number>(600);
  const [slippageBps, setSlippageBps] = useState<number>(100);
  const [quote, setQuote] = useState<SliceQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);

  const { prices } = usePrices();
  const { quoteSlice, submitOrder, loading } = useTWAP();

  const isSellBCH = sellToken.chain === 'bch' && (sellToken.symbol === 'BCH' || sellToken.type === 'native');
  const isBuyBCH = buyToken.chain === 'bch' && (buyToken.symbol === 'BCH' || buyToken.type === 'native');
  const tokenIn = isSellBCH ? '0x' : (sellToken.categoryId ?? '');
  const tokenOut = isBuyBCH ? '0x' : (buyToken.categoryId ?? '');
  const sellDecimals = sellToken.decimals ?? (isSellBCH ? 8 : 0);
  const buyDecimals = buyToken.decimals ?? (isBuyBCH ? 8 : 0);

  const sellPrice = prices[sellToken.symbol.replace('.b', '').toUpperCase()]?.price || prices[sellToken.symbol]?.price || 0;

  const totalIn = toBase(sellAmount, sellDecimals);
  const sliceIn = Math.floor(totalIn / numSlices);

  // Executable quote for one slice, debounced
  useEffect(() => {
    setQuote(null); setQuoteError(null);
    if (!tokenIn || !tokenOut || sliceIn <= 0) return;
    let cancelled = false;
    setQuoting(true);
    const t = setTimeout(() => {
      quoteSlice(tokenIn, tokenOut, String(sliceIn))
        .then(q => { if (!cancelled) setQuote(q); })
        .catch(e => { if (!cancelled) setQuoteError(e.message); })
        .finally(() => { if (!cancelled) setQuoting(false); });
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [tokenIn, tokenOut, sliceIn, quoteSlice]);

  const startOut = quote ? BigInt(quote.buyAmount) : 0n;
  const minOut = (startOut * BigInt(10_000 - slippageBps)) / 10_000n;

  const sliceTooSmall = useMemo(() => {
    if (isSellBCH) return sliceIn > 0 && sliceIn < MIN_SLICE_SATS;
    if (isBuyBCH) return quote !== null && minOut < BigInt(MIN_SLICE_SATS);
    return false; // token↔token: the server values it and says so
  }, [isSellBCH, isBuyBCH, sliceIn, quote, minOut]);

  const totalDuration = useMemo(() => {
    const s = (numSlices - 1) * intervalSec;
    if (s < 3600) return `${Math.round(s / 60)} min`;
    return `${(s / 3600).toFixed(1)} h`;
  }, [numSlices, intervalSec]);

  const handlePlaceTwap = async () => {
    const pkh = userPkh || pkhOfAddress(userAddress);
    if (!userAddress || !pkh) { toast.error('Connect your BCH wallet first'); return; }
    if (!quote) { toast.error('No route for this pair right now'); return; }
    const res = await submitOrder({
      creatorAddress: userAddress,
      creatorPkh: pkh,
      tokenIn,
      tokenOut,
      totalAmountIn: String(totalIn),
      numSlices,
      intervalSec,
      startAmountOutPerSlice: startOut.toString(),
      minAmountOutPerSlice: minOut.toString(),
    });
    if (res) {
      toast.success(`TWAP placed: ${numSlices} slices every ${intervalSec / 60} min`, {
        description: `All slices funded in tx ${res.fundingTxid.slice(0, 12)}…`,
        duration: 8000,
      });
      onOrderPlaced?.();
    } else {
      toast.error('TWAP order failed — see the message below the form');
    }
  };

  const fmtOut = (v: bigint) => `${fromBase(v.toString(), buyDecimals).toLocaleString(undefined, { maximumFractionDigits: Math.min(buyDecimals, 8) })} ${buyToken.symbol}`;
  const unsupported = !tokenIn || !tokenOut;

  return (
    <div className="space-y-4 pt-1">
      {/* ── 1. Slices ── */}
      <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <label className="text-zinc-400 font-semibold flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            Number of Slices
          </label>
          <span className="font-mono text-zinc-300 font-bold">{numSlices} slices</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {SLICE_PRESETS.map(n => (
            <button key={n} type="button" onClick={() => setNumSlices(n)}
              className={cn('py-1.5 rounded-xl text-xs font-mono font-bold transition-all border',
                numSlices === n ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-sm' : 'bg-white/[0.02] border-white/5 text-zinc-400 hover:text-white hover:bg-white/[0.05]')}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* ── 2. Interval ── */}
      <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <label className="text-zinc-400 font-semibold flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            Execution Interval
          </label>
          <span className="font-mono text-zinc-300 font-bold">every {intervalSec >= 3600 ? `${intervalSec / 3600} h` : `${intervalSec / 60} min`}</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {INTERVAL_PRESETS.map(p => (
            <button key={p.value} type="button" onClick={() => setIntervalSec(p.value)}
              className={cn('py-1.5 rounded-xl text-xs font-mono font-bold transition-all border',
                intervalSec === p.value ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-sm' : 'bg-white/[0.02] border-white/5 text-zinc-400 hover:text-white hover:bg-white/[0.05]')}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 3. Price protection ── */}
      <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <label className="text-zinc-400 font-semibold flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Max slippage per slice
          </label>
          <span className="font-mono text-zinc-300 font-bold">{(slippageBps / 100).toFixed(1)}%</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {SLIPPAGE_PRESETS.map(b => (
            <button key={b} type="button" onClick={() => setSlippageBps(b)}
              className={cn('py-1.5 rounded-xl text-xs font-mono font-bold transition-all border',
                slippageBps === b ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-sm' : 'bg-white/[0.02] border-white/5 text-zinc-400 hover:text-white hover:bg-white/[0.05]')}>
              {(b / 100).toFixed(1)}%
            </button>
          ))}
        </div>
      </div>

      {/* ── 4. Breakdown ── */}
      <div className="p-4 bg-gradient-to-br from-emerald-500/[0.06] via-teal-500/[0.03] to-transparent border border-emerald-500/20 rounded-2xl space-y-2.5 text-xs">
        <Row label="Market price">
          {sellPrice > 0 ? `$${sellPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })} / ${sellToken.symbol}` : '—'}
        </Row>
        <Row label="Slice size">
          {sliceIn > 0 ? `${fromBase(sliceIn, sellDecimals).toLocaleString(undefined, { maximumFractionDigits: Math.min(sellDecimals, 8) })} ${sellToken.symbol}` : '—'}
          {sellPrice > 0 && sliceIn > 0 && <span className="block text-[10px] text-zinc-400">~${(fromBase(sliceIn, sellDecimals) * sellPrice).toFixed(2)}</span>}
        </Row>
        <Row label="Expected per slice">
          {quoting ? <Loader2 className="w-3 h-3 animate-spin inline" /> : quote ? fmtOut(startOut) : '—'}
          {quote?.routeName && <span className="block text-[10px] text-zinc-400">{quote.routeName}</span>}
        </Row>
        <Row label="Minimum per slice">{quote ? fmtOut(minOut) : '—'}</Row>
        <Row label="Duration" last>{totalDuration} · unfilled slices refund after their window</Row>
      </div>

      {(quoteError || sliceTooSmall || unsupported) && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            {unsupported ? 'This token has no category id; TWAP needs a CashToken or BCH on both sides.'
              : sliceTooSmall ? `Each slice must be worth at least ${MIN_SLICE_SATS.toLocaleString()} sats — use fewer slices or a larger amount.`
              : `No route: ${quoteError}`}
          </span>
        </div>
      )}

      {/* ── 5. Submit ── */}
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
          disabled={loading || quoting || !quote || sliceTooSmall || unsupported}
        >
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Placing and funding slices…</>
            : <><Clock className="w-4 h-4 mr-2" /> Place TWAP · {numSlices} slices</>}
        </Button>
      )}
    </div>
  );
}

function Row({ label, children, last }: { label: string; children: ReactNode; last?: boolean }) {
  return (
    <div className={cn('flex items-start justify-between gap-3', !last && 'pb-2 border-b border-emerald-500/10')}>
      <span className="text-zinc-400 font-medium">{label}</span>
      <span className="font-mono font-bold text-white text-right">{children}</span>
    </div>
  );
}
