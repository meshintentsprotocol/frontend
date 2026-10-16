/**
 * V4 grid and position NFT commitment (port of meshserver src/pools/v4/grid.ts
 * and position.ts; checked against __fixtures__/positionNft.vectors.json).
 *
 * Grid: level i of a step s (bps) is the price r^i sats per token unit,
 * r = 1 + s/10000. A V4 bin at level i buys at level i and sells at level i+1.
 *
 * Commitment v1 (82 bytes): version 1 · flags (shape bits 0–2, variant bits
 * 3–5) · tokenCat (display order) · binStepBps LE2 · lowIndex, highIndex
 * (4-byte VM numbers) · binCount LE2 · managerHash · createdHeight LE4.
 */
import { hexToBin } from '@bitauth/libauth';
import { VARIANTS, type BinVariant } from './binV4';

// ── Grid ──────────────────────────────────────────────────────────────────────

export const Q = 64n;
export const ONE = 1n << Q;

/** Q64 grid price: the same integer the covenant computes (exponentiation by squaring, floor after every multiply). */
export function gridPrice(step: bigint | number, index: bigint | number): bigint {
  const s = BigInt(step);
  let e = BigInt(index);
  let base = (ONE * (10000n + s)) / 10000n;
  if (e < 0n) {
    base = (ONE * 10000n) / (10000n + s);
    e = -e;
  }
  let result = ONE;
  while (e > 0n) {
    if (e % 2n === 1n) result = (result * base) >> Q;
    base = (base * base) >> Q;
    e >>= 1n;
  }
  return result;
}

/** Grid price as a bytes8-sized fraction num/den with den a power of two, rounded down (bid) or up (ask). */
export function gridFraction(step: number, index: number, round: 'down' | 'up'): { num: bigint; den: bigint } {
  const p = gridPrice(step, index);
  let shift = 0n;
  while ((p >> shift) >= 1n << 62n) shift++;
  const den = ONE >> shift;
  if (den === 0n) throw new RangeError('price too large for a bytes8 fraction');
  const floor = p >> shift;
  const num = round === 'up' && (floor << shift) !== p ? floor + 1n : floor;
  // den = 2^(64-shift) must also fit bytes8 (< 2^63): drop one more bit of precision if needed.
  if (den >= 1n << 63n) {
    const n2 = round === 'up' ? (num + 1n) >> 1n : num >> 1n;
    return { num: n2, den: den >> 1n };
  }
  return { num, den };
}

/** Grid price in sats per token unit, as a number (display). */
export const gridPriceNum = (step: number, i: number) => Number(gridPrice(step, i)) / Number(ONE);

/** Grid level nearest a price in sats per token unit (the server's levelOf). */
export function levelOf(satsPerUnit: number, step: number): number {
  if (!(satsPerUnit > 0) || !Number.isFinite(satsPerUnit)) throw new RangeError('price must be a positive number of sats per token unit');
  return Math.round(Math.log(satsPerUnit) / Math.log1p(step / 10_000));
}

/**
 * V4 levels for a V3-style range [low, high] around `center` (sats per unit):
 * a V3 bin spans levels i..i+1 like a V4 bin at level i, so the V4 range ends
 * one level below the V3 top, and bins at or below the market level start as bids.
 * Same mapping as the server's V3 → V4 migration plan.
 */
export function v4Levels(low: number, high: number, center: number, step: number) {
  const lowIndex = levelOf(low, step);
  const highIndex = Math.max(lowIndex, levelOf(high, step) - 1);
  const marketIndex = levelOf(center, step) - 1;
  return { lowIndex, highIndex, marketIndex };
}

// ── Commitment ────────────────────────────────────────────────────────────────

export const COMMITMENT_V1_LEN = 82;
export const SHAPES = ['spot', 'curve', 'bidAsk', 'custom'] as const;
export type Shape = (typeof SHAPES)[number];

export interface PositionCommitment {
  version: 1;
  shape: Shape;
  variant: BinVariant;
  tokenCat: string;
  binStepBps: number;
  lowIndex: number;
  highIndex: number;
  binCount: number;
  managerHash: string;
  createdHeight: number;
}

