/**
 * Pools that were funded on-chain but not yet registered with the server
 * (e.g. the server was unreachable right after the broadcast). The funds are
 * safe in the covenant either way; this list lets the UI finish registration
 * later. Stored per browser; the chain remains the source of truth.
 *
 * One entry per funding transaction: V2 pools (`items`), V3 pools (`v3Items`)
 * or a whole strategy (`strategy`, registered by txid).
 */
import type { MeshApi, RegisterItem, RegisterItemV3, StrategyInput } from './meshApi';

const KEY = 'mesh_pending_pool_registrations_v2';

export interface PendingRegistration {
  txid: string;
  items?: RegisterItem[];
  v3Items?: RegisterItemV3[];
  strategy?: StrategyInput & { replaces?: string };
  createdAt: number;
  lastError?: string;
}

export function loadPending(): PendingRegistration[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingRegistration[]) : [];
  } catch {
    return [];
  }
}

function store(list: PendingRegistration[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage unavailable: nothing to persist */ }
}

export function addPending(p: PendingRegistration): void {
  store([...loadPending().filter(x => x.txid !== p.txid), p]);
}

export function removePending(txid: string): void {
  store(loadPending().filter(x => x.txid !== txid));
}

/** What a pending entry holds, in words. */
export function describePending(p: PendingRegistration): string {
  if (p.strategy) return `${p.strategy.template} strategy`;
  const n = (p.items?.length ?? 0) + (p.v3Items?.length ?? 0);
  return `${n} pool${n === 1 ? '' : 's'}`;
}

/** Register a pending entry; resolves to the first pool address or the strategy id. */
export async function registerPending(api: MeshApi, p: PendingRegistration): Promise<{ address?: string; strategyId?: string }> {
  if (p.strategy) {
    const r = await api.registerStrategy({ ...p.strategy, txid: p.txid });
    return { strategyId: r.strategy.id, address: r.strategy.pools[0]?.address };
  }
  const r = p.v3Items?.length ? await api.registerV3(p.v3Items) : await api.register(p.items ?? []);
  if (!r.success) throw new Error(r.error ?? 'registration failed');
  return { address: r.pools[0]?.address };
}

/** Register with retries: the server may not see a fresh transaction for a few seconds. */
export async function registerWithRetry<T>(fn: () => Promise<T>, attempts = 8, delayMs = 3_000): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e: any) {
      last = e;
      const status = e?.status;
      const retryable = status === 404 || status === 0 || status === 502 || (typeof status === 'number' && status >= 500);
      if (!retryable) throw e;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw last;
}
