/**
 * Strategy template forms: the fields an LP fills in for each template and the
 * conversion to the server's template params (meshserver
 * src/strategies/templates.ts).
 *
 * The LP thinks in "1 BCH = P tokens" and whole BCH / whole tokens; the server
 * takes sats per token base unit (decimal string) and base-unit deposits. The
 * conversions are exact (no floats).
 */
import { parseDecimal } from '../pool';

export type FieldKind =
  | 'token'        // a token category
  | 'price'        // "1 BCH = P tokens" for the field's token → satsPerToken
  | 'bch'          // whole BCH → sats
  | 'tokenAmount'  // whole tokens of the field's token → base units
  | 'count'        // small integer
  | 'bps'          // basis points
  | 'rate'         // token↔token: take-token units per give-token unit (whole tokens)
  | 'choice';

export interface FieldSpec {
  key: string;
  label: string;
  kind: FieldKind;
  /** For price / tokenAmount: the token field whose decimals apply. */
  token?: string;
  optional?: boolean;
  help?: string;
  choices?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  default?: string;
}

export interface TemplateForm {
  id: string;
  icon: string;               // lucide icon name, resolved by the UI
  deposit: string;            // "what you deposit"
  earns: string;              // "how it earns"
  fields: FieldSpec[];
  /** Server param name for each field that maps 1:1 (price and amount fields convert units). */
}

const FEE: FieldSpec = { key: 'feeBps', label: 'Pool fee', kind: 'bps', default: '30' };
/** Keep proceeds in Mesh (mirror mode) or pay them to the wallet. */
const proceedsField = (def: 'wallet' | 'recycle'): FieldSpec => ({
  key: 'proceeds', label: 'Proceeds', kind: 'choice', default: def,
  help: 'Recycle keeps your liquidity in Mesh: what a pool receives opens the reverse pool, which trades it back',
  choices: [{ value: 'recycle', label: 'Keep in Mesh (recycle)' }, { value: 'wallet', label: 'Pay to my wallet' }],
});

/** How a ladder's deposit is spread over its pools (server: strategies/shapes.ts). */
const shapeField: FieldSpec = {
  key: 'shape', label: 'Shape', kind: 'choice', default: 'spot',
  help: 'Spot spreads the deposit evenly, Curve puts most of it next to the market, Bid-Ask most of it at the edges',
  choices: [{ value: 'spot', label: 'Spot (even)' }, { value: 'curve', label: 'Curve (near the market)' }, { value: 'bidask', label: 'Bid-Ask (at the edges)' }],
};
const strengthField: FieldSpec = {
  key: 'strength', label: 'Shape strength', kind: 'choice', default: 'standard', optional: true,
  help: 'How strongly Curve or Bid-Ask leans; Spot ignores it',
  choices: [{ value: 'gentle', label: 'Gentle' }, { value: 'standard', label: 'Standard' }, { value: 'aggressive', label: 'Aggressive' }],
};
/** The market price a range is centred on: pools below it hold BCH, pools above it hold the token. */
const centerField = (optional: boolean): FieldSpec => ({
  key: 'center', label: 'Market price', kind: 'price', token: 'token', optional,
  help: 'Filled in from the market. Rungs priced past it start on the token side, so nothing is sold below the market on deploy',
});
/** Gap between bins on the shared price grid (server: strategies/binGrid.ts). */
export const BIN_STEP_CHOICES = [
  { value: '10', label: '0.1% · pegged pairs' }, { value: '25', label: '0.25% · steady pairs' },
  { value: '50', label: '0.5% · most pairs' }, { value: '100', label: '1% · volatile pairs' },
];

