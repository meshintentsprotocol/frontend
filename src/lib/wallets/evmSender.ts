/**
 * Unified EVM transaction sender abstraction.
 *
 * Two implementations:
 * - LocalEvmSender: wraps the in-app WDK wallet (sign → onHash → broadcast)
 * - AppKitEvmSender: wraps AppKit's EIP-1193 provider (estimateGas → fees → sendTransaction → onHash)
 *
 * Phase 6: AppKit + EVM
 */

import { ethers } from 'ethers';
import { evmFees, evmProvider, type SentEvmTx } from '@/swap-server/signers';
import type { CctpChain } from '@/swap-server/types';
import { getAppKitEvmProvider, switchAppKitNetwork } from './appkitBridge';
import { classifyError } from './signRequest';
import { useActiveWalletId, MAIN_WALLET_ID } from '@/lib/walletStore';
import { findWalletById } from './registry';
import { useMemo } from 'react';

const GWEI = 1_000_000_000n;

export interface EvmSender {
    kind: 'local' | 'appkit';
    address: string;
    /**
     * Send one transaction on `chainId`.
     * `onRequested` runs before the wallet is asked, with the nonce we expect.
     * `onHash` runs as soon as the hash is known.
     */
    send(
        chainId: number,
        tx: { to: string; data: string; value?: bigint; minMaxFeePerGasGwei?: number },
        opts?: {
            onRequested?: (r: { nonce: number; from: string }) => void | Promise<void>;
            onHash?: (h: string) => void | Promise<void>;
            signal?: AbortSignal;
        },
    ): Promise<SentEvmTx>;
}

// ── LocalEvmSender ─────────────────────────────────────────────────────────

/**
 * Sends transactions with the in-app WDK EVM wallet.
 * Sign first → hash known before broadcast → onHash → broadcast.
 * Unchanged from the existing behavior.
 */
export function createLocalEvmSender(
    signerFactory: (chain: CctpChain) => ethers.Signer | Promise<ethers.Signer>,
    address: string,
): EvmSender {
    return {
        kind: 'local',
        address,
        async send(chainId, tx, opts) {
            // Find the chain config by chainId - we need a CctpChain-like object for evmProvider
            const provider = new ethers.JsonRpcProvider(
                undefined, // will be resolved through the signer
                chainId,
                { staticNetwork: true },
            );

const CHAIN_ID_TO_CCTP_KEY: Record<number, string> = {
    11155111: 'eth-sepolia',
    11155420: 'op-sepolia',
    421614: 'arb-sepolia',
    84532: 'base-sepolia',
    5042002: 'arc-testnet',
    97: 'bsc-testnet',
    1: 'ethereum',
    10: 'optimism',
    42161: 'arbitrum',
    8453: 'base',
    5042: 'arc',
    56: 'bsc',
};

            const key = CHAIN_ID_TO_CCTP_KEY[chainId] || `chain-${chainId}`;
            // Create a synthetic CctpChain for the provider lookup
            const syntheticChain: CctpChain = {
                key,
                kind: 'evm',
                name: `Chain ${chainId}`,
                chainId,
                usdc: '',
                explorerTx: '',
            };

            const signer = await signerFactory(syntheticChain);
            const signerProvider = signer.provider;
            if (!signerProvider) throw new Error('the wallet is not connected to a network');

            const from = await signer.getAddress();
            const [gas, nonce, fees] = await Promise.all([
                signerProvider.estimateGas({ to: tx.to, data: tx.data, from, value: tx.value ?? 0n }),
                signerProvider.getTransactionCount(from, 'pending'),
                evmFees(signerProvider, tx.minMaxFeePerGasGwei),
            ]);

            opts?.signal?.throwIfAborted();
            await opts?.onRequested?.({ nonce, from });

            const signed = await signer.signTransaction({
                to: tx.to,
                data: tx.data,
                value: tx.value ?? 0n,
                chainId,
                type: 2,
                nonce,
                gasLimit: (gas * 13n) / 10n,
                ...fees,
            });

            const hash = ethers.keccak256(signed);
            await opts?.onHash?.(hash);
            await signerProvider.broadcastTransaction(signed);

            return {
                hash,
                async wait() {
                    const receipt = await signerProvider.waitForTransaction(hash, 1, 180_000);
                    if (!receipt) throw new Error('the transaction was not confirmed in time');
                    if (receipt.status !== 1) throw new Error('the transaction was reverted by the network');
                },
            };
        },
    };
}

