import { useQuery } from '@tanstack/react-query';
import { fetchAllProtocolTxs, type ProtocolTx } from '@/lib/relayers';

/**
 * Fetch all protocol transactions from the relayers and the swap server, and filter by token.
 *
 * For cross-chain tokens (BCH, SOL, BNB, USDC, XMR, MOVE):
 *   keeps txs where sellToken or buyToken symbol matches.
 *
 * For CashTokens (isCashToken=true, tokenId=64-char hex category):
 *   keeps cashtoken-relayer txs where the raw sell/buy token matches the category.
 */
export function useProtocolTransactions(
    tokenId: string,
    isCashToken: boolean,
    isMainnet: boolean
) {
    return useQuery<ProtocolTx[]>({
        queryKey: ['protocol-txs', tokenId, isCashToken, isMainnet],
        queryFn: async () => {
            const all = await fetchAllProtocolTxs(isMainnet);

            const filtered = all.filter(tx => {
                if (isCashToken) {
                    // CashToken: match the raw 64-char category hex on either side
                    return (
                        tx.source === 'cashtoken' &&
                        (tx.sellTokenRaw === tokenId || tx.buyTokenRaw === tokenId)
                    );
                }

                // Cross-chain: symbol match
                const sym = tokenId.toUpperCase();

                // BCH: show all cashtoken txs too (BCH is always one side)
                if (sym === 'BCH') {
                    return (
                        tx.sellToken === 'BCH' ||
                        tx.buyToken === 'BCH' ||
                        (tx.source === 'cashtoken')
                    );
                }

                // SOL + USDC: the sol-bch relayer, cross-chain USDC and Solana swaps
                if (sym === 'SOL' || sym === 'USDC') {
                    return (tx.source === 'sol-bch' || tx.source === 'cctp' || tx.source === 'jupiter') && (
                        tx.sellToken === sym || tx.buyToken === sym
                    );
                }

                // BNB: bsc-bch relayer
                if (sym === 'BNB' || sym === 'ETH' || sym === 'USDT') {
                    return tx.source === 'bsc-bch' && (
                        tx.sellToken === sym || tx.buyToken === sym
                    );
                }

                // Generic: match symbol anywhere
                return tx.sellToken === sym || tx.buyToken === sym;
            });

            return filtered.slice(0, 50);
        },
        staleTime: 15_000,
        refetchInterval: 15_000,
    });
}
