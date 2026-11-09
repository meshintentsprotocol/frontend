import { useState } from 'react';
import { Header } from '@/components/common/Header';
import { Footer } from '@/components/common/Footer';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  ArrowRight,
  Code2,
  Server,
  Layers,
  Globe,
  Copy,
  Check,
  ExternalLink,
  TerminalSquare,
  Wallet,
  RefreshCw,
  Bot,
  Sliders,
  Zap,
  DollarSign,
  ShieldCheck,
  Lock,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link, useNavigate } from 'react-router-dom';

// ─── Code Snippets ────────────────────────────────────────────────────────────

const codeSnippets = {
  wallet: {
    title: '1-Line Wallet Monetization',
    desc: 'Covenant-enforced treasury fees with zero backend servers.',
    tag: 'TypeScript SDK',
    code: `import { IntentBuilder } from '@bch-intents/sdk-cashtokens';

const swapIntent = IntentBuilder.limitOrder()
  .makerAddress('bitcoincash:qp3wjpa...user_wallet')
  .sellToken('BCH')
  .buyToken('f94d93...pUSD_CATEGORY_HEX')
  .sellAmount(100_000_000n) // 1.0 BCH
  .buyAmount(320_000_000n)   // 320 pUSD
  // ⚡ 1-LINE MONETIZATION
  .withFrontendFee(0.005, 'bitcoincash:qz...treasury')
  .build();`,
  },
  mesh: {
    title: 'Single-Asset Multi-Market ship()',
    desc: '100% of your deposit backs every route at once.',
    tag: 'BCHMesh SDK',
    code: `import { StrategyMeshClient } from '@bch-intents/sdk-mesh';

const meshClient = new StrategyMeshClient(provider, key);

const meshTx = await meshClient.ship({
  depositAsset: 'BCH',
  depositAmount: 1_000_000_000n, // 10 BCH
  routes: [
    { targetPair: 'BCH/pUSD', minPrice: 320_000_000n, feeBps: 25 },
    { targetPair: 'BCH/mUSD', minPrice: 320_500_000n, feeBps: 25 },
    { targetPair: 'BCH/FUR',  minPrice: 50_000_000n,  feeBps: 30 },
  ],
  recyclingEnabled: true
});`,
  },
  solver: {
    title: 'Zero-Inventory Arbitrage Solver',
    desc: 'Capture decaying spread surplus with zero hot-wallet inventory.',
    tag: 'Solver Engine',
    code: `import { IntentSolverNode } from '@bch-intents/sdk-solver';

const solver = new IntentSolverNode({
  zmqEndpoint: 'tcp://127.0.0.1:28332',
  nostrRelays: ['wss://relay.damus.io'],
});

solver.on('intent:discovered', async (intent) => {
  const quote = await solver.getMeshDepthQuote(
    intent.pair, intent.sellAmount
  );
  if (quote.outputAmount > intent.minimumBuyAmount) {
    await solver.executeAtomicMatch({
      userIntentUtxo: intent.utxo,
      makerStrategyUtxos: quote.usedUtxos,
    });
  }
});`,
  },
  crosschain: {
    title: 'BCH ↔ XMR Scriptless Swap',
    desc: 'Private cross-chain swaps via DLEQ ZK proofs.',
    tag: 'Cross-Chain SDK',
    code: `import { CrossChainAdaptorClient } from '@bch-intents/sdk-cross-chain';

const client = new CrossChainAdaptorClient(bchProvider, xmrRpc);

const swap = await client.createScriptlessSwap({
  sellAsset: 'BCH',
  sellAmount: 500_000_000n, // 5.0 BCH
  buyAsset: 'XMR',
  buyAmount: 7_500_000_000_000n, // 7.5 XMR
  timelockHours: 6,
});

await client.publishCrossChainIntent(swap);
// DLEQ ZK proofs verified ✓`,
  },
};

type TabKey = keyof typeof codeSnippets;

// ─── Persona cards ────────────────────────────────────────────────────────────

