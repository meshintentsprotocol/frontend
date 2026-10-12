const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../../meshprotocol');

function writeFile(relPath, content) {
  const fullPath = path.join(rootDir, relPath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, content.trim() + '\n', 'utf8');
  console.log('✓ Successfully wrote ' + relPath);
}

console.log('Generating Mesh Finance App into:', rootDir);

// -----------------------------------------------------------------------------
// 1. MeshAppShell.tsx
// -----------------------------------------------------------------------------
const appShell = `
import React, { useState } from 'react';
import { useMesh } from '@/context/MeshContext';
import { useMeshApp, type AppSubTab } from '@/context/MeshAppContext';
import { CornerCrosshair } from '@/components/common/MeshWireframeBox';
import { MeshPoolsExplorer } from './MeshPoolsExplorer';
import { MeshLiquidityTerminal } from './MeshLiquidityTerminal';
import { MeshStrategyStudio } from './MeshStrategyStudio';
import { MeshPortfolio } from './MeshPortfolio';
import { MeshNostrStream } from './MeshNostrStream';
import { MeshCovenantInspector } from './MeshCovenantInspector';
import { MeshWalletModal } from './MeshWalletModal';
import {
  Layers,
  Sliders,
  Sparkles,
  PieChart,
  Radio,
  FileCode2,
  Wallet,
  Zap,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

export function MeshAppShell() {
  const { language } = useMesh();
  const {
    subTab,
    setSubTab,
    isDemoMode,
    toggleDemoMode,
    walletConnected,
    walletAddress,
    bchBalance,
    network,
    setNetwork,
  } = useMeshApp();

  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const isZh = language === 'zh';

  const NAV_ITEMS: Array<{ id: AppSubTab; label: string; labelZh: string; icon: any; count?: number }> = [
    { id: 'pools', label: 'Pools Explorer', labelZh: '池子浏览器', icon: Layers },
    { id: 'liquidity', label: 'DLMM Liquidity', labelZh: '集中流动性', icon: Sliders },
    { id: 'strategies', label: 'Strategy Studio', labelZh: '做市策略工作室', icon: Sparkles },
    { id: 'portfolio', label: 'My Portfolio', labelZh: '我的持仓与收益', icon: PieChart, count: 3 },
    { id: 'intents', label: 'Nostr Intents Flow', labelZh: 'Nostr意图流', icon: Radio },
    { id: 'inspector', label: 'Covenant Inspector', labelZh: '智能契约审计', icon: FileCode2 },
  ];

  return (
    <section className="border-b border-[#c0c2c4] dark:border-neutral-800 px-4 sm:px-6 relative min-h-[90vh]">
      <div className="border-x border-[#c0c2c4] dark:border-neutral-800 relative max-w-7xl mx-auto py-6 sm:py-8 px-4 sm:px-8">
        <CornerCrosshair className="-left-3 -top-3" />
        <CornerCrosshair className="-right-3 -top-3" />
        <CornerCrosshair className="-left-3 -bottom-3" />
        <CornerCrosshair className="-right-3 -bottom-3" />

        {/* Demo Mode Notification Strip */}
        {isDemoMode && (
          <div className="mb-6 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span className="font-bold uppercase tracking-wider text-[11px] font-mono">
                Interactive Simulation Sandbox:
              </span>
              <span>
                Pre-funded with 12.50 BCH & 45,000 pUSD. Test creating strategies, rebalancing, and docking with zero real funds.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleDemoMode}
                className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 font-semibold text-[11px]"
              >
                Switch to Live Network
              </button>
            </div>
          </div>
        )}

        {/* Top Control Bar */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-6 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 uppercase">
                Mesh Finance
              </span>
              <span className="font-mono text-[11px] text-neutral-500">
                v3.4.0 · UTXO Covenant Engine
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white mt-1">
              {isZh ? '流动性与策略做市终端' : 'DeFi Liquidity & Strategy Terminal'}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-stretch sm:self-auto">
            {/* Demo Mode Toggle */}
            <button
              onClick={toggleDemoMode}
              className={\`px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors cursor-pointer \${
                isDemoMode
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                  : 'border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
              }\`}
            >
              <span className={\`w-1.5 h-1.5 rounded-full \${isDemoMode ? 'bg-amber-400 animate-pulse' : 'bg-neutral-500'}\`} />
              {isDemoMode ? 'SIMULATION: ON' : 'LIVE NETWORK'}
            </button>

            {/* Network Pill */}
            <div className="px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900 font-mono text-xs text-neutral-600 dark:text-neutral-300">
              BCH Chipnet
            </div>

            {/* Balance Pill */}
            {walletConnected && (
              <div className="px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 font-mono text-xs font-bold text-emerald-400">
                {bchBalance.toFixed(4)} BCH
              </div>
            )}

            {/* Wallet Button */}
            <button
              onClick={() => setWalletModalOpen(true)}
              className="px-4 py-1.5 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90 transition-opacity text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>
                {walletConnected
                  ? \`\${walletAddress?.slice(0, 10)}...\${walletAddress?.slice(-4)}\`
                  : 'Connect Wallet'}
              </span>
            </button>
          </div>
        </div>

        {/* Sub-Tabs Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-4 border-b border-neutral-200 dark:border-neutral-800 no-scrollbar">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = subTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSubTab(item.id)}
                className={\`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer \${
                  isActive
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900'
                }\`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{isZh ? item.labelZh : item.label}</span>
                {item.count && (
                  <span
                    className={\`px-1.5 py-0.2 rounded-full text-[10px] font-mono \${
                      isActive
                        ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900'
                        : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                    }\`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Dynamic Content Views */}
        <div className="py-6">
          {subTab === 'pools' && <MeshPoolsExplorer />}
          {subTab === 'liquidity' && <MeshLiquidityTerminal />}
          {subTab === 'strategies' && <MeshStrategyStudio />}
          {subTab === 'portfolio' && <MeshPortfolio />}
          {subTab === 'intents' && <MeshNostrStream />}
          {subTab === 'inspector' && <MeshCovenantInspector />}
        </div>
      </div>

      <MeshWalletModal open={walletModalOpen} onClose={() => setWalletModalOpen(false)} />
    </section>
  );
}
`;

writeFile('src/components/app/MeshAppShell.tsx', appShell);

