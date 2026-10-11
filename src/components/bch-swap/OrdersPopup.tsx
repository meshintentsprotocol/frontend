import { useIsMobile } from '@/hooks/use-mobile';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer';
import { OrdersHub } from '@/components/orders/OrdersHub';
import { useWalletUi, walletUi } from '@/lib/walletUi';

// ============================================================================
// Orders Popup — the Orders & History board, opened from the header's history icon
// ============================================================================
// Dialog on desktop, bottom sheet on mobile. Both close on Escape, on a click
// outside, and from their own close affordance. The board itself is OrdersHub.

const DESCRIPTION = 'Your open orders and order history: swaps, limit orders, TWAP and bridges';

export function OrdersPopup() {
    const ui = useWalletUi();
    const isMobile = useIsMobile();
    const onClose = walletUi.closeOrders;

    if (isMobile) {
        return (
            <Drawer open={ui.orders} onOpenChange={o => !o && onClose()}>
                <DrawerContent className="lg-panel h-[88dvh] border-b-0 p-0">
                    <DrawerTitle className="px-4 pb-1 text-base text-white">Orders & History</DrawerTitle>
                    <DrawerDescription className="sr-only">{DESCRIPTION}</DrawerDescription>
                    {ui.orders && <OrdersHub variant="embedded" filter={ui.ordersFilter} className="pb-[env(safe-area-inset-bottom)]" />}
                </DrawerContent>
            </Drawer>
        );
    }

    return (
        <Dialog open={ui.orders} onOpenChange={o => !o && onClose()}>
            <DialogContent className="lg-panel flex h-[min(680px,calc(100dvh-96px))] max-w-[760px] flex-col gap-0 overflow-hidden rounded-[28px] bg-transparent p-0 sm:rounded-[28px]" data-orders-popup>
                {/* pr-12 keeps the title clear of the dialog's close button */}
                <div className="flex h-12 shrink-0 items-center pl-5 pr-12">
                    <DialogTitle className="text-sm font-semibold text-white">Orders & History</DialogTitle>
                    <DialogDescription className="sr-only">{DESCRIPTION}</DialogDescription>
                </div>
                {ui.orders && <OrdersHub variant="embedded" filter={ui.ordersFilter} />}
            </DialogContent>
        </Dialog>
    );
}
