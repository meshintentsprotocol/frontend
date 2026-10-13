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
import { ethers } from 'ethers';
import type { Token } from '@/types';
import { describeError, SwapServerError } from './api';
import { resolveRoute, type SwapRoute } from './routing';
import { evmFees, evmProvider, evmUsdcBalance } from './signers';
import { useSwapServerOptional } from './context';
import { withJupiterTokens } from './solana';
import { pairAfterSelect, withCctpTokens } from './tokens';
import { useWDK } from '@/context/WDKProvider';
import { useSolanaQuote, useSolanaTokenList, useSolanaTokenSearch } from './useSolanaSwap';
import type { BchQuote, CctpChain, CctpQuote, SolanaQuote, SwapServerConfig } from './types';

function useDebounced<T>(value: T, ms: number): T {
    const [v, setV] = useState(value);
    useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
    return v;
}

/** USDC balance of the in-app wallet on one CCTP chain, as a decimal number. */
export function useCctpBalance(chain: CctpChain | undefined, owner: string | null | undefined) {
    const api = useSwapServerOptional()?.api;
    return useQuery({
        queryKey: ['swap-server', 'usdc-balance', chain?.key, owner],
        enabled: !!chain && !!owner && !!api,
        queryFn: async ({ signal }): Promise<number> => {
            if (chain!.kind === 'evm') return Number(ethers.formatUnits(await evmUsdcBalance(chain!, owner!), 6));
            // Solana is read by the server: the public mainnet RPC refuses browsers.
            return Number((await api!.getChainBalance(chain!.key, owner!, { signal })).display);
        },
        staleTime: 10_000, refetchInterval: 20_000, retry: 1,
    });
}

/** Gas a cross-chain transfer needs on its source chain: up to three EVM transactions, or one Solana burn with its rent. */
const EVM_GAS_UNITS = 320_000n;
const SOLANA_LAMPORTS = 6_000_000n;

export interface GasCheck { symbol: string; have: string; need: string; enough: boolean }

/** What the three numbers say. On Arc gas is the USDC being sent, which USDC_GAS_RESERVE already covers. */
export function gasVerdict(native: bigint, need: bigint, decimals: number, symbol: string): GasCheck {
    const show = (v: bigint) => Number(ethers.formatUnits(v, decimals)).toLocaleString(undefined, { maximumSignificantDigits: 3 });
    return { symbol, have: show(native), need: show(need), enough: native >= need };
}

/** Does the wallet hold enough of the source chain's gas token to send the transfer? Undefined until known. */
export function useGasCheck(chain: CctpChain | undefined, owner: string | null | undefined) {
    const api = useSwapServerOptional()?.api;
    const gasIsUsdc = !!chain?.minMaxFeePerGasGwei;
    return useQuery({
        queryKey: ['swap-server', 'gas', chain?.key, owner],
        enabled: !!chain && !!owner && !!api && !gasIsUsdc,
        queryFn: async ({ signal }): Promise<GasCheck> => {
            const b = await api!.getChainBalance(chain!.key, owner!, { signal });
            if (chain!.kind === 'solana') return gasVerdict(BigInt(b.native), SOLANA_LAMPORTS, 9, 'SOL');
            const fees = await evmFees(evmProvider(chain!));
            return gasVerdict(BigInt(b.native), fees.maxFeePerGas * EVM_GAS_UNITS, 18, b.nativeSymbol);
        },
        staleTime: 15_000, refetchInterval: 30_000, retry: 1,
    }).data;
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
    /** The Jupiter quote, for a Solana swap. */
    solQuote?: SolanaQuote;
    /** The 1Click NEAR Intents quote, for a Bitcoin Cash cross-chain swap. */
    bchQuote?: BchQuote;
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
    /** Mainnet mode: find Solana tokens beyond the list, by name, symbol or mint. */
    searchTokens?: (q: string) => Promise<Token[]>;
}

