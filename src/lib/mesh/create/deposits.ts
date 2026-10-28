/**
 * Step 3's deposit cards per strategy (MeshDocs/meshv3v4flow/08 §2): which
 * assets the LP deposits and how each card is labelled. The cards are the
 * deposit fields `visibleFields` keeps for the current choices, so a choice
 * that makes a deposit unnecessary removes its card.
 *
 * "Above / below the price" is in the frame every screen uses, 1 BCH = P
 * tokens: units holding BCH sit above the price (they sell BCH as it rises),
 * units holding the token sit below it (they buy BCH as it falls).
 */
import { visibleFields, type FieldSpec } from '../v3/strategyForms';
import type { StrategyId } from './registry';

export interface DepositCard {
  /** the form value it edits */
  key: string;
  /** 'bch' or the form key of its token ('token', 'tokenA', 'tokenB') */
  asset: 'bch' | string;
  label: string;
  required: boolean;
}

export interface DepositContext {
  /** units holding BCH (the server's bids) and units holding the token (asks), when known */
  bidCount?: number;
  askCount?: number;
  /** the market price as shown ("325.40"): labels then say "above 325.40" */
  marketText?: string;
  symbol?: (tokenKey: string) => string;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Unit word for a strategy's pools. */
function unitWord(id: StrategyId, engine: 'v4' | 'v3'): string {
  if (id === 'range') return engine === 'v4' ? 'bin' : 'pool';
  if (id === 'grid') return 'rung';
  if (id === 'take-profit' || id === 'accumulate') return 'step';
  return 'pool';
}

export function depositCards(id: StrategyId, values: Record<string, string>, ctx: DepositContext = {}, engine: 'v4' | 'v3' = 'v3'): DepositCard[] {
  if (id === 'custom') return [];
  const sym = (k: string) => ctx.symbol?.(k) ?? (k === 'tokenA' ? 'token A' : k === 'tokenB' ? 'token B' : 'the token');
  const unit = unitWord(id, engine);
  const fields = visibleFields(id, values).filter((f: FieldSpec) => f.kind === 'bch' || f.kind === 'tokenAmount');
  const cards = fields.map((f): DepositCard => {
    const asset = f.kind === 'bch' ? 'bch' : (f.token ?? 'token');
    let label = f.label;
    switch (id) {
      case 'range':
      case 'grid':
        label = asset === 'bch'
          ? `BCH for ${ctx.bidCount !== undefined ? `the ${plural(ctx.bidCount, unit)}` : `the ${unit}s`} above ${ctx.marketText ?? 'the price'}`
          : `${sym(asset)} for ${ctx.askCount !== undefined ? `the ${plural(ctx.askCount, unit)}` : `the ${unit}s`} below ${ctx.marketText ?? 'the price'}`;
        break;
      case 'take-profit':
        label = `${sym(asset)} to sell, split across the steps`;
        break;
      case 'accumulate':
        label = 'BCH to buy with, split across the steps';
        break;
      case 'fixed':
        label = asset === 'bch' ? 'BCH this order buys with' : `${sym(asset)} this order sells`;
        break;
      case 'spread':
        label = asset === 'bch' ? 'BCH for the buy side' : `${sym(asset)} for the sell side`;
        break;
      case 'recycling-pair':
        label = asset === 'bch' ? 'BCH to start buying with' : `${sym(asset)} to start selling`;
        break;
      case 'multi-pair':
        label = 'BCH reserve, shared by every token';
        break;
      case 'stable-pair':
        label = `${sym(asset)} for the pool that gives ${sym(asset)}`;
        break;
    }
    return { key: f.key, asset, label, required: !f.optional };
  });
  // a range with every bin on one side needs only that side's card
  if ((id === 'range' || id === 'grid') && ctx.bidCount !== undefined && ctx.askCount !== undefined) {
    return cards.filter(c => (c.asset === 'bch' ? ctx.bidCount! > 0 : ctx.askCount! > 0));
  }
  return cards;
}

/** Why a one-sided range shows only one card (null when it has both sides). */
export function oneSidedNote(id: StrategyId, ctx: DepositContext, symbol: string): string | null {
  if (id !== 'range' && id !== 'grid') return null;
  if (ctx.bidCount === undefined || ctx.askCount === undefined) return null;
  if (ctx.bidCount > 0 && ctx.askCount === 0) return `This range sits all above the price, so it only needs BCH.`;
  if (ctx.askCount > 0 && ctx.bidCount === 0) return `This range sits all below the price, so it only needs ${symbol}.`;
  return null;
}