export class PositionError extends Error {}

const is64 = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f]{64}$/.test(s);
const isInt = (x: unknown, lo: number, hi: number) => Number.isInteger(x) && (x as number) >= lo && (x as number) <= hi;
const leN = (v: number, bytes: number) => { let x = v, out = ''; for (let i = 0; i < bytes; i++) { out += (x % 256).toString(16).padStart(2, '0'); x = Math.floor(x / 256); } return out; };
/** 4-byte sign-magnitude VM number. */
const sle4 = (v: number) => { const h = leN(Math.abs(v), 4); return v < 0 ? h.slice(0, 6) + (parseInt(h.slice(6), 16) | 0x80).toString(16).padStart(2, '0') : h; };

export function validateCommitment(c: PositionCommitment): void {
  const fail = (m: string): never => { throw new PositionError(`invalid position commitment: ${m}`); };
  if (c.version !== 1) fail('version must be 1');
  if (!SHAPES.includes(c.shape)) fail(`unknown shape ${c.shape}`);
  if (!VARIANTS.includes(c.variant)) fail(`unknown variant ${c.variant}`);
  if (!is64(c.tokenCat)) fail('tokenCat must be 64 lowercase hex');
  if (!isInt(c.binStepBps, 1, 10_000)) fail('binStepBps must be 1..10000');
  if (!isInt(c.lowIndex, -(2 ** 31 - 1), 2 ** 31 - 1) || !isInt(c.highIndex, -(2 ** 31 - 1), 2 ** 31 - 1)) fail('indexes must fit a 4-byte VM number');
  if (c.lowIndex > c.highIndex) fail('lowIndex must be ≤ highIndex');
  if (!isInt(c.binCount, 1, 32_767)) fail('binCount must be 1..32767');
  if (!is64(c.managerHash)) fail('managerHash must be 64 lowercase hex (zeros for none)');
  if (!isInt(c.createdHeight, 0, 499_999_999)) fail('createdHeight must be a block height');
}

export function encodeCommitment(c: PositionCommitment): string {
  validateCommitment(c);
  const flags = SHAPES.indexOf(c.shape) | (VARIANTS.indexOf(c.variant) << 3);
  return '01' + flags.toString(16).padStart(2, '0') + c.tokenCat + leN(c.binStepBps, 2)
    + sle4(c.lowIndex) + sle4(c.highIndex) + leN(c.binCount, 2) + c.managerHash + leN(c.createdHeight, 4);
}

/** Strict decoder: anything but a well-formed v1 commitment throws. */
export function decodeCommitment(hex: string): PositionCommitment {
  const fail = (m: string): never => { throw new PositionError(`invalid position commitment: ${m}`); };
  if (!/^([0-9a-f]{2})*$/.test(hex)) fail('not lowercase hex');
  if (hex.length !== COMMITMENT_V1_LEN * 2) fail(`length ${hex.length / 2}, expected ${COMMITMENT_V1_LEN}`);
  const b = hexToBin(hex);
  if (b[0] !== 1) fail(`version ${b[0]}`);
  const flags = b[1]!;
  if (flags & 0xc0) fail('reserved flag bits set');
  if ((flags & 7) >= SHAPES.length) fail('unknown shape');
  if (((flags >> 3) & 7) >= VARIANTS.length) fail('unknown variant');
  const u = (o: number, n: number) => { let x = 0; for (let i = n - 1; i >= 0; i--) x = x * 256 + b[o + i]!; return x; };
  const s4 = (o: number) => { const mag = u(o, 4) % 0x80000000; return b[o + 3]! & 0x80 ? -mag : mag; };
  const c: PositionCommitment = {
    version: 1, shape: SHAPES[flags & 7]!, variant: VARIANTS[(flags >> 3) & 7]!,
    tokenCat: hex.slice(4, 68), binStepBps: u(34, 2), lowIndex: s4(36), highIndex: s4(40),
    binCount: u(44, 2), managerHash: hex.slice(92, 156), createdHeight: u(78, 4),
  };
  if (Object.is(c.lowIndex, -0) || Object.is(c.highIndex, -0)) fail('negative zero index');
  validateCommitment(c);
  return c;
}
