export const INTENT_SWAP_ADDRESS = "0xbd128d4f1dbb87783658bed4a4046f3811015952110f321863c34f161eb07611";
export const SOLANA_PROGRAM_ID = "5JAWumq5L4B8WrpF3CFox36SZ2bJF4xQvskLksmHRgs2";
export const INTENT_RELAYER_URL = import.meta.env.VITE_RELAYER_URL || import.meta.env.VITE_MESH_SERVER_URL || "http://localhost:3001";
export const CROSS_CHAIN_RELAYER_URL = import.meta.env.VITE_CROSS_CHAIN_RELAYER_URL || "https://cross-chain-relayer-production-a93e.up.railway.app";
export const BCH_SOLANA_RELAYER_URL = import.meta.env.VITE_BCH_SOLANA_RELAYER_URL || "http://localhost:3004";
export const CASHTOKEN_RELAYER_URL = import.meta.env.VITE_CASHTOKEN_RELAYER_URL || import.meta.env.VITE_MESH_SERVER_URL || "http://localhost:3001";
export const CASHTOKEN_RELAYER_MAINNET_URL = import.meta.env.VITE_CASHTOKEN_RELAYER_MAINNET_URL || import.meta.env.VITE_MESH_SERVER_URL || "http://localhost:3001";
export const SOL_BCH_ZK_SERVER_URL         = import.meta.env.VITE_SOL_BCH_ZK_SERVER_URL          || "http://localhost:3007";
export const SOL_BCH_ZK_SERVER_MAINNET_URL = import.meta.env.VITE_SOL_BCH_ZK_SERVER_MAINNET_URL  || "http://localhost:3007";
export const EVM_RELAYER_URL               = import.meta.env.VITE_EVM_RELAYER_URL                || "http://localhost:3005";
export const EVM_RELAYER_MAINNET_URL       = import.meta.env.VITE_EVM_RELAYER_MAINNET_URL        || "http://localhost:3005";
/** cctp-swap-server: cross-chain USDC (Circle CCTP) and Solana swaps (Jupiter). */
export const CCTP_SWAP_SERVER_URL: string  = import.meta.env.VITE_CCTP_SWAP_SERVER_URL           || "http://localhost:3012";
// The swap server instance that runs with CCTP_NETWORK=mainnet. Empty: Mainnet mode keeps using the server above
// (Solana swaps only; cross-chain USDC stays a Testnet-mode feature).
export const CCTP_SWAP_SERVER_MAINNET_URL: string = import.meta.env.VITE_CCTP_SWAP_SERVER_MAINNET_URL || "";
export const BCH_MESH_SERVER_URL           = import.meta.env.VITE_MESH_SERVER_URL                || import.meta.env.VITE_MESH_API_URL || "http://localhost:3001";
/** The MCP server AI agents connect to (bch-intents-mcp). Unset: the local dev server, and /mcp says so. */
export const MCP_SERVER_URL: string        = import.meta.env.VITE_MCP_URL                        || "http://localhost:8787/mcp";
export const MCP_SERVER_IS_HOSTED: boolean = Boolean(import.meta.env.VITE_MCP_URL);
export const SOLANA_RPC_URL = "https://devnet.helius-rpc.com/?api-key=7ceb6609-616a-4e84-ba92-5ee3d04eb5e7";
export const BCH_NETWORK = "chipnet";

// Chain IDs
export const MOVEMENT_TESTNET_CHAIN_ID = 250;
export const SOLANA_DEVNET_CHAIN_ID = 103; // Approximate/Custom

// Token addresses for testing
export const TOKENS = {
    MOVE: "0x1::aptos_coin::AptosCoin",
    USDC: "0x45142fb00dde90b950183d8ac2815597892f665c254c3f42b5768bc6ae4c8489", // Using deployed FA or AptosCoin
    SOL: "11111111111111111111111111111111"
};

// BCH CashToken categories (chipnet)
export const BCH_TOKEN_CATEGORIES = {
    MOVE_BRIDGED: "8a70a0a814108e7a26d132838dc5152e431394002c30440b75d15246dbb924df",
    SOL_BRIDGED: "d18f92ae2732ab773ad2006f15712530c3365319806307770857f128c7c25b30",
};
