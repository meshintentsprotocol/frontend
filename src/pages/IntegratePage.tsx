import React, { useState } from 'react';
import { Header } from '@/components/common/Header';
import { Footer } from '@/components/common/Footer';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  ArrowRight,
  Code2,
  Cpu,
  Network,
  Zap,
  ShieldCheck,
  Box,
  TerminalSquare,
  Smartphone,
  Server,
  CheckCircle2,
  Coins,
  Copy,
  Check,
  ExternalLink,
  Layers,
  Sparkles,
  TrendingUp,
  BarChart3,
  Globe,
  DollarSign,
  Wallet,
  RefreshCw,
  Sliders,
  ChevronRight,
  Shield,
  Bot,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

// ─── Code Snippets for Interactive Playground ────────────────────────────────

const codeSnippets = {
  wallet: {
    title: '1-Line Wallet Monetization',
    desc: 'Monetize any mobile or web wallet. The CashScript covenant automatically pays your treasury fee in Output 2 with zero backend servers.',
    tag: 'TypeScript SDK',
    code: `import { IntentBuilder } from '@bch-intents/sdk-cashtokens';

// 1. Build a swap intent in your wallet interface
const swapIntent = IntentBuilder.limitOrder()
  .makerAddress('bitcoincash:qp3wjpa...user_wallet')
  .sellToken('BCH')
  .buyToken('f94d93...pUSD_CATEGORY_HEX')
  .sellAmount(100_000_000n) // 1.0 BCH
  .buyAmount(320_000_000n)   // 320 pUSD
  // ⚡ 1-LINE MONETIZATION: 0.5% fee enforced on-chain via covenant
  .withFrontendFee(0.005, 'bitcoincash:qz...developer_treasury_address')
  .build();

// 2. Broadcast intent to the decentralized solver network
console.log('Covenant-enforced monetized swap ready for atomic execution!');`,
  },
  mesh: {
    title: 'Single-Asset Multi-Market ship()',
    desc: 'Deploy pure BCH liquidity across multiple trading pairs simultaneously. 100% of your deposit is available to every route at once.',
    tag: 'BCHMesh SDK',
    code: `import { StrategyMeshClient } from '@bch-intents/sdk-mesh';
import { ElectrumNetworkProvider } from 'cashscript';

const provider = new ElectrumNetworkProvider('mainnet');
const meshClient = new StrategyMeshClient(provider, marketMakerKey);

// 🚀 Deploy 100% of 10 BCH across 3 pairs simultaneously (N× virtual depth)
const meshTx = await meshClient.ship({
  depositAsset: 'BCH',
  depositAmount: 1_000_000_000n, // 10 BCH
  routes: [
    { targetPair: 'BCH/pUSD', minPrice: 320_000_000n, feeBps: 25 },
    { targetPair: 'BCH/mUSD', minPrice: 320_500_000n, feeBps: 25 },
    { targetPair: 'BCH/FUR',  minPrice: 50_000_000n,  feeBps: 30 },
  ],
  recyclingEnabled: true // Automated sub-cent balance re-centering
});

console.log('Single-asset multi-market depth deployed in tx:', meshTx.txid);`,
  },
  solver: {
    title: 'Zero-Inventory Arbitrage Solver',
    desc: 'Run a permissionless solver bot. Listen to Dutch auction intent streams and capture decaying spread surplus with zero hot-wallet inventory.',
    tag: 'Solver Engine',
    code: `import { IntentSolverNode } from '@bch-intents/sdk-solver';

const solver = new IntentSolverNode({
  zmqEndpoint: 'tcp://127.0.0.1:28332',
  nostrRelays: ['wss://relay.damus.io', 'wss://nostr.bchintents.org'],
});

solver.on('intent:discovered', async (intent) => {
  // 1. Fetch real-time quotes on BCHMesh UTXOs vs Cauldron AMM
  const meshQuote = await solver.getMeshDepthQuote(intent.pair, intent.sellAmount);

  if (meshQuote.outputAmount > intent.minimumBuyAmount) {
    const profit = meshQuote.outputAmount - intent.minimumBuyAmount;
    console.log(\`Arbitrage opportunity detected! Expected surplus: \${profit} sats\`);

    // 2. Settle atomically in a single transaction (MEV-proof)
    await solver.executeAtomicMatch({
      userIntentUtxo: intent.utxo,
      makerStrategyUtxos: meshQuote.usedUtxos,
      settlementOutput: intent.recipientAddress,
      solverProfitAddress: solver.walletAddress,
    });
  }
});`,
  },
  crosschain: {
    title: 'BCH ↔ Monero (XMR) Scriptless Swap',
    desc: 'Execute private cross-chain swaps without bridges or wrapping via DLEQ Zero-Knowledge proofs and Schnorr adaptor signatures.',
    tag: 'Cross-Chain SDK',
    code: `import { CrossChainAdaptorClient } from '@bch-intents/sdk-cross-chain';

const client = new CrossChainAdaptorClient(bchProvider, xmrDaemonRpc);

// 1. Initialize scriptless atomic swap with Monero adaptor signatures
const swapSession = await client.createScriptlessSwap({
  sellAsset: 'BCH',
  sellAmount: 500_000_000n, // 5.0 BCH
  buyAsset: 'XMR',
  buyAmount: 7_500_000_000_000n, // 7.5 XMR
  timelockHours: 6,
});

// 2. Publish intent to cross-chain solver relayer
await client.publishCrossChainIntent(swapSession);

console.log('Scriptless atomic swap active! DLEQ ZK proofs verified.');`,
  },
  gridbot: {
    title: 'Sub-Cent ($0.01) Grid Bot Rebalance',
    desc: 'Close stale out-of-range orders and deploy new tight market maker rungs in a single flat-fee transaction.',
    tag: 'Quant Market Maker',
    code: `import { StrategyMeshClient } from '@bch-intents/sdk-mesh';

const mesh = new StrategyMeshClient(provider, botKey);

async function syncGridWithSpotPrice(currentBchPrice: number) {
  // Close 4 stale rungs and open 4 fresh ±0.2% rungs in 1 single transaction
  const rebalanceTxid = await mesh.bulkRebalance({
    closeUtxoIds: ['txid1:0', 'txid1:1', 'txid2:0', 'txid2:1'],
    newStrategies: [
      { pair: 'BCH/pUSD', amount: 200_000_000n, priceNumerator: BigInt(currentBchPrice * 0.998), priceDenominator: 1n, feeBps: 20 },
      { pair: 'BCH/pUSD', amount: 200_000_000n, priceNumerator: BigInt(currentBchPrice * 1.000), priceDenominator: 1n, feeBps: 20 },
      { pair: 'BCH/pUSD', amount: 200_000_000n, priceNumerator: BigInt(currentBchPrice * 1.002), priceDenominator: 1n, feeBps: 20 },
      { pair: 'BCH/pUSD', amount: 200_000_000n, priceNumerator: BigInt(currentBchPrice * 1.004), priceDenominator: 1n, feeBps: 20 },
    ],
  });

  // Flat Bitcoin Cash transaction fee: < $0.01 (compared to $50+ on EVM)
  console.log('Grid re-centered for ~$0.008 fee:', rebalanceTxid);
}`,
  },
};

