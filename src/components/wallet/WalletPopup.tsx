import { useState, useEffect, useRef } from 'react';
import { X, Wallet, Bell, LogOut, RefreshCw, Eye, EyeOff, CheckCircle2, Clock, XCircle, KeyRound, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useWDK } from '@/context/WDKProvider';
import { useExternalBCHWallet } from '@/context/ExternalBCHWalletProvider';
import { WalletTokensTab } from './WalletTokensTab';
import { WalletOrdersTab } from './WalletOrdersTab';
import { WalletHistoryTab } from './WalletHistoryTab';
import { WalletAddressesTab } from './WalletAddressesTab';
import { ChangePasswordModal } from './ChangePasswordModal';
import { ConnectExternalWalletModal } from './ConnectExternalWalletModal';

import { hasStoredWallet } from '@/lib/crypto';
import { notifyToast as toast } from '@/lib/notify-toast';
import {
    setNotifNetwork, markNotificationsSeen, readNotifications, clearNotifications,
} from '@/lib/notifications';
import type { StoredNotification } from '@/lib/notifications';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useIsMobile } from '@/hooks/use-mobile';
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';

// ============================================================================
// Wallet Popup — Multi-tab wallet panel for the navbar
// ============================================================================

type TopTab = 'wallet' | 'notifications';
type SubTab = 'tokens' | 'orders' | 'history' | 'addresses';

// ============================================================================
// Notifications Panel — Shows captured toast/notification events
// ============================================================================

// The notification store moved to @/lib/notifications: keeping it here made
// notify-toast.ts import a component module, which became a real import cycle
// once this file started using notifyToast itself.
// Re-exported so existing importers of this module keep working.
export {
    setNotifNetwork, pushNotification, markNotificationsSeen, hasUnseenNotifications,
} from '@/lib/notifications';
export type { StoredNotification } from '@/lib/notifications';

function getTimeAgo(ts: number): string {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
}

