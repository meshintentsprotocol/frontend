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
// 1. Reusable UI Primitives
// -----------------------------------------------------------------------------

// src/components/ui/TactileButton.tsx
writeFile('src/components/ui/TactileButton.tsx', `
import React from 'react';
import { Loader2 } from 'lucide-react';

export interface TactileButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'destructive' | 'emerald' | 'ghost';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export function TactileButton({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className = '',
  disabled,
  ...props
}: TactileButtonProps) {
  const base = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-150 cursor-pointer select-none active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 shadow-xs';

  const variants = {
    primary: 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100',
    secondary: 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white hover:bg-neutral-200 dark:hover:bg-neutral-700',
    outline: 'border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#151821] text-neutral-800 dark:text-neutral-200 hover:border-neutral-400 dark:hover:border-neutral-500',
    destructive: 'border border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20',
    emerald: 'bg-emerald-500 text-black hover:bg-emerald-400 font-bold shadow-md shadow-emerald-500/10',
    ghost: 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800',
  };

  const sizes = {
    xs: 'px-2.5 py-1 text-[11px] gap-1',
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-xs gap-2',
    lg: 'px-5 py-3 text-sm gap-2.5',
  };

  return (
    <button
      disabled={disabled || loading}
      className={\`\${base} \${variants[variant]} \${sizes[size]} \${className}\`}
      {...props}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      <span>{children}</span>
    </button>
  );
}
`);

// src/components/ui/TactileInput.tsx
writeFile('src/components/ui/TactileInput.tsx', `
import React from 'react';

export interface TactileInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  subLabel?: string;
  suffix?: string;
  prefix?: string;
  balanceHint?: string;
  onMax?: () => void;
  onFraction?: (fraction: number) => void;
  error?: string;
}

export function TactileInput({
  label,
  subLabel,
  suffix,
  prefix,
  balanceHint,
  onMax,
  onFraction,
  error,
  className = '',
  ...props
}: TactileInputProps) {
  return (
    <div className="space-y-1.5 text-xs">
      {(label || balanceHint) && (
        <div className="flex items-center justify-between font-mono text-[11px]">
          {label && <span className="font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">{label}</span>}
          {balanceHint && (
            <div className="flex items-center gap-1.5 text-neutral-500">
              <span>{balanceHint}</span>
              {onMax && (
                <button
                  type="button"
                  onClick={onMax}
                  className="px-1.5 py-0.2 rounded bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-[10px] font-bold text-neutral-700 dark:text-neutral-300 cursor-pointer"
                >
                  MAX
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className={\`flex items-center gap-2 p-3 rounded-xl bg-white dark:bg-[#0e1017] border \${
        error
          ? 'border-rose-500/80 ring-1 ring-rose-500/20'
          : 'border-neutral-300 dark:border-neutral-700/80 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500/30'
      } transition-all \${className}\`}>
        {prefix && <span className="font-mono text-neutral-500 shrink-0 font-semibold">{prefix}</span>}
        <input
          className="flex-1 bg-transparent font-mono text-sm font-bold text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-600 focus:outline-none"
          {...props}
        />
        {suffix && (
          <span className="font-mono text-xs font-semibold text-neutral-600 dark:text-neutral-300 px-1 shrink-0">
            {suffix}
          </span>
        )}
      </div>

      {onFraction && (
        <div className="flex items-center justify-end gap-1 pt-0.5">
          {[0.25, 0.5, 0.75].map(frac => (
            <button
              key={frac}
              type="button"
              onClick={() => onFraction(frac)}
              className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800/80 hover:bg-neutral-200 dark:hover:bg-neutral-700 font-mono text-[10px] text-neutral-600 dark:text-neutral-400 cursor-pointer"
            >
              {frac * 100}%
            </button>
          ))}
        </div>
      )}

      {error && <div className="text-[11px] text-rose-500 font-mono">{error}</div>}
      {subLabel && !error && <div className="text-[10px] text-neutral-500 leading-normal">{subLabel}</div>}
    </div>
  );
}
`);

