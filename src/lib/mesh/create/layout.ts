/**
 * What a strategy's pools or bins look like on the price chart, before and
 * after the server previews them (MeshDocs/meshv3v4flow/09 §2.5).
 *
 * Every chart uses one axis: "1 BCH = P tokens", P growing to the right. A unit
 * holding BCH sells BCH as the price rises, so it sits right of the market; a
 * unit holding the token sits left of it.
 *
 * - V4 range: computed here with the same grid math as the covenant and the
 *   server planner (v4Levels, gridPrice), so the chart follows a drag at once.
 * - V3 strategies: drawn from the server preview's pools (exact prices).
 */
import { gridPriceNum, v4Levels } from '../v4/position';
import type { DepthLevel, StrategyPoolPreview } from '../meshApi';
import { tokensPerBchFromSats } from './price';

export type ChartSide = 'bch' | 'token';

export interface ChartBin {
  key: string;
  /** price span on the axis, tokens per BCH (minP < maxP) */
  minP: number;
  maxP: number;
  side: ChartSide;
  /** bar height, 0–1 */
  weight: number;
  label?: string;
}

export type ShapeName = 'spot' | 'curve' | 'bidask';
export type StrengthName = 'gentle' | 'standard' | 'aggressive';

/** V4 positions hold at most this many bins (server positionPlanner MAX_BINS). */
export const V4_MAX_BINS = 128;
/** A V3 range holds at most this many bins (server RANGE_MAX_BINS). */
export const V3_MAX_RANGE_BINS = 20;

const SIGMA: Record<StrengthName, number> = { gentle: 3.5, standard: 2, aggressive: 1.25 };
const BIDASK_K: Record<StrengthName, number> = { gentle: 1, standard: 3, aggressive: 6 };

/** The server's shape weight for a unit `d` away from the market (nearest = 1) on a side of `n` units. */
export function shapeWeight(shape: ShapeName, strength: StrengthName, d: number, n: number): number {
  if (shape === 'curve') {
    const s = SIGMA[strength];
    return Math.exp(-(d * d) / (2 * s * s));
  }
  if (shape === 'bidask') return 1 + (BIDASK_K[strength] * (d - 1)) / Math.max(1, n - 1);
  return 1;
}

export interface RangeLayout {
  bins: ChartBin[];
  /** bins holding BCH (bids) and holding the token (asks) */
  bidCount: number;
  askCount: number;
  lowIndex: number;
  highIndex: number;
  marketIndex: number;
  /** the range on the axis */
  minP: number;
  maxP: number;
  error?: string;
}

/**
 * A V4 range from the range template's server params (sats per token unit:
 * `low` = most tokens per BCH, `high` = fewest), the market and the bin step.
 */
export function v4RangeLayout({ lowSats, highSats, centerSats, stepBps, decimals, shape = 'spot', strength = 'standard', maxBins = V4_MAX_BINS }: {
  lowSats: number; highSats: number; centerSats: number; stepBps: number; decimals: number;
  shape?: ShapeName; strength?: StrengthName; maxBins?: number;
}): RangeLayout {
  const empty = (error: string): RangeLayout => ({ bins: [], bidCount: 0, askCount: 0, lowIndex: 0, highIndex: 0, marketIndex: 0, minP: 0, maxP: 0, error });
  if (!(lowSats > 0 && highSats > 0 && centerSats > 0)) return empty('Set the min, max and market prices');
  if (!(highSats > lowSats)) return empty('The max price must be above the min price');
  const { lowIndex, highIndex, marketIndex } = v4Levels(lowSats, highSats, centerSats, stepBps);
  const count = highIndex - lowIndex + 1;
  if (count < 1) return empty('The range holds no full bin at this step: widen it or pick a smaller step');
  if (count > maxBins) return empty(`This range holds ${count} bins, at most ${maxBins}: narrow it or pick a larger step`);
  const bidLevels = Math.max(0, Math.min(highIndex, marketIndex) - lowIndex + 1);
  const askLevels = count - bidLevels;
  const raw: Array<Omit<ChartBin, 'weight'> & { w: number }> = [];
  for (let l = lowIndex; l <= highIndex; l++) {
    const bid = l <= marketIndex;
    const pBid = tokensPerBchFromSats(gridPriceNum(stepBps, l), decimals);
    const pAsk = tokensPerBchFromSats(gridPriceNum(stepBps, l + 1), decimals);
    const d = bid ? marketIndex - l + 1 : l - marketIndex;
    raw.push({
      key: `bin-${l}`, minP: Math.min(pBid, pAsk), maxP: Math.max(pBid, pAsk), side: bid ? 'bch' : 'token',
      w: shapeWeight(shape, strength, d, bid ? bidLevels : askLevels), label: `level ${l}`,
    });
  }
  const top = Math.max(...raw.map(r => r.w));
  const bins = raw.map(({ w, ...b }) => ({ ...b, weight: top > 0 ? w / top : 1 }));
  return {
    bins, bidCount: bidLevels, askCount: askLevels, lowIndex, highIndex, marketIndex,
    minP: Math.min(...bins.map(b => b.minP)), maxP: Math.max(...bins.map(b => b.maxP)),
  };
}

