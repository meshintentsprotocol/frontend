import { describe, expect, it } from 'vitest';
import { collateralForLtv, distancePct, fmtPct, fromUnits, healthPct, liquidationPrice, ltvBps, ltvZone, project, toUnits } from '../math';
import { createDemoProvider, DEMO_DEPOSIT_ADDRESS, DEMO_MARKETS, DEMO_REPAY_ADDRESS, DEMO_TIMING } from '../providers/demo';
import { createLiquidiumProvider } from '../providers/liquidium';
import { LendError } from '../provider';

describe('loan arithmetic', () => {
    it('converts between text and base units without rounding up', () => {
        expect(toUnits('0.02', 8)).toBe(2_000_000n);
        expect(toUnits('500', 6)).toBe(500_000_000n);
        expect(toUnits('1.123456789', 6)).toBe(1_123_456n);
        expect(toUnits('1,000.5', 6)).toBe(1_000_500_000n);
        expect(toUnits('', 8)).toBe(0n);
        expect(toUnits('abc', 8)).toBe(0n);
        expect(fromUnits(2_000_000n, 8)).toBe('0.02');
        expect(fromUnits('502500000', 6)).toBe('502.5');
        expect(fromUnits(1n, 8)).toBe('0.00000001');
    });

    it('LTV, liquidation price and health agree with the figures Liquidium shows', () => {
        // 0.02 BTC at 83,000 against 502.5 USDC: 30.3% LTV, liquidated at 33,953.
        const debtUsd = 502.5, units = 0.02, price = 83_000;
        expect(ltvBps(debtUsd, units * price)).toBe(3027);
        expect(fmtPct(3027)).toBe('30.3%');
        expect(Math.round(liquidationPrice(debtUsd, units, 7400))).toBe(33_953);
        expect(distancePct(33_953, 83_000).toFixed(1)).toBe('-59.1');
        expect(healthPct(0, 1000, 7400)).toBe(100);
        expect(healthPct(740, 1000, 7400)).toBe(0);
        expect(healthPct(370, 1000, 7400)).toBeCloseTo(50);
    });

    it('finds the collateral for a target LTV, never short of it', () => {
        const btc = DEMO_MARKETS[0];
        const units = collateralForLtv(502.5, 3000, btc);
        expect(ltvBps(502.5, (Number(units) / 1e8) * btc.priceUsd)).toBeLessThanOrEqual(3000);
        expect(collateralForLtv(0, 3000, btc)).toBe(0n);
    });

    it('colours the LTV: safe, close to the limit, over it', () => {
        expect(ltvZone(3000, 6300)).toBe('safe');
        expect(ltvZone(5500, 6300)).toBe('caution');
        expect(ltvZone(6400, 6300)).toBe('danger');
    });
});

const memory = () => { const map = new Map<string, string>(); return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); }, removeItem: (k: string) => { map.delete(k); } }; };

function demo() {
    let t = 1_800_000_000_000;
    const storage = memory();
    const provider = createDemoProvider({ storage, now: () => t });
    return { provider, storage, advance: (ms: number) => { t += ms; }, now: () => t };
}
const base = { collateralAsset: 'BTC', borrowAsset: 'USDC', collateralAmount: '2000000', borrowAmount: '500000000' };
const addresses = { borrowDestination: 'x', refundDestination: 'y' };

