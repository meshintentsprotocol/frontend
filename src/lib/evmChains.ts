import { ethers } from 'ethers';

export interface EVMChainConfig {
    chainId: number;
    name: string;
    rpc: string;
    explorer: string;
    nativeCurrency: string;
    friVerifierHTLC: string;  // '' = not deployed — blocks swap initiation
    usdtAddress: string;
    usdcAddress: string;
    deployed: boolean;
}

export const EVM_CHAINS_TESTNET: Record<string, EVMChainConfig> = {
    ethereum: {
        chainId:         11155111,
        name:            'Ethereum Sepolia',
        rpc:             'https://ethereum-sepolia-rpc.publicnode.com',
        explorer:        'https://sepolia.etherscan.io',
        nativeCurrency:  'ETH',
        friVerifierHTLC: import.meta.env.VITE_ETH_FRI_VERIFIER_HTLC || '0x5e56f4c55113Ff7950768A19Ac884838EadEE086',
        usdtAddress:     '0xd077a400968890eacc75cdc901f0356c943e4fdb',
        usdcAddress:     '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
        deployed:        true,
    },
    bsc: {
        chainId:         97,
        name:            'BSC Testnet',
        rpc:             'https://data-seed-prebsc-1-s1.binance.org:8545/',
        explorer:        'https://testnet.bscscan.com',
        nativeCurrency:  'BNB',
        friVerifierHTLC: import.meta.env.VITE_BSC_FRI_VERIFIER_HTLC || '',
        usdtAddress:     '',
        usdcAddress:     '',
        deployed:        false,
    },
    base: {
        chainId:         84532,
        name:            'Base Sepolia',
        rpc:             'https://base-sepolia-rpc.publicnode.com',
        explorer:        'https://sepolia.basescan.org',
        nativeCurrency:  'ETH',
        friVerifierHTLC: import.meta.env.VITE_BASE_FRI_VERIFIER_HTLC || '',
        usdtAddress:     '',
        usdcAddress:     '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        deployed:        false,
    },
    arbitrum: {
        chainId:         421614,
        name:            'Arbitrum Sepolia',
        rpc:             'https://arbitrum-sepolia-rpc.publicnode.com',
        explorer:        'https://sepolia.arbiscan.io',
        nativeCurrency:  'ETH',
        friVerifierHTLC: import.meta.env.VITE_ARB_FRI_VERIFIER_HTLC || '',
        usdtAddress:     '',
        usdcAddress:     '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
        deployed:        false,
    },
    optimism: {
        chainId:         11155420,
        name:            'Optimism Sepolia',
        rpc:             'https://optimism-sepolia-rpc.publicnode.com',
        explorer:        'https://sepolia-optimism.etherscan.io',
        nativeCurrency:  'ETH',
        friVerifierHTLC: import.meta.env.VITE_OP_FRI_VERIFIER_HTLC || '',
        usdtAddress:     '',
        usdcAddress:     '0x5fd84259d66Cd46123540766Be93DFE6D43130D7',
        deployed:        false,
    },
    arc: {
        chainId:         5042002,
        name:            'Arc Testnet',
        rpc:             import.meta.env.VITE_ARC_TESTNET_RPC || 'https://rpc.testnet.arc.io',
        explorer:        'https://explorer.testnet.arc.io',
        nativeCurrency:  'USDC',
        friVerifierHTLC: '',
        usdtAddress:     '',
        usdcAddress:     '0x3600000000000000000000000000000000000000',
        deployed:        true,
    },
};

