import { describe, it, expect } from 'vitest';
import { ethers } from 'ethers';
import { Keypair, SystemProgram, Transaction } from '@solana/web3.js';
import { SwapServerError } from '../api';
import { BurnNotReported, FeeNotSent, feeIsDue, flushJournal, payFee, resumeBridge, startBridge, type BridgeDeps, type BridgeProgress } from '../flows';
import { createJournal } from '../journal';
import { toBase64 } from '../signers';
import type { BuiltTx, CctpChain, EvmBuiltTx, SwapServerConfig, Transfer } from '../types';
import { createLocalSolanaSigner } from '@/lib/wallets/solanaSigner';
import fixtures from './fixtures.json';

/**
 * The bridge flow against a fake server and a fake chain that write into one log, so the order of what reaches
 * the chain and what reaches the server can be checked. The transactions are the ones the server really built.
 */
const config = fixtures.config as unknown as SwapServerConfig;
const chain = (key: string) => config.cctp.chains.find(c => c.key === key) as CctpChain;
const BASE = chain('base-sepolia'), ARC = chain('arc-testnet'), SOLANA = chain('solana-devnet');
const created = fixtures.created as unknown as { transfer: Transfer; txs: EvmBuiltTx[] };
const GWEI = 1_000_000_000n;

function world(opts: { txs?: BuiltTx[]; transfer?: Partial<Transfer> } = {}) {
    const log: string[] = [];
    const store = new Map<string, string>();
    let clock = 1_000_000;
    const journal = createJournal({ getItem: k => store.get(k) ?? null, setItem: (k, v) => { store.set(k, v); } }, () => clock);
    let transfer: Transfer = { ...created.transfer, ...opts.transfer };
    const txs = opts.txs ?? created.txs;
    const fail: Record<string, unknown[]> = {};
    const maybeFail = (what: string) => { const e = fail[what]?.shift(); if (e) throw e; };

    const api = {
        createTransfer: async (b: unknown) => { log.push(`api:create ${JSON.stringify(b)}`); maybeFail('create'); return { transfer, quote: fixtures.created.quote as never, txs }; },
        rebuildTransfer: async (id: string) => { log.push(`api:rebuild ${id}`); return { transfer, txs }; },
        submitBurn: async (id: string, hash: string, fee?: string) => {
            log.push(`api:burn ${hash}${fee ? ` fee ${fee}` : ''}`); maybeFail('burn');
            transfer = { ...transfer, status: 'BURN_SUBMITTED', burnTxHash: hash, ...(fee ? { feeTxHash: fee } : {}) };
            return transfer;
        },
        submitFee: async (id: string, hash: string) => { log.push(`api:fee ${hash}`); maybeFail('fee'); transfer = { ...transfer, feeTxHash: hash }; return transfer; },
        getTransfer: async (id: string) => { log.push(`api:get ${id}`); maybeFail('get'); return transfer; },
        trackBurn: async (src: string, hash: string) => { log.push(`api:track ${src} ${hash}`); return transfer; },
    };

    const hashes: Record<string, string> = {};
    let nonce = 3;
    const provider = {
        estimateGas: async (t: { data: string }) => { maybeFail(`estimate:${kindOf(t.data)}`); return 60_000n; },
        getTransactionCount: async () => nonce,
        getFeeData: async () => ({ maxFeePerGas: 2n * GWEI, maxPriorityFeePerGas: 1n * GWEI, gasPrice: null }),
        broadcastTransaction: async (signed: string) => {
            const t = ethers.Transaction.from(signed);
            const kind = kindOf(t.data);
            hashes[kind] = t.hash!;
            // the journal must already hold the hash of a burn or a fee at this moment
            log.push(`chain:broadcast ${kind} journal=${JSON.stringify(strip(journal.get(transfer.id)))}`);
            maybeFail(`broadcast:${kind}`);
            nonce++;
            return {};
        },
        waitForTransaction: async (hash: string) => { log.push(`chain:mined ${Object.entries(hashes).find(([, h]) => h === hash)?.[0]}`); return { status: 1 }; },
    };
    const kindOf = (data: string) => txs.find(t => t.chain === 'evm' && t.data === data)?.kind ?? (data.startsWith('0xa9059cbb') ? 'fee' : 'unknown');
    const strip = (e?: { burn?: string; fee?: string }) => (e ? { burn: e.burn ? 'burn' : undefined, fee: e.fee ? 'fee' : undefined } : null);
    const wallet = ethers.Wallet.createRandom().connect(provider as unknown as ethers.Provider);

    const progress: string[] = [];
    const deps: BridgeDeps = {
        api, journal, retryDelayMs: 0, now: () => clock,
        evmSigner: () => wallet,
        onProgress: (p: BridgeProgress) => progress.push(`${p.step}:${p.state}`),
    };
    return {
        deps, api, journal, log, progress, hashes, fail,
        get transfer() { return transfer; }, set transfer(t: Transfer) { transfer = t; },
        advance: (ms: number) => { clock += ms; },
        steps: () => log.map(l => l.replace(/0x[0-9a-f]{64}/g, 'HASH').replace(/api:create .*/, 'api:create')),
    };
}

