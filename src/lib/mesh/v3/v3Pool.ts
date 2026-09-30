/**
 * MeshPoolV3 pools — encoding, contract construction, pricing.
 *
 * Mirrors meshserver/src/pools/v3/v3Contracts.ts; both are checked against
 * the contracts repo's vectors (__fixtures__/meshPoolV3.vectors.json), so the
 * address computed here is the one the server verifies. Pure module: runs in
 * the browser, tests and live scripts.
 *
 * A V3 pool holds only its reserve (BCH or one token) and accepts 1–3 assets,
 * each at its own price. What it receives goes to a proceeds output at
 * outputs[i + N]: the owner's wallet (mode 0), a fixed pool (mode 1) or the
 * mirror pool that sells it back (mode 2, recycling). The covenant enforces
 *   out · den · 10000 ≤ in · num · (10000 − fee)   for the slot of the asset paid.
 */
import { Contract, type NetworkProvider } from 'cashscript';
import { binToHex, cashAddressToLockingBytecode, sha256, utf8ToBin } from '@bitauth/libauth';
import artifactJson from '../artifacts/MeshPoolV3.json';
import { normCategory, stripHex, fitSafe, parseDecimal, type Fraction } from '../pool';

export const POOL_V3 = 'MeshPoolV3' as const;
export const V3_ARTIFACT = artifactJson as any;
/** Sats a BCH reserve keeps after every fill. */
export const V3_MIN_SATS = 1000n;
const MAX_INT = (1n << 63n) - 1n;
const ZERO32 = '00'.repeat(32);

export type ProceedsMode = 0 | 1 | 2;
export const MODE_NAMES = ['owner', 'fixed', 'mirror'] as const;

export interface V3Slot { cat: string; num: bigint; den: bigint; rNum: bigint; rDen: bigint }

export interface V3Params {
  ownerPkh: string;      // 40-hex lowercase
  reserve: string;       // '0x' or 64-hex
  slots: V3Slot[];       // 1..3
  feeBps: number;
  mode: ProceedsMode;
  proceedsHash: string;  // 64-hex; zeros unless mode 1
}

/** Server / API form (integers as decimal strings). */
export interface V3ParamsJson {
  ownerPkh: string; reserve: string; feeBps: number; mode: ProceedsMode; proceedsHash: string;
  slots: Array<{ cat: string; num: string; den: string; rNum: string; rDen: string }>;
}

const big = (v: unknown): bigint => (typeof v === 'bigint' ? v : v === undefined || v === null || v === '' ? 0n : BigInt(String(v)));

export function parseV3Params(j: any): V3Params {
  return {
    ownerPkh: stripHex(String(j?.ownerPkh ?? '')).toLowerCase(),
    reserve: normCategory(j?.reserve),
    slots: (j?.slots ?? []).map((s: any) => ({ cat: normCategory(s?.cat), num: big(s?.num), den: big(s?.den), rNum: big(s?.rNum), rDen: big(s?.rDen) })),
    feeBps: Number(j?.feeBps ?? 30),
    mode: Number(j?.mode ?? 0) as ProceedsMode,
    proceedsHash: stripHex(String(j?.proceedsHash ?? ZERO32)).toLowerCase(),
  };
}

export function v3ToJson(p: V3Params): V3ParamsJson {
  return {
    ownerPkh: p.ownerPkh, reserve: p.reserve, feeBps: p.feeBps, mode: p.mode, proceedsHash: p.proceedsHash,
    slots: p.slots.map(s => ({ cat: s.cat, num: s.num.toString(), den: s.den.toString(), rNum: s.rNum.toString(), rDen: s.rDen.toString() })),
  };
}