export const EVM_CHAINS_MAINNET: Record<string, EVMChainConfig> = {
    ethereum: {
        chainId:         1,
        name:            'Ethereum',
        rpc:             import.meta.env.VITE_ETH_MAINNET_RPC || 'https://ethereum-rpc.publicnode.com',
        explorer:        'https://etherscan.io',
        nativeCurrency:  'ETH',
        friVerifierHTLC: import.meta.env.VITE_ETH_MAINNET_FRI_VERIFIER_HTLC || '',
        usdtAddress:     '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        usdcAddress:     '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        deployed:        false,
    },
    bsc: {
        chainId:         56,
        name:            'BNB Chain',
        rpc:             import.meta.env.VITE_BSC_MAINNET_RPC || 'https://bsc-dataseed1.binance.org/',
        explorer:        'https://bscscan.com',
        nativeCurrency:  'BNB',
        friVerifierHTLC: import.meta.env.VITE_BSC_MAINNET_FRI_VERIFIER_HTLC || '',
        usdtAddress:     '0x55d398326f99059fF775485246999027B3197955',
        usdcAddress:     '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
        deployed:        false,
    },
    base: {
        chainId:         8453,
        name:            'Base',
        rpc:             import.meta.env.VITE_BASE_MAINNET_RPC || 'https://base-rpc.publicnode.com',
        explorer:        'https://basescan.org',
        nativeCurrency:  'ETH',
        friVerifierHTLC: import.meta.env.VITE_BASE_MAINNET_FRI_VERIFIER_HTLC || '',
        usdtAddress:     '',
        usdcAddress:     '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        deployed:        false,
    },
    arbitrum: {
        chainId:         42161,
        name:            'Arbitrum One',
        rpc:             import.meta.env.VITE_ARB_MAINNET_RPC || 'https://arbitrum-one-rpc.publicnode.com',
        explorer:        'https://arbiscan.io',
        nativeCurrency:  'ETH',
        friVerifierHTLC: import.meta.env.VITE_ARB_MAINNET_FRI_VERIFIER_HTLC || '',
        usdtAddress:     '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
        usdcAddress:     '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        deployed:        false,
    },
    optimism: {
        chainId:         10,
        name:            'Optimism',
        rpc:             import.meta.env.VITE_OP_MAINNET_RPC || 'https://optimism-rpc.publicnode.com',
        explorer:        'https://optimistic.etherscan.io',
        nativeCurrency:  'ETH',
        friVerifierHTLC: import.meta.env.VITE_OP_MAINNET_FRI_VERIFIER_HTLC || '',
        usdtAddress:     '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
        usdcAddress:     '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
        deployed:        false,
    },
    arc: {
        chainId:         5042,
        name:            'Arc',
        rpc:             import.meta.env.VITE_ARC_MAINNET_RPC || 'https://rpc.mainnet.arc.io',
        explorer:        'https://explorer.arc.io',
        nativeCurrency:  'USDC',
        friVerifierHTLC: '',
        usdtAddress:     '',
        usdcAddress:     '0x3600000000000000000000000000000000000000',
        deployed:        true,
    },
};

export function getEVMChainConfig(chain: string, isMainnet: boolean): EVMChainConfig | undefined {
    return (isMainnet ? EVM_CHAINS_MAINNET : EVM_CHAINS_TESTNET)[chain];
}

// ABI for FRIVerifierHTLC — covers escrow creation and user-initiated refund
export const FRI_VERIFIER_ABI = [
    'function lockWithFRI(bytes32 bchTxSigHash, uint256 timelock, address tokenAddress, uint256 tokenAmount) external payable returns (uint256)',
    'function refund(uint256 escrowId) external',
    'event FRIEscrowCreated(uint256 indexed escrowId, address indexed sender, address indexed solver, uint256 amount, address tokenAddress, uint256 timelock, uint256 createdAt)',
];

export const ERC20_APPROVE_ABI = [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)',
];

// Canonical chain name → bsc-bch-server chainName param
export const CHAIN_TO_SERVER_NAME: Record<string, string> = {
    ethereum: 'Sepolia',
    bsc:      'BSCTestnet',
    base:     'BaseSepolia',
    arbitrum: 'ArbitrumSepolia',
    optimism: 'OptimismSepolia',
};

export const CHAIN_TO_SERVER_NAME_MAINNET: Record<string, string> = {
    ethereum: 'Ethereum',
    bsc:      'BSCMainnet',
    base:     'BaseMainnet',
    arbitrum: 'ArbitrumOne',
    optimism: 'OptimismMainnet',
};

