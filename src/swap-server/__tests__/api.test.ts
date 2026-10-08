import { describe, it, expect } from 'vitest';
import { createSwapServerApi, describeError, SwapServerError } from '../api';
import fixtures from './fixtures.json';

/** The client against a fake fetch that answers with bodies recorded from the running server. */
interface Call { url: string; method: string; body?: unknown }

function fakeFetch(answer: (call: Call) => { status: number; body?: unknown; text?: string } | Promise<never>) {
    const calls: Call[] = [];
    const impl = (async (url: string, init?: RequestInit) => {
        const call: Call = { url: String(url), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined };
        calls.push(call);
        const a = await answer(call);
        return {
            ok: a.status >= 200 && a.status < 300, status: a.status,
            json: async () => { if (a.text !== undefined) throw new Error('not json'); return a.body; },
        } as Response;
    }) as unknown as typeof fetch;
    return { impl, calls };
}

const caught = async (p: Promise<unknown>) => { try { await p; } catch (e) { return e; } throw new Error('expected a failure'); };

describe('requests', () => {
    it('builds the documented URLs and bodies', async () => {
        const { impl, calls } = fakeFetch(() => ({ status: 200, body: {} }));
        const api = createSwapServerApi('http://swap.test', impl);
        await api.getConfig();
        await api.getQuote({ src: 'base-sepolia', dst: 'arc-testnet', amount: '1.5' });
        await api.getActivity(['0xAbC', 'SoLaNa'], { limit: 20, before: 1700 });
        await api.getActivity([]);
        await api.createTransfer({ src: 'a', dst: 'b', amount: '1', sender: 's', recipient: 'r' });
        await api.submitBurn('id1', '0xburn');
        await api.submitFee('id1', '0xfee');
        await api.rebuildTransfer('id1');
        await api.trackBurn('base-sepolia', '0xburn');
        await api.getSolQuote({ inputMint: 'A', outputMint: 'B', amount: '1000000', taker: 'T' });
        await api.getSolPrices(['A', 'B']);
        expect(calls.map(c => `${c.method} ${c.url.replace('http://swap.test', '')}`)).toEqual([
            'GET /config',
            'GET /quote?src=base-sepolia&dst=arc-testnet&amount=1.5',
            'GET /activity?address=0xAbC%2CSoLaNa&limit=20&before=1700',
            'GET /activity',
            'POST /transfers',
            'POST /transfers/id1/burn',
            'POST /transfers/id1/fee',
            'POST /transfers/id1/rebuild',
            'POST /track',
            'GET /solana/quote?inputMint=A&outputMint=B&amount=1000000&taker=T',
            'GET /solana/prices?ids=A%2CB',
        ]);
        expect(calls[4].body).toEqual({ src: 'a', dst: 'b', amount: '1', sender: 's', recipient: 'r' });
        expect(calls[5].body).toEqual({ txHash: '0xburn' });
        expect(calls[8].body).toEqual({ src: 'base-sepolia', txHash: '0xburn' });
    });

    it('returns the JSON of a 2xx answer', async () => {
        const { impl } = fakeFetch(() => ({ status: 200, body: fixtures.config }));
        const cfg = await createSwapServerApi('http://swap.test', impl).getConfig();
        expect(cfg.cctp.chains.map(c => c.key)).toContain('arc-testnet');
        expect(cfg.solana.network).toBe('mainnet');
    });
});

describe('errors', () => {
    it.each(Object.entries(fixtures.errors))('a recorded %s answer becomes a SwapServerError with the server\'s code', async (_name, recorded) => {
        const { impl } = fakeFetch(() => ({ status: recorded.status, body: recorded.body }));
        const e = await caught(createSwapServerApi('http://swap.test', impl).getConfig());
        expect(e).toBeInstanceOf(SwapServerError);
        expect(e).toMatchObject({ status: recorded.status, code: recorded.body.code, message: recorded.body.error });
    });

    it('an error without a body takes the default code of its status', async () => {
        for (const [status, code] of [[429, 'RATE_LIMITED'], [503, 'UNAVAILABLE'], [502, 'UPSTREAM_ERROR'], [409, 'WRONG_STATE'], [500, 'INTERNAL'], [418, 'INTERNAL']] as const) {
            const { impl } = fakeFetch(() => ({ status, text: '<html>bad gateway</html>' }));
            expect(await caught(createSwapServerApi('http://swap.test', impl).getConfig())).toMatchObject({ status, code });
        }
    });

    it('no answer at all is UNREACHABLE with status 0', async () => {
        const { impl } = fakeFetch(() => Promise.reject(new TypeError('Failed to fetch')));
        const e = await caught(createSwapServerApi('http://swap.test', impl).getQuote({ src: 'a', dst: 'b', amount: '1' }));
        expect(e).toBeInstanceOf(SwapServerError);
        expect(e).toMatchObject({ status: 0, code: 'UNREACHABLE' });
    });

    it('a call the caller cancelled is not reported as an unreachable server', async () => {
        const ctrl = new AbortController();
        const impl = ((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        })) as unknown as typeof fetch;
        const pending = caught(createSwapServerApi('http://swap.test', impl).getConfig({ signal: ctrl.signal }));
        ctrl.abort();
        const e = await pending;
        expect(e).not.toBeInstanceOf(SwapServerError);
        expect((e as Error).name).toBe('AbortError');
    });

    it('a call that takes too long is abandoned and reported as unreachable', async () => {
        const impl = ((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        })) as unknown as typeof fetch;
        const e = await caught(createSwapServerApi('http://swap.test', impl).getConfig({ timeoutMs: 20 }));
        expect(e).toMatchObject({ status: 0, code: 'UNREACHABLE' });
    });
});

describe('sentences for the user', () => {
    it('uses the server\'s sentence, capitalised, except where a code has a better one', () => {
        expect(describeError(new SwapServerError(400, 'BELOW_MINIMUM', 'amount below minimum 1 USDC'))).toBe('Amount below minimum 1 USDC');
        expect(describeError(new SwapServerError(429, 'RATE_LIMITED', 'rate limited'))).toBe('Too many requests. Try again in a few seconds.');
        expect(describeError(new SwapServerError(503, 'PAUSED', 'new transfers are paused'))).toBe('This service is temporarily unavailable.');
    });

    it('shortens a wallet or RPC error to its first line', () => {
        expect(describeError(Object.assign(new Error('long\nstack'), { shortMessage: 'insufficient funds for gas' }))).toBe('insufficient funds for gas');
        expect(describeError(new Error('execution reverted\n    at …'))).toBe('execution reverted');
    });
});
