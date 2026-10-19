import { useExternalBCHWallet } from '@/context/ExternalBCHWalletProvider';
import { useWDK } from '@/context/WDKProvider';
import { MAIN_WALLET_ID, setActiveWalletId, useActiveWalletId } from '@/lib/walletStore';

/**
 * The active BCH wallet, shared by the whole app (see lib/walletStore.ts).
 * Plain read — reconciliation is handled centrally by ExternalBCHWalletProvider.
 *
 * Phase 0: Foundation
 */
export function useActiveWallet() {
    const wdk = useWDK();
    const extBCH = useExternalBCHWallet();
    const activeWalletId = useActiveWalletId('bch');

    const isMainActive = activeWalletId === MAIN_WALLET_ID && wdk.isInitialized;
    const activeExtWallet = activeWalletId
        ? extBCH.wallets.find(w => w.id === activeWalletId)
        : undefined;

    return {
        activeWalletId,
        setActiveWalletId: (id: string | null) => setActiveWalletId(id, 'bch'),
        /** Alias for setActiveWalletId — used in BCHSwapCard wallet picker */
        setActiveWallet: (id: string | null) => setActiveWalletId(id, 'bch'),
        isMainActive,
        activeExtWallet,
    };
}