export const TEMPLATE_FORMS: TemplateForm[] = [
  { id: 'fixed', icon: 'Target', deposit: 'BCH (bid) or the token (ask)', earns: 'The fee on every fill at your price',
    fields: [
      { key: 'token', label: 'Token', kind: 'token' },
      { key: 'side', label: 'Side', kind: 'choice', default: 'bid', choices: [{ value: 'bid', label: 'Buy the token with BCH' }, { value: 'ask', label: 'Sell the token for BCH' }] },
      { key: 'price', label: 'Your price', kind: 'price', token: 'token' },
      FEE,
      { key: 'deposit', label: 'BCH deposit', kind: 'bch', help: 'The BCH this order buys the token with' },
      { key: 'depositTokens', label: 'Token deposit', kind: 'tokenAmount', token: 'token', help: 'The tokens this order sells' },
      proceedsField('wallet'),
      { key: 'recyclePrice', label: 'Trade-back price', kind: 'price', token: 'token',
        help: 'Where the reverse pool trades back: fewer tokens per BCH than a buy price, more than a sell price' },
    ] },
  { id: 'spread', icon: 'ArrowLeftRight', deposit: 'BCH and the token', earns: 'The spread between your bid and ask, plus the fee',
    fields: [
      { key: 'token', label: 'Token', kind: 'token' },
      { key: 'bid', label: 'Buy price (bid)', kind: 'price', token: 'token', help: 'More tokens per BCH than the ask' },
      { key: 'ask', label: 'Sell price (ask)', kind: 'price', token: 'token' },
      FEE,
      { key: 'depositBch', label: 'BCH for the bid', kind: 'bch' },
      { key: 'depositTokens', label: 'Tokens for the ask', kind: 'tokenAmount', token: 'token' },
      proceedsField('recycle'),
    ] },
  { id: 'multi-pair', icon: 'Network', deposit: 'BCH once', earns: 'Fills in any of 2–3 tokens from the same BCH',
    fields: [
      { key: 'token1', label: 'Token 1', kind: 'token' },
      { key: 'price1', label: 'Price for token 1', kind: 'price', token: 'token1' },
      { key: 'token2', label: 'Token 2', kind: 'token' },
      { key: 'price2', label: 'Price for token 2', kind: 'price', token: 'token2' },
      { key: 'token3', label: 'Token 3', kind: 'token', optional: true },
      { key: 'price3', label: 'Price for token 3', kind: 'price', token: 'token3' },
      FEE,
      { key: 'depositBch', label: 'BCH reserve', kind: 'bch' },
    ] },
  { id: 'stable-pair', icon: 'Scale', deposit: 'Either or both tokens', earns: 'Token↔token swaps around a peg',
    fields: [
      { key: 'tokenA', label: 'Token A', kind: 'token' },
      { key: 'tokenB', label: 'Token B', kind: 'token' },
      { key: 'rate', label: '1 A =', kind: 'rate', help: 'B tokens per A token at the peg' },
      { key: 'spreadBps', label: 'Spread each side', kind: 'bps', default: '20' },
      FEE,
      { key: 'depositA', label: 'A for the pool that gives A', kind: 'tokenAmount', token: 'tokenA', optional: true },
      { key: 'depositB', label: 'B for the pool that gives B', kind: 'tokenAmount', token: 'tokenB', optional: true },
    ] },
  { id: 'recycling-pair', icon: 'Repeat', deposit: 'BCH or the token', earns: 'Buys low, sells high, again and again — fills flip it automatically',
    fields: [
      { key: 'token', label: 'Token', kind: 'token' },
      { key: 'buy', label: 'Buy price', kind: 'price', token: 'token', help: 'More tokens per BCH than the sell price' },
      { key: 'sell', label: 'Sell price', kind: 'price', token: 'token' },
      { key: 'start', label: 'Start with', kind: 'choice', default: 'bch', choices: [{ value: 'bch', label: 'BCH (buy first)' }, { value: 'token', label: 'The token (sell first)' }] },
      FEE,
      { key: 'depositBch', label: 'BCH deposit', kind: 'bch', help: 'The BCH the pair starts buying with' },
      { key: 'depositTokens', label: 'Token deposit', kind: 'tokenAmount', token: 'token', help: 'The tokens the pair starts selling' },
    ] },
  { id: 'grid', icon: 'Grid3x3', deposit: 'BCH below the market, the token above it', earns: 'Every rung buys at its level and sells one level up',
    fields: [
      { key: 'token', label: 'Token', kind: 'token' },
      { key: 'low', label: 'Lowest price (1 BCH = most tokens)', kind: 'price', token: 'token' },
      { key: 'high', label: 'Highest price (1 BCH = fewest tokens)', kind: 'price', token: 'token' },
      { key: 'rungs', label: 'Rungs', kind: 'count', min: 2, max: 10, default: '4' },
      centerField(true),
      FEE,
      { key: 'depositBch', label: 'BCH (rungs below the market)', kind: 'bch', optional: true },
      { key: 'depositTokens', label: 'Tokens (rungs above the market)', kind: 'tokenAmount', token: 'token', optional: true },
      shapeField,
      strengthField,
    ] },
  { id: 'range', icon: 'BarChart3', deposit: 'BCH below the market, the token above it', earns: 'The gap between bins plus the fee, on every move inside the range',
    fields: [
      { key: 'token', label: 'Token', kind: 'token' },
      { key: 'low', label: 'Range low (1 BCH = most tokens)', kind: 'price', token: 'token' },
      { key: 'high', label: 'Range high (1 BCH = fewest tokens)', kind: 'price', token: 'token' },
      centerField(false),
      { key: 'binStepBps', label: 'Bin step', kind: 'choice', default: '100', choices: BIN_STEP_CHOICES,
        help: 'Gap between bins. Each bin is one pool: wider steps mean fewer, larger bins (at most 20)' },
      shapeField,
      strengthField,
      FEE,
      { key: 'depositBch', label: 'BCH (bins below the market)', kind: 'bch', optional: true },
      { key: 'depositTokens', label: 'Tokens (bins above the market)', kind: 'tokenAmount', token: 'token', optional: true },
    ] },
  { id: 'take-profit', icon: 'TrendingUp', deposit: 'The token, split across steps', earns: 'Sells your tokens in steps as the price rises',
    fields: [
      { key: 'token', label: 'Token', kind: 'token' },
      { key: 'from', label: 'First sell price', kind: 'price', token: 'token' },
      { key: 'to', label: 'Last sell price (fewer tokens per BCH)', kind: 'price', token: 'token' },
      { key: 'steps', label: 'Steps', kind: 'count', min: 2, max: 10, default: '4' },
      FEE,
      { key: 'depositTokens', label: 'Tokens', kind: 'tokenAmount', token: 'token' },
      shapeField,
      strengthField,
      proceedsField('wallet'),
    ] },
  { id: 'accumulate', icon: 'TrendingDown', deposit: 'BCH, split across steps', earns: 'Buys the token in steps as the price falls',
    fields: [
      { key: 'token', label: 'Token', kind: 'token' },
      { key: 'from', label: 'First buy price', kind: 'price', token: 'token' },
      { key: 'to', label: 'Last buy price (more tokens per BCH)', kind: 'price', token: 'token' },
      { key: 'steps', label: 'Steps', kind: 'count', min: 2, max: 10, default: '4' },
      FEE,
      { key: 'depositBch', label: 'BCH', kind: 'bch' },
      shapeField,
      strengthField,
      proceedsField('wallet'),
    ] },
];