// -----------------------------------------------------------------------------
// 2. MeshPoolsExplorer.tsx
// -----------------------------------------------------------------------------
const poolsExplorer = `
import React, { useState } from 'react';
import { useMeshApp } from '@/context/MeshAppContext';
import { MOCK_POOLS, type MeshPool } from '@/lib/meshApi';
import { Search, Sliders, ArrowUpRight, Repeat, Filter, Sparkles, TrendingUp } from 'lucide-react';

export function MeshPoolsExplorer() {
  const { setSubTab, setSelectedPool } = useMeshApp();
  const [filter, setFilter] = useState<'all' | 'stables' | 'high-yield' | 'recycled'>('all');
  const [search, setSearch] = useState('');

  const filteredPools = MOCK_POOLS.filter(p => {
    if (search && !p.targetSymbol.toLowerCase().includes(search.toLowerCase()) && !p.reserveSymbol.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (filter === 'stables') return p.targetSymbol.includes('USD');
    if (filter === 'high-yield') return p.apyPct > 22;
    if (filter === 'recycled') return p.mode === 'mirror';
    return true;
  });

  const handleProvide = (pool: MeshPool) => {
    setSelectedPool(pool);
    setSubTab('liquidity');
  };

  const handleStrategy = (pool: MeshPool) => {
    setSelectedPool(pool);
    setSubTab('strategies');
  };

  return (
    <div className="space-y-6">
      {/* 4-Card Protocol Telemetry Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#121215] border border-neutral-200/80 dark:border-neutral-800">
          <div className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider">Total Value Locked</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-neutral-900 dark:text-white mt-1">$2,418,920</div>
          <div className="text-[11px] text-emerald-500 font-mono mt-0.5">11,840 BCH allocated</div>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-[#121215] border border-neutral-200/80 dark:border-neutral-800">
          <div className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider">24h Covenant Volume</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-neutral-900 dark:text-white mt-1">$482,100</div>
          <div className="text-[11px] text-neutral-500 font-mono mt-0.5">1 sat/byte gas efficiency</div>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-[#121215] border border-neutral-200/80 dark:border-neutral-800">
          <div className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider">24h LP Fees Generated</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-500 mt-1">$1,446.30</div>
          <div className="text-[11px] text-emerald-600 font-mono mt-0.5">+14.2% vs 7d avg</div>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-[#121215] border border-neutral-200/80 dark:border-neutral-800">
          <div className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider">Active Covenants</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-neutral-900 dark:text-white mt-1">48 Pools</div>
          <div className="text-[11px] text-sky-400 font-mono mt-0.5">100% Non-custodial UTXOs</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="tablist">
          {[
            { id: 'all', label: 'All Markets' },
            { id: 'stables', label: 'Stablecoins (pUSD / mUSD)' },
            { id: 'high-yield', label: 'High APY (>22%)' },
            { id: 'recycled', label: 'Recycling Mirror Pools' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as any)}
              className={\`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer \${
                filter === f.id
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs'
                  : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:text-white'
              }\`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search by token or symbol..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-[#121215] border border-neutral-300 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-neutral-500 font-mono"
          />
        </div>
      </div>

      {/* Pools Wireframe Table */}
      <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800 overflow-hidden bg-white dark:bg-[#121215]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 font-mono text-[10px] text-neutral-500 uppercase tracking-wider bg-neutral-50/50 dark:bg-neutral-900/40">
                <th className="py-3.5 px-4 font-semibold">Pool Market</th>
                <th className="py-3.5 px-4 font-semibold">Type</th>
                <th className="py-3.5 px-4 font-semibold">TVL</th>
                <th className="py-3.5 px-4 font-semibold">24h Vol</th>
                <th className="py-3.5 px-4 font-semibold">Fee Tier</th>
                <th className="py-3.5 px-4 font-semibold">Dynamic APY</th>
                <th className="py-3.5 px-4 font-semibold">Status</th>
                <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
              {filteredPools.map(pool => (
                <tr key={pool.address} className="hover:bg-neutral-50/80 dark:hover:bg-neutral-900/40 transition-colors">
                  <td className="py-4 px-4 font-medium">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 flex items-center justify-center font-bold text-xs text-emerald-500">
                        {pool.targetSymbol[0]}
                      </div>
                      <div>
                        <div className="font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                          {pool.reserveSymbol} / {pool.targetSymbol}
                        </div>
                        <div className="font-mono text-[10px] text-neutral-500 truncate max-w-[140px]">
                          {pool.address}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300">
                      <Repeat className="w-2.5 h-2.5 text-emerald-500" /> DLMM Bin
                    </span>
                  </td>
                  <td className="py-4 px-4 font-mono">
                    <div className="font-semibold text-neutral-900 dark:text-white">$\${pool.tvlUsd.toLocaleString()}</div>
                    <div className="text-[10px] text-neutral-500">{(pool.tvlSats / 1e8).toFixed(2)} BCH</div>
                  </td>
                  <td className="py-4 px-4 font-mono text-neutral-700 dark:text-neutral-300">
                    $\${pool.volume24hUsd.toLocaleString()}
                  </td>
                  <td className="py-4 px-4 font-mono text-neutral-600 dark:text-neutral-400">
                    {(pool.feeBps / 100).toFixed(2)}%
                  </td>
                  <td className="py-4 px-4 font-mono">
                    <span className="text-emerald-500 font-bold">+{pool.apyPct.toFixed(1)}%</span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Active Range
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => handleProvide(pool)}
                        className="px-2.5 py-1 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:border-neutral-500 text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 hover:text-white transition-colors cursor-pointer"
                      >
                        Add Bins
                      </button>
                      <button
                        onClick={() => handleStrategy(pool)}
                        className="px-2.5 py-1 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90 text-[11px] font-semibold transition-opacity cursor-pointer"
                      >
                        Strategy
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
`;

writeFile('src/components/app/MeshPoolsExplorer.tsx', poolsExplorer);

