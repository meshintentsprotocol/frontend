/**
 * The Mesh server's quote for a same-chain BCH/CashToken order (POST /router/quote).
 *
 * The quote is the route the solver would take right now, so it is both the market
 * swap's price and the reference a limit price is set against. This hook is the one
 * place that asks for it:
 *
 *   - waits until typing pauses, so a keystroke is not a request;
 *   - cancels the request for an amount the user has already changed, so an answer
 *     that arrives late can never overwrite a newer one;
 *   - remembers which exact amount (in base units) each answer is for, so the card
 *     can tell a current quote from a stale one and refuse to submit on a stale one;
 *   - asks again every 15 s while the card is open, because pool prices move.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

const DEBOUNCE_MS = 350;
const REFRESH_MS = 15_000;

export interface MeshQuoteRoute {
    /** "Mesh pool (V3 2gr3ejl6)", "Cauldron (1 pool)", "Mesh 60% · Cauldron 40%". */
    name?: string;
    /** MESH_POOL | CAULDRON | SOLVER_INVENTORY | SPLIT */
    mode?: string;
    meshPct?: number;
    cauldronPct?: number;
    solverPct?: number;
}

export interface MeshQuoteState {
    status: 'idle' | 'loading' | 'ready' | 'error';
    /** The request this state answers: `${sell}|${buy}|${sellUnits}`. */
    key: string;
    buyUnits?: bigint;
    route?: MeshQuoteRoute;
    error?: string;
    /** The server prices this pair but settles on another network: nothing can be filled here. */
    settlementBlocked?: string;
    fetchedAt?: number;
}

export interface UseMeshQuoteInput {
    relayerUrl: string;
    network: 'mainnet' | 'chipnet';
    sellCategory: string;
    buyCategory: string;
    /** Null while there is no amount to price. */
    sellUnits: bigint | null;
    enabled: boolean;
}

export const quoteKey = (sell: string, buy: string, units: bigint | null) => `${sell}|${buy}|${units ?? ''}`;

function describeError(err: unknown, network: string): { error: string; settlementBlocked?: string } {
    // axios is not used here: fetch keeps the abort semantics simple.
    const e = err as { status?: number; body?: { error?: string; reason?: string; executable?: boolean; settlementNetwork?: string } };
    if (e?.body?.executable === false) {
        return {
            error: 'Not tradable on this network',
            settlementBlocked: `This Mesh server settles on ${e.body.settlementNetwork}; ${network} orders can't be filled here.`,
        };
    }
    if (e?.status === 404) return { error: 'No route for this amount' };
    if (e?.status === 429) return { error: 'Too many quote requests. Retrying shortly' };
    if (e?.status && e.status >= 500) return { error: 'The quote server had an error' };
    if (e?.status === 400) return { error: e.body?.error ?? 'The quote request was rejected' };
    return { error: 'The quote server is unreachable' };
}

export function useMeshQuote({ relayerUrl, network, sellCategory, buyCategory, sellUnits, enabled }: UseMeshQuoteInput) {
    const key = quoteKey(sellCategory, buyCategory, sellUnits);
    const [state, setState] = useState<MeshQuoteState>({ status: 'idle', key: '' });
    const [tick, setTick] = useState(0);
    const abortRef = useRef<AbortController | null>(null);
    /** The request last sent: a refresh of it goes out at once, a new amount waits for typing to pause. */
    const sentKeyRef = useRef('');

    const active = enabled && sellUnits !== null && sellUnits > 0n;

    useEffect(() => {
        abortRef.current?.abort();
        if (!active) {
            setState({ status: 'idle', key });
            return;
        }
        if (!relayerUrl) {
            setState({ status: 'error', key, error: `Mesh server is not configured for ${network}` });
            return;
        }
        // Keep the last answer for the same request while it refreshes; a new amount starts clean.
        setState(prev => (prev.key === key && prev.status === 'ready' ? prev : { status: 'loading', key }));

        const ctrl = new AbortController();
        abortRef.current = ctrl;
        const delay = sentKeyRef.current === key ? 0 : DEBOUNCE_MS;
        const timer = setTimeout(async () => {
            sentKeyRef.current = key;
            try {
                const res = await fetch(`${relayerUrl}/router/quote`, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ sellToken: sellCategory, buyToken: buyCategory, sellAmount: sellUnits!.toString(), network }),
                    signal: ctrl.signal,
                });
                const body = await res.json().catch(() => ({}));
                if (ctrl.signal.aborted) return;
                if (!res.ok || body?.executable === false) throw { status: res.status, body };
                const buyUnits = BigInt(String(body.buyAmount ?? '0'));
                if (buyUnits <= 0n) throw { status: 404, body };
                setState({
                    status: 'ready', key, buyUnits, fetchedAt: Date.now(),
                    route: {
                        name: body.routeName, mode: body.executionMode,
                        meshPct: body.meshPct, cauldronPct: body.cauldronPct, solverPct: body.solverPct,
                    },
                });
            } catch (err) {
                if (ctrl.signal.aborted || (err as Error)?.name === 'AbortError') return;
                const failed: MeshQuoteState = { status: 'error', key, ...describeError(err, network) };
                // A refresh that fails for a moment keeps a good answer that is under a minute old.
                // "No route" and a wrong network are real answers and replace it.
                const transient = !(failed.settlementBlocked || (err as { status?: number })?.status === 404);
                setState(prev => (transient && prev.key === key && prev.status === 'ready' && Date.now() - (prev.fetchedAt ?? 0) < 60_000
                    ? prev : failed));
            }
        }, delay);

        return () => { clearTimeout(timer); ctrl.abort(); };
        // sellUnits is part of `key`
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, active, relayerUrl, network, tick]);

    // Pool prices move: ask again while the page is visible.
    useEffect(() => {
        if (!active) return;
        const t = setInterval(() => {
            if (typeof document === 'undefined' || document.visibilityState === 'visible') setTick(n => n + 1);
        }, REFRESH_MS);
        return () => clearInterval(t);
    }, [active, key]);

    const refresh = useCallback(() => setTick(n => n + 1), []);

    /** A quote for exactly what is on screen now. */
    const current = state.key === key && state.status === 'ready' ? state : undefined;

    return { ...state, current, loading: active && (state.key !== key || state.status === 'loading'), refresh };
}
