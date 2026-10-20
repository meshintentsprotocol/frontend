/**
 * signBch.ts
 *
 * Universal transaction signer for LendBCH / Paryon transactions.
 * - External wallets (Cashonize, Paytaca, WizardConnect, extensions):
 *   signed via WalletConnect / extension bch_signTransaction RPC.
 * - Main in-app WDK wallet:
 *   signed locally using Schnorr signatures and libauth.
 */
import {
    decodeTransaction,
    encodeTransaction,
    hexToBin,
    binToHex,
    decodePrivateKeyWif,
    secp256k1,
    sha256,
    generateSigningSerializationBCH,
    hashTransactionUiOrder,
    cashAddressToLockingBytecode,
} from '@bitauth/libauth';
import type { WC2SignPayload, WC2SignResult } from '@/context/ExternalBCHWalletProvider';

export interface BchSignerHandle {
    isMainActive: boolean;
    getWIF: () => string | null;
    signExternal?: (payload: WC2SignPayload) => Promise<WC2SignResult>;
    userAddress: string;
}

/**
 * Sign a Paryon transaction payload using whichever wallet is active.
 */
export async function signParyonTx(
    payload: WC2SignPayload,
    signer: BchSignerHandle
): Promise<{ signedHex: string; txid: string }> {
    // 1. External wallet flow (Cashonize, Paytaca, WizardConnect, Cham)
    if (!signer.isMainActive && signer.signExternal) {
        const res = await signer.signExternal(payload);
        return {
            signedHex: res.signedTransaction,
            txid: res.signedTransactionHash,
        };
    }

    // 2. Main WDK wallet flow
    const wif = signer.getWIF();
    if (!wif) {
        throw new Error('No BCH wallet connected to sign transaction.');
    }

    const decodedWif = decodePrivateKeyWif(wif);
    if (typeof decodedWif === 'string') {
        throw new Error(`Invalid WIF: ${decodedWif}`);
    }

    const privKey = decodedWif.privateKey;
    const pubKey = secp256k1.derivePublicKeyCompressed(privKey);
    if (typeof pubKey === 'string') {
        throw new Error(`Secp256k1 pubkey derivation failed: ${pubKey}`);
    }

    const tx = decodeTransaction(hexToBin(payload.transaction));
    if (typeof tx === 'string') {
        throw new Error(`Failed to decode transaction: ${tx}`);
    }

    // Parse sourceOutputs (un-stringify libauth format if needed)
    const sourceOutputs = payload.sourceOutputs.map((so: any) => {
        let lockingBytecode = so.lockingBytecode;
        if (typeof lockingBytecode === 'string') {
            if (lockingBytecode.startsWith('<Uint8Array: 0x') && lockingBytecode.endsWith('>')) {
                lockingBytecode = hexToBin(lockingBytecode.slice(15, -1));
            } else if (lockingBytecode.startsWith('0x')) {
                lockingBytecode = hexToBin(lockingBytecode.slice(2));
            } else if (/^[0-9a-fA-F]+$/.test(lockingBytecode)) {
                lockingBytecode = hexToBin(lockingBytecode);
            }
        }
        let valueSatoshis = so.valueSatoshis;
        if (typeof valueSatoshis === 'string') {
            if (valueSatoshis.startsWith('<bigint: ') && valueSatoshis.endsWith('n>')) {
                valueSatoshis = BigInt(valueSatoshis.slice(9, -2));
            } else {
                valueSatoshis = BigInt(valueSatoshis);
            }
        } else {
            valueSatoshis = BigInt(valueSatoshis);
        }

        let token = so.token;
        if (token && typeof token === 'object') {
            let cat = token.category;
            if (typeof cat === 'string') {
                if (cat.startsWith('<Uint8Array: 0x') && cat.endsWith('>')) {
                    cat = hexToBin(cat.slice(15, -1));
                } else if (/^[0-9a-fA-F]+$/.test(cat)) {
                    cat = hexToBin(cat);
                }
            }
            let amt = token.amount;
            if (typeof amt === 'string' && amt.startsWith('<bigint: ') && amt.endsWith('n>')) {
                amt = BigInt(amt.slice(9, -2));
            } else if (amt != null) {
                amt = BigInt(amt);
            }
            let nft = token.nft;
            if (nft && typeof nft.commitment === 'string') {
                let comm = nft.commitment;
                if (comm.startsWith('<Uint8Array: 0x') && comm.endsWith('>')) {
                    comm = hexToBin(comm.slice(15, -1));
                } else if (/^[0-9a-fA-F]+$/.test(comm)) {
                    comm = hexToBin(comm);
                }
                nft = { ...nft, commitment: comm };
            }
            token = { category: cat, amount: amt, nft };
        }

        return {
            lockingBytecode,
            valueSatoshis,
            token,
        };
    });

    // Derive user address locking bytecode to match user inputs
    const lockRes = cashAddressToLockingBytecode(signer.userAddress);
    const userLockingHex = typeof lockRes !== 'string' ? binToHex(lockRes.bytecode) : '';

    // Sign each input that has placeholder/empty unlocking bytecode
    for (let inputIndex = 0; inputIndex < tx.inputs.length; inputIndex++) {
        const input = tx.inputs[inputIndex];
        const covered = sourceOutputs[inputIndex];
        if (!covered) continue;

        const coveredHex = binToHex(covered.lockingBytecode);
        // Only sign inputs belonging to user P2PKH or with empty unlocking bytecode
        const isUserP2PKH = userLockingHex && coveredHex === userLockingHex;
        const isEmpty = input.unlockingBytecode.length === 0;

        if (isUserP2PKH || isEmpty) {
            const ser = generateSigningSerializationBCH(
                { inputIndex, sourceOutputs, transaction: tx },
                { coveredBytecode: covered.lockingBytecode, signingSerializationType: new Uint8Array([0x41]) }
            );
            const sighash = sha256.hash(sha256.hash(ser));
            const sig = secp256k1.signMessageHashSchnorr(privKey, sighash);
            if (typeof sig === 'string') {
                throw new Error(`Schnorr signing failed on input ${inputIndex}: ${sig}`);
            }

            const fullSig = new Uint8Array([...sig, 0x41]);
            input.unlockingBytecode = new Uint8Array([
                fullSig.length, ...fullSig,
                pubKey.length, ...pubKey,
            ]);
        }
    }

    const signedBin = encodeTransaction(tx);
    const signedHex = binToHex(signedBin);
    const txid = binToHex(hashTransactionUiOrder(signedBin));

    return { signedHex, txid };
}
