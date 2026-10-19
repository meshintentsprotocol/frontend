/**
 * AppKit ↔ Registry bridge.
 *
 * Subscribes to AppKit's account/wallet-info/state changes for the `eip155` namespace.
 * On connect → adds a wallet to the registry. On disconnect or account change → updates or removes.
 * Persists a marker so AppKit is loaded on the next page load for reconnection.
 *
 * Phase 6: AppKit + EVM
 */

import {
    addWallet,
    removeWallet,
    updateWallet,
    getAllWallets,
    findWalletById,
} from './registry';
import { setActiveWalletId } from '@/lib/walletStore';
import type { ExternalWallet, ChainFamily, AppNetwork } from './types';
import { getAppKit, isAppKitLoaded, defaultChainId } from './appkit';

const MARKER_KEY = 'appkit_connected_v1';

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

// ── Subscription management ────────────────────────────────────────────────

let unsubscribers: (() => void)[] = [];
let bridgeStarted = false;

/** Derive the wallet ID for an AppKit connection */
function appKitWalletId(family: ChainFamily): string {
    return `appkit-${family}`;
}

/** Find existing AppKit wallet for a family */
function findAppKitWallet(family: ChainFamily): ExternalWallet | undefined {
    return getAllWallets().find(w => w.id === appKitWalletId(family));
}

/** Sanitize a wallet icon URL */
function sanitizeIcon(icon?: string): string | undefined {
    if (!icon) return undefined;
    if (icon.startsWith('https://') || icon.startsWith('data:image/')) return icon;
    return undefined;
}

/** Sanitize a wallet label */
function sanitizeLabel(label?: string): string {
    if (!label) return 'External Wallet';
    // Strip HTML and limit length
    const clean = label.replace(/<[^>]*>/g, '').trim().slice(0, 64);
    return clean || 'External Wallet';
}

/**
 * Handle an EVM account change from AppKit.
 */
function handleEvmAccount(
    account: { address?: string; isConnected?: boolean } | null | undefined,
    walletInfo: { name?: string; icon?: string } | null | undefined,
    network: AppNetwork,
) {
    const family: ChainFamily = 'evm';
    const walletId = appKitWalletId(family);
    const existing = findAppKitWallet(family);

    if (!account?.address || !account.isConnected) {
        // Disconnected
        if (existing) {
            removeWallet(walletId);
            removeMarker(family);
            // If this was the active wallet, clear it
            setActiveWalletId(null, family);
        }
        return;
    }

    const address = account.address;
    const label = sanitizeLabel(walletInfo?.name);
    const icon = sanitizeIcon(walletInfo?.icon);

    if (existing) {
        // Update existing wallet
        if (existing.address !== address || existing.label !== label || existing.icon !== icon) {
            updateWallet(walletId, {
                address,
                label,
                icon,
                network,
            });
        }
    } else {
        // Add new wallet
        try {
            addWallet({
                id: walletId,
                source: 'appkit',
                family,
                network,
                label,
                icon,
                address,
                connectedAt: Date.now(),
            });
            setActiveWalletId(walletId, family);
            addMarker(family);
        } catch (e) {
            console.warn('[AppKitBridge] Failed to add wallet:', e);
        }
    }
}

/**
 * Handle a Solana account change from AppKit.
 */
