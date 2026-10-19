/**
 * V3 pool transactions for LPs: deploy (one or many pools, e.g. a strategy),
 * withdraw, rebalance N → M, and migrate a V2 pool to V3.
 *
 * Same rules as the V2 builders (../poolTx.ts):
 *   - covenant outputs are raw locking bytecode, never wallet.send()
 *   - tokens are always balanced: what isn't deposited goes to the wallet's
 *     token-aware address, nothing is burned
 *   - the fee is measured from the built transaction
 *   - dock() has no output rules, so closing and opening pools can share one tx
 * A V3 token pool holds only its 1000 carrier sats, so withdrawing one needs a
 * wallet input for the fee — `balance()` adds it.
 */
import type { Contract, NetworkProvider, Utxo } from 'cashscript';
import {
  DEFAULT_FEE_RATE, PoolTxError, balance, buildPayment, lockingBytecodeOf, selectTokens,
  type BuiltTx, type In, type Out,
} from '../poolTx';
import { TOKEN_DUST, normCategory, poolSide, poolToken, type PoolParams } from '../pool';
import type { MeshSigner } from '../signer';
import { V3_MIN_SATS, buildV3Contract, type V3Params } from './v3Pool';

/** A V3 pool to fund: `tokens` are of the pool's reserve category (0 for a BCH reserve). */
export interface V3Deposit { params: V3Params; sats: bigint; tokens: bigint }

/** A live pool to close: its contract and the UTXOs to dock. */
export interface ClosePool { contract: Contract; utxos: Utxo[] }

const sum = (xs: bigint[]) => xs.reduce((a, b) => a + b, 0n);

/** The output that funds a V3 pool (validated against the covenant minimums). */
export function depositOutput(d: V3Deposit, provider: NetworkProvider): { out: Out; contract: Contract } {
  const contract = buildV3Contract(d.params, provider);
  const to = lockingBytecodeOf(contract.address);
  if (d.params.reserve === '0x') {
    if (d.tokens !== 0n) throw new PoolTxError('A BCH pool holds BCH only', 'INVALID_AMOUNT');
    if (d.sats <= V3_MIN_SATS) throw new PoolTxError(`A BCH pool needs more than ${V3_MIN_SATS} sats`, 'INVALID_AMOUNT');
    return { contract, out: { to, amount: d.sats } };
  }
  if (d.tokens < 2n) throw new PoolTxError('A token pool needs at least 2 token base units (1 always stays in the pool)', 'INVALID_AMOUNT');
  return { contract, out: { to, amount: d.sats > TOKEN_DUST ? d.sats : TOKEN_DUST, token: { category: d.params.reserve, amount: d.tokens } } };
}

/** Fund one or more V3 pools in one transaction (outputs 0..n-1, in order). */
export async function buildDeployV3(signer: MeshSigner, deposits: V3Deposit[], feeRate = DEFAULT_FEE_RATE): Promise<BuiltTx & { contracts: Contract[]; vouts: number[] }> {
  if (deposits.length === 0) throw new PoolTxError('nothing to deploy', 'INVALID_AMOUNT');
  const made = deposits.map(d => depositOutput(d, signer.provider));
  const built = await buildPayment(signer, made.map(m => m.out), feeRate);
  return { ...built, contracts: made.map(m => m.contract), vouts: made.map((_, i) => i) };
}

function docks(signer: MeshSigner, pools: ClosePool[]): { ins: In[]; sats: bigint; tokens: Map<string, bigint> } {
  const ins: In[] = [];
  const tokens = new Map<string, bigint>();
  let sats = 0n;
  for (const p of pools) {
    for (const u of p.utxos) {
      ins.push({ utxo: u, unlocker: signer.dockUnlocker(p.contract), p2pkh: false });
      sats += u.satoshis;
      if (u.token && !u.token.nft) {
        const c = normCategory(u.token.category);
        tokens.set(c, (tokens.get(c) ?? 0n) + u.token.amount);
      }
    }
  }
  return { ins, sats, tokens };
}

