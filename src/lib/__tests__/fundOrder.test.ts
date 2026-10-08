import { describe, expect, it } from 'vitest';
import { awaitingParts, fundingProblem, isOpen, networkOfAddress, statusView, targetFromIntent, targetFromTwap } from '../fundOrder';

// Real chipnet covenant addresses with their token-aware forms (same script hash).
const COV_A = 'bchtest:pvg92pn3v4ed9gswzrkqx9gldptavw944p7zth9chfjfg4cy85css3z09fmuj';
const COV_A_TOKEN = 'bchtest:rvg92pn3v4ed9gswzrkqx9gldptavw944p7zth9chfjfg4cy85cssr3nys69e';
const COV_B = 'bchtest:pwua5ak3wuke0g54jqts5vs295xv8sanvnmrgr70hjes7fshjffcs58a5eg79';
const COV_B_TOKEN = 'bchtest:rwua5ak3wuke0g54jqts5vs295xv8sanvnmrgr70hjes7fshjffcsx5p4qf8w';
const MAKER = 'bchtest:qz86d8zuq8p78mxunejverhp8e0t97zdsgcdy5272e';
const PKH = '8fa69c5c01c3e3ecdc9e64cc8ee13e5eb2f84d82';
const PUSD = 'dfe50223c8d5cba8dcef8dff6d92b61deb88a8ba44947367f2b746487b56039b';

const intent = (over: Record<string, unknown> = {}) => ({
    id: 'intent_1', intentId: 'intent_1', type: 'dutch', status: 'awaiting_funding',
    makerAddress: MAKER, makerPkh: PKH, contractAddress: COV_A,
    sellToken: 'BCH', buyToken: PUSD, sellAmount: '100000', buyAmount: '2970', minAmountOut: '2970', startBuyAmount: '3000',
    expiryTimestamp: 1_791_393_600, refundEligibleAt: 1_791_397_200,
    funding: { to: COV_A, satoshis: '100000' },
    ...over,
});

const slice = (k: number, covenant: string, over: Record<string, unknown> = {}) => ({
    intentId: `s${k}`, twapSliceIndex: k, status: 'awaiting_funding', contractAddress: covenant,
    sellAmount: '100000', minAmountOut: '2940', startTime: 1_791_390_000 + k * 600,
    expiryTimestamp: 1_791_393_600 + k * 600, refundEligibleAt: 1_791_397_200 + k * 600, ...over,
});
const twap = (over: Record<string, unknown> = {}) => ({
    orderId: 'tw1', status: 'AWAITING_FUNDING', creatorAddress: MAKER, creatorPkh: PKH, tokenIn: '0x', tokenOut: PUSD,
    numSlices: 2, totalAmountIn: '200000', slices: [slice(0, COV_A), slice(1, COV_B)],
    funding: [{ to: COV_A, satoshis: '100000' }, { to: COV_B, satoshis: '100000' }],
    ...over,
});

describe('targetFromIntent', () => {
    it('reads a BCH order', () => {
        const t = targetFromIntent(intent());
        expect(t).toMatchObject({
            kind: 'order', id: 'intent_1', status: 'awaiting_funding', orderType: 'dutch',
            makerAddress: MAKER, makerPkh: PKH, sellToken: 'BCH', buyToken: PUSD,
            sellAmount: '100000', minReceive: '2970', startReceive: '3000', expiresAt: 1_791_393_600,
        });
        expect(t.parts).toHaveLength(1);
        expect(t.funding).toEqual([{ to: COV_A, satoshis: '100000' }]);
    });

    it('a funded order has nothing to fund', () => {
        const t = targetFromIntent(intent({ status: 'active', funding: undefined }));
        expect(t.funding).toEqual([]);
        expect(awaitingParts(t)).toEqual([]);
        expect(fundingProblem(t)).toBe('This order is not waiting for funds.');
    });

    it('reads the limit type and normalises token ids', () => {
        const t = targetFromIntent(intent({ type: 'limit', sellToken: PUSD.toUpperCase(), buyToken: '0x', startBuyAmount: undefined }));
        expect(t).toMatchObject({ orderType: 'limit', sellToken: PUSD, buyToken: 'BCH' });
        expect(t.startReceive).toBeUndefined();
    });
});

describe('targetFromTwap', () => {
    it('totals the slices', () => {
        const t = targetFromTwap(twap());
        expect(t).toMatchObject({
            kind: 'twap', id: 'tw1', status: 'awaiting_funding', orderType: 'twap', sellToken: 'BCH', buyToken: PUSD,
            sellAmount: '200000', minReceive: '5880', expiresAt: 1_791_394_200, refundEligibleAt: 1_791_397_800,
        });
        expect(t.parts.map(p => p.covenant)).toEqual([COV_A, COV_B]);
        expect(fundingProblem(t)).toBeNull();
    });

    it('a partly funded TWAP is checked against the slices still waiting', () => {
        const t = targetFromTwap(twap({ status: 'RUNNING', slices: [slice(0, COV_A, { status: 'active' }), slice(1, COV_B)], funding: [{ to: COV_B, satoshis: '100000' }] }));
        expect(awaitingParts(t).map(p => p.id)).toEqual(['s1']);
        expect(fundingProblem(t)).toBeNull();
    });
});

