/**
 * Active accounts per chain family.
 *
 * Computes which account (built-in or external) is currently active
 * for each chain family: BCH, EVM, Solana, and Bitcoin.
 *
 * Phase 4: Portfolio, Send, Receive and Mesh NFTs for external wallets
 */

import { useMemo } from 'react';
import { useWDK } from '@/context/WDKProvider';
import { useExternalWallets } from '@/lib/wallets/registry';
import {
    MAIN_WALLET_ID,
    useActiveWalletId,
    useWalletLooks,
    defaultWalletColor,
    type WalletLook,
} from '@/lib/walletStore';
import {
    AppNetwork,
    ChainFamily,
    ExternalSource,
    ExternalWallet,
    appNetworkOf,
} from '@/lib/wallets/types';

export interface ActiveAccount {
    family: ChainFamily;
    walletId: string;
    kind: 'main' | ExternalSource;
    label: string;
    address: string;
    color: string;
}

export interface ActiveAccounts {
    bch?: ActiveAccount;
    evm?: ActiveAccount;
    solana?: ActiveAccount;
    btc?: ActiveAccount;
}

export interface ResolveAccountsParams {
    network: AppNetwork;
    activeIds: {
        bch: string | null;
        evm: string | null;
        solana: string | null;
        btc: string | null;
    };
    builtIn: {
        isInitialized: boolean;
        bchAddress: string | null;
        evmAddress: string | null;
        solanaAddress: string | null;
        btcAddress: string | null;
    };
    externalWallets: ExternalWallet[];
    looks: Record<string, WalletLook>;
}

/**
 * Pure resolver to compute active accounts per chain family.
 */
export function resolveActiveAccounts({
    network,
    activeIds,
    builtIn,
    externalWallets,
    looks,
}: ResolveAccountsParams): ActiveAccounts {
    const result: ActiveAccounts = {};
    const families: ChainFamily[] = ['bch', 'evm', 'solana', 'btc'];

    for (const family of families) {
        const activeId = activeIds[family];
        const builtInAddr =
            family === 'bch' ? builtIn.bchAddress :
            family === 'evm' ? builtIn.evmAddress :
            family === 'solana' ? builtIn.solanaAddress :
            builtIn.btcAddress;

        // If an external wallet is active for this family
        if (activeId && activeId !== MAIN_WALLET_ID) {
            const ext = externalWallets.find(
                w => w.id === activeId && w.family === family && w.network === network
            );
            if (ext) {
                result[family] = {
                    family,
                    walletId: ext.id,
                    kind: ext.source,
                    label: looks[ext.address]?.name || ext.label,
                    address: ext.address,
                    color: looks[ext.address]?.color || defaultWalletColor(ext.address),
                };
                continue;
            }
        }

        // Default or fallback to built-in wallet if initialized and address exists
        if (builtIn.isInitialized && builtInAddr) {
            result[family] = {
                family,
                walletId: MAIN_WALLET_ID,
                kind: 'main',
                label: looks[MAIN_WALLET_ID]?.name || 'Cham Wallet',
                address: builtInAddr,
                color: looks[MAIN_WALLET_ID]?.color || defaultWalletColor(MAIN_WALLET_ID),
            };
        }
    }

    return result;
}

export function useActiveAccounts(): ActiveAccounts {
    const wdk = useWDK();
    const allWallets = useExternalWallets();
    const activeBchId = useActiveWalletId('bch');
    const activeEvmId = useActiveWalletId('evm');
    const activeSolanaId = useActiveWalletId('solana');
    const activeBtcId = useActiveWalletId('btc');
    const looks = useWalletLooks();

    const network = appNetworkOf(wdk.bchNetwork);
    const bchAddress = network === 'mainnet' ? wdk.bchMainnetAddress : wdk.bchChipnetAddress;
    const btcAddress = network === 'mainnet' ? (wdk.btcMainnetAddress || wdk.btcAddress) : (wdk.btcTestnetAddress || wdk.btcAddress);

    return useMemo(() => {
        return resolveActiveAccounts({
            network,
            activeIds: {
                bch: activeBchId,
                evm: activeEvmId,
                solana: activeSolanaId,
                btc: activeBtcId,
            },
            builtIn: {
                isInitialized: wdk.isInitialized,
                bchAddress: bchAddress || wdk.bchAddress || null,
                evmAddress: wdk.evmAddress || null,
                solanaAddress: wdk.solanaAddress || null,
                btcAddress: btcAddress || null,
            },
            externalWallets: allWallets,
            looks,
        });
    }, [
        network,
        activeBchId,
        activeEvmId,
        activeSolanaId,
        activeBtcId,
        wdk.isInitialized,
        bchAddress,
        wdk.bchAddress,
        wdk.evmAddress,
        wdk.solanaAddress,
        btcAddress,
        allWallets,
        looks,
    ]);
}