/**
 * Withdraw from V3 pools. With one pool and `percent` < 100, one consolidated
 * remainder stays in the pool (output 0) and must still be a valid reserve.
 */
export async function buildWithdrawV3(
  signer: MeshSigner, pools: ClosePool[], opts: { percent?: number; reserve?: string; feeRate?: number } = {},
): Promise<BuiltTx & { remainderVout: number | null }> {
  const percent = opts.percent ?? 100;
  if (pools.every(p => p.utxos.length === 0)) throw new PoolTxError('Nothing to withdraw', 'INVALID_AMOUNT');
  if (!(percent > 0 && percent <= 100)) throw new PoolTxError('percent must be in (0, 100]', 'INVALID_AMOUNT');
  if (percent < 100 && (pools.length !== 1 || opts.reserve === undefined)) {
    throw new PoolTxError('A partial withdraw needs exactly one pool and its reserve', 'INVALID_AMOUNT');
  }
  const { ins, sats, tokens } = docks(signer, pools);
  const outs: Out[] = [];
  let remainderVout: number | null = null;
  if (percent < 100) {
    const reserve = normCategory(opts.reserve);
    const bp = BigInt(Math.round(percent * 100));
    if (reserve === '0x') {
      const keep = sats - (sats * bp) / 10_000n;
      if (keep <= V3_MIN_SATS) throw new PoolTxError('What would stay is below the pool\'s 1000-sat minimum — withdraw 100% instead', 'INVALID_AMOUNT');
      outs.push({ to: lockingBytecodeOf(pools[0]!.contract.address), amount: keep });
    } else {
      const T = tokens.get(reserve) ?? 0n;
      const keep = T - (T * bp) / 10_000n;
      if (keep < 2n) throw new PoolTxError('What would stay is below 2 token units — withdraw 100% instead', 'INVALID_AMOUNT');
      outs.push({ to: lockingBytecodeOf(pools[0]!.contract.address), amount: TOKEN_DUST, token: { category: reserve, amount: keep } });
      tokens.set(reserve, T - keep);
    }
    remainderVout = 0;
  }
  for (const [category, amount] of tokens) if (amount > 0n) outs.push({ to: signer.tokenAddress, amount: TOKEN_DUST, token: { category, amount } });
  const plain = (await signer.getUtxos()).filter(u => !u.token);
  return { ...balance(signer, ins, outs, plain, opts.feeRate ?? DEFAULT_FEE_RATE), remainderVout };
}

/**
 * N → M in one transaction: dock every UTXO of `close`, fund every pool of
 * `open` (outputs 0..m-1). Tokens the new pools need come from the closed
 * pools first, then the wallet; leftovers go to the wallet. BCH is balanced
 * with the wallet (fee, and any shortfall).
 */
export async function buildRebalanceV3(
  signer: MeshSigner, close: ClosePool[], open: V3Deposit[], feeRate = DEFAULT_FEE_RATE,
): Promise<BuiltTx & { contracts: Contract[]; vouts: number[] }> {
  if (close.every(p => p.utxos.length === 0) && open.length === 0) throw new PoolTxError('nothing to rebalance', 'INVALID_AMOUNT');
  const { ins, tokens } = docks(signer, close);
  const made = open.map(d => depositOutput(d, signer.provider));
  const outs: Out[] = made.map(m => m.out);

  const need = new Map<string, bigint>();
  for (const o of outs) if (o.token) need.set(o.token.category, (need.get(o.token.category) ?? 0n) + o.token.amount);
  const wallet = await signer.getUtxos();
  for (const [category, amount] of need) {
    const have = tokens.get(category) ?? 0n;
    if (have >= amount) { tokens.set(category, have - amount); continue; }
    tokens.set(category, 0n);
    const { picked, change } = selectTokens(wallet, category, amount - have);
    for (const u of picked) ins.push({ utxo: u, unlocker: signer.p2pkhUnlocker(u), p2pkh: true });
    if (change > 0n) tokens.set(category, change);
  }
  for (const [category, amount] of tokens) if (amount > 0n) outs.push({ to: signer.tokenAddress, amount: TOKEN_DUST, token: { category, amount } });
  const built = balance(signer, ins, outs, wallet.filter(u => !u.token), feeRate);
  return { ...built, contracts: made.map(m => m.contract), vouts: made.map((_, i) => i) };
}