// src/components/ui/TacticalBadge.tsx
writeFile('src/components/ui/TacticalBadge.tsx', `
import React from 'react';
import { Repeat } from 'lucide-react';

export interface TacticalBadgeProps {
  status: 'active' | 'in-range' | 'rebalancing' | 'out-of-range' | 'recycled' | 'optimal';
  label?: string;
  className?: string;
}

export function TacticalBadge({ status, label, className = '' }: TacticalBadgeProps) {
  const configs = {
    active: {
      bg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      dot: 'bg-emerald-500 animate-pulse',
      text: 'ACTIVE',
    },
    optimal: {
      bg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      dot: 'bg-emerald-500 animate-pulse',
      text: 'OPTIMAL RANGE',
    },
    'in-range': {
      bg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      dot: 'bg-emerald-500 animate-pulse',
      text: 'IN RANGE',
    },
    rebalancing: {
      bg: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30',
      dot: 'bg-amber-400',
      text: 'REBALANCING',
    },
    'out-of-range': {
      bg: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
      dot: 'bg-rose-400',
      text: 'OUT OF RANGE',
    },
    recycled: {
      bg: 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30',
      icon: <Repeat className="w-2.5 h-2.5 text-sky-400" />,
      text: 'RECYCLED',
    },
  };

  const c = configs[status] || configs.active;

  return (
    <span className={\`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-mono font-bold uppercase tracking-wider \${c.bg} \${className}\`}>
      {c.dot && <span className={\`w-1.5 h-1.5 rounded-full \${c.dot}\`} />}
      {c.icon}
      <span>{label || c.text}</span>
    </span>
  );
}
`);

// src/components/ui/MetricCard.tsx
writeFile('src/components/ui/MetricCard.tsx', `
import React from 'react';
import { CornerCrosshair } from '@/components/common/MeshWireframeBox';

export interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  delta?: { value: string; isPositive: boolean };
  icon?: React.ReactNode;
  className?: string;
}

export function MetricCard({ label, value, subValue, delta, icon, className = '' }: MetricCardProps) {
  return (
    <div className={\`p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#151821] border border-neutral-200/90 dark:border-neutral-800/90 relative overflow-hidden shadow-xs hover:border-neutral-400 dark:hover:border-neutral-600 transition-all \${className}\`}>
      <CornerCrosshair className="-left-1.5 -top-1.5" />
      <CornerCrosshair className="-right-1.5 -top-1.5" />
      <CornerCrosshair className="-left-1.5 -bottom-1.5" />
      <CornerCrosshair className="-right-1.5 -bottom-1.5" />

      <div className="flex items-center justify-between text-neutral-500 font-mono text-[10px] uppercase tracking-wider mb-1">
        <span>{label}</span>
        {icon}
      </div>

      <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-neutral-900 dark:text-white">
        {value}
      </div>

      {(subValue || delta) && (
        <div className="flex items-center gap-2 mt-1 font-mono text-[11px]">
          {delta && (
            <span className={\`font-bold \${delta.isPositive ? 'text-emerald-500' : 'text-rose-500'}\`}>
              {delta.isPositive ? '+' : ''}{delta.value}
            </span>
          )}
          {subValue && <span className="text-neutral-500">{subValue}</span>}
        </div>
      )}
    </div>
  );
}
`);

