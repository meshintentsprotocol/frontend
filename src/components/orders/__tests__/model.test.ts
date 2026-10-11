import { describe, it, expect } from 'vitest';
import type { BCHOrder, TwapOrderRecord, Token } from '@/types';
import type { ActivityItem } from '@/swap-server/types';
import {
    bchOrderLinks, bchOrderSteps, bchOrderTimer, chainsOfSwapType, countByKind, filterOrders, formatAmount,
    fromActivity, fromBchOrder, fromTwapOrder, sortOrders, twapSteps, type AssetInfo,
} from '../model';

const BCH: Token = { symbol: 'BCH', name: 'Bitcoin Cash', chain: 'bch', type: 'native', decimals: 8, icon: '/bch.svg' } as Token;
const PUSD: Token = { symbol: 'PUSD', name: 'ParyonUSD', chain: 'bch', type: 'cashtoken', decimals: 2, icon: '/pusd.png' } as Token;

const order = (over: Partial<BCHOrder> = {}): BCHOrder => ({
    id: 'o1', swapType: 'same-chain', orderType: 'market', sellToken: BCH, buyToken: PUSD,
    sellAmount: 0.1, buyAmount: 43.2, status: 'pending', createdAt: 1_700_000_000_000, duration: 60, txid: 'a'.repeat(64),
    ...over,
});

const asset = (cat: string): AssetInfo => (cat === '0x' ? { symbol: 'BCH', decimals: 8 } : { symbol: 'PUSD', decimals: 2 });

const slice = (i: number, status: string, over: object = {}) => ({
    intentId: `s${i}`, status, sellAmount: '1000000', minAmountOut: '400', refundEligibleAt: 1_700_010_000,
    createdAt: 1_700_000_100, twapSliceIndex: i, ...over,
});

const twap = (over: Partial<TwapOrderRecord> = {}): TwapOrderRecord => ({
    orderId: 't1', status: 'RUNNING', creatorAddress: 'bchtest:q', creatorPkh: '00', tokenIn: '0x', tokenOut: 'c'.repeat(64),
    numSlices: 3, slicesFilled: 1, slicesRefunded: 0, totalAmountIn: '3000000',
    slices: [
        slice(0, 'filled', { fillSources: { mesh: '300', cauldron: '130', solver: '0' }, fillMethod: 'mesh', explorerUrl: 'https://x/tx' }),
        slice(1, 'active'),
        slice(2, 'scheduled', { startTime: 1_700_001_300 }),
    ],
    ...over,
});

const activity = (over: Partial<ActivityItem> = {}): ActivityItem => ({
    id: 'a1', kind: 'transfer', product: 'cctp', network: 'testnet', status: 'BURN_CONFIRMED', phase: 'processing', terminal: false,
    createdAt: 1_700_000_500_000, updatedAt: 1_700_000_500_000, owner: '0x1', recipient: '0x1',
    sell: { chain: 'eth-sepolia', chainName: 'Ethereum Sepolia', symbol: 'USDC', display: '10' },
    buy: { chain: 'arc-testnet', chainName: 'Arc Testnet', symbol: 'USDC', display: '9.98', estimated: true },
    links: { source: 'https://e/tx/1' },
    ...over,
} as ActivityItem);

describe('fromBchOrder', () => {
    it('reads a market swap as a swap that is open and approximate', () => {
        const item = fromBchOrder(order(), { isMainnet: false });
        expect(item).toMatchObject({ key: 'bch:o1', kind: 'swap', open: true, buyApprox: true, route: 'Bitcoin Cash · Dutch auction' });
        expect(item.sell).toMatchObject({ symbol: 'BCH', amount: '0.1' });
        expect(item.status).toMatchObject({ label: 'Pending', tone: 'progress' });
    });

    it('reads a limit order as its own kind, with an exact amount', () => {
        const item = fromBchOrder(order({ orderType: 'limit', expiryTime: 1_700_003_600 }), { isMainnet: false });
        expect(item.kind).toBe('limit');
        expect(item.buyApprox).toBe(false);
        expect(item.route).toBe('Bitcoin Cash · limit order');
    });

    it('does not call "expired" or "failed" finished: the refund or the retry is still to come', () => {
        expect(fromBchOrder(order({ status: 'expired' }), { isMainnet: false })).toMatchObject({ open: true, status: { label: 'Refund pending', tone: 'waiting' } });
        expect(fromBchOrder(order({ status: 'failed' }), { isMainnet: false })).toMatchObject({ open: true, status: { label: 'Retrying' } });
        expect(fromBchOrder(order({ status: 'refunded' }), { isMainnet: false }).open).toBe(false);
    });

    it('names both chains of a cross-chain swap and surfaces a claim', () => {
        const item = fromBchOrder(order({ swapType: 'bch-to-sol', status: 'claimable' }), { isMainnet: false });
        expect(item.route).toBe('Bitcoin Cash → Solana');
        expect(item.status.tone).toBe('action');
    });

    it('says why an open order has not filled yet', () => {
        expect(fromBchOrder(order({ lastSkipCategory: 'unprofitable_spread' }), { isMainnet: false }).note?.text).toBe('Waiting for a better price');
        expect(fromBchOrder(order({ status: 'filled', lastSkipCategory: 'unprofitable_spread' }), { isMainnet: false }).note).toBeUndefined();
    });
});

