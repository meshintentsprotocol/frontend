/**
 * StrategyCovenantV2 pools — contract construction and exact pricing.
 *
 * Mirrors meshserver/src/pools/poolContracts.ts: the same constructor args
 * give the same address on both sides, which the server checks before it
 * accepts a registration. Pure module: no browser globals, no import.meta, so
 * it also runs under node (tests, live scripts).
 *
 * Covenant rules (contracts-bch-swap/contracts/StrategyCovenantV2.cash):
 *   - exactly one of tokenCategoryIn / tokenCategoryOut is BCH ('0x')
 *   - price is "out base units per in base unit", fee applied on top:
 *       amountOut · priceDen · 10000 ≤ amountIn · priceNum · (10000 − feeBps)
 *   - a BCH-giving pool keeps ≥ 1000 sats; a token-giving pool keeps ≥ 1 token
 *   - dock(ownerPk, ownerSig) lets the owner spend the pool anywhere
 */
import { Contract, type NetworkProvider } from 'cashscript';
import { binToHex, sha256, utf8ToBin } from '@bitauth/libauth';
import artifactJson from './artifacts/StrategyCovenantV2.json';

export const POOL_CONTRACT = 'StrategyCovenantV2' as const;
export const POOL_ARTIFACT = artifactJson as any;
/** Sats a BCH-giving pool must keep after every fill (covenant rule). */
export const POOL_MIN_SATS = 1000n;
/** Sats carried by every token output we create. */
export const TOKEN_DUST = 1000n;
/** The server checks priceNum/priceDen with Number.isInteger. */
export const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

export type PoolSide = 'SELL_BCH' | 'SELL_TOKEN';

export interface PoolParams {
  ownerPkh: string;          // 20-byte hex
  tokenCategoryIn: string;   // '0x' or 64-hex (display / big-endian)
  tokenCategoryOut: string;
  priceNum: number;
  priceDen: number;
  feeBps: number;
}

export const stripHex = (s: string) => (s.startsWith('0x') ? s.slice(2) : s);

/** '0x' for BCH, lowercase 64-hex otherwise. */
export function normCategory(c?: string): string {
  if (!c || c === '0x' || c.toUpperCase() === 'BCH') return '0x';
  return stripHex(c).toLowerCase();
}

/** Display category → little-endian constructor bytes ('0x' for BCH). */
export function categoryToLE(c: string): string {
  const clean = normCategory(c);
  if (clean === '0x') return '0x';
  return '0x' + clean.match(/.{2}/g)!.reverse().join('');
}

export function poolSide(p: Pick<PoolParams, 'tokenCategoryOut'>): PoolSide {
  return normCategory(p.tokenCategoryOut) === '0x' ? 'SELL_BCH' : 'SELL_TOKEN';
}

/** The token a pool trades against BCH. */
export function poolToken(p: Pick<PoolParams, 'tokenCategoryIn' | 'tokenCategoryOut'>): string {
  return normCategory(p.tokenCategoryOut) === '0x' ? normCategory(p.tokenCategoryIn) : normCategory(p.tokenCategoryOut);
}

/** Params for a pool of `side` on `token`. */
export function sideParams(side: PoolSide, token: string, ownerPkh: string, price: { num: bigint; den: bigint }, feeBps: number): PoolParams {
  const t = normCategory(token);
  return {
    ownerPkh: stripHex(ownerPkh).toLowerCase(),
    tokenCategoryIn: side === 'SELL_BCH' ? t : '0x',
    tokenCategoryOut: side === 'SELL_BCH' ? '0x' : t,
    priceNum: Number(price.num),
    priceDen: Number(price.den),
    feeBps,
  };
}

/** Same checks as the server; null when valid. */
export function validatePoolParams(p: PoolParams): string | null {
  const inCat = normCategory(p.tokenCategoryIn);
  const outCat = normCategory(p.tokenCategoryOut);
  if (!/^[0-9a-fA-F]{40}$/.test(stripHex(p.ownerPkh ?? ''))) return 'ownerPkh must be 20-byte hex';
  if ((inCat === '0x') === (outCat === '0x')) return 'exactly one side of the pool must be BCH';
  for (const c of [inCat, outCat]) if (c !== '0x' && !/^[0-9a-f]{64}$/.test(c)) return `invalid token category ${c}`;
  if (!(Number.isInteger(p.priceNum) && p.priceNum > 0)) return 'priceNum must be a positive integer';
  if (!(Number.isInteger(p.priceDen) && p.priceDen > 0)) return 'priceDen must be a positive integer';
  if (!(Number.isInteger(p.feeBps) && p.feeBps >= 0 && p.feeBps < 10000)) return 'feeBps must be in [0, 10000)';
  return null;
}

/** Exact constructor args, in the string form the server returns. */
export function constructorArgs(p: PoolParams): string[] {
  return ['0x' + stripHex(p.ownerPkh).toLowerCase(), categoryToLE(p.tokenCategoryIn), categoryToLE(p.tokenCategoryOut),
    String(p.priceNum), String(p.priceDen), String(p.feeBps)];
}

function contractArgs(args: string[]): Array<string | bigint> {
  return args.map((a, i) => (i < 3 ? a : BigInt(a)));
}