// -----------------------------------------------------------------------------
// 3. MeshLiquidityTerminal.tsx (DLMM Bins & Range Liquidity)
// -----------------------------------------------------------------------------
const liquidityTerminal = `
import React, { useState } from 'react';
import { useMeshApp } from '@/context/MeshAppContext';
import { MOCK_POOLS } from '@/lib/meshApi';
import { Sliders, ShieldCheck, CheckCircle2, ArrowRight, Sparkles, Scale, Flame } from 'lucide-react';

export function MeshLiquidityTerminal() {
  const { selectedPool, bchBalance, tokenBalances, addPosition, setSubTab } = useMeshApp();
  const pool = selectedPool ?? MOCK_POOLS[0];

  const [shape, setShape] = useState<'spot' | 'curve' | 'bid-ask'>('curve');
  const [minPrice, setMinPrice] = useState<number>(340);
  const [maxPrice, setMaxPrice] = useState<number>(375);
  const [depositBch, setDepositBch] = useState<string>('2.50');
  const [depositToken, setDepositToken] = useState<string>('893.12');
  const [singleSided, setSingleSided] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);

  const currentPrice = pool.priceTokensPerBch;

  const handleDeposit = () => {
    addPosition({
      name: \`\${pool.reserveSymbol}/\${pool.targetSymbol} DLMM Position\`,
      template: 'dlmm-bins',
      pair: \`\${pool.reserveSymbol} / \${pool.targetSymbol}\`,
      depositBch: parseFloat(depositBch) || 0,
      depositTokens: parseFloat(depositToken) || 0,
      tokenSymbol: pool.targetSymbol,
      valueUsd: (parseFloat(depositBch) || 0) * 357.5 + (parseFloat(depositToken) || 0),
      status: 'optimal',
      minPrice,
      maxPrice,
      currentPrice,
    });
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      setSubTab('portfolio');
    }, 1200);
  };

  // Generate 24 discrete DLMM bins for visualization
  const bins = Array.from({ length: 24 }).map((_, i) => {
    const p = 320 + i * 3.5;
    const isCurrent = Math.abs(p - currentPrice) < 2.0;
    const isInRange = p >= minPrice && p <= maxPrice;

    // Height based on shape
    let height = 30;
    if (shape === 'curve') {
      const dist = Math.abs(p - currentPrice);
      height = Math.max(15, 95 - dist * 3.2);
    } else if (shape === 'spot') {
      height = isInRange ? 65 : 20;
    } else {
      // bid-ask: higher below mid
      height = p < currentPrice ? 85 : 40;
    }

    return {
      price: p,
      isCurrent,
      isInRange,
      height: Math.min(100, Math.max(10, height)),
    };
  });

  return (
    <div className="space-y-6">
      {/* Pair Header */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#121215] border border-neutral-200/80 dark:border-neutral-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-xl text-neutral-900 dark:text-white">
              {pool.reserveSymbol} / {pool.targetSymbol}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              {(pool.feeBps / 100).toFixed(2)}% Fee Tier
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-1 font-mono">
            Current Price: 1 BCH = <span className="text-neutral-900 dark:text-white font-bold">{currentPrice}</span> {pool.targetSymbol}
          </p>
        </div>

        <div className="flex items-center gap-6 font-mono text-xs">
          <div>
            <div className="text-neutral-500 text-[10px]">24h Volume</div>
            <div className="font-bold text-neutral-900 dark:text-white">$\${pool.volume24hUsd.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-neutral-500 text-[10px]">Est. DLMM APR</div>
            <div className="font-bold text-emerald-500">+{pool.apyPct}%</div>
          </div>
          <div>
            <div className="text-neutral-500 text-[10px]">Covenant Reserve</div>
            <div className="font-bold text-neutral-900 dark:text-white">{(pool.tvlSats / 1e8).toFixed(2)} BCH</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive DLMM Depth Bar Visualizer */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-[#121215] border border-neutral-200/80 dark:border-neutral-800 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-900 dark:text-white font-mono uppercase tracking-wider">
                DLMM Discrete Bin Depth Visualizer
              </span>
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-semibold">
                <button
                  onClick={() => setShape('curve')}
                  className={\`px-2.5 py-1 rounded-lg transition-colors \${shape === 'curve' ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'text-neutral-500'}\`}
                >
                  Curve (Concentrated)
                </button>
                <button
                  onClick={() => setShape('spot')}
                  className={\`px-2.5 py-1 rounded-lg transition-colors \${shape === 'spot' ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'text-neutral-500'}\`}
                >
                  Spot (Uniform)
                </button>
                <button
                  onClick={() => setShape('bid-ask')}
                  className={\`px-2.5 py-1 rounded-lg transition-colors \${shape === 'bid-ask' ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'text-neutral-500'}\`}
                >
                  Bid-Ask Skew
                </button>
              </div>
            </div>

            {/* SVG / Bar Chart Canvas */}
            <div className="relative h-48 rounded-xl bg-neutral-950 border border-neutral-800 p-4 flex items-end justify-between gap-1 overflow-hidden">
              {/* Central Mid Cursor */}
              <div className="absolute top-2 bottom-2 left-1/2 w-px bg-sky-400 z-10">
                <span className="absolute top-1 -translate-x-1/2 px-1 py-0.5 rounded bg-sky-950 border border-sky-500/40 text-[8px] font-mono text-sky-300">
                  MID
                </span>
              </div>

              {bins.map((b, i) => (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                  onClick={() => {
                    if (b.price < currentPrice) setMinPrice(Math.round(b.price));
                    else setMaxPrice(Math.round(b.price));
                  }}
                >
                  <div
                    className={\`w-full rounded-t-sm transition-all duration-200 \${
                      b.isCurrent
                        ? 'bg-sky-400'
                        : b.isInRange
                        ? 'bg-emerald-500 hover:bg-emerald-400'
                        : 'bg-neutral-800 hover:bg-neutral-700'
                    }\`}
                    style={{ height: \`\${b.height}%\` }}
                  />
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-neutral-900 text-[9px] font-mono px-1.5 py-0.5 rounded border border-neutral-700 text-white whitespace-nowrap z-20">
                    {b.price.toFixed(1)} {pool.targetSymbol}
                  </div>
                </div>
              ))}
            </div>

            {/* Range Bound Slider Handles */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-1">
                <span className="text-[10px] text-neutral-500 font-mono uppercase">Min Price (tokens/BCH)</span>
                <input
                  type="number"
                  value={minPrice}
                  onChange={e => setMinPrice(parseFloat(e.target.value) || 0)}
                  className="w-full bg-transparent font-mono text-base font-bold text-neutral-900 dark:text-white focus:outline-none"
                />
                <span className="text-[10px] text-emerald-500 font-mono">
                  {((minPrice / currentPrice - 1) * 100).toFixed(1)}% vs Market
                </span>
              </div>

              <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-1">
                <span className="text-[10px] text-neutral-500 font-mono uppercase">Max Price (tokens/BCH)</span>
                <input
                  type="number"
                  value={maxPrice}
                  onChange={e => setMaxPrice(parseFloat(e.target.value) || 0)}
                  className="w-full bg-transparent font-mono text-base font-bold text-neutral-900 dark:text-white focus:outline-none"
                />
                <span className="text-[10px] text-rose-500 font-mono">
                  {((maxPrice / currentPrice - 1) * 100).toFixed(1)}% vs Market
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Deposit & Execution Panel */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-[#121215] border border-neutral-200/80 dark:border-neutral-800 space-y-4">
            <h3 className="font-bold text-base text-neutral-900 dark:text-white">Deposit Liquidity</h3>

            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-1.5">
                <div className="flex justify-between text-xs text-neutral-500 font-mono">
                  <span>BCH Deposit</span>
                  <span>Bal: {bchBalance.toFixed(4)} BCH</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={depositBch}
                    onChange={e => setDepositBch(e.target.value)}
                    className="flex-1 bg-transparent font-mono text-lg font-bold text-neutral-900 dark:text-white focus:outline-none"
                  />
                  <span className="font-mono text-xs font-semibold text-neutral-500">BCH</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-1.5">
                <div className="flex justify-between text-xs text-neutral-500 font-mono">
                  <span>{pool.targetSymbol} Deposit</span>
                  <span>Bal: {(tokenBalances[pool.targetSymbol] ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={depositToken}
                    onChange={e => setDepositToken(e.target.value)}
                    className="flex-1 bg-transparent font-mono text-lg font-bold text-neutral-900 dark:text-white focus:outline-none"
                  />
                  <span className="font-mono text-xs font-semibold text-neutral-500">{pool.targetSymbol}</span>
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400 cursor-pointer">
              <input
                type="checkbox"
                checked={singleSided}
                onChange={e => setSingleSided(e.target.checked)}
                className="w-3.5 h-3.5 accent-emerald-500 rounded"
              />
              Single-sided deposit (auto-recycles into mirror pool)
            </label>

            <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 font-mono text-[11px] space-y-1 text-neutral-600 dark:text-neutral-400">
              <div className="flex justify-between">
                <span>Fee Tier:</span>
                <span className="text-neutral-900 dark:text-white font-bold">{(pool.feeBps / 100).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Network Gas:</span>
                <span className="text-emerald-500 font-bold">~250 sats (1 sat/byte)</span>
              </div>
              <div className="flex justify-between">
                <span>Sovereign Exit:</span>
                <span className="text-neutral-900 dark:text-white">100% Non-Custodial Dock</span>
              </div>
            </div>

            <button
              onClick={handleDeposit}
              disabled={success}
              className="w-full py-3.5 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold text-xs hover:opacity-90 transition-opacity flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              {success ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Bins Funded Successfully!</span>
                </>
              ) : (
                <>
                  <span>Deploy Liquidity Bins</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
`;

