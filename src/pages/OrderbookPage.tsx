import React from 'react';
import { OrderbookLadder } from '@/components/orderbook/OrderbookLadder';
import { Compass, Zap, PlusCircle, TrendingUp, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function OrderbookPage() {
  return (
    <div className="container mx-auto py-6 px-4 md:px-8 max-w-[1280px] space-y-8">
      {/* Aqua Electric Blue Hero Header */}
      <div className="w-full bg-[#0038ff] rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-2xl border border-blue-400/20">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-400/20 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-white text-xs font-mono font-semibold">
              <Zap className="w-3.5 h-3.5 text-blue-200" />
              On-Chain UTXO Liquidity Depth
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white font-heading tracking-tight">
              Order Book Explorer
            </h1>
            <p className="text-xs sm:text-sm text-blue-100 max-w-xl leading-relaxed">
              Inspect real-time UTXO liquidity depth, limit price rungs, and active Strategy Mesh covenants across Bitcoin Cash chipnet.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link to="/mesh?tab=pools">
              <Button
                variant="outline"
                className="h-10 px-4 rounded-full border-white/20 bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all hover:scale-105"
              >
                <TrendingUp className="w-3.5 h-3.5 text-blue-200" />
                <span>Pools</span>
              </Button>
            </Link>

            <Link to="/mesh?tab=leaderboard">
              <Button
                variant="outline"
                className="h-10 px-4 rounded-full border-white/20 bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all hover:scale-105"
              >
                <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                <span>Leaderboard</span>
              </Button>
            </Link>

            <Link to="/mesh?tab=create">
              <Button
                className="h-10 px-5 rounded-full bg-white text-blue-900 hover:bg-blue-50 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-black/20 transition-all hover:scale-105"
              >
                <PlusCircle className="w-4 h-4 text-blue-700" />
                <span>New Position</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* CLOB Ladder Render */}
      <OrderbookLadder />
    </div>
  );
}

export default OrderbookPage;
