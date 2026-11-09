import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { ArrowRight, Sparkles, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MeshLiquidityWireframe } from './MeshLiquidityWireframe';

export function MeshHeroSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  return (
    <section ref={ref} className="relative min-h-[84vh] lg:min-h-[90vh] flex items-center pt-32 pb-24 overflow-hidden bg-[#050505]">
      {/* 3D Perspective Mesh Liquidity Wireframe Background */}
      <MeshLiquidityWireframe
        theme="cyan-emerald"
        interactive={true}
        showFloatingBadges={true}
        particleCount={30}
        gridDensity={18}
      />

      <div className="container mx-auto px-4 relative z-10 max-w-5xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="space-y-8"
        >
          {/* Subtle Live Protocol State Indicator */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/40 border border-cyan-500/30 text-cyan-400 text-xs font-mono font-medium backdrop-blur-md shadow-lg shadow-cyan-500/5"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
            </span>
            <span>Discrete Liquidity Mesh · CashScript Covenants</span>
          </motion.div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.05] text-white">
            Discrete Liquidity{' '}
            <br className="hidden sm:block" />
            Market Making on{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400">
              Bitcoin Cash
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-zinc-300 leading-relaxed max-w-2xl mx-auto drop-shadow-sm">
            Deploy V4 discrete bins with NFT-managed position custody.
            Zero curve slippage, sub-cent rebalances, and 100% single-asset depth across all pairs.
          </p>

          {/* Stat pills */}
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { label: 'Rebalance Cost', value: '< $0.01' },
              { label: 'Slippage', value: '0.00%' },
              { label: 'Depth Model', value: 'N× Shared' },
              { label: 'Custody', value: 'NFT-Owned' },
            ].map((s) => (
              <div
                key={s.label}
                className="px-4 py-2 rounded-full bg-black/50 border border-white/10 hover:border-cyan-500/40 text-sm backdrop-blur-md shadow-lg transition-colors duration-200"
              >
                <span className="font-bold text-white">{s.value}</span>{' '}
                <span className="text-zinc-400">{s.label}</span>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Button
              asChild
              size="lg"
              className="h-14 px-8 text-base font-bold rounded-full bg-emerald-400 hover:bg-emerald-300 text-black shadow-lg shadow-emerald-500/25 group border-0 transition-transform active:scale-95"
            >
              <Link to="/mesh">
                Deploy Liquidity <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-14 px-6 text-base font-bold rounded-full border-white/20 bg-black/40 hover:bg-white/10 text-white backdrop-blur-md"
            >
              <Link to="/mesh?tab=leaderboard">
                <Sparkles className="mr-2 w-4 h-4 text-emerald-400" /> Leaderboard
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-14 px-6 text-base font-bold rounded-full border-white/20 bg-black/40 hover:bg-white/10 backdrop-blur-md text-white"
            >
              <Link to="/orderbook">Live Orderbook</Link>
            </Button>
          </div>
        </motion.div>
      </div>

      {/* Downward atmospheric transition into Workflow section */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-b from-transparent via-[#050505]/50 to-[#07090e] pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 via-emerald-500/30 to-transparent pointer-events-none" />
    </section>
  );
}
