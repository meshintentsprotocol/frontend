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

// --------------------------------------------------------------------------
// 1. Bespoke MF (Mesh Finance) SVG Vector Logo
// --------------------------------------------------------------------------
const mfLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none">
  <defs>
    <linearGradient id="mfEmeraldCyan" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10B981" />
      <stop offset="45%" stop-color="#00F298" />
      <stop offset="100%" stop-color="#06B6D4" />
    </linearGradient>
    <linearGradient id="mfDarkPlate" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#151A27" />
      <stop offset="100%" stop-color="#0A0D14" />
    </linearGradient>
    <linearGradient id="mfBorderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2DD4BF" stop-opacity="0.8" />
      <stop offset="50%" stop-color="#06B6D4" stop-opacity="0.3" />
      <stop offset="100%" stop-color="#10B981" stop-opacity="0.8" />
    </linearGradient>
    <filter id="mfGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3.5" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Tactile Chamfered Hex-Squircle Shield Container -->
  <rect x="6" y="6" width="108" height="108" rx="26" fill="url(#mfDarkPlate)" stroke="url(#mfBorderGrad)" stroke-width="2" />
  
  <!-- Subtle Internal Grid / Lattice Background Lines -->
  <path d="M24 60 H96 M60 24 V96 M34 34 L86 86 M86 34 L34 86" stroke="#1E293B" stroke-width="1" stroke-dasharray="2 3" opacity="0.45" />

  <!-- THE "M" and "F" INTERCONNECTED MONOGRAM -->
  <!-- Left Leg of M -->
  <path d="M30 84 V36" stroke="url(#mfEmeraldCyan)" stroke-width="6.5" stroke-linecap="round" />
  
  <!-- M Diagonal Down to Center Node -->
  <path d="M30 36 L56 62" stroke="url(#mfEmeraldCyan)" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round" />
  
  <!-- M Diagonal Up to Right Apex / Stem of F -->
  <path d="M56 62 L78 36" stroke="url(#mfEmeraldCyan)" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round" />
  
  <!-- The Stem of F (descending down to base) -->
  <path d="M78 36 V84" stroke="url(#mfEmeraldCyan)" stroke-width="6.5" stroke-linecap="round" />
  
  <!-- Top Horizontal Bar of F -->
  <path d="M78 36 H96" stroke="url(#mfEmeraldCyan)" stroke-width="6.5" stroke-linecap="round" />
  
  <!-- Mid Horizontal Bar of F (branching from right-mid coordinate) -->
  <path d="M78 58 H92" stroke="url(#mfEmeraldCyan)" stroke-width="6" stroke-linecap="round" />

  <!-- Constellation Mesh Diagonal Connectors -->
  <path d="M30 60 L56 62 M56 62 L78 84" stroke="#06B6D4" stroke-width="2.5" stroke-linecap="round" opacity="0.65" />

  <!-- Interconnected Liquidity Node Spheres -->
  <circle cx="30" cy="36" r="4.5" fill="#10B981" />
  <circle cx="30" cy="84" r="4.5" fill="#10B981" />
  <circle cx="56" cy="62" r="6" fill="#00F298" filter="url(#mfGlow)" />
  <circle cx="78" cy="36" r="5" fill="#00D8F6" />
  <circle cx="78" cy="84" r="4.5" fill="#06B6D4" />
  <circle cx="96" cy="36" r="4" fill="#38BDF8" />
  <circle cx="92" cy="58" r="4" fill="#34D399" />
</svg>`;

writeFile('public/logo.svg', mfLogoSvg);
writeFile('public/favicon.svg', mfLogoSvg);
writeFile('public/mesh-icon.svg', mfLogoSvg);

// --------------------------------------------------------------------------
// 2. MeshLogo.tsx Component (Interactive React SVG with MF Monogram)
// --------------------------------------------------------------------------
const meshLogoComponent = `import React from 'react';
import { cn } from '@/lib/utils';
import { useMesh } from '@/context/MeshContext';

interface MeshLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
  variant?: 'icon' | 'full' | 'badge';
}

