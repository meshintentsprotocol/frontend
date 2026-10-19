/**
 * WizardConnect client module for BCH (Nostr relay transport, hdwalletv1 protocol).
 *
 * Phase 1: WizardConnect for BCH
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
        ? `${window.location.origin}/assets/bchintentslogo_edited.png`
        : 'https://bchintents.com/assets/bchintentslogo_edited.png';

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
    };

    getManagersMap().set(id, activeRecord);

    let isCancelled = false;

    const cancel = () => {
        isCancelled = true;
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
 * Restore an existing WizardConnect session from storage on page load.
 */
export function restore(id: string, network: AppNetwork): WizSession | null {
    const existing = getManagersMap().get(id);
    if (existing?.session) return existing.session;

    const iconUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/assets/bchintentslogo_edited.png`
        : 'https://bchintents.com/assets/bchintentslogo_edited.png';

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
    const lockingMap = new Map<string, { pathName: 'receive' | 'change' | 'defi'; index: number }>();
    lockingMap.set(lockingBytecodeHex, { pathName: 'receive', index: 0 });

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
    };

    getManagersMap().set(id, activeRecord);

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
