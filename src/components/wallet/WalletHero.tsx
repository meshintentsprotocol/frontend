/**
 * WalletHero - Top banner section for the Wallet landing page
 *
 * Features:
 * - Vibrant Emerald-Violet gradient aura background
 * - Triple-phone 3D perspective display (center + two flanking)
 * - Platform download badges (iOS, Android, Browser Extension)
 * - Framer Motion entrance animations
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Chrome, Smartphone, Apple, ArrowRight } from 'lucide-react';
import { WalletPhoneModel } from './WalletPhoneModel';
import { FlowScreenCarousel, ScreenSwap, ScreenPortfolio, ScreenEarn } from './WalletFlowScreens';
import { WalletDownloadModal } from './WalletDownloadModal';

export function WalletHero() {
    const [downloadOpen, setDownloadOpen] = useState(false);

    return (
        <section className="relative min-h-[100vh] flex items-center pt-28 pb-20 overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 bg-[#050505] z-0" />

            {/* Gradient orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-20%] left-[10%] w-[60vw] h-[60vw] bg-emerald-500/8 rounded-full blur-[180px] animate-pulse-glow" />
                <div className="absolute bottom-[-20%] right-[5%] w-[50vw] h-[50vw] bg-violet-500/5 rounded-full blur-[160px] animate-pulse-glow delay-1000" />
                <div className="absolute top-[20%] right-[20%] w-[30vw] h-[30vw] bg-teal-500/5 rounded-full blur-[120px]" />
                <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-15 mix-blend-overlay" />
            </div>

            <div className="container mx-auto px-4 relative z-10">
                {/* Top content: Text + Phone */}
                <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

                    {/* LEFT: Typography & CTAs */}
                    <motion.div
                        initial={{ opacity: 0, x: -40 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.7, ease: 'easeOut' }}
                        className="space-y-8"
                    >
                        {/* Badge */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="flex items-center gap-3.5"
                        >
                            <img
                                src="/logos/wallets/main.svg"
                                alt="Cham Wallet"
                                className="w-12 h-12 object-contain drop-shadow-[0_0_16px_rgba(0,209,143,0.5)] transition-transform hover:scale-110"
                            />
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                                </span>
                                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Cham Wallet</span>
                            </div>
                        </motion.div>

                        {/* Headline */}
                        <div className="space-y-3">
                            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.9]">
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-400">
                                    Simple.
                                </span>
                                <br />
                                <span className="text-white">Fast.</span>
                                <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-400">
                                    Intent‑Driven.
                                </span>
                            </h1>
                        </div>

                        {/* Sub-headline */}
                        <p className="text-lg md:text-xl text-zinc-400 max-w-lg leading-relaxed font-medium">
                            The self-custody multi-chain wallet for cross-chain swaps, native CashTokens, and automated yield — across Bitcoin Cash, EVM, and Solana.
                        </p>

                        {/* Platform badges */}
                        <div className="flex flex-wrap items-center gap-3">
                            <motion.button
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => setDownloadOpen(true)}
                                className="flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-white text-black font-bold text-sm hover:bg-zinc-100 transition-all shadow-lg shadow-white/10"
                            >
                                <Apple className="w-5 h-5" />
                                <div className="text-left">
                                    <span className="text-[9px] font-medium text-zinc-500 block leading-tight">Download on</span>
                                    <span className="text-sm font-bold leading-tight">App Store</span>
                                </div>
                            </motion.button>

                            <motion.button
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => setDownloadOpen(true)}
                                className="flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-white text-black font-bold text-sm hover:bg-zinc-100 transition-all shadow-lg shadow-white/10"
                            >
                                <Smartphone className="w-5 h-5" />
                                <div className="text-left">
                                    <span className="text-[9px] font-medium text-zinc-500 block leading-tight">Get it on</span>
                                    <span className="text-sm font-bold leading-tight">Google Play</span>
                                </div>
                            </motion.button>

                            <motion.button
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => setDownloadOpen(true)}
                                className="flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-emerald-500 text-black font-bold text-sm hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
                            >
                                <Chrome className="w-5 h-5" />
                                <div className="text-left">
                                    <span className="text-[9px] font-medium text-black/60 block leading-tight">Add to</span>
                                    <span className="text-sm font-bold leading-tight">Chrome</span>
                                </div>
                            </motion.button>
                        </div>
                    </motion.div>

                    {/* RIGHT: Triple Phone Display */}
                    <motion.div
                        initial={{ opacity: 0, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                        className="relative flex items-center justify-center h-[500px] sm:h-[580px] lg:h-[650px]"
                    >
                        {/* Left phone (angled) */}
                        <div className="absolute left-0 sm:left-4 lg:left-0 z-10">
                            <WalletPhoneModel
                                size="sm"
                                disableHover
                                showGlare={false}
                                style={{
                                    transform: 'perspective(800px) rotateY(15deg) rotateX(-2deg) translateZ(-40px)',
                                    opacity: 0.55,
                                }}
                            >
                                <ScreenPortfolio />
                            </WalletPhoneModel>
                        </div>

                        {/* Center phone (main) */}
                        <div className="relative z-20">
                            <WalletPhoneModel size="lg">
                                <FlowScreenCarousel interval={6000} />
                            </WalletPhoneModel>
                            {/* Glow ring */}
                            <div className="absolute -inset-4 bg-gradient-to-b from-emerald-500/10 to-transparent rounded-[3rem] blur-xl -z-10" />
                        </div>

                        {/* Right phone (angled) */}
                        <div className="absolute right-0 sm:right-4 lg:right-0 z-10">
                            <WalletPhoneModel
                                size="sm"
                                disableHover
                                showGlare={false}
                                style={{
                                    transform: 'perspective(800px) rotateY(-15deg) rotateX(-2deg) translateZ(-40px)',
                                    opacity: 0.55,
                                }}
                            >
                                <ScreenEarn />
                            </WalletPhoneModel>
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* Download Modal */}
            <WalletDownloadModal isOpen={downloadOpen} onClose={() => setDownloadOpen(false)} />
        </section>
    );
}

export default WalletHero;
