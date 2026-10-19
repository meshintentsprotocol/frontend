import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Keypair, PublicKey, SystemProgram, Transaction, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { createLocalSolanaSigner, createAppKitSolanaSigner, verifySolanaSignatureSafety } from '../solanaSigner';
import { toBase64, fromBase64, base58 } from '@/swap-server/signers';
import { _resetPendingSignForTest } from '../signRequest';

// Mock appkitBridge
vi.mock('../appkitBridge', () => ({
    getAppKitSolanaProvider: vi.fn(),
    switchAppKitSolanaNetwork: vi.fn().mockResolvedValue(true),
}));

import { getAppKitSolanaProvider } from '../appkitBridge';

describe('solanaSigner: Local and AppKit SolanaTxSigner', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        _resetPendingSignForTest();
    });

    const owner = Keypair.generate();
    const coSigner = Keypair.generate();
    const blockhash = Keypair.generate().publicKey.toBase58();

    function createCoSignedLegacyTx(): string {
        const tx = new Transaction({ feePayer: owner.publicKey, recentBlockhash: blockhash });
        tx.add(
            SystemProgram.createAccount({
                fromPubkey: owner.publicKey,
                newAccountPubkey: coSigner.publicKey,
                lamports: 100,
                space: 0,
                programId: SystemProgram.programId,
            })
        );
        tx.partialSign(coSigner);
        return toBase64(tx.serialize({ requireAllSignatures: false }));
    }

    function createV0Tx(): string {
        const message = new TransactionMessage({
            payerKey: owner.publicKey,
            recentBlockhash: blockhash,
            instructions: [
                SystemProgram.transfer({
                    fromPubkey: owner.publicKey,
                    toPubkey: coSigner.publicKey,
                    lamports: 500,
                }),
            ],
        }).compileToV0Message();
        return toBase64(new VersionedTransaction(message).serialize());
    }

    it('LocalSolanaSigner signs transaction and preserves co-signature', async () => {
        const signer = createLocalSolanaSigner(owner);
        expect(signer.kind).toBe('local');
        expect(signer.address).toBe(owner.publicKey.toBase58());

        const b64 = createCoSignedLegacyTx();
        const signed = await signer.sign(b64);

        const parsed = Transaction.from(signed.raw);
        expect(parsed.verifySignatures()).toBe(true);
        expect(signed.signature).toBe(base58(parsed.signature!));
        expect(signed.blockhash).toBe(blockhash);
    });

    it('LocalSolanaSigner rejects transaction intended for another wallet', async () => {
        const stranger = Keypair.generate();
        const signer = createLocalSolanaSigner(stranger);
        const b64 = createCoSignedLegacyTx();

        await expect(signer.sign(b64)).rejects.toThrow('this transaction is not for the connected Solana wallet');
    });

    it('verifySolanaSignatureSafety validates matching message and preserved co-signatures', () => {
        const b64 = createCoSignedLegacyTx();
        const before = VersionedTransaction.deserialize(fromBase64(b64));
        const after = VersionedTransaction.deserialize(fromBase64(b64));

        // Sign as owner
        after.sign([owner]);

        expect(() => verifySolanaSignatureSafety(before, after, 0)).not.toThrow();
    });

    it('verifySolanaSignatureSafety throws on altered message bytes', () => {
        const b64 = createCoSignedLegacyTx();
        const before = VersionedTransaction.deserialize(fromBase64(b64));

        // Create an altered tx with a different instruction
        const alteredTx = new Transaction({ feePayer: owner.publicKey, recentBlockhash: blockhash });
        alteredTx.add(
            SystemProgram.transfer({
                fromPubkey: owner.publicKey,
                toPubkey: coSigner.publicKey,
                lamports: 999999,
            })
        );
        alteredTx.sign(owner, coSigner);
        const after = VersionedTransaction.deserialize(alteredTx.serialize());

        expect(() => verifySolanaSignatureSafety(before, after, 0)).toThrow(/altered/i);
    });

    it('verifySolanaSignatureSafety throws on dropped or modified co-signature', () => {
        const b64 = createCoSignedLegacyTx();
        const before = VersionedTransaction.deserialize(fromBase64(b64));
        const after = VersionedTransaction.deserialize(fromBase64(b64));

        // Sign as owner but wipe the coSigner signature
        after.sign([owner]);
        after.signatures[1] = new Uint8Array(64); // wiped co-signer signature

        expect(() => verifySolanaSignatureSafety(before, after, 0)).toThrow(/co-signature was dropped/i);
    });

    it('verifySolanaSignatureSafety throws if wallet signature slot is missing or empty', () => {
        const b64 = createCoSignedLegacyTx();
        const before = VersionedTransaction.deserialize(fromBase64(b64));
        const after = VersionedTransaction.deserialize(fromBase64(b64));

        // Do not sign with owner (slot 0 remains empty)
        expect(() => verifySolanaSignatureSafety(before, after, 0)).toThrow(/Wallet signature is missing/i);
    });

    it('AppKitSolanaSigner signs via provider and passes checks', async () => {
        const b64 = createCoSignedLegacyTx();

        const mockProvider = {
            signTransaction: vi.fn().mockImplementation(async (tx: VersionedTransaction) => {
                // Emulate external wallet signing the transaction
                tx.sign([owner]);
                return tx;
            }),
        };

        (getAppKitSolanaProvider as any).mockResolvedValue(mockProvider);

        const signer = createAppKitSolanaSigner(owner.publicKey.toBase58(), false);
        expect(signer.kind).toBe('appkit');
        expect(signer.address).toBe(owner.publicKey.toBase58());

        const res = await signer.sign(b64);
        expect(res.raw).toBeDefined();
        expect(res.signature).toBeDefined();
        expect(res.blockhash).toBe(blockhash);

        // Verify co-signature was preserved
        const back = VersionedTransaction.deserialize(res.raw);
        expect(back.signatures[1].some(b => b !== 0)).toBe(true);
    });

    it('AppKitSolanaSigner rejects transaction if wallet address is not a required signer', async () => {
        const strangerAddress = Keypair.generate().publicKey.toBase58();
        const signer = createAppKitSolanaSigner(strangerAddress, false);
        const b64 = createCoSignedLegacyTx();

        await expect(signer.sign(b64)).rejects.toThrow(`this transaction is not for ${strangerAddress}`);
    });
});
