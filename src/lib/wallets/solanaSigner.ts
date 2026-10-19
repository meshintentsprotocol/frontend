/**
 * Unified Solana transaction signer abstraction.
 *
 * Two implementations:
 * - LocalSolanaSigner: wraps the in-app Keypair (signSolanaTx)
 * - AppKitSolanaSigner: wraps AppKit's Solana provider with strict safety checks
 *   (message preservation, co-signature preservation, wallet signature verification).
 *
 * Phase 7: AppKit + Solana
 */

import { useMemo } from 'react';
import { Keypair, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { base58, fromBase64, signSolanaTx, type SignedSolanaTx } from '@/swap-server/signers';
import { getAppKitSolanaProvider, switchAppKitSolanaNetwork } from './appkitBridge';
import { runSignRequest } from './signRequest';
import { findWalletById } from './registry';
import { useActiveAccounts } from '@/hooks/useActiveAccounts';
import { useWDK } from '@/context/WDKProvider';

export interface SolanaTxSigner {
    kind: 'local' | 'appkit';
    address: string;
    /** Add this wallet's signature to a server-built transaction, keeping signatures already on it. Never sends. */
    sign(base64Tx: string, opts?: { signal?: AbortSignal }): Promise<SignedSolanaTx>;
}

/**
 * Signs Solana transactions with a local Keypair (built-in Cham wallet).
 */
export function createLocalSolanaSigner(keypair: Keypair): SolanaTxSigner {
    return {
        kind: 'local',
        address: keypair.publicKey.toBase58(),
        async sign(base64Tx: string): Promise<SignedSolanaTx> {
            return signSolanaTx(base64Tx, keypair);
        },
    };
}

/**
 * Verify that a signed transaction matches the unsigned transaction:
 * 1. Message bytes are unchanged byte for byte.
 * 2. Signatures already present on before are unchanged byte for byte (co-signatures).
 * 3. Wallet signature slot is non-zero.
 */
export function verifySolanaSignatureSafety(
    before: VersionedTransaction,
    after: VersionedTransaction,
    walletIndex: number,
): void {
    // 1. Message bytes unchanged
    const beforeMsg = before.message.serialize();
    const afterMsg = after.message.serialize();
    if (beforeMsg.length !== afterMsg.length) {
        throw new Error('Transaction message was altered during signing: length mismatch');
    }
    for (let i = 0; i < beforeMsg.length; i++) {
        if (beforeMsg[i] !== afterMsg[i]) {
            throw new Error('Transaction message was altered during signing');
        }
    }

    // 2. Co-signatures preserved
    for (let i = 0; i < before.signatures.length; i++) {
        const wasSigned = before.signatures[i].some(b => b !== 0);
        if (wasSigned) {
            const afterSig = after.signatures[i];
            if (!afterSig || !before.signatures[i].every((b, idx) => b === afterSig[idx])) {
                throw new Error('Pre-existing co-signature was dropped or modified');
            }
        }
    }

    // 3. Wallet signature is non-zero
    const walletSig = after.signatures[walletIndex];
    if (!walletSig || !walletSig.some(b => b !== 0)) {
        throw new Error('Wallet signature is missing or empty');
    }
}

/**
 * Signs Solana transactions with an external wallet connected through AppKit.
 * Enforces single in-flight request, timeout, and safety validation.
 */
export function createAppKitSolanaSigner(address: string, isMainnet: boolean): SolanaTxSigner {
    const walletId = 'appkit-solana';

    return {
        kind: 'appkit',
        address,
        async sign(base64Tx: string, opts?: { signal?: AbortSignal }): Promise<SignedSolanaTx> {
            const wallet = findWalletById(walletId);
            const walletLabel = wallet?.label || 'Solana Wallet';

            return runSignRequest({
                walletId,
                walletLabel,
                exec: async (signal) => {
                    signal.throwIfAborted();
                    opts?.signal?.throwIfAborted();

                    const txBytes = fromBase64(base64Tx);
                    const before = VersionedTransaction.deserialize(txBytes);

                    const required = before.message.staticAccountKeys.slice(0, before.message.header.numRequiredSignatures);
                    const walletPubkey = new PublicKey(address);
                    const walletIndex = required.findIndex(k => k.equals(walletPubkey));
                    if (walletIndex === -1) {
                        throw new Error(`this transaction is not for ${address}`);
                    }

                    // Ensure on proper network
                    await switchAppKitSolanaNetwork(isMainnet);
                    signal.throwIfAborted();

                    const provider = await getAppKitSolanaProvider();
                    if (!provider || typeof provider.signTransaction !== 'function') {
                        throw new Error('AppKit Solana provider is not connected or does not support signTransaction');
                    }

                    // Sign a fresh copy of the transaction
                    const txToSign = VersionedTransaction.deserialize(txBytes);
                    const after = await provider.signTransaction(txToSign);
                    signal.throwIfAborted();

                    // Verify safety
                    verifySolanaSignatureSafety(before, after, walletIndex);

                    return {
                        raw: after.serialize(),
                        signature: base58(after.signatures[0]),
                        blockhash: after.message.recentBlockhash,
                    };
                },
            });
        },
    };
}

/**
 * React hook that returns the active SolanaTxSigner:
 * - Local Keypair signer for built-in Cham wallet
 * - AppKitSolanaSigner for connected external Solana wallet
 * - undefined when no wallet is active
 */
export function useActiveSolanaSigner(localKeypair?: Keypair): SolanaTxSigner | undefined {
    const accounts = useActiveAccounts();
    const { bchNetwork } = useWDK();
    const isMainnet = bchNetwork === 'mainnet';

    const solanaAccount = accounts.solana;
    const kind = solanaAccount?.kind ?? 'main';
    const address = solanaAccount?.address;

    return useMemo(() => {
        if (kind === 'main') {
            return localKeypair ? createLocalSolanaSigner(localKeypair) : undefined;
        }
        if (kind === 'appkit' && address) {
            return createAppKitSolanaSigner(address, isMainnet);
        }
        return undefined;
    }, [kind, address, isMainnet, localKeypair]);
}
