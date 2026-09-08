import React, { useState } from 'react';
import { useTWAP } from '@/hooks/useTWAP';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Clock, CheckCircle2, AlertCircle, XCircle, ChevronDown, ChevronUp,
  ExternalLink, Loader2, Sparkles, RefreshCw, Zap, TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function TWAPOrderHistory() {
  const { orders, cancelOrder, refreshOrders } = useTWAP(4000);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const handleCancel = async (orderId: string) => {
    setCancellingId(orderId);
    try {
      const ok = await cancelOrder(orderId);
      if (ok) {
        toast.success('TWAP order cancelled successfully');
      } else {
        toast.error('Failed to cancel TWAP order');
      }
    } finally {
      setCancellingId(null);
    }
  };

  const formatTime = (ts: number) => {
    return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatAddress = (addr: string) => {
    if (!addr || addr.length <= 16) return addr;
    return `${addr.slice(0, 10)}…${addr.slice(-6)}`;
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/10 rounded-3xl p-5 md:p-6 shadow-2xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-500/15 rounded-xl border border-emerald-500/30 text-emerald-400">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-heading font-black text-sm text-white tracking-tight flex items-center gap-1.5">
              TWAP Orders
              <span className="text-[10px] font-mono font-normal px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                Live Engine
              </span>
            </h3>
            <p className="text-[11px] text-zinc-400">Time-sliced order execution queue</p>
          </div>
        </div>

        <button
          onClick={() => { void refreshOrders(); }}
          className="p-2 text-zinc-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-xl transition-all"
          title="Refresh orders"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Orders List */}
      <div className="flex-1 overflow-y-auto space-y-3 max-h-[550px] pr-1">
        {orders.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center mx-auto text-zinc-500">
              <Zap className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-zinc-300">No TWAP orders found</p>
            <p className="text-xs text-zinc-500 max-w-xs mx-auto">
              Configure order size, number of slices, and execution intervals to place your first TWAP order.
            </p>
          </div>
        ) : (
          orders.map((order) => {
            const isExpanded = expandedId === order.orderId;
            const progressPct = Math.round((order.slicesCompleted / order.numSlices) * 100);
            const isRunning = order.status === 'RUNNING' || order.status === 'PENDING';

            return (
              <div
                key={order.orderId}
                className={cn(
                  "p-4 rounded-2xl border transition-all space-y-3",
                  isRunning
                    ? "bg-emerald-500/[0.04] border-emerald-500/30 hover:border-emerald-500/50"
                    : order.status === 'COMPLETED'
                    ? "bg-white/[0.02] border-white/10"
                    : "bg-red-500/[0.02] border-red-500/20 opacity-75"
                )}
              >
                {/* Top Row: Asset Pair & Status Badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-white uppercase tracking-wider">
                      {order.side} {order.tokenIn === '0x' ? 'BCH' : 'pUSD'} → {order.tokenOut === '0x' ? 'BCH' : 'pUSD'}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      #{order.orderId.slice(0, 8)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isRunning && (
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                    )}
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5",
                        order.status === 'COMPLETED'
                          ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                          : isRunning
                          ? "bg-blue-500/10 text-blue-300 border-blue-500/30"
                          : "bg-red-500/10 text-red-300 border-red-500/30"
                      )}
                    >
                      {order.status}
                    </Badge>
                  </div>
                </div>

                {/* Progress Bar & Slices Count */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400 font-medium">Progress</span>
                    <span className="font-mono font-bold text-white">
                      {order.slicesCompleted} / {order.numSlices} Slices ({progressPct}%)
                    </span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden p-0.5">
                    <div
                      className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(5, progressPct))}%` }}
                    />
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                  <div className="p-2 bg-white/[0.03] rounded-xl border border-white/5">
                    <div className="text-[10px] text-zinc-500">Filled Amount</div>
                    <div className="text-xs font-mono font-bold text-zinc-200">
                      {order.accumulatedAmountIn} / {order.totalAmountIn}
                    </div>
                  </div>
                  <div className="p-2 bg-white/[0.03] rounded-xl border border-white/5">
                    <div className="text-[10px] text-zinc-500">Output Received</div>
                    <div className="text-xs font-mono font-bold text-emerald-400">
                      {order.tokenOut === '0x'
                        ? `${(Number(order.accumulatedAmountOut) / 1e8).toFixed(6)} BCH`
                        : `${order.accumulatedAmountOut} CT`}
                    </div>
                  </div>
                  <div className="p-2 bg-white/[0.03] rounded-xl border border-white/5">
                    <div className="text-[10px] text-zinc-500">Interval</div>
                    <div className="text-xs font-mono font-bold text-zinc-200">
                      {order.intervalSec}s
                    </div>
                  </div>
                </div>

                {/* Action Buttons & Expand Toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : order.orderId)}
                    className="text-[11px] font-semibold text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    <span>{isExpanded ? 'Hide Slices' : `View ${order.sliceFills.length} Fills`}</span>
                  </button>

                  {isRunning && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCancel(order.orderId)}
                      disabled={cancellingId === order.orderId}
                      className="h-7 px-2.5 text-[11px] font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg"
                    >
                      {cancellingId === order.orderId ? (
                        <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Cancelling…</>
                      ) : (
                        <><XCircle className="w-3 h-3 mr-1" /> Cancel Order</>
                      )}
                    </Button>
                  )}
                </div>

                {/* Expanded Slices Table */}
                {isExpanded && (
                  <div className="pt-2 space-y-2 border-t border-white/10 animate-in fade-in duration-200">
                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                      On-Chain Slice Fill History
                    </div>
                    {order.sliceFills.length === 0 ? (
                      <p className="text-xs text-zinc-500 italic py-2">
                        Waiting for first slice execution interval…
                      </p>
                    ) : (
                      <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                        {order.sliceFills.map((fill, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5 text-[11px]"
                          >
                            <div className="space-y-0.5">
                              <div className="font-mono font-bold text-white">
                                Slice #{fill.sliceIndex + 1}: {fill.amountIn} in → {fill.amountOut} sats out
                              </div>
                              <div className="text-[10px] text-zinc-500">
                                {formatTime(fill.executedAt)} · Pool: {formatAddress(fill.poolAddress)}
                              </div>
                            </div>

                            <a
                              href={`https://chipnet.imaginary.cash/tx/${fill.txid}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-emerald-400 transition-colors"
                              title="View Chipnet Transaction"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
