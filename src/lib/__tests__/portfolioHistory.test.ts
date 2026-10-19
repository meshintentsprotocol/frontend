import { describe, it, expect, beforeEach } from 'vitest';
import {
    getHistoryKey,
    getPortfolioHistory,
    recordPortfolioPoint,
} from '../portfolioHistory';

class MemoryStorage {
    private store = new Map<string, string>();
    getItem(key: string) { return this.store.get(key) ?? null; }
    setItem(key: string, val: string) { this.store.set(key, String(val)); }
    removeItem(key: string) { this.store.delete(key); }
    clear() { this.store.clear(); }
}

const mockStorage = new MemoryStorage();
(globalThis as any).window = { localStorage: mockStorage };
(globalThis as any).localStorage = mockStorage;

describe('portfolioHistory', () => {
    const net = 'chipnet';
    const addrs = [
        'bchtest:qp3wjpa3tjlj042z2wv7hahsldgwhwy0rq9sywjpyy',
        '0x1111111111111111111111111111111111111111',
    ];

    beforeEach(() => {
        mockStorage.clear();
    });

    it('generates consistent storage keys regardless of address order', () => {
        const k1 = getHistoryKey(net, [addrs[0], addrs[1]]);
        const k2 = getHistoryKey(net, [addrs[1], addrs[0]]);
        expect(k1).toBe(k2);
    });

    it('records first point immediately', () => {
        const now = Date.now();
        const list = recordPortfolioPoint(net, addrs, 1500.5, now);
        expect(list).toHaveLength(1);
        expect(list[0]).toEqual({ t: now, totalUsd: 1500.5 });
    });

    it('ignores snapshots within the same hour', () => {
        const now = Date.now();
        recordPortfolioPoint(net, addrs, 1000, now);
        const second = recordPortfolioPoint(net, addrs, 1200, now + 30 * 60 * 1000); // 30 min later
        expect(second).toHaveLength(1);
        expect(second[0].totalUsd).toBe(1000);
    });

    it('records snapshot after 1 hour', () => {
        const now = Date.now();
        recordPortfolioPoint(net, addrs, 1000, now);
        const second = recordPortfolioPoint(net, addrs, 1200, now + 61 * 60 * 1000); // 61 min later
        expect(second).toHaveLength(2);
        expect(second[1].totalUsd).toBe(1200);
    });
});
