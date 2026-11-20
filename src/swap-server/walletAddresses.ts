/** Chain-specific user addresses; protocol fee accounts must never be used here. */
export function bchWalletAddress(chain: string, wallets: { bchMainnet?: string | null; solana?: string | null; evm?: string | null }): string | null {
    if (chain === 'bch') return wallets.bchMainnet?.startsWith('bitcoincash:') ? wallets.bchMainnet : null;
    if (chain === 'sol' || chain === 'solana') return wallets.solana || null;
    if (['eth', 'ethereum', 'base', 'arb', 'arbitrum', 'op', 'optimism', 'bsc', 'pol', 'polygon', 'avax', 'avalanche'].includes(chain)) return wallets.evm || null;
    return null;
}