const personas = [
  {
    badge: 'Wallets',
    title: 'Mobile & Web Wallets',
    desc: 'Add native BCH and CashToken swaps directly inside your app. Earn passive revenue on 100% of volume via covenant-enforced fees.',
    color: '#2be64d',
    icon: Wallet,
    stat: '1-Line Fee Integration',
  },
  {
    badge: 'DEXs',
    title: 'DEXs & Aggregators',
    desc: 'Route swaps through BCHMesh concentrated liquidity and solver networks. Zero impermanent loss, 100% shared depth, instant fills.',
    color: '#06b6d4',
    icon: RefreshCw,
    stat: 'Deep Single-Asset Liquidity',
  },
  {
    badge: 'Solvers',
    title: 'Solvers & Grid Bots',
    desc: 'Capture decaying Dutch auction spreads with zero hot-wallet inventory. Sub-cent atomic bulk rebalances on L1.',
    color: '#a855f7',
    icon: Bot,
    stat: 'Zero-Inventory Arbitrage',
  },
  {
    badge: 'Protocols',
    title: 'Protocols & DAOs',
    desc: 'Deploy Protocol-Owned Liquidity into automated BCHMesh Strategy UTXOs. TWAP covenants for smooth treasury liquidations.',
    color: '#fbbf24',
    icon: Sliders,
    stat: 'Autonomous Yield Vaults',
  },
];

// ─── Integration methods ──────────────────────────────────────────────────────

const methods = [
  {
    badge: 'SDK',
    title: 'TypeScript SDK',
    desc: 'Fluent builder API with full type definitions. Construct intents, fetch quotes, and execute swaps.',
    color: '#2be64d',
    icon: Code2,
    link: { label: 'SDK Docs', href: '/docs' },
  },
  {
    badge: 'Node',
    title: 'Solver & Relayer',
    desc: 'Open-source daemon. Connect to Nostr relays and BCH full nodes for permissionless intent matching.',
    color: '#06b6d4',
    icon: Server,
    link: { label: 'Solver Setup', href: '/docs' },
  },
  {
    badge: 'Contracts',
    title: 'CashScript Covenants',
    desc: 'Compose with stateless CashScript contracts. Build custom AMM grids, recursive vaults, and TWAP schedules.',
    color: '#a855f7',
    icon: Layers,
    link: { label: 'Covenant Specs', href: '/docs' },
  },
  {
    badge: 'Frontend',
    title: 'White-Label Interface',
    desc: 'Fork our production-ready open-source UI. Add your brand and fee address to launch your own swap exchange.',
    color: '#fbbf24',
    icon: Globe,
    link: { label: 'Fork on GitHub', href: 'https://github.com/Intents-Swaps/frontend' },
  },
];

// ─── Superpowers ──────────────────────────────────────────────────────────────

const superpowers = [
  { title: '1-Line Monetization', desc: 'CashScript covenant forces solver to pay your treasury in Output 2. Zero backend servers.', icon: DollarSign, color: '#2be64d' },
  { title: '100% Shared Depth', desc: 'Your single-asset BCH deposit backs multiple pairs simultaneously with N× virtual depth.', icon: Layers, color: '#06b6d4' },
  { title: 'Sub-Cent Rebalances', desc: 'Atomic bulk rebalance costs < $0.01 on BCH L1. Unlocks high-frequency MM bots.', icon: Zap, color: '#a855f7' },
  { title: 'Zero Bridge Risk', desc: 'Cross-chain via scriptless adaptor signatures and HTLCs. No custodial bridges ever.', icon: ShieldCheck, color: '#fbbf24' },
  { title: 'MEV-Proof Auctions', desc: 'Dutch auctions decay off-chain. Single atomic matches eliminate sandwich attacks.', icon: Lock, color: '#f43f5e' },
  { title: '100% Permissionless', desc: 'No KYC, no whitelisting. Any developer can install, run a solver, or deploy liquidity today.', icon: Globe, color: '#3b82f6' },
];

// ─── Quickstart steps ─────────────────────────────────────────────────────────