export const formFor = (id: string) => TEMPLATE_FORMS.find(f => f.id === id);

/**
 * The fields to show for the current values, in order. A field that a choice
 * makes unnecessary is left out (never shown and ignored); a field that a
 * choice makes required loses `optional`.
 */
export function visibleFields(id: string, v: Record<string, string>): FieldSpec[] {
  const form = formFor(id);
  if (!form) return [];
  const has = (k: string) => (v[k] ?? '').trim() !== '';
  return form.fields.filter(f => {
    // strength only changes Curve and Bid-Ask
    if (f.key === 'strength') return !!v.shape && v.shape !== 'spot';
    if (id === 'fixed') {
      if (f.key === 'deposit') return v.side !== 'ask';
      if (f.key === 'depositTokens') return v.side === 'ask';
      if (f.key === 'recyclePrice') return v.proceeds === 'recycle';
    }
    if (id === 'recycling-pair') {
      if (f.key === 'depositBch') return v.start !== 'token';
      if (f.key === 'depositTokens') return v.start === 'token';
    }
    if (id === 'multi-pair' && f.key === 'price3') return has('token3');
    return true;
  });
}

/** Base units → an exact whole-unit decimal string for an input ("1.25"), floored, trailing zeros dropped. */
export function amountText(units: bigint, decimals: number): string {
  if (units <= 0n) return '0';
  if (decimals === 0) return units.toString();
  const s = units.toString().padStart(decimals + 1, '0');
  const i = s.slice(0, -decimals);
  const f = s.slice(-decimals).replace(/0+$/, '');
  return f ? `${i}.${f}` : i;
}

