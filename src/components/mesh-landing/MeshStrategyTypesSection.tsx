import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Grid3X3, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StrategyCard {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  ctaText: string;
  href: string;
  hoverBgColor: string;
  engine: 'v4' | 'v3';
  apy: string;
}

const STRATEGIES: StrategyCard[] = [
  {
    id: 'v4-spot',
    badge: 'V4 DLMM Bins',
    title: 'Spot Price Grid',
    subtitle: 'Uniform Zero-Slippage Depth',
    description: 'Evenly distributes liquidity across discrete price bins. Fills execute at exact tick levels with guaranteed spread.',
    ctaText: 'Deploy Spot',
    href: '/mesh/create?strategy=spot',
    hoverBgColor: 'hover:bg-[#06b6d4]', // Neon Cyan
    engine: 'v4',
    apy: '28.4% APY',
  },
  {
    id: 'v4-curve',
    badge: 'V4 Concentrated',
    title: 'Curve Concentration',
    subtitle: 'High-Turnover Oracle Depth',
    description: 'Densely concentrates depth around the live market price for maximum volume turnover and automated fee capture.',
    ctaText: 'Deploy Curve',
    href: '/mesh/create?strategy=curve',
    hoverBgColor: 'hover:bg-[#2be64d]', // Neon Lime
    engine: 'v4',
    apy: '46.2% APY',
  },
  {
    id: 'v3-pools',
    badge: 'Mesh V3 Pool',
    title: 'Auto-Recycling Pool',
    subtitle: 'Multi-Asset Shared Liquidity',
    description: 'One BCH reserve quotes multiple CashTokens simultaneously with cyclic UTXO recycling covenants and 0.30% fee compounding.',
    ctaText: 'Deploy V3 Pool',
    href: '/mesh/create?strategy=v3',
    hoverBgColor: 'hover:bg-[#a855f7]', // Electric Purple
    engine: 'v3',
    apy: '32.1% APY',
  },
  {
    id: 'v4-nft',
    badge: 'CashToken NFT',
    title: 'Sovereign NFT Vault',
    subtitle: '1-Token Position Custody',
    description: 'Each liquidity position is minted as an 82-byte CashToken NFT. Transfer the NFT to transfer your entire position atomically.',
    ctaText: 'Manage Positions',
    href: '/mesh/positions',
    hoverBgColor: 'hover:bg-[#fbbf24]', // Solar Amber
    engine: 'v4',
    apy: '100% Non-Custodial',
  },
];

