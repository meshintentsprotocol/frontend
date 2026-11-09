import { useState, useEffect, useRef } from 'react';
import { BCHSwapCard } from '@/components/bch-swap/BCHSwapCard';
import { OrdersHub } from '@/components/orders/OrdersHub';
import type { OrderFilter } from '@/components/orders/model';
import { BCHOrderType } from '@/types';
import { useBCHSwapOptional } from '@/context/BCHSwapContext';
import { useLocation } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAppSettings } from '@/lib/appSettings';
import { walletUi } from '@/lib/walletUi';
import { useSwapServerOptional } from '@/swap-server/context';

// ============================================================================
// BCH Swap Page — /bchswap, /trade, /twap
// ============================================================================
// Unified page for BCH same-chain, cross-chain, limit orders, and TWAP execution.
//
// Orders & History is a popup by default (the card's history icon, or the header's).
// With the "Dock orders beside the swap" setting on, and room for it, the board sits
// next to the card instead and follows the card's Swap / Limit / TWAP tab.

const KIND_OF: Record<BCHOrderType, OrderFilter> = { market: 'swap', limit: 'limit', twap: 'twap' };

export default function BchSwapPage() {
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const initialTypeParam = queryParams.get('type') || queryParams.get('mode');
    const initialOrderType: BCHOrderType = initialTypeParam === 'limit'
        ? 'limit'
        : initialTypeParam === 'twap' || location.pathname === '/twap'
        ? 'twap'
        : 'market';

    const [orderType, setOrderType] = useState<BCHOrderType>(initialOrderType);
    const isMobile = useIsMobile();
    const docking = useAppSettings().dockOrders && !isMobile;

    // Ensure orderType updates if URL param changes after initial mount
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const typeParam = params.get('type') || params.get('mode');
        if (typeParam === 'limit') setOrderType('limit');
        else if (typeParam === 'twap' || location.pathname === '/twap') setOrderType('twap');
        else setOrderType('market');
    }, [location.search, location.pathname]);

    // The docked board can be folded away; it comes back when docking is switched on.
    const [showDock, setShowDock] = useState(true);
    useEffect(() => { if (docking) setShowDock(true); }, [docking]);

    const swapCtx = useBCHSwapOptional();
    const swapServer = useSwapServerOptional();
    const swapCardRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // A new order shows itself: its step card pops up, and a docked board unfolds.
    const pending = swapCtx?.pendingOrders;
    const known = useRef<Set<string> | null>(null);
    useEffect(() => {
        if (!pending) return;
        const ids = new Set(pending.map(o => o.id));
        const fresh = known.current ? pending.find(o => !known.current!.has(o.id) && Date.now() - o.createdAt < 60_000) : undefined;
        known.current = ids;
        if (!fresh) return;
        // The order's own card is opened by BCHSwapCard (so it works on the token page too); the page just unfolds the dock.
        setShowDock(true);
    }, [pending]);

    // The pair on the card is one of the swap server's: the board shows bridges.
    const filter: OrderFilter = swapServer?.pairRouted ? (swapServer.isMainnet ? 'swap' : 'bridge') : KIND_OF[orderType];

    // Sync swap card height to CSS variable for the docked board
    useEffect(() => {
        const el = swapCardRef.current;
        if (!el) return;
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                containerRef.current?.style.setProperty('--swap-card-height', `${entry.contentRect.height}px`);
            }
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const panelVisible = docking && showDock;

    return (
        <div className="container mx-auto py-4 sm:py-10 px-0 sm:px-4 md:px-8">
            <div className="flex justify-center max-w-[1200px] mx-auto w-full transition-all duration-300">
                <div
                    ref={containerRef}
                    className={`flex w-full gap-8 transition-all duration-500 justify-center
                    ${panelVisible ? 'lg:justify-start lg:gap-8 flex-col lg:flex-row' : 'max-w-[460px]'}`}
                >
                    {/* Swap Card */}
                    <div ref={swapCardRef} className="w-full lg:w-[460px] shrink-0 transform transition-transform duration-300">
                        <BCHSwapCard
                            orderType={orderType}
                            onOrderTypeChange={setOrderType}
                            ordersVisible={panelVisible}
                            onToggleOrders={() => (docking ? setShowDock(v => !v) : walletUi.openOrders(filter))}
                        />
                    </div>

                    {/* Orders & History, docked: like the wallet — from its top down to a bottom margin, with a glow. */}
                    {panelVisible && (
                        <div className="relative mt-4 w-full min-w-0 lg:mt-0 lg:flex-1 h-[clamp(460px,74vh,900px)] lg:sticky lg:top-24 lg:h-[calc(100dvh-10rem)] animate-in fade-in slide-in-from-right-10 zoom-in-95 duration-500 ease-out fill-mode-both delay-100">
                            <OrdersHub filter={filter} className="h-full" />
                            {/* Where it ends: a thin line of light along the bottom edge, as on the wallet. */}
                            <div aria-hidden className="pointer-events-none absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-400/80 to-transparent shadow-[0_0_22px_3px_rgba(16,185,129,0.5)]" />
                            <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-16 rounded-b-xl bg-gradient-to-t from-emerald-500/[0.09] to-transparent" />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
