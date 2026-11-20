/**
 * WizardConnect client module for BCH (Nostr relay transport, hdwalletv1 protocol).
 *
 * Phase 1: WizardConnect for BCH
 * Phase 5: Full HD wallet — all receive and change addresses scanned and signed.
 */

import { DappConnectionManager } from '@wizardconnect/dapp';
import {
    initiateDappRelay,
    parseExtendedJson,
    toUint8Array,
    binToHex,
} from '@wizardconnect/core';
import {
    encodeCashAddress,
    encodeLockingBytecodeP2pkh,
    hash160,
} from '@bitauth/libauth';
import { AppNetwork } from './types';
import { checkSigned, broadcast, txidOf } from './bchTx';
import { WC2SignPayload, WC2SignResult } from '@/context/ExternalBCHWalletProvider';
import { WalletSignError } from './signRequest';
import { removeWallet, updateWallet } from './registry';
import {
    scanHdWallet,
    buildLockingMapFromCache,
    loadHdCache,
    clearHdCache,
    scheduleRescan,
    cancelRescan,
    type HdScanResult,
} from './hdScan';

export type WizStatus = 'connected' | 'reconnecting' | 'disconnected';

export interface WizSession {
    id: string;
    label: string;
    icon?: string;
    address: string;
    network: AppNetwork;
    paths: any[];
}

interface ActiveManager {
    manager: DappConnectionManager;
    relay: any;
    network: AppNetwork;
    session: WizSession | null;
    status: WizStatus;
    lockingMap: Map<string, { pathName: 'receive' | 'change' | 'defi'; index: number }>;
    /** HD scan result — available after first scan; null before. */
    hdScan: HdScanResult | null;
}

declare global {
    interface Window {
        __wizManagers?: Map<string, ActiveManager>;
        __wizListeners?: Map<string, Set<(event: string, data?: any) => void>>;
    }
}

const moduleManagers = new Map<string, ActiveManager>();
const moduleListeners = new Map<string, Set<(event: string, data?: any) => void>>();

function getManagersMap(): Map<string, ActiveManager> {
    if (typeof window !== 'undefined') {
        if (!window.__wizManagers) {
            window.__wizManagers = new Map();
        }
        return window.__wizManagers;
    }
    return moduleManagers;
}

function getListenersMap(): Map<string, Set<(event: string, data?: any) => void>> {
    if (typeof window !== 'undefined') {
        if (!window.__wizListeners) {
            window.__wizListeners = new Map();
        }
        return window.__wizListeners;
    }
    return moduleListeners;
}

export function onWizEvent(id: string, handler: (event: string, data?: any) => void): () => void {
    const map = getListenersMap();
    if (!map.has(id)) map.set(id, new Set());
    const set = map.get(id)!;
    set.add(handler);
    return () => { set.delete(handler); };
}

function emitWizEvent(id: string, event: string, data?: any) {
    const listeners = getListenersMap().get(id);
    if (listeners) {
        for (const handler of listeners) {
            try { handler(event, data); } catch (e) { console.error(e); }
        }
    }
}

export function getWizStatus(id: string): WizStatus {
    return getManagersMap().get(id)?.status ?? 'disconnected';
}

function sanitizeIcon(iconUrl?: string | null): string | undefined {
    if (!iconUrl || typeof iconUrl !== 'string') return undefined;
    const trimmed = iconUrl.trim();
    if (trimmed.startsWith('https://') || trimmed.startsWith('data:image/')) {
        return trimmed;
    }
    return undefined;
}

/**
 * Derives the receive/0 address and locking bytecode from manager.
 */
function deriveReceive0(manager: DappConnectionManager, network: AppNetwork): {
    address: string;
    lockingBytecodeHex: string;
} {
    const pk = manager.getPubkey(0, 0n);
    if (!pk) {
        throw new Error('Wallet did not share a receive path.');
    }

    const pkh = hash160(pk);
    const prefix = network === 'mainnet' ? 'bitcoincash' : 'bchtest';
    const cashaddrResult = encodeCashAddress({
        prefix,
        type: 'p2pkh',
        payload: pkh,
    });
    const address = cashaddrResult.address;

    const lockingBytecode = encodeLockingBytecodeP2pkh(pkh);
    const lockingBytecodeHex = binToHex(lockingBytecode).toLowerCase();

    return { address, lockingBytecodeHex };
}

/**
 * Extract locking bytecode hex from a raw source output entry
 */
