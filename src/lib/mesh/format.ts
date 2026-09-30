/**
 * Amount parsing/formatting and explorer links for the Mesh pool pages.
 * Amounts stay in base units (bigint) until display.
 */
import type { BchNetwork } from './signer';

export const SATS_PER_BCH = 100_000_000n;

/** "0.015" → 1_500_000n. Throws on invalid input or more than `decimals` fraction digits. */
export function parseUnits(input: string, decimals: number): bigint {
  const t = input.trim();
  if (!/^\d*(\.\d*)?$/.test(t) || t === '' || t === '.') throw new Error('enter a number');
  const [i = '0', f = ''] = t.split('.');
  if (f.length > decimals) throw new Error(`at most ${decimals} decimal places`);
  return BigInt(i || '0') * 10n ** BigInt(decimals) + BigInt((f + '0'.repeat(decimals)).slice(0, decimals) || '0');
}

/** 1_500_000n, 8 → "0.015" (trailing zeros trimmed, at most `maxFrac` fraction digits). */
export function formatUnits(value: bigint | string | number, decimals: number, maxFrac = decimals): string {
  let v = BigInt(value);
  const neg = v < 0n;
  if (neg) v = -v;
  const scale = 10n ** BigInt(decimals);
  const int = v / scale;
  let frac = decimals > 0 ? (v % scale).toString().padStart(decimals, '0').slice(0, maxFrac) : '';
  frac = frac.replace(/0+$/, '');
  const intStr = int.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${neg ? '-' : ''}${intStr}${frac ? '.' + frac : ''}`;
}

export const parseBch = (input: string) => parseUnits(input, 8);
export const formatBch = (sats: bigint | string | number, maxFrac = 8) => formatUnits(sats, 8, maxFrac);

/** Sats as BCH with a unit, compact for small values ("12,345 sats" below 0.001 BCH). */
export function formatSatsCompact(sats: bigint | string | number): string {
  const v = BigInt(sats);
  const abs = v < 0n ? -v : v;
  if (abs < 100_000n) return `${formatUnits(v, 0)} sats`;
  return `${formatUnits(v, 8, abs >= SATS_PER_BCH ? 4 : 6)} BCH`;
}

export function satsToUsd(sats: bigint | string | number, bchUsd: number | null | undefined): number | null {
  if (!bchUsd) return null;
  return (Number(BigInt(sats)) / 1e8) * bchUsd;
}

export function formatUsd(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  if (Math.abs(v) >= 1000) return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPct(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${v.toFixed(digits)}%`;
}

export function formatNumber(v: number, maxFrac = 4): string {
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString(undefined, { maximumFractionDigits: maxFrac });
}

export function shortHex(s: string, head = 6, tail = 4): string {
  const body = s.includes(':') ? s.split(':')[1]! : s;
  return body.length <= head + tail + 1 ? body : `${body.slice(0, head)}…${body.slice(-tail)}`;
}

export function timeAgo(unixSec: number | null | undefined, now = Date.now() / 1000): string {
  if (!unixSec) return '—';
  const d = Math.max(0, Math.floor(now - unixSec));
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86_400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86_400)}d ago`;
}

export function explorerTx(network: BchNetwork, txid: string): string {
  return network === 'mainnet' ? `https://blockchair.com/bitcoin-cash/transaction/${txid}` : `https://chipnet.imaginary.cash/tx/${txid}`;
}

export function explorerAddress(network: BchNetwork, address: string): string {
  return network === 'mainnet' ? `https://blockchair.com/bitcoin-cash/address/${address}` : `https://chipnet.imaginary.cash/address/${address}`;
}
