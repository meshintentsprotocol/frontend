import { useState } from 'react';
import { Header } from '@/components/common/Header';
import { Footer } from '@/components/common/Footer';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  ArrowRight,
  Globe,
  MessageCircle,
  ArrowLeftRight,
  Layers,
  X,
  ExternalLink,
  Zap,
  Shield,
  BarChart3,
  CheckCircle2,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface EcosystemCardData {
  id: string;
  title: string;
  tagline: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  accentColor: string;
  badgeColor: string;
  tag: string;
  status: 'live' | 'beta' | 'coming-soon';
  stats: { label: string; value: string }[];
  features: string[];
  links: { label: string; href: string; internal?: boolean; primary?: boolean }[];
  details: string;
}

// ─── Data ───────────────────────────────────────────────────────────────────────
const ecosystemCards: EcosystemCardData[] = [
  {
    id: 'swap',
    title: 'BCH Intents Swap',
    tagline: 'Trustless cross-chain swaps, no bridges needed.',
    description: 'Our flagship product. Trustless intent-based swaps combining CashTokens and cross-chain execution without bridges or wrapping.',
    icon: <ArrowLeftRight className="w-8 h-8 text-black" />,
    gradient: 'from-emerald-400 to-emerald-600',
    accentColor: 'emerald',
    badgeColor: 'bg-emerald-500/20 text-emerald-300',
    tag: 'Core Protocol',
    status: 'live',
    stats: [
      { label: 'Avg Settlement', value: '< 60s' },
      { label: 'Slippage', value: '0%' },
      { label: 'Custody', value: 'Non-custodial' },
    ],
    features: [
      'Intent-based execution with competitive solver market',
      'Native BCH ↔ CashToken swaps via HTLC',
      'Cross-chain BCH ↔ XMR scriptless atomic swaps',
      'No bridges, no wrapping, no counterparty risk',
      'Real-time solver competition for best price',
      'CashScript smart-contract secured settlements',
    ],
    details: 'BCH Intents Swap is the flagship DeFi primitive of the BCH Intents Protocol. Users express what they want to trade, and a decentralized solver network competes to fill orders at the best price. Every trade settles atomically on-chain — no trust required at any step.',
    links: [
      { label: 'Start Trading', href: '/trade', internal: true, primary: true },
      { label: 'View Explorer', href: '/explore', internal: true },
      { label: 'Protocol Docs', href: 'https://docs.intentsprotocol.xyz/' },
    ],
  },
  {
    id: 'telegram',
    title: 'Telegram Trading Bot',
    tagline: 'Execute intents directly from your chat.',
    description: 'Trade instantly from Telegram. Seamless intent execution on the go with zero web interface required.',
    icon: <MessageCircle className="w-8 h-8 text-black" />,
    gradient: 'from-cyan-400 to-cyan-600',
    accentColor: 'cyan',
    badgeColor: 'bg-cyan-500/20 text-cyan-300',
    tag: 'Integrations',
    status: 'live',
    stats: [
      { label: 'Commands', value: '12+' },
      { label: 'Response', value: '< 2s' },
      { label: 'Interface', value: 'Chat-native' },
    ],
    features: [
      'One-command swap execution from Telegram',
      'Real-time price quotes and trade status',
      'Portfolio balance view with /balance',
      'Transaction history and receipts in-chat',
      'No app installation required — pure messaging',
      'Works with any Telegram account instantly',
    ],
    details: 'The BCH Intents Telegram Bot brings the full power of the intent protocol to the world\'s most popular messaging platform. Submit swaps, check balances, and track your trades without leaving Telegram. A non-custodial experience designed for speed and convenience.',
    links: [
      { label: 'Launch Bot', href: 'https://t.me/bchintents_bot', primary: true },
      { label: 'Bot Commands', href: 'https://docs.intentsprotocol.xyz/telegram' },
    ],
  },
  {
    id: 'explorer',
    title: 'BCH Intents Explorer',
    tagline: 'Full transparency into every intent lifecycle.',
    description: 'Transparently verify cross-chain state. Track intents, solver competition, and atomic HTLC settlements in real-time.',
    icon: <Globe className="w-8 h-8 text-black" />,
    gradient: 'from-teal-400 to-teal-600',
    accentColor: 'teal',
    badgeColor: 'bg-teal-500/20 text-teal-300',
    tag: 'Infrastructure',
    status: 'live',
    stats: [
      { label: 'Intents Tracked', value: '100%' },
      { label: 'Latency', value: 'Real-time' },
      { label: 'Chains', value: 'Multi-chain' },
    ],
    features: [
      'Real-time intent lifecycle tracking',
      'Solver competition analytics and fill rates',
      'HTLC state machine visualization',
      'Cross-chain settlement verification',
      'Historical intent search and filtering',
      'Open blockchain verification — no login required',
    ],
    details: 'The BCH Intents Explorer provides complete, trustless transparency into every stage of the intent execution pipeline. Watch solver bids compete in real-time, verify HTLC state transitions, and confirm atomic settlements across chains. Your proof-of-execution, always on-chain.',
    links: [
      { label: 'Open Explorer', href: '/explore', internal: true, primary: true },
      { label: 'Explorer Docs', href: 'https://docs.intentsprotocol.xyz/explorer' },
    ],
  },
  {
    id: 'bchmesh',
    title: 'BCHMesh Protocol',
    tagline: 'Single-asset concentrated liquidity across every pair.',
    description: 'Non-custodial concentrated liquidity with 100% shared multi-route depth. One BCH deposit backs all trading pairs simultaneously.',
    icon: <Layers className="w-8 h-8 text-black" />,
    gradient: 'from-violet-400 to-purple-600',
    accentColor: 'violet',
    badgeColor: 'bg-violet-500/20 text-violet-300',
    tag: 'Liquidity Layer',
    status: 'beta',
    stats: [
      { label: 'Inventory Needed', value: 'Single asset' },
      { label: 'Liquidity Depth', value: 'N× multiplier' },
      { label: 'Rebalance Cost', value: 'Sub-cent' },
    ],
    features: [
      '100% of deposit available to ALL routes simultaneously',
      'ship() deploys across BCH→pUSD, BCH→mUSD, BCH→FUR at once',
      'Recycled liquidity with automated sub-cent rebalancing',
      'Concentrated range orders with CashScript settlement',
      'No paired token inventory required — pure BCH LP',
      'TWAP execution engine for large order smoothing',
    ],
    details: 'BCHMesh is the concentrated liquidity layer of the BCH Intents Protocol. Unlike traditional AMMs that split your deposit fractionally across routes, BCHMesh provides 100% of your BCH balance as deep liquidity to every configured pair simultaneously. Call ship() once to supply the entire network depth across all markets — with automated recycling and sub-cent rebalancing costs.',
    links: [
      { label: 'Explore BCHMesh', href: '/mesh', internal: true, primary: true },
      { label: 'LP Dashboard', href: '/mesh', internal: true },
      { label: 'BCHMesh Docs', href: 'https://docs.intentsprotocol.xyz/bchmesh' },
    ],
  },
  {
    id: 'cham-wallet',
    title: 'Cham Wallet',
    tagline: 'Multi-chain self-custody. One interface for every chain.',
    description: 'The official BCH Intents wallet — a self-custody app and browser extension for cross-chain swaps, native CashTokens, and automated yield across Bitcoin Cash, EVM, and Solana.',
    icon: <Wallet className="w-8 h-8 text-black" />,
    gradient: 'from-green-400 to-emerald-600',
    accentColor: 'emerald',
    badgeColor: 'bg-green-500/20 text-green-300',
    tag: 'Wallet',
    status: 'live',
    stats: [
      { label: 'Chains', value: 'Multi-chain' },
      { label: 'Custody', value: 'Self-custody' },
      { label: 'Platforms', value: 'Web & Extension' },
    ],
    features: [
      'Non-custodial multi-chain wallet for BCH, EVM & Solana',
      'Built-in cross-chain swaps via BCH Intents Protocol',
      'Native CashToken support with full UTXO control',
      'Browser extension for seamless dApp connectivity',
      'Chameleon-themed adaptive UI that shifts with your chain',
      'One-click portfolio overview across all connected chains',
    ],
    details: 'Cham Wallet is the official multi-chain wallet of the BCH Intents ecosystem. It provides a unified, self-custody interface for managing assets across Bitcoin Cash, EVM-compatible chains, and Solana. With built-in protocol-native swaps, CashToken management, and a browser extension for dApp connectivity, Cham Wallet is the single pane of glass for the intent-driven future of DeFi.',
    links: [
      { label: 'Open Cham Wallet', href: 'https://cham-wallet-web.vercel.app', primary: true },
      { label: 'Get Extension', href: 'https://cham-wallet-web.vercel.app', },
    ],
  },
];

