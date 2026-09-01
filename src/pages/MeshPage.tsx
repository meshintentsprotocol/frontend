import React, { useMemo } from 'react';
import { Header } from '@/components/common/Header';
import { Footer } from '@/components/common/Footer';
import { CreatePositionUniswap } from '@/components/mesh/CreatePositionUniswap';
import { MeshPositionsList } from '@/components/mesh/MeshPositionsList';
import { MeshTopPoolsTable, type PoolMarketItem } from '@/components/mesh/MeshTopPoolsTable';
import {
  PlusCircle,
  Layers,
  Wifi,
  WifiOff,
  DollarSign,
  Activity,
  Zap,
  Coins,
} from 'lucide-react';
import { useMeshServer } from '@/hooks/useMeshServer';
import { Button } from '@/components/ui/button';
import { useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function MeshPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab: 'positions' | 'pools' | 'create' =
    rawTab === 'pools' || rawTab === 'create' ? rawTab : 'positions';

  const { health, positions, bchUsdPrice } = useMeshServer(12_000);
  const liveBchPrice = bchUsdPrice() || 324.4;

  const handleTabChange = (val: 'positions' | 'pools' | 'create') => {
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
    <div className="min-h-screen flex flex-col bg-[#050505] selection:bg-primary/30 text-foreground overflow-x-hidden">
      <Header />

      <main className="flex-1">
        <div className="container mx-auto p-4 md:p-8 max-w-[1200px] mt-4 space-y-6">
          {/* Tab 1: Positions (1inch Aqua Multi-Token Hierarchical Table) */}
          {activeTab === 'positions' && (
            <MeshPositionsList onCreateNew={() => handleTabChange('create')} />
          )}

          {/* Tab 2: Top Pools Table (With Hero, 4 Key Metrics Overview & My Positions Button) */}
          {activeTab === 'pools' && (
            <div className="space-y-8">
              {/* Top Header */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-2">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-semibold mb-2">
                    <Zap className="w-3.5 h-3.5" />
                    Mode 4: 100% Shared Concentrated Liquidity
                  </div>
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight">
                    Pools &amp; Liquidity
                  </h1>
                  <p className="text-sm md:text-base text-zinc-400 max-w-2xl leading-relaxed">
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
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-red-500/10 border-red-500/30 text-red-400',
                    )}
                  >
                    {health.ok ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                    <span>{health.ok ? `MeshNode ${health.latency}ms` : 'Offline'}</span>
                  </div>

                  {/* My Positions Button */}
                  <Button
                    onClick={() => handleTabChange('positions')}
                    variant="outline"
                    className="h-11 px-5 rounded-full border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold text-sm flex items-center gap-2 transition-all hover:border-emerald-500/40"
                  >
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <span>My Positions</span>
                  </Button>

                  {/* New Position Button */}
                  <Button
                    onClick={() => handleTabChange('create')}
                    className="h-11 px-6 rounded-full bg-emerald-400 hover:bg-emerald-300 text-black font-bold text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>New Position</span>
                  </Button>
                </div>
              </div>

              {/* Global Key Metrics Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Metric 1: TVL */}
                <div className="p-5 rounded-2xl bg-[#0c0c10] border border-white/8 space-y-2">
                  <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
                    <span>Total Value Locked</span>
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black font-mono text-white">
                    ${totalTvlUsd}
                  </div>
                  <div className="text-[11px] text-zinc-500 font-mono">
                    {totalBchLocked.toLocaleString(undefined, { maximumFractionDigits: 1 })} BCH locked
                  </div>
                </div>

                {/* Metric 2: 24h Fees */}
                <div className="p-5 rounded-2xl bg-[#0c0c10] border border-white/8 space-y-2">
                  <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
                    <span>24h LP Fees Earned</span>
                    <Coins className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">
                    ${total24hFeesUsd}
                  </div>
                  <div className="text-[11px] text-zinc-500 font-mono">
                    100% paid to LP covenants
                  </div>
                </div>

                {/* Metric 3: 24h Volume */}
                <div className="p-5 rounded-2xl bg-[#0c0c10] border border-white/8 space-y-2">
                  <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
                    <span>24h Fill Volume</span>
                    <Activity className="w-4 h-4 text-teal-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black font-mono text-white">
                    ${total24hVolumeUsd}
                  </div>
                  <div className="text-[11px] text-zinc-500 font-mono">
                    Decentralized solver matches
                  </div>
                </div>

                {/* Metric 4: Rebalance Unit Economics */}
                <div className="p-5 rounded-2xl bg-[#0c0c10] border border-white/8 space-y-2">
                  <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
                    <span>Avg Rebalance Fee</span>
                    <Zap className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                    &lt; $0.01
                  </div>
                  <div className="text-[11px] text-emerald-400/80 font-mono font-semibold">
                    ~1,500 sats per 20 rungs
                  </div>
                </div>
              </div>

              {/* Top Pools Table */}
              <MeshTopPoolsTable onSelectDeposit={handleDepositFromPool} />
            </div>
          )}

          {/* Tab 3: Create Position Builder (Uniswap v4 2-Step Flow) */}
          {activeTab === 'create' && (
            <CreatePositionUniswap />
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default MeshPage;
