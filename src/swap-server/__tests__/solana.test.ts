import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { Keypair, SystemProgram, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { SwapServerError } from '../api';
import { SwapProgressView } from '../ProcessingDialog';
import { resolveRoute } from '../routing';
import { fromBase64, toBase64 } from '../signers';
import { jupiterToken, runSolanaSwap, toBaseUnits, withJupiterTokens, type SwapStage } from '../solana';
import { swapHeadline, swapSteps } from '../steps';
import type { Token } from '@/types';
import type { CreatedSolanaSwap, SolanaSwap, SolanaToken, SwapServerConfig } from '../types';
import fixtures from './fixtures.json';

/**
 * Solana swaps without a network: the token rows, the routing of a pair, and the create → sign → execute flow
 * against a fake server that checks what the wallet hands back.
 */
const config = fixtures.config as unknown as SwapServerConfig;
const SOL_MINT = config.solana.nativeMint;
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

const solToken = (over: Partial<SolanaToken>): SolanaToken => ({
    mint: USDC_MINT, symbol: 'USDC', name: 'USD Coin', decimals: 6, verified: true, suspicious: false, tags: [], isStock: false, usdPrice: 1, ...over,
});
const STATIC_SOL: Token = { symbol: 'SOL', name: 'Solana', icon: '', decimals: 9, type: '11111111111111111111111111111111', chain: 'solana', address: SOL_MINT };

describe('token rows', () => {
    it('a Jupiter token is identified by its mint and carries its flags and price', () => {
        const t = jupiterToken(solToken({ verified: false, suspicious: true, usdPrice: 0.5 }));
        expect(t).toMatchObject({ chain: 'solana', address: USDC_MINT, decimals: 6, priceUsd: 0.5 });
        expect(t.swapServer).toEqual({ product: 'jupiter', verified: false, suspicious: true, isStock: false });
    });

    it('joins the list in mainnet mode only, and the static SOL row stays the one SOL row', () => {
        const list = [solToken({ mint: SOL_MINT, symbol: 'SOL', decimals: 9 }), solToken({})];
        expect(withJupiterTokens([STATIC_SOL], list, false)).toEqual([STATIC_SOL]);
        const out = withJupiterTokens([STATIC_SOL], list, true);
        expect(out.map(t => t.address)).toEqual([SOL_MINT, USDC_MINT]);
        expect(out[0]).toBe(STATIC_SOL);
    });

    it('two tokens with one symbol stay two rows', () => {
        const out = withJupiterTokens([], [solToken({}), solToken({ mint: 'Fake111111111111111111111111111111111111111', verified: false })], true);
        expect(out).toHaveLength(2);
    });
});

describe('amounts', () => {
    it('turns a decimal amount into base units of the token', () => {
        expect(toBaseUnits('1.5', 6)).toBe('1500000');
        expect(toBaseUnits('0.000000001', 9)).toBe('1');
    });
    it('refuses what the token cannot express', () => {
        for (const bad of ['', '0', 'abc', '-1', '1.0000001']) expect(toBaseUnits(bad, 6)).toBeUndefined();
    });
});

describe('routing', () => {
    const usdc = jupiterToken(solToken({}));
    it('two Solana mints in mainnet mode go to Jupiter, by mint', () => {
        expect(resolveRoute(STATIC_SOL, usdc, { isMainnet: true, config })).toEqual({ kind: 'sol-jupiter', inputMint: SOL_MINT, outputMint: USDC_MINT });
    });
    it('the same pair in testnet mode is not offered', () => {
        expect(resolveRoute(STATIC_SOL, usdc, { isMainnet: false, config })).toMatchObject({ kind: 'unsupported' });
    });
    it('a token against itself is refused', () => {
        expect(resolveRoute(usdc, usdc, { isMainnet: true, config })).toMatchObject({ kind: 'unsupported' });
    });
});

// ── the flow ──

const keypair = Keypair.generate();

function unsignedTx(payer = keypair.publicKey): string {
    const msg = new TransactionMessage({
        payerKey: payer, recentBlockhash: '11111111111111111111111111111111',
        instructions: [SystemProgram.transfer({ fromPubkey: payer, toPubkey: Keypair.generate().publicKey, lamports: 1 })],
    }).compileToV0Message();
    return toBase64(new VersionedTransaction(msg).serialize());
}

const record = (over: Partial<SolanaSwap> = {}): SolanaSwap => ({
    id: 'swap-1', taker: keypair.publicKey.toBase58(), inputMint: SOL_MINT, outputMint: USDC_MINT, inAmount: '10000000', quotedOutAmount: '1500000',
    minOutAmount: '1492500', slippageBps: 50, status: 'CREATED', terminal: false, createdAt: 1, updatedAt: 1,
    display: { inAmount: '0.01', quotedOutAmount: '1.5', minOutAmount: '1.4925', inSymbol: 'SOL', outSymbol: 'USDC' }, links: {},
    ...over,
});

function server(opts: { tx?: string; execute?: (signed: string) => SolanaSwap; polls?: SolanaSwap[] } = {}) {
    const log: string[] = [];
    const polls = [...(opts.polls ?? [])];
    return {
        log,
        api: {
            createSolSwap: async () => { log.push('create'); return { swap: record(), quote: {}, tx: { serializedTx: opts.tx ?? unsignedTx(), expiresInSec: 60, expiresAt: 0 } } as unknown as CreatedSolanaSwap; },
            executeSolSwap: async (id: string, signed: string) => {
                log.push(`execute ${id}`);
                // What reaches the server is signed by the wallet, and by nobody else's key.
                const tx = VersionedTransaction.deserialize(fromBase64(signed));
                expect(tx.signatures[0].some(b => b !== 0)).toBe(true);
                if (opts.execute) return opts.execute(signed);
                return record({ status: 'COMPLETED', terminal: true, signature: 'sig', outAmount: '1499000' });
            },
            getSolSwap: async () => { log.push('poll'); return polls.shift() ?? record({ status: 'SUBMITTED' }); },
        },
    };
}
const input = { inputMint: SOL_MINT, outputMint: USDC_MINT, amount: '10000000', taker: keypair.publicKey.toBase58() };

describe('the swap flow', () => {
    it('creates, signs and executes, in that order, and reports each stage', async () => {
        const s = server();
        const stages: SwapStage[] = [];
        const done = await runSolanaSwap(input, { api: s.api, keypair, onStage: st => stages.push(st) });
        expect(done.status).toBe('COMPLETED');
        expect(s.log).toEqual(['create', 'execute swap-1']);
        expect(stages).toEqual(['create', 'sign', 'landing']);
    });

    it('never signs a transaction that is for another wallet', async () => {
        const s = server({ tx: unsignedTx(Keypair.generate().publicKey) });
        await expect(runSolanaSwap(input, { api: s.api, keypair })).rejects.toThrow(/not for the connected/);
        expect(s.log).toEqual(['create']);
    });

    it('an unknown result is polled until it settles; the swap is not created again', async () => {
        const s = server({
            execute: () => { throw new SwapServerError(502, 'RESULT_UNKNOWN', 'no answer from Jupiter'); },
            polls: [record({ status: 'SUBMITTED' }), record({ status: 'COMPLETED', terminal: true, outAmount: '1499000' })],
        });
        const done = await runSolanaSwap(input, { api: s.api, keypair, pollMs: 1 });
        expect(done.status).toBe('COMPLETED');
        expect(s.log).toEqual(['create', 'execute swap-1', 'poll', 'poll']);
    });

    it('gives up waiting after the time allowed and hands back the open record', async () => {
        const s = server({ execute: () => { throw new SwapServerError(409, 'IN_PROGRESS', 'busy'); } });
        const done = await runSolanaSwap(input, { api: s.api, keypair, pollMs: 1, pollTimeoutMs: 5 });
        expect(done.terminal).toBe(false);
        expect(s.log.filter(l => l === 'create')).toHaveLength(1);
    });

    it('a refusal from the server is the error, not something to poll', async () => {
        const s = server({ execute: () => { throw new SwapServerError(409, 'EXPIRED', 'the order has expired'); } });
        await expect(runSolanaSwap(input, { api: s.api, keypair, pollMs: 1 })).rejects.toMatchObject({ code: 'EXPIRED' });
        expect(s.log).not.toContain('poll');
    });
});

describe('the steps of a swap', () => {
    const states = (s: SolanaSwap | undefined, op?: Parameters<typeof swapSteps>[1]) => swapSteps(s, op).map(x => x.state);

    it('follows the page while it signs', () => {
        expect(states(undefined, { stage: 'create', busy: true })).toEqual(['active', 'pending', 'pending', 'pending']);
        expect(states(record(), { stage: 'sign', busy: true })).toEqual(['done', 'active', 'pending', 'pending']);
        expect(states(record(), { stage: 'landing', busy: true })).toEqual(['done', 'done', 'active', 'pending']);
    });

    it('follows the record after that', () => {
        expect(states(record({ status: 'SUBMITTED', signature: 'sig' }))).toEqual(['done', 'done', 'active', 'pending']);
        const done = swapSteps(record({ status: 'COMPLETED', terminal: true, signature: 'sig', display: { outAmount: '1.499', outSymbol: 'USDC' }, links: { tx: 'https://solscan.io/tx/sig' } }));
        expect(done.map(x => x.state)).toEqual(['done', 'done', 'done', 'done']);
        expect(done[3].note).toBe('1.499 USDC arrived');
        expect(done[2].link).toBe('https://solscan.io/tx/sig');
    });

    it('a failure is marked where it happened, with the reason', () => {
        const noRecord = swapSteps(undefined, { stage: 'failed', busy: false, error: 'Not enough SOL' });
        expect(noRecord[0]).toMatchObject({ state: 'failed', note: 'Not enough SOL' });
        const rejected = swapSteps(record(), { stage: 'failed', busy: false, error: 'this transaction is not for the connected Solana wallet' });
        expect(rejected.map(x => x.state)).toEqual(['done', 'failed', 'pending', 'pending']);
        const onChain = swapSteps(record({ status: 'FAILED', terminal: true, signature: 'sig', failReason: 'Slippage exceeded' }));
        expect(onChain.map(x => x.state)).toEqual(['done', 'done', 'failed', 'pending']);
        expect(onChain[2].note).toBe('Slippage exceeded');
        expect(swapSteps(record({ status: 'EXPIRED', terminal: true }))[1]).toMatchObject({ state: 'failed', note: 'Not signed in time. Nothing was sent.' });
    });

    it('a page error does not call a submitted swap failed: it may still land', () => {
        expect(states(record({ status: 'SUBMITTED', signature: 'sig' }), { stage: 'failed', busy: false, error: 'fetch failed' })).toEqual(['done', 'done', 'active', 'pending']);
        expect(swapHeadline(record({ status: 'SUBMITTED' }), { stage: 'failed', busy: false })).toBe('Landing on Solana');
    });

    it('an unsigned record from another session says it cannot be signed now', () => {
        const steps = swapSteps(record());
        expect(steps[1].state).toBe('attention');
        expect(steps[1].note).toMatch(/Start a new one/);
        expect(swapHeadline(record())).toBe('Not signed');
    });

    it('headlines', () => {
        expect(swapHeadline(undefined, { stage: 'create', busy: true })).toBe('Preparing');
        expect(swapHeadline(record(), { stage: 'sign', busy: true })).toBe('Signing');
        expect(swapHeadline(record({ status: 'COMPLETED' }))).toBe('Completed');
        expect(swapHeadline(record({ status: 'FAILED' }))).toBe('Failed');
        expect(swapHeadline(record({ status: 'EXPIRED' }))).toBe('Expired');
    });
});

describe('the swap dialog body', () => {
    it('renders both sides and marks an estimate until the swap has delivered', () => {
        const side = { sell: { symbol: 'SOL', display: '0.01' }, buy: { symbol: 'USDC', display: '1.5' } };
        const text = (el: ReturnType<typeof createElement>) => renderToString(el).replace(/<!--.*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
        const open = text(createElement(SwapProgressView, { swap: record(), op: { stage: 'sign', busy: true }, ...side }));
        expect(open).toContain('0.01 SOL');
        expect(open).toContain('≈ 1.5 USDC');
        expect(open).toContain('Sign in your wallet');
        const done = text(createElement(SwapProgressView, { swap: record({ status: 'COMPLETED', display: { outAmount: '1.499', outSymbol: 'USDC' } }), ...side, buy: { symbol: 'USDC', display: '1.499' } }));
        expect(done).not.toContain('≈');
        expect(done).toContain('1.499 USDC arrived');
    });
});
