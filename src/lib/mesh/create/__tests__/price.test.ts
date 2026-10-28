import { describe, it, expect } from 'vitest';
import { bchPerToken, formatPrice, formatPriceEdge, formatPriceInput, parsePrice, priceAtPct, satsFromTokensPerBch, signedPct, tokensPerBchFromSats, vsMarketPct } from '../price';

describe('create-flow prices', () => {
  // pUSD has 2 decimals: 1 BCH = 325.40 pUSD ⇔ 1e8 / (325.40 × 100) ≈ 3073.14 sats per base unit
  const MID = 1e8 / (325.4 * 100);

  it('converts both ways', () => {
    expect(tokensPerBchFromSats(MID, 2)).toBeCloseTo(325.4, 6);
    expect(satsFromTokensPerBch(325.4, 2)).toBeCloseTo(MID, 6);
    expect(tokensPerBchFromSats(0, 2)).toBe(0);
    expect(bchPerToken(325.4)).toBeCloseTo(0.0030731, 6);
  });

  it('formats inputs by size', () => {
    expect(formatPriceInput(30804.123)).toBe('30804.12');
    expect(formatPriceInput(325.4)).toBe('325.4');
    expect(formatPriceInput(0.00123456789)).toBe('0.00123457');
    expect(formatPriceInput(0)).toBe('');
    expect(parsePrice('1.5')).toBe(1.5);
    expect(parsePrice('1,5')).toBeNaN();
    expect(parsePrice('0')).toBeNaN();
  });

  it('measures the token price against the market', () => {
    expect(vsMarketPct('325.4', 2, MID)).toBeCloseTo(0, 6);
    // fewer tokens per BCH = the token priced higher
    expect(vsMarketPct(String(325.4 / 1.02), 2, MID)).toBeCloseTo(2, 6);
    expect(vsMarketPct('325.4', 2, null)).toBeNull();
    expect(vsMarketPct('x', 2, MID)).toBeNull();
  });

  it('places a price a percentage from the market', () => {
    const p = priceAtPct(MID, 2, 2);
    expect(vsMarketPct(String(p), 2, MID)).toBeCloseTo(2, 6);
    expect(priceAtPct(MID, 2, 0)).toBeCloseTo(325.4, 6);
  });

  it('rounds range edges outward by one shown place', () => {
    expect(formatPriceEdge(256.45034, 'down')).toBe('256.4503');
    expect(formatPriceEdge(256.45034, 'up')).toBe('256.4504');
    expect(formatPriceEdge(30804.123, 'up')).toBe('30804.13');
    expect(formatPriceEdge(0.00123456789, 'down')).toBe('0.00123456');
    expect(formatPriceEdge(0, 'up')).toBe('');
  });

  it('prints signed percents and prices', () => {
    expect(signedPct(2)).toBe('+2.0%');
    expect(signedPct(-1.54)).toBe('−1.5%');
    expect(signedPct(0.01)).toBe('0.0%');
    expect(formatPrice(325.4)).toBe('325.40');
    expect(formatPrice(0.0030731)).toBe('0.003073');
    expect(formatPrice(0)).toBe('—');
  });
});