/**
 * A V3 range from the same params, with the server's own rules (templates.ts
 * `range` + `ladderPools`): every grid level between low and high, one pool per
 * pair of neighbouring levels, and a pool starts in BCH unless its buy price,
 * after the fee, would pay more than the market.
 */
export function v3RangeLayout({ lowSats, highSats, centerSats, stepBps, decimals, feeBps = 30, shape = 'spot', strength = 'standard', maxBins = V3_MAX_RANGE_BINS }: {
  lowSats: number; highSats: number; centerSats: number; stepBps: number; decimals: number;
  feeBps?: number; shape?: ShapeName; strength?: StrengthName; maxBins?: number;
}): RangeLayout {
  const empty = (error: string): RangeLayout => ({ bins: [], bidCount: 0, askCount: 0, lowIndex: 0, highIndex: 0, marketIndex: 0, minP: 0, maxP: 0, error });
  if (!(lowSats > 0 && highSats > 0 && centerSats > 0)) return empty('Set the min, max and market prices');
  if (!(highSats > lowSats)) return empty('The max price must be above the min price');
  const l = Math.log1p(stepBps / 10_000);
  const first = Math.ceil(Math.log(lowSats) / l - 1e-9);
  const last = Math.floor(Math.log(highSats) / l + 1e-9);
  const count = last - first;
  if (count < 1) return empty('The range holds no full bin at this step: widen it or pick a smaller step');
  if (count > maxBins) return empty(`This range holds ${count} pools, at most ${maxBins}: narrow it or pick a larger step`);
  const price = (i: number) => Math.exp(i * l);
  const fee = 1 - Math.min(9999, Math.max(0, feeBps)) / 10_000;
  const rungs = Array.from({ length: count }, (_, j) => ({ level: first + j, bid: price(first + j) * fee <= centerSats }));
  const bids = rungs.filter(r => r.bid);
  const asks = rungs.filter(r => !r.bid);
  const raw = rungs.map(r => {
    const d = r.bid ? bids.length - bids.indexOf(r) : asks.indexOf(r) + 1;
    const pBuy = tokensPerBchFromSats(price(r.level), decimals);
    const pSell = tokensPerBchFromSats(price(r.level + 1), decimals);
    return {
      key: `pool-${r.level}`, minP: Math.min(pBuy, pSell), maxP: Math.max(pBuy, pSell), side: (r.bid ? 'bch' : 'token') as ChartSide,
      w: shapeWeight(shape, strength, d, r.bid ? bids.length : asks.length), label: `level ${r.level}`,
    };
  });
  const top = Math.max(...raw.map(r => r.w));
  const out = raw.map(({ w, ...b }) => ({ ...b, weight: top > 0 ? w / top : 1 }));
  // the last bid sits at or below the market: the same "market index" a V4 layout reports
  const marketIndex = bids.length ? bids[bids.length - 1]!.level : first - 1;
  return {
    bins: out, bidCount: bids.length, askCount: asks.length, lowIndex: first, highIndex: last - 1, marketIndex,
    minP: Math.min(...out.map(b => b.minP)), maxP: Math.max(...out.map(b => b.maxP)),
  };
}

