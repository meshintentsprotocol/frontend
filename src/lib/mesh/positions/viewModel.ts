/**
 * Unified Position ViewModel (MeshDocs/meshv3v4flow/09 §3.2):
 * Merges V3 strategies, V4 positions (NFT-owned discrete bins), and standalone V3 pools
 * into a single unified PositionRow list with consistent metrics, coverage, and manage URLs.
 */
import type { Pool, StrategySummary } from '@/lib/mesh/meshApi';
import type { V4PositionView } from '@/lib/mesh/v4/types';
import { meshPaths } from '@/lib/mesh/routes';
import { calculateCoverage, type CoverageStatus } from './coverage';
import { tokensPerBchFromSats } from '@/lib/mesh/create/price';
import { gridPriceNum } from '@/lib/mesh/v4/position';
import { satsToUsd } from '@/lib/mesh/format';
import { STRATEGIES, type StrategyId } from '@/lib/mesh/create/registry';

export interface PositionChild {
  id: string;
  name: string;
  role?: string;
  status: string;
  sats: bigint;
  tokens?: bigint;
  tokenSymbol?: string;
  priceText?: string;
  url?: string;
}

export interface PositionRow {
  id: string;
  kind: 'v4' | 'v3-strategy' | 'v3-pool';
  engine: 'v4' | 'v3';
  pairLabel: string;
  tokenCat?: string;
  tokenSymbol: string;
  strategyName: string;
  strategyId?: string;
  status: CoverageStatus;
  originalStatus: string;
  valueSats: bigint;
  valueUsd: number | null;
  fees7dSats: bigint;
  fees7dUsd: number | null;
  pnlSats?: bigint;
  // Range bar metrics (in tokens per 1 BCH or rate)
  minPrice?: number | null;
  maxPrice?: number | null;
  marketPrice?: number | null;
  // Children breakdown
  poolsCount: number;
  activePoolsCount: number;
  url: string;
  children: PositionChild[];
}

export interface PositionsSummary {
  totalValueSats: bigint;
  totalValueUsd: number | null;
  fees7dSats: bigint;
  fees7dUsd: number | null;
  inRangeCount: number;
  totalActive: number;
  inRangePct: number | null;
}

export interface ViewModelOptions {
  v3Strategies?: StrategySummary[];
  v4Positions?: V4PositionView[];
  standalonePools?: Pool[];
  tokenInfo?: (category: string) => { symbol: string; decimals: number };
  marketRef?: (category: string) => { midSatsPerToken?: number | null; midTpb?: number | null };
  bchUsd?: number | null;
  idleStrategyIds?: string[];
}

