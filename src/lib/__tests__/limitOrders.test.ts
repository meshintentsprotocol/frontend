import { describe, it, expect } from 'vitest';
import type { BCHOrder, Token } from '@/types';
import { toBaseUnits, fromBaseUnits, ratioString, limitBuyUnits, plainDecimal, isEmptyAmount } from '../units';
import { checkExpiry, describeDuration, EXPIRY_MAX_SECONDS, EXPIRY_PRESETS } from '../expiry';
import { applyMeshIntent, meshStatus } from '../meshIntent';

describe('units', () => {
    it('converts typed decimals exactly (no float rounding)', () => {
        expect(Math.floor(0.29 * 1e8)).toBe(28999999);           // the bug this replaces
        expect(toBaseUnits('0.29', 8)).toBe(29_000_000n);
        expect(toBaseUnits(0.57, 8)).toBe(57_000_000n);
        expect(toBaseUnits('1.5', 2)).toBe(150n);
        expect(toBaseUnits('.5', 2)).toBe(50n);
        expect(toBaseUnits('12', 0)).toBe(12n);
    });

    it('cuts digits beyond the token decimals instead of rounding up', () => {
        expect(toBaseUnits('1.239', 2)).toBe(123n);
        expect(toBaseUnits('0.000000019', 8)).toBe(1n);
    });

    it('rejects what is not an amount', () => {
        for (const v of ['', '.', '-1', '1e5', 'abc', '1.2.3']) expect(toBaseUnits(v, 8)).toBeNull();
        expect(plainDecimal(1e-7)).toBe('0.0000001');
        expect(toBaseUnits(1e-7, 8)).toBe(10n);
    });

    it('formats base units back', () => {
        expect(fromBaseUnits(29_000_000n, 8)).toBe('0.29');
        expect(fromBaseUnits(150n, 2)).toBe('1.5');
        expect(fromBaseUnits(5n, 0)).toBe('5');
        expect(fromBaseUnits('100000000', 8)).toBe('1');
    });

    it('prices a quote rounded down, so "fills now" never asks for more than the quote', () => {
        // 100 pUSD (2 dp) -> 34412700 sats: 1 pUSD = 0.00344127 BCH
        expect(ratioString(34_412_700n, 8, 10_000n, 2)).toBe('0.00344127');
        // 1 BCH -> 290.29 pUSD
        expect(ratioString(29_029n, 2, 100_000_000n, 8)).toBe('290.29');
        // 3 -> 1 rounds 0.333… down
        expect(ratioString(1n, 0, 3n, 0, 4)).toBe('0.3333');
    });

    it('buy units at a limit price round down and match the quote at its own ratio', () => {
        const sell = 10_000n; // 100.00 pUSD
        const quote = 34_412_777n;
        const price = ratioString(quote, 8, sell, 2);
        const buy = limitBuyUnits(sell, 2, price, 8)!;
        expect(buy).toBeLessThanOrEqual(quote);
        expect(Number(quote - buy)).toBeLessThan(Number(quote) / 1e6); // within 1 ppm
        expect(limitBuyUnits(100_000n, 8, '290', 2)).toBe(29n);  // 0.001 BCH at 290 = 0.29
        expect(limitBuyUnits(100_000n, 8, '0', 2)).toBeNull();
        expect(limitBuyUnits(100_000n, 8, 'x', 2)).toBeNull();
    });

    it('knows an empty amount', () => {
        for (const v of ['', '0', '0.', '.', '0.000']) expect(isEmptyAmount(v)).toBe(true);
        expect(isEmptyAmount('0.01')).toBe(false);
    });
});

describe('expiry', () => {
    it('presets stay within the server limit of 7 days', () => {
        for (const p of EXPIRY_PRESETS) expect(p.seconds).toBeLessThanOrEqual(EXPIRY_MAX_SECONDS);
        expect(EXPIRY_MAX_SECONDS).toBe(604800);
    });

    it('checks a number and a unit', () => {
        expect(checkExpiry('90', 'minutes')).toEqual({ ok: true, seconds: 5400 });
        expect(checkExpiry('4.5', 'hours')).toEqual({ ok: true, seconds: 16200 });
        expect(checkExpiry('7', 'days')).toEqual({ ok: true, seconds: 604800 });
        expect(checkExpiry('8', 'days')).toMatchObject({ ok: false, error: 'At most 7 days' });
        expect(checkExpiry('2', 'minutes')).toMatchObject({ ok: false, error: 'At least 5 minutes' });
        expect(checkExpiry('', 'hours')).toMatchObject({ ok: false });
        expect(checkExpiry('1 week', 'hours')).toMatchObject({ ok: false, error: 'Enter a number' });
    });

    it('describes durations', () => {
        expect(describeDuration(3600)).toBe('1 hour');
        expect(describeDuration(86400 + 7200)).toBe('1 day 2 hours');
        expect(describeDuration(5400)).toBe('1 hour 30 minutes');
        expect(describeDuration(604800)).toBe('7 days');
    });
});

