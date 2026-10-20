/**
 * Real loans, through the swap server's /lend/* API. The server talks to Liquidium; the browser never does.
 *
 * Mainnet only: the protocol has no testnet, so this provider uses the mainnet swap server and is unavailable
 * when the build has no URL for it.
 */
import { CCTP_SWAP_SERVER_MAINNET_URL } from '@/lib/config';
import { LendError, type LendProvider } from '../provider';
import type { AdvancedReceipt, CreateLoanRequest, LendQuote, LoanView, Market, Portfolio, QuoteRequest } from '../types';

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

        advanced: baseUrl ? {
            portfolio: async (profileId?: string) => {
                if (!profileId) {
                    return {
                        supplied: [],
                        borrowed: [],
                        suppliedUsd: 0,
                        borrowedUsd: 0,
                        healthPct: 100,
                        netApy: 0,
                        netValueUsd: 0,
                        netInterestUsd: 0,
                        wallet: {},
                        borrowable: {},
                    };
                }
                return request<Portfolio>(`/lend/account/${encodeURIComponent(profileId)}/portfolio`);
            },
            getProfileId: async (address: string) => {
                const res = await request<{ profileId: string | null }>(`/lend/account/resolve/${encodeURIComponent(address)}`);
                return res.profileId;
            },
            prepareCreateProfile: async (account: string) => {
                return request<{ message: string; expiryTimestamp: string; actionType: string; account: string }>('/lend/account/prepare-create', { account });
            },
            createProfile: async (params: { account: string; chain: 'BTC' | 'ETH'; signature: string; expiryTimestamp: string }) => {
                return request<{ profileId: string; account: string }>('/lend/account/create', params);
            },
            supplyTarget: async (params: { profileId: string; poolId: string; action: 'deposit' | 'repay'; chain: string }) => {
                return request<{ targetAddress: string; poolId: string; action: string; chain: string }>('/lend/account/supply-target', params);
            },
            prepareBorrow: async (params: { profileId: string; poolId: string; amount: string; chain: string; receiver: string; signerWalletAddress: string }) => {
                return request<{ message: string; expiryTimestamp: string; data: any }>('/lend/account/prepare-borrow', params);
            },
            submitBorrow: async (params: { profileId: string; poolId: string; amount: string; chain: string; receiver: string; signerWalletAddress: string; expiryTimestamp: string; signature: string; signingChain: 'BTC' | 'ETH' }) => {
                return request<AdvancedReceipt>('/lend/account/submit-borrow', params);
            },
            prepareWithdraw: async (params: { profileId: string; poolId: string; amount: string; chain: string; receiver: string; signerWalletAddress: string }) => {
                return request<{ message: string; expiryTimestamp: string; data: any }>('/lend/account/prepare-withdraw', params);
            },
            submitWithdraw: async (params: { profileId: string; poolId: string; amount: string; chain: string; receiver: string; signerWalletAddress: string; expiryTimestamp: string; signature: string; signingChain: 'BTC' | 'ETH' }) => {
                return request<AdvancedReceipt>('/lend/account/submit-withdraw', params);
            },
            submitInflow: async (txid: string, operation: 'deposit' | 'repayment', chain?: string) => {
                await request('/lend/account/submit-inflow', { txid, operation, chain });
            },
            supply: async (asset: string, amount: bigint) => {
                throw new LendError(`To supply ${asset}, get a deposit target address from Liquidium and transfer funds.`);
            },
            withdraw: async () => {
                throw new LendError('Withdraw requires signing an outflow authorization.');
            },
            borrow: async () => {
                throw new LendError('Borrow requires signing an outflow authorization.');
            },
            repay: async (asset: string) => {
                throw new LendError(`To repay ${asset}, send funds to the repayment target address.`);
            },
        } : undefined,
    };
}
