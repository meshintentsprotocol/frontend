import { useMemo, useCallback } from 'react';
import { useWDK } from '@/context/WDKProvider';
import { useExternalBCHWallet, type ExternalWalletSource } from '@/context/ExternalBCHWalletProvider';
import {
    MAIN_WALLET_ID,
    defaultWalletColor,
    setWalletLook,
    useWalletLooks,
    useActiveWalletId,
    setActiveWalletId,
} from '@/lib/walletStore';
import { ChainFamily, appNetworkOf } from '@/lib/wallets/types';

export type WalletKind = 'main' | ExternalWalletSource | 'appkit';

/** One connected wallet, built-in or external, as the UI shows it. */
export interface ConnectedWallet {
    id: string;
    family: ChainFamily;
    kind: WalletKind;
    /** Which icon to show: see components/wallet/WalletIcon.tsx. */
    iconId: string;
    /** Direct image URL from session metadata */
    iconUrl?: string;
    /** The user's name for it, or the wallet's own label. */
    name: string;
    address: string;
    /** Hex colour. */
    color: string;
    active: boolean;
    /** Key its colour and name are stored under. */
    lookKey: string;
}

export interface WalletGroup {
    family: ChainFamily;
    wallets: ConnectedWallet[];
}

const FAMILIES: ChainFamily[] = ['bch', 'evm', 'solana', 'btc'];

function iconFor(kind: WalletKind, label: string): string {
    if (kind === 'main') return 'main';
    if (kind === 'extension') return 'bch-intents';
    const l = label.toLowerCase();
    if (l.includes('cashonize')) return 'cashonize';
    if (l.includes('paytaca')) return 'paytaca';
    if (l.includes('metamask')) return 'metamask';
    if (l.includes('phantom')) return 'phantom';
    return 'walletconnect';
}

/**
 * Every wallet the user can act with on the current network, and which one is active per chain.
 * Phase 0: Foundation
 */
export function useWallets() {
    const wdk = useWDK();
    const ext = useExternalBCHWallet();
    const activeBchId = useActiveWalletId('bch');
    const activeEvmId = useActiveWalletId('evm');
    const activeSolanaId = useActiveWalletId('solana');
    const activeBtcId = useActiveWalletId('btc');
    const looks = useWalletLooks();

    const currentNetwork = appNetworkOf(wdk.bchNetwork);

    const wallets = useMemo<ConnectedWallet[]>(() => {
        const list: ConnectedWallet[] = [];

        // BCH Built-in wallet (active on current network when unlocked)
        if (wdk.isInitialized && wdk.bchAddress) {
            list.push({
                id: MAIN_WALLET_ID,
                family: 'bch',
                kind: 'main',
                iconId: 'main',
                name: looks[MAIN_WALLET_ID]?.name || 'Cham Wallet',
                address: wdk.bchAddress,
                color: looks[MAIN_WALLET_ID]?.color || defaultWalletColor(MAIN_WALLET_ID),
                active: activeBchId === MAIN_WALLET_ID,
                lookKey: MAIN_WALLET_ID,
            });
        }

        // Visible external wallets on current network
        const visibleExt = ext.allWallets.filter(w => w.network === currentNetwork);
        for (const w of visibleExt) {
            const isActive =
                w.family === 'bch' ? activeBchId === w.id :
                w.family === 'evm' ? activeEvmId === w.id :
                w.family === 'solana' ? activeSolanaId === w.id :
                activeBtcId === w.id;

            list.push({
                id: w.id,
                family: w.family,
                kind: w.source,
                iconId: iconFor(w.source as WalletKind, w.label),
                iconUrl: w.icon,
                name: looks[w.address]?.name || w.label,
                address: w.address,
                color: looks[w.address]?.color || defaultWalletColor(w.address),
                active: isActive,
                lookKey: w.address,
            });
        }

        return list;
    }, [
        wdk.isInitialized,
        wdk.bchAddress,
        ext.allWallets,
        currentNetwork,
        activeBchId,
        activeEvmId,
        activeSolanaId,
        activeBtcId,
        looks,
    ]);

    const activeFor = useCallback(
        (family: ChainFamily = 'bch'): ConnectedWallet | null => {
            return wallets.find(w => w.family === family && w.active) ?? null;
        },
        [wallets]
    );

    const active = activeFor('bch');

    /**
     * The wallets per chain, for the switcher. A chain other than BCH is listed once an
     * external wallet is connected on it, with the built-in wallet first so the user can
     * switch back to it (it is active whenever no external wallet of that chain is).
     */
    const groups = useMemo<WalletGroup[]>(() => {
        const builtInAddress: Record<Exclude<ChainFamily, 'bch'>, string | null | undefined> = {
            evm: wdk.evmAddress,
            solana: wdk.solanaAddress,
            btc: currentNetwork === 'mainnet' ? (wdk.btcMainnetAddress || wdk.btcAddress) : (wdk.btcTestnetAddress || wdk.btcAddress),
        };
        const out: WalletGroup[] = [];
        for (const family of FAMILIES) {
            const own = wallets.filter(w => w.family === family);
            if (family === 'bch') {
                if (own.length > 0) out.push({ family, wallets: own });
                continue;
            }
            if (own.length === 0) continue;
            const builtIn = wdk.isInitialized ? builtInAddress[family] : null;
            const rows = builtIn
                ? [{
                    id: MAIN_WALLET_ID,
                    family,
                    kind: 'main' as const,
                    iconId: 'main',
                    name: looks[MAIN_WALLET_ID]?.name || 'Cham Wallet',
                    address: builtIn,
                    color: looks[MAIN_WALLET_ID]?.color || defaultWalletColor(MAIN_WALLET_ID),
                    active: !own.some(w => w.active),
                    lookKey: MAIN_WALLET_ID,
                }, ...own]
                : own;
            out.push({ family, wallets: rows });
        }
        return out;
    }, [wallets, looks, currentNetwork, wdk.isInitialized, wdk.evmAddress, wdk.solanaAddress, wdk.btcAddress, wdk.btcMainnetAddress, wdk.btcTestnetAddress]);

    /** The wallet the header shows: the active BCH wallet, else the active wallet of another chain. */
    const primary = active ?? FAMILIES.map(f => activeFor(f)).find(Boolean) ?? null;

    const setActive = useCallback((id: string | null, family: ChainFamily = 'bch') => {
        setActiveWalletId(id, family);
    }, []);

    return {
        wallets,
        groups,
        active,
        primary,
        activeFor,
        /** True when the user has any wallet to act with, built-in or external. */
        hasWallet: wallets.length > 0,
        hasMainWallet: wdk.isInitialized,
        setActive,
        setColor: (w: ConnectedWallet, color: string) => setWalletLook(w.lookKey, { color }),
        rename: (w: ConnectedWallet, name: string) => setWalletLook(w.lookKey, { name: name.trim().slice(0, 24) }),
    };
}

export const shortAddress = (address: string, head = 6, tail = 4) => {
    const bare = address.includes(':') ? address.slice(address.indexOf(':') + 1) : address;
    return bare.length > head + tail + 1 ? `${bare.slice(0, head)}…${bare.slice(-tail)}` : bare;
};
