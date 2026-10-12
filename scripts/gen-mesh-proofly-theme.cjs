const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../../meshprotocol');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function writeFile(relPath, content) {
  const fullPath = path.join(rootDir, relPath);
  ensureDir(path.dirname(fullPath));
  fs.writeFileSync(fullPath, content.trim() + '\n', 'utf8');
  console.log('Updated: ' + relPath);
}

// ==========================================
// 1. MeshWireframeBox.tsx (Crosshairs & Section)
// ==========================================
writeFile('src/components/common/MeshWireframeBox.tsx', `
import React from 'react';
import { cn } from '@/lib/utils';

export function CornerCrosshair({ className }: { className?: string }) {
  return (
    <svg
      className={cn(
        "rounded-full size-6 stroke-neutral-400 bg-[#F4F4F5] dark:bg-[#18181b] dark:stroke-neutral-500 absolute z-20 pointer-events-none transition-colors",
        className
      )}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 28 28"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 14h14" />
      <path d="M14 7v14" />
    </svg>
  );
}

interface WireframeSectionProps {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  id?: string;
}

export function WireframeSection({
  children,
  className,
  innerClassName,
  id,
}: WireframeSectionProps) {
  return (
    <section id={id} className={cn("border-b border-[#c0c2c4] dark:border-neutral-800 px-4 sm:px-6 relative", className)}>
      <div className={cn("border-x border-[#c0c2c4] dark:border-neutral-800 relative max-w-7xl mx-auto p-6 sm:p-10 md:p-12", innerClassName)}>
        <CornerCrosshair className="-left-3 -top-3" />
        <CornerCrosshair className="-right-3 -top-3" />
        <CornerCrosshair className="-left-3 -bottom-3" />
        <CornerCrosshair className="-right-3 -bottom-3" />
        {children}
      </div>
    </section>
  );
}
`);

