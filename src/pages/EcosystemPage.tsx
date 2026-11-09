import { useState } from 'react';
import { Header } from '@/components/common/Header';
import { Footer } from '@/components/common/Footer';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  ArrowRight,
  ArrowLeft,
  ArrowLeftRight,
  Globe,
  MessageCircle,
  Layers,
  Wallet,
  ExternalLink,
  CheckCircle2,
  Zap,
  Sparkles,
  Cpu,
  Lock,
  ChevronRight,
  Boxes,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link, useParams, useNavigate } from 'react-router-dom';

// ─── Types & Product Data ──────────────────────────────────────────────────────

interface Product {
  id: string;
  badge: string;
  title: string;
  tagline: string;
  desc: string;
  color: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  status: 'Live' | 'Beta' | 'Coming Soon';
  stats: { label: string; value: string; hint?: string }[];
  features: { title: string; desc: string }[];
  architecture: {
    headline: string;
    paragraphs: string[];
    technicalPoints: string[];
  };
  security: string;
  links: { label: string; href: string; internal?: boolean; primary?: boolean }[];
}

const products: Product[] = [
  {
    id: 'swap',
    badge: 'Core Protocol',
    title: 'BCH Intents Swap',
    tagline: 'Trustless intent-based cross-chain swaps without bridges.',
    desc: 'The flagship protocol engine. Users state what they want to trade, and competitive solver networks settle orders atomically on-chain with zero counterparty risk.',
    color: '#2be64d',
    icon: ArrowLeftRight,
    status: 'Live',
    stats: [
      { label: 'Avg Settlement', value: '< 60s', hint: 'Atomic mempool resolution' },
      { label: 'Curve Slippage', value: '0%', hint: 'Fixed Dutch auction clearing' },
      { label: 'Custody Model', value: '100% Non-Custodial', hint: 'User retains UTXO control' },
      { label: 'Token Standard', value: 'CashTokens CHIP', hint: 'Native UTXO token standard' },
    ],
    features: [
      { title: 'Decentralized Solver Competition', desc: 'Solvers compete off-chain to offer the best settlement price, eliminating front-running and sandwich attacks.' },
      { title: 'Scriptless Atomic Cross-Chain', desc: 'Exchange BCH directly with Monero (XMR) and EVM tokens using Schnorr adaptor signatures and zero-knowledge DLEQ proofs.' },
      { title: '1-Line Covenant Monetization', desc: 'Frontends and wallets earn protocol fees enforced via CashScript covenants in Output 2 with zero backend tracking.' },
      { title: 'Anti-MEV Dutch Auctions', desc: 'Orders predictably decay over time, preventing extractive validator bribes and protecting user trade surplus.' },
    ],
    architecture: {
      headline: 'Stateless UTXO Execution with CashScript Covenants',
      paragraphs: [
        'BCH Intents Swap completely replaces the conventional AMM pooled-token model with declarative intent states. Instead of depositing capital into vulnerable liquidity pools, users sign an off-chain limit order specifying their minimum acceptable payout.',
        'Solvers monitor Nostr relay streams and construct an atomic transaction combining the user UTXO with matching market maker reserves. The trade settles on the Bitcoin Cash mainnet only if the user receives their exact requested tokens.',
      ],
      technicalPoints: [
        'CashScript v0.10+ contract specifications with opcode introspections',
        'CHIP-2021-02 native CashTokens compatibility for fungible and NFT assets',
        'Output 2 developer treasury fee enforcement guaranteed by consensus',
        'Zero wrapped tokens, zero centralized bridges, zero custodial intermediaries',
      ],
    },
    security: 'All swap transactions settle through stateless CashScript covenants verified directly by Bitcoin Cash miners. Funds never touch a centralized server or pooled multisig.',
    links: [
      { label: 'Launch Swap Interface', href: '/trade', internal: true, primary: true },
      { label: 'Explore Live Orders', href: '/explore', internal: true },
      { label: 'Protocol GitBook Docs', href: 'https://docs.intentsprotocol.xyz/' },
    ],
  },
  {
    id: 'bchmesh',
    badge: 'Liquidity Layer',
    title: 'BCHMesh Protocol',
    tagline: 'Single-asset concentrated liquidity across every market simultaneously.',
    desc: 'Discrete Liquidity Market Making (DLMM) on Bitcoin Cash. A single pure BCH deposit quotes depth across up to 3 token pairs at once with sub-cent rebalancing costs.',
    color: '#a855f7',
    icon: Layers,
    status: 'Beta',
    stats: [
      { label: 'Deposit Model', value: 'Single Asset', hint: 'Pure BCH backing' },
      { label: 'Depth Multiplier', value: 'N× Virtual Depth', hint: '100% shared across pairs' },
      { label: 'Rebalance Cost', value: '< $0.01', hint: '~430 bytes on L1' },
      { label: 'Position Custody', value: 'CashToken NFT', hint: 'Sovereign transferable ownership' },
    ],
    features: [
      { title: 'Multi-Market ship() Calls', desc: 'Deploy 100% of your BCH deposit across BCH/pUSD, BCH/mUSD, and BCH/FUR simultaneously without splitting inventory.' },
      { title: 'Discrete Price Bins (DLMM)', desc: 'Zero curve slippage within active bins. Each filled rung captures spread revenue before recycling into counter-orders.' },
      { title: 'Sub-Cent L1 Rebalances', desc: 'Re-center stale price rungs for ~$0.008 per atomic batch, unlocking high-frequency grid market making on L1.' },
      { title: 'Sovereign NFT Position Keys', desc: 'Hold an unforgeable CashToken NFT in your wallet that gives you exclusive authority to withdraw or modify grid parameters.' },
    ],
    architecture: {
      headline: 'Proceeds-Separation Pools & Autonomous Recycling',
      paragraphs: [
        'Traditional Automated Market Makers force liquidity providers to hold a 50/50 paired token inventory that suffers from impermanent loss and fractured depth. BCHMesh resolves this via V4 Discrete Bins and V3 Proceeds-Separation covenants.',
        'Market makers deposit pure BCH into covenant UTXOs. When a trade occurs, the incoming CashTokens are separated into dedicated proceeds outputs while the core BCH reserve re-quotes other trading pairs instantly without waiting for re-centering.',
      ],
      technicalPoints: [
        'V4 Discrete Liquidity Market Maker (DLMM) bin architecture with zero intra-bin slippage',
        'V3 proceeds-separation covenant contracts with multi-token simultaneous pricing',
        'CashToken NFT commitment encoding grid state, strike bounds, and fee tier',
        'Flat $0.008 network fees versus $50+ gas spikes on Ethereum/Arbitrum AMMs',
      ],
    },
    security: 'Positions are strictly non-custodial. Only the wallet holding the position NFT can close bins or withdraw accumulated trading proceeds.',
    links: [
      { label: 'Explore Mesh Landing', href: '/mesh-landing', internal: true, primary: true },
      { label: 'Manage Pools & Positions', href: '/mesh', internal: true },
      { label: 'Mesh Protocol Specifications', href: 'https://docs.intentsprotocol.xyz/bchmesh' },
    ],
  },
  {
    id: 'cham-wallet',
    badge: 'Wallet & Local AI',
    title: 'Cham Wallet',
    desc: 'Self-custodial multi-chain mobile app, browser extension, and web client. Features on-device QVAC Local AI (Qwen3 1.7B) for Airplane Mode offline trading.',
    tagline: '100% on-device AI financial architect. One seed phrase, all networks.',
    color: '#06b6d4',
    icon: Wallet,
    status: 'Live',
    stats: [
      { label: 'Local AI Engine', value: '100% On-Device', hint: 'Tether QVAC × Qwen3 1.7B' },
      { label: 'Custody Framework', value: 'Tether WDK', hint: 'Self-custodial non-custodial' },
      { label: 'Supported Chains', value: '16 Networks', hint: 'BCH, Solana, EVM & more' },
      { label: 'Platforms', value: 'APK · Ext · Web', hint: 'Android, Chromium & Web App' },
    ],
    features: [
      { title: 'Airplane Mode Offline Trading', desc: 'Simulate liquidity grids, model cross-chain arbitrage, and queue swap intents at 35,000 ft with zero internet connectivity.' },
      { title: 'CashTokens UTXO Inspection', desc: 'Native support for CashToken commitments, metadata parsing via BCMR, and NFT minting/transfer inspection.' },
      { title: 'Direct Android APK Build', desc: 'Standalone mobile release with native biometric hardware protection and local encrypted keystore.' },
      { title: 'Chromium Browser Extension', desc: 'Manifest V3 extension for Chrome, Brave, and Edge with hardware wallet support and DApp connection APIs.' },
    ],
    architecture: {
      headline: 'Local AI Architect Integrated with Tether WDK',
      paragraphs: [
        'Cham Wallet bridges high-performance DeFi with private local intelligence. By embedding a quantized 1.7B parameter LLM on-device via Tether QVAC, the wallet can analyze market depth, suggest optimal DLMM bin spreads, and audit contract bytecode locally.',
        'Multi-chain accounts are derived deterministically from a single master seed using the Tether Wallet Development Kit (WDK), enabling synchronized asset management across Bitcoin Cash, Ethereum, Arbitrum, and Solana.',
      ],
      technicalPoints: [
        'On-device neural inference with zero cloud telemetry or private key leaks',
        'Deterministic BIP-44 key derivation across BCH, EVM (secp256k1) and Solana (ed25519)',
        'BCMR (Bitcoin Cash Metadata Registry) automated registry lookups',
        'Offline intent batching with instant mempool broadcast on network reconnection',
      ],
    },
    security: 'Private keys never leave your device. The embedded AI runs strictly in a local sandbox with zero network telemetry or tracking.',
    links: [
      { label: 'Download Android APK (Direct)', href: 'https://expo.dev/artifacts/eas/wHYSIbjjZ3l9FerNSQk5oCxkBVeyjWrWVaq00aA4o8M.apk', primary: true },
      { label: 'Open Cham Wallet Web', href: 'https://cham-wallet-web.vercel.app' },
      { label: 'Download Browser Extension', href: 'https://cham-wallet-web.vercel.app/downloads/cham-wallet-extension.zip' },
    ],
  },
  {
    id: 'telegram',
    badge: 'Integrations',
    title: 'Telegram Trading Bot',
    tagline: 'Instant non-custodial intent trading right inside your messaging chat.',
    desc: 'Submit swaps, track balances, and receive real-time execution receipts directly from Telegram with zero web interface or app installation required.',
    color: '#fbbf24',
    icon: MessageCircle,
    status: 'Live',
    stats: [
      { label: 'Bot Commands', value: '12+ Native', hint: 'Swap, balance, history, alerts' },
      { label: 'Quoting Latency', value: '< 2s', hint: 'Instant RFQ pricing stream' },
      { label: 'UX Friction', value: 'Zero Install', hint: 'Works in any Telegram client' },
      { label: 'Security', value: 'Non-Custodial', hint: 'Interactive signing prompts' },
    ],
    features: [
      { title: 'One-Command Dutch Auction Swaps', desc: 'Submit buy/sell intents by typing simple chat commands with custom slippage and expiration parameters.' },
      { title: 'Multi-Token Portfolio Overview', desc: 'Check your BCH and CashToken token balances in seconds using /balance without switching apps.' },
      { title: 'Live Fill Notifications', desc: 'Receive instant alerts with transaction hash links the moment a decentralized solver fills your intent.' },
      { title: 'Encrypted Nostr Relaying', desc: 'Transmits signed intents securely to public Nostr relays for solver discovery and competitive settlement.' },
    ],
    architecture: {
      headline: 'Chat-Native Decentralized Order Discovery',
      paragraphs: [
        'The Telegram Trading Bot acts as a conversational gateway to the BCH Intents relayer infrastructure. Users interact through intuitive chat dialogues to configure swap parameters and verify order conditions.',
        'Once confirmed, the bot broadcasts the encrypted intent to the decentralized solver network. Traders can inspect transaction settlement directly on the public Bitcoin Cash blockchain with absolute transparency.',
      ],
      technicalPoints: [
        'Serverless webhook routing with sub-second response times',
        'Direct connection to Nostr intent relays (NIP-01 and NIP-42)',
        'Automatic gas fee calculation and Dutch auction decay scheduling',
        'Session security with optional two-factor chat verification',
      ],
    },
    security: 'The bot cannot withdraw or seize user assets. All trades execute strictly via signed on-chain covenant conditions verified by miners.',
    links: [
      { label: 'Launch Telegram Bot', href: 'https://t.me/bchintents_bot', primary: true },
      { label: 'Read Bot Documentation', href: 'https://docs.intentsprotocol.xyz/telegram' },
    ],
  },
  {
    id: 'explorer',
    badge: 'Infrastructure',
    title: 'BCH Intents Explorer',
    tagline: 'Real-time telemetry and verification across the intent lifecycle.',
    desc: 'Public analytics and state inspection engine. Track live Dutch auction decay, monitor solver bidding wars, and verify atomic HTLC settlements across chains.',
    color: '#3b82f6',
    icon: Globe,
    status: 'Live',
    stats: [
      { label: 'Intent Coverage', value: '100% On-Chain', hint: 'Every discovered intent' },
      { label: 'Telemetry Stream', value: 'Real-Time', hint: 'Sub-second mempool events' },
      { label: 'Cross-Chain Support', value: 'Multi-Chain', hint: 'BCH, XMR, EVM, Solana' },
      { label: 'Authentication', value: 'Open Access', hint: 'No account or login required' },
    ],
    features: [
      { title: 'Live Dutch Auction Visualizer', desc: 'Watch intent prices decay in real-time as solvers compete to capture arbitrage surplus at optimal clearance.' },
      { title: 'Solver Leaderboard & Analytics', desc: 'Analyze solver win rates, volume handled, settlement speeds, and MEV-protection telemetry.' },
      { title: 'HTLC State Machine Inspector', desc: 'Verify secret preimages, locktime expirations, and scriptless Schnorr adaptor states for cross-chain trades.' },
      { title: 'Full Token BCMR Registry', desc: 'Browse CashTokens with verified verified metadata, token supply, icon assets, and contract bytecode.' },
    ],
    architecture: {
      headline: 'Real-Time Mempool Indexing with ZMQ & Nostr Relays',
      paragraphs: [
        'The BCH Intents Explorer operates a high-availability indexing cluster connected directly to Bitcoin Cash full nodes via ZeroMQ and public Nostr relays.',
        'It continuously decodes covenant script outputs, extracts fee parameters, and reconstructs the multi-step lifecycle of every trade from publication to final block confirmation.',
      ],
      technicalPoints: [
        'Sub-second ZeroMQ transaction ingestion from BCHN and Fulcrum nodes',
        'Interactive Dutch auction price decay curves with real-time WebSocket feeds',
        'Detailed transaction output dissection with CashScript AST disassembly',
        'Open REST and GraphQL endpoints for ecosystem developers and quant funds',
      ],
    },
    security: 'Read-only, completely open data. No personal data, IP tracking, or user telemetry is stored.',
    links: [
      { label: 'Open Live Explorer', href: '/explore', internal: true, primary: true },
      { label: 'Telemetry API Documentation', href: 'https://docs.intentsprotocol.xyz/explorer' },
    ],
  },
];

