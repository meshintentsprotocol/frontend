import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { ArrowRight, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

export function MeshCTASection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section ref={ref} className="relative py-24 lg:py-32 bg-[#050505] overflow-hidden">
      {/* Background orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] bg-emerald-500/5 rounded-full blur-[200px]" />
        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-10 mix-blend-overlay" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="relative max-w-4xl mx-auto"
        >
          {/* Rotating conic gradient border */}
          <div
            className="absolute -inset-[1.5px] rounded-[28px] z-0"
            style={{
              background: 'conic-gradient(from var(--angle), transparent 20%, #34d39950 40%, #2dd4bf80 50%, #34d39950 60%, transparent 80%)',
              animation: 'cta-border-spin 6s linear infinite',
            }}
          />

          {/* Inner card */}
          <div className="relative z-10 rounded-[26px] bg-[#0A0A0D] border border-white/5 overflow-hidden">
            {/* Top gradient strip */}
            <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />

            {/* Particle dots — purely decorative */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {Array.from({ length: 18 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute w-1 h-1 rounded-full bg-emerald-500/30"
                  style={{
                    left: `${5 + (i * 13) % 90}%`,
                    top: `${10 + (i * 17) % 80}%`,
                    animation: `dot-pulse ${2 + (i % 3)}s ease-in-out ${i * 0.3}s infinite`,
                  }}
                />
              ))}
            </div>

            <div className="px-8 py-16 md:px-16 md:py-20 text-center relative z-10">
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.15, duration: 0.5 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-[11px] font-bold uppercase tracking-widest text-emerald-300 mb-8"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Non-Custodial Liquidity Protocol
              </motion.div>

              {/* Headline */}
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter text-white mb-6"
              >
                Ready to Provide{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
                  Liquidity?
                </span>
              </motion.h2>

              {/* Subtext */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed"
              >
                One transaction. Non-custodial. Atomic partial fills.{' '}
                <strong className="text-white">No permission needed.</strong>{' '}
                Deploy your first BCHMesh covenant in under 60 seconds.
              </motion.p>

              {/* Feature pills */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="flex flex-wrap items-center justify-center gap-3 mb-10"
              >
                {['Fixed Rate', 'Oracle Curved', 'Dutch Decay', '~1,500 sats/tx', 'P2SH32'].map(tag => (
                  <span key={tag} className="px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-xs font-semibold text-zinc-400">
                    {tag}
                  </span>
                ))}
              </motion.div>

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.45, duration: 0.6 }}
                className="flex flex-col sm:flex-row items-center justify-center gap-4"
              >
                <Link
                  to="/mesh"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-black text-base rounded-2xl shadow-xl shadow-emerald-500/25 transition-all hover:shadow-emerald-500/50 hover:scale-[1.03] active:scale-[0.99]"
                >
                  Launch BCHMesh App <ArrowRight className="w-5 h-5" />
                </Link>
                <Link
                  to="/orderbook"
                  className="inline-flex items-center gap-2 px-8 py-4 border-2 border-white/15 hover:border-emerald-500/40 text-white font-bold text-base rounded-2xl transition-all hover:bg-emerald-500/5 hover:shadow-[0_0_20px_rgba(52,211,153,0.1)]"
                >
                  <BookOpen className="w-4 h-4 text-zinc-400" />
                  View Live Orderbook
                </Link>
              </motion.div>
            </div>

            {/* Bottom gradient strip */}
            <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-teal-500/30 to-transparent" />
          </div>
        </motion.div>
      </div>

      <style>{`
        @property --angle {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }
        @keyframes cta-border-spin {
          to { --angle: 360deg; }
        }
        @keyframes dot-pulse {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.5); }
        }
      `}</style>
    </section>
  );
}
