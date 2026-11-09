import { motion } from 'framer-motion';
import { Shield, Zap, DollarSign, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const BENEFITS = [
  {
    id: 'slippage',
    badge: 'Zero Slippage',
    title: 'Discrete In-Place Fills',
    description: 'Trades execute at fixed bin price rungs without AMM bonding curve decay. Takers receive 100% predictable price execution.',
    stat: '0.00%',
    statLabel: 'Price Slippage',
    hoverBg: 'hover:bg-[#06b6d4]', // Neon Cyan
  },
  {
    id: 'sovereignty',
    badge: 'Sovereign Custody',
    title: '82-Byte Position NFTs',
    description: 'Zero admin keys or pooled vault counterparty risk. Every position is an on-chain CashToken NFT held in your private wallet.',
    stat: '82 Bytes',
    statLabel: 'On-Chain Footprint',
    hoverBg: 'hover:bg-[#2be64d]', // Neon Lime
  },
  {
    id: 'fees',
    badge: 'Capital Efficiency',
    title: 'Sub-Cent Rebalances',
    description: 'Rebalance 50 discrete price rungs for less than 1,500 satoshis ($0.005), compared to $60+ on Ethereum and L2 rollups.',
    stat: '99.9%',
    statLabel: 'Gas Cost Savings',
    hoverBg: 'hover:bg-[#a855f7]', // Electric Purple
  },
  {
    id: 'recycling',
    badge: 'Auto-Recycling',
    title: 'Cyclic UTXO Invariance',
    description: 'Residual swap proceeds return directly to the same covenant script in the same transaction. Zero liquidity bleed.',
    stat: '1-Tx',
    statLabel: 'Closed Loop Settlement',
    hoverBg: 'hover:bg-[#fbbf24]', // Solar Amber
  },
];

export function MeshBenefitsSection() {
  return (
    <section className="relative py-24 md:py-32 overflow-hidden bg-gradient-to-b from-[#06070a] via-[#07080d] to-[#050505]">
      {/* Ambient multi-spectrum blooms reflecting CashTokens & low fees */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[75vw] h-[400px] bg-gradient-to-r from-cyan-500/[0.03] via-emerald-500/[0.03] to-purple-500/[0.025] rounded-full blur-[150px]" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 max-w-7xl relative z-10">
        {/* Title */}
        <div className="text-center mb-14 md:mb-20">
          <div className="inline-block px-3.5 py-1 rounded-full text-xs font-mono font-bold tracking-wider uppercase bg-white/5 text-zinc-400 border border-white/10 mb-4">
            Protocol Advantages
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Why build liquidity on Mesh
          </h2>
          <p className="mt-4 text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto">
            Architected specifically for Bitcoin Cash's high-speed, parallel Extended UTXO model.
          </p>
        </div>

        {/* 4 Cards Grid / Side Scroll */}
        <div className="flex overflow-x-auto snap-x snap-mandatory lg:grid lg:grid-cols-4 gap-4 sm:gap-6 pb-6 lg:pb-0 scrollbar-none no-scrollbar -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
          {BENEFITS.map((b, idx) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.08 }}
              className="w-[84vw] sm:w-[320px] lg:w-auto shrink-0 snap-center h-full"
            >
              <div
                className={cn(
                  'group h-[400px] sm:h-[420px] rounded-3xl p-7 sm:p-8 flex flex-col justify-between transition-all duration-300 ease-out cursor-pointer',
                  'bg-[#131418] border border-white/10',
                  b.hoverBg,
                  'hover:border-transparent hover:shadow-2xl',
                )}
              >
                <div>
                  {/* Top Badge */}
                  <div className="flex items-center justify-between mb-8">
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-bold tracking-tight bg-black text-white">
                      {b.badge}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white group-hover:text-black leading-snug mb-3 transition-colors duration-200">
                    {b.title}
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-zinc-400 group-hover:text-black/80 leading-relaxed font-normal transition-colors duration-200">
                    {b.description}
                  </p>
                </div>

                {/* Bottom Metric Stat */}
                <div className="pt-6 border-t border-white/10 group-hover:border-black/20 transition-colors">
                  <div className="text-3xl font-black font-mono text-cyan-400 group-hover:text-black transition-colors">
                    {b.stat}
                  </div>
                  <div className="text-xs font-mono uppercase tracking-wider text-zinc-500 group-hover:text-black/70 mt-1 transition-colors">
                    {b.statLabel}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Radiant transition into FAQ */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
    </section>
  );
}

export default MeshBenefitsSection;
