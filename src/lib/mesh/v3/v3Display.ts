/**
 * Display helpers for V3 pools: each accepted asset as a price in the LP's
 * terms ("1 BCH = P tokens"), and the buy / sell levels a pool (or strategy)
 * quotes, for the price ladder.
 */
import type { V3Info } from '../meshApi';

export type LevelKind = 'buy' | 'sell' | 'swap';

export interface PriceLevel {
  address: string;
  role?: string;
  kind: LevelKind;          // buy: the pool buys the token with BCH · sell: it sells the token for BCH
  token: string;            // the token the level is about
  tokenPerBch: number;      // LP price before the fee
  traderTokenPerBch: number;// what a trader sees after the fee
  fromMirror?: boolean;     // the level only exists once proceeds recycle into the mirror pool
}

const SATS_PER_BCH = 1e8;
const ratio = (num: string, den: string) => Number(num) / Number(den);

/** Levels one V3 pool quotes (BCH pairs only; token↔token slots are listed separately). */
export function poolLevels(address: string, v3: Pick<V3Info, 'reserve' | 'slots' | 'feeBps' | 'mode'>, decimalsOf: (cat: string) => number, role?: string): PriceLevel[] {
  const keep = 1 - v3.feeBps / 10_000;
  const out: PriceLevel[] = [];
  for (const s of v3.slots) {
    if (v3.reserve === '0x' && s.cat !== '0x') {
      // bid: num/den sats per token unit
      const scale = 10 ** decimalsOf(s.cat);
      const satsPerUnit = ratio(s.num, s.den);
      const p = SATS_PER_BCH / (satsPerUnit * scale);
      out.push({ address, role, kind: 'buy', token: s.cat, tokenPerBch: p, traderTokenPerBch: p / keep });
      if (v3.mode === 2 && Number(s.rNum) > 0) {
        const q = (ratio(s.rNum, s.rDen) * SATS_PER_BCH) / scale;      // reverse: token units per sat
        out.push({ address, role, kind: 'sell', token: s.cat, tokenPerBch: q, traderTokenPerBch: q * keep, fromMirror: true });
      }
    } else if (v3.reserve !== '0x' && s.cat === '0x') {
      // ask: num/den token units per sat
      const scale = 10 ** decimalsOf(v3.reserve);
      const p = (ratio(s.num, s.den) * SATS_PER_BCH) / scale;
      out.push({ address, role, kind: 'sell', token: v3.reserve, tokenPerBch: p, traderTokenPerBch: p * keep });
      if (v3.mode === 2 && Number(s.rNum) > 0) {
        const q = SATS_PER_BCH / (ratio(s.rNum, s.rDen) * scale);     // reverse: sats per token unit
        out.push({ address, role, kind: 'buy', token: v3.reserve, tokenPerBch: q, traderTokenPerBch: q / keep, fromMirror: true });
      }
    }
  }
  return out;
}

/** "reserve → accepted" text for a slot, e.g. "gives BCH for pUSD". */
export function slotText(reserveSymbol: string, assetSymbol: string): string {
  return `gives ${reserveSymbol} for ${assetSymbol}`;
}

/** Token↔token rate for a slot: reserve tokens a trader gets per accepted token, both in whole tokens. */
export function tokenRate(slot: { num: string; den: string }, feeBps: number, reserveDecimals: number, assetDecimals: number): number {
  return ratio(slot.num, slot.den) * (1 - feeBps / 10_000) * 10 ** (assetDecimals - reserveDecimals);
}
