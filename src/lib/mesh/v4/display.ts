/**
 * V4 display helpers: bins as chart bars, prices in "tokens per BCH", and the
 * genesis transactions still waiting to be registered (kept in the browser so
 * a position funded during a server hiccup is never lost from view).
 */
import type { DistributionBar } from '@/components/mesh/strategies/RangeDistribution';

/** Sats per token base unit → display tokens per BCH. */
export const tokenPerBch = (satsPerUnit: number, decimals: number) => (satsPerUnit > 0 ? 1e8 / (satsPerUnit * 10 ** decimals) : 0);

export interface BinLike { side?: 'bid' | 'ask'; bidSatsPerUnit: number; askSatsPerUnit: number; sats: string; tokens: string; label?: string }

/**
 * One bar per bin: a bin holding tokens is drawn at its ask (where it sells),
 * one holding BCH at its bid (where it buys), valued in BCH at that price.
 * A bin holding both (flipped in place by a partial fill) is drawn as two bars.
 */
export function binBars(bins: BinLike[], decimals: number, minSats = 1000n): DistributionBar[] {
  const out: DistributionBar[] = [];
  bins.forEach((b, k) => {
    const tokens = BigInt(b.tokens), sats = BigInt(b.sats);
    const role = b.label ?? `bin ${k}`;
    if (tokens > 0n) out.push({ tokenPerBch: tokenPerBch(b.askSatsPerUnit, decimals), bch: (Number(tokens) * b.askSatsPerUnit) / 1e8, side: 'ask', role });
    // BCH beyond the carrier an ask bin keeps: it buys at the bin's bid
    const bidSats = tokens > 0n ? sats - minSats : sats;
    if (tokens === 0n || bidSats > minSats) out.push({ tokenPerBch: tokenPerBch(b.bidSatsPerUnit, decimals), bch: Number(bidSats) / 1e8, side: 'bid', role });
  });
  return out.sort((a, b) => a.tokenPerBch - b.tokenPerBch);
}

// ── Pending registrations ───────────────────────────────────────────────────

export interface PendingV4 { category: string; genesisTxid: string; bins: unknown[]; pairName?: string; createdAt: number }
const KEY = 'mesh.v4.pending';

function read(): PendingV4[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as PendingV4[]; } catch { return []; }
}
function write(xs: PendingV4[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(xs.slice(-50))); } catch { /* storage unavailable: the toast still shows the txid */ }
}
export const pendingV4 = (): PendingV4[] => read();
export function addPendingV4(p: PendingV4): void { write([...read().filter(x => x.category !== p.category), p]); }
export function removePendingV4(category: string): void { write(read().filter(x => x.category !== category)); }

export const positionUrl = (category: string) => `/mesh/position/${category}`;
