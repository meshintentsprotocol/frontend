/**
 * WDK Wallet Provider — Browser-compatible
 *
 * Uses @tetherto/wdk for seed phrase generation/validation.
 * BCH is derived from the same BIP-39 mnemonic via mainnet-js.
 * Two BCH wallets are derived (Chipnet / Mainnet) and the user toggles between them.
 *
 * Session: volatile seed in sessionStorage (15-min auto-lock on inactivity).
 * Persistence: AES-GCM encrypted seed in localStorage (unlocked with password).
 */

import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { encryptAndStore, decryptFromStorage, hasStoredWallet } from '@/lib/crypto';
import WalletManagerSolana from '@tetherto/wdk-wallet-solana';
import WalletManagerBtc, { ElectrumWs } from '@tetherto/wdk-wallet-btc';
import { createKeyPairSignerFromPrivateKeyBytes } from '@solana/signers';

export type BchNetwork = 'chipnet' | 'mainnet';

interface WDKWalletState {
    isInitialized: boolean;
    isLoading: boolean;
    seedPhrase: string | null;
    evmAddress: string | null;
    solanaAddress: string | null;
    btcAddress: string | null;
    bchChipnetAddress: string | null;
    bchMainnetAddress: string | null;
    bchNetwork: BchNetwork;
    evmSigner: any | null;
    solanaSigner: any | null;
    solanaAccount: any | null;
    solanaManager: any | null;
    btcAccount: any | null;
    btcManager: any | null;
    bchChipnetWallet: any | null;
    bchMainnetWallet: any | null;
    evmBalance: string | null;
    solanaBalance: string | null;
    error: string | null;
}

interface WDKContextType extends WDKWalletState {
    bchAddress: string | null;
    bchWallet: any | null;
    setBchNetwork: (net: BchNetwork) => void;
    createWallet: () => Promise<string>;
    importWallet: (seedPhrase: string) => Promise<void>;
    unlockWallet: (password: string) => Promise<boolean>;
    saveWallet: (password: string) => Promise<void>;
    disconnect: () => void;
    refreshBalances: () => Promise<void>;
    hasStoredWallet: boolean;
}

const WDKContext = createContext<WDKContextType | null>(null);

export function useWDK() {
    const ctx = useContext(WDKContext);
    if (!ctx) throw new Error('useWDK must be used within WDKProvider');
    return ctx;
}

async function generateSeedPhrase(): Promise<string> {
    const { default: WDK } = await import('@tetherto/wdk');
    const phrase = WDK.getRandomSeedPhrase();
    if (phrase && typeof phrase === 'string' && phrase.split(' ').length >= 12) return phrase;
    throw new Error('Failed to generate seed phrase');
}

async function deriveEvmWallet(seedPhrase: string): Promise<any | null> {
    try {
        const { HDNodeWallet } = await import('ethers');
        return HDNodeWallet.fromPhrase(seedPhrase, undefined, "m/44'/60'/0'/0/0");
    } catch (e: any) {
        console.warn('[WDK] EVM derivation failed:', e.message);
        return null;
    }
}

async function deriveSolanaSigner(seedPhrase: string): Promise<{ signer: any; account: any; manager: any } | null> {
    try {
        const manager = new WalletManagerSolana(seedPhrase, {
            rpcUrl: 'https://api.devnet.solana.com',
            commitment: 'confirmed',
        });
        const account = await manager.getAccount(0);
        const address = await account.getAddress();
        const privateKey = account.keyPair.privateKey;
        if (!privateKey) throw new Error('No private key derived');

        const baseSigner = await createKeyPairSignerFromPrivateKeyBytes(privateKey);
        const secretKey64 = new Uint8Array(64);
        secretKey64.set(privateKey, 0);
        secretKey64.set(account.keyPair.publicKey, 32);
        const signer = { ...baseSigner, address, secretKey: secretKey64 };

        return { signer, account, manager };
    } catch (e: any) {
        console.warn('[WDK] Solana derivation failed:', e.message);
        return null;
    }
}

async function deriveBtcSigner(seedPhrase: string): Promise<any | null> {
    try {
        const client = new ElectrumWs({ url: 'wss://electrum.blockstream.info:50004' });
        const manager = new WalletManagerBtc(seedPhrase, { client, network: 'testnet', bip: 84 });
        const account = await manager.getAccount(0);
        const address = await account.getAddress();
        return { account, manager, address };
    } catch (e: any) {
        console.warn('[WDK] BTC derivation failed:', e.message);
        return null;
    }
}

