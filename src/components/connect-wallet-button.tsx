import { useState, useEffect } from 'react';
import { Wallet, Bell, History } from 'lucide-react';
import { useWDK } from '@/context/WDKProvider';
import { hasUnseenNotifications } from '@/lib/notifications';
import { WalletGlyph } from '@/components/wallet/WalletIcon';
import { useWallets, shortAddress } from '@/hooks/useWallets';
import { walletUi, useWalletUi } from '@/lib/walletUi';
import { cn } from '@/lib/utils';

/**
 * The way into a wallet. Everything it opens lives in the one wallet frame
 * (components/wallet/WalletPopup.tsx), through lib/walletUi.ts.
 *
 *   variant="header"  the header control: Connect, or once a wallet is there, the
 *                     search / notifications / orders actions and the wallet button
 *   variant="cta"     (default) a button for a page that cannot go on without a wallet.
 *                     With no wallet it connects one. With only an external BCH wallet
 *                     it sets up the built-in one, which is what the other chains need.
 */
export function ConnectWalletButton({ className, variant = 'cta' }: { className?: string; variant?: 'header' | 'cta' }) {
    const wdk = useWDK();
    const { hasWallet, active, wallets } = useWallets();
    const ui = useWalletUi();
    const inline = variant === 'cta';
    const needsMain = inline && hasWallet && !wdk.isInitialized;
    const [hasUnseen, setHasUnseen] = useState(false);

    // Poll for unseen notifications to drive the bell's red dot.
    useEffect(() => {
        if (inline) return;
        const check = () => setHasUnseen(hasUnseenNotifications(wdk.bchNetwork));
        check();
        const id = setInterval(check, 2000);
        return () => clearInterval(id);
    }, [wdk.bchNetwork, inline]);

    if (!hasWallet || inline) {
        return (
            <div className={cn('flex items-center gap-2', className)}>
                <button
                    type="button"
                    data-wallet-trigger
                    onClick={() => (needsMain ? walletUi.openOnboarding() : walletUi.openConnect())}
                    className={cn(
                        "group relative inline-flex shrink-0 items-center gap-2 overflow-hidden rounded-xl px-5 text-sm font-bold text-[#050505] tracking-wide bg-emerald-500 hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all duration-300 hover:-translate-y-[1px] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] border border-emerald-400/50",
                        inline ? "w-full h-full min-h-10 justify-center rounded-[inherit]" : "h-10",
                    )}
                >
                    <Wallet className="relative h-4 w-4" />
                    <span className="relative tracking-tight">
                        {needsMain
                            ? (wdk.hasStoredWallet ? 'Unlock Cham Wallet' : 'Set up Cham Wallet')
                            : hasWallet ? 'Add a wallet' : 'Connect'}
                    </span>
                </button>
            </div>
        );
    }

    const iconButton = 'relative flex items-center justify-center h-8 w-8 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors';

    return (
        <div className={cn('flex items-center gap-2', className)}>
            {/* Actions Panel (Only visible when connected) */}
            <div className="flex items-center gap-1 rounded-xl px-1.5 h-10 bg-[#0D0D0D]/90 backdrop-blur-xl border border-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset,0_4px_20px_-6px_rgba(0,0,0,0.7)] shrink-0">
                <button
                    id="header-search-trigger"
                    type="button"
                    title="Search tokens"
                    aria-label="Search tokens"
                    className={iconButton}
                    onClick={() => document.dispatchEvent(new CustomEvent('open-token-search'))}
                >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                    </svg>
                </button>

                <span className="w-px h-4 bg-white/[0.07] mx-0.5" />

                <button type="button" data-wallet-trigger onClick={() => walletUi.openWallet('notifications')} title="Notifications" aria-label="Notifications" className={iconButton}>
                    <Bell className="h-4 w-4" />
                    {hasUnseen && <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 ring-2 ring-[#0D0D0D] animate-pulse" />}
                </button>

                <button type="button" onClick={() => walletUi.openOrders()} title="Orders & history" aria-label="Orders & history" data-orders-trigger className={iconButton}>
                    <History className="h-4 w-4" />
                </button>
            </div>

            {/* The wallet: a solid tile in the active wallet's colour. It opens the wallet frame. */}
            <button
                type="button"
                data-wallet-trigger
                data-wallet-button
                onClick={() => (ui.wallet && ui.walletView === 'home' && ui.walletTab === 'wallet' ? walletUi.closeWallet() : walletUi.openWallet())}
                aria-haspopup="dialog"
                aria-expanded={ui.wallet}
                title={active ? `${active.name} · ${shortAddress(active.address, 6, 4)}` : 'Wallet'}
                aria-label={active ? `Open wallet: ${active.name}` : 'Open wallet'}
                className="group inline-flex h-10 shrink-0 items-center gap-2 rounded-xl transition-transform duration-200 hover:-translate-y-[1px] active:scale-95 2xl:border 2xl:border-white/10 2xl:bg-[#0D0D0D]/90 2xl:pr-3"
            >
                <WalletGlyph color={active?.color} size={40} />
                <span className="hidden min-w-0 flex-col items-start leading-tight 2xl:flex">
                    <span className="max-w-[110px] truncate text-[11px] font-bold text-white">{active?.name}</span>
                    <span className="font-mono text-[9.5px] text-white/40">
                        {active ? shortAddress(active.address, 5, 4) : ''}{wallets.length > 1 ? ` · ${wallets.length}` : ''}
                    </span>
                </span>
            </button>
        </div>
    );
}
