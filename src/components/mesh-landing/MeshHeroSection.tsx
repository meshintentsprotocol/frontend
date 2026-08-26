import { motion, useInView } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';
import { ArrowRight, Zap, TrendingUp, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

// Animated fake orderbook data
const BIDS = [
  { price: '324.20', amount: '0.4821', depth: 96 },
  { price: '323.80', amount: '1.2200', depth: 82 },
  { price: '323.40', amount: '0.8900', depth: 68 },
  { price: '323.00', amount: '2.1100', depth: 52 },
  { price: '322.60', amount: '0.3500', depth: 38 },
  { price: '322.20', amount: '1.7700', depth: 24 },
];

const ASKS = [
  { price: '324.60', amount: '0.6100', depth: 94 },
  { price: '325.00', amount: '0.9900', depth: 78 },
  { price: '325.40', amount: '1.4500', depth: 60 },
  { price: '325.80', amount: '0.7800', depth: 44 },
  { price: '326.20', amount: '2.3300', depth: 30 },
  { price: '326.60', amount: '0.5500', depth: 16 },
];

function AnimatedOrderbookCard() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1800);
    return () => clearInterval(t);
  }, []);

  // Slightly jitter prices each tick
  const jitter = (base: string, idx: number) => {
    const n = parseFloat(base);
    const delta = ((tick + idx) % 3 - 1) * 0.02;
    return (n + delta).toFixed(2);
  };

  return (
    <div className="relative w-full max-w-sm mx-auto">
      {/* Glow behind the card */}
      <div className="absolute -inset-4 bg-emerald-500/15 rounded-3xl blur-[40px]" />

      <div className="relative bg-[#0C0C0F] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <img src="/logos/bitcoin-cash-bch-logo.svg" alt="BCH" className="w-5 h-5" />
            <span className="font-bold text-sm text-white">BCH / pUSD</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-mono text-emerald-400">LIVE</span>
          </div>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-3 px-5 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-white/5">
          <span>Price (pUSD)</span>
          <span className="text-center">Amount (BCH)</span>
          <span className="text-right">Depth</span>
        </div>

        {/* Asks (sell side) */}
        <div className="px-2 py-1 space-y-0.5">
          {ASKS.slice().reverse().map((row, i) => (
            <motion.div
              key={i}
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.15 }}
              className="relative grid grid-cols-3 px-3 py-1 rounded-lg overflow-hidden text-xs"
            >
              <div
                className="absolute inset-0 rounded-lg bg-red-500/10"
                style={{ width: `${row.depth}%`, marginLeft: 'auto' }}
              />
              <span className="relative font-mono text-red-400">{jitter(row.price, i)}</span>
              <span className="relative font-mono text-zinc-300 text-center">{row.amount}</span>
              <span className="relative font-mono text-zinc-500 text-right">{row.depth}%</span>
            </motion.div>
          ))}
        </div>

        {/* Spread */}
        <div className="flex items-center justify-center gap-3 py-2 border-y border-white/5 bg-white/[0.02]">
          <span className="text-[11px] font-mono text-zinc-500">Spread</span>
          <span className="text-sm font-black font-mono text-white">$324.40</span>
          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-full border border-emerald-500/30">
            0.12%
          </span>
        </div>

        {/* Bids (buy side) */}
        <div className="px-2 py-1 space-y-0.5">
          {BIDS.map((row, i) => (
            <motion.div
              key={i}
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.2 }}
              className="relative grid grid-cols-3 px-3 py-1 rounded-lg overflow-hidden text-xs"
            >
              <div
                className="absolute inset-0 rounded-lg bg-emerald-500/10"
                style={{ width: `${row.depth}%` }}
              />
              <span className="relative font-mono text-emerald-400">{jitter(row.price, i + 10)}</span>
              <span className="relative font-mono text-zinc-300 text-center">{row.amount}</span>
              <span className="relative font-mono text-zinc-500 text-right">{row.depth}%</span>
            </motion.div>
          ))}
        </div>

        {/* Footer mini-bar */}
        <div className="flex items-center justify-between px-5 py-3 bg-emerald-500/5 border-t border-white/5 text-[10px] font-mono">
          <span className="text-zinc-500">4 Active LP Pools</span>
          <span className="text-emerald-400">↑ 2.4% 24h</span>
        </div>
      </div>
    </div>
  );
}

export function MeshHeroSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  return (
    <section ref={ref} className="relative min-h-[92vh] flex items-center pt-28 pb-20 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[#050505] z-0" />
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-[-15%] left-[-10%] w-[55vw] h-[55vw] bg-emerald-500/8 rounded-full blur-[180px] animate-pulse-glow" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[45vw] h-[45vw] bg-teal-600/8 rounded-full blur-[160px] animate-pulse-glow" style={{ animationDelay: '1s' }} />
        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-15 mix-blend-overlay" />
        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* LEFT — Copy */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="space-y-8"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.1, duration: 0.5 }}
            >
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs font-bold uppercase tracking-widest">
                <Zap className="w-3.5 h-3.5 fill-emerald-400 text-emerald-400" />
                BCH Concentrated Liquidity — CashScript Covenants
              </span>
            </motion.div>

            {/* Headline */}
            <div className="space-y-2">
              <p className="text-base md:text-lg font-medium text-zinc-400 uppercase tracking-widest pl-1">
                Become a
              </p>
              <h1 className="text-5xl sm:text-7xl md:text-8xl font-black tracking-tighter leading-[0.85]">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
                  MARKET
                </span>
                <br />
                <span className="text-white">MAKER</span>
                <br />
                <span className="block mt-2 text-2xl sm:text-4xl md:text-5xl font-bold text-white/80 tracking-tight">
                  on Bitcoin Cash
                </span>
              </h1>
            </div>

            {/* Description */}
            <div className="space-y-4 max-w-xl text-lg text-zinc-400 leading-relaxed border-l-2 border-white/10 pl-6">
              <p>
                <strong className="text-white">BCHMesh</strong> is a non-custodial concentrated liquidity protocol built on CashScript covenants. Deploy capital in one transaction and earn LP fees on every atomic partial fill.
              </p>
              <p>
                Supports <strong className="text-emerald-400">Fixed Rate</strong>, <strong className="text-teal-400">Oracle-Curved</strong>, and <strong className="text-amber-400">Dutch Decay</strong> strategy types. Rebalance your entire grid for sub-cent fees.
              </p>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap gap-6">
              {[
                { icon: <Shield className="w-4 h-4 text-emerald-400" />, label: 'Non-Custodial', sub: 'P2SH32 Covenant' },
                { icon: <Zap className="w-4 h-4 text-teal-400" />, label: '~1,500 sats', sub: 'Per spawn tx' },
                { icon: <TrendingUp className="w-4 h-4 text-amber-400" />, label: '10–100 bps', sub: 'LP fee range' },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-2">
                  {s.icon}
                  <div>
                    <div className="text-sm font-bold text-white">{s.label}</div>
                    <div className="text-[11px] text-zinc-500 font-mono">{s.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="pt-2 flex flex-wrap gap-3">
              <Link
                to="/mesh"
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-black text-base rounded-2xl shadow-lg shadow-emerald-500/20 transition-all hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.99]"
              >
                Launch App <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/orderbook"
                className="inline-flex items-center gap-2 px-7 py-3.5 border-2 border-white/20 hover:border-white/50 text-white font-bold text-base rounded-2xl transition-all hover:bg-white/5"
              >
                Live Orderbook
              </Link>
            </div>
          </motion.div>

          {/* RIGHT — Animated Orderbook */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.25, ease: 'easeOut' }}
          >
            <AnimatedOrderbookCard />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
