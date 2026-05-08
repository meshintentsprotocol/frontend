/**
 * RelayerNetworkCard - Card 6 in the bento grid
 * 
 * Features:
 * - Network visualization with floating nodes
 * - Decentralized relayer messaging
 * - Pink gradient mesh background (like Uniswap's Unichain card)
 * - "Start building" CTA
 */

import { cn } from '@/lib/utils';
import { Network, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

interface RelayerNetworkCardProps {
    className?: string;
}

// Floating node positions
const NODES = [
    { x: '70%', y: '20%', size: 'lg', delay: 0 },
    { x: '85%', y: '40%', size: 'md', delay: 0.2 },
    { x: '75%', y: '60%', size: 'sm', delay: 0.4 },
    { x: '90%', y: '75%', size: 'md', delay: 0.6 },
    { x: '65%', y: '85%', size: 'lg', delay: 0.8 },
];

const TOKEN_ICONS = [
    'https://raw.githubusercontent.com/kitelabs-io/mvmt-tokens/main/logos/MOVE.png',
    '/logos/bitcoin-cash-bch-logo.svg',
    '/assets/solanaLogo.png',
    '/logos/usd-coin-usdc-logo.svg',
    '/logos/usd-coin-usdc-logo.svg',
];

const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
};

export function RelayerNetworkCard({ className }: RelayerNetworkCardProps) {
    return (
        <div
            className={cn(
                'bento-card h-full min-h-[320px] flex flex-col overflow-hidden',
                'mesh-gradient-teal grainy',
                className
            )}
        >
            {/* Content Section */}
            <div className="relative z-10 flex-1 flex flex-col max-w-[60%]">
                {/* Card Header */}
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center">
                        <Network className="w-5 h-5 text-teal-500" />
                    </div>
                    <span className="tag-teal">
                        <Sparkles className="w-3 h-3" />
                        Solver Network
                    </span>
                </div>

                {/* Title */}
                <h3 className="text-2xl md:text-3xl font-bold mb-2">
                    <span className="text-gradient-teal">
                        Solver Network
                    </span>
                </h3>

                {/* Description */}
                <p className="text-muted-foreground mb-6 leading-relaxed">
                    Run a Solver bot and earn spread profit by filling Dutch Auctions. Source liquidity from your own wallet, Cauldron DEX, or cross-chain. No bonding. No staking. Permissionless.
                </p>

                {/* CTA Button */}
                <Link to="/solver" className="mt-auto">
                    <Button
                        variant="outline"
                        className="rounded-full gap-2 group border-teal-500/30 hover:border-teal-500/50 hover:bg-teal-500/5"
                    >
                        Become a Solver
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                </Link>
            </div>

            {/* Floating Network Nodes Visualization */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {/* Connection lines (decorative) */}
                <svg className="absolute inset-0 w-full h-full opacity-20">
                    <defs>
                        <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="hsl(175 80% 40%)" stopOpacity="0.5" />
                            <stop offset="100%" stopColor="hsl(175 80% 40%)" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <line x1="70%" y1="20%" x2="85%" y2="40%" stroke="url(#lineGradient)" strokeWidth="1" />
                    <line x1="85%" y1="40%" x2="75%" y2="60%" stroke="url(#lineGradient)" strokeWidth="1" />
                    <line x1="75%" y1="60%" x2="90%" y2="75%" stroke="url(#lineGradient)" strokeWidth="1" />
                    <line x1="90%" y1="75%" x2="65%" y2="85%" stroke="url(#lineGradient)" strokeWidth="1" />
                </svg>

                {/* Floating Token Nodes */}
                {NODES.map((node, index) => (
                    <motion.div
                        key={index}
                        className={cn(
                            'absolute rounded-full overflow-hidden',
                            'bg-zinc-100 dark:bg-zinc-800 border-2 border-background shadow-lg',
                            sizeClasses[node.size as keyof typeof sizeClasses]
                        )}
                        style={{ left: node.x, top: node.y }}
                        initial={{ opacity: 0, scale: 0 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: node.delay, duration: 0.4 }}
                        animate={{
                            y: [0, -8, 0],
                            rotate: [0, 5, -5, 0]
                        }}
                    >
                        <img
                            src={TOKEN_ICONS[index]}
                            alt="Token"
                            className="w-full h-full object-cover"
                        />
                    </motion.div>
                ))}

                {/* Large decorative element */}
                <motion.div
                    className="absolute bottom-[-20%] right-[-10%] w-48 h-48"
                    initial={{ opacity: 0, rotate: -10 }}
                    whileInView={{ opacity: 1, rotate: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 }}
                >
                    <div className="w-full h-full bg-gradient-to-br from-teal-500/30 to-cyan-600/20 rounded-3xl rotate-12 backdrop-blur-sm border border-teal-500/20" />
                </motion.div>
            </div>
        </div>
    );
}

export default RelayerNetworkCard;
