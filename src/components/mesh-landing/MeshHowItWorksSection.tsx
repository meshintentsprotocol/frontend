import { motion, useInView } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';
import { Settings2, Zap, Coins } from 'lucide-react';

const STEPS = [
  {
    num: '01',
    icon: Settings2,
    title: 'Choose Strategy',
    description: 'Select Fixed Rate, Oracle Spot, or Dutch Decay. Set your price curve and fee tier in seconds.',
    color: 'emerald',
    gradient: 'from-emerald-500/20 to-emerald-600/5',
    border: 'border-emerald-500/30',
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-400',
    numColor: 'text-emerald-500/40',
  },
  {
    num: '02',
    icon: Zap,
    title: 'Deploy Covenant',
    description: 'Funds lock on-chain in a non-custodial P2SH32 CashScript contract — one atomic BCH transaction.',
    color: 'teal',
    gradient: 'from-teal-500/20 to-teal-600/5',
    border: 'border-teal-500/30',
    iconBg: 'bg-teal-500/15',
    iconColor: 'text-teal-400',
    numColor: 'text-teal-500/40',
  },
  {
    num: '03',
    icon: Coins,
    title: 'Earn Fees Automatically',
    description: 'Takers submit intents, your pool fills partial or full amounts. LP fees accumulate and dock anytime.',
    color: 'cyan',
    gradient: 'from-cyan-500/20 to-cyan-600/5',
    border: 'border-cyan-500/30',
    iconBg: 'bg-cyan-500/15',
    iconColor: 'text-cyan-400',
    numColor: 'text-cyan-500/40',
  },
];

function DashedConnector({ active }: { active: boolean }) {
  return (
    <div className="hidden lg:flex items-center justify-center w-20 shrink-0 mt-[-24px] relative">
      <svg width="80" height="2" viewBox="0 0 80 2" fill="none" className="overflow-visible">
        <line
          x1="0" y1="1" x2="80" y2="1"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1.5"
          strokeDasharray="5 4"
        />
        {active && (
          <motion.line
            x1="0" y1="1" x2="80" y2="1"
            stroke="rgb(52,211,153)"
            strokeWidth="1.5"
            strokeDasharray="5 4"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
          />
        )}
      </svg>
      {/* Arrow tip */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0"
        style={{
          borderTop: '4px solid transparent',
          borderBottom: '4px solid transparent',
          borderLeft: `6px solid ${active ? 'rgb(52,211,153)' : 'rgba(255,255,255,0.1)'}`,
          transition: 'border-left-color 0.3s',
        }}
      />
    </div>
  );
}

export function MeshHowItWorksSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });
  const [activeStep, setActiveStep] = useState(0);

  // Cycle through steps
  useEffect(() => {
    if (!inView) return;
    const id = setInterval(() => setActiveStep(s => (s + 1) % STEPS.length), 1800);
    return () => clearInterval(id);
  }, [inView]);

  return (
    <section ref={ref} className="relative py-24 lg:py-32 bg-[#050505] overflow-hidden">
      {/* Background orb */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-500/5 rounded-full blur-[160px]" />
        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-10 mix-blend-overlay" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16 lg:mb-20"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/[0.03] text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-6">
            How It Works
          </span>
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-white">
            Three Steps to{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
              Liquidity
            </span>
          </h2>
          <p className="mt-4 text-lg text-zinc-400 max-w-xl mx-auto">
            Deploy concentrated liquidity on Bitcoin Cash without giving up custody of your funds.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="flex flex-col lg:flex-row items-stretch justify-center gap-0 lg:gap-0">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isActive = activeStep === idx;
            return (
              <div key={idx} className="flex flex-col lg:flex-row items-center">
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.6, delay: idx * 0.15, ease: 'easeOut' }}
                  className={`relative w-full lg:w-72 xl:w-80 flex-1 lg:flex-none rounded-3xl border bg-gradient-to-br ${step.gradient} backdrop-blur-xl p-7 transition-all duration-500 cursor-default
                    ${isActive ? step.border + ' shadow-lg' : 'border-white/5'}
                  `}
                >
                  {/* Step number watermark */}
                  <span className={`absolute top-4 right-5 font-black text-6xl leading-none select-none pointer-events-none ${step.numColor}`}>
                    {step.num}
                  </span>

                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-2xl ${step.iconBg} flex items-center justify-center mb-5 border ${step.border}`}>
                    <Icon className={`w-6 h-6 ${step.iconColor}`} />
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-black text-white mb-2">{step.title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">{step.description}</p>

                  {/* Active indicator bar */}
                  <div className="mt-5 h-[2px] rounded-full bg-white/5 overflow-hidden">
                    <motion.div
                      className={`h-full bg-gradient-to-r ${idx === 0 ? 'from-emerald-400 to-teal-400' : idx === 1 ? 'from-teal-400 to-cyan-400' : 'from-cyan-400 to-emerald-400'}`}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: isActive ? 1 : 0 }}
                      transition={{ duration: 1.6, ease: 'linear' }}
                      style={{ originX: 0 }}
                    />
                  </div>
                </motion.div>

                {/* Connector between cards */}
                {idx < STEPS.length - 1 && (
                  <DashedConnector active={activeStep > idx} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
