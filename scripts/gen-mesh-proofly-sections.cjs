const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../../meshprotocol');

function writeFile(relPath, content) {
  const fullPath = path.join(rootDir, relPath);
  fs.writeFileSync(fullPath, content.trim() + '\n', 'utf8');
  console.log('Updated: ' + relPath);
}

// ==========================================
// 1. MeshRecyclingVisualizer.tsx
// ==========================================
writeFile('src/components/landing/MeshRecyclingVisualizer.tsx', `
import React, { useState, useEffect } from 'react';
import { useMesh } from '@/context/MeshContext';
import { CornerCrosshair } from '@/components/common/MeshWireframeBox';
import { motion } from 'framer-motion';
import { RefreshCw, Play, Pause, Repeat, ArrowRight } from 'lucide-react';

export function MeshRecyclingVisualizer() {
  const { t, language } = useMesh();
  const [activeStep, setActiveStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  const isZh = language === 'zh';

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 4);
    }, 4500);
    return () => clearInterval(timer);
  }, [isPlaying]);

  const steps = [
    {
      title: t.recycling.step1Title,
      desc: t.recycling.step1Desc,
      state: isZh ? '买单挂单中' : 'Active Bid Pool',
      holding: '10.00 BCH',
      action: isZh ? '在 3,200 汇率挂单收购 pUSD' : 'Bidding for pUSD at 3,200 sats',
      poolType: 'Bid Pool (UTXO #1)',
    },
    {
      title: t.recycling.step2Title,
      desc: t.recycling.step2Desc,
      state: isZh ? '链上原子成交' : 'Atomic Fill On-Chain',
      holding: '32,000 pUSD Received',
      action: isZh ? '收益绕过池金库，同交易实例化镜像卖单' : 'Proceeds instantiate mirror ask in same tx',
      poolType: 'Atomic Transition',
    },
    {
      title: t.recycling.step3Title,
      desc: t.recycling.step3Desc,
      state: isZh ? '镜像卖单激活' : 'Mirror Ask Live',
      holding: '32,000 pUSD Active',
      action: isZh ? '以 3,280 汇率卖出 pUSD (高位套利)' : 'Asking 3,280 sats (Selling High)',
      poolType: 'Mirror Pool (UTXO #2)',
    },
    {
      title: t.recycling.step4Title,
      desc: t.recycling.step4Desc,
      state: isZh ? '闭环完成与自转' : 'Round-Trip Complete',
      holding: '10.25 BCH (+2.5% Gain)',
      action: isZh ? '资金回流原始买单，再次进入就绪状态' : 'BCH flows back to original bid loop',
      poolType: 'Perpetual Loop Re-armed',
    },
  ];

  const current = steps[activeStep];

  return (
    <section id="recycling" className="border-b border-[#c0c2c4] dark:border-neutral-800 px-4 sm:px-6 relative">
      <div className="border-x border-[#c0c2c4] dark:border-neutral-800 relative max-w-7xl mx-auto py-16 sm:py-24 px-6 sm:px-10 lg:px-12 text-center">
        <CornerCrosshair className="-left-3 -top-3" />
        <CornerCrosshair className="-right-3 -top-3" />
        <CornerCrosshair className="-left-3 -bottom-3" />
        <CornerCrosshair className="-right-3 -bottom-3" />

        {/* Pill Tag */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-neutral-300 dark:border-neutral-700 bg-neutral-100/80 dark:bg-neutral-800/60 text-xs text-neutral-600 dark:text-neutral-400 font-medium mb-3">
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{t.recycling.kicker}</span>
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 mb-3 max-w-3xl mx-auto">
          {t.recycling.title}
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 text-sm sm:text-base max-w-2xl mx-auto mb-12">
          {t.recycling.subtitle}
        </p>

        {/* Visualizer Frame Card */}
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121215] shadow-xs p-6 sm:p-8 text-left space-y-6">
          {/* Header Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-mono font-semibold text-neutral-800 dark:text-neutral-200">
                {t.recycling.badgeLiveLoop}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                {t.recycling.statCycleGain}
              </span>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* 4 Step Selector Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {steps.map((s, idx) => (
              <button
                key={idx}
                onClick={() => { setActiveStep(idx); setIsPlaying(false); }}
                className={\`p-3.5 rounded-xl border text-left transition-all cursor-pointer \${
                  activeStep === idx
                    ? 'border-neutral-900 dark:border-white bg-neutral-100 dark:bg-neutral-800/80 shadow-xs'
                    : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 text-neutral-500 hover:border-neutral-300 dark:hover:border-neutral-700'
                }\`}
              >
                <div className="text-[10px] font-mono font-semibold text-neutral-500 uppercase mb-1">
                  Step 0{idx + 1}
                </div>
                <div className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 truncate">{s.state}</div>
                <div className="text-[11px] text-neutral-500 mt-0.5 truncate">{s.holding}</div>
              </button>
            ))}
          </div>

          {/* Main Visualizer Diagram Stage */}
          <div className="grid md:grid-cols-12 gap-6 items-center p-6 rounded-xl bg-neutral-50 dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800">
            {/* Left Box: Active State */}
            <div className="md:col-span-5 space-y-3">
              <span className="inline-block px-2 py-0.5 rounded-md bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 font-mono text-[11px] font-medium border border-neutral-300 dark:border-neutral-700">
                {current.poolType}
              </span>
              <h3 className="font-semibold text-xl text-neutral-900 dark:text-neutral-100">
                {current.title}
              </h3>
              <p className="text-neutral-600 dark:text-neutral-400 text-xs sm:text-sm leading-relaxed">
                {current.desc}
              </p>
              <div className="p-2.5 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 font-mono text-xs text-neutral-700 dark:text-neutral-300">
                <span className="font-semibold text-neutral-900 dark:text-white">Action: </span>
                {current.action}
              </div>
            </div>

            {/* Center Animated Transition Glyph */}
            <div className="md:col-span-2 flex items-center justify-center my-2 md:my-0">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
                className="w-12 h-12 rounded-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 flex items-center justify-center text-neutral-700 dark:text-neutral-300 shadow-xs"
              >
                <Repeat className="w-5 h-5" />
              </motion.div>
            </div>

            {/* Right Box: Live UTXO State Monitor */}
            <div className="md:col-span-5 p-4 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 space-y-2.5 font-mono text-xs">
              <div className="flex justify-between items-center text-neutral-500 border-b border-neutral-200 dark:border-neutral-700 pb-2">
                <span>ON-CHAIN STATE</span>
                <span className="font-semibold text-neutral-900 dark:text-white">UNSPENT UTXO</span>
              </div>
              <div className="flex justify-between items-center text-neutral-700 dark:text-neutral-300">
                <span className="text-neutral-500">Locked Capital:</span>
                <span className="font-semibold text-neutral-900 dark:text-white">{current.holding}</span>
              </div>
              <div className="flex justify-between items-center text-neutral-700 dark:text-neutral-300">
                <span className="text-neutral-500">Proceeds Mode:</span>
                <span className="font-semibold text-neutral-900 dark:text-white">Mode 2 (Mirror)</span>
              </div>
              <div className="flex justify-between items-center text-neutral-700 dark:text-neutral-300">
                <span className="text-neutral-500">Centralized Custody:</span>
                <span className="font-semibold text-neutral-900 dark:text-white">0.00% (Pure Covenant)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
`);

