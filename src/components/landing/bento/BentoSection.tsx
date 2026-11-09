/**
 * BentoSection - Main wrapper for the bento-box/masonry grid layout
 * 
 * This component establishes the Uniswap-inspired bento grid section.
 * Uses CSS Grid with responsive breakpoints for masonry-like layouts.
 */

import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { CrossChainSwapsCard } from './CrossChainSwapsCard';
import { MovementSwapsCard } from './MovementSwapsCard';
import { DutchAuctionCard } from './DutchAuctionCard';
import { TrustlessHTLCCard } from './TrustlessHTLCCard';
import { TradingApiCard } from './TradingApiCard';
import { RelayerNetworkCard } from './RelayerNetworkCard';

interface BentoSectionProps {
    className?: string;
}

export function BentoSection({ className }: BentoSectionProps) {
    return (
        <section
            className={cn(
                'relative py-20 md:py-32 overflow-hidden',
                className
            )}
        >
            {/* Section Background with Grainy Texture */}
            <div className="absolute inset-0 bg-zinc-50 dark:bg-zinc-950 grainy" />

            {/* Ambient Gradient Orbs */}
            <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-[120px] animate-pulse-glow" />
            <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-teal-500/5 dark:bg-teal-500/10 rounded-full blur-[100px]" />

            <div className="container mx-auto px-4 relative z-10">
                {/* Section Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                        The{' '}
                        <span className="text-gradient-primary">Intent-Based</span>{' '}
                        Architecture
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Stateless covenants. Solver competition. Atomic settlement.
                    </p>
                </motion.div>

                {/* Bento Grid Layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                    {/* Row 1: Two cards spanning 2 cols each */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        className="lg:col-span-2"
                    >
                        <CrossChainSwapsCard />
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 }}
                        className="lg:col-span-2"
                    >
                        <MovementSwapsCard />
                    </motion.div>

                    {/* Row 2: Dutch Auction + Trustless HTLC */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.3 }}
                        className="lg:col-span-2"
                    >
                        <DutchAuctionCard />
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.4 }}
                        className="lg:col-span-2"
                    >
                        <TrustlessHTLCCard />
                    </motion.div>

                    {/* Row 3: Two medium cards */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.5 }}
                        className="lg:col-span-2"
                    >
                        <TradingApiCard />
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.6 }}
                        className="lg:col-span-2"
                    >
                        <RelayerNetworkCard />
                    </motion.div>
                </div>
            </div>
        </section>
    );
}

export default BentoSection;
