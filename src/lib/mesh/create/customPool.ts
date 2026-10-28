/**
 * A hand-built MeshPoolV3 pool from what the LP typed (moved out of
 * CreatePoolV3Form): the reserve it gives, 1–3 assets it accepts with their
 * prices, proceeds to the wallet (mode 0) or kept in Mesh (mode 2, BCH↔token
 * only, with a trade-back price), and the fee.
 */
import { slotPriceFromRate, slotPriceFromTokenPerBch, validateV3Params, type V3Params } from '../v3/v3Pool';

export interface CustomRow { cat: string; price: string; back: string }

const ZERO32 = '00'.repeat(32);

export function customPoolParams({ ownerPkh, reserve, rows, recycle, feeBps, decimalsOf, symbolOf }: {
  ownerPkh: string | null;
  /** '0x' for BCH, else a token category */
  reserve: string;
  rows: CustomRow[];
  recycle: boolean;
  feeBps: number;
  decimalsOf: (category: string) => number;
  symbolOf: (category: string) => string;
}): { params?: V3Params; error?: string } {
  if (!ownerPkh) return { error: 'Connect a wallet' };
  const reserveIsBch = reserve === '0x';
  try {
    const seen = new Set<string>();
    const slots = rows.map((r, k) => {
      if (!r.cat) throw new Error(`Asset ${k + 1}: choose a token`);
      if (r.cat === reserve) throw new Error(`Asset ${k + 1}: a pool can't accept the asset it gives`);
      if (seen.has(r.cat)) throw new Error(`Asset ${k + 1}: ${symbolOf(r.cat)} is already accepted above`);
      seen.add(r.cat);
      if (!r.price) throw new Error(`Asset ${k + 1}: enter a price`);
      let price; let back = { num: 0n, den: 0n };
      if (reserveIsBch && r.cat !== '0x') {
        price = slotPriceFromTokenPerBch(r.price, decimalsOf(r.cat), true);
        if (recycle) {
          if (!r.back) throw new Error(`Asset ${k + 1}: enter the sell-back price`);
          back = slotPriceFromTokenPerBch(r.back, decimalsOf(r.cat), false);
        }
      } else if (!reserveIsBch && r.cat === '0x') {
        price = slotPriceFromTokenPerBch(r.price, decimalsOf(reserve), false);
        if (recycle) {
          if (!r.back) throw new Error(`Asset ${k + 1}: enter the buy-back price`);
          back = slotPriceFromTokenPerBch(r.back, decimalsOf(reserve), true);
        }
      } else {
        if (recycle) throw new Error('Keep in Mesh works only for pools between BCH and a token: choose "To my wallet", or accept BCH');
        price = slotPriceFromRate(r.price, decimalsOf(reserve), decimalsOf(r.cat));
      }
      return { cat: r.cat, num: price.num, den: price.den, rNum: back.num, rDen: back.den };
    });
    const p: V3Params = { ownerPkh, reserve, slots, feeBps, mode: recycle ? 2 : 0, proceedsHash: ZERO32 };
    const bad = validateV3Params(p);
    return bad ? { error: bad } : { params: p };
  } catch (e: any) {
    return { error: e?.message ?? String(e) };
  }
}
