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
    return (
        <span
            className={cn('relative inline-flex shrink-0 items-center justify-center transition-[background-color,box-shadow] duration-500', className)}
            style={{
                width: size, height: size, borderRadius: Math.round(size * 0.3),
                background: `linear-gradient(145deg, color-mix(in srgb, ${color} 82%, #ffffff) 0%, ${color} 45%, color-mix(in srgb, ${color} 78%, #000000) 100%)`,
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(0,0,0,0.25), 0 6px 18px -6px ${color}`,
            }}
        >
            <Wallet className="text-[#050505]" strokeWidth={2.6} style={{ width: size * 0.52, height: size * 0.52 }} />
        </span>
    );
}

export function WalletIcon({ id, color, size = 36, active, className }: {
    /** 'main' | 'cashonize' | 'paytaca' | 'walletconnect' | 'bch-intents' */
    id: string;
    /** Hex colour of the wallet; tints the ring. */
    color?: string;
    size?: number;
    /** Shows the small live dot. */
    active?: boolean;
    className?: string;
}) {
    const [failed, setFailed] = useState(false);
    const radius = Math.round(size * 0.3);

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
                    src={`/logos/wallets/${id}.svg`}
                    alt=""
                    draggable={false}
                    onError={() => setFailed(true)}
                    style={{ width: size - 4, height: size - 4, borderRadius: radius - 2 }}
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