const fmtUsd = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });

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
    const stocks = !!config?.solana.stocksEnabled;
    const solList = useSolanaTokenList(isMainnet);
    const solTokens = useMemo(() => (stocks ? solList : solList?.filter(t => !t.isStock)), [solList, stocks]);
    // Jupiter's rows first: its USDC row then also serves as the Solana end of cross-chain USDC on mainnet.
    const tokens = useCallback((base: Token[]) => withCctpTokens(withJupiterTokens(base, solTokens, isMainnet), config, isMainnet), [config, isMainnet, solTokens]);
    const searchTokens = useSolanaTokenSearch(isMainnet);
    const pair = useCallback((p: Token, o: Token, list: Token[]) => pairAfterSelect(p, o, { tokens: list, config, isMainnet }), [config, isMainnet]);
    const wdk = useWDK();
    const cctp = route?.kind === 'usdc-cctp' ? route : null;
    const jup = route?.kind === 'sol-jupiter' ? route : null;
    const bch = route?.kind === 'bch-crosschain' ? route : null;
    const sol = useSolanaQuote(jup, sellToken, buyToken, sellAmount);

    // The trade page switches its history panel to ours while the pair is one of ours.
    const setPairRouted = ctx?.setPairRouted;
    const routed = !!cctp || !!jup || !!bch;
    useEffect(() => { setPairRouted?.(routed); return () => setPairRouted?.(false); }, [setPairRouted, routed]);

    // BCH cross-chain quotes
    const bchTyped = normalizeAmount(sellAmount);
    const bchAmount = useDebounced(bchTyped, 400);
    const bchSettled = bchAmount === bchTyped;
    const bchQuotable = !!bch && !!api && Number(bchAmount) > 0 && !config?.bch?.paused;

    const bchQuoteQuery = useQuery({
        queryKey: ['swap-server', 'bch-quote', bch?.fromAsset, bch?.toAsset, bchAmount],
        queryFn: ({ signal }) => api!.getBchQuote({
            fromAsset: bch!.fromAsset,
            toAsset: bch!.toAsset,
            fromChain: bch!.fromChain,
            toChain: bch!.toChain,
            amount: bchAmount,
        }, { signal }),
        enabled: bchQuotable,
        staleTime: 10_000,
        refetchInterval: 20_000,
        retry: (n, e) => n < 2 && e instanceof SwapServerError && (e.status === 0 || e.status === 429 || e.status >= 500),
    });
    const bchQuote = bchQuotable && bchSettled ? bchQuoteQuery.data : undefined;

    const recipient = useMemo(() => {
        if (!bch) return null;
        if (bch.toChain === 'bch') return wdk.address || null;
        if (bch.toChain === 'solana') return wdk.solanaAddress || null;
        return wdk.evmAddress || null;
    }, [bch, wdk.address, wdk.solanaAddress, wdk.evmAddress]);

    const refundTo = useMemo(() => {
        if (!bch) return null;
        if (bch.fromChain === 'bch') return wdk.address || null;
        if (bch.fromChain === 'solana') return wdk.solanaAddress || null;
        return wdk.evmAddress || null;
    }, [bch, wdk.address, wdk.solanaAddress, wdk.evmAddress]);

    const owner = cctp ? (cctp.src.kind === 'evm' ? ctx?.evmAddress : ctx?.solanaAddress) : null;
    const balance = useCctpBalance(cctp?.src, owner);
    const gas = useGasCheck(cctp?.src, owner);

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
        if (!ctx || !route) return { ...IDLE, tokens, pair, searchTokens };
        const shared = { route, tokens, pair, searchTokens };
        if (route.kind === 'unsupported') return { ...IDLE, ...shared, blocked: route.reason };

        const busy = ctx.signing;
        const hasAmount = Number(sellAmount) > 0;
        if (route.kind === 'sol-jupiter') {
            const q = sol.quote;
            const s = config?.solana;
            const check = q?.takerCheck;
            const short = sol.sellBalance !== null && Number(sellAmount) > sol.sellBalance;
            let problem: string | null = null;
            if (!config) problem = ctx.configLoading ? 'Loading…' : 'Swaps unavailable';
            else if (!s!.enabled) problem = 'Swaps unavailable';
            else if (s!.paused) problem = 'Swaps paused';
            else if (!ctx.solanaAddress) problem = 'Connect your wallet';
            else if (hasAmount && !sol.amountBase) problem = `${sellToken.symbol} has ${sellToken.decimals} decimals at most`;
            else if (hasAmount && (!sol.settled || (sol.fetching && !q))) problem = 'Getting quote…';
            else if (sol.error) problem = sol.error instanceof SwapServerError && sol.error.code === 'RATE_LIMITED' ? 'Busy, retrying…' : 'No quote';
            else if (q && s!.maxSwapUsd > 0 && (q.inUsdValue ?? 0) > s!.maxSwapUsd) problem = `Maximum is $${fmtUsd(s!.maxSwapUsd)}`;
            else if (hasAmount && short) problem = `Not enough ${sellToken.symbol}`;
            else if (check && !check.ok) problem = 'Wallet cannot pay for this swap';

            const notice = !config ? (ctx.configError ?? null)
                : !s!.enabled ? 'Solana swaps are not set up on this server.'
                : s!.paused ? (s!.pauseReason ? `Solana swaps are paused: ${s!.pauseReason}` : 'Solana swaps are paused for now.')
                : sol.error ? describeError(sol.error)
                // Jupiter's own words for why this wallet cannot do it (usually: not enough SOL for fees and rent).
                : check && !check.ok && !short ? (check.message ?? null) : null;

            return {
                ...shared,
                active: true, blocked: null,
                buyAmount: sol.buyAmount,
                solQuote: q, quoting: hasAmount && !problem && !q,
                problem, notice, busy,
                canSubmit: !!q && !problem && !busy,
                sellBalance: sol.sellBalance,
                actionLabel: `Swap ${sellToken.symbol} → ${buyToken.symbol}`,
                execute: async () => {
                    if (!q || !sol.amountBase) return false;
                    const done = await ctx.swap({
                        inputMint: route.inputMint, outputMint: route.outputMint, amount: sol.amountBase,
                        sell: { symbol: sellToken.symbol, display: normalizeAmount(sellAmount) },
                        buy: { symbol: buyToken.symbol, display: sol.buyAmount },
                    });
                    return !!done;
                },
            };
        }

        if (route.kind === 'bch-crosschain') {
            const q = bchQuote;
            const bchConf = config?.bch;
            let problem: string | null = null;
            if (!config) problem = ctx.configLoading ? 'Loading…' : 'BCH swaps unavailable';
            else if (bchConf?.paused) problem = 'BCH swaps paused';
            else if (!recipient) problem = `Connect ${route.toChain.toUpperCase()} wallet`;
            else if (!refundTo) problem = `Connect ${route.fromChain.toUpperCase()} wallet`;
            else if (hasAmount && (!bchSettled || (bchQuoteQuery.isFetching && !q))) problem = 'Getting quote…';
            else if (bchQuoteQuery.error) problem = bchQuoteQuery.error instanceof SwapServerError && bchQuoteQuery.error.code === 'RATE_LIMITED' ? 'Busy, retrying…' : 'No quote';

            const notice = !config ? (ctx.configError ?? null)
                : bchConf?.paused ? (bchConf.pauseReason ?? 'Bitcoin Cash swaps are paused.')
                : bchQuoteQuery.error ? describeError(bchQuoteQuery.error)
                : q?.warning ?? null;

            return {
                ...shared,
                active: true,
                blocked: null,
                buyAmount: q?.amountOutFormatted ?? '',
                bchQuote: q,
                quoting: hasAmount && !problem && !q,
                problem,
                notice,
                busy,
                canSubmit: !!q && !problem && !busy,
                sellBalance: null,
                actionLabel: `Swap to ${buyToken.symbol}`,
                execute: async () => {
                    if (!q || !recipient || !refundTo) return false;
                    const record = await ctx.executeBchSwap({
                        fromAsset: route.fromAsset,
                        toAsset: route.toAsset,
                        fromChain: route.fromChain,
                        toChain: route.toChain,
                        amount: bchAmount,
                        recipient,
                        refundTo,
                        sell: { symbol: sellToken.symbol, display: sellAmount },
                        buy: { symbol: buyToken.symbol, display: q.amountOutFormatted },
                    });
                    return !!record;
                },
            };
        }

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
        // Without gas the wallet could sign nothing: say so before the click, not after.
        else if (hasAmount && gas && !gas.enough && (balance.data === undefined || Number(sellAmount) <= balance.data)) problem = `Not enough ${gas.symbol} for gas`;
        const gasNotice = gas && !gas.enough
            ? `Sending from ${route.src.name} needs about ${gas.need} ${gas.symbol} for network fees. This wallet has ${gas.have}.` : null;

        const notice = !config ? (ctx.configError ?? null)
            : paused ? (config.cctp.pauseReason ? `Cross-chain USDC is paused: ${config.cctp.pauseReason}` : 'Cross-chain USDC is paused for now.')
            : quoteError ? describeError(quoteError) : gasNotice;

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
    }, [ctx, route, config, tokens, pair, searchTokens, sellAmount, sellToken, buyToken, sol, typed, invalid, paused, settled, quote, quoteError, quoteQuery.isFetching, balance.data, gas]);
}
