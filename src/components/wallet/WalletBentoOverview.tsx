import { motion } from 'framer-motion';
import {
    Zap,
    ShieldCheck,
    Coins,
    TrendingUp,
    Layers,
    ArrowUpRight,
    Sparkles,
    Lock,
    Repeat,
    Activity
} from 'lucide-react';

export function WalletBentoOverview() {
    return (
        <section className="relative py-28 bg-[#070707] text-white overflow-hidden border-t border-zinc-900">
            {/* Ambient background glows */}
            <div className="absolute top-1/2 left-1/4 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[160px] pointer-events-none" />
            <div className="absolute bottom-10 right-1/4 w-[400px] h-[400px] bg-teal-500/5 rounded-full blur-[140px] pointer-events-none" />

            <div className="container mx-auto px-4 relative z-10">
                {/* Header */}
                <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider"
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        Next-Gen Onchain Super-App
                    </motion.div>
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight"
                    >
                        Designed for everything you do onchain.
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="text-zinc-400 text-base sm:text-lg max-w-2xl mx-auto"
                    >
                        Say goodbye to clumsy bridges, gas estimation headaches, and fragmented UTXO wallets. Cham Wallet orchestrates multi-chain liquidity with one unified interface.
                    </motion.p>
                </div>

                {/* Bento Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                    {/* Card 1: Intent Swaps (Wide, 2 cols on lg) */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="lg:col-span-2 relative rounded-3xl p-8 bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 border border-zinc-800/80 hover:border-emerald-500/40 transition-all duration-300 group overflow-hidden shadow-2xl"
                    >
                        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all duration-500 pointer-events-none" />

                        <div className="flex flex-col h-full justify-between gap-8 relative z-10">
                            <div>
                                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-6 group-hover:scale-110 transition-transform duration-300">
                                    <Repeat className="w-6 h-6" />
                                </div>
                                <div className="space-y-2">
                                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Cross-Chain Intent Engine</span>
                                    <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">Zero-Bridge Swaps via Solvers</h3>
                                    <p className="text-zinc-400 text-sm sm:text-base max-w-lg leading-relaxed">
                                        Express what you want to swap. Decentralized solvers bid in real-time Dutch auctions to fulfill your order across Bitcoin Cash, Solana, Ethereum, and Movement at best-in-market rates with atomic settlement.
                                    </p>
                                </div>
                            </div>

                            {/* Visual simulation card */}
                            <div className="bg-black/60 backdrop-blur-md rounded-2xl p-5 border border-zinc-800/80 space-y-3 max-w-xl">
                                <div className="flex items-center justify-between text-xs text-zinc-400 pb-2 border-b border-zinc-800/60">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                        <span>Best Route: Solver Batch #1048</span>
                                    </div>
                                    <span className="text-emerald-400 font-mono font-medium">99.98% Fill Probability</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-400 text-sm">
                                            BCH
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm">5.00 BCH</div>
                                            <div className="text-xs text-zinc-500">~$2,420.00</div>
                                        </div>
                                    </div>

                                    <div className="flex-1 flex items-center justify-center">
                                        <div className="h-[2px] w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-violet-500 relative flex items-center justify-center">
                                            <div className="px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-700 text-[10px] text-zinc-300 font-mono shadow">
                                                HTLC Atomic
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center font-bold text-violet-400 text-sm">
                                            SOL
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-sm">16.48 SOL</div>
                                            <div className="text-xs text-zinc-500">~$2,418.50</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Card 2: 100% Self-Custodial */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="relative rounded-3xl p-8 bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 border border-zinc-800/80 hover:border-violet-500/40 transition-all duration-300 group overflow-hidden shadow-2xl flex flex-col justify-between"
                    >
                        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl group-hover:bg-violet-500/20 transition-all duration-500 pointer-events-none" />

                        <div>
                            <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mb-6 group-hover:scale-110 transition-transform duration-300">
                                <Lock className="w-6 h-6" />
                            </div>
                            <span className="text-xs font-bold text-violet-400 uppercase tracking-widest">Sovereignty</span>
                            <h3 className="text-2xl font-bold tracking-tight mt-1 mb-2">Your Keys, Your Coins</h3>
                            <p className="text-zinc-400 text-sm leading-relaxed">
                                Universal BIP-39 / BIP-44 key derivation across Bitcoin Cash, EVM, and Solana. Client-side encrypted seed backup, zero analytics tracking, and hardware security enclave integration.
                            </p>
                        </div>

                        <div className="mt-8 pt-6 border-t border-zinc-800/60 flex items-center justify-between text-xs font-semibold text-zinc-400">
                            <span className="flex items-center gap-1.5 text-emerald-400">
                                <ShieldCheck className="w-4 h-4" /> 100% Non-Custodial
                            </span>
                            <span className="text-zinc-500">Biometric TouchID/FaceID</span>
                        </div>
                    </motion.div>

                    {/* Card 3: Earn Yield via BCH Mesh */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="relative rounded-3xl p-8 bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 border border-zinc-800/80 hover:border-teal-500/40 transition-all duration-300 group overflow-hidden shadow-2xl flex flex-col justify-between"
                    >
                        <div className="absolute bottom-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl group-hover:bg-teal-500/20 transition-all duration-500 pointer-events-none" />

                        <div>
                            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 mb-6 group-hover:scale-110 transition-transform duration-300">
                                <TrendingUp className="w-6 h-6" />
                            </div>
                            <span className="text-xs font-bold text-teal-400 uppercase tracking-widest">Yield Liquidity</span>
                            <h3 className="text-2xl font-bold tracking-tight mt-1 mb-2">Earn Yield via BCH Mesh</h3>
                            <p className="text-zinc-400 text-sm leading-relaxed">
                                Put idle assets to work. Deposit BCH, CashTokens, or stablecoins into peer-to-peer liquidity mesh pools and earn real swap fees paid directly by solvers.
                            </p>
                        </div>

                        <div className="mt-8 p-4 rounded-2xl bg-black/50 border border-teal-500/20 flex items-center justify-between">
                            <div>
                                <div className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Top Mesh Pool</div>
                                <div className="text-sm font-extrabold text-white">BCH / USDC Pool</div>
                            </div>
                            <div className="text-right">
                                <div className="text-base font-black text-teal-400">+24.8% APY</div>
                                <div className="text-[10px] text-zinc-400">Auto-compounding</div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Card 4: Native CashTokens UTXO Hub */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        className="relative rounded-3xl p-8 bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 border border-zinc-800/80 hover:border-emerald-500/40 transition-all duration-300 group overflow-hidden shadow-2xl flex flex-col justify-between"
                    >
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all duration-500 pointer-events-none" />

                        <div>
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-6 group-hover:scale-110 transition-transform duration-300">
                                <Coins className="w-6 h-6" />
                            </div>
                            <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Bitcoin Cash 2023+</span>
                            <h3 className="text-2xl font-bold tracking-tight mt-1 mb-2">Native CashTokens</h3>
                            <p className="text-zinc-400 text-sm leading-relaxed">
                                First-class UTXO token and NFT support on Bitcoin Cash. View BCMR onchain metadata, send multi-token transactions in a single output, and inspect token commitments.
                            </p>
                        </div>

                        <div className="mt-8 flex items-center gap-2 flex-wrap">
                            <span className="px-3 py-1 rounded-lg bg-zinc-800/80 border border-zinc-700/60 text-xs font-mono text-zinc-300">
                                BCMR Metadata
                            </span>
                            <span className="px-3 py-1 rounded-lg bg-zinc-800/80 border border-zinc-700/60 text-xs font-mono text-zinc-300">
                                &lt;$0.001 Fees
                            </span>
                            <span className="px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono text-emerald-400">
                                UTXO Covenants
                            </span>
                        </div>
                    </motion.div>

                    {/* Card 5: Real-Time Pyth Oracle Feeds */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                        className="relative rounded-3xl p-8 bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 border border-zinc-800/80 hover:border-cyan-500/40 transition-all duration-300 group overflow-hidden shadow-2xl flex flex-col justify-between"
                    >
                        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl group-hover:bg-cyan-500/20 transition-all duration-500 pointer-events-none" />

                        <div>
                            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-6 group-hover:scale-110 transition-transform duration-300">
                                <Activity className="w-6 h-6" />
                            </div>
                            <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest">Pyth Network</span>
                            <h3 className="text-2xl font-bold tracking-tight mt-1 mb-2">Live Price Feeds</h3>
                            <p className="text-zinc-400 text-sm leading-relaxed">
                                Millisecond-latency oracle price telemetry directly inside your portfolio. Verify exchange rates onchain before signing intent commitments.
                            </p>
                        </div>

                        <div className="mt-8 flex items-center justify-between text-xs text-zinc-400 pt-4 border-t border-zinc-800/60">
                            <span className="flex items-center gap-1.5 text-cyan-400 font-mono">
                                <Zap className="w-3.5 h-3.5" /> 400ms Sub-second Updates
                            </span>
                            <span className="text-zinc-500">Cross-Verified</span>
                        </div>
                    </motion.div>

                </div>
            </div>
        </section>
    );
}

export default WalletBentoOverview;
