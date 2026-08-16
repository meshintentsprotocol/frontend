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
    /** Build the Paytaca deep-link for a WC or WizardConnect URI. */
    getPaytacaDeepLink: (uri: string, isWizardConnect: boolean) => string;

    /** Cancel an in-progress connection attempt. */
    cancelConnecting: () => void;

    disconnectWallet: (id: string) => void;
    disconnectAll: () => void;

    /**
     * Request the external wallet to sign (and optionally broadcast) a raw transaction.
     * The `payload` must be in WC2-BCH format:
     *   - transaction: hex-encoded unsigned tx
     *   - sourceOutputs: UTXOs in libauth-stringify format
     *   - broadcast: true → wallet broadcasts and returns signedTransactionHash
     *   - userPrompt: optional label shown in wallet UI
     *
     * Returns: { signedTransaction, signedTransactionHash } when broadcast=true
     */
    signTransaction: (id: string, payload: WC2SignPayload) => Promise<WC2SignResult>;
}

/** WC2-BCH bch_signTransaction request payload */
export interface WC2SignPayload {
    transaction: string;         // hex-encoded unsigned tx
    sourceOutputs: unknown[];    // libauth-stringify encoded UTXOs
    broadcast: boolean;
    userPrompt?: string;
}

/** WC2-BCH bch_signTransaction response */
export interface WC2SignResult {
    signedTransaction: string;       // hex of the signed tx
    signedTransactionHash: string;   // txid
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

// ── WalletConnect singleton ───────────────────────────────────────────────────
// We store the client on `window` rather than in module scope so that Vite's
// HMR (which re-evaluates the module on every save) cannot reset the singleton.
// WalletConnect keeps its own internal global counter, so if our module-level
// variable is cleared but WC's counter isn't, `SignClient.init()` would be
// called again and WC would warn "Init() was called N times".
//
// Using `window.__wcBchClient` / `window.__wcBchClientPending` ensures only one
// init ever runs for the lifetime of the page, regardless of HMR.
declare global {
    interface Window {
        __wcBchClient?: any;
        __wcBchClientPending?: Promise<any>;
    }
}

async function getWCClient(): Promise<any> {
    // Already resolved — return immediately (the common hot path).
    if (window.__wcBchClient) return window.__wcBchClient;

    // Init already in progress — piggy-back on the existing promise.
    if (window.__wcBchClientPending) return window.__wcBchClientPending;

    const isLocalhost = window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';
    const safeUrl = isLocalhost ? 'https://bchintents.com' : window.location.origin;

    const mod = await import('@walletconnect/sign-client');
    const SignClient = mod.SignClient ?? mod.default;

    // Store the promise immediately before awaiting so concurrent calls share it.
    window.__wcBchClientPending = SignClient.init({
        projectId: WALLETCONNECT_PROJECT_ID,
        metadata: {
            name: 'BCH Intents Protocol',
            description: 'Intent-based cross-chain swaps on Bitcoin Cash',
            url: safeUrl,
            icons: [`${window.location.origin}/assets/bchintentslogo_edited.png`],
        },
    }).then((client: any) => {
        window.__wcBchClient = client;
        delete window.__wcBchClientPending;   // clean up — resolved, not needed
        return client;
    });

    return window.__wcBchClientPending;
}

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
            let client: any;
            try {
                client = await getWCClient();
            } catch {
                // WalletConnect not installed — silently skip
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

        let client: any;
        try {
            client = await getWCClient();
        } catch {
            setConnecting({ active: false, label: null, source: null, uri: null });
            throw new Error(
                'WalletConnect is not installed. Run: npm install @walletconnect/sign-client'
            );
        }

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

        const peerName = session.peer?.metadata?.name;
        let label = connecting.label || 'External Wallet';
        if (label === 'External Wallet' && peerName) {
            label = peerName;
        }

        const newWallet: ExternalBCHWallet = {
            id: `wc-${Date.now()}`,
            source: 'walletconnect',
            label,
            address,
            connected: true,
            sessionTopic: session.topic,
        };

        try {
            localStorage.setItem('active_bch_wallet_id', newWallet.id);
        } catch {}

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
            DappConnectionManager = mod.DappConnectionManager ?? (mod as any).default;
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

        try {
            localStorage.setItem('active_bch_wallet_id', newWallet.id);
        } catch {}

        setWallets(prev => [...prev.filter(w => w.address !== address), newWallet]);
        setConnecting({ active: false, label: null, source: null, uri: null });
    }, []);

    // ── Cashonize Deep Link ──────────────────────────────────────────────────

    const getCashonizeDeepLink = useCallback((wcUri: string): string => {
        return `https://cashonize.com/?uri=${encodeURIComponent(wcUri)}`;
    }, []);

    const getPaytacaDeepLink = useCallback((uri: string, isWizardConnect: boolean): string => {
        return isWizardConnect 
            ? `paytaca://wizard?uri=${encodeURIComponent(uri)}` 
            : `paytaca://wc?uri=${encodeURIComponent(uri)}`;
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

    // ── Transaction Signing ──────────────────────────────────────────────────

    const signTransaction = useCallback(async (id: string, payload: WC2SignPayload): Promise<WC2SignResult> => {
        const wallet = wallets.find(w => w.id === id);
        if (!wallet) throw new Error(`Wallet ${id} not found.`);

        if (wallet.source === 'walletconnect') {
            if (!wallet.sessionTopic || !wcClientRef.current) {
                throw new Error('WalletConnect session is not active.');
            }

            // Send bch_signTransaction — Cashonize will show a preview dialog,
            // the user approves, wallet signs + optionally broadcasts.
            // Spec: https://github.com/mainnet-pat/wc2-bch-bcr
            const response = await wcClientRef.current.request({
                topic: wallet.sessionTopic,
                chainId: getBchChain(bchNetwork),
                request: {
                    method: 'bch_signTransaction',
                    // WalletConnect params must be JSON-serialisable.
                    // The sourceOutputs already use the libauth-stringify format
                    // ('<Uint8Array: 0x...>' / '<bigint: 123n>') produced by wc2Serialize.ts.
                    params: payload,
                },
            }) as any;

            if (response && typeof response === 'object') {
                const signedTransaction = response.signedTransaction ?? '';
                const signedTransactionHash = response.signedTransactionHash ?? '';
                if (signedTransactionHash) {
                    return { signedTransaction, signedTransactionHash };
                }
            }

            throw new Error('Invalid or empty response from WalletConnect bch_signTransaction.');

        } else if (wallet.source === 'wizardconnect') {
            if (!wizClientRef.current) throw new Error('WizardConnect client is not active.');

            // WizardConnect uses a similar interface; pass the full payload
            const response = await wizClientRef.current.signTransaction(payload) as any;
            if (response && response.signedTransactionHash) {
                return {
                    signedTransaction: response.signedTransaction ?? '',
                    signedTransactionHash: response.signedTransactionHash,
                };
            }

            throw new Error('Invalid or empty response from WizardConnect signTransaction.');
        }

        throw new Error('Unsupported external wallet source.');
    }, [wallets, bchNetwork]);

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