export function MeshStrategyTypesSection() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<'all' | 'v4' | 'v3'>('all');
  const [activeIndex, setActiveIndex] = useState(0);

  const filteredStrategies =
    filter === 'all' ? STRATEGIES : STRATEGIES.filter((s) => s.engine === filter);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, offsetWidth } = scrollRef.current;
    const newIndex = Math.round(scrollLeft / (offsetWidth * 0.82));
    if (newIndex >= 0 && newIndex < filteredStrategies.length) {
      setActiveIndex(newIndex);
    }
  };

  const scrollTo = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = scrollRef.current.offsetWidth * 0.85;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  return (
    <section className="relative py-24 md:py-32 overflow-hidden bg-gradient-to-b from-[#06080d] via-[#050507] to-[#06070a]">
      {/* Ambient spotlights behind strategy cards */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-[10%] w-[45vw] h-[380px] bg-teal-500/[0.03] rounded-full blur-[160px]" />
        <div className="absolute bottom-1/4 right-[10%] w-[45vw] h-[380px] bg-emerald-500/[0.035] rounded-full blur-[160px]" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 max-w-7xl relative z-10">
        {/* Simplified Header (1inch Style) */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 md:mb-16">
          <div>
            <div className="inline-block px-3.5 py-1 rounded-full text-xs font-mono font-bold tracking-wider uppercase bg-white/5 text-zinc-400 border border-white/10 mb-4">
              Liquidity Engines
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
              Choose your <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
                liquidity model
              </span>
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Filter Toggle */}
            <div className="inline-flex p-1 rounded-full bg-zinc-900 border border-white/10 text-xs font-semibold">
              <button
                onClick={() => setFilter('all')}
                className={cn(
                  'px-4 py-1.5 rounded-full transition-all cursor-pointer',
                  filter === 'all' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white',
                )}
              >
                All Models
              </button>
              <button
                onClick={() => setFilter('v4')}
                className={cn(
                  'px-4 py-1.5 rounded-full transition-all cursor-pointer',
                  filter === 'v4' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white',
                )}
              >
                V4 DLMM
              </button>
              <button
                onClick={() => setFilter('v3')}
                className={cn(
                  'px-4 py-1.5 rounded-full transition-all cursor-pointer',
                  filter === 'v3' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white',
                )}
              >
                V3 Pools
              </button>
            </div>

            {/* Scroll Buttons */}
            <div className="hidden sm:flex items-center gap-2">
              <button
                onClick={() => scrollTo('left')}
                aria-label="Scroll left"
                className="w-9 h-9 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => scrollTo('right')}
                aria-label="Scroll right"
                className="w-9 h-9 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center text-white transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Strategy Cards Container with Snap Scroll */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none no-scrollbar gap-4 sm:gap-6 pb-6 pt-2 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0"
        >
          {filteredStrategies.map((card, idx) => (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.08 }}
              className="w-[84vw] sm:w-[340px] md:w-[360px] lg:w-[calc(25%-18px)] shrink-0 snap-center"
            >
              <div
                className={cn(
                  'group relative h-[420px] sm:h-[440px] rounded-3xl p-7 sm:p-8 flex flex-col justify-between transition-all duration-300 ease-out cursor-pointer',
                  'bg-[#131418] border border-white/10',
                  card.hoverBgColor,
                  'hover:border-transparent hover:shadow-2xl',
                )}
              >
                {/* Content */}
                <div>
                  {/* Top Badge & APY */}
                  <div className="flex items-center justify-between mb-8">
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-bold tracking-tight bg-black text-white">
                      {card.badge}
                    </span>
                    <span className="text-xs font-mono font-bold text-cyan-400 group-hover:text-black">
                      {card.apy}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white group-hover:text-black leading-snug mb-2 transition-colors duration-200">
                    {card.title}
                  </h3>

                  {/* Subtitle */}
                  <div className="text-xs font-medium text-cyan-300/90 group-hover:text-black/70 mb-4 transition-colors duration-200">
                    {card.subtitle}
                  </div>

                  {/* Description */}
                  <p className="text-sm text-zinc-400 group-hover:text-black/80 leading-relaxed font-normal transition-colors duration-200">
                    {card.description}
                  </p>
                </div>

                {/* Bottom Pill CTA */}
                <div className="pt-6">
                  <Link to={card.href} className="inline-block">
                    <button
                      type="button"
                      className="px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 bg-white/10 text-white hover:bg-white/15 group-hover:bg-black group-hover:text-white group-hover:hover:bg-black/90"
                    >
                      {card.ctaText}
                    </button>
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Mobile Indicator Dots */}
        <div className="flex sm:hidden items-center justify-center gap-1.5 mt-2">
          {filteredStrategies.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                if (scrollRef.current) {
                  const width = scrollRef.current.offsetWidth * 0.85;
                  scrollRef.current.scrollTo({ left: i * width, behavior: 'smooth' });
                }
              }}
              aria-label={`Slide ${i + 1}`}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                activeIndex === i ? 'w-6 bg-cyan-400' : 'w-1.5 bg-white/20',
              )}
            />
          ))}
        </div>
      </div>

      {/* Radiant transition into Benefits section */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/20 via-white/10 to-transparent pointer-events-none" />
    </section>
  );
}

export default MeshStrategyTypesSection;
