/**
 * useBchAddressBalance — fetch BCH + CashToken balances for any address.
 *
 * Unlike useBchBalances (which requires a mainnet-js wallet with private key),
 * this hook works with a raw address string, so it serves external wallets
 * (WalletConnect / WizardConnect / the browser extension) and the wallet list
 * in the header alike.
 *
 * It reads the address's UTXOs over Electrum (lib/bchElectrum.ts) — the same
 * source transactions are built from. The REST endpoints this used before
 * stopped answering browsers (redirects and gateway errors without CORS
 * headers), which left every external wallet showing a zero balance.
 */

import { useCallback, useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';

export interface AddressBalance {
    /** Spendable BCH in satoshis: the UTXOs that carry no token. */
    sats: number;
    /** CashToken category → aggregated fungible amount (base unit, string). */
    tokens: Record<string, string>;
}

const EMPTY: AddressBalance = { sats: 0, tokens: {} };

/**
 * Ensure the address carries the cashaddr prefix matching the network being
 * queried. A bare payload (no prefix) must not be hardcoded to `bitcoincash:` —
 * on chipnet that produces a mainnet-prefixed address the server can't resolve.
 */
function withNetworkPrefix(address: string, isMainnet: boolean): string {
    if (address.includes(':')) return address;
    return `${isMainnet ? 'bitcoincash' : 'bchtest'}:${address}`;
}

/**
 * Fetch full balance data for any BCH address (no private key needed).
 * Throws when the server cannot be reached, so the previous balance is kept
 * instead of flashing zero.
 */
export async function fetchAddressBalance(address: string, isMainnet: boolean): Promise<AddressBalance> {
    // Loaded on demand: cashscript and its Electrum client are heavy.
    const { getAddressUtxos } = await import('@/lib/bchElectrum');
    const utxos = await getAddressUtxos(withNetworkPrefix(address, isMainnet), isMainnet ? 'mainnet' : 'chipnet');

    let sats = 0n;
    const tokens: Record<string, bigint> = {};
    for (const u of utxos) {
        if (!u.token) { sats += u.satoshis; continue; }
        if (u.token.amount > 0n) {
            const category = u.token.category.toLowerCase();
            tokens[category] = (tokens[category] ?? 0n) + u.token.amount;
        }
    }
    return {
        sats: Number(sats),
        tokens: Object.fromEntries(Object.entries(tokens).map(([category, amount]) => [category, amount.toString()])),
    };
}

// ─────────────────────────────────────────────────────────────────────────────

interface UseBchAddressBalanceOpts {
    address: string | null;
    isMainnet: boolean;
    /** Polling interval in ms (0 or omit to disable). */
    refetchMs?: number;
}

export function useBchAddressBalance({ address, isMainnet, refetchMs }: UseBchAddressBalanceOpts) {
    const enabled = !!address;
    const queryKey = ['ext-bch-balance', isMainnet ? 'mainnet' : 'chipnet', address ?? ''] as const;

    const query = useQuery<AddressBalance>({
        queryKey,
        enabled,
        staleTime: 8_000,
        refetchInterval: refetchMs && refetchMs > 0 ? refetchMs : false,
        placeholderData: keepPreviousData,
        retry: 1,
        queryFn: () => fetchAddressBalance(address!, isMainnet),
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