async function deriveBchWallets(seedPhrase: string) {
    let chipnetWallet: any = null;
    let mainnetWallet: any = null;
    let chipnetAddress: string | null = null;
    let mainnetAddress: string | null = null;

    try {
        const { TestNetWallet } = await import('mainnet-js');
        chipnetWallet = await TestNetWallet.fromSeed(seedPhrase);
        chipnetAddress = (chipnetWallet as any).cashaddr ?? await (chipnetWallet as any).getDepositAddress?.();
        console.log('[WDK] BCH Chipnet:', chipnetAddress);
    } catch (e: any) {
        console.warn('[WDK] BCH Chipnet derivation failed:', e.message);
    }

    try {
        const { Wallet } = await import('mainnet-js');
        mainnetWallet = await Wallet.fromSeed(seedPhrase);
        mainnetAddress = (mainnetWallet as any).cashaddr ?? await (mainnetWallet as any).getDepositAddress?.();
        console.log('[WDK] BCH Mainnet:', mainnetAddress);
    } catch (e: any) {
        console.warn('[WDK] BCH Mainnet derivation failed:', e.message);
    }

    return { chipnetWallet, mainnetWallet, chipnetAddress, mainnetAddress };
}

async function initializeWallet(seedPhrase: string) {
    const [evmSigner, solanaResult, btcResult, bchResult] = await Promise.all([
        deriveEvmWallet(seedPhrase),
        deriveSolanaSigner(seedPhrase),
        deriveBtcSigner(seedPhrase),
        deriveBchWallets(seedPhrase),
    ]);
    return {
        evmSigner,
        solanaSigner: solanaResult?.signer ?? null,
        solanaAccount: solanaResult?.account ?? null,
        solanaManager: solanaResult?.manager ?? null,
        btcAccount: btcResult?.account ?? null,
        btcManager: btcResult?.manager ?? null,
        bchChipnetWallet: bchResult.chipnetWallet,
        bchMainnetWallet: bchResult.mainnetWallet,
        evmAddress: evmSigner?.address ?? null,
        solanaAddress: solanaResult?.signer?.address ?? null,
        btcAddress: btcResult?.address ?? null,
        bchChipnetAddress: bchResult.chipnetAddress,
        bchMainnetAddress: bchResult.mainnetAddress,
    };
}

const BCH_NETWORK_KEY = 'wdk_bch_network';
const SESSION_TIMEOUT_MS = 15 * 60 * 1000;

function loadBchNetworkPref(): BchNetwork {
    try {
        return localStorage.getItem(BCH_NETWORK_KEY) === 'mainnet' ? 'mainnet' : 'chipnet';
    } catch {
        return 'chipnet';
    }
}

const EMPTY_STATE: WDKWalletState = {
    isInitialized: false,
    isLoading: false,
    seedPhrase: null,
    evmAddress: null,
    solanaAddress: null,
    btcAddress: null,
    bchChipnetAddress: null,
    bchMainnetAddress: null,
    bchNetwork: 'chipnet',
    evmSigner: null,
    solanaSigner: null,
    solanaAccount: null,
    solanaManager: null,
    btcAccount: null,
    btcManager: null,
    bchChipnetWallet: null,
    bchMainnetWallet: null,
    evmBalance: null,
    solanaBalance: null,
    error: null,
};

