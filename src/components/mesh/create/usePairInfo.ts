/**
 * The token a create screen starts on (?token=, else pUSD of the wallet's
 * network), its details (with the chipnet test tokens as a fallback) and its
 * market, for step ① and Simple mode.
 */
import { useMeshSigner, useStrategySuggest } from '@/hooks/useMesh';
import { useTokenInfo, type TokenInfo } from '@/components/mesh/pools/shared';
import { CHIPNET_DEFAULT_TOKENS } from '@/components/mesh/TokenSelectModal';
import { pusdCategory } from '@/lib/pusd';
import { formDefaults } from '@/lib/mesh/create/forms';
import { tokensPerBchFromSats } from '@/lib/mesh/create/price';

export function defaultToken(network: string): string {
  return formDefaults('range', network, { mainnetPusd: pusdCategory(true) }).token ?? '';
}

export function usePairInfo(token: string) {
  const { get, loading } = useTokenInfo([token]);
  const i = get(token);
  const f = CHIPNET_DEFAULT_TOKENS.find(t => t.categoryId === token);
  const info: TokenInfo = i.known ? i : f ? { ...i, symbol: f.symbol, decimals: f.decimals, icon: f.icon ?? null, known: true } : i;
  const suggest = useStrategySuggest(token ? { template: 'range', token } : null);
  const ctx = suggest.data?.market?.[token] ?? null;
  const marketP = ctx?.midSatsPerToken ? tokensPerBchFromSats(ctx.midSatsPerToken, info.decimals) : null;
  return { info, infoLoading: loading && !info.known, suggest, ctx, marketP };
}

/** The wallet's network, for the default token. */
export function useNetwork(): string {
  return useMeshSigner().network;
}
