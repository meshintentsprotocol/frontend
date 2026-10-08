/**
 * Central chain registry.
 *
 * Single source of truth for chain display metadata (logo, name, accent).
 * Components never hard-code chain logo paths — they resolve through
 * `getChainMeta()` / `getChainLogo()`, which tolerate the various chain
 * label spellings used across the app ('Bitcoin Cash', 'bch', 'BSC', 'eth'…).
 */

export interface ChainMeta {
    /** Canonical chain id. */
    id: string;
    /** Human-readable name. */
    name: string;
    /** Logo path/URL (served from /public). */
    logo: string;
    /** Accent colour — useful for glows / fallback dots. */
    color: string;
}

export const CHAINS: Record<string, ChainMeta> = {
    bitcoin: { id: 'bitcoin', name: 'Bitcoin', logo: '/logos/bitcoin-btc-logo.svg', color: '#f7931a' },
    'bitcoin-cash': { id: 'bitcoin-cash', name: 'Bitcoin Cash', logo: '/logos/bitcoin-cash-bch-logo.svg', color: '#0ac18e' },
    ethereum: { id: 'ethereum', name: 'Ethereum', logo: '/logos/ethereum-eth-logo.svg', color: '#627eea' },
    bsc: { id: 'bsc', name: 'BNB Chain', logo: '/logos/bnb-bnb-logo.svg', color: '#f0b90b' },
    base: { id: 'base', name: 'Base', logo: '/logos/Base_square_blue.svg', color: '#0052ff' },
    arbitrum: { id: 'arbitrum', name: 'Arbitrum', logo: '/logos/arbitrum-arb-logo.svg', color: '#28a0f0' },
    optimism: { id: 'optimism', name: 'Optimism', logo: '/logos/optimism.svg', color: '#ff0420' },
    arc: { id: 'arc', name: 'Arc', logo: '/logos/arc.svg', color: '#7fd4ff' },
    solana: { id: 'solana', name: 'Solana', logo: '/logos/solana.svg', color: '#9945ff' },
    movement: { id: 'movement', name: 'Movement', logo: '/logos/movement.svg', color: '#ffda34' },
    monero: { id: 'monero', name: 'Monero', logo: '/logos/monero.svg', color: '#ff6600' },
};

// Maps every label variant seen in the codebase onto a canonical chain id.
const CHAIN_ALIASES: Record<string, string> = {
    bitcoin: 'bitcoin',
    btc: 'bitcoin',
    'bitcoin cash': 'bitcoin-cash',
    'bitcoin-cash': 'bitcoin-cash',
    bch: 'bitcoin-cash',
    ethereum: 'ethereum',
    eth: 'ethereum',
    sepolia: 'ethereum',
    bsc: 'bsc',
    bnb: 'bsc',
    'bnb chain': 'bsc',
    'binance smart chain': 'bsc',
    base: 'base',
    arbitrum: 'arbitrum',
    arb: 'arbitrum',
    optimism: 'optimism',
    op: 'optimism',
    arc: 'arc',
    solana: 'solana',
    sol: 'solana',
    movement: 'movement',
    move: 'movement',
    mvmt: 'movement',
    monero: 'monero',
    xmr: 'monero',
};

/** Resolve chain metadata from any label spelling. Returns null if unknown. */
export function getChainMeta(label?: string | null): ChainMeta | null {
    if (!label) return null;
    const norm = label.toLowerCase().trim();
    const id = CHAIN_ALIASES[norm] ?? norm;
    return CHAINS[id] ?? null;
}

/** Resolve just the chain logo path. Returns null if unknown. */
export function getChainLogo(label?: string | null): string | null {
    return getChainMeta(label)?.logo ?? null;
}
