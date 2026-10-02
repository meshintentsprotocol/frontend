import { describe, it, expect, vi, afterEach } from 'vitest';
import { createAdminApi, AdminApiError, sellAsset, buyAsset } from '../api';

/** Admin console client: reads are open, writes carry x-admin-key, errors keep the server's message. */
function mockFetch(status: number, body: unknown) {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('createAdminApi', () => {
  it('reads without the key and drops empty query params', async () => {
    const f = mockFetch(200, { total: 0, intents: [], counts: {} });
    await createAdminApi('http://mesh:3001/', () => 'secret').intents({ status: 'open', kind: '', owner: undefined, limit: 50 });
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe('http://mesh:3001/api/v1/admin/intents?status=open&limit=50');
    expect((init?.headers as Record<string, string>)['x-admin-key']).toBeUndefined();
  });

  it('writes send the current key and a JSON body', async () => {
    const f = mockFetch(200, { routes: {} });
    let key = 'k1';
    const api = createAdminApi('http://mesh:3001', () => key);
    key = 'k2';
    await api.setRoutes({ meshEnabled: false, reason: 'maintenance' });
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe('http://mesh:3001/api/v1/admin/routes/control');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>)['x-admin-key']).toBe('k2');
    expect(JSON.parse(String(init?.body))).toEqual({ meshEnabled: false, reason: 'maintenance' });
  });

  it('throws AdminApiError with status and server message', async () => {
    mockFetch(401, { error: 'Missing or invalid x-admin-key' });
    const err = await createAdminApi('http://mesh', () => '').retryIntent('intent_1').catch(e => e);
    expect(err).toBeInstanceOf(AdminApiError);
    expect(err).toMatchObject({ status: 401, message: 'Missing or invalid x-admin-key' });
  });

  it('ids are URL-encoded in paths', async () => {
    const f = mockFetch(200, {});
    await createAdminApi('http://mesh', () => 'k').resyncPool('bchtest:pabc');
    expect(f.mock.calls.at(-1)![0]).toBe('http://mesh/api/v1/admin/pools/bchtest%3Apabc/resync');
  });
});

describe('intent assets', () => {
  it("map 'BCH' to '0x' and keep categories", () => {
    expect(sellAsset({ sellToken: 'BCH' })).toBe('0x');
    expect(buyAsset({ buyToken: 'ab'.repeat(32) })).toBe('ab'.repeat(32));
  });
});