function extractLockingBytecodeHex(raw: any): string {
    if (!raw) return '';
    let val = raw.lockingBytecode ?? raw.scriptPubKey ?? raw;

    if (typeof val === 'string' && val.startsWith('<Uint8Array:')) {
        try {
            val = parseExtendedJson(val);
        } catch { /* ignore */ }
    }

    if (val instanceof Uint8Array) {
        return binToHex(val).toLowerCase();
    }

    if (typeof val === 'string') {
        const cleaned = val.replace(/^0x/i, '').toLowerCase();
        if (/^[0-9a-f]+$/.test(cleaned)) return cleaned;
    }

    return '';
}

/**
 * Start pairing for a new WizardConnect session.
 * Returns pairing URIs and a promise that resolves once the wallet approves.
 */
export async function startPairing(network: AppNetwork): Promise<{
    id: string;
    uri: string;
    qrUri: string;
    ready: Promise<WizSession>;
    cancel: () => void;
}> {
    const id = `wiz-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const iconUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/assets/pwa-512x512.png`
        : 'https://bchintents.com/assets/pwa-512x512.png';

    const manager = new DappConnectionManager('BCH Intents', iconUrl, {
        session: { key: `wizardconnect-${id}` },
    });

    const relay = initiateDappRelay(({ client, status }: { client: any; status: any }) => {
        manager.updateConnection(client, status);
    });

    manager.attachRelay(relay);

    const activeRecord: ActiveManager = {
        manager,
        relay,
        network,
        session: null,
        status: 'reconnecting',
        lockingMap: new Map(),
        hdScan: null,
    };

    getManagersMap().set(id, activeRecord);

    let isCancelled = false;

    const cancel = () => {
        isCancelled = true;
        cancelRescan(id);
        clearHdCache(id);
        try {
            relay.cleanup();
            manager.destroy();
            manager.clearStoredSession();
        } catch { /* ignore */ }
        getManagersMap().delete(id);
    };

    const ready = new Promise<WizSession>((resolve, reject) => {
        manager.on('walletready', () => {
            if (isCancelled) return;
            try {
                const { address, lockingBytecodeHex } = deriveReceive0(manager, network);
                // Seed locking map with receive/0 immediately so signing works before scan completes
                activeRecord.lockingMap.set(lockingBytecodeHex, { pathName: 'receive', index: 0 });

                const rawIcon = (manager as any).walletIcon ?? (manager as any).metadata?.icon;
                const rawName = (manager as any).walletName ?? (manager as any).metadata?.name;
                const label = rawName || 'Paytaca';
                const icon = sanitizeIcon(rawIcon);

                const session: WizSession = {
                    id,
                    label,
                    icon,
                    address,
                    network,
                    paths: manager.getSessionPaths() || [],
                };

                activeRecord.session = session;
                activeRecord.status = 'connected';
                emitWizEvent(id, 'connected', session);
                resolve(session);

                // Kick off the HD scan in the background (don't block pairing)
                _startHdScan(id, activeRecord);
            } catch (err) {
                reject(err);
            }
        });

        manager.on('reconnecting', () => {
            activeRecord.status = 'reconnecting';
            emitWizEvent(id, 'reconnecting');
        });

        manager.on('disconnect', (_reason: any, message: any) => {
            activeRecord.status = 'disconnected';
            emitWizEvent(id, 'disconnect', message);
            removeWallet(id);
            if (!activeRecord.session) {
                reject(new Error(message || 'Wallet disconnected before pairing completed.'));
            }
        });
    });

    return {
        id,
        uri: relay.uri,
        qrUri: relay.qrUri,
        ready,
        cancel,
    };
}

/**
 * Internal: kick off a full HD scan and update the locking map + schedule rescans.
 */
