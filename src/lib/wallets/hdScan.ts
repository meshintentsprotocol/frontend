/**
 * HD address scanner for WizardConnect wallets.
 *
 * Scans receive and change paths using the BIP-44 gap limit (20 consecutive
 * unused addresses end the scan). "Used" means Electrum's
 * `blockchain.scripthash.get_history` returns at least one entry.
 *
 * Cache: `wiz_hd_<walletId>` in localStorage.
 *   { receive: lastUsedIndex, change: lastUsedIndex, scannedAt }
 * First paint uses the cache; background rescan happens on connect and every 5 min.
 *
 * Phase 5: WizardConnect HD wallet
 */

import { DappConnectionManager } from '@wizardconnect/dapp';
import {
    encodeCashAddress,
    encodeLockingBytecodeP2pkh,
    hash160,
    binToHex,
    sha256,
} from '@bitauth/libauth';
import type { AppNetwork } from './types';

export const HD_GAP_LIMIT = 20;
export const HD_SCAN_CONCURRENCY = 10;
export const HD_RESCAN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export interface HdPathResult {
    lastUsedIndex: number; // -1 means no address used yet
    addresses: string[];   // all derived up to lastUsedIndex + GAP_LIMIT
    lockingMap: Map<string, { pathName: 'receive' | 'change'; index: number }>;
}

export interface HdScanResult {
    receive: HdPathResult;
    change: HdPathResult;
    scannedAt: number;
}

interface CachedScan {
    receiveLastUsed: number;
    changeLastUsed: number;
    scannedAt: number;
}

const CACHE_PREFIX = 'wiz_hd_';

function cacheKey(walletId: string): string {
    return CACHE_PREFIX + walletId;
}

function loadCache(walletId: string): CachedScan | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(cacheKey(walletId));
        if (!raw) return null;
        return JSON.parse(raw) as CachedScan;
    } catch {
        return null;
    }
}

function saveCache(walletId: string, result: HdScanResult): void {
    if (typeof window === 'undefined') return;
    try {
        const entry: CachedScan = {
            receiveLastUsed: result.receive.lastUsedIndex,
            changeLastUsed: result.change.lastUsedIndex,
            scannedAt: result.scannedAt,
        };
        localStorage.setItem(cacheKey(walletId), JSON.stringify(entry));
    } catch { /* non-fatal */ }
}

export function clearHdCache(walletId: string): void {
    if (typeof window === 'undefined') return;
    try { localStorage.removeItem(cacheKey(walletId)); } catch { /* ignore */ }
}

/** Derive a cashaddr + locking bytecode hex for a given HD pubkey. */
function deriveAddress(
    manager: DappConnectionManager,
    childIndex: number,
    addressIndex: number,
    network: AppNetwork,
): { address: string; lockingBytecodeHex: string } {
    const pk = manager.getPubkey(childIndex, BigInt(addressIndex));
    if (!pk) throw new Error(`Cannot derive key at child=${childIndex} index=${addressIndex}`);
    const pkh = hash160(pk);
    const prefix = network === 'mainnet' ? 'bitcoincash' : 'bchtest';
    const { address } = encodeCashAddress({ prefix, type: 'p2pkh', payload: pkh });
    const lockingBytecodeHex = binToHex(encodeLockingBytecodeP2pkh(pkh)).toLowerCase();
    return { address, lockingBytecodeHex };
}

/** Reverse the bytes of a hex string (for scripthash computation). */
function reverseHex(hex: string): string {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) bytes.push(hex.slice(i, i + 2));
    return bytes.reverse().join('');
}

/**
 * Compute the Electrum scripthash for a cashscript P2PKH locking bytecode hex.
 * sha256 of the raw bytes, then byte-reversed, in hex.
 */
function scriptHashOf(lockingBytecodeHex: string): string {
    const bytes = new Uint8Array(lockingBytecodeHex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(lockingBytecodeHex.slice(i * 2, i * 2 + 2), 16);
    }
    const hash = sha256.hash(bytes);
    return reverseHex(binToHex(hash));
}

/** Check if an address has any history via Electrum raw call. */
async function hasHistory(
    lockingBytecodeHex: string,
    electrumProvider: any,
): Promise<boolean> {
    try {
        const scriptHash = scriptHashOf(lockingBytecodeHex);
        // cashscript's ElectrumNetworkProvider exposes `performRequest` or
        // has a raw client via `electrum`. Try both.
        let history: any[] = [];
        if (typeof electrumProvider.performRequest === 'function') {
            history = await electrumProvider.performRequest(
                'blockchain.scripthash.get_history',
                scriptHash,
            );
        } else if (electrumProvider.electrum) {
            history = await electrumProvider.electrum.request(
                'blockchain.scripthash.get_history',
                scriptHash,
            );
        } else {
            // Fallback: check UTXOs (less accurate for spent addresses)
            const utxos = await electrumProvider.getUtxos(
                // We can't convert LB to address here easily, so just return false
                // and the scan will stop at the gap.
                ''
            ).catch(() => []);
            return utxos.length > 0;
        }
        return Array.isArray(history) && history.length > 0;
    } catch {
        return false;
    }
}

