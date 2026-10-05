import { useState } from 'react';
import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { LimitOrderHistory } from './LimitOrderHistory';
import { TWAPOrderHistory } from './TWAPOrderHistory';

// ============================================================================
// Orders Popup — the swap page's orders & history panels, opened from the navbar
// ============================================================================
// Dialog on desktop, bottom sheet on mobile. Both close on Escape, on a click
// outside, and from their own close affordance.

type OrdersKind = 'swap' | 'twap';

const KINDS: { value: OrdersKind; label: string }[] = [
    { value: 'swap', label: 'Swaps & limits' },
    { value: 'twap', label: 'TWAP' },
];

const DESCRIPTION = 'Your open orders and order history';

interface OrdersPopupProps {
    open: boolean;
    onClose: () => void;
}

export function OrdersPopup({ open, onClose }: OrdersPopupProps) {
    const [kind, setKind] = useState<OrdersKind>('swap');
    const isMobile = useIsMobile();

    const kindToggle = (
        <div role="tablist" aria-label="Order type" className="flex items-center gap-0.5 p-0.5 rounded-lg bg-white/[0.04] border border-white/[0.08]">
            {KINDS.map(k => (
                <button
                    key={k.value}
                    type="button"
                    role="tab"
                    aria-selected={kind === k.value}
                    onClick={() => setKind(k.value)}
                    className={cn(
                        'h-7 px-3 rounded-md text-[11px] font-semibold transition-colors',
                        kind === k.value ? 'bg-white/[0.1] text-white' : 'text-zinc-500 hover:text-zinc-300',
                    )}
                >
                    {k.label}
                </button>
            ))}
        </div>
    );

    const panel = kind === 'twap' ? <TWAPOrderHistory /> : <LimitOrderHistory />;

    if (isMobile) {
        return (
            <Drawer open={open} onOpenChange={o => !o && onClose()}>
                <DrawerContent className="max-h-[85vh]">
                    <DrawerHeader className="flex items-center justify-between gap-3">
                        <DrawerTitle className="text-white text-base">Orders & History</DrawerTitle>
                        <DrawerDescription className="sr-only">{DESCRIPTION}</DrawerDescription>
                        {kindToggle}
                    </DrawerHeader>
                    <div className="overflow-y-auto px-4 pb-6">{panel}</div>
                </DrawerContent>
            </Drawer>
        );
    }

    return (
        <Dialog open={open} onOpenChange={o => !o && onClose()}>
            <DialogContent className="max-w-[760px] gap-0 p-0 overflow-hidden bg-[#0A0A0A] border-white/[0.08] sm:rounded-3xl">
                {/* pr-12 keeps the header clear of the dialog's close button */}
                <div className="flex items-center justify-between gap-3 pl-5 pr-12 h-14 border-b border-white/[0.06]">
                    <DialogTitle className="text-sm font-semibold text-white">Orders & History</DialogTitle>
                    <DialogDescription className="sr-only">{DESCRIPTION}</DialogDescription>
                    {kindToggle}
                </div>
                {/* The limit panel sizes itself from --swap-card-height (set by the swap page) */}
                <div className="p-3" style={{ '--swap-card-height': 'min(600px, calc(100vh - 160px))' } as CSSProperties}>
                    {panel}
                </div>
            </DialogContent>
        </Dialog>
    );
}
