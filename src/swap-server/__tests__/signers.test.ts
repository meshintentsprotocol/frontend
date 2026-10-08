import { describe, it, expect } from 'vitest';
import { createPublicKey, verify } from 'crypto';
import { ethers } from 'ethers';
import { Keypair, PublicKey, SystemProgram, Transaction, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { base58, evmFees, feeTx, fromBase64, sendEvmTx, signSolanaTx, toBase64 } from '../signers';
import type { CctpChain, EvmBuiltTx, SwapServerConfig } from '../types';
import fixtures from './fixtures.json';

const config = fixtures.config as unknown as SwapServerConfig;
const chain = (key: string) => config.cctp.chains.find(c => c.key === key) as CctpChain;
const GWEI = 1_000_000_000n;

/** Check an ed25519 signature with Node's own crypto, so the test does not trust the code under test. */
function signedBy(message: Uint8Array, signature: Uint8Array, key: PublicKey): boolean {
    const spki = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), key.toBuffer()]);
    return verify(null, message, createPublicKey({ key: spki, format: 'der', type: 'spki' }), signature);
}

describe('Solana: one signer for legacy and versioned transactions', () => {
    const owner = Keypair.generate();
    const eventKey = Keypair.generate();
    const blockhash = Keypair.generate().publicKey.toBase58();

    it('a legacy transaction already signed by a second key (the CCTP burn) gets the owner\'s signature and keeps the other', () => {
        const tx = new Transaction({ feePayer: owner.publicKey, recentBlockhash: blockhash });
        tx.add(SystemProgram.createAccount({ fromPubkey: owner.publicKey, newAccountPubkey: eventKey.publicKey, lamports: 1, space: 0, programId: SystemProgram.programId }));
        tx.partialSign(eventKey);
        const fromServer = toBase64(tx.serialize({ requireAllSignatures: false }));

        const signed = signSolanaTx(fromServer, owner);
        const back = Transaction.from(signed.raw);
        expect(back.verifySignatures()).toBe(true);                       // both signatures are valid
        expect(signed.signature).toBe(base58(back.signature!));           // the id is the fee payer's signature
        expect(signed.blockhash).toBe(blockhash);
        expect(back.signatures.map(s => s.publicKey.toBase58())).toEqual([owner.publicKey.toBase58(), eventKey.publicKey.toBase58()]);
    });

    it('a v0 transaction (a Jupiter swap) is signed in place', () => {
        const message = new TransactionMessage({
            payerKey: owner.publicKey, recentBlockhash: blockhash,
            instructions: [SystemProgram.transfer({ fromPubkey: owner.publicKey, toPubkey: eventKey.publicKey, lamports: 5 })],
        }).compileToV0Message();
        const unsigned = toBase64(new VersionedTransaction(message).serialize());

        const signed = signSolanaTx(unsigned, owner);
        const back = VersionedTransaction.deserialize(signed.raw);
        expect(back.version).toBe(0);
        expect(signedBy(back.message.serialize(), back.signatures[0], owner.publicKey)).toBe(true);
        expect(signed.signature).toBe(base58(back.signatures[0]));
    });

    it('the burn the server really builds: legacy, one signature in, the owner\'s slot empty', () => {
        const recorded = fixtures.createdFromSolana.txs[0] as { serializedTx: string };
        const tx = VersionedTransaction.deserialize(fromBase64(recorded.serializedTx));
        expect(tx.version).toBe('legacy');
        expect(tx.message.header.numRequiredSignatures).toBe(2);
        expect(tx.message.staticAccountKeys[0].toBase58()).toBe(fixtures.createdFromSolana.transfer.sender);
        expect(tx.signatures[0].every(b => b === 0)).toBe(true);          // ours to add
        expect(tx.signatures[1].some(b => b !== 0)).toBe(true);           // the event account's, already there
        expect(signedBy(tx.message.serialize(), tx.signatures[1], tx.message.staticAccountKeys[1])).toBe(true);
    });

    it('refuses a transaction that is not for the connected wallet', () => {
        const recorded = fixtures.createdFromSolana.txs[0] as { serializedTx: string };
        expect(() => signSolanaTx(recorded.serializedTx, Keypair.generate())).toThrow('not for the connected Solana wallet');
    });

    it('base58 and base64 helpers match the library ones', () => {
        for (let i = 0; i < 20; i++) {
            const k = Keypair.generate().publicKey;
            expect(base58(k.toBytes())).toBe(k.toBase58());
        }
        expect(base58(new Uint8Array([0, 0, 1]))).toBe('112');
        const bytes = Uint8Array.from({ length: 70_000 }, (_, i) => (i * 31) % 256);
        expect(Buffer.from(toBase64(bytes), 'base64').equals(Buffer.from(bytes))).toBe(true);
        expect(Buffer.from(fromBase64(Buffer.from(bytes).toString('base64'))).equals(Buffer.from(bytes))).toBe(true);
    });
});