// ── AppKitEvmSender ────────────────────────────────────────────────────────

/**
 * Sends transactions through AppKit's EIP-1193 provider.
 * The wallet signs AND broadcasts (eth_sendTransaction), so the hash is
 * only known after the wallet confirms. This is why the journal needs the
 * `*Requested` fields (nonce + from) before the wallet is asked.
 */
export function createAppKitEvmSender(address: string): EvmSender {
    return {
        kind: 'appkit',
        address,
        async send(chainId, tx, opts) {
            const eip1193 = await getAppKitEvmProvider();
            if (!eip1193) throw new Error('Your external EVM wallet is not connected. Please connect it via the wallet menu before sending.');

            // Switch to the target chain
            const switched = await switchAppKitNetwork(chainId);
            if (!switched) throw new Error(`Could not switch to chain ${chainId}`);

            // Create a BrowserProvider from the EIP-1193 provider
            const provider = new ethers.BrowserProvider(eip1193, chainId);

            // Verify the chain ID matches after the switch
            const network = await provider.getNetwork();
            if (Number(network.chainId) !== chainId) {
                throw new Error(`Wallet is on chain ${network.chainId}, expected ${chainId}. Please switch manually.`);
            }

            const signer = await provider.getSigner();
            const from = await signer.getAddress();

            // The wallet may have switched account since it connected; never sign from an
            // account other than the one Cham shows (and records in the journal).
            if (from.toLowerCase() !== address.toLowerCase()) {
                throw new Error(`Your wallet is on account ${from.slice(0, 6)}…${from.slice(-4)}, but Cham is connected to ${address.slice(0, 6)}…${address.slice(-4)}. Switch back to that account in your wallet, or reconnect it.`);
            }

            // Estimate gas and prepare fees
            const [gasEstimate, nonce, fees] = await Promise.all([
                provider.estimateGas({
                    to: tx.to,
                    data: tx.data,
                    from,
                    value: tx.value ?? 0n,
                }),
                provider.getTransactionCount(from, 'pending'),
                evmFees(provider, tx.minMaxFeePerGasGwei),
            ]);

            opts?.signal?.throwIfAborted();

            // onRequested runs BEFORE the wallet is asked
            await opts?.onRequested?.({ nonce, from });

            const gasLimit = (gasEstimate * 13n) / 10n;

            // With AppKit, sendTransaction signs AND broadcasts
            const resp = await signer.sendTransaction({
                to: tx.to,
                data: tx.data,
                value: tx.value ?? 0n,
                gasLimit,
                maxFeePerGas: fees.maxFeePerGas,
                maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
                nonce,
            });

            const hash = resp.hash;

            // onHash runs AFTER the wallet broadcast
            await opts?.onHash?.(hash);

            return {
                hash,
                async wait() {
                    const receipt = await resp.wait(1);
                    if (!receipt) throw new Error('the transaction was not confirmed in time');
                    if (receipt.status !== 1) throw new Error('the transaction was reverted by the network');
                },
            };
        },
    };
}

// ── Hook ───────────────────────────────────────────────────────────────────

export interface UseActiveEvmSenderResult {
    sender: EvmSender | null;
    /** Human-readable reason why no sender is available */
    reason?: string;
}

/**
 * Returns the active EVM sender: local for the built-in wallet, AppKit for an external.
 */
export function useActiveEvmSender(
    wdkEvmSigner: ((chain: CctpChain) => ethers.Signer | Promise<ethers.Signer>) | undefined,
    wdkEvmAddress: string | null | undefined,
): UseActiveEvmSenderResult {
    const activeEvmId = useActiveWalletId('evm');

    return useMemo(() => {
        // External AppKit wallet is active
        if (activeEvmId && activeEvmId !== MAIN_WALLET_ID) {
            const ext = findWalletById(activeEvmId);
            if (ext && ext.source === 'appkit') {
                return { sender: createAppKitEvmSender(ext.address) };
            }
            return { sender: null, reason: `External EVM wallet ${activeEvmId} is not available` };
        }

        // Built-in wallet
        if (wdkEvmSigner && wdkEvmAddress) {
            return { sender: createLocalEvmSender(wdkEvmSigner, wdkEvmAddress) };
        }

        return { sender: null, reason: 'No EVM wallet is connected' };
    }, [activeEvmId, wdkEvmSigner, wdkEvmAddress]);
}
