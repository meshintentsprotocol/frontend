import { describe, it, expect } from 'vitest';
import { legacyMeshTarget, meshPaths, meshSection, tokenParam } from '../routes';

const TOKEN = '72559c652a3bee6e5c0c1c42dacdc32ab757bf52ea4ab765ed123b3185d58f48';

describe('mesh paths', () => {
  it('builds every page URL', () => {
    expect(meshPaths.positions()).toBe('/mesh/positions');
    expect(meshPaths.positions('pools')).toBe('/mesh/positions?view=pools');
    expect(meshPaths.pools()).toBe('/mesh/pools');
    expect(meshPaths.pools('pairs')).toBe('/mesh/pools');
    expect(meshPaths.pools('strategies')).toBe('/mesh/pools?view=strategies');
    expect(meshPaths.leaderboard('fills')).toBe('/mesh/leaderboard?view=fills');
    expect(meshPaths.create()).toBe('/mesh/new');
    expect(meshPaths.create(undefined, { token: TOKEN })).toBe(`/mesh/new?token=${TOKEN}`);
    expect(meshPaths.create('range', { token: TOKEN, step: 2, engine: 'v4' })).toBe(`/mesh/new/range?token=${TOKEN}&step=2&engine=v4`);
    expect(meshPaths.create('grid', { replaces: 'stg-abc' })).toBe('/mesh/new/grid?replaces=stg-abc');
    expect(meshPaths.pair(TOKEN)).toBe(`/mesh/pair/${TOKEN}`);
  });

  it('accepts only 64-hex token categories', () => {
    expect(tokenParam(TOKEN.toUpperCase())).toBe(TOKEN);
    expect(tokenParam('nope')).toBeUndefined();
    expect(tokenParam(null)).toBeUndefined();
  });
});

describe('legacy /mesh?tab= links', () => {
  it.each([
    ['', '/mesh/positions'],
    ['?tab=positions', '/mesh/positions'],
    ['?tab=positions&view=pools', '/mesh/positions?view=pools'],
    ['tab=pools', '/mesh/pools'],
    ['?tab=pools&view=strategies', '/mesh/pools?view=strategies'],
    ['?tab=pools&view=pools', '/mesh/pools?view=pools'],
    ['?tab=leaderboard', '/mesh/leaderboard'],
    ['?tab=leaderboard&view=fills', '/mesh/leaderboard?view=fills'],
    ['?tab=create', '/mesh/new'],
    [`?tab=create&token=${TOKEN}`, `/mesh/new?token=${TOKEN}`],
    ['?tab=create&template=fixed', '/mesh/new/fixed'],
    ['?tab=create&template=custom', '/mesh/new/custom'],
    [`?tab=create&template=range&token=${TOKEN}`, `/mesh/new/range?token=${TOKEN}`],
    ['?tab=create&template=grid&replaces=stg-123', '/mesh/new/grid?replaces=stg-123'],
    ['?tab=create&token=bad', '/mesh/new'],
    ['?tab=whatever', '/mesh/positions'],
  ])('%s → %s', (search, target) => {
    expect(legacyMeshTarget(search)).toBe(target);
  });
});

describe('sections', () => {
  it('maps pathnames to the nav section', () => {
    expect(meshSection('/mesh')).toBe('positions');
    expect(meshSection('/mesh/positions')).toBe('positions');
    expect(meshSection('/mesh/pools')).toBe('pools');
    expect(meshSection(`/mesh/pair/${TOKEN}`)).toBe('pools');
    expect(meshSection('/mesh/new/range')).toBe('create');
    expect(meshSection('/mesh/leaderboard')).toBe('leaderboard');
    expect(meshSection('/mesh/strategy/stg-1')).toBe('detail');
    expect(meshSection('/orderbook')).toBeNull();
  });
});
