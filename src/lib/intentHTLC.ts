import { ethers } from 'ethers';

// ── Testnet (Sepolia) ────────────────────────────────────────────────────────
export const STARK_HTLC_ADDRESS = '0x6aE7c527064Cb2A78cA5C42A3B5C77D309a8DF27';
export const INTENT_HTLC_ADDRESS = '0xF5eFC84aa1EB987EaAD4Ae00F0d2cf805882Dff4';
export const USDT_SEPOLIA = '0xd077a400968890eacc75cdc901f0356c943e4fdb';
export const USDC_SEPOLIA = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_RPC = 'https://ethereum-sepolia-rpc.publicnode.com';

// ── Mainnet (BSC) ────────────────────────────────────────────────────────────
export const BSC_STARK_HTLC_ADDRESS = import.meta.env.VITE_MAINNET_STARK_HTLC_ADDRESS || '';
export const BSC_CHAIN_ID = 56;
export const BSC_RPC = import.meta.env.VITE_MAINNET_EVM_RPC || 'https://bsc-dataseed1.binance.org/';
export const USDT_BSC = '0x55d398326f99059fF775485246999027B3197955';
export const USDC_BSC = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';

export interface EvmNetworkConfig {
    htlcAddress: string;
    chainId: number;
    rpc: string;
    nativeCurrency: string;
    explorerUrl: string;
}

export function getEvmConfig(isMainnet: boolean): EvmNetworkConfig {
    if (isMainnet) {
        return {
            htlcAddress: BSC_STARK_HTLC_ADDRESS,
            chainId: BSC_CHAIN_ID,
            rpc: BSC_RPC,
            nativeCurrency: 'BNB',
            explorerUrl: 'https://bscscan.com',
        };
    }
    return {
        htlcAddress: STARK_HTLC_ADDRESS,
        chainId: SEPOLIA_CHAIN_ID,
        rpc: SEPOLIA_RPC,
        nativeCurrency: 'ETH',
        explorerUrl: 'https://sepolia.etherscan.io',
    };
}

export const STARK_HTLC_ABI = [
    'function createStarkEscrow(address solver, uint256 timelockDuration, address tokenAddress, uint256 tokenAmount) external payable returns (uint256)',
    'event StarkEscrowCreated(uint256 indexed escrowId, address indexed sender, address indexed solver, uint256 amount, address tokenAddress, uint256 timelock, uint256 createdAt)',
];

export const HTLC_ABI = [
    'function createEscrow(bytes32 hashlock, address recipient, uint256 timelockDuration, address tokenAddress, uint256 tokenAmount) external payable returns (uint256)',
    'function claim(uint256 escrowId, bytes32 secret) external',
    'function refund(uint256 escrowId) external',
    'function getEscrowDetails(uint256 escrowId) external view returns (bytes32 hashlock, uint256 timelock, address sender, address recipient, uint256 amount, address tokenAddress, bool claimed, bool refunded, uint256 createdAt)',
    'event EscrowCreated(uint256 indexed escrowId, bytes32 hashlock, address indexed sender, address indexed recipient, uint256 amount, address tokenAddress, uint256 timelock, uint256 createdAt)',
    'event EscrowClaimed(uint256 indexed escrowId, address indexed recipient, bytes32 secret)',
];

export const ERC20_ABI = [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)',
];

export async function getConnectedSigner(
    evmSigner: ethers.HDNodeWallet,
    isMainnet = false,
): Promise<ethers.HDNodeWallet> {
    const cfg = getEvmConfig(isMainnet);
    const provider = new ethers.JsonRpcProvider(cfg.rpc, cfg.chainId);
    return evmSigner.connect(provider) as ethers.HDNodeWallet;
}

