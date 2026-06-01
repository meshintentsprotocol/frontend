import { Header } from '@/components/common/Header';
import { Footer } from '@/components/common/Footer';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ArrowRight, Globe, MessageCircle, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export default function EcosystemPage() {
    return (
        <div className="min-h-screen flex flex-col bg-[#050505] selection:bg-primary/30 text-foreground">
            <Header />

            <main className="flex-1">
                {/* Hero section */}
                <section className="relative pt-28 pb-12 overflow-hidden">
                    <div className="absolute inset-0 bg-[#050505] z-0" />
                    <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                        <div className="absolute top-[10%] left-[20%] w-[30vw] h-[30vw] bg-primary/10 rounded-full blur-[120px] animate-pulse-glow" />
                        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-20 mix-blend-overlay"></div>
                    </div>

                    <div className="container mx-auto px-4 relative z-10 text-center">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8 }}
                            className="max-w-3xl mx-auto space-y-6"
                        >
                            <h1 className="text-5xl md:text-7xl font-black tracking-tighter">
                                The BCH Intents{' '}
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-green-500 to-yellow-400">
                                    Ecosystem
                                </span>
                            </h1>
                            <p className="text-lg md:text-xl text-muted-foreground">
                                Discover the suite of powerful tools and products built on top of the BCH Intents Protocol.
                            </p>
                        </motion.div>
                    </div>
                </section>

                {/* Bento Grid section */}
                <section className={cn('relative py-12 md:py-20 overflow-hidden')}>
                    <div className="absolute inset-0 bg-zinc-50 dark:bg-zinc-950 grainy" />

                    {/* Ambient Gradient Orbs */}
                    <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2" />
                    <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-teal-500/5 dark:bg-teal-500/10 rounded-full blur-[120px] translate-x-1/4 translate-y-1/4" />

                    <div className="container mx-auto px-4 relative z-10">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                            {/* Card 1: Swap */}
                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.1 }}
                                className="relative group rounded-3xl overflow-hidden border border-white/10 bg-black/40 p-8 hover:bg-black/60 transition-colors flex flex-col"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="relative z-10 h-full flex flex-col items-center text-center">
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/20">
                                        <ArrowLeftRight className="w-8 h-8 text-black" />
                                    </div>
                                    <h3 className="text-2xl font-bold mb-4">BCH Intents Swap</h3>
                                    <p className="text-muted-foreground text-lg mb-8 flex-1">
                                        Our flagship product. Trustless intent-based swaps combining CashTokens and cross-chain execution without bridges or wrapping.
                                    </p>
                                    <div>
                                        <Button asChild className="rounded-full gap-2 group border-emerald-500/30 hover:border-emerald-500/50 hover:bg-emerald-500/10 glass-solid text-white">
                                            <Link to="/trade">
                                                Start Trading <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform text-emerald-400" />
                                            </Link>
                                        </Button>
                                    </div>
                                </div>
                            </motion.div>

                            {/* Card 2: Telegram Bot */}
                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.2 }}
                                className="relative group rounded-3xl overflow-hidden border border-white/10 bg-black/40 p-8 hover:bg-black/60 transition-colors flex flex-col"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="relative z-10 h-full flex flex-col items-center text-center">
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center mb-6 shadow-lg shadow-cyan-500/20">
                                        <MessageCircle className="w-8 h-8 text-black" />
                                    </div>
                                    <h3 className="text-2xl font-bold mb-4">Telegram Bot</h3>
                                    <p className="text-muted-foreground mb-8 flex-1">
                                        Trade instantly from Telegram. Seamless intent execution on the go with zero web interface required.
                                    </p>
                                    <div>
                                        <Button asChild className="rounded-full gap-2 group border-cyan-500/30 hover:border-cyan-500/50 hover:bg-cyan-500/10 glass-solid text-white">
                                            <a href="#" target="_blank" rel="noopener noreferrer">
                                                Launch Bot <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform text-cyan-400" />
                                            </a>
                                        </Button>
                                    </div>
                                </div>
                            </motion.div>

                            {/* Card 3: Explorer */}
                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.3 }}
                                className="relative group rounded-3xl overflow-hidden border border-white/10 bg-black/40 p-8 hover:bg-black/60 transition-colors flex flex-col"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="relative z-10 h-full flex flex-col items-center text-center">
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center mb-6 shadow-lg shadow-teal-500/20">
                                        <Globe className="w-8 h-8 text-black" />
                                    </div>
                                    <h3 className="text-2xl font-bold mb-4">BCH Intents Explorer</h3>
                                    <p className="text-muted-foreground text-lg mb-8 flex-1">
                                        Transparently verify cross-chain state. Track intents, solver competition, and atomic HTLC settlements in real-time.
                                    </p>
                                    <div>
                                        <Button asChild className="rounded-full gap-2 group border-teal-500/30 hover:border-teal-500/50 hover:bg-teal-500/10 glass-solid text-white">
                                            <Link to="/explore">
                                                Open Explorer <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform text-teal-400" />
                                            </Link>
                                        </Button>
                                    </div>
                                </div>
                            </motion.div>

                        </div>
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
}
