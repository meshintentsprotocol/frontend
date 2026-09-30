/**
 * Pool transactions for LPs: create, top up, withdraw (partial / full), reprice.
 *
 * Every builder returns a ready TransactionBuilder; `signer.send()` signs and
 * broadcasts it (locally or through the external wallet). Rules:
 *   - covenant outputs are written as raw locking bytecode, never via
 *     wallet.send() (which drops CashTokens) or a non-token address
 *   - tokens are always balanced: change and withdrawn tokens go to the
 *     wallet's token-aware address, so nothing is burned
 *   - the fee is measured from the built transaction, not guessed
 *   - dock() has no output rules, so a withdraw can keep a consolidated
 *     remainder in the pool, and a reprice can move the reserve to a new pool
 *     in the same transaction
 */
import { TransactionBuilder, type Contract, type Unlocker, type Utxo } from 'cashscript';
import { cashAddressToLockingBytecode } from '@bitauth/libauth';
import {
  POOL_MIN_SATS, TOKEN_DUST, buildPoolContract, normCategory, poolSide, poolToken,
  type PoolParams, type PoolSide,
} from './pool';
import type { MeshSigner } from './signer';

export const DEFAULT_FEE_RATE = 1.2; // sat/byte; relay minimum is 1
const P2PKH_DUST = 546n;

export class PoolTxError extends Error {
  constructor(message: string, readonly code: 'INSUFFICIENT_FUNDS' | 'INVALID_AMOUNT' | 'POOL_CHANGED' | 'BROADCAST') { super(message); }
}

export interface In { utxo: Utxo; unlocker: Unlocker; p2pkh: boolean }
export interface Out { to: Uint8Array | string; amount: bigint; token?: { category: string; amount: bigint; nft?: any } }

export interface BuiltTx { builder: TransactionBuilder; fee: bigint; size: number; inputs: number; outputs: Out[] }

export function lockingBytecodeOf(address: string): Uint8Array {
  const r = cashAddressToLockingBytecode(address);
  if (typeof r === 'string') throw new Error(`invalid address ${address}: ${r}`);
  return r.bytecode;
}

const sum = (xs: bigint[]) => xs.reduce((a, b) => a + b, 0n);

function makeBuilder(signer: MeshSigner, ins: In[], outs: Out[]): TransactionBuilder {
  const b = new TransactionBuilder({ provider: signer.provider });
  for (const i of ins) b.addInput(i.utxo, i.unlocker);
  for (const o of outs) b.addOutput(o as any);
  return b;
}

function measure(signer: MeshSigner, ins: In[], outs: Out[]): number {
  const hex = makeBuilder(signer, ins, outs).build();
  return hex.length / 2 + signer.unsignedInputPadding * ins.filter(i => i.p2pkh).length;
}

/**
 * Add wallet BCH inputs until the transaction pays its fee, and put the
 * surplus into a change output (`change.to`, inserted at `change.at`).
 */
