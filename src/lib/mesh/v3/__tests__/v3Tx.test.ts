/**
 * V3 LP builders against the real MeshPoolV3 bytecode (MockNetworkProvider +
 * VM debug): deploy, fill the deployed pool, withdraw, rebalance, migrate V2.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockNetworkProvider, SignatureTemplate, TransactionBuilder, type Utxo } from 'cashscript';
import { encodePrivateKeyWif, sha256, utf8ToBin } from '@bitauth/libauth';
import { LocalWifSigner } from '../../signer';
import { buildPoolContract, sideParams } from '../../pool';
import { lockingBytecodeOf, type Out } from '../../poolTx';
import { buildV3Contract, mirrorOf, parseV3Params, type V3Params } from '../v3Pool';
import { buildDeployV3, buildMigrateV2, buildRebalanceV3, buildWithdrawV3 } from '../v3Tx';

const PUSD = 'dfe50223c8d5cba8dcef8dff6d92b61deb88a8ba44947367f2b746487b56039b';
const MUSD = 'b4863d5773c7a269b6fe3b9f7ce2ce1098ab71c0b046ef2a39058d5e30b1f353';
const wifOf = (seed: string) => encodePrivateKeyWif(sha256.hash(utf8ToBin(seed)), 'testnet');
const txid = (n: number) => n.toString(16).padStart(64, '0');

let provider: MockNetworkProvider;
let lp: LocalWifSigner;
let other: LocalWifSigner;
let n = 100;
let multi: V3Params;
let ask: V3Params;
let recycle: V3Params;

beforeEach(() => {
  provider = new MockNetworkProvider();
  lp = new LocalWifSigner(wifOf('lp-v3'), 'chipnet', provider);
  other = new LocalWifSigner(wifOf('attacker-v3'), 'chipnet', provider);
  multi = parseV3Params({ ownerPkh: lp.pkh, reserve: '0x', feeBps: 30, mode: 0, slots: [{ cat: PUSD, num: 2000, den: 1 }, { cat: MUSD, num: 1990, den: 1 }] });
  ask = parseV3Params({ ownerPkh: lp.pkh, reserve: PUSD, feeBps: 30, mode: 0, slots: [{ cat: '0x', num: 1, den: 2100 }] });
  recycle = parseV3Params({ ownerPkh: lp.pkh, reserve: '0x', feeBps: 30, mode: 2, slots: [{ cat: PUSD, num: 2000, den: 1, rNum: 1, rDen: 2200 }] });
});

function fundWallet(s: LocalWifSigner, sats: bigint[], tokens: Array<[string, bigint]> = []) {
  for (const x of sats) provider.addUtxo(s.address, { txid: txid(n++), vout: 0, satoshis: x });
  for (const [category, amount] of tokens) provider.addUtxo(s.address, { txid: txid(n++), vout: 0, satoshis: 1000n, token: { category, amount } });
}
/** A pool UTXO as a builder output would create it. */
function poolUtxo(out: Out): Utxo {
  return { txid: txid(n++), vout: 0, satoshis: out.amount, ...(out.token ? { token: { category: out.token.category, amount: out.token.amount } } : {}) } as Utxo;
}
const tokenSum = (outs: Out[], cat: string) => outs.reduce((a, o) => a + (o.token && o.token.category === cat ? o.token.amount : 0n), 0n);

