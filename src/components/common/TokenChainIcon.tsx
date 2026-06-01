/**
 * TokenChainIcon — token logo with a small chain-logo badge overlaid at the
 * bottom-right corner, matching the order-row icons on /trade.
 *
 * Chain logos resolve through the central registry (`lib/chains.ts`), so any
 * chain label spelling ('Bitcoin Cash', 'bch', 'BSC', …) renders correctly.
 */

import { cn } from '@/lib/utils';
import { getChainMeta } from '@/lib/chains';

type IconSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZES: Record<IconSize, { wrap: string; img: string; badge: string; badgeImg: string }> = {
    xs: { wrap: 'h-6 w-6', img: 'h-4 w-4', badge: 'h-2.5 w-2.5', badgeImg: 'h-[7px] w-[7px]' },
    sm: { wrap: 'h-8 w-8', img: 'h-5 w-5', badge: 'h-3 w-3', badgeImg: 'h-2 w-2' },
    md: { wrap: 'h-9 w-9', img: 'h-6 w-6', badge: 'h-3.5 w-3.5', badgeImg: 'h-2.5 w-2.5' },
    lg: { wrap: 'h-10 w-10', img: 'h-6 w-6', badge: 'h-4 w-4', badgeImg: 'h-2.5 w-2.5' },
};

interface TokenChainIconProps {
    /** Token logo path/URL. */
    tokenIcon: string;
    /** Token name — used as alt text. */
    tokenName?: string;
    /** Chain label (any spelling). Badge is hidden when unresolvable. */
    chain?: string | null;
    size?: IconSize;
    className?: string;
}

export function TokenChainIcon({ tokenIcon, tokenName, chain, size = 'md', className }: TokenChainIconProps) {
    const s = SIZES[size];
    const chainMeta = getChainMeta(chain);

    return (
        <div className={cn('relative flex-shrink-0', className)}>
            <div className={cn(s.wrap, 'rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden')}>
                <img
                    src={tokenIcon}
                    alt={tokenName || 'token'}
                    className={cn(s.img, 'object-contain')}
                    loading="lazy"
                    onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                />
            </div>
            {chainMeta && (
                <div
                    className={cn(
                        s.badge,
                        'absolute -bottom-0.5 -right-0.5 rounded-full bg-[#0A0A0A] border border-white/15 flex items-center justify-center overflow-hidden',
                    )}
                    title={chainMeta.name}
                >
                    <img
                        src={chainMeta.logo}
                        alt={chainMeta.name}
                        className={cn(s.badgeImg, 'object-contain')}
                        loading="lazy"
                    />
                </div>
            )}
        </div>
    );
}

export default TokenChainIcon;