const input = { src: BASE, dst: ARC, amount: '1', sender: created.transfer.sender, recipient: created.transfer.recipient };
const network = () => new SwapServerError(0, 'UNREACHABLE', 'no answer');

describe('EVM source: approve, burn, service fee', () => {
    it('signs in order, reports the burn the moment it is out, and journals each hash before its broadcast', async () => {
        const w = world();
        const { transfer } = await startBridge(input, w.deps);
        expect(w.steps()).toEqual([
            'api:create',
            'chain:broadcast approve journal=null',                               // an approval moves no money: not journaled
            'chain:mined approve',
            'chain:broadcast burn journal={"burn":"burn"}',                       // written down first
            'api:burn HASH',                                                      // reported before it is even mined
            'chain:mined burn',
            'chain:broadcast fee journal={"burn":"burn","fee":"fee"}',
            'api:fee HASH',
            'chain:mined fee',
        ]);
        expect(w.log.find(l => l.startsWith('api:create'))).toContain('"src":"base-sepolia","dst":"arc-testnet","amount":"1"');
        expect(transfer).toMatchObject({ status: 'BURN_SUBMITTED', burnTxHash: w.hashes.burn, feeTxHash: w.hashes.fee });
        expect(w.journal.all()).toEqual({});                                      // the server has everything
        expect(w.progress).toEqual(['create:active', 'create:done', 'approve:active', 'approve:done', 'burn:active', 'burn:done', 'fee:active', 'fee:done']);
    });

    it('with no approval needed and no fee, the burn is the only signature', async () => {
        const w = world({ txs: created.txs.filter(t => t.kind === 'burn') });
        await startBridge(input, w.deps);
        expect(w.steps()).toEqual(['api:create', 'chain:broadcast burn journal={"burn":"burn"}', 'api:burn HASH', 'chain:mined burn']);
        expect(w.journal.all()).toEqual({});
    });

    it('a refused approval stops before any money moves, and leaves nothing behind', async () => {
        const w = world();
        w.fail['estimate:approve'] = [new Error('insufficient funds for gas')];
        await expect(startBridge(input, w.deps)).rejects.toThrow('insufficient funds for gas');
        expect(w.log.some(l => l.includes('burn'))).toBe(false);
        expect(w.journal.all()).toEqual({});
    });

    it('a server that cannot be told about the burn: retried, then BurnNotReported with the hash kept', async () => {
        const w = world({ txs: created.txs.filter(t => t.kind !== 'approve') });
        w.fail.burn = [network(), network(), network(), network()];
        const e = await startBridge(input, w.deps).catch(x => x);
        expect(e).toBeInstanceOf(BurnNotReported);
        expect(e.txHash).toBe(w.hashes.burn);
        expect(w.log.filter(l => l.startsWith('api:burn'))).toHaveLength(4);
        expect(w.log.some(l => l.includes('broadcast fee'))).toBe(false);          // the flow stops; the fee waits
        expect(w.journal.get(created.transfer.id)?.burn).toBe(w.hashes.burn);

        // next load: the journal reports it, and nothing is signed again
        const before = w.log.length;
        expect(await flushJournal(w.deps)).toBe(1);
        expect(w.log.slice(before).map(l => l.replace(/0x[0-9a-f]{64}/g, 'HASH'))).toEqual([`api:get ${created.transfer.id}`, 'api:burn HASH']);
        expect(w.transfer.burnTxHash).toBe(w.hashes.burn);
        expect(w.journal.all()).toEqual({});
    });

    it('one blip while reporting the burn is ridden out', async () => {
        const w = world({ txs: created.txs.filter(t => t.kind === 'burn') });
        w.fail.burn = [network()];
        const { transfer } = await startBridge(input, w.deps);
        expect(transfer.status).toBe('BURN_SUBMITTED');
        expect(w.log.filter(l => l.startsWith('api:burn'))).toHaveLength(2);
    });

    it('a refusal from the server is not retried', async () => {
        const w = world({ txs: created.txs.filter(t => t.kind === 'burn') });
        w.fail.burn = [new SwapServerError(409, 'BURN_ALREADY_REGISTERED', 'burn already registered')];
        await expect(startBridge(input, w.deps)).rejects.toBeInstanceOf(BurnNotReported);
        expect(w.log.filter(l => l.startsWith('api:burn'))).toHaveLength(1);
    });

    it('the fee cannot be sent after the burn: FeeNotSent, and the fee can be paid later from the record', async () => {
        const w = world({ txs: created.txs.filter(t => t.kind !== 'approve') });
        w.fail['estimate:fee'] = [new Error('insufficient funds for gas')];
        const e = await startBridge(input, w.deps).catch(x => x);
        expect(e).toBeInstanceOf(FeeNotSent);
        expect(w.transfer.burnTxHash).toBe(w.hashes.burn);

        w.transfer = { ...w.transfer, status: 'ATTESTED', feeStatus: 'awaiting' };
        expect(feeIsDue(w.transfer, BASE)).toBe(true);
        const before = w.log.length;
        const after = await payFee(created.transfer.id, BASE, w.deps);
        expect(w.log.slice(before).map(l => l.replace(/0x[0-9a-f]{64}/g, 'HASH'))).toEqual([
            `api:get ${created.transfer.id}`, 'chain:broadcast fee journal={"burn":"burn","fee":"fee"}', 'api:fee HASH', 'chain:mined fee',
        ]);
        expect(after.feeTxHash).toBe(w.hashes.fee);
        expect(w.journal.all()).toEqual({});
    });

    it('payFee does nothing when no fee is due', async () => {
        const w = world({ transfer: { status: 'ATTESTED', burnTxHash: '0x' + '11'.repeat(32), feeStatus: 'paid' } });
        await payFee(created.transfer.id, BASE, w.deps);
        expect(w.log).toEqual([`api:get ${created.transfer.id}`]);
    });
});