writeFile('src/components/app/MeshLiquidityTerminal.tsx', liquidityTerminal);

// -----------------------------------------------------------------------------
// 4. MeshStrategyStudio.tsx (Curated Archetypes + Strategy Builder)
// -----------------------------------------------------------------------------
const strategyStudio = `
import React, { useState } from 'react';
import { useMeshApp } from '@/context/MeshAppContext';
import { ARCHETYPES, type StrategyArchetype, MOCK_POOLS } from '@/lib/meshApi';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Repeat,
  Zap,
  Scale,
  Flame,
  SlidersHorizontal,
  ChevronDown,
  Info,
} from 'lucide-react';

export function MeshStrategyStudio() {
  const { selectedTemplate, setSelectedTemplate, bchBalance, tokenBalances, addPosition, setSubTab } = useMeshApp();

  const [activeTab, setActiveTab] = useState<'gallery' | 'builder'>(selectedTemplate ? 'builder' : 'gallery');
  const [templateId, setTemplateId] = useState<string>(selectedTemplate ?? 'recycling-pair');

  // Builder form inputs
  const [tokenSymbol, setTokenSymbol] = useState('pUSD');
  const [price, setPrice] = useState('357.25');
  const [feeBps, setFeeBps] = useState('30');
  const [proceeds, setProceeds] = useState<'recycle' | 'wallet'>('recycle');
  const [depositBch, setDepositBch] = useState('2.50');
  const [depositToken, setDepositToken] = useState('893.12');
  const [preset, setPreset] = useState<'tight' | 'balanced' | 'wide' | 'custom'>('balanced');
  const [success, setSuccess] = useState(false);

  const currentArch = ARCHETYPES.find(a => a.id === templateId) ?? ARCHETYPES[0];

  const handlePick = (id: string) => {
    setTemplateId(id);
    setSelectedTemplate(id);
    setActiveTab('builder');
  };

  const applyPreset = (p: 'tight' | 'balanced' | 'wide') => {
    setPreset(p);
    const mid = 357.25;
    const pct = p === 'tight' ? 1.5 : p === 'balanced' ? 5.0 : 15.0;
    // Set simulated bounds
    setPrice((mid * (1 + pct / 100)).toFixed(2));
  };

  const handleDeploy = () => {
    addPosition({
      name: \`\${currentArch.name} (\${tokenSymbol})\`,
      template: templateId,
      pair: \`BCH / \${tokenSymbol}\`,
      depositBch: parseFloat(depositBch) || 0,
      depositTokens: parseFloat(depositToken) || 0,
      tokenSymbol,
      valueUsd: (parseFloat(depositBch) || 0) * 357.5 + (parseFloat(depositToken) || 0),
      status: 'optimal',
      minPrice: parseFloat(price) * 0.95,
      maxPrice: parseFloat(price) * 1.05,
      currentPrice: 357.25,
    });
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      setSubTab('portfolio');
    }, 1200);
  };

  return (
    <div className="space-y-6">
      {/* Top Studio Switcher */}
      <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('gallery')}
            className={\`px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors \${
              activeTab === 'gallery'
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                : 'text-neutral-500 hover:text-white'
            }\`}
          >
            Curated Archetypes ({ARCHETYPES.length})
          </button>
          <button
            onClick={() => setActiveTab('builder')}
            className={\`px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors \${
              activeTab === 'builder'
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                : 'text-neutral-500 hover:text-white'
            }\`}
          >
            Custom Strategy Studio
          </button>
        </div>

        <a
          href="/docs/mesh/strategies/configuration-guide"
          target="_blank"
          className="text-xs font-semibold text-neutral-500 hover:text-emerald-400 transition-colors flex items-center gap-1 font-mono"
        >
          <span>View Comparison Specs</span> →
        </a>
      </div>

      {activeTab === 'gallery' ? (
        /* Archetypes Gallery View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ARCHETYPES.map(arch => (
            <div
              key={arch.id}
              className="p-5 rounded-2xl bg-white dark:bg-[#121215] border border-neutral-200/80 dark:border-neutral-800 space-y-3.5 hover:border-neutral-400 dark:hover:border-neutral-600 transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-base text-neutral-900 dark:text-white">{arch.name}</h3>
                  <div className="flex items-center gap-1.5">
                    {arch.recycles && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <Repeat className="w-2.5 h-2.5" /> Recycles
                      </span>
                    )}
                    <span className="font-mono text-[10px] text-neutral-500 uppercase">{arch.category}</span>
                  </div>
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">{arch.summary}</p>
              </div>

              <div className="space-y-2 pt-2 border-t border-neutral-200 dark:border-neutral-800 text-[11px] font-mono">
                <div className="flex justify-between text-neutral-500">
                  <span>Est. APY:</span>
                  <span className="text-emerald-500 font-bold">{arch.estApy}</span>
                </div>
                <div className="flex justify-between text-neutral-500">
                  <span>Deposit:</span>
                  <span className="text-neutral-800 dark:text-neutral-200">{arch.deposit}</span>
                </div>
                <div className="flex justify-between text-neutral-500">
                  <span>Risk Level:</span>
                  <span className="text-amber-500">{arch.risk}</span>
                </div>
              </div>

              <button
                onClick={() => handlePick(arch.id)}
                className="w-full py-2.5 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold text-xs hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Configure Strategy</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        /* Interactive Strategy Builder View */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Form & Presets */}
          <div className="lg:col-span-7 space-y-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-[#121215] border border-neutral-200/80 dark:border-neutral-800 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
                <div>
                  <h3 className="font-bold text-lg text-neutral-900 dark:text-white">{currentArch.name}</h3>
                  <p className="text-xs text-neutral-500 font-mono mt-0.5">{currentArch.summary}</p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Sovereign Covenant
                </span>
              </div>

              {/* Range Presets Selector */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 font-mono uppercase">
                  Range & Volatility Presets
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => applyPreset('tight')}
                    className={\`p-2 rounded-xl border text-left cursor-pointer transition-all \${
                      preset === 'tight' ? 'border-emerald-500 bg-emerald-950/20 text-white' : 'border-neutral-200 dark:border-neutral-800 text-neutral-400'
                    }\`}
                  >
                    <div className="text-xs font-bold flex items-center gap-1"><Zap className="w-3 h-3 text-emerald-400" /> Tight (±1.5%)</div>
                    <div className="text-[9px] text-neutral-500 font-mono">High fee capture</div>
                  </button>
                  <button
                    onClick={() => applyPreset('balanced')}
                    className={\`p-2 rounded-xl border text-left cursor-pointer transition-all \${
                      preset === 'balanced' ? 'border-emerald-500 bg-emerald-950/20 text-white' : 'border-neutral-200 dark:border-neutral-800 text-neutral-400'
                    }\`}
                  >
                    <div className="text-xs font-bold flex items-center gap-1"><Scale className="w-3 h-3 text-emerald-400" /> Balanced (±5%)</div>
                    <div className="text-[9px] text-neutral-500 font-mono">Recommended</div>
                  </button>
                  <button
                    onClick={() => applyPreset('wide')}
                    className={\`p-2 rounded-xl border text-left cursor-pointer transition-all \${
                      preset === 'wide' ? 'border-emerald-500 bg-emerald-950/20 text-white' : 'border-neutral-200 dark:border-neutral-800 text-neutral-400'
                    }\`}
                  >
                    <div className="text-xs font-bold flex items-center gap-1"><Flame className="w-3 h-3 text-emerald-400" /> Wide (±15%)</div>
                    <div className="text-[9px] text-neutral-500 font-mono">Low maintenance</div>
                  </button>
                </div>
              </div>

              {/* Fee Tier Selector */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 font-mono uppercase">
                  Fee Tier Selector
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { bps: '5', label: '0.05%', name: 'Pegged' },
                    { bps: '30', label: '0.30%', name: 'Standard' },
                    { bps: '50', label: '0.50%', name: 'Volatile' },
                    { bps: '100', label: '1.00%', name: 'Exotic' },
                  ].map(t => (
                    <button
                      key={t.bps}
                      onClick={() => setFeeBps(t.bps)}
                      className={\`p-2 rounded-xl border text-left cursor-pointer transition-all \${
                        feeBps === t.bps ? 'border-emerald-500 bg-emerald-950/20 text-white' : 'border-neutral-200 dark:border-neutral-800 text-neutral-400'
                      }\`}
                    >
                      <div className="font-mono text-xs font-bold text-emerald-400">{t.label}</div>
                      <div className="text-[9px] text-neutral-500">{t.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Proceeds Mode */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 font-mono uppercase">
                  Proceeds Destination
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => setProceeds('recycle')}
                    className={\`p-3 rounded-xl border text-left cursor-pointer transition-all \${
                      proceeds === 'recycle' ? 'border-emerald-500 bg-emerald-950/20 text-white' : 'border-neutral-200 dark:border-neutral-800 text-neutral-400'
                    }\`}
                  >
                    <div className="text-xs font-bold flex items-center gap-1.5"><Repeat className="w-3.5 h-3.5 text-emerald-400" /> Keep in Mesh (Recycle)</div>
                    <div className="text-[10px] text-neutral-500 mt-1">Fills fund reverse mirror pool automatically</div>
                  </button>
                  <button
                    onClick={() => setProceeds('wallet')}
                    className={\`p-3 rounded-xl border text-left cursor-pointer transition-all \${
                      proceeds === 'wallet' ? 'border-emerald-500 bg-emerald-950/20 text-white' : 'border-neutral-200 dark:border-neutral-800 text-neutral-400'
                    }\`}
                  >
                    <div className="text-xs font-bold flex items-center gap-1.5">Pay to My Wallet</div>
                    <div className="text-[10px] text-neutral-500 mt-1">Direct sweep to CashAddress</div>
                  </button>
                </div>
              </div>

              {/* Deposit Inputs */}
              <div className="space-y-3 pt-2">
                <div className="p-3.5 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-1">
                  <div className="flex justify-between text-xs text-neutral-500 font-mono">
                    <span>BCH Deposit Amount</span>
                    <span>Bal: {bchBalance.toFixed(4)} BCH</span>
                  </div>
                  <input
                    type="text"
                    value={depositBch}
                    onChange={e => setDepositBch(e.target.value)}
                    className="w-full bg-transparent font-mono text-base font-bold text-neutral-900 dark:text-white focus:outline-none"
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-1">
                  <div className="flex justify-between text-xs text-neutral-500 font-mono">
                    <span>{tokenSymbol} Deposit Amount</span>
                    <span>Bal: {(tokenBalances[tokenSymbol] ?? 0).toLocaleString()}</span>
                  </div>
                  <input
                    type="text"
                    value={depositToken}
                    onChange={e => setDepositToken(e.target.value)}
                    className="w-full bg-transparent font-mono text-base font-bold text-neutral-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Pre-Flight Verification & Deploy */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-[#121215] border border-neutral-200/80 dark:border-neutral-800 space-y-4">
              <h3 className="font-bold text-base text-neutral-900 dark:text-white font-mono uppercase tracking-wider">
                Pre-Flight Contract Verification
              </h3>

              <div className="space-y-2 text-xs font-mono">
                <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-1">
                  <div className="text-neutral-500">Contract Bytecode:</div>
                  <div className="text-white font-bold">MeshPoolV3.cash (Verified)</div>
                </div>
                <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-1">
                  <div className="text-neutral-500">Target Pools to Open:</div>
                  <div className="text-white font-bold">2 Autonomous Covenants (Bid + Mirror Ask)</div>
                </div>
                <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-1">
                  <div className="text-neutral-500">Estimated Gas Fee:</div>
                  <div className="text-emerald-400 font-bold">250 sats (1 sat/byte)</div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-800/40 text-[11px] text-emerald-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>100% Non-Custodial: Only your private key can execute sovereign dock spend path.</span>
              </div>

              <button
                onClick={handleDeploy}
                disabled={success}
                className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                {success ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-black" />
                    <span>Deploying Strategy Covenants...</span>
                  </>
                ) : (
                  <>
                    <span>Deploy Strategy (1 Sat Fee)</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
`;

