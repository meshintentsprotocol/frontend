/**
 * Real BCH loans, through the swap server's /lendbch/* API (ParyonUSD contracts).
 *
 * Provides native BCH collateral -> PUSD CashToken borrowing. All transactions are
 * non-custodial: built unsigned on the swap server, signed by the user's wallet
 * (Cashonize/Paytaca via bch_signTransaction or in-app WDK via WIF), and broadcast on-chain.
 */
import { CCTP_SWAP_SERVER_MAINNET_URL, CCTP_SWAP_SERVER_URL } from '@/lib/config';
import { LendError, type LendProvider, type ParyonPrepareBorrowResult, type ParyonPrepareManageResult, type ParyonPrepareRateResult } from '../provider';
import type { CreateLoanRequest, LendQuote, LoanView, Market, QuoteRequest } from '../types';

const PARYON_REFS_KEY = 'lend_paryon_loan_refs_v1';
const PARYON_HIDDEN_KEY = 'lend_paryon_loan_hidden_v1';

function readRefs(key = PARYON_REFS_KEY): string[] {
    try {
        const v = JSON.parse(localStorage.getItem(key) ?? '[]');
        return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    } catch { return []; }
}
const writeRefs = (refs: string[], key = PARYON_REFS_KEY) => {
    try { localStorage.setItem(key, JSON.stringify([...new Set(refs)].slice(0, 100))); } catch { /* storage full */ }
};

export const paryonConfigured = () => !!(CCTP_SWAP_SERVER_MAINNET_URL || CCTP_SWAP_SERVER_URL);

interface RawParyonMarket {
    network: string;
    paused: boolean;
    pauseReason: string | null;
    priceCents: string | null;
    totalDebtCents: string;
    totalCollateralSats: string;
    loanCount: number;
    rate: { minApr: number; medianApr: number; maxApr: number; defaultApr: number };
    fees: { borrowFeeBps: number; frontendFeeBps: number };
    limits: { minOpenRatioPct: number; warnRatioPct: number; minLoanCents: string };
    currentPeriod: number | null;
    priceContract: string | null;
}

interface RawParyonLoan {
    loanTokenId: string;
    txid: string;
    vout: number;
    collateralSats: string;
    debtCents: string;
    status: number;
    currentRate: number;
    nextRate: number;
    aprPct: number;
    collateralRatioPct: number | null;
    liquidationPriceCents: string | null;
    beingRedeemedCents: string;
    lastPeriodInterestPaid: number;
}

interface RawQuoteResponse {
    borrowCents: string;
    collateralSats: string;
    priceCents: string;
    maxBorrowCents: string;
    minCollateralSats: string;
    collateralRatioPct: number;
    liquidationPriceCents: string;
    protocolFeeSats: string;
    frontendFeeSats: string;
    aprPct: number;
    warnLowRatio: boolean;
    allowed: boolean;
    reason?: string;
}

function mapParyonLoanToView(raw: RawParyonLoan): LoanView {
    const cr = raw.collateralRatioPct || 150;
    // LTV in basis points = 10,000 / (CR / 100) = 1,000,000 / CR
    const ltvBps = cr > 0 ? Math.min(10000, Math.round(1_000_000 / cr)) : 6667;
    // Liquidation threshold is 110% CR => 9091 bps
    const liqBps = 9091;
    const liqPrice = raw.liquidationPriceCents ? Number(raw.liquidationPriceCents) / 100 : 0;
    const shortRef = raw.loanTokenId.length > 16
        ? `${raw.loanTokenId.slice(0, 8)}…${raw.loanTokenId.slice(-6)}`
        : raw.loanTokenId;

    return {
        ref: shortRef,
        provider: 'paryon',
        phase: 'active',
        status: {
            operation: 'active',
            state: raw.status === 2 ? 'mature' : raw.status === 1 ? 'single-period' : 'new',
            confirmations: 1,
            requiredConfirmations: 1,
        },
        collateral: {
            asset: 'BCH',
            chain: 'BCH',
            decimals: 8,
            amount: raw.collateralSats,
        },
        borrow: {
            asset: 'PUSD',
            chain: 'BCH',
            decimals: 2,
            amount: raw.debtCents,
            destination: 'Connected BCH wallet',
        },
        refundDestination: 'Connected BCH wallet',
        deposit: {
            amount: raw.collateralSats,
            targets: [{ chain: 'BCH', address: 'Paryon Loan Contract', amount: raw.collateralSats, feeAmount: '0' }],
            expiresAt: null,
            detectedAt: Date.now(),
        },
        repayment: {
            debt: raw.debtCents,
            targets: [{ chain: 'BCH', address: 'Paryon Manage Contract', amount: raw.debtCents, feeAmount: '0' }],
        },
        position: {
            collateral: raw.collateralSats,
            borrowed: raw.debtCents,
            interest: '0',
            totalDebt: raw.debtCents,
        },
        ltvBps,
        liquidationThresholdBps: liqBps,
        liquidationPrice: liqPrice,
        borrowApy: raw.aprPct,
        createdAt: Date.now() - 3600_000,
        updatedAt: Date.now(),
        paryon: {
            loanTokenId: raw.loanTokenId,
            collateralRatioPct: raw.collateralRatioPct,
            currentRate: raw.currentRate,
            nextRate: raw.nextRate,
            status: raw.status,
            txid: raw.txid,
            vout: raw.vout,
            beingRedeemedCents: raw.beingRedeemedCents,
        },
    };
}