describe('demo mode', () => {
    it('starts with the examples: an active loan, one awaiting its deposit, a closed one', async () => {
        const { provider } = demo();
        const loans = await provider.myLoans([]);
        expect(loans.map(l => [l.ref, l.phase])).toEqual([['DOPEN1', 'active'], ['DWAIT1', 'awaiting_deposit'], ['DCLSD1', 'closed']]);
        expect(loans.every(l => l.provider === 'demo')).toBe(true);
        expect(loans[0].ltvBps).toBe(2191);
    });

    it('quotes with the fee, and refuses what the real service would', async () => {
        const { provider } = demo();
        const q = await provider.quote(base);
        expect(q).toMatchObject({ ltvBps: 3027, maxLtvBps: 6300, activationFee: '2500000', openingDebt: '502500000', errors: [] });
        expect((await provider.quote({ ...base, borrowAmount: '1100000000' })).errors[0]).toMatch(/most allowed is 63\.0%/);
        expect((await provider.quote({ ...base, borrowAsset: 'BTC' })).errors[0]).toMatch(/must differ/);
        expect((await provider.quote({ ...base, collateralAmount: '99900000000' })).errors.join(' ')).toMatch(/demo wallet holds only/);
        await expect(provider.createLoan({ ...base, ...addresses, borrowAmount: '1100000000' })).rejects.toBeInstanceOf(LendError);
    });

    it('a new loan gets a D id and fake addresses, then funds itself by the clock', async () => {
        const { provider, advance } = demo();
        const created = await provider.createLoan({ ...base, ...addresses });
        expect(created.ref).toMatch(/^D[A-Z0-9]{5}$/);
        expect(created.phase).toBe('awaiting_deposit');
        expect(created.deposit.targets[0]).toMatchObject({ chain: 'BTC', address: DEMO_DEPOSIT_ADDRESS, amount: '2000001' });
        expect(created.repayment.targets).toEqual([]);
        const before = provider.wallet();

        advance(DEMO_TIMING.depositMs + DEMO_TIMING.perConfirmationMs * 2 + 10);
        const confirming = await provider.getLoan(created.ref);
        expect(confirming.phase).toBe('confirming');
        expect(confirming.status).toMatchObject({ confirmations: 2, requiredConfirmations: 4 });

        advance(DEMO_TIMING.perConfirmationMs * 3);
        const active = await provider.getLoan(created.ref);
        expect(active.phase).toBe('active');
        expect(active.position).toMatchObject({ collateral: '2000000', totalDebt: '502500000' });
        expect(active.repayment.targets[0]).toMatchObject({ chain: 'ETH', address: DEMO_REPAY_ADDRESS, amount: '502500000' });
        // The collateral left the demo wallet and the borrowed coins arrived, once.
        const after = provider.wallet();
        expect(BigInt(before.BTC) - BigInt(after.BTC)).toBe(2_000_000n);
        expect(BigInt(after.USDC) - BigInt(before.USDC)).toBe(500_000_000n);
        await provider.getLoan(created.ref);
        expect(provider.wallet()).toEqual(after);
        expect(provider.activity(created.ref).map(a => a.kind)).toEqual(['Borrow', 'Supply']);
    });

    it('repaying part lowers the debt; repaying all closes the loan and returns the collateral', async () => {
        const { provider, advance } = demo();
        const part = await provider.simulate!.repay('DOPEN1', 100_000_000n);
        expect(part.phase).toBe('active');
        expect(part.position.totalDebt).toBe('300000000');
        expect(part.ltvBps).toBeLessThan(2191);

        const btcBefore = BigInt(provider.wallet().BTC);
        const full = await provider.simulate!.repay('DOPEN1', 999_000_000_000n);   // more than is owed: only the debt is taken
        expect(full.phase).toBe('repaying');
        advance(DEMO_TIMING.repayMs + 1);
        const closed = await provider.getLoan('DOPEN1');
        expect(closed.phase).toBe('closed');
        expect(closed.ltvBps).toBe(0);
        expect(BigInt(provider.wallet().BTC) - btcBefore).toBe(2_200_000n);
        await expect(provider.simulate!.repay('DOPEN1', 1n)).rejects.toThrow(/cannot be repaid/);
    });

    it('adding collateral lowers the LTV and the liquidation price', async () => {
        const { provider } = demo();
        const before = await provider.getLoan('DOPEN1');
        const after = await provider.simulate!.depositMore('DOPEN1', 2_200_000n);
        expect(Math.abs(after.ltvBps - before.ltvBps / 2)).toBeLessThan(1);   // half, to the basis point
        expect(after.liquidationPrice).toBeCloseTo(before.liquidationPrice / 2, 4);
        await expect(provider.simulate!.depositMore('DWAIT1', 1n)).rejects.toThrow(/once the loan is active/);
    });

    it('projects a repayment and a top-up before they happen', async () => {
        const { provider } = demo();
        const loan = await provider.getLoan('DOPEN1');
        expect(project(loan, DEMO_MARKETS, { repay: 400_000_000n })).toMatchObject({ debt: 0n, ltvBps: 0, liquidationPrice: 0 });
        expect(Math.abs(project(loan, DEMO_MARKETS, { addCollateral: 2_200_000n }).ltvBps - loan.ltvBps / 2)).toBeLessThan(1);
    });

    it('remembers its state between visits, finds a loan by id, and forgets one on request', async () => {
        const { provider, storage, now } = demo();
        const created = await provider.createLoan({ ...base, ...addresses });
        const again = createDemoProvider({ storage, now });
        expect((await again.myLoans([])).some(l => l.ref === created.ref)).toBe(true);
        expect((await again.findLoans(created.ref.toLowerCase()))[0].ref).toBe(created.ref);
        expect(await again.findLoans('NOPE00')).toEqual([]);
        again.forgetLoan(created.ref);
        expect((await again.myLoans([])).some(l => l.ref === created.ref)).toBe(false);
    });

    it('advanced: supply, borrow against it, repay, withdraw, with the rules Liquidium applies', async () => {
        const { provider } = demo();
        const a = provider.advanced!;
        const start = await a.portfolio();
        expect(start.supplied[0]).toMatchObject({ asset: 'BTC', amount: '18000000' });
        expect(start.borrowed[0]).toMatchObject({ asset: 'USDT', amount: '2500000000' });
        expect(start.healthPct).toBeCloseTo(77.4, 0);
        expect(start.borrowable.BTC).toBe('0');

        const receipt = await a.supply('BTC', 10_000_000n);
        expect(receipt).toMatchObject({ asset: 'BTC', amount: '10000000', etaMinutes: 40 });
        expect((await a.portfolio()).healthPct).toBeGreaterThan(start.healthPct);

        await expect(a.borrow('BTC', 1000n)).rejects.toThrow(/cannot borrow while supplying the same token/);
        await expect(a.supply('USDT', 1_000_000n)).rejects.toThrow(/cannot supply a token you are borrowing/);
        await expect(a.borrow('USDC', 999_000_000_000n)).rejects.toThrow(/more USDC than your supplied collateral allows/);
        await a.borrow('USDC', 1_000_000_000n);
        expect((await a.portfolio()).borrowed.find(p => p.asset === 'USDC')?.amount).toBe('1005000000');

        await expect(a.withdraw('BTC', 28_000_000n)).rejects.toThrow(/under-collateralised/);
        await a.repay('USDC', 2_000_000_000n);
        await a.repay('USDT', 2_500_000_000n);
        const clear = await a.portfolio();
        expect(clear.borrowed).toEqual([]);
        expect(clear.healthPct).toBe(100);
        await a.withdraw('BTC', 28_000_000n);
        expect((await a.portfolio()).supplied).toEqual([]);
    });
});

