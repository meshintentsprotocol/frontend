/**
 * Every Mesh pool page URL, in one place (MeshDocs/meshv3v4flow/09 §2.1).
 *
 *   /mesh/positions[?view=pools]            my positions
 *   /mesh/pools[?view=pools|strategies]     pairs, all pools, all strategies
 *   /mesh/leaderboard[?view=fills]          providers / recent fills
 *   /mesh/new[?token=]                      create, step 1 (pair and goal)
 *   /mesh/new/:strategy[?token=&step=&engine=&replaces=]   create, steps 2–3
 *   /mesh/pair/:token                       one pair
 *   /mesh/strategy/:id · /mesh/position/:category · /mesh/pool/:address
 *
 * The old single page (/mesh?tab=…&view=…&template=…&replaces=…&token=…) maps
 * onto these with `legacyMeshTarget`, so shared links keep working.
 */

export type PositionsView = 'strategies' | 'pools';
export type PoolsView = 'pairs' | 'pools' | 'strategies';
export type LeaderboardView = 'providers' | 'fills';

export interface CreateQuery {
  token?: string;
  /** a pegged pair's second token / a multi-pair's further tokens */
  tokenB?: string;
  replaces?: string;
  step?: 2 | 3;
  engine?: 'v4' | 'v3';
}

const enc = encodeURIComponent;
const HEX64 = /^[0-9a-f]{64}$/i;

function query(q: Record<string, string | number | undefined>): string {
  const parts = Object.entries(q)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${enc(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

/** A token category from a URL, or undefined when it isn't one. */
export function tokenParam(raw: string | null | undefined): string | undefined {
  return raw && HEX64.test(raw) ? raw.toLowerCase() : undefined;
}

export const meshPaths = {
  positions: (view?: PositionsView) => `/mesh/positions${view === 'pools' ? '?view=pools' : ''}`,
  pools: (view?: PoolsView) => `/mesh/pools${view && view !== 'pairs' ? `?view=${view}` : ''}`,
  leaderboard: (view?: LeaderboardView) => `/mesh/leaderboard${view === 'fills' ? '?view=fills' : ''}`,
  /** `strategy` omitted: step 1. `custom` is the hand-built pool. */
  create: (strategy?: string, q: CreateQuery = {}) =>
    `/mesh/new${strategy ? `/${enc(strategy)}` : ''}${query({ token: q.token, tokenB: q.tokenB, step: q.step, engine: q.engine, replaces: q.replaces })}`,
  pair: (token: string) => `/mesh/pair/${enc(token)}`,
  strategy: (id: string) => `/mesh/strategy/${enc(id)}`,
  position: (category: string) => `/mesh/position/${enc(category)}`,
  pool: (address: string) => `/mesh/pool/${enc(address)}`,
};

/**
 * Where an old /mesh?tab=… URL now lives. `search` is the query string with or
 * without the leading '?'.
 */
export function legacyMeshTarget(search: string): string {
  const p = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const tab = p.get('tab');
  const view = p.get('view') ?? undefined;
  switch (tab) {
    case 'pools':
      return meshPaths.pools(view === 'pools' || view === 'strategies' ? view : undefined);
    case 'leaderboard':
      return meshPaths.leaderboard(view === 'fills' ? 'fills' : undefined);
    case 'create': {
      const template = p.get('template') ?? undefined;
      const token = tokenParam(p.get('token'));
      const replaces = p.get('replaces') ?? undefined;
      return meshPaths.create(template, { token, replaces });
    }
    case 'positions':
    case null:
    default:
      return meshPaths.positions(view === 'pools' ? 'pools' : undefined);
  }
}

/** Which Mesh section a pathname belongs to (for nav highlighting). */
export function meshSection(pathname: string): 'positions' | 'pools' | 'leaderboard' | 'create' | 'detail' | null {
  if (pathname === '/mesh' || pathname.startsWith('/mesh/positions')) return 'positions';
  if (pathname.startsWith('/mesh/pools') || pathname.startsWith('/mesh/pair/')) return 'pools';
  if (pathname.startsWith('/mesh/leaderboard') || pathname.startsWith('/mesh/provider/')) return 'leaderboard';
  if (pathname.startsWith('/mesh/new')) return 'create';
  if (/^\/mesh\/(strategy|position|pool)\//.test(pathname)) return 'detail';
  return null;
}
