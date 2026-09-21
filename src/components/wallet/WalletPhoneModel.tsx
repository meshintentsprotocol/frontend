/**
 * WalletPhoneModel - Reusable interactive mobile device frame
 *
 * Premium iPhone-style mockup with:
 * - Dynamic island camera notch
 * - Titanium-style border with subtle gradient
 * - Glass glare reflection overlay
 * - iOS-style home bar indicator
 * - Configurable sizes (sm, md, lg, xl)
 * - Smooth Framer Motion hover scale
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

type PhoneSize = 'sm' | 'md' | 'lg' | 'xl';

interface WalletPhoneModelProps {
    children: React.ReactNode;
    size?: PhoneSize;
    className?: string;
    /** Extra tilt/rotation via CSS transform */
    style?: React.CSSProperties;
    /** Disable hover scale animation */
    disableHover?: boolean;
    /** Show the glass glare overlay */
    showGlare?: boolean;
}

const SIZE_MAP: Record<PhoneSize, { outer: string; notch: string; bar: string }> = {
    sm: {
        outer: 'w-[180px] h-[380px] rounded-[1.6rem] border-[6px]',
        notch: 'w-16 h-[18px] rounded-b-xl top-0',
        bar: 'w-20 h-[3px] rounded-full',
    },
    md: {
        outer: 'w-[240px] h-[500px] rounded-[2rem] border-[8px]',
        notch: 'w-20 h-[22px] rounded-b-xl top-0',
        bar: 'w-24 h-[4px] rounded-full',
    },
    lg: {
        outer: 'w-[300px] h-[620px] rounded-[2.5rem] border-[10px]',
        notch: 'w-24 h-[26px] rounded-b-2xl top-0',
        bar: 'w-28 h-[4px] rounded-full',
    },
    xl: {
        outer: 'w-[340px] h-[700px] rounded-[3rem] border-[12px]',
        notch: 'w-28 h-[28px] rounded-b-2xl top-0',
        bar: 'w-32 h-[5px] rounded-full',
    },
};

export function WalletPhoneModel({
    children,
    size = 'lg',
    className,
    style,
    disableHover = false,
    showGlare = true,
}: WalletPhoneModelProps) {
    const s = SIZE_MAP[size];

    return (
        <motion.div
            whileHover={disableHover ? undefined : { scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className={cn(
                s.outer,
                'relative overflow-hidden flex flex-col shrink-0',
                'bg-gradient-to-b from-zinc-800 to-zinc-900 border-zinc-700/60',
                'shadow-[0_20px_80px_rgba(0,0,0,0.6),0_0_40px_rgba(16,185,129,0.08)]',
                className
            )}
            style={style}
        >
            {/* Dynamic-island-style notch */}
            <div
                className={cn(
                    s.notch,
                    'absolute inset-x-0 mx-auto bg-zinc-900 z-30',
                    'flex items-center justify-center'
                )}
            >
                {/* Camera dot */}
                <div className="w-2 h-2 rounded-full bg-zinc-700 border border-zinc-600/50" />
            </div>

            {/* Screen area */}
            <div className="flex-1 flex flex-col bg-[#050505] relative overflow-hidden">
                {children}
            </div>

            {/* Home bar indicator */}
            <div className="absolute bottom-2 inset-x-0 flex items-center justify-center z-30 pointer-events-none">
                <div className={cn(s.bar, 'bg-white/30')} />
            </div>

            {/* Glass glare reflection */}
            {showGlare && (
                <div
                    className="absolute inset-0 pointer-events-none z-20"
                    style={{
                        background:
                            'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.03) 100%)',
                    }}
                />
            )}
        </motion.div>
    );
}

export default WalletPhoneModel;
