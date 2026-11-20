import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { TokenMetadata } from '../bcmr';

const A = 'aa'.repeat(32), B = 'bb'.repeat(32);
const metadata = (category = A, network: 'mainnet' | 'chipnet' = 'mainnet'): TokenMetadata => ({
    category, resolvedCategory: category, network, name: 'Alpha', symbol: 'ALP', decimals: 8,
    icon: 'ipfs://logo', uris: { icon: 'ipfs://logo' }, description: '', isNft: false,
    nftType: null, nfts: null, source: 'bcmr-indexer', snapshotTimestamp: null, migratedTo: null, fetchedAt: 1000,
});
const response = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

describe('production metadata boundary', () => {
    beforeEach(() => { vi.resetModules(); });
    afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

    it('rejects metadata for a different category, network or source', async () => {
        const { parseServerMetadata } = await import('../bcmr');
        expect(parseServerMetadata(A, 'mainnet', metadata())).toMatchObject({ decimals: 8 });
        expect(parseServerMetadata(A, 'chipnet', metadata())).toBeNull();
        expect(parseServerMetadata(B, 'mainnet', metadata())).toBeNull();
        expect(parseServerMetadata(A, 'mainnet', { ...metadata(), category: 123 })).toBeNull();
        expect(parseServerMetadata(A, 'mainnet', { ...metadata(), source: 'verified' })).toBeNull();
    });

    it.each([true, '8', null, -1, 19, 1.2])('rejects decimals %p rather than coercing units', async decimals => {
        const { parseServerMetadata } = await import('../bcmr');
        expect(parseServerMetadata(A, 'mainnet', { ...metadata(), decimals })).toBeNull();
    });

    it('rejects old ambiguous migration responses but accepts category-specific snapshots', async () => {
        const { parseServerMetadata } = await import('../bcmr');
        expect(parseServerMetadata(A, 'mainnet', { ...metadata(), migratedTo: B, resolvedCategory: undefined })).toBeNull();
        expect(parseServerMetadata(A, 'mainnet', { ...metadata(), migratedTo: B })).toMatchObject({ category: A, migratedTo: B, decimals: 8 });
    });

    it('does not cache an outage as missing metadata', async () => {
        const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
        vi.stubGlobal('fetch', fetchMock);
        const { BcmrClient } = await import('../bcmr');
        await expect(BcmrClient.get(A, true)).rejects.toThrow();
        fetchMock.mockResolvedValueOnce(response(200, metadata()));
        expect(await BcmrClient.get(A, true)).toMatchObject({ category: A });
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('preserves good batch entries and leaves transient entries retryable', async () => {
        vi.stubGlobal('fetch', vi.fn(async (input: string) => {
            if (input.endsWith('/bcmr/batch')) return response(200, { network: 'mainnet', tokens: { [A]: metadata(), [B]: null }, unavailable: [B] });
            throw new Error('offline');
        }));
        const { BcmrClient } = await import('../bcmr');
        const result = await BcmrClient.getMany([A, B], true);
        expect(result[A]).toMatchObject({ symbol: 'ALP' });
        expect(B in result).toBe(false);
        vi.stubGlobal('fetch', vi.fn(async () => response(200, metadata(B))));
        expect(await BcmrClient.get(B, true)).toMatchObject({ category: B });
    });

    it('does not turn omitted batch entries into authoritative null results', async () => {
        vi.stubGlobal('fetch', vi.fn(async (input: string) => input.endsWith('/bcmr/batch')
            ? response(200, { network: 'mainnet', tokens: {} }) : response(200, metadata())));
        const { BcmrClient } = await import('../bcmr');
        expect((await BcmrClient.getMany([A], true))[A]).toMatchObject({ category: A });
    });

    it('does not consume a batch from the other network', async () => {
        vi.stubGlobal('fetch', vi.fn(async (input: string) => input.endsWith('/bcmr/batch')
            ? response(200, { network: 'chipnet', tokens: { [A]: metadata(A, 'chipnet') } }) : response(200, metadata())));
        const { BcmrClient } = await import('../bcmr');
        expect((await BcmrClient.getMany([A], true))[A]?.network).toBe('mainnet');
    });

    it('deduplicates single lookups and isolates mainnet and chipnet caches', async () => {
        const fetchMock = vi.fn(async (input: string) => response(200, metadata(A, input.includes('network=mainnet') ? 'mainnet' : 'chipnet')));
        vi.stubGlobal('fetch', fetchMock);
        const { BcmrClient } = await import('../bcmr');
        await Promise.all([BcmrClient.get(A, true), BcmrClient.get(A, true)]);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect((await BcmrClient.get(A, false))?.network).toBe('chipnet');
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('rescales per-token metrics together and retains total liquidity', async () => {
        const { CauldronService } = await import('../cauldron');
        const raw = { token_id: A, display_name: 'Alpha', display_symbol: 'ALP', score_rank: 1,
            trade_volume: 123, tvl_sats: 456, tvl_tokens: 500, price_now: 2, price_now_usd: 3,
            price_24h: 1, price_24h_usd: 2, change_24h_bp: 0, change_7d_bp: 0,
            bcmr: { token: { category: A, symbol: 'ALP', decimals: 2 } } };
        const row = CauldronService.applyMetadata(raw, metadata());
        expect(row.price_now).toBe(2_000_000);
        expect(row.price_now_usd).toBe(3_000_000);
        expect(row.tvl_tokens).toBe(0.0005);
        expect(row.tvl_sats).toBe(456);
        expect(row.trade_volume).toBe(123);
        expect(CauldronService.metadataOf(row).decimals).toBe(8);
        expect(CauldronService.applyMetadata(raw, metadata(B))).toBe(raw);
    });

    it('retries logo URLs after the bounded failure-cache TTL', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(1000);
        const { markIconUrlFailed, isIconUrlFailed, ICON_FAILURE_RETRY_MS } = await import('../tokenIcons');
        markIconUrlFailed('https://example.com/logo.svg');
        expect(isIconUrlFailed('https://example.com/logo.svg')).toBe(true);
        vi.advanceTimersByTime(ICON_FAILURE_RETRY_MS + 1);
        expect(isIconUrlFailed('https://example.com/logo.svg')).toBe(false);
    });
});
