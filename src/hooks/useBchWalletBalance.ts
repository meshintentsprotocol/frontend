/**
 * useBchWalletBalance — per-wallet balance with HD multi-address support.
 *
 * For WizardConnect wallets: sums UTXOs across all scanned receive and change
 * addresses. For all other wallets (WalletConnect, extension, built-in): uses
 * the single wallet address via `useBchAddressBalance`.
 *
 * Phase 5: WizardConnect HD wallet
 */

import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ExternalWallet } from '@/lib/wallets/types';
import { addressSet } from '@/lib/wallets/wizardconnect';
import { type AddressBalance, fetchAddressBalance } from './useBchAddressBalance';

const EMPTY: AddressBalance = { sats: 0, tokens: {} };

/** Merge multiple AddressBalance results into one (sum sats + tokens). */
export function mergeBalances(balances: AddressBalance[]): AddressBalance {
    let sats = 0n;
    const tokens: Record<string, bigint> = {};
    for (const b of balances) {
        sats += BigInt(b.sats);
        for (const [cat, amt] of Object.entries(b.tokens)) {
            const key = cat.toLowerCase();
            tokens[key] = (tokens[key] ?? 0n) + BigInt(amt);
        }
    }
    return {
        sats: Number(sats),
        tokens: Object.fromEntries(Object.entries(tokens).map(([k, v]) => [k, v.toString()])),
    };
}

/** Fetch the combined balance for a WizardConnect wallet across all HD addresses. */
async function fetchHdWalletBalance(walletId: string, primaryAddress: string, isMainnet: boolean): Promise<AddressBalance> {
    const addresses = addressSet(walletId);
    // addressSet() returns at least [primaryAddress]; if scan not done it returns only that
    const all = addresses.length > 0 ? addresses : [primaryAddress];

    const balances = await Promise.all(
        all.map(addr => fetchAddressBalance(addr, isMainnet).catch(() => EMPTY))
    );
    return mergeBalances(balances);
}

// ─────────────────────────────────────────────────────────────────────────────

interface UseWalletBalanceOpts {
    wallet: ExternalWallet | null;
    isMainnet: boolean;
    refetchMs?: number;
}

/**
 * Hook: fetch balance for an external wallet.
 * WizardConnect wallets aggregate across all HD addresses.
 * All other wallets use a single-address query.
 */
export function useBchWalletBalance({ wallet, isMainnet, refetchMs }: UseWalletBalanceOpts) {
    const isWizardConnect = wallet?.source === 'wizardconnect';
    const network = isMainnet ? 'mainnet' : 'chipnet';

    const queryKey = isWizardConnect
        ? ['wiz-hd-balance', network, wallet!.id]
        : ['ext-bch-balance', network, wallet?.address ?? ''];

    const queryFn = useCallback(async (): Promise<AddressBalance> => {
        if (!wallet) return EMPTY;
        if (isWizardConnect) {
            return fetchHdWalletBalance(wallet.id, wallet.address, isMainnet);
        }
        return fetchAddressBalance(wallet.address, isMainnet);
    }, [wallet?.id, wallet?.address, wallet?.source, isMainnet]);

    const enabled = !!wallet;

    const query = useQuery<AddressBalance>({
        queryKey,
        queryFn,
        enabled,
        staleTime: 8_000,
        refetchInterval: refetchMs && refetchMs > 0 ? refetchMs : false,
        placeholderData: (prev, prevQuery) => {
            // Only keep previous data if it's for the same wallet
            const prevKey = prevQuery?.queryKey;
            if (!prevKey) return undefined;
            return prevKey[2] === queryKey[2] ? prev : undefined;
        },
        retry: 1,
    });

    const data = useMemo<AddressBalance>(() => query.data ?? EMPTY, [query.data]);
    const refetch = useCallback(async () => { await query.refetch(); }, [query.refetch]);

    return {
        data,
        isLoading: enabled && query.isLoading,
        isFetching: query.isFetching,
        isError: query.isError,
        refetch,
    };
}
