import { motion, useInView, AnimatePresence } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';
import {
  ArrowRight,
  Zap,
  TrendingUp,
  Shield,
  Layers,
  Sparkles,
  RefreshCw,
  Sliders,
  DollarSign,
  Activity,
  CheckCircle2,
  Lock,
  Flame,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ─── Interactive Multi-Market Orbital Card ────────────────────────────────────

function MultiMarketMeshCard() {
  const [activeTab, setActiveTab] = useState<'mesh' | 'orderbook' | 'recycling'>('mesh');
  const [bchDeposit, setBchDeposit] = useState<number>(10);
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);

  // Auto cycle active route animation
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveRouteIndex((prev) => (prev + 1) % 3);
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  const bchPrice = 324.4;
  const pairValue = (bchDeposit * bchPrice).toLocaleString(undefined, { maximumFractionDigits: 0 });
  const totalVirtualDepth = (bchDeposit * bchPrice * 3).toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <div className="relative w-full max-w-lg mx-auto">
      {/* Ambient Backlight Glow */}
      <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-violet-500/20 rounded-3xl blur-[45px] pointer-events-none" />

      <div className="relative bg-[#0c0c10] border border-white/12 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-2xl">
        {/* Card Header & Tabs */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/8 bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-mono text-xs font-bold text-white tracking-wide">
              BCHMesh <span className="text-emerald-400">v1.0 Live</span>
            </span>
          </div>

          <div className="flex bg-black/60 p-1 rounded-xl border border-white/6 text-[11px] font-medium">
            <button
              onClick={() => setActiveTab('mesh')}
              className={cn(
                'px-2.5 py-1 rounded-lg transition-all',
                activeTab === 'mesh' ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30' : 'text-zinc-400 hover:text-white',
              )}
            >
              100% Shared Mesh
            </button>
            <button
              onClick={() => setActiveTab('orderbook')}
              className={cn(
                'px-2.5 py-1 rounded-lg transition-all',
                activeTab === 'orderbook' ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30' : 'text-zinc-400 hover:text-white',
              )}
            >
              Live Depth
            </button>
            <button
              onClick={() => setActiveTab('recycling')}
              className={cn(
                'px-2.5 py-1 rounded-lg transition-all',
                activeTab === 'recycling' ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30' : 'text-zinc-400 hover:text-white',
              )}
            >
              Recycling
            </button>
          </div>
        </div>

        {/* Tab 1: 100% Shared Mesh Orbital Visualizer */}
        <AnimatePresence mode="wait">
          {activeTab === 'mesh' && (
            <motion.div
              key="mesh"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 space-y-6"
            >
              {/* Deposit Banner */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20">
                <div>
                  <div className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest font-semibold">
                    Single-Asset Deposit (Pure BCH)
                  </div>
                  <div className="text-2xl font-black font-mono text-white flex items-center gap-2 mt-0.5">
                    <span>{bchDeposit} BCH</span>
                    <span className="text-xs text-zinc-400 font-normal">(${(bchDeposit * bchPrice).toLocaleString()})</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest font-semibold">
                    Virtual Multiplier
                  </div>
                  <div className="text-2xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                    3× Depth
                  </div>
                </div>
              </div>

              {/* 3 Simultaneous 100% Backed Routes */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 px-1">
                  <span>100% Shared Across Configured Routes</span>
                  <span className="text-emerald-400 font-semibold">No Balance Splitting</span>
                </div>

                {[
                  { pair: 'BCH ➔ pUSD', name: 'USDC-Pegged Stablecoin', pct: '100%', val: `$${pairValue}`, color: 'emerald', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' },
                  { pair: 'BCH ➔ mUSD', name: 'Algorithmic Dollar', pct: '100%', val: `$${pairValue}`, color: 'cyan', border: 'border-cyan-500/30', bg: 'bg-cyan-500/10' },
                  { pair: 'BCH ➔ FUR', name: 'Ecosystem Utility Token', pct: '100%', val: `$${pairValue}`, color: 'violet', border: 'border-violet-500/30', bg: 'bg-violet-500/10' },
                ].map((route, i) => (
                  <motion.div
                    key={route.pair}
                    animate={{
                      scale: activeRouteIndex === i ? 1.02 : 1,
                      borderColor: activeRouteIndex === i ? 'rgba(52, 211, 153, 0.6)' : 'rgba(255, 255, 255, 0.08)',
                    }}
                    transition={{ duration: 0.3 }}
                    className={cn(
                      'p-3.5 rounded-2xl border transition-all flex items-center justify-between',
                      activeRouteIndex === i ? 'bg-white/[0.06] shadow-lg shadow-emerald-500/10' : 'bg-white/[0.02]',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center font-mono text-xs font-bold', route.bg, `text-${route.color}-400`)}>
                        {i + 1}
                      </div>
                      <div>
                        <div className="text-sm font-bold font-mono text-white flex items-center gap-2">
                          {route.pair}
                          {activeRouteIndex === i && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold uppercase">
                              Active Route
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-500">{route.name}</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-black font-mono text-emerald-400">{route.pct} Backed</div>
                      <div className="text-xs font-mono text-zinc-400">{route.val} depth</div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Total virtual depth ticker */}
              <div className="p-3.5 rounded-2xl bg-black/50 border border-white/8 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-zinc-400 font-medium">
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Total Virtual Market Depth:</span>
                </div>
                <div className="font-mono font-black text-white text-sm">
                  ${totalVirtualDepth}{' '}
                  <span className="text-emerald-400 text-xs font-semibold">({bchDeposit * 3} BCH eq)</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Tab 2: Live Concentrated Orderbook */}
          {activeTab === 'orderbook' && (
            <motion.div
              key="orderbook"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-5 space-y-3"
            >
              <div className="grid grid-cols-3 text-[10px] font-mono font-semibold text-zinc-500 uppercase px-2">
                <span>Price (pUSD)</span>
                <span className="text-center">Size (BCH)</span>
                <span className="text-right">Route Depth</span>
              </div>

              <div className="space-y-1">
                {[
                  { price: '325.80', size: '1.45', depth: '92%', type: 'ask' },
                  { price: '325.20', size: '2.10', depth: '78%', type: 'ask' },
                  { price: '324.80', size: '0.85', depth: '64%', type: 'ask' },
                ].map((row, i) => (
                  <div key={i} className="relative grid grid-cols-3 px-3 py-1 rounded-lg text-xs font-mono overflow-hidden">
                    <div className="absolute inset-0 bg-red-500/10" style={{ width: row.depth, marginLeft: 'auto' }} />
                    <span className="relative text-red-400">{row.price}</span>
                    <span className="relative text-zinc-300 text-center">{row.size}</span>
                    <span className="relative text-zinc-500 text-right">{row.depth}</span>
                  </div>
                ))}
              </div>

              <div className="py-2 border-y border-white/5 bg-white/[0.02] flex items-center justify-between px-3 text-xs font-mono">
                <span className="text-zinc-500">Spot Midpoint</span>
                <span className="font-bold text-white">$324.40</span>
                <span className="text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 text-[10px]">
                  0.08% spread
                </span>
              </div>

              <div className="space-y-1">
                {[
                  { price: '324.00', size: '1.15', depth: '65%', type: 'bid' },
                  { price: '323.60', size: '2.80', depth: '80%', type: 'bid' },
                  { price: '323.00', size: '3.50', depth: '95%', type: 'bid' },
                ].map((row, i) => (
                  <div key={i} className="relative grid grid-cols-3 px-3 py-1 rounded-lg text-xs font-mono overflow-hidden">
                    <div className="absolute inset-0 bg-emerald-500/10" style={{ width: row.depth }} />
                    <span className="relative text-emerald-400">{row.price}</span>
                    <span className="relative text-zinc-300 text-center">{row.size}</span>
                    <span className="relative text-zinc-500 text-right">{row.depth}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Tab 3: Recycling & Sub-Cent Rebalancing */}
          {activeTab === 'recycling' && (
            <motion.div
              key="recycling"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 space-y-5"
            >
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" style={{ animationDuration: '8s' }} />
                  Infinite Recycled Liquidity Loop
                </h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  When a taker fills a portion of your strategy, the remaining balance is automatically recreated as a new covenant UTXO. Rebalance your entire grid for under $0.01 flat.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/8 text-center">
                  <div className="text-xl font-black font-mono text-emerald-400">~1,500 sats</div>
                  <div className="text-[11px] text-zinc-500 mt-1">Bulk Rebalance Fee</div>
                </div>
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/8 text-center">
                  <div className="text-xl font-black font-mono text-cyan-400">&lt; 1 Block</div>
                  <div className="text-[11px] text-zinc-500 mt-1">Settlement Speed</div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/15 space-y-2 text-xs font-mono text-zinc-300">
                <div className="flex items-center justify-between text-emerald-400 font-bold">
                  <span>Atomic Recoined UTXO</span>
                  <span>100% Non-Custodial</span>
                </div>
                <div className="text-[11px] text-zinc-400">
                  Taker fill: 2.5 BCH ➔ Remainder 7.5 BCH auto-spawned into next price rung with 0 admin fees.
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Interactive Slider Footer */}
        <div className="p-5 bg-white/[0.02] border-t border-white/8 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400 font-medium flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-emerald-400" /> Simulate Deposit Amount:
            </span>
            <span className="font-mono font-bold text-white">{bchDeposit} BCH</span>
          </div>

          <input
            type="range"
            min="1"
            max="50"
            value={bchDeposit}
            onChange={(e) => setBchDeposit(Number(e.target.value))}
            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-400"
          />

          <div className="flex justify-between text-[10px] font-mono text-zinc-500">
            <span>1 BCH ($324)</span>
            <span>25 BCH ($8,110)</span>
            <span>50 BCH ($16,220)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Hero Section ─────────────────────────────────────────────────────────────

export function MeshHeroSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  return (
    <section ref={ref} className="relative min-h-[94vh] flex items-center pt-32 pb-20 overflow-hidden">
      {/* Ambient background & gradient lighting */}
      <div className="absolute inset-0 bg-[#050505] z-0" />
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[55vw] h-[55vw] bg-emerald-500/10 rounded-full blur-[180px] animate-pulse-glow" />
        <div className="absolute top-[30%] right-[-10%] w-[45vw] h-[45vw] bg-teal-500/10 rounded-full blur-[170px] animate-pulse-glow delay-1000" />
        <div className="absolute bottom-[-15%] left-[20%] w-[50vw] h-[50vw] bg-violet-500/8 rounded-full blur-[190px] animate-pulse-glow delay-500" />
        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-15 mix-blend-overlay" />
        {/* Fine grid lines */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="container mx-auto px-4 relative z-10 max-w-7xl">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-14 items-center">
          {/* LEFT COLUMN — Copy & Value Prop (7 cols) */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="lg:col-span-7 space-y-8"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.1, duration: 0.5 }}
            >
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-bold uppercase tracking-widest backdrop-blur-md">
                <Zap className="w-3.5 h-3.5 fill-emerald-400 text-emerald-400" />
                Mode 4: 100% Shared Multi-Market Liquidity • CashScript
              </span>
            </motion.div>

            {/* Headline */}
            <div className="space-y-3">
              <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.02]">
                Single-Asset Concentrated Liquidity on{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
                  Bitcoin Cash
                </span>
              </h1>
              <p className="text-lg sm:text-xl text-zinc-400 leading-relaxed max-w-2xl font-normal">
                Deploy 100% of your pure BCH deposit across every market simultaneously.
                Eliminate paired token inventory, eliminate impermanent loss, and rebalance your entire grid for sub-cent fees.
              </p>
            </div>

            {/* Core Feature Bullet Highlights */}
            <div className="grid sm:grid-cols-2 gap-3.5 max-w-xl text-sm">
              {[
                { label: '100% Shared Multi-Market Depth', desc: 'Single deposit active across all trading pairs simultaneously' },
                { label: 'Sub-Cent ($0.01) Rebalances', desc: 'Re-center 20+ grid levels in 1 flat-fee transaction' },
                { label: 'Zero Paired Inventory Needed', desc: 'Hold pure BCH — never get stuck holding decaying tokens' },
                { label: 'Non-Custodial P2SH32 Covenants', desc: 'Stateless CashScript smart contracts with zero admin keys' },
              ].map((f, i) => (
                <div key={i} className="flex items-start gap-2.5 p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-white text-xs">{f.label}</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5 leading-snug">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap gap-4 pt-2">
              <Button
                asChild
                size="lg"
                className="h-14 px-8 text-base font-bold rounded-full bg-emerald-400 hover:bg-emerald-300 text-black shadow-lg shadow-emerald-500/20 group"
              >
                <Link to="/mesh">
                  Deploy Liquidity <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-14 px-8 text-base font-bold rounded-full border-white/20 bg-white/5 hover:bg-white/10 backdrop-blur-md text-white"
              >
                <Link to="/orderbook">View Live Orderbook</Link>
              </Button>
            </div>
          </motion.div>

          {/* RIGHT COLUMN — Multi-Market Interactive Visualizer (5 cols) */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
            className="lg:col-span-5"
          >
            <MultiMarketMeshCard />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

