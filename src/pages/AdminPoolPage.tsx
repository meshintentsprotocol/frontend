import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Layers, 
  Activity, 
  Search, 
  Filter, 
  RefreshCw, 
  ExternalLink, 
  Copy, 
  CheckCircle2, 
  XCircle, 
  Coins, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Clock, 
  ShieldCheck, 
  Database, 
  TrendingUp, 
  ChevronRight, 
  Zap, 
  Sparkles,
  Sliders,
  Wallet,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { BCH_MESH_SERVER_URL } from '@/lib/config';

interface FillEvent {
  id: string;
  fillTxid: string;
  tokenAmountIn: string;
  tokenAmountOut: string;
  feeSats: string;
  timestamp: number;
  explorerUrl: string;
}

interface PoolRecord {
  id: string;
  txid: string;
  vout: number;
  address: string;
  contractType: string;
  pair: string;
  tokenCategoryIn: string;
  tokenCategoryOut: string;
  symbolIn: string;
  symbolOut: string;
  reserveSats: string;
  reserveBch: string;
  reserveUsd: string;
  tokenAmountIn: string;
  tokenAmountOut: string;
  ownerPkh: string;
  curveType: number;
  curveName: string;
  feeBps: number;
  spreadBps: number;
  priceNum: number;
  priceDen: number;
  rangeLow?: number;
  rangeHigh?: number;
  earnedFeeSats: string;
  earnedFeeBch: string;
  isSpent: boolean;
  fillsCount: number;
  fills: FillEvent[];
  explorerUrl: string;
  addressExplorerUrl: string;
  bundleId?: string;
  pairRole?: 'FORWARD' | 'REVERSE' | 'STANDALONE';
  reverseScriptHash?: string;
  reverseAddress?: string;
  pairName?: string;
}

interface AdminSummary {
  totalReserveSats: string;
  totalReserveBch: string;
  totalReserveUsd: string;
  totalFillsCount: number;
  uniqueMakersCount: number;
  uniqueBundlesCount: number;
}

