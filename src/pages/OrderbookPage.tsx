import React from 'react';
import { OrderbookLadder } from '@/components/orderbook/OrderbookLadder';
import { Compass } from 'lucide-react';

export function OrderbookPage() {
  return (
    <div className="container mx-auto p-4 md:p-8 max-w-[1280px] mt-4 space-y-8">
      {/* Page Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400">
            <Compass className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-black text-white tracking-tight">
              Visual Order Book Explorer
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Inspect live UTXO liquidity depth across active Strategy Mesh Covenants
            </p>
          </div>
        </div>
      </div>

      {/* CLOB Ladder Render */}
      <OrderbookLadder />
    </div>
  );
}

export default OrderbookPage;
