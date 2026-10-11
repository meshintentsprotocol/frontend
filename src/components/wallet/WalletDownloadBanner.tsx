import { useState } from 'react';
import { motion } from 'framer-motion';
import { Apple, Smartphone, Chrome, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import { WalletDownloadModal } from './WalletDownloadModal';

export function WalletDownloadBanner() {
    const [downloadOpen, setDownloadOpen] = useState(false);

    return (
        <section className="relative py-24 bg-black overflow-hidden border-t border-zinc-900">
            {/* Gradient Background Aura */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-950/20 to-black pointer-events-none" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-emerald-500/10 rounded-full blur-[160px] pointer-events-none" />

            <div className="container mx-auto px-4 relative z-10">
                <div className="max-w-5xl mx-auto rounded-[2.5rem] bg-gradient-to-b from-zinc-900 via-zinc-900/90 to-zinc-950 border border-emerald-500/30 p-8 sm:p-12 md:p-16 relative overflow-hidden shadow-2xl shadow-emerald-500/5 text-center">
                    
                    {/* Glowing highlight accents */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
                    
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="space-y-6 max-w-2xl mx-auto"
                    >
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                            <Zap className="w-3.5 h-3.5" /> Start Exploring Web3 Sovereignty
                        </div>

                        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight">
                            Experience the future of <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400">
                                cross-chain liquidity.
                            </span>
                        </h2>

                        <p className="text-zinc-400 text-base sm:text-lg leading-relaxed">
                            Join thousands of users experiencing seamless cross-chain swaps, native CashTokens, and automated yield with Cham Wallet.
                        </p>

                        {/* CTA Buttons */}
                        <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
                            <motion.button
                                whileHover={{ scale: 1.04 }}
                                whileTap={{ scale: 0.96 }}
                                onClick={() => setDownloadOpen(true)}
                                className="flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-white text-black font-bold text-sm hover:bg-zinc-100 transition-all shadow-xl shadow-white/10"
                            >
                                <Apple className="w-5 h-5" />
                                <div className="text-left">
                                    <span className="text-[9px] font-semibold text-zinc-500 block leading-tight">Download on</span>
                                    <span className="text-sm font-bold leading-tight">App Store</span>
                                </div>
                            </motion.button>

                            <motion.button
                                whileHover={{ scale: 1.04 }}
                                whileTap={{ scale: 0.96 }}
                                onClick={() => setDownloadOpen(true)}
                                className="flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-white text-black font-bold text-sm hover:bg-zinc-100 transition-all shadow-xl shadow-white/10"
                            >
                                <Smartphone className="w-5 h-5" />
                                <div className="text-left">
                                    <span className="text-[9px] font-semibold text-zinc-500 block leading-tight">Get it on</span>
                                    <span className="text-sm font-bold leading-tight">Google Play</span>
                                </div>
                            </motion.button>

                            <motion.button
                                whileHover={{ scale: 1.04 }}
                                whileTap={{ scale: 0.96 }}
                                onClick={() => setDownloadOpen(true)}
                                className="flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-emerald-500 text-black font-bold text-sm hover:bg-emerald-400 transition-all shadow-xl shadow-emerald-500/25"
                            >
                                <Chrome className="w-5 h-5" />
                                <div className="text-left">
                                    <span className="text-[9px] font-semibold text-black/60 block leading-tight">Install for</span>
                                    <span className="text-sm font-bold leading-tight">Chrome & Brave</span>
                                </div>
                            </motion.button>
                        </div>

                        {/* Security check footer */}
                        <div className="pt-6 flex items-center justify-center gap-6 text-xs text-zinc-500 font-medium">
                            <span className="flex items-center gap-1.5 text-zinc-400">
                                <ShieldCheck className="w-4 h-4 text-emerald-400" /> 100% Open Source
                            </span>
                            <span>•</span>
                            <span>Audited Smart Covenants</span>
                            <span>•</span>
                            <span>Non-Custodial</span>
                        </div>
                    </motion.div>
                </div>
            </div>

            <WalletDownloadModal isOpen={downloadOpen} onClose={() => setDownloadOpen(false)} />
        </section>
    );
}

export default WalletDownloadBanner;
