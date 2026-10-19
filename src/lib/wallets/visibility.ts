/**
 * Visibility rules for wallet-tagged records (activity, notifications, orders).
 *
 * Rules:
 * - isConnected(rec):
 *     rec.network === appNetwork &&
 *     connectedAddresses(family).has(norm(rec.wallet ?? builtInAddress(family)))
 * - isActive(rec):
 *     rec.network === appNetwork &&
 *     norm(rec.wallet ?? builtInAddress(family)) === norm(activeAddress(family))
 *
 * Records written before Phase 3 have no wallet tag -> they belong to the built-in wallet.
 *
 * Phase 3: Balances, history and notifications follow the wallet
 */

import { AppNetwork, ChainFamily } from './types';
import { getWalletContext, WalletAmbientContext } from './ambient';
import { pkhOfAddress } from '@/lib/mesh/signer';

export interface WalletTaggedRecord {
    family?: ChainFamily;
    network?: AppNetwork | string;
    wallet?: string | null;
}

/**
 * Normalizes an address for identity comparison:
 * - Lowercase
 * - BCH prefix stripped ('bitcoincash:', 'bchtest:', 'bchreg:')
 * - Token-aware and plain cashaddr mapped to identical PKH
 * - EVM checksum lowered
 */
export function norm(address?: string | null, family: ChainFamily = 'bch'): string {
    if (!address || typeof address !== 'string') return '';
    const trimmed = address.trim();

    if (family === 'bch') {
        try {
            const withPrefix = /^(bitcoincash|bchtest|bchreg):/i.test(trimmed)
                ? trimmed
                : (trimmed.startsWith('b') ? trimmed : `bitcoincash:${trimmed}`);
            return pkhOfAddress(withPrefix).toLowerCase();
        } catch {
            // Fallback: strip prefix and lowercase
            return trimmed.replace(/^(bitcoincash|bchtest|bchreg):/i, '').toLowerCase();
        }
    }

    if (family === 'evm') {
        return trimmed.toLowerCase();
    }

    return trimmed;
}

/**
 * Map ambient or legacy network string to unified AppNetwork ('mainnet' | 'testnet')
 */
export function normalizeNetwork(net?: string): AppNetwork {
    if (!net) return 'testnet';
    const l = net.toLowerCase();
    return l === 'mainnet' ? 'mainnet' : 'testnet';
}

/**
 * Resolves the owner address of a record (falls back to built-in address if untagged).
 */
export function getRecordOwnerAddress(
    record: WalletTaggedRecord,
    ctx: WalletAmbientContext = getWalletContext()
): string | null {
    const family = record.family || 'bch';
    return record.wallet || ctx.builtIn[family] || null;
}

/**
 * Returns true if the record belongs to a currently connected wallet on the active network.
 * (Used by notification bell to show alerts for all currently connected wallets).
 */
export function isConnected(
    record: WalletTaggedRecord,
    customCtx?: WalletAmbientContext
): boolean {
    const ctx = customCtx || getWalletContext();
    const family: ChainFamily = record.family || 'bch';
    const recNetwork = normalizeNetwork(record.network);

    if (recNetwork !== ctx.network) {
        return false;
    }

    const owner = getRecordOwnerAddress(record, ctx);
    if (!owner) {
        return false;
    }

    const normOwner = norm(owner, family);
    const connectedList = ctx.connectedAddresses[family] || [];

    return connectedList.some(addr => norm(addr, family) === normOwner);
}

/**
 * Returns true if the record belongs to the currently active wallet on the active network.
 * (Used by portfolio activity and order lists).
 */
export function isActive(
    record: WalletTaggedRecord,
    customCtx?: WalletAmbientContext
): boolean {
    const ctx = customCtx || getWalletContext();
    const family: ChainFamily = record.family || 'bch';
    const recNetwork = normalizeNetwork(record.network);

    if (recNetwork !== ctx.network) {
        return false;
    }

    const activeAddr = ctx.active[family];
    if (!activeAddr) {
        return false;
    }

    const owner = getRecordOwnerAddress(record, ctx);
    if (!owner) {
        return false;
    }

    return norm(owner, family) === norm(activeAddr, family);
}
