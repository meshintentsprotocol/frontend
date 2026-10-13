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

// -------------------------------------------------------------
// 1. High-Contrast index.css
// -------------------------------------------------------------
const indexCss = `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --bg-base: #f4f6f9;
    --bg-surface: #ffffff;
    --bg-card: #ffffff;
    --bg-subtle: #eaedf2;
    --bg-input: #ffffff;
    --border-grid: #cbd5e1;
    --border-card: #cbd5e1;
    --border-subtle: #e2e8f0;
    --text-primary: #090d16;
    --text-secondary: #334155;
    --text-muted: #64748b;
    --btn-primary-bg: #090d16;
    --btn-primary-text: #ffffff;
    --btn-secondary-bg: #ffffff;
    --btn-secondary-border: #cbd5e1;
    --btn-secondary-text: #090d16;
    --crosshair-bg: #cbd5e1;
    --crosshair-stroke: #475569;
  }

  .dark {
    --bg-base: #0d0f15;
    --bg-surface: #131722;
    --bg-card: #151a27;
    --bg-subtle: #1c2233;
    --bg-input: #0f131d;
    --border-grid: #262e42;
    --border-card: #283247;
    --border-subtle: #1e2538;
    --text-primary: #f8fafc;
    --text-secondary: #cbd5e1;
    --text-muted: #8ca0b8;
    --btn-primary-bg: #f8fafc;
    --btn-primary-text: #0d0f15;
    --btn-secondary-bg: #151a27;
    --btn-secondary-border: #333f5c;
    --btn-secondary-text: #f8fafc;
    --crosshair-bg: #20273a;
    --crosshair-stroke: #94a3b8;
  }

  * {
    border-color: var(--border-card);
    scrollbar-width: thin;
  }

  html {
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;
  }

  body {
    background-color: var(--bg-base);
    color: var(--text-primary);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    transition: background-color 0.15s ease, color 0.15s ease;
  }
}

/* High-contrast custom scrollbar */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}
.dark ::-webkit-scrollbar-thumb {
  background: #2b364d;
}

.wireframe-border {
  border-color: var(--border-grid);
}

.wireframe-card {
  background-color: var(--bg-card);
  border: 1px solid var(--border-card);
}
`;

writeFile('src/index.css', indexCss);

