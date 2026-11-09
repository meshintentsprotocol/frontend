/**
 * ExternalBCHWalletProvider — manages WalletConnect v2, WizardConnect,
 * and Cham Wallet browser extension sessions for BCH.
 *
 * Backed by the central wallet registry (lib/wallets/registry.ts) and
 * signing-request runner (lib/wallets/signRequest.ts).
 *
 * Phase 0: Foundation
 */

import {
    createContext,
    useContext,
    useState,
    useCallback,
    useMemo,
    useEffect,
    useRef,
    type ReactNode,
} from 'react';
import { useWDK } from '@/context/WDKProvider';
import {
    MAIN_WALLET_ID,
    setActiveWalletId,
    useActiveWalletId,
} from '@/lib/walletStore';
import {
    AppNetwork,
    ChainFamily,
    ExternalWallet,
    appNetworkOf,
    MAX_EXTERNAL_WALLETS,
} from '@/lib/wallets/types';
import {
    getAllWallets,
    visibleWallets,
    addWallet,
    removeWallet,
    clearAllWallets,
    useExternalWallets,
    registerSessionCloser,
} from '@/lib/wallets/registry';
export { useExternalWallets };
import { resolveActive } from '@/lib/wallets/resolveActive';
import {
    getWCBchClient,
    connectBch,
    getBchChain,
} from '@/lib/wallets/walletconnect';
import {
    runSignRequest,
    WalletSignError,
} from '@/lib/wallets/signRequest';
import {
    startPairing as startWizardPairing,
    restore as restoreWizardSession,
    disconnect as disconnectWizard,
    sign as signWizard,
    type WizSession,
} from '@/lib/wallets/wizardconnect';
import { setWalletContext } from '@/lib/wallets/ambient';
import {
    hasAppKitMarker,
    restoreAppKitConnections,
    disconnectAppKit,
    handleModeSwitch,
    setAppKitNetwork,
    namespaceOf,
} from '@/lib/wallets/appkitBridge';
import { isAppKitLoaded } from '@/lib/wallets/appkit';

// ── Types ────────────────────────────────────────────────────────────────────

export type ExternalWalletSource = 'walletconnect' | 'wizardconnect' | 'extension';

export interface ExternalBCHWallet {
    id: string;
    source: ExternalWalletSource;
    label: string; // "Cashonize", "Paytaca", "Other"
    address: string; // bitcoincash:q... or bchtest:q...
    connected: boolean;
    sessionTopic?: string; // WC session topic for disconnect
    connectedAt?: number;
}

type ConnectingState = {
    active: boolean;
    label: string | null;
    source: ExternalWalletSource | null;
    uri: string | null;
};

export interface WC2SignPayload {
    transaction: string; // hex-encoded unsigned tx
    sourceOutputs: unknown[]; // libauth-stringify encoded UTXOs
    broadcast: boolean;
    userPrompt?: string;
}

export interface WC2SignResult {
    signedTransaction: string; // hex of the signed tx
    signedTransactionHash: string; // txid
}

export interface BchPairingHandle {
    qrValue: string;
    linkText: string;
    expiresAt?: number;
    ready: Promise<ExternalWallet>;
    cancel: () => void;
}

interface ExternalBCHWalletContextType {
    /** Visible BCH external wallets on current network (for compatibility with existing callers) */
    wallets: ExternalBCHWallet[];
    /** All external wallets across all chains & networks */
    allWallets: ExternalWallet[];
    isConnecting: boolean;
    connectingLabel: string | null;
    connectingUri: string | null;
    connectingSource: ExternalWalletSource | null;

    /** Start a WalletConnect v2 session — returns the wc:// URI. */
    startWalletConnect: (label: string) => Promise<string>;
    /** Block until the WC session is approved. */
    waitForWalletConnect: () => Promise<void>;

    /** Start a WizardConnect session — returns uri and qrUri. */
    startWizardConnect: () => Promise<{ uri: string; qrUri: string }>;
    /** Block until the WizardConnect session is approved. */
    waitForWizardConnect: () => Promise<void>;

