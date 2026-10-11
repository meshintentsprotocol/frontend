import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, HelpCircle, Sparkles } from 'lucide-react';

interface FAQItem {
    question: string;
    answer: string;
}

const FAQS: FAQItem[] = [
    {
        question: 'What is Cham Wallet and how does it differ from traditional crypto wallets?',
        answer: 'Cham Wallet is a multi-chain, self-custodial mobile app and browser extension built for declarative onchain finance. Instead of manually bridging tokens, calculating slippage, and signing multiple approval transactions across disparate networks, you simply express what you want (e.g. "Swap 5 BCH for SOL at current market price"). Decentralized solvers compete to fulfill your order atomically with zero lockup bridges.'
    },
    {
        question: 'How do cross-chain swaps work without wrapped token bridges?',
        answer: 'Cham Wallet uses Hash Time-Locked Contracts (HTLCs) and CashScript smart covenants. When you submit an intent, solvers lock funds on the destination chain (e.g., Solana SPL) and you lock on the origin chain (e.g., Bitcoin Cash). Once cryptographic pre-images are revealed, settlement executes simultaneously. If a counterparty fails to fulfill, your funds automatically refund upon timeout with zero risk of bridge exploit.'
    },
    {
        question: 'Which blockchains and token standards are supported?',
        answer: 'Cham Wallet supports Bitcoin Cash (Native UTXO & CashTokens), Solana (SPL tokens), Ethereum (ERC-20), Movement Network (MoveVM), BNB Chain (BEP-20), Arbitrum One, Base, and Monero (XMR via atomic scriptless scripts). New chains are continually added via modular relayer integrations.'
    },
    {
        question: 'Does Cham Wallet have full support for Bitcoin Cash CashTokens?',
        answer: 'Yes! Cham Wallet is one of the few mobile & extension wallets with native, first-class CashTokens support. You can store, send, receive, and mint both Fungible Tokens (FT) and Non-Fungible Tokens (NFT) on Bitcoin Cash, complete with BCMR onchain metadata resolution and UTXO commitment inspection.'
    },
    {
        question: 'How can I earn yield using BCH Mesh inside the wallet?',
        answer: 'Cham Wallet integrates directly with the BCH Mesh peer-to-peer liquidity protocol. You can deposit idle BCH, CashTokens, or stablecoins into decentralized mesh pools with a single tap. Liquidity providers earn real transaction swap fees paid by active solvers and arbitrageurs.'
    },
    {
        question: 'Is Cham Wallet non-custodial? Who owns the private keys?',
        answer: 'Cham Wallet is 100% self-custodial. Your private keys and 12/24-word recovery seed are encrypted locally on your device using AES-256-GCM and stored inside your hardware Secure Enclave or Keychain. No server, developer, or relayer ever has access to your keys.'
    },
    {
        question: 'How do I install Cham Wallet on my devices?',
        answer: 'Cham Wallet is available as a Chrome/Brave/Firefox browser extension, an iOS app (via Apple App Store & TestFlight), and an Android app (via Google Play Store & Direct APK). Click any "Download" button on this page to install or join the early beta program.'
    }
];

export function WalletFAQ() {
    const [openIdx, setOpenIdx] = useState<number | null>(0);

    const toggle = (idx: number) => {
        setOpenIdx(openIdx === idx ? null : idx);
    };

    return (
        <section className="relative py-28 bg-[#050505] text-white overflow-hidden border-t border-zinc-900">
            <div className="container mx-auto px-4 relative z-10 max-w-4xl">
                {/* Header */}
                <div className="text-center mb-16 space-y-4">
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800/80 border border-zinc-700/60 text-zinc-300 text-xs font-semibold uppercase tracking-wider"
                    >
                        <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
                        Got Questions?
                    </motion.div>
                    <motion.h2 
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight"
                    >
                        Frequently Asked Questions
                    </motion.h2>
                    <motion.p 
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="text-zinc-400 text-base sm:text-lg max-w-xl mx-auto"
                    >
                        Everything you need to know about Cham Wallet, security architecture, and cross-chain mechanics.
                    </motion.p>
                </div>

                {/* FAQ Accordion */}
                <div className="space-y-4">
                    {FAQS.map((faq, idx) => {
                        const isOpen = openIdx === idx;
                        return (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 15 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.4, delay: idx * 0.05 }}
                                className="rounded-2xl bg-zinc-900/60 border border-zinc-800 overflow-hidden transition-all duration-200"
                            >
                                <button
                                    onClick={() => toggle(idx)}
                                    className="w-full p-6 text-left flex items-center justify-between gap-4 hover:bg-zinc-800/40 transition-colors"
                                >
                                    <span className="font-bold text-base sm:text-lg text-white">
                                        {faq.question}
                                    </span>
                                    <ChevronDown 
                                        className={`w-5 h-5 text-zinc-400 transition-transform duration-300 shrink-0 ${
                                            isOpen ? 'rotate-180 text-emerald-400' : ''
                                        }`} 
                                    />
                                </button>

                                <AnimatePresence initial={false}>
                                    {isOpen && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="px-6 pb-6 pt-2 text-zinc-400 text-sm sm:text-base leading-relaxed border-t border-zinc-800/60">
                                                {faq.answer}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

export default WalletFAQ;
