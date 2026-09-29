import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { getChainMeta } from '@/lib/chains';
import { getIconFallbackUrls, isIconUrlFailed, markIconUrlFailed } from '@/lib/tokenIcons';

type IconSize = 'xs' | 'sm' | 'md' | 'lg';

const ICON_LOAD_TIMEOUT_MS = 4000;

const SIZES: Record<IconSize, { wrap: string; img: string; badge: string; badgeImg: string; text: string }> = {
    xs: { wrap: 'h-6 w-6', img: 'h-4 w-4', badge: 'h-2.5 w-2.5', badgeImg: 'h-[7px] w-[7px]', text: 'text-[9px]' },
    sm: { wrap: 'h-8 w-8', img: 'h-5 w-5', badge: 'h-3 w-3', badgeImg: 'h-2 w-2', text: 'text-[10px]' },
    md: { wrap: 'h-9 w-9', img: 'h-6 w-6', badge: 'h-3.5 w-3.5', badgeImg: 'h-2.5 w-2.5', text: 'text-xs' },
    lg: { wrap: 'h-10 w-10', img: 'h-6 w-6', badge: 'h-4 w-4', badgeImg: 'h-2.5 w-2.5', text: 'text-sm' },
};

interface TokenChainIconProps {
    /** Token logo path/URL. */
    tokenIcon: string;
    /** Token name or symbol — used as alt text & fallback seed. */
    tokenName?: string;
    /** Chain label (any spelling). Badge is hidden when unresolvable. */
    chain?: string | null;
    size?: IconSize;
    className?: string;
}

export function TokenChainIcon({ tokenIcon, tokenName, chain, size = 'md', className }: TokenChainIconProps) {
    const s = SIZES[size];
    const chainMeta = getChainMeta(chain);

    // Skip candidates that already failed elsewhere this session; keep at least
    // the last one (identicon) so there is always something to try.
    const fallbackUrls = useMemo(() => {
        const all = getIconFallbackUrls(tokenIcon, tokenName || 'token');
        const live = all.filter(u => !isIconUrlFailed(u));
        return live.length > 0 ? live : all.slice(-1);
    }, [tokenIcon, tokenName]);

    const [urlIndex, setUrlIndex] = useState(0);
    const [loaded, setLoaded] = useState(false);

    // Reset whenever the candidate list changes
    useEffect(() => {
        setUrlIndex(0);
        setLoaded(false);
    }, [fallbackUrls]);

    const allFailed = urlIndex >= fallbackUrls.length;
    const currentSrc = fallbackUrls[urlIndex];
    const isLastCandidate = urlIndex >= fallbackUrls.length - 1;

    const advance = () => {
        if (currentSrc) markIconUrlFailed(currentSrc);
        setLoaded(false);
        setUrlIndex(prev => prev + 1);
    };

    // Unpinned IPFS CIDs make gateways hang for 20s+ without ever firing
    // onError — give each non-final candidate a bounded time to load.
    useEffect(() => {
        if (loaded || allFailed || isLastCandidate) return;
        const timer = setTimeout(advance, ICON_LOAD_TIMEOUT_MS);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentSrc, loaded, allFailed, isLastCandidate]);

    const initialLetter = (tokenName || '?').trim().slice(0, 2).toUpperCase();

    return (
        <div className={cn('relative flex-shrink-0', className)}>
            <div className={cn(s.wrap, 'relative rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden')}>
                {/* Monogram sits underneath until an image paints — no blank holes or layout shift */}
                {!loaded && (
                    <span className={cn('font-bold text-muted-foreground select-none', s.text)}>
                        {initialLetter}
                    </span>
                )}
                {!allFailed && currentSrc && (
                    <img
                        key={currentSrc}
                        src={currentSrc}
                        alt={tokenName || 'token'}
                        className={cn(
                            s.img,
                            'object-contain transition-opacity duration-150',
                            loaded ? 'opacity-100' : 'absolute opacity-0',
                        )}
                        onLoad={() => setLoaded(true)}
                        onError={advance}
                    />
                )}
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