    /** Connect the Cham Wallet browser extension. */
    connectExtension: () => Promise<void>;

    /** Whether more external wallets can be connected (under MAX_EXTERNAL_WALLETS limit) */
    canAddExternalWallet: () => boolean;

    /** Unified BCH pairing handle for WizardConnect or WalletConnect (P2 connect screen) */
    startBchPairing: (protocol: 'wizardconnect' | 'walletconnect') => Promise<BchPairingHandle>;

    /** Build the Cashonize web wallet deep-link for a WC URI. */
    getCashonizeDeepLink: (wcUri: string) => string;
    /** Build the Paytaca deep-link for a WC or WizardConnect URI. */
    getPaytacaDeepLink: (uri: string, isWizardConnect: boolean) => string;

    /** Cancel an in-progress connection attempt. */
    cancelConnecting: () => void;

    disconnectWallet: (id: string) => void;
    disconnectAll: () => void;

    /** Request the external wallet to sign (and optionally broadcast) a raw transaction. */
    signTransaction: (id: string, payload: WC2SignPayload) => Promise<WC2SignResult>;
}

const ExternalBCHWalletContext = createContext<ExternalBCHWalletContextType | null>(null);

export function useExternalBCHWallet() {
    const ctx = useContext(ExternalBCHWalletContext);
    if (!ctx) throw new Error('useExternalBCHWallet must be used within ExternalBCHWalletProvider');
    return ctx;
}

// ── Cham Wallet extension ─────────────────────────────────────────────

export const EXTENSION_WALLET_LABEL = 'Cham Extension';

interface BchIntentsProvider {
    isBCHIntents: true;
    request(args: { method: string; params?: unknown[] }): Promise<any>;
    on(event: string, handler: (...args: any[]) => void): unknown;
    removeListener(event: string, handler: (...args: any[]) => void): unknown;
}

function getExtensionProvider(timeoutMs = 3000): Promise<BchIntentsProvider> {
    const w = typeof window !== 'undefined' ? (window as unknown as { bchIntents?: BchIntentsProvider }) : {};
    if (w.bchIntents?.isBCHIntents) return Promise.resolve(w.bchIntents);
    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined') {
            reject(new Error('Window is undefined'));
            return;
        }
        const onReady = () => {
            clearTimeout(timer);
            resolve((window as any).bchIntents!);
        };
        const timer = setTimeout(() => {
            window.removeEventListener('bchIntents#initialized', onReady);
            reject(Object.assign(new Error('Cham Wallet extension is not installed.'), { code: 'NOT_INSTALLED' }));
        }, timeoutMs);
        window.addEventListener('bchIntents#initialized', onReady, { once: true });
    });
}

