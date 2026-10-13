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

// -----------------------------------------------------------------------------
// 1. High-Contrast MeshPoolsExplorer.tsx
// -----------------------------------------------------------------------------
writeFile('src/components/app/MeshPoolsExplorer.tsx', `
import React, { useState } from 'react';
import { useMeshApp } from '@/context/MeshAppContext';
import { MOCK_POOLS, type MeshPool } from '@/lib/meshApi';
import { MetricCard } from '@/components/ui/MetricCard';
import { TacticalBadge } from '@/components/ui/TacticalBadge';
import { TactileButton } from '@/components/ui/TactileButton';
import { Search, Sliders, ArrowUpRight, Repeat, Filter, Sparkles, TrendingUp, Layers } from 'lucide-react';

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
      {/* 4-Card Protocol Telemetry Strip using Reusable MetricCards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <MetricCard
          label="Total Value Locked"
          value="$2,418,920"
          subValue="11,840 BCH allocated"
          delta={{ value: "4.8% 24h", isPositive: true }}
        />
        <MetricCard
          label="24h Covenant Volume"
          value="$482,100"
          subValue="1 sat/byte gas efficiency"
          delta={{ value: "12.4%", isPositive: true }}
        />
        <MetricCard
          label="24h LP Fees Generated"
          value="$1,446.30"
          subValue="Paid to LPs"
          delta={{ value: "14.2% vs 7d avg", isPositive: true }}
        />
        <MetricCard
          label="Active Covenants"
          value="48 Pools"
          subValue="100% Non-custodial UTXOs"
        />
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
                  : 'bg-white dark:bg-[#151821] border border-neutral-300 dark:border-neutral-700/80 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400 dark:hover:border-neutral-500'
              }\`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search by token or symbol..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-[#0e1017] border border-neutral-300 dark:border-neutral-700/80 text-xs text-neutral-900 dark:text-white placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 font-mono"
          />
        </div>
      </div>

      {/* Pools Wireframe Table */}
      <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 overflow-hidden bg-white dark:bg-[#151821] shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 font-mono text-[10px] text-neutral-500 uppercase tracking-wider bg-neutral-50 dark:bg-[#11131a]">
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
            <tbody className="divide-y divide-neutral-200/80 dark:divide-neutral-800/80">
              {filteredPools.map(pool => (
                <tr key={pool.address} className="hover:bg-neutral-50 dark:hover:bg-[#1c202c]/50 transition-colors">
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
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200">
                      <Repeat className="w-2.5 h-2.5 text-emerald-500" /> DLMM Bin
                    </span>
                  </td>
                  <td className="py-4 px-4 font-mono">
                    <div className="font-bold text-neutral-900 dark:text-white">$\${pool.tvlUsd.toLocaleString()}</div>
                    <div className="text-[10px] text-neutral-500">{(pool.tvlSats / 1e8).toFixed(2)} BCH</div>
                  </td>
                  <td className="py-4 px-4 font-mono text-neutral-800 dark:text-neutral-200">
                    $\${pool.volume24hUsd.toLocaleString()}
                  </td>
                  <td className="py-4 px-4 font-mono text-neutral-600 dark:text-neutral-400">
                    {(pool.feeBps / 100).toFixed(2)}%
                  </td>
                  <td className="py-4 px-4 font-mono">
                    <span className="text-emerald-500 font-bold">+{pool.apyPct.toFixed(1)}%</span>
                  </td>
                  <td className="py-4 px-4">
                    <TacticalBadge status="optimal" />
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      <TactileButton
                        size="xs"
                        variant="outline"
                        onClick={() => handleProvide(pool)}
                      >
                        Add Bins
                      </TactileButton>
                      <TactileButton
                        size="xs"
                        variant="primary"
                        onClick={() => handleStrategy(pool)}
                      >
                        Strategy
                      </TactileButton>
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
`);

