import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Bell, CheckCircle2, Clock, XCircle, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWDK } from '@/context/WDKProvider';
import { WalletTokensTab } from './WalletTokensTab';
import { WalletPoolsTab } from './WalletPoolsTab';
import { WalletSettingsTab } from './settings/WalletSettingsTab';
import { ChangePasswordModal } from './ChangePasswordModal';
import { WalletProfile } from './WalletProfile';
import { ConnectWalletView } from './ConnectWalletView';
import { WalletOnboardingView } from './WalletOnboardingView';
import { Chameleon } from './Chameleon';
import { OrdersHub } from '@/components/orders/OrdersHub';

import { useExternalWallets } from '@/lib/wallets/registry';
import { saveAppSettings, useAppSettings } from '@/lib/appSettings';
import { setNotifNetwork, markNotificationsSeen, readNotifications, clearNotifications } from '@/lib/notifications';
import type { StoredNotification } from '@/lib/notifications';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useWallets } from '@/hooks/useWallets';
import { useIsMobile } from '@/hooks/use-mobile';
import { walletUi, useWalletUi, type WalletSubTab } from '@/lib/walletUi';
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';

// ============================================================================
// Wallet Popup — the wallet frame
// ============================================================================
// One frame for everything about wallets: the wallet itself (profile, tokens,
// pools, orders, settings), notifications, connecting a wallet, and creating,
// importing or unlocking the built-in one. Opened from lib/walletUi.ts.
//
// It runs from under the header to just above the bottom of the screen, on the right edge: lying over the page by
// default, docked beside it when the "Dock wallet" setting is on, and a
// full-height sheet on a phone. The profile is its top band; everything under
// the tabs gets the rest of the height.

const SUB_TABS: WalletSubTab[] = ['tokens', 'pools', 'orders', 'settings'];

function getTimeAgo(ts: number): string {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
}

