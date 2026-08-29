import { motion, useInView } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';
import {
  Shield,
  Zap,
  Layers,
  Activity,
  CheckCircle2,
  XCircle,
  Sparkles,
  TrendingUp,
  RefreshCw,
  Lock,
  DollarSign,
  ArrowRight,
  Sliders,
  Flame,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Animated Savings Counter ────────────────────────────────────────────────

function SavingsCounter({ inView }: { inView: boolean }) {
  const [bchCost, setBchCost] = useState(0);
  const [evmCost, setEvmCost] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const duration = 1400;
    const start = Date.now();
    const step = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setBchCost(Number((eased * 0.008).toFixed(3)));
      setEvmCost(Math.round(eased * 68));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView]);

  return (
    <div className="grid grid-cols-2 gap-3 mt-4">
      <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
        <div className="text-2xl font-black font-mono text-emerald-400">${bchCost}</div>
        <div className="text-[11px] text-zinc-400 font-medium mt-0.5">BCHMesh Bulk Rebalance</div>
        <div className="text-[10px] text-emerald-500/80 font-mono">~1,500 sats flat</div>
      </div>
      <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-center">
        <div className="text-2xl font-black font-mono text-red-400">${evmCost}</div>
        <div className="text-[11px] text-zinc-400 font-medium mt-0.5">EVM (Uniswap v3/v4)</div>
        <div className="text-[10px] text-red-400/80 font-mono">20 rungs @ 35 gwei</div>
      </div>
    </div>
  );
}

// ─── Partial Fill Auto-Recycle Bar ───────────────────────────────────────────

function AutoRecycleVisualizer({ inView }: { inView: boolean }) {
  return (
    <div className="space-y-3 mt-4">
      <div className="flex justify-between text-xs font-mono">
        <span className="text-zinc-400">Taker Fill (Captured Fee)</span>
        <span className="text-emerald-400 font-bold">65% Filled</span>
      </div>
      <div className="h-3 rounded-full bg-white/5 overflow-hidden p-0.5 border border-white/10 flex">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
          initial={{ width: 0 }}
          animate={inView ? { width: '65%' } : {}}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
        <motion.div
          className="h-full rounded-full bg-cyan-500/30"
          initial={{ width: 0 }}
          animate={inView ? { width: '35%' } : {}}
          transition={{ duration: 1.2, delay: 0.2, ease: 'easeOut' }}
        />
      </div>
      <div className="flex justify-between text-[10px] font-mono text-zinc-500">
        <span className="text-emerald-400">● 6.5 BCH Executed (Maker fee earned)</span>
        <span className="text-cyan-400">● 3.5 BCH Auto-Recoined to Covenant</span>
      </div>
    </div>
  );
}

// ─── Main Benefits Section ───────────────────────────────────────────────────