function handleSolanaAccount(
    account: { address?: string; isConnected?: boolean } | null | undefined,
    walletInfo: { name?: string; icon?: string } | null | undefined,
    network: AppNetwork,
) {
    const family: ChainFamily = 'solana';
    const walletId = appKitWalletId(family);
    const existing = findAppKitWallet(family);

    if (!account?.address || !account.isConnected) {
        // Disconnected
        if (existing) {
            removeWallet(walletId);
            removeMarker(family);
            setActiveWalletId(null, family);
        }
        return;
    }

    const address = account.address;
    const label = sanitizeLabel(walletInfo?.name || 'Solana Wallet');
    const icon = sanitizeIcon(walletInfo?.icon);

    if (existing) {
        // Update existing wallet
        if (existing.address !== address || existing.label !== label || existing.icon !== icon) {
            updateWallet(walletId, {
                address,
                label,
                icon,
                network,
            });
        }
    } else {
        // Add new wallet
        try {
            addWallet({
                id: walletId,
                source: 'appkit',
                family,
                network,
                label,
                icon,
                address,
                connectedAt: Date.now(),
            });
            setActiveWalletId(walletId, family);
            addMarker(family);
        } catch (e) {
            console.warn('[AppKitBridge] Failed to add Solana wallet:', e);
        }
    }
}

/**
 * Start the AppKit bridge. Subscribes to account changes and syncs with the registry.
 * Idempotent: calling twice has no effect.
 */
