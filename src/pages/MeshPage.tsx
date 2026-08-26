import React, { useState } from 'react';
import { CreatePositionCard } from '@/components/mesh/CreatePositionCard';
import { ActivePositionsGrid } from '@/components/mesh/ActivePositionsGrid';
import { PlusCircle, Grid3X3, Layers, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useMeshServer } from '@/hooks/useMeshServer';

export function MeshPage() {
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create');
  const { health, prices, stats, positions, loading, refresh } = useMeshServer();

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-[1280px] mt-4 space-y-8">
      {/* Top Header & Tab Switcher */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400">
            <Layers className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-black text-white tracking-tight">
              BCHMesh Concentrated Liquidity
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Active market making &amp; sub-cent bulk rebalancing for Bitcoin Cash
            </p>
          </div>
        </div>

        {/* Server Health Pill + Stats */}
        <div className="flex items-center gap-3">
          {/* Price feeds mini-bar */}
          {prices.length > 0 && (
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-white/[0.04] border border-white/10 rounded-xl text-xs font-mono">
              {prices.slice(0, 3).map(p => (
                <span key={p.pairName} className="text-zinc-300">
                  <span className="text-zinc-500">{p.pairName}:</span>{' '}
                  <span className={p.source === 'cauldron' ? 'text-teal-400' : 'text-emerald-400'}>
                    {parseFloat(p.priceHuman).toFixed(4)}
                  </span>
                  <span className="text-zinc-600 ml-0.5 text-[9px]">{p.source}</span>
                </span>
              ))}
            </div>
          )}

          {/* Server connection indicator */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
            health.ok
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}>
            {health.ok ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span>{health.ok ? `MeshServer ${health.latency}ms` : 'MeshServer offline'}</span>
          </div>

          {/* Stats pill */}
          {stats && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.04] border border-white/10 rounded-xl text-xs font-semibold text-zinc-400">
              <span>{stats.strategies} pools</span>
              <span className="text-white/20">|</span>
              <span>{stats.intents} intents</span>
            </div>
          )}

          {/* Refresh */}
          <button
            onClick={() => { void refresh(); }}
            className="p-1.5 text-zinc-500 hover:text-white transition-colors"
            title="Refresh server data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Offline Warning Banner */}
      {!loading && !health.ok && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-sm text-amber-300 flex items-center gap-3">
          <WifiOff className="w-5 h-5 shrink-0" />
          <span>
            Cannot reach <code className="font-mono text-xs bg-black/30 px-1.5 py-0.5 rounded">MeshServer</code> at{' '}
            <code className="font-mono text-xs bg-black/30 px-1.5 py-0.5 rounded">localhost:3001</code>.
            Start it with <code className="font-mono text-xs bg-black/30 px-1.5 py-0.5 rounded">npm start</code> inside{' '}
            <code className="font-mono text-xs bg-black/30 px-1.5 py-0.5 rounded">BCHMesh/meshserver</code>.
            The UI will show live data when connected.
          </span>
        </div>
      )}

      {/* Tab Switcher Pills */}
      <div className="flex items-center p-1 bg-white/[0.04] border border-white/10 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('create')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'create'
              ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <PlusCircle className="w-4 h-4" />
          <span>Create Pool</span>
        </button>
        <button
          onClick={() => setActiveTab('manage')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'manage'
              ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Grid3X3 className="w-4 h-4" />
          <span>Active Positions {positions.length > 0 ? `(${positions.length})` : ''}</span>
        </button>
      </div>

      {/* Tab Content Render */}
      {activeTab === 'create' ? (
        <CreatePositionCard />
      ) : (
        <ActivePositionsGrid />
      )}
    </div>
  );
}

export default MeshPage;