// -----------------------------------------------------------------------------
// 2. High-Contrast MeshLiquidityTerminal.tsx
// -----------------------------------------------------------------------------
writeFile('src/components/app/MeshLiquidityTerminal.tsx', `
import React, { useState } from 'react';
import { useMeshApp } from '@/context/MeshAppContext';
import { MOCK_POOLS } from '@/lib/meshApi';
import { TactileInput } from '@/components/ui/TactileInput';
import { TactileButton } from '@/components/ui/TactileButton';
import { TacticalBadge } from '@/components/ui/TacticalBadge';
import { Sliders, ShieldCheck, CheckCircle2, ArrowRight, Sparkles, Scale, Flame, Zap } from 'lucide-react';

export function MeshLiquidityTerminal() {
  const { selectedPool, bchBalance, tokenBalances, addPosition, setSubTab } = useMeshApp();
  const pool = selectedPool ?? MOCK_POOLS[0];

  const [shape, setShape] = useState<'spot' | 'curve' | 'bid-ask'>('curve');
  const [minPrice, setMinPrice] = useState<number>(340);
  const [maxPrice, setMaxPrice] = useState<number>(375);
  const [depositBch, setDepositBch] = useState<string>('2.50');
  const [depositToken, setDepositToken] = useState<string>('893.12');
  const [singleSided, setSingleSided] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);

  const currentPrice = pool.priceTokensPerBch;

  const handleDeposit = () => {
    setLoading(true);
    setTimeout(() => {
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
      setLoading(false);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setSubTab('portfolio');
      }, 1000);
    }, 600);
  };

  const bins = Array.from({ length: 24 }).map((_, i) => {
    const p = 320 + i * 3.5;
    const isCurrent = Math.abs(p - currentPrice) < 2.0;
    const isInRange = p >= minPrice && p <= maxPrice;

    let height = 30;
    if (shape === 'curve') {
      const dist = Math.abs(p - currentPrice);
      height = Math.max(15, 95 - dist * 3.2);
    } else if (shape === 'spot') {
      height = isInRange ? 65 : 20;
    } else {
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
      {/* Pair Header Banner */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#151821] border border-neutral-300 dark:border-neutral-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="font-extrabold text-xl text-neutral-900 dark:text-white">
              {pool.reserveSymbol} / {pool.targetSymbol}
            </span>
            <TacticalBadge status="optimal" />
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700">
              {(pool.feeBps / 100).toFixed(2)}% Fee Tier
            </span>
          </div>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 font-mono">
            Current Price: 1 BCH = <span className="text-neutral-900 dark:text-white font-bold">{currentPrice}</span> {pool.targetSymbol}
          </p>
        </div>

        <div className="flex items-center gap-6 font-mono text-xs">
          <div>
            <div className="text-neutral-500 text-[10px] uppercase">24h Volume</div>
            <div className="font-bold text-neutral-900 dark:text-white">$\${pool.volume24hUsd.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-neutral-500 text-[10px] uppercase">Dynamic APR</div>
            <div className="font-bold text-emerald-500">+{pool.apyPct}%</div>
          </div>
          <div>
            <div className="text-neutral-500 text-[10px] uppercase">Covenant Reserve</div>
            <div className="font-bold text-neutral-900 dark:text-white">{(pool.tvlSats / 1e8).toFixed(2)} BCH</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive Depth Visualizer */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-[#151821] border border-neutral-300 dark:border-neutral-800 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-900 dark:text-white font-mono uppercase tracking-wider">
                DLMM Discrete Bin Depth Visualizer
              </span>
              <div className="flex items-center gap-1 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-xs font-semibold">
                <button
                  onClick={() => setShape('curve')}
                  className={\`px-2.5 py-1 rounded-lg transition-colors cursor-pointer \${shape === 'curve' ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold' : 'text-neutral-500'}\`}
                >
                  Curve (Concentrated)
                </button>
                <button
                  onClick={() => setShape('spot')}
                  className={\`px-2.5 py-1 rounded-lg transition-colors cursor-pointer \${shape === 'spot' ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold' : 'text-neutral-500'}\`}
                >
                  Spot (Uniform)
                </button>
                <button
                  onClick={() => setShape('bid-ask')}
                  className={\`px-2.5 py-1 rounded-lg transition-colors cursor-pointer \${shape === 'bid-ask' ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold' : 'text-neutral-500'}\`}
                >
                  Bid-Ask Skew
                </button>
              </div>
            </div>

            {/* Depth Bars Container */}
            <div className="relative h-52 rounded-xl bg-[#090a0f] border border-neutral-800 p-4 flex items-end justify-between gap-1 overflow-hidden">
              {/* Mid Cursor */}
              <div className="absolute top-2 bottom-2 left-1/2 w-px bg-sky-400 z-10">
                <span className="absolute top-1 -translate-x-1/2 px-1.5 py-0.5 rounded bg-sky-950 border border-sky-500/50 text-[8px] font-mono text-sky-300 shadow-xs">
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
                        ? 'bg-emerald-500 hover:bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                        : 'bg-neutral-800 hover:bg-neutral-700'
                    }\`}
                    style={{ height: \`\${b.height}%\` }}
                  />
                  <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-neutral-900 text-[9px] font-mono px-1.5 py-0.5 rounded border border-neutral-700 text-white whitespace-nowrap z-20">
                    {b.price.toFixed(1)} {pool.targetSymbol}
                  </div>
                </div>
              ))}
            </div>

            {/* Granular Min/Max Handles */}
            <div className="grid grid-cols-2 gap-4 pt-1">
              <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-[#0e1017] border border-neutral-300 dark:border-neutral-700/80 space-y-1">
                <span className="text-[10px] text-neutral-500 font-mono uppercase font-semibold">Min Price Bound</span>
                <input
                  type="number"
                  value={minPrice}
                  onChange={e => setMinPrice(parseFloat(e.target.value) || 0)}
                  className="w-full bg-transparent font-mono text-base font-bold text-neutral-900 dark:text-white focus:outline-none"
                />
                <span className="text-[10px] text-emerald-500 font-mono">
                  {((minPrice / currentPrice - 1) * 100).toFixed(1)}% vs Market Mid
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-[#0e1017] border border-neutral-300 dark:border-neutral-700/80 space-y-1">
                <span className="text-[10px] text-neutral-500 font-mono uppercase font-semibold">Max Price Bound</span>
                <input
                  type="number"
                  value={maxPrice}
                  onChange={e => setMaxPrice(parseFloat(e.target.value) || 0)}
                  className="w-full bg-transparent font-mono text-base font-bold text-neutral-900 dark:text-white focus:outline-none"
                />
                <span className="text-[10px] text-rose-500 font-mono">
                  {((maxPrice / currentPrice - 1) * 100).toFixed(1)}% vs Market Mid
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Deposit & Action Panel */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-[#151821] border border-neutral-300 dark:border-neutral-800 space-y-4 shadow-xs">
            <h3 className="font-bold text-base text-neutral-900 dark:text-white">Deposit Liquidity</h3>

            <div className="space-y-3">
              <TactileInput
                label="BCH Deposit"
                balanceHint={\`Bal: \${bchBalance.toFixed(4)} BCH\`}
                value={depositBch}
                onChange={e => setDepositBch(e.target.value)}
                suffix="BCH"
                onMax={() => setDepositBch(Math.max(0, bchBalance - 0.001).toFixed(4))}
                onFraction={f => setDepositBch((bchBalance * f).toFixed(4))}
              />

              <TactileInput
                label={\`\${pool.targetSymbol} Deposit\`}
                balanceHint={\`Bal: \${(tokenBalances[pool.targetSymbol] ?? 0).toLocaleString()} \${pool.targetSymbol}\`}
                value={depositToken}
                onChange={e => setDepositToken(e.target.value)}
                suffix={pool.targetSymbol}
                onMax={() => setDepositToken(String(tokenBalances[pool.targetSymbol] ?? 0))}
                onFraction={f => setDepositToken(String(Math.floor((tokenBalances[pool.targetSymbol] ?? 0) * f)))}
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={singleSided}
                onChange={e => setSingleSided(e.target.checked)}
                className="w-4 h-4 accent-emerald-500 rounded"
              />
              <span>Single-sided deposit (auto-recycles into mirror covenant)</span>
            </label>

            <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-[#0e1017] border border-neutral-200 dark:border-neutral-800 font-mono text-[11px] space-y-1.5 text-neutral-600 dark:text-neutral-400">
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
                <span className="text-neutral-900 dark:text-white font-bold">100% Non-Custodial Dock</span>
              </div>
            </div>

            <TactileButton
              variant="emerald"
              size="lg"
              className="w-full h-12"
              loading={loading}
              onClick={handleDeposit}
            >
              {success ? 'Bins Funded Successfully!' : 'Deploy Liquidity Bins (1 Sat Fee)'}
            </TactileButton>
          </div>
        </div>
      </div>
    </div>
  );
}
`);

