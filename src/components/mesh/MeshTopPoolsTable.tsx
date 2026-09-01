import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  SlidersHorizontal,
  TrendingUp,
  Activity,
  RotateCcw,
  Layers,
  ArrowUpRight,
  Sparkles,
  PlusCircle,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import { useMeshServer, type MeshPosition } from '@/hooks/useMeshServer';
import { tokenSymbol } from '@/lib/meshContracts';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface PoolMarketItem {
  id: string;
  pairName: string;
  baseSymbol: string;
  quoteSymbol: string;
  quoteCategoryId?: string;
  strategyType: 'Fixed Rate' | 'Oracle Spot Curve' | 'Dutch Decay' | 'Multi-Market Mode 4';
  feeTier: number; // e.g. 0.25
  tvlUsd: number;
  tvlBch: number;
  volume24h: number;
  fees24h: number;
  apy7d: number;
  priceUsd: number;
  priceChange24h: number;
  activeUtxos: number;
}

const DEFAULT_MARKET_POOLS: PoolMarketItem[] = [
  {
    id: 'bch-pusd',
    pairName: 'BCH / pUSD',
    baseSymbol: 'BCH',
    quoteSymbol: 'pUSD',
    quoteCategoryId: 'f94d9302e1a4ef4f6479a95786a347db7e94a8ad07efcfafcfba1396b2aa6d1b',
    strategyType: 'Multi-Market Mode 4',
    feeTier: 0.25,
    tvlUsd: 584200,
    tvlBch: 1800.86,
    volume24h: 142800,
    fees24h: 357,
    apy7d: 22.4,
    priceUsd: 324.40,
    priceChange24h: 2.4,
    activeUtxos: 8,
  },
  {
    id: 'bch-musd',
    pairName: 'BCH / mUSD',
    baseSymbol: 'BCH',
    quoteSymbol: 'mUSD',
    quoteCategoryId: '900224219a164daab2f4b4b248a3794ef64a3ef5a92a5efcfafcfa1396b2aa6d',
    strategyType: 'Oracle Spot Curve',
    feeTier: 0.30,
    tvlUsd: 392100,
    tvlBch: 1208.70,
    volume24h: 96400,
    fees24h: 289,
    apy7d: 26.8,
    priceUsd: 324.15,
    priceChange24h: 1.8,
    activeUtxos: 5,
  },
  {
    id: 'bch-fur',
    pairName: 'BCH / FUR',
    baseSymbol: 'BCH',
    quoteSymbol: 'FUR',
    quoteCategoryId: 'c74f5192e1a4ef4f6479a95786a347db7e94a8ad07efcfafcfba1396b2aa6d1b',
    strategyType: 'Multi-Market Mode 4',
    feeTier: 0.50,
    tvlUsd: 215400,
    tvlBch: 664.00,
    volume24h: 78500,
    fees24h: 392,
    apy7d: 66.5,
    priceUsd: 48.20,
    priceChange24h: 8.5,
    activeUtxos: 6,
  },
  {
    id: 'bch-usdc',
    pairName: 'BCH / USDC',
    baseSymbol: 'BCH',
    quoteSymbol: 'USDC',
    quoteCategoryId: 'usdc_cashtoken_category',
    strategyType: 'Fixed Rate',
    feeTier: 0.05,
    tvlUsd: 495000,
    tvlBch: 1525.89,
    volume24h: 184000,
    fees24h: 92,
    apy7d: 6.8,
    priceUsd: 324.40,
    priceChange24h: 2.4,
    activeUtxos: 4,
  },
  {
    id: 'bch-wbtc',
    pairName: 'BCH / WBTC',
    baseSymbol: 'BCH',
    quoteSymbol: 'WBTC',
    quoteCategoryId: 'wbtc_cashtoken_category',
    strategyType: 'Dutch Decay',
    feeTier: 0.30,
    tvlUsd: 148000,
    tvlBch: 456.22,
    volume24h: 42000,
    fees24h: 126,
    apy7d: 31.2,
    priceUsd: 0.00342,
    priceChange24h: -0.4,
    activeUtxos: 3,
  },
];