// -------------------------------------------------------------
// 2. Comprehensive High-Grade MeshHeader.tsx
// -------------------------------------------------------------
const meshHeader = `import React, { useState } from 'react';
import { useMesh } from '@/context/MeshContext';
import { useMeshApp, type AppSubTab } from '@/context/MeshAppContext';
import { MeshLogo } from './MeshLogo';
import { TactileButton } from '@/components/ui/TactileButton';
import {
  Sun,
  Moon,
  Menu,
  X,
  ArrowUpRight,
  Wallet,
  Layers,
  Sliders,
  Sparkles,
  PieChart,
  Radio,
  FileCode2,
  BookOpen,
  ChevronRight,
  CheckCircle2,
  Copy,
  ExternalLink,
} from 'lucide-react';

export function MeshHeader() {
  const { theme, toggleTheme, language, setLanguage, activeTab, setActiveTab, t } = useMesh();
  const {
    subTab,
    setSubTab,
    isDemoMode,
    toggleDemoMode,
    walletConnected,
    walletAddress,
    bchBalance,
    connectWallet,
    positions,
  } = useMeshApp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const isZh = language === 'zh';
  const isAppMode = activeTab === 'app';

  // Landing Page smooth navigation anchors
  const LANDING_LINKS = [
    { id: 'features', label: isZh ? '核心特性' : 'Features', targetId: 'features' },
    { id: 'recycling', label: isZh ? '再循环引擎' : 'Recycling', targetId: 'recycling' },
    { id: 'strategies', label: isZh ? '策略模版' : 'Strategies', targetId: 'strategies' },
    { id: 'tri-route', label: isZh ? '三路路由' : 'Tri-Route', targetId: 'tri-route' },
    { id: 'simulator', label: isZh ? '收益模拟' : 'Simulator', targetId: 'simulator' },
    { id: 'architecture', label: isZh ? '技术架构' : 'Architecture', targetId: 'architecture' },
    { id: 'covenants', label: isZh ? '契约验证' : 'Covenants', targetId: 'covenants' },
    { id: 'faq', label: isZh ? '常见问题' : 'FAQ', targetId: 'faq' },
    { id: 'docs', label: isZh ? '开发者文档' : 'Docs', isTab: true, tabName: 'docs' as const },
  ];

  // App Terminal Tabs
  const APP_TABS: Array<{ id: AppSubTab; label: string; labelZh: string; icon: any; count?: number; pulse?: boolean }> = [
    { id: 'pools', label: 'Pools', labelZh: '流动性池', icon: Layers },
    { id: 'liquidity', label: 'DLMM Terminal', labelZh: '做市终端', icon: Sliders },
    { id: 'strategies', label: 'Strategy Studio', labelZh: '策略工坊', icon: Sparkles },
    { id: 'portfolio', label: 'Portfolio', labelZh: '我的持仓', icon: PieChart, count: positions.length },
    { id: 'intents', label: 'Nostr Swarm', labelZh: '意图流动', icon: Radio, pulse: true },
    { id: 'inspector', label: 'Covenants', labelZh: '契约审计', icon: FileCode2 },
  ];

  const handleLandingClick = (link: (typeof LANDING_LINKS)[0]) => {
    if (link.isTab && link.tabName) {
      setActiveTab(link.tabName);
    } else if (link.targetId) {
      if (activeTab !== 'landing') {
        setActiveTab('landing');
        setTimeout(() => {
          document.getElementById(link.targetId)?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      } else {
        document.getElementById(link.targetId)?.scrollIntoView({ behavior: 'smooth' });
      }
    }
    setMobileMenuOpen(false);
  };

  const copyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#cbd5e1] dark:border-[#262e42] bg-[#ffffff]/95 dark:bg-[#0d0f15]/95 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo & Mode Badge */}
        <div className="flex items-center gap-3 shrink-0">
          <div
            onClick={() => setActiveTab('landing')}
            className="flex items-center gap-2.5 cursor-pointer group select-none"
          >
            <MeshLogo className="w-8 h-8 group-hover:scale-105 transition-transform" />
            <div className="flex flex-col">
              <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                Mesh Finance
              </span>
              <span className="font-mono text-[9px] text-slate-500 dark:text-slate-400 font-medium">
                UTXO DeFi Protocol
              </span>
            </div>
          </div>

          {/* Mode Pill Indicator */}
          <div className="hidden md:flex items-center gap-1.5 pl-2 border-l border-slate-300 dark:border-slate-800">
            {isAppMode ? (
              <button
                onClick={() => setActiveTab('landing')}
                className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-mono text-[10px] font-bold hover:bg-emerald-500/20 transition-all flex items-center gap-1 cursor-pointer"
                title="Click to view landing overview"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>TERMINAL ACTIVE</span>
              </button>
            ) : (
              <span className="px-2 py-0.5 rounded-md bg-slate-200/60 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-mono text-[10px] font-semibold">
                OVERVIEW
              </span>
            )}
          </div>
        </div>

        {/* Center Navigation Bar */}
        {isAppMode ? (
          /* App Navigation Tabs */
          <nav className="hidden lg:flex items-center gap-1 bg-slate-100 dark:bg-[#131722] p-1 rounded-2xl border border-slate-300 dark:border-[#262e42]">
            {APP_TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = subTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSubTab(tab.id)}
                  className={\`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer relative \${
                    isActive
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-[#1e2538]'
                  }\`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{isZh ? tab.labelZh : tab.label}</span>
                  {tab.pulse && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  )}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span
                      className={\`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold \${
                        isActive
                          ? 'bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }\`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        ) : (
          /* Landing Navigation Links */
          <nav className="hidden lg:flex items-center gap-1 text-xs font-semibold">
            {LANDING_LINKS.map(link => (
              <button
                key={link.id}
                onClick={() => handleLandingClick(link)}
                className="px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
              >
                {link.label}
              </button>
            ))}
          </nav>
        )}

        {/* Right Controls Tray */}
        <div className="hidden sm:flex items-center gap-2">
          {/* Chipnet Status / Simulation Toggle in App Mode */}
          {isAppMode && (
            <button
              onClick={toggleDemoMode}
              className={\`px-2.5 py-1.5 rounded-xl border text-[11px] font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer \${
                isDemoMode
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300'
                  : 'border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400'
              }\`}
              title="Click to toggle client-side simulation vs live chipnet"
            >
              <span className={\`w-1.5 h-1.5 rounded-full \${isDemoMode ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}\`} />
              <span>{isDemoMode ? 'SIMULATION' : 'CHIPNET'}</span>
            </button>
          )}

          {/* Language Switch */}
          <div className="flex items-center rounded-xl bg-slate-200/60 dark:bg-[#131722] p-0.5 border border-slate-300 dark:border-[#262e42] text-[11px] font-mono">
            <button
              onClick={() => setLanguage('en')}
              className={\`px-2 py-1 rounded-lg transition-all cursor-pointer \${
                language === 'en'
                  ? 'bg-white dark:bg-[#1c2233] text-slate-900 dark:text-white font-bold shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }\`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage('zh')}
              className={\`px-2 py-1 rounded-lg transition-all cursor-pointer \${
                language === 'zh'
                  ? 'bg-white dark:bg-[#1c2233] text-slate-900 dark:text-white font-bold shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }\`}
            >
              中文
            </button>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl border border-slate-300 dark:border-[#262e42] bg-white dark:bg-[#131722] text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-600 transition-all cursor-pointer shadow-xs"
            title={theme === 'dark' ? t.nav.modeLight : t.nav.modeDark}
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-700" />}
          </button>

          {/* Primary Action Button */}
          {isAppMode ? (
            walletConnected ? (
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#131722] border border-slate-300 dark:border-[#262e42] p-1 rounded-xl">
                <span className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono text-xs font-bold">
                  {bchBalance.toFixed(2)} BCH
                </span>
                <button
                  onClick={copyAddress}
                  className="px-2 py-1 rounded-lg text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#1c2233] flex items-center gap-1 cursor-pointer"
                  title="Click to copy CashAddress"
                >
                  <span>{walletAddress?.slice(0, 6)}...{walletAddress?.slice(-3)}</span>
                  {copied ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 opacity-60" />}
                </button>
              </div>
            ) : (
              <TactileButton
                variant="primary"
                size="sm"
                onClick={() => connectWallet()}
                icon={<Wallet className="w-3.5 h-3.5" />}
              >
                Connect Wallet
              </TactileButton>
            )
          ) : (
            <TactileButton
              variant="primary"
              size="sm"
              onClick={() => { setActiveTab('app'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              icon={<ArrowUpRight className="w-3.5 h-3.5" />}
            >
              Launch App
            </TactileButton>
          )}
        </div>

        {/* Mobile Hamburger */}
        <div className="flex lg:hidden items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-b border-slate-300 dark:border-[#262e42] bg-white dark:bg-[#0d0f15] p-4 space-y-3">
          {isAppMode ? (
            <div className="space-y-1">
              <div className="text-[10px] font-mono text-slate-500 uppercase px-2 mb-1">Terminal Navigation</div>
              {APP_TABS.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => { setSubTab(tab.id); setMobileMenuOpen(false); }}
                    className={\`w-full text-left p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between \${
                      subTab === tab.id
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }\`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      <span>{isZh ? tab.labelZh : tab.label}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 opacity-50" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-1">
              {LANDING_LINKS.map(link => (
                <button
                  key={link.id}
                  onClick={() => handleLandingClick(link)}
                  className="w-full text-left p-2.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {link.label}
                </button>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <button
              onClick={() => { setActiveTab(isAppMode ? 'landing' : 'app'); setMobileMenuOpen(false); }}
              className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-bold text-center"
            >
              {isAppMode ? 'Back to Overview' : 'Launch Terminal'}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
`;