describe('EVM fees', () => {
    const provider = (fd: Partial<Record<'maxFeePerGas' | 'maxPriorityFeePerGas' | 'gasPrice', bigint | null>>) => ({ getFeeData: async () => fd }) as unknown as ethers.Provider;

    it('raises the fee to the chain floor: Arc drops anything under 20 gwei', async () => {
        expect(await evmFees(provider({ maxFeePerGas: 2n * GWEI, maxPriorityFeePerGas: 1n * GWEI }), 20)).toEqual({ maxFeePerGas: 20n * GWEI, maxPriorityFeePerGas: 1n * GWEI });
    });
    it('leaves a fee above the floor alone', async () => {
        expect(await evmFees(provider({ maxFeePerGas: 45n * GWEI, maxPriorityFeePerGas: 2n * GWEI }), 20)).toEqual({ maxFeePerGas: 45n * GWEI, maxPriorityFeePerGas: 2n * GWEI });
    });
    it('never sends a tip above the maximum', async () => {
        const f = await evmFees(provider({ maxFeePerGas: 1n * GWEI, maxPriorityFeePerGas: 3n * GWEI }));
        expect(f.maxPriorityFeePerGas <= f.maxFeePerGas).toBe(true);
    });
    it('falls back to twice the gas price on a chain without EIP-1559 data', async () => {
        expect(await evmFees(provider({ maxFeePerGas: null, maxPriorityFeePerGas: null, gasPrice: 5n * GWEI }))).toEqual({ maxFeePerGas: 10n * GWEI, maxPriorityFeePerGas: 1n * GWEI });
    });
});

describe('EVM send: the hash is known before anything is broadcast', () => {
    const tx = fixtures.created.txs.find(t => t.kind === 'burn') as EvmBuiltTx;

    function fakeNetwork(over: Partial<Record<'estimateGas' | 'broadcast' | 'wait', () => unknown>> = {}) {
        const log: string[] = [];
        let broadcast: string | undefined;
        const provider = {
            estimateGas: async () => { log.push('estimateGas'); over.estimateGas?.(); return 100_000n; },
            getTransactionCount: async (_a: string, tag: string) => { log.push(`nonce:${tag}`); return 7; },
            getFeeData: async () => ({ maxFeePerGas: 3n * GWEI, maxPriorityFeePerGas: 1n * GWEI, gasPrice: null }),
            broadcastTransaction: async (signed: string) => { log.push('broadcast'); over.broadcast?.(); broadcast = signed; return {}; },
            waitForTransaction: async () => { log.push('wait'); return over.wait ? over.wait() : { status: 1 }; },
        };
        const wallet = ethers.Wallet.createRandom().connect(provider as unknown as ethers.Provider);
        return { wallet, log, signed: () => ethers.Transaction.from(broadcast!) };
    }

    it('signs with the pending nonce, 30 % gas headroom and the chain\'s fee floor', async () => {
        const net = fakeNetwork();
        const order: string[] = [];
        const sent = await sendEvmTx(net.wallet, { ...tx, minMaxFeePerGasGwei: 20 }, { onHash: h => { order.push(`hash:${h}`, ...net.log.splice(0)); } });
        expect(order.slice(1)).toEqual(expect.arrayContaining(['estimateGas', 'nonce:pending']));
        expect(order).not.toContain('broadcast');                         // onHash ran first
        expect(net.log).toEqual(['broadcast']);
        const t = net.signed();
        expect(t.hash).toBe(sent.hash);
        expect(t).toMatchObject({ to: tx.to, data: tx.data, nonce: 7, type: 2, gasLimit: 130_000n, maxFeePerGas: 20n * GWEI, value: 0n });
        expect(Number(t.chainId)).toBe(tx.chainId);
        expect(t.from).toBe(await net.wallet.getAddress());
        await sent.wait();
    });

    it('a transaction that would revert is refused before it is signed', async () => {
        const net = fakeNetwork({ estimateGas: () => { throw new Error('execution reverted: ERC20: transfer amount exceeds balance'); } });
        let hashed = false;
        await expect(sendEvmTx(net.wallet, tx, { onHash: () => { hashed = true; } })).rejects.toThrow('execution reverted');
        expect(hashed).toBe(false);
        expect(net.log).not.toContain('broadcast');
    });

    it('wait() rejects when the transaction reverted or never confirmed', async () => {
        await expect((await sendEvmTx(fakeNetwork({ wait: () => ({ status: 0 }) }).wallet, tx)).wait()).rejects.toThrow('reverted');
        await expect((await sendEvmTx(fakeNetwork({ wait: () => null }).wallet, tx)).wait()).rejects.toThrow('not confirmed in time');
    });
});

describe('the service-fee transaction rebuilt from a record', () => {
    it('is a USDC transfer of exactly the fee to the treasury, and equals the one the server built', () => {
        const recorded = fixtures.created.txs.find(t => t.kind === 'fee') as EvmBuiltTx;
        const t = fixtures.created.transfer;
        const rebuilt = feeTx(chain(t.src), t.feeRecipient, t.protocolFee);
        expect(rebuilt).toMatchObject({ kind: 'fee', to: recorded.to, data: recorded.data, chainId: recorded.chainId });
        const erc20 = new ethers.Interface(['function transfer(address to, uint256 amount)']);
        const [to, amount] = erc20.decodeFunctionData('transfer', rebuilt.data);
        expect(to).toBe(t.feeRecipient);
        expect(amount).toBe(BigInt(t.protocolFee));
    });
    it('carries the fee floor on Arc', () => {
        expect(feeTx(chain('arc-testnet'), '0x6ccb65F44d1f33553e7DBC28b3C4870c8E0C5563', '10000').minMaxFeePerGasGwei).toBe(20);
        expect(feeTx(chain('base-sepolia'), '0x6ccb65F44d1f33553e7DBC28b3C4870c8E0C5563', '10000').minMaxFeePerGasGwei).toBeUndefined();
    });
});