// -----------------------------------------------------------------------------
// 2. MeshHeader.tsx — Unified Smart Header (Landing Mode vs App Mode)
// -----------------------------------------------------------------------------
writeFile('src/components/common/MeshHeader.tsx', `
import React, { useState } from 'react';
import { useMesh } from '@/context/MeshContext';
import { useMeshApp, type AppSubTab } from '@/context/MeshAppContext';
import { MeshLogo } from './MeshLogo';
import { CornerCrosshair } from './MeshWireframeBox';
import {
  Sun,
  Moon,
  ArrowUpRight,
  Menu,
  X,
  Wallet,
  Layers,
  Sliders,
  Sparkles,
  PieChart,
  Radio,
  FileCode2,
  ChevronRight,
  Zap,
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
  } = useMeshApp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isZh = language === 'zh';
  const isAppMode = activeTab === 'app';

  const APP_TABS: Array<{ id: AppSubTab; label: string; labelZh: string; icon: any }> = [
    { id: 'pools', label: 'Pools', labelZh: '池子', icon: Layers },
    { id: 'liquidity', label: 'Liquidity', labelZh: '集中流动性', icon: Sliders },
    { id: 'strategies', label: 'Strategies', labelZh: '策略工作室', icon: Sparkles },
    { id: 'portfolio', label: 'Portfolio', labelZh: '我的持仓', icon: PieChart },
    { id: 'intents', label: 'Intents', labelZh: 'Nostr意图', icon: Radio },
    { id: 'inspector', label: 'Covenants', labelZh: '契约审计', icon: FileCode2 },
  ];

  const LANDING_LINKS = [
    { id: 'overview', label: t.nav.overview, href: '#hero' },
    { id: 'recycling', label: t.nav.recycling, href: '#recycling' },
    { id: 'strategies', label: t.nav.strategies, href: '#strategies' },
    { id: 'simulator', label: t.nav.simulator, href: '#simulator' },
    { id: 'architecture', label: t.nav.architecture, href: '#architecture' },
    { id: 'docs', label: t.nav.docs, action: () => setActiveTab('docs') },
  ];

  const handleLandingClick = (link: typeof LANDING_LINKS[0]) => {
    if (link.action) {
      link.action();
    } else {
      setActiveTab('landing');
      setTimeout(() => {
        const el = document.querySelector(link.href || '');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    }
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-[#f8fafc]/95 dark:bg-[#0b0c10]/95 backdrop-blur-md border-b border-[#cbd5e1] dark:border-[#232734] transition-colors duration-150">
      <div className="border-x border-[#cbd5e1] dark:border-[#232734] max-w-7xl mx-auto px-4 sm:px-8 h-18 flex items-center justify-between relative">
        <CornerCrosshair className="-left-2.5 -top-2.5" />
        <CornerCrosshair className="-right-2.5 -top-2.5" />
        <CornerCrosshair className="-left-2.5 -bottom-2.5" />
        <CornerCrosshair className="-right-2.5 -bottom-2.5" />

        {/* Brand Logo & App Mode Switcher */}
        <div className="flex items-center gap-4">
          <div
            onClick={() => { setActiveTab('landing'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className="cursor-pointer flex items-center gap-2.5 select-none"
          >
            <MeshLogo size={32} />
          </div>

          {/* Mode Pill: Switch between Landing and App Terminal */}
          <div className="hidden md:flex items-center p-0.5 rounded-xl bg-neutral-200/70 dark:bg-neutral-800/80 border border-neutral-300 dark:border-neutral-700/80 text-[11px] font-semibold font-mono">
            <button
              onClick={() => setActiveTab('landing')}
              className={\`px-2.5 py-1 rounded-lg transition-all cursor-pointer \${
                !isAppMode
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs font-bold'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }\`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('app')}
              className={\`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 \${
                isAppMode
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs font-bold'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }\`}
            >
              <span>Terminal</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            </button>
          </div>
        </div>

        {/* Central Navigation: Differs in App Mode vs Landing Mode */}
        {isAppMode ? (
          /* App Navigation Tabs */
          <nav className="hidden lg:flex items-center gap-1">
            {APP_TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = subTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSubTab(tab.id)}
                  className={\`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer \${
                    isActive
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60'
                  }\`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{isZh ? tab.labelZh : tab.label}</span>
                </button>
              );
            })}
          </nav>
        ) : (
          /* Landing Navigation Links */
          <nav className="hidden lg:flex items-center gap-1 text-sm font-medium">
            {LANDING_LINKS.map(link => (
              <button
                key={link.id}
                onClick={() => handleLandingClick(link)}
                className="px-3 py-1.5 rounded-lg text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-200/50 dark:hover:bg-neutral-800/60 transition-colors cursor-pointer text-xs font-medium"
              >
                {link.label}
              </button>
            ))}
          </nav>
        )}

        {/* Right Controls: Telemetry, Theme, Language, Wallet */}
        <div className="hidden sm:flex items-center gap-2">
          {/* Simulation Toggle in App Mode */}
          {isAppMode && (
            <button
              onClick={toggleDemoMode}
              className={\`px-2.5 py-1 rounded-xl border text-[11px] font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer \${
                isDemoMode
                  ? 'border-amber-500/50 bg-amber-500/15 text-amber-600 dark:text-amber-300'
                  : 'border-neutral-300 dark:border-neutral-700 text-neutral-500'
              }\`}
              title="Toggle client-side simulation vs live testnet"
            >
              <span className={\`w-1.5 h-1.5 rounded-full \${isDemoMode ? 'bg-amber-400 animate-pulse' : 'bg-neutral-400'}\`} />
              <span>{isDemoMode ? 'SIMULATION' : 'CHIPNET'}</span>
            </button>
          )}

          {/* Language Switch */}
          <div className="flex items-center rounded-lg bg-neutral-200/60 dark:bg-neutral-800/80 p-0.5 border border-neutral-300 dark:border-neutral-700 text-[11px] font-mono">
            <button
              onClick={() => setLanguage('en')}
              className={\`px-1.5 py-0.5 rounded transition-all \${
                language === 'en'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-bold shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }\`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage('zh')}
              className={\`px-1.5 py-0.5 rounded transition-all \${
                language === 'zh'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-bold shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }\`}
            >
              中文
            </button>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl border border-neutral-300 dark:border-neutral-700/80 bg-white dark:bg-[#151821] text-neutral-700 dark:text-neutral-300 hover:border-neutral-400 dark:hover:border-neutral-500 transition-all cursor-pointer shadow-xs"
            title={theme === 'dark' ? t.nav.modeLight : t.nav.modeDark}
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-neutral-700" />}
          </button>

          {/* Primary Action Button */}
          {isAppMode ? (
            <button
              onClick={() => connectWallet()}
              className="px-3.5 py-2 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-bold font-mono flex items-center gap-1.5 shadow-sm hover:opacity-90 cursor-pointer"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>
                {walletConnected
                  ? \`\${bchBalance.toFixed(2)} BCH\`
                  : 'Connect Wallet'}
              </span>
            </button>
          ) : (
            <button
              onClick={() => { setActiveTab('app'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="h-9 px-4 rounded-xl font-bold text-xs bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <span>Launch App</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Mobile Hamburger */}
        <div className="flex sm:hidden items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-neutral-700" />}
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-b border-[#cbd5e1] dark:border-[#232734] bg-[#f8fafc] dark:bg-[#0b0c10] p-4 space-y-2">
          {isAppMode ? (
            <div className="space-y-1">
              <div className="text-[10px] font-mono text-neutral-500 uppercase px-2 mb-1">Terminal Modules</div>
              {APP_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setSubTab(tab.id); setMobileMenuOpen(false); }}
                  className={\`w-full text-left p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between \${
                    subTab === tab.id
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                      : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800'
                  }\`}
                >
                  <span>{isZh ? tab.labelZh : tab.label}</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-50" />
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {LANDING_LINKS.map(link => (
                <button
                  key={link.id}
                  onClick={() => handleLandingClick(link)}
                  className="w-full text-left p-2.5 rounded-xl text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800"
                >
                  {link.label}
                </button>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 flex gap-2">
            <button
              onClick={() => { setActiveTab(isAppMode ? 'landing' : 'app'); setMobileMenuOpen(false); }}
              className="flex-1 py-2.5 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-bold text-center"
            >
              {isAppMode ? 'Back to Overview' : 'Launch Terminal'}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
`);

console.log('✓ Stage 2 complete: UI primitives and unified smart header created.');
