/**
 * useBchBalances — shared BCH balance queries.
 *
 * The native BCH balance and the CashToken balances are fetched as TWO
 * independent queries:
 *
 *   • native balance — a single cheap `getBalance()` call → polled fast,
 *     and `isLoading` reflects ONLY this query so the BCH amount renders the
 *     moment it resolves.
 *   • CashToken balances — a full UTXO scan (`getTokenUtxos()`), which is
 *     much heavier → polled ~4× slower and never blocks the native balance.
 *
 * Both usePortfolio and BCHWalletProvider call this hook; TanStack Query
 * de-duplicates them onto one cache entry per query.
 */

import { useCallback, useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useWDK } from '@/context/WDKProvider';
import { readPersisted } from '@/lib/persist';

export interface BchBalances {
    /** Spendable BCH balance, in satoshis. */
    sats: number;
    /** CashToken category → aggregated fungible amount (base unit, as string). */
    tokens: Record<string, string>;
}

const TOKEN_INTERVAL_MULTIPLIER = 4;
const TOKEN_INTERVAL_FLOOR_MS = 20_000;

/**
 * @param refetchMs Native-balance polling interval in ms (omit to disable).
 *                  The CashToken scan polls at 4× this (minimum 20s).
 */
export function useBchBalances(refetchMs?: number) {
    const { bchWallet, bchAddress, bchNetwork } = useWDK();
    const enabled = !!bchWallet && !!bchAddress;

    const balanceKey = ['bch-balance', bchNetwork, bchAddress ?? ''] as const;
    const tokensKey = ['bch-tokens', bchNetwork, bchAddress ?? ''] as const;

    const tokenInterval = refetchMs
        ? Math.max(refetchMs * TOKEN_INTERVAL_MULTIPLIER, TOKEN_INTERVAL_FLOOR_MS)
        : (false as const);

    // ── Native BCH balance (fast — the figure the user watches) ───────────────
    const balanceQuery = useQuery<number>({
        queryKey: balanceKey,
        enabled,
        staleTime: 5_000,
        refetchInterval: refetchMs ?? false,
        placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[2] === bchAddress ? prev : undefined),
        initialData: () => readPersisted<number>([...balanceKey])?.data,
        initialDataUpdatedAt: () => readPersisted([...balanceKey])?.updatedAt,
        queryFn: async (): Promise<number> => {
            // Throwing on failure keeps the previous balance instead of flashing
            // 0. getBalance('sat') returns a plain number.
            const sats = Number(await bchWallet.getBalance('sat'));
            if (!Number.isFinite(sats)) {
                throw new Error('BCH getBalance returned a non-numeric value');
            }
            return sats;
        },
    });

    // ── CashToken balances (slow — never blocks the native balance) ───────────
    const tokensQuery = useQuery<Record<string, string>>({
        queryKey: tokensKey,
        enabled,
        staleTime: 15_000,
        refetchInterval: tokenInterval,
        placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[2] === bchAddress ? prev : undefined),
        initialData: () => readPersisted<Record<string, string>>([...tokensKey])?.data,
        initialDataUpdatedAt: () => readPersisted([...tokensKey])?.updatedAt,
        queryFn: async (): Promise<Record<string, string>> => {
            const tokens: Record<string, string> = {};
            const utxos = await bchWallet.getTokenUtxos?.();
            if (Array.isArray(utxos)) {
                for (const u of utxos) {
                    const category = u.token?.category;
                    if (!category) continue;
                    const prev = BigInt(tokens[category] ?? '0');
                    tokens[category] = (prev + BigInt(u.token.amount ?? 0)).toString();
                }
            }
            return tokens;
        },
    });

    const refetch = useCallback(async () => {
        const results = await Promise.all([balanceQuery.refetch(), tokensQuery.refetch()]);
        const error = results.find(result => result.error)?.error;
        if (error) throw error;
    }, [balanceQuery.refetch, tokensQuery.refetch]);

    // Stable reference — only changes when the balance or tokens actually
    // change. Without this the object is recreated every render, which would
    // make every consumer's useMemo (portfolio tokens, total, chart) recompute
    // on each render and re-animate the chart on every poll tick.
    const data = useMemo<BchBalances>(() => ({
        sats: balanceQuery.data ?? 0,
        tokens: tokensQuery.data ?? {},
    }), [balanceQuery.data, tokensQuery.data]);

    return {
        data,
        // "loading" reflects ONLY the native balance — the critical figure.
        isLoading: enabled && balanceQuery.isLoading,
        isFetching: balanceQuery.isFetching || tokensQuery.isFetching,
        isError: balanceQuery.isError,
        refetch,
    };
}
