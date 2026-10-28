/**
 * Price helpers for the create flow. The LP reads and types "1 BCH = P tokens";
 * the server stores sats per token base unit. "vs market" is always the token's
 * price against the market mid (the same convention as the server's vsMidBps):
 * +2% means the token is priced 2% above the market, i.e. fewer tokens per BCH.
 */

/** sats per token base unit → whole tokens per BCH. */
export function tokensPerBchFromSats(satsPerUnit: number, decimals: number): number {
  return satsPerUnit > 0 && Number.isFinite(satsPerUnit) ? 1e8 / (satsPerUnit * 10 ** decimals) : 0;
}

/** whole tokens per BCH → sats per token base unit. */
export function satsFromTokensPerBch(tokensPerBch: number, decimals: number): number {
  return tokensPerBch > 0 && Number.isFinite(tokensPerBch) ? 1e8 / (tokensPerBch * 10 ** decimals) : 0;
}

/** A "1 BCH = P tokens" value as an input string: 2 decimals from 1,000, 4 from 1, up to 8 below. */
export function formatPriceInput(tokensPerBch: number): string {
  if (!(tokensPerBch > 0) || !Number.isFinite(tokensPerBch)) return '';
  const d = tokensPerBch >= 1000 ? 2 : tokensPerBch >= 1 ? 4 : 8;
  return tokensPerBch.toFixed(d).replace(/\.?0+$/, '');
}

/** Parse an input string; NaN when it isn't a positive number. */
export function parsePrice(text: string | undefined): number {
  const t = (text ?? '').trim();
  if (!/^\d+(\.\d+)?$/.test(t)) return NaN;
  const v = Number(t);
  return v > 0 ? v : NaN;
}

/** The token's price vs the market, in percent, for a "1 BCH = P" input; null without both. */
export function vsMarketPct(tokensPerBchText: string | undefined, decimals: number, midSatsPerUnit: number | null | undefined): number | null {
  const p = parsePrice(tokensPerBchText);
  if (!(p > 0) || !midSatsPerUnit || !(midSatsPerUnit > 0)) return null;
  const sats = satsFromTokensPerBch(p, decimals);
  return (sats / midSatsPerUnit - 1) * 100;
}

/** The "1 BCH = P" value that prices the token `pct` percent from the market. */
export function priceAtPct(midSatsPerUnit: number, decimals: number, pct: number): number {
  return tokensPerBchFromSats(midSatsPerUnit * (1 + pct / 100), decimals);
}

/** "1 TOKEN = x BCH" for a "1 BCH = P" value. */
export function bchPerToken(tokensPerBch: number): number {
  return tokensPerBch > 0 ? 1 / tokensPerBch : 0;
}

/** Signed percent text: "+2.0%", "−1.5%", "0.0%". */
export function signedPct(pct: number, digits = 1): string {
  const v = Math.abs(pct) < 0.5 * 10 ** -digits ? 0 : pct;
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(digits)}%`;
}

/** A price with its natural number of decimals for display ("325.40", "0.003073"). */
export function formatPrice(v: number): string {
  if (!(v > 0) || !Number.isFinite(v)) return '—';
  const d = v >= 1000 ? 2 : v >= 1 ? 2 : v >= 0.01 ? 4 : 6;
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