interface MeshTopPoolsTableProps {
  onSelectDeposit?: (pool: PoolMarketItem) => void;
}

export function MeshTopPoolsTable({ onSelectDeposit }: MeshTopPoolsTableProps) {
  const { positions, bchUsdPrice } = useMeshServer(15_000);
  const livePrice = bchUsdPrice() || 324.4;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStrategy, setSelectedStrategy] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'tvl' | 'volume' | 'apy'>('tvl');
  const [sortAsc, setSortAsc] = useState(false);

  // Merge live server position counts into default pool items
  const poolsData = useMemo(() => {
    return DEFAULT_MARKET_POOLS.map((pool) => {
      const matchCount = positions.filter((p) => {
        const sym = tokenSymbol(p.tokenCategoryIn || p.tokenCategoryOut || '').toUpperCase();
        return pool.pairName.toUpperCase().includes(sym);
      }).length;

      return {
        ...pool,
        activeUtxos: matchCount > 0 ? matchCount : pool.activeUtxos,
        priceUsd: pool.quoteSymbol.includes('USD') ? livePrice : pool.priceUsd,
      };
    });
  }, [positions, livePrice]);

  // Filter and sort
  const filteredPools = useMemo(() => {
    return poolsData
      .filter((p) => {
        const matchesSearch =
          p.pairName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.quoteSymbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.baseSymbol.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStrategy =
          selectedStrategy === 'All' ||
          p.strategyType.toLowerCase().includes(selectedStrategy.toLowerCase());

        return matchesSearch && matchesStrategy;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortBy === 'tvl') diff = b.tvlUsd - a.tvlUsd;
        if (sortBy === 'volume') diff = b.volume24h - a.volume24h;
        if (sortBy === 'apy') diff = b.apy7d - a.apy7d;
        return sortAsc ? -diff : diff;
      });
  }, [poolsData, searchQuery, selectedStrategy, sortBy, sortAsc]);

  const handleSort = (field: 'tvl' | 'volume' | 'apy') => {
    if (sortBy === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search & Strategy Filter Pills */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search tokens or pool pairs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-xl bg-white/[0.04] border border-white/8 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
        </div>

        {/* Strategy Pills */}
        <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-black/60 border border-white/8 text-xs">
          {['All', 'Mode 4', 'Fixed Rate', 'Oracle', 'Dutch Decay'].map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedStrategy(tab)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs transition-all',
                selectedStrategy === tab
                  ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30'
                  : 'text-zinc-400 hover:text-white',
              )}
            >
              {tab === 'Mode 4' ? 'Mode 4 Multi-Market' : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Pools Table (Uniswap Style) */}
      <div className="rounded-3xl border border-white/10 bg-[#0c0c10] overflow-hidden shadow-2xl backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            {/* Table Header */}
            <thead>
              <tr className="border-b border-white/8 bg-white/[0.02] text-zinc-400 font-mono">
                <th className="py-4 px-5 font-semibold w-12">#</th>
                <th className="py-4 px-5 font-semibold">Pool Pair</th>
                <th
                  onClick={() => handleSort('tvl')}
                  className="py-4 px-5 font-semibold text-right cursor-pointer hover:text-white transition-colors"
                >
                  <span className="inline-flex items-center gap-1">
                    TVL / Depth <ArrowUpDown className="w-3 h-3 text-zinc-500" />
                  </span>
                </th>
                <th
                  onClick={() => handleSort('volume')}
                  className="py-4 px-5 font-semibold text-right cursor-pointer hover:text-white transition-colors"
                >
                  <span className="inline-flex items-center gap-1">
                    24h Volume <ArrowUpDown className="w-3 h-3 text-zinc-500" />
                  </span>
                </th>
                <th
                  onClick={() => handleSort('apy')}
                  className="py-4 px-5 font-semibold text-right cursor-pointer hover:text-white transition-colors"
                >
                  <span className="inline-flex items-center gap-1">
                    7d APY / 24h Fees <ArrowUpDown className="w-3 h-3 text-zinc-500" />
                  </span>
                </th>
                <th className="py-4 px-5 font-semibold text-right">Midpoint Price</th>
                <th className="py-4 px-5 font-semibold text-right">Actions</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-white/5">
              {filteredPools.map((pool, idx) => {
                return (
                  <tr
                    key={pool.id}
                    className="hover:bg-white/[0.02] transition-colors group"
                  >
                    {/* Rank */}
                    <td className="py-4 px-5 font-mono text-zinc-500">{idx + 1}</td>

                    {/* Pool Pair */}
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        {/* Overlapping Token Badges */}
                        <div className="flex -space-x-2 relative shrink-0">
                          <div className="w-8 h-8 rounded-full bg-emerald-500/20 border-2 border-[#0c0c10] flex items-center justify-center overflow-hidden">
                            <img src="/logos/bitcoin-cash-bch-logo.svg" alt="BCH" className="w-5 h-5" />
                          </div>
                          <div className="w-8 h-8 rounded-full bg-cyan-500/20 border-2 border-[#0c0c10] flex items-center justify-center font-mono text-[10px] font-bold text-cyan-300">
                            {pool.quoteSymbol.slice(0, 3)}
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-white group-hover:text-emerald-400 transition-colors">
                              {pool.pairName}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 text-[10px] font-mono border border-white/5">
                              {pool.feeTier}%
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-mono text-emerald-400 font-semibold">
                              {pool.strategyType}
                            </span>
                            <span className="text-zinc-600 text-[10px]">•</span>
                            <span className="text-[10px] font-mono text-zinc-500">
                              {pool.activeUtxos} live covenants
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* TVL */}
                    <td className="py-4 px-5 text-right font-mono">
                      <div className="font-bold text-white text-sm">
                        ${pool.tvlUsd.toLocaleString()}
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        {pool.tvlBch.toLocaleString()} BCH
                      </div>
                    </td>

                    {/* 24h Volume */}
                    <td className="py-4 px-5 text-right font-mono">
                      <div className="font-bold text-white text-sm">
                        ${pool.volume24h.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-emerald-400">
                        +{(pool.volume24h * 0.05).toFixed(0)} sats/v
                      </div>
                    </td>

                    {/* APY & Fees */}
                    <td className="py-4 px-5 text-right font-mono">
                      <div className="font-bold text-emerald-400 text-sm flex items-center justify-end gap-1">
                        <TrendingUp className="w-3 h-3" />
                        {pool.apy7d}%
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        ${pool.fees24h}/day fees
                      </div>
                    </td>

                    {/* Price */}
                    <td className="py-4 px-5 text-right font-mono">
                      <div className="font-bold text-white text-sm">
                        ${pool.priceUsd.toFixed(2)}
                      </div>
                      <div
                        className={cn(
                          'text-[10px]',
                          pool.priceChange24h >= 0 ? 'text-emerald-400' : 'text-red-400',
                        )}
                      >
                        {pool.priceChange24h >= 0 ? '+' : ''}
                        {pool.priceChange24h}%
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {onSelectDeposit ? (
                          <Button
                            size="sm"
                            onClick={() => onSelectDeposit(pool)}
                            className="h-8 px-3.5 rounded-full bg-emerald-400 hover:bg-emerald-300 text-black font-bold text-xs shadow-md shadow-emerald-500/20"
                          >
                            Deposit
                          </Button>
                        ) : (
                          <Link
                            to="/mesh"
                            className="h-8 px-3.5 rounded-full bg-emerald-400 hover:bg-emerald-300 text-black font-bold text-xs inline-flex items-center shadow-md shadow-emerald-500/20"
                          >
                            Deposit
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
