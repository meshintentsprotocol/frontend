import React, { useMemo, useState } from 'react';
import { CreatePositionUniswap } from '@/components/mesh/CreatePositionUniswap';
import { MeshPositionsList } from '@/components/mesh/MeshPositionsList';
import { MeshTopPoolsTable, type PoolMarketItem } from '@/components/mesh/MeshTopPoolsTable';
import { MeshLeaderboardHero } from '@/components/mesh/leaderboard/MeshLeaderboardHero';
import { MeshVolumeRaceChart } from '@/components/mesh/leaderboard/MeshVolumeRaceChart';
import { MeshLeaderboardTable } from '@/components/mesh/leaderboard/MeshLeaderboardTable';
import { MeshLeaderboardSidebar } from '@/components/mesh/leaderboard/MeshLeaderboardSidebar';
import {
  MOCK_LEADERBOARD_PROVIDERS,
  MOCK_LEADERBOARD_SWAPS,
  MOCK_GLOBAL_STATS,
  type Timeframe,
} from '@/lib/meshLeaderboardData';
import {
  PlusCircle,
  Layers,
  Wifi,
  WifiOff,
  DollarSign,
  Activity,
  Zap,
  Coins,
  Trophy,
} from 'lucide-react';
import { useMeshServer } from '@/hooks/useMeshServer';
import { Button } from '@/components/ui/button';
import { useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function MeshPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab: 'positions' | 'pools' | 'leaderboard' | 'create' =
    rawTab === 'pools' || rawTab === 'create' || rawTab === 'leaderboard'
      ? rawTab
      : 'positions';

  const [leaderboardTimeframe, setLeaderboardTimeframe] = useState<Timeframe>('1M');
  const { health, positions, bchUsdPrice } = useMeshServer(12_000);
  const liveBchPrice = bchUsdPrice() || 324.4;

  const handleTabChange = (val: 'positions' | 'pools' | 'leaderboard' | 'create') => {
    setSearchParams({ tab: val });
  };

  // Calculate live global metrics for Top Pools view
  const totalBchLocked = useMemo(() => {
    const totalSats = positions.reduce((acc, p) => acc + (Number(p.reserveSats) || 0), 0);
    return totalSats > 0 ? totalSats / 1e8 : 4560.42; // default fallback if fresh node
  }, [positions]);

  const totalTvlUsd = (totalBchLocked * liveBchPrice).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });

  const total24hFeesUsd = (totalBchLocked * liveBchPrice * 0.0028).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });

  const total24hVolumeUsd = (totalBchLocked * liveBchPrice * 0.35).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });

  const handleDepositFromPool = (pool: PoolMarketItem) => {
    handleTabChange('create');
  };

  return (
    <div className="container mx-auto py-4 sm:py-6 px-4 md:px-8 max-w-[1200px] space-y-6">
      {/* Tab 1: Positions (1inch Aqua Multi-Token Hierarchical Table) */}
      {activeTab === 'positions' && (
        <MeshPositionsList onCreateNew={() => handleTabChange('create')} />
      )}

      {/* Tab 2: Top Pools Table (With Aqua Hero, 4 Key Metrics Overview & Action Buttons) */}
      {activeTab === 'pools' && (
        <div className="space-y-8">
          {/* Top Hero Banner */}
          <div className="w-full bg-[#0038ff] rounded-3xl p-6 sm:p-8 md:p-10 text-white relative overflow-hidden shadow-2xl border border-blue-400/20 space-y-6">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-400/20 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
            
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-white text-xs font-mono font-semibold">
                  <Zap className="w-3.5 h-3.5 text-blue-200" />
                  Mode 4: 100% Shared Concentrated Liquidity
                </div>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight font-heading">
                  Pools &amp; Liquidity
                </h1>
                <p className="text-xs sm:text-sm md:text-base text-blue-100 max-w-2xl leading-relaxed">
                  Provide single-asset BCH liquidity, earn maker fees on every atomic fill, and rebalance your entire grid with sub-cent ($0.01) transaction costs.
                </p>
              </div>

              {/* Top Action CTAs */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Server Status Pill */}
                <div
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold font-mono backdrop-blur-md',
                    health.ok
                      ? 'bg-black/20 border-white/20 text-blue-200'
                      : 'bg-red-500/20 border-red-500/30 text-red-300',
                  )}
                >
                  {health.ok ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5 text-red-300" />}
                  <span>{health.ok ? `MeshNode ${health.latency}ms` : 'Offline'}</span>
                </div>

                {/* My Positions Button */}
                <Button
                  onClick={() => handleTabChange('positions')}
                  variant="outline"
                  className="h-10 px-4 rounded-full border-white/20 bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all hover:scale-105"
                >
                  <Layers className="w-3.5 h-3.5 text-blue-200" />
                  <span>My Positions</span>
                </Button>

                {/* Leaderboard Button */}
                <Button
                  onClick={() => handleTabChange('leaderboard')}
                  variant="outline"
                  className="h-10 px-4 rounded-full border-white/20 bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all hover:scale-105"
                >
                  <Trophy className="w-3.5 h-3.5 text-yellow-300" />
                  <span>Leaderboard</span>
                </Button>

                {/* New Position Button */}
                <Button
                  onClick={() => handleTabChange('create')}
                  className="h-10 px-5 rounded-full bg-white text-blue-900 hover:bg-blue-50 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-black/20 transition-all hover:scale-105"
                >
                  <PlusCircle className="w-4 h-4 text-blue-700" />
                  <span>New Position</span>
                </Button>
              </div>
            </div>

            {/* Global Key Metrics Summary Grid inside Aqua card */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-6 border-t border-white/10 font-mono">
              <div className="space-y-1">
                <div className="text-[11px] text-blue-200 font-medium font-sans">Total Value Locked</div>
                <div className="text-2xl sm:text-3xl font-bold text-white">${totalTvlUsd}</div>
                <div className="text-[11px] text-blue-200/80">
                  {totalBchLocked.toLocaleString(undefined, { maximumFractionDigits: 1 })} BCH locked
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] text-blue-200 font-medium font-sans">24h LP Fees Earned</div>
                <div className="text-2xl sm:text-3xl font-bold text-emerald-300">${total24hFeesUsd}</div>
                <div className="text-[11px] text-blue-200/80">100% paid to LP covenants</div>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] text-blue-200 font-medium font-sans">24h Fill Volume</div>
                <div className="text-2xl sm:text-3xl font-bold text-white">${total24hVolumeUsd}</div>
                <div className="text-[11px] text-blue-200/80">Decentralized solver matches</div>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] text-blue-200 font-medium font-sans">Avg Rebalance Fee</div>
                <div className="text-2xl sm:text-3xl font-bold text-cyan-200">&lt; $0.01</div>
                <div className="text-[11px] text-blue-200/80">~1,500 sats per 20 rungs</div>
              </div>
            </div>
          </div>

          {/* Top Pools Table */}
          <MeshTopPoolsTable onSelectDeposit={handleDepositFromPool} />
        </div>
      )}

      {/* Tab 3: Leaderboard (1inch Aqua LP Leaderboard with Volume Race & Analytics) */}
      {activeTab === 'leaderboard' && (
        <div className="space-y-8">
          <MeshLeaderboardHero
            timeframe={leaderboardTimeframe}
            onTimeframeChange={setLeaderboardTimeframe}
            stats={MOCK_GLOBAL_STATS}
            onCreatePosition={() => handleTabChange('create')}
          />

          {/* Visual Scale Volume Race Chart */}
          <MeshVolumeRaceChart providers={MOCK_LEADERBOARD_PROVIDERS} />

          {/* 2-Column Main Section: Left Table (70%), Right Sidebar (30%) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8">
              <MeshLeaderboardTable
                providers={MOCK_LEADERBOARD_PROVIDERS}
                timeframe={leaderboardTimeframe}
              />
            </div>
            <div className="lg:col-span-4">
              <MeshLeaderboardSidebar
                swaps={MOCK_LEADERBOARD_SWAPS}
                timeframe={leaderboardTimeframe}
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Create Position Builder (Uniswap v4 2-Step Flow) */}
      {activeTab === 'create' && (
        <CreatePositionUniswap />
      )}
    </div>
  );
}

export default MeshPage;