export function MeshLogo({
  size = 36,
  className,
  showText = true,
  variant = 'full',
}: MeshLogoProps) {
  const { theme } = useMesh();
  const isDark = theme === 'dark';

  return (
    <div className={cn("inline-flex items-center gap-2.5 select-none cursor-pointer group", className)}>
      {/* The MF Monogram Icon Badge */}
      <div
        className="relative shrink-0 flex items-center justify-center transition-transform duration-200 group-hover:scale-105"
        style={{ width: size, height: size }}
      >
        {/* Glowing backdrop in dark mode */}
        {isDark && (
          <div className="absolute inset-0 rounded-2xl bg-emerald-500/20 blur-md pointer-events-none group-hover:bg-emerald-400/35 transition-colors" />
        )}

        <svg
          viewBox="0 0 120 120"
          className="w-full h-full drop-shadow-sm"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="compMfGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="45%" stopColor="#00F298" />
              <stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>
            <linearGradient id="compPlateGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={isDark ? "#171D2B" : "#F8FAFC"} />
              <stop offset="100%" stopColor={isDark ? "#0A0D15" : "#E2E8F0"} />
            </linearGradient>
            <linearGradient id="compBorderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2DD4BF" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#06B6D4" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.8" />
            </linearGradient>
            <filter id="compGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Chamfered Squircle Shield */}
          <rect
            x="6"
            y="6"
            width="108"
            height="108"
            rx="26"
            fill="url(#compPlateGrad)"
            stroke="url(#compBorderGrad)"
            strokeWidth="2.5"
          />

          {/* Internal Matrix Guidelines */}
          <path
            d="M24 60 H96 M60 24 V96 M34 34 L86 86 M86 34 L34 86"
            stroke={isDark ? "#222C40" : "#CBD5E1"}
            strokeWidth="1"
            strokeDasharray="2 3"
            opacity="0.5"
          />

          {/* Left Leg of M */}
          <path
            d="M30 84 V36"
            stroke="url(#compMfGrad)"
            strokeWidth="6.5"
            strokeLinecap="round"
          />

          {/* M Diagonal Down */}
          <path
            d="M30 36 L56 62"
            stroke="url(#compMfGrad)"
            strokeWidth="6.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* M Diagonal Up / Stem of F */}
          <path
            d="M56 62 L78 36"
            stroke="url(#compMfGrad)"
            strokeWidth="6.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Stem of F descending */}
          <path
            d="M78 36 V84"
            stroke="url(#compMfGrad)"
            strokeWidth="6.5"
            strokeLinecap="round"
          />

          {/* Top Bar of F */}
          <path
            d="M78 36 H96"
            stroke="url(#compMfGrad)"
            strokeWidth="6.5"
            strokeLinecap="round"
          />

          {/* Mid Bar of F */}
          <path
            d="M78 58 H92"
            stroke="url(#compMfGrad)"
            strokeWidth="6"
            strokeLinecap="round"
          />

          {/* Diagonal Cross-Lattice */}
          <path
            d="M30 60 L56 62 M56 62 L78 84"
            stroke="#06B6D4"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.65"
          />

          {/* Constellation Nodes */}
          <circle cx="30" cy="36" r="4.5" fill="#10B981" />
          <circle cx="30" cy="84" r="4.5" fill="#10B981" />
          <circle cx="56" cy="62" r="6" fill="#00F298" filter="url(#compGlow)" />
          <circle cx="78" cy="36" r="5" fill="#00D8F6" />
          <circle cx="78" cy="84" r="4.5" fill="#06B6D4" />
          <circle cx="96" cy="36" r="4" fill="#38BDF8" />
          <circle cx="92" cy="58" r="4" fill="#34D399" />
        </svg>
      </div>

      {/* Typography: Mesh Finance */}
      {showText && (
        <div className="flex flex-col leading-none">
          <div className="font-extrabold text-base sm:text-lg tracking-tight flex items-center gap-1.5">
            <span className={isDark ? "text-white" : "text-slate-900"}>Mesh</span>
            <span className="bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 bg-clip-text text-transparent font-black">
              Finance
            </span>
          </div>
          <span className="text-[9px] font-mono tracking-widest uppercase font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
            UTXO DEFI PROTOCOL
          </span>
        </div>
      )}
    </div>
  );
}
`;

writeFile('src/components/common/MeshLogo.tsx', meshLogoComponent);

// --------------------------------------------------------------------------
// 3. Type-Safe TacticalBadge.tsx Fix
// --------------------------------------------------------------------------
const tacticalBadgeFix = `import React from 'react';
import { CheckCircle2, AlertTriangle, ShieldCheck, Repeat, Clock, Radio } from 'lucide-react';

