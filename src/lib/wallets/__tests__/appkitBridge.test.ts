import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    getAllWallets,
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

// Mock getAppKit
let mockEvmCallback: ((account: any) => void) | null = null;
let mockSolanaCallback: ((account: any) => void) | null = null;
let mockStateCallback: ((state: any) => void) | null = null;
let mockSwitchedNetworks: any[] = [];
let mockEvmAccount: any = null;
let mockSolanaAccount: any = null;
let mockWalletInfo: any = { name: 'MetaMask', icon: 'https://metamask.io/icon.png' };

const fakeAppKit = {
    getAccount: vi.fn((namespace: string) => (namespace === 'solana' ? mockSolanaAccount : mockEvmAccount)),
    getWalletInfo: vi.fn(() => mockWalletInfo),
    getNetworks: vi.fn(() => [
        { id: 1, name: 'Ethereum', chainNamespace: 'eip155', testnet: false },
        { id: 11155111, name: 'Sepolia', chainNamespace: 'eip155', testnet: true },
        { id: 'sol-main', name: 'Solana', chainNamespace: 'solana', testnet: false },
        { id: 'sol-dev', name: 'Solana Devnet', chainNamespace: 'solana', testnet: true },
    ]),
    subscribeAccount: vi.fn((cb: any, namespace: string) => {
        if (namespace === 'solana') {
            mockSolanaCallback = cb;
            return () => { mockSolanaCallback = null; };
        }
        mockEvmCallback = cb;
        return () => { mockEvmCallback = null; };
    }),
    subscribeState: vi.fn((cb: any) => {
        mockStateCallback = cb;
        return () => { mockStateCallback = null; };
    }),
    switchNetwork: vi.fn(async (net: any) => {
        mockSwitchedNetworks.push(net);
    }),
    disconnect: vi.fn(async ({ namespace }: any = {}) => {
        if (namespace === 'solana') {
            mockSolanaAccount = null;
            if (mockSolanaCallback) mockSolanaCallback(null);
        } else {
            mockEvmAccount = null;
            if (mockEvmCallback) mockEvmCallback(null);
        }
    }),
    open: vi.fn(async () => {}),
};

vi.mock('../appkit', () => ({
    getAppKit: vi.fn(async () => fakeAppKit),
    isAppKitLoaded: vi.fn(() => true),
    defaultChainId: vi.fn((isMainnet: boolean) => (isMainnet ? 1 : 11155111)),
}));

describe('AppKit bridge', () => {
    beforeEach(() => {
        stopAppKitBridge();
        mockStorage.clear();
        _resetRegistryForTest([]);
        setActiveWalletId(null, 'evm');
        setActiveWalletId(null, 'solana');
        mockEvmCallback = null;
        mockSolanaCallback = null;
        mockStateCallback = null;
        mockSwitchedNetworks = [];
        mockEvmAccount = null;
        mockSolanaAccount = null;
        mockWalletInfo = { name: 'MetaMask', icon: 'https://metamask.io/icon.png' };
        vi.clearAllMocks();
    });

    it('adds connected EVM wallet to registry and sets marker', async () => {
        mockEvmAccount = { address: '0x1234567890123456789012345678901234567890', isConnected: true };

        await startAppKitBridge('testnet');

        const wallet = findWalletById('appkit-evm');
        expect(wallet).toBeDefined();
        expect(wallet?.family).toBe('evm');
        expect(wallet?.source).toBe('appkit');
        expect(wallet?.address).toBe('0x1234567890123456789012345678901234567890');
        expect(wallet?.label).toBe('MetaMask');
        expect(getActiveWalletId('evm')).toBe('appkit-evm');
        expect(hasAppKitMarker()).toBe(true);
    });

    it('updates registry when EVM account changes', async () => {
        mockEvmAccount = { address: '0x1111111111111111111111111111111111111111', isConnected: true };
        await startAppKitBridge('testnet');

        expect(findWalletById('appkit-evm')?.address).toBe('0x1111111111111111111111111111111111111111');

        // Simulate account change event
        mockEvmAccount = { address: '0x2222222222222222222222222222222222222222', isConnected: true };
        mockEvmCallback!(mockEvmAccount);

        expect(findWalletById('appkit-evm')?.address).toBe('0x2222222222222222222222222222222222222222');
    });

    it('removes EVM wallet from registry and clears marker on disconnect', async () => {
        mockEvmAccount = { address: '0x1111111111111111111111111111111111111111', isConnected: true };
        await startAppKitBridge('testnet');
        expect(findWalletById('appkit-evm')).toBeDefined();

        await disconnectAppKit('eip155');

        expect(findWalletById('appkit-evm')).toBeUndefined();
        expect(getActiveWalletId('evm')).toBeNull();
        expect(hasAppKitMarker()).toBe(false);
    });

    it('adds connected Solana wallet to registry and sets marker', async () => {
        mockWalletInfo = { name: 'Phantom', icon: 'https://phantom.app/icon.png' };
        mockSolanaAccount = { address: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', isConnected: true };

        await startAppKitBridge('testnet');

        const wallet = findWalletById('appkit-solana');
        expect(wallet).toBeDefined();
        expect(wallet?.family).toBe('solana');
        expect(wallet?.source).toBe('appkit');
        expect(wallet?.address).toBe('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
        expect(wallet?.label).toBe('Phantom');
        expect(getActiveWalletId('solana')).toBe('appkit-solana');
        expect(hasAppKitMarker()).toBe(true);
    });

    it('removes Solana wallet from registry and clears marker on disconnect', async () => {
        mockSolanaAccount = { address: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', isConnected: true };
        await startAppKitBridge('testnet');
        expect(findWalletById('appkit-solana')).toBeDefined();

        await disconnectAppKit('solana');

        expect(findWalletById('appkit-solana')).toBeUndefined();
        expect(getActiveWalletId('solana')).toBeNull();
        expect(hasAppKitMarker()).toBe(false);
    });

    it('handles mode switch by requesting network switch for EVM and Solana', async () => {
        mockEvmAccount = { address: '0x1111111111111111111111111111111111111111', isConnected: true };
        mockSolanaAccount = { address: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', isConnected: true };
        await startAppKitBridge('testnet');

        await handleModeSwitch(true, 'mainnet');

        expect(fakeAppKit.switchNetwork).toHaveBeenCalledWith(
            expect.objectContaining({ id: 1 })
        );
        expect(fakeAppKit.switchNetwork).toHaveBeenCalledWith(
            expect.objectContaining({ chainNamespace: 'solana', testnet: false })
        );
    });
});
