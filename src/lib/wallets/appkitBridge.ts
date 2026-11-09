/**
 * AppKit ↔ Registry bridge.
 *
 * Subscribes to AppKit's account changes for the `eip155`, `solana` and `bip122` namespaces.
 * On connect → adds a wallet to the registry. On disconnect or account change → updates or removes.
 * Persists a marker so AppKit is loaded on the next page load for reconnection.
 *
 * Rules that keep the registry honest:
 * - Only families the user asked for (a connect flow opened for it, or a marker from an earlier
 *   connect) are registered. A multi-chain wallet that approves extra namespaces over
 *   WalletConnect does not add surprise wallets.
 * - `connecting` / `reconnecting` are not disconnects. On a page load AppKit reports every
 *   namespace as `connecting` until its reconnect settles; treating that as a disconnect
 *   removed the wallet and its marker, so it never came back.
 * - Name and icon come from the wallet of that namespace (`getWalletInfo(namespace)`), so a
 *   Phantom Solana wallet next to a MetaMask EVM wallet is not labelled "MetaMask".
 * - The app's mode lives in one module variable, so a mode switch reaches the subscriptions
 *   instead of them keeping the network they were created with.
 *
 * Phase 6: AppKit + EVM · Phase 7: Solana · Phase 8: Bitcoin
 */

import {
    addWallet,
    removeWallet,
    updateWallet,
    getAllWallets,
    findWalletById,
} from './registry';
import { setActiveWalletId, getActiveWalletId } from '@/lib/walletStore';
import type { ExternalWallet, ChainFamily, AppNetwork } from './types';
import { getAppKit, isAppKitLoaded } from './appkit';

const MARKER_KEY = 'appkit_connected_v1';

export type AppKitNamespace = 'eip155' | 'solana' | 'bip122';

const FAMILY_OF: Record<AppKitNamespace, Exclude<ChainFamily, 'bch'>> = {
    eip155: 'evm',
    solana: 'solana',
    bip122: 'btc',
};

const NAMESPACES = Object.keys(FAMILY_OF) as AppKitNamespace[];

const FALLBACK_LABEL: Record<Exclude<ChainFamily, 'bch'>, string> = {
    evm: 'EVM Wallet',
    solana: 'Solana Wallet',
    btc: 'Bitcoin Wallet',
};

export function namespaceOf(family: ChainFamily): AppKitNamespace | null {
    return family === 'evm' ? 'eip155' : family === 'solana' ? 'solana' : family === 'btc' ? 'bip122' : null;
}

interface AppKitMarker {
    families: ChainFamily[];
}

// ── Marker persistence ─────────────────────────────────────────────────────

function readMarkers(): AppKitMarker {
    try {
        const raw = localStorage.getItem(MARKER_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.families)) return parsed;
        }
    } catch { /* ignore */ }
    return { families: [] };
}

function writeMarkers(m: AppKitMarker) {
    try { localStorage.setItem(MARKER_KEY, JSON.stringify(m)); } catch { /* ignore */ }
}

function addMarker(family: ChainFamily) {
    const m = readMarkers();
    if (!m.families.includes(family)) {
        m.families.push(family);
        writeMarkers(m);
    }
}

function removeMarker(family: ChainFamily) {
    const m = readMarkers();
    m.families = m.families.filter(f => f !== family);
    writeMarkers(m);
}

export function hasAppKitMarker(): boolean {
    return readMarkers().families.length > 0;
}

// ── Bridge state ───────────────────────────────────────────────────────────

let unsubscribers: (() => void)[] = [];
let bridgeStarted = false;
/** The app's current mode; read by every handler. */
let bridgeNetwork: AppNetwork = 'testnet';
/** Families a connect flow is open for right now. */
const requestedFamilies = new Set<ChainFamily>();

/** Derive the wallet ID for an AppKit connection */
function appKitWalletId(family: ChainFamily): string {
    return `appkit-${family}`;
}

/** Find existing AppKit wallet for a family */
function findAppKitWallet(family: ChainFamily): ExternalWallet | undefined {
    return getAllWallets().find(w => w.id === appKitWalletId(family));
}

