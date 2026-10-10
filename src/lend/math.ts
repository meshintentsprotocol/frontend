/**
 * The arithmetic of a collateralised loan. Pure: no network, no React. The same formulas the swap server uses
 * for a quote, so a figure shown while typing agrees with the one the server confirms.
 *
 *   LTV               = debt value ÷ collateral value
 *   liquidation price = debt value ÷ (collateral units × liquidation threshold)
 *   health            = how far LTV is from the threshold: 100% with no debt, 0% at the threshold
 */
import type { LoanView, Market } from './types';

/** Decimal text → base units. Extra decimals are cut, never rounded up. Empty or invalid text is 0. */
export function toUnits(text: string, decimals: number): bigint {
    const clean = (text ?? '').replace(/,/g, '').trim();
    if (!/^\d*\.?\d*$/.test(clean) || clean === '' || clean === '.') return 0n;
    const [whole, frac = ''] = clean.split('.');
    return BigInt(whole || '0') * 10n ** BigInt(decimals) + BigInt((frac.slice(0, decimals).padEnd(decimals, '0')) || '0');
}

/** Base units → decimal text without trailing zeros. */
export function fromUnits(units: bigint | string, decimals: number, maxFrac = decimals): string {
    const v = typeof units === 'string' ? BigInt(units || '0') : units;
    const neg = v < 0n;
    const abs = neg ? -v : v;
    const base = 10n ** BigInt(decimals);
    const frac = (abs % base).toString().padStart(decimals, '0').slice(0, maxFrac).replace(/0+$/, '');
    return `${neg ? '-' : ''}${abs / base}${frac ? `.${frac}` : ''}`;
}

export const toNumber = (units: bigint | string, decimals: number) => Number(fromUnits(units, decimals));

/** Grouped thousands, at most `maxFrac` decimals: 1234.5 → "1,234.5". */
export function fmt(value: number, maxFrac = 2): string {
    if (!Number.isFinite(value)) return '—';
    return value.toLocaleString('en-US', { maximumFractionDigits: maxFrac });
}
export const fmtUsd = (value: number) => `$ ${fmt(value, value !== 0 && Math.abs(value) < 100 ? 2 : 1)}`;
export const fmtPct = (bps: number, digits = 1) => `${(bps / 100).toFixed(digits)}%`;
/** How much of an asset, in the precision people expect for it. */
export const fmtAmount = (units: bigint | string, market: Pick<Market, 'decimals' | 'asset'>) =>
    fmt(toNumber(units, market.decimals), market.asset === 'BTC' || market.asset === 'ETH' ? 8 : 2);

export const usdOf = (units: bigint, market: Pick<Market, 'decimals' | 'priceUsd'>) => toNumber(units, market.decimals) * market.priceUsd;

/** The activation fee on an amount borrowed, in the borrowed asset's base units. */
export const activationFee = (borrow: bigint, feeBps: number) => (borrow * BigInt(feeBps)) / 10_000n;

export function ltvBps(debtUsd: number, collateralUsd: number): number {
    if (collateralUsd <= 0 || debtUsd <= 0) return 0;
    return Math.round((debtUsd / collateralUsd) * 10_000);
}

export function liquidationPrice(debtUsd: number, collateralUnits: number, thresholdBps: number): number {
    if (collateralUnits <= 0 || thresholdBps <= 0 || debtUsd <= 0) return 0;
    return debtUsd / (collateralUnits * (thresholdBps / 10_000));
}

/** 100 with no debt, 0 at the liquidation threshold. */
export function healthPct(debtUsd: number, collateralUsd: number, thresholdBps: number): number {
    if (debtUsd <= 0) return 100;
    if (collateralUsd <= 0 || thresholdBps <= 0) return 0;
    const used = debtUsd / (collateralUsd * (thresholdBps / 10_000));
    return Math.max(0, Math.min(100, (1 - used) * 100));
}

/** The collateral, in base units, that puts a debt at exactly this LTV. Rounded up, so the LTV is not exceeded. */
export function collateralForLtv(debtUsd: number, targetLtvBps: number, collateral: Pick<Market, 'decimals' | 'priceUsd'>): bigint {
    if (debtUsd <= 0 || targetLtvBps <= 0 || collateral.priceUsd <= 0) return 0n;
    const units = debtUsd / (targetLtvBps / 10_000) / collateral.priceUsd;
    return BigInt(Math.ceil(units * 10 ** collateral.decimals));
}

/** How far the collateral's price is from the liquidation price, as a signed percent: −59.1 means it must fall 59.1%. */
export function distancePct(liquidation: number, current: number): number {
    if (liquidation <= 0 || current <= 0) return 0;
    return (liquidation / current - 1) * 100;
}

/** Where a loan's LTV sits: safe, close to its opening limit, or close to liquidation. */
export function ltvZone(bps: number, maxLtvBps: number): 'safe' | 'caution' | 'danger' {
    if (bps >= maxLtvBps) return 'danger';
    return bps >= maxLtvBps * 0.77 ? 'caution' : 'safe';
}

/** What a loan owes now and what it holds, from whichever fields are filled at its stage. */
export function loanFigures(loan: LoanView, markets: Market[]) {
    const c = markets.find(m => m.asset === loan.collateral.asset);
    const b = markets.find(m => m.asset === loan.borrow.asset);
    const funded = BigInt(loan.position.collateral || '0') > 0n;
    const collateral = funded ? BigInt(loan.position.collateral) : BigInt(loan.collateral.amount);
    const totalDebt = BigInt(loan.position.totalDebt || '0');
    const debt = totalDebt > 0n ? totalDebt : BigInt(loan.repayment.debt || '0') > 0n ? BigInt(loan.repayment.debt) : BigInt(loan.borrow.amount);
    const collateralUsd = toNumber(collateral, loan.collateral.decimals) * (c?.priceUsd ?? 0);
    const debtUsd = toNumber(debt, loan.borrow.decimals) * (b?.priceUsd ?? 1);
    return { collateral, debt, collateralUsd, debtUsd, collateralPrice: c?.priceUsd ?? 0, interest: BigInt(loan.position.interest || '0') };
}

/** A loan after a repayment or a collateral top-up that has not happened yet. */
export function project(loan: LoanView, markets: Market[], change: { repay?: bigint; addCollateral?: bigint }) {
    const now = loanFigures(loan, markets);
    const c = markets.find(m => m.asset === loan.collateral.asset);
    const b = markets.find(m => m.asset === loan.borrow.asset);
    const debt = now.debt - (change.repay ?? 0n) > 0n ? now.debt - (change.repay ?? 0n) : 0n;
    const collateral = now.collateral + (change.addCollateral ?? 0n);
    const debtUsd = toNumber(debt, loan.borrow.decimals) * (b?.priceUsd ?? 1);
    const collateralUnits = toNumber(collateral, loan.collateral.decimals);
    return {
        debt, collateral,
        ltvBps: ltvBps(debtUsd, collateralUnits * (c?.priceUsd ?? 0)),
        liquidationPrice: liquidationPrice(debtUsd, collateralUnits, loan.liquidationThresholdBps),
    };
}
