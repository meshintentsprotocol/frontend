/**
 * Reown AppKit lazy singleton for EVM (Phase 6), Solana (P7) and Bitcoin (P8).
 *
 * The entire AppKit + adapter bundle is large, so it is imported lazily:
 * - when the user opens the EVM/Solana/Bitcoin step of the connect screen, or
 * - when the registry has a persisted AppKit wallet to restore on page load.
 *
 * Phase 6: AppKit + EVM
 */

import { getWalletConnectProjectId } from './walletconnect';

// Keep a module-level singleton reference
let appKitInstance: any = null;
let appKitPromise: Promise<any> | null = null;

// Arc chain definitions (not in AppKit's built-in networks)
const ARC_MAINNET_DEF = {
    id: 5042,
    name: 'Arc',
    nativeCurrency: { name: 'ARC', symbol: 'ARC', decimals: 18 },
    rpcUrls: {
        default: { http: [import.meta.env.VITE_ARC_MAINNET_RPC || 'https://rpc.mainnet.arc.io'] },
    },
    blockExplorers: {
        default: { name: 'Arc Explorer', url: 'https://explorer.arc.io' },
    },
};

const ARC_TESTNET_DEF = {
    id: 5042002,
    name: 'Arc Testnet',
    nativeCurrency: { name: 'ARC', symbol: 'ARC', decimals: 18 },
    rpcUrls: {
        default: { http: [import.meta.env.VITE_ARC_TESTNET_RPC || 'https://rpc.testnet.arc.io'] },
    },
    blockExplorers: {
        default: { name: 'Arc Testnet Explorer', url: 'https://testnet.explorer.arc.io' },
    },
};

/**
 * Lazily load and create the AppKit instance.
 * Returns the same instance on subsequent calls.
 */
export async function getAppKit(): Promise<any> {
    if (appKitInstance) return appKitInstance;
    if (appKitPromise) return appKitPromise;

    appKitPromise = (async () => {
        try {
            const [
                { createAppKit },
                { EthersAdapter },
                { SolanaAdapter },
                { BitcoinAdapter },
                networks,
            ] = await Promise.all([
                import('@reown/appkit'),
                import('@reown/appkit-adapter-ethers'),
                import('@reown/appkit-adapter-solana'),
                import('@reown/appkit-adapter-bitcoin'),
                import('@reown/appkit/networks'),
            ]);

            const {
                mainnet, base, arbitrum, optimism, bsc,
                sepolia, baseSepolia, arbitrumSepolia, optimismSepolia, bscTestnet,
                solana, solanaDevnet,
                bitcoin, bitcoinTestnet,
                defineChain,
            } = networks;

            // Define Arc chains via defineChain
            const arc = defineChain(ARC_MAINNET_DEF);
            const arcTestnet = defineChain(ARC_TESTNET_DEF);

            const isLocalhost = typeof location !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
            const projectId = getWalletConnectProjectId();

            const instance = createAppKit({
                projectId,
                adapters: [new EthersAdapter(), new SolanaAdapter(), new BitcoinAdapter()],
                // Both modes' networks registered at creation; the app restricts usage to the current mode
                networks: [
                    // Mainnet
                    mainnet, base, arbitrum, optimism, bsc, arc, solana, bitcoin,
                    // Testnet
                    sepolia, baseSepolia, arbitrumSepolia, optimismSepolia, bscTestnet, arcTestnet, solanaDevnet, bitcoinTestnet,
                ],
                metadata: {
                    name: 'Cham',
                    description: 'Bitcoin Cash intents and cross-chain swaps',
                    url: isLocalhost ? 'https://intentsprotocol.xyz' : location.origin,
                    icons: [`${typeof location !== 'undefined' ? location.origin : ''}/assets/bchintentslogo_edited.png`],
                },
                themeMode: 'dark',
                themeVariables: {
                    '--w3m-accent': '#10b981',
                    '--w3m-z-index': 1000,
                },
                features: {
                    email: false,
                    socials: false,
                    swaps: false,
                    onramp: false,
                    send: false,
                    history: false,
                    analytics: false,
                },
            });

            appKitInstance = instance;
            return instance;
        } catch (e) {
            appKitPromise = null;
            throw e;
        }
    })();

    return appKitPromise;
}

/** Check if AppKit is already loaded (without triggering a load). */
export function isAppKitLoaded(): boolean {
    return appKitInstance !== null;
}

/** Get the AppKit instance if already loaded; null otherwise. */
export function getAppKitSync(): any | null {
    return appKitInstance;
}

// ── Chain ID mappings ──────────────────────────────────────────────────────

/** Map from our CCTP chain key to AppKit chain id */
export const APPKIT_CHAIN_IDS: Record<string, number> = {
    // Mainnet
    ethereum: 1,
    base: 8453,
    arbitrum: 42161,
    optimism: 10,
    bsc: 56,
    arc: 5042,
    // Testnet
    'eth-sepolia': 11155111,
    'base-sepolia': 84532,
    'arb-sepolia': 421614,
    'op-sepolia': 11155420,
    'bsc-testnet': 97,
    'arc-testnet': 5042002,
};

/** Map from chain id to AppKit network key (for switchNetwork) */
export const CHAIN_ID_TO_KEY: Record<number, string> = {};
for (const [key, id] of Object.entries(APPKIT_CHAIN_IDS)) {
    CHAIN_ID_TO_KEY[id] = key;
}

// Testnet chain IDs
export const TESTNET_CHAIN_IDS = new Set([11155111, 84532, 421614, 11155420, 97, 5042002]);
// Mainnet chain IDs
export const MAINNET_CHAIN_IDS = new Set([1, 8453, 42161, 10, 56, 5042]);

/** Default chain for a mode */
export function defaultChainId(isMainnet: boolean): number {
    return isMainnet ? 1 : 11155111; // Ethereum mainnet or Sepolia
}