/** A share of a balance in base units, floored (never more than the balance). */
export function shareOf(balance: bigint, fraction: number, reserve = 0n): bigint {
  const avail = balance > reserve ? balance - reserve : 0n;
  const pct = BigInt(Math.max(0, Math.min(100, Math.round(fraction * 100))));
  return (avail * pct) / 100n;
}

// ── Unit conversions ─────────────────────────────────────────────────────────

const SATS_PER_BCH = 100_000_000n;
const FRAC = 12;

/** Exact decimal string of num/den, floored to `frac` digits. */
export function decimalOf(num: bigint, den: bigint, frac = FRAC): string {
  const scale = 10n ** BigInt(frac);
  const n = (num * scale) / den;
  const f = (n % scale).toString().padStart(frac, '0').replace(/0+$/, '');
  return `${n / scale}${f ? '.' + f : ''}`;
}

/** "1 BCH = P tokens" → sats per token base unit (decimal string). */
export function satsPerUnitFromTokenPerBch(tokenPerBch: string, decimals: number): string {
  const p = parseDecimal(tokenPerBch);
  return decimalOf(SATS_PER_BCH * p.den, p.num * 10n ** BigInt(decimals));
}

/** Whole-unit decimal ("1.25") → base units. */
export function toBaseUnits(v: string, decimals: number): bigint {
  const t = (v ?? '').trim();
  if (!t) return 0n;
  if (!/^\d+(\.\d+)?$/.test(t)) throw new Error(`invalid amount: ${v}`);
  const [i, f = ''] = t.split('.');
  if (f.length > decimals) throw new Error(`at most ${decimals} decimals`);
  return BigInt(i + f.padEnd(decimals, '0'));
}

export type Decimals = (category: string) => number;

/**
 * Form values → server params for the template. Throws with a user-facing
 * message when a required field is missing or invalid.
 */