describe('deploy', () => {
  it('funds a multi-asset BCH pool and a token pool in one tx; outputs are raw locking bytecode', async () => {
    fundWallet(lp, [500_000n], [[PUSD, 100n]]);
    const built = await buildDeployV3(lp, [{ params: multi, sats: 100_000n, tokens: 0n }, { params: ask, sats: 1_000n, tokens: 40n }]);
    expect(built.vouts).toEqual([0, 1]);
    expect(built.outputs[0]!.to).toEqual(lockingBytecodeOf(built.contracts[0]!.address));
    expect(built.outputs[1]).toMatchObject({ amount: 1_000n, token: { category: PUSD, amount: 40n } });
    expect(tokenSum(built.outputs, PUSD)).toBe(100n);           // 60 back to the wallet, nothing burned
    expect(() => built.builder.debug()).not.toThrow();
  });

  it('refuses deposits below the covenant minimums', async () => {
    fundWallet(lp, [500_000n], [[PUSD, 100n]]);
    await expect(buildDeployV3(lp, [{ params: multi, sats: 1_000n, tokens: 0n }])).rejects.toThrow(/more than 1000/);
    await expect(buildDeployV3(lp, [{ params: ask, sats: 1_000n, tokens: 1n }])).rejects.toThrow(/at least 2/);
  });

  it('the deployed pool fills at its price, proceeds at outputs[i + N]', async () => {
    fundWallet(lp, [500_000n]);
    const built = await buildDeployV3(lp, [{ params: multi, sats: 100_000n, tokens: 0n }]);
    const pool = built.contracts[0]!;
    const pu = poolUtxo(built.outputs[0]!);
    const taker = new SignatureTemplate(wifOf('taker'));
    const fill = (proceedsTo: Uint8Array, take: bigint) => new TransactionBuilder({ provider })
      .addInput(pu, pool.unlock.fill())
      .addInput({ txid: txid(n++), vout: 0, satoshis: 5_000n, token: { category: MUSD, amount: 10n } } as Utxo, taker.unlockP2PKH())
      .addOutput({ to: lockingBytecodeOf(pool.address), amount: 100_000n - take })
      .addOutput({ to: other.lockingBytecode, amount: take })
      .addOutput({ to: proceedsTo, amount: 1_000n, token: { category: MUSD, amount: 10n } });
    expect(() => fill(lp.lockingBytecode, 19_840n).debug()).not.toThrow();   // mUSD slot: 10 · 1990 · 0.997
    expect(() => fill(lp.lockingBytecode, 19_841n).debug()).toThrow();
    expect(() => fill(other.lockingBytecode, 19_840n).debug()).toThrow();     // proceeds must reach the owner
  });
});

describe('withdraw', () => {
  it('a token pool holding only its carrier sats: the wallet pays the fee, tokens come home', async () => {
    fundWallet(lp, [50_000n]);
    const c = buildV3Contract(ask, provider);
    const utxo = poolUtxo({ to: lockingBytecodeOf(c.address), amount: 1_000n, token: { category: PUSD, amount: 37n } });
    const built = await buildWithdrawV3(lp, [{ contract: c, utxos: [utxo] }]);
    expect(built.inputs).toBeGreaterThan(1);
    expect(built.outputs.find(o => o.to === lp.tokenAddress)?.token?.amount).toBe(37n);
    expect(() => built.builder.debug()).not.toThrow();
  });

  it('partial withdraw keeps a valid BCH remainder at output 0', async () => {
    fundWallet(lp, [50_000n]);
    const c = buildV3Contract(multi, provider);
    const utxos = [poolUtxo({ to: lockingBytecodeOf(c.address), amount: 60_000n }), poolUtxo({ to: lockingBytecodeOf(c.address), amount: 40_000n })];
    const built = await buildWithdrawV3(lp, [{ contract: c, utxos }], { percent: 25, reserve: '0x' });
    expect(built.remainderVout).toBe(0);
    expect(built.outputs[0]).toMatchObject({ amount: 75_000n });
    expect(() => built.builder.debug()).not.toThrow();
  });

  it('only the owner can dock', async () => {
    fundWallet(other, [50_000n]);
    const c = buildV3Contract(multi, provider);
    const built = await buildWithdrawV3(other, [{ contract: c, utxos: [poolUtxo({ to: lockingBytecodeOf(c.address), amount: 60_000n })] }]);
    expect(() => built.builder.debug()).toThrow();
  });
});

