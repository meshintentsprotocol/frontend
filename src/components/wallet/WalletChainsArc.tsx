import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, CheckCircle2, ArrowRight, Shield, Zap, Globe, Sparkles } from 'lucide-react';
import { WalletPhoneModel } from './WalletPhoneModel';
import { ScreenPortfolio } from './WalletFlowScreens';

interface ChainInfo {
    id: string;
    name: string;
    symbol: string;
    color: string;
    badgeBg: string;
    textColor: string;
    icon: string;
    type: string;
    speed: string;
    fee: string;
    description: string;
    features: string[];
}

const SUPPORTED_CHAINS: ChainInfo[] = [
    {
        id: 'bch',
        name: 'Bitcoin Cash',
        symbol: 'BCH',
        color: 'from-emerald-500 to-teal-400',
        badgeBg: 'bg-emerald-500/15 border-emerald-500/30',
        textColor: 'text-emerald-400',
        icon: '💚',
        type: 'Native UTXO + CashTokens',
        speed: '~Instant (0-conf) / 10m',
        fee: '< $0.001',
        description: 'Native L1 blockchain for peer-to-peer digital cash with advanced CashScript smart covenants and UTXO CashTokens.',
        features: ['Native CashTokens', 'CashScript Covenants', '0-Conf Double-Spend Proofs', 'Ultra-low Gas'],
    },
    {
        id: 'sol',
        name: 'Solana',
        symbol: 'SOL',
        color: 'from-violet-500 to-purple-400',
        badgeBg: 'bg-violet-500/15 border-violet-500/30',
        textColor: 'text-violet-400',
        icon: '🟣',
        type: 'High-Throughput L1',
        speed: '400ms Sub-second',
        fee: '< $0.005',
        description: 'Ultra-fast execution layer powering high-frequency intent settlements with escrow programs.',
        features: ['SPL Tokens', 'Escrow Relayer Support', 'Sub-second Finality', 'Pyth High-Frequency Oracles'],
    },
    {
        id: 'eth',
        name: 'Ethereum',
        symbol: 'ETH',
        color: 'from-blue-500 to-indigo-400',
        badgeBg: 'bg-blue-500/15 border-blue-500/30',
        textColor: 'text-blue-400',
        icon: '🔷',
        type: 'EVM Mainnet',
        speed: '12s Finality',
        fee: 'Variable (~$0.80)',
        description: 'Decentralized smart contract settlement standard with automated HTLC and permit2 signatures.',
        features: ['ERC-20 & ERC-721', 'EIP-712 Intent Signing', 'Permit2 Gasless Swaps', 'Audited Covenants'],
    },
    {
        id: 'move',
        name: 'Movement Network',
        symbol: 'MOVE',
        color: 'from-amber-500 to-yellow-400',
        badgeBg: 'bg-amber-500/15 border-amber-500/30',
        textColor: 'text-amber-400',
        icon: '⚡',
        type: 'MoveVM Layer 2',
        speed: '< 1s Finality',
        fee: '< $0.001',
        description: 'High-performance MoveVM modular blockchain bringing formal verification and lightning speed to intents.',
        features: ['Move Language Security', 'Sub-second Batches', 'Formal Verification', 'Universal Bridge Free'],
    },
    {
        id: 'bsc',
        name: 'BNB Chain',
        symbol: 'BNB',
        color: 'from-yellow-500 to-amber-400',
        badgeBg: 'bg-yellow-500/15 border-yellow-500/30',
        textColor: 'text-yellow-400',
        icon: '🟡',
        type: 'EVM Compatible',
        speed: '3s Finality',
        fee: '< $0.05',
        description: 'High volume BEP-20 ecosystem supported via dedicated solver relayer relays for instant settlement.',
        features: ['BEP-20 Tokens', 'PancakeSwap Solver Route', 'Fast Block Time', 'Low EVM Fees'],
    },
    {
        id: 'arb',
        name: 'Arbitrum One',
        symbol: 'ARB',
        color: 'from-cyan-500 to-blue-400',
        badgeBg: 'bg-cyan-500/15 border-cyan-500/30',
        textColor: 'text-cyan-400',
        icon: '🔵',
        type: 'Ethereum Nitro L2',
        speed: '< 250ms',
        fee: '< $0.02',
        description: 'Leading Ethereum optimistic rollup with deep DeFi liquidity and ultra-cheap atomic HTLC executions.',
        features: ['Full EVM Equivalence', 'Nitro Tech Stack', 'Deep Stablecoin Liquidity', 'Instant Swaps'],
    },
    {
        id: 'base',
        name: 'Base',
        symbol: 'BASE',
        color: 'from-blue-600 to-cyan-400',
        badgeBg: 'bg-blue-600/15 border-blue-600/30',
        textColor: 'text-blue-400',
        icon: '🔵',
        type: 'Coinbase OP Stack L2',
        speed: '< 1s',
        fee: '< $0.01',
        description: 'Fast, secure and low-cost Ethereum Layer 2 powered by OP Stack, built for mass adoption and onchain finance.',
        features: ['OP Stack Architecture', 'Seamless On/Off Ramps', 'Account Abstraction', 'Zero Slippage Intents'],
    },
    {
        id: 'xmr',
        name: 'Monero',
        symbol: 'XMR',
        color: 'from-orange-500 to-amber-500',
        badgeBg: 'bg-orange-500/15 border-orange-500/30',
        textColor: 'text-orange-400',
        icon: '🟠',
        type: 'Privacy Native',
        speed: '2m Blocks',
        fee: '< $0.01',
        description: 'Trustless, non-interactive cross-chain atomic swaps between Bitcoin Cash and Monero using dual-signature scriptless scripts.',
        features: ['Confidential Transactions', 'Scriptless Script Swaps', 'Zero KYC Swaps', 'Complete Financial Privacy'],
    }
];