describe('fundingProblem', () => {
    it('accepts funding that pays the covenant its sold amount', () => {
        expect(fundingProblem(targetFromIntent(intent()))).toBeNull();
    });

    it('accepts a token order funded at the covenant\'s token address', () => {
        const t = targetFromIntent(intent({ sellToken: PUSD, buyToken: 'BCH', sellAmount: '700', funding: { to: COV_A_TOKEN, satoshis: '1000', token: { category: PUSD, amount: '700' } } }));
        expect(fundingProblem(t)).toBeNull();
    });

    it('refuses an output to an address that is not the order\'s covenant', () => {
        expect(fundingProblem(targetFromIntent(intent({ funding: { to: COV_B, satoshis: '100000' } })))).toMatch(/not one of this order's covenants/);
        expect(fundingProblem(targetFromIntent(intent({ funding: { to: MAKER, satoshis: '100000' } })))).toMatch(/not one of this order's covenants/);
        expect(fundingProblem(targetFromIntent(intent({ funding: { to: 'garbage', satoshis: '100000' } })))).toMatch(/not one of this order's covenants/);
    });

    it('refuses an amount that is not the order\'s', () => {
        expect(fundingProblem(targetFromIntent(intent({ funding: { to: COV_A, satoshis: '900000' } })))).toBe('A funding output pays 900000 sats; the order sells 100000.');
        expect(fundingProblem(targetFromIntent(intent({ funding: { to: COV_A, satoshis: '0' } })))).toMatch(/no satoshi amount/);
    });

    it('refuses a token on a BCH order, and the wrong token or amount on a token order', () => {
        expect(fundingProblem(targetFromIntent(intent({ funding: { to: COV_A, satoshis: '100000', token: { category: PUSD, amount: '1' } } })))).toMatch(/sells BCH but/);
        const tokenOrder = (funding: unknown) => targetFromIntent(intent({ sellToken: PUSD, buyToken: 'BCH', sellAmount: '700', funding }));
        expect(fundingProblem(tokenOrder({ to: COV_A_TOKEN, satoshis: '1000' }))).toMatch(/does not carry the token/);
        expect(fundingProblem(tokenOrder({ to: COV_A_TOKEN, satoshis: '1000', token: { category: 'a'.repeat(64), amount: '700' } }))).toMatch(/does not carry the token/);
        expect(fundingProblem(tokenOrder({ to: COV_A_TOKEN, satoshis: '1000', token: { category: PUSD, amount: '7000' } }))).toBe('A funding output pays 7000 token units; the order sells 700.');
    });

    it('refuses a list that does not match the covenants one to one', () => {
        expect(fundingProblem(targetFromTwap(twap({ funding: [{ to: COV_A, satoshis: '100000' }] })))).toBe('The server listed 1 funding output(s) for 2 covenant(s).');
        expect(fundingProblem(targetFromTwap(twap({ funding: [{ to: COV_A, satoshis: '100000' }, { to: COV_A, satoshis: '100000' }] })))).toMatch(/not one of this order's covenants/);
    });

    it('accepts a token TWAP funded at each slice\'s token address', () => {
        const t = targetFromTwap(twap({
            tokenIn: PUSD, tokenOut: '0x', totalAmountIn: '1400',
            slices: [slice(0, COV_A, { sellAmount: '700' }), slice(1, COV_B, { sellAmount: '700' })],
            funding: [{ to: COV_B_TOKEN, satoshis: '1000', token: { category: PUSD, amount: '700' } }, { to: COV_A_TOKEN, satoshis: '1000', token: { category: PUSD, amount: '700' } }],
        }));
        expect(fundingProblem(t)).toBeNull();
    });
});

describe('helpers', () => {
    it('networkOfAddress reads the prefix', () => {
        expect(networkOfAddress(MAKER)).toBe('chipnet');
        expect(networkOfAddress('bitcoincash:qz86d8zuq8p78mxunejverhp8e0t97zdsgulqngfd9')).toBe('mainnet');
        expect(networkOfAddress('qz86d8zuq8p78mxunejverhp8e0t97zdsgcdy5272e')).toBeNull();
    });

    it('statuses read plainly and say whether to keep watching', () => {
        expect(statusView('awaiting_funding')).toMatchObject({ label: 'Awaiting funding', tone: 'wait' });
        expect(statusView('expired')).toMatchObject({ label: 'Refund pending', tone: 'back' });
        expect(statusView('expired_unfunded')).toMatchObject({ label: 'Expired', tone: 'dead' });
        expect(statusView('something_new').label).toBe('something_new');
        expect(isOpen('active')).toBe(true);
        expect(isOpen('expired')).toBe(true);
        expect(isOpen('filled')).toBe(false);
        expect(isOpen('expired_unfunded')).toBe(false);
    });
});
