import { useState, useRef, useEffect } from 'react';
import { motion, useScroll, useTransform, useSpring, useMotionValueEvent } from 'framer-motion';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface EcosystemCard {
    id: string;
    badge: string;
    title: string;
    description: string;
    ctaText: string;
    href: string;
    isExternal?: boolean;
    hoverBgColor: string;
}

const CARD_COLORS = ['#2be64d', '#a855f7', '#06b6d4', '#fbbf24'];

const CARDS: EcosystemCard[] = [
    {
        id: 'mesh',
        badge: 'Mesh Protocol',
        title: 'Provide liquidity & earn yield',
        description: 'Deploy capital into auto-recycling V3 pools and concentrated V4 NFT bins with zero liquidity bleed.',
        ctaText: 'Explore Pools',
        href: '/mesh-landing',
        hoverBgColor: 'hover:bg-[#2be64d]',
    },
    {
        id: 'wallet',
        badge: 'Cham Wallet',
        title: 'Run crypto from your pocket',
        description: 'Secure, swap & track multi-chain assets across 16 networks in one self-custodial app with biometric security.',
        ctaText: 'Get Wallet',
        href: 'https://cham-wallet-web.vercel.app/',
        isExternal: true,
        hoverBgColor: 'hover:bg-[#a855f7]',
    },
    {
        id: 'mcp',
        badge: 'MCP Server',
        title: 'Power AI agents with liquidity',
        description: 'Model Context Protocol server for Claude, Cursor, and autonomous bots to execute swap intents directly on-chain.',
        ctaText: 'Connect MCP',
        href: '/mcp',
        hoverBgColor: 'hover:bg-[#06b6d4]',
    },
    {
        id: 'integrate',
        badge: '1inch-grade Suite',
        title: 'Build & scale your DeFi apps',
        description: 'High-throughput solver APIs, TypeScript SDK, Libauth bindings, and open-source smart contract covenants.',
        ctaText: 'Integrate',
        href: '/integrate',
        hoverBgColor: 'hover:bg-[#fbbf24]',
    },
];

