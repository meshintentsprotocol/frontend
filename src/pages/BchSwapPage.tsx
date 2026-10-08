import { useState, useEffect, useRef } from 'react';
import { BCHSwapCard } from '@/components/bch-swap/BCHSwapCard';
import { LimitOrderHistory } from '@/components/bch-swap/LimitOrderHistory';
import { TWAPOrderHistory } from '@/components/bch-swap/TWAPOrderHistory';
import { BCHOrderType } from '@/types';
import { useBCHSwapOptional } from '@/context/BCHSwapContext';
import { useLocation } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { useSwapServerOptional } from '@/swap-server/context';
import { TradeHistorySlot } from '@/swap-server/SwapServerHistory';

// ============================================================================
// BCH Swap Page — /bchswap, /trade, /twap
// ============================================================================
// Unified page for BCH same-chain, cross-chain, limit orders, and TWAP execution.
// Expands to a two-column layout when 'limit' or 'twap' mode is selected.

export default function BchSwapPage() {
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const initialTypeParam = queryParams.get('type');
    const initialOrderType: BCHOrderType = initialTypeParam === 'limit'
        ? 'limit'
        : initialTypeParam === 'twap' || location.pathname === '/twap'
        ? 'twap'
        : 'market';

    const [orderType, setOrderType] = useState<BCHOrderType>(initialOrderType);
    const isMobile = useIsMobile();

    // Ensure orderType updates if URL param changes after initial mount
    useEffect(() => {
        const typeParam = new URLSearchParams(location.search).get('type');
        if (typeParam === 'limit') setOrderType('limit');
        else if (typeParam === 'twap' || location.pathname === '/twap') setOrderType('twap');
        else setOrderType('market');
    }, [location.search, location.pathname]);

    const [showOrders, setShowOrders] = useState(false);

    // Limit and TWAP modes need the History & Progress panel — show it by default
    useEffect(() => {
        if (orderType === 'limit' || orderType === 'twap') setShowOrders(true);
    }, [orderType]);

    const swapCtx = useBCHSwapOptional();
    const prevPendingCount = useRef<number | null>(null);
    const swapCardRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Show orders panel when a new order is created
    useEffect(() => {
        const currentCount = (swapCtx?.pendingOrders?.length || 0) + (swapCtx?.completedOrders?.length || 0);
        if (prevPendingCount.current === null) {
            prevPendingCount.current = currentCount;
            return;
        }
        if (currentCount > prevPendingCount.current) {
            setShowOrders(true);
        }
        prevPendingCount.current = currentCount;
    }, [swapCtx?.pendingOrders?.length, swapCtx?.completedOrders?.length]);

    // A transfer through the swap server opens the panel the way a new order does. Not on mobile, where the
    // panel is a sheet and the transfer's own dialog is already on screen.
    const swapServer = useSwapServerOptional();
    const signing = !!swapServer?.operation?.busy;
    // Also when the page loads while one is on its way, so a reload does not hide it.
    const moving = (swapServer?.activeCount ?? 0) > 0;
    useEffect(() => { if ((signing || moving) && !isMobile) setShowOrders(true); }, [signing, moving, isMobile]);

    // Sync swap card height to CSS variable for orders panel
    useEffect(() => {
        const el = swapCardRef.current;
        if (!el) return;
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const h = entry.contentRect.height;
                if (containerRef.current) {
                    containerRef.current.style.setProperty('--swap-card-height', `${h}px`);
                }
            }
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const panelVisible = showOrders;

    return (
        <div className="container mx-auto py-4 sm:py-10 px-0 sm:px-4 md:px-8">
            <div className="flex justify-center max-w-[1200px] mx-auto w-full transition-all duration-300">
                <div
                    ref={containerRef}
                    className={`flex w-full gap-8 transition-all duration-500 justify-center
                    ${panelVisible && !isMobile ? 'lg:justify-start lg:gap-8 flex-col lg:flex-row' : 'max-w-[460px]'}`}
                >
                    {/* Swap Card */}
                    <div ref={swapCardRef} className="w-full lg:w-[460px] shrink-0 transform transition-transform duration-300">
                        <BCHSwapCard
                            orderType={orderType}
                            onOrderTypeChange={setOrderType}
                            ordersVisible={panelVisible}
                            onToggleOrders={() => setShowOrders(v => !v)}
                        />
                    </div>

                    {/* Orders Panel — desktop only: slides + scales in */}
                    {panelVisible && !isMobile && (
                        <div className="w-full lg:flex-1 animate-in fade-in slide-in-from-right-10 zoom-in-95 duration-500 ease-out fill-mode-both delay-100">
                            <TradeHistorySlot>{orderType === 'twap' ? <TWAPOrderHistory /> : <LimitOrderHistory />}</TradeHistorySlot>
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile: history as slide-up bottom sheet */}
            {isMobile && (
                <Drawer open={panelVisible} onOpenChange={setShowOrders}>
                    <DrawerContent className="max-h-[85vh]">
                        <DrawerHeader>
                            <DrawerTitle className="text-white text-base">
                                {orderType === 'twap' ? 'TWAP Execution Queue' : 'Orders & History'}
                            </DrawerTitle>
                            <DrawerDescription className="sr-only">
                                {orderType === 'twap' ? 'View and manage your active TWAP orders' : 'View your order history and pending limit orders'}
                            </DrawerDescription>
                        </DrawerHeader>
                        <div className="overflow-y-auto px-4 pb-6">
                            <TradeHistorySlot>{orderType === 'twap' ? <TWAPOrderHistory /> : <LimitOrderHistory />}</TradeHistorySlot>
                        </div>
                    </DrawerContent>
                </Drawer>
            )}
        </div>
    );
}

