/**
 * wc2Serialize.ts
 *
 * Converts CashScript/Electrum UTXO objects into the WC2-BCH "extended JSON"
 * format that Cashonize (and other BCH wallets supporting bch_signTransaction)
 * expect as `sourceOutputs`.
 *
 * The WC2-BCH spec uses libauth's `stringify()` which encodes:
 *   - Uint8Array → "<Uint8Array: 0x{hex}>"
 *   - BigInt     → "<bigint: {value}n>"
 *
 * References:
 *   - https://github.com/mainnet-pat/wc2-bch-bcr
 *   - Cashonize: src/utils/zodValidation.ts
 */

/** Encode a Uint8Array (or hex string) as the libauth stringify format */
function encodeBytes(bytes: Uint8Array | string): string {
    const hex = typeof bytes === 'string' ? bytes : Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return `<Uint8Array: 0x${hex}>`;
}

/** Encode a BigInt or number as the libauth stringify format */
function encodeBigInt(value: bigint | number): string {
    return `<bigint: ${BigInt(value)}n>`;
}

/**
 * Encode an outpoint txid. libauth keeps transaction hashes (and token
 * categories) in the order they are displayed, and reverses them itself when
 * it serializes — so the hex goes in as it is. A wallet that checks the source
 * outputs against the transaction's inputs refuses a reversed hash.
 */
function txidToHash(txid: string): string {
    return `<Uint8Array: 0x${txid.toLowerCase()}>`;
}

/**
 * Convert a cashaddr (bitcoincash:q...) to its P2PKH locking bytecode hex,
 * then encode as WC2 Uint8Array.
 */
async function addrToLockingBytecode(addr: string): Promise<string> {
    const { cashAddressToLockingBytecode } = await import('@bitauth/libauth');
    const result = cashAddressToLockingBytecode(addr);
    if (typeof result === 'string') throw new Error(`Invalid address: ${addr} — ${result}`);
    const hex = Array.from(result.bytecode).map(b => b.toString(16).padStart(2, '0')).join('');
    return `<Uint8Array: 0x${hex}>`;
}

export interface WC2SourceOutput {
    outpointIndex: number;
    outpointTransactionHash: string; // encoded Uint8Array
    sequenceNumber: number;
    lockingBytecode: string;         // encoded Uint8Array
    unlockingBytecode: string;       // encoded Uint8Array (empty = placeholder for wallet to fill)
    valueSatoshis: string;           // encoded BigInt
    token?: {
        amount: string;              // encoded BigInt
        category: string;            // encoded Uint8Array
        nft?: {
            capability: 'none' | 'mutable' | 'minting';
            commitment: string;      // encoded Uint8Array
        };
    };
}

export interface WC2SignTransactionPayload {
    transaction: string;             // unsigned hex tx
    sourceOutputs: WC2SourceOutput[];
    broadcast: boolean;
    userPrompt?: string;
}

/**
 * Convert CashScript ElectrumNetworkProvider UTXOs to WC2 sourceOutputs.
 *
 * @param utxos - UTXOs as returned by `provider.getUtxos(address)`
 * @param selectedIndices - Which UTXOs from the list are used as inputs (in order)
 * @param walletAddress - cashaddr of the wallet owning these UTXOs
 */
export async function buildWC2SourceOutputs(
    utxos: any[],
    selectedIndices: number[],
    walletAddress: string,
): Promise<WC2SourceOutput[]> {
    const lockingBytecode = await addrToLockingBytecode(walletAddress);

    return selectedIndices.map((idx) => {
        const utxo = utxos[idx];
        const sourceOutput: WC2SourceOutput = {
            outpointIndex: utxo.vout ?? 0,
            outpointTransactionHash: txidToHash(utxo.txid),
            sequenceNumber: 0xffffffff,
            lockingBytecode,
            // Empty unlocking bytecode = signal to wallet that THIS input needs signing
            unlockingBytecode: '<Uint8Array: 0x>',
            valueSatoshis: encodeBigInt(BigInt(utxo.satoshis)),
        };

        if (utxo.token) {
            sourceOutput.token = {
                amount: encodeBigInt(BigInt(utxo.token.amount ?? 0)),
                // Display order, as libauth holds it: the wallet signs over this value
                category: encodeBytes(utxo.token.category as string),
            };
            if (utxo.token.nft) {
                sourceOutput.token.nft = {
                    capability: utxo.token.nft.capability ?? 'none',
                    commitment: encodeBytes(utxo.token.nft.commitment ?? ''),
                };
            }
        }

        return sourceOutput;
    });
}

/**
 * Build the full WC2 `bch_signTransaction` params object.
 *
 * @param unsignedTxHex - Hex-encoded unsigned transaction (from CashScript builder)
 * @param sourceOutputs - WC2-encoded source outputs
 * @param userPrompt - Description shown to the user in the wallet UI
 */
export function buildWC2Payload(
    unsignedTxHex: string,
    sourceOutputs: WC2SourceOutput[],
    userPrompt = 'BCH Covenant Swap',
): WC2SignTransactionPayload {
    return {
        transaction: unsignedTxHex,
        sourceOutputs,
        broadcast: true,
        userPrompt,
    };
}

/**
 * Creates a mock Unlocker object for CashScript's TransactionBuilder.
 * CashScript requires inputs to have an unlocker so it can extract the 
 * locking bytecode for serialization. Since the external wallet will sign
 * the inputs, we provide empty unlocking bytes, but we MUST provide the 
 * correct locking bytecode generated from the user's address.
 */
export async function getDummyUnlocker(address: string) {
    const { cashAddressToLockingBytecode } = await import('@bitauth/libauth');
    const result = cashAddressToLockingBytecode(address);
    const bytecode = typeof result === 'string' ? new Uint8Array(25) : result.bytecode;
    
    return {
        unlockingBytecode: new Uint8Array(0),
        generateLockingBytecode: () => bytecode,
        generateUnlockingBytecode: () => new Uint8Array(0),
    } as any;
}