describe('when the user can send the service fee', () => {
    const t = (over: Partial<Transfer>): Transfer => ({ ...created.transfer, status: 'ATTESTED', burnTxHash: '0x' + '11'.repeat(32), ...over });
    it('held for the fee, or burned with no fee transaction ever reported', () => {
        expect(feeIsDue(t({ feeStatus: 'awaiting' }), BASE)).toBe(true);
        expect(feeIsDue(t({ feeStatus: 'awaiting', feeTxHash: '0x' + '22'.repeat(32) }), BASE)).toBe(true);   // the reported one did not pay
        expect(feeIsDue(t({ status: 'BURN_CONFIRMED', feeStatus: 'pending' }), BASE)).toBe(true);
    });
    it('not while a reported fee is still being checked, not when paid, not when there is none', () => {
        expect(feeIsDue(t({ feeStatus: 'pending', feeTxHash: '0x' + '22'.repeat(32) }), BASE)).toBe(false);
        expect(feeIsDue(t({ feeStatus: 'paid' }), BASE)).toBe(false);
        expect(feeIsDue(t({ feeStatus: 'none', protocolFee: '0' }), BASE)).toBe(false);
    });
    it('not before the burn, not after the end, and never on a Solana source', () => {
        expect(feeIsDue(t({ status: 'CREATED', burnTxHash: undefined, feeStatus: 'pending' }), BASE)).toBe(false);
        expect(feeIsDue(t({ status: 'COMPLETED', feeStatus: 'awaiting' }), BASE)).toBe(false);
        expect(feeIsDue(t({ status: 'FAILED', feeStatus: 'awaiting' }), BASE)).toBe(false);
        expect(feeIsDue(t({ feeStatus: 'awaiting' }), SOLANA)).toBe(false);
    });
});

