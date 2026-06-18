/**
 * ExternalBCHWalletProvider — manages WalletConnect v2 and WizardConnect
 * sessions for external BCH wallets (Cashonize, Paytaca, etc.).
 *
 * This context is separate from WDKProvider. It manages:
 *   - Active WC2 / WizardConnect sessions
 *   - Connected wallet addresses + balance polling
 *   - Session persistence (WC handles its own; we track IDs in localStorage)
 *
 * We implement the connection logic directly (learning from the SDK adapter
 * patterns) rather than importing from @bch-intents/sdk-wallet-adapter.
 */

import {
    createContext,
    useContext,
    useState,
    useCallback,
    useEffect,
    useRef,
    type ReactNode,
} from 'react';
import { useWDK, type BchNetwork } from '@/context/WDKProvider';

// ── Types ────────────────────────────────────────────────────────────────────

export type ExternalWalletSource = 'walletconnect' | 'wizardconnect';

export interface ExternalBCHWallet {
    id: string;
    source: ExternalWalletSource;
    label: string;               // "Cashonize", "Paytaca", "Other"
    address: string;             // bitcoincash:q... or bchtest:q...
    connected: boolean;
    sessionTopic?: string;       // WC session topic for disconnect
}

type ConnectingState = {
    active: boolean;
    label: string | null;
    source: ExternalWalletSource | null;
    uri: string | null;
};

interface ExternalBCHWalletContextType {
    wallets: ExternalBCHWallet[];
    isConnecting: boolean;
    connectingLabel: string | null;
    connectingUri: string | null;
    connectingSource: ExternalWalletSource | null;

    /** Start a WalletConnect v2 session — returns the wc:// URI. */
    startWalletConnect: (label: string) => Promise<string>;
    /** Block until the WC session is approved. */
    waitForWalletConnect: () => Promise<void>;

    /** Start a WizardConnect session — returns the wiz:// URI. */
    startWizardConnect: () => Promise<string>;
    /** Block until the WizardConnect session is approved. */
    waitForWizardConnect: () => Promise<void>;

    /** Build the Cashonize web wallet deep-link for a WC URI. */
    getCashonizeDeepLink: (wcUri: string) => string;

    /** Cancel an in-progress connection attempt. */
    cancelConnecting: () => void;

    disconnectWallet: (id: string) => void;
    disconnectAll: () => void;
}

const ExternalBCHWalletContext = createContext<ExternalBCHWalletContextType | null>(null);

export function useExternalBCHWallet() {
    const ctx = useContext(ExternalBCHWalletContext);
    if (!ctx) throw new Error('useExternalBCHWallet must be used within ExternalBCHWalletProvider');
    return ctx;
}

// ── Constants ────────────────────────────────────────────────────────────────

const WALLETCONNECT_PROJECT_ID = '46eab391b8e623fe273e8b3ed7d45e18';
const BCH_NAMESPACE = 'bch';
const STORAGE_KEY = 'ext_bch_wallets';

function getBchChain(network: BchNetwork): string {
    return network === 'mainnet' ? 'bch:bitcoincash' : 'bch:bchtest';
}

