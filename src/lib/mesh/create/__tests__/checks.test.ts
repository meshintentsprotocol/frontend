import { describe, it, expect } from 'vitest';
import { gapPct, settingsCheck } from '../checks';

const sym = (k: string) => ({ token: 'pUSD', token1: 'pUSD', token2: 'MUSD', token3: 'TT', tokenA: 'pUSD', tokenB: 'MUSD' }[k] ?? '?');

describe('step 2 checks', () => {
  it('fixed: price, and a trade-back price on the right side when recycling', () => {
    expect(settingsCheck('fixed', { side: 'bid', price: '' }, sym)).toMatch(/Set your price/);
    expect(settingsCheck('fixed', { side: 'bid', price: '270', proceeds: 'wallet' }, sym)).toBeNull();
    expect(settingsCheck('fixed', { side: 'bid', price: '270', proceeds: 'recycle' }, sym)).toMatch(/trade-back/);
    // a buy recycles by selling dearer: fewer tokens per BCH
    expect(settingsCheck('fixed', { side: 'bid', price: '270', proceeds: 'recycle', recyclePrice: '275' }, sym)).toMatch(/fewer pUSD per BCH/);
    expect(settingsCheck('fixed', { side: 'bid', price: '270', proceeds: 'recycle', recyclePrice: '265' }, sym)).toBeNull();
    expect(settingsCheck('fixed', { side: 'ask', price: '265', proceeds: 'recycle', recyclePrice: '260' }, sym)).toMatch(/more pUSD per BCH/);
    expect(settingsCheck('fixed', { side: 'ask', price: '265', proceeds: 'recycle', recyclePrice: '270' }, sym)).toBeNull();
  });

  it('two prices: the buy gives more tokens per BCH than the sell', () => {
    expect(settingsCheck('spread', { bid: '272', ask: '266' }, sym)).toBeNull();
    expect(settingsCheck('spread', { bid: '266', ask: '272' }, sym)).toMatch(/buy price must give more pUSD/);
    expect(settingsCheck('recycling-pair', { buy: '266', sell: '272' }, sym)).toMatch(/buy price/);
    expect(settingsCheck('recycling-pair', { buy: '272', sell: '266' }, sym)).toBeNull();
    expect(settingsCheck('grid', { low: '280', high: '260' }, sym)).toBeNull();
    expect(settingsCheck('grid', { low: '260', high: '280' }, sym)).toMatch(/max price/);
  });

  it('ladders run away from the market', () => {
    expect(settingsCheck('take-profit', { from: '264', to: '236' }, sym)).toBeNull();
    expect(settingsCheck('take-profit', { from: '236', to: '264' }, sym)).toMatch(/fewer pUSD per BCH/);
    expect(settingsCheck('accumulate', { from: '275', to: '316' }, sym)).toBeNull();
    expect(settingsCheck('accumulate', { from: '316', to: '275' }, sym)).toMatch(/more pUSD per BCH/);
  });

  it('multi-pair and pegged pair', () => {
    expect(settingsCheck('multi-pair', { token1: 'aa', price1: '1' }, sym)).toMatch(/two tokens/);
    expect(settingsCheck('multi-pair', { token1: 'aa', price1: '1', token2: 'AA', price2: '2' }, sym)).toMatch(/once/);
    expect(settingsCheck('multi-pair', { token1: 'aa', price1: '1', token2: 'bb', price2: '' }, sym)).toMatch(/price for MUSD/);
    expect(settingsCheck('multi-pair', { token1: 'aa', price1: '1', token2: 'bb', price2: '2' }, sym)).toBeNull();
    expect(settingsCheck('stable-pair', { tokenA: 'aa', tokenB: 'aa', rate: '1' }, sym)).toMatch(/differ/);
    expect(settingsCheck('stable-pair', { tokenA: 'aa', tokenB: 'bb', rate: '' }, sym)).toMatch(/rate/);
    expect(settingsCheck('stable-pair', { tokenA: 'aa', tokenB: 'bb', rate: '1', spreadBps: '2.5' }, sym)).toMatch(/whole number/);
    expect(settingsCheck('stable-pair', { tokenA: 'aa', tokenB: 'bb', rate: '1', spreadBps: '20' }, sym)).toBeNull();
  });

  it('measures a round-trip gap', () => {
    expect(gapPct(272.7, 267.3)).toBeCloseTo(2.02, 2);
    expect(gapPct(0, 1)).toBeNull();
  });
});
