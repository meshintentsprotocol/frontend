import { useCallback } from 'react';
import { useActiveWallet } from './useActiveWallet';
import { useBCHWallet } from '@/context/BCHWalletProvider';
import { useExternalBCHWallet, type WC2SignPayload, type WC2SignResult } from '@/context/ExternalBCHWalletProvider';
import { useWDK } from '@/context/WDKProvider';

export function useActiveSigner() {
    const { activeWalletId, isMainActive, activeExtWallet } = useActiveWallet();
    const wdk = useWDK();
    const mainWallet = useBCHWallet();
    const extWallet = useExternalBCHWallet();

    /**
     * Signs a raw hex transaction using the currently active wallet.
     * - Main wallet: uses WIF locally via getWIF() (caller must handle CashScript signing)
     * - External wallet: sends full WC2 payload to Cashonize via bch_signTransaction
     */
    const signTransaction = useCallback(async (payload: WC2SignPayload): Promise<WC2SignResult> => {
        if (isMainActive) {
            throw new Error(
                'For main WDK wallet, use getWIF() and CashScript SignatureTemplate directly. ' +
                'signTransaction() is for external wallets (WalletConnect / WizardConnect).'
            );
        }

        if (activeExtWallet) {
            return extWallet.signTransaction(activeExtWallet.id, payload);
        }

        throw new Error('No active wallet found to sign transaction.');
    }, [isMainActive, activeExtWallet, extWallet, activeWalletId]);

    return {
        /** Sign via external wallet — only valid when !isMainActive */
        signTransaction,
        isMainActive,
        activeExtWallet,
        /** Returns WIF for main wallet (null for external wallets) */
        getWIF: () => isMainActive ? mainWallet.getWIF() : null,
    };
}
