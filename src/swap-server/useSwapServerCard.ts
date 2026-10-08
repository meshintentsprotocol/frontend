/**
 * Everything the swap card needs for a pair the swap server handles, behind one hook. The card asks it first:
 *
 *   state.active        the pair is ours and ready to quote: the card skips its own quote effects, shows
 *                       `buyAmount`, and hands the click to `execute`
 *   state.blocked       the pair has no flow at all (see routing.ts): the card disables its button with this text
 *   neither             the card behaves exactly as it did before this module existed
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { ethers } from 'ethers';
import type { Token } from '@/types';
import { describeError, SwapServerError } from './api';
import { resolveRoute, type SwapRoute } from './routing';
import { evmUsdcBalance } from './signers';
import { useSwapServerOptional } from './context';
import { pairAfterSelect, withCctpTokens } from './tokens';
import type { CctpChain, CctpQuote, SwapServerConfig } from './types';

function useDebounced<T>(value: T, ms: number): T {
    const [v, setV] = useState(value);
    useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
    return v;
}

/** USDC balance of the in-app wallet on one CCTP chain, as a decimal number. */
export function useCctpBalance(chain: CctpChain | undefined, owner: string | null | undefined) {
    const { connection } = useConnection();
    return useQuery({
        queryKey: ['swap-server', 'usdc-balance', chain?.key, owner],
        enabled: !!chain && !!owner,
        queryFn: async (): Promise<number> => {
            if (chain!.kind === 'evm') return Number(ethers.formatUnits(await evmUsdcBalance(chain!, owner!), 6));
            const ata = getAssociatedTokenAddressSync(new PublicKey(chain!.usdc), new PublicKey(owner!));
            // No token account yet is a balance of zero, not an error.
            const bal = await connection.getTokenAccountBalance(ata).catch(() => null);
            return bal ? Number(bal.value.uiAmountString ?? 0) : 0;
        },
        staleTime: 10_000, refetchInterval: 20_000, retry: 1,
    });
}

/** "1." and ".5" as the server wants them: "1" and "0.5". */
export function normalizeAmount(raw: string): string {
    let s = raw.trim();
    if (s.startsWith('.')) s = `0${s}`;
    if (s.endsWith('.')) s = s.slice(0, -1);
    return s;
}

/** USDC to keep back on a chain where USDC is also the gas (Arc): three transactions cost about a cent. */
export const USDC_GAS_RESERVE = 0.05;

/** Why an amount cannot be quoted, from /config alone: no round trip to learn a limit. */
export function amountProblem(amount: string, config: SwapServerConfig): string | null {
    if (!/^\d+(\.\d*)?$/.test(amount) || !(Number(amount) > 0)) return 'Enter an amount';
    if ((amount.split('.')[1] ?? '').length > 6) return 'USDC has 6 decimals at most';
    const n = Number(amount);
    if (n < config.cctp.minTransferUsdc) return `Minimum is ${config.cctp.minTransferUsdc} USDC`;
    if (n > config.cctp.maxTransferUsdc) return `Maximum is ${config.cctp.maxTransferUsdc} USDC`;
    return null;
}

export interface SwapServerCardState {
    route: SwapRoute | null;
    /** A swap-server pair that can be quoted and executed from this card. */
    active: boolean;
    /** Set when the pair has no flow; the text for the disabled button. */
    blocked: string | null;
    /** The receive amount for the buy field: '' until a quote arrives. */
    buyAmount: string;
    quote?: CctpQuote;
    quoting: boolean;
    /** Why the button is disabled, when it is. Short: it is the button's label. */
    problem: string | null;
    /** A longer line under the details when the quote failed for a reason worth reading. */
    notice: string | null;
    canSubmit: boolean;
    busy: boolean;
    sellBalance: number | null;
    /** The label of the button when it is enabled. */
    actionLabel: string;
    execute: () => Promise<boolean>;
    /** The selector's list with the swap server's rows in. */
    tokens: (base: Token[]) => Token[];
    /** After a pick on one side: what the other side should become, if anything. */
    pair: (picked: Token, other: Token, list: Token[]) => { other?: Token; reset?: boolean };
}

const IDLE: SwapServerCardState = {
    route: null, active: false, blocked: null, buyAmount: '', quoting: false, problem: null, notice: null, canSubmit: false, busy: false,
    sellBalance: null, actionLabel: '', execute: async () => false, tokens: base => base, pair: () => ({}),
};

