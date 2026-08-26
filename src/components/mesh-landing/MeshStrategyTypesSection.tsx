import { motion, useInView, useMotionValue, useSpring } from 'framer-motion';
import { useRef } from 'react';
import { TrendingUp, Activity, RotateCcw, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface SparklineProps {
  path: string;
  color: string;
  inView: boolean;
}

function Sparkline({ path, color, inView }: SparklineProps) {
  return (
    <svg viewBox="0 0 200 60" className="w-full h-14" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`spark-fill-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Fill area */}
      <motion.path
        d={`${path} L 200 60 L 0 60 Z`}
        fill={`url(#spark-fill-${color})`}
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ delay: 0.4, duration: 0.6 }}
      />
      {/* Line */}
      <motion.path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={inView ? { pathLength: 1 } : {}}
        transition={{ duration: 1.2, ease: 'easeInOut', delay: 0.2 }}
      />
    </svg>
  );
}

const STRATEGIES = [
  {
    id: 'fixed-rate',
    icon: TrendingUp,
    title: 'Fixed Rate',
    subtitle: 'Straight Covenant',
    covenant: 'StrategyCovenant',
    description: 'Set a fixed exchange rate. Your liquidity fills at exactly your specified price — no slippage, no curve math.',
    tagline: 'Predictable. Simple. On-chain.',
    sparkPath: 'M 0 40 L 40 40 L 80 40 L 120 40 L 160 40 L 200 40',
    sparkColor: '#34d399',
    accent: 'emerald',
    borderGlow: 'hover:shadow-emerald-500/20',
    badgeBg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    iconBg: 'bg-emerald-500/15 text-emerald-400',
    gradientBorder: 'hover:border-emerald-500/40',
    pillColor: 'from-emerald-500 to-teal-500',
  },
  {
    id: 'oracle-curved',
    icon: Activity,
    title: 'Oracle Curved',
    subtitle: 'Oracle Strategy Covenant',
    covenant: 'OracleStrategyCovenant',
    description: 'Tracks live Cauldron DEX spot prices. Adjusts your rate dynamically based on oracle data — never stale.',
    tagline: 'Dynamic. Oracle-driven. Real-time.',
    sparkPath: 'M 0 55 C 30 50, 50 35, 80 28 S 130 20, 160 18 L 200 15',
    sparkColor: '#2dd4bf',
    accent: 'teal',
    borderGlow: 'hover:shadow-teal-500/20',
    badgeBg: 'bg-teal-500/10 text-teal-300 border-teal-500/20',
    iconBg: 'bg-teal-500/15 text-teal-400',
    gradientBorder: 'hover:border-teal-500/40',
    pillColor: 'from-teal-500 to-cyan-500',
  },
  {
    id: 'dutch-decay',
    icon: RotateCcw,
    title: 'Dutch Decay',
    subtitle: 'Dutch Decay Covenant',
    covenant: 'DutchDecayStrategyCovenant',
    description: 'Price decays over time from a ceiling to a floor. First taker to match wins — ideal for time-sensitive liquidations.',
    tagline: 'Time-weighted. Auction-style. Fair.',
    sparkPath: 'M 0 5 C 40 8, 70 20, 100 35 S 160 52, 200 58',
    sparkColor: '#fbbf24',
    accent: 'amber',
    borderGlow: 'hover:shadow-amber-500/20',
    badgeBg: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    iconBg: 'bg-amber-500/15 text-amber-400',
    gradientBorder: 'hover:border-amber-500/40',
    pillColor: 'from-amber-500 to-orange-500',
  },
];

export function MeshStrategyTypesSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section ref={ref} className="relative py-24 lg:py-32 bg-[#0D0D0E] overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-emerald-500/4 rounded-full blur-[140px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-amber-500/4 rounded-full blur-[120px]" />
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
            Strategy Types
          </span>
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-white">
            Pick Your{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-400 to-amber-400">
              Curve
            </span>
          </h2>
          <p className="mt-4 text-lg text-zinc-400 max-w-xl mx-auto">
            Three non-custodial covenant types. Each backed by a verifiable CashScript contract deployed to the BCH chain.
          </p>
        </motion.div>

        {/* Cards grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {STRATEGIES.map((s, idx) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 40 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: idx * 0.12, ease: 'easeOut' }}
                className={`group relative flex flex-col rounded-3xl border border-white/5 bg-[#0C0C0F] backdrop-blur-xl overflow-hidden transition-all duration-500 hover:shadow-2xl ${s.borderGlow} ${s.gradientBorder} hover:-translate-y-1`}
              >
                {/* Card top bar gradient */}
                <div className={`h-[2px] w-full bg-gradient-to-r ${s.pillColor} opacity-60 group-hover:opacity-100 transition-opacity`} />

                <div className="flex flex-col flex-1 p-6">
                  {/* Icon + badge row */}
                  <div className="flex items-start justify-between mb-5">
                    <div className={`w-12 h-12 rounded-2xl ${s.iconBg} flex items-center justify-center`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${s.badgeBg}`}>
                      {s.subtitle}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-xl font-black text-white mb-1">{s.title}</h3>
                  <p className="text-xs font-mono text-zinc-500 mb-4">{s.covenant}</p>

                  {/* Description */}
                  <p className="text-sm text-zinc-400 leading-relaxed flex-1">{s.description}</p>

                  {/* Sparkline */}
                  <div className="mt-5 rounded-xl bg-white/[0.02] border border-white/5 px-3 pt-3 pb-1 overflow-hidden">
                    <Sparkline path={s.sparkPath} color={s.sparkColor} inView={inView} />
                    <p className="text-[10px] font-mono text-zinc-600 text-right pb-1">{s.tagline}</p>
                  </div>

                  {/* CTA */}
                  <Link
                    to="/mesh"
                    className={`mt-5 inline-flex items-center gap-2 text-sm font-bold bg-gradient-to-r ${s.pillColor} bg-clip-text text-transparent hover:gap-3 transition-all duration-300 group/link`}
                  >
                    Try this Strategy
                    <ArrowRight className={`w-4 h-4 ${s.accent === 'emerald' ? 'text-emerald-400' : s.accent === 'teal' ? 'text-teal-400' : 'text-amber-400'} group-hover/link:translate-x-1 transition-transform`} />
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