// -----------------------------------------------------------------------------
// 3. High-Contrast MeshPortfolio.tsx
// -----------------------------------------------------------------------------
writeFile('src/components/app/MeshPortfolio.tsx', `
import React from 'react';
import { useMeshApp } from '@/context/MeshAppContext';
import { MetricCard } from '@/components/ui/MetricCard';
import { TacticalBadge } from '@/components/ui/TacticalBadge';
import { TactileButton } from '@/components/ui/TactileButton';
import { PieChart, Repeat, ArrowUpRight, MinusCircle, RefreshCw, CheckCircle2 } from 'lucide-react';

export function MeshPortfolio() {
  const { positions, dockPosition, claimFees, bchBalance } = useMeshApp();

  const totalValue = positions.reduce((a, b) => a + b.valueUsd, 0);
  const totalFeesSats = positions.reduce((a, b) => a + b.feesEarnedSats, 0);
  const totalPnl = positions.reduce((a, b) => a + b.pnlUsd, 0);

  return (
    <div className="space-y-6">
      {/* Portfolio Telemetry Bar using MetricCard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <MetricCard
          label="Deposited Strategy Value"
          value={\`$\${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\`}
          subValue={\`Across \${positions.length} active covenants\`}
        />
        <MetricCard
          label="Total Accrued Fees"
          value={\`\${totalFeesSats.toLocaleString()} sats\`}
          subValue={\`≈ $\${((totalFeesSats / 1e8) * 357.5).toFixed(2)} USD\`}
          delta={{ value: "Live Accruing", isPositive: true }}
        />
        <MetricCard
          label="Total Net P&L"
          value={\`+$\${totalPnl.toFixed(2)}\`}
          subValue="Fees + Spread profit"
          delta={{ value: "Net Positive", isPositive: true }}
        />
        <MetricCard
          label="Weighted Strategy APY"
          value="26.4%"
          subValue="Dynamic compounding"
          delta={{ value: "Real Yield", isPositive: true }}
        />
      </div>

      {/* Positions List */}
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
                  className="p-5 rounded-2xl bg-white dark:bg-[#151821] border border-neutral-300 dark:border-neutral-800 space-y-4 hover:border-neutral-400 dark:hover:border-neutral-600 transition-all shadow-xs"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-base text-neutral-900 dark:text-white">{pos.name}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200">
                          {pos.pair}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-neutral-500 mt-0.5">
                        {pos.id} · {pos.recyclesCount} Mirror Recycles Completed
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <TacticalBadge status={inRange ? 'in-range' : 'rebalancing'} />
                    </div>
                  </div>

                  {/* Mini-Bin Range Visualizer */}
                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-[#0e1017] border border-neutral-200 dark:border-neutral-800 space-y-1.5 font-mono">
                    <div className="flex justify-between text-[10px] text-neutral-500">
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
                      <div className="text-neutral-500 text-[10px] uppercase">Position Value</div>
                      <div className="font-bold text-neutral-900 dark:text-white">$\${pos.valueUsd.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-neutral-500 text-[10px] uppercase">Deposited</div>
                      <div className="text-neutral-700 dark:text-neutral-300">
                        {pos.depositBch} BCH + {pos.depositTokens} {pos.tokenSymbol}
                      </div>
                    </div>
                    <div>
                      <div className="text-neutral-500 text-[10px] uppercase">Accrued Fees</div>
                      <div className="font-bold text-emerald-500">{pos.feesEarnedSats} sats</div>
                    </div>
                    <div>
                      <div className="text-neutral-500 text-[10px] uppercase">Net P&L</div>
                      <div className="font-bold text-emerald-500">+$\${pos.pnlUsd.toFixed(2)}</div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                    <TactileButton
                      size="sm"
                      variant="outline"
                      disabled={pos.feesEarnedSats === 0}
                      onClick={() => claimFees(pos.id)}
                    >
                      Sweep Fees ({pos.feesEarnedSats} sats)
                    </TactileButton>
                    <TactileButton
                      size="sm"
                      variant="destructive"
                      onClick={() => dockPosition(pos.id)}
                    >
                      Sovereign Dock Exit
                    </TactileButton>
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
`);

console.log('✓ Stage 3 complete: High-contrast pages upgraded with reusable primitives.');
