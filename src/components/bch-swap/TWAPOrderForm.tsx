import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Clock, Layers, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Token } from '@/types';
import { useTWAP, pkhOfAddress, type SliceQuote } from '@/hooks/useTWAP';
import { ConnectWalletButton } from '@/components/connect-wallet-button';
import { toast } from 'sonner';
import { usePrices } from '@/hooks/usePrices';
import { SLIPPAGE_BPS_PRESETS, getAppSettings } from '@/lib/appSettings';
import { useWDK } from '@/context/WDKProvider';
import { walletUi } from '@/lib/walletUi';
import { QuoteCard, QuoteRow } from './QuoteCard';

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
const SLIPPAGE_PRESETS = SLIPPAGE_BPS_PRESETS; // bps
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
  const [slippageBps, setSlippageBps] = useState<number>(() => getAppSettings().defaultSlippageBps);
  const [quote, setQuote] = useState<SliceQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);

  const { prices } = usePrices();
  const network = useWDK().bchNetwork;
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
      // The order's own card, with its slices, the way a bridge shows its steps.
      walletUi.openOrder({ source: 'twap', id: res.order.orderId });
    } else {
      toast.error('TWAP order failed — see the message below the form');
    }
  };

  const fmtOut = (v: bigint) => `${fromBase(v.toString(), buyDecimals).toLocaleString(undefined, { maximumFractionDigits: Math.min(buyDecimals, 8) })} ${buyToken.symbol}`;
  const unsupported = !tokenIn || !tokenOut;

  const chip = (selected: boolean) => cn(
    'px-2.5 py-0.5 rounded-md text-xs font-semibold transition-colors border',
    selected ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'text-white/50 hover:text-white border-transparent',
  );
  const intervalLabel = intervalSec >= 3600 ? `${intervalSec / 3600}h` : `${intervalSec / 60}m`;

  return (
    <div className="space-y-3">
      {/* ── Schedule and price protection: one card, in the swap card's own style ── */}
      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-3">
        <Setting icon={<Layers className="h-3.5 w-3.5" />} label="Slices">
          {SLICE_PRESETS.map(n => (
            <button key={n} type="button" aria-pressed={numSlices === n} onClick={() => setNumSlices(n)} className={chip(numSlices === n)}>{n}</button>
          ))}
        </Setting>
        <Setting icon={<Clock className="h-3.5 w-3.5" />} label="Every" divided>
          {INTERVAL_PRESETS.map(p => (
            <button key={p.value} type="button" aria-pressed={intervalSec === p.value} onClick={() => setIntervalSec(p.value)} className={chip(intervalSec === p.value)}>{p.label}</button>
          ))}
        </Setting>
        <Setting icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Max slippage" divided>
          {SLIPPAGE_PRESETS.map(b => (
            <button key={b} type="button" aria-pressed={slippageBps === b} onClick={() => setSlippageBps(b)} className={chip(slippageBps === b)}>{(b / 100).toFixed(1)}%</button>
          ))}
        </Setting>
      </div>

      {/* ── The quote, as every other pair shows it ── */}
      <QuoteCard
        icon={<Clock className="h-3 w-3" />}
        tone="teal"
        label="TWAP"
        provider={`${numSlices} slices · every ${intervalLabel} · ${network === 'mainnet' ? 'Mainnet' : 'Testnet'}`}
        aside={`About ${totalDuration}`}
      >
        <QuoteRow label="You send" value={totalIn > 0 ? `${fromBase(totalIn, sellDecimals).toLocaleString(undefined, { maximumFractionDigits: Math.min(sellDecimals, 8) })} ${sellToken.symbol}` : '—'} hint={sellPrice > 0 && totalIn > 0 ? `~$${(fromBase(totalIn, sellDecimals) * sellPrice).toFixed(2)}` : undefined} />
        <QuoteRow label="Each slice" value={sliceIn > 0 ? `${fromBase(sliceIn, sellDecimals).toLocaleString(undefined, { maximumFractionDigits: Math.min(sellDecimals, 8) })} ${sellToken.symbol}` : '—'} />
        <QuoteRow label="Expected per slice" value={quoting ? <Loader2 className="inline h-3 w-3 animate-spin" /> : quote ? `≈ ${fmtOut(startOut)}` : '—'} hint={quote?.routeName} />
        <QuoteRow label="At least per slice" value={quote ? fmtOut(minOut) : '—'} hint={`${(slippageBps / 100).toFixed(1)}% slippage`} />
        <QuoteRow label="You receive" strong value={quote ? `≈ ${fmtOut(startOut * BigInt(numSlices))}` : '—'} />
        <p className="pt-1 text-xs text-white/40">All slices are funded in one transaction. A slice that is not filled in its window is refunded.</p>
      </QuoteCard>

      {(quoteError || sliceTooSmall || unsupported) && (
        <div className="flex items-start gap-2 text-xs text-amber-200/80 bg-amber-500/[0.06] border border-amber-500/20 rounded-lg px-2.5 py-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
          <span>
            {unsupported ? 'This token has no category id; TWAP needs a CashToken or BCH on both sides.'
              : sliceTooSmall ? `Each slice must be worth at least ${MIN_SLICE_SATS.toLocaleString()} sats — use fewer slices or a larger amount.`
              : `No route: ${quoteError}`}
          </span>
        </div>
      )}

      {/* ── Submit ── */}
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
          className="w-full h-14 text-base font-semibold bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 rounded-2xl shadow-lg shadow-emerald-500/20 disabled:from-white/[0.04] disabled:to-white/[0.04] disabled:text-white/40 disabled:shadow-none transition-all"
          onClick={handlePlaceTwap}
          disabled={loading || quoting || !quote || sliceTooSmall || unsupported}
        >
          {loading
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Placing and funding slices…</>
            : `Place TWAP · ${sellToken.symbol} → ${buyToken.symbol}`}
        </Button>
      )}
    </div>
  );
}

function Setting({ icon, label, divided, children }: { icon: ReactNode; label: string; divided?: boolean; children: ReactNode }) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-y-2', divided && 'pt-3 border-t border-white/[0.04]')}>
      <span className="flex items-center gap-1.5 text-sm text-white/50"><span className="text-emerald-400">{icon}</span>{label}</span>
      <div className="flex flex-wrap justify-end gap-1">{children}</div>
    </div>
  );
}