describe('the real provider', () => {
    const fake = (routes: Record<string, { status?: number; body: unknown }>) => {
        const calls: { url: string; method: string; body?: unknown }[] = [];
        const fetchImpl = (async (url: string, init?: RequestInit) => {
            calls.push({ url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined });
            const key = Object.keys(routes).find(k => url.includes(k));
            const r = key ? routes[key] : { status: 404, body: { error: 'not found' } };
            return { ok: (r.status ?? 200) < 400, status: r.status ?? 200, json: async () => r.body } as Response;
        }) as typeof fetch;
        return { calls, fetchImpl };
    };

    it('talks to /lend on the swap server and passes the server\'s own sentence on', async () => {
        const { calls, fetchImpl } = fake({ '/lend/markets': { body: { markets: DEMO_MARKETS } }, '/lend/quote': { status: 400, body: { error: 'collateralAmount must be above zero' } } });
        const p = createLiquidiumProvider('https://swap.example/', fetchImpl);
        expect((await p.listMarkets()).length).toBe(DEMO_MARKETS.length);
        expect(calls[0]).toMatchObject({ url: 'https://swap.example/lend/markets', method: 'GET' });
        await expect(p.quote(base)).rejects.toMatchObject({ message: 'collateralAmount must be above zero', status: 400 });
        expect(calls[1]).toMatchObject({ method: 'POST', body: base });
    });

    it('without a server URL it says so, and has no demo-only actions', async () => {
        const p = createLiquidiumProvider('', fake({}).fetchImpl);
        await expect(p.listMarkets()).rejects.toThrow(/not set up in this build/);
        expect(p.simulate).toBeUndefined();
        expect(p.advanced).toBeUndefined();
    });
});