/** Sum of the shape weights on each side (the nearest unit = 1), for linking the two deposits. */
export function sideWeights(layout: Pick<RangeLayout, 'bidCount' | 'askCount'>, shape: ShapeName = 'spot', strength: StrengthName = 'standard'): { bid: number; ask: number } {
  const sum = (n: number) => { let s = 0; for (let d = 1; d <= n; d++) s += shapeWeight(shape, strength, d, n); return s; };
  return { bid: sum(layout.bidCount), ask: sum(layout.askCount) };
}

/** Snap a "1 BCH = P" price to the nearest edge of the V4 bin grid at this step. */
export function snapToGrid(p: number, stepBps: number, decimals: number): number {
  if (!(p > 0)) return p;
  const sats = 1e8 / (p * 10 ** decimals);
  const level = Math.round(Math.log(sats) / Math.log1p(stepBps / 10_000));
  return tokensPerBchFromSats(gridPriceNum(stepBps, level), decimals);
}

/** Move a grid-snapped price by `n` bins (positive = higher P). */
export function stepOnGrid(p: number, n: number, stepBps: number, decimals: number): number {
  if (!(p > 0)) return p;
  const sats = 1e8 / (p * 10 ** decimals);
  const level = Math.round(Math.log(sats) / Math.log1p(stepBps / 10_000));
  // a higher P is a lower sats price: one level down
  return tokensPerBchFromSats(gridPriceNum(stepBps, level - n), decimals);
}

/**
 * Chart bins from a V3 strategy preview for one token: each pool is drawn
 * from its price to its trade-back price (or as a narrow bar without one),
 * its height its deposit's value in BCH.
 */
export function v3PreviewBins(pools: StrategyPoolPreview[], token: string, decimals: number): ChartBin[] {
  const out: Array<ChartBin & { value: number }> = [];
  for (const p of pools) {
    const m = (p.market ?? []).find(s => s.asset === token);
    if (!m?.satsPerToken) continue;
    const price = tokensPerBchFromSats(m.satsPerToken, decimals);
    const back = m.reverseSatsPerToken ? tokensPerBchFromSats(m.reverseSatsPerToken, decimals) : null;
    const side: ChartSide = m.side === 'buys' ? 'bch' : 'token';
    const half = price * 0.0015;
    const lo = back ? Math.min(price, back) : price - half;
    const hi = back ? Math.max(price, back) : price + half;
    const sats = Number(p.deposit.sats);
    const tokens = p.deposit.token ? Number(p.deposit.token.amount) : 0;
    const value = side === 'bch' ? sats : (tokens * m.satsPerToken);
    out.push({ key: p.role + ':' + p.address, minP: lo, maxP: hi, side, weight: 0, value, label: p.role });
  }
  const top = Math.max(1, ...out.map(o => o.value));
  return out.map(({ value, ...b }) => ({ ...b, weight: Math.max(0.12, value / top) })).sort((a, b) => a.minP - b.minP);
}

/** Other LPs' liquidity on the pair's bin grid, as faint background bars. */
export function depthBins(levels: DepthLevel[], stepBps: number, decimals: number): ChartBin[] {
  const rows = levels.map(l => {
    const sats = Number(l.satsPerToken);
    const pLo = tokensPerBchFromSats(sats * (1 + stepBps / 10_000), decimals);
    const pHi = tokensPerBchFromSats(sats, decimals);
    const bidValue = Number(l.bidSats);
    const askValue = Number(l.askTokens) * sats;
    return { key: `depth-${l.index}`, minP: Math.min(pLo, pHi), maxP: Math.max(pLo, pHi), bidValue, askValue };
  }).filter(r => r.bidValue > 0 || r.askValue > 0);
  const top = Math.max(1, ...rows.map(r => Math.max(r.bidValue, r.askValue)));
  return rows.map(r => ({
    key: r.key, minP: r.minP, maxP: r.maxP,
    side: (r.bidValue >= r.askValue ? 'bch' : 'token') as ChartSide,
    weight: Math.max(r.bidValue, r.askValue) / top,
  }));
}
