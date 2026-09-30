import { describe, it, expect } from 'vitest';
import { TEMPLATE_FORMS, decimalOf, satsPerUnitFromTokenPerBch, toBaseUnits, toServerParams } from '../strategyForms';

const PUSD = 'dfe50223c8d5cba8dcef8dff6d92b61deb88a8ba44947367f2b746487b56039b';
const MUSD = 'b4863d5773c7a269b6fe3b9f7ce2ce1098ab71c0b046ef2a39058d5e30b1f353';
const dec = () => 2;

describe('unit conversions', () => {
  it('"1 BCH = 500 pUSD" (2 decimals) = 2000 sats per base unit', () => {
    expect(satsPerUnitFromTokenPerBch('500', 2)).toBe('2000');
    expect(satsPerUnitFromTokenPerBch('300', 2)).toBe('3333.333333333333');
  });
  it('exact decimals and base units', () => {
    expect(decimalOf(1n, 400n)).toBe('0.0025');
    expect(toBaseUnits('1.25', 8)).toBe(125_000_000n);
    expect(toBaseUnits('12', 2)).toBe(1200n);
    expect(() => toBaseUnits('1.234', 2)).toThrow(/at most 2/);
  });
});

describe('template params', () => {
  it('every template has a form', () => {
    expect(TEMPLATE_FORMS.map(f => f.id)).toEqual(['fixed', 'spread', 'multi-pair', 'stable-pair', 'recycling-pair', 'grid', 'take-profit', 'accumulate']);
  });

  it('fixed bid / ask', () => {
    expect(toServerParams('fixed', { token: PUSD, side: 'bid', price: '500', deposit: '0.001', feeBps: '30' }, dec))
      .toEqual({ token: PUSD, side: 'bid', satsPerToken: '2000', feeBps: 30, deposit: '100000' });
    expect(toServerParams('fixed', { token: PUSD, side: 'ask', price: '480', depositTokens: '2.5', feeBps: '30' }, dec))
      .toMatchObject({ side: 'ask', deposit: '250' });
  });

  it('recycling pair: buy more tokens per BCH than the sell price', () => {
    const p = toServerParams('recycling-pair', { token: PUSD, buy: '500', sell: '400', start: 'bch', depositBch: '0.0003', feeBps: '30' }, dec);
    expect(p).toMatchObject({ buySatsPerToken: '2000', sellSatsPerToken: '2500', start: 'bch', deposit: '30000' });
  });

  it('multi-pair skips the optional third token', () => {
    const p = toServerParams('multi-pair', { token1: PUSD, price1: '500', token2: MUSD, price2: '502', depositBch: '0.0008', feeBps: '30' }, dec) as any;
    expect(p.tokens).toHaveLength(2);
    expect(p.depositSats).toBe('80000');
  });

  it('stable pair rate converts whole tokens to base units', () => {
    const p = toServerParams('stable-pair', { tokenA: PUSD, tokenB: MUSD, rate: '1', depositB: '50', feeBps: '10', spreadBps: '20' }, dec) as any;
    expect(p.rate).toBe('1');
    expect(p.depositB).toBe('5000');
    expect(p.depositA).toBeUndefined();
  });

  it('missing fields are reported by label', () => {
    expect(() => toServerParams('grid', { token: PUSD, low: '600', high: '400', rungs: '4', feeBps: '30' }, dec)).toThrow(/deposit is required/);
  });
});