/** Same rules as the server; null when valid. */
export function validateV3Params(p: V3Params): string | null {
  const isCat = (c: string) => c === '0x' || /^[0-9a-f]{64}$/.test(c);
  if (!/^[0-9a-f]{40}$/.test(p.ownerPkh)) return 'ownerPkh must be 20-byte hex';
  if (!isCat(p.reserve)) return 'reserve must be BCH or a 64-hex token category';
  if (p.slots.length < 1 || p.slots.length > 3) return 'a pool accepts 1 to 3 assets';
  if (!Number.isInteger(p.feeBps) || p.feeBps < 0 || p.feeBps >= 10000) return 'fee must be 0–9999 bps';
  if (![0, 1, 2].includes(p.mode)) return 'unknown proceeds mode';
  const seen = new Set<string>();
  for (const [k, s] of p.slots.entries()) {
    if (!isCat(s.cat)) return `asset ${k + 1}: invalid category`;
    if (s.cat === p.reserve) return `asset ${k + 1}: a pool cannot accept its own reserve asset`;
    if (seen.has(s.cat)) return `asset ${k + 1}: listed twice`;
    seen.add(s.cat);
    if (s.num <= 0n || s.den <= 0n) return `asset ${k + 1}: price must be > 0`;
    for (const v of [s.num, s.den, s.rNum, s.rDen]) if (v < 0n || v > MAX_INT) return `asset ${k + 1}: price too large`;
    if (p.mode === 2 && (s.rNum <= 0n || s.rDen <= 0n)) return `asset ${k + 1}: recycling needs a sell-back price`;
  }
  if (!/^[0-9a-f]{64}$/.test(p.proceedsHash)) return 'proceedsHash must be 32-byte hex';
  if (p.mode === 1 && p.proceedsHash === ZERO32) return 'fixed-destination mode needs a destination pool';
  if (p.mode !== 1 && p.proceedsHash !== ZERO32) return 'proceedsHash is only used with a fixed destination';
  return null;
}

// ── Encoding ─────────────────────────────────────────────────────────────────

export const catVm = (c: string) => (normCategory(c) === '0x' ? ZERO32 : normCategory(c).match(/.{2}/g)!.reverse().join(''));

export function le(v: bigint | number, bytes: number): string {
  let x = BigInt(v);
  if (x < 0n || x >= 1n << BigInt(bytes * 8 - 1)) throw new Error(`value ${v} does not fit ${bytes} signed bytes`);
  let out = '';
  for (let i = 0; i < bytes; i++) { out += (x & 0xffn).toString(16).padStart(2, '0'); x >>= 8n; }
  return out;
}

/** Constructor args ('0x…' fixed-width bytes), as the server returns them. */
export function v3Args(p: V3Params): string[] {
  const args = ['0x' + p.ownerPkh, '0x' + catVm(p.reserve)];
  for (let k = 0; k < 3; k++) {
    const s = p.slots[k];
    if (s) args.push('0x' + catVm(s.cat), '0x' + le(s.num, 8), '0x' + le(s.den, 8), '0x' + le(s.rNum, 8), '0x' + le(s.rDen, 8));
    else args.push('0x' + catVm(p.reserve), '0x' + le(0, 8), '0x' + le(0, 8), '0x' + le(0, 8), '0x' + le(0, 8));
  }
  args.push('0x' + le(p.feeBps, 2), '0x' + le(p.mode, 2), '0x' + p.proceedsHash);
  return args;
}

export function buildV3Contract(p: V3Params, provider: NetworkProvider): Contract {
  const err = validateV3Params(p);
  if (err) throw new Error(err);
  return new Contract(V3_ARTIFACT, v3Args(p), { provider });
}

/**
 * Rebuild a V3 pool from server-provided params and refuse to continue unless
 * it produces the expected address (never sign for a contract we did not
 * recompute ourselves).
 */
export function v3ContractFor(params: V3ParamsJson | V3Params, expectedAddress: string, provider: NetworkProvider): { contract: Contract; params: V3Params } {
  const p = parseV3Params(params);
  const contract = buildV3Contract(p, provider);
  if (contract.address !== expectedAddress && contract.tokenAddress !== expectedAddress) {
    throw new Error(`pool params do not match ${expectedAddress} (computed ${contract.address})`);
  }
  return { contract, params: p };
}

let hashCache: string | null = null;
export function v3ArtifactHash(): string {
  hashCache ??= binToHex(sha256.hash(utf8ToBin(String(V3_ARTIFACT.bytecode))));
  return hashCache;
}

// ── Mirror and proceeds ──────────────────────────────────────────────────────

/** The reverse pool mirror mode derives for slot k (same owner and fee, mode 2). */
export function mirrorOf(p: V3Params, k = 0): V3Params {
  const s = p.slots[k]!;
  return {
    ownerPkh: p.ownerPkh, reserve: s.cat, feeBps: p.feeBps, mode: 2, proceedsHash: ZERO32,
    slots: [{ cat: p.reserve, num: s.rNum, den: s.rDen, rNum: s.num, rDen: s.den }],
  };
}

