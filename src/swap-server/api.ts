/**
 * Typed client for the swap server's public API. No keys: the server never signs for the user, so every flow is
 * "get an unsigned transaction, sign it in the wallet, report back".
 *
 * Amount units differ between the two products and are the easiest thing to get wrong:
 *   cross-chain (/quote, /transfers)  decimal USDC          "1.5"
 *   Solana swaps (/solana/*)          integer base units    "1500000"
 */
import { CCTP_SWAP_SERVER_URL } from '@/lib/config';
import type {
    ActivityPage, CctpQuote, CreatedSolanaSwap, CreatedTransfer, SolanaPrices, SolanaQuote, SolanaSwap, SolanaToken,
    SolanaTokenPage, SwapServerConfig, SwapServerErrorCode, Transfer,
} from './types';

/** Every failure of a call, with the server's code. `status` is 0 when the server did not answer. */
export class SwapServerError extends Error {
    constructor(public status: number, public code: SwapServerErrorCode | string, message: string) {
        super(message);
        this.name = 'SwapServerError';
    }
}

const DEFAULT_CODE: Record<number, SwapServerErrorCode> = {
    400: 'INVALID_REQUEST', 403: 'FORBIDDEN', 404: 'NOT_FOUND', 409: 'WRONG_STATE', 429: 'RATE_LIMITED', 502: 'UPSTREAM_ERROR', 503: 'UNAVAILABLE',
};

type Query = Record<string, string | number | undefined>;
const qs = (o: Query) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== '') p.set(k, String(v));
    const s = p.toString();
    return s ? `?${s}` : '';
};

export interface RequestOptions { signal?: AbortSignal; timeoutMs?: number }

