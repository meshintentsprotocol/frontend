import { motion, useInView } from 'framer-motion';
import { useRef, useState, useEffect, type ReactNode } from 'react';
import { Shield, Zap, Layers, Activity } from 'lucide-react';

// Animated sats counter
function SatsCounter({ target, inView }: { target: number; inView: boolean }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const duration = 1200;
    const start = Date.now();
    const step = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, target]);

  return <span className="font-black font-mono text-3xl text-white">~{value.toLocaleString()}</span>;
}

// Animated fill bar
function FillBar({ inView }: { inView: boolean }) {
  const segments = [
    { pct: 72, label: 'Your Pool (Partial Fill)', color: 'bg-emerald-500' },
    { pct: 28, label: 'Remainder (Auto-Recoined)', color: 'bg-teal-600/50' },
  ];
  return (
    <div className="space-y-2 mt-2">
      {segments.map((seg, i) => (
        <div key={i}>
          <div className="flex justify-between text-[10px] font-mono text-zinc-500 mb-1">
            <span>{seg.label}</span>
            <span>{seg.pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${seg.color}`}
              initial={{ width: 0 }}
              animate={inView ? { width: `${seg.pct}%` } : {}}
              transition={{ duration: 1.0, delay: 0.3 + i * 0.2, ease: 'easeOut' }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// Scrolling price feed
function PriceFeed() {
  const rows = [
    { pair: 'BCH/pUSD', price: '324.40', change: '+2.4%', up: true },
    { pair: 'BCH/mUSD', price: '323.91', change: '+1.8%', up: true },
    { pair: 'pUSD/BCH', price: '0.003082', change: '-0.1%', up: false },
    { pair: 'BCH/pUSD', price: '324.55', change: '+2.5%', up: true },
    { pair: 'BCH/mUSD', price: '323.88', change: '+1.7%', up: true },
  ];

  return (
    <div className="relative overflow-hidden h-24 mt-3">
      <div
        className="absolute inset-0 flex flex-col gap-1.5"
        style={{ animation: 'feed-scroll 4s linear infinite' }}
      >
        {[...rows, ...rows].map((r, i) => (
          <div key={i} className="flex items-center justify-between text-xs shrink-0">
            <span className="font-mono text-zinc-400">{r.pair}</span>
            <span className="font-mono font-bold text-white">{r.price}</span>
            <span className={`font-mono text-[11px] ${r.up ? 'text-emerald-400' : 'text-red-400'}`}>{r.change}</span>
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-[#0C1610] to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-[#0C1610] to-transparent pointer-events-none" />
      <style>{`
        @keyframes feed-scroll {
          0%   { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
      `}</style>
    </div>
  );
}

// ─── Card A: Non-Custodial ─────────────────────────────────────────────────
function CardNonCustodial() {
  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm text-zinc-400 leading-relaxed">
        Your keys, your funds. The covenant contract lives on-chain and{' '}
        <strong className="text-white">only you can dock</strong> (withdraw).
        No admin keys. No upgradeable proxies. Pure CashScript logic.
      </p>
      <div className="flex flex-wrap gap-2 mt-4">
        {['P2SH32', 'CashScript', 'Non-upgradeable'].map(tag => (
          <span key={tag} className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/15">
            {tag}
          </span>
        ))}
      </div>
      <div className="relative flex items-center justify-center h-20 mt-2">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center animate-pulse">
          <Shield className="w-8 h-8 text-emerald-400" />
        </div>
        <div className="absolute inset-0 rounded-full bg-emerald-500/5 animate-ping" style={{ animationDuration: '2s' }} />
      </div>
    </div>
  );
}

// ─── Card B: Sub-Cent Fees ─────────────────────────────────────────────────
function CardSubCentFees({ inView }: { inView: boolean }) {
  return (
    <div className="mt-3">
      <SatsCounter target={1500} inView={inView} />
      <p className="text-xs text-zinc-500 mt-1">sats per spawn transaction</p>
      <p className="text-sm text-zinc-400 mt-3">
        Rebalance an entire grid in one flat tx. No gas auctions. No priority fees.
      </p>
    </div>
  );
}

// ─── Card C: Partial Fill ──────────────────────────────────────────────────
function CardPartialFill({ inView }: { inView: boolean }) {
  return (
    <div className="mt-3">
      <p className="text-sm text-zinc-400">
        Takers can partially fill your pool. The remainder{' '}
        <strong className="text-white">auto-recreates</strong> the covenant UTXO.
      </p>
      <FillBar inView={inView} />
    </div>
  );
}

// ─── Card D: Live Oracle ───────────────────────────────────────────────────
function CardLiveOracle() {
  return (
    <div className="mt-3 grid sm:grid-cols-2 gap-4">
      <p className="text-sm text-zinc-400 leading-relaxed">
        Tracks <strong className="text-white">Cauldron DEX spot prices</strong> and Pyth oracle feeds
        in real-time. Your Oracle Curved strategy adapts dynamically — always competitive, never stale.
      </p>
      <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/10 px-3 py-2 overflow-hidden">
        <p className="text-[10px] font-mono text-emerald-400 mb-1 uppercase tracking-widest">Live Prices</p>
        <PriceFeed />
      </div>
    </div>
  );
}

// ─── Shared card shell props ───────────────────────────────────────────────
interface BentoCardProps {
  icon: ReactNode;
  title: string;
  iconBg: string;
  border: string;
  glow: string;
  children: ReactNode;
  className?: string;
  delay?: number;
  inView: boolean;
  animDir?: 'left' | 'right' | 'up';
}

function BentoCard({ icon, title, iconBg, border, glow, children, className = '', delay = 0, inView, animDir = 'up' }: BentoCardProps) {
  const initial = animDir === 'left' ? { opacity: 0, x: -30 } : animDir === 'right' ? { opacity: 0, x: 30 } : { opacity: 0, y: 30 };
  return (
    <motion.div
      initial={initial}
      animate={inView ? { opacity: 1, x: 0, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: 'easeOut' }}
      className={`rounded-3xl border bg-[#0C0C0F] backdrop-blur-xl p-6 transition-all duration-500 shadow-lg ${border} ${glow} ${className}`}
    >
      <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center mb-4`}>
        {icon}
      </div>
      <h3 className="text-xl font-black text-white mb-1">{title}</h3>
      {children}
    </motion.div>
  );
}

export function MeshBenefitsSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section ref={ref} className="relative py-24 lg:py-32 bg-[#0D0D0E] overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 left-1/3 w-[500px] h-[500px] bg-emerald-500/4 rounded-full blur-[150px]" />
        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-10 mix-blend-overlay" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/[0.03] text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-6">
            Why BCHMesh
          </span>
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-white">
            Built for{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
              Real LPs
            </span>
          </h2>
          <p className="mt-4 text-lg text-zinc-400 max-w-xl mx-auto">
            No custodians. No wrapped tokens. No permission needed. Just your capital, on-chain, earning.
          </p>
        </motion.div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Row 1 left: tall card (Non-Custodial) — spans 2 rows */}
          <BentoCard
            inView={inView}
            delay={0}
            animDir="left"
            icon={<Shield className="w-5 h-5 text-emerald-400" />}
            title="Non-Custodial"
            iconBg="bg-emerald-500/10"
            border="border-emerald-500/10 hover:border-emerald-500/30"
            glow="hover:shadow-emerald-500/10"
            className="md:row-span-2"
          >
            <CardNonCustodial />
          </BentoCard>

          {/* Row 1 right: Sub-Cent Fees */}
          <BentoCard
            inView={inView}
            delay={0.1}
            animDir="right"
            icon={<Zap className="w-5 h-5 text-teal-400" />}
            title="Sub-Cent Fees"
            iconBg="bg-teal-500/10"
            border="border-teal-500/10 hover:border-teal-500/30"
            glow="hover:shadow-teal-500/10"
          >
            <CardSubCentFees inView={inView} />
          </BentoCard>

          {/* Row 2 right: Partial Fill */}
          <BentoCard
            inView={inView}
            delay={0.18}
            animDir="right"
            icon={<Layers className="w-5 h-5 text-cyan-400" />}
            title="Partial Fill Support"
            iconBg="bg-cyan-500/10"
            border="border-cyan-500/10 hover:border-cyan-500/30"
            glow="hover:shadow-cyan-500/10"
          >
            <CardPartialFill inView={inView} />
          </BentoCard>

          {/* Row 3: Wide card — Oracle (spans 2 cols) */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.26, ease: 'easeOut' }}
            className="md:col-span-2 rounded-3xl border border-amber-500/10 hover:border-amber-500/30 bg-gradient-to-br from-[#0C1610] to-[#0C0C0F] backdrop-blur-xl p-6 transition-all duration-500 shadow-lg hover:shadow-amber-500/10"
          >
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <Activity className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-black text-white mb-1">Live Oracle Integration</h3>
                <CardLiveOracle />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
