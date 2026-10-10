import { useEffect } from 'react';
import { useExternalBCHWallet } from '@/context/ExternalBCHWalletProvider';
import { useWDK } from '@/context/WDKProvider';
import { MAIN_WALLET_ID, setActiveWalletId, useActiveWalletId } from '@/lib/walletStore';

/**
 * The active BCH wallet, shared by the whole app (see lib/walletStore.ts).
 * Every caller gets the same value, and a switch made in one place reaches all.
 */
export function useActiveWallet() {
    const wdk = useWDK();
    const extBCH = useExternalBCHWallet();
    const activeWalletId = useActiveWalletId();

    // Auto-fallback logic:
    // If 'main' is locked and there are external wallets, switch to the first external wallet
    useEffect(() => {
        if (!wdk.isInitialized && activeWalletId === MAIN_WALLET_ID && extBCH.wallets.length > 0) {
            setActiveWalletId(extBCH.wallets[0].id);
        }

        // If an external wallet was selected but no longer exists (e.g. disconnected), fallback to 'main'
        if (activeWalletId !== MAIN_WALLET_ID && !extBCH.wallets.find(w => w.id === activeWalletId)) {
            setActiveWalletId(MAIN_WALLET_ID);
        }
    }, [wdk.isInitialized, activeWalletId, extBCH.wallets]);

    // Active connection check for UI safety
    const isMainActive = activeWalletId === MAIN_WALLET_ID;
    const activeExtWallet = extBCH.wallets.find(w => w.id === activeWalletId);

    // Safely fallback if the state is temporarily mismatched
    const safeActiveId = (isMainActive || activeExtWallet) ? activeWalletId : MAIN_WALLET_ID;

    return {
        activeWalletId: safeActiveId,
        setActiveWalletId,
        /** Alias for setActiveWalletId — used in BCHSwapCard wallet picker */
        setActiveWallet: setActiveWalletId,
        isMainActive: safeActiveId === MAIN_WALLET_ID,
        activeExtWallet
    };
}