async function _startHdScan(id: string, record: ActiveManager): Promise<void> {
    const { manager, network } = record;
    try {
        // Build provider lazily (import to avoid circular deps)
        const { electrumProviderFor } = await import('@/lib/bchElectrum');
        const bchNet = network === 'mainnet' ? 'mainnet' : 'chipnet';
        const provider = electrumProviderFor(bchNet);

        const cache = loadHdCache(id);
        // Fast-path: seed locking map from cache immediately
        if (cache) {
            const cachedMap = buildLockingMapFromCache(manager, network, cache);
            for (const [k, v] of cachedMap) record.lockingMap.set(k, v);
        }

        const result = await scanHdWallet(id, manager, network, provider, cache ?? undefined);
        // Merge scanned results into the locking map (additive, never remove)
        for (const [k, v] of result.receive.lockingMap) record.lockingMap.set(k, v);
        for (const [k, v] of result.change.lockingMap) record.lockingMap.set(k, v);
        record.hdScan = result;
        emitWizEvent(id, 'hdscan', result);

        scheduleRescan(id, manager, network, provider, (newResult) => {
            if (!getManagersMap().has(id)) return;
            for (const [k, v] of newResult.receive.lockingMap) record.lockingMap.set(k, v);
            for (const [k, v] of newResult.change.lockingMap) record.lockingMap.set(k, v);
            record.hdScan = newResult;
            emitWizEvent(id, 'hdscan', newResult);
        });
    } catch (e) {
        console.warn('[WizardConnect] HD scan failed for', id, e);
    }
}

/**
 * Restore an existing WizardConnect session from storage on page load.
 */