export function balance(
  signer: MeshSigner, ins: In[], outs: Out[], walletPlain: Utxo[], feeRate: number,
  change: { to: Uint8Array | string; at?: number; min?: bigint } = { to: signer.address },
): BuiltTx {
  const pool = [...walletPlain].sort((a, b) => (b.satoshis > a.satoshis ? 1 : -1));
  const chosen = [...ins];
  const minChange = change.min ?? P2PKH_DUST;
  const withChange = (amount: bigint) => {
    const o = [...outs];
    o.splice(change.at ?? o.length, 0, { to: change.to, amount });
    return o;
  };
  for (;;) {
    const satsIn = sum(chosen.map(i => i.utxo.satoshis));
    const satsOut = sum(outs.map(o => o.amount));
    // Try with a change output first (its exact amount does not change the size).
    const sizeC = measure(signer, chosen, withChange(minChange));
    const feeC = BigInt(Math.ceil(sizeC * feeRate));
    const changeAmt = satsIn - satsOut - feeC;
    if (changeAmt >= minChange) {
      const finalOuts = withChange(changeAmt);
      return { builder: makeBuilder(signer, chosen, finalOuts), fee: feeC, size: sizeC, inputs: chosen.length, outputs: finalOuts };
    }
    if (change.min === undefined) {
      // A change output is optional: drop it if what is left is dust.
      const size = measure(signer, chosen, outs);
      const fee = BigInt(Math.ceil(size * feeRate));
      if (satsIn - satsOut >= fee) {
        return { builder: makeBuilder(signer, chosen, outs), fee: satsIn - satsOut, size, inputs: chosen.length, outputs: outs };
      }
    }
    const next = pool.shift();
    if (!next) {
      throw new PoolTxError(`Not enough BCH: short by ${(-changeAmt + minChange).toString()} sats (including the network fee)`, 'INSUFFICIENT_FUNDS');
    }
    chosen.push({ utxo: next, unlocker: signer.p2pkhUnlocker(), p2pkh: true });
  }
}

/** Pick token UTXOs of `category` covering `amount`; returns the inputs and the token change. */
export function selectTokens(utxos: Utxo[], category: string, amount: bigint): { picked: Utxo[]; change: bigint } {
  const cands = utxos
    .filter(u => u.token && !u.token.nft && normCategory(u.token.category) === category)
    .sort((a, b) => (b.token!.amount > a.token!.amount ? 1 : -1));
  const picked: Utxo[] = [];
  let got = 0n;
  for (const u of cands) {
    if (got >= amount) break;
    picked.push(u);
    got += u.token!.amount;
  }
  if (got < amount) throw new PoolTxError(`Not enough tokens: have ${got}, need ${amount} base units`, 'INSUFFICIENT_FUNDS');
  return { picked, change: got - amount };
}

export interface FundTarget { contract: Contract; side: PoolSide; token: string; sats: bigint; tokens: bigint }

function validateTarget(t: FundTarget): void {
  if (t.side === 'SELL_BCH') {
    if (t.sats <= POOL_MIN_SATS) throw new PoolTxError(`A BCH pool needs more than ${POOL_MIN_SATS} sats`, 'INVALID_AMOUNT');
  } else {
    if (t.tokens < 2n) throw new PoolTxError('A token pool needs at least 2 token base units (1 always stays in the pool)', 'INVALID_AMOUNT');
  }
}

/**
 * One transaction funding one or more pool outputs (outputs 0..n-1, in order).
 * Used for creating pools and for top-ups (a top-up is another UTXO at the pool address).
 */
export async function buildFundPools(signer: MeshSigner, targets: FundTarget[], feeRate = DEFAULT_FEE_RATE): Promise<BuiltTx & { vouts: number[] }> {
  if (targets.length === 0) throw new PoolTxError('nothing to fund', 'INVALID_AMOUNT');
  targets.forEach(validateTarget);
  const outs: Out[] = targets.map(t => {
    const to = lockingBytecodeOf(t.contract.address);
    if (t.side === 'SELL_BCH' && t.tokens === 0n) return { to, amount: t.sats };
    const category = normCategory(t.token);
    return { to, amount: t.sats > TOKEN_DUST ? t.sats : TOKEN_DUST, token: { category, amount: t.tokens } };
  });
  const built = await buildPayment(signer, outs, feeRate);
  return { ...built, vouts: targets.map((_, i) => i) };
}

/**
 * Pay `outs` (outputs 0..n-1, in order) from the wallet: selects token UTXOs
 * per category (change to the token-aware address), then BCH for the rest.
 */