writeFile('src/components/app/MeshStrategyStudio.tsx', strategyStudio);

// -----------------------------------------------------------------------------
// 5. MeshPortfolio.tsx (Active Positions, Fee Claim, Dock Exit)
// -----------------------------------------------------------------------------
const portfolioContent = `
import React from 'react';
import { useMeshApp } from '@/context/MeshAppContext';
import { PieChart, Repeat, ArrowUpRight, MinusCircle, RefreshCw, CheckCircle2 } from 'lucide-react';

export function MeshPortfolio() {
  const { positions, dockPosition, claimFees, bchBalance } = useMeshApp();

  const totalValue = positions.reduce((a, b) => a + b.valueUsd, 0);
  const totalFeesSats = positions.reduce((a, b) => a + b.feesEarnedSats, 0);
  const totalPnl = positions.reduce((a, b) => a + b.pnlUsd, 0);

  return (
    <div className="space-y-6">
      {/* Portfolio Summary Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#121215] border border-neutral-200/80 dark:border-neutral-800">
          <div className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider">Deposited Strategy Value</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-neutral-900 dark:text-white mt-1">
            $\${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-neutral-500 font-mono mt-0.5">Across {positions.length} active covenants</div>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-[#121215] border border-neutral-200/80 dark:border-neutral-800">
          <div className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider">Total Accrued Fees</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-500 mt-1">
            {totalFeesSats.toLocaleString()} sats
          </div>
          <div className="text-[11px] text-emerald-600 font-mono mt-0.5">
            ≈ $\${((totalFeesSats / 1e8) * 357.5).toFixed(2)} USD
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-[#121215] border border-neutral-200/80 dark:border-neutral-800">
          <div className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider">Total Net P&L</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-500 mt-1">
            +$\${totalPnl.toFixed(2)}
          </div>
          <div className="text-[11px] text-emerald-600 font-mono mt-0.5">Fees + Spread earnings</div>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-[#121215] border border-neutral-200/80 dark:border-neutral-800">
          <div className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider">Weighted Strategy APY</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-neutral-900 dark:text-white mt-1">
            26.4%
          </div>
          <div className="text-[11px] text-sky-400 font-mono mt-0.5">Dynamic compounding</div>
        </div>
      </div>

      {/* Active Positions List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base text-neutral-900 dark:text-white font-mono uppercase tracking-wider">
            Active Strategy Positions ({positions.length})
          </h3>
          <span className="text-xs text-neutral-500 font-mono">
            Sovereign UTXOs verified on Bitcoin Cash
          </span>
        </div>

        {positions.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-800 text-neutral-500 text-xs font-mono">
            No active positions deployed yet. Visit Strategy Studio to open one.
          </div>
        ) : (
          <div className="space-y-3">
            {positions.map(pos => {
              const inRange = pos.currentPrice >= pos.minPrice && pos.currentPrice <= pos.maxPrice;
              return (
                <div
                  key={pos.id}
                  className="p-5 rounded-2xl bg-white dark:bg-[#121215] border border-neutral-200/80 dark:border-neutral-800 space-y-4 hover:border-neutral-400 dark:hover:border-neutral-700 transition-all"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-neutral-900 dark:text-white">{pos.name}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400">
                          {pos.pair}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-neutral-500 mt-0.5">
                        {pos.id} · {pos.recyclesCount} Mirror Recycles Completed
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={\`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold \${
                        inRange
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                      }\`}>
                        <span className={\`w-1.5 h-1.5 rounded-full \${inRange ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}\`} />
                        {inRange ? 'IN RANGE' : 'REBALANCING'}
                      </span>
                    </div>
                  </div>

                  {/* Mini-Bin Range Visualizer */}
                  <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-1.5">
                    <div className="flex justify-between text-[10px] font-mono text-neutral-500">
                      <span>Min: {pos.minPrice}</span>
                      <span className="text-sky-400 font-bold">Mid: {pos.currentPrice}</span>
                      <span>Max: {pos.maxPrice}</span>
                    </div>
                    <div className="h-2 rounded-full bg-neutral-200 dark:bg-neutral-800 relative overflow-hidden">
                      <div
                        className="absolute top-0 bottom-0 bg-emerald-500 rounded-full"
                        style={{
                          left: '25%',
                          width: '50%',
                        }}
                      />
                      <div
                        className="absolute top-0 bottom-0 w-1 bg-white shadow-xs"
                        style={{ left: '48%' }}
                      />
                    </div>
                  </div>

                  {/* Metrics Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                    <div>
                      <div className="text-neutral-500 text-[10px]">Position Value</div>
                      <div className="font-bold text-neutral-900 dark:text-white">$\${pos.valueUsd.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-neutral-500 text-[10px]">Deposited</div>
                      <div className="text-neutral-700 dark:text-neutral-300">
                        {pos.depositBch} BCH + {pos.depositTokens} {pos.tokenSymbol}
                      </div>
                    </div>
                    <div>
                      <div className="text-neutral-500 text-[10px]">Accrued Fees</div>
                      <div className="font-bold text-emerald-500">{pos.feesEarnedSats} sats</div>
                    </div>
                    <div>
                      <div className="text-neutral-500 text-[10px]">Net P&L</div>
                      <div className="font-bold text-emerald-500">+$\${pos.pnlUsd.toFixed(2)}</div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                    <button
                      onClick={() => claimFees(pos.id)}
                      disabled={pos.feesEarnedSats === 0}
                      className="px-3 py-1.5 rounded-xl border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 text-xs font-semibold font-mono disabled:opacity-40 cursor-pointer"
                    >
                      Sweep Fees ({pos.feesEarnedSats} sats)
                    </button>
                    <button
                      onClick={() => dockPosition(pos.id)}
                      className="px-3 py-1.5 rounded-xl border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold font-mono cursor-pointer"
                    >
                      Sovereign Dock Exit (Withdraw All)
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
`;