export function toServerParams(id: string, v: Record<string, string>, dec: Decimals): Record<string, unknown> {
  const fields = formFor(id)?.fields ?? [];
  // errors name the field the LP sees ("Your price is required")
  const labelOf = (k: string) => fields.find(f => f.key === k)?.label ?? k;
  const need = (k: string, label = labelOf(k)) => { const x = (v[k] ?? '').trim(); if (!x) throw new Error(`${label} is required`); return x; };
  const price = (k: string, tokenKey: string) => satsPerUnitFromTokenPerBch(need(k), dec(need(tokenKey)));
  const sats = (k: string) => toBaseUnits(need(k), 8).toString();
  const units = (k: string, tokenKey: string) => toBaseUnits(need(k), dec(need(tokenKey))).toString();
  const count = (k: string) => {
    const spec = fields.find(f => f.key === k);
    const lo = spec?.min ?? 2, hi = spec?.max ?? 10;
    const x = need(k);
    if (!/^\d+$/.test(x) || Number(x) < lo || Number(x) > hi) throw new Error(`${labelOf(k)} must be a whole number from ${lo} to ${hi}`);
    return Number(x);
  };
  const opt = (k: string) => (v[k] ?? '').trim() !== '';
  const fee = Number(v.feeBps ?? 30);
  // spot is the server default: only send a shape that changes something
  const shape = () => (v.shape && v.shape !== 'spot' ? { shape: v.shape, strength: v.strength || 'standard' } : {});

  switch (id) {
    case 'fixed': {
      const side = v.side === 'ask' ? 'ask' : 'bid';
      const recycle = v.proceeds === 'recycle';
      return { token: need('token'), side, satsPerToken: price('price', 'token'), feeBps: fee,
        deposit: side === 'bid' ? sats('deposit') : units('depositTokens', 'token'),
        ...(recycle ? { proceeds: 'recycle', recycleSatsPerToken: price('recyclePrice', 'token') } : {}) };
    }
    case 'spread':
      // bid: more tokens per BCH ⇒ fewer sats per token than the ask
      return { token: need('token'), bidSatsPerToken: price('bid', 'token'), askSatsPerToken: price('ask', 'token'), feeBps: fee,
        depositSats: sats('depositBch'), depositTokens: units('depositTokens', 'token'),
        ...(v.proceeds === 'recycle' ? { proceeds: 'recycle' } : {}) };
    case 'multi-pair': {
      const tokens = [1, 2, 3].filter(i => opt(`token${i}`)).map(i => ({ token: v[`token${i}`]!, satsPerToken: price(`price${i}`, `token${i}`) }));
      return { tokens, feeBps: fee, depositSats: sats('depositBch') };
    }
    case 'stable-pair': {
      const a = need('tokenA'); const b = need('tokenB');
      // server rate: B base units per A base unit
      const r = parseDecimal(need('rate', 'rate'));
      const rate = decimalOf(r.num * 10n ** BigInt(dec(b)), r.den * 10n ** BigInt(dec(a)));
      return { tokenA: a, tokenB: b, rate, spreadBps: Number(v.spreadBps ?? 0), feeBps: fee,
        ...(opt('depositA') ? { depositA: units('depositA', 'tokenA') } : {}), ...(opt('depositB') ? { depositB: units('depositB', 'tokenB') } : {}) };
    }
    case 'recycling-pair': {
      const start = v.start === 'token' ? 'token' : 'bch';
      return { token: need('token'), buySatsPerToken: price('buy', 'token'), sellSatsPerToken: price('sell', 'token'), start, feeBps: fee,
        deposit: start === 'bch' ? sats('depositBch') : units('depositTokens', 'token') };
    }
    case 'grid':
      // the server's low/high are sats per token: the "lowest price" in tokens-per-BCH terms is the most tokens per BCH
      return { token: need('token'), lowSatsPerToken: price('low', 'token'), highSatsPerToken: price('high', 'token'),
        rungs: count('rungs'), feeBps: fee, ...shape(),
        ...(opt('center') ? { centerSatsPerToken: price('center', 'token') } : {}),
        ...(opt('depositBch') ? { depositSats: sats('depositBch') } : {}),
        ...(opt('depositTokens') ? { depositTokens: units('depositTokens', 'token') } : {}) };
    case 'range':
      return { token: need('token'), lowSatsPerToken: price('low', 'token'), highSatsPerToken: price('high', 'token'),
        centerSatsPerToken: price('center', 'token'), binStepBps: v.binStepBps || '100', feeBps: fee, ...shape(),
        ...(opt('depositBch') ? { depositSats: sats('depositBch') } : {}),
        ...(opt('depositTokens') ? { depositTokens: units('depositTokens', 'token') } : {}) };
    case 'take-profit':
      return { token: need('token'), fromSatsPerToken: price('from', 'token'), toSatsPerToken: price('to', 'token'),
        steps: count('steps'), feeBps: fee, depositTokens: units('depositTokens', 'token'), ...shape(),
        ...(v.proceeds === 'recycle' ? { proceeds: 'recycle' } : {}) };
    case 'accumulate':
      return { token: need('token'), fromSatsPerToken: price('from', 'token'), toSatsPerToken: price('to', 'token'),
        steps: count('steps'), feeBps: fee, depositSats: sats('depositBch'), ...shape(),
        ...(v.proceeds === 'recycle' ? { proceeds: 'recycle' } : {}) };
    default:
      throw new Error(`unknown template ${id}`);
  }
}

