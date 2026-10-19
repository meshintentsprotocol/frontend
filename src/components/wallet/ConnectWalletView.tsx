/**
 * ConnectWalletView — the unified entry point for connecting wallets.
 *
 * Flow:
 * 1. ConnectStart: Cham Wallet built-in, Cham extension, "Connect another wallet"
 * 2. ChainPicker: Bitcoin Cash (available), EVM / Solana / Bitcoin ("Coming soon")
 * 3. PairingQr: BCH protocol selection (WizardConnect / WalletConnect), QR code, selectable URI
 * 4. ConnectedCard: Newly connected wallet details, active indicator, look editor, and Done
 *
 * Phase 2: The connect screen redesign
 */

import { useState, useCallback } from 'react';
import { useExternalBCHWallet } from '@/context/ExternalBCHWalletProvider';
import { useConnectFlow } from './connect/useConnectFlow';
import { ConnectStart } from './connect/ConnectStart';
import { ChainPicker } from './connect/ChainPicker';
import { PairingQr } from './connect/PairingQr';
import { ConnectedCard } from './connect/ConnectedCard';
import { ExternalWallet } from '@/lib/wallets/types';
import { notifyToast as toast } from '@/lib/notify-toast';

export function ConnectWalletView({ onDone }: {
    /** The user is finished here: go to the wallet. */
    onDone: () => void;
}) {
    const ext = useExternalBCHWallet();
    const flow = useConnectFlow();

    const [isConnectingExtension, setIsConnectingExtension] = useState(false);
    const [extensionWallet, setExtensionWallet] = useState<ExternalWallet | null>(null);

    const handleConnectExtension = useCallback(async () => {
        setIsConnectingExtension(true);
        try {
            await ext.connectExtension();
            const found = ext.allWallets.find(w => w.source === 'extension');
            if (found) {
                setExtensionWallet(found);
            }
            toast.success('Cham Wallet extension connected!');
        } catch (e: any) {
            const msg =
                e?.code === 'NOT_INSTALLED'
                    ? 'Cham Wallet extension is not installed.'
                    : e?.code === 4001
                    ? 'Connection declined in extension.'
                    : e?.message || 'Could not connect extension';
            toast.error(msg);
        } finally {
            setIsConnectingExtension(false);
        }
    }, [ext]);

    // If extension just connected, show ConnectedCard
    if (extensionWallet) {
        return (
            <ConnectedCard
                wallet={extensionWallet}
                onDone={() => {
                    setExtensionWallet(null);
                    onDone();
                }}
            />
        );
    }

    // Step 4: External wallet connected via QR
    if (flow.step === 'connected' && flow.connectedWallet) {
        return (
            <ConnectedCard
                wallet={flow.connectedWallet}
                onDone={() => {
                    flow.reset();
                    onDone();
                }}
            />
        );
    }

    // Step 3: QR pairing (BCH)
    if (flow.step === 'qr') {
        return (
            <PairingQr
                protocol={flow.selectedProtocol}
                qrValue={flow.qrValue}
                linkText={flow.linkText}
                expiresAt={flow.expiresAt}
                isLoading={flow.isLoading}
                error={flow.error}
                onSelectProtocol={flow.selectProtocol}
                onRetry={flow.retryPairing}
                onBack={flow.goToChain}
            />
        );
    }

    // Step 2: Chain picker
    if (flow.step === 'chain') {
        return (
            <ChainPicker
                onBack={flow.goToPick}
                onPickChain={flow.pickChain}
            />
        );
    }

    // Step 1: Start view (pick wallet / connect another)
    return (
        <ConnectStart
            canAdd={flow.canAdd}
            onConnectAnother={flow.goToChain}
            onConnectExtension={handleConnectExtension}
            isConnectingExtension={isConnectingExtension}
        />
    );
}
