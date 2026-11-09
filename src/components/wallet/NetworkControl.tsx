/**
 * The Testnet / Mainnet choice. It is made in one place, the wallet's profile
 * section (NetworkSwitch); the header only shows which one is on (NetworkBadge).
 */

import { cn } from '@/lib/utils';
import { useWDK } from '@/context/WDKProvider';
import { useWallets } from '@/hooks/useWallets';
import { walletUi } from '@/lib/walletUi';

const NETWORKS = [['chipnet', 'Testnet'], ['mainnet', 'Mainnet']] as const;

/** The two-way switch, sized for the profile card. */
export function NetworkSwitch({ className }: { className?: string }) {
    const wdk = useWDK();
    const isMainnet = wdk.bchNetwork === 'mainnet';
    return (
        <div
            role="radiogroup"
            aria-label="Network"
            className={cn('relative flex h-8 shrink-0 items-center rounded-full p-0.5 lg-well', className)}
        >
            <span
                aria-hidden
                className={cn(
                    'absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-full border transition-[left,background-color,border-color] duration-300 [transition-timing-function:cubic-bezier(0.34,1.4,0.64,1)]',
                    isMainnet ? 'left-[50%] border-emerald-400/35 bg-emerald-500/20' : 'left-0.5 border-white/[0.12] bg-white/[0.1]',
                )}
            />
            {NETWORKS.map(([net, label]) => {
                const selected = wdk.bchNetwork === net;
                return (
                    <button
                        key={net}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => wdk.setBchNetwork(net)}
                        className={cn(
                            'relative z-10 flex h-7 flex-1 items-center justify-center gap-1 rounded-full px-3 text-[11px] font-semibold transition-colors duration-200',
                            selected ? (net === 'mainnet' ? 'text-emerald-200' : 'text-white') : 'text-white/40 hover:text-white/70',
                        )}
                    >
                        {net === 'mainnet' && selected && <LiveDot />}
                        {label}
                    </button>
                );
            })}
        </div>
    );
}

function LiveDot() {
    return (
        <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
        </span>
    );
}

/**
 * The header's network badge. With a wallet connected it opens the wallet, where the
 * switch is; with none there is no profile to open, so it switches right there.
 */
export function NetworkBadge({ className }: { className?: string }) {
    const wdk = useWDK();
    const { hasWallet } = useWallets();
    const isMainnet = wdk.bchNetwork === 'mainnet';
    const label = isMainnet ? 'Mainnet' : 'Testnet';
    return (
        <button
            type="button"
            data-network-badge
            onClick={() => (hasWallet ? walletUi.openWallet() : wdk.setBchNetwork(isMainnet ? 'chipnet' : 'mainnet'))}
            title={hasWallet ? `${label} · change it in the wallet` : `${label} · switch to ${isMainnet ? 'Testnet' : 'Mainnet'}`}
            aria-label={hasWallet ? `Network: ${label}. Open the wallet to change it` : `Network: ${label}. Switch to ${isMainnet ? 'Testnet' : 'Mainnet'}`}
            className={cn(
                'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold backdrop-blur-xl transition-colors duration-300',
                isMainnet
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15'
                    : 'border-white/10 bg-[#0D0D0D]/90 text-zinc-300 hover:border-white/20 hover:text-white',
                className,
            )}
        >
            {isMainnet ? <LiveDot /> : <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
            {label}
        </button>
    );
}