export async function buildPayment(signer: MeshSigner, outs: Out[], feeRate = DEFAULT_FEE_RATE): Promise<BuiltTx> {
  const utxos = await signer.getUtxos();
  const all = [...outs];
  const need = new Map<string, bigint>();
  for (const o of outs) if (o.token) need.set(normCategory(o.token.category), (need.get(normCategory(o.token.category)) ?? 0n) + o.token.amount);
  const ins: In[] = [];
  for (const [category, amount] of need) {
    const { picked, change } = selectTokens(utxos, category, amount);
    for (const u of picked) ins.push({ utxo: u, unlocker: signer.p2pkhUnlocker(), p2pkh: true });
    if (change > 0n) all.push({ to: signer.tokenAddress, amount: TOKEN_DUST, token: { category, amount: change } });
  }
  return balance(signer, ins, all, utxos.filter(u => !u.token), feeRate);
}

/** Create pools from params (e.g. one SELL_BCH + one SELL_TOKEN for a two-sided market). */
export async function buildCreatePools(
  signer: MeshSigner,
  pools: Array<{ params: PoolParams; sats: bigint; tokens: bigint }>,
  feeRate = DEFAULT_FEE_RATE,
) {
  const targets = pools.map(p => ({
    contract: buildPoolContract(p.params, signer.provider),
    side: poolSide(p.params), token: poolToken(p.params), sats: p.sats, tokens: p.tokens,
  }));
  const built = await buildFundPools(signer, targets, feeRate);
  return { ...built, contracts: targets.map(t => t.contract) };
}

export interface PoolTarget { contract: Contract; params: Pick<PoolParams, 'tokenCategoryIn' | 'tokenCategoryOut'> }

/**
 * Dock pool UTXOs and pay the owner. `percent` < 100 keeps one consolidated
 * remainder at the pool address (output 0) holding the other share of both the
 * reserve and the tokens; it must still be a valid pool.
 */
export async function buildWithdraw(
  signer: MeshSigner, pool: PoolTarget, poolUtxos: Utxo[], percent: number, feeRate = DEFAULT_FEE_RATE,
): Promise<BuiltTx & { remainderVout: number | null }> {
  if (poolUtxos.length === 0) throw new PoolTxError('The pool has no UTXOs to withdraw', 'INVALID_AMOUNT');
  if (!(percent > 0 && percent <= 100)) throw new PoolTxError('percent must be in (0, 100]', 'INVALID_AMOUNT');
  const side = poolSide(pool.params);
  const cat = poolToken(pool.params);
  const ins: In[] = poolUtxos.map(u => ({ utxo: u, unlocker: signer.dockUnlocker(pool.contract), p2pkh: false }));

  const S = sum(poolUtxos.map(u => u.satoshis));
  const byCat = new Map<string, bigint>();
  const nfts: Utxo[] = [];
  for (const u of poolUtxos) {
    if (!u.token) continue;
    if (u.token.nft) { nfts.push(u); continue; }
    const c = normCategory(u.token.category);
    byCat.set(c, (byCat.get(c) ?? 0n) + u.token.amount);
  }
  const T = byCat.get(cat) ?? 0n;

  const outs: Out[] = [];
  let remainderVout: number | null = null;
  if (percent < 100) {
    const bp = BigInt(Math.round(percent * 100));
    let rS = S - (S * bp) / 10_000n;
    const rT = T - (T * bp) / 10_000n;
    if (side === 'SELL_BCH' && rS <= POOL_MIN_SATS) {
      throw new PoolTxError('What would stay in the pool is below its 1000-sat minimum — withdraw 100% instead', 'INVALID_AMOUNT');
    }
    if (side === 'SELL_TOKEN') {
      if (rT < 2n) throw new PoolTxError('What would stay in the pool is below 2 token units — withdraw 100% instead', 'INVALID_AMOUNT');
      if (rS < TOKEN_DUST) rS = TOKEN_DUST;
    }
    if (rT > 0n && rS < TOKEN_DUST) rS = TOKEN_DUST;
    outs.push({ to: lockingBytecodeOf(pool.contract.address), amount: rS, token: rT > 0n ? { category: cat, amount: rT } : undefined });
    remainderVout = 0;
    // the owner receives the withdrawn share of the pool token
    if (T - rT > 0n) byCat.set(cat, T - rT); else byCat.delete(cat);
  }
  for (const [category, amount] of byCat) {
    if (amount > 0n) outs.push({ to: signer.tokenAddress, amount: TOKEN_DUST, token: { category, amount } });
  }
  for (const u of nfts) outs.push({ to: signer.tokenAddress, amount: TOKEN_DUST, token: { ...u.token!, category: normCategory(u.token!.category) } });

  const plain = (await signer.getUtxos()).filter(u => !u.token);
  const built = balance(signer, ins, outs, plain, feeRate);
  return { ...built, remainderVout };
}