// ==========================================
// 2. MeshStrategyTemplatesSection.tsx
// ==========================================
writeFile('src/components/landing/MeshStrategyTemplatesSection.tsx', `
import React, { useState } from 'react';
import { useMesh } from '@/context/MeshContext';
import { CornerCrosshair } from '@/components/common/MeshWireframeBox';
import { LayoutGrid, ArrowUpRight, CheckCircle2 } from 'lucide-react';

export function MeshStrategyTemplatesSection() {
  const { language, setActiveTab } = useMesh();
  const [activeCategory, setActiveCategory] = useState<'all' | 'conservative' | 'balanced' | 'aggressive'>('all');

  const isZh = language === 'zh';

  const templates = [
    {
      id: 'mirror-spread',
      title: isZh ? '永续镜像套利策略' : 'Perpetual Mirror Spread',
      category: 'conservative',
      apy: '18.4%',
      risk: isZh ? '低风险' : 'Low',
      tokens: 'BCH / pUSD',
      desc: isZh
        ? '单一买单成交后即刻同交易构建镜像卖单，捕捉 1.5% - 2.5% 点差收益。'
        : 'Instantiates mirror ask upon fill to capture 1.5% - 2.5% fixed bid-ask spread perpetually.',
      tags: ['MeshPoolV3', 'Perpetual', 'Zero Impermanent Loss'],
    },
    {
      id: 'tri-slot-basket',
      title: isZh ? '三代币篮子单池报价' : 'Tri-Slot Single Reserve Basket',
      category: 'balanced',
      apy: '32.1%',
      risk: isZh ? '中等风险' : 'Medium',
      tokens: 'BCH / FLEX / LAW / USDC',
      desc: isZh
        ? '单一储备通过 3 个槽位同时接受三种不同代币兑换，提升资金周转率 3 倍。'
        : 'One single BCH reserve simultaneously quotes 3 CashTokens via discrete output indices.',
      tags: ['MultiSlot', 'High Turnover', '3x Velocity'],
    },
    {
      id: 'volatility-grid',
      title: isZh ? '高频波动网格策略' : 'High-Frequency Volatility Grid',
      category: 'aggressive',
      apy: '54.8%',
      risk: isZh ? '高收益' : 'High Yield',
      tokens: 'BCH / CashTokens',
      desc: isZh
        ? '在 Chipnet/Mainnet 密集部署多阶价格契约，套利者密集触发以吃取波动率。'
        : 'Dense ladder of automated covenant orders swept by arbitrage bots for maximum compounding.',
      tags: ['Grid', 'Compounding', 'Arbitrage Friendly'],
    },
  ];

  const filtered = activeCategory === 'all'
    ? templates
    : templates.filter(t => t.category === activeCategory);

  return (
    <section id="strategies" className="border-b border-[#c0c2c4] dark:border-neutral-800 px-4 sm:px-6 relative">
      <div className="border-x border-[#c0c2c4] dark:border-neutral-800 relative max-w-7xl mx-auto py-16 sm:py-24 px-6 sm:px-10 lg:px-12 text-center">
        <CornerCrosshair className="-left-3 -top-3" />
        <CornerCrosshair className="-right-3 -top-3" />
        <CornerCrosshair className="-left-3 -bottom-3" />
        <CornerCrosshair className="-right-3 -bottom-3" />

        {/* Pill Tag */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-neutral-300 dark:border-neutral-700 bg-neutral-100/80 dark:bg-neutral-800/60 text-xs text-neutral-600 dark:text-neutral-400 font-medium mb-3">
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>{isZh ? '预置做市模板' : 'Pre-Built LP Templates'}</span>
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 mb-3 max-w-3xl mx-auto">
          {isZh ? '为各种收益需求量身定制的策略' : 'Covenant Strategies Built for Every Profile'}
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 text-sm sm:text-base max-w-2xl mx-auto mb-10">
          {isZh
            ? '选择经过形式化验证的 CashScript 契约模板，一键部署自主运行的链上做市资金池。'
            : 'Select formally audited CashScript templates to deploy autonomous on-chain liquidity vaults.'}
        </p>

        {/* Filter Pills */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {(['all', 'conservative', 'balanced', 'aggressive'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={\`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer \${
                activeCategory === cat
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs'
                  : 'bg-neutral-100 dark:bg-neutral-800/70 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'
              }\`}
            >
              {cat === 'all' && (isZh ? '全部策略' : 'All Strategies')}
              {cat === 'conservative' && (isZh ? '低风险稳健' : 'Conservative')}
              {cat === 'balanced' && (isZh ? '均衡多槽位' : 'Balanced')}
              {cat === 'aggressive' && (isZh ? '高频进取型' : 'Aggressive')}
            </button>
          ))}
        </div>

        {/* Template Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          {filtered.map((tpl) => (
            <div
              key={tpl.id}
              className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121215] p-6 shadow-xs flex flex-col justify-between hover:border-neutral-300 dark:hover:border-neutral-700 transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                    {tpl.tokens}
                  </span>
                  <div className="text-right">
                    <span className="font-mono font-bold text-base text-emerald-600 dark:text-emerald-400">{tpl.apy}</span>
                    <span className="text-[10px] text-neutral-400 block">Est. APY</span>
                  </div>
                </div>

                <h3 className="font-semibold text-base text-neutral-900 dark:text-neutral-100 mb-2">
                  {tpl.title}
                </h3>
                <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed mb-4">
                  {tpl.desc}
                </p>

                <div className="flex flex-wrap gap-1.5 mb-6">
                  {tpl.tags.map((tag, i) => (
                    <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <button
                onClick={() => { setActiveTab('app'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="w-full py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-medium text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>{isZh ? '部署该策略' : 'Deploy Template'}</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
`);

