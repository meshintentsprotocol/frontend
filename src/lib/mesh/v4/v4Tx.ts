/**
 * V4 position transactions for the LP's wallet: seed, genesis, withdraw,
 * transfer, and the V3 → V4 migration. Every plan comes from the server and is
 * verified first (./verify); these builders only lay it out and add the
 * wallet's inputs, change and fee (measured from the built transaction).
 *
 * Genesis layout (D12): input 0 spends output #0 of the seed transaction (its
 * txid becomes the position's category); outputs are the plan's in order
 * (identity, NFT, bins, BCMR publication), then token change, then BCH change.
 */
import { hexToBin } from '@bitauth/libauth';
import { TransactionBuilder, type Contract, type Unlocker, type Utxo } from 'cashscript';
import { DEFAULT_FEE_RATE, PoolTxError, balance, lockingBytecodeOf, selectTokens, type BuiltTx, type In, type Out } from '../poolTx';
import { TOKEN_DUST, normCategory } from '../pool';
import type { MeshSigner } from '../signer';
import type { V4MigratePlan, V4Plan, V4PlanOutput, V4TokenJson, V4WithdrawPlan } from './types';

const plain = (u: Utxo) => !u.token;

/** A plain wallet UTXO at output #0 of its transaction: usable as a genesis seed (largest first). */
export function findSeed(utxos: Utxo[]): Utxo | null {
  return utxos.filter(u => plain(u) && u.vout === 0).sort((a, b) => (b.satoshis > a.satoshis ? 1 : -1))[0] ?? null;
}

/**
 * No seed in the wallet: pay the wallet's own largest plain UTXO back to itself
 * at output 0. The new transaction's output #0 is the seed (usable unconfirmed).
 */
export async function buildSeed(signer: MeshSigner, feeRate = DEFAULT_FEE_RATE): Promise<BuiltTx> {
  const utxos = (await signer.getUtxos()).filter(plain).sort((a, b) => (b.satoshis > a.satoshis ? 1 : -1));
  const first = utxos[0];
  if (!first) throw new PoolTxError('The wallet has no BCH to make a seed output from', 'INSUFFICIENT_FUNDS');
  return balance(signer, [{ utxo: first, unlocker: signer.p2pkhUnlocker(), p2pkh: true }], [], utxos.slice(1), feeRate,
    { to: signer.address, at: 0, min: 1000n });
}

const tokenOf = (t: V4TokenJson | undefined): Out['token'] =>
  t ? { category: t.category, amount: BigInt(t.amount), ...(t.nft ? { nft: { capability: t.nft.capability, commitment: t.nft.commitment } } : {}) } : undefined;

export const planOutputs = (outs: V4PlanOutput[]): Out[] =>
  outs.map(o => ({ to: hexToBin(o.lockingBytecode), amount: BigInt(o.valueSatoshis), ...(o.token ? { token: tokenOf(o.token) } : {}) }));

/** The genesis: seed at input 0, the plan's outputs in order, token deposits from the wallet, change last. */
export async function buildGenesis(signer: MeshSigner, plan: V4Plan, seed: Utxo, feeRate = DEFAULT_FEE_RATE): Promise<BuiltTx> {
  if (seed.vout !== 0 || seed.txid !== plan.category || seed.token) throw new PoolTxError('the seed must be a plain output #0 whose txid is the plan\'s category', 'INVALID_AMOUNT');
  const utxos = await signer.getUtxos();
  const outs = planOutputs(plan.outputs);
  const ins: In[] = [{ utxo: seed, unlocker: signer.p2pkhUnlocker(), p2pkh: true }];
  const tokenCat = plan.commitment.tokenCat;
  const tokens = BigInt(plan.totals.tokens);
  if (tokens > 0n) {
    const { picked, change } = selectTokens(utxos, tokenCat, tokens);
    for (const u of picked) ins.push({ utxo: u, unlocker: signer.p2pkhUnlocker(), p2pkh: true });
    if (change > 0n) outs.push({ to: signer.tokenAddress, amount: TOKEN_DUST, token: { category: tokenCat, amount: change } });
  }
  const others = utxos.filter(u => plain(u) && !(u.txid === seed.txid && u.vout === seed.vout));
  return balance(signer, ins, outs, others, feeRate);
}

/** An input whose unlocking bytecode is already known (a bin's owner(k) path from the plan). */
export function fixedUnlocker(lockingHex: string, unlockingHex: string): Unlocker {
  const lock = hexToBin(lockingHex), unl = hexToBin(unlockingHex);
  return { generateLockingBytecode: () => lock, generateUnlockingBytecode: () => unl } as Unlocker;
}

const utxoOf = (i: { txid: string; vout: number; satoshis: string; token?: V4TokenJson }): Utxo => ({
  txid: i.txid, vout: i.vout, satoshis: BigInt(i.satoshis),
  ...(i.token ? { token: tokenOf(i.token) as Utxo['token'] } : {}),
});