const steps = [
  { step: '01', title: 'Install SDK', code: 'npm i @bch-intents/sdk', desc: 'Add the lightweight TypeScript SDK to your repository.' },
  { step: '02', title: 'Set Treasury', code: '.withFrontendFee(0.005, addr)', desc: 'Specify your payout address and fee percentage.' },
  { step: '03', title: 'Broadcast', code: 'await relayer.publish(intent)', desc: 'Publish swap intents to Nostr relays and solvers.' },
  { step: '04', title: 'Earn Fees', code: 'Output 2 → Treasury', desc: 'Solvers settle atomically. Your wallet is funded instantly.' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IntegratePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>('wallet');
  const [copied, setCopied] = useState(false);
  const [copiedInstall, setCopiedInstall] = useState(false);
  const [hoveredPersona, setHoveredPersona] = useState<number | null>(null);
  const [hoveredMethod, setHoveredMethod] = useState<number | null>(null);
  const [hoveredPower, setHoveredPower] = useState<number | null>(null);

  const copyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyInstallCmd = () => {
    navigator.clipboard.writeText('npm install @bch-intents/sdk');
    setCopiedInstall(true);
    setTimeout(() => setCopiedInstall(false), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#050505] selection:bg-primary/30 text-foreground overflow-x-hidden">
      <Header />

      <main className="flex-1">
        {/* ─── HERO ──────────────────────────────────────────────────── */}
        <section className="relative pt-32 pb-20 overflow-hidden">
          <div className="absolute inset-0 bg-[#050505]" />
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-[5%] left-[20%] w-[45vw] h-[45vw] rounded-full blur-[160px] bg-emerald-500/8" />
            <div className="absolute top-[30%] right-[15%] w-[35vw] h-[35vw] rounded-full blur-[160px] bg-cyan-500/6" />
          </div>

          <div className="container mx-auto px-4 relative z-10 text-center max-w-5xl">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-8"
            >
              <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.08]">
                Add BCH Swaps &{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
                  Earn Revenue
                </span>{' '}
                on Every Trade
              </h1>

              <p className="text-lg sm:text-xl text-zinc-400 max-w-3xl mx-auto leading-relaxed">
                Integrate non-custodial, 100% shared liquidity swaps into your wallet, DEX, or bot in days.
                Collect on-chain enforced treasury fees with a single line of code.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                <Button
                  size="lg"
                  className="h-14 px-8 text-base font-bold rounded-full bg-emerald-400 hover:bg-emerald-300 text-black shadow-lg shadow-emerald-500/20 w-full sm:w-auto group"
                  onClick={() => document.getElementById('built-for-builders')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  Start Building
                  <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 px-8 text-base font-bold rounded-full border-white/20 bg-white/5 hover:bg-white/10 w-full sm:w-auto text-white"
                  onClick={() => navigate('/docs')}
                >
                  Read Documentation
                  <ArrowRight className="ml-2 w-4 h-4 text-zinc-400" />
                </Button>
              </div>

              {/* Quick Copy NPM */}
              <div className="flex justify-center">
                <div
                  onClick={copyInstallCmd}
                  className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-white/5 border border-white/10 hover:border-emerald-500/40 transition-all cursor-pointer group"
                >
                  <TerminalSquare className="w-4 h-4 text-emerald-400" />
                  <span className="font-mono text-xs sm:text-sm text-zinc-300">npm install @bch-intents/sdk</span>
                  {copiedInstall ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ─── BUILT FOR BUILDERS — 1inch-style cards ────────────────── */}
        <section id="built-for-builders" className="relative py-24 bg-[#050505]">
          <div className="container mx-auto px-4">
            <div className="text-center mb-14 max-w-3xl mx-auto">
              <span className="text-xs uppercase tracking-widest text-emerald-400 font-semibold mb-3 inline-block">
                Built for Builders
              </span>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight">
                Who Can Build on BCH Intents?
              </h2>
            </div>

            {/* Desktop grid / Mobile side-scroll */}
            <div
              className="flex gap-4 sm:gap-5 overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-none no-scrollbar md:grid md:grid-cols-4 md:overflow-visible md:pb-0"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {personas.map((p, i) => {
                const isHovered = hoveredPersona === i;
                const Icon = p.icon;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    onMouseEnter={() => setHoveredPersona(i)}
                    onMouseLeave={() => setHoveredPersona(null)}
                    className="relative flex-shrink-0 w-[82vw] sm:w-[320px] md:w-auto snap-center rounded-3xl min-h-[360px] sm:h-[380px] flex flex-col justify-between p-6 sm:p-8 border border-white/10 cursor-default overflow-hidden transition-colors duration-500"
                    style={{
                      backgroundColor: isHovered ? p.color : '#131418',
                    }}
                  >
                    {/* Badge */}
                    <div>
                      <span
                        className="inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-5 transition-colors duration-500"
                        style={{
                          backgroundColor: isHovered ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.06)',
                          color: isHovered ? '#000' : '#fff',
                        }}
                      >
                        {p.badge}
                      </span>

                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-colors duration-500"
                        style={{ backgroundColor: isHovered ? 'rgba(0,0,0,0.15)' : `${p.color}15` }}
                      >
                        <Icon className="w-5 h-5 transition-colors duration-500" style={{ color: isHovered ? '#000' : p.color }} />
                      </div>

                      <h3
                        className="text-xl font-bold mb-2 transition-colors duration-500"
                        style={{ color: isHovered ? '#000' : '#fff' }}
                      >
                        {p.title}
                      </h3>
                      <p
                        className="text-sm leading-relaxed transition-colors duration-500"
                        style={{ color: isHovered ? 'rgba(0,0,0,0.7)' : 'rgba(161,161,170,1)' }}
                      >
                        {p.desc}
                      </p>
                    </div>

                    <div
                      className="text-xs font-mono transition-colors duration-500"
                      style={{ color: isHovered ? 'rgba(0,0,0,0.5)' : 'rgba(113,113,122,1)' }}
                    >
                      {p.stat}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Mobile dot indicators */}
            <div className="flex justify-center gap-1.5 mt-4 md:hidden">
              {personas.map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/20" />
              ))}
            </div>
          </div>
        </section>

        {/* ─── 4 WAYS TO INTEGRATE — 1inch-style cards ───────────────── */}
        <section className="relative py-24 bg-[#0a0a0f] border-t border-white/5">
          <div className="container mx-auto px-4">
            <div className="text-center mb-14 max-w-3xl mx-auto">
              <span className="text-xs uppercase tracking-widest text-cyan-400 font-semibold mb-3 inline-block">
                Integration Methods
              </span>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight">
                4 Ways to Integrate
              </h2>
              <p className="text-lg text-zinc-400 mt-4">
                Choose the architecture that fits your stack.
              </p>
            </div>

            <div
              className="flex gap-4 sm:gap-5 overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-none no-scrollbar md:grid md:grid-cols-4 md:overflow-visible md:pb-0 max-w-6xl mx-auto"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {methods.map((m, i) => {
                const isHovered = hoveredMethod === i;
                const Icon = m.icon;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    onMouseEnter={() => setHoveredMethod(i)}
                    onMouseLeave={() => setHoveredMethod(null)}
                    className="relative flex-shrink-0 w-[82vw] sm:w-[320px] md:w-auto snap-center rounded-3xl min-h-[360px] sm:h-[380px] flex flex-col justify-between p-6 sm:p-8 border border-white/10 cursor-default overflow-hidden transition-colors duration-500"
                    style={{
                      backgroundColor: isHovered ? m.color : '#131418',
                    }}
                  >
                    <div>
                      <span
                        className="inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-5 transition-colors duration-500"
                        style={{
                          backgroundColor: isHovered ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.06)',
                          color: isHovered ? '#000' : '#fff',
                        }}
                      >
                        {m.badge}
                      </span>

                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-colors duration-500"
                        style={{ backgroundColor: isHovered ? 'rgba(0,0,0,0.15)' : `${m.color}15` }}
                      >
                        <Icon className="w-5 h-5 transition-colors duration-500" style={{ color: isHovered ? '#000' : m.color }} />
                      </div>

                      <h3
                        className="text-xl font-bold mb-2 transition-colors duration-500"
                        style={{ color: isHovered ? '#000' : '#fff' }}
                      >
                        {m.title}
                      </h3>
                      <p
                        className="text-sm leading-relaxed transition-colors duration-500"
                        style={{ color: isHovered ? 'rgba(0,0,0,0.7)' : 'rgba(161,161,170,1)' }}
                      >
                        {m.desc}
                      </p>
                    </div>

                    <Link
                      to={m.link.href}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-colors duration-500 w-fit"
                      style={{
                        backgroundColor: isHovered ? '#000' : 'transparent',
                        color: isHovered ? '#fff' : 'rgba(161,161,170,1)',
                        border: isHovered ? 'none' : '1px solid rgba(255,255,255,0.1)',
                      }}
                    >
                      {m.link.label} <ArrowRight className="w-3 h-3" />
                    </Link>
                  </motion.div>
                );
              })}
            </div>

            {/* Mobile dot indicators */}
            <div className="flex justify-center gap-1.5 mt-4 md:hidden">
              {methods.map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/20" />
              ))}
            </div>

          </div>
        </section>

        {/* ─── 6 SUPERPOWERS — 1inch-style cards ─────────────────────── */}
        <section className="relative py-24 bg-[#050505] border-t border-white/5">
          <div className="container mx-auto px-4">
            <div className="text-center mb-14 max-w-3xl mx-auto">
              <span className="text-xs uppercase tracking-widest text-emerald-400 font-semibold mb-3 inline-block">
                Why Integrate?
              </span>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight">
                6 Superpowers
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
              {superpowers.map((s, i) => {
                const isHovered = hoveredPower === i;
                const Icon = s.icon;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 }}
                    onMouseEnter={() => setHoveredPower(i)}
                    onMouseLeave={() => setHoveredPower(null)}
                    className="rounded-3xl min-h-[220px] sm:h-[260px] flex flex-col justify-between p-6 sm:p-8 border border-white/10 cursor-default overflow-hidden transition-colors duration-500"
                    style={{
                      backgroundColor: isHovered ? s.color : '#131418',
                    }}
                  >
                    <div>
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-colors duration-500"
                        style={{ backgroundColor: isHovered ? 'rgba(0,0,0,0.15)' : `${s.color}15` }}
                      >
                        <Icon className="w-5 h-5 transition-colors duration-500" style={{ color: isHovered ? '#000' : s.color }} />
                      </div>
                      <h3
                        className="text-lg font-bold mb-2 transition-colors duration-500"
                        style={{ color: isHovered ? '#000' : '#fff' }}
                      >
                        {s.title}
                      </h3>
                      <p
                        className="text-sm leading-relaxed transition-colors duration-500"
                        style={{ color: isHovered ? 'rgba(0,0,0,0.7)' : 'rgba(161,161,170,1)' }}
                      >
                        {s.desc}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── CODE PLAYGROUND ──────────────────────────────────────── */}
        <section className="relative py-24 bg-[#0a0a0f] border-t border-white/5 overflow-hidden">
          <div className="container mx-auto px-4 relative z-10">
            <div className="text-center mb-12 max-w-3xl mx-auto">
              <span className="text-xs uppercase tracking-widest text-emerald-400 font-semibold mb-3 inline-block">
                Developer Playground
              </span>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight">
                Explore the SDK
              </h2>
            </div>

            <div className="max-w-4xl mx-auto">
              {/* Tabs */}
              <div className="flex flex-wrap gap-2 justify-center mb-6">
                {([
                  { key: 'wallet', label: 'Wallet Fee' },
                  { key: 'mesh', label: 'ship() Multi-Market' },
                  { key: 'solver', label: 'Zero-Inv Solver' },
                  { key: 'crosschain', label: 'BCH ↔ XMR' },
                ] as { key: TabKey; label: string }[]).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      'px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200',
                      activeTab === tab.key
                        ? 'bg-emerald-400 text-black shadow-lg shadow-emerald-500/20'
                        : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border border-white/5',
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Code window */}
              <div className="rounded-3xl overflow-hidden border border-white/10 bg-[#0c0c0f] shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 bg-white/[0.03] border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500/70" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                      <div className="w-3 h-3 rounded-full bg-green-500/70" />
                    </div>
                    <span className="text-xs font-mono text-zinc-400 pl-3">
                      {codeSnippets[activeTab].tag}
                    </span>
                  </div>
                  <button
                    onClick={() => copyCode(codeSnippets[activeTab].code)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-zinc-300 transition-colors border border-white/5 font-medium"
                  >
                    {copied ? (
                      <><Check className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-400">Copied!</span></>
                    ) : (
                      <><Copy className="w-3.5 h-3.5 text-zinc-400" /><span>Copy</span></>
                    )}
                  </button>
                </div>

                <div className="px-6 py-3 bg-emerald-500/5 border-b border-emerald-500/10 flex items-center gap-3">
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                  <p className="text-xs text-zinc-300 font-medium">{codeSnippets[activeTab].desc}</p>
                </div>

                <div className="p-6 md:p-8 overflow-x-auto text-xs sm:text-sm font-mono leading-relaxed text-zinc-300">
                  <AnimatePresence mode="wait">
                    <motion.pre
                      key={activeTab}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className="text-zinc-300 selection:bg-emerald-500/30"
                    >
                      <code>{codeSnippets[activeTab].code}</code>
                    </motion.pre>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── QUICKSTART STEPS — 1inch-style cards ─────────────────── */}
        <section className="relative py-24 bg-[#050505] border-t border-white/5">
          <div className="container mx-auto px-4">
            <div className="text-center mb-14 max-w-3xl mx-auto">
              <span className="text-xs uppercase tracking-widest text-emerald-400 font-semibold mb-3 inline-block">
                Quickstart
              </span>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight">
                Live in 4 Steps
              </h2>
            </div>

            <div
              className="flex gap-4 sm:gap-5 overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-none no-scrollbar md:grid md:grid-cols-4 md:overflow-visible md:pb-0 max-w-6xl mx-auto"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {steps.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="relative flex-shrink-0 w-[82vw] sm:w-[300px] md:w-auto snap-center rounded-3xl min-h-[260px] sm:h-[280px] flex flex-col justify-between p-6 sm:p-8 border border-white/10 bg-[#131418]"
                >
                  <div>
                    <span className="text-4xl font-black text-emerald-400/30 font-mono block mb-3">{item.step}</span>
                    <h3 className="text-xl font-bold mb-2 text-white">{item.title}</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">{item.desc}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-black/50 border border-white/5 font-mono text-[11px] text-emerald-300 truncate">
                    {item.code}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Mobile dot indicators */}
            <div className="flex justify-center gap-1.5 mt-4 md:hidden">
              {steps.map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/20" />
              ))}
            </div>
          </div>
        </section>

        {/* ─── READY TO BUILD CTA ────────────────────────────────────── */}
        <section className="relative w-full overflow-hidden bg-emerald-500">
          <div className="relative w-full py-14 sm:py-16 md:py-20 min-h-[220px] md:min-h-[260px] flex items-center justify-center">
            {/* Subtle depth overlay */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/[0.04] via-transparent to-black/[0.08]" />

            <div className="container mx-auto px-4 sm:px-6 relative z-10 max-w-4xl">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="flex flex-col items-center text-center space-y-3 sm:space-y-4"
              >
                {/* Heading */}
                <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-[42px] font-black tracking-tight text-[#050505] leading-tight">
                  Ready to Build?
                </h2>

                {/* Subtitle */}
                <p className="text-sm sm:text-base md:text-lg text-[#050505]/85 font-medium max-w-xl mx-auto leading-relaxed">
                  Join our developer community, explore open-source codebases, or start integrating today.
                </p>

                {/* Centered Actions */}
                <div className="pt-2 sm:pt-3 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => navigate('/docs')}
                    className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#050505] px-7 py-3.5 text-sm sm:text-base font-bold text-white transition-all duration-200 hover:bg-black/90 hover:shadow-xl active:scale-95 shadow-md shadow-black/20"
                  >
                    <span>Read the Docs</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </button>

                  <button
                    type="button"
                    onClick={() => window.open('https://github.com/Intents-Swaps', '_blank')}
                    className="group inline-flex items-center justify-center gap-2 rounded-full bg-black/10 hover:bg-black/20 px-6 py-3.5 text-sm sm:text-base font-bold text-[#050505] transition-all duration-200 active:scale-95 border border-black/15"
                  >
                    <span>GitHub</span>
                    <ExternalLink className="w-4 h-4 opacity-70" />
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