export async function startAppKitBridge(network: AppNetwork): Promise<void> {
    if (bridgeStarted) return;
    bridgeStarted = true;

    try {
        const appKit = await getAppKit();

        // Get initial state
        try {
            const evmAccount = appKit.getAccount?.('eip155') ?? null;
            const solAccount = appKit.getAccount?.('solana') ?? null;
            const walletInfo = appKit.getWalletInfo?.() ?? null;
            handleEvmAccount(evmAccount, walletInfo, network);
            handleSolanaAccount(solAccount, walletInfo, network);
        } catch { /* initial read may fail */ }

        // Subscribe to EVM account changes
        if (typeof appKit.subscribeAccount === 'function') {
            const unsub = appKit.subscribeAccount((account: any) => {
                try {
                    const walletInfo = appKit.getWalletInfo?.() ?? null;
                    handleEvmAccount(account, walletInfo, network);
                } catch (e) {
                    console.warn('[AppKitBridge] Error handling account change:', e);
                }
            }, 'eip155');
            if (typeof unsub === 'function') unsubscribers.push(unsub);
        }

        // Subscribe to Solana account changes
        if (typeof appKit.subscribeAccount === 'function') {
            const unsub = appKit.subscribeAccount((account: any) => {
                try {
                    const walletInfo = appKit.getWalletInfo?.() ?? null;
                    handleSolanaAccount(account, walletInfo, network);
                } catch (e) {
                    console.warn('[AppKitBridge] Error handling Solana account change:', e);
                }
            }, 'solana');
            if (typeof unsub === 'function') unsubscribers.push(unsub);
        }

        // Subscribe to state changes (modal open/close)
        if (typeof appKit.subscribeState === 'function') {
            const unsub = appKit.subscribeState((state: any) => {
                // When the modal closes, re-read accounts in case connection happened
                if (state && state.open === false) {
                    try {
                        const evmAccount = appKit.getAccount?.('eip155') ?? null;
                        const solAccount = appKit.getAccount?.('solana') ?? null;
                        const walletInfo = appKit.getWalletInfo?.() ?? null;
                        handleEvmAccount(evmAccount, walletInfo, network);
                        handleSolanaAccount(solAccount, walletInfo, network);
                    } catch { /* ignore */ }
                }
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
 * Returns a promise that resolves when the modal closes.
 */
export async function openAppKitConnect(namespace: 'eip155' | 'solana' | 'bip122' = 'eip155'): Promise<void> {
    const appKit = await getAppKit();
    await appKit.open({ view: 'Connect', namespace });
}

/**
 * Disconnect AppKit for a specific namespace.
 */
export async function disconnectAppKit(namespace: 'eip155' | 'solana' | 'bip122' = 'eip155'): Promise<void> {
    if (!isAppKitLoaded()) return;
    const appKit = await getAppKit();

    const familyMap: Record<string, ChainFamily> = {
        eip155: 'evm',
        solana: 'solana',
        bip122: 'btc',
    };
    const family = familyMap[namespace];

    try {
        await appKit.disconnect?.({ namespace });
    } catch { /* ignore */ }

    // Clean up registry
    const walletId = appKitWalletId(family);
    const existing = findWalletById(walletId);
    if (existing) {
        removeWallet(walletId);
    }
    removeMarker(family);
    setActiveWalletId(null, family);
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

/**
 * Switch AppKit Solana to mainnet or devnet for the current mode.
 */
export async function switchAppKitSolanaNetwork(isMainnet: boolean): Promise<boolean> {
    const appKit = await getAppKit();
    try {
        const networks = appKit.getNetworks?.() ?? [];
        const target = networks.find?.((n: any) => n?.chainNamespace === 'solana' && (isMainnet ? !n?.testnet : !!n?.testnet));
        if (target) {
            await appKit.switchNetwork?.(target);
            return true;
        }
        return false;
    } catch (e) {
        console.warn('[AppKitBridge] Failed to switch Solana network:', e);
        return false;
    }
}

/**
 * Handle a mode switch (testnet ↔ mainnet).
 * Switch each connected namespace to the mode's default chain.
 */
export async function handleModeSwitch(isMainnet: boolean, network: AppNetwork): Promise<void> {
    if (!isAppKitLoaded()) return;

    const chainId = defaultChainId(isMainnet);

    // Switch EVM to the default chain for the new mode
    const evmWallet = findAppKitWallet('evm');
    if (evmWallet) {
        await switchAppKitNetwork(chainId);
        // Re-read account after switch
        try {
            const appKit = await getAppKit();
            const evmAccount = appKit.getAccount?.('eip155') ?? null;
            const walletInfo = appKit.getWalletInfo?.() ?? null;
            handleEvmAccount(evmAccount, walletInfo, network);
        } catch { /* ignore */ }
    }

    // Switch Solana to the mode's network
    const solWallet = findAppKitWallet('solana');
    if (solWallet) {
        await switchAppKitSolanaNetwork(isMainnet);
        try {
            const appKit = await getAppKit();
            const solAccount = appKit.getAccount?.('solana') ?? null;
            const walletInfo = appKit.getWalletInfo?.() ?? null;
            handleSolanaAccount(solAccount, walletInfo, network);
        } catch { /* ignore */ }
    }
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
 * Get the AppKit EVM provider (EIP-1193) for signing transactions.
 * Returns null if AppKit is not connected for EVM.
 */
export async function getAppKitEvmProvider(): Promise<any | null> {
    const appKit = await getAppKit();
    try {
        const p = appKit.getProvider?.('eip155') ?? appKit.getWalletProvider?.() ?? null;
        if (p) return p;
        if (typeof window !== 'undefined' && (window as any).ethereum) {
            return (window as any).ethereum;
        }
        return null;
    } catch {
        return (typeof window !== 'undefined' && (window as any).ethereum) ? (window as any).ethereum : null;
    }
}

/**
 * Get the AppKit Solana provider for signing transactions.
 * Returns null if AppKit is not connected for Solana.
 */
export async function getAppKitSolanaProvider(): Promise<any | null> {
    const appKit = await getAppKit();
    try {
        const p = appKit.getProvider?.('solana') ?? null;
        if (p) return p;
        if (typeof window !== 'undefined') {
            if ((window as any).phantom?.solana) return (window as any).phantom.solana;
            if ((window as any).solflare) return (window as any).solflare;
            if ((window as any).backpack?.solana) return (window as any).backpack.solana;
            if ((window as any).solana) return (window as any).solana;
        }
        return null;
    } catch {
        if (typeof window !== 'undefined') {
            if ((window as any).phantom?.solana) return (window as any).phantom.solana;
            if ((window as any).solflare) return (window as any).solflare;
            if ((window as any).backpack?.solana) return (window as any).backpack.solana;
            if ((window as any).solana) return (window as any).solana;
        }
        return null;
    }
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
}