export function createParyonProvider(
    baseUrl: string = CCTP_SWAP_SERVER_MAINNET_URL || CCTP_SWAP_SERVER_URL || 'https://cctp-swap-server-production-7cb54caf.up.railway.app',
    fetchImpl: typeof fetch = (...a) => fetch(...a)
): LendProvider {
    async function request<T>(path: string, body?: unknown, timeoutMs = 25_000): Promise<T> {
        if (!baseUrl) throw new LendError('Paryon BCH borrowing is not configured.', 503);
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
            throw new LendError('The LendBCH swap server cannot be reached. Check your connection and try again.');
        } finally {
            clearTimeout(timer);
        }
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new LendError(json?.error ?? json?.message ?? `LendBCH service error ${res.status}.`, res.status);
        return json as T;
    }

    return {
        id: 'paryon',

        listMarkets: async (): Promise<Market[]> => {
            // Chipnet cold reads can take ~60s; give the market call room beyond the default 25s so the asset
            // picker still populates on the first load rather than silently coming back empty.
            const m = await request<RawParyonMarket>('/lendbch/market', undefined, 60_000);
            const bchPrice = m.priceCents ? Number(m.priceCents) / 100 : 0;
            const minOpenCr = m.limits?.minOpenRatioPct || 150;
            const maxLtv = Math.round(1_000_000 / minOpenCr); // e.g. 6667 bps for 150%

            const bchMarket: Market = {
                poolId: 'paryon-bch-collateral',
                asset: 'BCH',
                chain: 'BCH',
                name: 'Bitcoin Cash',
                decimals: 8,
                priceUsd: bchPrice,
                supplyApy: 0,
                borrowApy: 0,
                utilization: 0,
                availableLiquidity: m.totalCollateralSats,
                totalSupply: m.totalCollateralSats,
                totalDebt: '0',
                maxLtvBps: maxLtv,
                liquidationThresholdBps: 9091, // 110% CR
                liquidationBonusBps: 1000,
                activationFeeBps: (m.fees?.borrowFeeBps || 25) + (m.fees?.frontendFeeBps || 25),
                frozen: m.paused,
            };

            const pusdMarket: Market = {
                poolId: 'paryon-pusd-borrow',
                asset: 'PUSD',
                chain: 'BCH',
                name: 'Paryon USD',
                decimals: 2,
                priceUsd: 1.0,
                supplyApy: 0,
                borrowApy: m.rate?.medianApr || 3.5,
                utilization: 100,
                availableLiquidity: '10000000000',
                totalSupply: m.totalDebtCents,
                totalDebt: m.totalDebtCents,
                maxLtvBps: maxLtv,
                liquidationThresholdBps: 9091,
                liquidationBonusBps: 1000,
                activationFeeBps: (m.fees?.borrowFeeBps || 25) + (m.fees?.frontendFeeBps || 25),
                frozen: m.paused,
            };

            return [bchMarket, pusdMarket];
        },

        quote: async (req: QuoteRequest): Promise<LendQuote> => {
            const raw = await request<RawQuoteResponse>('/lendbch/quote', {
                borrowCents: req.borrowAmount,
                collateralSats: req.collateralAmount,
            });

            const bchPrice = Number(raw.priceCents || 0) / 100;
            const collateralUsd = (Number(raw.collateralSats) * bchPrice) / 1e8;
            const borrowUsd = Number(raw.borrowCents) / 100;
            const cr = raw.collateralRatioPct || 150;
            const ltvBps = cr > 0 ? Math.min(10000, Math.round(1_000_000 / cr)) : 6667;
            const liqPrice = raw.liquidationPriceCents ? Number(raw.liquidationPriceCents) / 100 : 0;

            const protoFeeCents = (BigInt(raw.protocolFeeSats || '0') * BigInt(raw.priceCents || '0')) / 100_000_000n;
            const frontFeeCents = (BigInt(raw.frontendFeeSats || '0') * BigInt(raw.priceCents || '0')) / 100_000_000n;
            const activationFeeCents = (protoFeeCents + frontFeeCents).toString();

            return {
                collateral: { asset: 'BCH', chain: 'BCH', amount: raw.collateralSats, usd: collateralUsd },
                borrow: { asset: 'PUSD', chain: 'BCH', amount: raw.borrowCents, usd: borrowUsd },
                ltvBps,
                maxLtvBps: 6667,
                liquidationThresholdBps: 9091,
                activationFee: activationFeeCents,
                openingDebt: raw.borrowCents,
                borrowApy: raw.aprPct,
                liquidationPrice: liqPrice,
                collateralPrice: bchPrice,
                errors: raw.allowed ? [] : [raw.reason || 'Collateral ratio or minimum borrow not met.'],
            };
        },

        createLoan: async (req: CreateLoanRequest): Promise<LoanView> => {
            throw new LendError('Paryon loans require multi-step transaction signing. Use prepareBorrow and submit.', 400);
        },

        getLoan: async (ref: string): Promise<LoanView> => {
            // ref can be short ref or full loanTokenId
            let fullId = ref;
            if (ref.includes('…')) {
                const all = readRefs();
                const matched = all.find(r => r.startsWith(ref.split('…')[0]) && r.endsWith(ref.split('…')[1]));
                if (matched) fullId = matched;
            }
            const raw = await request<RawParyonLoan>(`/lendbch/loans/${encodeURIComponent(fullId)}`);
            writeRefs([raw.loanTokenId, ...readRefs()]);
            return mapParyonLoanToView(raw);
        },

        findLoans: async (query: string): Promise<LoanView[]> => {
            const clean = query.trim();
            if (/^[0-9a-f]{64}$/i.test(clean)) {
                try {
                    const l = await request<RawParyonLoan>(`/lendbch/loans/${clean}`);
                    if (l) return [mapParyonLoanToView(l)];
                } catch { /* not found */ }
            }
            const res = await request<{ loans: RawParyonLoan[] }>(`/lendbch/loans?address=${encodeURIComponent(clean)}`).catch(() => ({ loans: [] }));
            return (res.loans || []).map(mapParyonLoanToView);
        },

        myLoans: async (addresses: string[]): Promise<LoanView[]> => {
            const found = new Map<string, LoanView>();
            for (const addr of addresses.filter(Boolean)) {
                const res = await request<{ loans: RawParyonLoan[] }>(`/lendbch/loans?address=${encodeURIComponent(addr)}`).catch(() => ({ loans: [] }));
                for (const l of res.loans || []) {
                    found.set(l.loanTokenId, mapParyonLoanToView(l));
                }
            }
            for (const ref of readRefs()) {
                if (found.has(ref)) continue;
                try {
                    const l = await request<RawParyonLoan>(`/lendbch/loans/${encodeURIComponent(ref)}`);
                    if (l) found.set(l.loanTokenId, mapParyonLoanToView(l));
                } catch { /* ignore expired/closed */ }
            }
            if (found.size) writeRefs([...found.keys()]);
            const hidden = new Set(readRefs(PARYON_HIDDEN_KEY));
            return [...found.values()].filter(l => !hidden.has(l.paryon?.loanTokenId || l.ref));
        },

        forgetLoan: (ref: string) => {
            writeRefs(readRefs().filter(r => r !== ref));
            writeRefs([ref, ...readRefs(PARYON_HIDDEN_KEY)], PARYON_HIDDEN_KEY);
        },

        paryon: {
            prepareBorrow: (params) => request<ParyonPrepareBorrowResult>('/lendbch/prepare/borrow', params),
            prepareManage: (params) => {
                // UI uses readable action names; the server's manage builder branches on 'add' | 'withdraw' | 'repay' | 'close'.
                const map: Record<string, string> = { addCollateral: 'add', withdrawCollateral: 'withdraw' };
                const actionType = map[(params as { actionType: string }).actionType] ?? (params as { actionType: string }).actionType;
                return request<ParyonPrepareManageResult>('/lendbch/prepare/manage', { ...params, actionType });
            },
            prepareRate: (params) => request<ParyonPrepareRateResult>('/lendbch/prepare/rate', params),
            submit: (params) => request<{ success: boolean; txids: string[] }>('/lendbch/submit', params),
            broadcast: (txHex) => request<{ txid: string }>('/lendbch/broadcast', { txHex }),
        },
    };
}
