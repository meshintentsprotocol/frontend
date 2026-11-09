import { motion } from 'framer-motion';
import { Sliders, Zap, Coins, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const STEPS = [
  {
    step: '01',
    badge: 'Configuration',
    title: 'Select Price Bins',
    description: 'Configure your discrete price range using V4 DLMM bins (Spot, Curve, or Bid-Ask) or multi-asset V3 pools.',
    icon: Sliders,
    hoverBg: 'hover:bg-[#06b6d4]', // Neon Cyan
  },
  {
    step: '02',
    badge: 'Genesis Mint',
    title: 'Deploy Covenant',
    description: 'Lock liquidity into a stateless P2SH32 CashScript covenant in one atomic transaction and receive an 82-byte NFT position token.',
    icon: Zap,
    hoverBg: 'hover:bg-[#2be64d]', // Neon Lime
  },
  {
    step: '03',
    badge: 'Zero Slippage',
    title: 'Earn Auto-Yield',
    description: 'Takers fill discrete bins in-place. Each round trip captures spread while fees compound perpetually on-chain.',
    icon: Coins,
    hoverBg: 'hover:bg-[#a855f7]', // Electric Purple
  },
];

export function MeshHowItWorksSection() {
  return (
    <section className="relative py-24 md:py-32 overflow-hidden bg-gradient-to-b from-[#07090e] via-[#080b12] to-[#06080d]">
      {/* Ambient background glow & subtle dot matrix */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70vw] h-[360px] bg-emerald-500/[0.04] rounded-full blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:28px_28px] opacity-35" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 max-w-7xl relative z-10">
        {/* Title */}
        <div className="text-center mb-14 md:mb-20">
          <div className="inline-block px-3.5 py-1 rounded-full text-xs font-mono font-bold tracking-wider uppercase bg-white/5 text-zinc-400 border border-white/10 mb-4">
            Workflow Architecture
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
            How Mesh Protocol works
          </h2>
          <p className="mt-4 text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto">
            From single-transaction genesis to autonomous in-place fills on Bitcoin Cash.
          </p>
        </div>

        {/* 3 Simple 1inch-Style Step Cards */}
        <div className="flex overflow-x-auto snap-x snap-mandatory lg:grid lg:grid-cols-3 gap-5 md:gap-6 pb-6 lg:pb-0 scrollbar-none no-scrollbar -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
          {STEPS.map((s, idx) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
              className="w-[84vw] sm:w-[340px] lg:w-auto shrink-0 snap-center h-full"
            >
              <div
                className={`group h-[380px] sm:h-[400px] rounded-3xl p-7 sm:p-8 flex flex-col justify-between transition-all duration-300 ease-out cursor-pointer bg-[#131418] border border-white/10 ${s.hoverBg} hover:border-transparent hover:shadow-2xl`}
              >
                <div>
                  {/* Top: Step number & Badge */}
                  <div className="flex items-center justify-between mb-8">
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-bold tracking-tight bg-black text-white">
                      {s.badge}
                    </span>
                    <span className="text-xl font-black font-mono text-zinc-600 group-hover:text-black/50 transition-colors">
                      {s.step}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white group-hover:text-black leading-snug mb-3 transition-colors duration-200">
                    {s.title}
                  </h3>

                  {/* Description */}
                  <p className="text-sm sm:text-base text-zinc-400 group-hover:text-black/80 leading-relaxed font-normal transition-colors duration-200">
                    {s.description}
                  </p>
                </div>

                {/* Bottom link */}
                <div className="pt-6">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 group-hover:text-black transition-colors flex items-center gap-1.5">
                    Step {s.step} Details <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Radiant transition into Strategy Types section */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-teal-400/25 via-emerald-400/35 to-transparent pointer-events-none" />
    </section>
  );
}

export default MeshHowItWorksSection;
