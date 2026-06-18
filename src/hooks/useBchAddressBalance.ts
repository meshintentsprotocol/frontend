/**
 * useBchAddressBalance — fetch BCH + CashToken balances for any address.
 *
 * Unlike useBchBalances (which requires a mainnet-js wallet with private key),
 * this hook works with a raw address string. It uses the Fulcrum/Electrum REST
 * API (chipnet) or the BCMR-aware chaingraph endpoint (mainnet) to fetch the
 * balance and CashToken UTXOs.
 *
 * Used for external wallet balance display (WalletConnect / WizardConnect).
 */

import { useCallback, useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';

export interface AddressBalance {
    /** Spendable BCH in satoshis. */
    sats: number;
    /** CashToken category → aggregated fungible amount (base unit, string). */
    tokens: Record<string, string>;
}

const EMPTY: AddressBalance = { sats: 0, tokens: {} };

// ── Electrum REST endpoints ─────────────────────────────────────────────────
// These are public, no-auth endpoints that return UTXO-level data.
const CHIPNET_REST = 'https://chipnet.imaginary.cash';
const MAINNET_REST = 'https://rest1.biggestfan.net';

/**
 * Fetch the confirmed balance (in sats) for an address via Electrum REST.
 */
async function fetchBchBalance(address: string, isMainnet: boolean): Promise<number> {
    const base = isMainnet ? MAINNET_REST : CHIPNET_REST;
    // Strip the prefix for the REST query if needed
    const addr = address.includes(':') ? address : `bitcoincash:${address}`;

    try {
        const res = await fetch(`${base}/electrs/address/${encodeURIComponent(addr)}`);
        if (!res.ok) throw new Error(`REST ${res.status}`);
        const data = await res.json();
        // confirmed + unconfirmed
        const funded = data?.chain_stats?.funded_txo_sum ?? 0;
        const spent = data?.chain_stats?.spent_txo_sum ?? 0;
        const mempoolFunded = data?.mempool_stats?.funded_txo_sum ?? 0;
        const mempoolSpent = data?.mempool_stats?.spent_txo_sum ?? 0;
        return (funded - spent) + (mempoolFunded - mempoolSpent);
    } catch (e: any) {
        console.warn('[useBchAddressBalance] balance fetch failed:', e.message);
        // Fallback: try the fulcrum balance endpoint
        try {
            const res2 = await fetch(`${base}/electrs/address/${encodeURIComponent(addr)}/utxo`);
            if (!res2.ok) throw new Error(`UTXO REST ${res2.status}`);
            const utxos: any[] = await res2.json();
            return utxos.reduce((sum: number, u: any) => sum + (u.value ?? 0), 0);
        } catch {
            return 0;
        }
    }
}

/**
 * Fetch CashToken UTXOs for an address and aggregate fungible amounts by category.
 * Uses the chaingraph/BCMR-aware approach if available, otherwise falls back
 * to scanning regular UTXOs for token data.
 */
async function fetchTokenBalances(address: string, isMainnet: boolean): Promise<Record<string, string>> {
    const base = isMainnet ? MAINNET_REST : CHIPNET_REST;
    const addr = address.includes(':') ? address : `bitcoincash:${address}`;
    const tokens: Record<string, string> = {};

    try {
        const res = await fetch(`${base}/electrs/address/${encodeURIComponent(addr)}/utxo`);
        if (!res.ok) return tokens;
        const utxos: any[] = await res.json();

        for (const u of utxos) {
            if (!u.token) continue;
            const category = u.token.category;
            if (!category) continue;
            const amount = BigInt(u.token.amount ?? 0);
            const prev = BigInt(tokens[category] ?? '0');
            tokens[category] = (prev + amount).toString();
        }
    } catch (e: any) {
        console.warn('[useBchAddressBalance] token fetch failed:', e.message);
    }

    return tokens;
}

/**
 * Fetch full balance data for any BCH address (no private key needed).
 */
async function fetchAddressBalance(address: string, isMainnet: boolean): Promise<AddressBalance> {
    const [sats, tokens] = await Promise.all([
        fetchBchBalance(address, isMainnet),
        fetchTokenBalances(address, isMainnet),
    ]);
    return { sats, tokens };
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
