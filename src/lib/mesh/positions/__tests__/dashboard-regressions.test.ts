import { describe, it, expect } from 'vitest';
import { buildPositionsViewModel, strategyTokenCategories } from '../viewModel';
import { gridPriceNum } from '../../v4/position';
import { tokensPerBchFromSats } from '../../create/price';

describe('position dashboard regressions', () => {
  it('does not count a strategy child pool again as standalone liquidity', () => {
    const result = buildPositionsViewModel({
      v3Strategies: [{ id: 'strategy-1', template: 'range', params: { token: 'token-1' }, status: 'active', valueSats: '100000', fees7dSats: '25', pools: [{ address: 'child-pool', status: 'active' }], poolCount: 1, activePools: 1 } as any],
      standalonePools: [
        { address: 'child-pool', status: 'active', valueSats: '100000' } as any,
        { address: 'independent-pool', status: 'active', valueSats: '50000' } as any,
      ],
    });
    expect(result.rows.map(row => row.id)).toEqual(['strategy-1', 'independent-pool']);
    expect(result.summary.totalValueSats).toBe(150000n);
    expect(result.summary.fees7dSats).toBe(25n);
  });

  it('includes the final V4 bin ask boundary in the displayed range', () => {
    const low = tokensPerBchFromSats(gridPriceNum(100, 21), 0);
    const previousLow = tokensPerBchFromSats(gridPriceNum(100, 20), 0);
    const result = buildPositionsViewModel({
      v4Positions: [{ category: 'position-1', commitment: { tokenCat: 'token-1', binStepBps: 100, lowIndex: 10, highIndex: 20 }, totals: { sats: '100000', tokens: '0', valueAtBidSats: '100000' }, bins: [] } as any],
      tokenInfo: () => ({ symbol: 'TOK', decimals: 0 }),
      marketRef: () => ({ midTpb: (low + previousLow) / 2 }),
    });
    expect(result.rows[0].minPrice).toBe(low);
    expect(result.rows[0].status).toBe('in-range');
  });
});

it('uses indexed multi-pair token categories in the dashboard label', () => {
  const strategy = { id: 'multi-1', template: 'multi-pair', params: { tokens: [{ token: 'AAA' }, { token: 'BBB' }] }, status: 'active', valueSats: '100000', pools: [], poolCount: 1, activePools: 1 } as any;
  expect(strategyTokenCategories(strategy)).toEqual(['aaa', 'bbb']);
  const result = buildPositionsViewModel({
    v3Strategies: [strategy],
    tokenInfo: category => ({ symbol: category === 'aaa' ? 'USD' : 'TOK', decimals: 0 }),
  });
  expect(result.rows[0].pairLabel).toBe('BCH / USD / TOK');
  expect(result.rows[0].tokenCat).toBe('aaa');
});