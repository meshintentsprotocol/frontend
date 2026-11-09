/**
 * TradingApiCard - Card 5 in the bento grid
 * 
 * Features:
 * - Developer-focused messaging
 * - Code snippet or API visualization
 * - Triggered on hover (desktop) or scroll in-view (mobile)
 * - Orange/green gradient mesh background
 * - "Integrate the SDK" CTA linking to /docs
 */

import { cn } from '@/lib/utils';
import { Code2, ArrowRight, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useBentoAnimationTrigger } from './useBentoAnimationTrigger';

interface TradingApiCardProps {
    className?: string;
}

export function TradingApiCard({ className }: TradingApiCardProps) {
    const { cardRef, isActive, onMouseEnter, onMouseLeave } = useBentoAnimationTrigger();

    return (
        <div
            ref={cardRef}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            className={cn(
                'bento-card h-full min-h-[320px] flex flex-col transition-all duration-300 cursor-pointer',
                'mesh-gradient-green grainy',
                isActive && 'ring-1 ring-emerald-500/30',
                className
            )}
        >
            {/* Card Header */}
            <div className="flex items-center gap-2 mb-4">
                <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-300",
                    isActive ? "bg-emerald-500/20 shadow-sm shadow-emerald-500/20" : "bg-emerald-500/10"
                )}>
                    <Code2 className="w-5 h-5 text-emerald-500" />
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500">
                    <Terminal className="w-3 h-3" />
                    Trading API
                </span>
            </div>

            {/* Title */}
            <h3 className="text-2xl md:text-3xl font-bold mb-2">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-primary">
                    Build with the SDK
                </span>
            </h3>

            {/* Description */}
            <p className="text-muted-foreground mb-4 leading-relaxed">
                Integrate intent-based swaps into your wallet or DEX with 3 lines of code. Covenant-enforced fees guarantee you revenue on every fill.
            </p>

            {/* CTA Button */}
            <Link to="/docs" className="inline-block w-fit">
                <Button
                    variant="outline"
                    className="rounded-full gap-2 group border-emerald-500/30 hover:border-emerald-500/50 hover:bg-emerald-500/5"
                >
                    Integrate the SDK
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
            </Link>

            {/* Code Snippet Visualization */}
            <div className="mt-auto pt-6">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className={cn(
                        "bg-zinc-900 dark:bg-zinc-950 rounded-xl p-4 font-mono text-xs overflow-hidden relative border transition-all duration-300",
                        isActive ? "border-emerald-500/40 shadow-md shadow-emerald-500/10" : "border-white/5"
                    )}
                >
                    {/* Shimmer effect */}
                    <div className={cn("absolute inset-0 shimmer transition-opacity duration-300", isActive ? "opacity-70" : "opacity-20")} />

                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-3 h-3 rounded-full bg-red-500/80" />
                            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                            <div className="w-3 h-3 rounded-full bg-green-500/80" />
                            <span className="ml-2 text-zinc-500">intent-builder.ts</span>
                        </div>

                        <pre className="text-zinc-400 overflow-x-auto">
                            <code>
                                <span className="text-cyan-400">import</span>{' '}
                                <span className="text-zinc-200">{'{ IntentBuilder }'}</span>{' '}
                                <span className="text-cyan-400">from</span>{' '}
                                <span className="text-green-400">'@bch-intents/sdk-cashtokens'</span>;{'\n\n'}
                                <span className="text-cyan-400">const</span>{' '}
                                <span className="text-zinc-200">params</span>{' '}
                                <span className="text-zinc-500">=</span>{' '}
                                <span className="text-zinc-200">IntentBuilder</span>
                                <span className="text-zinc-500">.</span>
                                <span className="text-yellow-400">dutchAuction</span>
                                <span className="text-zinc-500">()</span>{'\n'}
                                {'    '}
                                <span className="text-zinc-500">.</span>
                                <span className="text-yellow-400">sellToken</span>
                                <span className="text-zinc-500">(</span>
                                <span className="text-green-400">'BCH'</span>
                                <span className="text-zinc-500">)</span>{'\n'}
                                {'    '}
                                <span className="text-zinc-500">.</span>
                                <span className="text-yellow-400">buyToken</span>
                                <span className="text-zinc-500">(</span>
                                <span className="text-zinc-200">tokenCategory</span>
                                <span className="text-zinc-500">)</span>{'\n'}
                                {'    '}
                                <span className="text-zinc-500">.</span>
                                <span className="text-yellow-400">sellAmount</span>
                                <span className="text-zinc-500">(</span>
                                <span className="text-emerald-400">10000n</span>
                                <span className="text-zinc-500">)</span>{'\n'}
                                {'    '}
                                <span className="text-zinc-500">.</span>
                                <span className="text-yellow-400">startBuyAmount</span>
                                <span className="text-zinc-500">(</span>
                                <span className="text-emerald-400">500n</span>
                                <span className="text-zinc-500">)</span>{'\n'}
                                {'    '}
                                <span className="text-zinc-500">.</span>
                                <span className="text-yellow-400">endBuyAmount</span>
                                <span className="text-zinc-500">(</span>
                                <span className="text-emerald-400">400n</span>
                                <span className="text-zinc-500">)</span>{'\n'}
                                {'    '}
                                <span className="text-zinc-500">.</span>
                                <span className="text-yellow-400">withFrontendFee</span>
                                <span className="text-zinc-500">(</span>
                                <span className="text-emerald-400">0.005</span>
                                <span className="text-zinc-500">,</span>{' '}
                                <span className="text-zinc-200">feeAddress</span>
                                <span className="text-zinc-500">)</span>{'\n'}
                                {'    '}
                                <span className="text-zinc-500">.</span>
                                <span className="text-yellow-400">build</span>
                                <span className="text-zinc-500">()</span>;
                            </code>
                        </pre>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}

export default TradingApiCard;
