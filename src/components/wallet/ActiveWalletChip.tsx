/**
 * ActiveWalletChip — names the wallet that will sign, where that matters right
 * there (the swap card). It does not switch wallets itself: clicking it opens the
 * wallet, whose profile is the one place that does.
 */

import { cn } from '@/lib/utils';
import { useWallets, shortAddress } from '@/hooks/useWallets';
import { walletUi } from '@/lib/walletUi';
import { WalletGlyph, WalletIcon } from './WalletIcon';

export function ActiveWalletChip({ className }: { className?: string }) {
    const { active } = useWallets();
    if (!active) return null;

    return (
        <button
            type="button"
            data-wallet-trigger
            data-wallet-chip
            onClick={() => walletUi.openWallet()}
            title={`Signing with ${active.name} · ${shortAddress(active.address, 6, 4)}. Open the wallet to change it.`}
            aria-label={`Signing with ${active.name}. Open the wallet`}
            className={cn(
                'flex h-7 items-center gap-1.5 rounded-full border bg-white/[0.04] pl-0.5 pr-0.5 text-xs font-bold transition-colors hover:bg-white/[0.08] sm:pr-2.5',
                className,
            )}
            style={{ color: active.color, borderColor: `${active.color}55` }}
        >
            {active.iconUrl
                ? <WalletIcon id={active.iconId} src={active.iconUrl} color={active.color} size={22} />
                : <WalletGlyph color={active.color} size={22} />}
            <span className="hidden max-w-[84px] truncate sm:inline">{active.name}</span>
        </button>
    );
}
