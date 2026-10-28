import { describe, it, expect, beforeEach } from 'vitest';
import { GOALS, STRATEGIES, STRATEGY_GROUPS, STRATEGY_IDS, goalOf, isStrategyId } from '../registry';
import { enginesFor, pickEngine, defaultEngineCaps } from '../engine';
import { depositCards, oneSidedNote } from '../deposits';
import { clearDraft, draftKey, loadDraft, saveDraft } from '../draft';
import { TEMPLATE_FORMS } from '../../v3/strategyForms';
import { clamp, linearScale, logScale, niceTicks } from '@/components/mesh/charts/scale';

const ON = { v4Enabled: true, v4Ladders: false };

describe('strategy registry', () => {
  it('covers every server template plus the custom pool', () => {
    const templates = STRATEGY_IDS.map(id => STRATEGIES[id].template).filter(Boolean).sort();
    expect(templates).toEqual(TEMPLATE_FORMS.map(f => f.id).sort());
    expect(STRATEGIES.custom.template).toBeNull();
  });

  it('puts every strategy under exactly one goal or the advanced group', () => {
    for (const id of STRATEGY_IDS) {
      const goals = GOALS.filter(g => g.strategies.includes(id));
      if (id === 'custom') expect(goals).toHaveLength(0);
      else expect(goals).toHaveLength(1);
      expect(STRATEGY_GROUPS.some(g => g.strategies.includes(id))).toBe(true);
    }
    expect(goalOf('grid')?.id).toBe('range');
    expect(isStrategyId('range')).toBe(true);
    expect(isStrategyId('nope')).toBe(false);
  });
});

describe('engine choice', () => {
  it('range defaults to V4, V3 when rebalancing or when V4 is off', () => {
    expect(enginesFor('range', ON)).toEqual(['v4', 'v3']);
    expect(enginesFor('range', ON, { replaces: 'stg-1' })).toEqual(['v3']);
    expect(enginesFor('range', { v4Enabled: false, v4Ladders: true })).toEqual(['v3']);
  });

  it('grid and recycling pair use V4 only with ladder support', () => {
    expect(enginesFor('grid', ON)).toEqual(['v3']);
    expect(enginesFor('grid', { v4Enabled: true, v4Ladders: true })).toEqual(['v4', 'v3']);
    expect(enginesFor('recycling-pair', { v4Enabled: true, v4Ladders: true })[0]).toBe('v4');
    expect(enginesFor('fixed', { v4Enabled: true, v4Ladders: true })).toEqual(['v3']);
  });

  it('honours an allowed request, else the default', () => {
    expect(pickEngine('range', ON, 'v3')).toBe('v3');
    expect(pickEngine('range', ON, null)).toBe('v4');
    expect(pickEngine('fixed', ON, 'v4')).toBe('v3');
  });

  it('reads the build flags', () => {
    expect(defaultEngineCaps({})).toEqual({ v4Enabled: true, v4Ladders: false });
    expect(defaultEngineCaps({ VITE_MESH_V4: '0', VITE_MESH_V4_LADDERS: '1' })).toEqual({ v4Enabled: false, v4Ladders: true });
  });
});

describe('deposit cards', () => {
  const sym = (k: string) => (k === 'tokenA' ? 'pUSD' : k === 'tokenB' ? 'MUSD' : 'pUSD');

  it('fixed: one card for the side', () => {
    expect(depositCards('fixed', { side: 'bid' }, { symbol: sym }).map(c => c.key)).toEqual(['deposit']);
    const ask = depositCards('fixed', { side: 'ask' }, { symbol: sym });
    expect(ask.map(c => c.key)).toEqual(['depositTokens']);
    expect(ask[0]!.label).toBe('pUSD this order sells');
    expect(ask[0]!.required).toBe(true);
  });

  it('recycling pair: one card for the start side', () => {
    expect(depositCards('recycling-pair', { start: 'token' }).map(c => c.key)).toEqual(['depositTokens']);
    expect(depositCards('recycling-pair', { start: 'bch' }).map(c => c.key)).toEqual(['depositBch']);
  });

  it('range: both sides, labels count the bins, one-sided drops a card', () => {
    const both = depositCards('range', {}, { bidCount: 10, askCount: 10, symbol: sym, marketText: '325.40' }, 'v4');
    expect(both.map(c => c.label)).toEqual(['BCH for the 10 bins above 325.40', 'pUSD for the 10 bins below 325.40']);
    expect(depositCards('range', {}, { bidCount: 2, askCount: 3, symbol: sym }, 'v3')[1]!.label).toBe('pUSD for the 3 pools below the price');
    const bidOnly = depositCards('range', {}, { bidCount: 6, askCount: 0, symbol: sym }, 'v4');
    expect(bidOnly.map(c => c.key)).toEqual(['depositBch']);
    expect(oneSidedNote('range', { bidCount: 6, askCount: 0 }, 'pUSD')).toMatch(/only needs BCH/);
    expect(oneSidedNote('range', { bidCount: 0, askCount: 4 }, 'pUSD')).toMatch(/only needs pUSD/);
    expect(oneSidedNote('range', { bidCount: 2, askCount: 4 }, 'pUSD')).toBeNull();
    expect(depositCards('grid', {}, { bidCount: 1, askCount: 3, symbol: sym })[0]!.label).toBe('BCH for the 1 rung above the price');
  });

  it('pegged pair: a card per token, both optional; multi-pair: the shared reserve', () => {
    const peg = depositCards('stable-pair', {}, { symbol: sym });
    expect(peg.map(c => [c.asset, c.required])).toEqual([['tokenA', false], ['tokenB', false]]);
    expect(depositCards('multi-pair', {}).map(c => c.label)).toEqual(['BCH reserve, shared by every token']);
    expect(depositCards('custom', {})).toEqual([]);
  });
});

describe('drafts', () => {
  beforeEach(() => { try { sessionStorage.clear(); } catch { /* no storage in this environment */ } });

  it('round-trips form values and clears', () => {
    const k = draftKey('range', 'abc');
    saveDraft(k, { low: '300', high: '350' });
    const back = loadDraft(k);
    if (typeof sessionStorage === 'undefined') { expect(back).toBeNull(); return; }
    expect(back).toEqual({ low: '300', high: '350' });
    clearDraft(k);
    expect(loadDraft(k)).toBeNull();
  });
});

describe('chart scales', () => {
  it('maps and inverts', () => {
    const s = linearScale([0, 10], [0, 200]);
    expect(s(5)).toBe(100);
    expect(s.invert(50)).toBe(2.5);
    const l = logScale([1, 100], [0, 100]);
    expect(l(10)).toBeCloseTo(50, 6);
    expect(l.invert(50)).toBeCloseTo(10, 6);
    expect(clamp(5, 0, 3)).toBe(3);
  });

  it('gives round ticks', () => {
    expect(niceTicks(0, 100, 5)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(niceTicks(309.1, 341.7, 4)).toEqual([310, 320, 330, 340]);
    expect(niceTicks(5, 5)).toEqual([5]);
  });
});
