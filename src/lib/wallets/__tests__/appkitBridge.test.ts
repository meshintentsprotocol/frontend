import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    findWalletById,
    _resetRegistryForTest,
} from '../registry';
import { getActiveWalletId, setActiveWalletId } from '@/lib/walletStore';
import {
    hasAppKitMarker,
    startAppKitBridge,
    disconnectAppKit,
    handleModeSwitch,
    stopAppKitBridge,
    openAppKitConnect,
    getAppKitEvmProvider,
    getAppKitSolanaProvider,
} from '../appkitBridge';

// Mock storage
class MemoryStorage {
    private store = new Map<string, string>();
    getItem(key: string) { return this.store.get(key) ?? null; }
    setItem(key: string, val: string) { this.store.set(key, String(val)); }
    removeItem(key: string) { this.store.delete(key); }
    clear() { this.store.clear(); }
}

const mockStorage = new MemoryStorage();
(globalThis as any).window = {
    localStorage: mockStorage,
    addEventListener: () => {},
    removeEventListener: () => {},
};
(globalThis as any).localStorage = mockStorage;

type Ns = 'eip155' | 'solana' | 'bip122';

// Per-namespace AppKit state, as AppKit keeps it.
let accounts: Record<Ns, any>;
let walletInfo: Record<Ns, any>;
let accountCallbacks: Record<Ns, ((account: any) => void) | null>;
let stateCallbacks: Set<(state: any) => void>;
const providers: Record<Ns, any> = { eip155: { kind: 'evm-provider' }, solana: { kind: 'sol-provider' }, bip122: { kind: 'btc-provider' } };

/** AppKit pushing an account change for one namespace. */
function push(ns: Ns, account: any) {
    accounts[ns] = account;
    accountCallbacks[ns]?.(account);
}

function closeModal() {
    for (const cb of [...stateCallbacks]) cb({ open: false });
}

const fakeAppKit = {
    getAccount: vi.fn((ns: Ns) => accounts[ns]),
    getWalletInfo: vi.fn((ns: Ns) => walletInfo[ns]),
    getProvider: vi.fn((ns: Ns) => providers[ns]),
    getNetworks: vi.fn(() => [
        { id: 1, name: 'Ethereum', chainNamespace: 'eip155', testnet: false },
        { id: 11155111, name: 'Sepolia', chainNamespace: 'eip155', testnet: true },
        { id: 'sol-main', name: 'Solana', chainNamespace: 'solana', testnet: false },
        { id: 'sol-dev', name: 'Solana Devnet', chainNamespace: 'solana', testnet: true },
        { id: 'btc-main', name: 'Bitcoin', chainNamespace: 'bip122', testnet: false },
        { id: 'btc-test', name: 'Bitcoin Testnet', chainNamespace: 'bip122', testnet: true },
    ]),
    subscribeAccount: vi.fn((cb: any, ns: Ns) => {
        accountCallbacks[ns] = cb;
        return () => { accountCallbacks[ns] = null; };
    }),
    subscribeState: vi.fn((cb: any) => {
        stateCallbacks.add(cb);
        return () => { stateCallbacks.delete(cb); };
    }),
    switchNetwork: vi.fn(async () => {}),
    disconnect: vi.fn(async ({ namespace }: { namespace: Ns }) => {
        push(namespace, { address: undefined, isConnected: false, status: 'disconnected' });
    }),
    open: vi.fn(async () => {}),
};

vi.mock('../appkit', () => ({
    getAppKit: vi.fn(async () => fakeAppKit),
    isAppKitLoaded: vi.fn(() => true),
    defaultChainId: vi.fn((isMainnet: boolean) => (isMainnet ? 1 : 11155111)),
}));

const EVM_A = '0x1111111111111111111111111111111111111111';
const EVM_B = '0x2222222222222222222222222222222222222222';
const SOL = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const BTC = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';

const connected = (address: string) => ({ address, isConnected: true, status: 'connected' });
const setMarkers = (...families: string[]) => mockStorage.setItem('appkit_connected_v1', JSON.stringify({ families }));

/** The user picks a chain, approves in the wallet, and the modal closes. */
async function connectThroughModal(ns: Ns, account: any) {
    const done = openAppKitConnect(ns);
    await Promise.resolve();
    await Promise.resolve();
    push(ns, account);
    closeModal();
    await vi.advanceTimersByTimeAsync(400);
    await done;
}