type TabKey = keyof typeof codeSnippets;

export default function IntegratePage() {
  const [activeTab, setActiveTab] = useState<TabKey>('wallet');
  const [copied, setCopied] = useState(false);
  const [copiedInstall, setCopiedInstall] = useState(false);

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
        {/* ─── 1. HERO SECTION (THORChain Style) ─────────────────────────── */}
        <section className="relative pt-32 pb-20 md:pb-28 overflow-hidden">
          <div className="absolute inset-0 bg-[#050505] z-0" />

          {/* Ambient Glow Orbs */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full overflow-hidden pointer-events-none z-0">
            <div className="absolute top-[5%] left-[20%] w-[45vw] h-[45vw] rounded-full blur-[140px] bg-emerald-500/10 animate-pulse-glow" />
            <div className="absolute top-[25%] right-[15%] w-[35vw] h-[35vw] rounded-full blur-[160px] bg-cyan-500/10 animate-pulse-glow delay-1000" />
            <div className="absolute bottom-[10%] left-[30%] w-[40vw] h-[40vw] rounded-full blur-[180px] bg-violet-500/8 animate-pulse-glow delay-500" />
            <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-20 mix-blend-overlay" />
          </div>

          <div className="container mx-auto px-4 relative z-10 text-center max-w-5xl">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="space-y-8"
            >
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 backdrop-blur-md">
                <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs md:text-sm font-semibold text-emerald-300">
                  TypeScript SDK v1.0 • CashScript Covenants • Sub-Cent Fees
                </span>
              </div>

              {/* Title */}
              <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[1.08]">
                Add Bitcoin Cash Swaps &{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
                  Earn Revenue
                </span>{' '}
                on Every Trade
              </h1>

              {/* Subheading */}
              <p className="text-lg sm:text-xl md:text-2xl text-zinc-400 max-w-3xl mx-auto leading-relaxed font-normal">
                Integrate non-custodial, 100% shared liquidity swaps into your wallet, DEX, or bot in days.
                Collect on-chain enforced treasury fees with a single line of code.
              </p>

              {/* Action Buttons & NPM Box */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
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
                  className="h-14 px-8 text-base font-bold rounded-full border-white/20 bg-white/5 hover:bg-white/10 backdrop-blur-md w-full sm:w-auto text-white"
                  onClick={() => window.open('https://docs.intentsprotocol.xyz/', '_blank')}
                >
                  Read Documentation
                  <ExternalLink className="ml-2 w-4 h-4 text-zinc-400" />
                </Button>
              </div>

              {/* Quick Copy NPM Bar */}
              <div className="pt-2 flex justify-center">
                <div
                  onClick={copyInstallCmd}
                  className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-white/5 border border-white/10 hover:border-emerald-500/40 hover:bg-white/8 transition-all cursor-pointer group"
                >
                  <TerminalSquare className="w-4 h-4 text-emerald-400" />
                  <span className="font-mono text-xs sm:text-sm text-zinc-300">
                    npm install @bch-intents/sdk
                  </span>
                  {copiedInstall ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                  )}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Live Metric Ticker Bar */}
          <div className="container mx-auto px-4 mt-16 relative z-10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 max-w-4xl mx-auto">
              {[
                { label: 'Avg Rebalance Cost', value: '< $0.01', icon: DollarSign, color: 'text-emerald-400' },
                { label: 'Virtual Depth Multiplier', value: '100% Shared', icon: Layers, color: 'text-cyan-400' },
                { label: 'Solver Entry Barrier', value: 'Zero-Inventory', icon: Zap, color: 'text-teal-400' },
                { label: 'Wallet Monetization', value: '1-Line Code', icon: Coins, color: 'text-violet-400' },
              ].map((metric, i) => (
                <div
                  key={i}
                  className="p-4 rounded-2xl bg-white/[0.03] border border-white/8 backdrop-blur-md text-center"
                >
                  <div className={cn('text-xl md:text-2xl font-black', metric.color)}>{metric.value}</div>
                  <div className="text-xs text-zinc-500 font-medium mt-1">{metric.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 2. BUILT FOR BUILDERS (4 Personas) ───────────────────────── */}
        <section id="built-for-builders" className="relative py-24 bg-zinc-950/80 border-t border-white/5">
          <div className="container mx-auto px-4 relative z-10">
            <div className="text-center mb-16 max-w-3xl mx-auto">
              <span className="text-xs uppercase tracking-widest text-emerald-400 font-semibold mb-3 inline-block">
                Built for Builders
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
                Who Can Build on BCH Intents & BCHMesh?
              </h2>
              <p className="text-lg text-zinc-400">
                Whether you run a consumer wallet, an algorithmic trading bot, or a cross-chain DEX aggregator,
                the protocol gives you unprecedented superpowers and monetization models.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
              {/* Persona 1: Wallets */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="group rounded-3xl p-8 bg-gradient-to-b from-white/[0.06] to-white/[0.01] border border-white/10 hover:border-emerald-500/40 hover:bg-white/[0.08] transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Wallet className="w-7 h-7 text-emerald-400" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Wallets & Frontends</span>
                  <h3 className="text-2xl font-bold mt-2 mb-3 text-white">Mobile & Web Wallets</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                    Add native BCH and CashToken swaps directly inside your app. Earn passive revenue on 100% of user trading volume via covenant-enforced Output 2 fees.
                  </p>
                </div>
                <div className="pt-4 border-t border-white/5 space-y-2">
                  <div className="text-xs text-zinc-500 font-mono">1-Line Fee Integration</div>
                  <div className="text-xs text-zinc-300 font-semibold flex items-center gap-1 text-emerald-400">
                    Selene • Paytaca • Cashonize ready <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </div>
                </div>
              </motion.div>

              {/* Persona 2: DEXs & Aggregators */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="group rounded-3xl p-8 bg-gradient-to-b from-white/[0.06] to-white/[0.01] border border-white/10 hover:border-cyan-500/40 hover:bg-white/[0.08] transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <RefreshCw className="w-7 h-7 text-cyan-400" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">Trading Interfaces</span>
                  <h3 className="text-2xl font-bold mt-2 mb-3 text-white">DEXs & Aggregators</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                    Route swaps through BCHMesh concentrated liquidity and solver networks. Zero impermanent loss, 100% shared depth across all pairs, and instant fills.
                  </p>
                </div>
                <div className="pt-4 border-t border-white/5 space-y-2">
                  <div className="text-xs text-zinc-500 font-mono">Deep Single-Asset Liquidity</div>
                  <div className="text-xs text-zinc-300 font-semibold flex items-center gap-1 text-cyan-400">
                    Smart Multi-Route Routing <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </div>
                </div>
              </motion.div>

              {/* Persona 3: Quant Solvers & Bots */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="group rounded-3xl p-8 bg-gradient-to-b from-white/[0.06] to-white/[0.01] border border-white/10 hover:border-teal-500/40 hover:bg-white/[0.08] transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Bot className="w-7 h-7 text-teal-400" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-teal-400">Arbitrage & MMs</span>
                  <h3 className="text-2xl font-bold mt-2 mb-3 text-white">Solvers & Grid Bots</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                    Capture decaying Dutch auction price spreads with zero hot-wallet inventory. Run high-frequency grid bots with sub-cent ($0.01) atomic bulk rebalances.
                  </p>
                </div>
                <div className="pt-4 border-t border-white/5 space-y-2">
                  <div className="text-xs text-zinc-500 font-mono">Zero-Inventory Arbitrage</div>
                  <div className="text-xs text-zinc-300 font-semibold flex items-center gap-1 text-teal-400">
                    Sub-Cent Bulk Rebalances <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </div>
                </div>
              </motion.div>

              {/* Persona 4: Protocols & DAOs */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
                className="group rounded-3xl p-8 bg-gradient-to-b from-white/[0.06] to-white/[0.01] border border-white/10 hover:border-violet-500/40 hover:bg-white/[0.08] transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Sliders className="w-7 h-7 text-violet-400" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-violet-400">Treasury & Vaults</span>
                  <h3 className="text-2xl font-bold mt-2 mb-3 text-white">Protocols & DAOs</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                    Deploy Protocol-Owned Liquidity (POL) into automated BCHMesh Strategy UTXOs. Smooth large treasury liquidations via TWAP covenants with zero slippage.
                  </p>
                </div>
                <div className="pt-4 border-t border-white/5 space-y-2">
                  <div className="text-xs text-zinc-500 font-mono">Autonomous Yield Vaults</div>
                  <div className="text-xs text-zinc-300 font-semibold flex items-center gap-1 text-violet-400">
                    TWAP & POL Management <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ─── 3. 4 WAYS TO INTEGRATE (Integration Methods) ─────────────── */}
        <section className="relative py-24 bg-[#050505]">
          <div className="container mx-auto px-4 relative z-10">
            <div className="text-center mb-16 max-w-3xl mx-auto">
              <span className="text-xs uppercase tracking-widest text-cyan-400 font-semibold mb-3 inline-block">
                Integration Methods
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
                4 Ways to Integrate
              </h2>
              <p className="text-lg text-zinc-400">
                Choose the architecture that fits your stack. From 1-line client SDKs to custom on-chain CashScript contracts.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {/* Method 1 */}
              <div className="p-8 rounded-3xl bg-zinc-900/50 border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      <Code2 className="w-6 h-6 text-emerald-400" />
                    </div>
                    <span className="text-xs font-mono px-3 py-1 rounded-full bg-white/5 text-zinc-400 border border-white/5">
                      Method 01
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold mb-3 text-white">TypeScript SDK & Swap Widget</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                    Use our fluent TypeScript SDK to construct intents, fetch quotes, and execute swaps. Plug the ready-made swap widget into any React, Vue, or mobile wallet view.
                  </p>
                  <ul className="space-y-2.5 mb-6 text-xs text-zinc-300 font-medium">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Full TypeScript type definitions & autocomplete</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>1-Line covenant-enforced fee configuration</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>WizardConnect & Electron Cash wallet providers</span>
                    </li>
                  </ul>
                </div>
                <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                  <span className="text-xs font-mono text-emerald-400">@bch-intents/sdk</span>
                  <a href="https://docs.intentsprotocol.xyz/sdk" target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-400 hover:text-white font-semibold flex items-center gap-1">
                    SDK Docs <ArrowRight className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Method 2 */}
              <div className="p-8 rounded-3xl bg-zinc-900/50 border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                      <Server className="w-6 h-6 text-cyan-400" />
                    </div>
                    <span className="text-xs font-mono px-3 py-1 rounded-full bg-white/5 text-zinc-400 border border-white/5">
                      Method 02
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold mb-3 text-white">Open-Source Solver & Relayer Node</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                    Run an autonomous solver daemon. Connect to Nostr relays and Bitcoin Cash full nodes to listen for Dutch auction intents and execute atomic matches for profit.
                  </p>
                  <ul className="space-y-2.5 mb-6 text-xs text-zinc-300 font-medium">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>100% Permissionless: No KYC, no whitelisting</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>Zero-inventory triangular match support</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>Sub-second ZMQ mempool event ingestion</span>
                    </li>
                  </ul>
                </div>
                <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                  <span className="text-xs font-mono text-cyan-400">@bch-intents/solver-node</span>
                  <a href="https://docs.intentsprotocol.xyz/solvers" target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-400 hover:text-white font-semibold flex items-center gap-1">
                    Solver Setup <ArrowRight className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Method 3 */}
              <div className="p-8 rounded-3xl bg-zinc-900/50 border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center">
                      <Layers className="w-6 h-6 text-teal-400" />
                    </div>
                    <span className="text-xs font-mono px-3 py-1 rounded-full bg-white/5 text-zinc-400 border border-white/5">
                      Method 03
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold mb-3 text-white">CashScript Covenants & BCHMesh</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                    Compose directly with stateless CashScript covenants. Build custom automated market making grids, recursive yield vaults, and TWAP execution schedules.
                  </p>
                  <ul className="space-y-2.5 mb-6 text-xs text-zinc-300 font-medium">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                      <span>CHIP-2021-02 native CashTokens smart contracts</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                      <span>Zero reentrancy vulnerability by UTXO design</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                      <span>Single-asset multi-market ship() support</span>
                    </li>
                  </ul>
                </div>
                <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                  <span className="text-xs font-mono text-teal-400">CashScript v0.10+</span>
                  <a href="https://docs.intentsprotocol.xyz/covenants" target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-400 hover:text-white font-semibold flex items-center gap-1">
                    Covenant Specs <ArrowRight className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Method 4 */}
              <div className="p-8 rounded-3xl bg-zinc-900/50 border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
                      <Globe className="w-6 h-6 text-violet-400" />
                    </div>
                    <span className="text-xs font-mono px-3 py-1 rounded-full bg-white/5 text-zinc-400 border border-white/5">
                      Method 04
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold mb-3 text-white">White-Label Swap Interface</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                    Fork our production-ready, open-source web interface. Add your brand colors, custom domain, and fee address to launch your own branded swap exchange in 1 day.
                  </p>
                  <ul className="space-y-2.5 mb-6 text-xs text-zinc-300 font-medium">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0" />
                      <span>Vite + React + Tailwind + Framer Motion stack</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0" />
                      <span>Built-in wallet connection modal & transaction toasts</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0" />
                      <span>Instant deployment to Vercel, Netlify, or IPFS</span>
                    </li>
                  </ul>
                </div>
                <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                  <span className="text-xs font-mono text-violet-400">bch-intents-frontend</span>
                  <a href="https://github.com/Intents-Swaps/frontend" target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-400 hover:text-white font-semibold flex items-center gap-1">
                    Fork on GitHub <ArrowRight className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── 4. WHY INTEGRATE? (6 Superpowers) ────────────────────────── */}
        <section className="relative py-24 bg-zinc-950/80 border-y border-white/5">
          <div className="container mx-auto px-4 relative z-10">
            <div className="text-center mb-16 max-w-3xl mx-auto">
              <span className="text-xs uppercase tracking-widest text-emerald-400 font-semibold mb-3 inline-block">
                Why Integrate?
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
                The 6 Superpowers of BCH Intents & BCHMesh
              </h2>
              <p className="text-lg text-zinc-400">
                How our UTXO architecture and covenant design fundamentally outcompetes EVM-based liquidity protocols.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {[
                {
                  title: '1-Line Covenant Monetization',
                  desc: 'Never build payment servers or database accounting. The CashScript covenant mathematically forces the solver to pay your treasury address in Output 2 to settle the trade.',
                  icon: DollarSign,
                  color: 'text-emerald-400',
                  bg: 'bg-emerald-500/10',
                },
                {
                  title: '100% Shared Liquidity Depth',
                  desc: 'Traditional AMMs force you to split capital fractionally. BCHMesh lets 100% of your single-asset BCH deposit back multiple pairs simultaneously (N× virtual depth).',
                  icon: Layers,
                  color: 'text-cyan-400',
                  bg: 'bg-cyan-500/10',
                },
                {
                  title: 'Sub-Cent ($0.01) Rebalances',
                  desc: 'On EVM chains, rebalancing 20 grid rungs costs $50–$100 in gas. On Bitcoin Cash, an atomic bulk rebalance costs under $0.01, unlocking high-frequency MM bots.',
                  icon: Zap,
                  color: 'text-teal-400',
                  bg: 'bg-teal-500/10',
                },
                {
                  title: 'Zero Bridge or Wrapped Risk',
                  desc: 'Trade native UTXOs directly. Cross-chain swaps with Monero (XMR), Solana, and EVM execute via scriptless adaptor signatures and atomic HTLCs with zero custodial bridges.',
                  icon: ShieldCheck,
                  color: 'text-violet-400',
                  bg: 'bg-violet-500/10',
                },
                {
                  title: 'MEV-Proof Dutch Auctions',
                  desc: 'Swaps decay predictably over time off-chain. Solvers compete to fill at the best price in single atomic matches, completely eliminating sandwich attacks and front-running.',
                  icon: Lock,
                  color: 'text-amber-400',
                  bg: 'bg-amber-500/10',
                },
                {
                  title: '100% Permissionless Access',
                  desc: 'No KYC, no gated whitelisting, and no multi-million dollar bond auctions. Any developer can install the SDK, run a solver, or deploy liquidity today.',
                  icon: Globe,
                  color: 'text-blue-400',
                  bg: 'bg-blue-500/10',
                },
              ].map((power, i) => (
                <div
                  key={i}
                  className="p-8 rounded-3xl bg-white/[0.03] border border-white/8 hover:border-white/20 transition-all space-y-4"
                >
                  <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center', power.bg)}>
                    <power.icon className={cn('w-6 h-6', power.color)} />
                  </div>
                  <h3 className="text-xl font-bold text-white">{power.title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">{power.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 5. INTERACTIVE DEVELOPER CODE SHOWCASE ───────────────────── */}
        <section className="relative py-24 bg-[#050505] overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-5xl h-full max-h-[800px] bg-emerald-500/5 blur-[160px] rounded-full pointer-events-none" />

          <div className="container mx-auto px-4 relative z-10">
            <div className="text-center mb-12 max-w-3xl mx-auto">
              <span className="text-xs uppercase tracking-widest text-emerald-400 font-semibold mb-3 inline-block">
                Developer Playground
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
                Explore the SDK in Action
              </h2>
              <p className="text-lg text-zinc-400">
                Real code you can copy, paste, and run in your applications today.
              </p>
            </div>

            <div className="max-w-5xl mx-auto">
              {/* Tabs Bar */}
              <div className="flex flex-wrap gap-2 justify-center mb-6">
                {(
                  [
                    { key: 'wallet', label: '1-Line Wallet Fee' },
                    { key: 'mesh', label: 'ship() Multi-Market' },
                    { key: 'solver', label: 'Zero-Inv Solver' },
                    { key: 'crosschain', label: 'BCH ↔ XMR Swap' },
                    { key: 'gridbot', label: 'Sub-Cent Grid Bot' },
                  ] as { key: TabKey; label: string }[]
                ).map((tab) => (
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

              {/* Window Chrome & Code Viewer */}
              <div className="rounded-3xl overflow-hidden border border-white/10 bg-[#0c0c0f] shadow-2xl backdrop-blur-xl">
                {/* Header Bar */}
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
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Explanation Banner */}
                <div className="px-6 py-3 bg-emerald-500/5 border-b border-emerald-500/10 flex items-center gap-3">
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                  <p className="text-xs text-zinc-300 font-medium">{codeSnippets[activeTab].desc}</p>
                </div>

                {/* Code Content */}
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

        {/* ─── 6. 4-STEP QUICKSTART INTEGRATION FLOW ─────────────────────── */}
        <section className="relative py-24 bg-zinc-950/80 border-y border-white/5">
          <div className="container mx-auto px-4 relative z-10">
            <div className="text-center mb-16 max-w-3xl mx-auto">
              <span className="text-xs uppercase tracking-widest text-emerald-400 font-semibold mb-3 inline-block">
                Quickstart Guide
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
                Live Swaps & Revenue in 4 Steps
              </h2>
              <p className="text-lg text-zinc-400">
                Go from zero to live covenant swaps in less than an afternoon.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-6xl mx-auto">
              {[
                {
                  step: '01',
                  title: 'Install SDK',
                  desc: 'Add the lightweight TypeScript SDK or drop-in widget to your repository via npm or yarn.',
                  code: 'npm i @bch-intents/sdk',
                },
                {
                  step: '02',
                  title: 'Set Treasury Address',
                  desc: 'Specify your developer payout address and fee percentage using .withFrontendFee().',
                  code: '.withFrontendFee(0.005, addr)',
                },
                {
                  step: '03',
                  title: 'Broadcast Intent',
                  desc: 'Publish user swap intents to decentralized Nostr relays and solver indexers.',
                  code: 'await relayer.publish(intent)',
                },
                {
                  step: '04',
                  title: 'Earn On-Chain Fees',
                  desc: 'Solvers settle trades atomically. Output 2 immediately funds your treasury wallet.',
                  code: 'Output 2: Paid in real-time',
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="relative p-6 rounded-3xl bg-white/[0.03] border border-white/8 flex flex-col justify-between"
                >
                  <div>
                    <div className="text-3xl font-black text-emerald-400/40 mb-3 font-mono">
                      {item.step}
                    </div>
                    <h3 className="text-xl font-bold mb-2 text-white">{item.title}</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed mb-4">{item.desc}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/50 border border-white/5 font-mono text-[11px] text-emerald-300 truncate">
                    {item.code}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 7. ECOSYSTEM DIRECTORY & INTEGRATORS ───────────────────────── */}
        <section className="relative py-24 bg-[#050505]">
          <div className="container mx-auto px-4 relative z-10">
            <div className="text-center mb-16 max-w-3xl mx-auto">
              <span className="text-xs uppercase tracking-widest text-cyan-400 font-semibold mb-3 inline-block">
                Ecosystem & Partners
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                Supported Wallets, Relayers & Protocols
              </h2>
              <p className="text-zinc-400">
                Built to power the next generation of Bitcoin Cash applications.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
              {[
                { name: 'Selene Wallet', tag: 'Mobile Wallet' },
                { name: 'Paytaca', tag: 'Mobile & Merchant' },
                { name: 'Cashonize', tag: 'Web Wallet' },
                { name: 'Zapit', tag: 'Multi-Asset Wallet' },
                { name: 'Electron Cash', tag: 'Desktop Power Users' },
                { name: 'Cauldron DEX', tag: 'AMM Liquidity' },
                { name: 'Nostr Intent Pool', tag: 'Encrypted Relayers' },
                { name: 'Monero Relayer', tag: 'Cross-Chain Adaptors' },
              ].map((partner, i) => (
                <div
                  key={i}
                  className="p-6 rounded-2xl bg-white/[0.02] border border-white/6 text-center hover:border-emerald-500/30 hover:bg-white/[0.04] transition-all"
                >
                  <div className="text-base font-bold text-white mb-1">{partner.name}</div>
                  <div className="text-xs text-zinc-500 font-medium">{partner.tag}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 8. FINAL DEVELOPER CTA & SUPPORT HUBS ─────────────────────── */}
        <section className="relative py-32 bg-[#050505] overflow-hidden border-t border-white/5">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/5 to-cyan-500/10" />

          <div className="container mx-auto px-4 relative z-10 text-center max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="space-y-8"
            >
              <h2 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight">
                Ready to Build the Future of{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
                  Bitcoin Cash DeFi?
                </span>
              </h2>
              <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
                Join our developer community, explore open-source codebases, or apply for an ecosystem grant to accelerate your build.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <Button
                  size="lg"
                  className="h-14 px-8 text-base font-bold rounded-full bg-emerald-400 hover:bg-emerald-300 text-black shadow-lg shadow-emerald-500/20 w-full sm:w-auto"
                  onClick={() => window.open('https://docs.intentsprotocol.xyz/', '_blank')}
                >
                  Read the GitBook Docs
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 px-8 text-base font-bold rounded-full border-white/20 bg-white/5 hover:bg-white/10 w-full sm:w-auto text-white"
                  onClick={() => window.open('https://github.com/Intents-Swaps', '_blank')}
                >
                  View GitHub Repositories
                  <ExternalLink className="ml-2 w-4 h-4 text-zinc-400" />
                </Button>
              </div>

              <div className="pt-8 flex items-center justify-center gap-6 text-sm text-zinc-500">
                <a href="https://t.me/bchintents" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors">
                  Developer Telegram
                </a>
                <span>•</span>
                <a href="https://x.com/bchintents" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors">
                  Twitter / X
                </a>
                <span>•</span>
                <Link to="/kb" className="hover:text-emerald-400 transition-colors">
                  Knowledge Base
                </Link>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

