/**
 * TrustlessHTLCCard - Card 4 in the bento grid
 *
 * Features:
 * - Animated HTLC lock/unlock visualization
 * - Two chain pills (BCH ↔ SOL) connected by a glowing hash secret
 * - Triggered on hover (desktop) or scroll in-view (mobile)
 * - Purple/cyan gradient mesh background
 * - "No bridges. No trust. Just math." messaging
 */

import { cn } from '@/lib/utils';
import { ShieldCheck, Lock, Unlock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useBentoAnimationTrigger } from './useBentoAnimationTrigger';

interface TrustlessHTLCCardProps {
    className?: string;
}

type Phase = 'locking' | 'locked' | 'unlocking' | 'settled';

const PHASE_DURATION: Record<Phase, number> = {
    locking: 1200,
    locked: 1000,
    unlocking: 1200,
    settled: 1800,
};

const PHASE_ORDER: Phase[] = ['locking', 'locked', 'unlocking', 'settled'];

export function TrustlessHTLCCard({ className }: TrustlessHTLCCardProps) {
    const { cardRef, isActive, isMobile, onMouseEnter, onMouseLeave } = useBentoAnimationTrigger();
    const [phase, setPhase] = useState<Phase>('locking');
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearPhaseTimer = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    useEffect(() => {
        if (!isActive) {
            clearPhaseTimer();
            setPhase('locking');
            return;
        }

        const advance = (p: Phase) => {
            timerRef.current = setTimeout(() => {
                const idx = PHASE_ORDER.indexOf(p);
                const next = PHASE_ORDER[(idx + 1) % PHASE_ORDER.length];
                setPhase(next);
                advance(next);
            }, PHASE_DURATION[p]);
        };

        advance(phase);

        return () => clearPhaseTimer();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isActive]);

    const isSettled = isActive && phase === 'settled';
    const isLocked = isActive && (phase === 'locked' || phase === 'unlocking');

    return (
        <div
            ref={cardRef}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            className={cn(
                'bento-card h-full min-h-[280px] flex flex-col transition-all duration-300 cursor-pointer',
                'mesh-gradient-cyan grainy',
                isActive && 'ring-1 ring-cyan-500/30',
                className
            )}
        >
            {/* Card Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-xl md:text-2xl font-bold mb-1">Trustless Settlement</h3>
                    <p className="text-muted-foreground text-sm">No bridges. No trust. Just math.</p>
                </div>
                <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-300",
                    isActive ? "bg-cyan-500/20 shadow-sm shadow-cyan-500/20" : "bg-cyan-500/10"
                )}>
                    <ShieldCheck className="w-5 h-5 text-cyan-400" />
                </div>
            </div>

            {/* HTLC Visualization */}
            <div className="flex-1 flex items-center justify-center">
                <div className="flex items-center gap-3 w-full">
                    {/* Chain A — BCH */}
                    <div className="flex flex-col items-center gap-1.5 flex-1">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-800 border border-border/40 flex items-center justify-center">
                            <img
                                src="/logos/bitcoin-cash-bch-logo.svg"
                                alt="BCH"
                                className="w-6 h-6 object-cover"
                            />
                        </div>
                        <span className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase">BCH</span>
                        {/* Lock indicator */}
                        <motion.div
                            animate={{
                                backgroundColor: isSettled
                                    ? 'rgba(52,211,153,0.15)'
                                    : isLocked
                                        ? 'rgba(6,182,212,0.2)'
                                        : 'rgba(6,182,212,0.05)',
                            }}
                            className="w-10 h-10 rounded-xl flex items-center justify-center border border-cyan-500/20"
                        >
                            <AnimatePresence mode="wait">
                                {isSettled ? (
                                    <motion.div key="unlock" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                                        <Unlock className="w-4 h-4 text-emerald-400" />
                                    </motion.div>
                                ) : (
                                    <motion.div key="lock" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                                        <Lock className={cn('w-4 h-4', isLocked ? 'text-cyan-400' : 'text-muted-foreground')} />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    </div>

                    {/* Secret hash connector */}
                    <div className="flex flex-col items-center gap-1 flex-shrink-0">
                        {/* Dashed line left */}
                        <div className="flex items-center gap-1">
                            <motion.div
                                animate={{ opacity: isLocked ? [0.3, 1, 0.3] : 0.2 }}
                                transition={{ duration: 1.2, repeat: Infinity }}
                                className="w-8 h-px bg-gradient-to-r from-transparent to-cyan-500"
                            />
                            {/* Hash pill */}
                            <motion.div
                                animate={{
                                    boxShadow: isLocked
                                        ? ['0 0 0px rgba(6,182,212,0)', '0 0 12px rgba(6,182,212,0.7)', '0 0 0px rgba(6,182,212,0)']
                                        : '0 0 0px rgba(6,182,212,0)',
                                    backgroundColor: isSettled ? 'rgba(52,211,153,0.2)' : 'rgba(6,182,212,0.15)',
                                }}
                                transition={{ duration: 1.2, repeat: Infinity }}
                                className="px-2 py-1 rounded-md border border-cyan-500/30 text-[9px] font-mono text-cyan-300 whitespace-nowrap"
                            >
                                sha256(s)
                            </motion.div>
                            <motion.div
                                animate={{ opacity: isLocked ? [0.3, 1, 0.3] : 0.2 }}
                                transition={{ duration: 1.2, repeat: Infinity }}
                                className="w-8 h-px bg-gradient-to-l from-transparent to-cyan-500"
                            />
                        </div>
                        {/* Phase label */}
                        <span className={cn(
                            'text-[10px] font-semibold tracking-wide uppercase mt-1',
                            isSettled ? 'text-emerald-400' : 'text-cyan-400'
                        )}>
                            {!isActive
                                ? (isMobile ? 'BCH ↔ Solana atomic' : 'Hover to simulate HTLC')
                                : (
                                    phase === 'locking' ? 'Locking…' :
                                        phase === 'locked' ? 'Locked' :
                                            phase === 'unlocking' ? 'Revealing…' :
                                                '✓ Settled'
                                )}
                        </span>
                    </div>

                    {/* Chain B — SOL */}
                    <div className="flex flex-col items-center gap-1.5 flex-1">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-800 border border-border/40 flex items-center justify-center">
                            <img
                                src="/assets/solanaLogo.png"
                                alt="SOL"
                                className="w-6 h-6 object-cover"
                            />
                        </div>
                        <span className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase">Solana</span>
                        <motion.div
                            animate={{
                                backgroundColor: isSettled
                                    ? 'rgba(52,211,153,0.15)'
                                    : isLocked
                                        ? 'rgba(6,182,212,0.2)'
                                        : 'rgba(6,182,212,0.05)',
                            }}
                            className="w-10 h-10 rounded-xl flex items-center justify-center border border-cyan-500/20"
                        >
                            <AnimatePresence mode="wait">
                                {isSettled ? (
                                    <motion.div key="unlock" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                                        <Unlock className="w-4 h-4 text-emerald-400" />
                                    </motion.div>
                                ) : (
                                    <motion.div key="lock" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                                        <Lock className={cn('w-4 h-4', isLocked ? 'text-cyan-400' : 'text-muted-foreground')} />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    </div>
                </div>
            </div>

            {/* Bottom Stats Row */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/30">
                <div className="text-center">
                    <div className="text-2xl font-bold text-cyan-400">Atomic</div>
                    <div className="text-xs text-muted-foreground">All-or-nothing</div>
                </div>
                <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">No bridge</div>
                    <div className="text-xs text-muted-foreground">No custodian</div>
                </div>
            </div>
        </div>
    );
}

export default TrustlessHTLCCard;
