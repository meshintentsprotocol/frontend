import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const NETWORKS = [
    {
        name: "Bitcoin Cash",
        icon: <img src="/logos/bitcoin-cash-bch-logo.svg" alt="BCH" className="w-12 h-12" />,
        position: "top-[10%] left-[8%] z-50",
        delay: 0,
        live: true,
    },
    {
        name: "Solana",
        icon: <img src="/logos/solana.svg" alt="Solana" className="w-12 h-12" />,
        position: "top-[15%] right-[10%]",
        delay: 0.2,
        live: true,
    },
    {
        name: "Movement",
        icon: <img src="/logos/movement.svg" alt="MOVE" className="w-12 h-12" />,
        position: "top-[42%] right-[5%]",
        delay: 0.4,
        live: true,
    },
    {
        name: "Monero",
        icon: <img src="/logos/monero.svg" alt="XMR" className="w-12 h-12" />,
        position: "top-[42%] left-[2%]",
        delay: 0.6,
        live: true,
    },
    {
        name: "Ethereum",
        icon: <img src="/logos/ethereum-eth-logo.svg" alt="ETH" className="w-12 h-12 grayscale group-hover:grayscale-0 transition-all duration-300 opacity-50 group-hover:opacity-100" />,
        position: "bottom-[15%] left-[12%]",
        delay: 0.7,
        live: false,
    },
    {
        name: "Arbitrum",
        icon: <img src="/logos/arbitrum-arb-logo.svg" alt="ARB" className="w-12 h-12 grayscale group-hover:grayscale-0 transition-all duration-300 opacity-50 group-hover:opacity-100" />,
        position: "top-[45%] right-[2%]",
        delay: 0.9,
        live: false,
    },
    {
        name: "Avalanche",
        icon: <img src="/logos/avalanche-avax-logo.svg" alt="AVAX" className="w-12 h-12 grayscale group-hover:grayscale-0 transition-all duration-300 opacity-50 group-hover:opacity-100" />,
        position: "top-[4%] left-[45%]",
        delay: 1.1,
        live: false,
    },
    {
        name: "Base",
        icon: <img src="/logos/Base_square_blue.svg" alt="BASE" className="w-12 h-12 grayscale group-hover:grayscale-0 transition-all duration-300 opacity-50 group-hover:opacity-100" />,
        position: "bottom-[5%] left-[45%]",
        delay: 1.3,
        live: false,
    },
    {
        name: "Polygon",
        icon: <img src="/logos/polygon-matic-logo.svg" alt="MATIC" className="w-12 h-12 grayscale group-hover:grayscale-0 transition-all duration-300 opacity-50 group-hover:opacity-100" />,
        position: "bottom-[5%] left-[25%]",
        delay: 1.5,
        live: false,
    }
];

export function LiveOnSection() {
    return (
        <section id="live-on-network" className="relative py-20 lg:py-0 lg:min-h-[850px] flex items-center justify-center overflow-hidden bg-[#050505] border-y border-white/5">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay pointer-events-none"></div>
            <div className="absolute top-1/2 left-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[140px] pointer-events-none opacity-40 -translate-y-1/2" />
            <div className="absolute top-1/2 right-1/4 w-[600px] h-[600px] bg-teal-500/5 rounded-full blur-[140px] pointer-events-none opacity-40 -translate-y-1/2" />

            <div className="container mx-auto px-4 relative z-10 w-full flex flex-col items-center justify-center h-full">

                {/* Center Content */}
                <div className="text-center z-20 max-w-4xl pointer-events-none flex flex-col items-center justify-center mt-12 lg:mt-0">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-subtle border border-white/10 mb-8 pointer-events-auto">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        <span className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
                            Live on Network
                        </span>
                    </div>

                    <h2 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
                        Atomic Execution. Native Assets. No Bridges.
                    </h2>
                    <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
                        Each chain locks funds via a Hash Time-Lock Contract (HTLC). A shared secret links both sides — either both complete, or both refund. No custodians. No wrapped tokens. Pure atomic settlement.
                    </p>

                </div>

                {/* Scattered Cards for Desktop */}
                <div className="absolute inset-0 hidden lg:block w-full h-full pointer-events-none z-10">
                    {NETWORKS.map((network, idx) => (
                        <motion.div
                            key={idx}
                            className={cn("absolute pointer-events-auto", network.position)}
                            animate={{ y: [0, -20, 0] }}
                            transition={{ duration: 5 + (idx % 3), repeat: Infinity, ease: "easeInOut", delay: network.delay }}
                            whileHover={{ y: -25, scale: 1.1, zIndex: 50 }}
                        >
                            <div className="group flex flex-col items-center justify-center p-6 w-44 h-44 rounded-[2.5rem] bg-zinc-900/40 border border-white/5 backdrop-blur-xl hover:bg-zinc-800/80 transition-all duration-300 cursor-pointer shadow-2xl hover:shadow-[0_0_50px_rgba(255,255,255,0.08)] hover:border-white/20">
                                <div className="mb-4 transform group-hover:scale-110 transition-transform duration-300">
                                    {network.icon}
                                </div>
                                <span className="text-base font-semibold text-white/50 group-hover:text-white transition-colors duration-300">
                                    {network.name}
                                </span>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Grid for Mobile */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-16 lg:hidden w-full max-w-2xl mx-auto relative z-10 pointer-events-auto">
                    {NETWORKS.map((network, idx) => (
                        <div key={idx} className="group flex flex-col items-center justify-center p-6 rounded-3xl bg-zinc-900/40 border border-white/5 backdrop-blur-md hover:bg-zinc-800/60 transition-colors cursor-pointer">
                            <div className="mb-3 transform group-hover:scale-110 transition-transform duration-300">
                                {network.icon}
                            </div>
                            <span className="text-sm font-semibold text-white/70 text-center">
                                {network.name}
                            </span>
                        </div>
                    ))}
                </div>

            </div>
        </section>
    );
}
