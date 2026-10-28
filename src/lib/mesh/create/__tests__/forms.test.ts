import { describe, it, expect } from 'vitest';
import { CHIPNET_MUSD, CHIPNET_PUSD, depositFields, formDefaults, mainTokenOf, priceKeysFor, suggestQueryFor, tokenCatsOf, tokenValuesOf, trialDeposits } from '../forms';

const TOK = '72559c652a3bee6e5c0c1c42dacdc32ab757bf52ea4ab765ed123b3185d58f48';

describe('form defaults', () => {
  it('starts on the token the LP came with, else pUSD; second tokens get MUSD on chipnet', () => {
    expect(formDefaults('range', 'chipnet').token).toBe(CHIPNET_PUSD);
    expect(formDefaults('range', 'chipnet', { token: TOK.toUpperCase() }).token).toBe(TOK);
    const peg = formDefaults('stable-pair', 'chipnet');
    expect([peg.tokenA, peg.tokenB]).toEqual([CHIPNET_PUSD, CHIPNET_MUSD]);
    expect(formDefaults('stable-pair', 'chipnet', { token: CHIPNET_MUSD }).tokenB).toBe(CHIPNET_PUSD);
    const multi = formDefaults('multi-pair', 'chipnet', { token: TOK });
    expect([multi.token1, multi.token2, multi.token3]).toEqual([TOK, CHIPNET_MUSD, undefined]);
    expect(formDefaults('range', 'mainnet', { mainnetPusd: 'aa'.repeat(32) }).token).toBe('aa'.repeat(32));
    expect(formDefaults('stable-pair', 'mainnet', { mainnetPusd: 'aa'.repeat(32) }).tokenB).toBe('');
  });

  it('keeps field defaults', () => {
    const d = formDefaults('grid', 'chipnet');
    expect(d.rungs).toBe('4');
    expect(d.feeBps).toBe('30');
    expect(d.shape).toBe('spot');
    expect(formDefaults('range', 'chipnet').binStepBps).toBe('100');
  });
});

describe('trial deposits', () => {
  it('fills only the deposit fields the choices use', () => {
    expect(depositFields('fixed', { side: 'ask' }).map(f => f.key)).toEqual(['depositTokens']);
    const t = trialDeposits('fixed', { side: 'bid', price: '300' });
    expect(t.deposit).toBe('1');
    expect(t.depositTokens).toBeUndefined();
    expect(t.price).toBe('300');
    const r = trialDeposits('range', {}, 'bch');
    expect([r.depositBch, r.depositTokens]).toEqual(['1', '']);
    const both = trialDeposits('grid', {});
    expect([both.depositBch, both.depositTokens]).toEqual(['1', '1000000']);
  });
});

describe('suggest queries and tokens', () => {
  it('asks /suggest per template once its tokens are set', () => {
    expect(suggestQueryFor('range', { token: TOK })).toEqual({ template: 'range', token: TOK });
    expect(suggestQueryFor('range', {})).toBeNull();
    expect(suggestQueryFor('multi-pair', { token1: TOK, token2: CHIPNET_PUSD })).toEqual({ template: 'multi-pair', tokens: [TOK, CHIPNET_PUSD] });
    expect(suggestQueryFor('stable-pair', { tokenA: CHIPNET_PUSD })).toBeNull();
  });

  it('reads a stored strategy’s tokens for a rebalance', () => {
    expect(tokenValuesOf('grid', { token: TOK })).toEqual({ token: TOK });
    expect(tokenValuesOf('multi-pair', { tokens: [{ token: TOK }, { token: CHIPNET_PUSD }] })).toEqual({ token1: TOK, token2: CHIPNET_PUSD });
    expect(tokenValuesOf('stable-pair', { tokenA: CHIPNET_PUSD, tokenB: 'nope' })).toEqual({ tokenA: CHIPNET_PUSD });
    expect(mainTokenOf({ tokenA: CHIPNET_PUSD })).toBe(CHIPNET_PUSD);
    expect(tokenCatsOf('stable-pair', { tokenA: CHIPNET_PUSD, tokenB: CHIPNET_MUSD })).toEqual([CHIPNET_PUSD, CHIPNET_MUSD]);
  });

  it('knows which prices follow a token', () => {
    expect(priceKeysFor('range', 'token').sort()).toEqual(['center', 'high', 'low']);
    expect(priceKeysFor('multi-pair', 'token2')).toEqual(['price2']);
    expect(priceKeysFor('stable-pair', 'tokenA')).toEqual(['rate']);
  });
});