// Arc chains — not in the legacy EVM_CHAINS tables (CCTP-only), but needed for AppKit and cross-chain transfers
export const ARC_TESTNET: EVMChainConfig = {
    chainId:         5042002,
    name:            'Arc Testnet',
    rpc:             import.meta.env.VITE_ARC_TESTNET_RPC || 'https://rpc.testnet.arc.io',
    explorer:        'https://testnet.explorer.arc.io',
    nativeCurrency:  'ARC',
    friVerifierHTLC: '',
    usdtAddress:     '',
    usdcAddress:     '',
    deployed:        false,
};

export const ARC_MAINNET: EVMChainConfig = {
    chainId:         5042,
    name:            'Arc',
    rpc:             import.meta.env.VITE_ARC_MAINNET_RPC || 'https://rpc.mainnet.arc.io',
    explorer:        'https://explorer.arc.io',
    nativeCurrency:  'ARC',
    friVerifierHTLC: '',
    usdtAddress:     '',
    usdcAddress:     '',
    deployed:        false,
};

// Set of all EVM chain keys — used for routing detection
export const EVM_CHAIN_KEYS = new Set(['ethereum', 'bsc', 'base', 'arbitrum', 'optimism', 'arc']);

export function isEvmChain(chain?: string): chain is 'ethereum' | 'bsc' | 'base' | 'arbitrum' | 'optimism' | 'arc' {
    return !!chain && EVM_CHAIN_KEYS.has(chain);
}

/** All EVM chain configs for the given mode, including Arc. */
export function evmChainsFor(isMainnet: boolean): Record<string, EVMChainConfig> {
    const base = isMainnet ? { ...EVM_CHAINS_MAINNET } : { ...EVM_CHAINS_TESTNET };
    base.arc = isMainnet ? ARC_MAINNET : ARC_TESTNET;
    return base;
}

/** Map chain ID → chain key, across both modes */
export const CHAIN_ID_TO_KEY_MAP: Record<number, string> = {};
for (const [key, cfg] of Object.entries({ ...EVM_CHAINS_TESTNET, ...EVM_CHAINS_MAINNET })) {
    CHAIN_ID_TO_KEY_MAP[cfg.chainId] = key;
}
CHAIN_ID_TO_KEY_MAP[ARC_TESTNET.chainId] = 'arc';
CHAIN_ID_TO_KEY_MAP[ARC_MAINNET.chainId] = 'arc';

/** Look up a chain config by its chain ID */
export function getEVMChainByChainId(chainId: number, isMainnet: boolean): EVMChainConfig | undefined {
    const chains = evmChainsFor(isMainnet);
    return Object.values(chains).find(c => c.chainId === chainId);
}

// Returns the human-readable network label shown on the swap card
export function evmNetworkLabel(chain: string, isMainnet: boolean): string {
    const cfg = getEVMChainConfig(chain, isMainnet);
    return cfg?.name ?? chain;
}

// Derives a connected ethers Signer for a given EVM chain
export async function getEvmSignerForChain(
    seedPhraseOrSigner: any,
    chain: string,
    isMainnet: boolean,
): Promise<ethers.HDNodeWallet> {
    const cfg = getEVMChainConfig(chain, isMainnet);
    if (!cfg) throw new Error(`Unknown EVM chain: ${chain}`);
    const provider = new ethers.JsonRpcProvider(cfg.rpc, cfg.chainId);
    if (typeof seedPhraseOrSigner === 'string') {
        const { HDNodeWallet } = await import('ethers');
        const wallet = HDNodeWallet.fromPhrase(seedPhraseOrSigner, undefined, "m/44'/60'/0'/0/0");
        return wallet.connect(provider) as ethers.HDNodeWallet;
    }
    return seedPhraseOrSigner.connect(provider) as ethers.HDNodeWallet;
}
