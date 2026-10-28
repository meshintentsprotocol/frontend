import { describe, it, expect } from 'vitest';
import { depthBins, shapeWeight, sideWeights, snapToGrid, stepOnGrid, v3PreviewBins, v3RangeLayout, v4RangeLayout } from '../layout';
import { formatPriceEdge, satsFromTokensPerBch, tokensPerBchFromSats } from '../price';
import { v4Levels } from '../../v4/position';
import type { StrategyPoolPreview } from '../../meshApi';

// pUSD (2 decimals): market 1 BCH = 325.40 pUSD
const DEC = 2;
const sats = (p: number) => satsFromTokensPerBch(p, DEC);
const MID = 325.4;

describe('V4 range layout', () => {
  // the range form's server params: low = most tokens per BCH (= the max P), high = fewest (= the min P)
  const base = { lowSats: sats(MID * 1.05), highSats: sats(MID * 0.95), centerSats: sats(MID), stepBps: 50, decimals: DEC };

  it('matches the planner levels and puts BCH bins right of the market', () => {
    const l = v4RangeLayout(base);
    const lv = v4Levels(base.lowSats, base.highSats, base.centerSats, 50);
    expect(l.error).toBeUndefined();
    expect(l.bins).toHaveLength(lv.highIndex - lv.lowIndex + 1);
    expect(l.bidCount + l.askCount).toBe(l.bins.length);
    expect(l.bidCount).toBeGreaterThan(0);
    expect(l.askCount).toBeGreaterThan(0);
    for (const b of l.bins) {
      expect(b.maxP).toBeGreaterThan(b.minP);
      if (b.side === 'bch') expect(b.minP).toBeGreaterThanOrEqual(MID * 0.99);
      else expect(b.maxP).toBeLessThanOrEqual(MID * 1.01);
    }
    // every bin spans one 0.5% step
    expect(l.bins[0]!.maxP / l.bins[0]!.minP).toBeCloseTo(1.005, 4);
  });

  it('is one-sided when the market is outside the range', () => {
    const above = v4RangeLayout({ ...base, centerSats: sats(MID * 0.8) });
    expect(above.bidCount).toBe(above.bins.length);
    expect(above.askCount).toBe(0);
    const below = v4RangeLayout({ ...base, centerSats: sats(MID * 1.2) });
    expect(below.askCount).toBe(below.bins.length);
  });

  it('refuses ranges the planner refuses', () => {
    expect(v4RangeLayout({ ...base, lowSats: 0 }).error).toMatch(/Set the min/);
    expect(v4RangeLayout({ ...base, lowSats: base.highSats, highSats: base.lowSats }).error).toMatch(/max price must be above/);
    const wide = v4RangeLayout({ ...base, lowSats: sats(MID * 3), highSats: sats(MID / 3), stepBps: 10 });
    expect(wide.error).toMatch(/at most 128/);
    expect(v4RangeLayout({ ...base, maxBins: 5 }).error).toMatch(/at most 5/);
  });

  it('shapes the bars like the server', () => {
    expect(shapeWeight('spot', 'standard', 3, 4)).toBe(1);
    expect(shapeWeight('curve', 'standard', 1, 4)).toBeGreaterThan(shapeWeight('curve', 'standard', 3, 4));
    expect(shapeWeight('bidask', 'standard', 4, 4)).toBe(4);
    const curve = v4RangeLayout({ ...base, shape: 'curve' });
    expect(Math.max(...curve.bins.map(b => b.weight))).toBe(1);
    expect(Math.min(...curve.bins.map(b => b.weight))).toBeLessThan(0.5);
  });
});

