import { describe, it, expect } from 'vitest';
import { bchMaxReserve, linkedSats, linkedTokens } from '../linked';
import { satsFromTokensPerBch } from '../price';

// pUSD (2 decimals) at 1 BCH = 325.40 pUSD
const MID = satsFromTokensPerBch(325.4, 2);

describe('linked range deposits', () => {
  it('gives equal value with the same weight each side', () => {
    // 1 BCH ↔ 325.40 pUSD (32,540 base units)
    expect(Number(linkedTokens(100_000_000n, { bid: 5, ask: 5 }, MID))).toBeCloseTo(32_540, -1);
    expect(Number(linkedSats(32_540n, { bid: 5, ask: 5 }, MID))).toBeCloseTo(100_000_000, -3);
  });

  it('scales by the weight on each side so every bin holds the same value', () => {
    const t = linkedTokens(120_000_000n, { bid: 12, ask: 8 }, MID);
    // 8/12 of 1.2 BCH = 0.8 BCH of pUSD
    expect(Number(t)).toBeCloseTo(0.8 * 32_540, -1);
    const back = linkedSats(t, { bid: 12, ask: 8 }, MID);
    expect(Number(back)).toBeGreaterThan(119_990_000);
    expect(back).toBeLessThanOrEqual(120_000_000n);
  });

  it('is zero when a side is empty or there is no market', () => {
    expect(linkedTokens(100_000n, { bid: 0, ask: 4 }, MID)).toBe(0n);
    expect(linkedTokens(100_000n, { bid: 4, ask: 0 }, MID)).toBe(0n);
    expect(linkedTokens(100_000n, { bid: 4, ask: 4 }, null)).toBe(0n);
    expect(linkedSats(0n, { bid: 4, ask: 4 }, MID)).toBe(0n);
  });

  it('keeps room for carriers, the fee and the V4 NFT on Max', () => {
    expect(bchMaxReserve(0, 'v3')).toBe(5_000n);
    expect(bchMaxReserve(4, 'v3')).toBe(9_000n);
    expect(bchMaxReserve(4, 'v4')).toBe(10_800n);
  });
});
