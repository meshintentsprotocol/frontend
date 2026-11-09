/**
 * Form values for the create flow, on top of lib/mesh/v3/strategyForms.ts:
 * starting values, the trial deposits step 2 uses to check settings before the
 * LP has typed amounts, the /suggest query, and a rebalance's starting values
 * from the strategy it replaces.
 */
import { formFor, visibleFields, type FieldSpec } from '../v3/strategyForms';

/** chipnet test tokens the forms start on (pUSD, MUSD) */
export const CHIPNET_PUSD = 'dfe50223c8d5cba8dcef8dff6d92b61deb88a8ba44947367f2b746487b56039b';
export const CHIPNET_MUSD = 'b4863d5773c7a269b6fe3b9f7ce2ce1098ab71c0b046ef2a39058d5e30b1f353';
export const MAINNET_PUSD_FALLBACK = '';

const HEX64 = /^[0-9a-f]{64}$/i;
/** a token field that holds the second token (token2, tokenB) */
const SECOND = /2$|B$/;

/**
 * Starting values: field defaults, the token the LP came with (or pUSD of the
 * wallet's network) as the main token, and the second token for pegged and
 * multi-token strategies (MUSD on chipnet).
 */
export function formDefaults(template: string, network: string, opts: { token?: string; tokenB?: string; mainnetPusd?: string } = {}): Record<string, string> {
  const fields: FieldSpec[] = formFor(template)?.fields ?? [];
  const v: Record<string, string> = {};
  const pusd = network === 'mainnet' ? (opts.mainnetPusd ?? MAINNET_PUSD_FALLBACK) : CHIPNET_PUSD;
  const main = opts.token && HEX64.test(opts.token) ? opts.token.toLowerCase() : pusd;
  const second = opts.tokenB && HEX64.test(opts.tokenB) ? opts.tokenB.toLowerCase() : network === 'mainnet' ? '' : CHIPNET_MUSD;
  for (const f of fields) {
    if (f.default !== undefined) v[f.key] = f.default;
    if (f.kind === 'token' && !f.optional) v[f.key] = SECOND.test(f.key) ? second : main;
  }
  // a pegged pair can't trade a token against itself, and earns a smaller fee (the server's suggestion: 0.10%)
  if (template === 'stable-pair' && v.tokenA && v.tokenA === v.tokenB) v.tokenB = v.tokenA === CHIPNET_MUSD ? CHIPNET_PUSD : network === 'mainnet' ? '' : CHIPNET_MUSD;
  if (template === 'stable-pair') v.feeBps = '10';
  if (template === 'multi-pair' && v.token1 && v.token1 === v.token2) v.token2 = v.token1 === CHIPNET_MUSD ? CHIPNET_PUSD : network === 'mainnet' ? '' : CHIPNET_MUSD;
  return v;
}

/** Deposit fields the current choices use, in the order shown. */
export function depositFields(template: string, values: Record<string, string>): FieldSpec[] {
  return visibleFields(template, values).filter(f => f.kind === 'bch' || f.kind === 'tokenAmount');
}

/**
 * Trial deposits for checking step-2 settings with the server before amounts
 * are typed: 1 BCH and 1,000,000 tokens per deposit field (whole units), large
 * enough that no shaped split drops a pool. `sides` limits a range or grid to
 * the side(s) that have pools.
 */
export function trialDeposits(template: string, values: Record<string, string>, sides: 'both' | 'bch' | 'token' = 'both'): Record<string, string> {
  const out: Record<string, string> = { ...values };
  for (const f of depositFields(template, values)) {
    const isBch = f.kind === 'bch';
    const use = sides === 'both' || (sides === 'bch' ? isBch : !isBch);
    out[f.key] = use ? (isBch ? '1' : '1000000') : '';
  }
  return out;
}

/** The /suggest query for a template's current tokens (null until they're set). */
export function suggestQueryFor(template: string, v: Record<string, string>): { template: string; token?: string; tokens?: string[]; tokenA?: string; tokenB?: string } | null {
  if (template === 'multi-pair') {
    const tokens = [v.token1, v.token2, v.token3].filter(Boolean) as string[];
    return tokens.length ? { template, tokens } : null;
  }
  if (template === 'stable-pair') return v.tokenA && v.tokenB ? { template, tokenA: v.tokenA, tokenB: v.tokenB } : null;
  return v.token ? { template, token: v.token } : null;
}

/** The token form values a strategy's stored params name (for a rebalance). */
export function tokenValuesOf(template: string, params: Record<string, unknown>): Record<string, string> {
  const s = (x: unknown) => (typeof x === 'string' && HEX64.test(x) ? x.toLowerCase() : undefined);
  if (template === 'multi-pair') {
    const list = Array.isArray(params.tokens) ? (params.tokens as Array<{ token?: unknown }>) : [];
    const out: Record<string, string> = {};
    list.slice(0, 3).forEach((t, i) => { const c = s(t?.token); if (c) out[`token${i + 1}`] = c; });
    return out;
  }
  if (template === 'stable-pair') {
    const out: Record<string, string> = {};
    const a = s(params.tokenA), b = s(params.tokenB);
    if (a) out.tokenA = a;
    if (b) out.tokenB = b;
    return out;
  }
  const t = s(params.token);
  return t ? { token: t } : {};
}

/** The main token category of a set of form values. */
export const mainTokenOf = (v: Record<string, string>) => v.token ?? v.token1 ?? v.tokenA ?? '';

/** Every token category the values name, in field order. */
export function tokenCatsOf(template: string, v: Record<string, string>): string[] {
  return (formFor(template)?.fields ?? []).filter(f => f.kind === 'token').map(f => v[f.key]).filter((c): c is string => !!c);
}

/** Price field keys that depend on a token field (cleared when that token changes). */
export function priceKeysFor(template: string, tokenKey: string): string[] {
  const keys = (formFor(template)?.fields ?? []).filter(f => (f.kind === 'price' && f.token === tokenKey)).map(f => f.key);
  if (template === 'stable-pair' && (tokenKey === 'tokenA' || tokenKey === 'tokenB')) keys.push('rate');
  return keys;
}