describe('V3 range layout', () => {
  const base = { lowSats: sats(MID * 1.05), highSats: sats(MID * 0.95), centerSats: sats(MID), stepBps: 100, decimals: DEC, feeBps: 30 };

  it('puts a pool in BCH unless its buy price after the fee pays more than the market (server ladderPools)', () => {
    const l = v3RangeLayout(base);
    expect(l.error).toBeUndefined();
    expect(l.bins.length).toBe(l.bidCount + l.askCount);
    expect(l.bidCount).toBeGreaterThan(0);
    expect(l.askCount).toBeGreaterThan(0);
    for (const b of l.bins) {
      // the buy price is the pool's larger "1 BCH = P"
      if (b.side === 'bch') expect(b.maxP).toBeGreaterThanOrEqual(MID * 0.997 - 1e-9);
      else expect(b.maxP).toBeLessThan(MID * 0.997);
      expect(b.maxP / b.minP).toBeCloseTo(1.01, 4);
    }
    // every level between low and high, one pool per neighbouring pair
    const lg = Math.log1p(0.01);
    const n = Math.floor(Math.log(base.highSats) / lg + 1e-9) - Math.ceil(Math.log(base.lowSats) / lg - 1e-9);
    expect(l.bins).toHaveLength(n);
  });

  it('refuses more than 20 pools and empty ranges, like the server', () => {
    expect(v3RangeLayout({ ...base, lowSats: sats(MID * 1.15), highSats: sats(MID * 0.85), stepBps: 50 }).error).toMatch(/at most 20/);
    expect(v3RangeLayout({ ...base, lowSats: sats(MID * 1.001), highSats: sats(MID * 0.999) }).error).toMatch(/no full bin/);
    const above = v3RangeLayout({ ...base, centerSats: sats(MID * 0.8) });
    expect(above.askCount).toBe(0);
  });

  it('keeps the outer pools when snapped edges are rounded outward for the inputs', () => {
    // ±5% snapped to the 1% grid, as the presets do, then shown with 4 decimals
    const lo = formatPriceEdge(snapToGrid(MID * 0.95, 100, DEC), 'down');
    const hi = formatPriceEdge(snapToGrid(MID * 1.05, 100, DEC), 'up');
    const viaText = v3RangeLayout({ ...base, lowSats: sats(Number(hi)), highSats: sats(Number(lo)) });
    const exact = v3RangeLayout({ ...base, lowSats: sats(snapToGrid(MID * 1.05, 100, DEC)) * (1 - 1e-12), highSats: sats(snapToGrid(MID * 0.95, 100, DEC)) * (1 + 1e-12) });
    expect(viaText.bins.length).toBe(exact.bins.length);
    expect(viaText.minP).toBeCloseTo(snapToGrid(MID * 0.95, 100, DEC), 6);
  });

  it('sums shape weights per side for linking deposits', () => {
    expect(sideWeights({ bidCount: 3, askCount: 2 })).toEqual({ bid: 3, ask: 2 });
    const c = sideWeights({ bidCount: 4, askCount: 4 }, 'curve', 'standard');
    expect(c.bid).toBeCloseTo(c.ask, 9);
    expect(c.bid).toBeLessThan(4);
    expect(sideWeights({ bidCount: 0, askCount: 2 }).bid).toBe(0);
  });
});

describe('grid snapping', () => {
  it('snaps to bin edges and steps one bin at a time', () => {
    const s = snapToGrid(MID, 50, DEC);
    expect(snapToGrid(s, 50, DEC)).toBeCloseTo(s, 9);
    const up = stepOnGrid(s, 1, 50, DEC);
    expect(up / s).toBeCloseTo(1.005, 4);
    expect(stepOnGrid(up, -1, 50, DEC)).toBeCloseTo(s, 6);
    expect(stepOnGrid(s, 10, 50, DEC) / s).toBeCloseTo(1.005 ** 10, 3);
  });
});

describe('V3 preview and depth bars', () => {
  const pool = (role: string, side: 'buys' | 'sells', price: number, back: number | undefined, deposit: { sats: string; tokens?: string }): StrategyPoolPreview => ({
    role, contractName: 'MeshPoolV3', address: `addr-${role}`, tokenAddress: '', lockingBytecode: '', fundTo: '',
    deposit: { sats: deposit.sats, token: deposit.tokens ? { category: 'tok', amount: deposit.tokens } : undefined },
    v3: {} as any, registered: false,
    market: [{ asset: 'tok', side, satsPerToken: sats(price), reverseSatsPerToken: back ? sats(back) : undefined, vsMidBps: 0 }],
  });

  it('draws each pool from its price to its trade-back price', () => {
    const bins = v3PreviewBins([
      pool('bid', 'buys', 330, 335, { sats: '100000' }),
      pool('ask', 'sells', 320, undefined, { sats: '1000', tokens: '3000' }),
    ], 'tok', DEC);
    expect(bins).toHaveLength(2);
    const bid = bins.find(b => b.label === 'bid')!;
    expect(bid.side).toBe('bch');
    expect(bid.minP).toBeCloseTo(330, 6);
    expect(bid.maxP).toBeCloseTo(335, 6);
    const ask = bins.find(b => b.label === 'ask')!;
    expect(ask.side).toBe('token');
    expect(ask.maxP).toBeGreaterThan(ask.minP);
    expect(bins[0]!.minP).toBeLessThan(bins[1]!.minP);
  });

  it('turns pair depth into faint bars', () => {
    const d = depthBins([
      { index: 1, satsPerToken: String(sats(330)), bidSats: '50000', askTokens: '0', pools: 1, lps: 1 },
      { index: 2, satsPerToken: String(sats(320)), bidSats: '0', askTokens: '100', pools: 1, lps: 1 },
      { index: 3, satsPerToken: String(sats(310)), bidSats: '0', askTokens: '0', pools: 0, lps: 0 },
    ], 50, DEC);
    expect(d).toHaveLength(2);
    expect(d[0]!.side).toBe('bch');
    expect(d[1]!.side).toBe('token');
    expect(Math.max(...d.map(x => x.weight))).toBe(1);
    expect(tokensPerBchFromSats(sats(330), DEC)).toBeCloseTo(330, 6);
  });
});