// ─── Status badge styling ──────────────────────────────────────────────────────

const statusStyles: Record<string, string> = {
  Live: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  Beta: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  'Coming Soon': 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30',
};

// ─── Product Display Page Component (when a card is clicked) ──────────────────

function ProductDisplayPage({
  product,
  onBack,
}: {
  product: Product;
  onBack: () => void;
  onSelectProduct?: (p: Product) => void;
}) {
  const Icon = product.icon;

  return (
    <div className="relative pt-28 pb-24">
      {/* Background with ambient glows matching hero */}
      <div className="absolute inset-0 bg-[#050505] -z-10" />
      <div className="absolute inset-0 pointer-events-none -z-10 overflow-hidden">
        <div
          className="absolute top-[5%] left-[15%] w-[45vw] h-[45vw] rounded-full blur-[160px] opacity-15"
          style={{ backgroundColor: product.color }}
        />
        <div className="absolute top-[25%] right-[10%] w-[35vw] h-[35vw] rounded-full blur-[170px] bg-violet-500/8" />
        <div className="absolute bottom-[10%] left-[30%] w-[40vw] h-[40vw] rounded-full blur-[190px] bg-cyan-500/6" />
        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-15 mix-blend-overlay" />
      </div>

      <div className="container mx-auto px-4 max-w-6xl">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between mb-10 pb-4 border-b border-white/10">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-sm font-semibold text-zinc-300 hover:text-white transition-all group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            All Ecosystem Products
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-zinc-500 hidden sm:inline">Ecosystem</span>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-600 hidden sm:inline" />
            <span className="text-xs font-bold text-white">{product.title}</span>
          </div>
        </div>

        {/* ─── Hero Section ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="rounded-3xl p-8 sm:p-12 border border-white/10 bg-[#0d0f14]/80 backdrop-blur-xl relative overflow-hidden mb-12 shadow-2xl"
        >
          {/* Accent top gradient bar */}
          <div
            className="absolute top-0 left-0 right-0 h-1.5"
            style={{ backgroundColor: product.color }}
          />

          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
            <div className="space-y-5 max-w-2xl">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-black/60 text-white border border-white/10">
                  {product.badge}
                </span>
                <span className={cn('text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full', statusStyles[product.status])}>
                  {product.status}
                </span>
              </div>

              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center shrink-0 shadow-lg"
                  style={{ backgroundColor: product.color }}
                >
                  {product.id === 'cham-wallet' ? (
                    <img src="/logos/wallets/cham-spiral.png" alt="Cham" className="w-10 h-10 object-contain" />
                  ) : (
                    <Icon className="w-9 h-9" style={{ color: '#000' }} />
                  )}
                </div>
                <div>
                  <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
                    {product.title}
                  </h1>
                  <p className="text-sm sm:text-base font-semibold mt-1" style={{ color: product.color }}>
                    {product.tagline}
                  </p>
                </div>
              </div>

              <p className="text-zinc-300 text-base sm:text-lg leading-relaxed font-normal">
                {product.desc}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3.5 pt-2">
                {product.links.map((link) => {
                  const isPrimary = link.primary;
                  return link.internal ? (
                    <Link key={link.label} to={link.href}>
                      <Button
                        size="lg"
                        className={cn(
                          'h-12 sm:h-14 px-6 sm:px-8 rounded-full font-bold text-sm sm:text-base shadow-lg transition-transform hover:scale-[1.02]',
                          isPrimary
                            ? 'text-black hover:opacity-90'
                            : 'border border-white/20 bg-white/5 hover:bg-white/10 text-white',
                        )}
                        style={isPrimary ? { backgroundColor: product.color } : {}}
                      >
                        {link.label}
                        <ArrowRight className="ml-2 w-4 h-4" />
                      </Button>
                    </Link>
                  ) : (
                    <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer">
                      <Button
                        size="lg"
                        className={cn(
                          'h-12 sm:h-14 px-6 sm:px-8 rounded-full font-bold text-sm sm:text-base shadow-lg transition-transform hover:scale-[1.02]',
                          isPrimary
                            ? 'text-black hover:opacity-90'
                            : 'border border-white/20 bg-white/5 hover:bg-white/10 text-white',
                        )}
                        style={isPrimary ? { backgroundColor: product.color } : {}}
                      >
                        {link.label}
                        <ExternalLink className="ml-2 w-4 h-4" />
                      </Button>
                    </a>
                  );
                })}
              </div>
            </div>

            {/* Quick Summary Pill Box */}
            <div className="w-full lg:w-72 rounded-2xl bg-black/40 border border-white/10 p-5 space-y-3.5">
              <div className="text-xs uppercase tracking-widest text-zinc-500 font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-zinc-400" /> Protocol Highlights
              </div>
              <div className="space-y-2.5 text-xs text-zinc-300">
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <span className="text-zinc-500">Security</span>
                  <span className="font-semibold text-white">Non-Custodial</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <span className="text-zinc-500">Network</span>
                  <span className="font-semibold text-white">Bitcoin Cash L1</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <span className="text-zinc-500">Smart Contract</span>
                  <span className="font-semibold text-white">CashScript</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Access</span>
                  <span className="font-semibold text-white">Permissionless</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ─── Key Metrics Grid ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-14">
          {product.stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="p-6 rounded-3xl bg-[#131418] border border-white/10 flex flex-col justify-between"
            >
              <div>
                <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold block mb-2">
                  {stat.label}
                </span>
                <div className="text-2xl sm:text-3xl font-black text-white" style={{ color: product.color }}>
                  {stat.value}
                </div>
              </div>
              {stat.hint && (
                <div className="text-[11px] text-zinc-500 mt-2 font-mono">
                  {stat.hint}
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* ─── Architecture & Mechanics ─────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-14">
          <div className="lg:col-span-7 rounded-3xl p-8 sm:p-10 bg-[#131418] border border-white/10 space-y-5">
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <Cpu className="w-4 h-4" style={{ color: product.color }} />
              Architecture & Mechanics
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {product.architecture.headline}
            </h2>
            {product.architecture.paragraphs.map((p, idx) => (
              <p key={idx} className="text-zinc-300 text-sm sm:text-base leading-relaxed">
                {p}
              </p>
            ))}

            <div className="pt-4 border-t border-white/5 space-y-2.5">
              <div className="text-xs uppercase tracking-widest text-zinc-500 font-bold mb-3">
                Technical Specifications
              </div>
              {product.architecture.technicalPoints.map((pt, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-zinc-300">
                  <div
                    className="w-1.5 h-1.5 rounded-full mt-2 shrink-0"
                    style={{ backgroundColor: product.color }}
                  />
                  <span>{pt}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Features Column */}
          <div className="lg:col-span-5 rounded-3xl p-8 sm:p-10 bg-[#131418] border border-white/10 space-y-5">
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <Zap className="w-4 h-4" style={{ color: product.color }} />
              Core Capabilities
            </span>
            <h3 className="text-2xl font-bold text-white">
              Why it matters
            </h3>

            <div className="space-y-4 pt-2">
              {product.features.map((feat) => (
                <div
                  key={feat.title}
                  className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/15 transition-all space-y-1.5"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: product.color }} />
                    <h4 className="font-bold text-sm text-white">{feat.title}</h4>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed pl-6">
                    {feat.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Ecosystem Page ───────────────────────────────────────────────────────

export default function EcosystemPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  // Find active product if URL matches, e.g. /ecosystem/swap
  const activeProduct = id ? products.find((p) => p.id === id) : null;
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  const handleSelectProduct = (product: Product) => {
    navigate(`/ecosystem/${product.id}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToAll = () => {
    navigate('/ecosystem');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#050505] selection:bg-primary/30 text-foreground">
      <Header />

      <main className="flex-1">
        {activeProduct ? (
          /* Dedicated Ecosystem Product Display Page */
          <ProductDisplayPage
            product={activeProduct}
            onBack={handleBackToAll}
            onSelectProduct={handleSelectProduct}
          />
        ) : (
          /* Main Ecosystem Overview View */
          <>
            {/* ─── Hero Section with Ambient Glows ───────────────────── */}
            <section className="relative pt-32 pb-16 overflow-hidden">
              <div className="absolute inset-0 bg-[#050505]" />
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[10%] left-[10%] w-[35vw] h-[35vw] bg-emerald-500/8 rounded-full blur-[140px]" />
                <div className="absolute top-[20%] right-[10%] w-[25vw] h-[25vw] bg-violet-500/6 rounded-full blur-[120px]" />
                <div className="absolute bottom-[5%] left-[30%] w-[30vw] h-[30vw] bg-cyan-500/6 rounded-full blur-[130px]" />
                <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-15 mix-blend-overlay" />
              </div>

              <div className="container mx-auto px-4 relative z-10 text-center max-w-4xl">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8 }}
                  className="space-y-6"
                >
                  <span className="inline-block text-xs font-semibold uppercase tracking-widest px-4 py-2 rounded-full bg-white/5 border border-white/10 text-zinc-400">
                    5 products · 1 unified protocol
                  </span>

                  <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.05]">
                    The BCH Intents{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-emerald-400 to-violet-400">
                      Ecosystem
                    </span>
                  </h1>

                  <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
                    A suite of non-custodial tools built on the BCH Intents Protocol — from trustless swaps to concentrated liquidity and beyond.
                  </p>
                </motion.div>
              </div>
            </section>

            {/* ─── Products Grid (No sliders, vertical on small screens, ambient background) ─── */}
            <section className="relative py-12 md:py-20 overflow-hidden">
              {/* Cohesive Ambient Background matching top section */}
              <div className="absolute inset-0 bg-[#050505] -z-10" />
              <div className="absolute inset-0 pointer-events-none -z-10 overflow-hidden">
                <div className="absolute top-[5%] left-[20%] w-[45vw] h-[45vw] bg-emerald-500/6 rounded-full blur-[160px]" />
                <div className="absolute top-[40%] right-[15%] w-[40vw] h-[40vw] bg-violet-500/6 rounded-full blur-[170px]" />
                <div className="absolute bottom-[10%] left-[25%] w-[35vw] h-[35vw] bg-cyan-500/6 rounded-full blur-[160px]" />
                <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-15 mix-blend-overlay" />
              </div>

              <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
                {/* Responsive Grid: Vertical on small screens, 3 top + 2 bottom on desktop */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-5">
                  {products.slice(0, 3).map((product, i) => {
                    const isHovered = hoveredCard === i;
                    const Icon = product.icon;
                    return (
                      <motion.div
                        key={product.id}
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.08 }}
                        onMouseEnter={() => setHoveredCard(i)}
                        onMouseLeave={() => setHoveredCard(null)}
                        onClick={() => handleSelectProduct(product)}
                        className="relative rounded-3xl h-[400px] sm:h-[420px] flex flex-col justify-between p-7 sm:p-8 border border-white/10 cursor-pointer overflow-hidden transition-colors duration-500 shadow-xl"
                        style={{ backgroundColor: isHovered ? product.color : '#131418' }}
                      >
                        <div>
                          {/* Badge row */}
                          <div className="flex items-center gap-2 mb-6">
                            <span
                              className="inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider transition-colors duration-500"
                              style={{
                                backgroundColor: isHovered ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.06)',
                                color: isHovered ? '#000' : '#fff',
                              }}
                            >
                              {product.badge}
                            </span>
                            <span
                              className={cn(
                                'text-[10px] font-semibold uppercase tracking-widest px-2.5 py-0.5 rounded-full transition-colors duration-500',
                                isHovered ? 'bg-black/15 text-black/70' : statusStyles[product.status],
                              )}
                            >
                              {product.status}
                            </span>
                          </div>

                          {/* Icon */}
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-colors duration-500"
                            style={{ backgroundColor: isHovered ? 'rgba(0,0,0,0.15)' : `${product.color}15` }}
                          >
                            {product.id === 'cham-wallet' ? (
                              <img src="/logos/wallets/cham-spiral.png" alt="Cham" className="w-7 h-7 object-contain" />
                            ) : (
                              <Icon className="w-6 h-6 transition-colors duration-500" style={{ color: isHovered ? '#000' : product.color }} />
                            )}
                          </div>

                          <h3
                            className="text-2xl font-bold mb-3 transition-colors duration-500 leading-snug"
                            style={{ color: isHovered ? '#000' : '#fff' }}
                          >
                            {product.title}
                          </h3>
                          <p
                            className="text-sm sm:text-base leading-relaxed transition-colors duration-500"
                            style={{ color: isHovered ? 'rgba(0,0,0,0.75)' : 'rgba(161,161,170,1)' }}
                          >
                            {product.desc}
                          </p>
                        </div>

                        {/* Bottom CTA Button (1inch style) */}
                        <div className="pt-6">
                          <button
                            type="button"
                            className="px-6 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all duration-300"
                            style={{
                              backgroundColor: isHovered ? '#000' : 'rgba(255,255,255,0.08)',
                              color: '#fff',
                              border: isHovered ? 'none' : '1px solid rgba(255,255,255,0.1)',
                            }}
                          >
                            View details →
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Bottom Row of 2 Cards (Centered on large screens, vertical on mobile) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-5xl mx-auto">
                  {products.slice(3).map((product, i) => {
                    const idx = i + 3;
                    const isHovered = hoveredCard === idx;
                    const Icon = product.icon;
                    return (
                      <motion.div
                        key={product.id}
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.15 + i * 0.08 }}
                        onMouseEnter={() => setHoveredCard(idx)}
                        onMouseLeave={() => setHoveredCard(null)}
                        onClick={() => handleSelectProduct(product)}
                        className="relative rounded-3xl h-[400px] sm:h-[420px] flex flex-col justify-between p-7 sm:p-8 border border-white/10 cursor-pointer overflow-hidden transition-colors duration-500 shadow-xl"
                        style={{ backgroundColor: isHovered ? product.color : '#131418' }}
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-6">
                            <span
                              className="inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider transition-colors duration-500"
                              style={{
                                backgroundColor: isHovered ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.06)',
                                color: isHovered ? '#000' : '#fff',
                              }}
                            >
                              {product.badge}
                            </span>
                            <span
                              className={cn(
                                'text-[10px] font-semibold uppercase tracking-widest px-2.5 py-0.5 rounded-full transition-colors duration-500',
                                isHovered ? 'bg-black/15 text-black/70' : statusStyles[product.status],
                              )}
                            >
                              {product.status}
                            </span>
                          </div>

                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-colors duration-500"
                            style={{ backgroundColor: isHovered ? 'rgba(0,0,0,0.15)' : `${product.color}15` }}
                          >
                            <Icon className="w-6 h-6 transition-colors duration-500" style={{ color: isHovered ? '#000' : product.color }} />
                          </div>

                          <h3
                            className="text-2xl font-bold mb-3 transition-colors duration-500 leading-snug"
                            style={{ color: isHovered ? '#000' : '#fff' }}
                          >
                            {product.title}
                          </h3>
                          <p
                            className="text-sm sm:text-base leading-relaxed transition-colors duration-500"
                            style={{ color: isHovered ? 'rgba(0,0,0,0.75)' : 'rgba(161,161,170,1)' }}
                          >
                            {product.desc}
                          </p>
                        </div>

                        <div className="pt-6">
                          <button
                            type="button"
                            className="px-6 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all duration-300"
                            style={{
                              backgroundColor: isHovered ? '#000' : 'rgba(255,255,255,0.08)',
                              color: '#fff',
                              border: isHovered ? 'none' : '1px solid rgba(255,255,255,0.1)',
                            }}
                          >
                            View details →
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* ─── Protocol Banner ───────────────────────────────────── */}
            <section className="relative py-24 border-t border-white/5">
              <div className="container mx-auto px-4 text-center max-w-3xl relative z-10">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="space-y-6"
                >
                  <h2 className="text-3xl md:text-5xl font-black tracking-tight">
                    One protocol.{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-violet-400">
                      Infinite composability.
                    </span>
                  </h2>
                  <p className="text-zinc-400 text-lg">
                    Every product shares the same trustless settlement layer, solver network, and on-chain contract infrastructure.
                  </p>
                  <div className="flex items-center justify-center gap-4 flex-wrap pt-2">
                    <Button asChild className="rounded-full gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold h-12 px-6">
                      <Link to="/trade">Launch App <ArrowRight className="w-4 h-4" /></Link>
                    </Button>
                    <Button asChild variant="outline" className="rounded-full gap-2 border-white/15 hover:bg-white/5 h-12 px-6 text-white font-bold">
                      <a href="https://docs.intentsprotocol.xyz/" target="_blank" rel="noopener noreferrer">
                        Read Docs <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                  </div>
                </motion.div>
              </div>
            </section>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