// ==========================================
// 3. MeshYieldSimulator.tsx
// ==========================================
writeFile('src/components/landing/MeshYieldSimulator.tsx', `
import React, { useState } from 'react';
import { useMesh } from '@/context/MeshContext';
import { CornerCrosshair } from '@/components/common/MeshWireframeBox';
import { Calculator, ArrowUpRight } from 'lucide-react';

export function MeshYieldSimulator() {
  const { language, setActiveTab } = useMesh();
  const [bchAmount, setBchAmount] = useState(20);
  const [dailyTurns, setDailyTurns] = useState(4);
  const [spreadBps, setSpreadBps] = useState(220); // 2.2%

  const isZh = language === 'zh';
  const bchPrice = 320;
  const initialUsd = bchAmount * bchPrice;
  const feePerTurn = (spreadBps / 10000);
  const dailyReturnUsd = initialUsd * feePerTurn * dailyTurns;
  const yearlyReturnUsd = dailyReturnUsd * 365;
  const calculatedApy = ((yearlyReturnUsd / initialUsd) * 100).toFixed(1);

  return (
    <section id="simulator" className="border-b border-[#c0c2c4] dark:border-neutral-800 px-4 sm:px-6 relative">
      <div className="border-x border-[#c0c2c4] dark:border-neutral-800 relative max-w-7xl mx-auto py-16 sm:py-24 px-6 sm:px-10 lg:px-12 text-center">
        <CornerCrosshair className="-left-3 -top-3" />
        <CornerCrosshair className="-right-3 -top-3" />
        <CornerCrosshair className="-left-3 -bottom-3" />
        <CornerCrosshair className="-right-3 -bottom-3" />

        {/* Pill Tag */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-neutral-300 dark:border-neutral-700 bg-neutral-100/80 dark:bg-neutral-800/60 text-xs text-neutral-600 dark:text-neutral-400 font-medium mb-3">
          <Calculator className="w-3.5 h-3.5" />
          <span>{isZh ? '收益测算模拟器' : 'Interactive Yield Simulator'}</span>
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 mb-3 max-w-3xl mx-auto">
          {isZh ? '测算您的做市资本周转收益' : 'Calculate Your Virtual Depth Velocity'}
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 text-sm sm:text-base max-w-2xl mx-auto mb-12">
          {isZh
            ? '通过永续镜像池机制，单笔资金在同个区块或跨区块内被循环消耗与重建，带来远超传统 AMM 的年化收益率。'
            : 'Perpetual mirror recycling turns your capital multiple times daily without impermanent loss.'}
        </p>

        {/* Simulator Card */}
        <div className="max-w-4xl mx-auto rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121215] shadow-xs p-6 sm:p-10 text-left">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* Left: Input Sliders */}
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-xs font-mono mb-2">
                  <span className="text-neutral-600 dark:text-neutral-400">{isZh ? '投入 BCH 资金量' : 'Initial BCH Capital'}</span>
                  <span className="font-bold text-neutral-900 dark:text-white">{bchAmount} BCH (\${initialUsd.toLocaleString()})</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={bchAmount}
                  onChange={(e) => setBchAmount(Number(e.target.value))}
                  className="w-full accent-neutral-900 dark:accent-neutral-100 h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono mb-2">
                  <span className="text-neutral-600 dark:text-neutral-400">{isZh ? '每日周转循环次数' : 'Recycling Turns / Day'}</span>
                  <span className="font-bold text-neutral-900 dark:text-white">{dailyTurns}x / day</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="12"
                  value={dailyTurns}
                  onChange={(e) => setDailyTurns(Number(e.target.value))}
                  className="w-full accent-neutral-900 dark:accent-neutral-100 h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono mb-2">
                  <span className="text-neutral-600 dark:text-neutral-400">{isZh ? '买卖点差' : 'Net Bid/Ask Spread'}</span>
                  <span className="font-bold text-neutral-900 dark:text-white">{(spreadBps / 100).toFixed(2)}% ({spreadBps} bps)</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="500"
                  step="10"
                  value={spreadBps}
                  onChange={(e) => setSpreadBps(Number(e.target.value))}
                  className="w-full accent-neutral-900 dark:accent-neutral-100 h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Right: Calculated APY & Yield Stats */}
            <div className="p-6 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-4 font-mono">
              <div className="border-b border-neutral-200 dark:border-neutral-700 pb-3">
                <span className="text-xs text-neutral-500 uppercase">{isZh ? '预估复合年化收益' : 'Estimated Annual APY'}</span>
                <div className="text-3xl sm:text-4xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {calculatedApy}%
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>{isZh ? '单日净收益' : 'Daily Revenue'}:</span>
                  <span className="font-semibold text-neutral-900 dark:text-white">\${dailyReturnUsd.toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>{isZh ? '年化净收益' : 'Annual Revenue'}:</span>
                  <span className="font-semibold text-neutral-900 dark:text-white">\${yearlyReturnUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })} USD</span>
                </div>
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>{isZh ? '单笔手续费成本' : 'Avg Gas Cost'}:</span>
                  <span className="font-semibold text-neutral-900 dark:text-white">&lt; $0.001</span>
                </div>
              </div>

              <button
                onClick={() => { setActiveTab('app'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="w-full py-2.5 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium text-xs hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs mt-3"
              >
                <span>{isZh ? '启动该参数池' : 'Deploy Custom Pool'}</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
`);

