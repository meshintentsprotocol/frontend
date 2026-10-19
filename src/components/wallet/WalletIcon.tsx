import { useState } from 'react';
import { Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A wallet's icon: `public/logos/wallets/<id>.svg`, on a tile tinted with the
 * wallet's colour. The files there are placeholders meant to be replaced with
 * the real logos (see the README next to them). A missing file falls back to
 * a generic wallet glyph.
 */
/**
 * The wallet as a solid tile in its own colour: the header's wallet button, and
 * wherever a wallet is shown by colour instead of by brand.
 */
export function WalletGlyph({ color = '#10b981', size = 40, className }: { color?: string; size?: number; className?: string }) {
    const radius = Math.round(size * 0.3);
    return (
        <span
            className={cn('relative inline-flex shrink-0 items-center justify-center overflow-hidden transition-[background-color] duration-500', className)}
            style={{
                width: size, height: size, borderRadius: radius,
                // A single lit gem: light from the top-left, a thin bright rim, a soft inner floor and a gentle ambient shadow.
                background: `radial-gradient(130% 115% at 28% 18%, color-mix(in srgb, ${color} 90%, #ffffff) 0%, ${color} 46%, color-mix(in srgb, ${color} 72%, #04110a) 100%)`,
                boxShadow: [
                    `inset 0 1px 1px rgba(255,255,255,0.55)`,
                    `inset 0 0 0 1px color-mix(in srgb, ${color} 50%, #ffffff)`,
                    `inset 0 -${Math.max(1, size * 0.05)}px ${Math.max(2, size * 0.1)}px rgba(0,0,0,0.3)`,
                    `0 1px 2px rgba(0,0,0,0.45)`,
                    `0 ${Math.round(size * 0.18)}px ${Math.round(size * 0.4)}px -${Math.round(size * 0.26)}px color-mix(in srgb, ${color} 65%, transparent)`,
                ].join(', '),
            }}
        >
            {/* top sheen */}
            <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.4), transparent)' }} />
            <Wallet className="relative text-[#04110a]" strokeWidth={2.4} style={{ width: size * 0.5, height: size * 0.5, filter: 'drop-shadow(0 1px 0.5px rgba(255,255,255,0.35))' }} />
        </span>
    );
}

export function WalletIcon({ id, src, color, size = 36, active, className }: {
    /** 'main' | 'cashonize' | 'paytaca' | 'walletconnect' | 'bch-intents' */
    id: string;
    /** Direct image URL from session metadata (e.g. peer icon) */
    src?: string;
    /** Hex colour of the wallet; tints the ring. */
    color?: string;
    size?: number;
    /** Shows the small live dot. */
    active?: boolean;
    className?: string;
}) {
    const [failed, setFailed] = useState(false);
    const radius = Math.round(size * 0.3);

    const imageSrc = !failed && src ? src : `/logos/wallets/${id}.svg`;

    return (
        <span
            className={cn('relative inline-flex shrink-0 items-center justify-center bg-white/[0.04]', className)}
            style={{
                width: size, height: size, borderRadius: radius,
                boxShadow: color ? `0 0 0 1.5px ${color}66, 0 4px 14px -6px ${color}80` : '0 0 0 1px rgba(255,255,255,0.08)',
            }}
        >
            {failed ? (
                <Wallet style={{ width: size * 0.48, height: size * 0.48, color: color ?? '#a1a1aa' }} />
            ) : (
                <img
                    src={imageSrc}
                    alt=""
                    draggable={false}
                    onError={() => setFailed(true)}
                    style={{ width: size - 4, height: size - 4, borderRadius: radius - 2, objectFit: 'contain' }}
                />
            )}
            {active && (
                <span
                    className="absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-[#0A0A0A]"
                    style={{ width: Math.max(8, size * 0.24), height: Math.max(8, size * 0.24), background: color ?? '#10b981' }}
                />
            )}
        </span>
    );
}
