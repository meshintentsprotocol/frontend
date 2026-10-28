/**
 * Every strategy the create flow offers, as data (MeshDocs/meshv3v4flow/09
 * §2.3, 08 §1). The shell reads this list; it never special-cases a template.
 * Form fields and the conversion to server params stay in
 * lib/mesh/v3/strategyForms.ts, so what is sent to the server doesn't change.
 */
import type { Engine } from './engine';

export type StrategyId =
  | 'range' | 'grid' | 'recycling-pair' | 'fixed' | 'spread'
  | 'take-profit' | 'accumulate' | 'multi-pair' | 'stable-pair' | 'custom';

export type GoalId = 'range' | 'up' | 'down' | 'one' | 'peg' | 'multi' | 'custom';

/** What a strategy trades: BCH against one token, two tokens, BCH against 2–3 tokens, or a hand-built pool. */
export type PairKind = 'bch-token' | 'token-token' | 'bch-multi' | 'custom';

export interface StrategyDef {
  id: StrategyId;
  /** the server template (custom pools go through /pools, not /strategies) */
  template: string | null;
  goal: GoalId;
  name: string;
  /** one line for cards */
  line: string;
  /** what the LP deposits, in words */
  deposit: string;
  /** how it earns, in words */
  earns: string;
  pair: PairKind;
  /** engines that can hold it, best first (engine.ts narrows this to what the server supports) */
  engines: Engine[];
  /** proceeds stay in Mesh: always, by choice, or never */
  recycles: 'always' | 'optional' | 'never';
  /** Spot / Curve / Bid-Ask */
  shapes: boolean;
  /** Tight / Balanced / Wide presets around the market */
  presets: boolean;
  /** the step-2 title in the stepper */
  settingsLabel: string;
  settingsHint: string;
}

export const STRATEGIES: Record<StrategyId, StrategyDef> = {
  range: {
    id: 'range', template: 'range', goal: 'range', name: 'Range',
    line: 'Bins below and above the price; each buys at its level and sells one step up, again and again.',
    deposit: 'BCH below the price, the token above it', earns: 'The step between bins on every round trip',
    pair: 'bch-token', engines: ['v4', 'v3'], recycles: 'always', shapes: true, presets: true,
    settingsLabel: 'Range and shape', settingsHint: 'Price range on a chart, shape, bin step',
  },
  grid: {
    id: 'grid', template: 'grid', goal: 'range', name: 'Grid',
    line: 'Rungs that each buy at their level and sell one level up.',
    deposit: 'BCH for rungs below the price, the token above it', earns: 'The gap between rungs on every round trip',
    pair: 'bch-token', engines: ['v4', 'v3'], recycles: 'always', shapes: true, presets: true,
    settingsLabel: 'Rungs', settingsHint: 'Lowest and highest price, number of rungs',
  },
  'recycling-pair': {
    id: 'recycling-pair', template: 'recycling-pair', goal: 'range', name: 'Recycling pair',
    line: 'Buys at one price, sells at the other, and flips back after every fill.',
    deposit: 'BCH or the token, whichever starts', earns: 'The gap between the two prices',
    pair: 'bch-token', engines: ['v4', 'v3'], recycles: 'always', shapes: false, presets: true,
    settingsLabel: 'Buy and sell prices', settingsHint: 'Two prices and the side that starts',
  },
  fixed: {
    id: 'fixed', template: 'fixed', goal: 'one', name: 'Fixed price',
    line: 'A standing order at your price that earns the fee on every fill.',
    deposit: 'BCH to buy with, or the token to sell', earns: 'The fee on every fill',
    pair: 'bch-token', engines: ['v3'], recycles: 'optional', shapes: false, presets: false,
    settingsLabel: 'Price and side', settingsHint: 'Buy or sell, one price',
  },
  spread: {
    id: 'spread', template: 'spread', goal: 'one', name: 'Spread',
    line: 'A buy below the price and a sell above it; you earn the gap and the fee.',
    deposit: 'BCH and the token', earns: 'The gap between your prices, plus the fee',
    pair: 'bch-token', engines: ['v3'], recycles: 'optional', shapes: false, presets: true,
    settingsLabel: 'Two prices', settingsHint: 'A buy price and a sell price',
  },
  'take-profit': {
    id: 'take-profit', template: 'take-profit', goal: 'up', name: 'Sell as the price rises',
    line: 'Sells your tokens in steps on the way up.',
    deposit: 'The token, split across steps', earns: 'Sells higher as the price climbs, plus the fee',
    pair: 'bch-token', engines: ['v3'], recycles: 'optional', shapes: true, presets: true,
    settingsLabel: 'Sell ladder', settingsHint: 'First and last sell price, steps',
  },
  accumulate: {
    id: 'accumulate', template: 'accumulate', goal: 'down', name: 'Buy as the price falls',
    line: 'Buys the token in steps on the way down with BCH you set aside.',
    deposit: 'BCH, split across steps', earns: 'Buys cheaper as the price falls, plus the fee',
    pair: 'bch-token', engines: ['v3'], recycles: 'optional', shapes: true, presets: true,
    settingsLabel: 'Buy ladder', settingsHint: 'First and last buy price, steps',
  },
  'multi-pair': {
    id: 'multi-pair', template: 'multi-pair', goal: 'multi', name: 'One BCH reserve, several tokens',
    line: 'One BCH reserve that 2 or 3 tokens can buy from, each at its own price.',
    deposit: 'BCH once', earns: 'The fee on fills in any of the tokens',
    pair: 'bch-multi', engines: ['v3'], recycles: 'never', shapes: false, presets: false,
    settingsLabel: 'Tokens and prices', settingsHint: '2 or 3 tokens, one price each',
  },
  'stable-pair': {
    id: 'stable-pair', template: 'stable-pair', goal: 'peg', name: 'Pegged pair',
    line: 'Swaps two tokens that should trade near 1:1, with a spread each side.',
    deposit: 'Either token, or both', earns: 'The spread and the fee on each swap',
    pair: 'token-token', engines: ['v3'], recycles: 'never', shapes: false, presets: false,
    settingsLabel: 'Peg and spread', settingsHint: 'Rate, spread and fee',
  },
  custom: {
    id: 'custom', template: null, goal: 'custom', name: 'Custom pool',
    line: 'Choose what the pool gives, up to three assets it accepts, and where proceeds go.',
    deposit: 'Your choice', earns: 'The fee on every fill',
    pair: 'custom', engines: ['v3'], recycles: 'optional', shapes: false, presets: false,
    settingsLabel: 'Pool settings', settingsHint: 'Gives, accepts, proceeds, fee',
  },
};