writeFile('src/components/app/MeshPortfolio.tsx', portfolioContent);

// -----------------------------------------------------------------------------
// 6. MeshNostrStream.tsx (Live Mempool Intent Feed)
// -----------------------------------------------------------------------------
const nostrStream = `
import React, { useState, useEffect } from 'react';
import { Radio, ShieldCheck, Zap, ArrowRight, ExternalLink, Activity } from 'lucide-react';

interface NostrIntent {
  id: string;
  sender: string;
  type: 'LIMIT_SWAP' | 'ARBITRAGE_FILL' | 'RECYCLE_MIRROR';
  give: string;
  want: string;
  rate: string;
  solver: string;
  status: 'BROADCASTING' | 'MATCHED' | 'SETTLED';
  timestamp: string;
}

export function MeshNostrStream() {
  const [intents, setIntents] = useState<NostrIntent[]>([
    {
      id: 'nip90-intent-98a2',
      sender: 'npub1x88fa...92a1',
      type: 'LIMIT_SWAP',
      give: '1.25 BCH',
      want: '446.50 pUSD',
      rate: '357.20 pUSD/BCH',
      solver: 'solver-omega-01',
      status: 'SETTLED',
      timestamp: '2s ago',
    },
    {
      id: 'nip90-intent-44c1',
      sender: 'npub1k39pl...11f8',
      type: 'RECYCLE_MIRROR',
      give: '358.10 pUSD',
      want: '1.00 BCH',
      rate: '358.10 pUSD/BCH',
      solver: 'covenant-self-recycle',
      status: 'SETTLED',
      timestamp: '6s ago',
    },
    {
      id: 'nip90-intent-77e4',
      sender: 'npub1qq00z...55d2',
      type: 'ARBITRAGE_FILL',
      give: '0.85 BCH',
      want: '1,054 MESH',
      rate: '1,240 MESH/BCH',
      solver: 'solver-alpha-09',
      status: 'MATCHED',
      timestamp: '11s ago',
    },
  ]);

  // Simulate incoming gossip intents
  useEffect(() => {
    const interval = setInterval(() => {
      const newIntent: NostrIntent = {
        id: 'nip90-intent-' + Math.random().toString(36).substring(2, 6),
        sender: 'npub1' + Math.random().toString(36).substring(2, 8),
        type: Math.random() > 0.5 ? 'LIMIT_SWAP' : 'RECYCLE_MIRROR',
        give: (Math.random() * 2 + 0.5).toFixed(2) + ' BCH',
        want: (Math.random() * 700 + 150).toFixed(2) + ' pUSD',
        rate: '357.40 pUSD/BCH',
        solver: 'solver-batch-bot',
        status: 'SETTLED',
        timestamp: 'Just now',
      };
      setIntents(prev => [newIntent, ...prev.slice(0, 9)]);
    }, 7000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Relays Status Banner */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#121215] border border-neutral-200/80 dark:border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-mono text-xs">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span className="font-bold text-neutral-900 dark:text-white">Nostr NIP-90 Intent Swarm Connected</span>
          </div>
          <p className="text-neutral-500 text-[11px] mt-1">wss://relay.meshprotocol.org · 38ms latency</p>
        </div>

        <div className="flex items-center gap-6">
          <div>
            <div className="text-[10px] text-neutral-500 uppercase">Gossip Speed</div>
            <div className="text-neutral-900 dark:text-white font-bold">18 intents/s</div>
          </div>
          <div>
            <div className="text-[10px] text-neutral-500 uppercase">Active Solvers</div>
            <div className="text-emerald-400 font-bold">6 Competing</div>
          </div>
        </div>
      </div>

      {/* Live Intent Feed Table */}
      <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800 overflow-hidden bg-white dark:bg-[#121215]">
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <span className="font-mono text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
            Live Decentralized Order Gossip
          </span>
          <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
            <Activity className="w-3.5 h-3.5" /> Real-time Mempool Stream
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 font-mono text-[10px] text-neutral-500 uppercase bg-neutral-50 dark:bg-neutral-900/40">
                <th className="py-3 px-4">Intent ID</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Give Asset</th>
                <th className="py-3 px-4">Want Asset</th>
                <th className="py-3 px-4">Execution Rate</th>
                <th className="py-3 px-4">Solver</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800/60 font-mono">
              {intents.map(intent => (
                <tr key={intent.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/40 transition-colors">
                  <td className="py-3 px-4 text-neutral-900 dark:text-white font-bold">{intent.id}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-md text-[10px] bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                      {intent.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-neutral-700 dark:text-neutral-300">{intent.give}</td>
                  <td className="py-3 px-4 text-neutral-700 dark:text-neutral-300">{intent.want}</td>
                  <td className="py-3 px-4 text-neutral-900 dark:text-white">{intent.rate}</td>
                  <td className="py-3 px-4 text-neutral-500">{intent.solver}</td>
                  <td className="py-3 px-4 text-right">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      {intent.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
`;

