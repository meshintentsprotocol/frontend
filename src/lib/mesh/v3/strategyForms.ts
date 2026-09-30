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

export const TEMPLATE_FORMS: TemplateForm[] = [
  { id: 'fixed', icon: 'Target', deposit: 'BCH (bid) or the token (ask)', earns: 'The fee on every fill at your price',
    fields: [
      { key: 'token', label: 'Token', kind: 'token' },
      { key: 'side', label: 'Side', kind: 'choice', default: 'bid', choices: [{ value: 'bid', label: 'Buy the token with BCH' }, { value: 'ask', label: 'Sell the token for BCH' }] },
      { key: 'price', label: 'Your price', kind: 'price', token: 'token' },
      FEE,
      { key: 'deposit', label: 'Deposit', kind: 'bch', help: 'BCH for a bid; for an ask, enter the token amount below instead' },
      { key: 'depositTokens', label: 'Token deposit (ask)', kind: 'tokenAmount', token: 'token', optional: true },
    ] },
  { id: 'spread', icon: 'ArrowLeftRight', deposit: 'BCH and the token', earns: 'The spread between your bid and ask, plus the fee',
    fields: [
      { key: 'token', label: 'Token', kind: 'token' },
      { key: 'bid', label: 'Buy price (bid)', kind: 'price', token: 'token', help: 'More tokens per BCH than the ask' },
      { key: 'ask', label: 'Sell price (ask)', kind: 'price', token: 'token' },
      FEE,
      { key: 'depositBch', label: 'BCH for the bid', kind: 'bch' },
      { key: 'depositTokens', label: 'Tokens for the ask', kind: 'tokenAmount', token: 'token' },
    ] },
  { id: 'multi-pair', icon: 'Network', deposit: 'BCH once', earns: 'Fills in any of 2–3 tokens from the same BCH',
    fields: [
      { key: 'token1', label: 'Token 1', kind: 'token' },
      { key: 'price1', label: 'Price for token 1', kind: 'price', token: 'token1' },
      { key: 'token2', label: 'Token 2', kind: 'token' },
      { key: 'price2', label: 'Price for token 2', kind: 'price', token: 'token2' },
      { key: 'token3', label: 'Token 3 (optional)', kind: 'token', optional: true },
      { key: 'price3', label: 'Price for token 3', kind: 'price', token: 'token3', optional: true },
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
      { key: 'depositBch', label: 'BCH deposit', kind: 'bch', optional: true },
      { key: 'depositTokens', label: 'Token deposit', kind: 'tokenAmount', token: 'token', optional: true },
    ] },
  { id: 'grid', icon: 'Grid3x3', deposit: 'BCH, split across rungs', earns: 'Every rung buys at its level and sells one level up',
    fields: [
      { key: 'token', label: 'Token', kind: 'token' },
      { key: 'low', label: 'Lowest price (1 BCH = most tokens)', kind: 'price', token: 'token' },
      { key: 'high', label: 'Highest price (1 BCH = fewest tokens)', kind: 'price', token: 'token' },
      { key: 'rungs', label: 'Rungs', kind: 'count', min: 2, max: 10, default: '4' },
      FEE,
      { key: 'depositBch', label: 'BCH', kind: 'bch' },
    ] },
  { id: 'take-profit', icon: 'TrendingUp', deposit: 'The token, split across steps', earns: 'Sells your tokens in steps as the price rises',
    fields: [
      { key: 'token', label: 'Token', kind: 'token' },
      { key: 'from', label: 'First sell price', kind: 'price', token: 'token' },
      { key: 'to', label: 'Last sell price (fewer tokens per BCH)', kind: 'price', token: 'token' },
      { key: 'steps', label: 'Steps', kind: 'count', min: 2, max: 10, default: '4' },
      FEE,
      { key: 'depositTokens', label: 'Tokens', kind: 'tokenAmount', token: 'token' },
    ] },
  { id: 'accumulate', icon: 'TrendingDown', deposit: 'BCH, split across steps', earns: 'Buys the token in steps as the price falls',
    fields: [
      { key: 'token', label: 'Token', kind: 'token' },
      { key: 'from', label: 'First buy price', kind: 'price', token: 'token' },
      { key: 'to', label: 'Last buy price (more tokens per BCH)', kind: 'price', token: 'token' },
      { key: 'steps', label: 'Steps', kind: 'count', min: 2, max: 10, default: '4' },
      FEE,
      { key: 'depositBch', label: 'BCH', kind: 'bch' },
    ] },
];

export const formFor = (id: string) => TEMPLATE_FORMS.find(f => f.id === id);

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
  const need = (k: string, label = k) => { const x = (v[k] ?? '').trim(); if (!x) throw new Error(`${label} is required`); return x; };
  const price = (k: string, tokenKey: string) => satsPerUnitFromTokenPerBch(need(k, 'price'), dec(need(tokenKey, 'token')));
  const sats = (k: string) => toBaseUnits(need(k, 'deposit'), 8).toString();
  const units = (k: string, tokenKey: string) => toBaseUnits(need(k, 'token deposit'), dec(need(tokenKey, 'token'))).toString();
  const opt = (k: string) => (v[k] ?? '').trim() !== '';
  const fee = Number(v.feeBps ?? 30);

  switch (id) {
    case 'fixed': {
      const side = v.side === 'ask' ? 'ask' : 'bid';
      return { token: need('token'), side, satsPerToken: price('price', 'token'), feeBps: fee,
        deposit: side === 'bid' ? sats('deposit') : units('depositTokens', 'token') };
    }
    case 'spread':
      // bid: more tokens per BCH ⇒ fewer sats per token than the ask
      return { token: need('token'), bidSatsPerToken: price('bid', 'token'), askSatsPerToken: price('ask', 'token'), feeBps: fee,
        depositSats: sats('depositBch'), depositTokens: units('depositTokens', 'token') };
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
        rungs: Number(need('rungs')), feeBps: fee, depositSats: sats('depositBch') };
    case 'take-profit':
      return { token: need('token'), fromSatsPerToken: price('from', 'token'), toSatsPerToken: price('to', 'token'),
        steps: Number(need('steps')), feeBps: fee, depositTokens: units('depositTokens', 'token') };
    case 'accumulate':
      return { token: need('token'), fromSatsPerToken: price('from', 'token'), toSatsPerToken: price('to', 'token'),
        steps: Number(need('steps')), feeBps: fee, depositSats: sats('depositBch') };
    default:
      throw new Error(`unknown template ${id}`);
  }
}

/** Token categories a form value set refers to (for metadata lookups). */
export function tokensIn(id: string, v: Record<string, string>): string[] {
  const f = formFor(id);
  return (f?.fields ?? []).filter(x => x.kind === 'token').map(x => (v[x.key] ?? '').trim()).filter(Boolean);
}