describe('resuming a transfer that still waits for its burn', () => {
    const noted = '0x' + 'ab'.repeat(32);

    it('nothing in the journal: the transactions are fetched again and signed', async () => {
        const w = world({ txs: created.txs.filter(t => t.kind === 'burn') });
        const t = await resumeBridge(created.transfer.id, BASE, w.deps);
        expect(w.steps()).toEqual([`api:get ${created.transfer.id}`, `api:rebuild ${created.transfer.id}`, 'chain:broadcast burn journal={"burn":"burn"}', 'api:burn HASH', 'chain:mined burn']);
        expect(t.status).toBe('BURN_SUBMITTED');
    });

    it('this device already sent the burn: the hash is reported and nothing is signed', async () => {
        const w = world();
        w.journal.set(created.transfer.id, { burn: noted });
        const t = await resumeBridge(created.transfer.id, BASE, { ...w.deps, chainKnows: async () => true });
        expect(w.log).toEqual([`api:get ${created.transfer.id}`, `api:burn ${noted}`]);
        expect(t.burnTxHash).toBe(noted);
        expect(w.journal.all()).toEqual({});
    });

    it('without a way to ask the chain, a journaled burn is taken as sent: never a second burn', async () => {
        const w = world();
        w.journal.set(created.transfer.id, { burn: noted });
        await resumeBridge(created.transfer.id, BASE, w.deps);
        expect(w.log.some(l => l.startsWith('chain:broadcast'))).toBe(false);
    });

    it('EVM: a journaled burn the chain never saw is dropped and a new one signed (its nonce is still free)', async () => {
        const w = world({ txs: created.txs.filter(t => t.kind === 'burn') });
        w.journal.set(created.transfer.id, { burn: noted });
        await resumeBridge(created.transfer.id, BASE, { ...w.deps, chainKnows: async () => false });
        expect(w.log.filter(l => l.startsWith('api:burn'))).toEqual([`api:burn ${w.hashes.burn}`]);
        expect(w.hashes.burn).not.toBe(noted);
    });

    it('EVM AppKit: burn was requested and the nonce advanced: refuses to sign again without user confirmation', async () => {
        const w = world();
        const signer = await w.deps.evmSigner!(BASE);
        const address = await signer.getAddress();
        w.journal.set(created.transfer.id, {
            burnRequested: { nonce: 0, from: address, at: Date.now() },
        });
        const providerWithAdvancedNonce = {
            getTransactionCount: async () => 1,
        };
        const walletWithAdvancedNonce = {
            getAddress: async () => address,
            provider: providerWithAdvancedNonce,
        };
        const deps: BridgeDeps = {
            ...w.deps,
            evmSigner: () => walletWithAdvancedNonce as any,
        };

        await expect(resumeBridge(created.transfer.id, BASE, deps)).rejects.toThrow('may already have sent');
        expect(w.log.some(l => l.startsWith('chain:broadcast'))).toBe(false);
    });

    it('EVM AppKit: burn was requested and nonce did not advance: safe to rebuild and request again', async () => {
        const w = world({ txs: created.txs.filter(t => t.kind === 'burn') });
        const signer = await w.deps.evmSigner!(BASE);
        const address = await signer.getAddress();
        w.journal.set(created.transfer.id, {
            burnRequested: { nonce: 0, from: address, at: Date.now() },
        });
        const providerWithSameNonce = {
            getTransactionCount: async () => 0,
            estimateGas: async () => 100_000n,
            getFeeData: async () => ({ maxFeePerGas: 1_000_000_000n, maxPriorityFeePerGas: 1_000_000_000n }),
            broadcastTransaction: async () => ({}),
            waitForTransaction: async () => ({ status: 1 }),
        };
        const wallet = ethers.Wallet.createRandom().connect(providerWithSameNonce as unknown as ethers.Provider);
        const deps: BridgeDeps = {
            ...w.deps,
            evmSigner: () => wallet,
        };

        const t = await resumeBridge(created.transfer.id, BASE, deps);
        expect(t.status).toBe('BURN_SUBMITTED');
    });

    it('Solana: an unseen burn can still land for a while, so resume waits; later it signs a new one', async () => {
        const owner = Keypair.generate(), eventKey = Keypair.generate();
        const build = () => {
            const tx = new Transaction({ feePayer: owner.publicKey, recentBlockhash: Keypair.generate().publicKey.toBase58() });
            tx.add(SystemProgram.createAccount({ fromPubkey: owner.publicKey, newAccountPubkey: eventKey.publicKey, lamports: 1, space: 0, programId: SystemProgram.programId }));
            tx.partialSign(eventKey);
            return { kind: 'burn', chain: 'solana', serializedTx: toBase64(tx.serialize({ requireAllSignatures: false })), eventAccount: eventKey.publicKey.toBase58(), lastValidBlockHeight: 1 } as BuiltTx;
        };
        const w = world({ txs: [build()], transfer: { src: 'solana-devnet' } });
        w.journal.set(created.transfer.id, { burn: 'oldSignature' });
        const sent: Uint8Array[] = [];
        const deps: BridgeDeps = { ...w.deps, chainKnows: async () => false, solana: { keypair: owner, send: async raw => { sent.push(raw); return 'newSignature'; } } };

        await expect(resumeBridge(created.transfer.id, SOLANA, deps)).rejects.toThrow('may still confirm');
        expect(sent).toHaveLength(0);

        w.advance(3 * 60_000 + 1);
        const t = await resumeBridge(created.transfer.id, SOLANA, deps);
        expect(sent).toHaveLength(1);
        expect(Transaction.from(sent[0]).verifySignatures()).toBe(true);
        expect(t.burnTxHash).toBe('newSignature');
        expect(w.journal.all()).toEqual({});
    });

    it('a transfer that is already past its burn is returned as it is', async () => {
        const w = world({ transfer: { status: 'ATTESTED', burnTxHash: noted } });
        const t = await resumeBridge(created.transfer.id, BASE, w.deps);
        expect(t.status).toBe('ATTESTED');
        expect(w.log).toEqual([`api:get ${created.transfer.id}`]);
    });
});