export function useSwapServerCard({ sellToken, buyToken, sellAmount, isMainnet }: { sellToken: Token; buyToken: Token; sellAmount: string; isMainnet: boolean }): SwapServerCardState {
    const ctx = useSwapServerOptional();
    const config = ctx?.config;
    const api = ctx?.api;

    // The card is what makes the provider start fetching.
    const activate = ctx?.activate;
    useEffect(() => { activate?.(); }, [activate]);

    const route = useMemo(() => (ctx ? resolveRoute(sellToken, buyToken, { isMainnet, config }) : null), [ctx, sellToken, buyToken, isMainnet, config]);

    // Stable while /config and the mode are: the card memoises its token list on them.
    const tokens = useCallback((base: Token[]) => withCctpTokens(base, config, isMainnet), [config, isMainnet]);
    const pair = useCallback((p: Token, o: Token, list: Token[]) => pairAfterSelect(p, o, { tokens: list, config, isMainnet }), [config, isMainnet]);
    const cctp = route?.kind === 'usdc-cctp' ? route : null;

    // The trade page switches its history panel to ours while the pair is one of ours.
    const setPairRouted = ctx?.setPairRouted;
    const routed = !!cctp;
    useEffect(() => { setPairRouted?.(routed); return () => setPairRouted?.(false); }, [setPairRouted, routed]);

    const owner = cctp ? (cctp.src.kind === 'evm' ? ctx?.evmAddress : ctx?.solanaAddress) : null;
    const balance = useCctpBalance(cctp?.src, owner);

    const typed = normalizeAmount(sellAmount);
    const amount = useDebounced(typed, 400);
    const settled = amount === typed;
    const invalid = cctp && config ? amountProblem(amount, config) : null;
    const paused = !!cctp && !!config?.cctp.paused;
    const quotable = !!cctp && !!config && !invalid && !paused;

    const quoteQuery = useQuery({
        queryKey: ['swap-server', 'quote', cctp?.src.key, cctp?.dst.key, amount],
        queryFn: ({ signal }) => api!.getQuote({ src: cctp!.src.key, dst: cctp!.dst.key, amount }, { signal }),
        enabled: quotable && !!api,
        staleTime: 10_000, refetchInterval: 20_000,
        // A refusal will not change by asking again; only "no answer" and "busy" are retried.
        retry: (n, e) => n < 2 && e instanceof SwapServerError && (e.status === 0 || e.status === 429 || e.status >= 500),
    });
    const quote = quotable && settled ? quoteQuery.data : undefined;
    const quoteError = quotable && settled && quoteQuery.error ? quoteQuery.error : null;

    return useMemo((): SwapServerCardState => {
        if (!ctx || !route) return { ...IDLE, tokens, pair };
        const shared = { route, tokens, pair };
        if (route.kind === 'unsupported') return { ...IDLE, ...shared, blocked: route.reason };
        if (route.kind === 'sol-jupiter') return { ...IDLE, ...shared, blocked: 'Solana swaps are coming to this card soon.' };

        const busy = !!ctx.operation?.busy;
        const hasAmount = Number(sellAmount) > 0;
        let problem: string | null = null;
        if (!config) problem = ctx.configLoading ? 'Loading…' : 'Bridge unavailable';
        else if (paused) problem = 'Bridge paused';
        else if (hasAmount && invalid) problem = invalid;
        else if (hasAmount && (!settled || (quoteQuery.isFetching && !quote))) problem = 'Getting quote…';
        else if (quoteError) problem = quoteError instanceof SwapServerError && quoteError.code === 'RATE_LIMITED' ? 'Busy, retrying…' : 'No quote';
        // On Arc the gas is paid in USDC from the same balance: sending all of it leaves nothing to send it with.
        else if (route.src.minMaxFeePerGasGwei && balance.data !== undefined && Number(sellAmount) <= balance.data && Number(sellAmount) > balance.data - USDC_GAS_RESERVE) {
            problem = `Keep ${USDC_GAS_RESERVE} USDC for gas`;
        }

        const notice = !config ? (ctx.configError ?? null)
            : paused ? (config.cctp.pauseReason ? `Cross-chain USDC is paused: ${config.cctp.pauseReason}` : 'Cross-chain USDC is paused for now.')
            : quoteError ? describeError(quoteError) : null;

        return {
            ...shared,
            active: true, blocked: null,
            buyAmount: quote?.display?.expectedReceive ?? '',
            quote, quoting: hasAmount && !problem && !quote,
            problem, notice, busy,
            canSubmit: !!quote && !problem && !busy,
            sellBalance: balance.data ?? null,
            actionLabel: `Bridge USDC · ${route.src.name} → ${route.dst.name}`,
            execute: async () => {
                if (!quote) return false;
                const t = await ctx.bridge({ src: route.src, dst: route.dst, amount: typed });
                return !!t;
            },
        };
    }, [ctx, route, config, tokens, pair, sellAmount, typed, invalid, paused, settled, quote, quoteError, quoteQuery.isFetching, balance.data]);
}
