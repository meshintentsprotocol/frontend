/**
 * The token a create screen starts on (?token=, else pUSD of the wallet's
 * network), its details (with the chipnet test tokens as a fallback) and its
 * market, for step ① and Simple mode.
 *
 * Uses Cauldron AMM indexer price exclusively.
 */
import { useMeshSigner } from '@/hooks/useMesh';
import { useTokenInfo, type TokenInfo } from '@/components/mesh/pools/shared';
import { CHIPNET_DEFAULT_TOKENS } from '@/components/mesh/TokenSelectModal';
import { pusdCategory } from '@/lib/pusd';
import { formDefaults } from '@/lib/mesh/create/forms';
import { useCauldronPrice } from '@/hooks/useCauldronPrice';

export function defaultToken(network: string): string {
  return formDefaults('range', network, { mainnetPusd: pusdCategory(true) }).token ?? '';
}

export function usePairInfo(token: string) {
  const { get, loading } = useTokenInfo([token]);
  const i = get(token);
  const f = CHIPNET_DEFAULT_TOKENS.find(t => t.categoryId === token);
  const info: TokenInfo = i.known ? i : f ? { ...i, symbol: f.symbol, decimals: f.decimals, icon: f.icon ?? null, known: true } : i;
  const cauldron = useCauldronPrice(token, info.decimals);
  const ctx = cauldron.hasCauldron ? cauldron.marketContext : null;
  const marketP = cauldron.tokensPerBch;
  return {
    info,
    infoLoading: (loading && !info.known) || cauldron.isLoading,
    suggest: { isLoading: cauldron.isLoading },
    ctx,
    marketP,
    cauldron,
  };
}

/** The wallet's network, for the default token. */
export function useNetwork(): string {
  return useMeshSigner().network;
}
