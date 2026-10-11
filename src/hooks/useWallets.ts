import { useMemo } from 'react';
import { useWDK } from '@/context/WDKProvider';
import { useExternalBCHWallet, type ExternalWalletSource } from '@/context/ExternalBCHWalletProvider';
import { useActiveWallet } from '@/hooks/useActiveWallet';
import { MAIN_WALLET_ID, defaultWalletColor, setWalletLook, useWalletLooks } from '@/lib/walletStore';

export type WalletKind = 'main' | ExternalWalletSource;

/** One connected BCH wallet, built-in or external, as the UI shows it. */
export interface ConnectedWallet {
    id: string;
    kind: WalletKind;
    /** Which icon to show: see components/wallet/WalletIcon.tsx. */
    iconId: string;
    /** The user's name for it, or the wallet's own label. */
    name: string;
    address: string;
    /** Hex colour. */
    color: string;
    active: boolean;
    /** Key its colour and name are stored under. */
    lookKey: string;
}

function iconFor(kind: WalletKind, label: string): string {
    if (kind === 'main') return 'main';
    if (kind === 'extension') return 'bch-intents';
    const l = label.toLowerCase();
    if (l.includes('cashonize')) return 'cashonize';
    if (l.includes('paytaca')) return 'paytaca';
    return 'walletconnect';
}

/**
 * Every wallet the user can act with, and which one is active. The built-in
 * wallet is listed while it is unlocked; external wallets while connected.
 */
export function useWallets() {
    const wdk = useWDK();
    const ext = useExternalBCHWallet();
    const { activeWalletId, setActiveWalletId } = useActiveWallet();
    const looks = useWalletLooks();

    const wallets = useMemo<ConnectedWallet[]>(() => {
        const list: ConnectedWallet[] = [];
        if (wdk.isInitialized && wdk.bchAddress) {
            list.push({
                id: MAIN_WALLET_ID, kind: 'main', iconId: 'main',
                name: looks[MAIN_WALLET_ID]?.name || 'Cham Wallet',
                address: wdk.bchAddress,
                color: looks[MAIN_WALLET_ID]?.color || defaultWalletColor(MAIN_WALLET_ID),
                active: activeWalletId === MAIN_WALLET_ID,
                lookKey: MAIN_WALLET_ID,
            });
        }
        for (const w of ext.wallets) {
            list.push({
                id: w.id, kind: w.source, iconId: iconFor(w.source, w.label),
                name: looks[w.address]?.name || w.label,
                address: w.address,
                color: looks[w.address]?.color || defaultWalletColor(w.address),
                active: activeWalletId === w.id,
                lookKey: w.address,
            });
        }
        return list;
    }, [wdk.isInitialized, wdk.bchAddress, ext.wallets, activeWalletId, looks]);

    const active = wallets.find(w => w.active) ?? null;

    return {
        wallets,
        active,
        /** True when the user has any wallet to act with, built-in or external. */
        hasWallet: wallets.length > 0,
        hasMainWallet: wdk.isInitialized,
        setActive: setActiveWalletId,
        setColor: (w: ConnectedWallet, color: string) => setWalletLook(w.lookKey, { color }),
        rename: (w: ConnectedWallet, name: string) => setWalletLook(w.lookKey, { name: name.trim().slice(0, 24) }),
    };
}

export const shortAddress = (address: string, head = 6, tail = 4) => {
    const bare = address.includes(':') ? address.slice(address.indexOf(':') + 1) : address;
    return bare.length > head + tail + 1 ? `${bare.slice(0, head)}…${bare.slice(-tail)}` : bare;
};