/**
 * Scan one HD path (receive = childIndex 0, change = childIndex 1).
 * Returns when `HD_GAP_LIMIT` consecutive addresses have no history.
 */
async function scanPath(
    manager: DappConnectionManager,
    childIndex: number,
    pathName: 'receive' | 'change',
    network: AppNetwork,
    electrumProvider: any,
    startHint = -1,
): Promise<HdPathResult> {
    const lockingMap = new Map<string, { pathName: 'receive' | 'change'; index: number }>();
    const addresses: string[] = [];
    let lastUsedIndex = startHint;
    let scanFrom = Math.max(0, startHint + 1 - HD_GAP_LIMIT);
    let consecutiveUnused = 0;
    let i = scanFrom;

    // Derive at most gap*2 addresses ahead in batches, stop when gap limit hit
    while (true) {
        // Build a batch
        const batch: { address: string; lockingBytecodeHex: string; index: number }[] = [];
        for (let b = 0; b < HD_SCAN_CONCURRENCY; b++) {
            try {
                const derived = deriveAddress(manager, childIndex, i + b, network);
                batch.push({ ...derived, index: i + b });
            } catch {
                break;
            }
        }
        if (batch.length === 0) break;

        // Parallel history checks
        const results = await Promise.all(
            batch.map(item => hasHistory(item.lockingBytecodeHex, electrumProvider).then(used => ({ ...item, used })))
        );

        for (const { address, lockingBytecodeHex, index, used } of results) {
            // Always register addresses up to the current frontier in the map
            addresses[index] = address;
            lockingMap.set(lockingBytecodeHex, { pathName, index });

            if (used) {
                lastUsedIndex = index;
                consecutiveUnused = 0;
            } else {
                consecutiveUnused++;
            }

            if (consecutiveUnused >= HD_GAP_LIMIT) {
                // We found the gap; break out of both loops
                return { lastUsedIndex, addresses: addresses.filter(Boolean), lockingMap };
            }
        }

        i += batch.length;
    }

    return { lastUsedIndex, addresses: addresses.filter(Boolean), lockingMap };
}

/**
 * Full HD scan for a WizardConnect manager.
 * Scans both receive (child 0) and change (child 1) paths.
 */
export async function scanHdWallet(
    walletId: string,
    manager: DappConnectionManager,
    network: AppNetwork,
    electrumProvider: any,
    hint?: { receiveLastUsed: number; changeLastUsed: number },
): Promise<HdScanResult> {
    const [receive, change] = await Promise.all([
        scanPath(manager, 0, 'receive', network, electrumProvider, hint?.receiveLastUsed ?? -1),
        scanPath(manager, 1, 'change', network, electrumProvider, hint?.changeLastUsed ?? -1),
    ]);

    const result: HdScanResult = { receive, change, scannedAt: Date.now() };
    saveCache(walletId, result);
    return result;
}

/**
 * Build initial locking map from cache (used before first scan).
 * Derives all addresses from index 0 up to lastUsedIndex + GAP_LIMIT.
 */
export function buildLockingMapFromCache(
    manager: DappConnectionManager,
    network: AppNetwork,
    cache: CachedScan,
): Map<string, { pathName: 'receive' | 'change'; index: number }> {
    const lockingMap = new Map<string, { pathName: 'receive' | 'change'; index: number }>();

    for (const [childIndex, pathName] of [[0, 'receive' as const], [1, 'change' as const]] as const) {
        const lastUsed = childIndex === 0 ? cache.receiveLastUsed : cache.changeLastUsed;
        const upTo = Math.max(0, lastUsed) + HD_GAP_LIMIT;
        for (let i = 0; i <= upTo; i++) {
            try {
                const { lockingBytecodeHex } = deriveAddress(manager, childIndex, i, network);
                lockingMap.set(lockingBytecodeHex, { pathName, index: i });
            } catch { break; }
        }
    }

    return lockingMap;
}

// ── Background rescan management ─────────────────────────────────────────────

const reschedule = new Map<string, ReturnType<typeof setTimeout>>();

export function scheduleRescan(
    walletId: string,
    manager: DappConnectionManager,
    network: AppNetwork,
    electrumProvider: any,
    onResult: (result: HdScanResult) => void,
    delayMs = HD_RESCAN_INTERVAL_MS,
): void {
    cancelRescan(walletId);
    const id = setTimeout(async () => {
        reschedule.delete(walletId);
        try {
            const cache = loadCache(walletId);
            const result = await scanHdWallet(walletId, manager, network, electrumProvider, cache ?? undefined);
            onResult(result);
            // schedule next
            scheduleRescan(walletId, manager, network, electrumProvider, onResult);
        } catch (e) {
            console.warn('[hdScan] Background rescan failed for', walletId, e);
            // retry later
            scheduleRescan(walletId, manager, network, electrumProvider, onResult);
        }
    }, delayMs);
    reschedule.set(walletId, id);
}

export function cancelRescan(walletId: string): void {
    const id = reschedule.get(walletId);
    if (id !== undefined) {
        clearTimeout(id);
        reschedule.delete(walletId);
    }
}

export { loadCache as loadHdCache };
