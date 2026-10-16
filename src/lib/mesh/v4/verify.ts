/**
 * Local checks of the server's V4 plans before the wallet signs anything.
 *
 * The server proposes; the browser verifies. A plan is refused unless:
 *   - every bin's locking bytecode is rebuilt here from its parameters, its
 *     owner is the new position (ownerCat = category) and its prices are the
 *     grid prices of its level (bid = level i, ask = level i + 1);
 *   - the NFT goes to this wallet, is mutable (never minting) and carries the
 *     commitment that matches the bins;
 *   - the bins hold no more than the deposit, the identity output is small and
 *     the metadata output is the BCMR publication of the planned registry;
 *   - nothing else is paid anywhere.
 * A withdrawal plan is checked the same way: every bin input unlocks through
 * owner(k) of a bin of this position and everything goes to the holder.
 */
import { binToHex, utf8ToBin } from '@bitauth/libauth';
import { BIN_MIN_SATS, binV4LockingBytecode, binV4OwnerUnlocking, parseBinV4, type BinV4Params } from './binV4';
import { decodeCommitment, gridFraction } from './position';
import type { V4MigratePlan, V4Plan, V4PositionView, V4WithdrawPlan } from './types';

export class PlanCheckError extends Error {}

/** The identity output only controls metadata: it must stay tiny. */
export const MAX_IDENTITY_SATS = 1000n;
const NFT_MAX_SATS = 2000n;

export interface PlanExpect {
  category: string;
  tokenCat: string;
  /** the wallet's locking bytecode (hex): the NFT must go there */
  ownerLock: string;
  /** most BCH and tokens the bins may take */
  maxSats: bigint;
  maxTokens: bigint;
  binStepBps: number;
  /** the range the LP asked for (inclusive levels) */
  lowIndex?: number;
  highIndex?: number;
}

const fail = (m: string): never => { throw new PlanCheckError(m); };
const pushHex = (h: string) => {
  const n = h.length / 2;
  if (n <= 75) return n.toString(16).padStart(2, '0') + h;
  if (n <= 255) return '4c' + n.toString(16).padStart(2, '0') + h;
  return fail('metadata URI too long');
};

/** OP_RETURN 'BCMR' <sha256> <uri>: the publication output of a genesis. */
export function bcmrPublicationHex(sha256Hex: string, uri: string): string {
  return '6a' + pushHex(binToHex(utf8ToBin('BCMR'))) + pushHex(sha256Hex) + pushHex(binToHex(utf8ToBin(uri)));
}

/** Check a bin's prices against its grid level. */
function checkBinPrices(p: BinV4Params, step: number, level: number, k: number): void {
  const bid = gridFraction(step, level, 'down');
  const ask = gridFraction(step, level + 1, 'up');
  if (p.bidNum !== bid.num || p.bidDen !== bid.den) fail(`bin ${k}: bid is not the grid price of level ${level}`);
  if (p.askNum !== ask.num || p.askDen !== ask.den) fail(`bin ${k}: ask is not the grid price of level ${level + 1}`);
}

