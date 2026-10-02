import { useState, type ReactNode } from 'react';
import { useTWAP } from '@/hooks/useTWAP';
import { useTokenInfo } from '@/components/mesh/pools/shared';
import { Badge } from '@/components/ui/badge';
import { Clock, ChevronDown, ChevronUp, ExternalLink, RefreshCw, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TwapOrderRecord, TwapSliceView } from '@/types';

/**
 * The user's TWAP orders as the server tracks them: every slice is an intent
 * that is filled on chain or refunded after its window. Slices can't be
 * cancelled early; unfunded slices never start.
 */
const STATUS_STYLE: Record<TwapOrderRecord['status'], string> = {
  AWAITING_FUNDING: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  RUNNING: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  COMPLETED: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  PARTIALLY_FILLED: 'bg-teal-500/10 text-teal-300 border-teal-500/30',
  REFUNDED: 'bg-red-500/10 text-red-300 border-red-500/30',
};

const received = (s: TwapSliceView) =>
  s.fillSources ? BigInt(s.fillSources.mesh) + BigInt(s.fillSources.cauldron) + BigInt(s.fillSources.solver) : 0n;

export function TWAPOrderHistory() {
  const { orders, refreshOrders } = useTWAP(4000);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const tokens = useTokenInfo(orders.flatMap(o => [o.tokenIn, o.tokenOut]));

  const asset = (cat: string) => (cat === '0x'
    ? { symbol: 'BCH', decimals: 8 }
    : { symbol: tokens.get(cat).symbol, decimals: tokens.get(cat).decimals });
  const amount = (v: bigint | string, cat: string) => {
    const a = asset(cat);
    return `${(Number(v) / 10 ** a.decimals).toLocaleString(undefined, { maximumFractionDigits: Math.min(a.decimals, 8) })} ${a.symbol}`;
  };
  const time = (ts: number) => new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/10 rounded-3xl p-5 md:p-6 shadow-2xl space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-500/15 rounded-xl border border-emerald-500/30 text-emerald-400">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-heading font-black text-sm text-white tracking-tight">TWAP Orders</h3>
            <p className="text-[11px] text-zinc-400">Each slice fills on chain or refunds after its window</p>
          </div>
        </div>
        <button onClick={() => { void refreshOrders(); }} title="Refresh orders"
          className="p-2 text-zinc-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-xl transition-all">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 max-h-[550px] pr-1">
        {orders.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center mx-auto text-zinc-500">
              <Zap className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-zinc-300">No TWAP orders found</p>
          </div>
        ) : orders.map(order => {
          const open = expandedId === order.orderId;
          const pct = Math.round((order.slicesFilled / order.numSlices) * 100);
          const got = order.slices.reduce((a, s) => a + received(s), 0n);
          const live = order.status === 'RUNNING' || order.status === 'AWAITING_FUNDING';
          return (
            <div key={order.orderId} className={cn('p-4 rounded-2xl border space-y-3',
              live ? 'bg-emerald-500/[0.04] border-emerald-500/30' : 'bg-white/[0.02] border-white/10')}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-white tracking-wider">
                  {asset(order.tokenIn).symbol} → {asset(order.tokenOut).symbol}
                  <span className="ml-2 text-[10px] font-mono font-normal text-zinc-400">#{order.orderId.slice(0, 8)}</span>
                </span>
                <Badge variant="outline" className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5', STATUS_STYLE[order.status])}>
                  {order.status.replace('_', ' ')}
                </Badge>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Filled</span>
                  <span className="font-mono font-bold text-white">
                    {order.slicesFilled} / {order.numSlices}{order.slicesRefunded ? ` · ${order.slicesRefunded} refunded` : ''}
                  </span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden p-0.5">
                  <div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(4, pct))}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center">
                <Metric label="Selling">{amount(order.totalAmountIn, order.tokenIn)}</Metric>
                <Metric label="Received" accent>{amount(got, order.tokenOut)}</Metric>
              </div>

              <button onClick={() => setExpandedId(open ? null : order.orderId)}
                className="text-[11px] font-semibold text-zinc-400 hover:text-white flex items-center gap-1">
                {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {open ? 'Hide slices' : `View ${order.numSlices} slices`}
              </button>

              {open && (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 border-t border-white/10 pt-2">
                  {order.slices.map((s, i) => {
                    const tx = s.fillTxid ?? s.refundTxid;
                    return (
                      <div key={s.intentId} className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5 text-[11px]">
                        <div className="space-y-0.5">
                          <div className="font-mono font-bold text-white">
                            #{(s.twapSliceIndex ?? i) + 1} · {amount(s.sellAmount, order.tokenIn)} → {s.status === 'filled' ? amount(received(s), order.tokenOut) : `min ${amount(s.minAmountOut, order.tokenOut)}`}
                          </div>
                          <div className="text-[10px] text-zinc-500">
                            {s.status}{s.fillMethod ? ` · ${s.fillMethod}` : ''}
                            {s.status === 'awaiting_funding' || s.status === 'filled' || s.status === 'refunded' ? '' : ` · refund after ${time(s.refundEligibleAt)}`}
                            {s.lastFillError ? ` · ${s.lastFillError}` : ''}
                          </div>
                        </div>
                        {tx && s.explorerUrl && (
                          <a href={s.explorerUrl} target="_blank" rel="noreferrer" title="View transaction"
                            className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-emerald-400">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ label, children, accent }: { label: string; children: ReactNode; accent?: boolean }) {
  return (
    <div className="p-2 bg-white/[0.03] rounded-xl border border-white/5">
      <div className="text-[10px] text-zinc-500">{label}</div>
      <div className={cn('text-xs font-mono font-bold', accent ? 'text-emerald-400' : 'text-zinc-200')}>{children}</div>
    </div>
  );
}