writeFile('src/components/common/MeshHeader.tsx', meshHeader);

// -------------------------------------------------------------
// 3. Clean MeshAppShell.tsx (No redundant duplicate header/tabs)
// -------------------------------------------------------------
const meshAppShell = `import React, { useState } from 'react';
import { useMesh } from '@/context/MeshContext';
import { useMeshApp } from '@/context/MeshAppContext';
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
  Zap,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  ChevronRight,
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
  } = useMeshApp();

  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const isZh = language === 'zh';

  // Contextual telemetry labels per active sub-tab
  const TAB_META: Record<string, { title: string; titleZh: string; desc: string; descZh: string; badge: string }> = {
    pools: {
      title: 'Pools & DLMM Liquidity Explorer',
      titleZh: '流动性池与深度分布',
      desc: 'Browse decentralized covenant bin pools with non-custodial yields.',
      descZh: '浏览自主契约流动性池，查看无托管即时收益率。',
      badge: '48 LIVE COVENANTS',
    },
    liquidity: {
      title: 'DLMM Concentrated Liquidity Terminal',
      titleZh: '离散流动性做市终端',
      desc: 'Place single-sided or concentrated bin liquidity with 1-sat transaction fees.',
      descZh: '配置集中价格区间做市，享受 1 sat 费率的自主再循环契约。',
      badge: 'ZERO RE-INDEXING FEES',
    },
    strategies: {
      title: 'Autonomous Strategy Studio',
      titleZh: '自动化策略工坊',
      desc: 'Deploy self-rebalancing recycling grid pairs and autonomous market makers.',
      descZh: '部署自我平衡的循环网格策略与自主做市契约。',
      badge: '100% NON-CUSTODIAL',
    },
    portfolio: {
      title: 'My Sovereign Positions & Portfolio',
      titleZh: '我的持仓与主权金库',
      desc: 'Inspect active covenant positions, harvest accrued satoshis, or execute sovereign dock exit.',
      descZh: '查看活跃策略契约，一键提取累计手续费或执行主权撤出。',
      badge: 'BCH UTXO VERIFIED',
    },
    intents: {
      title: 'Nostr NIP-90 Intent Swarm',
      titleZh: 'Nostr 去中心化意图流动',
      desc: 'Real-time solver order flow and peer-to-peer mempool liquidity matching.',
      descZh: '实时撮合求解器广播的交易意图与 P2P 内存池流动性。',
      badge: 'P2P GOSSIP MEMPOOL',
    },
    inspector: {
      title: 'CashScript Covenant Bytecode Inspector',
      titleZh: 'CashScript 契约字节码审计',
      desc: 'Audit verified on-chain contract bytecode running on Bitcoin Cash Chipnet.',
      descZh: '审计在 Bitcoin Cash Chipnet 上运行的不可篡改原生契约字节码。',
      badge: 'PRAGMA CASHSCRIPT 0.10',
    },
  };

  const meta = TAB_META[subTab] || TAB_META.pools;

  return (
    <section className="px-4 sm:px-6 relative min-h-[90vh] py-6 sm:py-8">
      <div className="relative max-w-7xl mx-auto space-y-6">
        <CornerCrosshair className="-left-3 -top-3" />
        <CornerCrosshair className="-right-3 -top-3" />
        <CornerCrosshair className="-left-3 -bottom-3" />
        <CornerCrosshair className="-right-3 -bottom-3" />

        {/* Demo Simulation Alert Strip */}
        {isDemoMode && (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-700 dark:text-amber-300">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span className="font-bold uppercase tracking-wider text-[11px] font-mono">
                Simulation Sandbox Active:
              </span>
              <span className="font-medium">
                Testing with pre-allocated 12.50 BCH & 45,000 pUSD. Zero gas risk, all operations simulate live CashScript covenant cycles.
              </span>
            </div>
            <button
              onClick={toggleDemoMode}
              className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 font-bold text-[11px] transition-colors cursor-pointer"
            >
              Switch to Live Chipnet
            </button>
          </div>
        )}

        {/* Contextual Terminal Header */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#131722] border border-slate-300 dark:border-[#262e42] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-mono text-[10px] font-bold uppercase">
                {meta.badge}
              </span>
              <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                Network: Bitcoin Cash Chipnet • 1 sat/vB
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-1.5">
              {isZh ? meta.titleZh : meta.title}
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              {isZh ? meta.descZh : meta.desc}
            </p>
          </div>

          <div className="flex items-center gap-2 self-stretch md:self-auto shrink-0">
            {/* Quick-switch buttons between adjacent views */}
            <button
              onClick={() => setSubTab('pools')}
              className={\`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer \${
                subTab === 'pools'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-[#1a2030] border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }\`}
            >
              Pools
            </button>
            <button
              onClick={() => setSubTab('liquidity')}
              className={\`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer \${
                subTab === 'liquidity'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-[#1a2030] border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }\`}
            >
              DLMM
            </button>
            <button
              onClick={() => setSubTab('strategies')}
              className={\`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer \${
                subTab === 'strategies'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-[#1a2030] border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }\`}
            >
              Studio
            </button>
            <button
              onClick={() => setSubTab('portfolio')}
              className={\`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer \${
                subTab === 'portfolio'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-[#1a2030] border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }\`}
            >
              Portfolio
            </button>
          </div>
        </div>

        {/* Dynamic Content Views */}
        <div>
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

writeFile('src/components/app/MeshAppShell.tsx', meshAppShell);

// -------------------------------------------------------------
// 4. Clean MeshNostrStream.tsx (Tactile & High-Contrast)
// -------------------------------------------------------------
const meshNostrStream = `import React, { useState, useEffect } from 'react';
import { Radio, ShieldCheck, Zap, ArrowRight, ExternalLink, Activity } from 'lucide-react';
import { TacticalBadge } from '@/components/ui/TacticalBadge';
import { MetricCard } from '@/components/ui/MetricCard';

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
      setIntents(prev => [newIntent, ...prev.slice(0, 11)]);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Telemetry Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <MetricCard
          label="NIP-90 Relay Status"
          value="Connected"
          subValue="relay.meshprotocol.org"
          delta={{ value: "38ms Latency", isPositive: true }}
        />
        <MetricCard
          label="Intent Gossip Rate"
          value="18 / sec"
          subValue="High mempool throughput"
          delta={{ value: "Active Swarm", isPositive: true }}
        />
        <MetricCard
          label="Competing Solvers"
          value="8 Online"
          subValue="MEV-protected Dutch auctions"
        />
        <MetricCard
          label="Settled Covenant Fills"
          value="1,492 Today"
          subValue="100% On-Chain Bitcoin Cash"
          delta={{ value: "99.8% Success", isPositive: true }}
        />
      </div>

      {/* Live Intent Feed Table */}
      <div className="rounded-2xl border border-slate-300 dark:border-[#262e42] overflow-hidden bg-white dark:bg-[#131722] shadow-xs">
        <div className="p-4 border-b border-slate-200 dark:border-[#262e42] flex items-center justify-between bg-slate-50 dark:bg-[#11141e]">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-500 animate-pulse" />
            <span className="font-mono text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Decentralized Intent Mempool Stream
            </span>
          </div>
          <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
            <Activity className="w-3.5 h-3.5" /> P2P Relay Live
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#262e42] font-mono text-[10px] text-slate-500 uppercase tracking-wider bg-slate-50 dark:bg-[#11141e]">
                <th className="py-3 px-4">Intent Hash</th>
                <th className="py-3 px-4">Archetype</th>
                <th className="py-3 px-4">Give Asset</th>
                <th className="py-3 px-4">Want Asset</th>
                <th className="py-3 px-4">Execution Rate</th>
                <th className="py-3 px-4">Solver Routing</th>
                <th className="py-3 px-4 text-right">Settlement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#262e42] font-mono">
              {intents.map(intent => (
                <tr key={intent.id} className="hover:bg-slate-50 dark:hover:bg-[#1a2030]/60 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{intent.id}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                      {intent.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-semibold">{intent.give}</td>
                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-semibold">{intent.want}</td>
                  <td className="py-3 px-4 text-slate-900 dark:text-white font-bold">{intent.rate}</td>
                  <td className="py-3 px-4 text-slate-500 dark:text-slate-400">{intent.solver}</td>
                  <td className="py-3 px-4 text-right">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
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

writeFile('src/components/app/MeshNostrStream.tsx', meshNostrStream);

// -------------------------------------------------------------
// 5. Clean MeshCovenantInspector.tsx (High-Grade Bytecode Audit)
// -------------------------------------------------------------
const meshCovenantInspector = `import React, { useState } from 'react';
import { FileCode2, ShieldCheck, CheckCircle2, Terminal, Copy, ExternalLink } from 'lucide-react';
import { TactileButton } from '@/components/ui/TactileButton';

export function MeshCovenantInspector() {
  const [copied, setCopied] = useState(false);

  const cashScriptSource = \`pragma cashscript ^0.10.0;

/**
 * MeshPoolV3 ?" Sovereign Non-Custodial UTXO Covenant
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

  const copyCode = () => {
    navigator.clipboard.writeText(cashScriptSource);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="p-5 rounded-2xl bg-white dark:bg-[#131722] border border-slate-300 dark:border-[#262e42] shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            <h3 className="font-bold text-base text-slate-900 dark:text-white">CashScript Covenant On-Chain Bytecode Audit</h3>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-mono font-bold">
            VERIFIED AUDIT: CHIPNET V3
          </span>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          Every Mesh Finance liquidity pool runs on unalterable CashScript bytecode compiled for Bitcoin Cash. Contract outputs enforce atomic solver fills and perpetual mirror pool recycling without custodian intermediaries.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-300 dark:border-[#262e42] overflow-hidden bg-slate-950 font-mono text-xs shadow-md">
        <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-200 font-bold">contracts/MeshPoolV3.cash</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-emerald-400 font-bold">Artifact Hash: 0x9f88c2...e81a</span>
            <button
              onClick={copyCode}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 cursor-pointer transition-colors"
            >
              {copied ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>
        <pre className="p-5 overflow-x-auto text-emerald-300 leading-relaxed font-mono selection:bg-emerald-900">
          {cashScriptSource}
        </pre>
      </div>
    </div>
  );
}
`;

writeFile('src/components/app/MeshCovenantInspector.tsx', meshCovenantInspector);

// -------------------------------------------------------------
// 6. Upgraded MeshWalletModal.tsx (Universal High Contrast)
// -------------------------------------------------------------
const meshWalletModal = `import React from 'react';
import { useMeshApp } from '@/context/MeshAppContext';
import { CornerCrosshair } from '@/components/common/MeshWireframeBox';
import { Wallet, ShieldCheck, CheckCircle2, X, ExternalLink, Zap, Compass, Smartphone, Laptop } from 'lucide-react';

export function MeshWalletModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { connectWallet, walletConnected, walletAddress, disconnectWallet } = useMeshApp();

  if (!open) return null;

  const WALLETS = [
    { id: 'cham', name: 'Cham Wallet Extension', desc: 'Native CashTokens & Intent Swarm Web3 Extension', popular: true, icon: Compass },
    { id: 'cashonize', name: 'Cashonize Web Wallet', desc: 'Popular open-source web wallet for BCH & CashTokens', popular: false, icon: Laptop },
    { id: 'paytaca', name: 'Paytaca Mobile', desc: 'Mobile-first BCH CashTokens wallet with WalletConnect', popular: false, icon: Smartphone },
    { id: 'demo', name: 'Interactive Chipnet Sandbox', desc: 'Pre-loaded 12.50 BCH & 45k pUSD simulation sandbox', popular: true, icon: Zap },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in-50">
      <div className="relative w-full max-w-md bg-white dark:bg-[#131722] border border-slate-300 dark:border-[#262e42] rounded-3xl p-6 text-slate-900 dark:text-slate-100 shadow-2xl">
        <CornerCrosshair className="-left-2 -top-2" />
        <CornerCrosshair className="-right-2 -top-2" />
        <CornerCrosshair className="-left-2 -bottom-2" />
        <CornerCrosshair className="-right-2 -bottom-2" />

        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-[#262e42] mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#1c2233] border border-slate-300 dark:border-slate-700 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Connect BCH Wallet</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">Mesh Finance V3 • Sovereign Web3</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {walletConnected ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0f131d] border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Status</span>
                <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                </span>
              </div>
              <div className="font-mono text-xs text-slate-900 dark:text-white truncate bg-white dark:bg-black/40 p-2.5 rounded-lg border border-slate-300 dark:border-slate-800">
                {walletAddress}
              </div>
            </div>
            <button
              onClick={() => { disconnectWallet(); onClose(); }}
              className="w-full py-2.5 rounded-xl border border-rose-500/40 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-xs font-semibold cursor-pointer transition-colors"
            >
              Disconnect Wallet
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {WALLETS.map(w => {
              const Icon = w.icon;
              return (
                <button
                  key={w.id}
                  onClick={() => { connectWallet(w.name); onClose(); }}
                  className="w-full p-3 rounded-2xl border border-slate-300 dark:border-[#262e42] hover:border-slate-500 dark:hover:border-slate-500 bg-slate-50 dark:bg-[#1a2030] hover:bg-slate-100 dark:hover:bg-[#20273a] transition-all flex items-center justify-between group text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-emerald-500">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-500 transition-colors">{w.name}</span>
                        {w.popular && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">{w.desc}</p>
                    </div>
                  </div>
                  <Zap className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-5 pt-3 border-t border-slate-200 dark:border-[#262e42] flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Non-Custodial Protocol
          </span>
          <span className="font-mono text-[10px]">Chipnet & Mainnet</span>
        </div>
      </div>
    </div>
  );
}
`;

writeFile('src/components/app/MeshWalletModal.tsx', meshWalletModal);

console.log('✓ Stage 5 complete: MeshHeader navbar overhaul, MeshAppShell stream, NostrStream, CovenantInspector, WalletModal & index.css updated!');
