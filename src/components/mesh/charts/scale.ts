/**
 * Scales for the Mesh charts: one function maps a value to a pixel and back,
 * so marks, handles and labels share one scale (and keyboard steps, drags and
 * inputs agree).
 */

export interface Scale {
  (v: number): number;
  invert(px: number): number;
  domain: [number, number];
  range: [number, number];
}

export function linearScale(domain: [number, number], range: [number, number]): Scale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  const f = ((v: number) => r0 + (v - d0) * k) as Scale;
  f.invert = (px: number) => (k === 0 ? d0 : d0 + (px - r0) / k);
  f.domain = domain;
  f.range = range;
  return f;
}

/** Log scale for prices that span a wide ratio (positive domain only). */
export function logScale(domain: [number, number], range: [number, number]): Scale {
  const [d0, d1] = domain.map(v => Math.log(Math.max(v, Number.MIN_VALUE))) as [number, number];
  const lin = linearScale([d0, d1], range);
  const f = ((v: number) => lin(Math.log(Math.max(v, Number.MIN_VALUE)))) as Scale;
  f.invert = (px: number) => Math.exp(lin.invert(px));
  f.domain = domain;
  f.range = range;
  return f;
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** About `count` round tick values covering [min, max]. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!(max > min) || !Number.isFinite(min) || !Number.isFinite(max)) return [min];
  const span = max - min;
  const raw = span / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  // the smallest of 1, 2, 5, 10 (× mag) that is at least the raw step
  const step = (norm > 5 ? 10 : norm > 2 ? 5 : norm > 1 ? 2 : 1) * mag;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) out.push(Number(v.toPrecision(12)));
  return out;
}