describe('links', () => {
    it('uses the explorer of the network the order is on', () => {
        expect(bchOrderLinks(order(), false)[0].href).toContain('chipnet.chaingraph.cash/tx/');
        expect(bchOrderLinks(order(), true)[0].href).toContain('blockchair.com/bitcoin-cash/transaction/');
    });

    it('links a fill on the destination chain and a refund on the source chain', () => {
        const filled = bchOrderLinks(order({ swapType: 'bch-to-sol', status: 'filled', fillTxid: 'sig' }), false);
        expect(filled.map(l => l.label)).toEqual(['Source', 'Fill']);
        expect(filled[1].href).toContain('explorer.solana.com/tx/sig');
        const refunded = bchOrderLinks(order({ swapType: 'bch-to-sol', status: 'refunded', refundTxid: 'b'.repeat(64) }), false);
        expect(refunded[1]).toMatchObject({ label: 'Refund' });
        expect(refunded[1].href).toContain('chaingraph');
    });

    it('splits a swap type into its chains', () => {
        expect(chainsOfSwapType('same-chain')).toEqual(['bch', 'bch']);
        expect(chainsOfSwapType('mov-to-sol')).toEqual(['movement', 'solana']);
        expect(chainsOfSwapType('eth-to-bch')).toEqual(['eth', 'bch']);
    });
});

describe('bchOrderTimer', () => {
    const created = 1_700_000_000;
    it('shows how far a Dutch auction has run', () => {
        expect(bchOrderTimer(order(), created + 30)?.text).toBe('auction 30s / 1m 0s (50%)');
    });
    it('counts a limit order down to its expiry, then to the refund', () => {
        const limit = order({ orderType: 'limit', expiryTime: created + 3600 });
        expect(bchOrderTimer(limit, created + 60)?.text).toBe('expires in 59m 0s');
        expect(bchOrderTimer(limit, created + 3600 + 600)).toMatchObject({ tone: 'red' });
        expect(bchOrderTimer(limit, created + 3600 + 600)?.text).toContain('refund in ~');
    });
    it('has no clock for a settled order', () => {
        expect(bchOrderTimer(order({ status: 'filled' }), created + 30)).toBeNull();
    });
});

describe('fromTwapOrder', () => {
    it('shows what arrived, the slices filled, and when it was placed', () => {
        const item = fromTwapOrder(twap(), asset);
        expect(item).toMatchObject({ kind: 'twap', open: true, createdAt: 1_700_000_100_000 });
        expect(item.sell).toMatchObject({ symbol: 'BCH', amount: '0.03' });
        expect(item.buy).toMatchObject({ symbol: 'PUSD', amount: '4.3' });
        expect(item.progress).toEqual({ done: 1, total: 3, refunded: 0 });
    });

    it('shows the minimum while nothing has filled', () => {
        const none = twap({ slicesFilled: 0, slices: [slice(0, 'active'), slice(1, 'scheduled')] });
        expect(fromTwapOrder(none, asset)).toMatchObject({ buyApprox: true, buy: { amount: '8' } });
    });

    it('is history once every slice is over', () => {
        expect(fromTwapOrder(twap({ status: 'PARTIALLY_FILLED' }), asset)).toMatchObject({ open: false, status: { label: 'Partly filled' } });
    });
});

describe('fromActivity', () => {
    it('reads a transfer as a bridge with its step and both links', () => {
        const item = fromActivity(activity({ links: { source: 'https://e/1', destination: 'https://e/2' } }));
        expect(item).toMatchObject({ kind: 'bridge', open: true, buyApprox: true, route: 'Ethereum Sepolia → Arc Testnet · Circle CCTP' });
        expect(item.status).toEqual({ label: 'Attesting', tone: 'progress' });
        expect(item.links.map(l => l.label)).toEqual(['Source', 'Delivery']);
    });

    it('reads a Jupiter record as a swap, and an unsigned one as not signed', () => {
        const item = fromActivity(activity({ kind: 'swap', product: 'jupiter', phase: 'awaiting_signature', status: 'CREATED' }));
        expect(item).toMatchObject({ kind: 'swap', route: 'Solana · Jupiter', status: { label: 'Not signed', tone: 'action' } });
    });
});