describe('Solana source', () => {
    const owner = Keypair.generate(), eventKey = Keypair.generate();
    const build = (): BuiltTx => {
        const tx = new Transaction({ feePayer: owner.publicKey, recentBlockhash: Keypair.generate().publicKey.toBase58() });
        tx.add(SystemProgram.createAccount({ fromPubkey: owner.publicKey, newAccountPubkey: eventKey.publicKey, lamports: 1, space: 0, programId: SystemProgram.programId }));
        tx.partialSign(eventKey);
        return { kind: 'burn', chain: 'solana', serializedTx: toBase64(tx.serialize({ requireAllSignatures: false })), eventAccount: eventKey.publicKey.toBase58(), lastValidBlockHeight: 1 };
    };
    const solInput = { ...input, src: SOLANA, sender: owner.publicKey.toBase58() };

    it('one transaction: signed, sent, reported; the fee is inside it', async () => {
        const w = world({ txs: [build()] });
        const sent: Uint8Array[] = [];
        const { transfer } = await startBridge(solInput, { ...w.deps, solana: { keypair: owner, send: async raw => { sent.push(raw); w.log.push(`chain:send journal=${JSON.stringify(!!w.journal.get(created.transfer.id)?.burn)}`); return 'sig1'; } } });
        expect(Transaction.from(sent[0]).verifySignatures()).toBe(true);
        expect(w.steps()).toEqual(['api:create', 'chain:send journal=true', 'api:burn sig1']);
        expect(transfer.burnTxHash).toBe('sig1');
        expect(w.journal.all()).toEqual({});
        expect(w.progress).toEqual(['create:active', 'create:done', 'burn:active', 'burn:done']);
    });

    it('a blockhash that expired before sending: one fresh transaction is fetched and sent', async () => {
        const w = world({ txs: [build()] });
        let tries = 0;
        await startBridge(solInput, { ...w.deps, solana: { keypair: owner, send: async () => { if (tries++ === 0) throw new Error('Blockhash not found'); return 'sig2'; } } });
        expect(w.steps()).toEqual(['api:create', `api:rebuild ${created.transfer.id}`, 'api:burn sig2']);
        expect(tries).toBe(2);
    });

    it('a refusal by the node means nothing went out: the journal is cleared and the record can be retried', async () => {
        const w = world({ txs: [build()] });
        await expect(startBridge(solInput, { ...w.deps, solana: { keypair: owner, send: async () => { throw new Error('Transaction simulation failed: insufficient lamports'); } } })).rejects.toThrow('simulation failed');
        expect(w.journal.all()).toEqual({});
    });

    it('an error that may hide a sent transaction keeps the journal entry', async () => {
        const w = world({ txs: [build()] });
        await expect(startBridge(solInput, { ...w.deps, solana: { keypair: owner, send: async () => { throw new Error('fetch failed'); } } })).rejects.toThrow('fetch failed');
        expect(w.journal.get(created.transfer.id)?.burn).toBeTruthy();
    });

    it('without a Solana wallet the flow says so', async () => {
        const w = world({ txs: [build()] });
        await expect(startBridge(solInput, w.deps)).rejects.toThrow('No Solana wallet');
    });

    it('SolanaTxSigner: a pre-signed burn keeps its second signature', async () => {
        const w = world({ txs: [build()] });
        const sent: Uint8Array[] = [];
        const signer = createLocalSolanaSigner(owner);
        const { transfer } = await startBridge(solInput, {
            ...w.deps,
            solana: {
                signer,
                send: async raw => {
                    sent.push(raw);
                    w.log.push(`chain:send journal=${JSON.stringify(!!w.journal.get(created.transfer.id)?.burn)}`);
                    return 'sig-signer';
                },
            },
        });
        const parsed = Transaction.from(sent[0]);
        expect(parsed.verifySignatures()).toBe(true);
        expect(parsed.signatures).toHaveLength(2);
        expect(parsed.signatures[1].publicKey.toBase58()).toBe(eventKey.publicKey.toBase58());
        expect(transfer.burnTxHash).toBe('sig-signer');
    });
});

