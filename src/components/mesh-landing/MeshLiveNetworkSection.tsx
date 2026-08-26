import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

const TOKENS = [
  { symbol: 'BCH', name: 'Bitcoin Cash', logo: '/logos/bitcoin-cash-bch-logo.svg', live: true, change: '+2.4%', changeUp: true },
  { symbol: 'pUSD', name: 'Cauldron pUSD', logo: '/logos/cauldron.png', live: true, change: '+0.1%', changeUp: true },
  { symbol: 'mUSD', name: 'Cauldron mUSD', logo: '/logos/cauldron.png', live: true, change: '-0.2%', changeUp: false },
  { symbol: 'BTC', name: 'Bitcoin', logo: '/logos/bitcoin-btc-logo.svg', live: false, change: '+1.1%', changeUp: true },
  { symbol: 'ETH', name: 'Ethereum', logo: '/logos/ethereum-eth-logo.svg', live: false, change: '+0.8%', changeUp: true },
  { symbol: 'SOL', name: 'Solana', logo: '/logos/solana.svg', live: false, change: '-0.5%', changeUp: false },
];

// Orbit ring configurations
const ORBITS = [
  { radius: 155, speed: '18s', tokens: [TOKENS[1], TOKENS[4]], startAngle: 30 },
  { radius: 225, speed: '28s', tokens: [TOKENS[2], TOKENS[3], TOKENS[5]], startAngle: 80 },
  { radius: 295, speed: '40s', tokens: [TOKENS[0]], startAngle: 200 },
];

interface OrbitRingProps {
  radius: number;
  speed: string;
  tokens: typeof TOKENS;
  startAngle: number;
  delay?: number;
  inView: boolean;
}

function OrbitRing({ radius, speed, tokens, startAngle, inView }: OrbitRingProps) {
  const size = radius * 2;
  const angleStep = 360 / tokens.length;

  return (
    <div
      className="absolute top-1/2 left-1/2 rounded-full border border-white/[0.04]"
      style={{
        width: size,
        height: size,
        transform: 'translate(-50%, -50%)',
        animation: inView ? `orbit-spin ${speed} linear infinite` : 'none',
      }}
    >
      {tokens.map((token, idx) => {
        const angle = ((startAngle + idx * angleStep) * Math.PI) / 180;
        const x = radius + radius * Math.cos(angle) - 44;
        const y = radius + radius * Math.sin(angle) - 44;

        return (
          <div
            key={token.symbol}
            className="absolute w-[88px] h-[88px] flex items-center justify-center"
            style={{
              left: x,
              top: y,
              animation: inView ? `orbit-counter ${speed} linear infinite` : 'none',
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: 0.3 + idx * 0.15, type: 'spring', stiffness: 200 }}
              className="group flex flex-col items-center justify-center p-3 w-20 h-20 rounded-[22px] bg-zinc-900/60 border border-white/5 backdrop-blur-xl hover:border-emerald-500/30 hover:bg-zinc-800/80 transition-all duration-300 cursor-default shadow-xl"
            >
              <img
                src={token.logo}
                alt={token.symbol}
                className={`w-8 h-8 mb-1 ${token.live ? '' : 'grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all'}`}
                onError={(e) => { (e.target as HTMLImageElement).src = '/logos/bitcoin-cash-bch-logo.svg'; }}
              />
              <span className="text-[10px] font-bold text-white/70 group-hover:text-white transition-colors">{token.symbol}</span>
              <span className={`text-[9px] font-mono ${token.changeUp ? 'text-emerald-400' : 'text-red-400'}`}>
                {token.change}
              </span>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}

export function MeshLiveNetworkSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section ref={ref} className="relative py-24 lg:py-40 bg-[#050505] overflow-hidden border-y border-white/5">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-emerald-500/4 rounded-full blur-[180px]" />
        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-10 mix-blend-overlay" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Text header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/[0.03] text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live Network
          </span>
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-white">
            BCH + CashToken{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">Ecosystem</span>
          </h2>
          <p className="mt-4 text-lg text-zinc-400 max-w-xl mx-auto">
            Mesh pools pair native BCH with any CashToken. Liquidity that actually lives on-chain.
          </p>
        </motion.div>

        {/* Orbital visualization */}
        <div className="relative flex items-center justify-center" style={{ height: 680 }}>
          {/* Orbit rings */}
          {ORBITS.map((orbit, i) => (
            <OrbitRing key={i} {...orbit} inView={inView} />
          ))}

          {/* Center BCH logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ type: 'spring', stiffness: 150, delay: 0.1 }}
            className="relative z-10 flex flex-col items-center justify-center w-28 h-28 rounded-[32px] bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 backdrop-blur-xl shadow-[0_0_60px_rgba(52,211,153,0.25)]"
          >
            <img src="/logos/bitcoin-cash-bch-logo.svg" alt="BCH" className="w-14 h-14" />
            <span className="text-[10px] font-black text-emerald-400 tracking-widest mt-1">BCH</span>
            {/* Pulse ring */}
            <div className="absolute inset-0 rounded-[32px] border border-emerald-500/20 animate-ping" style={{ animationDuration: '3s' }} />
          </motion.div>
        </div>

        {/* Mobile grid fallback */}
        <div className="lg:hidden grid grid-cols-3 gap-4 mt-8 max-w-sm mx-auto">
          {TOKENS.map(token => (
            <div key={token.symbol} className="flex flex-col items-center p-3 rounded-2xl bg-zinc-900/50 border border-white/5">
              <img src={token.logo} alt={token.symbol} className="w-8 h-8 mb-1"
                onError={(e) => { (e.target as HTMLImageElement).src = '/logos/bitcoin-cash-bch-logo.svg'; }} />
              <span className="text-[10px] font-bold text-zinc-400">{token.symbol}</span>
              <span className={`text-[9px] font-mono ${token.changeUp ? 'text-emerald-400' : 'text-red-400'}`}>{token.change}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes orbit-spin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to   { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes orbit-counter {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-360deg); }
        }
      `}</style>
    </section>
  );
}
