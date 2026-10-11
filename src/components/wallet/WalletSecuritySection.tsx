import { motion } from 'framer-motion';
import { 
    ShieldCheck, 
    Lock, 
    Fingerprint, 
    FileCode, 
    EyeOff, 
    Terminal, 
    CheckCircle, 
    AlertTriangle,
    Sparkles
} from 'lucide-react';

const SECURITY_PILLARS = [
    {
        icon: Fingerprint,
        title: 'Biometric Passkeys & Enclave',
        badge: 'Zero-Knowledge',
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10 border-emerald-500/20',
        description: 'Private keys are stored in your device’s hardware Secure Enclave or Keychain, protected by biometric TouchID, FaceID, or hardware PIN.',
    },
    {
        icon: ShieldCheck,
        title: 'Pre-Sign Transaction Simulation',
        badge: 'Drainer Guard',
        color: 'text-teal-400',
        bg: 'bg-teal-500/10 border-teal-500/20',
        description: 'Inspect exact token balance changes and contract approvals before signing. Automated simulation catches drainers and spoofed tokens in real-time.',
    },
    {
        icon: FileCode,
        title: 'Audited CashScript & Covenants',
        badge: 'Mathematically Verified',
        color: 'text-violet-400',
        bg: 'bg-violet-500/10 border-violet-500/20',
        description: 'All atomic swap escrows and Mesh liquidity pools are open-source CashScript contracts, formally verified for UTXO correctness.',
    },
    {
        icon: EyeOff,
        title: 'Zero Tracking & No KYC',
        badge: 'Privacy Sovereign',
        color: 'text-cyan-400',
        bg: 'bg-cyan-500/10 border-cyan-500/20',
        description: 'No email, no phone numbers, no IP telemetry logs, and zero KYC. All cross-chain intents are gossiped peer-to-peer over Nostr.',
    },
];

export function WalletSecuritySection() {
    return (
        <section className="relative py-28 bg-[#040404] text-white overflow-hidden border-t border-zinc-900">
            {/* Ambient Lighting */}
            <div className="absolute top-1/3 left-1/3 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[200px] pointer-events-none" />

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
                        <Lock className="w-3.5 h-3.5" />
                        Institutional-Grade Self-Custody
                    </motion.div>
                    <motion.h2 
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight"
                    >
                        Security-first mindset. <br className="hidden sm:inline" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500">
                            Engineered for sovereign finance.
                        </span>
                    </motion.h2>
                    <motion.p 
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="text-zinc-400 text-base sm:text-lg max-w-2xl mx-auto"
                    >
                        In DeFi, true security means removing intermediaries and unverified bridges entirely. Cham Wallet enforces mathematical guarantees at every layer.
                    </motion.p>
                </div>

                {/* 4 Pillars Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
                    {SECURITY_PILLARS.map((pillar, idx) => {
                        const Icon = pillar.icon;
                        return (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 25 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: idx * 0.1 }}
                                className="p-6 rounded-3xl bg-gradient-to-b from-zinc-900/80 to-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-all duration-300 flex flex-col justify-between group shadow-xl"
                            >
                                <div>
                                    <div className="flex items-center justify-between mb-6">
                                        <div className={`w-12 h-12 rounded-2xl ${pillar.bg} flex items-center justify-center ${pillar.color} group-hover:scale-110 transition-transform duration-300`}>
                                            <Icon className="w-6 h-6" />
                                        </div>
                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800/80 border border-zinc-700 text-zinc-400">
                                            {pillar.badge}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-bold text-white mb-2">{pillar.title}</h3>
                                    <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
                                        {pillar.description}
                                    </p>
                                </div>

                                <div className="mt-6 pt-4 border-t border-zinc-800/60 flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                                    <CheckCircle className="w-3.5 h-3.5" /> Client-Enforced
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Bottom Audited Callout */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="mt-12 max-w-4xl mx-auto p-6 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-6"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                            <Terminal className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="font-bold text-sm text-white">Open Source & Reproducible</div>
                            <div className="text-xs text-zinc-400">All protocol smart contracts, relayer code, and client bundles are auditable on GitHub.</div>
                        </div>
                    </div>
                    <a 
                        href="https://github.com/Intents-Swaps" 
                        target="_blank" 
                        rel="noreferrer"
                        className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-bold text-white transition-all whitespace-nowrap"
                    >
                        View Source Code
                    </a>
                </motion.div>
            </div>
        </section>
    );
}

export default WalletSecuritySection;