export function MeshBenefitsSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <section ref={ref} className="relative py-28 lg:py-36 bg-[#050505] overflow-hidden border-t border-white/5">
      {/* Background Lighting */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[180px]" />
        <div className="absolute bottom-10 right-1/4 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[160px]" />
        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-15 mix-blend-overlay" />
      </div>

      <div className="container mx-auto px-4 relative z-10 max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16 md:mb-20 max-w-3xl mx-auto"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-xs font-bold uppercase tracking-widest text-emerald-300 mb-4 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            Why BCHMesh
          </span>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-white leading-tight">
            Eradicating{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
              Impermanent Loss
            </span>{' '}
            & Capital Fragmentation
          </h2>
          <p className="mt-4 text-base sm:text-lg text-zinc-400 leading-relaxed">
            Traditional AMMs dilute your yield, split your inventory fractionally across pools, and bleed you with gas.
            BCHMesh introduces a unified concentrated liquidity standard built on Bitcoin Cash covenants.
          </p>
        </motion.div>

        {/* ─── 1. Head-to-Head Comparison Matrix (BCHMesh vs Traditional AMMs) ─── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="mb-16 rounded-3xl border border-white/10 bg-[#0c0c10] overflow-hidden shadow-2xl backdrop-blur-xl"
        >
          <div className="p-6 md:p-8 border-b border-white/5 bg-white/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs uppercase tracking-widest text-emerald-400 font-mono font-semibold">
                Architecture Breakdown
              </span>
              <h3 className="text-2xl font-bold text-white mt-1">BCHMesh vs. Traditional EVM AMMs</h3>
            </div>
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 font-semibold">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              N× Virtual Capital Efficiency Multiplier
            </div>
          </div>

          <div className="divide-y divide-white/5 overflow-x-auto text-sm">
            {[
              {
                dimension: 'Multi-Market Liquidity Deployment',
                mesh: '100% of single BCH deposit available to ALL trading pairs simultaneously (Mode 4 shared depth)',
                meshHighlight: true,
                trad: 'Must split capital fractionally (e.g. 33% / 33% / 33%) across isolated pools',
              },
              {
                dimension: 'High-Frequency Grid Rebalance Fee',
                mesh: '< $0.01 flat fee to re-center 20+ rungs in 1 transaction (~1,500 sats)',
                meshHighlight: true,
                trad: '$50 – $100+ gas on Ethereum / L2 priority bidding wars',
              },
              {
                dimension: 'Paired Token Inventory Requirement',
                mesh: '0% Paired Inventory: Hold pure single-asset BCH with zero unwanted token exposure',
                meshHighlight: true,
                trad: 'Mandatory 50/50 token pair holding (subject to token rug-pulls and decay)',
              },
              {
                dimension: 'Impermanent Loss Exposure',
                mesh: 'Zero IL on unrouted capital; single-sided fills execute purely as profitable limit orders',
                meshHighlight: true,
                trad: 'Constant arbitrage bleed and toxic flow to MEV searchers',
              },
              {
                dimension: 'Smart Contract & Reentrancy Security',
                mesh: 'Stateless CashScript UTXO covenants (CHIP-2021-02) with zero reentrancy attack vectors',
                meshHighlight: true,
                trad: 'Complex EVM state storage susceptible to reentrancy and proxy governance hacks',
              },
            ].map((row, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-12 p-5 md:p-6 gap-4 items-center hover:bg-white/[0.01] transition-colors">
                <div className="md:col-span-4 font-bold text-white flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  {row.dimension}
                </div>
                <div className="md:col-span-4 flex items-start gap-2.5 text-emerald-300 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{row.mesh}</span>
                </div>
                <div className="md:col-span-4 flex items-start gap-2.5 text-zinc-500">
                  <XCircle className="w-4 h-4 text-red-400/70 shrink-0 mt-0.5" />
                  <span>{row.trad}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ─── 2. 4 Core Pillars Bento Grid ─────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Pillar 1: Single-Asset Multi-Market */}
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="p-8 rounded-3xl bg-[#0c0c10] border border-emerald-500/20 hover:border-emerald-500/40 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6">
                <Layers className="w-6 h-6 text-emerald-400" />
              </div>
              <span className="text-xs uppercase tracking-widest text-emerald-400 font-mono font-semibold">
                Pillar 01
              </span>
              <h3 className="text-2xl font-bold text-white mt-1 mb-3">
                100% Shared Multi-Market Liquidity
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Deposit pure BCH once via <code className="text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded font-mono">ship()</code>.
                Your entire balance is simultaneously available to <code className="text-zinc-200">BCH ➔ pUSD</code>,{' '}
                <code className="text-zinc-200">BCH ➔ mUSD</code>, and <code className="text-zinc-200">BCH ➔ FUR</code> with an $N\times$ virtual depth multiplier.
              </p>
            </div>

            <div className="mt-6 p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-zinc-400">
                <span>Deposited Capital:</span>
                <span className="text-white font-bold">10 BCH ($3,244)</span>
              </div>
              <div className="flex justify-between text-emerald-400 font-semibold">
                <span>Active Network Depth:</span>
                <span>30 BCH ($9,732 Virtual Depth)</span>
              </div>
            </div>
          </motion.div>

          {/* Pillar 2: Sub-Cent Rebalancing */}
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="p-8 rounded-3xl bg-[#0c0c10] border border-teal-500/20 hover:border-teal-500/40 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mb-6">
                <Zap className="w-6 h-6 text-teal-400" />
              </div>
              <span className="text-xs uppercase tracking-widest text-teal-400 font-mono font-semibold">
                Pillar 02
              </span>
              <h3 className="text-2xl font-bold text-white mt-1 mb-3">
                Sub-Cent ($0.01) High-Frequency Rebalancing
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Active market making on Ethereum is crippled by gas costs. On Bitcoin Cash, an automated grid bot can cancel and spawn 20+ strategy UTXOs for a flat fee of ~1,500 sats ($0.008).
              </p>
            </div>

            <SavingsCounter inView={inView} />
          </motion.div>

          {/* Pillar 3: Partial Fills & Auto-Recycling */}
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="p-8 rounded-3xl bg-[#0c0c10] border border-cyan-500/20 hover:border-cyan-500/40 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-6">
                <RefreshCw className="w-6 h-6 text-cyan-400" />
              </div>
              <span className="text-xs uppercase tracking-widest text-cyan-400 font-mono font-semibold">
                Pillar 03
              </span>
              <h3 className="text-2xl font-bold text-white mt-1 mb-3">
                Autonomous Recycled Liquidity Loop
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                When a taker partially fills your pool, the covenant contract automatically recreates the remaining funds as a new UTXO. Your liquidity compounds and recycles continuously on-chain.
              </p>
            </div>

            <AutoRecycleVisualizer inView={inView} />
          </motion.div>

          {/* Pillar 4: Non-Custodial Stateless Covenants */}
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="p-8 rounded-3xl bg-[#0c0c10] border border-violet-500/20 hover:border-violet-500/40 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-6">
                <Shield className="w-6 h-6 text-violet-400" />
              </div>
              <span className="text-xs uppercase tracking-widest text-violet-400 font-mono font-semibold">
                Pillar 04
              </span>
              <h3 className="text-2xl font-bold text-white mt-1 mb-3">
                Stateless P2SH32 CashScript Security
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Your keys, your funds. The covenant contract lives on Bitcoin Cash Layer-1. Only you hold the docking key to withdraw your deposit. No admin multisigs, no pause buttons, no upgradeable proxies.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {['P2SH32 32-Byte Hash', 'CHIP-2021-02 CashTokens', 'Zero Reentrancy Attack Surface', 'Non-Upgradeable Logic'].map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1.5 rounded-full bg-violet-500/10 text-violet-300 text-[11px] font-semibold border border-violet-500/20"
                >
                  {tag}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

