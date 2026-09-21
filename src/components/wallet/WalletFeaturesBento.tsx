import { motion } from 'framer-motion';
import { 
    ShieldCheck, 
    KeyRound, 
    Shuffle, 
    Layers, 
    Cpu, 
    Smartphone, 
    Flame, 
    Check, 
    QrCode,
    Sparkles,
    Lock
} from 'lucide-react';

export function WalletFeaturesBento() {
    return (
        <section className="relative py-28 bg-[#060606] text-white overflow-hidden border-t border-zinc-900">
            {/* Background Lighting */}
            <div className="absolute top-1/4 left-10 w-[500px] h-[500px] bg-teal-500/5 rounded-full blur-[170px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-10 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[170px] pointer-events-none" />

            <div className="container mx-auto px-4 relative z-10">
                {/* Header */}
                <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider"
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        Comprehensive Feature Matrix
                    </motion.div>
                    <motion.h2 
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight"
                    >
                        All the features you need. <span className="text-zinc-500 font-normal">(And then some.)</span>
                    </motion.h2>
                    <motion.p 
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="text-zinc-400 text-base sm:text-lg max-w-2xl mx-auto"
                    >
                        Built from the ground up for power users, DeFi liquidity providers, and everyday crypto spenders.
                    </motion.p>
                </div>

                {/* Bento Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">

                    {/* Feature 1: MEV & Front-Running Protection */}
                    <motion.div
                        initial={{ opacity: 0, y: 25 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                        className="md:col-span-2 rounded-3xl p-8 bg-zinc-900/60 border border-zinc-800 hover:border-emerald-500/30 transition-all duration-300 relative overflow-hidden group shadow-xl"
                    >
                        <div className="flex flex-col h-full justify-between gap-6">
                            <div>
                                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-6">
                                    <ShieldCheck className="w-6 h-6" />
                                </div>
                                <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Zero Toxic MEV</span>
                                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1 mb-2">
                                    Protected Intent Gossip via Nostr
                                </h3>
                                <p className="text-zinc-400 text-sm sm:text-base max-w-xl leading-relaxed">
                                    Orders are broadcasted over encrypted Nostr relays directly to authorized solvers. There is no public mempool for predatory sandwich bots to front-run or extract slippage from your transaction.
                                </p>
                            </div>

                            <div className="grid sm:grid-cols-2 gap-3 pt-4 border-t border-zinc-800/80">
                                <div className="p-3.5 rounded-2xl bg-black/40 border border-zinc-800">
                                    <div className="text-emerald-400 font-bold text-sm flex items-center gap-1.5">
                                        <Check className="w-4 h-4" /> 100% Dutch Auction
                                    </div>
                                    <div className="text-xs text-zinc-400 mt-1">Price improves continuously until best solver fills</div>
                                </div>
                                <div className="p-3.5 rounded-2xl bg-black/40 border border-zinc-800">
                                    <div className="text-emerald-400 font-bold text-sm flex items-center gap-1.5">
                                        <Check className="w-4 h-4" /> Zero Slippage Shock
                                    </div>
                                    <div className="text-xs text-zinc-400 mt-1">Guaranteed minimum output or full refund</div>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Feature 2: Universal 1-Seed Multi-Chain */}
                    <motion.div
                        initial={{ opacity: 0, y: 25 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="rounded-3xl p-8 bg-zinc-900/60 border border-zinc-800 hover:border-violet-500/30 transition-all duration-300 relative overflow-hidden group shadow-xl flex flex-col justify-between"
                    >
                        <div>
                            <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mb-6">
                                <KeyRound className="w-6 h-6" />
                            </div>
                            <span className="text-xs font-bold text-violet-400 uppercase tracking-widest">BIP-44 & SLIP-0044</span>
                            <h3 className="text-2xl font-bold tracking-tight mt-1 mb-2">
                                Universal Seed
                            </h3>
                            <p className="text-zinc-400 text-sm leading-relaxed">
                                One single 12 or 24-word seed phrase derives standard CashAddr for Bitcoin Cash, 0x for Ethereum/EVM, and Base58 for Solana.
                            </p>
                        </div>

                        <div className="mt-6 p-3 rounded-2xl bg-black/50 border border-zinc-800 font-mono text-[11px] text-zinc-400 space-y-1.5">
                            <div className="text-emerald-400 font-bold">m/44'/145'/0' (BCH CashAddr)</div>
                            <div className="text-blue-400 font-bold">m/44'/60'/0' (EVM / ETH)</div>
                            <div className="text-purple-400 font-bold">m/44'/501'/0' (Solana SPL)</div>
                        </div>
                    </motion.div>

                    {/* Feature 3: Universal DApp Connect */}
                    <motion.div
                        initial={{ opacity: 0, y: 25 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="rounded-3xl p-8 bg-zinc-900/60 border border-zinc-800 hover:border-cyan-500/30 transition-all duration-300 relative overflow-hidden group shadow-xl flex flex-col justify-between"
                    >
                        <div>
                            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-6">
                                <QrCode className="w-6 h-6" />
                            </div>
                            <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest">Ecosystem Compatibility</span>
                            <h3 className="text-2xl font-bold tracking-tight mt-1 mb-2">
                                Universal DApp Connect
                            </h3>
                            <p className="text-zinc-400 text-sm leading-relaxed">
                                Connect to thousands of decentralized apps via WalletConnect v2 QR codes, in-app mobile browser, or browser extension injection.
                            </p>
                        </div>

                        <div className="mt-6 flex items-center justify-between text-xs text-zinc-400 pt-4 border-t border-zinc-800">
                            <span>WalletConnect v2</span>
                            <span className="text-cyan-400 font-bold">Injected window.intent</span>
                        </div>
                    </motion.div>

                    {/* Feature 4: Atomic HTLC Settlement */}
                    <motion.div
                        initial={{ opacity: 0, y: 25 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        className="md:col-span-2 rounded-3xl p-8 bg-zinc-900/60 border border-zinc-800 hover:border-teal-500/30 transition-all duration-300 relative overflow-hidden group shadow-xl"
                    >
                        <div className="flex flex-col h-full justify-between gap-6">
                            <div>
                                <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 mb-6">
                                    <Shuffle className="w-6 h-6" />
                                </div>
                                <span className="text-xs font-bold text-teal-400 uppercase tracking-widest">Non-Custodial Architecture</span>
                                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1 mb-2">
                                    Atomic HTLC & CashScript Covenants
                                </h3>
                                <p className="text-zinc-400 text-sm sm:text-base max-w-xl leading-relaxed">
                                    Cross-chain transactions rely on mathematical guarantees: Hash Time-Locked Contracts (HTLC) and CashScript covenants ensure you either receive the target token, or your original funds automatically refund upon timeout.
                                </p>
                            </div>

                            <div className="flex items-center gap-3 text-xs font-mono text-zinc-400 flex-wrap">
                                <span className="px-3 py-1.5 rounded-xl bg-black/60 border border-zinc-800 text-teal-300">
                                    SHA256 Hash Locks
                                </span>
                                <span className="px-3 py-1.5 rounded-xl bg-black/60 border border-zinc-800 text-teal-300">
                                    OP_CHECKLOCKTIMEVERIFY
                                </span>
                                <span className="px-3 py-1.5 rounded-xl bg-black/60 border border-zinc-800 text-teal-300">
                                    Zero Bridge Exploit Surface
                                </span>
                            </div>
                        </div>
                    </motion.div>

                </div>
            </div>
        </section>
    );
}

export default WalletFeaturesBento;