function loadPersistedWallets(): ExternalBCHWallet[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function persistWallets(wallets: ExternalBCHWallet[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets));
    } catch { /* non-fatal */ }
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function ExternalBCHWalletProvider({ children }: { children: ReactNode }) {
    const { bchNetwork } = useWDK();

    const [wallets, setWallets] = useState<ExternalBCHWallet[]>(() => loadPersistedWallets());
    const [connecting, setConnecting] = useState<ConnectingState>({
        active: false,
        label: null,
        source: null,
        uri: null,
    });

    // Refs for the in-flight WC client + approval
    const wcClientRef = useRef<any>(null);
    const wcApprovalRef = useRef<(() => Promise<any>) | null>(null);
    const wizClientRef = useRef<any>(null);

    // Persist wallets on change
    useEffect(() => { persistWallets(wallets); }, [wallets]);

    // ── Background SignClient re-initialization on page load ─────────────────
    // If we have persisted WalletConnect sessions, silently spin up a SignClient
    // in the background so we can:
    //   1. Attach the session_delete listener → detect remote disconnect
    //   2. Validate which sessions are still alive → prune dead ones
    useEffect(() => {
        const wcWallets = wallets.filter(w => w.source === 'walletconnect' && w.sessionTopic);
        if (wcWallets.length === 0) return;

        let cancelled = false;

        (async () => {
            let SignClient: any;
            try {
                const mod = await import('@walletconnect/sign-client');
                SignClient = mod.SignClient ?? mod.default;
            } catch {
                // WalletConnect not installed — silently skip
                return;
            }

            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const safeUrl = isLocalhost ? 'https://bchintents.com' : window.location.origin;

            let client: any;
            try {
                client = await SignClient.init({
                    projectId: WALLETCONNECT_PROJECT_ID,
                    metadata: {
                        name: 'BCH Intents Protocol',
                        description: 'Intent-based cross-chain swaps on Bitcoin Cash',
                        url: safeUrl,
                        icons: [`${window.location.origin}/assets/bchintentslogo_edited.png`],
                    },
                });
            } catch {
                return;
            }

            if (cancelled) return;

            wcClientRef.current = client;

            // Attach global disconnect listener for all known sessions
            client.on('session_delete', ({ topic }: { topic: string }) => {
                console.log('[ExternalBCH] Remote session_delete received for topic:', topic);
                setWallets(prev => prev.filter(w => w.sessionTopic !== topic));
            });

            // Also listen for session expiry
            client.on('session_expire', ({ topic }: { topic: string }) => {
                console.log('[ExternalBCH] Session expired for topic:', topic);
                setWallets(prev => prev.filter(w => w.sessionTopic !== topic));
            });

            // Prune sessions that no longer exist on the relay
            // Delay by 5 seconds to give the relay time to sync on slow connections
            setTimeout(() => {
                if (cancelled) return;
                const activeSessions = client.session?.getAll?.() ?? [];
                const activeTopics = new Set<string>(activeSessions.map((s: any) => s.topic));

                setWallets(prev => {
                    const pruned = prev.filter(w => {
                        if (w.source !== 'walletconnect' || !w.sessionTopic) return true;
                        const alive = activeTopics.has(w.sessionTopic);
                        if (!alive) {
                            console.log('[ExternalBCH] Pruning dead session for wallet:', w.label, w.sessionTopic);
                        }
                        return alive;
                    });
                    return pruned;
                });
            }, 5000);
        })();

        return () => { cancelled = true; };
    // Only run once on mount — wallets ref is captured from initial load
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── WalletConnect v2 ─────────────────────────────────────────────────────

    const startWalletConnect = useCallback(async (label: string): Promise<string> => {
        setConnecting({ active: true, label, source: 'walletconnect', uri: null });

        let SignClient: any;
        try {
            const mod = await import('@walletconnect/sign-client');
            SignClient = mod.SignClient ?? mod.default;
        } catch {
            setConnecting({ active: false, label: null, source: null, uri: null });
            throw new Error(
                'WalletConnect is not installed. Run: npm install @walletconnect/sign-client'
            );
        }

        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const safeUrl = isLocalhost ? 'https://bchintents.com' : window.location.origin;

        const client = await SignClient.init({
            projectId: WALLETCONNECT_PROJECT_ID,
            metadata: {
                name: 'BCH Intents Protocol',
                description: 'Intent-based cross-chain swaps on Bitcoin Cash',
                url: safeUrl,
                icons: [`${window.location.origin}/assets/bchintentslogo_edited.png`],
            },
        });

        wcClientRef.current = client;

        const chain = getBchChain(bchNetwork);

        const { uri, approval } = await client.connect({
            requiredNamespaces: {
                [BCH_NAMESPACE]: {
                    methods: ['bch_sendTransaction', 'bch_getAddresses', 'bch_signTransaction', 'bch_signMessage'],
                    chains: [chain],
                    events: ['accountsChanged'],
                },
            },
        });

        if (!uri) {
            setConnecting({ active: false, label: null, source: null, uri: null });
            throw new Error('WalletConnect failed to generate a pairing URI.');
        }

        wcApprovalRef.current = approval;
        setConnecting(s => ({ ...s, uri }));
        return uri;
    }, [bchNetwork]);

    const waitForWalletConnect = useCallback(async (): Promise<void> => {
        if (!wcApprovalRef.current) {
            throw new Error('Call startWalletConnect() before waitForWalletConnect().');
        }

        const session = await wcApprovalRef.current();
        wcApprovalRef.current = null;

        const accounts = session.namespaces[BCH_NAMESPACE]?.accounts ?? [];
        if (accounts.length === 0) {
            setConnecting({ active: false, label: null, source: null, uri: null });
            throw new Error('WalletConnect session did not provide any BCH accounts.');
        }

        // CAIP-10: "bch:bitcoincash:bitcoincash:qp..." → extract address
        const rawAccount = accounts[0];
        const address = rawAccount.split(':').slice(2).join(':');

        const label = connecting.label || 'External Wallet';
        const newWallet: ExternalBCHWallet = {
            id: `wc-${Date.now()}`,
            source: 'walletconnect',
            label,
            address,
            connected: true,
            sessionTopic: session.topic,
        };

        setWallets(prev => [...prev.filter(w => w.address !== address), newWallet]);
        setConnecting({ active: false, label: null, source: null, uri: null });

        // Listen for disconnect
        const client = wcClientRef.current;
        if (client) {
            client.on('session_delete', ({ topic }: { topic: string }) => {
                if (topic === session.topic) {
                    setWallets(prev => prev.filter(w => w.sessionTopic !== topic));
                }
            });
        }
    }, [connecting.label]);

    // ── WizardConnect ────────────────────────────────────────────────────────

    const startWizardConnect = useCallback(async (): Promise<string> => {
        setConnecting({ active: true, label: 'Paytaca', source: 'wizardconnect', uri: null });

        let DappConnectionManager: any;
        try {
            const mod = await import('@wizardconnect/dapp');
            DappConnectionManager = mod.DappConnectionManager ?? mod.default;
        } catch {
            setConnecting({ active: false, label: null, source: null, uri: null });
            throw new Error(
                'WizardConnect is not installed. Run: npm install @wizardconnect/dapp'
            );
        }

        const client = new DappConnectionManager(
            'BCH Intents Protocol',
            `${window.location.origin}/assets/bchintentslogo_edited.png`
        );

        wizClientRef.current = client;

        // Generate pairing URI
        const uri = await client.getPairingUri?.() ?? client.uri ?? '';
        if (!uri) {
            setConnecting({ active: false, label: null, source: null, uri: null });
            throw new Error('WizardConnect failed to generate a pairing URI.');
        }

        setConnecting(s => ({ ...s, uri }));
        return uri;
    }, []);

    const waitForWizardConnect = useCallback(async (): Promise<void> => {
        const client = wizClientRef.current;
        if (!client) throw new Error('Call startWizardConnect() first.');

        // Wait for wallet to connect
        const session = await client.waitForSession?.() ?? await client.connect?.();

        // Extract address and pubkey from the session
        let address = '';
        let pubkeyHex = '';

        if (session?.address) {
            address = session.address;
            pubkeyHex = session.pubkeyHex ?? session.publicKey ?? '';
        } else if (client.getAddress) {
            address = await client.getAddress();
        }

        if (!address) {
            setConnecting({ active: false, label: null, source: null, uri: null });
            throw new Error('WizardConnect did not return an address.');
        }

        const newWallet: ExternalBCHWallet = {
            id: `wiz-${Date.now()}`,
            source: 'wizardconnect',
            label: 'Paytaca',
            address,
            connected: true,
        };

        setWallets(prev => [...prev.filter(w => w.address !== address), newWallet]);
        setConnecting({ active: false, label: null, source: null, uri: null });
    }, []);

    // ── Cashonize Deep Link ──────────────────────────────────────────────────

    const getCashonizeDeepLink = useCallback((wcUri: string): string => {
        return `https://cashonize.com/?uri=${encodeURIComponent(wcUri)}`;
    }, []);

    // ── Cancel / Disconnect ──────────────────────────────────────────────────

    const cancelConnecting = useCallback(() => {
        setConnecting({ active: false, label: null, source: null, uri: null });
        wcApprovalRef.current = null;
    }, []);

    const disconnectWallet = useCallback((id: string) => {
        setWallets(prev => {
            const wallet = prev.find(w => w.id === id);
            if (wallet?.source === 'walletconnect' && wallet.sessionTopic && wcClientRef.current) {
                try {
                    wcClientRef.current.disconnect({
                        topic: wallet.sessionTopic,
                        reason: { code: 6000, message: 'User disconnected' },
                    });
                } catch { /* ignore */ }
            }
            return prev.filter(w => w.id !== id);
        });
    }, []);

    const disconnectAll = useCallback(() => {
        for (const w of wallets) {
            if (w.source === 'walletconnect' && w.sessionTopic && wcClientRef.current) {
                try {
                    wcClientRef.current.disconnect({
                        topic: w.sessionTopic,
                        reason: { code: 6000, message: 'User disconnected' },
                    });
                } catch { /* ignore */ }
            }
        }
        setWallets([]);
    }, [wallets]);

    return (
        <ExternalBCHWalletContext.Provider value={{
            wallets,
            isConnecting: connecting.active,
            connectingLabel: connecting.label,
            connectingUri: connecting.uri,
            connectingSource: connecting.source,
            startWalletConnect,
            waitForWalletConnect,
            startWizardConnect,
            waitForWizardConnect,
            getCashonizeDeepLink,
            cancelConnecting,
            disconnectWallet,
            disconnectAll,
        }}>
            {children}
        </ExternalBCHWalletContext.Provider>
    );
}
