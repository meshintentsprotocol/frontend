/**
 * FAQ - Premium FAQ Component
 * 
 * Inspired by 1inch's clean, minimalist FAQ design:
 * - Smooth open/close animations with Framer Motion
 * - Plus/minus toggle icons
 * - Show more/less when more than 5 FAQs
 * - Clean typography with proper light/dark mode support
 * - Premium feel with subtle hover states
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, ChevronDown, ChevronUp } from 'lucide-react';

// FAQ data - easily extensible
const FAQ_DATA = [
    {
        question: "What is BCH Intents?",
        answer: "BCH Intents is a cross-chain swap protocol that connects Bitcoin Cash (BCH) with Solana, EVM chains, and Movement — without bridges or wrapped tokens. Instead of routing through a DEX, you express what you want to trade and professional Solvers compete to fill your order at the best price, using just-in-time liquidity from their own wallets."
    },
    {
        question: "Do I need gas to place or cancel a swap?",
        answer: "No — placing an intent is gasless. You sign a message with your wallet, which is free. The Solver who fills your order pays the on-chain gas on your behalf. The only exception: if you have a BCH-side limit order already broadcast on-chain as a UTXO, cancelling it requires a small on-chain spend back to your own wallet."
    },
    {
        question: "How does the Dutch Auction guarantee me a fair price?",
        answer: "When you submit a swap, a Dutch Auction starts: the price begins slightly above market and decays linearly over time. Solvers race to fill your order — if they wait too long a competitor takes it, so they're incentivised to fill as quickly as possible. That competition means you receive at or near the real market price, with no MEV and essentially zero slippage."
    },
    {
        question: "Is this a bridge? Are my tokens wrapped?",
        answer: "No — BCH Intents does not bridge anything. Your BCH is never held by a third party. Instead, both sides of a cross-chain swap are locked simultaneously using Hash Time-Locked Contracts (HTLCs). The trade either settles atomically on both chains, or the time-lock expires and both parties are refunded. No custodians, no wrapped representations, no single point of failure."
    },
    {
        question: "Which chains are currently supported?",
        answer: "The Intents SDK supports 8+ chains including Bitcoin Cash (BCH), Solana, Ethereum, Monero, and Movement (Move VM). The protocol is blockchain-agnostic, enabling integration with any chain that supports basic hash time-locks or signature verification."
    },
    {
        question: "How do cross-chain swaps actually work?",
        answer: "When you swap BCH → SOL: (1) your BCH is locked in a CashScript HTLC contract using a secret hash. (2) A Solver locks the equivalent SOL for you on Solana using the same hash. (3) You reveal your secret to claim the SOL. (4) The Solver uses that revealed secret to claim the BCH. Every step is verified on-chain — neither side can cheat."
    },
    {
        question: "What is a Solver?",
        answer: "Solvers are professional market makers who run software to watch the decentralized Nostr intent pool and fill swaps. They source just-in-time liquidity from their own wallets or external DEXs. They take on price risk in exchange for the spread, meaning you get instant execution without waiting for a counterparty and without fragmented liquidity pools."
    },
    {
        question: "What happens if a swap doesn't complete?",
        answer: "Nothing is lost. HTLCs include a time-lock: if the Solver fails to complete the swap within the agreed window, both sides automatically expire and you can reclaim your funds. The protocol is atomic — it either fully settles across all chains involved, or fully refunds. There is no partial state where one side is stuck."
    },
    {
        question: "How do I become a Solver?",
        answer: "The Solver network is completely permissionless—no staking or bonding required. If you are a market maker, trading firm, or developer interested in running a Solver node to earn covenant-enforced fees by filling intents, you can integrate the SDK today. Check our GitHub and Developer Documentation to start building."
    }
];

const INITIAL_DISPLAY_COUNT = 5;

interface FAQItemProps {
    question: string;
    answer: string;
    isOpen: boolean;
    onToggle: () => void;
    index: number;
}

function FAQItem({ question, answer, isOpen, onToggle, index }: FAQItemProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={cn(
                'border-b border-border/50 last:border-b-0',
                'transition-colors duration-200'
            )}
        >
            <button
                onClick={onToggle}
                className={cn(
                    'w-full flex items-start gap-4 py-6 text-left',
                    'group transition-colors duration-200',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg'
                )}
                aria-expanded={isOpen}
            >
                {/* Toggle Icon */}
                <span
                    className={cn(
                        'flex-shrink-0 w-6 h-6 flex items-center justify-center',
                        'text-muted-foreground group-hover:text-foreground transition-colors',
                        isOpen && 'text-primary'
                    )}
                >
                    {isOpen ? (
                        <Minus className="w-4 h-4" strokeWidth={2.5} />
                    ) : (
                        <Plus className="w-4 h-4" strokeWidth={2.5} />
                    )}
                </span>

                {/* Question Text */}
                <span
                    className={cn(
                        'flex-1 text-lg font-medium',
                        'text-foreground group-hover:text-foreground transition-colors',
                        isOpen && 'text-foreground'
                    )}
                >
                    {question}
                </span>
            </button>

            {/* Answer with smooth animation */}
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
                        className="overflow-hidden"
                    >
                        <div className="pb-6 pl-10 pr-4">
                            <p className="text-muted-foreground leading-relaxed">
                                {answer}
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

