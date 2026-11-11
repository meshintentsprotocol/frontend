import { useId } from 'react';
import { cn } from '@/lib/utils';

export interface BCHLogoProps {
    className?: string;
    size?: number | string;
    variant?: 'gradient' | 'solid';
    glow?: boolean;
    alt?: string;
}

/**
 * BCHLogo — Official vector lightning logo for BCH Intents Protocol.
 * Scalable vector SVG with smooth rounded corners, theme gradient, and optional subtle glow.
 */
export function BCHLogo({
    className,
    size,
    variant = 'gradient',
    glow = false,
    alt = 'BCH Intents Logo',
}: BCHLogoProps) {
    const rawId = useId();
    const gradId = `bch-grad-${rawId.replace(/:/g, '')}`;
    const filterId = `bch-glow-${rawId.replace(/:/g, '')}`;

    const style = size ? { width: size, height: size } : undefined;

    return (
        <svg
            viewBox="0 0 512 512"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={cn('shrink-0 select-none transition-transform', className)}
            style={style}
            role="img"
            aria-label={alt}
        >
            <defs>
                <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#00F59B" />
                    <stop offset="100%" stopColor="#00C853" />
                </linearGradient>
                {glow && (
                    <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="0" stdDeviation="12" floodColor="#00F59B" floodOpacity="0.45" />
                    </filter>
                )}
            </defs>
            <path
                d="M 280.72 70.70 Q 318.00 30.00 308.26 84.33 L 287.99 197.47 Q 287.00 203.00 292.61 203.34 L 400.84 209.92 Q 435.00 212.00 411.50 236.88 L 222.66 436.83 Q 180.00 482.00 195.53 421.85 L 225.47 305.92 Q 227.00 300.00 220.90 299.67 L 111.81 293.82 Q 78.00 292.00 100.87 267.03 Z"
                fill={variant === 'gradient' ? `url(#${gradId})` : '#00D17A'}
                filter={glow ? `url(#${filterId})` : undefined}
            />
        </svg>
    );
}

export default BCHLogo;

