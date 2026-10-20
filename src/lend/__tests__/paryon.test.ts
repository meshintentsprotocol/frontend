import { describe, expect, it } from 'vitest';
import { createParyonProvider } from '../providers/paryon';

describe('Paryon provider adapter', () => {
    const fake = (routes: Record<string, { status?: number; body: unknown }>) => {
        const calls: { url: string; method: string; body?: unknown }[] = [];
        const fetchImpl = (async (url: string, init?: RequestInit) => {
            calls.push({
                url,
                method: init?.method ?? 'GET',
                body: init?.body ? JSON.parse(String(init.body)) : undefined,
            });
            const key = Object.keys(routes).find(k => url.includes(k));
            const r = key ? routes[key] : { status: 404, body: { error: 'not found' } };
            return {
                ok: (r.status ?? 200) < 400,
                status: r.status ?? 200,
                json: async () => r.body,
            } as Response;
        }) as typeof fetch;
        return { calls, fetchImpl };
    };

    const mockMarket = {
        network: 'chipnet',
        paused: false,
        pauseReason: null,
        priceCents: '45000',
        totalDebtCents: '1000000',
        totalCollateralSats: '5000000000',
        loanCount: 12,
        rate: { minApr: 0.005, medianApr: 0.035, maxApr: 0.25, defaultApr: 0.02 },
        fees: { borrowFeeBps: 50, frontendFeeBps: 25 },
        limits: { minOpenRatioPct: 150, warnRatioPct: 130, minLoanCents: '2000' },
        currentPeriod: 5,
        priceContract: 'bchtest:pr1ce...',
    };

    const mockLoan = {
        loanTokenId: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
        txid: '1111222233334444111122223333444411112222333344441111222233334444',
        vout: 0,
        collateralSats: '100000000',
        debtCents: '20000',
        status: 2,
        currentRate: 15,
        nextRate: 15,
        aprPct: 2.5,
        collateralRatioPct: 225,
        liquidationPriceCents: '22000',
        beingRedeemedCents: '0',
        lastPeriodInterestPaid: 5,
    };

    it('lists markets and transforms Paryon market data into standard Market format', async () => {
        const { calls, fetchImpl } = fake({
            '/lendbch/market': { body: mockMarket },
        });

        const p = createParyonProvider('https://swap.example', fetchImpl);
        const markets = await p.listMarkets();

        expect(calls[0]).toMatchObject({ url: 'https://swap.example/lendbch/market', method: 'GET' });
        expect(markets).toHaveLength(2);
        expect(markets[0]).toMatchObject({
            asset: 'BCH',
            chain: 'BCH',
            priceUsd: 450,
            maxLtvBps: 6667, // 100 / 150% = 66.67%
        });
        expect(markets[1]).toMatchObject({
            asset: 'PUSD',
            chain: 'BCH',
            priceUsd: 1.0,
        });
    });

    it('quotes a borrow and calculates fees and liquidation price', async () => {
        const { calls, fetchImpl } = fake({
            '/lendbch/quote': {
                body: {
                    borrowCents: '20000',
                    collateralSats: '100000000',
                    priceCents: '45000',
                    maxBorrowCents: '30000',
                    minCollateralSats: '66666667',
                    collateralRatioPct: 225,
                    liquidationPriceCents: '22000',
                    protocolFeeSats: '50000',
                    frontendFeeSats: '25000',
                    aprPct: 2.0,
                    warnLowRatio: false,
                    allowed: true,
                },
            },
        });

        const p = createParyonProvider('https://swap.example', fetchImpl);
        const q = await p.quote({
            collateralAsset: 'BCH',
            borrowAsset: 'PUSD',
            collateralAmount: '100000000',
            borrowAmount: '20000',
        });

        expect(calls[0]).toMatchObject({
            url: 'https://swap.example/lendbch/quote',
            method: 'POST',
            body: {
                collateralSats: '100000000',
                borrowCents: '20000',
            },
        });
        expect(q.collateral.amount).toBe('100000000');
        expect(q.borrow.amount).toBe('20000');
        expect(q.borrowApy).toBe(2.0);
        expect(q.liquidationPrice).toBe(220);
        expect(q.ltvBps).toBe(4444); // 1,000,000 / 225 = 4444 bps (44.44% LTV)
    });

    it('fetches user loans and maps to LoanView with paryon metadata', async () => {
        const { calls, fetchImpl } = fake({
            '/lendbch/loans': {
                body: {
                    loans: [mockLoan],
                },
            },
        });

        const p = createParyonProvider('https://swap.example', fetchImpl);
        const loans = await p.myLoans(['bchtest:qp3wjpa3tlywygzy5ygjqz8gc2dtapvdcsw6s920ul']);

        expect(calls[0].url).toContain('/lendbch/loans?address=');
        expect(loans).toHaveLength(1);
        expect(loans[0]).toMatchObject({
            provider: 'paryon',
            phase: 'active',
            collateral: {
                asset: 'BCH',
                amount: '100000000',
            },
            borrow: {
                asset: 'PUSD',
                amount: '20000',
            },
            paryon: {
                loanTokenId: mockLoan.loanTokenId,
                collateralRatioPct: 225,
                status: 2,
            },
        });
    });

    it('exposes paryon-specific non-custodial prepare and submit methods', async () => {
        const { calls, fetchImpl } = fake({
            '/lendbch/prepare/borrow': {
                body: {
                    step1: { unsignedTxHex: '01000000...', inputIndex: 0, sighashType: 65 },
                    step2: { unsignedTxHex: '02000000...', inputIndex: 0, sighashType: 65 },
                },
            },
            '/lendbch/submit': {
                body: { txid: 'abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234' },
            },
        });

        const p = createParyonProvider('https://swap.example', fetchImpl);
        expect(p.paryon).toBeDefined();

        const prep = await p.paryon!.prepareBorrow({
            collateralSats: '100000000',
            borrowCents: '20000',
            ownerAddress: 'bchtest:qp3wjpa3tlywygzy5ygjqz8gc2dtapvdcsw6s920ul',
        });
        expect(prep.step1.sighashType).toBe(65);

        const sub = await p.paryon!.submit({
            step: 'step1',
            signedTxHex: '01000000signed',
        });
        expect(sub.txid).toBe('abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234');
    });

    it('fails gracefully when baseUrl is missing or endpoint is down', async () => {
        const p = createParyonProvider('', fake({}).fetchImpl);
        await expect(p.listMarkets()).rejects.toThrow(/Paryon BCH borrowing is not configured/);
    });

    it('demo provider supports quoting and creating BCH / PUSD loans', async () => {
        const { createDemoProvider } = await import('../providers/demo');
        const demo = createDemoProvider({ storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } });
        const quote = await demo.quote({
            collateralAsset: 'BCH',
            borrowAsset: 'PUSD',
            collateralAmount: '100000000', // 1 BCH
            borrowAmount: '20000',         // 200 PUSD ($200)
        });
        expect(quote.errors).toHaveLength(0);
        expect(quote.collateral.asset).toBe('BCH');
        expect(quote.borrow.asset).toBe('PUSD');
        expect(quote.ltvBps).toBeGreaterThan(0);

        const loan = await demo.createLoan({
            collateralAsset: 'BCH',
            borrowAsset: 'PUSD',
            collateralAmount: '100000000',
            borrowAmount: '20000',
            borrowDestination: 'demo',
            refundDestination: 'demo',
        });
        expect(loan.collateral.asset).toBe('BCH');
        expect(loan.borrow.asset).toBe('PUSD');
        expect(loan.ref).toMatch(/^D/);
    });
});