export function WalletChainsArc() {
    const [activeChain, setActiveChain] = useState<ChainInfo>(SUPPORTED_CHAINS[0]);

    return (
        <section className="relative py-28 bg-[#050505] text-white overflow-hidden border-t border-zinc-900">
            {/* Ambient Background Aura */}
            <div className="absolute top-1/3 right-10 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[180px] pointer-events-none" />
            <div className="absolute bottom-10 left-10 w-[500px] h-[500px] bg-violet-500/5 rounded-full blur-[160px] pointer-events-none" />

            <div className="container mx-auto px-4 relative z-10">
                {/* Section Header */}
                <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800/80 border border-zinc-700/60 text-zinc-300 text-xs font-semibold uppercase tracking-wider"
                    >
                        <Globe className="w-3.5 h-3.5 text-emerald-400" />
                        Multi-Chain Superhighway
                    </motion.div>
                    <motion.h2 
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight"
                    >
                        All your chains. <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-violet-400">One unified key.</span>
                    </motion.h2>
                    <motion.p 
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="text-zinc-400 text-base sm:text-lg max-w-2xl mx-auto"
                    >
                        Cham Wallet eliminates network switching. Manage Bitcoin Cash UTXOs, EVM tokens, Solana SPL, and MoveVM assets simultaneously with zero RPC configuration.
                    </motion.p>
                </div>

                {/* Main Interactive Showcase */}
                <div className="grid lg:grid-cols-12 gap-12 items-center max-w-6xl mx-auto">
                    
                    {/* LEFT / CENTER: Interactive Chain Arc Selector */}
                    <div className="lg:col-span-7 space-y-6">
                        <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                            <span>Supported Ecosystems</span>
                            <span className="h-[1px] flex-1 bg-zinc-800" />
                            <span className="text-emerald-400">{SUPPORTED_CHAINS.length} Live Chains</span>
                        </div>

                        {/* Chain Pills Grid / Arc */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {SUPPORTED_CHAINS.map((chain) => {
                                const isSelected = activeChain.id === chain.id;
                                return (
                                    <motion.button
                                        key={chain.id}
                                        whileHover={{ scale: 1.03 }}
                                        whileTap={{ scale: 0.97 }}
                                        onClick={() => setActiveChain(chain)}
                                        className={`flex items-center gap-2.5 p-3.5 rounded-2xl border transition-all duration-200 text-left ${
                                            isSelected 
                                                ? `${chain.badgeBg} ring-1 ring-emerald-400/50 shadow-lg shadow-emerald-500/10` 
                                                : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'
                                        }`}
                                    >
                                        <span className="text-xl">{chain.icon}</span>
                                        <div className="overflow-hidden">
                                            <div className="font-bold text-xs truncate text-white">{chain.name}</div>
                                            <div className="text-[10px] text-zinc-400 uppercase font-mono">{chain.symbol}</div>
                                        </div>
                                    </motion.button>
                                );
                            })}
                        </div>

                        {/* Dynamic Chain Detail Card */}
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeChain.id}
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -15 }}
                                transition={{ duration: 0.3 }}
                                className="p-6 rounded-3xl bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 relative overflow-hidden"
                            >
                                <div className={`absolute top-0 right-0 w-48 h-48 bg-gradient-to-br ${activeChain.color} opacity-10 rounded-full blur-2xl pointer-events-none`} />

                                <div className="space-y-4 relative z-10">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className="text-3xl">{activeChain.icon}</span>
                                            <div>
                                                <h3 className="text-xl font-black text-white">{activeChain.name}</h3>
                                                <span className={`text-xs font-mono font-semibold ${activeChain.textColor}`}>
                                                    {activeChain.type}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] uppercase font-bold text-zinc-500">Typical Fee</div>
                                            <div className="text-sm font-mono font-bold text-emerald-400">{activeChain.fee}</div>
                                        </div>
                                    </div>

                                    <p className="text-zinc-300 text-sm leading-relaxed">
                                        {activeChain.description}
                                    </p>

                                    {/* Feature Pills */}
                                    <div className="pt-2 flex flex-wrap gap-2">
                                        {activeChain.features.map((feat, idx) => (
                                            <span 
                                                key={idx} 
                                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-zinc-800/80 border border-zinc-700/60 text-xs text-zinc-300"
                                            >
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                                {feat}
                                            </span>
                                        ))}
                                    </div>

                                    <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400">
                                        <span className="flex items-center gap-1.5">
                                            <Zap className="w-3.5 h-3.5 text-amber-400" /> Block Time: {activeChain.speed}
                                        </span>
                                        <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                                            <Shield className="w-3.5 h-3.5" /> Full Solver Routing
                                        </span>
                                    </div>
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* RIGHT: Phone Preview */}
                    <div className="lg:col-span-5 flex justify-center">
                        <div className="relative">
                            <WalletPhoneModel size="md">
                                <ScreenPortfolio />
                            </WalletPhoneModel>
                            <div className="absolute -inset-4 bg-emerald-500/10 rounded-[3rem] blur-2xl -z-10" />
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
}

export default WalletChainsArc;
