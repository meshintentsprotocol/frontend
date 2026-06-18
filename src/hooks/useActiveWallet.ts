import { useState, useEffect } from 'react';
import { useExternalBCHWallet } from '@/context/ExternalBCHWalletProvider';
import { useWDK } from '@/context/WDKProvider';

const STORAGE_KEY = 'active_bch_wallet_id';

export function useActiveWallet() {
    const wdk = useWDK();
    const extBCH = useExternalBCHWallet();

    // Default to 'main'
    const [activeWalletId, setActiveWalletIdState] = useState<string>(() => {
        try {
            return localStorage.getItem(STORAGE_KEY) || 'main';
        } catch {
            return 'main';
        }
    });

    // Update storage when state changes
    const setActiveWalletId = (id: string) => {
        try {
            localStorage.setItem(STORAGE_KEY, id);
        } catch {}
        setActiveWalletIdState(id);
    };

    // Auto-fallback logic:
    // If 'main' is locked and there are external wallets, switch to the first external wallet
    useEffect(() => {
        if (!wdk.isInitialized && activeWalletId === 'main' && extBCH.wallets.length > 0) {
            setActiveWalletId(extBCH.wallets[0].id);
        }
        
        // If an external wallet was selected but no longer exists (e.g. disconnected), fallback to 'main'
        if (activeWalletId !== 'main' && !extBCH.wallets.find(w => w.id === activeWalletId)) {
            setActiveWalletId('main');
        }
    }, [wdk.isInitialized, activeWalletId, extBCH.wallets]);

    // Active connection check for UI safety
    const isMainActive = activeWalletId === 'main';
    const activeExtWallet = extBCH.wallets.find(w => w.id === activeWalletId);
    
    // Safely fallback if the state is temporarily mismatched
    const safeActiveId = (isMainActive || activeExtWallet) ? activeWalletId : 'main';

    return {
        activeWalletId: safeActiveId,
        setActiveWalletId,
        /** Alias for setActiveWalletId — used in BCHSwapCard wallet picker */
        setActiveWallet: setActiveWalletId,
        isMainActive,
        activeExtWallet
    };
}
