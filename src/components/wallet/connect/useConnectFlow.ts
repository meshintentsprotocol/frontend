/**
 * useConnectFlow — State machine and pairing management for the multi-chain connect flow.
 *
 * Steps:
 * 1. 'pick'      - Start view: built-in Cham Wallet, extension, "Connect another wallet"
 * 2. 'chain'     - Chain picker (BCH -> step 3; EVM -> opens AppKit modal; Solana, Bitcoin -> "Coming soon")
 * 3. 'qr'        - BCH protocol selection (WizardConnect / WalletConnect) + QR + URI
 * 4. 'connected' - Connected card with name, icon, address, look editor, and Done
 *
 * Phase 2: The connect screen
 * Phase 6: EVM via AppKit
 */

import { useReducer, useCallback, useRef, useEffect } from 'react';
import { useExternalBCHWallet } from '@/context/ExternalBCHWalletProvider';
import { ChainFamily, ExternalWallet } from '@/lib/wallets/types';
import { openAppKitConnect, startAppKitBridge } from '@/lib/wallets/appkitBridge';
import { findWalletById } from '@/lib/wallets/registry';
import { useWDK } from '@/context/WDKProvider';
import { appNetworkOf } from '@/lib/wallets/types';

export type ConnectStep = 'pick' | 'chain' | 'qr' | 'connected';
export type BchProtocol = 'wizardconnect' | 'walletconnect';

export interface ConnectFlowState {
    step: ConnectStep;
    selectedFamily: ChainFamily;
    selectedProtocol: BchProtocol;
    qrValue: string | null;
    linkText: string | null;
    expiresAt?: number;
    connectedWallet: ExternalWallet | null;
    isLoading: boolean;
    error: string | null;
}

export type ConnectFlowAction =
    | { type: 'GO_TO_PICK' }
    | { type: 'GO_TO_CHAIN' }
    | { type: 'PICK_CHAIN'; family: ChainFamily }
    | { type: 'SELECT_PROTOCOL'; protocol: BchProtocol }
    | { type: 'PAIRING_START' }
    | { type: 'PAIRING_READY'; qrValue: string; linkText: string; expiresAt?: number }
    | { type: 'PAIRING_ERROR'; error: string }
    | { type: 'PAIRING_SUCCESS'; wallet: ExternalWallet }
    | { type: 'RESET' };

export const INITIAL_CONNECT_STATE: ConnectFlowState = {
    step: 'pick',
    selectedFamily: 'bch',
    selectedProtocol: 'wizardconnect',
    qrValue: null,
    linkText: null,
    expiresAt: undefined,
    connectedWallet: null,
    isLoading: false,
    error: null,
};

export function connectFlowReducer(state: ConnectFlowState, action: ConnectFlowAction): ConnectFlowState {
    switch (action.type) {
        case 'GO_TO_PICK':
            return {
                ...state,
                step: 'pick',
                error: null,
            };

        case 'GO_TO_CHAIN':
            return {
                ...state,
                step: 'chain',
                error: null,
            };

        case 'PICK_CHAIN':
            return {
                ...state,
                step: action.family === 'bch' ? 'qr' : 'chain',
                selectedFamily: action.family,
                selectedProtocol: 'wizardconnect',
                qrValue: null,
                linkText: null,
                expiresAt: undefined,
                error: null,
                isLoading: action.family === 'evm' || action.family === 'solana', // show spinner while AppKit loads
            };

        case 'SELECT_PROTOCOL':
            return {
                ...state,
                selectedProtocol: action.protocol,
                qrValue: null,
                linkText: null,
                expiresAt: undefined,
                error: null,
            };

        case 'PAIRING_START':
            return {
                ...state,
                isLoading: true,
                error: null,
            };

        case 'PAIRING_READY':
            return {
                ...state,
                isLoading: false,
                qrValue: action.qrValue,
                linkText: action.linkText,
                expiresAt: action.expiresAt,
                error: null,
            };

        case 'PAIRING_ERROR':
            return {
                ...state,
                isLoading: false,
                error: action.error,
            };

        case 'PAIRING_SUCCESS':
            return {
                ...state,
                step: 'connected',
                isLoading: false,
                connectedWallet: action.wallet,
                error: null,
            };

        case 'RESET':
            return {
                ...INITIAL_CONNECT_STATE,
            };

        default:
            return state;
    }
}

export interface UseConnectFlowReturn extends ConnectFlowState {
    canAdd: boolean;
    goToPick: () => void;
    goToChain: () => void;
    pickChain: (family: ChainFamily) => void;
    selectProtocol: (protocol: BchProtocol) => void;
    retryPairing: () => void;
    reset: () => void;
}

