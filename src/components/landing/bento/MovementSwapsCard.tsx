// Live bento card
/**
 * MovementSwapsCard - Card 2 in the bento grid
 * 
 * Features:
 * - Movement Swaps header with icon
 * - "Construct. Express. Execute." tagline
 * - Dutch Auctions description
 * - Animated swap visualization showing token routing
 * - Triggered on hover (desktop) or scroll in-view (mobile)
 */

import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, Sparkles, Zap, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TokenDisplay } from '@/components/common/TokenDisplay';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useBentoAnimationTrigger } from './useBentoAnimationTrigger';

// Tokens for the swap animation — CashToken + Cross-Chain swaps
const SWAP_PAIRS = [
    // CashToken: BCH → PUSD (primary showcase)
    {
        from: { icon: 'https://bitcoincash.org/img/green/bitcoin-cash-circle.svg', ticker: 'BCH' },
        to: { icon: '/logos/paryonlog.svg', ticker: 'PUSD' },
        type: 'CashToken',
    },
    // CashToken: PUSD → BCH (reverse)
    {
        from: { icon: '/logos/paryonlog.svg', ticker: 'PUSD' },
        to: { icon: 'https://bitcoincash.org/img/green/bitcoin-cash-circle.svg', ticker: 'BCH' },
        type: 'CashToken',
    },
    // Cross-chain: SOL → BCH
    {
        from: { icon: '/assets/solanaLogo.png', ticker: 'SOL' },
        to: { icon: 'https://bitcoincash.org/img/green/bitcoin-cash-circle.svg', ticker: 'BCH' },
        type: 'Cross-Chain',
    },
    // Cross-chain: USDC → BCH
    {
        from: { icon: '/logos/usd-coin-usdc-logo.svg', ticker: 'USDC' },
        to: { icon: 'https://bitcoincash.org/img/green/bitcoin-cash-circle.svg', ticker: 'BCH' },
        type: 'Cross-Chain',
    },
    // CashToken: BCH → MUSD (same-chain)
    {
        from: { icon: 'https://bitcoincash.org/img/green/bitcoin-cash-circle.svg', ticker: 'BCH' },
        to: { icon: 'https://electroncash.org/images/logosForEcosystem/square/moria.png', ticker: 'MUSD' },
        type: 'CashToken',
    },
    // Cross-chain: SOL → PUSD
    {
        from: { icon: '/assets/solanaLogo.png', ticker: 'SOL' },
        to: { icon: '/logos/paryonlog.svg', ticker: 'PUSD' },
        type: 'Cross-Chain',
    },
];

// Feature badges
const FEATURES = [
    { icon: Shield, label: 'MEV protection', color: 'text-cyan-500' },
    { icon: Sparkles, label: 'Best swap', color: 'text-primary' },
    { icon: Zap, label: 'Free', color: 'text-green-500' },
];

interface MovementSwapsCardProps {
    className?: string;
}

