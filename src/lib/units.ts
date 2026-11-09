/**
 * Exact conversions between what a user types and on-chain base units.
 *
 * `Math.floor(Number('0.29') * 1e8)` is 28999999, one sat short, because 0.29 has no
 * exact binary form. Orders, funding outputs and quotes are all priced in base units,
 * so every conversion here works on the decimal string and on bigints.
 */

/** A plain decimal string ("12", "0.5", ".5", "1."): digits with at most one point. */
const DECIMAL = /^(\d*)(?:\.(\d*))?$/;

/** Number → plain decimal string, without exponent notation (1e-7 → "0.0000001"). */
export function plainDecimal(value: number | string): string {
    if (typeof value === 'string') return value.trim();
    if (!Number.isFinite(value)) return '';
    const s = String(value);
    if (!/e/i.test(s)) return s;
    return value.toFixed(20).replace(/\.?0+$/, '');
}

/**
 * "0.29" with 8 decimals → 29000000n. Digits beyond `decimals` are cut off (never
 * rounded up), so the result is never more than the user typed. Null for anything
 * that is not a non-negative decimal.
 */
export function toBaseUnits(value: number | string, decimals: number): bigint | null {
    const m = DECIMAL.exec(plainDecimal(value));
    if (!m || (m[1] === '' && (m[2] ?? '') === '')) return null;
    const whole = m[1] || '0';
    const frac = (m[2] ?? '').slice(0, decimals).padEnd(decimals, '0');
    return BigInt(whole + frac);
}

/** 29000000n with 8 decimals → "0.29". No trailing zeros. */
export function fromBaseUnits(units: bigint | string, decimals: number): string {
    const u = typeof units === 'bigint' ? units : BigInt(units);
    const neg = u < 0n;
    const abs = neg ? -u : u;
    if (decimals === 0) return `${neg ? '-' : ''}${abs}`;
    const s = abs.toString().padStart(decimals + 1, '0');
    const whole = s.slice(0, -decimals);
    const frac = s.slice(-decimals).replace(/0+$/, '');
    return `${neg ? '-' : ''}${whole}${frac ? '.' + frac : ''}`;
}

/** Digits after the point that `sigDigits` significant digits of a positive ratio need. */
function placesFor(num: bigint, den: bigint, sigDigits: number): number {
    if (num <= 0n || den <= 0n) return 0;
    // number of digits of the integer part, or minus the leading zeros after the point
    const intPart = num / den;
    if (intPart > 0n) return Math.max(0, sigDigits - intPart.toString().length);
    let zeros = 0;
    let r = num;
    while (r * 10n < den) { r *= 10n; zeros++; }
    return zeros + sigDigits;
}

/**
 * The price of `sellUnits` → `buyUnits` as "1 sell = N buy", rounded DOWN to
 * `sigDigits` significant digits. Rounding down matters for a limit order priced
 * from a quote: an order asking for more than the quote pays would never fill.
 */
export function ratioString(
    buyUnits: bigint, buyDecimals: number, sellUnits: bigint, sellDecimals: number, sigDigits = 8,
): string {
    if (sellUnits <= 0n || buyUnits <= 0n) return '0';
    // price = (buyUnits / 10^buyDec) / (sellUnits / 10^sellDec)
    const num = buyUnits * 10n ** BigInt(sellDecimals);
    const den = sellUnits * 10n ** BigInt(buyDecimals);
    const places = Math.min(18, placesFor(num, den, sigDigits));
    const scaled = (num * 10n ** BigInt(places)) / den;
    return fromBaseUnits(scaled, places);
}

/**
 * Buy amount in base units for `sellUnits` at a limit price "1 sell = price buy",
 * rounded down. Null when the price is not a positive decimal.
 */
export function limitBuyUnits(sellUnits: bigint, sellDecimals: number, price: string, buyDecimals: number): bigint | null {
    const m = DECIMAL.exec(price.trim());
    if (!m || (m[1] === '' && (m[2] ?? '') === '')) return null;
    const frac = m[2] ?? '';
    const priceScaled = BigInt((m[1] || '0') + frac);   // price · 10^frac.length
    if (priceScaled <= 0n) return null;
    // buy = sell/10^sd · price → base units: sellUnits · priceScaled · 10^bd / (10^sd · 10^fl)
    return (sellUnits * priceScaled * 10n ** BigInt(buyDecimals)) / (10n ** BigInt(sellDecimals + frac.length));
}

/** True for "", "0", "0.", "." — an amount that is not there yet. */
export const isEmptyAmount = (v: string): boolean => !v || !/[1-9]/.test(v);