const PUSD = { symbol: 'PUSD', chain: 'bch', type: 'cashtoken', decimals: 2 } as Token;
const BCH = { symbol: 'BCH', chain: 'bch', type: 'native', decimals: 8 } as Token;
const order = (over: Partial<BCHOrder> = {}): BCHOrder => ({
    id: 'i1', intentId: 'i1', swapType: 'same-chain', orderType: 'limit', sellToken: BCH, buyToken: PUSD,
    sellAmount: 0.001, buyAmount: 0.29, status: 'awaiting_funding', createdAt: 0, ...over,
});
const url = (t: string) => `https://x/tx/${t}`;

describe('mesh intent status', () => {
    it('maps every server display status', () => {
        expect(meshStatus('awaiting_funding')).toBe('awaiting_funding');
        expect(meshStatus('active')).toBe('pending');
        expect(meshStatus('scheduled')).toBe('pending');
        expect(meshStatus('underfunded')).toBe('underfunded');
        expect(meshStatus('expired')).toBe('expired');
        expect(meshStatus('refund_pending')).toBe('expired');
        expect(meshStatus('expired_unfunded')).toBe('abandoned');
        expect(meshStatus('filled')).toBe('filled');
        expect(meshStatus('refunded')).toBe('refunded');
        expect(meshStatus('cancelled')).toBe('cancelled');
        expect(meshStatus('closed_external')).toBe('closed');
        expect(meshStatus('something-new')).toBeNull();
    });

    it('takes the server times and the fill', () => {
        const o = order();
        expect(applyMeshIntent(o, { status: 'active', expiryTimestamp: 2000, refundEligibleAt: 2100 }, url)).toBe(true);
        expect(o).toMatchObject({ status: 'pending', expiryTime: 2000, refundableFrom: 2100 });
        applyMeshIntent(o, { status: 'filled', fillTxid: 'f'.repeat(64), fillMethod: 'CAULDRON', fill: { makerPaid: '31' } }, url);
        expect(o).toMatchObject({ status: 'filled', fillTxid: 'f'.repeat(64), routeType: 'CAULDRON_AMM', receivedUnits: '31' });
        expect(o.destExplorerUrl).toBe(url('f'.repeat(64)));
    });

    it('says why a limit order is waiting, and clears it once settled', () => {
        const o = order({ status: 'pending' });
        applyMeshIntent(o, { status: 'active', unfillableSince: 100 }, url);
        expect(o.lastSkipCategory).toBe('unprofitable_spread');
        applyMeshIntent(o, { status: 'active' }, url);
        expect(o.lastSkipCategory).toBeUndefined();
        const m = order({ status: 'pending', orderType: 'market' });
        applyMeshIntent(m, { status: 'active', reason: 'no route' }, url);
        expect(m).toMatchObject({ lastSkipCategory: 'no_route', lastSkipReason: 'no route' });
    });

    it('never reopens a settled order', () => {
        const o = order({ status: 'cancelled', cancelTxid: 'c'.repeat(64) });
        expect(applyMeshIntent(o, { status: 'active' }, url)).toBe(false);
        expect(o.status).toBe('cancelled');
    });

    it('records the refund and the external close', () => {
        const r = order({ status: 'expired' });
        applyMeshIntent(r, { status: 'refunded', refundTxid: 'r'.repeat(64) }, url);
        expect(r).toMatchObject({ status: 'refunded', refundTxid: 'r'.repeat(64), destExplorerUrl: url('r'.repeat(64)) });
        const c = order({ status: 'pending' });
        applyMeshIntent(c, { status: 'closed_external', closedTxid: 'e'.repeat(64) }, url);
        expect(c).toMatchObject({ status: 'closed', cancelTxid: 'e'.repeat(64) });
    });
});
