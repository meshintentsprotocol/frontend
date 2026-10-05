import { useState, useEffect } from 'react';
import { Wallet, Bell, History } from 'lucide-react';
import { useWDK } from '@/context/WDKProvider';
import { WalletOnboardingModal } from '@/components/wallet/WalletOnboardingModal';
import { WalletPopup, hasUnseenNotifications } from '@/components/wallet/WalletPopup';
import { OrdersPopup } from '@/components/bch-swap/OrdersPopup';
import { cn } from '@/lib/utils';

type PopupTab = 'wallet' | 'notifications';

export function ConnectWalletButton({ className }: { className?: string }) {
    const wdk = useWDK();
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

    const connectedChains = [
        wdk.evmAddress && { icon: '/logos/ethereum-eth-logo.svg', label: 'EVM' },
        wdk.bchAddress && { icon: '/logos/bitcoin-cash-bch-logo.svg', label: 'BCH' },
        wdk.btcAddress && { icon: '/logos/bitcoin-btc-logo.svg', label: 'BTC' },
        wdk.solanaAddress && { icon: '/logos/solana.svg', label: 'SOL' },
    ].filter(Boolean) as { icon: string; label: string }[];

    const openWallet = () => { setPopupTab('wallet'); setShowPopup(v => !v); };
    const openNotifications = () => { setPopupTab('notifications'); setShowPopup(true); };

    return (
        <div className={cn("flex items-center gap-2", className)}>
            <WalletOnboardingModal open={showOnboarding} onClose={() => setShowOnboarding(false)} />
            <WalletPopup open={showPopup} onClose={() => setShowPopup(false)} initialTab={popupTab} />
            <OrdersPopup open={showOrders} onClose={() => setShowOrders(false)} />

            {connectedChains.length === 0 ? (
                <button
                    onClick={() => setShowOnboarding(true)}
                    className="group relative inline-flex shrink-0 h-10 items-center gap-2 overflow-hidden rounded-xl px-5 text-sm font-bold text-[#050505] tracking-wide bg-emerald-500 hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all duration-300 hover:-translate-y-[1px] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] border border-emerald-400/50"
                >
                    <Wallet className="relative h-4 w-4" />
                    <span className="relative tracking-tight">Connect</span>
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

                    {/* Wallet Button */}
                    <button
                        onClick={openWallet}
                        title="Open wallet"
                        className="group relative inline-flex shrink-0 h-10 w-10 items-center justify-center rounded-xl bg-[#111111] border border-white/15 shadow-[0_0_0_1px_rgba(255,255,255,0.05)_inset,0_4px_16px_-6px_rgba(0,0,0,0.8)] hover:bg-[#181818] hover:border-white/25 transition-all duration-300"
                    >
                        <Wallet className="h-4 w-4 text-emerald-400 transition-transform duration-200 group-hover:scale-110" />
                    </button>
                </div>
            )}
        </div>
    );
}