// ==========================================
// 2. MeshHeader.tsx
// ==========================================
writeFile('src/components/common/MeshHeader.tsx', `
import React, { useState } from 'react';
import { useMesh, Tab } from '@/context/MeshContext';
import { MeshLogo } from './MeshLogo';
import { CornerCrosshair } from './MeshWireframeBox';
import { Sun, Moon, Menu, X, ArrowUpRight } from 'lucide-react';

export function MeshHeader() {
  const { theme, toggleTheme, language, setLanguage, activeTab, setActiveTab, t } = useMesh();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isZh = language === 'zh';

  const navLinks = [
    { id: 'overview', label: t.nav.overview, href: '#overview' },
    { id: 'features', label: isZh ? '核心特性' : 'Features', href: '#features' },
    { id: 'recycling', label: t.nav.recycling, href: '#recycling' },
    { id: 'strategies', label: t.nav.strategies, href: '#strategies' },
    { id: 'simulator', label: t.nav.simulator, href: '#simulator' },
    { id: 'architecture', label: t.nav.architecture, href: '#architecture' },
    { id: 'docs', label: t.nav.docs, tab: 'docs' as Tab },
    { id: 'app', label: isZh ? '做市终端' : 'Terminal', tab: 'app' as Tab, badge: isZh ? '公测' : 'Beta' },
  ];

  const handleNavClick = (link: typeof navLinks[0]) => {
    if (link.tab) {
      setActiveTab(link.tab);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setActiveTab('landing');
      setTimeout(() => {
        const el = document.querySelector(link.href || '');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    }
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-[#f9f9fb]/90 dark:bg-[#09090b]/90 backdrop-blur-md border-b border-[#c0c2c4] dark:border-neutral-800 transition-colors duration-200">
      <div className="border-x border-[#c0c2c4] dark:border-neutral-800 max-w-7xl mx-auto px-4 sm:px-8 h-20 flex items-center justify-between relative">
        <CornerCrosshair className="-left-3 -top-3" />
        <CornerCrosshair className="-right-3 -top-3" />
        <CornerCrosshair className="-left-3 -bottom-3" />
        <CornerCrosshair className="-right-3 -bottom-3" />

        {/* Brand Logo */}
        <div
          onClick={() => { setActiveTab('landing'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          className="cursor-pointer flex items-center gap-3"
        >
          <MeshLogo size={34} />
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-1 text-sm font-medium">
          {navLinks.map((link) => {
            const isActive = link.tab ? activeTab === link.tab : false;
            return (
              <button
                key={link.id}
                onClick={() => handleNavClick(link)}
                className={\`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 \${
                  isActive
                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 font-semibold'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-200/50 dark:hover:bg-neutral-800/60'
                }\`}
              >
                <span>{link.label}</span>
                {link.badge && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                    {link.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Controls */}
        <div className="hidden sm:flex items-center gap-2.5">
          {/* Language Switch */}
          <div className="flex items-center rounded-lg bg-neutral-200/60 dark:bg-neutral-800/80 p-0.5 border border-neutral-300 dark:border-neutral-700 text-xs">
            <button
              onClick={() => setLanguage('en')}
              className={\`px-2 py-1 rounded-md font-mono font-medium transition-all \${
                language === 'en'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }\`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage('zh')}
              className={\`px-2 py-1 rounded-md font-mono font-medium transition-all \${
                language === 'zh'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }\`}
            >
              中文
            </button>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400 dark:hover:border-neutral-700 transition-all cursor-pointer shadow-xs"
            title={theme === 'dark' ? t.nav.modeLight : t.nav.modeDark}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-neutral-700" />}
          </button>

          {/* Launch Terminal / Verify Button */}
          <button
            onClick={() => { setActiveTab('app'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className="h-10 px-5 rounded-xl font-medium text-xs bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:bg-black dark:hover:bg-white flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
          >
            <span>{t.nav.launchApp}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Mobile Hamburger */}
        <div className="flex sm:hidden items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-neutral-700" />}
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-b border-[#c0c2c4] dark:border-neutral-800 bg-[#f9f9fb] dark:bg-[#09090b] p-5 space-y-3">
          <div className="grid grid-cols-2 gap-2 pb-2">
            <button
              onClick={() => { setLanguage('en'); setMobileMenuOpen(false); }}
              className={\`p-2 text-xs font-mono font-medium rounded-lg border text-center \${
                language === 'en' ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'border-neutral-300 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400'
              }\`}
            >
              English
            </button>
            <button
              onClick={() => { setLanguage('zh'); setMobileMenuOpen(false); }}
              className={\`p-2 text-xs font-mono font-medium rounded-lg border text-center \${
                language === 'zh' ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'border-neutral-300 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400'
              }\`}
            >
              中文简体
            </button>
          </div>
          {navLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => handleNavClick(link)}
              className="w-full text-left p-2.5 rounded-lg text-sm font-medium text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200/50 dark:hover:bg-neutral-800 flex items-center justify-between"
            >
              <span>{link.label}</span>
              {link.badge && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  {link.badge}
                </span>
              )}
            </button>
          ))}
          <button
            onClick={() => { setActiveTab('app'); setMobileMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className="w-full h-11 rounded-xl bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 font-medium text-sm flex items-center justify-center gap-2 mt-2"
          >
            <span>{t.nav.launchApp}</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </header>
  );
}
`);