function disconnectExtension() {
    try {
        const w = window as unknown as { bchIntents?: { disconnect?: () => void } };
        w.bchIntents?.disconnect?.();
    } catch { /* ignore */ }
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function ExternalBCHWalletProvider({ children }: { children: ReactNode }) {
    const {
        bchNetwork,
        bchChipnetAddress,
        bchMainnetAddress,
        evmAddress,
        solanaAddress,
        btcAddress,
        btcMainnetAddress,
        btcTestnetAddress,
        isInitialized,
    } = useWDK();
    const appNetwork: AppNetwork = appNetworkOf(bchNetwork);

    const allWallets = useExternalWallets();
    const activeBchId = useActiveWalletId('bch');
    const activeEvmId = useActiveWalletId('evm');
    const activeSolanaId = useActiveWalletId('solana');
    const activeBtcId = useActiveWalletId('btc');

    // ── Keep ambient wallet context in sync for non-React services ───────────
    useEffect(() => {
        const builtIn: Record<ChainFamily, string | null> = {
            bch: (appNetwork === 'mainnet' ? bchMainnetAddress : bchChipnetAddress) || null,
            evm: evmAddress || null,
            solana: solanaAddress || null,
            btc: (appNetwork === 'mainnet' ? (btcMainnetAddress || btcAddress) : (btcTestnetAddress || btcAddress)) || null,
        };
        const activeIds: Record<ChainFamily, string | null> = {
            bch: activeBchId, evm: activeEvmId, solana: activeSolanaId, btc: activeBtcId,
        };

        const active = {} as Record<ChainFamily, string | null>;
        const connected = {} as Record<ChainFamily, string[]>;
        for (const family of ['bch', 'evm', 'solana', 'btc'] as ChainFamily[]) {
            const exts = allWallets.filter(w => w.family === family && w.network === appNetwork);
            const activeExt = exts.find(w => w.id === activeIds[family]);
            active[family] = activeExt?.address ?? builtIn[family];
            const list: string[] = builtIn[family] ? [builtIn[family]!] : [];
            for (const w of exts) if (!list.includes(w.address)) list.push(w.address);
            connected[family] = list;
        }

        setWalletContext({
            network: appNetwork,
            active,
            builtIn,
            connectedAddresses: connected,
        });
    }, [
        appNetwork,
        activeBchId,
        activeEvmId,
        activeSolanaId,
        activeBtcId,
        allWallets,
        bchChipnetAddress,
        bchMainnetAddress,
        evmAddress,
        solanaAddress,
        btcAddress,
        btcMainnetAddress,
        btcTestnetAddress,
    ]);

    // Filter to visible BCH wallets and map to ExternalBCHWallet shape
    const bchWallets: ExternalBCHWallet[] = useMemo(() => allWallets
        .filter(w => w.family === 'bch' && w.network === appNetwork)
        .map(w => ({
            id: w.id,
            source: w.source as ExternalWalletSource,
            label: w.label,
            address: w.address,
            connected: true,
            sessionTopic: w.sessionTopic,
            connectedAt: w.connectedAt,
        })), [allWallets, appNetwork]);

    const [connecting, setConnecting] = useState<ConnectingState>({
        active: false,
        label: null,
        source: null,
        uri: null,
    });

    const pendingLabelRef = useRef<string | null>(null);
    const wcApprovalRef = useRef<(() => Promise<any>) | null>(null);
    const wizPairingRef = useRef<{ id: string; ready: Promise<WizSession>; cancel: () => void } | null>(null);

    // ── Restore persisted WizardConnect wallets on mount/network change ─────
    useEffect(() => {
        const wizWallets = allWallets.filter(w => w.source === 'wizardconnect' && w.network === appNetwork);
        for (const w of wizWallets) {
            try {
                const session = restoreWizardSession(w.id, appNetwork);
                if (!session) {
                    removeWallet(w.id);
                }
            } catch {
                removeWallet(w.id);
            }
        }
    }, [appNetwork, allWallets]);

    // ── AppKit wallets: restore on load, follow the mode on every switch ────
    useEffect(() => {
        if (isAppKitLoaded()) {
            handleModeSwitch(appNetwork === 'mainnet', appNetwork).catch(e => console.warn('[AppKit] mode switch error:', e));
        } else if (hasAppKitMarker()) {
            restoreAppKitConnections(appNetwork).catch(e => console.warn('[AppKit] restore error:', e));
        } else {
            setAppKitNetwork(appNetwork);
        }
    }, [appNetwork]);

    // ── Session Closer Registration ─────────────────────────────────────────
    useEffect(() => {
        const unregister = registerSessionCloser(async (wallet) => {
            if (wallet.source === 'walletconnect' && wallet.sessionTopic) {
                try {
                    const client = await getWCBchClient();
                    client.disconnect({
                        topic: wallet.sessionTopic,
                        reason: { code: 6000, message: 'User disconnected' },
                    });
                } catch { /* ignore */ }
            } else if (wallet.source === 'wizardconnect') {
                await disconnectWizard(wallet.id);
            } else if (wallet.source === 'extension') {
                disconnectExtension();
            } else if (wallet.source === 'appkit') {
                const ns = namespaceOf(wallet.family);
                if (ns) await disconnectAppKit(ns);
            }
        });
        return unregister;
    }, []);

    // ── Single Active Wallet Reconcile Effect ────────────────────────────────
    useEffect(() => {
        const candidates = bchWallets.map(w => ({ id: w.id, connectedAt: w.connectedAt ?? 0 }));
        const resolved = resolveActive('bch', activeBchId, candidates, isInitialized);
        if (resolved !== activeBchId) {
            setActiveWalletId(resolved, 'bch');
        }
    }, [bchWallets, isInitialized, activeBchId]);

    // ── WalletConnect ────────────────────────────────────────────────────────

    const startWalletConnect = useCallback(async (label: string): Promise<string> => {
        pendingLabelRef.current = label;
        setConnecting({
            active: true,
            label,
            source: 'walletconnect',
            uri: null,
        });

        try {
            const { uri, approval } = await connectBch(appNetwork);
            wcApprovalRef.current = approval;
            setConnecting(s => ({ ...s, uri }));
            return uri;
        } catch (e) {
            setConnecting({ active: false, label: null, source: null, uri: null });
            throw e;
        }
    }, [appNetwork]);

    const waitForWalletConnect = useCallback(async (): Promise<void> => {
        const approval = wcApprovalRef.current;
        if (!approval) throw new Error('Call startWalletConnect() first.');

        try {
            const session = await approval();
            const bchNamespace = session.namespaces?.bch;
            const accounts: string[] = bchNamespace?.accounts || [];
            if (accounts.length === 0) {
                throw new Error('WalletConnect session did not approve any BCH accounts.');
            }

            const rawAccount = accounts[0];
            const address = rawAccount.split(':').slice(2).join(':');
            const peerName = session.peer?.metadata?.name;
            const label = peerName || pendingLabelRef.current || 'Cashonize';

            const walletId = `wc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const newWallet: ExternalWallet = {
                id: walletId,
                source: 'walletconnect',
                family: 'bch',
                network: appNetwork,
                label,
                address,
                sessionTopic: session.topic,
                connectedAt: Date.now(),
            };

            addWallet(newWallet);
            setActiveWalletId(newWallet.id, 'bch');
        } finally {
            setConnecting({ active: false, label: null, source: null, uri: null });
            wcApprovalRef.current = null;
            pendingLabelRef.current = null;
        }
    }, [appNetwork]);

    // ── WizardConnect ───────────────────────────────────────────────────────

    const startWizardConnect = useCallback(async (): Promise<{ uri: string; qrUri: string }> => {
        setConnecting({
            active: true,
            label: 'Paytaca',
            source: 'wizardconnect',
            uri: null,
        });

        try {
            const pairing = await startWizardPairing(appNetwork);
            wizPairingRef.current = {
                id: pairing.id,
                ready: pairing.ready,
                cancel: pairing.cancel,
            };
            setConnecting(s => ({ ...s, uri: pairing.uri }));
            return { uri: pairing.uri, qrUri: pairing.qrUri };
        } catch (e) {
            setConnecting({ active: false, label: null, source: null, uri: null });
            throw e;
        }
    }, [appNetwork]);

    const waitForWizardConnect = useCallback(async (): Promise<void> => {
        const pairing = wizPairingRef.current;
        if (!pairing) throw new Error('Call startWizardConnect() first.');

        try {
            const session = await pairing.ready;
            const newWallet: ExternalWallet = {
                id: session.id,
                source: 'wizardconnect',
                family: 'bch',
                network: session.network,
                label: session.label,
                icon: session.icon,
                address: session.address,
                connectedAt: Date.now(),
            };

            addWallet(newWallet);
            setActiveWalletId(newWallet.id, 'bch');
        } finally {
            setConnecting({ active: false, label: null, source: null, uri: null });
            wizPairingRef.current = null;
        }
    }, []);

    const canAddExternalWallet = useCallback((): boolean => {
        return allWallets.length < MAX_EXTERNAL_WALLETS;
    }, [allWallets.length]);

    const startBchPairing = useCallback(async (protocol: 'wizardconnect' | 'walletconnect'): Promise<BchPairingHandle> => {
        if (!canAddExternalWallet()) {
            throw new Error(`Maximum of ${MAX_EXTERNAL_WALLETS} external wallets reached.`);
        }

        if (protocol === 'wizardconnect') {
            const pairing = await startWizardPairing(appNetwork);
            let isCancelled = false;

            const ready = (async () => {
                const session = await pairing.ready;
                if (isCancelled) {
                    throw new Error('Connection cancelled');
                }
                const newWallet: ExternalWallet = {
                    id: session.id,
                    source: 'wizardconnect',
                    family: 'bch',
                    network: session.network,
                    label: session.label,
                    icon: session.icon,
                    address: session.address,
                    connectedAt: Date.now(),
                };
                addWallet(newWallet);
                setActiveWalletId(newWallet.id, 'bch');
                return newWallet;
            })();

            return {
                qrValue: pairing.qrUri,
                linkText: pairing.uri,
                ready,
                cancel: () => {
                    isCancelled = true;
                    pairing.cancel();
                },
            };
        } else {
            const { uri, approval } = await connectBch(appNetwork);
            let isCancelled = false;
            const expiresAt = Date.now() + 5 * 60 * 1000;

            const ready = (async () => {
                const session = await approval();
                if (isCancelled) {
                    throw new Error('Connection cancelled');
                }
                const bchNamespace = session.namespaces?.bch;
                const accounts: string[] = bchNamespace?.accounts || [];
                if (accounts.length === 0) {
                    throw new Error('WalletConnect session did not approve any BCH accounts.');
                }

                const rawAccount = accounts[0];
                const address = rawAccount.split(':').slice(2).join(':');
                const peerName = session.peer?.metadata?.name;
                const label = peerName || 'Cashonize';
                const rawIcon = session.peer?.metadata?.icons?.[0];
                const icon = (rawIcon && (rawIcon.startsWith('https://') || rawIcon.startsWith('data:image/'))) ? rawIcon : undefined;

                const walletId = `wc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                const newWallet: ExternalWallet = {
                    id: walletId,
                    source: 'walletconnect',
                    family: 'bch',
                    network: appNetwork,
                    label,
                    icon,
                    address,
                    sessionTopic: session.topic,
                    connectedAt: Date.now(),
                };

                addWallet(newWallet);
                setActiveWalletId(newWallet.id, 'bch');
                return newWallet;
            })();

            return {
                qrValue: uri,
                linkText: uri,
                expiresAt,
                ready,
                cancel: () => {
                    isCancelled = true;
                },
            };
        }
    }, [appNetwork, canAddExternalWallet]);

    // ── Cham Wallet Extension ───────────────────────────────────────────────

    const connectExtension = useCallback(async (): Promise<void> => {
        setConnecting({ active: true, label: EXTENSION_WALLET_LABEL, source: 'extension', uri: null });

        try {
            const provider = await getExtensionProvider();
            let addresses: string[] = [];
            try {
                addresses = (await provider.request({ method: 'bch_requestAccounts' })) as string[];
            } catch {
                addresses = (await provider.request({ method: 'bch_accounts' })) as string[];
            }

            if (!addresses || addresses.length === 0) {
                throw new Error('No accounts returned from Cham Wallet extension.');
            }

            const address = addresses[0];
            const walletId = `ext-${Date.now()}`;
            const newWallet: ExternalWallet = {
                id: walletId,
                source: 'extension',
                family: 'bch',
                network: appNetwork,
                label: EXTENSION_WALLET_LABEL,
                address,
                connectedAt: Date.now(),
            };

            addWallet(newWallet);
            setActiveWalletId(newWallet.id, 'bch');
        } finally {
            setConnecting({ active: false, label: null, source: null, uri: null });
        }
    }, [appNetwork]);

    // ── Deep Links ──────────────────────────────────────────────────────────

    const getCashonizeDeepLink = useCallback((wcUri: string): string => {
        return `https://cashonize.com/?uri=${encodeURIComponent(wcUri)}`;
    }, []);

    const getPaytacaDeepLink = useCallback((uri: string, isWizardConnect: boolean): string => {
        return isWizardConnect
            ? `paytaca://wizard?uri=${encodeURIComponent(uri)}`
            : `paytaca://wc?uri=${encodeURIComponent(uri)}`;
    }, []);

    // ── Cancel & Disconnect ─────────────────────────────────────────────────

    const cancelConnecting = useCallback(() => {
        setConnecting({ active: false, label: null, source: null, uri: null });
        wcApprovalRef.current = null;
        pendingLabelRef.current = null;
        if (wizPairingRef.current) {
            wizPairingRef.current.cancel();
            wizPairingRef.current = null;
        }
    }, []);

    const disconnectWallet = useCallback((id: string) => {
        disconnectWizard(id);
        removeWallet(id);
    }, []);

    /** Every external wallet on every chain and network; the selection goes back to the built-in wallet. */
    const disconnectAll = useCallback(() => {
        clearAllWallets();
        setActiveWalletId(MAIN_WALLET_ID, 'bch');
        setActiveWalletId(null, 'evm');
        setActiveWalletId(null, 'solana');
        setActiveWalletId(null, 'btc');
    }, []);

    // ── Transaction Signing with Runner ──────────────────────────────────────

    const signTransaction = useCallback(async (id: string, payload: WC2SignPayload): Promise<WC2SignResult> => {
        const wallet = allWallets.find(w => w.id === id);
        if (!wallet) throw new Error(`Wallet ${id} not found.`);

        if (wallet.network !== appNetwork) {
            throw new WalletSignError('wrong-network', wallet.label);
        }

        return runSignRequest({
            walletId: wallet.id,
            walletLabel: wallet.label,
            exec: async (signal) => {
                if (wallet.source === 'walletconnect') {
                    if (!wallet.sessionTopic) {
                        throw new WalletSignError('session-gone', wallet.label);
                    }

                    const client = await getWCBchClient();
                    if (signal.aborted) throw new WalletSignError('cancelled', wallet.label);

                    const response = await client.request({
                        topic: wallet.sessionTopic,
                        chainId: getBchChain(appNetwork),
                        request: {
                            method: 'bch_signTransaction',
                            params: payload,
                        },
                    }) as any;

                    if (signal.aborted) throw new WalletSignError('cancelled', wallet.label);

                    if (response && typeof response === 'object') {
                        const signedTransaction = response.signedTransaction ?? '';
                        const signedTransactionHash = response.signedTransactionHash ?? '';
                        if (signedTransactionHash) {
                            return { signedTransaction, signedTransactionHash };
                        }
                    }

                    throw new Error('Invalid or empty response from WalletConnect bch_signTransaction.');
                }

                if (wallet.source === 'extension') {
                    const provider = await getExtensionProvider();
                    if (signal.aborted) throw new WalletSignError('cancelled', wallet.label);

                    const [address] = await provider.request({ method: 'bch_accounts' }) as string[];
                    if (address !== wallet.address) {
                        throw new Error('The account in the Cham Wallet extension changed. Reconnect the extension and try again.');
                    }

                    const response = await provider.request({ method: 'bch_signTransaction', params: [payload] });
                    if (signal.aborted) throw new WalletSignError('cancelled', wallet.label);

                    if (response?.signedTransactionHash) {
                        return {
                            signedTransaction: response.signedTransaction ?? '',
                            signedTransactionHash: response.signedTransactionHash,
                        };
                    }

                    throw new Error('Invalid or empty response from the extension bch_signTransaction.');
                }

                if (wallet.source === 'wizardconnect') {
                    return signWizard(wallet.id, payload, signal);
                }

                throw new Error('Unsupported external wallet source.');
            },
        });
    }, [allWallets, appNetwork]);

    return (
        <ExternalBCHWalletContext.Provider value={{
            wallets: bchWallets,
            allWallets,
            isConnecting: connecting.active,
            connectingLabel: connecting.label,
            connectingUri: connecting.uri,
            connectingSource: connecting.source,
            startWalletConnect,
            waitForWalletConnect,
            startWizardConnect,
            waitForWizardConnect,
            connectExtension,
            canAddExternalWallet,
            startBchPairing,
            getCashonizeDeepLink,
            getPaytacaDeepLink,
            cancelConnecting,
            disconnectWallet,
            disconnectAll,
            signTransaction,
        }}>
            {children}
        </ExternalBCHWalletContext.Provider>
    );
}