export function useConnectFlow(): UseConnectFlowReturn {
    const { canAddExternalWallet, startBchPairing } = useExternalBCHWallet();
    const { bchNetwork } = useWDK();
    const [state, dispatch] = useReducer(connectFlowReducer, INITIAL_CONNECT_STATE);

    const attemptRef = useRef<number>(0);
    const cancelActivePairingRef = useRef<(() => void) | null>(null);

    const canAdd = canAddExternalWallet();

    const cancelCurrent = useCallback(() => {
        if (cancelActivePairingRef.current) {
            try {
                cancelActivePairingRef.current();
            } catch { /* ignore */ }
            cancelActivePairingRef.current = null;
        }
    }, []);

    const startPairingForProtocol = useCallback(async (protocol: BchProtocol) => {
        cancelCurrent();
        const currentAttempt = ++attemptRef.current;

        dispatch({ type: 'PAIRING_START' });

        try {
            const handle = await startBchPairing(protocol);

            if (currentAttempt !== attemptRef.current) {
                handle.cancel();
                return;
            }

            cancelActivePairingRef.current = handle.cancel;
            dispatch({
                type: 'PAIRING_READY',
                qrValue: handle.qrValue,
                linkText: handle.linkText,
                expiresAt: handle.expiresAt,
            });

            handle.ready
                .then((wallet) => {
                    if (currentAttempt === attemptRef.current) {
                        dispatch({ type: 'PAIRING_SUCCESS', wallet });
                        cancelActivePairingRef.current = null;
                    }
                })
                .catch((err) => {
                    if (currentAttempt === attemptRef.current) {
                        const msg = err instanceof Error ? err.message : String(err || '');
                        if (!msg.toLowerCase().includes('cancelled')) {
                            dispatch({ type: 'PAIRING_ERROR', error: msg || 'Pairing failed' });
                        }
                    }
                });
        } catch (err) {
            if (currentAttempt === attemptRef.current) {
                const msg = err instanceof Error ? err.message : String(err || '');
                dispatch({ type: 'PAIRING_ERROR', error: msg || 'Could not start pairing' });
            }
        }
    }, [cancelCurrent, startBchPairing]);

    /** Open AppKit for EVM connection (Phase 6) */
    const startAppKitEvm = useCallback(async () => {
        const currentAttempt = ++attemptRef.current;
        const network = appNetworkOf(bchNetwork);

        try {
            // Ensure the bridge is running
            await startAppKitBridge(network);

            // Open AppKit's connect modal for EVM
            await openAppKitConnect('eip155');

            // After modal closes, check if we got a wallet
            if (currentAttempt !== attemptRef.current) return;

            // Look for the AppKit wallet in the registry
            const appkitWallet = findWalletById('appkit-evm');
            if (appkitWallet) {
                dispatch({ type: 'PAIRING_SUCCESS', wallet: appkitWallet });
            } else {
                // Modal closed without connecting
                dispatch({ type: 'GO_TO_CHAIN' });
            }
        } catch (err) {
            if (currentAttempt === attemptRef.current) {
                const msg = err instanceof Error ? err.message : String(err || '');
                dispatch({ type: 'PAIRING_ERROR', error: msg || 'Could not open wallet selector' });
            }
        }
    }, [bchNetwork]);

    /** Open AppKit for Solana connection (Phase 7) */
    const startAppKitSolana = useCallback(async () => {
        const currentAttempt = ++attemptRef.current;
        const network = appNetworkOf(bchNetwork);

        try {
            // Ensure the bridge is running
            await startAppKitBridge(network);

            // Open AppKit's connect modal for Solana
            await openAppKitConnect('solana');

            // After modal closes, check if we got a wallet
            if (currentAttempt !== attemptRef.current) return;

            // Look for the AppKit wallet in the registry
            const appkitWallet = findWalletById('appkit-solana');
            if (appkitWallet) {
                dispatch({ type: 'PAIRING_SUCCESS', wallet: appkitWallet });
            } else {
                // Modal closed without connecting
                dispatch({ type: 'GO_TO_CHAIN' });
            }
        } catch (err) {
            if (currentAttempt === attemptRef.current) {
                const msg = err instanceof Error ? err.message : String(err || '');
                dispatch({ type: 'PAIRING_ERROR', error: msg || 'Could not open wallet selector' });
            }
        }
    }, [bchNetwork]);

    const goToPick = useCallback(() => {
        cancelCurrent();
        dispatch({ type: 'GO_TO_PICK' });
    }, [cancelCurrent]);

    const goToChain = useCallback(() => {
        if (!canAddExternalWallet()) return;
        cancelCurrent();
        dispatch({ type: 'GO_TO_CHAIN' });
    }, [canAddExternalWallet, cancelCurrent]);

    const pickChain = useCallback((family: ChainFamily) => {
        dispatch({ type: 'PICK_CHAIN', family });
        if (family === 'bch') {
            startPairingForProtocol('wizardconnect');
        } else if (family === 'evm') {
            startAppKitEvm();
        } else if (family === 'solana') {
            startAppKitSolana();
        }
    }, [startPairingForProtocol, startAppKitEvm, startAppKitSolana]);

    const selectProtocol = useCallback((protocol: BchProtocol) => {
        dispatch({ type: 'SELECT_PROTOCOL', protocol });
        startPairingForProtocol(protocol);
    }, [startPairingForProtocol]);

    const retryPairing = useCallback(() => {
        if (state.selectedFamily === 'bch') {
            startPairingForProtocol(state.selectedProtocol);
        }
    }, [state.selectedFamily, state.selectedProtocol, startPairingForProtocol]);

    const reset = useCallback(() => {
        cancelCurrent();
        dispatch({ type: 'RESET' });
    }, [cancelCurrent]);

    useEffect(() => {
        return () => {
            cancelCurrent();
        };
    }, [cancelCurrent]);

    return {
        ...state,
        canAdd,
        goToPick,
        goToChain,
        pickChain,
        selectProtocol,
        retryPairing,
        reset,
    };
}