export function AdminPoolPage() {
  const [pools, setPools] = useState<PoolRecord[]>([]);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPair, setSelectedPair] = useState('ALL');
  const [selectedStrategy, setSelectedStrategy] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL'); // ALL, ACTIVE, SPENT
  const [groupByBundle, setGroupByBundle] = useState(false);
  const [selectedMaker, setSelectedMaker] = useState<string | null>(null);

  // Inspector Drawer
  const [inspectPool, setInspectPool] = useState<PoolRecord | null>(null);

  const fetchPools = useCallback(async () => {
    try {
      const res = await fetch(`${BCH_MESH_SERVER_URL}/api/v1/admin/mesh-pools`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.pools)) {
        setPools(data.pools);
        if (data.summary) {
          setSummary(data.summary);
        }
      }
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to fetch admin mesh pools:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPools();
    if (!autoRefresh) return;
    const interval = setInterval(fetchPools, 15000);
    return () => clearInterval(interval);
  }, [fetchPools, autoRefresh]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(id);
    setTimeout(() => setCopySuccess(null), 2000);
  };

  // Available unique pairs
  const uniquePairs = useMemo(() => {
    const set = new Set<string>();
    pools.forEach(p => {
      if (p.pair) set.add(p.pair);
    });
    return Array.from(set);
  }, [pools]);

  // Filtered pools
  const filteredPools = useMemo(() => {
    return pools.filter(p => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTx = p.txid.toLowerCase().includes(q);
        const matchAddr = p.address.toLowerCase().includes(q);
        const matchMaker = p.ownerPkh.toLowerCase().includes(q);
        const matchBundle = p.bundleId?.toLowerCase().includes(q);
        if (!matchTx && !matchAddr && !matchMaker && !matchBundle) return false;
      }
      // Pair filter
      if (selectedPair !== 'ALL' && p.pair !== selectedPair) return false;
      // Strategy filter
      if (selectedStrategy !== 'ALL') {
        if (selectedStrategy === '0' && p.curveType !== 0) return false;
        if (selectedStrategy === '1' && p.curveType !== 1) return false;
        if (selectedStrategy === '2' && p.curveType !== 2) return false;
        if (selectedStrategy === '3' && p.curveType !== 3) return false;
      }
      // Status filter
      if (selectedStatus === 'ACTIVE' && p.isSpent) return false;
      if (selectedStatus === 'SPENT' && !p.isSpent) return false;
      // Maker filter
      if (selectedMaker && p.ownerPkh !== selectedMaker) return false;

      return true;
    });
  }, [pools, searchQuery, selectedPair, selectedStrategy, selectedStatus, selectedMaker]);

  // Group by bundles
  const bundledGroups = useMemo(() => {
    const bundles: Record<string, PoolRecord[]> = {};
    const standalone: PoolRecord[] = [];

    filteredPools.forEach(p => {
      if (p.bundleId) {
        if (!bundles[p.bundleId]) bundles[p.bundleId] = [];
        bundles[p.bundleId].push(p);
      } else {
        standalone.push(p);
      }
    });

    return { bundles, standalone };
  }, [filteredPools]);

  // Top Aggregates
  const activeCount = pools.filter(p => !p.isSpent).length;
  const totalBch = summary?.totalReserveBch || pools.filter(p => !p.isSpent).reduce((acc, p) => acc + Number(p.reserveBch), 0).toFixed(4);
  const totalUsd = summary?.totalReserveUsd || (Number(totalBch) * 347.25).toFixed(2);
  const totalFills = summary?.totalFillsCount || pools.reduce((acc, p) => acc + p.fillsCount, 0);
  const uniqueMakers = summary?.uniqueMakersCount || new Set(pools.map(p => p.ownerPkh)).size;

  return (
    <div className="min-h-screen bg-[#06080e] text-slate-100 px-4 md:px-8 py-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Ribbon */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                UTXO COVENANT INDEXER
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-md bg-slate-800/80 text-slate-400 border border-slate-700/50">
                Chipnet / Testnet
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Mesh Liquidity Pools & Market Maker Telemetry
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Real-time monitoring of deployed CashScript covenants, reserves, bundle linkages, and taker execution logs.
            </p>
          </div>

          {/* Refresh Controls */}
          <div className="flex items-center gap-3 self-start md:self-auto">
            <div className="flex items-center gap-2 bg-slate-900/90 px-3.5 py-1.5 rounded-xl border border-slate-800 text-xs text-slate-300">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{lastRefreshed.toLocaleTimeString()}</span>
              <button 
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`ml-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase transition ${
                  autoRefresh ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {autoRefresh ? '15s Auto' : 'Paused'}
              </button>
            </div>
            <button
              onClick={() => { setLoading(true); fetchPools(); }}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-semibold text-xs shadow-lg shadow-emerald-500/10 transition active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Sync Now
            </button>
          </div>
        </div>

        {/* Top KPI Metrics Ribbon */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/40 border border-slate-800/80 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition text-emerald-400">
              <Layers className="w-12 h-12" />
            </div>
            <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Active Pools
            </div>
            <div className="text-2xl font-bold text-white mt-2 flex items-baseline gap-1.5">
              {activeCount}
              <span className="text-xs font-normal text-slate-500">/ {pools.length} total</span>
            </div>
            <div className="text-[11px] text-emerald-400/80 mt-1 font-mono">100% Non-Custodial</div>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/40 border border-slate-800/80 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition text-teal-400">
              <Coins className="w-12 h-12" />
            </div>
            <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-teal-400" />
              Total Reserve TVL
            </div>
            <div className="text-2xl font-bold text-white mt-2">
              {totalBch} <span className="text-sm font-semibold text-teal-400">BCH</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-mono">≈ ${totalUsd} USD</div>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/40 border border-slate-800/80 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition text-cyan-400">
              <Activity className="w-12 h-12" />
            </div>
            <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              Recorded Fills
            </div>
            <div className="text-2xl font-bold text-white mt-2">
              {totalFills}
            </div>
            <div className="text-[11px] text-cyan-400/80 mt-1 font-mono">Direct & Solver Swaps</div>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/40 border border-slate-800/80 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition text-amber-400">
              <Wallet className="w-12 h-12" />
            </div>
            <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-amber-400" />
              Unique Makers
            </div>
            <div className="text-2xl font-bold text-white mt-2">
              {uniqueMakers}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-mono">Market Maker PKHs</div>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/40 border border-slate-800/80 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition text-purple-400">
              <ArrowRightLeft className="w-12 h-12" />
            </div>
            <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <ArrowRightLeft className="w-3.5 h-3.5 text-purple-400" />
              Active Bundles
            </div>
            <div className="text-2xl font-bold text-white mt-2">
              {Object.keys(bundledGroups.bundles).length}
            </div>
            <div className="text-[11px] text-purple-400/80 mt-1 font-mono">Two-Sided Markets</div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by TxID, Address, Maker PKH, or Bundle ID..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Pair Select */}
            <select
              value={selectedPair}
              onChange={e => setSelectedPair(e.target.value)}
              className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50"
            >
              <option value="ALL">All Trading Pairs</option>
              {uniquePairs.map(pair => (
                <option key={pair} value={pair}>{pair}</option>
              ))}
            </select>

            {/* Strategy Type Select */}
            <select
              value={selectedStrategy}
              onChange={e => setSelectedStrategy(e.target.value)}
              className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50"
            >
              <option value="ALL">All Strategies</option>
              <option value="0">Straight Limit (Curve 0)</option>
              <option value="1">Oracle Dynamic (Curve 1)</option>
              <option value="2">Dutch Decay (Curve 2)</option>
              <option value="3">Multi-Pair / Recycling (Curve 3)</option>
            </select>

            {/* Status Select */}
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Pools Only</option>
              <option value="SPENT">Docked / Spent Only</option>
            </select>

            {/* Bundle Grouping Toggle */}
            <button
              onClick={() => setGroupByBundle(!groupByBundle)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-xs font-semibold transition ${
                groupByBundle 
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' 
                  : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              {groupByBundle ? 'Grouped by Bundle' : 'Flat Table View'}
            </button>
          </div>

          {/* Active Filter Pills */}
          {(selectedMaker || selectedPair !== 'ALL' || selectedStrategy !== 'ALL' || selectedStatus !== 'ALL') && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/60 text-xs">
              <span className="text-slate-400">Active Filters:</span>
              {selectedMaker && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  Maker: {selectedMaker.slice(0, 8)}...{selectedMaker.slice(-6)}
                  <button onClick={() => setSelectedMaker(null)} className="hover:text-white ml-1">×</button>
                </span>
              )}
              {selectedPair !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-500/10 text-teal-300 border border-teal-500/20">
                  Pair: {selectedPair}
                  <button onClick={() => setSelectedPair('ALL')} className="hover:text-white ml-1">×</button>
                </span>
              )}
              {selectedStrategy !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                  Strategy: {selectedStrategy === '0' ? 'Straight' : selectedStrategy === '1' ? 'Oracle' : selectedStrategy === '2' ? 'Dutch' : 'Multi-Pair'}
                  <button onClick={() => setSelectedStrategy('ALL')} className="hover:text-white ml-1">×</button>
                </span>
              )}
              {selectedStatus !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                  Status: {selectedStatus}
                  <button onClick={() => setSelectedStatus('ALL')} className="hover:text-white ml-1">×</button>
                </span>
              )}
              <button 
                onClick={() => { setSelectedMaker(null); setSelectedPair('ALL'); setSelectedStrategy('ALL'); setSelectedStatus('ALL'); }}
                className="text-xs text-slate-500 hover:text-slate-300 underline ml-2"
              >
                Reset All
              </button>
            </div>
          )}
        </div>

        {/* Main Content Area: Grouped or Flat */}
        {loading && pools.length === 0 ? (
          <div className="p-16 rounded-2xl bg-slate-900/40 border border-slate-800 flex flex-col items-center justify-center gap-3 text-slate-400">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
            <p className="text-sm">Querying live BCHMesh on-chain indexer...</p>
          </div>
        ) : filteredPools.length === 0 ? (
          <div className="p-16 rounded-2xl bg-slate-900/40 border border-slate-800 text-center text-slate-400 space-y-2">
            <Database className="w-8 h-8 mx-auto text-slate-500" />
            <div className="text-base font-semibold text-slate-300">No matching liquidity pools found</div>
            <p className="text-xs text-slate-500">Try adjusting your search query or reset filter selections.</p>
          </div>
        ) : groupByBundle ? (
          /* BUNDLE GROUPED VIEW */
          <div className="space-y-6">
            {Object.entries(bundledGroups.bundles).map(([bId, bPools]) => {
              const forward = bPools.find(p => p.pairRole === 'FORWARD') || bPools[0];
              const reverse = bPools.find(p => p.pairRole === 'REVERSE') || bPools[1];

              return (
                <div key={bId} className="p-6 rounded-2xl bg-slate-900/80 border border-purple-500/20 shadow-xl space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-purple-500/10 text-purple-300 border border-purple-500/30">
                        BUNDLE: {bId}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        Maker: {forward.ownerPkh.slice(0, 10)}...{forward.ownerPkh.slice(-6)}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">
                      Two-Sided Market Pair • {bPools.length} Active Positions
                    </div>
                  </div>

                  {/* 2-Column Side-by-Side Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Forward Side */}
                    {forward && (
                      <div className="p-4 rounded-xl bg-slate-950/70 border border-emerald-500/20 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            FORWARD (Ask / Sell {forward.symbolIn})
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            forward.isSpent ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {forward.isSpent ? 'Docked' : 'Active'}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <div className="text-sm font-semibold text-white">{forward.pair}</div>
                          <div className="text-xs font-mono text-emerald-300">{forward.reserveBch} BCH</div>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between">
                          <span>Address: {forward.address.slice(0, 14)}...</span>
                          <button onClick={() => setInspectPool(forward)} className="text-emerald-400 hover:underline">
                            Inspect
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Reverse Side */}
                    {reverse && (
                      <div className="p-4 rounded-xl bg-slate-950/70 border border-cyan-500/20 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-cyan-400 flex items-center gap-1">
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                            REVERSE (Bid / Buy {reverse.symbolOut})
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            reverse.isSpent ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                          }`}>
                            {reverse.isSpent ? 'Docked' : 'Active'}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <div className="text-sm font-semibold text-white">{reverse.pair}</div>
                          <div className="text-xs font-mono text-cyan-300">{reverse.tokenAmountOut} {reverse.symbolIn}</div>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between">
                          <span>Address: {reverse.address.slice(0, 14)}...</span>
                          <button onClick={() => setInspectPool(reverse)} className="text-cyan-400 hover:underline">
                            Inspect
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Standalones */}
            {bundledGroups.standalone.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-slate-300 flex items-center gap-2">
                  <Database className="w-4 h-4 text-slate-400" />
                  Standalone Positions ({bundledGroups.standalone.length})
                </h3>
                {/* Fall through to flat table */}
              </div>
            )}
          </div>
        ) : null}

        {/* FLAT POOLS DATA TABLE */}
        {(!groupByBundle || bundledGroups.standalone.length > 0) && (
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-950/90 text-slate-400 font-semibold border-b border-slate-800">
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Pair & Role</th>
                    <th className="py-3.5 px-4">Strategy Curve</th>
                    <th className="py-3.5 px-4">Covenant Address</th>
                    <th className="py-3.5 px-4">Maker PKH</th>
                    <th className="py-3.5 px-4">UTXO Reserves</th>
                    <th className="py-3.5 px-4">Pricing & Spread</th>
                    <th className="py-3.5 px-4">Fills</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {(groupByBundle ? bundledGroups.standalone : filteredPools).map(pool => {
                    const isCopiedAddr = copySuccess === `addr_${pool.id}`;
                    const isCopiedTx = copySuccess === `tx_${pool.id}`;

                    return (
                      <tr key={pool.id} className="hover:bg-slate-800/30 transition">
                        {/* Status */}
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            pool.isSpent 
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            <span className={`w-1 h-1 rounded-full ${pool.isSpent ? 'bg-rose-400' : 'bg-emerald-400 animate-pulse'}`} />
                            {pool.isSpent ? 'Docked' : 'Active'}
                          </span>
                        </td>

                        {/* Pair & Role */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white font-sans">{pool.pair}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <span className={`px-1.5 py-0.2 rounded ${
                              pool.pairRole === 'FORWARD' ? 'bg-emerald-500/20 text-emerald-300' :
                              pool.pairRole === 'REVERSE' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {pool.pairRole || 'STANDALONE'}
                            </span>
                            {pool.bundleId && (
                              <span className="text-purple-400 text-[9px] truncate max-w-[80px]" title={pool.bundleId}>
                                📦 {pool.bundleId.slice(0, 10)}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Strategy Curve */}
                        <td className="py-3 px-4">
                          <span className="font-sans text-slate-300 block">{pool.contractType}</span>
                          <span className="text-[10px] text-slate-500 font-sans">{pool.curveName}</span>
                        </td>

                        {/* Covenant Address */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-300 truncate max-w-[110px]" title={pool.address}>
                              {pool.address.slice(0, 8)}...{pool.address.slice(-6)}
                            </span>
                            <button
                              onClick={() => handleCopy(pool.address, `addr_${pool.id}`)}
                              className="text-slate-500 hover:text-slate-300 transition"
                              title="Copy Address"
                            >
                              {isCopiedAddr ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                            <a
                              href={pool.addressExplorerUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-slate-500 hover:text-emerald-400 transition"
                              title="View Address on Chipnet Explorer"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </td>

                        {/* Maker PKH */}
                        <td className="py-3 px-4">
                          <button
                            onClick={() => setSelectedMaker(pool.ownerPkh)}
                            className="text-amber-400/90 hover:text-amber-300 hover:underline truncate max-w-[90px] block"
                            title={`Filter pools by maker: ${pool.ownerPkh}`}
                          >
                            {pool.ownerPkh.slice(0, 6)}...{pool.ownerPkh.slice(-4)}
                          </button>
                        </td>

                        {/* UTXO Reserves */}
                        <td className="py-3 px-4">
                          <div className="text-white font-semibold">{pool.reserveBch} BCH</div>
                          <div className="text-[10px] text-slate-400">
                            {Number(pool.tokenAmountOut) > 0 ? `${pool.tokenAmountOut} ${pool.symbolOut}` : `≈ $${pool.reserveUsd}`}
                          </div>
                        </td>

                        {/* Pricing & Spread */}
                        <td className="py-3 px-4 text-[11px]">
                          {pool.curveType === 1 ? (
                            <div>
                              <span className="text-cyan-400">Oracle Dynamic</span>
                              <div className="text-slate-500 text-[10px]">Spread: {pool.spreadBps} bps • Fee: {pool.feeBps} bps</div>
                            </div>
                          ) : (
                            <div>
                              <span className="text-slate-300">Rate: {pool.priceNum}/{pool.priceDen}</span>
                              <div className="text-slate-500 text-[10px]">Fee: {pool.feeBps} bps</div>
                            </div>
                          )}
                        </td>

                        {/* Fills */}
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            pool.fillsCount > 0 ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20' : 'text-slate-500'
                          }`}>
                            {pool.fillsCount} fills
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setInspectPool(pool)}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-sans font-medium transition"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Inspector Modal / Slide-over */}
        {inspectPool && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                <div className="flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-base font-bold text-white">
                    Strategy Covenant Inspector
                  </h3>
                </div>
                <button
                  onClick={() => setInspectPool(null)}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
                >
                  ×
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-6 text-xs font-mono">
                {/* Status & Contract */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
                    <span className="text-slate-400 font-sans block text-[11px]">Contract Type</span>
                    <span className="text-white font-bold">{inspectPool.contractType}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
                    <span className="text-slate-400 font-sans block text-[11px]">Pool State</span>
                    <span className={inspectPool.isSpent ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                      {inspectPool.isSpent ? 'SPENT / DOCKED' : 'ACTIVE IN ORDERBOOK'}
                    </span>
                  </div>
                </div>

                {/* Addresses & Hashes */}
                <div className="space-y-2">
                  <div className="text-slate-400 font-sans font-semibold text-[11px]">On-Chain Identifiers</div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Covenant P2SH32 Address:</span>
                      <span className="text-slate-200 select-all break-all">{inspectPool.address}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Funding UTXO (TxID:Vout):</span>
                      <span className="text-slate-200 select-all break-all">{inspectPool.txid}:{inspectPool.vout}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Maker Owner PKH (20 Bytes):</span>
                      <span className="text-amber-300 select-all break-all">{inspectPool.ownerPkh}</span>
                    </div>
                    {inspectPool.reverseAddress && (
                      <div>
                        <span className="text-cyan-400 block text-[10px]">Pre-Calculated Reverse Address:</span>
                        <span className="text-cyan-200 select-all break-all">{inspectPool.reverseAddress}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Reserves & Balances */}
                <div className="space-y-2">
                  <div className="text-slate-400 font-sans font-semibold text-[11px]">Reserves & Token Balances</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                      <span className="text-slate-500 block text-[10px]">BCH Sats:</span>
                      <span className="text-white font-bold">{inspectPool.reserveSats} sats</span>
                      <span className="text-slate-400 text-[10px] block mt-0.5">({inspectPool.reserveBch} BCH)</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                      <span className="text-slate-500 block text-[10px]">Token Category Out:</span>
                      <span className="text-white font-bold">{inspectPool.symbolOut}</span>
                      <span className="text-slate-400 text-[10px] block mt-0.5 truncate" title={inspectPool.tokenCategoryOut}>
                        {inspectPool.tokenCategoryOut.slice(0, 16)}...
                      </span>
                    </div>
                  </div>
                </div>

                {/* Fill History */}
                <div className="space-y-2">
                  <div className="text-slate-400 font-sans font-semibold text-[11px] flex items-center justify-between">
                    <span>Fill Events History ({inspectPool.fills.length})</span>
                  </div>
                  {inspectPool.fills.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 text-center text-slate-500 text-[11px]">
                      No fill executions recorded yet for this strategy.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {inspectPool.fills.map(f => (
                        <div key={f.id} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] space-y-1">
                          <div className="flex items-center justify-between text-slate-300">
                            <span>Tx: {f.fillTxid.slice(0, 12)}...</span>
                            <span className="text-emerald-400">In: {f.tokenAmountIn} / Out: {f.tokenAmountOut}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
                <a
                  href={inspectPool.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-emerald-400 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Funding Tx on Explorer
                </a>
                <button
                  onClick={() => setInspectPool(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default AdminPoolPage;