// ==========================================
// 3. MeshHero.tsx (Proofly Hero Style)
// ==========================================
writeFile('src/components/landing/MeshHero.tsx', `
import React, { useState } from 'react';
import { useMesh } from '@/context/MeshContext';
import { CornerCrosshair } from '@/components/common/MeshWireframeBox';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, ShieldCheck, RefreshCw, Layers, Coins, Zap } from 'lucide-react';

export function MeshHero() {
  const { language, t, setActiveTab } = useMesh();
  const [activeTabMode, setActiveTabMode] = useState<'recycle' | 'multislot' | 'batch'>('recycle');
  const [bchInput, setBchInput] = useState(10);

  const isZh = language === 'zh';
  const bchPrice = 320;
  const virtualDepth = bchInput * bchPrice * 5.4;

  return (
    <section id="overview" className="border-b border-[#c0c2c4] dark:border-neutral-800 px-4 sm:px-6 relative">
      <div className="border-x border-[#c0c2c4] dark:border-neutral-800 relative max-w-7xl mx-auto py-12 md:py-20 px-6 sm:px-10 lg:px-12">
        <CornerCrosshair className="-left-3 -top-3" />
        <CornerCrosshair className="-right-3 -top-3" />
        <CornerCrosshair className="-left-3 -bottom-3" />
        <CornerCrosshair className="-right-3 -bottom-3" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          {/* Left Column: Heading, Subtitle, Pill, Action Buttons */}
          <div className="lg:col-span-7 space-y-6">
            {/* Pill Tag */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-neutral-300 dark:border-neutral-700 bg-neutral-100/80 dark:bg-neutral-800/60 text-xs text-neutral-600 dark:text-neutral-400 font-medium">
              <span>{isZh ? '新一代比特币现金流动性协议' : 'The next generation of UTXO Liquidity'}</span>
            </div>

            {/* Massive Geometric Heading */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 leading-[1.12]">
              {isZh ? '去中心化自主流动性网格' : 'Decentralized Autonomous Liquidity Mesh'}
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-neutral-600 dark:text-neutral-400 leading-relaxed max-w-xl">
              {isZh
                ? '基于比特币现金 CashScript 契约的去中心化流动性回收协议。生成可验证的链上做市契约，零滑点撮合多代币池，实现资金 24/7 永续高频自转。'
                : 'Secure, transparent, and instant liquidity recycling powered by Bitcoin Cash covenants. Deploy deterministic proof pools, route multi-token reserves, and recycle capital with zero slippage.'}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <button
                onClick={() => { setActiveTab('app'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="px-6 py-3.5 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium text-sm hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{isZh ? '进入做市终端' : 'Launch Mesh Terminal'}</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  const el = document.querySelector('#features');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-6 py-3.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 font-medium text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <span>{isZh ? '探索契约特性' : 'Explore Protocol Features'}</span>
              </button>
            </div>
          </div>

          {/* Right Column: Clean Rounded Card */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121215] shadow-sm p-6 relative overflow-hidden">
              {/* Card Header & Tabs */}
              <div className="flex items-center justify-between pb-4 border-b border-neutral-100 dark:border-neutral-800">
                <div className="flex items-center gap-1.5 p-1 rounded-lg bg-neutral-100 dark:bg-neutral-800/80 text-xs">
                  <button
                    onClick={() => setActiveTabMode('recycle')}
                    className={\`px-2.5 py-1 rounded-md transition-all font-medium \${
                      activeTabMode === 'recycle'
                        ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                        : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                    }\`}
                  >
                    {isZh ? '永续回收' : 'Recycling'}
                  </button>
                  <button
                    onClick={() => setActiveTabMode('multislot')}
                    className={\`px-2.5 py-1 rounded-md transition-all font-medium \${
                      activeTabMode === 'multislot'
                        ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                        : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                    }\`}
                  >
                    {isZh ? '多槽位' : 'Multi-Slot'}
                  </button>
                  <button
                    onClick={() => setActiveTabMode('batch')}
                    className={\`px-2.5 py-1 rounded-md transition-all font-medium \${
                      activeTabMode === 'batch'
                        ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                        : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                    }\`}
                  >
                    {isZh ? '多池撮合' : 'Batch Fill'}
                  </button>
                </div>

                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                  MeshPoolV3
                </span>
              </div>

              {/* Dynamic Content */}
              <div className="my-5 min-h-[190px] flex flex-col justify-between">
                <AnimatePresence mode="wait">
                  {activeTabMode === 'recycle' && (
                    <motion.div
                      key="recycle"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="space-y-3.5"
                    >
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                          <RefreshCw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Perpetual Mirror Loop</span>
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">+2.2% Net Spread</span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-2.5 font-mono text-xs">
                        <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200">
                          <span>Bid Pool: 10.0 BCH</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">@ 3,200 pUSD</span>
                        </div>
                        <div className="text-center text-[10px] text-neutral-400">
                          ↓ fill() creates mirror ask on-chain in same tx ↓
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200">
                          <span>Mirror Ask: 32,000 pUSD</span>
                          <span className="text-cyan-600 dark:text-cyan-400 font-semibold">@ 3,280 pUSD</span>
                        </div>
                      </div>

                      <p className="text-[11px] text-neutral-500 leading-snug">
                        {isZh ? '无需中心化服务器托管，镜像的镜像即为原始池，资金 24/7 自主复利运转。' : 'Zero server tracking required. The mirror of the mirror is the original pool, keeping capital working 24/7.'}
                      </p>
                    </motion.div>
                  )}

                  {activeTabMode === 'multislot' && (
                    <motion.div
                      key="multislot"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="space-y-3.5"
                    >
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                          <Coins className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                          <span>1 Single Reserve • 3 Tokens</span>
                        </span>
                        <span className="text-neutral-500">Slot 0/1/2</span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-1.5 font-mono text-xs">
                        <div className="text-neutral-900 dark:text-white font-semibold pb-1 border-b border-neutral-200 dark:border-neutral-700">
                          Reserve: 25.0 BCH
                        </div>
                        <div className="flex justify-between text-neutral-600 dark:text-neutral-300">
                          <span>Slot 0: Accepts FLEX</span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">1,420 FLEX</span>
                        </div>
                        <div className="flex justify-between text-neutral-600 dark:text-neutral-300">
                          <span>Slot 1: Accepts LAW</span>
                          <span className="font-semibold text-cyan-600 dark:text-cyan-400">850 LAW</span>
                        </div>
                        <div className="flex justify-between text-neutral-600 dark:text-neutral-300">
                          <span>Slot 2: Accepts USDC</span>
                          <span className="font-semibold text-purple-600 dark:text-purple-400">328.5 USDC</span>
                        </div>
                      </div>

                      <p className="text-[11px] text-neutral-500 leading-snug">
                        {isZh ? '收益流出至唯一输出索引，单笔 UTXO 储备即可原生承载多个代币对。' : 'Proceeds leave the pool to unique output indices, allowing 1 reserve to quote multiple tokens.'}
                      </p>
                    </motion.div>
                  )}

                  {activeTabMode === 'batch' && (
                    <motion.div
                      key="batch"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="space-y-3.5"
                    >
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                          <span>Atomic Multi-Pool Fill</span>
                        </span>
                        <span className="text-neutral-500">Atomic Tx</span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-1.5 font-mono text-xs">
                        <div className="text-neutral-900 dark:text-white font-semibold pb-1 border-b border-neutral-200 dark:border-neutral-700">
                          Batch Order: 100 BCH
                        </div>
                        <div className="text-neutral-600 dark:text-neutral-300">
                          • Sweeps Pool #1 (outpoint: a8f...0) — 40 BCH
                        </div>
                        <div className="text-neutral-600 dark:text-neutral-300">
                          • Sweeps Pool #2 (outpoint: c2e...1) — 35 BCH
                        </div>
                        <div className="text-neutral-600 dark:text-neutral-300">
                          • Sweeps Pool #3 (outpoint: f91...0) — 25 BCH
                        </div>
                      </div>

                      <p className="text-[11px] text-neutral-500 leading-snug">
                        {isZh ? '每个池的收益输出索引独立推导，无竞态碰撞，无资金锁定。' : 'Each pool proceeds index is uniquely derived. No order collisions, no pool lockups.'}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Slider for Virtual Depth */}
              <div className="pt-3.5 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-neutral-500">{isZh ? '模拟做市资金深度:' : 'Simulated Virtual Depth:'}</span>
                  <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                    $\${virtualDepth.toLocaleString(undefined, { maximumFractionDigits: 0 })} USD
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={bchInput}
                  onChange={(e) => setBchInput(Number(e.target.value))}
                  className="w-full accent-neutral-900 dark:accent-neutral-100 cursor-pointer h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none"
                />
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
// 4. MeshStatsBar.tsx (Streamlined Management Row of 3 Cards)
// ==========================================
writeFile('src/components/landing/MeshStatsBar.tsx', `
import React from 'react';
import { useMesh } from '@/context/MeshContext';
import { CornerCrosshair } from '@/components/common/MeshWireframeBox';
import { Building2, Users2, FileCheck, Layers, ShieldCheck, Zap } from 'lucide-react';

export function MeshStatsBar() {
  const { language } = useMesh();
  const isZh = language === 'zh';

  const cards = [
    {
      icon: Building2,
      title: isZh ? '契约池部署与登记' : 'Covenant Pool Deployment',
      desc: isZh
        ? '流动性提供者基于 CashScript 契约初始化资金池，确定数学定价与输出规则。'
        : 'Liquidity providers deploy CashScript covenants with immutable pricing and settlement rules.',
    },
    {
      icon: Users2,
      title: isZh ? '多槽位与流动性管理' : 'Multi-Slot Liquidity Management',
      desc: isZh
        ? '单笔 UTXO 储备支持最多 3 种代币同时报价，套利者零竞态撮合多资产。'
        : 'Single UTXO reserve quotes up to 3 tokens concurrently with collision-free slot outputs.',
    },
    {
      icon: FileCheck,
      title: isZh ? '永续自循环回收' : 'Perpetual UTXO Recycling',
      desc: isZh
        ? '单笔成交交易内立即按设定点差反向生成镜像池，资金 24/7 永续运转。'
        : 'Swaps generate counter-mirror pools in the very same transaction loop for 24/7 autonomous recycling.',
    },
  ];

  return (
    <section className="border-b border-[#c0c2c4] dark:border-neutral-800 px-4 sm:px-6 relative">
      <div className="border-x border-[#c0c2c4] dark:border-neutral-800 relative max-w-7xl mx-auto py-16 sm:py-20 px-6 sm:px-10 lg:px-12 text-center">
        <CornerCrosshair className="-left-3 -top-3" />
        <CornerCrosshair className="-right-3 -top-3" />
        <CornerCrosshair className="-left-3 -bottom-3" />
        <CornerCrosshair className="-right-3 -bottom-3" />

        {/* Section Pill Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-neutral-300 dark:border-neutral-700 bg-neutral-100/80 dark:bg-neutral-800/60 text-xs text-neutral-600 dark:text-neutral-400 font-medium mb-4">
          <span>{isZh ? '工作原理 🔍' : 'How it works 🔍'}</span>
        </div>

        {/* Section Title */}
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 mb-3 max-w-3xl mx-auto">
          {isZh ? '精炼高效的 UTXO 与契约流动性路由' : 'Streamlined UTXO and covenant liquidity routing'}
        </h2>

        {/* Subtitle */}
        <p className="text-neutral-600 dark:text-neutral-400 text-sm sm:text-base max-w-2xl mx-auto mb-12">
          {isZh
            ? '从部署链上契约到管理多资产储备和实时回收交易 Gas —— 我们的协议让每个环节都极简、透明且安全。'
            : 'From deploying covenant pools to managing multi-token reserves and recycling UTXO gas in real time — our protocol makes every step seamless and secure.'}
        </p>

        {/* 3 Streamlined Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          {cards.map((card, i) => {
            const Icon = card.icon;
            return (
              <div
                key={i}
                className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121215] p-6 shadow-sm hover:border-neutral-300 dark:hover:border-neutral-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="w-11 h-11 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-800 dark:text-neutral-200 mb-5">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-base text-neutral-900 dark:text-neutral-100 mb-2">
                    {card.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    {card.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
`);

// ==========================================
// 5. MeshKeyFeatures.tsx (...and so much Key Features! 3x2 Grid with Crosshairs)
// ==========================================
writeFile('src/components/landing/MeshKeyFeatures.tsx', `
import React from 'react';
import { useMesh } from '@/context/MeshContext';
import { CornerCrosshair } from '@/components/common/MeshWireframeBox';
import { ShieldCheck, Clock, Users, Zap, Lock, FileText } from 'lucide-react';

export function MeshKeyFeatures() {
  const { language } = useMesh();
  const isZh = language === 'zh';

  const features = [
    {
      icon: ShieldCheck,
      title: isZh ? '去中心化链上验证' : 'Decentralized Verification',
      desc: isZh
        ? '纯 CashScript 契约约束，零中心化管理员权限与后门。'
        : 'Pure CashScript covenants enforce all spend conditions with zero admin keys.',
    },
    {
      icon: Clock,
      title: isZh ? '时效证明防抢跑' : 'Time-Limited Proof Codes',
      desc: isZh
        ? '每个撮合调用包含链上时效约束，彻底杜绝 MEV 抢跑套利。'
        : 'Fill transactions include timestamp nonces to mathematically prevent frontrunning.',
    },
    {
      icon: Users,
      title: isZh ? '基于角色的多槽位隔离' : 'Role-Based Access Control',
      desc: isZh
        ? '唯一输出绑定索引，多代币槽位独立结算，杜绝资金碰撞。'
        : 'Output index binding guarantees discrete token settlements from one shared reserve.',
    },
    {
      icon: Zap,
      title: isZh ? '秒级瞬时确认' : 'Real-Time Verification',
      desc: isZh
        ? '基于比特币现金高效结算机制，平均交易费低于 0.001 美元。'
        : 'Direct UTXO state transitions with sub-second propagation and sub-cent fees.',
    },
    {
      icon: Lock,
      title: isZh ? '安全抗重入保护' : 'Secure Authentication',
      desc: isZh
        ? '无 EVM 共享状态机，天然免疫重入攻击与蜜罐漏洞。'
        : 'UTXO isolation prevents reentrancy, shared-state exploits, and flash loan attacks.',
    },
    {
      icon: FileText,
      title: isZh ? '全量链上审计痕迹' : 'Complete Audit Trail',
      desc: isZh
        ? '所有做市状态与结算历史均完整记录在链上，支持任意节点审计。'
        : 'Deterministic transaction inputs and outputs provide a verifiable, public audit log.',
    },
  ];

  return (
    <section id="features" className="border-b border-[#c0c2c4] dark:border-neutral-800 px-4 sm:px-6 relative">
      <div className="border-x border-[#c0c2c4] dark:border-neutral-800 relative max-w-7xl mx-auto py-16 sm:py-24 px-6 sm:px-10 lg:px-12 text-center">
        <CornerCrosshair className="-left-3 -top-3" />
        <CornerCrosshair className="-right-3 -top-3" />
        <CornerCrosshair className="-left-3 -bottom-3" />
        <CornerCrosshair className="-right-3 -bottom-3" />

        {/* Section Heading */}
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 mb-3">
          {isZh ? '...以及如此多强大的核心特性！' : '...and so much Key Features!'}
        </h2>

        <p className="text-neutral-600 dark:text-neutral-400 text-sm sm:text-base max-w-xl mx-auto mb-14">
          {isZh
            ? '构建于比特币现金区块链之上，带来极致的安全性与资金效率。'
            : 'Built on Bitcoin Cash for maximum security, capital velocity, and transparency.'}
        </p>

        {/* 3x2 Grid with Crosshairs at every intersection */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-8 gap-x-8 max-w-5xl mx-auto">
          {features.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="relative border border-[#c0c2c4] dark:border-neutral-800 bg-white dark:bg-[#121215] rounded-2xl p-7 text-center shadow-xs flex flex-col items-center justify-center transition-all hover:border-neutral-400 dark:hover:border-neutral-700"
              >
                {/* 4 Corner Crosshairs on each card to match reference! */}
                <CornerCrosshair className="-left-3 -top-3" />
                <CornerCrosshair className="-right-3 -top-3" />
                <CornerCrosshair className="-left-3 -bottom-3" />
                <CornerCrosshair className="-right-3 -bottom-3" />

                {/* Soft rounded icon box */}
                <div className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-700 dark:text-neutral-300 mb-4">
                  <Icon className="w-5 h-5 stroke-[1.75]" />
                </div>

                <h3 className="font-semibold text-sm sm:text-base text-neutral-900 dark:text-neutral-100 mb-1.5">
                  {item.title}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed max-w-[240px]">
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
`);

// ==========================================
// 6. MeshFooter.tsx (Multi-column links + Giant brutalist wordmark)
// ==========================================
writeFile('src/components/common/MeshFooter.tsx', `
import React from 'react';
import { useMesh } from '@/context/MeshContext';
import { CornerCrosshair } from './MeshWireframeBox';
import { ArrowUpRight } from 'lucide-react';

export function MeshFooter() {
  const { language, setActiveTab } = useMesh();
  const isZh = language === 'zh';

  return (
    <footer className="border-b border-[#c0c2c4] dark:border-neutral-800 px-4 sm:px-6 relative bg-[#f9f9fb] dark:bg-[#09090b] transition-colors duration-200">
      <div className="border-x border-[#c0c2c4] dark:border-neutral-800 relative max-w-7xl mx-auto pt-16 sm:pt-20 pb-0 px-6 sm:px-10 lg:px-12 overflow-hidden">
        <CornerCrosshair className="-left-3 -top-3" />
        <CornerCrosshair className="-right-3 -top-3" />
        <CornerCrosshair className="-left-3 -bottom-3" />
        <CornerCrosshair className="-right-3 -bottom-3" />

        {/* 5-Column Navigation Grid matching reference */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 sm:gap-10 pb-16 text-left">
          {/* Col 1: Everything by Mesh */}
          <div className="space-y-3">
            <h4 className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 tracking-tight">
              {isZh ? '全部产品' : 'Everything by Mesh'}
            </h4>
            <ul className="space-y-2 text-xs text-neutral-500 dark:text-neutral-400">
              <li>
                <button
                  onClick={() => { setActiveTab('landing'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer text-left"
                >
                  Mesh Protocol
                </button>
              </li>
              <li>
                <button
                  onClick={() => { setActiveTab('app'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer text-left"
                >
                  Mesh Terminal
                </button>
              </li>
              <li>
                <a
                  href="https://trade.bchintents.com"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-neutral-900 dark:hover:text-white transition-colors flex items-center gap-1"
                >
                  <span>Intent dApp</span>
                  <ArrowUpRight className="w-3 h-3 opacity-60" />
                </a>
              </li>
            </ul>
          </div>

          {/* Col 2: Components */}
          <div className="space-y-3">
            <h4 className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 tracking-tight">
              {isZh ? '协议组件' : 'Components'}
            </h4>
            <ul className="space-y-2 text-xs text-neutral-500 dark:text-neutral-400">
              <li><a href="#overview" className="hover:text-neutral-900 dark:hover:text-white">Introduction</a></li>
              <li><a href="#features" className="hover:text-neutral-900 dark:hover:text-white">Features</a></li>
              <li><a href="#recycling" className="hover:text-neutral-900 dark:hover:text-white">Recycling Engine</a></li>
              <li><a href="#strategies" className="hover:text-neutral-900 dark:hover:text-white">Strategy Templates</a></li>
              <li><a href="#simulator" className="hover:text-neutral-900 dark:hover:text-white">Yield Simulator</a></li>
              <li><a href="#architecture" className="hover:text-neutral-900 dark:hover:text-white">Architecture</a></li>
            </ul>
          </div>

          {/* Col 3: Pro Features */}
          <div className="space-y-3">
            <h4 className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 tracking-tight">
              {isZh ? '高级特性' : 'Pro Features'}
            </h4>
            <ul className="space-y-2 text-xs text-neutral-500 dark:text-neutral-400">
              <li>
                <button
                  onClick={() => { setActiveTab('docs'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="hover:text-neutral-900 dark:hover:text-white text-left cursor-pointer"
                >
                  CashScript Covenants
                </button>
              </li>
              <li><a href="#tri-route" className="hover:text-neutral-900 dark:hover:text-white">Tri-Route Matcher</a></li>
              <li><a href="#simulator" className="hover:text-neutral-900 dark:hover:text-white">Virtual Depth Math</a></li>
              <li><a href="#faq" className="hover:text-neutral-900 dark:hover:text-white">Protocol FAQ</a></li>
            </ul>
          </div>

          {/* Col 4: Other / Social */}
          <div className="space-y-3">
            <h4 className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 tracking-tight">
              {isZh ? '社区与生态' : 'Other'}
            </h4>
            <ul className="space-y-2 text-xs text-neutral-500 dark:text-neutral-400">
              <li><a href="https://t.me" target="_blank" rel="noreferrer" className="hover:text-neutral-900 dark:hover:text-white">Telegram Group</a></li>
              <li><a href="https://github.com/ArcadeLabsInc/bch-intents" target="_blank" rel="noreferrer" className="hover:text-neutral-900 dark:hover:text-white">GitHub Repo</a></li>
              <li><a href="https://cashscript.org" target="_blank" rel="noreferrer" className="hover:text-neutral-900 dark:hover:text-white">CashScript.org</a></li>
              <li><a href="https://cashtokens.org" target="_blank" rel="noreferrer" className="hover:text-neutral-900 dark:hover:text-white">CashTokens.org</a></li>
              <li><a href="https://x.com" target="_blank" rel="noreferrer" className="hover:text-neutral-900 dark:hover:text-white">X / Twitter</a></li>
            </ul>
          </div>

          {/* Col 5: Legal */}
          <div className="space-y-3">
            <h4 className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 tracking-tight">
              {isZh ? '合规与许可' : 'Legal'}
            </h4>
            <ul className="space-y-2 text-xs text-neutral-500 dark:text-neutral-400">
              <li><span className="hover:text-neutral-900 dark:hover:text-white cursor-pointer">Open Source Apache 2.0</span></li>
              <li><span className="hover:text-neutral-900 dark:hover:text-white cursor-pointer">Terms of Protocol</span></li>
              <li><span className="hover:text-neutral-900 dark:hover:text-white cursor-pointer">Security Audits</span></li>
            </ul>
          </div>
        </div>

        {/* GIANT BRUTALIST PIXEL WATERMARK DISPLAY AT THE BOTTOM */}
        <div className="relative pt-6 pb-2 select-none pointer-events-none flex items-center justify-center">
          <div className="w-full text-center">
            <span className="font-black text-[18vw] sm:text-[19vw] tracking-tighter uppercase leading-none font-mono block text-neutral-900/10 dark:text-white/10 bg-gradient-to-b from-neutral-900/25 to-transparent dark:from-white/20 dark:to-transparent bg-clip-text text-transparent transform translate-y-4">
              BCHMESH
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
`);

// ==========================================
// 7. Update App.tsx to include MeshKeyFeatures & clean layout
// ==========================================
writeFile('src/App.tsx', `
import React, { useEffect, useState } from 'react';
import { useMesh } from '@/context/MeshContext';
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
import { MeshAppComingSoon } from '@/components/app/MeshAppComingSoon';

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
        {activeTab === 'app' && <MeshAppComingSoon />}
      </main>

      {/* Wireframe Brutalist Footer */}
      <MeshFooter />
    </div>
  );
}

export default App;
`);

console.log('All Proofly theme components written successfully.');