export function createSwapServerApi(baseUrl: string = CCTP_SWAP_SERVER_URL, fetchImpl: typeof fetch = (...a) => fetch(...a)) {
    async function request<T>(path: string, body?: unknown, opts: RequestOptions = {}): Promise<T> {
        // One controller for both the caller's cancel and the timeout (AbortSignal.any is not everywhere yet).
        const ctrl = new AbortController();
        const onAbort = () => ctrl.abort();
        if (opts.signal?.aborted) ctrl.abort(); else opts.signal?.addEventListener('abort', onAbort, { once: true });
        const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20_000);
        let res: Response;
        try {
            res = await fetchImpl(`${baseUrl}${path}`, {
                method: body === undefined ? 'GET' : 'POST',
                headers: body === undefined ? undefined : { 'content-type': 'application/json' },
                body: body === undefined ? undefined : JSON.stringify(body),
                signal: ctrl.signal,
            });
        } catch (e) {
            if (opts.signal?.aborted) throw e;   // the caller cancelled: not an error to report
            throw new SwapServerError(0, 'UNREACHABLE', 'The swap service cannot be reached. Check your connection and try again.');
        } finally {
            clearTimeout(timer);
            opts.signal?.removeEventListener('abort', onAbort);
        }
        const json = await res.json().catch(() => null);
        if (!res.ok) {
            throw new SwapServerError(res.status, json?.code ?? DEFAULT_CODE[res.status] ?? 'INTERNAL', json?.error ?? `The swap service answered ${res.status}`);
        }
        return json as T;
    }

    return {
        baseUrl,

        // ── both products ──
        getConfig: (o?: RequestOptions) => request<SwapServerConfig>('/config', undefined, o),
        /** A wallet's history for up to five addresses; with none, the public feed. */
        getActivity: (addresses: string[], p: { limit?: number; before?: number } = {}, o?: RequestOptions) =>
            request<ActivityPage>(`/activity${qs({ address: addresses.join(',') || undefined, limit: p.limit, before: p.before })}`, undefined, o),

        // ── cross-chain USDC: amounts are decimal USDC ──
        getQuote: (p: { src: string; dst: string; amount: string; speed?: 'auto' | 'fast' | 'standard' }, o?: RequestOptions) =>
            request<CctpQuote>(`/quote${qs(p)}`, undefined, o),
        createTransfer: (b: { src: string; dst: string; amount: string; sender: string; recipient: string; speed?: 'auto' | 'fast' | 'standard' }) =>
            request<CreatedTransfer>('/transfers', b),
        /** The unsigned transactions of a CREATED transfer again (after a reload, or a Solana blockhash that expired). */
        rebuildTransfer: (id: string) => request<{ transfer: Transfer; txs: CreatedTransfer['txs'] }>(`/transfers/${id}/rebuild`, {}),
        submitBurn: (id: string, txHash: string, feeTxHash?: string) => request<Transfer>(`/transfers/${id}/burn`, { txHash, feeTxHash }),
        submitFee: (id: string, txHash: string) => request<Transfer>(`/transfers/${id}/fee`, { txHash }),
        getTransfer: (id: string, o?: RequestOptions) => request<Transfer>(`/transfers/${id}`, undefined, o),
        /** Have the server adopt a burn it has no open record for, so it is still delivered. */
        trackBurn: (src: string, txHash: string) => request<Transfer>('/track', { src, txHash }),

        // ── Solana swaps: amounts are base units of the input token ──
        getSolTokens: (p: { q?: string; tag?: string; sort?: 'liquidity' | 'volume' | 'mcap'; limit?: number; offset?: number } = {}, o?: RequestOptions) =>
            request<SolanaTokenPage>(`/solana/tokens${qs(p)}`, undefined, o),
        searchSolTokens: (q: string, o?: RequestOptions) => request<{ tokens: SolanaToken[] }>(`/solana/tokens/search${qs({ q })}`, undefined, o),
        getSolToken: (mint: string, o?: RequestOptions) => request<SolanaToken>(`/solana/tokens/${mint}`, undefined, o),
        getSolStocks: (p: { issuer?: string; q?: string; minLiquidity?: number; limit?: number; offset?: number } = {}, o?: RequestOptions) =>
            request<SolanaTokenPage>(`/solana/stocks${qs(p)}`, undefined, o),
        getSolPrices: (mints: string[], o?: RequestOptions) => request<SolanaPrices>(`/solana/prices${qs({ ids: mints.join(',') })}`, undefined, o),
        getSolQuote: (p: { inputMint: string; outputMint: string; amount: string; slippageBps?: number; taker?: string }, o?: RequestOptions) =>
            request<SolanaQuote>(`/solana/quote${qs(p)}`, undefined, o),
        createSolSwap: (b: { inputMint: string; outputMint: string; amount: string; taker: string; slippageBps?: number; receiver?: string }) =>
            request<CreatedSolanaSwap>('/solana/swaps', b),
        /** Answers when the transaction has landed, so the timeout is long. RESULT_UNKNOWN means poll, never re-create. */
        executeSolSwap: (id: string, signedTransaction: string) => request<SolanaSwap>(`/solana/swaps/${id}/execute`, { signedTransaction }, { timeoutMs: 70_000 }),
        getSolSwap: (id: string, o?: RequestOptions) => request<SolanaSwap>(`/solana/swaps/${id}`, undefined, o),
    };
}

export type SwapServerApi = ReturnType<typeof createSwapServerApi>;

/**
 * False in a production build that was not given the server's URL. The default URL is a developer's localhost,
 * and a public site must not send its visitors' browsers there.
 */
export const swapServerConfigured: boolean = !(import.meta.env.PROD && /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(CCTP_SWAP_SERVER_URL));

export const swapServerApi = createSwapServerApi();

/** A sentence for the user. The server's own sentence is used unless the code calls for something more useful. */
export function describeError(e: unknown): string {
    if (e instanceof SwapServerError) {
        if (e.code === 'RATE_LIMITED') return 'Too many requests. Try again in a few seconds.';
        if (e.code === 'PAUSED') return 'This service is temporarily unavailable.';
        if (e.code === 'ROUTE_CLOSED') return 'This route is temporarily closed.';
        return e.message.charAt(0).toUpperCase() + e.message.slice(1);
    }
    const any = e as { shortMessage?: string; reason?: string; message?: string } | undefined;
    return (any?.shortMessage || any?.reason || any?.message || String(e)).split('\n')[0].slice(0, 200);
}