export function OneEcosystemSection() {
    const sectionRef = useRef<HTMLDivElement>(null);
    const [isMobile, setIsMobile] = useState(false);
    const [activeCardIndex, setActiveCardIndex] = useState(0);

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    // Pinned scroll-linked horizontal movement for mobile:
    const { scrollYProgress } = useScroll({
        target: sectionRef,
        offset: ['start start', 'end end'],
    });

    const smoothProgress = useSpring(scrollYProgress, {
        stiffness: 70,
        damping: 24,
        restDelta: 0.001,
    });

    // Translate cards horizontally as vertical scroll advances
    const xTranslate = useTransform(
        smoothProgress,
        [0.02, 0.96],
        ['0%', '-76%']
    );

    // Track active card index based on scroll progress
    useMotionValueEvent(smoothProgress, 'change', (latest) => {
        if (latest < 0.25) setActiveCardIndex(0);
        else if (latest < 0.52) setActiveCardIndex(1);
        else if (latest < 0.78) setActiveCardIndex(2);
        else setActiveCardIndex(3);
    });

    // Smoothly jump to a card when tapping a pill indicator
    const jumpToCard = (index: number) => {
        if (!sectionRef.current) return;
        const rect = sectionRef.current.getBoundingClientRect();
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const sectionTop = rect.top + scrollTop;
        const totalScrollable = sectionRef.current.offsetHeight - window.innerHeight;
        const targetY = sectionTop + (index / (CARDS.length - 1)) * totalScrollable;
        window.scrollTo({ top: targetY, behavior: 'smooth' });
    };

    return (
        <section
            ref={sectionRef}
            className="relative bg-[#050505] h-[260vh] md:h-auto md:py-32"
        >
            <div className="sticky top-16 md:static py-10 md:py-0 overflow-hidden flex flex-col justify-center min-h-[90vh] md:min-h-0">
                <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
                    {/* Title */}
                    <div className="text-center mb-8 md:mb-20">
                        <motion.h2
                            initial={{ opacity: 0, y: 16 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5 }}
                            className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.1] max-w-4xl mx-auto"
                        >
                            One ecosystem <br />
                            <span className="text-white/95">for everything you do with crypto</span>
                        </motion.h2>
                    </div>

                    <div className="relative">
                        {/* Mobile: Pinned scroll-driven rail */}
                        {isMobile ? (
                            <div className="overflow-hidden px-1">
                                <motion.div
                                    style={{ x: xTranslate }}
                                    className="flex gap-4 w-max"
                                >
                                    {CARDS.map((card, idx) => (
                                        <CardContent key={card.id} card={card} idx={idx} />
                                    ))}
                                </motion.div>
                            </div>
                        ) : (
                            /* Desktop: 4-column responsive grid */
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-2">
                                {CARDS.map((card) => (
                                    <div key={card.id}>
                                        <CardInner card={card} />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Mobile: Interactive Segmented Scroll Controller & Indicator */}
                        <div className="flex md:hidden flex-col items-center justify-center gap-3 mt-7">
                            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#131418]/90 border border-white/10 backdrop-blur-xl shadow-xl shadow-black/60">
                                {/* Brand Dot + Current Product Badge */}
                                <div className="flex items-center gap-2">
                                    <span
                                        className="w-2 h-2 rounded-full transition-colors duration-300"
                                        style={{ backgroundColor: CARD_COLORS[activeCardIndex] }}
                                    />
                                    <span className="text-xs font-bold text-white tracking-tight">
                                        {CARDS[activeCardIndex].badge}
                                    </span>
                                </div>

                                <span className="text-zinc-700 text-xs select-none">•</span>

                                {/* Segmented capsules (tapping scrolls directly to that card) */}
                                <div className="flex items-center gap-1.5">
                                    {CARDS.map((c, i) => {
                                        const isCurrent = i === activeCardIndex;
                                        return (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => jumpToCard(i)}
                                                aria-label={`Go to ${c.badge}`}
                                                className="py-1 px-0.5 focus:outline-none"
                                            >
                                                <motion.div
                                                    animate={{
                                                        width: isCurrent ? 28 : 8,
                                                        backgroundColor: isCurrent ? CARD_COLORS[i] : 'rgba(255, 255, 255, 0.18)',
                                                    }}
                                                    transition={{ duration: 0.25, ease: 'easeOut' }}
                                                    className="h-1.5 rounded-full"
                                                />
                                            </button>
                                        );
                                    })}
                                </div>

                                <span className="text-[11px] font-mono text-zinc-400 font-semibold pl-1">
                                    0{activeCardIndex + 1}/04
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

// ─── Mobile card wrapper ───────────────────────────────────────────────────

function CardContent({ card }: { card: EcosystemCard; idx: number }) {
    return (
        <div className="w-[84vw] shrink-0">
            <CardInner card={card} />
        </div>
    );
}

// ─── Card Inner component (1inch aesthetic) ────────────────────────────────

function CardInner({ card }: { card: EcosystemCard }) {
    return (
        <div
            className={cn(
                'group relative h-[420px] sm:h-[440px] rounded-3xl p-7 sm:p-8 flex flex-col justify-between transition-all duration-300 ease-out cursor-pointer',
                'bg-[#131418] border border-white/10',
                card.hoverBgColor,
                'hover:border-transparent hover:shadow-2xl'
            )}
        >
            <div>
                <div className="inline-block px-3.5 py-1.5 rounded-full text-xs font-bold tracking-tight bg-black text-white mb-8 transition-colors">
                    {card.badge}
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white group-hover:text-black leading-snug mb-4 transition-colors duration-200">
                    {card.title}
                </h3>
                <p className="text-sm sm:text-base text-zinc-400 group-hover:text-black/80 leading-relaxed font-normal transition-colors duration-200">
                    {card.description}
                </p>
            </div>

            <div className="pt-6">
                {card.isExternal ? (
                    <a href={card.href} target="_blank" rel="noopener noreferrer" className="inline-block">
                        <button
                            type="button"
                            className="px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 bg-white/10 text-white hover:bg-white/15 group-hover:bg-black group-hover:text-white group-hover:hover:bg-black/90"
                        >
                            {card.ctaText}
                        </button>
                    </a>
                ) : (
                    <Link to={card.href} className="inline-block">
                        <button
                            type="button"
                            className="px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 bg-white/10 text-white hover:bg-white/15 group-hover:bg-black group-hover:text-white group-hover:hover:bg-black/90"
                        >
                            {card.ctaText}
                        </button>
                    </Link>
                )}
            </div>
        </div>
    );
}

export default OneEcosystemSection;
