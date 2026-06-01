import { ethers } from 'ethers';

// ── Testnet (Sepolia) ────────────────────────────────────────────────────────
export const STARK_HTLC_ADDRESS = '0x6aE7c527064Cb2A78cA5C42A3B5C77D309a8DF27';
export const USDT_SEPOLIA = '0xd077a400968890eacc75cdc901f0356c943e4fdb';
export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_RPC = 'https://ethereum-sepolia-rpc.publicnode.com';

// ── Mainnet (BSC) ────────────────────────────────────────────────────────────
// Deployed after running: npx hardhat run scripts/deploy_stark_htlc.ts --network bscMainnet
export const BSC_STARK_HTLC_ADDRESS = import.meta.env.VITE_MAINNET_STARK_HTLC_ADDRESS || '';
export const BSC_CHAIN_ID = 56;
export const BSC_RPC = import.meta.env.VITE_MAINNET_EVM_RPC || 'https://bsc-dataseed1.binance.org/';
// USDT on BSC mainnet (standard Binance-peg USDT)
export const USDT_BSC = '0x55d398326f99059fF775485246999027B3197955';

// ── Network-aware helpers ─────────────────────────────────────────────────────
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

export const ERC20_ABI = [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)',
];

// Returns the evmSigner connected to the correct chain provider.
export async function getConnectedSigner(
    evmSigner: ethers.HDNodeWallet,
    isMainnet = false,
): Promise<ethers.HDNodeWallet> {
    const cfg = getEvmConfig(isMainnet);
    const provider = new ethers.JsonRpcProvider(cfg.rpc, cfg.chainId);
    return evmSigner.connect(provider) as ethers.HDNodeWallet;
}

// Creates a STARK escrow on the HTLC contract (Sepolia testnet or BSC mainnet).
// For ERC20 tokens (tokenAddress != ZeroAddress), approves the contract first.
// Returns the escrowId as a decimal string.
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

    // Parse escrowId from StarkEscrowCreated event
    const iface = new ethers.Interface(STARK_HTLC_ABI);
    for (const log of receipt.logs) {
        try {
            const parsed = iface.parseLog(log);
            if (parsed?.name === 'StarkEscrowCreated') {
                return parsed.args.escrowId.toString();
            }
        } catch { /* skip unrelated logs */ }
    }
    throw new Error('StarkEscrowCreated event not found in receipt');
}
