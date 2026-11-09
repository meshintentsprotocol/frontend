import { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChainFamily } from '@/lib/wallets/types';

/** Logo of each chain family, for chain pickers and the small badge on a wallet icon. */
export const CHAIN_LOGOS: Record<ChainFamily, string> = {
    bch: '/logos/bitcoin-cash-bch-logo.svg',
    evm: '/logos/ethereum-eth-logo.svg',
    solana: '/logos/solana.svg',
    btc: '/logos/bitcoin-btc-logo.svg',
};

export const CHAIN_NAMES: Record<ChainFamily, string> = {
    bch: 'Bitcoin Cash',
    evm: 'EVM',
    solana: 'Solana',
    btc: 'Bitcoin',
};

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

export function WalletIcon({ id, src, color, size = 36, active, chain, className }: {
    /** 'main' | 'cashonize' | 'paytaca' | 'walletconnect' | 'bch-intents' */
    id: string;
    /** The wallet's own icon from its session (WalletConnect peer, AppKit wallet info); tried first. */
    src?: string;
    /** Hex colour of the wallet; tints the ring. */
    color?: string;
    size?: number;
    /** Shows the small live dot. */
    active?: boolean;
    /** Shows the chain's logo as a small badge, for lists that mix chains. */
    chain?: ChainFamily;
    className?: string;
}) {
    // Session icon first, then the bundled file, then the glyph.
    const sources = [src, `/logos/wallets/${id}.svg`].filter((s): s is string => !!s);
    const [attempt, setAttempt] = useState(0);
    useEffect(() => { setAttempt(0); }, [src, id]);
    const imageSrc = sources[attempt];
    const radius = Math.round(size * 0.3);
    const badge = Math.max(12, Math.round(size * 0.42));

    return (
        <span
            className={cn('relative inline-flex shrink-0 items-center justify-center bg-white/[0.04]', className)}
            style={{
                width: size, height: size, borderRadius: radius,
                boxShadow: color ? `0 0 0 1.5px ${color}66, 0 4px 14px -6px ${color}80` : '0 0 0 1px rgba(255,255,255,0.08)',
            }}
        >
            {imageSrc ? (
                <img
                    key={imageSrc}
                    src={imageSrc}
                    alt=""
                    draggable={false}
                    referrerPolicy="no-referrer"
                    onError={() => setAttempt(a => a + 1)}
                    style={{ width: size - 4, height: size - 4, borderRadius: radius - 2, objectFit: 'contain' }}
                />
            ) : (
                <Wallet style={{ width: size * 0.48, height: size * 0.48, color: color ?? '#a1a1aa' }} />
            )}
            {chain && (
                <img
                    src={CHAIN_LOGOS[chain]}
                    alt={CHAIN_NAMES[chain]}
                    title={CHAIN_NAMES[chain]}
                    draggable={false}
                    className="absolute -bottom-1 -left-1 rounded-full bg-[#0A0A0A] p-[1.5px] ring-1 ring-[#0A0A0A]"
                    style={{ width: badge, height: badge }}
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