/** A family is tracked when the user asked for it now or connected it before. */
function isTracked(family: ChainFamily): boolean {
    return requestedFamilies.has(family) || readMarkers().families.includes(family) || !!findAppKitWallet(family);
}

/** Sanitize a wallet icon URL */
function sanitizeIcon(icon?: string): string | undefined {
    if (!icon) return undefined;
    if (icon.startsWith('https://') || icon.startsWith('data:image/')) return icon;
    return undefined;
}

/** Sanitize a wallet label */
function sanitizeLabel(label: string | undefined, fallback: string): string {
    if (!label) return fallback;
    // Strip HTML and limit length
    const clean = label.replace(/<[^>]*>/g, '').trim().slice(0, 64);
    return clean || fallback;
}

type AccountLike = { address?: string; isConnected?: boolean; status?: string } | null | undefined;
type WalletInfoLike = { name?: string; icon?: string } | null | undefined;

function readWalletInfo(appKit: any, namespace: AppKitNamespace): WalletInfoLike {
    try {
        return appKit.getWalletInfo?.(namespace) ?? null;
    } catch {
        return null;
    }
}

/**
 * Apply one namespace's account state to the registry.
 * Exported for tests; the app goes through the subscriptions.
 *
 * `polled`: the state was read, not pushed by AppKit. Right after `createAppKit` the
 * status is not set yet and the account looks empty, so a polled read only removes a
 * wallet on an explicit `disconnected`.
 */
export function handleAppKitAccount(
    namespace: AppKitNamespace,
    account: AccountLike,
    walletInfo: WalletInfoLike,
    opts?: { polled?: boolean },
) {
    const family = FAMILY_OF[namespace];
    const walletId = appKitWalletId(family);
    const existing = findAppKitWallet(family);
    const status = account?.status;

    // Still settling (page load, wallet approving): neither a connect nor a disconnect.
    if (status === 'connecting' || status === 'reconnecting') return;

    const connected = !!account?.address && (status === 'connected' || (status === undefined && !!account?.isConnected));

    if (!connected) {
        if (opts?.polled && status !== 'disconnected') return;
        if (existing) {
            removeWallet(walletId);
            if (getActiveWalletId(family) === walletId) setActiveWalletId(null, family);
        }
        // A family that never connected keeps its marker while the connect flow is open.
        if (!requestedFamilies.has(family)) removeMarker(family);
        return;
    }

    if (!existing && !isTracked(family)) return;

    const address = account!.address!;
    const label = sanitizeLabel(walletInfo?.name, FALLBACK_LABEL[family]);
    const icon = sanitizeIcon(walletInfo?.icon);

    if (existing) {
        if (existing.address !== address || existing.label !== label || existing.icon !== icon || existing.network !== bridgeNetwork) {
            updateWallet(walletId, { address, label, icon, network: bridgeNetwork });
        }
        addMarker(family);
        return;
    }

    try {
        addWallet({
            id: walletId,
            source: 'appkit',
            family,
            network: bridgeNetwork,
            label,
            icon,
            address,
            connectedAt: Date.now(),
        });
        setActiveWalletId(walletId, family);
        addMarker(family);
    } catch (e) {
        console.warn(`[AppKitBridge] Failed to add ${family} wallet:`, e);
    }
}

function syncAll(appKit: any) {
    for (const ns of NAMESPACES) {
        try {
            handleAppKitAccount(ns, appKit.getAccount?.(ns) ?? null, readWalletInfo(appKit, ns), { polled: true });
        } catch (e) {
            console.warn(`[AppKitBridge] Error reading ${ns} account:`, e);
        }
    }
}

/**
 * Follow the app's mode. AppKit wallets are one session across both modes, so their
 * registry rows move with the mode instead of disappearing from it.
 */
export function setAppKitNetwork(network: AppNetwork) {
    bridgeNetwork = network;
    for (const w of getAllWallets()) {
        if (w.source === 'appkit' && w.network !== network) updateWallet(w.id, { network });
    }
}

