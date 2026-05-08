/**
 * DutchAuctionCard - Card 3 in the bento grid
 *
 * Features:
 * - Animated price decay curve (Dutch auction visualization)
 * - Shows price dropping until a solver fills the order
 * - Amber/orange gradient mesh background
 * - "Fair Price, Every Time" messaging
 */

import { cn } from '@/lib/utils';
import { TrendingDown, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

interface DutchAuctionCardProps {
    className?: string;
}

// Simulate price ticking down from a high to market price
const TOTAL_STEPS = 30;
const START_PRICE = 1.18;
const FILL_PRICE = 1.042;

export function DutchAuctionCard({ className }: DutchAuctionCardProps) {
    const [step, setStep] = useState(0);
    const [filled, setFilled] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const startAuction = () => {
        setStep(0);
        setFilled(false);
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => {
            setStep(prev => {
                if (prev >= TOTAL_STEPS - 1) {
                    clearInterval(intervalRef.current!);
                    setFilled(true);
                    // restart after a pause
                    setTimeout(startAuction, 2000);
                    return prev;
                }
                return prev + 1;
            });
        }, 80);
    };

    useEffect(() => {
        startAuction();
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const progress = step / (TOTAL_STEPS - 1); // 0 → 1
    const currentPrice = START_PRICE - (START_PRICE - FILL_PRICE) * progress;
    const barWidth = `${100 - progress * 100}%`; // bar shrinks as price drops

    return (
        <div
            className={cn(
                'bento-card h-full min-h-[280px] flex flex-col',
                'mesh-gradient-amber grainy',
                className
            )}
        >
            {/* Card Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-xl md:text-2xl font-bold mb-1">Dutch Auction</h3>
                    <p className="text-muted-foreground text-sm">Solvers compete. You win.</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <TrendingDown className="w-5 h-5 text-amber-500" />
                </div>
            </div>

            {/* Auction Visualization */}
            <div className="flex-1 flex flex-col justify-center gap-3">
                {/* Price display */}
                <div className="flex items-end justify-between px-1">
                    <span className="text-xs text-muted-foreground">Start</span>
                    <motion.span
                        key={step}
                        className={cn(
                            'text-2xl font-bold tabular-nums transition-colors duration-200',
                            filled ? 'text-emerald-400' : 'text-amber-400'
                        )}
                    >
                        ${currentPrice.toFixed(3)}
                    </motion.span>
                    <span className="text-xs text-muted-foreground">Market</span>
                </div>

                {/* Decaying price bar */}
                <div className="relative h-3 w-full bg-amber-500/10 rounded-full overflow-hidden">
                    <motion.div
                        className={cn(
                            'absolute left-0 top-0 h-full rounded-full transition-all',
                            filled ? 'bg-emerald-500' : 'bg-amber-500'
                        )}
                        style={{ width: barWidth }}
                    />
                    {/* Solver fill indicator */}
                    {filled && (
                        <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="absolute right-0 top-1/2 -translate-y-1/2 -translate-x-1 w-4 h-4 bg-emerald-400 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/40"
                        >
                            <Zap className="w-2.5 h-2.5 text-black" />
                        </motion.div>
                    )}
                </div>

                {/* Status label */}
                <div className="text-center text-xs text-muted-foreground h-4">
                    {filled ? (
                        <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-emerald-400 font-semibold"
                        >
                            ⚡ Solver filled at ${FILL_PRICE} — best market price
                        </motion.span>
                    ) : (
                        <span>Solvers competing… price decaying</span>
                    )}
                </div>
            </div>

            {/* Bottom Stats Row */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/30">
                <div className="text-center">
                    <div className="text-2xl font-bold text-amber-400">~0%</div>
                    <div className="text-xs text-muted-foreground">Slippage</div>
                </div>
                <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">No MEV</div>
                    <div className="text-xs text-muted-foreground">Protected</div>
                </div>
            </div>
        </div>
    );
}

export default DutchAuctionCard;
