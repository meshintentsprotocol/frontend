import { describe, it, expect, vi, afterEach } from 'vitest';
import { createAdminApi, AdminApiError, sellAsset, buyAsset } from '../api';

/** Admin console client: every request carries x-admin-key, errors keep the server's message. */
function mockFetch(status: number, body: unknown) {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('createAdminApi', () => {
  it('reads send the key too, and drop empty query params', async () => {
    const f = mockFetch(200, { total: 0, intents: [], counts: {} });
    await createAdminApi('http://mesh:3001/', () => 'secret').intents({ status: 'open', kind: '', owner: undefined, limit: 50 });
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe('http://mesh:3001/api/v1/admin/intents?status=open&limit=50');
    expect((init?.headers as Record<string, string>)['x-admin-key']).toBe('secret');
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

describe('Mesh Balancer calls', () => {
  it('reads the bot status and filtered trades', async () => {
    const f = mockFetch(200, { total: 0, trades: [] });
    const api = createAdminApi('http://mesh:3001', () => 'secret');
    await api.balancerTrades({ kind: 'mesh-cross', result: '', limit: 50, offset: 0 });
    await api.balancerTrade('trd-1/x');
    expect(f.mock.calls[0]![0]).toBe('http://mesh:3001/api/v1/admin/balancer/trades?kind=mesh-cross&limit=50&offset=0');
    expect(f.mock.calls[1]![0]).toBe('http://mesh:3001/api/v1/admin/balancer/trades/trd-1%2Fx');
    expect((f.mock.calls[0]![1]?.headers as Record<string, string>)['x-admin-key']).toBe('secret');
  });

  it('settings, pause and commands are writes with the admin key', async () => {
    const f = mockFetch(200, { config: {} });
    const api = createAdminApi('http://mesh:3001', () => 'k');
    await api.setBalancerConfig({ dryRun: false, modes: { sameOwner: false }, minProfitSats: '3000', note: 'go live' });
    await api.pauseBalancer('checking');
    await api.balancerCommand('split-utxos', { count: 8, sats: 40000 });
    const body = (i: number) => JSON.parse(String(f.mock.calls[i]![1]?.body));
    expect(f.mock.calls.map(c => c[0])).toEqual(['http://mesh:3001/api/v1/admin/balancer/config', 'http://mesh:3001/api/v1/admin/balancer/pause', 'http://mesh:3001/api/v1/admin/balancer/command']);
    expect(f.mock.calls.every(c => c[1]?.method === 'POST' && (c[1]?.headers as Record<string, string>)['x-admin-key'] === 'k')).toBe(true);
    expect(body(0)).toEqual({ dryRun: false, modes: { sameOwner: false }, minProfitSats: '3000', note: 'go live' });
    expect(body(1)).toEqual({ reason: 'checking' });
    expect(body(2)).toEqual({ type: 'split-utxos', count: 8, sats: 40000 });
  });
});

it('revenue requests use the authenticated Mesh admin endpoint', async () => {
 const f = mockFetch(200, {windows:{}});
 await createAdminApi('http://mesh:3001/', () => 'operator-key').revenue();
 expect(f.mock.calls[0]![0]).toBe('http://mesh:3001/api/v1/admin/revenue');
 expect((f.mock.calls[0]![1]?.headers as Record<string,string>)['x-admin-key']).toBe('operator-key');
});