function lockOf(address: string): Uint8Array {
  const r = cashAddressToLockingBytecode(address);
  if (typeof r === 'string') throw new Error(r);
  return r.bytecode;
}

/** Where slot k's proceeds go: locking bytecode, plus the mirror pool's address in mode 2. */
export function proceedsDestination(p: V3Params, k: number, provider: NetworkProvider): { kind: typeof MODE_NAMES[number]; lockingBytecode: Uint8Array; address?: string; mirror?: V3Params } {
  if (p.mode === 0) return { kind: 'owner', lockingBytecode: Uint8Array.from([0x76, 0xa9, 0x14, ...hexBytes(p.ownerPkh), 0x88, 0xac]) };
  if (p.mode === 1) return { kind: 'fixed', lockingBytecode: Uint8Array.from([0xaa, 0x20, ...hexBytes(p.proceedsHash), 0x87]) };
  const mirror = mirrorOf(p, k);
  const c = buildV3Contract(mirror, provider);
  return { kind: 'mirror', lockingBytecode: lockOf(c.address), address: mirror.reserve === '0x' ? c.address : c.tokenAddress, mirror };
}

function hexBytes(h: string): number[] {
  return h.match(/.{2}/g)!.map(b => parseInt(b, 16));
}

// ── Pricing ──────────────────────────────────────────────────────────────────

export const slotFor = (p: V3Params, cat: string) => p.slots.findIndex(s => s.cat === normCategory(cat));

/** Reserve units the covenant allows for `amountIn` of `cat` (single floor, as fill()). */
export function v3OutputFor(p: V3Params, cat: string, amountIn: bigint): bigint {
  const s = p.slots[slotFor(p, cat)];
  if (!s || amountIn <= 0n) return 0n;
  return (amountIn * s.num * (10000n - BigInt(p.feeBps))) / (s.den * 10000n);
}

/** Largest amount a reserve can give while staying valid. */
export function v3AvailableOut(reserve: string, sats: bigint, tokens: bigint): bigint {
  const a = normCategory(reserve) === '0x' ? sats - V3_MIN_SATS : tokens - 1n;
  return a > 0n ? a : 0n;
}

const SATS_PER_BCH = 100_000_000n;

/**
 * Slot price from an LP quote of "1 BCH = P tokens" (P in whole tokens):
 *   BCH reserve accepting the token (a bid):  sats out per token unit = 1e8 / (P·10^dec)
 *   token reserve accepting BCH (an ask):     token units out per sat = P·10^dec / 1e8
 */
export function slotPriceFromTokenPerBch(tokenPerBch: string, decimals: number, reserveIsBch: boolean): Fraction {
  const p = parseDecimal(tokenPerBch);
  const scale = 10n ** BigInt(decimals);
  return fitSafe(reserveIsBch
    ? { num: SATS_PER_BCH * p.den, den: p.num * scale }
    : { num: p.num * scale, den: SATS_PER_BCH * p.den });
}

/** Token↔token slot price from "1 give-token = R take-tokens" (whole tokens): reserve units out per accepted unit. */
export function slotPriceFromRate(takePerGive: string, giveDecimals: number, takeDecimals: number): Fraction {
  // reserve (give) units per accepted (take) unit = 10^giveDec / (R · 10^takeDec)
  const r = parseDecimal(takePerGive);
  return fitSafe({ num: r.den * 10n ** BigInt(giveDecimals), den: r.num * 10n ** BigInt(takeDecimals) });
}

/** What a trader receives per unit paid, after the fee (reserve units per accepted unit). */
export function traderOutPerIn(p: V3Params, k: number): number {
  const s = p.slots[k]!;
  return (Number(s.num) / Number(s.den)) * (1 - p.feeBps / 10_000);
}

/** Minimum deposit for a V3 pool. */
export function v3MinDeposit(reserve: string): { sats: bigint; tokens: bigint } {
  return normCategory(reserve) === '0x' ? { sats: V3_MIN_SATS + 1n, tokens: 0n } : { sats: 1000n, tokens: 2n };
}
