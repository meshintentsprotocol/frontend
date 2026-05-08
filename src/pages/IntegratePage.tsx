import React, { useState } from 'react';
import { Header } from '@/components/common/Header';
import { Footer } from '@/components/common/Footer';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { 
    ArrowRight, Code2, Cpu, Link as LinkIcon, Blocks, 
    Network, Zap, ShieldCheck, Box, TerminalSquare, 
    Smartphone, Server, Workflow, CheckCircle2, Coins 
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function IntegratePage() {
    const [activeTab, setActiveTab] = useState<'bch' | 'crosschain'>('bch');

    return (
        <div className="min-h-screen flex flex-col bg-[#050505] selection:bg-primary/30 text-foreground overflow-x-hidden">
            <Header />

            <main className="flex-1">
                {/* 1. ADVANCED MESH HERO SECTION */}
                <section className="relative min-h-[90vh] flex items-center pt-20 pb-12 overflow-hidden">
                    <div className="absolute inset-0 bg-[#050505] z-0" />
                    
                    {/* Mesh Gradient Backgrounds */}
                    <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0 opacity-60">
                        <div className="absolute -top-[10%] -left-[10%] w-[50vw] h-[50vw] rounded-full blur-[120px] mesh-gradient-primary animate-pulse-glow" />
                        <div className="absolute top-[40%] -right-[10%] w-[40vw] h-[40vw] rounded-full blur-[150px] mesh-gradient-purple animate-pulse-glow delay-1000 opacity-50" />
                        <div className="absolute -bottom-[20%] left-[20%] w-[60vw] h-[60vw] rounded-full blur-[150px] mesh-gradient-orange animate-pulse-glow delay-500 opacity-40" />
                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] mix-blend-overlay"></div>
                    </div>

                    {/* Floating Geometric/Code Elements */}
                    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                        <motion.div 
                            className="absolute top-1/4 left-[10%] w-32 h-32 border border-white/10 rounded-2xl bg-white/5 backdrop-blur-md flex items-center justify-center rotate-12"
                            animate={{ y: [-20, 20, -20], rotate: [12, 15, 12] }}
                            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                        >
                            <Code2 className="w-12 h-12 text-white/20" />
                        </motion.div>
                        <motion.div 
                            className="absolute bottom-1/3 right-[15%] w-40 h-40 border border-primary/20 rounded-full bg-primary/5 backdrop-blur-sm -rotate-6"
                            animate={{ y: [20, -20, 20], rotate: [-6, -10, -6] }}
                            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                        />
                    </div>

                    <div className="container mx-auto px-4 relative z-10 text-center">
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="max-w-4xl mx-auto space-y-8"
                        >
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md mb-4">
                                <span className="flex h-2 w-2 rounded-full bg-primary animate-ping" />
                                <span className="text-sm font-medium text-zinc-300">v0.1.0 Available on NPM</span>
                            </div>
                            
                            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-tight">
                                The Universal <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-emerald-400 to-cyan-400">
                                    Intents SDK
                                </span>
                            </h1>
                            
                            <p className="text-xl md:text-2xl text-zinc-400 max-w-3xl mx-auto leading-relaxed">
                                The ultimate TypeScript toolkit for Intent-Centric DeFi. Tap into infinite Just-In-Time (JIT) liquidity, eliminate slippage, and completely eradicate Impermanent Loss. Build the next generation of trustless exchanges on Bitcoin Cash.
                            </p>

                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
                                <Button size="lg" className="h-14 px-8 text-lg font-bold rounded-full bg-white text-black hover:bg-zinc-200 w-full sm:w-auto glow-primary" onClick={() => document.getElementById('bifurcation')?.scrollIntoView({ behavior: 'smooth' })}>
                                    Start Building
                                    <ArrowRight className="ml-2 w-5 h-5" />
                                </Button>
                                <Button size="lg" variant="outline" className="h-14 px-8 text-lg font-bold rounded-full border-white/20 bg-white/5 hover:bg-white/10 backdrop-blur-md w-full sm:w-auto text-white" onClick={() => window.open('https://docs.intentsprotocol.xyz/', '_blank')}>
                                    Read Documentation
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                </section>

                {/* 2. THE BIFURCATION (BCH Native vs Cross-Chain) */}
                <section id="bifurcation" className="relative py-24 bg-zinc-950 border-y border-white/5">
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay"></div>
                    
                    <div className="container mx-auto px-4 relative z-10">
                        <div className="text-center mb-16">
                            <h2 className="text-4xl md:text-5xl font-bold mb-6">Choose Your Path</h2>
                            <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
                                The SDK is divided into two primary toolsets, allowing you to build exactly what your users need without unnecessary bloat.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
                            {/* Path A: BCH Native */}
                            <motion.div 
                                initial={{ opacity: 0, x: -30 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true, margin: "-100px" }}
                                className="relative group rounded-3xl p-1 bg-gradient-to-b from-emerald-500/20 to-transparent hover:from-emerald-500/40 transition-all duration-500"
                            >
                                <div className="h-full bg-zinc-900 rounded-[22px] p-8 md:p-10 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[80px] rounded-full group-hover:bg-emerald-500/20 transition-all" />
                                    
                                    <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-8 relative z-10">
                                        <Box className="w-8 h-8 text-emerald-400" />
                                    </div>
                                    
                                    <h3 className="text-3xl font-bold mb-4 relative z-10 text-white">BCH Native SDK</h3>
                                    <p className="text-zinc-400 text-lg mb-8 relative z-10 min-h-[80px]">
                                        Perfect for DEXs, stablecoin wallets, and native ecosystem dApps. Execute CashToken swaps, Dutch Auctions, and Limit Orders directly on-chain.
                                    </p>
                                    
                                    <ul className="space-y-4 mb-8 relative z-10">
                                        {[
                                            "Stateless Recursive Covenants",
                                            "User Experience via Electron Wallet & WizardConnect",
                                            "MEV-Proof Dutch Auctions & Limit Orders",
                                            "Decentralized Nostr Intent Pools"
                                        ].map((feature, i) => (
                                            <li key={i} className="flex items-center text-zinc-300">
                                                <CheckCircle2 className="w-5 h-5 text-emerald-400 mr-3 shrink-0" />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </motion.div>

                            {/* Path B: Cross-Chain */}
                            <motion.div 
                                initial={{ opacity: 0, x: 30 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true, margin: "-100px" }}
                                className="relative group rounded-3xl p-1 bg-gradient-to-b from-purple-500/20 to-transparent hover:from-purple-500/40 transition-all duration-500"
                            >
                                <div className="h-full bg-zinc-900 rounded-[22px] p-8 md:p-10 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 blur-[80px] rounded-full group-hover:bg-purple-500/20 transition-all" />
                                    
                                    <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-8 relative z-10">
                                        <Network className="w-8 h-8 text-purple-400" />
                                    </div>
                                    
                                    <h3 className="text-3xl font-bold mb-4 relative z-10 text-white">Cross-Chain SDK</h3>
                                    <p className="text-zinc-400 text-lg mb-8 relative z-10 min-h-[80px]">
                                        Tap into global liquidity. Bridge Solana, EVM, and Movement directly to Bitcoin Cash without wrapped tokens, custodial bridges, or trusted oracles.
                                    </p>
                                    
                                    <ul className="space-y-4 mb-8 relative z-10">
                                        {[
                                            "Trustless HTLC Atomic Swaps",
                                            "Cross-Curve Cryptographic Proofs",
                                            "Trustless Layer 1 Settlement",
                                            "Zero-Slippage JIT Liquidity Bridging"
                                        ].map((feature, i) => (
                                            <li key={i} className="flex items-center text-zinc-300">
                                                <CheckCircle2 className="w-5 h-5 text-purple-400 mr-3 shrink-0" />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </section>

                {/* 3. INTERACTIVE CODE SHOWCASE */}
                <section className="relative py-24 bg-[#050505] overflow-hidden">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-full max-h-[800px] bg-emerald-900/10 blur-[150px] rounded-full pointer-events-none" />
                    
                    <div className="container mx-auto px-4 relative z-10">
                        <div className="text-center mb-12">
                            <h2 className="text-4xl md:text-5xl font-bold mb-6">Developer Experience First</h2>
                            <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
                                The SDK provides a fluent, environment-agnostic API that supports both web frontends and native desktop python environments (via PyQt5). It abstracts away the extreme complexity of Bitcoin Cash smart contracts and cross-chain cryptography.
                            </p>
                        </div>

                        <div className="max-w-5xl mx-auto">
                            {/* Window Chrome */}
                            <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/80 backdrop-blur-xl shadow-2xl">
                                <div className="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-white/5">
                                    <div className="flex gap-2">
                                        <div className="w-3 h-3 rounded-full bg-red-500/80" />
                                        <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                                        <div className="w-3 h-3 rounded-full bg-green-500/80" />
                                    </div>
                                    <div className="flex gap-2 bg-black/50 p-1 rounded-lg border border-white/5">
                                        <button 
                                            onClick={() => setActiveTab('bch')}
                                            className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-colors", activeTab === 'bch' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white')}
                                        >
                                            Native BCH Intent
                                        </button>
                                        <button 
                                            onClick={() => setActiveTab('crosschain')}
                                            className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-colors", activeTab === 'crosschain' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white')}
                                        >
                                            Cross-Chain Swap
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="p-6 md:p-8 overflow-x-auto text-sm md:text-base font-mono leading-relaxed text-zinc-300">
                                    <AnimatePresence mode="wait">
                                        {activeTab === 'bch' ? (
                                            <motion.div
                                                key="bch"
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                transition={{ duration: 0.3 }}
                                            >
                                                <span className="text-zinc-500">{"// Gasless execution: The solver pays the network fees"}</span><br/>
                                                <span className="text-zinc-500">{"// 1. Build the Intent off-chain"}</span><br/>
                                                <span className="text-purple-400">const</span> intentParams = IntentBuilder.<span className="text-blue-400">dutchAuction</span>()<br/>
                                                &nbsp;&nbsp;&nbsp;&nbsp;.<span className="text-yellow-200">makerAddress</span>(<span className="text-green-400">'bchtest:qzj9ccz7...'</span>)<br/>
                                                &nbsp;&nbsp;&nbsp;&nbsp;.<span className="text-yellow-200">sellToken</span>(<span className="text-green-400">'BCH'</span>)<br/>
                                                &nbsp;&nbsp;&nbsp;&nbsp;.<span className="text-yellow-200">buyToken</span>(<span className="text-green-400">'tokenIdHex...'</span>)<br/>
                                                &nbsp;&nbsp;&nbsp;&nbsp;.<span className="text-yellow-200">sellAmount</span>(<span className="text-orange-400">5000n</span>)<br/>
                                                &nbsp;&nbsp;&nbsp;&nbsp;.<span className="text-yellow-200">startBuyAmount</span>(<span className="text-orange-400">6000n</span>) <span className="text-zinc-500">{"// Decaying price curve"}</span><br/>
                                                &nbsp;&nbsp;&nbsp;&nbsp;.<span className="text-yellow-200">endBuyAmount</span>(<span className="text-orange-400">4000n</span>)<br/>
                                                &nbsp;&nbsp;&nbsp;&nbsp;.<span className="text-yellow-200">duration</span>(Duration.<span className="text-blue-400">minutes</span>(<span className="text-orange-400">10</span>))<br/>
                                                &nbsp;&nbsp;&nbsp;&nbsp;.<span className="text-blue-400">build</span>();<br/>
                                                <br/>
                                                <span className="text-zinc-500">{"// 2. Compile to a CashScript Covenant"}</span><br/>
                                                <span className="text-purple-400">const</span> client = <span className="text-purple-400">new</span> <span className="text-emerald-400">IntentsLocalClient</span>(provider);<br/>
                                                <span className="text-purple-400">const</span> contract = client.<span className="text-blue-400">compileDutchAuction</span>(intentParams);<br/>
                                                <br/>
                                                <span className="text-zinc-500">{"// 3. Request user to fund the intent via WizardConnect"}</span><br/>
                                                <span className="text-purple-400">await</span> adapter.<span className="text-blue-400">send</span>(contract.address, intentParams.sellAmount);<br/>
                                            </motion.div>
                                        ) : (
                                            <motion.div
                                                key="crosschain"
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                transition={{ duration: 0.3 }}
                                            >
                                                <span className="text-zinc-500">{"// Guaranteed returns: Users are protected from MEV and front-running"}</span><br/>
                                                <span className="text-zinc-500">{"// 1. Generate Cross-Chain Secrets (HTLC)"}</span><br/>
                                                <span className="text-purple-400">const</span> secret = HTLCCrypto.<span className="text-blue-400">generateSecret</span>();<br/>
                                                <span className="text-purple-400">const</span> secretHash = HTLCCrypto.<span className="text-blue-400">hashSecret</span>(secret);<br/>
                                                <br/>
                                                <span className="text-zinc-500">{"// 2. Build the Cross-Chain Intent"}</span><br/>
                                                <span className="text-purple-400">const</span> intent = CrossChainBuilder.<span className="text-blue-400">createSwap</span>()<br/>
                                                &nbsp;&nbsp;&nbsp;&nbsp;.<span className="text-yellow-200">sourceChain</span>(<span className="text-green-400">'SOLANA'</span>)<br/>
                                                &nbsp;&nbsp;&nbsp;&nbsp;.<span className="text-yellow-200">targetChain</span>(<span className="text-green-400">'BCH'</span>)<br/>
                                                &nbsp;&nbsp;&nbsp;&nbsp;.<span className="text-yellow-200">sellAmount</span>(<span className="text-orange-400">100</span>, <span className="text-green-400">'USDC'</span>)<br/>
                                                &nbsp;&nbsp;&nbsp;&nbsp;.<span className="text-yellow-200">buyAmount</span>(<span className="text-orange-400">0.5</span>, <span className="text-green-400">'BCH'</span>)<br/>
                                                &nbsp;&nbsp;&nbsp;&nbsp;.<span className="text-yellow-200">htlcSecretHash</span>(secretHash)<br/>
                                                &nbsp;&nbsp;&nbsp;&nbsp;.<span className="text-yellow-200">solverTimelock</span>(<span className="text-orange-400">7200</span>)<br/>
                                                &nbsp;&nbsp;&nbsp;&nbsp;.<span className="text-blue-400">build</span>();<br/>
                                                <br/>
                                                <span className="text-zinc-500">{"// 3. Connect to the Relayer Network"}</span><br/>
                                                <span className="text-purple-400">const</span> relayer = <span className="text-purple-400">new</span> <span className="text-emerald-400">NostrRelayerClient</span>();<br/>
                                                <span className="text-purple-400">await</span> relayer.<span className="text-blue-400">publishIntent</span>(intent);<br/>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 4. THE SOLVER NETWORK */}
                <section className="relative py-24 bg-zinc-950 border-t border-white/5 overflow-hidden">
                    <div className="absolute inset-0 z-0">
                        {/* CSS Mesh Network representation */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
                    </div>

                    <div className="container mx-auto px-4 relative z-10">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                            <div>
                                <h2 className="text-4xl md:text-5xl font-bold mb-6">The End of AMMs. <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Powered by Just-In-Time Liquidity</span></h2>
                                <p className="text-xl text-zinc-400 mb-8 leading-relaxed">
                                    Traditional AMMs force you to bootstrap liquidity pools, resulting in capital fragmentation and impermanent loss. 
                                    <br/><br/>
                                    The BCH Intents SDK taps directly into a decentralized Nostr network of professional Solvers. They compete to fill your users' orders using their own off-chain inventory, guaranteeing zero slippage and complete MEV protection.
                                </p>
                                
                                <div className="space-y-6">
                                    <div className="flex items-start">
                                        <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mr-4 shrink-0 border border-blue-500/20">
                                            <Zap className="w-6 h-6 text-blue-400" />
                                        </div>
                                        <div>
                                            <h4 className="text-xl font-bold mb-2">Instant Execution</h4>
                                            <p className="text-zinc-400">Solvers provide liquidity instantly from their wallets as soon as the covenant is funded.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start">
                                        <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mr-4 shrink-0 border border-emerald-500/20">
                                            <ShieldCheck className="w-6 h-6 text-emerald-400" />
                                        </div>
                                        <div>
                                            <h4 className="text-xl font-bold mb-2">MEV Resistant</h4>
                                            <p className="text-zinc-400">Trades are evaluated off-chain and executed by solvers in a single atomic transaction. No front-running.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start">
                                        <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mr-4 shrink-0 border border-purple-500/20">
                                            <Coins className="w-6 h-6 text-purple-400" />
                                        </div>
                                        <div>
                                            <h4 className="text-xl font-bold mb-2">Frontend Monetization</h4>
                                            <p className="text-zinc-400">Bake protocol fees directly into the covenant. Earn revenue on every swap without running backend infrastructure.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="relative h-[400px] bg-black/50 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-md flex items-center justify-center">
                                {/* Abstract animated node network */}
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-emerald-500/5" />
                                <motion.div 
                                    className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/40 absolute z-20 flex items-center justify-center"
                                    animate={{ scale: [1, 1.1, 1], boxShadow: ['0 0 0 0 rgba(16, 185, 129, 0.4)', '0 0 0 20px rgba(16, 185, 129, 0)', '0 0 0 0 rgba(16, 185, 129, 0)'] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                >
                                    <Box className="w-8 h-8 text-emerald-400" />
                                </motion.div>
                                
                                {/* Surrounding nodes */}
                                {[
                                    { x: -100, y: -80, delay: 0 },
                                    { x: 120, y: -60, delay: 0.5 },
                                    { x: -120, y: 80, delay: 1 },
                                    { x: 100, y: 100, delay: 1.5 },
                                ].map((pos, i) => (
                                    <React.Fragment key={i}>
                                        <motion.div 
                                            className="w-3 h-3 rounded-full bg-blue-400 absolute z-10"
                                            initial={{ x: pos.x, y: pos.y }}
                                            animate={{ opacity: [0.3, 1, 0.3] }}
                                            transition={{ duration: 2, delay: pos.delay, repeat: Infinity }}
                                        />
                                        <svg className="absolute inset-0 w-full h-full z-0 opacity-20">
                                            <line x1="50%" y1="50%" x2={`calc(50% + ${pos.x}px)`} y2={`calc(50% + ${pos.y}px)`} stroke="url(#gradient)" strokeWidth="2" strokeDasharray="4 4">
                                                <animate attributeName="stroke-dashoffset" from="100" to="0" dur="2s" repeatCount="indefinite" />
                                            </line>
                                        </svg>
                                    </React.Fragment>
                                ))}
                                <svg width="0" height="0">
                                    <defs>
                                        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stopColor="#3b82f6" />
                                            <stop offset="100%" stopColor="#10b981" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 5. PACKAGES & ECOSYSTEM */}
                <section className="relative py-24 bg-[#050505]">
                    <div className="container mx-auto px-4 relative z-10">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl md:text-5xl font-bold mb-4">Modular Packages</h2>
                            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                                Install only what you need. Our monorepo is divided into highly focused, tree-shakeable packages.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[
                                { name: "@bch-intents/sdk-cashtokens", desc: "Fluent IntentBuilder API and Local Client for compiling CashScript covenants.", icon: Box, color: "text-emerald-400", bg: "bg-emerald-500/10" },
                                { name: "@bch-intents/sdk-cross-chain", desc: "HTLC cryptography, adaptor signatures, and EVM/Solana routing logic.", icon: Network, color: "text-purple-400", bg: "bg-purple-500/10" },
                                { name: "@bch-intents/sdk-wallet-adapter", desc: "Provider-agnostic signing featuring WizardConnect for mobile wallets.", icon: Smartphone, color: "text-blue-400", bg: "bg-blue-500/10" },
                                { name: "@bch-intents/sdk-order-book", desc: "NostrRelayerClient for NIP-44 encrypted solver networks.", icon: Server, color: "text-orange-400", bg: "bg-orange-500/10" },
                                { name: "Electron Cash Plugin (Upcoming)", desc: "A native Python plugin leveraging ElectronCashAdapter for desktop power users.", icon: TerminalSquare, color: "text-yellow-400", bg: "bg-yellow-500/10" }
                            ].map((pkg, i) => (
                                <div key={i} className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 hover:bg-zinc-900 transition-colors">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 ${pkg.bg}`}>
                                        <pkg.icon className={`w-6 h-6 ${pkg.color}`} />
                                    </div>
                                    <h3 className="font-mono text-sm font-bold text-zinc-200 mb-3">{pkg.name}</h3>
                                    <p className="text-sm text-zinc-400">{pkg.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>


                {/* 7. CTA */}
                <section className="relative py-32 bg-[#050505] overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary/10" />
                    
                    <div className="container mx-auto px-4 relative z-10 text-center">
                        <h2 className="text-5xl md:text-6xl font-black mb-8">Ready to Build?</h2>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Button size="lg" className="h-14 px-8 text-lg font-bold rounded-full bg-primary text-black hover:bg-primary/90 w-full sm:w-auto glow-primary" onClick={() => window.open('https://docs.intentsprotocol.xyz/', '_blank')}>
                                Read the GitBook Docs
                                <ArrowRight className="ml-2 w-5 h-5" />
                            </Button>
                            <Button size="lg" variant="outline" className="h-14 px-8 text-lg font-bold rounded-full border-white/20 hover:bg-white/5 w-full sm:w-auto" onClick={() => window.open('https://github.com/Intents-Swaps', '_blank')}>
                                View GitHub Repository
                            </Button>
                        </div>
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
}