export function MovementSwapsCard({ className }: MovementSwapsCardProps) {
    const { cardRef, isActive, isMobile, onMouseEnter, onMouseLeave } = useBentoAnimationTrigger();
    const [currentPair, setCurrentPair] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Rotate swap pairs when active
    useEffect(() => {
        if (!isActive) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            setCurrentPair(0);
            return;
        }

        intervalRef.current = setInterval(() => {
            setCurrentPair((prev) => (prev + 1) % SWAP_PAIRS.length);
        }, 1900);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isActive]);

    const pair = SWAP_PAIRS[currentPair];

    return (
        <div
            ref={cardRef}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            className={cn(
                'bento-card h-full min-h-[420px] flex flex-col transition-all duration-300 cursor-pointer',
                'mesh-gradient-teal grainy',
                isActive && 'ring-1 ring-teal-500/30',
                className
            )}
        >
            {/* Card Header */}
            <div className="flex items-center gap-2 mb-4">
                <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-300",
                    isActive ? "bg-teal-500/20 shadow-sm shadow-teal-500/20" : "bg-teal-500/10"
                )}>
                    <Sparkles className="w-5 h-5 text-teal-500" />
                </div>
                <span className="tag-teal">
                    <Zap className="w-3 h-3" />
                    Intents Swap
                </span>
            </div>

            {/* Tagline - Gradient text like Uniswap */}
            <h3 className="text-2xl md:text-3xl font-bold mb-2">
                <span className="text-gradient-teal">
                    Smarter swaps. Aggregated liquidity.
                </span>
            </h3>

            {/* Description */}
            <p className="text-muted-foreground mb-4 leading-relaxed">
                Stop fighting for gas. Express your intent using{' '}
                <span className="text-foreground font-medium">Dutch Auctions</span> and let
                professional Resolvers execute your trades optimally, every time.
            </p>

            {/* CTA and Feature Badges */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
                <Link to="/trade">
                    <Button variant="outline" className="rounded-full gap-2 group border-teal-500/30 hover:border-teal-500/50 hover:bg-teal-500/5">
                        Try Intent Swap
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                </Link>

                {FEATURES.map((feature) => (
                    <div
                        key={feature.label}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800/50 text-sm"
                    >
                        <feature.icon className={cn('w-3.5 h-3.5', feature.color)} />
                        <span className="text-foreground/80">{feature.label}</span>
                    </div>
                ))}
            </div>

            {/* Animated Swap Visualization */}
            <div className="mt-auto">
                <div className="bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl p-6 relative overflow-hidden">
                    {/* Animated routing line */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <motion.div
                            className="h-0.5 bg-gradient-to-r from-teal-500/0 via-teal-500 to-teal-500/0"
                            initial={{ width: 0, opacity: 0 }}
                            animate={isActive ? { width: '60%', opacity: 1 } : { width: '20%', opacity: 0.3 }}
                            transition={isActive ? { duration: 0.8, repeat: Infinity, repeatType: 'reverse' } : { duration: 0.3 }}
                        />
                    </div>

                    <div className="flex items-center justify-between relative z-10">
                        {/* From Token */}
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={`from-${currentPair}`}
                                initial={{ opacity: 0, x: -16 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -16 }}
                                transition={{ duration: 0.25 }}
                                className="flex flex-col items-center gap-2"
                            >
                                <TokenDisplay
                                    tokenIcon={pair.from.icon}
                                    size="xl"
                                    compact
                                    showChainBadge={false}
                                />
                                <span className="text-sm font-medium text-muted-foreground">
                                    {pair.from.ticker}
                                </span>
                            </motion.div>
                        </AnimatePresence>

                        {/* Arrow with pulse + swap type label */}
                        <div className="flex flex-col items-center gap-1">
                            <AnimatePresence mode="wait">
                                <motion.span
                                    key={`type-${currentPair}`}
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 4 }}
                                    transition={{ duration: 0.2 }}
                                    className={cn(
                                        "text-[10px] font-semibold px-2 py-0.5 rounded-full mb-1",
                                        pair.type === 'CashToken'
                                            ? "bg-emerald-500/10 text-emerald-500"
                                            : "bg-sky-500/10 text-sky-500"
                                    )}
                                >
                                    {pair.type}
                                </motion.span>
                            </AnimatePresence>
                            <motion.div
                                animate={isActive ? { scale: [1, 1.18, 1] } : { scale: 1 }}
                                transition={isActive ? { duration: 1, repeat: Infinity } : { duration: 0.2 }}
                                className="w-10 h-10 rounded-full bg-teal-500/10 flex items-center justify-center"
                            >
                                <ArrowRight className="w-5 h-5 text-teal-500" />
                            </motion.div>
                            <span className="text-xs text-teal-500 font-medium">
                                {isActive ? '~2s' : (isMobile ? 'Live fill' : 'Hover to view')}
                            </span>
                        </div>

                        {/* To Token */}
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={`to-${currentPair}`}
                                initial={{ opacity: 0, x: 16 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 16 }}
                                transition={{ duration: 0.25 }}
                                className="flex flex-col items-center gap-2"
                            >
                                <TokenDisplay
                                    tokenIcon={pair.to.icon}
                                    size="xl"
                                    compact
                                    showChainBadge={false}
                                />
                                <span className="text-sm font-medium text-muted-foreground">
                                    {pair.to.ticker}
                                </span>
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default MovementSwapsCard;
