/**
 * Pools that were funded on-chain but not yet registered with the server
 * (e.g. the server was unreachable right after the broadcast). The funds are
 * safe in the covenant either way; this list lets the UI finish registration
 * later. Stored per browser; the chain remains the source of truth.
 */
import type { RegisterItem } from './meshApi';

const KEY = 'mesh_pending_pool_registrations_v2';

export interface PendingRegistration {
  txid: string;
  items: RegisterItem[];
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
