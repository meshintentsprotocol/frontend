/**
 * useCauldronPrice — Single source of truth for CashToken market prices from Cauldron.
 *
 * Exclusively uses Cauldron AMM indexer data (identical to /explore and TokenDetailPage).
 * If no Cauldron liquidity/price exists for the token, returns hasCauldron: false
 * with midSatsPerToken: null (strictly NO fallback to Mesh covenant pool prices).
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CauldronService, type CauldronTokenData } from '@/lib/cauldron';
import { BcmrClient } from '@/lib/bcmr';
import { useMeshSigner } from '@/hooks/useMesh';
import { usePrices } from '@/hooks/usePrices';
import type { MarketContext } from '@/lib/mesh/meshApi';

export interface CauldronPriceData {
  hasCauldron: boolean;
  /** Price in sats per whole display token */
  priceSats: number | null;
  /** Price in sats per token base unit (satsPerUnit) */
  satsPerUnit: number | null;
  /** Whole tokens per 1 BCH (1e8 / priceSats) */
  tokensPerBch: number | null;
  /** BCH per 1 whole token (priceSats / 1e8) */
  bchPerToken: number | null;
  /** USD price of 1 whole token */
  tokenUsd: number | null;
  /** Live BCH price in USD */
  bchUsd: number | null;
  /** Full MarketContext compatible with Mesh create flow and MarketStrip */
  marketContext: MarketContext | null;
  /** Raw Cauldron token details */
  raw: CauldronTokenData | null;
  isLoading: boolean;
  refetch: () => void;
}

export function useCauldronPrice(tokenId: string | undefined, knownDecimals?: number): CauldronPriceData {
  const signer = useMeshSigner();
  const isMainnet = signer.network === 'mainnet';
  const { prices } = usePrices();
  const bchPriceUsd = prices['BCH']?.price ?? 0;

  const cleanTokenId = tokenId && tokenId !== '0x' ? tokenId.toLowerCase() : undefined;

  const query = useQuery({
    queryKey: ['cauldron-price', cleanTokenId, isMainnet],
    queryFn: async (): Promise<CauldronTokenData | null> => {
      if (!cleanTokenId) return null;
      const [market, bcmr] = await Promise.all([
        CauldronService.getTokenDetail(cleanTokenId, isMainnet),
        BcmrClient.get(cleanTokenId, isMainnet).catch(() => null),
      ]);
      if (!market) return null;
      return CauldronService.applyMetadata(market, bcmr);
    },
    enabled: !!cleanTokenId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return useMemo((): CauldronPriceData => {
    const raw = query.data ?? null;
    const meta = raw ? CauldronService.metadataOf(raw) : null;
    const decimals = typeof knownDecimals === 'number' ? knownDecimals : (meta?.decimals ?? 0);
    const priceSats = raw?.price_now && raw.price_now > 0 ? raw.price_now : null;

    if (!cleanTokenId || !raw || !priceSats) {
      const emptyContext: MarketContext | null = cleanTokenId ? {
        token: cleanTokenId,
        symbol: meta?.symbol ?? null,
        decimals,
        icon: meta?.iconRaw ?? null,
        cauldron: null,
        mesh: { bestBid: null, bestAsk: null },
        midSatsPerToken: null,
        midSource: null,
        midConfidence: 'none',
        bchUsd: bchPriceUsd || null,
        tokenUsd: null,
      } : null;

      return {
        hasCauldron: false,
        priceSats: null,
        satsPerUnit: null,
        tokensPerBch: null,
        bchPerToken: null,
        tokenUsd: null,
        bchUsd: bchPriceUsd || null,
        marketContext: emptyContext,
        raw,
        isLoading: query.isLoading,
        refetch: query.refetch,
      };
    }

    // ct.price_now is sats per whole (display) token
    const satsPerUnit = priceSats / (10 ** decimals);
    const tokensPerBch = 1e8 / priceSats;
    const bchPerToken = priceSats / 1e8;
    const tokenUsd = raw.price_now_usd > 0
      ? raw.price_now_usd
      : (bchPriceUsd > 0 ? bchPerToken * bchPriceUsd : null);

    const marketContext: MarketContext = {
      token: cleanTokenId,
      symbol: meta?.symbol ?? null,
      decimals,
      icon: meta?.iconRaw ?? null,
      cauldron: {
        satsPerToken: String(satsPerUnit),
        bchReserve: String(raw.tvl_sats || 0),
        tokenReserve: String(raw.tvl_tokens || 0),
        poolAddress: '',
      },
      mesh: { bestBid: null, bestAsk: null }, // Strictly NO mesh price fallback
      midSatsPerToken: satsPerUnit,
      midSource: 'cauldron',
      midConfidence: 'cauldron',
      bchUsd: bchPriceUsd || null,
      tokenUsd: tokenUsd ?? null,
    };

    return {
      hasCauldron: true,
      priceSats,
      satsPerUnit,
      tokensPerBch,
      bchPerToken,
      tokenUsd,
      bchUsd: bchPriceUsd || null,
      marketContext,
      raw,
      isLoading: query.isLoading,
      refetch: query.refetch,
    };
  }, [cleanTokenId, query.data, query.isLoading, query.refetch, knownDecimals, bchPriceUsd]);
}
