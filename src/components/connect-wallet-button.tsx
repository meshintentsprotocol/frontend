import { useState, useEffect } from 'react';
import { Wallet, Bell, History } from 'lucide-react';
import { useWDK } from '@/context/WDKProvider';
import { WalletOnboardingModal } from '@/components/wallet/WalletOnboardingModal';
import { WalletPopup, hasUnseenNotifications } from '@/components/wallet/WalletPopup';
import { ConnectExternalWalletModal } from '@/components/wallet/ConnectExternalWalletModal';
import { WalletSwitcher } from '@/components/wallet/WalletSwitcher';
import { useWallets } from '@/hooks/useWallets';
import { OrdersPopup } from '@/components/bch-swap/OrdersPopup';
import { cn } from '@/lib/utils';

type PopupTab = 'wallet' | 'notifications';

/**
 * The way into a wallet.
 *
 *   variant="header"  the header control: Connect, or once a wallet is there, the
 *                     search / notifications / orders actions and the wallet profile
 *   variant="cta"     (default) a button for a page that cannot go on without a wallet.
 *                     With no wallet it connects one. With only an external BCH wallet
 *                     it sets up the built-in one, which is what the other chains need.
 */
export function ConnectWalletButton({ className, variant = 'cta' }: { className?: string; variant?: 'header' | 'cta' }) {
    const wdk = useWDK();
    const { hasWallet } = useWallets();
    const inline = variant === 'cta';
    const needsMain = inline && hasWallet && !wdk.isInitialized;
    const [showConnect, setShowConnect] = useState(false);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [showPopup, setShowPopup] = useState(false);
    const [showOrders, setShowOrders] = useState(false);
    const [popupTab, setPopupTab] = useState<PopupTab>('wallet');
    const [hasUnseen, setHasUnseen] = useState(false);

    // Poll for unseen notifications to drive the bell's red dot.
    useEffect(() => {
        const check = () => setHasUnseen(hasUnseenNotifications(wdk.bchNetwork));
        check();
        const id = setInterval(check, 2000);
        return () => clearInterval(id);
    }, [wdk.bchNetwork]);

    const openWallet = () => { setPopupTab('wallet'); setShowPopup(true); };
    const openNotifications = () => { setPopupTab('notifications'); setShowPopup(true); };

    return (
        <div className={cn("flex items-center gap-2", className)}>
            {/* Built-in wallet or an external one: either is enough to get in. */}
            <ConnectExternalWalletModal open={showConnect} onClose={() => setShowConnect(false)} onUseBuiltIn={() => setShowOnboarding(true)} />
            <WalletOnboardingModal open={showOnboarding} onClose={() => setShowOnboarding(false)} />
            <WalletPopup open={showPopup} onClose={() => setShowPopup(false)} initialTab={popupTab} />
            <OrdersPopup open={showOrders} onClose={() => setShowOrders(false)} />

            {!hasWallet || inline ? (
                <button
                    onClick={() => (needsMain ? setShowOnboarding(true) : setShowConnect(true))}
                    className={cn(
                        "group relative inline-flex shrink-0 items-center gap-2 overflow-hidden rounded-xl px-5 text-sm font-bold text-[#050505] tracking-wide bg-emerald-500 hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all duration-300 hover:-translate-y-[1px] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] border border-emerald-400/50",
                        inline ? "w-full h-full min-h-10 justify-center rounded-[inherit]" : "h-10",
                    )}
                >
                    <Wallet className="relative h-4 w-4" />
                    <span className="relative tracking-tight">
                        {needsMain
                            ? (wdk.hasStoredWallet ? 'Unlock main wallet' : 'Set up main wallet')
                            : hasWallet ? 'Add a wallet' : 'Connect'}
                    </span>
                </button>
            ) : (
                <div className="flex items-center gap-2">
                    {/* Actions Panel (Only visible when connected) */}
                    <div className="flex items-center gap-1 rounded-xl px-1.5 h-10 bg-[#0D0D0D]/90 backdrop-blur-xl border border-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset,0_4px_20px_-6px_rgba(0,0,0,0.7)] shrink-0">
                        {/* Search */}
                        <button
                            id="header-search-trigger"
                            title="Search tokens"
                            aria-label="Search tokens"
                            className="relative flex items-center justify-center h-8 w-8 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                            onClick={() => document.dispatchEvent(new CustomEvent('open-token-search'))}
                        >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                            </svg>
                        </button>

                        <span className="w-px h-4 bg-white/[0.07] mx-0.5" />

                        {/* Notifications */}
                        <button
                            onClick={openNotifications}
                            title="Notifications"
                            aria-label="Notifications"
                            className="relative flex items-center justify-center h-8 w-8 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                        >
                            <Bell className="h-4 w-4" />
                            {hasUnseen && (
                                <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 ring-2 ring-[#0D0D0D] animate-pulse" />
                            )}
                        </button>

                        {/* Orders & history */}
                        <button
                            onClick={() => setShowOrders(true)}
                            title="Orders & history"
                            aria-label="Orders & history"
                            className="flex items-center justify-center h-8 w-8 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                        >
                            <History className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Wallet profile: the active wallet, and the switch between wallets */}
                    <WalletSwitcher onAddWallet={() => setShowConnect(true)} onOpenWallet={openWallet} />
                </div>
            )}
        </div>
    );
}
