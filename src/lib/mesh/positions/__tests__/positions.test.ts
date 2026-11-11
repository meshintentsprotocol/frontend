import { describe, it, expect } from 'vitest';
import { calculateCoverage, coverageBadge } from '../coverage';
import { buildPositionsViewModel } from '../viewModel';

describe('coverage calculations', () => {
  it('identifies in-range positions when market is between min and max', () => {
    const status = calculateCoverage({
      minPrice: 250,
      maxPrice: 350,
      marketPrice: 300,
      totalValueSats: 1000000n,
    });
    expect(status).toBe('in-range');
  });

  it('identifies out-of-range positions when market price is outside bounds', () => {
    const statusHigh = calculateCoverage({
      minPrice: 250,
      maxPrice: 350,
      marketPrice: 400,
      totalValueSats: 1000000n,
    });
    expect(statusHigh).toBe('out-of-range');

    const statusLow = calculateCoverage({
      minPrice: 250,
      maxPrice: 350,
      marketPrice: 200,
      totalValueSats: 1000000n,
    });
    expect(statusLow).toBe('out-of-range');
  });

  it('marks closed when status is closed or totalValue is 0', () => {
    expect(calculateCoverage({ status: 'closed', totalValueSats: 1000n })).toBe('closed');
    expect(calculateCoverage({ totalValueSats: 0n })).toBe('closed');
  });

  it('marks idle when flagged', () => {
    expect(calculateCoverage({ isIdle: true, totalValueSats: 5000n })).toBe('idle');
  });

  it('badge returns correct labels and tones', () => {
    expect(coverageBadge('in-range')).toEqual({ label: 'In range', tone: 'emerald' });
    expect(coverageBadge('out-of-range')).toEqual({ label: 'Out of range', tone: 'amber' });
    expect(coverageBadge('idle')).toEqual({ label: 'Idle funds', tone: 'amber' });
    expect(coverageBadge('closed')).toEqual({ label: 'Closed', tone: 'zinc' });
  });
});

describe('buildPositionsViewModel', () => {
  it('aggregates V4 positions, V3 strategies and standalone pools into rows', () => {
    const v4Positions: any[] = [
      {
        category: 'v4cat1',
        genesisTxid: 'tx1',
        commitment: {
          tokenCat: 'tok1',
          binStepBps: 100,
          lowIndex: 10,
          highIndex: 20,
          binCount: 11,
          shape: 'spot',
        },
        totals: { sats: '500000', tokens: '1000', valueAtBidSats: '1000000', bins: 11, binsWithTokens: 5 },
        bins: [
          {
            index: 10,
            address: 'addr1',
            sats: '500000',
            tokens: '0',
            bid: { satsPerUnit: 100 },
            ask: { satsPerUnit: 100 },
          },
        ],
      },
    ];

    const v3Strategies: any[] = [
      {
        id: 'stg-1',
        template: 'range',
        ownerPkh: 'pkh1',
        status: 'active',
        poolCount: 3,
        activePools: 3,
        valueSats: '2000000',
        fees7dSats: '15000',
        pools: [{ address: 'paddr1', role: 'bid', status: 'active' }],
      },
    ];

    const standalonePools: any[] = [
      {
        address: 'pooladdr1',
        contractName: 'MeshPoolV3',
        valueSats: '500000',
        status: 'active',
        v3: { reserve: '0x', slots: [{ cat: 'tok1' }] },
      },
    ];

    const vm = buildPositionsViewModel({
      v4Positions,
      v3Strategies,
      standalonePools,
      tokenInfo: () => ({ symbol: 'pUSD', decimals: 2 }),
      marketRef: () => ({ midTpb: 300 }),
      bchUsd: 400,
    });

    expect(vm.rows).toHaveLength(3);
    expect(vm.rows[0].kind).toBe('v4');
    expect(vm.rows[0].engine).toBe('v4');
    expect(vm.rows[1].kind).toBe('v3-strategy');
    expect(vm.rows[1].engine).toBe('v3');
    expect(vm.rows[2].kind).toBe('v3-pool');
    expect(vm.summary.totalValueSats).toBe(3500000n);
    expect(vm.summary.totalActive).toBe(3);
  });
});
