/**
 * Which engine a strategy uses (MeshDocs/meshv3v4flow/09 §2.3).
 *
 * - Range: V4 bins by default, V3 pools on request; V3 only when rebalancing
 *   an existing V3 strategy (that is one V3 transaction).
 * - Grid and recycling pair: V4 once the server's V4 planner accepts bins
 *   whose buy and sell prices are not neighbouring grid levels (build phase
 *   I7, VITE_MESH_V4_LADDERS=1); V3 until then.
 * - Everything else: V3 (one token per V4 bin, no proceeds output).
 * The server's per-version pause turns V4 off: a 503 on the V4 preview.
 */
import type { StrategyId } from './registry';
import { STRATEGIES } from './registry';

export type Engine = 'v4' | 'v3';

export interface EngineCaps {
  /** the server serves V4 previews (no 503 seen) */
  v4Enabled: boolean;
  /** the server's V4 planner takes grid / recycling-pair bins (phase I7) */
  v4Ladders: boolean;
}

/** Engine caps from the build config; v4Enabled may be turned off at runtime by a 503. */
export function defaultEngineCaps(env: Record<string, string | undefined> = import.meta.env as any): EngineCaps {
  return { v4Enabled: env?.VITE_MESH_V4 !== '0', v4Ladders: env?.VITE_MESH_V4_LADDERS === '1' };
}

/** Engines this strategy can use now, best first. */
export function enginesFor(id: StrategyId, caps: EngineCaps, opts: { replaces?: string } = {}): Engine[] {
  const def = STRATEGIES[id];
  if (!def.engines.includes('v4') || opts.replaces || !caps.v4Enabled) return ['v3'];
  if (id === 'range') return ['v4', 'v3'];
  if ((id === 'grid' || id === 'recycling-pair') && caps.v4Ladders) return ['v4', 'v3'];
  return ['v3'];
}

/** The engine to use: the one asked for when allowed, else the default. */
export function pickEngine(id: StrategyId, caps: EngineCaps, wanted?: string | null, opts: { replaces?: string } = {}): Engine {
  const allowed = enginesFor(id, caps, opts);
  return wanted === 'v4' || wanted === 'v3' ? (allowed.includes(wanted) ? wanted : allowed[0]!) : allowed[0]!;
}