/**
 * Move a pool to new terms (price / fee) in one transaction: dock the old UTXOs
 * and fund the new pool at output 0. The reserve moves; what the pool received
 * (tokens for a BCH pool, BCH for a token pool) goes back to the owner.
 */
export async function buildReprice(
  signer: MeshSigner, oldPool: PoolTarget, poolUtxos: Utxo[], newParams: PoolParams, feeRate = DEFAULT_FEE_RATE,
): Promise<BuiltTx & { contract: Contract; vout: number }> {
  const side = poolSide(oldPool.params);
  const cat = poolToken(oldPool.params);
  if (poolSide(newParams) !== side || poolToken(newParams) !== cat) {
    throw new PoolTxError('A reprice keeps the pool side and token; create a new pool instead', 'INVALID_AMOUNT');
  }
  if (poolUtxos.length === 0) throw new PoolTxError('The pool has no UTXOs', 'INVALID_AMOUNT');
  const contract = buildPoolContract(newParams, signer.provider);
  const newLock = lockingBytecodeOf(contract.address);
  const ins: In[] = poolUtxos.map(u => ({ utxo: u, unlocker: signer.dockUnlocker(oldPool.contract), p2pkh: false }));
  const T = sum(poolUtxos.filter(u => u.token && !u.token.nft && normCategory(u.token.category) === cat).map(u => u.token!.amount));
  const plain = (await signer.getUtxos()).filter(u => !u.token);

  if (side === 'SELL_BCH') {
    // Reserve (sats) → new pool at output 0; received tokens → owner.
    const outs: Out[] = T > 0n ? [{ to: signer.tokenAddress, amount: TOKEN_DUST, token: { category: cat, amount: T } }] : [];
    const built = balance(signer, ins, outs, [], feeRate, { to: newLock, at: 0, min: POOL_MIN_SATS + 1n });
    return { ...built, contract, vout: 0 };
  }
  if (T < 2n) throw new PoolTxError('The pool has fewer than 2 token units left — withdraw instead', 'INVALID_AMOUNT');
  // Reserve (tokens) → new pool at output 0; received sats → owner as change.
  const outs: Out[] = [{ to: newLock, amount: TOKEN_DUST, token: { category: cat, amount: T } }];
  const built = balance(signer, ins, outs, plain, feeRate);
  return { ...built, contract, vout: 0 };
}

/** Sign + broadcast with a clear error when a solver fill raced the LP. */
export async function sendPoolTx(signer: MeshSigner, built: { builder: TransactionBuilder }, prompt: string): Promise<string> {
  try {
    return await signer.send(built.builder, prompt);
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (/missing.?inputs|txn-mempool-conflict|bad-txns-inputs-missingorspent|conflict/i.test(msg)) {
      throw new PoolTxError('The pool changed while you were signing (a trade probably just filled it). Refresh and try again.', 'POOL_CHANGED');
    }
    throw new PoolTxError(msg, 'BROADCAST');
  }
}

/** Locate the vout of `address` in a built output list (safety check before registering). */
export function voutOf(outputs: Out[], address: string): number {
  const lock = lockingBytecodeOf(address);
  const hex = (b: Uint8Array) => Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
  const target = hex(lock);
  return outputs.findIndex(o => o.to instanceof Uint8Array && hex(o.to) === target);
}