// ==========================================
// 4. MeshFAQ.tsx
// ==========================================
writeFile('src/components/landing/MeshFAQ.tsx', `
import React, { useState } from 'react';
import { useMesh } from '@/context/MeshContext';
import { CornerCrosshair } from '@/components/common/MeshWireframeBox';
import { HelpCircle, ChevronDown } from 'lucide-react';

export function MeshFAQ() {
  const { language } = useMesh();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const isZh = language === 'zh';

  const faqs = [
    {
      q: isZh ? 'Mesh Protocol 与传统 AMM (如 Uniswap) 有何区别？' : 'How does Mesh Protocol differ from traditional AMMs like Uniswap?',
      a: isZh
        ? 'Mesh Protocol 完全基于比特币现金原生 UTXO 契约，无需共享全局资金池，没有重入漏洞和三明治套利风险。流动性以独立契约 UTXO 存在，并支持单笔交易内自动镜像回收。'
        : 'Mesh Protocol is 100% native to Bitcoin Cash UTXOs. There is no pooled EVM global state, zero reentrancy risk, and zero sandwich attacks. Each LP UTXO operates deterministically with instant perpetual recycling.',
    },
    {
      q: isZh ? '什么是“永续自循环回收” (Perpetual Recycling)？' : 'What is Perpetual Recycling?',
      a: isZh
        ? '当买单被撮合成交后，收到的资产（如 pUSD）不会闲置或提取至中心化账户，而是由契约强制在同一笔交易内实例化为反向镜像卖单，捕捉双向点差收益，实现 24/7 永续运转。'
        : 'When an order fills, proceeds do not sit idle. The covenant code mandates an on-chain mirror order in the same transaction loop, earning spreads on both sides automatically.',
    },
    {
      q: isZh ? '单笔储备支持多槽位（Multi-Slot）意味着什么？' : 'What is Multi-Slot routing from a single reserve?',
      a: isZh
        ? '传统订单簿需要为每个币对锁定独立的 BCH 储备。MeshPoolV3 的多槽位特性允许 1 笔 BCH 储备同时向 3 种不同的 CashTokens 报价，通过独立的输出索引隔离结算，无资金竞态冲突。'
        : 'Instead of fragmenting capital into separate pools, 1 BCH reserve can quote up to 3 different CashTokens simultaneously, drastically increasing capital efficiency.',
    },
    {
      q: isZh ? '协议的代码是否经过审计与开源？' : 'Is the protocol code open source and audited?',
      a: isZh
        ? '所有核心 CashScript 契约与 SDK 均在 GitHub 完全开源，遵循 Apache-2.0 许可。契约逻辑通过 CashScript 形式化数学验证，确保不可篡改。'
        : 'All core CashScript covenants and frontend SDKs are fully open source on GitHub under Apache-2.0. Formal verification tooling is used to validate all spend conditions.',
    },
  ];

  return (
    <section id="faq" className="border-b border-[#c0c2c4] dark:border-neutral-800 px-4 sm:px-6 relative">
      <div className="border-x border-[#c0c2c4] dark:border-neutral-800 relative max-w-7xl mx-auto py-16 sm:py-24 px-6 sm:px-10 lg:px-12 text-center">
        <CornerCrosshair className="-left-3 -top-3" />
        <CornerCrosshair className="-right-3 -top-3" />
        <CornerCrosshair className="-left-3 -bottom-3" />
        <CornerCrosshair className="-right-3 -bottom-3" />

        {/* Pill Tag */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-neutral-300 dark:border-neutral-700 bg-neutral-100/80 dark:bg-neutral-800/60 text-xs text-neutral-600 dark:text-neutral-400 font-medium mb-3">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>{isZh ? '常见问题解答' : 'Frequently Asked Questions'}</span>
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 mb-3 max-w-3xl mx-auto">
          {isZh ? '关于 Mesh Protocol 的一切细节' : 'Everything You Need to Know'}
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 text-sm sm:text-base max-w-xl mx-auto mb-12">
          {isZh
            ? '了解基于比特币现金的下一代自主流动性契约的工作原理。'
            : 'Answers to key technical questions regarding UTXO covenant liquidity.'}
        </p>

        {/* Accordion list */}
        <div className="max-w-3xl mx-auto space-y-3 text-left">
          {faqs.map((item, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121215] shadow-xs overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full p-5 flex items-center justify-between gap-4 text-left font-medium text-sm sm:text-base text-neutral-900 dark:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 cursor-pointer"
                >
                  <span>{item.q}</span>
                  <ChevronDown className={\`w-4 h-4 text-neutral-500 shrink-0 transition-transform duration-200 \${isOpen ? 'rotate-180' : ''}\`} />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed border-t border-neutral-100 dark:border-neutral-800">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
`);

console.log('Finished updating secondary sections.');