export interface GoalDef {
  id: GoalId;
  name: string;
  line: string;
  best: string;
  /** strategies under this goal, the default first */
  strategies: StrategyId[];
}

/** The step-1 cards, in order. */
export const GOALS: GoalDef[] = [
  { id: 'range', name: 'Earn fees in a range', best: 'Best for most pairs',
    line: 'Buy below the price and sell above it, again and again, while the price moves inside your range.',
    strategies: ['range', 'grid', 'recycling-pair'] },
  { id: 'up', name: 'Sell as the price rises', best: 'You hold the token and expect it to rise',
    line: 'Sell your tokens in steps on the way up. Proceeds can stay in Mesh or go to your wallet.',
    strategies: ['take-profit'] },
  { id: 'down', name: 'Buy as the price falls', best: 'You hold BCH and want the token cheaper',
    line: 'Buy the token in steps on the way down with BCH you set aside.',
    strategies: ['accumulate'] },
  { id: 'one', name: 'Trade at one price', best: 'You know the price you want',
    line: 'A standing order at your price that keeps earning the fee on every fill. Add the other side for a spread.',
    strategies: ['fixed', 'spread'] },
  { id: 'peg', name: 'Pegged pair', best: 'Stablecoins and wrapped tokens',
    line: 'Two tokens that should trade near 1:1, with a small spread each side.',
    strategies: ['stable-pair'] },
  { id: 'multi', name: 'One BCH reserve, several tokens', best: 'Quote 2 or 3 tokens from the same BCH',
    line: 'One pool of BCH that several tokens can buy from, each at its own price.',
    strategies: ['multi-pair'] },
];

export const STRATEGY_IDS = Object.keys(STRATEGIES) as StrategyId[];

export function isStrategyId(s: string | undefined | null): s is StrategyId {
  return !!s && s in STRATEGIES;
}

export function goalOf(id: StrategyId): GoalDef | undefined {
  return GOALS.find(g => g.strategies.includes(id));
}

/** Strategies grouped for the "More strategies" list. */
export const STRATEGY_GROUPS: Array<{ name: string; strategies: StrategyId[] }> = [
  { name: 'Earn fees around the price', strategies: ['range', 'grid', 'recycling-pair', 'spread'] },
  { name: 'Follow a trend', strategies: ['take-profit', 'accumulate'] },
  { name: 'One price', strategies: ['fixed'] },
  { name: 'Pegged tokens', strategies: ['stable-pair'] },
  { name: 'One reserve, several tokens', strategies: ['multi-pair'] },
  { name: 'Advanced', strategies: ['custom'] },
];
