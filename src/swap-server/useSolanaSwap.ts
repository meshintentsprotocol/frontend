/**
 * The React side of Solana swaps (mainnet, through the swap server and Jupiter): the token list for the
 * selector, the wallet's balances, and the quote for the card. All of it is off outside mainnet mode.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ethers } from 'ethers';
import type { Token } from '@/types';
import { SwapServerError } from './api';
import { useSwapServerOptional } from './context';
import { jupiterToken, toBaseUnits } from './solana';
import type { SolanaQuote } from './types';

function useDebounced<T>(value: T, ms: number): T {
    const [v, setV] = useState(value);
    useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
    return v;
}

const retry = (n: number, e: unknown) => n < 2 && e instanceof SwapServerError && (e.status === 0 || e.status === 429 || e.status >= 500);

/** Jupiter's verified tokens, most liquid first: what the selector lists before anyone types. */
export function useSolanaTokenList(enabled: boolean) {
    const ctx = useSwapServerOptional();
    return useQuery({
        queryKey: ['swap-server', 'sol-tokens'],
        queryFn: ({ signal }) => ctx!.api.getSolTokens({ sort: 'liquidity', limit: 60 }, { signal }),
        enabled: enabled && !!ctx?.config?.solana.enabled,
        staleTime: 5 * 60_000, retry,
    }).data?.tokens;
}

/**
 * Search for the selector: the verified list first, then everything Jupiter indexes (unverified tokens are
 * marked as such by the row). A pasted mint goes straight to the wide search.
 */
export function useSolanaTokenSearch(enabled: boolean) {
    const ctx = useSwapServerOptional();
    const api = ctx?.api;
    const on = enabled && !!ctx?.config?.solana.enabled;
    const search = useCallback(async (q: string): Promise<Token[]> => {
        if (!api || q.length < 2) return [];
        const looksLikeMint = q.length >= 32 && !/\s/.test(q);
        const verified = looksLikeMint ? [] : (await api.getSolTokens({ q, sort: 'liquidity', limit: 20 }).catch(() => ({ tokens: [] }))).tokens;
        const wide = verified.length >= 5 ? [] : (await api.searchSolTokens(q).catch(() => ({ tokens: [] }))).tokens;
        const seen = new Set<string>();
        return [...verified, ...wide].filter(t => !seen.has(t.mint) && seen.add(t.mint)).slice(0, 30).map(jupiterToken);
    }, [api]);
    return on ? search : undefined;
}

/** What the in-app wallet holds on Solana mainnet, by mint. */
export function useSolanaBalances(enabled: boolean) {
    const ctx = useSwapServerOptional();
    const owner = ctx?.solanaAddress;
    return useQuery({
        queryKey: ['swap-server', 'sol-balances', owner],
        queryFn: ({ signal }) => ctx!.api.getSolBalances(owner!, { signal }),
        enabled: enabled && !!owner && !!ctx?.config?.solana.enabled,
        staleTime: 10_000, refetchInterval: 30_000, retry,
    }).data?.balances;
}

export interface SolanaCardQuote {
    amountBase?: string;
    quote?: SolanaQuote;
    error: unknown;
    fetching: boolean;
    settled: boolean;
    buyAmount: string;
    sellBalance: number | null;
}

/** The Jupiter quote for the card's pair and amount, asked with the wallet so Jupiter also checks it can pay. */
export function useSolanaQuote(route: { inputMint: string; outputMint: string } | null, sellToken: Token, buyToken: Token, sellAmount: string): SolanaCardQuote {
    const ctx = useSwapServerOptional();
    const typed = sellAmount.trim();
    const amount = useDebounced(typed, 500);
    const settled = amount === typed;
    const amountBase = route ? toBaseUnits(amount, sellToken.decimals) : undefined;
    const on = !!route && !!amountBase && !!ctx?.config && !ctx.config.solana.paused;
    const taker = ctx?.solanaAddress ?? undefined;
    const q = useQuery({
        queryKey: ['swap-server', 'sol-quote', route?.inputMint, route?.outputMint, amountBase, taker],
        queryFn: ({ signal }) => ctx!.api.getSolQuote({ inputMint: route!.inputMint, outputMint: route!.outputMint, amount: amountBase!, taker }, { signal }),
        enabled: on, staleTime: 8_000, refetchInterval: 15_000, retry,
    });
    const balances = useSolanaBalances(!!route);
    const quote = on && settled ? q.data : undefined;
    const held = route ? balances?.find(b => b.mint === route.inputMint) : undefined;
    const error = on && settled ? q.error : null;
    const sellBalance = !route ? null : balances ? Number(held?.display ?? 0) : null;
    const buyAmount = quote ? ethers.formatUnits(quote.outAmount, buyToken.decimals) : '';
    return useMemo(() => ({ amountBase, quote, error, fetching: q.isFetching, settled, buyAmount, sellBalance }),
        [amountBase, quote, error, q.isFetching, settled, buyAmount, sellBalance]);
}