export function FAQ() {
    const [openIndex, setOpenIndex] = useState<number | null>(0); // First item open by default
    const [showAll, setShowAll] = useState(false);

    const displayedFAQs = showAll ? FAQ_DATA : FAQ_DATA.slice(0, INITIAL_DISPLAY_COUNT);
    const hasMoreFAQs = FAQ_DATA.length > INITIAL_DISPLAY_COUNT;

    const handleToggle = (index: number) => {
        setOpenIndex(openIndex === index ? null : index);
    };

    return (
        <section className="py-24 md:py-32 relative">
            {/* Subtle background */}
            <div className="absolute inset-0 bg-zinc-50/50 dark:bg-zinc-950/50" />

            <div className="container mx-auto px-4 relative z-10">
                <div className="max-w-4xl mx-auto">
                    {/* Two-column layout like 1inch */}
                    <div className="grid md:grid-cols-[280px_1fr] gap-12 md:gap-16">
                        {/* Left Column - Title */}
                        <div className="md:sticky md:top-32 md:self-start">
                            <motion.h2
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                className="text-4xl md:text-5xl font-bold tracking-tight"
                            >
                                Questions?{' '}
                                <span className="text-muted-foreground">Answers.</span>
                            </motion.h2>
                        </div>

                        {/* Right Column - FAQ Items */}
                        <div>
                            <div className="divide-y-0">
                                {displayedFAQs.map((faq, index) => (
                                    <FAQItem
                                        key={index}
                                        question={faq.question}
                                        answer={faq.answer}
                                        isOpen={openIndex === index}
                                        onToggle={() => handleToggle(index)}
                                        index={index}
                                    />
                                ))}
                            </div>

                            {/* Show More / Show Less Button */}
                            {hasMoreFAQs && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.3 }}
                                    className="mt-6"
                                >
                                    <button
                                        onClick={() => setShowAll(!showAll)}
                                        className={cn(
                                            'inline-flex items-center gap-2',
                                            'text-primary hover:text-primary/80 transition-colors',
                                            'font-medium focus:outline-none focus-visible:underline'
                                        )}
                                    >
                                        {showAll ? (
                                            <>
                                                Show less
                                                <ChevronUp className="w-4 h-4" />
                                            </>
                                        ) : (
                                            <>
                                                Show more
                                                <ChevronDown className="w-4 h-4" />
                                            </>
                                        )}
                                    </button>
                                </motion.div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

export default FAQ;
