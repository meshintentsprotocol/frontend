/**
 * Step-2 checks in plain words, before the server is asked (MeshDocs/
 * meshv3v4flow/08 §1 "Rules every step ② follows"). Prices are the form's
 * "1 BCH = P tokens": buying the token cheaper means MORE tokens per BCH.
 * The server still checks everything; these only say it sooner and clearer.
 */
import type { StrategyId } from './registry';
import { parsePrice } from './price';

const has = (v: Record<string, string>, k: string) => (v[k] ?? '').trim() !== '';

export function settingsCheck(id: StrategyId, v: Record<string, string>, symbolOf: (tokenKey: string) => string): string | null {
  const P = (k: string) => parsePrice(v[k]);
  const s = symbolOf('token');
  switch (id) {
    case 'fixed': {
      if (!(P('price') > 0)) return 'Set your price';
      if (v.proceeds === 'recycle') {
        const back = P('recyclePrice');
        if (!(back > 0)) return 'Set the trade-back price';
        if (v.side === 'ask' && !(back > P('price'))) return `The trade-back price must buy ${s} back cheaper: more ${s} per BCH than your price`;
        if (v.side !== 'ask' && !(back < P('price'))) return `The trade-back price must sell ${s} dearer: fewer ${s} per BCH than your price`;
      }
      return null;
    }
    case 'spread':
      if (!(P('bid') > 0 && P('ask') > 0)) return 'Set the buy and the sell price';
      return P('bid') > P('ask') ? null : `The buy price must give more ${s} per BCH than the sell price`;
    case 'recycling-pair':
      if (!(P('buy') > 0 && P('sell') > 0)) return 'Set the buy and the sell price';
      return P('buy') > P('sell') ? null : `The buy price must give more ${s} per BCH than the sell price`;
    case 'grid':
      if (!(P('low') > 0 && P('high') > 0)) return 'Set the min and max price';
      return P('low') > P('high') ? null : 'The max price must be above the min price';
    case 'take-profit':
      if (!(P('from') > 0 && P('to') > 0)) return 'Set the first and the last sell price';
      return P('from') > P('to') ? null : `The last sell must be dearer than the first: fewer ${s} per BCH`;
    case 'accumulate':
      if (!(P('from') > 0 && P('to') > 0)) return 'Set the first and the last buy price';
      return P('to') > P('from') ? null : `The last buy must be cheaper than the first: more ${s} per BCH`;
    case 'multi-pair': {
      const keys = [1, 2, 3].filter(i => has(v, `token${i}`));
      if (keys.length < 2) return 'Choose at least two tokens';
      const cats = keys.map(i => v[`token${i}`]!.toLowerCase());
      if (new Set(cats).size !== cats.length) return 'Each token can only be listed once';
      for (const i of keys) if (!(P(`price${i}`) > 0)) return `Set the price for ${symbolOf(`token${i}`)}`;
      return null;
    }
    case 'stable-pair':
      if (!has(v, 'tokenA') || !has(v, 'tokenB')) return 'Choose both tokens';
      if (v.tokenA!.toLowerCase() === v.tokenB!.toLowerCase()) return 'Token A and token B must differ';
      if (!(P('rate') > 0)) return 'Set the rate';
      if (has(v, 'spreadBps') && !/^\d+$/.test(v.spreadBps!.trim())) return 'The spread is a whole number of basis points';
      return null;
    default:
      return null;
  }
}

/** The gap between a buy and a sell price, in % of the sell side (what one round trip earns before fees). */
export function gapPct(buyP: number, sellP: number): number | null {
  return buyP > 0 && sellP > 0 ? (buyP / sellP - 1) * 100 : null;
}