// ─── Status Badge ───────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: EcosystemCardData['status'] }) {
  const map = {
    live: { label: 'Live', cls: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' },
    beta: { label: 'Beta', cls: 'bg-amber-500/20 text-amber-300 border border-amber-500/30' },
    'coming-soon': { label: 'Coming Soon', cls: 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30' },
  };
  const { label, cls } = map[status];
  return (
    <span className={cn('text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full', cls)}>
      {label}
    </span>
  );
}

// ─── Color maps ─────────────────────────────────────────────────────────────────
const accentCheckMap: Record<string, string> = {
  emerald: 'text-emerald-400',
  cyan: 'text-cyan-400',
  teal: 'text-teal-400',
  violet: 'text-violet-400',
  green: 'text-green-400',
};
const accentBtnPrimaryMap: Record<string, string> = {
  emerald: 'bg-emerald-500 hover:bg-emerald-400 text-black',
  cyan: 'bg-cyan-500 hover:bg-cyan-400 text-black',
  teal: 'bg-teal-500 hover:bg-teal-400 text-black',
  violet: 'bg-violet-500 hover:bg-violet-400 text-white',
  green: 'bg-green-500 hover:bg-green-400 text-black',
};
const accentBtnSecondaryMap: Record<string, string> = {
  emerald: 'border-emerald-500/30 hover:border-emerald-400/60 hover:bg-emerald-500/10 text-emerald-300',
  cyan: 'border-cyan-500/30 hover:border-cyan-400/60 hover:bg-cyan-500/10 text-cyan-300',
  teal: 'border-teal-500/30 hover:border-teal-400/60 hover:bg-teal-500/10 text-teal-300',
  violet: 'border-violet-500/30 hover:border-violet-400/60 hover:bg-violet-500/10 text-violet-300',
  green: 'border-green-500/30 hover:border-green-400/60 hover:bg-green-500/10 text-green-300',
};
const accentHoverGlowMap: Record<string, string> = {
  emerald: 'from-emerald-500/10',
  cyan: 'from-cyan-500/10',
  teal: 'from-teal-500/10',
  violet: 'from-violet-500/10',
  green: 'from-green-500/10',
};

// ─── Detail Popup Modal ─────────────────────────────────────────────────────────
function EcosystemDetailModal({ card, onClose }: { card: EcosystemCardData; onClose: () => void }) {
  const checkColor = accentCheckMap[card.accentColor] ?? 'text-emerald-400';
  const btnPrimary = accentBtnPrimaryMap[card.accentColor] ?? accentBtnPrimaryMap.emerald;
  const btnSecondary = accentBtnSecondaryMap[card.accentColor] ?? accentBtnSecondaryMap.emerald;

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        key="panel"
        initial={{ opacity: 0, scale: 0.94, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 24 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className="fixed inset-0 z-[210] flex items-center justify-center p-4 pointer-events-none"
      >
        <div
          className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#0c0c0f] border border-white/10 shadow-2xl pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top gradient accent bar */}
          <div className={cn('h-1 w-full rounded-t-3xl bg-gradient-to-r', card.gradient)} />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center transition-colors border border-white/10"
          >
            <X className="w-4 h-4 text-white/70" />
          </button>

          <div className="p-8 space-y-8">
            {/* Header */}
            <div className="flex items-start gap-5">
              <div className={cn('w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center flex-shrink-0 shadow-lg', card.gradient)}>
                {card.id === 'cham-wallet' ? (
                  <img src="/logos/wallets/cham-spiral.png" alt="Cham Wallet" className="w-10 h-10 object-contain" />
                ) : card.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', card.badgeColor)}>{card.tag}</span>
                  <StatusBadge status={card.status} />
                </div>
                <h2 className="text-2xl font-black tracking-tight text-white">{card.title}</h2>
                <p className={cn('text-sm font-medium mt-1', checkColor)}>{card.tagline}</p>
              </div>
            </div>

            {/* Detail paragraph */}
            <p className="text-zinc-300 leading-relaxed text-[15px]">{card.details}</p>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              {card.stats.map((s) => (
                <div key={s.label} className="rounded-2xl bg-white/4 border border-white/8 px-4 py-4 text-center">
                  <div className={cn('text-xl font-black', checkColor)}>{s.value}</div>
                  <div className="text-xs text-zinc-500 mt-1 font-medium">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Features */}
            <div>
              <h3 className="text-xs uppercase tracking-widest text-zinc-500 font-semibold mb-4 flex items-center gap-2">
                <Zap className="w-3 h-3" /> Key Features
              </h3>
              <ul className="space-y-2.5">
                {card.features.map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <CheckCircle2 className={cn('w-4 h-4 flex-shrink-0 mt-0.5', checkColor)} />
                    <span className="text-sm text-zinc-300">{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Trust note */}
            <div className="flex items-start gap-3 rounded-2xl bg-white/3 border border-white/8 p-4">
              <Shield className="w-4 h-4 text-zinc-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-zinc-500 leading-relaxed">
                All BCH Intents products are non-custodial. Smart contracts are open-source and auditable. Settlement is always on-chain and trustless.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-wrap gap-3 pt-1">
              {card.links.map((link) =>
                link.internal ? (
                  <Link key={link.label} to={link.href} onClick={onClose}>
                    <button className={cn('flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200', link.primary ? btnPrimary : cn('border', btnSecondary))}>
                      {link.label}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </Link>
                ) : (
                  <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer"
                    className={cn('flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200', link.primary ? btnPrimary : cn('border', btnSecondary))}>
                    {link.label}
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Ecosystem Card ─────────────────────────────────────────────────────────────
function EcosystemCard({ card, delay, onOpen }: { card: EcosystemCardData; delay: number; onOpen: () => void }) {
  const hoverGlow = accentHoverGlowMap[card.accentColor] ?? 'from-emerald-500/10';
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative group rounded-3xl overflow-hidden border border-white/10 bg-black/40 hover:bg-black/60 transition-colors flex flex-col cursor-pointer"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
    >
      <div className={cn('absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br to-transparent', hoverGlow)} />
      <div className="relative z-10 h-full flex flex-col items-center text-center p-8">
        {/* Badges */}
        <div className="flex items-center gap-2 mb-5 flex-wrap justify-center">
          <span className={cn('text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-widest', card.badgeColor)}>{card.tag}</span>
          <StatusBadge status={card.status} />
        </div>
        {/* Icon */}
        <div className={cn('w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center mb-5 shadow-lg', card.gradient)}>
          {card.id === 'cham-wallet' ? (
            <img src="/logos/wallets/cham-spiral.png" alt="Cham Wallet" className="w-10 h-10 object-contain" />
          ) : card.icon}
        </div>
        <h3 className="text-2xl font-bold mb-3">{card.title}</h3>
        <p className="text-muted-foreground text-base mb-6 flex-1">{card.description}</p>
        {/* Stats pills */}
        <div className="flex flex-wrap gap-2 justify-center mb-7">
          {card.stats.map((s) => (
            <span key={s.label} className="text-[11px] px-3 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-400 font-medium">
              <span className="text-white font-semibold">{s.value}</span> {s.label}
            </span>
          ))}
        </div>
        {/* View details hint */}
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-500 group-hover:text-white transition-colors">
          <BarChart3 className="w-4 h-4" />
          View details
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────
export default function EcosystemPage() {
  const [activeCard, setActiveCard] = useState<EcosystemCardData | null>(null);

  return (
    <div className="min-h-screen flex flex-col bg-[#050505] selection:bg-primary/30 text-foreground">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative pt-28 pb-12 overflow-hidden">
          <div className="absolute inset-0 bg-[#050505] z-0" />
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
            <div className="absolute top-[10%] left-[10%] w-[35vw] h-[35vw] bg-primary/10 rounded-full blur-[130px] animate-pulse-glow" />
            <div className="absolute top-[20%] right-[10%] w-[25vw] h-[25vw] bg-violet-500/8 rounded-full blur-[100px]" />
            <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-20 mix-blend-overlay" />
          </div>
          <div className="container mx-auto px-4 relative z-10 text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="max-w-3xl mx-auto space-y-6">
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
                className="inline-block text-xs font-semibold uppercase tracking-widest px-4 py-2 rounded-full bg-white/5 border border-white/10 text-zinc-400 mb-2"
              >
                5 products · 1 unified protocol
              </motion.span>
              <h1 className="text-5xl md:text-7xl font-black tracking-tighter">
                The BCH Intents{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-emerald-400 to-violet-400">Ecosystem</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                A suite of powerful, non-custodial tools built on the BCH Intents Protocol — from trustless swaps to concentrated liquidity and beyond.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Cards Grid */}
        <section className="relative py-12 md:py-20 overflow-hidden">
          <div className="absolute inset-0 bg-zinc-950 grainy" />
          <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-violet-500/5 rounded-full blur-[120px] translate-x-1/4 translate-y-1/4" />
          <div className="container mx-auto px-4 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {ecosystemCards.map((card, i) => (
                <EcosystemCard key={card.id} card={card} delay={0.1 + i * 0.1} onOpen={() => setActiveCard(card)} />
              ))}
            </div>
          </div>
        </section>

        {/* Protocol banner */}
        <section className="relative py-16 overflow-hidden border-t border-white/5">
          <div className="container mx-auto px-4 text-center max-w-3xl relative z-10">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-black tracking-tight">
                One protocol.{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-violet-400">Infinite composability.</span>
              </h2>
              <p className="text-zinc-400 text-lg">
                Every product in the ecosystem shares the same trustless settlement layer, solver network, and on-chain contract infrastructure.
              </p>
              <div className="flex items-center justify-center gap-4 flex-wrap">
                <Button asChild className="rounded-full gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold">
                  <Link to="/trade">Launch App <ArrowRight className="w-4 h-4" /></Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full gap-2 border-white/15 hover:bg-white/5">
                  <a href="https://docs.intentsprotocol.xyz/" target="_blank" rel="noopener noreferrer">
                    Read Docs <ExternalLink className="w-4 h-4" />
                  </a>
                </Button>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />

      {/* Detail modal — rendered outside main layout flow */}
      {activeCard && (
        <EcosystemDetailModal card={activeCard} onClose={() => setActiveCard(null)} />
      )}
    </div>
  );
}
