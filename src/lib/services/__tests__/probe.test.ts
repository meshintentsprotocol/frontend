import { describe, it, expect } from 'vitest';
import registryJson from '../endpoints.json';
import { probeAll, probeUrl, resolveEndpoints, summarize, getPath, type Registry } from '../probe';

const registry = registryJson as unknown as Registry;

/** A fake fetch: url → { status, body } (or 'fail' to throw). */
function fakeFetch(routes: Record<string, { status?: number; body?: unknown } | 'fail'>) {
    const calls: string[] = [];
    const f = (async (url: string) => {
        calls.push(url);
        const r = routes[url];
        if (!r || r === 'fail') throw new TypeError('fetch failed');
        return new Response(r.body === undefined ? 'x' : JSON.stringify(r.body), { status: r.status ?? 200 });
    }) as unknown as typeof fetch;
    return { f, calls };
}

describe('endpoint registry', () => {
    it('has unique ids and a probe for each', () => {
        const ids = registry.endpoints.map(e => e.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const e of registry.endpoints) expect(['health', 'http', 'evm-rpc', 'sol-rpc']).toContain(e.probe);
    });

    it('resolves like src/lib/config.ts: own setting, then fallback setting, then the code default', () => {
        const eps = resolveEndpoints(registry, { VITE_MESH_SERVER_URL: 'https://mesh.example' });
        const by = (id: string) => eps.find(e => e.id === id)!;
        expect(by('mesh-testnet')).toMatchObject({ url: 'https://mesh.example', source: 'VITE_MESH_SERVER_URL' });
        expect(by('mesh-quotes-testnet')).toMatchObject({ url: 'https://mesh.example', source: 'VITE_MESH_SERVER_URL (fallback)' });
        expect(by('evm-testnet')).toMatchObject({ url: 'http://localhost:3005', source: 'code default' });
        expect(by('cctp-mainnet')).toMatchObject({ url: '', source: 'not set' });
        const sanity = resolveEndpoints(registry, { VITE_SANITY_PROJECT_ID: 'abc' }).find(e => e.id === 'sanity')!;
        expect(sanity.url).toBe('https://abc.api.sanity.io/v1/ping');
    });

    it('builds health URLs from the base, or from the origin for /mcp', () => {
        const eps = resolveEndpoints(registry, { VITE_MCP_URL: 'https://mcp.example/mcp', VITE_MESH_SERVER_URL: 'https://x.example/' });
        expect(probeUrl(eps.find(e => e.id === 'mcp')!)).toBe('https://mcp.example/health');
        expect(probeUrl(eps.find(e => e.id === 'mesh-testnet')!)).toBe('https://x.example/health');
    });

    it('reads dotted paths', () => {
        expect(getPath({ a: { b: { c: 1 } } }, 'a.b.c')).toBe(1);
        expect(getPath({ a: null }, 'a.b')).toBeUndefined();
    });
});

describe('probes', () => {
    const only = (ids: string[]): Registry => ({ endpoints: registry.endpoints.filter(e => ids.includes(e.id)) });

    it('live when the server reports the expected network; mismatch otherwise', async () => {
        const { f } = fakeFetch({
            'http://a/health': { body: { status: 'ok', network: 'chipnet' } },
            'http://a/health/ready': { body: { ready: true } },
        });
        const rows = await probeAll(only(['mesh-testnet', 'mesh-mainnet']), { VITE_MESH_SERVER_URL: 'http://a', VITE_CASHTOKEN_RELAYER_MAINNET_URL: 'http://a' }, { fetch: f });
        expect(rows[0].result).toMatchObject({ status: 'live', reported: 'chipnet' });
        expect(rows[1].result).toMatchObject({ status: 'mismatch', reported: 'chipnet' });
        expect(rows[1].result.detail).toContain('Expected mainnet');
    });

    it('degraded when the readiness check answers 503', async () => {
        const { f } = fakeFetch({
            'http://a/health': { body: { network: 'chipnet' } },
            'http://a/health/ready': { status: 503, body: { ready: false, reasons: ['solver loop stopped'] } },
        });
        const [row] = await probeAll(only(['mesh-testnet']), { VITE_MESH_SERVER_URL: 'http://a' }, { fetch: f });
        expect(row.result).toMatchObject({ status: 'degraded', detail: 'Not ready: solver loop stopped' });
    });

    it('says why a mainnet side is off, from the server', async () => {
        const { f } = fakeFetch({ 'http://e/health': { body: { bch: 'chipnet', mainnet: { status: 'disabled — set MAINNET_ENABLED=true to activate' } } } });
        const [row] = await probeAll(only(['evm-mainnet']), { VITE_EVM_RELAYER_MAINNET_URL: 'http://e' }, { fetch: f });
        expect(row.result.status).toBe('mismatch');
        expect(row.result.detail).toContain('MAINNET_ENABLED');
    });

    it('down on no answer or an error status; optional unset is fine', async () => {
        const { f } = fakeFetch({ 'http://b/health': { status: 500, body: {} } });
        const rows = await probeAll(only(['cctp-testnet', 'evm-testnet', 'cctp-mainnet']), { VITE_CCTP_SWAP_SERVER_URL: 'http://b', VITE_EVM_RELAYER_URL: 'http://gone' }, { fetch: f });
        expect(rows.map(r => r.result.status)).toEqual(['down', 'down', 'unset']);
        expect(summarize(rows)).toMatchObject({ down: 2, unset: 1, problems: 2 });
    });

    it('JSON-RPC: chain id for EVM, getHealth for Solana', async () => {
        const f = (async (_url: string, init?: RequestInit) => {
            const body = JSON.parse(String(init?.body));
            return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: body.method === 'eth_chainId' ? '0x38' : 'ok' }));
        }) as unknown as typeof fetch;
        const rows = await probeAll(only(['bsc-rpc', 'solana-rpc']), {}, { fetch: f });
        const by = (id: string) => rows.find(r => r.endpoint.id === id)!.result;
        expect(by('bsc-rpc')).toMatchObject({ status: 'live', reported: 'chain 56' });
        expect(by('solana-rpc')).toMatchObject({ status: 'live', reported: 'ok' });
    });

    it('probes a shared URL once and flags localhost from a deployed page', async () => {
        const { f, calls } = fakeFetch({ 'http://localhost:3001/health': { body: { network: 'chipnet' } }, 'http://localhost:3001/health/ready': { body: {} } });
        const rows = await probeAll(only(['mesh-testnet', 'mesh-quotes-testnet']), {}, { fetch: f, pageOrigin: 'https://app.example' });
        expect(calls.filter(u => u === 'http://localhost:3001/health')).toHaveLength(1);
        expect(rows.every(r => r.result.warning === 'Points at localhost from a deployed page')).toBe(true);
        expect(summarize(rows).problems).toBe(2);
    });
});