export function restore(id: string, network: AppNetwork): WizSession | null {
    const existing = getManagersMap().get(id);
    if (existing?.session) return existing.session;

    const iconUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/assets/pwa-512x512.png`
        : 'https://bchintents.com/assets/pwa-512x512.png';

    const manager = new DappConnectionManager('BCH Intents', iconUrl, {
        session: { key: `wizardconnect-${id}` },
    });

    const stored = manager.loadStoredSession();
    if (!stored?.walletPublicKey) {
        // Pairing was never finished; discard
        try { manager.clearStoredSession(); } catch { /* ignore */ }
        return null;
    }

    if (stored.paths) {
        manager.restoreSessionPaths(stored.paths);
    }

    const { address, lockingBytecodeHex } = deriveReceive0(manager, network);
    // Seed locking map with receive/0; HD scan will add the rest
    const lockingMap = new Map<string, { pathName: 'receive' | 'change' | 'defi'; index: number }>();
    lockingMap.set(lockingBytecodeHex, { pathName: 'receive', index: 0 });

    // Build locking map from cache immediately for instant signing
    const cache = loadHdCache(id);
    if (cache) {
        const cachedMap = buildLockingMapFromCache(manager, network, cache);
        for (const [k, v] of cachedMap) lockingMap.set(k, v);
    }

    const relay = initiateDappRelay(
        ({ client, status }: { client: any; status: any }) => {
            manager.updateConnection(client, status);
        },
        {
            existingCredentials: {
                privateKey: stored.privateKey,
                secret: stored.secret,
                walletPublicKey: stored.walletPublicKey,
            },
        }
    );

    manager.attachRelay(relay);

    const session: WizSession = {
        id,
        label: stored.walletName || 'Paytaca',
        icon: sanitizeIcon(stored.walletIcon),
        address,
        network,
        paths: stored.paths || [],
    };

    const activeRecord: ActiveManager = {
        manager,
        relay,
        network,
        session,
        status: manager.isWalletDiscovered() ? 'connected' : 'reconnecting',
        lockingMap,
        hdScan: null,
    };

    getManagersMap().set(id, activeRecord);

    // Kick off HD scan in the background
    _startHdScan(id, activeRecord);

    manager.on('walletready', () => {
        try {
            const rawIcon = (manager as any).walletIcon ?? (manager as any).metadata?.icon;
            const rawName = (manager as any).walletName ?? (manager as any).metadata?.name;
            const updatedLabel = rawName || session.label;
            const updatedIcon = sanitizeIcon(rawIcon) ?? session.icon;

            activeRecord.status = 'connected';
            updateWallet(id, { label: updatedLabel, icon: updatedIcon });
            emitWizEvent(id, 'connected');
        } catch { /* non-fatal */ }
    });

    manager.on('reconnecting', () => {
        activeRecord.status = 'reconnecting';
        emitWizEvent(id, 'reconnecting');
    });

    manager.on('disconnect', (_reason: any, message: any) => {
        activeRecord.status = 'disconnected';
        emitWizEvent(id, 'disconnect', message);
        removeWallet(id);
    });

    return session;
}

/**
 * Disconnect an active WizardConnect session.
 */
export async function disconnect(id: string): Promise<void> {
    const record = getManagersMap().get(id);
    if (!record) return;

    cancelRescan(id);

    try {
        await record.manager.sendDisconnect('User disconnected').catch(() => {});
        record.relay?.cleanup?.();
        record.manager.destroy?.();
        record.manager.clearStoredSession?.();
    } catch { /* ignore */ }

    getManagersMap().delete(id);
    getListenersMap().delete(id);
}

/**
 * Returns all used addresses (receive + change) for a WizardConnect wallet.
 * Falls back to just receive/0 if the HD scan hasn't completed yet.
 */
export function addressSet(id: string): string[] {
    const record = getManagersMap().get(id);
    if (!record) return [];

    const { hdScan, session } = record;
    if (!hdScan) {
        // Scan not done yet — return just the primary address
        return session ? [session.address] : [];
    }

    const addrs = new Set<string>();
    // receive/0 is always included
    if (session) addrs.add(session.address);
    for (const a of hdScan.receive.addresses) if (a) addrs.add(a);
    for (const a of hdScan.change.addresses) if (a) addrs.add(a);
    return Array.from(addrs);
}

/**
 * Returns the next unused receive address (index = lastUsedIndex + 1).
 * Falls back to receive/0 if scan is not done.
 */
export function nextUnusedReceiveAddress(id: string, network: AppNetwork): string | null {
    const record = getManagersMap().get(id);
    if (!record) return null;

    const { hdScan, manager, session } = record;
    if (!hdScan) return session?.address ?? null;

    const nextIdx = hdScan.receive.lastUsedIndex + 1;
    try {
        const { address } = _deriveAddress(manager, 0, nextIdx, network);
        return address;
    } catch {
        return session?.address ?? null;
    }
}

/** Internal: same as deriveReceive0 but for any path/index. */
function _deriveAddress(
    manager: DappConnectionManager,
    childIndex: number,
    addressIndex: number,
    network: AppNetwork,
): { address: string; lockingBytecodeHex: string } {
    const { encodeCashAddress: eca, encodeLockingBytecodeP2pkh: elb, hash160: h160, binToHex: b2h } =
        // re-use the already-imported functions from @bitauth/libauth
        { encodeCashAddress, encodeLockingBytecodeP2pkh, hash160, binToHex };
    const pk = manager.getPubkey(childIndex, BigInt(addressIndex));
    if (!pk) throw new Error(`No pubkey at ${childIndex}/${addressIndex}`);
    const pkh = h160(pk);
    const prefix = network === 'mainnet' ? 'bitcoincash' : 'bchtest';
    const { address } = eca({ prefix, type: 'p2pkh', payload: pkh });
    const lockingBytecodeHex = b2h(elb(pkh)).toLowerCase();
    return { address, lockingBytecodeHex };
}

/**
 * Sign a transaction using an active WizardConnect session.
 */
export async function sign(
    id: string,
    payload: WC2SignPayload,
    signal?: AbortSignal
): Promise<WC2SignResult> {
    const record = getManagersMap().get(id);
    if (!record || !record.manager) {
        throw new Error('WizardConnect session is not active.');
    }

    const { manager, lockingMap, network } = record;

    // Match input paths from payload sourceOutputs
    const inputPaths: [number, 'receive' | 'change' | 'defi', number][] = [];
    const sourceOutputs = payload.sourceOutputs || [];

    for (let i = 0; i < sourceOutputs.length; i++) {
        const lockHex = extractLockingBytecodeHex(sourceOutputs[i]);
        if (lockHex && lockingMap.has(lockHex)) {
            const entry = lockingMap.get(lockHex)!;
            inputPaths.push([i, entry.pathName, entry.index]);
        }
    }

    if (inputPaths.length === 0) {
        const label = record.session?.label || 'WizardConnect wallet';
        throw new WalletSignError('failed', label, `This transaction spends nothing from ${label}.`);
    }

    // Call signTransaction
    const response = await manager.signTransaction(
        {
            transaction: {
                ...payload,
                broadcast: false,
            } as any,
            inputPaths,
        },
        { signal }
    );

    if (response.error) {
        throw new Error(response.error);
    }

    const signedHex = response.signedTransaction;
    if (!signedHex) {
        throw new Error('Empty signed transaction returned from WizardConnect.');
    }

    // Validate signed transaction against unsigned before broadcast
    checkSigned(payload.transaction, signedHex);

    // Broadcast over Electrum
    const bchNetwork = network === 'mainnet' ? 'mainnet' : 'chipnet';
    const txid = await broadcast(bchNetwork, signedHex);

    return {
        signedTransaction: signedHex,
        signedTransactionHash: txid,
    };
}
