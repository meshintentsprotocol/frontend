/**
 * Linked range deposits (MeshDocs/meshv3v4flow/09 §8, decision 2): typing one
 * deposit fills the other so that every unit of equal shape weight holds equal
 * value at the market price. With the same number of units each side and the
 * Spot shape that is simply equal value; with 12 BCH bins and 8 token bins the
 * token side gets 8/12 of the BCH value, so no bin is larger than its shape says.
 *
 * Amounts are base units (sats, token units); the result is floored and is a
 * suggestion the LP can change ("Set separately" unlinks the two).
 */

export interface SideWeights { bid: number; ask: number }

/** Token base units that match a BCH deposit (sats). 0 when either side is empty or there is no market. */
export function linkedTokens(sats: bigint, w: SideWeights, midSatsPerUnit: number | null | undefined): bigint {
  if (sats <= 0n || !(w.bid > 0) || !(w.ask > 0) || !midSatsPerUnit || !(midSatsPerUnit > 0)) return 0n;
  const v = (Number(sats) * w.ask) / (w.bid * midSatsPerUnit);
  return Number.isFinite(v) && v >= 1 ? BigInt(Math.floor(v)) : 0n;
}

/** Sats that match a token deposit (base units). */
export function linkedSats(tokens: bigint, w: SideWeights, midSatsPerUnit: number | null | undefined): bigint {
  if (tokens <= 0n || !(w.bid > 0) || !(w.ask > 0) || !midSatsPerUnit || !(midSatsPerUnit > 0)) return 0n;
  const v = (Number(tokens) * midSatsPerUnit * w.bid) / w.ask;
  return Number.isFinite(v) && v >= 1 ? BigInt(Math.floor(v)) : 0n;
}

/** Sats the BCH "Max" leaves in the wallet: the network fee margin plus a 1,000-sat carrier per token unit (and the V4 NFT outputs). */
export function bchMaxReserve(askUnits: number, engine: 'v4' | 'v3'): bigint {
  return 5_000n + BigInt(Math.max(0, askUnits)) * 1_000n + (engine === 'v4' ? 1_800n : 0n);
}
