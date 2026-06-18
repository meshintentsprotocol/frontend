import { useState, useEffect, useRef } from 'react';
import { BCHSwapCard } from '@/components/bch-swap/BCHSwapCard';
import { LimitOrderHistory } from '@/components/bch-swap/LimitOrderHistory';
import { BCHOrderType } from '@/types';
import { useBCHSwapOptional } from '@/context/BCHSwapContext';
import { useLocation } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';

// ============================================================================
// BCH Swap Page — /bchswap
// ============================================================================
// Unified page for BCH same-chain (CashToken) and cross-chain (BCH↔Solana) swaps.
// Layout mirrors the existing SwapPage pattern when 'market' is selected.
// Expands to a two-column layout when 'limit' orders are selected or after a swap.

export default function BchSwapPage() {
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const initialOrderType = queryParams.get('type') === 'limit' ? 'limit' : 'market';

    const [orderType, setOrderType] = useState<BCHOrderType>(initialOrderType);
    const isMobile = useIsMobile();

    // Ensure orderType updates if URL param changes after initial mount
    useEffect(() => {
        const typeParam = new URLSearchParams(location.search).get('type');
        setOrderType(typeParam === 'limit' ? 'limit' : 'market');
    }, [location.search]);

    const [showOrders, setShowOrders] = useState(false);

    // Limit mode needs the Open & Orders panel — show it by default there.
    useEffect(() => {
        if (orderType === 'limit') setShowOrders(true);
    }, [orderType]);
    const swapCtx = useBCHSwapOptional();
    const prevPendingCount = useRef<number | null>(null); // null = not yet initialized
    const swapCardRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Show orders panel ONLY when a NEW order is created (not from existing localStorage)
    useEffect(() => {
        const currentCount = (swapCtx?.pendingOrders?.length || 0) + (swapCtx?.completedOrders?.length || 0);
        if (prevPendingCount.current === null) {
            // First render — capture existing count, don't show panel
            prevPendingCount.current = currentCount;
            return;
        }
        if (currentCount > prevPendingCount.current) {
            setShowOrders(true);
        }
        prevPendingCount.current = currentCount;
    }, [swapCtx?.pendingOrders?.length, swapCtx?.completedOrders?.length]);

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

                    {/* Orders Panel — desktop only: slides + scales in after swap or when limit mode is active */}
                    {panelVisible && !isMobile && (
                        <div className="w-full lg:flex-1 animate-in fade-in slide-in-from-right-10 zoom-in-95 duration-500 ease-out fill-mode-both delay-100">
                            <LimitOrderHistory />
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile: history as slide-up bottom sheet */}
            {isMobile && (
                <Drawer open={panelVisible} onOpenChange={setShowOrders}>
                    <DrawerContent className="max-h-[85vh]">
                        <DrawerHeader>
                            <DrawerTitle className="text-white text-base">Orders & History</DrawerTitle>
                        </DrawerHeader>
                        <div className="overflow-y-auto px-4 pb-6">
                            <LimitOrderHistory />
                        </div>
                    </DrawerContent>
                </Drawer>
            )}
        </div>
    );
}