describe('the journal reported on load', () => {
    const burn = '0x' + 'cd'.repeat(32), fee = '0x' + 'ef'.repeat(32);
    const chainOf = (key: string) => chain(key);

    it('a burn the chain has not seen is left for the user to resume', async () => {
        const w = world();
        w.journal.set(created.transfer.id, { burn });
        expect(await flushJournal({ ...w.deps, chainKnows: async () => false }, chainOf)).toBe(0);
        expect(w.log).toEqual([`api:get ${created.transfer.id}`]);
        expect(w.journal.get(created.transfer.id)?.burn).toBe(burn);
    });

    it('a burn whose record expired in the meantime is handed to the server to adopt', async () => {
        const w = world({ transfer: { status: 'EXPIRED' } });
        w.journal.set(created.transfer.id, { burn });
        expect(await flushJournal({ ...w.deps, chainKnows: async () => true }, chainOf)).toBe(1);
        expect(w.log).toEqual([`api:get ${created.transfer.id}`, `api:track base-sepolia ${burn}`]);
        expect(w.journal.all()).toEqual({});
    });

    it('a fee that was sent but never reported is reported', async () => {
        const w = world({ transfer: { status: 'ATTESTED', burnTxHash: burn, feeStatus: 'awaiting' } });
        w.journal.set(created.transfer.id, { burn, fee });
        expect(await flushJournal({ ...w.deps, chainKnows: async () => true }, chainOf)).toBe(1);
        expect(w.log).toEqual([`api:get ${created.transfer.id}`, `api:fee ${fee}`]);
        expect(w.journal.all()).toEqual({});
    });

    it('an entry the server already has in full is just dropped', async () => {
        const w = world({ transfer: { status: 'MINT_SUBMITTED', burnTxHash: burn, feeTxHash: fee, feeStatus: 'pending' } });
        w.journal.set(created.transfer.id, { burn, fee });
        expect(await flushJournal(w.deps)).toBe(0);
        expect(w.journal.all()).toEqual({});
    });

    it('an unknown transfer drops the entry; a server that does not answer keeps it', async () => {
        const w = world();
        w.journal.set(created.transfer.id, { burn });
        w.fail.get = [network()];
        await flushJournal(w.deps);
        expect(w.journal.get(created.transfer.id)).toBeTruthy();
        w.fail.get = [new SwapServerError(404, 'NOT_FOUND', 'transfer not found')];
        await flushJournal(w.deps);
        expect(w.journal.all()).toEqual({});
    });

    it('entries older than a day are forgotten', () => {
        const w = world();
        w.journal.set('old', { burn });
        w.advance(24 * 60 * 60_000 + 1);
        expect(w.journal.all()).toEqual({});
    });
});