/**
 * The withdrawal as planned: bins through owner(k), the NFT input signed by
 * the holder (P2PKH), outputs in order. The fee comes out of the bins.
 */
export function buildWithdrawV4(signer: MeshSigner, w: V4WithdrawPlan): BuiltTx {
  const ins: In[] = w.inputs.map(i => (i.role === 'nft'
    ? { utxo: utxoOf(i), unlocker: signer.p2pkhUnlocker(), p2pkh: true }
    : { utxo: utxoOf(i), unlocker: fixedUnlocker(i.lockingBytecode, i.unlockingBytecode!), p2pkh: false }));
  const outs: Out[] = w.outputs.map(o => ({ to: hexToBin(o.lockingBytecode), amount: BigInt(o.valueSatoshis), ...(o.token ? { token: tokenOf(o.token) } : {}) }));
  // no wallet inputs and no change: the plan is balanced, and the holder signs only the NFT input
  const builder = new TransactionBuilder({ provider: signer.provider });
  for (const i of ins) builder.addInput(i.utxo, i.unlocker);
  for (const o of outs) builder.addOutput(o as any);
  const size = builder.build().length / 2 + signer.unsignedInputPadding;
  const fee = ins.reduce((a, i) => a + i.utxo.satoshis, 0n) - outs.reduce((a, o) => a + o.amount, 0n);
  if (BigInt(size) > fee) throw new PoolTxError(`the plan's fee (${fee} sats) is below 1 sat/byte for ${size} bytes: ask for a new plan`, 'INVALID_AMOUNT');
  return { builder, fee, size, inputs: ins.length, outputs: outs };
}

/** Send the position NFT (and with it the position) to another token-aware address. */
export async function buildTransferV4(signer: MeshSigner, nft: Utxo, to: string, feeRate = DEFAULT_FEE_RATE): Promise<BuiltTx> {
  if (!nft.token?.nft) throw new PoolTxError('that UTXO does not hold an NFT', 'INVALID_AMOUNT');
  let lock: Uint8Array;
  try { lock = lockingBytecodeOf(to); } catch { throw new PoolTxError('not a valid address', 'INVALID_AMOUNT'); }
  const outs: Out[] = [{ to: lock, amount: nft.satoshis, token: { ...nft.token, category: normCategory(nft.token.category) } }];
  const others = (await signer.getUtxos()).filter(plain);
  return balance(signer, [{ utxo: nft, unlocker: signer.p2pkhUnlocker(), p2pkh: true }], outs, others, feeRate);
}

export interface MigrateClose { contract: Contract; utxos: Utxo[] }

/**
 * Migration: seed at input 0, every V3 pool UTXO docked (owner signature), the
 * V4 genesis outputs in order; tokens the position does not take go back to the
 * wallet, and BCH change last. The wallet tops up only if the pools fall short.
 */
export async function buildMigrate(signer: MeshSigner, m: V4MigratePlan, seed: Utxo, close: MigrateClose[], feeRate = DEFAULT_FEE_RATE): Promise<BuiltTx> {
  if (seed.vout !== 0 || seed.txid !== m.v4.category || seed.token) throw new PoolTxError('the seed must be a plain output #0 whose txid is the plan\'s category', 'INVALID_AMOUNT');
  const ins: In[] = [{ utxo: seed, unlocker: signer.p2pkhUnlocker(), p2pkh: true }];
  const docked = new Map<string, bigint>();
  for (const c of close) for (const u of c.utxos) {
    ins.push({ utxo: u, unlocker: signer.dockUnlocker(c.contract), p2pkh: false });
    if (u.token && !u.token.nft) {
      const cat = normCategory(u.token.category);
      docked.set(cat, (docked.get(cat) ?? 0n) + u.token.amount);
    }
    if (u.token?.nft) throw new PoolTxError('a pool holds an NFT: withdraw it first', 'INVALID_AMOUNT');
  }
  const outs = planOutputs(m.v4.outputs);
  const tokenCat = m.v4.commitment.tokenCat;
  const used = BigInt(m.v4.totals.tokens);
  if ((docked.get(tokenCat) ?? 0n) < used) throw new PoolTxError('the pools hold fewer tokens than the plan puts in the position', 'POOL_CHANGED');
  docked.set(tokenCat, (docked.get(tokenCat) ?? 0n) - used);
  for (const [category, amount] of docked) if (amount > 0n) outs.push({ to: signer.tokenAddress, amount: TOKEN_DUST, token: { category, amount } });
  const others = (await signer.getUtxos()).filter(u => plain(u) && !(u.txid === seed.txid && u.vout === seed.vout));
  return balance(signer, ins, outs, others, feeRate);
}