describe('the board', () => {
    const items = [
        fromBchOrder(order({ id: 'old', createdAt: 1_000 }), { isMainnet: false }),
        fromBchOrder(order({ id: 'claim', swapType: 'bch-to-sol', status: 'claimable', createdAt: 2_000 }), { isMainnet: false }),
        fromBchOrder(order({ id: 'lim', orderType: 'limit', status: 'filled', createdAt: 3_000 }), { isMainnet: false }),
        fromTwapOrder(twap(), asset),
        fromActivity(activity()),
    ];

    it('counts and narrows by kind', () => {
        expect(countByKind(items)).toEqual({ all: 5, swap: 2, limit: 1, twap: 1, bridge: 1 });
        expect(filterOrders(items, 'twap').map(i => i.id)).toEqual(['t1']);
        expect(filterOrders(items, 'all')).toHaveLength(5);
    });

    it('sorts by time in both directions', () => {
        expect(sortOrders(items, 'newest').map(i => i.id)).toEqual(['a1', 't1', 'lim', 'claim', 'old']);
        expect(sortOrders(items, 'oldest').map(i => i.id)).toEqual(['old', 'claim', 'lim', 't1', 'a1']);
    });

    it('puts what needs the user first, and what is finished last', () => {
        const ids = sortOrders(items, 'status').map(i => i.id);
        expect(ids[0]).toBe('claim');
        expect(ids[ids.length - 1]).toBe('lim');
    });

    it('does not reorder the list it was given', () => {
        const before = items.map(i => i.id);
        sortOrders(items, 'pair');
        expect(items.map(i => i.id)).toEqual(before);
    });
});

describe('steps', () => {
    const opts = { isMainnet: false, nowSec: 1_700_000_030 };
    const states = (o: BCHOrder) => bchOrderSteps(o, opts).map(s => `${s.key}:${s.state}`);

    it('walks a swap from created to received', () => {
        expect(states(order())).toEqual(['create:done', 'fund:done', 'fill:active', 'end:pending']);
        const filled = bchOrderSteps(order({ status: 'filled', fillTxid: 'f'.repeat(64) }), opts);
        expect(filled.map(s => s.state)).toEqual(['done', 'done', 'done', 'done']);
        expect(filled[3]).toMatchObject({ label: 'Filled', note: '43.2 PUSD arrived' });
        expect(filled[3].link).toContain('f'.repeat(64));
    });

    it('ends a refunded order on the refund, not on a failure', () => {
        const steps = bchOrderSteps(order({ status: 'refunded', refundTxid: 'b'.repeat(64) }), opts);
        expect(steps[steps.length - 1]).toMatchObject({ label: 'Refunded', state: 'done' });
        expect(steps.some(s => s.state === 'failed')).toBe(false);
    });

    it('stops an order that was never funded at the funding step', () => {
        expect(states(order({ status: 'abandoned', txid: undefined }))).toEqual(['create:done', 'fund:failed', 'fill:pending', 'end:pending']);
    });

    it('asks for the claim on a cross-chain swap', () => {
        const steps = bchOrderSteps(order({ swapType: 'bch-to-sol', status: 'claimable' }), opts);
        expect(steps.find(s => s.key === 'claim')).toMatchObject({ label: 'Claim on Solana', state: 'attention' });
    });

    it('gives a TWAP one step per slice', () => {
        const steps = twapSteps(twap(), asset, t => `t${t}`);
        expect(steps.map(s => s.state)).toEqual(['done', 'active', 'pending']);
        expect(steps[0]).toMatchObject({ label: 'Slice 1 · 0.01 BCH → 4.3 PUSD', note: 'Filled · via mesh', link: 'https://x/tx' });
        expect(steps[1].label).toBe('Slice 2 · 0.01 BCH → min 4 PUSD');
        expect(steps[2].note).toBe('Scheduled · opens t1700001300');
    });
});

describe('formatAmount', () => {
    it('keeps amounts short and never invents one', () => {
        expect(formatAmount(0.1)).toBe('0.1');
        expect(formatAmount(43.2)).toBe('43.2');
        expect(formatAmount(0)).toBe('0');
        expect(formatAmount(undefined)).toBe('?');
        expect(formatAmount('abc')).toBe('?');
    });
});