export async function createStarkEscrow(
    evmSigner: ethers.HDNodeWallet,
    solverAddr: string,
    timelockDuration: number,
    tokenAddress: string,
    amountWei: string,
    isMainnet = false,
): Promise<string> {
    const cfg = getEvmConfig(isMainnet);
    if (!cfg.htlcAddress) throw new Error('STARK HTLC address not configured for this network');
    const signer = await getConnectedSigner(evmSigner, isMainnet);
    const isERC20 = tokenAddress !== ethers.ZeroAddress;

    if (isERC20) {
        const erc20 = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
        const existing = await erc20.allowance(signer.address, cfg.htlcAddress);
        if (BigInt(existing) < BigInt(amountWei)) {
            const approveTx = await erc20.approve(cfg.htlcAddress, amountWei);
            await approveTx.wait();
        }
    }

    const htlc = new ethers.Contract(cfg.htlcAddress, STARK_HTLC_ABI, signer);
    const value = isERC20 ? 0n : BigInt(amountWei);
    const tokenAmt = isERC20 ? BigInt(amountWei) : 0n;

    const tx = await htlc.createStarkEscrow(
        solverAddr,
        BigInt(timelockDuration),
        tokenAddress,
        tokenAmt,
        { value },
    );
    const receipt = await tx.wait();

    const iface = new ethers.Interface(STARK_HTLC_ABI);
    for (const log of receipt.logs) {
        try {
            const parsed = iface.parseLog(log);
            if (parsed?.name === 'StarkEscrowCreated') {
                return parsed.args.escrowId.toString();
            }
        } catch { /* skip */ }
    }
    throw new Error('StarkEscrowCreated event not found in receipt');
}

export async function createHTLCEscrow(
    evmSigner: ethers.HDNodeWallet,
    hashlock: string,
    recipientAddr: string,
    timelockDuration: number,
    tokenAddress: string,
    amountWei: string,
    isMainnet = false,
): Promise<string> {
    const cfg = getEvmConfig(isMainnet);
    const htlcAddr = INTENT_HTLC_ADDRESS;
    const signer = await getConnectedSigner(evmSigner, isMainnet);
    const isERC20 = tokenAddress !== ethers.ZeroAddress;

    if (isERC20) {
        const erc20 = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
        const existing = await erc20.allowance(signer.address, htlcAddr);
        if (BigInt(existing) < BigInt(amountWei)) {
            const approveTx = await erc20.approve(htlcAddr, amountWei);
            await approveTx.wait();
        }
    }

    const htlc = new ethers.Contract(htlcAddr, HTLC_ABI, signer);
    const value = isERC20 ? 0n : BigInt(amountWei);
    const tokenAmt = isERC20 ? BigInt(amountWei) : 0n;
    const hashBuf = hashlock.startsWith('0x') ? hashlock : `0x${hashlock}`;

    const tx = await htlc.createEscrow(
        hashBuf,
        recipientAddr,
        BigInt(timelockDuration),
        tokenAddress,
        tokenAmt,
        { value },
    );
    const receipt = await tx.wait();

    const iface = new ethers.Interface(HTLC_ABI);
    for (const log of receipt.logs) {
        try {
            const parsed = iface.parseLog(log);
            if (parsed?.name === 'EscrowCreated') {
                return parsed.args.escrowId.toString();
            }
        } catch { /* skip */ }
    }
    throw new Error('EscrowCreated event not found in receipt');
}

export async function claimHTLCEscrow(
    evmSigner: ethers.HDNodeWallet,
    escrowId: string,
    secretHex: string,
    isMainnet = false,
): Promise<string> {
    const htlcAddr = INTENT_HTLC_ADDRESS;
    const signer = await getConnectedSigner(evmSigner, isMainnet);
    const htlc = new ethers.Contract(htlcAddr, HTLC_ABI, signer);
    const secretBuf = secretHex.startsWith('0x') ? secretHex : `0x${secretHex}`;
    const tx = await htlc.claim(BigInt(escrowId), secretBuf);
    const receipt = await tx.wait();
    return receipt.hash;
}

export async function refundHTLCEscrow(
    evmSigner: ethers.HDNodeWallet,
    escrowId: string,
    isMainnet = false,
): Promise<string> {
    const htlcAddr = INTENT_HTLC_ADDRESS;
    const signer = await getConnectedSigner(evmSigner, isMainnet);
    const htlc = new ethers.Contract(htlcAddr, HTLC_ABI, signer);
    const tx = await htlc.refund(BigInt(escrowId));
    const receipt = await tx.wait();
    return receipt.hash;
}