/** Verify a /v4/positions/preview plan (or the v4 part of a migration plan). Returns the parsed bins. */
export function verifyPlan(plan: V4Plan, x: PlanExpect): BinV4Params[] {
  if (plan.category !== x.category) fail('the plan is for another category than the seed');
  const c = decodeCommitment(plan.commitmentHex);
  if (c.tokenCat !== x.tokenCat) fail('the commitment names another token');
  if (c.binStepBps !== x.binStepBps) fail('the commitment has another bin step');
  if (c.binCount !== plan.bins.length) fail('the commitment counts another number of bins');
  if (c.variant !== 'default' || !/^0{64}$/.test(c.managerHash)) fail('the plan adds a variant or a manager the LP did not ask for');

  const bins = plan.bins.map((b, k) => {
    const p = parseBinV4(b.params);
    if (p.ownerCat !== x.category) fail(`bin ${k}: owned by another position`);
    if (p.tokenCat !== x.tokenCat) fail(`bin ${k}: another token`);
    if ((p.variant ?? 'default') !== 'default' || (p.managerHash ?? '00'.repeat(32)) !== '00'.repeat(32) || (p.manageAfter ?? 0) !== 0) {
      fail(`bin ${k}: has a manager or variant`);
    }
    if (binV4LockingBytecode(p) !== b.lockingBytecode) fail(`bin ${k}: address does not match its parameters`);
    checkBinPrices(p, x.binStepBps, b.level, k);
    if (b.level < c.lowIndex || b.level > c.highIndex) fail(`bin ${k}: outside the committed range`);
    if (x.lowIndex !== undefined && b.level < x.lowIndex) fail(`bin ${k}: below the range asked for`);
    if (x.highIndex !== undefined && b.level > x.highIndex) fail(`bin ${k}: above the range asked for`);
    return p;
  });

  let binSats = 0n, binTokens = 0n, idCount = 0, nftCount = 0, metaCount = 0;
  const seenBins = new Set<number>();
  for (const [j, o] of plan.outputs.entries()) {
    const v = BigInt(o.valueSatoshis);
    if (o.role === 'identity') {
      idCount++;
      if (j !== 0) fail('the identity output must be output 0');
      if (o.token || v > MAX_IDENTITY_SATS) fail('the identity output must be a small plain output');
    } else if (o.role === 'nft') {
      nftCount++;
      if (j !== 1) fail('the NFT must be output 1');
      if (o.lockingBytecode !== x.ownerLock) fail('the NFT does not go to this wallet');
      const t = o.token ?? fail('the NFT output has no token');
      if (t.category !== x.category || t.amount !== '0' || !t.nft) fail('the NFT output is not the position NFT');
      if (t.nft!.capability !== 'mutable') fail('the position NFT must be mutable');
      if (t.nft!.commitment !== plan.commitmentHex) fail('the NFT commitment differs from the plan');
      if (v > NFT_MAX_SATS) fail('the NFT output carries too many sats');
    } else if (o.role === 'bin') {
      const k = o.binIndex ?? fail('a bin output has no bin index');
      const b = plan.bins[k] ?? fail(`output ${j}: no bin ${k}`);
      if (seenBins.has(k)) fail(`bin ${k} funded twice`);
      seenBins.add(k);
      if (o.lockingBytecode !== b.lockingBytecode) fail(`output ${j}: not bin ${k}'s address`);
      if (v < BIN_MIN_SATS) fail(`bin ${k}: below the 1,000-sat minimum`);
      if (o.token) {
        if (o.token.category !== x.tokenCat || o.token.nft) fail(`bin ${k}: carries a foreign token`);
        binTokens += BigInt(o.token.amount);
      }
      if (v !== BigInt(b.sats) || (o.token?.amount ?? '0') !== b.tokens) fail(`bin ${k}: funded differently from the plan`);
      binSats += v;
    } else if (o.role === 'metadata') {
      metaCount++;
      if (j !== plan.outputs.length - 1) fail('the metadata output must be last');
      if (v !== 0n || o.token) fail('the metadata output must carry nothing');
      if (o.lockingBytecode !== bcmrPublicationHex(plan.metadata.sha256, plan.metadata.uri)) fail('the metadata output is not the planned BCMR publication');
      if (plan.metadata.uri !== `ipfs://${cidOfSha256(plan.metadata.sha256)}`) fail('the metadata URI is not the IPFS address of the registry');
    } else {
      fail(`unknown output role ${(o as any).role}`);
    }
  }
  if (idCount !== 1 || nftCount !== 1 || metaCount !== 1) fail('a genesis has one identity, one NFT and one metadata output');
  if (seenBins.size !== plan.bins.length) fail('some bins are not funded');
  if (binTokens > x.maxTokens) fail(`the bins take ${binTokens} token units; the deposit is ${x.maxTokens}`);
  // ask bins carry 1,000 sats each with their tokens: that is part of the BCH the LP pays
  if (binSats > x.maxSats) fail(`the bins take ${binSats} sats; at most ${x.maxSats} were allowed`);
  return bins;
}

/** Verify a migration plan: docks only the strategy's pools, opens a verified V4 position. */
export function verifyMigratePlan(m: V4MigratePlan, x: Omit<PlanExpect, 'maxSats' | 'maxTokens'>): BinV4Params[] {
  const sats = BigInt(m.available.sats), tokens = BigInt(m.available.tokens);
  const closeSats = m.close.reduce((a, c) => a + c.utxos.reduce((b, u) => b + BigInt(u.sats), 0n), 0n);
  if (closeSats !== sats) fail('the plan counts other sats than the pools it docks');
  return verifyPlan(m.v4, { ...x, maxSats: sats, maxTokens: tokens });
}

