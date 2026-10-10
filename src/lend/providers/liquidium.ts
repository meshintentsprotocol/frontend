/**
 * Real loans, through the swap server's /lend/* API. The server talks to Liquidium; the browser never does.
 *
 * Mainnet only: the protocol has no testnet, so this provider uses the mainnet swap server and is unavailable
 * when the build has no URL for it.
 */
import { CCTP_SWAP_SERVER_MAINNET_URL } from '@/lib/config';
import { LendError, type LendProvider } from '../provider';
import type { CreateLoanRequest, LendQuote, LoanView, Market, QuoteRequest } from '../types';

const REFS_KEY = 'lend_loan_refs_v1';
/** Loans the user removed from their history. They still exist; they are only not listed here. */
const HIDDEN_KEY = 'lend_loan_hidden_v1';

function readRefs(key = REFS_KEY): string[] {
    try {
        const v = JSON.parse(localStorage.getItem(key) ?? '[]');
        return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    } catch { return []; }
}
const writeRefs = (refs: string[], key = REFS_KEY) => { try { localStorage.setItem(key, JSON.stringify([...new Set(refs)].slice(0, 100))); } catch { /* storage full or blocked */ } };

export const liquidiumConfigured = () => !!CCTP_SWAP_SERVER_MAINNET_URL;

export function createLiquidiumProvider(baseUrl: string = CCTP_SWAP_SERVER_MAINNET_URL, fetchImpl: typeof fetch = (...a) => fetch(...a)): LendProvider {
    async function request<T>(path: string, body?: unknown, timeoutMs = 25_000): Promise<T> {
        if (!baseUrl) throw new LendError('Borrowing is not set up in this build of the app.', 503);
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);
        let res: Response;
        try {
            res = await fetchImpl(`${baseUrl.replace(/\/+$/, '')}${path}`, {
                method: body === undefined ? 'GET' : 'POST',
                headers: body === undefined ? undefined : { 'content-type': 'application/json' },
                body: body === undefined ? undefined : JSON.stringify(body),
                signal: ctrl.signal,
            });
        } catch {
            throw new LendError('The lending service cannot be reached. Check your connection and try again.');
        } finally {
            clearTimeout(timer);
        }
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new LendError(json?.error ?? json?.message ?? `The lending service answered ${res.status}.`, res.status);
        return json as T;
    }

    return {
        id: 'liquidium',
        listMarkets: async () => (await request<{ markets: Market[] }>('/lend/markets')).markets,
        quote: (req: QuoteRequest) => request<LendQuote>('/lend/quote', req),
        createLoan: async (req: CreateLoanRequest) => {
            // Creating takes the protocol a few seconds; a second request would be a second loan, so this is never retried.
            const loan = await request<LoanView>('/lend/loans', req, 60_000);
            writeRefs([loan.ref, ...readRefs()]);
            return loan;
        },
        getLoan: (ref, fresh) => (fresh ? request<LoanView>(`/lend/loans/${encodeURIComponent(ref)}/refresh`, {}) : request<LoanView>(`/lend/loans/${encodeURIComponent(ref)}`)),
        findLoans: async query => {
            const { loans } = await request<{ loans: LoanView[] }>(`/lend/loans?address=${encodeURIComponent(query.trim())}`);
            // Looking a loan up by hand brings it back into the list.
            if (loans.length) {
                const refs = loans.map(l => l.ref);
                writeRefs(readRefs(HIDDEN_KEY).filter(r => !refs.includes(r)), HIDDEN_KEY);
                writeRefs([...refs, ...readRefs()]);
            }
            return loans;
        },
        myLoans: async addresses => {
            const found = new Map<string, LoanView>();
            // By the wallet's addresses first: that also finds loans made on another device.
            for (const address of addresses.filter(Boolean)) {
                const { loans } = await request<{ loans: LoanView[] }>(`/lend/loans?address=${encodeURIComponent(address)}`).catch(() => ({ loans: [] as LoanView[] }));
                for (const l of loans) found.set(l.ref, l);
            }
            for (const ref of readRefs()) {
                if (found.has(ref)) continue;
                const l = await request<LoanView>(`/lend/loans/${encodeURIComponent(ref)}`).catch(() => null);
                if (l) found.set(l.ref, l);
            }
            if (found.size) writeRefs([...found.keys(), ...readRefs()]);
            const hidden = new Set(readRefs(HIDDEN_KEY));
            return [...found.values()].filter(l => !hidden.has(l.ref)).sort((a, b) => b.createdAt - a.createdAt);
        },
        forgetLoan: ref => { writeRefs(readRefs().filter(r => r !== ref)); writeRefs([ref, ...readRefs(HIDDEN_KEY)], HIDDEN_KEY); },
    };
}
