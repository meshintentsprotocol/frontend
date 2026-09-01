import React, { useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Loader2,
  RefreshCw,
  Zap,
  ArrowDownToLine,
  PlusCircle,
  Clock,
  Layers,
} from 'lucide-react';
import { type PoolFillItem } from '@/hooks/usePoolFills';

interface MeshPoolActivityTableProps {
  fills: PoolFillItem[];
  totalFills: number;
  totalBchVolume: number;
  loading: boolean;
  onRefresh: () => void;
}

export function MeshPoolActivityTable({
  fills,
  totalFills,
  totalBchVolume,
  loading,
  onRefresh,
}: MeshPoolActivityTableProps) {
  const [filter, setFilter] = useState<'ALL' | 'SWAP_FILL' | 'TOP_UP' | 'DOCK'>('ALL');

  const filteredFills = fills.filter((f) => {
    if (filter === 'ALL') return true;
    return f.type === filter;
  });

  return (
    <div className="p-6 bg-gradient-to-br from-[#0D0D10] to-[#121216] border border-white/10 rounded-3xl space-y-5 shadow-2xl backdrop-blur-xl">
      {/* Header & Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-teal-400" />
            <span>Pool Transactions &amp; Fill Feed</span>
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Real-time on-chain transaction history for this liquidity covenant on Chipnet.
          </p>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-black/40 border border-white/5 rounded-2xl overflow-x-auto">
          {[
            { id: 'ALL', label: 'All Events' },
            { id: 'SWAP_FILL', label: 'Swaps' },
            { id: 'TOP_UP', label: 'Deposits' },
            { id: 'DOCK', label: 'Withdrawals' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                filter === item.id
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table Content */}
      {loading ? (
        <div className="py-16 text-center text-zinc-400 text-xs">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-teal-400 mb-2" />
          <span>Scanning on-chain covenant history…</span>
        </div>
      ) : filteredFills.length === 0 ? (
        <div className="py-16 text-center text-zinc-500 text-xs space-y-2">
          <Activity className="w-8 h-8 mx-auto text-zinc-600 mb-1" />
          <p>No transactions match the selected filter.</p>
          <p className="text-[11px] text-zinc-600">
            Execute a swap or deposit liquidity to generate on-chain activity.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-zinc-400 font-semibold">
                <th className="pb-3">Action</th>
                <th className="pb-3">Flow In</th>
                <th className="pb-3">Flow Out</th>
                <th className="pb-3">Maker Fee Earned</th>
                <th className="pb-3">Timestamp</th>
                <th className="pb-3 text-right">Transaction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {filteredFills.map((f) => {
                const isSwap = f.type === 'SWAP_FILL';
                const isTopUp = f.type === 'TOP_UP';
                const isDock = f.type === 'DOCK';

                return (
                  <tr key={f.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 font-sans">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          isSwap
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : isTopUp
                            ? 'bg-teal-500/10 text-teal-400 border-teal-500/30'
                            : isDock
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            : 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                        }`}
                      >
                        {isSwap && <Zap className="w-3 h-3" />}
                        {isTopUp && <PlusCircle className="w-3 h-3" />}
                        {isDock && <ArrowDownToLine className="w-3 h-3" />}
                        <span>
                          {isSwap
                            ? 'Swap Fill'
                            : isTopUp
                            ? 'Liquidity Top-Up'
                            : isDock
                            ? 'Dock Exit'
                            : f.type}
                        </span>
                      </span>
                    </td>
                    <td className="py-3.5 text-zinc-300">
                      {f.tokenInAmount} {f.tokenInSymbol}
                    </td>
                    <td className="py-3.5 text-zinc-300">
                      {f.tokenOutAmount} {f.tokenOutSymbol}
                    </td>
                    <td className="py-3.5 text-emerald-400 font-bold">
                      +{isSwap ? (parseInt(f.feeSats, 10) / 1e8).toFixed(6) : '0.000000'} BCH
                    </td>
                    <td className="py-3.5 text-zinc-400 font-sans text-xs">
                      {new Date(f.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-3.5 text-right">
                      <a
                        href={f.explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-teal-400 hover:text-teal-300 font-mono text-xs font-semibold"
                      >
                        <span>{f.txid.slice(0, 8)}…</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
