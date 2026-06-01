import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ArrowRight, Activity, Layers, ShieldCheck, Code2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatedTradeButton } from '@/components/ui/animated-trade-button';
import { WaitlistModal } from '@/components/landing/WaitlistModal';

// Stats Data
const STATS = [
    {
        label: "Chains Live",
        value: "8+",
        sub: "BCH SOL ETH XMR more..",
        color: "text-emerald-400",
        icon: <Layers className="w-4 h-4 text-emerald-400" />
    },
    {
        label: "Discovery",
        value: "P2P",
        sub: "Nostr Intent Pool",
        color: "text-emerald-300",
        icon: <Activity className="w-4 h-4 text-emerald-300" />
    },
    {
        label: "Settlement",
        value: "Atomic",
        sub: "All-or-Nothing",
        color: "text-cyan-400",
        icon: <ShieldCheck className="w-4 h-4 text-cyan-400" />
    },
    {
        label: "SDK Packages",
        value: "6",
        sub: "Published on NPM",
        color: "text-teal-400",
        icon: <Code2 className="w-4 h-4 text-teal-400" />
    }
];

export function HeroStatsSection() {
    const [waitlistOpen, setWaitlistOpen] = useState(false);
    const [initialSuccess, setInitialSuccess] = useState<{ message: string } | null>(null);
    const [searchParams, setSearchParams] = useSearchParams();

    // Detect X OAuth callback in URL
    useEffect(() => {
        const waitlistStatus = searchParams.get('waitlist');
        const handle = searchParams.get('handle');

        if (waitlistStatus === 'success' && handle) {
            setInitialSuccess({ message: handle });
            setWaitlistOpen(true);
            // Clean the URL
            searchParams.delete('waitlist');
            searchParams.delete('handle');
            setSearchParams(searchParams, { replace: true });
        } else if (waitlistStatus === 'error') {
            setWaitlistOpen(true);
            searchParams.delete('waitlist');
            searchParams.delete('msg');
            setSearchParams(searchParams, { replace: true });
        }
    }, []);

    return (
        <section className="relative min-h-[90vh] flex items-center pt-28 pb-20 overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-[#050505] z-0" />
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-emerald-500/10 rounded-full blur-[150px] animate-pulse-glow" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-zinc-600/10 rounded-full blur-[150px] animate-pulse-glow delay-1000" />
                <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-20 mix-blend-overlay"></div>
            </div>

            <div className="container mx-auto px-4 relative z-10">
                <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

                    {/* LEFT COLUMN: Typography & Copy */}
                    <motion.div
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="space-y-8"
                    >

                        {/* Main Typography */}
                        <div className="space-y-2">
                            <h2 className="text-lg md:text-2xl font-medium text-muted-foreground uppercase tracking-widest pl-1">
                                Explore the
                            </h2>
                            <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-[10rem] font-black tracking-tighter leading-[0.85]">
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-600">
                                    BRIDGE
                                </span>
                                <span className="text-white">
                                    LESS
                                </span>
                                <br />
                                <span className="text-white/90 block mt-2 md:mt-4 text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight">
                                    future of DeFi
                                </span>
                            </h1>
                        </div>

                        {/* Taglines */}
                        <p className="text-xl font-medium text-muted-foreground/80 max-w-lg">
                            Sign your intent. Solvers compete. You get the best price. <br />
                        </p>

                        {/* Description Paragraphs */}
                        <div className="space-y-6 max-w-xl text-lg text-muted-foreground leading-relaxed border-l-2 border-white/10 pl-6">
                            <p>
                                <strong className="text-white">BCH Intents</strong> is a permissionless swap protocol powered by CashScript covenants and a competitive network of professional Solvers.
                            </p>
                            <p>
                                Express what you want to trade — across BCH, Solana, Movement, and more — and let Dutch Auction price discovery guarantee you the best execution.
                            </p>
                        </div>

                        {/* CTA */}
                        <div className="pt-6 flex flex-wrap items-center gap-3 sm:gap-4">
                            <Button asChild className="w-full sm:w-auto rounded-none h-12 sm:h-14 px-6 sm:px-8 text-base sm:text-lg font-bold bg-emerald-500 text-black hover:bg-emerald-400 transition-all">
                                <Link to="/trade">
                                    Trade Now <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
                                </Link>
                            </Button>

                            <Button asChild variant="outline" className="w-full sm:w-auto rounded-none h-12 sm:h-14 px-6 sm:px-8 text-base sm:text-lg font-bold border-2 border-white/20 hover:border-white hover:bg-white hover:text-black transition-all text-white">
                                <Link to="/ecosystem">
                                    Explore
                                </Link>
                            </Button>

                            <Button asChild className="group/build w-full sm:w-auto rounded-none h-12 sm:h-14 px-6 sm:px-8 text-base sm:text-lg font-bold bg-white text-black hover:bg-zinc-200 transition-all">
                                <Link to="/integrate">
                                    Build <Zap className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
                                </Link>
                            </Button>
                        </div>
                    </motion.div>

                    {/* RIGHT COLUMN: Stats Grid */}
                    <motion.div
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                        className="relative"
                    >

                        {/* 4 Cards Grid - 2x2 even on mobile */}
                        <div className="grid grid-cols-2 gap-4">
                            {STATS.map((stat, i) => (
                                <motion.div
                                    key={i}
                                    whileHover={{ scale: 1.02 }}
                                    className={cn(
                                        "bento-card-interactive relative p-4 sm:p-6 rounded-[24px] flex flex-col justify-between min-h-[140px] sm:min-h-[180px]",
                                        "glass-subtle border border-white/5 overflow-hidden group"
                                    )}
                                >
                                    {/* Hover Glow */}
                                    <div className={`absolute inset-0 bg-gradient-to-b from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

                                    <div className="relative z-10">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-muted-foreground text-sm font-medium">{stat.label}</span>
                                            {stat.icon}
                                        </div>
                                        <div className={`text-3xl md:text-4xl font-black font-mono tracking-tighter mb-1 ${stat.color} group-hover:scale-105 transition-transform origin-left`}>
                                            {stat.value}
                                        </div>
                                        {stat.sub && (
                                            <span className="text-[10px] font-mono text-white/40 uppercase tracking-[0.2em] font-semibold">{stat.sub}</span>
                                        )}
                                    </div>

                                    {/* Decorative Blur */}
                                    <div className={`absolute -bottom-10 -right-10 w-24 h-24 rounded-full blur-[40px] opacity-20 ${stat.color.replace('text-', 'bg-')}`} />
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* Waitlist Modal */}
            <WaitlistModal
                isOpen={waitlistOpen}
                onClose={() => {
                    setWaitlistOpen(false);
                    setInitialSuccess(null);
                }}
                initialSuccess={initialSuccess}
            />
        </section>
    );
}