/**
 * Migrate a V2 pool to V3 in one transaction: dock it, move its reserve into
 * `reserveTo` (a V3 pool with the same reserve asset) and what it collected
 * into `collectedTo` (a V3 pool with the other asset as reserve) or the wallet.
 * The BCH side is funded from the pool itself (as change), so the new BCH pool
 * receives everything left after the fee.
 */
export async function buildMigrateV2(
  signer: MeshSigner,
  v2: { contract: Contract; params: PoolParams; utxos: Utxo[] },
  reserveTo: V3Params,
  collectedTo?: V3Params,
  feeRate = DEFAULT_FEE_RATE,
): Promise<BuiltTx & { contracts: Contract[] }> {
  if (v2.utxos.length === 0) throw new PoolTxError('The V2 pool has no UTXOs', 'INVALID_AMOUNT');
  const side = poolSide(v2.params);
  const token = poolToken(v2.params);
  const reserveAsset = side === 'SELL_BCH' ? '0x' : token;
  if (reserveTo.reserve !== reserveAsset) throw new PoolTxError('The new pool must keep the V2 pool\'s reserve asset', 'INVALID_AMOUNT');
  if (collectedTo && collectedTo.reserve !== (side === 'SELL_BCH' ? token : '0x')) {
    throw new PoolTxError('The recycle pool must hold what the V2 pool collected', 'INVALID_AMOUNT');
  }
  const { ins, tokens } = docks(signer, [{ contract: v2.contract, utxos: v2.utxos }]);
  const T = tokens.get(token) ?? 0n;
  const reserveC = buildV3Contract(reserveTo, signer.provider);
  const collectedC = collectedTo ? buildV3Contract(collectedTo, signer.provider) : undefined;
  const contracts = collectedC ? [reserveC, collectedC] : [reserveC];

  if (side === 'SELL_BCH') {
    // reserve = sats → new BCH pool (as change, output 0); collected tokens → recycle pool or wallet
    const outs: Out[] = [];
    if (T > 0n) {
      if (collectedC && T >= 2n) outs.push({ to: lockingBytecodeOf(collectedC.address), amount: TOKEN_DUST, token: { category: token, amount: T } });
      else outs.push({ to: signer.tokenAddress, amount: TOKEN_DUST, token: { category: token, amount: T } });
    }
    // the fee comes out of the reserve: wallet coins never flow into the new pool
    const built = balance(signer, ins, outs, [], feeRate, { to: lockingBytecodeOf(reserveC.address), at: 0, min: V3_MIN_SATS + 1n });
    return { ...built, contracts };
  }
  // SELL_TOKEN: reserve tokens → new token pool (output 0); collected sats → recycle pool (as change) or wallet
  if (T < 2n) throw new PoolTxError('The V2 pool has fewer than 2 token units left — withdraw instead', 'INVALID_AMOUNT');
  const outs: Out[] = [{ to: lockingBytecodeOf(reserveC.address), amount: TOKEN_DUST, token: { category: token, amount: T } }];
  const plain = (await signer.getUtxos()).filter(u => !u.token);
  const sats = sum(v2.utxos.map(u => u.satoshis));
  const recycle = collectedC && sats - TOKEN_DUST > V3_MIN_SATS + 1000n;
  const built = recycle
    ? balance(signer, ins, outs, [], feeRate, { to: lockingBytecodeOf(collectedC!.address), at: 1, min: V3_MIN_SATS + 1n })
    : balance(signer, ins, outs, plain, feeRate);
  return { ...built, contracts };
}