/** sats per token base unit → "1 BCH = P tokens" as a form string (4–6 significant digits). */
export function tokenPerBchText(satsPerUnit: unknown, decimals: number): string | undefined {
  const s = Number(satsPerUnit);
  if (!(s > 0) || !Number.isFinite(s)) return undefined;
  const v = 1e8 / (s * 10 ** decimals);
  const d = v >= 1000 ? 2 : v >= 1 ? 4 : 8;
  return v.toFixed(d).replace(/\.?0+$/, '');
}

/**
 * Server params (e.g. a /strategies/suggest result) → form values for the
 * template: prices back to "1 BCH = P tokens", counts, fee, choices. Deposits
 * and tokens are left as they are.
 */
export function fromServerParams(id: string, p: Record<string, any>, dec: Decimals, current: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  const put = (k: string, v: unknown) => { if (v !== undefined && v !== null && v !== '') out[k] = String(v); };
  const tok = (k: string) => current[k] ?? p[k];
  const tpb = (sats: unknown, tokenKey: string) => { const t = tok(tokenKey); return t ? tokenPerBchText(sats, dec(t)) : undefined; };
  put('feeBps', p.feeBps);
  switch (id) {
    case 'fixed': put('price', tpb(p.satsPerToken, 'token')); put('side', p.side); put('recyclePrice', tpb(p.recycleSatsPerToken, 'token')); break;
    case 'spread': put('bid', tpb(p.bidSatsPerToken, 'token')); put('ask', tpb(p.askSatsPerToken, 'token')); put('proceeds', p.proceeds); break;
    case 'multi-pair':
      (Array.isArray(p.tokens) ? p.tokens : []).forEach((t: any, i: number) => {
        const key = `token${i + 1}`;
        const cat = current[key] || t?.token;
        if (cat) put(`price${i + 1}`, tokenPerBchText(t?.satsPerToken, dec(cat)));
      });
      break;
    case 'stable-pair': {
      const a = tok('tokenA'); const b = tok('tokenB'); const r = Number(p.rate);
      if (a && b && r > 0) put('rate', (r * 10 ** dec(a) / 10 ** dec(b)).toFixed(6).replace(/\.?0+$/, ''));
      put('spreadBps', p.spreadBps);
      break;
    }
    case 'recycling-pair': put('buy', tpb(p.buySatsPerToken, 'token')); put('sell', tpb(p.sellSatsPerToken, 'token')); put('start', p.start); break;
    case 'grid': put('low', tpb(p.lowSatsPerToken, 'token')); put('high', tpb(p.highSatsPerToken, 'token')); put('rungs', p.rungs);
      put('center', tpb(p.centerSatsPerToken, 'token')); put('shape', p.shape); put('strength', p.strength); break;
    case 'range': put('low', tpb(p.lowSatsPerToken, 'token')); put('high', tpb(p.highSatsPerToken, 'token'));
      put('center', tpb(p.centerSatsPerToken, 'token')); put('binStepBps', p.binStepBps); put('shape', p.shape); put('strength', p.strength); break;
    case 'take-profit':
    case 'accumulate': put('from', tpb(p.fromSatsPerToken, 'token')); put('to', tpb(p.toSatsPerToken, 'token')); put('steps', p.steps);
      put('shape', p.shape); put('strength', p.strength); put('proceeds', p.proceeds); break;
  }
  return out;
}

/** Token categories a form value set refers to (for metadata lookups). */
export function tokensIn(id: string, v: Record<string, string>): string[] {
  const f = formFor(id);
  return (f?.fields ?? []).filter(x => x.kind === 'token').map(x => (v[x.key] ?? '').trim()).filter(Boolean);
}