export function buildPositionsViewModel(opts: ViewModelOptions): {
  rows: PositionRow[];
  summary: PositionsSummary;
} {
  const {
    v3Strategies = [],
    v4Positions = [],
    standalonePools = [],
    tokenInfo = (cat: string) => ({ symbol: cat === '0x' ? 'BCH' : 'Token', decimals: 8 }),
    marketRef = () => ({ midSatsPerToken: null, midTpb: null }),
    bchUsd = null,
    idleStrategyIds = [],
  } = opts;

  const rows: PositionRow[] = [];

  // 1. Process V4 positions
  for (const pos of v4Positions) {
    const tokenCat = pos.commitment.tokenCat;
    const info = tokenInfo(tokenCat);
    const mkt = marketRef(tokenCat);

    // Calculate low and high prices for V4 bins
    const lowSats = gridPriceNum(pos.commitment.binStepBps, pos.commitment.lowIndex);
    const highSats = gridPriceNum(pos.commitment.binStepBps, pos.commitment.highIndex);
    const minP = tokensPerBchFromSats(highSats, info.decimals);
    const maxP = tokensPerBchFromSats(lowSats, info.decimals);

    const valSats = BigInt(pos.totals.valueAtBidSats || pos.totals.sats || '0');
    const hasBch = BigInt(pos.totals.sats) > 0n;
    const hasTokens = BigInt(pos.totals.tokens) > 0n;

    const coverage = calculateCoverage({
      minPrice: minP,
      maxPrice: maxP,
      marketPrice: mkt.midTpb,
      hasBch,
      hasTokens,
      totalValueSats: valSats,
    });

    const activeBins = pos.bins.filter(b => BigInt(b.sats) > 0n || BigInt(b.tokens) > 0n).length;

    // Children: group bins or list active bins
    const children: PositionChild[] = pos.bins
      .filter(b => BigInt(b.sats) > 0n || BigInt(b.tokens) > 0n)
      .map(b => {
        const sats = BigInt(b.sats);
        const tokens = BigInt(b.tokens);
        const tpb = tokensPerBchFromSats(b.ask.satsPerUnit || b.bid.satsPerUnit, info.decimals);
        return {
          id: `${pos.category}-${b.index}`,
          name: `Bin #${b.index}`,
          role: sats > 0n ? 'Bid (BCH)' : 'Ask (Token)',
          status: sats > 0n || tokens > 0n ? 'active' : 'empty',
          sats,
          tokens,
          tokenSymbol: info.symbol,
          priceText: tpb > 0 ? `1 BCH = ${tpb.toFixed(2)} ${info.symbol}` : undefined,
        };
      });

    rows.push({
      id: pos.category,
      kind: 'v4',
      engine: 'v4',
      pairLabel: `BCH / ${info.symbol}`,
      tokenCat,
      tokenSymbol: info.symbol,
      strategyName: 'Range (V4)',
      strategyId: 'range',
      status: coverage,
      originalStatus: valSats > 0n ? 'active' : 'closed',
      valueSats: valSats,
      valueUsd: satsToUsd(valSats, bchUsd),
      fees7dSats: 0n,
      fees7dUsd: null,
      minPrice: minP,
      maxPrice: maxP,
      marketPrice: mkt.midTpb,
      poolsCount: pos.bins.length,
      activePoolsCount: activeBins,
      url: meshPaths.position(pos.category),
      children,
    });
  }

  // 2. Process V3 strategies
  for (const stg of v3Strategies) {
    const templateId = (stg.template as StrategyId) || 'range';
    const def = STRATEGIES[templateId];
    const name = def?.name ?? stg.template;

    // Find main token category
    const poolCats = stg.pools.map(p => p.role).filter(Boolean);
    const tokenCat = (stg.params?.token as string) || (stg.params?.token1 as string) || (stg.params?.tokenA as string) || '';
    const info = tokenInfo(tokenCat);
    const mkt = marketRef(tokenCat);

    const valSats = BigInt(stg.valueSats || '0');
    const fees7d = BigInt(stg.fees7dSats || '0');
    const pnl = BigInt(stg.pnlSats || '0');

    let minP: number | null = null;
    let maxP: number | null = null;
    if (stg.metrics?.range) {
      minP = tokensPerBchFromSats(stg.metrics.range.high, info.decimals);
      maxP = tokensPerBchFromSats(stg.metrics.range.low, info.decimals);
    }

    const isIdle = idleStrategyIds.includes(stg.id) || !!stg.idle;

    const coverage = calculateCoverage({
      status: stg.status,
      minPrice: minP,
      maxPrice: maxP,
      marketPrice: mkt.midTpb,
      isIdle,
      totalValueSats: valSats,
    });

    const children: PositionChild[] = stg.pools.map(p => ({
      id: p.address,
      name: p.address.slice(0, 10) + '…',
      role: p.role,
      status: p.status,
      sats: 0n,
      url: meshPaths.pool(p.address),
    }));

    rows.push({
      id: stg.id,
      kind: 'v3-strategy',
      engine: 'v3',
      pairLabel: def?.pair === 'token-token' ? 'Token / Token' : `BCH / ${info.symbol}`,
      tokenCat,
      tokenSymbol: info.symbol,
      strategyName: name,
      strategyId: stg.template,
      status: coverage,
      originalStatus: stg.status,
      valueSats: valSats,
      valueUsd: satsToUsd(valSats, bchUsd),
      fees7dSats: fees7d,
      fees7dUsd: satsToUsd(fees7d, bchUsd),
      pnlSats: pnl,
      minPrice: minP,
      maxPrice: maxP,
      marketPrice: mkt.midTpb,
      poolsCount: stg.poolCount,
      activePoolsCount: stg.activePools,
      url: meshPaths.strategy(stg.id),
      children,
    });
  }

  // 3. Process Standalone V3 Pools
  for (const pool of standalonePools) {
    const valSats = BigInt(pool.valueSats || '0');
    const reserveIsBch = pool.v3?.reserve === '0x';
    const firstSlot = pool.v3?.slots[0];
    const tokenCat = reserveIsBch && firstSlot ? firstSlot.cat : pool.v3?.reserve || '';
    const info = tokenInfo(tokenCat);
    const mkt = marketRef(tokenCat);

    const coverage = calculateCoverage({
      status: pool.status,
      totalValueSats: valSats,
    });

    rows.push({
      id: pool.address,
      kind: 'v3-pool',
      engine: 'v3',
      pairLabel: reserveIsBch ? `BCH / ${info.symbol}` : `${info.symbol} pool`,
      tokenCat,
      tokenSymbol: info.symbol,
      strategyName: 'Custom pool',
      status: coverage,
      originalStatus: pool.status,
      valueSats: valSats,
      valueUsd: satsToUsd(valSats, bchUsd),
      fees7dSats: 0n,
      fees7dUsd: null,
      marketPrice: mkt.midTpb,
      poolsCount: 1,
      activePoolsCount: pool.status === 'active' ? 1 : 0,
      url: meshPaths.pool(pool.address),
      children: [],
    });
  }

  // Calculate totals
  let totalValueSats = 0n;
  let fees7dSats = 0n;
  let inRangeCount = 0;
  let totalActive = 0;

  for (const r of rows) {
    totalValueSats += r.valueSats;
    fees7dSats += r.fees7dSats;
    if (r.status !== 'closed') {
      totalActive++;
      if (r.status === 'in-range') {
        inRangeCount++;
      }
    }
  }

  const inRangePct = totalActive > 0 ? Math.round((inRangeCount / totalActive) * 100) : null;

  return {
    rows,
    summary: {
      totalValueSats,
      totalValueUsd: satsToUsd(totalValueSats, bchUsd),
      fees7dSats,
      fees7dUsd: satsToUsd(fees7dSats, bchUsd),
      inRangeCount,
      totalActive,
      inRangePct,
    },
  };
}
