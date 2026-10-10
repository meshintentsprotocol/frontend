/**
 * Demo mode: the whole borrow and supply product with nothing real behind it.
 *
 * Markets, a wallet with balances, loans and positions live in this browser only. A demo loan gets an ID that
 * starts with D and addresses that are obviously fake; it waits for its "deposit", confirms and becomes active on
 * its own, by the clock, so every screen can be seen without sending anything. Nothing here touches a network.
 *
 * Time and storage are passed in, so the engine is tested without a browser.
 */
import { LendError, type LendProvider } from '../provider';
import { activationFee, healthPct, liquidationPrice, ltvBps, toNumber } from '../math';
import type { AdvancedReceipt, CreateLoanRequest, LendQuote, LoanPhase, LoanView, Market, Portfolio, Position, QuoteRequest } from '../types';

export const DEMO_DEPOSIT_ADDRESS = 'bc1qdemosupply0000000000000000000000m6r9a';
export const DEMO_REPAY_ADDRESS = '0x2222222222222222222222222222222222222222';
const DEMO_EVM = '0x1111111111111111111111111111111111111111';
const DEMO_BTC = 'bc1qdemowallet00000000000000000000000jknq';

const market = (asset: string, chain: string, name: string, decimals: number, priceUsd: number, supplyApy: number, borrowApy: number, utilization: number, liquidity: string): Market => ({
    poolId: `demo-${asset.toLowerCase()}`, asset, chain, name, decimals, priceUsd, supplyApy, borrowApy, utilization,
    availableLiquidity: liquidity, totalSupply: liquidity, totalDebt: '0',
    maxLtvBps: 6500, liquidationThresholdBps: 7400, liquidationBonusBps: 500, activationFeeBps: 50, frozen: false,
});

export const DEMO_MARKETS: Market[] = [
    market('BTC', 'BTC', 'Bitcoin', 8, 83_000, 0.012, 0.323, 4.5, '150000000'),
    market('ETH', 'ETH', 'Ethereum', 18, 2_500, 0.006, 0.26, 2.6, '3000000000000000000'),
    market('USDC', 'ETH', 'USDC', 6, 1, 3.351, 4.68, 79.6, '100000000000'),
    market('USDT', 'ETH', 'USDT', 6, 1, 2.335, 3.907, 66.4, '100000000000'),
];

/** How long each stage of a demo loan lasts. Short enough to watch, long enough to read. */
export const DEMO_TIMING = { depositMs: 12_000, perConfirmationMs: 3_000, confirmations: 4, repayMs: 9_000 };

interface DemoLoan {
    ref: string;
    collateralAsset: string;
    borrowAsset: string;
    collateral: string;      // base units
    borrowed: string;        // base units, without the fee
    debt: string;            // base units, with the fee, less repayments
    createdAt: number;
    /** Set while the loan stays unfunded (the seeded "awaiting deposit" example never advances). */
    frozen?: boolean;
    closedAt?: number;
    repaidAt?: number;       // a full repayment started; the loan closes DEMO_TIMING.repayMs later
    activity: { at: number; kind: 'Supply' | 'Borrow' | 'Repay'; asset: string; amount: string }[];
}

interface DemoState {
    loans: DemoLoan[];
    wallet: Record<string, string>;
    supplied: Record<string, string>;
    borrowed: Record<string, string>;
    seq: number;
}

export interface DemoStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }

const KEY = 'lend_demo_v1';
const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';

function seed(now: number): DemoState {
    const hour = 3_600_000;
    return {
        seq: 1,
        wallet: { BTC: '150000000', ETH: '3000000000000000000', USDC: '100000000000', USDT: '100000000000' },
        supplied: { BTC: '18000000' },
        borrowed: { USDT: '2500000000' },
        loans: [
            {
                ref: 'DOPEN1', collateralAsset: 'BTC', borrowAsset: 'USDC', collateral: '2200000', borrowed: '398000000', debt: '400000000', createdAt: now - 26 * hour,
                activity: [{ at: now - 26 * hour, kind: 'Supply', asset: 'BTC', amount: '2200000' }, { at: now - 25 * hour, kind: 'Borrow', asset: 'USDC', amount: '398000000' }],
            },
            {
                ref: 'DWAIT1', collateralAsset: 'BTC', borrowAsset: 'USDC', collateral: '4800000', borrowed: '995000000', debt: '1000000000', createdAt: now - 10 * 60_000, frozen: true,
                activity: [],
            },
            {
                ref: 'DCLSD1', collateralAsset: 'BTC', borrowAsset: 'USDT', collateral: '1000000', borrowed: '250000000', debt: '0', createdAt: now - 9 * 24 * hour, closedAt: now - 2 * 24 * hour,
                activity: [{ at: now - 9 * 24 * hour, kind: 'Supply', asset: 'BTC', amount: '1000000' }, { at: now - 9 * 24 * hour, kind: 'Borrow', asset: 'USDT', amount: '250000000' }, { at: now - 2 * 24 * hour, kind: 'Repay', asset: 'USDT', amount: '251250000' }],
            },
        ],
    };
}

