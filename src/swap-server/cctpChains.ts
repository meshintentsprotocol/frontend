/**
 * What this app adds to a CCTP chain from the server's /config: the `Token.chain` it is listed under and a public
 * RPC the in-app wallet can send through. The server keeps its own RPCs private, so the browser needs its own.
 *
 * A chain the server offers but this table does not know is left out of the selector: there would be no way to
 * sign for it.
 */
import type { Token } from '@/types';
import { EVM_CHAINS_TESTNET } from '@/lib/evmChains';
import { SOLANA_RPC_URL } from '@/lib/config';
import type { CctpChain } from './types';

export interface CctpChainLocal {
    tokenChain: NonNullable<Token['chain']>;
    rpc: string;
}

const env = import.meta.env as Record<string, string | undefined>;

const LOCAL: Record<string, CctpChainLocal> = {
    'eth-sepolia':   { tokenChain: 'ethereum', rpc: env.VITE_ETH_SEPOLIA_RPC || EVM_CHAINS_TESTNET.ethereum.rpc },
    'op-sepolia':    { tokenChain: 'optimism', rpc: env.VITE_OP_SEPOLIA_RPC || EVM_CHAINS_TESTNET.optimism.rpc },
    'arb-sepolia':   { tokenChain: 'arbitrum', rpc: env.VITE_ARB_SEPOLIA_RPC || EVM_CHAINS_TESTNET.arbitrum.rpc },
    'base-sepolia':  { tokenChain: 'base',     rpc: env.VITE_BASE_SEPOLIA_RPC || EVM_CHAINS_TESTNET.base.rpc },
    'arc-testnet':   { tokenChain: 'arc',      rpc: env.VITE_ARC_TESTNET_RPC || 'https://rpc.testnet.arc.io' },
    'solana-devnet': { tokenChain: 'solana',   rpc: SOLANA_RPC_URL },
};

export function localChain(key: string): CctpChainLocal | undefined {
    return LOCAL[key];
}

/** The server's chain a token of this `Token.chain` lives on, among the chains /config lists as open. */
export function chainForTokenChain(tokenChain: Token['chain'], chains: CctpChain[]): CctpChain | undefined {
    return chains.find(c => LOCAL[c.key]?.tokenChain === tokenChain);
}

export function explorerTxUrl(chain: CctpChain, tx: string): string {
    return chain.explorerTx.replace('{tx}', tx);
}