describe('AppKit bridge', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        stopAppKitBridge();
        mockStorage.clear();
        _resetRegistryForTest([]);
        setActiveWalletId(null, 'evm');
        setActiveWalletId(null, 'solana');
        setActiveWalletId(null, 'btc');
        accounts = { eip155: null, solana: null, bip122: null };
        walletInfo = {
            eip155: { name: 'MetaMask', icon: 'https://metamask.io/icon.png' },
            solana: { name: 'Phantom', icon: 'https://phantom.app/icon.png' },
            bip122: { name: 'Xverse', icon: 'data:image/svg+xml;base64,AAAA' },
        };
        accountCallbacks = { eip155: null, solana: null, bip122: null };
        stateCallbacks = new Set();
        vi.clearAllMocks();
    });

    it('connecting through the modal adds the wallet, makes it active and sets the marker', async () => {
        await startAppKitBridge('testnet');
        await connectThroughModal('eip155', connected(EVM_A));

        const wallet = findWalletById('appkit-evm');
        expect(wallet?.family).toBe('evm');
        expect(wallet?.source).toBe('appkit');
        expect(wallet?.address).toBe(EVM_A);
        expect(wallet?.label).toBe('MetaMask');
        expect(wallet?.icon).toBe('https://metamask.io/icon.png');
        expect(wallet?.network).toBe('testnet');
        expect(getActiveWalletId('evm')).toBe('appkit-evm');
        expect(hasAppKitMarker()).toBe(true);
    });

    it('restores a marked wallet on start', async () => {
        setMarkers('evm');
        accounts.eip155 = connected(EVM_A);
        await startAppKitBridge('testnet');
        expect(findWalletById('appkit-evm')?.address).toBe(EVM_A);
    });

    it('updates the registry when the account changes', async () => {
        setMarkers('evm');
        accounts.eip155 = connected(EVM_A);
        await startAppKitBridge('testnet');

        push('eip155', connected(EVM_B));
        expect(findWalletById('appkit-evm')?.address).toBe(EVM_B);
    });

    it('keeps the wallet and marker while AppKit is reconnecting on a page load', async () => {
        setMarkers('evm');
        _resetRegistryForTest([{ id: 'appkit-evm', source: 'appkit', family: 'evm', network: 'testnet', label: 'MetaMask', address: EVM_A, connectedAt: 1 }]);
        // Right after createAppKit nothing is set yet, then every namespace says `connecting`.
        accounts.eip155 = { address: undefined, isConnected: false, status: undefined };
        await startAppKitBridge('testnet');
        push('eip155', { address: undefined, isConnected: false, status: 'connecting' });
        push('eip155', { address: undefined, isConnected: false, status: 'reconnecting' });

        expect(findWalletById('appkit-evm')).toBeDefined();
        expect(hasAppKitMarker()).toBe(true);

        push('eip155', connected(EVM_A));
        expect(findWalletById('appkit-evm')?.address).toBe(EVM_A);
    });

    it('removes the wallet and marker when AppKit reports it disconnected', async () => {
        setMarkers('evm');
        accounts.eip155 = connected(EVM_A);
        await startAppKitBridge('testnet');
        setActiveWalletId('appkit-evm', 'evm');

        push('eip155', { address: undefined, isConnected: false, status: 'disconnected' });

        expect(findWalletById('appkit-evm')).toBeUndefined();
        expect(getActiveWalletId('evm')).toBeNull();
        expect(hasAppKitMarker()).toBe(false);
    });

    it('a session that died while the app was closed is cleaned up by the delayed re-read', async () => {
        setMarkers('evm');
        _resetRegistryForTest([{ id: 'appkit-evm', source: 'appkit', family: 'evm', network: 'testnet', label: 'MetaMask', address: EVM_A, connectedAt: 1 }]);
        accounts.eip155 = { address: undefined, isConnected: false, status: undefined };
        await startAppKitBridge('testnet');
        expect(findWalletById('appkit-evm')).toBeDefined();

        // AppKit settled to `disconnected` before our subscription existed: no push arrives.
        accounts.eip155 = { address: undefined, isConnected: false, status: 'disconnected' };
        await vi.advanceTimersByTimeAsync(10_000);

        expect(findWalletById('appkit-evm')).toBeUndefined();
        expect(hasAppKitMarker()).toBe(false);
    });

    it('names each wallet after the wallet of its own namespace', async () => {
        setMarkers('evm', 'solana');
        accounts.eip155 = connected(EVM_A);
        accounts.solana = connected(SOL);
        await startAppKitBridge('testnet');

        expect(findWalletById('appkit-evm')?.label).toBe('MetaMask');
        expect(findWalletById('appkit-solana')?.label).toBe('Phantom');
        expect(findWalletById('appkit-solana')?.icon).toBe('https://phantom.app/icon.png');
    });

    it('does not add wallets for namespaces the user did not ask for', async () => {
        await startAppKitBridge('testnet');
        // A multi-chain wallet approves EVM and Bitcoin while the user connects Solana.
        const done = openAppKitConnect('solana');
        await Promise.resolve();
        await Promise.resolve();
        push('solana', connected(SOL));
        push('eip155', connected(EVM_A));
        push('bip122', connected(BTC));
        closeModal();
        await vi.advanceTimersByTimeAsync(400);
        await done;

        expect(findWalletById('appkit-solana')).toBeDefined();
        expect(findWalletById('appkit-evm')).toBeUndefined();
        expect(findWalletById('appkit-btc')).toBeUndefined();
    });

    it('adds a Bitcoin wallet under bip122 with its own name', async () => {
        await startAppKitBridge('testnet');
        await connectThroughModal('bip122', connected(BTC));

        const wallet = findWalletById('appkit-btc');
        expect(wallet?.family).toBe('btc');
        expect(wallet?.address).toBe(BTC);
        expect(wallet?.label).toBe('Xverse');
        expect(getActiveWalletId('btc')).toBe('appkit-btc');
    });

    it('disconnect removes the wallet, its marker and the active selection', async () => {
        setMarkers('evm', 'solana');
        accounts.eip155 = connected(EVM_A);
        accounts.solana = connected(SOL);
        await startAppKitBridge('testnet');
        setActiveWalletId('appkit-solana', 'solana');

        await disconnectAppKit('solana');

        expect(findWalletById('appkit-solana')).toBeUndefined();
        expect(getActiveWalletId('solana')).toBeNull();
        expect(findWalletById('appkit-evm')).toBeDefined();
        expect(hasAppKitMarker()).toBe(true);

        await disconnectAppKit('eip155');
        expect(hasAppKitMarker()).toBe(false);
    });

    it('a mode switch moves AppKit wallets to the new mode and switches Solana, not EVM', async () => {
        setMarkers('evm', 'solana');
        accounts.eip155 = connected(EVM_A);
        accounts.solana = connected(SOL);
        await startAppKitBridge('testnet');

        await handleModeSwitch(true, 'mainnet');

        expect(findWalletById('appkit-evm')?.network).toBe('mainnet');
        expect(findWalletById('appkit-solana')?.network).toBe('mainnet');
        expect(fakeAppKit.switchNetwork).toHaveBeenCalledWith(expect.objectContaining({ chainNamespace: 'solana', testnet: false }));
        expect(fakeAppKit.switchNetwork).not.toHaveBeenCalledWith(expect.objectContaining({ chainNamespace: 'eip155' }));

        // Pushes after the switch use the new mode, not the one the subscription was created in.
        push('eip155', connected(EVM_B));
        expect(findWalletById('appkit-evm')?.network).toBe('mainnet');
    });

    it('signing providers come only from the connected AppKit wallet, never from injected globals', async () => {
        (globalThis as any).window.ethereum = { injected: true };
        (globalThis as any).window.phantom = { solana: { injected: true } };
        try {
            await startAppKitBridge('testnet');
            expect(await getAppKitEvmProvider()).toBeNull();
            expect(await getAppKitSolanaProvider()).toBeNull();

            await connectThroughModal('eip155', connected(EVM_A));
            expect(await getAppKitEvmProvider()).toBe(providers.eip155);
            expect(await getAppKitSolanaProvider()).toBeNull();
        } finally {
            delete (globalThis as any).window.ethereum;
            delete (globalThis as any).window.phantom;
        }
    });
});