export function buildPoolContract(p: PoolParams, provider: NetworkProvider): Contract {
  const err = validatePoolParams(p);
  if (err) throw new Error(err);
  return new Contract(POOL_ARTIFACT, contractArgs(constructorArgs(p)), { provider });
}

/**
 * Rebuild a pool from server-provided constructor args and refuse to continue
 * unless it produces the expected address (never sign for a contract we did
 * not recompute ourselves).
 */
export function contractFromArgs(args: string[], expectedAddress: string, provider: NetworkProvider): Contract {
  if (!Array.isArray(args) || args.length !== 6) throw new Error('pool constructor args must have 6 entries');
  const c = new Contract(POOL_ARTIFACT, contractArgs(args), { provider });
  if (c.address !== expectedAddress && c.tokenAddress !== expectedAddress) {
    throw new Error(`pool args do not match ${expectedAddress} (computed ${c.address})`);
  }
  return c;
}

let hashCache: string | null = null;
/** sha256 of the covenant bytecode, compared with the server's preview. */
export function artifactHash(): string {
  hashCache ??= binToHex(sha256.hash(utf8ToBin(String(POOL_ARTIFACT.bytecode))));
  return hashCache;
}

// ── Pricing ──────────────────────────────────────────────────────────────────

export interface Fraction { num: bigint; den: bigint }

const gcd = (a: bigint, b: bigint): bigint => { while (b) [a, b] = [b, a % b]; return a < 0n ? -a : a; };

export function reduce(f: Fraction): Fraction {
  const g = gcd(f.num, f.den) || 1n;
  return { num: f.num / g, den: f.den / g };
}

/**
 * Fit a price into safe integers. Rounds the price down (num down, den up):
 * the pool then pays out slightly less, never more, than the LP asked for.
 */
export function fitSafe(f: Fraction): Fraction {
  let { num, den } = reduce(f);
  while (num > MAX_SAFE || den > MAX_SAFE) {
    num = num / 10n;
    den = (den + 9n) / 10n;
  }
  if (num < 1n) num = 1n;
  return reduce({ num, den });
}

/** Parse a positive decimal string ("311.25") into an exact fraction. */
export function parseDecimal(s: string): Fraction {
  const t = s.trim();
  if (!/^\d+(\.\d+)?$/.test(t)) throw new Error(`invalid number: ${s}`);
  const [i, f = ''] = t.split('.');
  const num = BigInt(i + f);
  if (num === 0n) throw new Error('price must be greater than 0');
  return { num, den: 10n ** BigInt(f.length) };
}

const SATS_PER_BCH = 100_000_000n;

/**
 * Covenant price for an LP quote of "1 BCH = P tokens" (P in whole tokens).
 *   SELL_BCH   (pool in = token units, out = sats):  sats per token unit = 1e8 / (P·10^dec)
 *   SELL_TOKEN (pool in = sats, out = token units):  token units per sat = P·10^dec / 1e8
 */
export function priceFromTokenPerBch(tokenPerBch: string, decimals: number, side: PoolSide): Fraction {
  const p = parseDecimal(tokenPerBch);
  const scale = 10n ** BigInt(decimals);
  const f = side === 'SELL_BCH'
    ? { num: SATS_PER_BCH * p.den, den: p.num * scale }
    : { num: p.num * scale, den: SATS_PER_BCH * p.den };
  return fitSafe(f);
}

/** Inverse of priceFromTokenPerBch: the LP's "1 BCH = P tokens" (before fee), for display. */
export function tokenPerBchFromParams(p: PoolParams, decimals: number): number {
  const num = Number(p.priceNum); const den = Number(p.priceDen); const scale = 10 ** decimals;
  return poolSide(p) === 'SELL_BCH' ? (1e8 * den) / (num * scale) : (num * 1e8) / (den * scale);
}

/**
 * What a trader actually gets, as "1 BCH = X tokens", after the pool fee:
 *   SELL_BCH   trader sells tokens for BCH: pays P / (1 − fee) tokens per BCH
 *   SELL_TOKEN trader buys tokens with BCH: receives P · (1 − fee) tokens per BCH
 */
export function traderTokenPerBch(p: PoolParams, decimals: number): number {
  const base = tokenPerBchFromParams(p, decimals);
  const keep = (10_000 - p.feeBps) / 10_000;
  return poolSide(p) === 'SELL_BCH' ? base / keep : base * keep;
}

/** Output the covenant allows for `amountIn` (single floor, identical to fill()). */
export function poolOutputFor(p: PoolParams, amountIn: bigint): bigint {
  if (amountIn <= 0n) return 0n;
  return (amountIn * BigInt(p.priceNum) * BigInt(10_000 - p.feeBps)) / (BigInt(p.priceDen) * 10_000n);
}

/** Human "tokens per BCH" from a sats-per-token-unit decimal string (e.g. the server's market ref). */
export function tokenPerBchFromSatsPerUnit(satsPerUnit: string | number, decimals: number): number {
  const s = Number(satsPerUnit);
  return s > 0 ? 1e8 / (s * 10 ** decimals) : 0;
}

/** Minimum funding the server accepts, per side. */
export function minFunding(side: PoolSide): { sats: bigint; tokens: bigint } {
  return side === 'SELL_BCH' ? { sats: POOL_MIN_SATS + 1n, tokens: 0n } : { sats: TOKEN_DUST, tokens: 2n };
}
