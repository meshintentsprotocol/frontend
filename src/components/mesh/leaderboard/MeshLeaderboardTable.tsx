import React, { useState, useMemo } from 'react';
import {
  type LeaderboardProvider,
  type Timeframe,
  formatUsd,
  getAvatarGradient,
} from '@/lib/meshLeaderboardData';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowUp, ArrowDown, Minus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type SortField =
  | 'volume'
  | 'sharedLiquidity'
  | 'putableLiquidity'
  | 'fees'
  | 'apy'
  | 'positions';

interface MeshLeaderboardTableProps {
  providers: LeaderboardProvider[];
  timeframe: Timeframe;
}

export function MeshLeaderboardTable({ providers, timeframe }: MeshLeaderboardTableProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('volume');
  const [displayCount, setDisplayCount] = useState(15);

  const sortOptions: { id: SortField; label: string }[] = [
    { id: 'volume', label: `Volume, ${timeframe}` },
    { id: 'sharedLiquidity', label: 'Shared liquidity' },
    { id: 'putableLiquidity', label: 'Putable liquidity' },
    { id: 'fees', label: `Fees, ${timeframe}` },
    { id: 'apy', label: `APY, ${timeframe}` },
    { id: 'positions', label: 'Positions' },
  ];

  const maxVolume = useMemo(() => {
    return Math.max(...providers.map((p) => p.volumeUsd), 1);
  }, [providers]);

  const filteredAndSortedProviders = useMemo(() => {
    return providers
      .filter((p) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          p.address.toLowerCase().includes(q) ||
          p.shortAddress.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        switch (sortField) {
          case 'volume':
            return b.volumeUsd - a.volumeUsd;
          case 'sharedLiquidity':
            return b.sharedLiquidityUsd - a.sharedLiquidityUsd;
          case 'putableLiquidity':
            return b.putableLiquidityUsd - a.putableLiquidityUsd;
          case 'fees':
            return b.feesUsd - a.feesUsd;
          case 'apy':
            return b.apyPct - a.apyPct;
          case 'positions':
            return b.positionsCount - a.positionsCount;
          default:
            return 0;
        }
      });
  }, [providers, searchQuery, sortField]);

  const visibleProviders = filteredAndSortedProviders.slice(0, displayCount);

  return (
    <div className="bg-[#0b0c10] border border-white/8 rounded-3xl p-5 sm:p-7 space-y-6 shadow-xl">
      {/* Search and Table Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-white font-heading">
          Volume race, {timeframe}
        </h2>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by address or wallet..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-white/5 border border-white/10 rounded-full text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* Sort Pills Row */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <span className="text-xs text-zinc-400 font-medium whitespace-nowrap mr-1">
          Sort by
        </span>
        {sortOptions.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setSortField(opt.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
              sortField === opt.id
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border border-white/5'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Leaderboard Table Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[620px]">
          <thead>
            <tr className="border-b border-white/5 text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
              <th className="pb-3 w-16">Rank</th>
              <th className="pb-3 min-w-[180px]">Liquidity provider</th>
              <th className="pb-3 w-72">
                <div className="flex justify-between px-1">
                  <span>$0</span>
                  <span>$125M</span>
                  <span>$250M</span>
                  <span>$375M</span>
                  <span>$500M</span>
                </div>
              </th>
              <th className="pb-3 text-right pr-2">Shared liquidity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {visibleProviders.map((provider) => {
              const volumePct = Math.min((provider.volumeUsd / maxVolume) * 100, 100);

              return (
                <tr
                  key={provider.address}
                  onClick={() => navigate(`/mesh/provider/${provider.address}`)}
                  className="group hover:bg-white/[0.03] transition-colors cursor-pointer"
                >
                  {/* Rank Column */}
                  <td className="py-3.5 pl-1">
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="text-sm font-bold text-white">
                        {provider.rank}
                      </span>
                      {provider.isNew ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          NEW
                        </span>
                      ) : provider.rankDelta > 0 ? (
                        <span className="flex items-center text-[11px] font-bold text-emerald-400">
                          <ArrowUp className="w-3 h-3" />
                          {provider.rankDelta}
                        </span>
                      ) : provider.rankDelta < 0 ? (
                        <span className="flex items-center text-[11px] font-bold text-red-400">
                          <ArrowDown className="w-3 h-3" />
                          {Math.abs(provider.rankDelta)}
                        </span>
                      ) : (
                        <span className="text-[11px] text-zinc-500">
                          <Minus className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Liquidity Provider Identity */}
                  <td className="py-3.5">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex-shrink-0 shadow-md border border-white/10"
                        style={{ background: getAvatarGradient(provider.address) }}
                      />
                      <div className="font-mono text-sm text-zinc-200 group-hover:text-blue-400 transition-colors font-medium">
                        {provider.shortAddress}
                      </div>
                    </div>
                  </td>

                  {/* Volume Race Bar */}
                  <td className="py-3.5 px-2">
                    <div className="relative w-full h-8 bg-blue-950/20 rounded-lg overflow-hidden border border-blue-500/10 flex items-center px-3">
                      {/* Filled Progress Bar */}
                      <div
                        className="absolute inset-y-0 left-0 bg-blue-500/20 rounded-lg transition-all duration-500"
                        style={{ width: `${volumePct}%` }}
                      />
                      <span className="relative z-10 text-xs font-mono font-bold text-blue-300">
                        {formatUsd(provider.volumeUsd)}
                      </span>
                    </div>
                  </td>

                  {/* Shared Liquidity Column */}
                  <td className="py-3.5 text-right font-mono text-sm text-zinc-300 pr-2">
                    {provider.sharedLiquidityUsd > 0
                      ? formatUsd(provider.sharedLiquidityUsd)
                      : '$0'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Info & Load More */}
      <div className="pt-4 border-t border-white/5 flex flex-col items-center gap-4 text-center">
        <p className="text-xs text-zinc-400 font-mono">
          Share liquidity through Mesh to appear on the leaderboard.
        </p>

        {displayCount < filteredAndSortedProviders.length && (
          <Button
            variant="outline"
            onClick={() => setDisplayCount((prev) => prev + 15)}
            className="rounded-full px-6 h-9 border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold"
          >
            Load more
          </Button>
        )}
      </div>

      {/* Legal / Protocol Disclaimer */}
      <p className="text-[11px] text-zinc-500 leading-relaxed pt-2 border-t border-white/5">
        Rankings refresh continuously. Providers are ranked by the USD volume swapped through their shared liquidity in the selected period. The goal line marks the next rank up for your wallet. Putable liquidity is the most that swaps can take from a provider's wallet right now, in USD, summed across all supported networks. Fees, APY, and rank movement follow the selected timeframe. The leaderboard is for information only; rankings, past fees, and rank movements are not an inducement, recommendation, or encouragement to trade more, provide more liquidity, or pursue rewards, and nothing here is financial or investment advice.
      </p>
    </div>
  );
}