function NotificationsPanel() {
    const { bchNetwork } = useWDK();
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
    }, [bchNetwork]);

    const clearAll = () => {
        clearNotifications(bchNetwork);
        setNotifications([]);
    };

    const typeConfig: Record<string, { icon: React.ReactNode; color: string }> = {
        success: { icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" />, color: 'border-emerald-500/30' },
        error: { icon: <XCircle className="h-4 w-4 text-red-400" />, color: 'border-red-500/30' },
        info: { icon: <Bell className="h-4 w-4 text-blue-400" />, color: 'border-blue-500/30' },
        warning: { icon: <Clock className="h-4 w-4 text-yellow-400" />, color: 'border-yellow-500/30' },
    };

    if (notifications.length === 0) {
        return (
            <div className="flex-1 px-4 py-10 text-center">
                <Bell className="h-10 w-10 mx-auto text-muted-foreground/20 mb-3" />
                <p className="text-sm text-muted-foreground">No notifications yet</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                    Toast events will appear here
                </p>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto min-h-0 px-3 pb-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
            <div className="flex items-center justify-between px-1 py-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    {notifications.length} Notifications
                </span>
                <button
                    onClick={clearAll}
                    className="text-[10px] text-muted-foreground hover:text-red-400 transition-colors"
                >
                    Clear All
                </button>
            </div>
            <div className="space-y-1.5">
                {notifications.map(notif => {
                    const cfg = typeConfig[notif.type] || typeConfig.info;
                    return (
                        <div
                            key={notif.id}
                            className={cn(
                                "flex items-start gap-2.5 p-2.5 rounded-lg border-l-2 bg-white/[0.02] hover:bg-white/[0.04] transition-colors",
                                cfg.color
                            )}
                        >
                            <div className="mt-0.5 flex-shrink-0">{cfg.icon}</div>
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium text-foreground">{notif.message}</div>
                                {notif.description && (
                                    <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{notif.description}</div>
                                )}
                                <div className="text-[9px] text-muted-foreground/60 mt-0.5">
                                    {getTimeAgo(notif.timestamp)}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

interface WalletPopupProps {
    open: boolean;
    onClose: () => void;
    /** Top tab to show when opened (e.g. 'notifications' from the navbar bell). */
    initialTab?: TopTab;
}

export function WalletPopup({ open, onClose, initialTab }: WalletPopupProps) {
    const [topTab, setTopTab] = useState<TopTab>('wallet');
    const [subTab, setSubTab] = useState<SubTab>('tokens');
    const [balanceVisible, setBalanceVisible] = useState(true);
    const [showChangePwd, setShowChangePwd] = useState(false);
    const [showConnectExt, setShowConnectExt] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const isMobile = useIsMobile();

    const wdk = useWDK();
    const extBCH = useExternalBCHWallet();

    // Keep module-level _activeNetwork in sync so pushNotification() writes to the right key
    useEffect(() => { setNotifNetwork(wdk.bchNetwork); }, [wdk.bchNetwork]);

    // Honour the requested tab whenever the popup is opened from the navbar.
    useEffect(() => {
        if (open && initialTab) setTopTab(initialTab);
    }, [open, initialTab]);

    // A child modal (change-password / settings) portals outside the panel, so
    // suspend the popup's own close handlers while one is open.
    const childModalOpen = showChangePwd || showConnectExt;

    // True while a Radix dialog (Send / Receive / token selector …) is open —
    // those portal to <body>, so the popup must not treat clicks in them as
    // "outside" and close itself.
    const radixDialogOpen = () => !!document.querySelector('[role="dialog"][data-state="open"]');

    // Close on outside click
    useEffect(() => {
        if (!open || childModalOpen) return;
        const handler = (e: MouseEvent) => {
            if (radixDialogOpen()) return;
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        // Delay to avoid click-through from the trigger button
        const timer = setTimeout(() => document.addEventListener('mousedown', handler), 100);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handler);
        };
    }, [open, onClose, childModalOpen]);

    // Close on Escape
    useEffect(() => {
        if (!open || childModalOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !radixDialogOpen()) onClose();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [open, onClose, childModalOpen]);

    // Calculate total portfolio value using shared hook to ensure UI consistency.
    // While open, balances poll every 5s in the background (stale-while-revalidate);
    // while closed, polling stops but the cache keeps the last-known values warm.
    const { tokens: activeTokens, totalValue: portfolioValue, loading: portfolioLoading, isRefetching: portfolioRefetching, refetch: refetchPortfolio } = usePortfolio({ pollingMs: open ? 5000 : 0 });

    // Refresh immediately when popup opens
    useEffect(() => {
        if (open) refetchPortfolio();
    }, [open, refetchPortfolio]);

    const handleGlobalRefresh = () => {
        refetchPortfolio();
    };

    const handleLogout = () => {
        if (wdk.isInitialized) wdk.disconnect();
        toast.success('Main wallet disconnected');
        onClose();
    };

    // Get shortened address for display — WDK EVM is the canonical primary handle
    const getDisplayAddress = (): string => {
        const addr = wdk.evmAddress || wdk.solanaAddress || wdk.bchAddress;
        if (!addr) return '';
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    if (!open) return null;

    const content = (
        <>
            {/* ─── Top Tab Bar ─── */}
            <div className="flex items-center justify-between px-1 pt-1 pb-0 border-b border-white/[0.06] shrink-0">
                <div className="flex">
                    <button
                        onClick={() => setTopTab('wallet')}
                        className={cn(
                            "flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium rounded-t-lg transition-colors",
                            topTab === 'wallet'
                                ? "text-primary bg-white/[0.04] border-b-2 border-primary"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <Wallet className="h-3.5 w-3.5" />
                        Wallet
                    </button>
                    <button
                        onClick={() => setTopTab('notifications')}
                        className={cn(
                            "flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium rounded-t-lg transition-colors",
                            topTab === 'notifications'
                                ? "text-primary bg-white/[0.04] border-b-2 border-primary"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <Bell className="h-3.5 w-3.5" />
                        Notifications
                    </button>
                </div>
                <div className="flex items-center gap-1 pr-2">
                    {wdk.isInitialized && (
                        <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10"
                            onClick={() => setShowConnectExt(true)}
                            title="Connect external BCH wallet"
                        >
                            <Plus className="h-3.5 w-3.5" />
                        </Button>
                    )}
                    {wdk.isInitialized && hasStoredWallet() && (
                        <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10"
                            onClick={() => { setTopTab('wallet'); setSubTab('addresses'); }}
                            title="Addresses & Keys"
                        >
                            <KeyRound className="h-3.5 w-3.5" />
                        </Button>
                    )}
                    <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                        onClick={handleLogout}
                        title="Disconnect all wallets"
                    >
                        <LogOut className="h-3.5 w-3.5" />
                    </Button>
                    {!isMobile && (
                        <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={onClose}
                        >
                            <X className="h-3.5 w-3.5" />
                        </Button>
                    )}
                </div>
            </div>

            {topTab === 'wallet' ? (
                <div className="flex flex-col flex-1 min-h-0">
                    {/* ─── Portfolio Value ─── */}
                    <div className="px-4 py-4 border-b border-white/[0.06] shrink-0">
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                                    Total Portfolio Value
                                </span>
                                <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground"
                                    onClick={handleGlobalRefresh} disabled={portfolioLoading || portfolioRefetching}>
                                    <RefreshCw className={cn("h-3 w-3", (portfolioLoading || portfolioRefetching) && "animate-spin")} />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground"
                                    onClick={() => setBalanceVisible(v => !v)}>
                                    {balanceVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                                </Button>
                            </div>
                            {getDisplayAddress() && (
                                <span className="text-[9px] font-mono text-muted-foreground/60 bg-white/[0.03] px-2 py-0.5 rounded-md">
                                    {getDisplayAddress()}
                                </span>
                            )}
                        </div>
                        {/* Amount row + network toggle */}
                        <div className="flex items-center justify-between gap-3 mt-1">
                            <div className="text-2xl font-bold tracking-tight">
                                {!balanceVisible
                                    ? '••••••'
                                    : portfolioLoading
                                        ? <span className="inline-block h-7 w-28 rounded-md bg-white/[0.06] animate-pulse align-middle" />
                                        : `$${portfolioValue.toFixed(2)}`
                                }
                            </div>
                            {/* Network segmented toggle */}
                            <div
                                role="tablist"
                                aria-label="Network"
                                className="relative flex h-7 items-center rounded-lg p-0.5 bg-white/[0.04] border border-white/[0.08] shrink-0"
                            >
                                <span
                                    aria-hidden
                                    className={cn(
                                        "absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-md",
                                        "transition-[left] duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)]",
                                        wdk.bchNetwork === 'mainnet'
                                            ? "left-[calc(50%+1px)] bg-white/[0.1] border border-white/[0.12]"
                                            : "left-0.5 bg-white/[0.08] border border-white/[0.1]"
                                    )}
                                />
                                <button
                                    role="tab"
                                    aria-selected={wdk.bchNetwork !== 'mainnet'}
                                    onClick={() => wdk.setBchNetwork('chipnet')}
                                    className={cn(
                                        "relative z-10 px-2.5 h-6 rounded-md text-[10px] font-semibold transition-colors duration-200",
                                        wdk.bchNetwork !== 'mainnet' ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                                    )}
                                >
                                    Testnet
                                </button>
                                <button
                                    role="tab"
                                    aria-selected={wdk.bchNetwork === 'mainnet'}
                                    onClick={() => wdk.setBchNetwork('mainnet')}
                                    className={cn(
                                        "relative z-10 px-2.5 h-6 rounded-md text-[10px] font-semibold transition-colors duration-200 flex items-center gap-1",
                                        wdk.bchNetwork === 'mainnet' ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                                    )}
                                >
                                    {wdk.bchNetwork === 'mainnet' && (
                                        <span className="relative flex h-1.5 w-1.5">
                                            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70" />
                                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                        </span>
                                    )}
                                    Mainnet
                                </button>
                            </div>
                        </div>
                    </div>


                    {/* ─── Sub Tabs ─── */}
                    <div className="flex border-b border-white/[0.06] shrink-0">
                        {(['tokens', 'orders', 'history', 'addresses'] as SubTab[]).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setSubTab(tab)}
                                className={cn(
                                    "flex-1 py-2 text-[11px] font-medium capitalize transition-colors relative",
                                    subTab === tab
                                        ? "text-primary"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {tab}
                                {subTab === tab && (
                                    <span className="absolute bottom-0 left-1/4 w-1/2 h-[2px] bg-primary rounded-full" />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* ─── Tab Content ─── */}
                    <div className="flex-1 overflow-y-auto px-3 pb-6 min-h-0" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
                        {subTab === 'tokens' && <WalletTokensTab balanceVisible={balanceVisible} activeTokens={activeTokens} loading={portfolioLoading} onClose={onClose} onConnectExternal={() => setShowConnectExt(true)} />}
                        {subTab === 'orders' && <WalletOrdersTab />}
                        {subTab === 'history' && <WalletHistoryTab />}
                        {subTab === 'addresses' && <WalletAddressesTab onChangePassword={() => setShowChangePwd(true)} onConnectExternal={() => setShowConnectExt(true)} />}
                    </div>
                </div>
            ) : (
                /* ─── Notifications Tab ─── */
                <NotificationsPanel />
            )}

            <ChangePasswordModal open={showChangePwd} onClose={() => setShowChangePwd(false)} />
            <ConnectExternalWalletModal open={showConnectExt} onClose={() => setShowConnectExt(false)} />
        </>
    );

    if (isMobile) {
        return (
            <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
                <DrawerContent className="p-0 h-[88vh]">
                    <DrawerTitle className="sr-only">Wallet</DrawerTitle>
                    <DrawerDescription className="sr-only">Your wallet balances, orders and history</DrawerDescription>
                    <div className="flex flex-col flex-1 min-h-0 bg-[#0A0A0A] pb-[env(safe-area-inset-bottom)]">
                        {content}
                    </div>
                </DrawerContent>
            </Drawer>
        );
    }

    return (
        <div
            ref={panelRef}
            className={cn(
                "fixed top-[80px] right-16 z-[100] w-[380px]",
                "h-[calc(100vh-96px)]",
                "bg-[#0A0A0A]/95 backdrop-blur-2xl rounded-2xl border border-white/[0.08]",
                "shadow-2xl shadow-black/50 flex flex-col",
                "animate-in slide-in-from-top-2 fade-in duration-200"
            )}
        >
            {content}
        </div>
    );
}
