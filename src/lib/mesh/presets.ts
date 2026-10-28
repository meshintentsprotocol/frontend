/**
 * Shared choices for Mesh strategy and pool forms: fee tiers and range-width
 * presets. One source, used by the strategy builder and the custom pool form.
 */

export interface FeeTier {
  bps: number;
  label: string;
  name: string;
}

/** Pool fee chips. 0.10% is the server's suggestion for pegged token pairs. */
export const FEE_TIERS: FeeTier[] = [
  { bps: 5, label: '0.05%', name: 'Pegged' },
  { bps: 10, label: '0.10%', name: 'Stable pairs' },
  { bps: 30, label: '0.30%', name: 'Most pairs' },
  { bps: 50, label: '0.50%', name: 'Volatile' },
  { bps: 100, label: '1.00%', name: 'Thin markets' },
];

export interface RangePreset {
  id: 'tight' | 'balanced' | 'wide' | 'custom';
  label: string;
  /** Half-width of the range around the market, in percent; null = set by hand. */
  pct: number | null;
  desc: string;
}

export const RANGE_PRESETS: RangePreset[] = [
  { id: 'tight', label: 'Tight', pct: 1.5, desc: '±1.5% · earns most while the price is calm' },
  { id: 'balanced', label: 'Balanced', pct: 5, desc: '±5% · a good default' },
  { id: 'wide', label: 'Wide', pct: 15, desc: '±15% · rarely leaves the range' },
  { id: 'custom', label: 'Custom', pct: null, desc: 'Set the prices yourself' },
];
