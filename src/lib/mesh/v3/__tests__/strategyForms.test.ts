import { describe, it, expect } from 'vitest';
import { TEMPLATE_FORMS, decimalOf, fromServerParams, satsPerUnitFromTokenPerBch, toBaseUnits, toServerParams, tokenPerBchText } from '../strategyForms';

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
    expect(TEMPLATE_FORMS.map(f => f.id)).toEqual(['fixed', 'spread', 'multi-pair', 'stable-pair', 'recycling-pair', 'grid', 'range', 'take-profit', 'accumulate']);
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
    expect(() => toServerParams('accumulate', { token: PUSD, from: '400', to: '600', steps: '4', feeBps: '30' }, dec)).toThrow(/deposit is required/);
    expect(() => toServerParams('range', { token: PUSD, low: '600', high: '400', feeBps: '30' }, dec)).toThrow(/price is required/);
  });

  it('grid: the market price and both deposits are sent only when given', () => {
    const p = toServerParams('grid', { token: PUSD, low: '520', high: '480', rungs: '4', center: '500', depositBch: '0.0006', depositTokens: '2', feeBps: '30' }, dec) as any;
    expect(p).toMatchObject({ centerSatsPerToken: '2000', depositSats: '60000', depositTokens: '200' });
    const bare = toServerParams('grid', { token: PUSD, low: '520', high: '480', rungs: '4', depositBch: '0.0006', feeBps: '30' }, dec) as any;
    expect(bare.centerSatsPerToken).toBeUndefined();
    expect(bare.depositTokens).toBeUndefined();
  });

  it('range: bin step, shape and the market price', () => {
    const p = toServerParams('range', { token: PUSD, low: '520', high: '480', center: '500', binStepBps: '50', shape: 'curve', strength: 'aggressive', depositBch: '0.01', depositTokens: '5', feeBps: '30' }, dec) as any;
    expect(p).toMatchObject({ centerSatsPerToken: '2000', binStepBps: '50', shape: 'curve', strength: 'aggressive', depositSats: '1000000', depositTokens: '500' });
    // spot is the server's default: not sent
    const spot = toServerParams('range', { token: PUSD, low: '520', high: '480', center: '500', shape: 'spot', depositBch: '0.01', feeBps: '30' }, dec) as any;
    expect(spot.shape).toBeUndefined();
    expect(spot.binStepBps).toBe('100');
  });

  it('take-profit and accumulate can keep proceeds in Mesh', () => {
    const p = toServerParams('take-profit', { token: PUSD, from: '480', to: '400', steps: '3', depositTokens: '3', proceeds: 'recycle', feeBps: '30' }, dec) as any;
    expect(p.proceeds).toBe('recycle');
    const w = toServerParams('accumulate', { token: PUSD, from: '520', to: '600', steps: '3', depositBch: '0.0003', proceeds: 'wallet', feeBps: '30' }, dec) as any;
    expect(w.proceeds).toBeUndefined();
  });
});

describe('suggestions → form → server params', () => {
  // what GET /strategies/suggest returns around a 3250 sats-per-unit pUSD mid (MUSD 32.5)
  const SUGGESTED: Record<string, Record<string, unknown>> = {
    fixed: { token: PUSD, side: 'bid', satsPerToken: '3233.75', feeBps: 30 },
    spread: { token: PUSD, bidSatsPerToken: '3233.75', askSatsPerToken: '3266.25', feeBps: 30, proceeds: 'recycle' },
    'multi-pair': { tokens: [{ token: PUSD, satsPerToken: '3233.75' }, { token: MUSD, satsPerToken: '32.3375' }], feeBps: 30 },
    'stable-pair': { tokenA: PUSD, tokenB: MUSD, rate: '100', spreadBps: 20, feeBps: 10 },
    'recycling-pair': { token: PUSD, start: 'bch', buySatsPerToken: '3217.5', sellSatsPerToken: '3282.5', feeBps: 30 },
    grid: { token: PUSD, lowSatsPerToken: '3087.5', highSatsPerToken: '3412.5', rungs: 4, centerSatsPerToken: '3250', feeBps: 30 },
    range: { token: PUSD, lowSatsPerToken: '3087.5', highSatsPerToken: '3412.5', centerSatsPerToken: '3250', binStepBps: '100', shape: 'curve', strength: 'standard', feeBps: 30 },
    'take-profit': { token: PUSD, fromSatsPerToken: '3315', toSatsPerToken: '3737.5', steps: 4, feeBps: 30 },
    accumulate: { token: PUSD, fromSatsPerToken: '3185', toSatsPerToken: '2762.5', steps: 4, feeBps: 30 },
  };
  const DEPOSITS: Record<string, Record<string, string>> = {
    fixed: { deposit: '0.01' }, spread: { depositBch: '0.01', depositTokens: '5' }, 'multi-pair': { depositBch: '0.01' },
    'stable-pair': { depositA: '5', depositB: '5' }, 'recycling-pair': { depositBch: '0.01' }, grid: { depositBch: '0.04', depositTokens: '5' },
    range: { depositBch: '0.04', depositTokens: '5' },
    'take-profit': { depositTokens: '8' }, accumulate: { depositBch: '0.04' },
  };
  const close = (a: unknown, b: unknown) => Math.abs(Number(a) / Number(b) - 1) < 1e-3;

  it.each(Object.keys(SUGGESTED))('%s: prices survive the round trip (within rounding)', id => {
    const tokens: Record<string, string> = { token: PUSD, token1: PUSD, token2: MUSD, tokenA: PUSD, tokenB: MUSD };
    const form = { ...tokens, ...fromServerParams(id, SUGGESTED[id]!, dec, tokens), ...DEPOSITS[id] };
    const back = toServerParams(id, form, dec) as Record<string, any>;
    for (const [k, v] of Object.entries(SUGGESTED[id]!)) {
      if (k === 'tokens') (v as any[]).forEach((t, i) => expect(close(back.tokens[i].satsPerToken, t.satsPerToken)).toBe(true));
      else if (/[sS]atsPerToken$|^rate$/.test(k)) expect(close(back[k], v)).toBe(true);
      else if (k !== 'token' && k !== 'tokenA' && k !== 'tokenB' && k !== 'side' && k !== 'start') expect(String(back[k])).toBe(String(v));
    }
  });

  it('"1 BCH = P tokens" text: 4–6 significant digits', () => {
    expect(tokenPerBchText('3250', 2)).toBe('307.6923');
    expect(tokenPerBchText('0', 2)).toBeUndefined();
  });
});