/**
 * Verify a withdrawal plan against the position as the server shows it, rebuilt
 * locally from the registered bin parameters: each bin input unlocks one of this
 * position's bins through owner(k), the NFT input is ours, and the BCH, tokens
 * and NFT all go to `toLock` / back to the holder.
 */
export function verifyWithdrawPlan(w: V4WithdrawPlan, bins: BinV4Params[], x: { category: string; holderLock: string; toLock?: string }): void {
  if (w.category !== x.category) fail('the plan is for another position');
  const k = w.nftInputIndex;
  const nftIn = w.inputs[k] ?? fail('no NFT input');
  if (nftIn.role !== 'nft' || nftIn.lockingBytecode !== x.holderLock) fail('the NFT input is not the holder\'s');
  if (nftIn.token?.category !== x.category || !nftIn.token.nft) fail('the NFT input does not carry the position NFT');
  const locks = new Map(bins.map(p => [binV4LockingBytecode(p), p]));
  let inSats = BigInt(nftIn.satoshis), inTokens = 0n;
  for (const [j, i] of w.inputs.entries()) {
    if (j === k) continue;
    if (i.role !== 'bin') fail(`input ${j}: only bins and the NFT are spent`);
    const p = locks.get(i.lockingBytecode) ?? fail(`input ${j}: not a bin of this position`);
    if (i.unlockingBytecode !== binV4OwnerUnlocking(p, k)) fail(`input ${j}: unexpected unlocking bytecode`);
    inSats += BigInt(i.satoshis);
    if (i.token) inTokens += BigInt(i.token.amount);
  }
  const to = x.toLock ?? x.holderLock;
  let outSats = 0n, outTokens = 0n;
  for (const o of w.outputs) {
    outSats += BigInt(o.valueSatoshis);
    if (o.role === 'nft') {
      if (o.lockingBytecode !== x.holderLock) fail('the NFT does not come back to the holder');
      if (o.token?.category !== x.category || o.token.nft?.commitment !== nftIn.token!.nft!.commitment || o.token.nft?.capability !== nftIn.token!.nft!.capability) {
        fail('the NFT comes back changed');
      }
    } else {
      if (o.lockingBytecode !== to) fail('a withdrawal output goes elsewhere');
      if (o.token) outTokens += BigInt(o.token.amount);
    }
  }
  if (outTokens !== inTokens) fail('tokens would be burned or created');
  const fee = inSats - outSats;
  if (fee < 0n || fee > 20_000n) fail(`unexpected network fee: ${fee} sats`);
}

/**
 * Bin parameters of a registered position, rebuilt from what the server lists
 * (prices per bin, token and manager from the commitment, owner = the category)
 * and checked: each must hash to the bin address the server shows.
 */
export function paramsOfView(view: V4PositionView): BinV4Params[] {
  const c = view.commitment;
  return view.bins.map((b, k) => {
    const p = parseBinV4({
      ...(c.variant !== 'default' ? { variant: c.variant } : {}),
      tokenCat: c.tokenCat, ownerCat: view.category,
      bidNum: b.bid.num, bidDen: b.bid.den, askNum: b.ask.num, askDen: b.ask.den,
      ...(/^0{64}$/.test(c.managerHash) ? {} : { managerHash: c.managerHash }),
    });
    if (binV4LockingBytecode(p) !== b.lockingBytecode) fail(`bin ${k}: its address does not match its listed parameters`);
    return p;
  });
}

const B32 = 'abcdefghijklmnopqrstuvwxyz234567';
/** CIDv1 (raw codec, sha2-256) of a file whose sha256 is known: 'b' + base32(01 55 12 20 digest). */
export function cidOfSha256(sha256Hex: string): string {
  const bytes = [0x01, 0x55, 0x12, 0x20, ...(sha256Hex.match(/.{2}/g) ?? []).map(h => parseInt(h, 16))];
  let out = 'b', bits = 0, value = 0;
  for (const x of bytes) {
    value = ((value << 8) | x) & 0x1fff; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
