import { WalletPopup } from './WalletPopup';
import { OrdersPopup } from '@/components/bch-swap/OrdersPopup';
import { OrderDetailsDialog } from '@/components/orders/OrderDetailsDialog';

/**
 * The app's wallet surfaces, mounted once by App: the wallet frame, the Orders &
 * History board and the order details card. Open them through lib/walletUi.ts.
 */
export function WalletUiRoot() {
    return (
        <>
            <WalletPopup />
            <OrdersPopup />
            <OrderDetailsDialog />
        </>
    );
}