writeFile('src/components/app/MeshNostrStream.tsx', nostrStream);

// -----------------------------------------------------------------------------
// 7. MeshCovenantInspector.tsx (CashScript Bytecode & UTXO State)
// -----------------------------------------------------------------------------
const inspectorContent = `
import React from 'react';
import { FileCode2, ShieldCheck, CheckCircle2, Terminal } from 'lucide-react';

export function MeshCovenantInspector() {
  const cashScriptSource = \`pragma cashscript ^0.10.0;

/**
 * MeshPoolV3 — Sovereign Non-Custodial UTXO Covenant
 * Enforces atomic intent fills and perpetual mirror pool recycling.
 */
contract MeshPoolV3(
    bytes20 ownerPkh,
    bytes reserveCategory,
    bytes slotsData,
    int feeBps,
    int mode,
    bytes32 proceedsHash
) {
    // Spend path 1: Sovereign Dock (Owner emergency or yield withdrawal)
    function dock(pubkey pk, sig s) {
        require(hash160(pk) == ownerPkh);
        require(checkSig(s, pk));
    }

    // Spend path 2: Atomic Intent Fill by Solvers
    function fill(bytes swapProof, int fillAmount) {
        // Enforce exact output satoshis & CashTokens back to covenant or mirror
        require(fillAmount > 0);
        require(tx.outputs[0].lockingBytecode == tx.inputs[this.activeInputIndex].lockingBytecode);
    }
}\`;

  return (
    <div className="space-y-6">
      <div className="p-5 rounded-2xl bg-white dark:bg-[#121215] border border-neutral-200/80 dark:border-neutral-800 space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <h3 className="font-bold text-base text-neutral-900 dark:text-white">CashScript Covenant On-Chain Verification</h3>
        </div>
        <p className="text-xs text-neutral-500 leading-relaxed">
          Every Mesh Finance pool runs on unalterable CashScript bytecode compiled for Bitcoin Cash Chipnet & Mainnet.
        </p>
      </div>

      <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800 overflow-hidden bg-neutral-950 font-mono text-xs">
        <div className="p-3 bg-neutral-900/80 border-b border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span>contracts/MeshPoolV3.cash</span>
          </div>
          <span className="text-emerald-400">Artifact Hash: 0x9f88c... verified</span>
        </div>
        <pre className="p-5 overflow-x-auto text-neutral-300 leading-relaxed font-mono">
          {cashScriptSource}
        </pre>
      </div>
    </div>
  );
}
`;

