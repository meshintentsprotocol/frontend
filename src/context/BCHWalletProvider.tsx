/**
 * BCH Wallet Provider — WDK bridge
 *
 * Maintains the same BCHWalletContextType interface so BCHSwapContext and
 * BCHSwapCard need zero changes. State is derived from WDKProvider, which
 * owns the seed and derives the mainnet-js wallet internally.
 */

import { createContext, useContext, useCallback, useMemo, type ReactNode } from 'react';
import { useWDK } from '@/context/WDKProvider';
import { useBchBalances } from '@/hooks/useBchBalances';

export type BCHWalletMode = 'wdk' | 'cashonize' | 'browser' | null;

interface BCHWalletContextType {
    connected: boolean;
    connecting: boolean;
    walletMode: BCHWalletMode;
    address: string | null;
    tokenAddress: string | null;
    balance: number;
    tokenBalances: Record<string, bigint>;
    connectCashonize: () => Promise<void>;
    connectBrowserWallet: () => Promise<void>;
    disconnect: () => void;
    refreshBalance: () => Promise<void>;
    getWIF: () => string | null;
    // Legacy internal fields kept as no-ops for CashonizeBridge compat
    _setCashonizeState: (s: { address: string; tokenAddress: string; balance: number }) => void;
    _requestCashonizeConnect: boolean;
    _onCashonizeConnected: () => void;
}

const BCHWalletContext = createContext<BCHWalletContextType | undefined>(undefined);

export function BCHWalletProvider({ children }: { children: ReactNode }) {
    const wdk = useWDK();

    const connected = wdk.isInitialized && !!wdk.bchAddress;
    const address = wdk.bchAddress;
    const tokenAddress = wdk.bchWallet
        ? ((wdk.bchWallet as any).tokenaddr ?? address)
        : address;

    // Balance comes from the shared BCH query — no separate polling loop. When
    // the popup/portfolio mounts usePortfolio it polls faster; otherwise this
    // 8s interval keeps swap-flow components reasonably fresh.
    const bchQuery = useBchBalances(8_000);
    const balance = bchQuery.data.sats;

    const tokenBalances = useMemo<Record<string, bigint>>(() => {
        const out: Record<string, bigint> = {};
        for (const [category, amount] of Object.entries(bchQuery.data.tokens)) {
            try { out[category] = BigInt(amount); } catch { /* skip malformed */ }
        }
        return out;
    }, [bchQuery.data.tokens]);

    const refreshBalance = useCallback(async () => {
        await bchQuery.refetch();
    }, [bchQuery.refetch]);

    // WDK exposes the mainnet-js wallet directly — return its WIF for signing
    const getWIF = useCallback((): string | null => {
        return (wdk.bchWallet as any)?.privateKeyWif ?? null;
    }, [wdk.bchWallet]);

    // These are no-ops; the WDK onboarding modal handles wallet creation
    const connectCashonize = useCallback(async () => {}, []);
    const connectBrowserWallet = useCallback(async () => {}, []);

    return (
        <BCHWalletContext.Provider value={{
            connected,
            connecting: wdk.isLoading,
            walletMode: connected ? 'wdk' : null,
            address,
            tokenAddress,
            balance,
            tokenBalances,
            connectCashonize,
            connectBrowserWallet,
            disconnect: wdk.disconnect,
            refreshBalance,
            getWIF,
            _setCashonizeState: () => {},
            _requestCashonizeConnect: false,
            _onCashonizeConnected: () => {},
        }}>
            {children}
        </BCHWalletContext.Provider>
    );
}

/** Pass-through — Cashonize is replaced by WDK; kept for App.tsx import compat. */
export function CashonizeProvider({ children }: { children: ReactNode }) {
    return <>{children}</>;
}

export function useBCHWallet() {
    const ctx = useContext(BCHWalletContext);
    if (!ctx) throw new Error('useBCHWallet must be used within BCHWalletProvider');
    return ctx;
}