export type BadgeStatus = 'optimal' | 'in-range' | 'rebalancing' | 'warning' | 'idle' | 'recycled';

interface TacticalBadgeProps {
  status: BadgeStatus;
  label?: string;
  className?: string;
}

interface BadgeConfig {
  bg: string;
  dot?: string;
  icon?: React.ReactNode;
  text: string;
}

export function TacticalBadge({ status, label, className = '' }: TacticalBadgeProps) {
  const configs: Record<BadgeStatus, BadgeConfig> = {
    optimal: {
      bg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
      dot: 'bg-emerald-400 animate-pulse',
      text: 'OPTIMAL',
    },
    'in-range': {
      bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      dot: 'bg-emerald-400',
      text: 'IN RANGE',
    },
    rebalancing: {
      bg: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30',
      dot: 'bg-amber-400 animate-ping',
      text: 'REBALANCING',
    },
    warning: {
      bg: 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30',
      dot: 'bg-rose-400',
      text: 'OUT OF RANGE',
    },
    idle: {
      bg: 'bg-slate-200/60 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700',
      dot: 'bg-slate-400',
      text: 'DOCKED / IDLE',
    },
    recycled: {
      bg: 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30',
      icon: <Repeat className="w-2.5 h-2.5 text-sky-400" />,
      text: 'RECYCLED',
    },
  };

  const c = configs[status] || configs.optimal;

  return (
    <span className={\`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-mono font-bold uppercase tracking-wider \${c.bg} \${className}\`}>
      {c.dot && <span className={\`w-1.5 h-1.5 rounded-full \${c.dot}\`} />}
      {c.icon}
      <span>{label || c.text}</span>
    </span>
  );
}
`;

writeFile('src/components/ui/TacticalBadge.tsx', tacticalBadgeFix);

// --------------------------------------------------------------------------
// 4. MeshDocs.tsx LaTeX Expression Fix (line 368 string escape)
// --------------------------------------------------------------------------
const meshDocsPath = path.join(rootDir, 'src/components/docs/MeshDocs.tsx');
if (fs.existsSync(meshDocsPath)) {
  let content = fs.readFileSync(meshDocsPath, 'utf8');
  content = content.replace(
    'Let Bid Covenant be \\(B(P_{bid})\\) and Mirror Ask Covenant be \\(A(P_{ask})\\).',
    'Let Bid Covenant be B(P_bid) and Mirror Ask Covenant be A(P_ask).'
  );
  fs.writeFileSync(meshDocsPath, content, 'utf8');
  console.log('✓ Fixed LaTeX braces in MeshDocs.tsx');
}

// --------------------------------------------------------------------------
// 5. Updated MeshHeader.tsx (Unified Clean Logo with MF Emblem)
// --------------------------------------------------------------------------
const meshHeaderPath = path.join(rootDir, 'src/components/common/MeshHeader.tsx');
if (fs.existsSync(meshHeaderPath)) {
  let content = fs.readFileSync(meshHeaderPath, 'utf8');
  content = content.replace(
    /<div\s+onClick=\{\(\)\s*=>\s*setActiveTab\('landing'\)\}\s+className="flex items-center gap-2\.5 cursor-pointer group select-none"\s*>[\s\S]*?<\/div>\s*<\/div>/,
    `<div
            onClick={() => setActiveTab('landing')}
            className="flex items-center gap-2.5 cursor-pointer group select-none"
          >
            <MeshLogo size={36} showText={true} />
          </div>`
  );
  fs.writeFileSync(meshHeaderPath, content, 'utf8');
  console.log('✓ Updated MeshHeader.tsx with unified MeshLogo');
}

// --------------------------------------------------------------------------
// 6. Updated MeshFooter.tsx (MF Logo in Col 1 & MESH FINANCE Watermark)
// --------------------------------------------------------------------------
const meshFooter = `import React from 'react';
import { useMesh } from '@/context/MeshContext';
import { CornerCrosshair } from './MeshWireframeBox';
import { MeshLogo } from './MeshLogo';
import { ArrowUpRight } from 'lucide-react';

export function MeshFooter() {
  const { language, setActiveTab } = useMesh();
  const isZh = language === 'zh';

  return (
    <footer className="border-b border-[#cbd5e1] dark:border-[#262e42] px-4 sm:px-6 relative bg-white dark:bg-[#090d14] transition-colors duration-200">
      <div className="border-x border-[#cbd5e1] dark:border-[#262e42] relative max-w-7xl mx-auto pt-16 sm:pt-20 pb-0 px-6 sm:px-10 lg:px-12 overflow-hidden">
        <CornerCrosshair className="-left-3 -top-3" />
        <CornerCrosshair className="-right-3 -top-3" />
        <CornerCrosshair className="-left-3 -bottom-3" />
        <CornerCrosshair className="-right-3 -bottom-3" />

        {/* 5-Column Navigation Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 sm:gap-10 pb-16 text-left">
          {/* Col 1: Brand & Ethos */}
          <div className="col-span-2 md:col-span-1 space-y-3.5">
            <MeshLogo size={36} showText={true} />
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pr-2">
              Sovereign discrete liquidity protocol and autonomous strategy engine engineered natively on Bitcoin Cash UTXO covenants.
            </p>
          </div>

          {/* Col 2: Navigation */}
          <div className="space-y-3">
            <h4 className="font-semibold text-xs text-slate-900 dark:text-slate-100 tracking-tight uppercase font-mono">
              Terminal
            </h4>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400 font-medium">
              <li>
                <button
                  onClick={() => { setActiveTab('landing'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer text-left"
                >
                  Overview
                </button>
              </li>
              <li>
                <button
                  onClick={() => { setActiveTab('app'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer text-left"
                >
                  Liquidity Pools
                </button>
              </li>
              <li>
                <button
                  onClick={() => { setActiveTab('app'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer text-left"
                >
                  Strategy Studio
                </button>
              </li>
              <li>
                <button
                  onClick={() => { setActiveTab('docs'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer text-left"
                >
                  Developer Docs
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Architecture */}
          <div className="space-y-3">
            <h4 className="font-semibold text-xs text-slate-900 dark:text-slate-100 tracking-tight uppercase font-mono">
              Technology
            </h4>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400 font-medium">
              <li><span className="text-slate-600 dark:text-slate-400">MeshPoolV3 Covenants</span></li>
              <li><span className="text-slate-600 dark:text-slate-400">CashScript v0.10</span></li>
              <li><span className="text-slate-600 dark:text-slate-400">CashTokens Standard</span></li>
              <li><span className="text-slate-600 dark:text-slate-400">Nostr NIP-90 Intents</span></li>
            </ul>
          </div>

          {/* Col 4: Ecosystem */}
          <div className="space-y-3">
            <h4 className="font-semibold text-xs text-slate-900 dark:text-slate-100 tracking-tight uppercase font-mono">
              Ecosystem
            </h4>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400 font-medium">
              <li><a href="https://bitcoincash.org" target="_blank" rel="noreferrer" className="hover:text-slate-900 dark:hover:text-white">Bitcoin Cash L1</a></li>
              <li><a href="https://cashtokens.org" target="_blank" rel="noreferrer" className="hover:text-slate-900 dark:hover:text-white">CashTokens.org</a></li>
              <li><a href="https://cashscript.org" target="_blank" rel="noreferrer" className="hover:text-slate-900 dark:hover:text-white">CashScript.org</a></li>
              <li><a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-slate-900 dark:hover:text-white">GitHub Sources</a></li>
            </ul>
          </div>

          {/* Col 5: Legal & Security */}
          <div className="space-y-3">
            <h4 className="font-semibold text-xs text-slate-900 dark:text-slate-100 tracking-tight uppercase font-mono">
              Security
            </h4>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400 font-medium">
              <li><span className="text-emerald-500 font-bold">100% Non-Custodial</span></li>
              <li><span className="text-slate-600 dark:text-slate-400">Apache 2.0 Open Source</span></li>
              <li><span className="text-slate-600 dark:text-slate-400">Chipnet Audited</span></li>
            </ul>
          </div>
        </div>

        {/* GIANT WATERMARK DISPLAY */}
        <div className="relative pt-6 pb-2 select-none pointer-events-none flex items-center justify-center">
          <div className="w-full text-center">
            <span className="font-black text-[16vw] tracking-tighter uppercase leading-none font-mono block text-slate-900/[0.04] dark:text-white/[0.05] bg-gradient-to-b from-slate-900/[0.08] to-transparent dark:from-white/10 dark:to-transparent bg-clip-text text-transparent transform translate-y-3">
              MESH FINANCE
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
`;

writeFile('src/components/common/MeshFooter.tsx', meshFooter);

// --------------------------------------------------------------------------
// 7. Updated MeshWalletModal.tsx (With Real SVG Logos)
// --------------------------------------------------------------------------
const meshWalletModal = `import React from 'react';
import { useMeshApp } from '@/context/MeshAppContext';
import { CornerCrosshair } from '@/components/common/MeshWireframeBox';
import { MeshLogo } from '@/components/common/MeshLogo';
import { Wallet, ShieldCheck, CheckCircle2, X, ExternalLink, Zap } from 'lucide-react';

export function MeshWalletModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { connectWallet, walletConnected, walletAddress, disconnectWallet } = useMeshApp();

  if (!open) return null;

  const WALLETS = [
    {
      id: 'cham',
      name: 'Cham Wallet Extension',
      desc: 'Native CashTokens & Intent Swarm Web3 Extension',
      popular: true,
      logo: '/logos/cham-wallet.svg',
    },
    {
      id: 'cashonize',
      name: 'Cashonize Web Wallet',
      desc: 'Popular open-source web wallet for BCH & CashTokens',
      popular: false,
      logo: '/logos/wallets/cashonize.svg',
    },
    {
      id: 'paytaca',
      name: 'Paytaca Mobile',
      desc: 'Mobile-first BCH CashTokens wallet with WalletConnect',
      popular: false,
      logo: '/logos/wallets/paytaca.svg',
    },
    {
      id: 'demo',
      name: 'Interactive Chipnet Sandbox',
      desc: 'Pre-loaded 12.50 BCH & 45k pUSD simulation sandbox',
      popular: true,
      isDemo: true,
    },
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
            <MeshLogo size={32} showText={false} />
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
            {WALLETS.map(w => (
              <button
                key={w.id}
                onClick={() => { connectWallet(w.name); onClose(); }}
                className="w-full p-3 rounded-2xl border border-slate-300 dark:border-[#262e42] hover:border-slate-500 dark:hover:border-slate-500 bg-slate-50 dark:bg-[#1a2030] hover:bg-slate-100 dark:hover:bg-[#20273a] transition-all flex items-center justify-between group text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center overflow-hidden p-1.5">
                    {w.logo ? (
                      <img src={w.logo} alt={w.name} className="w-full h-full object-contain" />
                    ) : (
                      <MeshLogo size={20} showText={false} />
                    )}
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
            ))}
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

// --------------------------------------------------------------------------
// 8. index.html Updates (Favicon, Title, Metadata)
// --------------------------------------------------------------------------
const indexHtml = `<!DOCTYPE html>
<html lang="en" class="dark scroll-smooth">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/logo.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Mesh Finance — Sovereign UTXO DeFi Liquidity Protocol</title>
    <meta
      name="description"
      content="Mesh Finance (MF) is the sovereign discrete concentrated liquidity layer for Bitcoin Cash (CashTokens). Isolated covenant UTXOs, zero pool honeypots, and 1-sat atomic perpetual recycling."
    />
    <meta property="og:title" content="Mesh Finance — Sovereign UTXO DeFi Protocol" />
    <meta
      property="og:description"
      content="Isolated UTXO Covenants. Zero Honeypots. 100% Capital Ownership on Bitcoin Cash L1."
    />
    <meta property="og:image" content="/logo.svg" />
    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
  </head>
  <body class="antialiased selection:bg-emerald-500/30 selection:text-emerald-300 transition-colors duration-200">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

writeFile('index.html', indexHtml);

// --------------------------------------------------------------------------
// 9. vercel.json SPA Configuration
// --------------------------------------------------------------------------
const vercelJson = `{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
`;

writeFile('vercel.json', vercelJson);

console.log('✓ Stage 7 complete: MF Logo, TacticalBadge, MeshDocs, MeshHeader, MeshFooter, MeshWalletModal, index.html, vercel.json updated!');