function NotificationsPanel() {
    const { bchNetwork } = useWDK();
    const externalWallets = useExternalWallets();
    const [notifications, setNotifications] = useState<StoredNotification[]>([]);

    useEffect(() => {
        const load = () => {
            setNotifications(readNotifications(bchNetwork));
            // The panel is visible whenever this runs — keep notifications marked
            // as seen so the navbar's unseen indicator clears.
            markNotificationsSeen(bchNetwork);
        };
        load();
        const interval = setInterval(load, 2000);
        return () => clearInterval(interval);
    }, [bchNetwork, externalWallets]);

    const clearAll = () => {
        clearNotifications(bchNetwork);
        setNotifications([]);
    };

    const typeConfig: Record<string, { icon: React.ReactNode; color: string }> = {
        success: { icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" />, color: 'border-emerald-500/40' },
        error: { icon: <XCircle className="h-4 w-4 text-red-400" />, color: 'border-red-500/40' },
        info: { icon: <Bell className="h-4 w-4 text-blue-400" />, color: 'border-blue-500/40' },
        warning: { icon: <Clock className="h-4 w-4 text-yellow-400" />, color: 'border-yellow-500/40' },
    };

    if (notifications.length === 0) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
                <Chameleon size={120} className="text-white/30" />
                <p className="mt-3 text-sm font-semibold text-white/80">No notifications yet</p>
                <p className="mt-1 text-[11px] text-white/40">Swaps, orders and wallet events show up here.</p>
            </div>
        );
    }

    return (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 lg-scroll">
            <div className="flex items-center justify-between px-1 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{notifications.length} Notifications</span>
                <button type="button" onClick={clearAll} className="text-[10px] font-semibold text-white/40 transition-colors hover:text-red-400">Clear All</button>
            </div>
            <div className="space-y-1.5">
                {notifications.map(notif => {
                    const cfg = typeConfig[notif.type] || typeConfig.info;
                    return (
                        <div key={notif.id} className={cn('flex items-start gap-2.5 rounded-xl border-l-2 bg-white/[0.03] p-2.5 transition-colors hover:bg-white/[0.05]', cfg.color)}>
                            <div className="mt-0.5 flex-shrink-0">{cfg.icon}</div>
                            <div className="min-w-0 flex-1">
                                <div className="text-xs font-medium text-white">{notif.message}</div>
                                {notif.description && <div className="mt-0.5 line-clamp-2 text-[10px] text-white/50">{notif.description}</div>}
                                <div className="mt-0.5 text-[9px] text-white/35">{getTimeAgo(notif.timestamp)}</div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

const BAR_BUTTON = 'flex h-8 w-8 items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-white/[0.07] hover:text-white';

export function WalletPopup() {
    const ui = useWalletUi();
    const open = ui.wallet;
    const settings = useAppSettings();
    const isMobile = useIsMobile();
    const docked = settings.dockWallet && !isMobile;

    const [subTab, setSubTab] = useState<WalletSubTab>('tokens');
    const [showChangePwd, setShowChangePwd] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    const wdk = useWDK();
    const { hasWallet } = useWallets();
    const balanceVisible = !settings.hideBalances;

    // With no wallet there is nothing to show but the way to get one.
    const view = ui.walletView === 'home' && !hasWallet ? 'connect' : ui.walletView;
    const onClose = walletUi.closeWallet;

    // Keep module-level _activeNetwork in sync so pushNotification() writes to the right key
    useEffect(() => { setNotifNetwork(wdk.bchNetwork); }, [wdk.bchNetwork]);

    // An opener may ask for a particular tab (the orders board, settings).
    useEffect(() => { if (open && ui.walletSub) setSubTab(ui.walletSub); }, [open, ui.walletSub]);

    // True while a Radix dialog (Send / Receive / edit card / token selector …) is open —
    // those portal to <body>, so the popup must not treat clicks in them as
    // "outside" and close itself.
    const radixDialogOpen = () => !!document.querySelector('[role="dialog"][data-state="open"]');

    // A popup closes on a click outside it; a docked panel stays until it is closed.
    useEffect(() => {
        if (!open || showChangePwd || docked || isMobile) return;
        const handler = (e: MouseEvent) => {
            if (radixDialogOpen()) return;
            const target = e.target as Element;
            // The header's own wallet buttons toggle the popup themselves.
            if (target.closest?.('[data-wallet-trigger]')) return;
            if (panelRef.current && !panelRef.current.contains(target)) onClose();
        };
        // Delay to avoid click-through from the trigger button
        const timer = setTimeout(() => document.addEventListener('mousedown', handler), 100);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handler);
        };
    }, [open, onClose, showChangePwd, docked, isMobile]);

    useEffect(() => {
        if (!open || showChangePwd) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !radixDialogOpen()) onClose();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [open, onClose, showChangePwd]);

    // A docked wallet takes its strip of the page on a wide screen (index.css).
    useEffect(() => {
        const on = open && docked;
        document.documentElement.classList.toggle('wallet-docked', on);
        return () => document.documentElement.classList.remove('wallet-docked');
    }, [open, docked]);

    // Calculate total portfolio value using shared hook to ensure UI consistency.
    // While open, balances poll every 5s in the background (stale-while-revalidate);
    // while closed, polling stops but the cache keeps the last-known values warm.
    const { tokens: activeTokens, totalValue: portfolioValue, loading: portfolioLoading, refetch: refetchPortfolio } = usePortfolio({ pollingMs: open ? 5000 : 0, scope: 'active' });

    // Refresh immediately when popup opens
    useEffect(() => {
        if (open) refetchPortfolio();
    }, [open, refetchPortfolio]);

    const setBalanceVisible = (visible: boolean) => saveAppSettings({ hideBalances: !visible });

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        try { await refetchPortfolio(); } finally { setTimeout(() => setRefreshing(false), 600); }
    }, [refetchPortfolio]);

    if (!open) return null;

    const closeButton = !isMobile && (
        <button type="button" onClick={onClose} title="Close" aria-label="Close the wallet" className={BAR_BUTTON}>
            <X className="h-4 w-4" />
        </button>
    );

    const content = view === 'connect' ? (
        <div className="relative flex min-h-0 flex-1 flex-col">
            <div className="absolute right-2 top-2 z-10">{closeButton}</div>
            <ConnectWalletView onDone={walletUi.showHome} />
        </div>
    ) : view === 'onboarding' ? (
        <div className="relative flex min-h-0 flex-1 flex-col">
            <div className="absolute right-2 top-2 z-10">{closeButton}</div>
            <WalletOnboardingView onDone={walletUi.showHome} onBack={hasWallet ? walletUi.showHome : walletUi.openConnect} />
        </div>
    ) : (
        <>
            {/* ─── Top bar: wallet / notifications, and the frame's own controls ─── */}
            <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2">
                <div role="tablist" aria-label="Wallet sections" className="flex rounded-full p-0.5 lg-well">
                    {(['wallet', 'notifications'] as const).map(tab => (
                        <button
                            key={tab}
                            type="button"
                            role="tab"
                            aria-selected={ui.walletTab === tab}
                            onClick={() => walletUi.setWalletTab(tab)}
                            className={cn(
                                'h-7 rounded-full px-3.5 text-[11px] font-semibold capitalize transition-colors',
                                ui.walletTab === tab ? 'bg-white/[0.12] text-white' : 'text-white/45 hover:text-white/80',
                            )}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
                <div className="flex items-center">
                    {!isMobile && (
                        <button
                            type="button"
                            onClick={() => saveAppSettings({ dockWallet: !settings.dockWallet })}
                            title={docked ? 'Undock: open as a popup' : 'Dock to the side'}
                            aria-label={docked ? 'Undock the wallet' : 'Dock the wallet to the side'}
                            aria-pressed={docked}
                            className={cn(BAR_BUTTON, docked && 'text-emerald-300')}
                        >
                            {docked ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                        </button>
                    )}
                    {closeButton}
                </div>
            </div>

            {ui.walletTab === 'wallet' ? (
                <div className="flex min-h-0 flex-1 flex-col">
                    <WalletProfile
                        totalValue={portfolioValue}
                        loading={portfolioLoading}
                        busy={refreshing}
                        onRefresh={handleRefresh}
                        balanceVisible={balanceVisible}
                        onBalanceVisibleChange={setBalanceVisible}
                    />

                    {/* ─── Sub tabs ─── */}
                    <div role="tablist" aria-label="Wallet" className="flex shrink-0 border-b border-white/[0.07] px-3">
                        {SUB_TABS.map(tab => (
                            <button
                                key={tab}
                                type="button"
                                role="tab"
                                aria-selected={subTab === tab}
                                onClick={() => setSubTab(tab)}
                                className={cn(
                                    'relative flex-1 py-2 text-xs font-semibold capitalize transition-colors',
                                    subTab === tab ? 'text-white' : 'text-white/40 hover:text-white/75',
                                )}
                            >
                                {tab}
                                {subTab === tab && <span className="absolute inset-x-[22%] bottom-[-1px] h-[2px] rounded-full bg-emerald-400" />}
                            </button>
                        ))}
                    </div>

                    <div className={cn('min-h-0 flex-1', subTab === 'orders' ? 'flex flex-col' : 'overflow-y-auto px-3 pb-6 lg-scroll')}>
                        {subTab === 'tokens' && <WalletTokensTab balanceVisible={balanceVisible} activeTokens={activeTokens} loading={portfolioLoading} onClose={docked ? undefined : onClose} />}
                        {subTab === 'pools' && <WalletPoolsTab onClose={docked ? undefined : onClose} />}
                        {subTab === 'orders' && <OrdersHub variant="embedded" />}
                        {subTab === 'settings' && (
                            <WalletSettingsTab
                                balanceVisible={balanceVisible}
                                onBalanceVisibleChange={setBalanceVisible}
                                onChangePassword={() => setShowChangePwd(true)}
                            />
                        )}
                    </div>
                </div>
            ) : (
                <NotificationsPanel />
            )}

            <ChangePasswordModal open={showChangePwd} onClose={() => setShowChangePwd(false)} />
        </>
    );

    if (isMobile) {
        return (
            <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
                <DrawerContent className="lg-panel mt-0 h-[100dvh] rounded-t-xl border-b-0 p-0 [&>div:first-child]:pb-1 [&>div:first-child]:pt-2">
                    <DrawerTitle className="sr-only">Wallet</DrawerTitle>
                    <DrawerDescription className="sr-only">Your wallets, balances, orders and settings</DrawerDescription>
                    <div className="flex min-h-0 flex-1 flex-col pb-[env(safe-area-inset-bottom)]">{content}</div>
                </DrawerContent>
            </Drawer>
        );
    }

    return (
        <div
            ref={panelRef}
            role="dialog"
            aria-label="Wallet"
            data-wallet-frame={docked ? 'docked' : 'popup'}
            className={cn(
                // From under the header to just short of the bottom, a small margin in from the right edge, in both modes. A popup lies over
                // the page and closes on a click outside; docked, it stays and the page makes room for it (index.css).
                'lg-panel fixed bottom-2 right-2 top-20 z-[100] flex w-[404px] max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-xl',
                'animate-in slide-in-from-right-8 fade-in duration-200',
            )}
        >
            {content}
            {/* Where the wallet ends: a thin line of light along its bottom edge. */}
            <div aria-hidden className="pointer-events-none absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-400/80 to-transparent shadow-[0_0_22px_3px_rgba(16,185,129,0.5)]" />
            <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-emerald-500/[0.09] to-transparent" />
        </div>
    );
}