export function WDKProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<WDKWalletState>({
        ...EMPTY_STATE,
        bchNetwork: loadBchNetworkPref(),
    });

    // Restore session on mount
    useEffect(() => {
        if (state.isInitialized) return;
        const storedSeed = sessionStorage.getItem('wdk_session_seed');
        const lastActive = sessionStorage.getItem('wdk_session_last_active');
        if (!storedSeed || !lastActive) return;

        const timePassed = Date.now() - parseInt(lastActive, 10);
        if (timePassed >= SESSION_TIMEOUT_MS) {
            sessionStorage.removeItem('wdk_session_seed');
            return;
        }

        setState(s => ({ ...s, isLoading: true }));
        initializeWallet(storedSeed).then(init => {
            sessionStorage.setItem('wdk_session_last_active', Date.now().toString());
            setState(s => ({ ...s, isInitialized: true, isLoading: false, seedPhrase: storedSeed, ...init }));
        }).catch(() => {
            sessionStorage.removeItem('wdk_session_seed');
            setState(s => ({ ...s, isLoading: false }));
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Track activity to extend session
    useEffect(() => {
        if (!state.isInitialized) return;
        const update = () => sessionStorage.setItem('wdk_session_last_active', Date.now().toString());
        window.addEventListener('mousemove', update);
        window.addEventListener('keydown', update);
        window.addEventListener('click', update);
        return () => {
            window.removeEventListener('mousemove', update);
            window.removeEventListener('keydown', update);
            window.removeEventListener('click', update);
        };
    }, [state.isInitialized]);

    // Auto-lock on inactivity
    useEffect(() => {
        if (!state.isInitialized) return;
        const interval = setInterval(() => {
            const last = sessionStorage.getItem('wdk_session_last_active');
            if (last && Date.now() - parseInt(last, 10) > SESSION_TIMEOUT_MS) {
                sessionStorage.removeItem('wdk_session_seed');
                sessionStorage.removeItem('wdk_session_last_active');
                window.location.reload();
            }
        }, 60_000);
        return () => clearInterval(interval);
    }, [state.isInitialized]);

    const createWallet = useCallback(async (): Promise<string> => {
        setState(s => ({ ...s, isLoading: true, error: null }));
        try {
            const phrase = await generateSeedPhrase();
            const init = await initializeWallet(phrase);
            sessionStorage.setItem('wdk_session_seed', phrase);
            sessionStorage.setItem('wdk_session_last_active', Date.now().toString());
            setState(s => ({ ...s, isInitialized: true, isLoading: false, seedPhrase: phrase, ...init }));
            return phrase;
        } catch (e: any) {
            setState(s => ({ ...s, isLoading: false, error: e.message }));
            throw e;
        }
    }, []);

    const importWallet = useCallback(async (seedPhrase: string): Promise<void> => {
        setState(s => ({ ...s, isLoading: true, error: null }));
        try {
            const trimmed = seedPhrase.trim().toLowerCase();
            const words = trimmed.split(/\s+/);
            if (words.length !== 12 && words.length !== 24) throw new Error('Seed phrase must be 12 or 24 words');
            const init = await initializeWallet(trimmed);
            sessionStorage.setItem('wdk_session_seed', trimmed);
            sessionStorage.setItem('wdk_session_last_active', Date.now().toString());
            setState(s => ({ ...s, isInitialized: true, isLoading: false, seedPhrase: trimmed, ...init }));
        } catch (e: any) {
            setState(s => ({ ...s, isLoading: false, error: e.message }));
            throw e;
        }
    }, []);

    const unlockWallet = useCallback(async (password: string): Promise<boolean> => {
        setState(s => ({ ...s, isLoading: true, error: null }));
        try {
            const phrase = await decryptFromStorage(password);
            if (!phrase) {
                setState(s => ({ ...s, isLoading: false, error: 'Wrong password' }));
                return false;
            }
            const init = await initializeWallet(phrase);
            sessionStorage.setItem('wdk_session_seed', phrase);
            sessionStorage.setItem('wdk_session_last_active', Date.now().toString());
            setState(s => ({ ...s, isInitialized: true, isLoading: false, seedPhrase: phrase, ...init }));
            return true;
        } catch (e: any) {
            setState(s => ({ ...s, isLoading: false, error: e.message }));
            return false;
        }
    }, []);

    const saveWallet = useCallback(async (password: string): Promise<void> => {
        if (!state.seedPhrase) throw new Error('No wallet to save');
        await encryptAndStore(state.seedPhrase, password);
    }, [state.seedPhrase]);

    const setBchNetwork = useCallback((net: BchNetwork) => {
        try { localStorage.setItem(BCH_NETWORK_KEY, net); } catch {}
        setState(s => ({ ...s, bchNetwork: net }));
    }, []);

    const disconnect = useCallback(() => {
        try { state.solanaAccount?.dispose?.(); } catch {}
        try { state.solanaManager?.dispose?.(); } catch {}
        sessionStorage.removeItem('wdk_session_seed');
        sessionStorage.removeItem('wdk_session_last_active');
        setState({ ...EMPTY_STATE, bchNetwork: loadBchNetworkPref() });
    }, [state.solanaAccount, state.solanaManager]);

    const refreshBalances = useCallback(async () => {}, []);

    const { bchAddress, bchWallet } = useMemo(() => ({
        bchAddress: state.bchNetwork === 'chipnet' ? state.bchChipnetAddress : state.bchMainnetAddress,
        bchWallet: state.bchNetwork === 'chipnet' ? state.bchChipnetWallet : state.bchMainnetWallet,
    }), [state.bchNetwork, state.bchChipnetAddress, state.bchMainnetAddress, state.bchChipnetWallet, state.bchMainnetWallet]);

    return (
        <WDKContext.Provider value={{
            ...state,
            bchAddress,
            bchWallet,
            setBchNetwork,
            createWallet,
            importWallet,
            unlockWallet,
            saveWallet,
            disconnect,
            refreshBalances,
            hasStoredWallet: hasStoredWallet(),
        }}>
            {children}
        </WDKContext.Provider>
    );
}
