/**
 * walletUi — which of the app-wide wallet surfaces is open.
 *
 * The wallet panel, the Orders & History board and the order details card are each
 * mounted once (components/wallet/WalletUiRoot.tsx). The wallet panel is one frame:
 * connecting a wallet and creating, importing or unlocking the built-in one are
 * views inside it, not windows of their own. Anything can open them from here: the
 * header, the swap card's wallet chip, a row in a list. Before this each
 * "Connect" button carried its own copy of every one of them.
 *
 * A module-level store read through useSyncExternalStore, like lib/walletStore.ts.
 */

import { useSyncExternalStore } from 'react';

export type WalletTopTab = 'wallet' | 'notifications';
export type WalletSubTab = 'tokens' | 'pools' | 'orders' | 'settings';
/** What the wallet frame shows: the wallet itself, the connect flow, or the built-in wallet's create / import / unlock. */
export type WalletView = 'home' | 'connect' | 'onboarding';
/** The kinds the Orders & History board can be narrowed to. */
export type OrdersFilter = 'all' | 'swap' | 'limit' | 'twap' | 'bridge';

/** The order the details card is showing. Swap-server records have their own dialog (swap-server/ProcessingDialog). */
export interface OrderRef {
    source: 'bch' | 'twap';
    id: string;
}

export interface WalletUiState {
    wallet: boolean;
    walletView: WalletView;
    walletTab: WalletTopTab;
    /** Set when the opener asks for a particular tab; the panel keeps its own tab otherwise. */
    walletSub: WalletSubTab | null;
    orders: boolean;
    ordersFilter: OrdersFilter | null;
    order: OrderRef | null;
}

let state: WalletUiState = {
    wallet: false, walletView: 'home', walletTab: 'wallet', walletSub: null,
    orders: false, ordersFilter: null,
    order: null,
};

const listeners = new Set<() => void>();

function set(patch: Partial<WalletUiState>) {
    state = { ...state, ...patch };
    for (const l of listeners) l();
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export const walletUi = {
    openWallet: (tab: WalletTopTab = 'wallet', sub: WalletSubTab | null = null) => set({ wallet: true, walletView: 'home', walletTab: tab, walletSub: sub }),
    closeWallet: () => set({ wallet: false, walletView: 'home', walletSub: null }),
    toggleWallet: () => (state.wallet ? walletUi.closeWallet() : walletUi.openWallet()),
    setWalletTab: (tab: WalletTopTab) => set({ walletTab: tab }),

    openOrders: (filter: OrdersFilter | null = null) => set({ orders: true, ordersFilter: filter }),
    closeOrders: () => set({ orders: false, ordersFilter: null }),

    /** The connect flow, inside the wallet frame. */
    openConnect: () => set({ wallet: true, walletView: 'connect' }),
    /** The built-in wallet: create, import or unlock, inside the wallet frame. */
    openOnboarding: () => set({ wallet: true, walletView: 'onboarding' }),
    /** Back to the wallet itself. */
    showHome: () => set({ walletView: 'home' }),

    openOrder: (order: OrderRef) => set({ order }),
    closeOrder: () => set({ order: null }),
};

export function useWalletUi(): WalletUiState {
    return useSyncExternalStore(subscribe, () => state, () => state);
}
