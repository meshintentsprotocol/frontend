/**
 * The swap server's React context: its shape and the two hooks that read it. No component lives here, so the
 * provider file exports components only and fast refresh keeps working.
 */
import { createContext, useContext } from 'react';
import type { SwapServerApi } from './api';
import type { Operation } from './steps';
import type { ActivityItem, CctpChain, SwapServerConfig, Transfer } from './types';

export type HistoryView = 'auto' | 'orders' | 'swap-server';

export interface SwapServerContextValue {
    api: SwapServerApi;
    /** Called by whatever shows swap-server data. Until something has, the provider fetches nothing. */
    activate: () => void;
    isMainnet: boolean;
    config?: SwapServerConfig;
    configLoading: boolean;
    /** Set when the server could not be reached or refused. */
    configError?: string;
    chain: (key: string) => CctpChain | undefined;
    evmAddress: string | null;
    solanaAddress: string | null;

    /** The wallet's records for the current mode (testnet: cross-chain USDC; mainnet: Solana swaps), newest first. */
    rows: ActivityItem[];
    /** When `rows` arrived, for countdowns. */
    rowsReceivedAt: number;
    rowsLoading: boolean;
    openCount: number;
    /** Records past their burn and not yet delivered, including one held for its fee. */
    activeCount: number;
    refresh: () => void;

    /** The transfer this page is signing, or has just signed. */
    operation: Operation | null;
    bridge: (input: { src: CctpChain; dst: CctpChain; amount: string }) => Promise<Transfer | undefined>;
    resume: (id: string) => Promise<void>;
    sendFee: (id: string) => Promise<void>;

    /** The processing dialog: open, and on which record. `null` follows the current operation. */
    dialog: { open: boolean; id: string | null };
    showDialog: (id?: string | null) => void;
    hideDialog: () => void;

    /** Which history the trade page shows. The card reports whether its pair is one of ours. */
    historyView: HistoryView;
    setHistoryView: (v: HistoryView) => void;
    /** True when the trade page should show this module's history instead of the order history. */
    historyOurs: boolean;
    pairRouted: boolean;
    setPairRouted: (routed: boolean) => void;
}

export const SwapServerContext = createContext<SwapServerContextValue | null>(null);

export function useSwapServer(): SwapServerContextValue {
    const v = useContext(SwapServerContext);
    if (!v) throw new Error('useSwapServer must be used within SwapServerProvider');
    return v;
}

/** For components that also render outside the provider (embedded cards, tests). */
export function useSwapServerOptional(): SwapServerContextValue | null {
    return useContext(SwapServerContext);
}