/**
 * Start the AppKit bridge. Subscribes to account changes and syncs with the registry.
 * Idempotent: a second call only updates the network.
 */
export async function startAppKitBridge(network: AppNetwork): Promise<void> {
    setAppKitNetwork(network);
    if (bridgeStarted) return;
    bridgeStarted = true;

    try {
        const appKit = await getAppKit();

        syncAll(appKit);
        // A session that ended while the app was closed may report `disconnected` before the
        // subscriptions below exist; read once more after reconnection has had time to settle.
        const resync = setTimeout(() => { if (bridgeStarted) syncAll(appKit); }, 10_000);
        unsubscribers.push(() => clearTimeout(resync));

        if (typeof appKit.subscribeAccount === 'function') {
            for (const ns of NAMESPACES) {
                const unsub = appKit.subscribeAccount((account: any) => {
                    try {
                        handleAppKitAccount(ns, account, readWalletInfo(appKit, ns));
                    } catch (e) {
                        console.warn(`[AppKitBridge] Error handling ${ns} account change:`, e);
                    }
                }, ns);
                if (typeof unsub === 'function') unsubscribers.push(unsub);
            }
        }

        // Name and icon can arrive after the account does.
        if (typeof appKit.subscribeWalletInfo === 'function') {
            for (const ns of NAMESPACES) {
                const unsub = appKit.subscribeWalletInfo(() => {
                    try {
                        handleAppKitAccount(ns, appKit.getAccount?.(ns) ?? null, readWalletInfo(appKit, ns), { polled: true });
                    } catch { /* ignore */ }
                }, ns);
                if (typeof unsub === 'function') unsubscribers.push(unsub);
            }
        }

        // When the modal closes, re-read accounts in case a connection happened.
        if (typeof appKit.subscribeState === 'function') {
            const unsub = appKit.subscribeState((state: any) => {
                if (state && state.open === false) syncAll(appKit);
            });
            if (typeof unsub === 'function') unsubscribers.push(unsub);
        }
    } catch (e) {
        bridgeStarted = false;
        throw e;
    }
}

/**
 * Open AppKit's connect modal for a specific namespace.
 * Resolves when the modal closes (not when it opens — `appKit.open()` resolves immediately).
 */
export async function openAppKitConnect(namespace: AppKitNamespace = 'eip155'): Promise<void> {
    const family = FAMILY_OF[namespace];
    const appKit = await getAppKit();
    requestedFamilies.add(family);

    try {
        await appKit.open({ view: 'Connect', namespace });

        await new Promise<void>((resolve) => {
            if (typeof appKit.subscribeState !== 'function') {
                setTimeout(resolve, 500);
                return;
            }
            const unsub = appKit.subscribeState((state: any) => {
                if (state && state.open === false) {
                    try { unsub?.(); } catch { /* ignore */ }
                    // Small delay to let account handlers settle
                    setTimeout(resolve, 300);
                }
            });
        });

        // The account may have settled while the modal closed.
        handleAppKitAccount(namespace, appKit.getAccount?.(namespace) ?? null, readWalletInfo(appKit, namespace), { polled: true });
    } finally {
        requestedFamilies.delete(family);
    }
}

/**
 * Disconnect AppKit for a specific namespace.
 */
export async function disconnectAppKit(namespace: AppKitNamespace = 'eip155'): Promise<void> {
    const family = FAMILY_OF[namespace];

    if (isAppKitLoaded()) {
        try {
            const appKit = await getAppKit();
            await appKit.disconnect?.({ namespace });
        } catch { /* ignore */ }
    }

    // Clean up registry, marker and active selection even when AppKit never loaded this session.
    const walletId = appKitWalletId(family);
    if (findWalletById(walletId)) removeWallet(walletId);
    removeMarker(family);
    if (getActiveWalletId(family) === walletId) setActiveWalletId(null, family);
}

/**
 * Switch AppKit to a specific chain ID for the current mode.
 * Returns true if the switch was successful.
 */
