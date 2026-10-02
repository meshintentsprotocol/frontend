/**
 * ParyonUSD (pUSD) per BCH network: the default stable for swaps and wallets.
 *   mainnet  PUSD      — the largest stablecoin pool on Cauldron mainnet
 *   chipnet  PUSDTEST  — "ParyonUSD (chipnet-16)", the deepest chipnet test pUSD
 */
import type { Token } from '@/types';

export const PUSD_MAINNET = '2469acc5afa4b10cb5b5c04afb89c3a3ffd61c5da9c01e26d00951cae2a02544';
export const PUSD_CHIPNET = 'dfe50223c8d5cba8dcef8dff6d92b61deb88a8ba44947367f2b746487b56039b';
const PUSD_ICON = 'https://paryonusd.com/logo.svg';

export const pusdCategory = (isMainnet: boolean) => (isMainnet ? PUSD_MAINNET : PUSD_CHIPNET);

export function pusdToken(isMainnet: boolean): Token {
  const categoryId = pusdCategory(isMainnet);
  return {
    symbol: isMainnet ? 'PUSD' : 'PUSDTEST',
    name: isMainnet ? 'ParyonUSD' : 'ParyonUSD (chipnet)',
    icon: PUSD_ICON,
    decimals: 2,
    type: categoryId,
    chain: 'bch',
    categoryId,
  };
}