export interface DemoOptions { storage?: DemoStorage; now?: () => number; markets?: Market[] }

export interface DemoProvider extends LendProvider {
    /** Wallet balances of the demo profile, base units by asset. */
    wallet(): Record<string, string>;
    /** The activity rows of a loan, newest first. */
    activity(ref: string): DemoLoan['activity'];
    reset(): void;
}

export function createDemoProvider(opts: DemoOptions = {}): DemoProvider {
    const now = opts.now ?? Date.now;
    const markets = opts.markets ?? DEMO_MARKETS;
    const storage: DemoStorage | undefined = opts.storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
    const m = (asset: string): Market => {
        const found = markets.find(x => x.asset === asset);
        if (!found) throw new LendError(`${asset} is not available.`, 400);
        return found;
    };

    let state: DemoState;
    try { state = JSON.parse(storage?.getItem(KEY) ?? 'null') ?? seed(now()); } catch { state = seed(now()); }
    const save = () => { try { storage?.setItem(KEY, JSON.stringify(state)); } catch { /* demo state is expendable */ } };

    function stage(l: DemoLoan): { phase: LoanPhase; operation: string; state: string; confirmations: number | null } {
        const t = now();
        if (l.closedAt && l.closedAt <= t) return { phase: 'closed', operation: 'repayment', state: 'completed', confirmations: null };
        if (l.repaidAt) return t - l.repaidAt >= DEMO_TIMING.repayMs
            ? { phase: 'closed', operation: 'repayment', state: 'completed', confirmations: null }
            : { phase: 'repaying', operation: 'repayment', state: 'confirming', confirmations: null };
        if (l.frozen) return { phase: 'awaiting_deposit', operation: 'deposit', state: 'action_required', confirmations: null };
        const age = t - l.createdAt;
        if (age < DEMO_TIMING.depositMs) return { phase: 'awaiting_deposit', operation: 'deposit', state: 'action_required', confirmations: null };
        const confirmations = Math.floor((age - DEMO_TIMING.depositMs) / DEMO_TIMING.perConfirmationMs);
        if (confirmations < DEMO_TIMING.confirmations) return { phase: 'confirming', operation: 'deposit', state: 'confirming', confirmations };
        return { phase: 'active', operation: 'repayment', state: 'active', confirmations: null };
    }

    function view(l: DemoLoan): LoanView {
        const c = m(l.collateralAsset), b = m(l.borrowAsset);
        const s = stage(l);
        const funded = s.phase === 'active' || s.phase === 'repaying';
        const closed = s.phase === 'closed';
        const debt = closed ? 0n : BigInt(l.debt);
        const collateralUnits = toNumber(l.collateral, c.decimals);
        const debtUsd = toNumber(debt, b.decimals) * b.priceUsd;
        return {
            ref: l.ref, provider: 'demo', phase: s.phase,
            status: { operation: s.operation, state: s.state, confirmations: s.confirmations, requiredConfirmations: s.phase === 'confirming' ? DEMO_TIMING.confirmations : null },
            collateral: { asset: c.asset, chain: c.chain, decimals: c.decimals, amount: l.collateral },
            borrow: { asset: b.asset, chain: b.chain, decimals: b.decimals, amount: l.borrowed, destination: DEMO_EVM },
            refundDestination: DEMO_BTC,
            deposit: {
                amount: l.collateral,
                targets: [{ chain: c.chain, address: DEMO_DEPOSIT_ADDRESS, amount: (BigInt(l.collateral) + 1n).toString(), feeAmount: '100' }],
                expiresAt: l.createdAt + 60 * 60_000, detectedAt: s.phase === 'awaiting_deposit' ? null : l.createdAt + DEMO_TIMING.depositMs,
            },
            repayment: { debt: funded ? debt.toString() : '0', targets: funded ? [{ chain: b.chain, address: DEMO_REPAY_ADDRESS, amount: debt.toString(), feeAmount: '0' }] : [] },
            position: {
                collateral: funded ? l.collateral : '0', borrowed: funded ? l.borrowed : '0', interest: '0', totalDebt: funded ? debt.toString() : '0',
            },
            ltvBps: closed ? 0 : ltvBps(debtUsd, collateralUnits * c.priceUsd),
            liquidationThresholdBps: c.liquidationThresholdBps,
            liquidationPrice: closed ? 0 : liquidationPrice(debtUsd, collateralUnits, c.liquidationThresholdBps),
            borrowApy: b.borrowApy, createdAt: l.createdAt, updatedAt: now(),
        };
    }

    /** A loan that reached "active" has moved its amounts: collateral left the wallet, the borrowed coins arrived. */
    function settle() {
        let changed = false;
        for (const l of state.loans) {
            const s = stage(l);
            const moved = l.activity.some(a => a.kind === 'Borrow');
            if ((s.phase === 'active' || s.phase === 'repaying' || s.phase === 'closed') && !moved && !l.frozen) {
                const at = l.createdAt + DEMO_TIMING.depositMs + DEMO_TIMING.confirmations * DEMO_TIMING.perConfirmationMs;
                l.activity.push({ at: l.createdAt + DEMO_TIMING.depositMs, kind: 'Supply', asset: l.collateralAsset, amount: l.collateral }, { at, kind: 'Borrow', asset: l.borrowAsset, amount: l.borrowed });
                state.wallet[l.collateralAsset] = (BigInt(state.wallet[l.collateralAsset] ?? '0') - BigInt(l.collateral)).toString();
                state.wallet[l.borrowAsset] = (BigInt(state.wallet[l.borrowAsset] ?? '0') + BigInt(l.borrowed)).toString();
                changed = true;
            }
            if (l.repaidAt && !l.closedAt && now() - l.repaidAt >= DEMO_TIMING.repayMs) {
                l.closedAt = l.repaidAt + DEMO_TIMING.repayMs;
                l.debt = '0';
                state.wallet[l.collateralAsset] = (BigInt(state.wallet[l.collateralAsset] ?? '0') + BigInt(l.collateral)).toString();
                changed = true;
            }
        }
        if (changed) save();
    }

    function quote(req: QuoteRequest): LendQuote {
        const c = m(req.collateralAsset), b = m(req.borrowAsset);
        const collateral = BigInt(req.collateralAmount || '0'), borrow = BigInt(req.borrowAmount || '0');
        const fee = activationFee(borrow, b.activationFeeBps);
        const opening = borrow + fee;
        const collateralUnits = toNumber(collateral, c.decimals);
        const debtUsd = toNumber(opening, b.decimals) * b.priceUsd;
        const ltv = ltvBps(debtUsd, collateralUnits * c.priceUsd);
        const maxLtvBps = c.maxLtvBps - Math.max(200, req.ltvBufferBps ?? 200);
        const errors: string[] = [];
        if (c.asset === b.asset) errors.push('Collateral and the borrowed asset must differ.');
        if (borrow <= 0n || collateral <= 0n) errors.push('Enter both amounts.');
        else if (ltv > maxLtvBps) errors.push(`This loan would open at ${(ltv / 100).toFixed(1)}% LTV. The most allowed is ${(maxLtvBps / 100).toFixed(1)}%: add collateral or borrow less.`);
        if (collateral > BigInt(state.wallet[c.asset] ?? '0')) errors.push(`The demo wallet holds only ${toNumber(state.wallet[c.asset] ?? '0', c.decimals)} ${c.asset}.`);
        return {
            collateral: { asset: c.asset, chain: c.chain, amount: collateral.toString(), usd: collateralUnits * c.priceUsd },
            borrow: { asset: b.asset, chain: b.chain, amount: borrow.toString(), usd: toNumber(borrow, b.decimals) * b.priceUsd },
            ltvBps: ltv, maxLtvBps, liquidationThresholdBps: c.liquidationThresholdBps,
            activationFee: fee.toString(), openingDebt: opening.toString(), borrowApy: b.borrowApy,
            liquidationPrice: liquidationPrice(debtUsd, collateralUnits, c.liquidationThresholdBps), collateralPrice: c.priceUsd, errors,
        };
    }

    const loanOf = (ref: string): DemoLoan => {
        const l = state.loans.find(x => x.ref === ref.trim().toUpperCase());
        if (!l) throw new LendError('Loan not found.', 404);
        return l;
    };
    const newRef = () => {
        let n = now() + state.seq++;
        let ref = 'D';
        for (let i = 0; i < 5; i++) { ref += REF_ALPHABET[n % REF_ALPHABET.length]; n = Math.floor(n / REF_ALPHABET.length) + 7 * (i + 1); }
        return state.loans.some(l => l.ref === ref) ? `${ref.slice(0, 5)}${state.seq % 10}` : ref;
    };

    // ── advanced ──
    function portfolio(): Portfolio {
        const rows = (book: Record<string, string>, side: 'supply' | 'borrow'): Position[] => Object.entries(book).filter(([, v]) => BigInt(v) > 0n).map(([asset, amount]) => {
            const mk = m(asset);
            const usd = toNumber(amount, mk.decimals) * mk.priceUsd;
            const apy = side === 'supply' ? mk.supplyApy : mk.borrowApy;
            // A fixed 40 days of interest, so the rows show a figure without a clock running.
            const interest = BigInt(Math.round(Number(amount) * (apy / 100) * (40 / 365)));
            return { asset, amount, usd, apy, interest: interest.toString() };
        });
        const supplied = rows(state.supplied, 'supply'), borrowed = rows(state.borrowed, 'borrow');
        const suppliedUsd = supplied.reduce((s, p) => s + p.usd, 0), borrowedUsd = borrowed.reduce((s, p) => s + p.usd, 0);
        const thresholdBps = 7400, maxLtv = 0.65;
        const netValueUsd = suppliedUsd - borrowedUsd;
        const earn = supplied.reduce((s, p) => s + p.usd * p.apy, 0), pay = borrowed.reduce((s, p) => s + p.usd * p.apy, 0);
        const room = Math.max(0, suppliedUsd * maxLtv - borrowedUsd);
        const borrowable: Record<string, string> = {};
        for (const mk of markets) {
            if (BigInt(state.supplied[mk.asset] ?? '0') > 0n) { borrowable[mk.asset] = '0'; continue; }
            borrowable[mk.asset] = BigInt(Math.floor((room / mk.priceUsd) * 10 ** Math.min(mk.decimals, 8))).toString() + '0'.repeat(Math.max(0, mk.decimals - 8));
        }
        return {
            supplied, borrowed, suppliedUsd, borrowedUsd,
            healthPct: healthPct(borrowedUsd, suppliedUsd, thresholdBps),
            netApy: netValueUsd > 0 ? (earn - pay) / netValueUsd : 0,
            netValueUsd,
            netInterestUsd: supplied.reduce((s, p) => s + toNumber(p.interest, m(p.asset).decimals) * m(p.asset).priceUsd, 0) - borrowed.reduce((s, p) => s + toNumber(p.interest, m(p.asset).decimals) * m(p.asset).priceUsd, 0),
            wallet: { ...state.wallet }, borrowable,
        };
    }

    function move(asset: string, amount: bigint, apply: (mk: Market) => void): AdvancedReceipt {
        const mk = m(asset);
        if (amount <= 0n) throw new LendError('Enter an amount above zero.', 400);
        apply(mk);
        save();
        return { asset, amount: amount.toString(), usd: toNumber(amount, mk.decimals) * mk.priceUsd, etaMinutes: mk.chain === 'BTC' ? 40 : 15, txid: `demo-${(now() % 100000).toString().padStart(5, '0')}` };
    }
    const add = (book: Record<string, string>, asset: string, delta: bigint) => { book[asset] = (BigInt(book[asset] ?? '0') + delta).toString(); };

    return {
        id: 'demo',
        listMarkets: async () => markets,
        quote: async req => quote(req),
        createLoan: async (req: CreateLoanRequest) => {
            const q = quote(req);
            if (q.errors.length) throw new LendError(q.errors[0], 400);
            const loan: DemoLoan = { ref: newRef(), collateralAsset: q.collateral.asset, borrowAsset: q.borrow.asset, collateral: q.collateral.amount, borrowed: q.borrow.amount, debt: q.openingDebt, createdAt: now(), activity: [] };
            state.loans.unshift(loan);
            save();
            return view(loan);
        },
        getLoan: async ref => { settle(); return view(loanOf(ref)); },
        findLoans: async query => { settle(); const q = query.trim().toUpperCase(); return state.loans.filter(l => l.ref === q).map(view); },
        myLoans: async () => { settle(); return state.loans.map(view); },
        forgetLoan: ref => { state.loans = state.loans.filter(l => l.ref !== ref); save(); },

        simulate: {
            repay: async (ref, amount) => {
                settle();
                const l = loanOf(ref);
                if (stage(l).phase !== 'active') throw new LendError('This loan cannot be repaid right now.', 409);
                const debt = BigInt(l.debt);
                const pay = amount >= debt ? debt : amount;
                if (pay <= 0n) throw new LendError('Enter an amount above zero.', 400);
                if (pay > BigInt(state.wallet[l.borrowAsset] ?? '0')) throw new LendError(`The demo wallet does not hold enough ${l.borrowAsset}.`, 400);
                add(state.wallet, l.borrowAsset, -pay);
                l.activity.push({ at: now(), kind: 'Repay', asset: l.borrowAsset, amount: pay.toString() });
                if (pay === debt) l.repaidAt = now(); else l.debt = (debt - pay).toString();
                save();
                return view(l);
            },
            depositMore: async (ref, amount) => {
                settle();
                const l = loanOf(ref);
                if (stage(l).phase !== 'active') throw new LendError('Collateral can be added once the loan is active.', 409);
                if (amount <= 0n) throw new LendError('Enter an amount above zero.', 400);
                if (amount > BigInt(state.wallet[l.collateralAsset] ?? '0')) throw new LendError(`The demo wallet does not hold enough ${l.collateralAsset}.`, 400);
                add(state.wallet, l.collateralAsset, -amount);
                l.collateral = (BigInt(l.collateral) + amount).toString();
                l.activity.push({ at: now(), kind: 'Supply', asset: l.collateralAsset, amount: amount.toString() });
                save();
                return view(l);
            },
        },

        advanced: {
            portfolio: async () => portfolio(),
            supply: async (asset, amount) => move(asset, amount, () => {
                if (BigInt(state.borrowed[asset] ?? '0') > 0n) throw new LendError('You cannot supply a token you are borrowing.', 400);
                if (amount > BigInt(state.wallet[asset] ?? '0')) throw new LendError(`The demo wallet does not hold enough ${asset}.`, 400);
                add(state.wallet, asset, -amount); add(state.supplied, asset, amount);
            }),
            withdraw: async (asset, amount) => move(asset, amount, mk => {
                const have = BigInt(state.supplied[asset] ?? '0');
                if (amount > have) throw new LendError(`Only ${toNumber(have, mk.decimals)} ${asset} is supplied.`, 400);
                const p = portfolio();
                const leftUsd = p.suppliedUsd - toNumber(amount, mk.decimals) * mk.priceUsd;
                if (p.borrowedUsd > leftUsd * 0.65) throw new LendError('Withdrawing this much would leave your borrowing under-collateralised. Repay first.', 400);
                add(state.supplied, asset, -amount); add(state.wallet, asset, amount);
            }),
            borrow: async (asset, amount) => move(asset, amount, mk => {
                if (BigInt(state.supplied[asset] ?? '0') > 0n) throw new LendError('You cannot borrow while supplying the same token.', 400);
                if (amount > BigInt(portfolio().borrowable[asset] ?? '0')) throw new LendError(`That is more ${asset} than your supplied collateral allows.`, 400);
                add(state.borrowed, asset, amount + activationFee(amount, mk.activationFeeBps)); add(state.wallet, asset, amount);
            }),
            repay: async (asset, amount) => move(asset, amount, mk => {
                const owe = BigInt(state.borrowed[asset] ?? '0');
                const pay = amount > owe ? owe : amount;
                if (pay > BigInt(state.wallet[asset] ?? '0')) throw new LendError(`The demo wallet does not hold enough ${asset}.`, 400);
                void mk;
                add(state.borrowed, asset, -pay); add(state.wallet, asset, -pay);
            }),
        },

        wallet: () => { settle(); return { ...state.wallet }; },
        activity: ref => [...loanOf(ref).activity].sort((a, b) => b.at - a.at),
        reset: () => { state = seed(now()); try { storage?.removeItem(KEY); } catch { /* nothing to clear */ } },
    };
}