export async function switchAppKitNetwork(chainId: number): Promise<boolean> {
    const appKit = await getAppKit();

    try {
        // Find the network object for this chain ID from AppKit's registered networks
        const networks = appKit.getNetworks?.() ?? [];
        const target = networks.find?.((n: any) => n?.id === chainId);
        if (target) {
            await appKit.switchNetwork?.(target);
        } else {
            // Try by chain ID directly
            await appKit.switchNetwork?.({ id: chainId });
        }
        return true;
    } catch (e) {
        console.warn('[AppKitBridge] Failed to switch network to chain', chainId, e);
        return false;
    }
}

async function switchNamespaceMode(namespace: 'solana' | 'bip122', isMainnet: boolean): Promise<boolean> {
    const appKit = await getAppKit();
    try {
        const networks = appKit.getNetworks?.() ?? [];
        const target = networks.find?.((n: any) => n?.chainNamespace === namespace && (isMainnet ? !n?.testnet : !!n?.testnet));
        if (target) {
            await appKit.switchNetwork?.(target);
            return true;
        }
        return false;
    } catch (e) {
        console.warn(`[AppKitBridge] Failed to switch ${namespace} network:`, e);
        return false;
    }
}

/** Switch AppKit Solana to mainnet or devnet for the current mode. */
export function switchAppKitSolanaNetwork(isMainnet: boolean): Promise<boolean> {
    return switchNamespaceMode('solana', isMainnet);
}

/** Switch AppKit Bitcoin to mainnet or testnet for the current mode. */
export function switchAppKitBitcoinNetwork(isMainnet: boolean): Promise<boolean> {
    return switchNamespaceMode('bip122', isMainnet);
}

/**
 * Handle a mode switch (testnet ↔ mainnet).
 *
 * Every AppKit row moves to the new mode. Solana and Bitcoin are switched to the mode's
 * network (a Bitcoin address differs between mainnet and testnet). EVM is not: asking
 * the wallet to change chain on every mode toggle pops its approval prompt for nothing,
 * and the EVM sender switches to the exact chain it needs right before it sends.
 */
export async function handleModeSwitch(isMainnet: boolean, network: AppNetwork): Promise<void> {
    setAppKitNetwork(network);
    if (!isAppKitLoaded()) return;

    if (findAppKitWallet('solana')) await switchAppKitSolanaNetwork(isMainnet);
    if (findAppKitWallet('btc')) await switchAppKitBitcoinNetwork(isMainnet);

    try {
        syncAll(await getAppKit());
    } catch { /* ignore */ }
}

/**
 * Restore AppKit connections on page load, if markers exist.
 */
export async function restoreAppKitConnections(network: AppNetwork): Promise<void> {
    if (!hasAppKitMarker()) return;

    // Loading AppKit will cause it to auto-reconnect existing sessions
    await startAppKitBridge(network);
}

/**
 * The connected wallet's provider for a namespace, or null.
 *
 * There is deliberately no fallback to `window.ethereum`, `window.phantom` and the like:
 * that would sign with whatever extension is installed, which may be a different wallet
 * or account than the one Cham shows as connected.
 */
async function connectedProvider(namespace: AppKitNamespace): Promise<any | null> {
    if (!findAppKitWallet(FAMILY_OF[namespace])) return null;
    const appKit = await getAppKit();
    try {
        return appKit.getProvider?.(namespace) ?? null;
    } catch {
        return null;
    }
}

/** EIP-1193 provider of the connected EVM wallet, for signing. */
export function getAppKitEvmProvider(): Promise<any | null> {
    return connectedProvider('eip155');
}

/** Provider of the connected Solana wallet, for signing. */
export function getAppKitSolanaProvider(): Promise<any | null> {
    return connectedProvider('solana');
}

/** Provider of the connected Bitcoin wallet, for signing. */
export function getAppKitBitcoinProvider(): Promise<any | null> {
    return connectedProvider('bip122');
}

/**
 * Clean up bridge subscriptions.
 */
export function stopAppKitBridge(): void {
    for (const unsub of unsubscribers) {
        try { unsub(); } catch { /* ignore */ }
    }
    unsubscribers = [];
    bridgeStarted = false;
    requestedFamilies.clear();
}
