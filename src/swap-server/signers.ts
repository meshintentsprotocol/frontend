/**
 * Signing for the swap server's unsigned transactions with the in-app wallet.
 *
 * EVM: the transaction is signed first and its hash handed to the caller before anything is broadcast, so the
 * hash can be written down (see journal.ts). Fees follow the server's own sender: EIP-1559 with the chain's floor,
 * because Arc silently drops a transaction priced under 20 gwei.
 *
 * Solana: one path for both formats. The CCTP burn is a legacy transaction already signed by a second key; a
 * Jupiter swap is a v0 transaction. `VersionedTransaction` reads both and adds our signature in its slot.
 */
import { ethers } from 'ethers';
import { Keypair, VersionedTransaction } from '@solana/web3.js';
import { localChain } from './cctpChains';
import type { CctpChain, EvmBuiltTx } from './types';

const GWEI = 1_000_000_000n;

// ── EVM ──────────────────────────────────────────────────────────────────────

const providers = new Map<string, ethers.JsonRpcProvider>();

/** A provider for this CCTP chain. The network is fixed, so ethers does not probe it before every call. */
export function evmProvider(chain: CctpChain): ethers.JsonRpcProvider {
    const local = localChain(chain.key);
    if (!local || chain.kind !== 'evm' || !chain.chainId) throw new Error(`${chain.name} is not an EVM chain this app can sign for`);
    let p = providers.get(chain.key);
    if (!p) {
        p = new ethers.JsonRpcProvider(local.rpc, chain.chainId, { staticNetwork: true });
        providers.set(chain.key, p);
    }
    return p;
}

/** The in-app EVM wallet, connected to this chain. */
export function evmSignerFor(chain: CctpChain, wallet: ethers.Signer): ethers.Signer {
    return wallet.connect(evmProvider(chain));
}

export async function evmFees(provider: ethers.Provider, floorGwei?: number): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
    const fd = await provider.getFeeData();
    const prio = fd.maxPriorityFeePerGas ?? GWEI;
    let max = fd.maxFeePerGas ?? (fd.gasPrice ? fd.gasPrice * 2n : 30n * GWEI);
    const floor = floorGwei ? BigInt(floorGwei) * GWEI : 0n;
    if (max < floor) max = floor;
    if (max < prio) max = prio;
    return { maxFeePerGas: max, maxPriorityFeePerGas: prio > max ? max : prio };
}

export interface SentEvmTx {
    hash: string;
    /** Resolves when the transaction is mined; rejects if it reverted or was not mined in time. */
    wait(): Promise<void>;
}

/**
 * Sign, hand the hash to `onHash`, then broadcast. `onHash` runs before the broadcast and is awaited.
 * estimateGas runs first, so a transaction that would revert is refused before it costs anything.
 */
export async function sendEvmTx(
    signer: ethers.Signer, tx: EvmBuiltTx,
    opts: { onHash?: (hash: string) => void | Promise<void>; waitTimeoutMs?: number } = {},
): Promise<SentEvmTx> {
    const provider = signer.provider;
    if (!provider) throw new Error('the wallet is not connected to a network');
    const from = await signer.getAddress();
    const [gas, nonce, fees] = await Promise.all([
        provider.estimateGas({ to: tx.to, data: tx.data, from }),
        provider.getTransactionCount(from, 'pending'),
        evmFees(provider, tx.minMaxFeePerGasGwei),
    ]);
    const signed = await signer.signTransaction({
        to: tx.to, data: tx.data, value: 0n, chainId: tx.chainId, type: 2, nonce, gasLimit: (gas * 13n) / 10n, ...fees,
    });
    const hash = ethers.keccak256(signed);
    await opts.onHash?.(hash);
    await provider.broadcastTransaction(signed);
    return {
        hash,
        wait: async () => {
            const receipt = await provider.waitForTransaction(hash, 1, opts.waitTimeoutMs ?? 180_000);
            if (!receipt) throw new Error('the transaction was not confirmed in time');
            if (receipt.status !== 1) throw new Error('the transaction was reverted by the network');
        },
    };
}

const erc20 = new ethers.Interface(['function transfer(address to, uint256 amount) returns (bool)', 'function balanceOf(address owner) view returns (uint256)']);

/** The service-fee transaction of a transfer, rebuilt from its record: a plain USDC transfer to the treasury. */
export function feeTx(chain: CctpChain, feeRecipient: string, protocolFee: string): EvmBuiltTx {
    return {
        kind: 'fee', chain: 'evm', chainId: chain.chainId!, to: chain.usdc, value: '0',
        data: erc20.encodeFunctionData('transfer', [feeRecipient, BigInt(protocolFee)]),
        minMaxFeePerGasGwei: chain.minMaxFeePerGasGwei,
    };
}

/** USDC balance of an EVM address on a CCTP chain, in base units. */
export async function evmUsdcBalance(chain: CctpChain, owner: string): Promise<bigint> {
    const raw = await evmProvider(chain).call({ to: chain.usdc, data: erc20.encodeFunctionData('balanceOf', [owner]) });
    return BigInt(raw);
}

// ── Solana ───────────────────────────────────────────────────────────────────

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** Base58, for a signature. Local so this module adds no dependency. */
export function base58(bytes: Uint8Array): string {
    const digits = [0];
    for (const byte of bytes) {
        let carry = byte;
        for (let i = 0; i < digits.length; i++) {
            carry += digits[i] << 8;
            digits[i] = carry % 58;
            carry = (carry / 58) | 0;
        }
        while (carry > 0) { digits.push(carry % 58); carry = (carry / 58) | 0; }
    }
    let out = '';
    for (const byte of bytes) { if (byte === 0) out += '1'; else break; }
    for (let i = digits.length - 1; i >= 0; i--) out += B58[digits[i]];
    return out;
}

export function fromBase64(b64: string): Uint8Array {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

export function toBase64(bytes: Uint8Array): string {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
}

export interface SignedSolanaTx {
    raw: Uint8Array;        // send this (CCTP burn), or base64 it for the server (Jupiter swap)
    signature: string;      // the transaction id: the fee payer's signature
    blockhash: string;
}

/** Add the wallet's signature to a transaction the server built. Signatures already on it are kept. */
export function signSolanaTx(base64Tx: string, keypair: Keypair): SignedSolanaTx {
    const tx = VersionedTransaction.deserialize(fromBase64(base64Tx));
    const required = tx.message.staticAccountKeys.slice(0, tx.message.header.numRequiredSignatures);
    if (!required.some(k => k.equals(keypair.publicKey))) throw new Error('this transaction is not for the connected Solana wallet');
    tx.sign([keypair]);
    return { raw: tx.serialize(), signature: base58(tx.signatures[0]), blockhash: tx.message.recentBlockhash };
}