writeFile('src/components/app/MeshCovenantInspector.tsx', inspectorContent);

// -----------------------------------------------------------------------------
// 8. Update App.tsx to wire in MeshAppProvider & MeshAppShell
// -----------------------------------------------------------------------------
const appTsx = `
import React, { useEffect, useState } from 'react';
import { useMesh } from '@/context/MeshContext';
import { MeshAppProvider } from '@/context/MeshAppContext';
import { MeshCanvas } from '@/components/common/MeshCanvas';
import { MeshHeader } from '@/components/common/MeshHeader';
import { MeshFooter } from '@/components/common/MeshFooter';
import { MeshHero } from '@/components/landing/MeshHero';
import { MeshStatsBar } from '@/components/landing/MeshStatsBar';
import { MeshKeyFeatures } from '@/components/landing/MeshKeyFeatures';
import { MeshRecyclingVisualizer } from '@/components/landing/MeshRecyclingVisualizer';
import { MeshStrategyTemplatesSection } from '@/components/landing/MeshStrategyTemplatesSection';
import { MeshTriRouteSection } from '@/components/landing/MeshTriRouteSection';
import { MeshYieldSimulator } from '@/components/landing/MeshYieldSimulator';
import { MeshArchitectureBento } from '@/components/landing/MeshArchitectureBento';
import { MeshCovenantVisualizer } from '@/components/landing/MeshCovenantVisualizer';
import { MeshFAQ } from '@/components/landing/MeshFAQ';
import { MeshDocs } from '@/components/docs/MeshDocs';
import { MeshAppShell } from '@/components/app/MeshAppShell';

export function App() {
  const { activeTab, theme } = useMesh();
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const scrollTop = el.scrollTop || document.body.scrollTop;
      const scrollHeight = el.scrollHeight - el.clientHeight;
      setScrollProgress(scrollHeight > 0 ? scrollTop / scrollHeight : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <MeshAppProvider>
      <div className={\`min-h-screen flex flex-col transition-colors duration-200 relative \${theme === 'dark' ? 'bg-[#09090b] text-[#fafafa]' : 'bg-[#f9f9fb] text-[#09090b]'}\`}>
        {/* Top Scroll Indicator */}
        <div className="fixed top-0 left-0 right-0 h-[2px] z-[100] bg-transparent pointer-events-none">
          <div
            className="h-full bg-neutral-900 dark:bg-white transition-[width] duration-75"
            style={{ width: \`\${scrollProgress * 100}%\` }}
          />
        </div>

        {/* Interactive Mesh Canvas in background */}
        <MeshCanvas />

        {/* Wireframe Header */}
        <MeshHeader />

        {/* Main Body */}
        <main className="flex-1 relative z-10">
          {activeTab === 'landing' && (
            <>
              <MeshHero />
              <MeshStatsBar />
              <MeshKeyFeatures />
              <MeshRecyclingVisualizer />
              <MeshStrategyTemplatesSection />
              <MeshTriRouteSection />
              <MeshYieldSimulator />
              <MeshArchitectureBento />
              <MeshCovenantVisualizer />
              <MeshFAQ />
            </>
          )}
          {activeTab === 'docs' && <MeshDocs />}
          {activeTab === 'app' && <MeshAppShell />}
        </main>

        {/* Wireframe Brutalist Footer */}
        <MeshFooter />
      </div>
    </MeshAppProvider>
  );
}

export default App;
`;

writeFile('src/App.tsx', appTsx);

console.log('✓ All Mesh Finance DeFi App modules successfully generated!');
