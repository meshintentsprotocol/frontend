/**
 * BCH transaction utilities: decoding verification before broadcast,
 * local txid computation, and Electrum broadcast handling.
 *
 * Phase 1: WizardConnect
 */

import {
    decodeTransaction,
    encodeTransaction,
    hexToBin,
    binToHex,
    hashTransactionUiOrder,
    type TransactionCommon,
} from '@bitauth/libauth';
import { electrumProviderFor, type BchNetwork } from '@/lib/bchElectrum';

export class TxMismatchError extends Error {
    constructor(reason: string) {
        super(`The wallet returned a different transaction (${reason}); nothing was sent.`);
        this.name = 'TxMismatchError';
    }
}

/** Compute the transaction hash (txid in UI order: lower-case hex) locally */
export function txidOf(signedHex: string): string {
    const bin = hexToBin(signedHex);
    const hash = hashTransactionUiOrder(bin);
    return binToHex(hash);
}

/**
 * Decodes an unsigned tx (either hex or a libauth Transaction object)
 * into a decoded libauth Transaction structure.
 */
function toDecodedTransaction(tx: string | any): TransactionCommon {
    if (typeof tx === 'string') {
        const decoded = decodeTransaction(hexToBin(tx));
        if (typeof decoded === 'string') {
            throw new Error(`Failed to decode unsigned transaction: ${decoded}`);
        }
        return decoded;
    }

    if (tx && typeof tx === 'object') {
        if ('inputs' in tx && 'outputs' in tx) {
            // Already a transaction-like object; encode then decode to normalize types
            try {
                const bin = encodeTransaction(tx);
                const decoded = decodeTransaction(bin);
                if (typeof decoded === 'string') {
                    throw new Error(`Failed to decode transaction object: ${decoded}`);
                }
                return decoded;
            } catch (e: any) {
                // If already matching shape, return as-is
                return tx as TransactionCommon;
            }
        }
    }

    throw new Error('Invalid transaction payload: expected hex string or Transaction object.');
}

/**
 * Checks that the signed transaction matches the unsigned transaction in all respects
 * EXCEPT unlockingBytecode.
 *
 * Verifies:
 * - Version & locktime
 * - Input count, outpoint txids, outpoint indices, sequence numbers
 * - Output count, locking bytecode, satoshi value, CashToken data (category, amount, NFT capability & commitment)
 *
 * Throws TxMismatchError if any discrepancy is found.
 */
export function checkSigned(unsignedTx: string | any, signedHex: string): void {
    const unsigned = toDecodedTransaction(unsignedTx);

    const signedDecoded = decodeTransaction(hexToBin(signedHex));
    if (typeof signedDecoded === 'string') {
        throw new TxMismatchError(`Signed transaction is invalid: ${signedDecoded}`);
    }
    const signed = signedDecoded;

    if (unsigned.version !== signed.version) {
        throw new TxMismatchError(`version mismatch: expected ${unsigned.version}, got ${signed.version}`);
    }

    if (unsigned.locktime !== signed.locktime) {
        throw new TxMismatchError(`locktime mismatch: expected ${unsigned.locktime}, got ${signed.locktime}`);
    }

    if (unsigned.inputs.length !== signed.inputs.length) {
        throw new TxMismatchError(`input count mismatch: expected ${unsigned.inputs.length}, got ${signed.inputs.length}`);
    }

    for (let i = 0; i < unsigned.inputs.length; i++) {
        const uIn = unsigned.inputs[i];
        const sIn = signed.inputs[i];

        const uHash = binToHex(uIn.outpointTransactionHash);
        const sHash = binToHex(sIn.outpointTransactionHash);
        if (uHash !== sHash) {
            throw new TxMismatchError(`input ${i} outpoint hash mismatch: expected ${uHash}, got ${sHash}`);
        }

        if (uIn.outpointIndex !== sIn.outpointIndex) {
            throw new TxMismatchError(`input ${i} outpoint index mismatch: expected ${uIn.outpointIndex}, got ${sIn.outpointIndex}`);
        }

        if (uIn.sequenceNumber !== sIn.sequenceNumber) {
            throw new TxMismatchError(`input ${i} sequence mismatch: expected ${uIn.sequenceNumber}, got ${sIn.sequenceNumber}`);
        }
    }

    if (unsigned.outputs.length !== signed.outputs.length) {
        throw new TxMismatchError(`output count mismatch: expected ${unsigned.outputs.length}, got ${signed.outputs.length}`);
    }

    for (let i = 0; i < unsigned.outputs.length; i++) {
        const uOut = unsigned.outputs[i];
        const sOut = signed.outputs[i];

        const uLock = binToHex(uOut.lockingBytecode);
        const sLock = binToHex(sOut.lockingBytecode);
        if (uLock !== sLock) {
            throw new TxMismatchError(`output ${i} locking bytecode mismatch`);
        }

        if (uOut.valueSatoshis !== sOut.valueSatoshis) {
            throw new TxMismatchError(`output ${i} value mismatch: expected ${uOut.valueSatoshis}, got ${sOut.valueSatoshis}`);
        }

        const uToken = uOut.token;
        const sToken = sOut.token;

        if (Boolean(uToken) !== Boolean(sToken)) {
            throw new TxMismatchError(`output ${i} token presence mismatch`);
        }

        if (uToken && sToken) {
            if (binToHex(uToken.category) !== binToHex(sToken.category)) {
                throw new TxMismatchError(`output ${i} token category mismatch`);
            }
            if (uToken.amount !== sToken.amount) {
                throw new TxMismatchError(`output ${i} token amount mismatch`);
            }

            const uNft = uToken.nft;
            const sNft = sToken.nft;
            if (Boolean(uNft) !== Boolean(sNft)) {
                throw new TxMismatchError(`output ${i} token NFT presence mismatch`);
            }

            if (uNft && sNft) {
                if (uNft.capability !== sNft.capability) {
                    throw new TxMismatchError(`output ${i} token NFT capability mismatch`);
                }
                const uCommit = binToHex(uNft.commitment || new Uint8Array(0));
                const sCommit = binToHex(sNft.commitment || new Uint8Array(0));
                if (uCommit !== sCommit) {
                    throw new TxMismatchError(`output ${i} token NFT commitment mismatch`);
                }
            }
        }
    }
}

/**
 * Broadcasts a raw hex signed transaction to the network via Electrum.
 * Tolerates already-known errors and returns the local txid.
 */
export async function broadcast(network: BchNetwork, signedHex: string): Promise<string> {
    const txid = txidOf(signedHex);
    const provider = electrumProviderFor(network);

    try {
        await provider.sendRawTransaction(signedHex);
        return txid;
    } catch (err: unknown) {
        const msg = (err instanceof Error ? err.message : String(err || '')).toLowerCase();
        if (
            msg.includes('already known') ||
            msg.includes('txn-already-known') ||
            msg.includes('transaction already in block chain') ||
            msg.includes('txn-already-in-mempool')
        ) {
            return txid;
        }
        throw err;
    }
}
