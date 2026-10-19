import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    scanHdWallet,
    buildLockingMapFromCache,
    loadHdCache,
    clearHdCache,
    scheduleRescan,
    cancelRescan,
    HD_GAP_LIMIT,
} from '../hdScan';
import type { DappConnectionManager } from '@wizardconnect/dapp';

class MemoryStorage {
    private store = new Map<string, string>();
    getItem(key: string) { return this.store.get(key) ?? null; }
    setItem(key: string, val: string) { this.store.set(key, String(val)); }
    removeItem(key: string) { this.store.delete(key); }
    clear() { this.store.clear(); }
}

const mockStorage = new MemoryStorage();
(globalThis as any).localStorage = mockStorage;
(globalThis as any).window = {
    localStorage: mockStorage,
};

describe('hdScan module', () => {
    // Deterministic fake pubkey generator for tests
    function makeFakeManager(): DappConnectionManager {
        return {
            getPubkey: vi.fn((childIndex: number, index: bigint) => {
                const b = new Uint8Array(33);
                b[0] = 0x02;
                b[1] = childIndex & 0xff;
                b[2] = Number(index & 0xffn);
                return b;
            }),
        } as unknown as DappConnectionManager;
    }

    beforeEach(() => {
        mockStorage.clear();
        vi.clearAllMocks();
        vi.restoreAllMocks();
    });

    it('scans up to gap limit and records lastUsedIndex', async () => {
        const manager = makeFakeManager();

        let receiveCount = 0;
        const fakeProvider = {
            performRequest: vi.fn(async (method: string, _params: any[]) => {
                if (method === 'blockchain.scripthash.get_history') {
                    const currentIdx = receiveCount++;
                    // receive addresses are queried first (indices 0, 1, 3 have history)
                    if (currentIdx === 0 || currentIdx === 1 || currentIdx === 3) {
                        return [{ tx_hash: 'abc', height: 100 }];
                    }
                }
                return [];
            }),
        };

        const walletId = 'wiz-test-123';
        const result = await scanHdWallet(walletId, manager, 'testnet', fakeProvider);

        expect(result.receive.lastUsedIndex).toBe(3);
        // Scanned up to 3 + 20 = 23 (indices 0..23 = 24 addresses)
        expect(result.receive.addresses.length).toBe(24);
        expect(result.receive.lockingMap.size).toBe(24);

        // Change was all empty, so lastUsedIndex is -1
        expect(result.change.lastUsedIndex).toBe(-1);
        expect(result.change.addresses.length).toBe(20);

        // Result was cached
        const cached = loadHdCache(walletId);
        expect(cached).not.toBeNull();
        expect(cached?.receiveLastUsed).toBe(3);
        expect(cached?.changeLastUsed).toBe(-1);
    });

    it('clears cache properly', () => {
        const walletId = 'wiz-test-clear';
        localStorage.setItem('wiz_hd_' + walletId, JSON.stringify({ receiveLastUsed: 5, changeLastUsed: 2, scannedAt: Date.now() }));
        expect(loadHdCache(walletId)).not.toBeNull();

        clearHdCache(walletId);
        expect(loadHdCache(walletId)).toBeNull();
    });

    it('builds locking map from cache without network calls', () => {
        const manager = makeFakeManager();
        const cache = {
            receiveLastUsed: 2,
            changeLastUsed: 1,
            scannedAt: Date.now(),
        };

        const map = buildLockingMapFromCache(manager, 'testnet', cache);
        // receive: up to 2 + 20 = 22 (indices 0..22 = 23)
        // change: up to 1 + 20 = 21 (indices 0..21 = 22)
        // total = 45 entries
        expect(map.size).toBe(45);

        // Verify values
        for (const entry of map.values()) {
            expect(['receive', 'change']).toContain(entry.pathName);
            expect(typeof entry.index).toBe('number');
        }
    });

    it('schedules and cancels background rescan without errors', () => {
        vi.useFakeTimers();
        const manager = makeFakeManager();
        const fakeProvider = { performRequest: vi.fn(async () => []) };
        const onResult = vi.fn();

        scheduleRescan('wiz-rescan', manager, 'testnet', fakeProvider, onResult, 1000);
        cancelRescan('wiz-rescan');

        vi.advanceTimersByTime(2000);
        expect(onResult).not.toHaveBeenCalled();

        vi.useRealTimers();
    });
});