describe('rebalance N → M', () => {
  it('closes a BCH pool and a token pool and opens a recycling pool and its mirror in one tx', async () => {
    fundWallet(lp, [30_000n]);
    const a = buildV3Contract(multi, provider);
    const b = buildV3Contract(ask, provider);
    const close = [
      { contract: a, utxos: [poolUtxo({ to: lockingBytecodeOf(a.address), amount: 90_000n })] },
      { contract: b, utxos: [poolUtxo({ to: lockingBytecodeOf(b.address), amount: 1_000n, token: { category: PUSD, amount: 30n } })] },
    ];
    const open = [
      { params: recycle, sats: 80_000n, tokens: 0n },
      { params: mirrorOf(recycle), sats: 1_000n, tokens: 25n },
    ];
    const built = await buildRebalanceV3(lp, close, open);
    expect(built.vouts).toEqual([0, 1]);
    expect(built.outputs[1]).toMatchObject({ token: { category: PUSD, amount: 25n } });
    expect(tokenSum(built.outputs, PUSD)).toBe(30n);            // 5 left over → wallet
    expect(() => built.builder.debug()).not.toThrow();
  });

  it('tops up tokens from the wallet when the closed pools hold too few', async () => {
    fundWallet(lp, [30_000n], [[PUSD, 50n]]);
    const b = buildV3Contract(ask, provider);
    const built = await buildRebalanceV3(lp,
      [{ contract: b, utxos: [poolUtxo({ to: lockingBytecodeOf(b.address), amount: 1_000n, token: { category: PUSD, amount: 10n } })] }],
      [{ params: mirrorOf(recycle), sats: 1_000n, tokens: 40n }]);
    expect(built.outputs[0]).toMatchObject({ token: { amount: 40n } });
    expect(tokenSum(built.outputs, PUSD)).toBe(60n);
    expect(() => built.builder.debug()).not.toThrow();
  });
});

describe('migrate a V2 pool', () => {
  it('SELL_BCH V2 pool: reserve → V3 BCH pool, collected pUSD → a recycle (mirror) pool', async () => {
    fundWallet(lp, [10_000n]);
    const v2params = sideParams('SELL_BCH', PUSD, lp.pkh, { num: 2000n, den: 1n }, 30);
    const v2 = buildPoolContract(v2params, provider);
    const v2utxo = poolUtxo({ to: lockingBytecodeOf(v2.tokenAddress), amount: 80_000n, token: { category: PUSD, amount: 12n } });
    const reserveTo = parseV3Params({ ownerPkh: lp.pkh, reserve: '0x', feeBps: 30, mode: 2, slots: [{ cat: PUSD, num: 2000, den: 1, rNum: 1, rDen: 2200 }] });
    const built = await buildMigrateV2(lp, { contract: v2, params: v2params, utxos: [v2utxo] }, reserveTo, mirrorOf(reserveTo));
    const [newPool, mirror] = built.contracts;
    expect(built.outputs[0]!.to).toEqual(lockingBytecodeOf(newPool!.address));
    expect(built.outputs[0]!.amount).toBeGreaterThan(78_000n);   // the reserve minus the fee
    expect(built.outputs.find(o => o.to instanceof Uint8Array && (o.to as Uint8Array).length === 35 && o.token)?.token?.amount).toBe(12n);
    expect(mirror!.address).toBe(buildV3Contract(mirrorOf(reserveTo), provider).address);
    expect(() => built.builder.debug()).not.toThrow();
  });

  it('refuses a new pool with a different reserve asset', async () => {
    const v2params = sideParams('SELL_BCH', PUSD, lp.pkh, { num: 2000n, den: 1n }, 30);
    const v2 = buildPoolContract(v2params, provider);
    await expect(buildMigrateV2(lp, { contract: v2, params: v2params, utxos: [poolUtxo({ to: lockingBytecodeOf(v2.address), amount: 80_000n })] }, ask))
      .rejects.toThrow(/reserve asset/);
  });
});
