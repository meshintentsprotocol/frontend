/**
 * V4 in the browser: encoder parity with the audited contracts' vectors, local
 * verification of server plans (every tampering refused), and the wallet's
 * transaction builders (offline, cashscript MockNetworkProvider).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockNetworkProvider, type Utxo } from 'cashscript';
import { binToHex, decodeTransaction, encodePrivateKeyWif, hexToBin, sha256, utf8ToBin } from '@bitauth/libauth';
import binVectors from '../../__fixtures__/meshBinV4.vectors.json';
import nftVectors from '../../__fixtures__/positionNft.vectors.json';
import planFixture from '../../__fixtures__/v4Plan.fixture.json';
import {
  binV4Address, binV4Args, binV4FillUnlocking, binV4LockingBytecode, binV4ManageUnlocking, binV4OwnerUnlocking,
  binV4Prefix, binV4RedeemHex, binV4ScriptHash, parseBinV4, validateBinV4, BinV4ParamError,
} from '../binV4';
import { decodeCommitment, encodeCommitment, gridFraction, gridPrice, levelOf, ONE, v4Levels } from '../position';
import { PlanCheckError, cidOfSha256, paramsOfView, verifyMigratePlan, verifyPlan, verifyWithdrawPlan, type PlanExpect } from '../verify';
import { buildGenesis, buildMigrate, buildSeed, buildTransferV4, buildWithdrawV4, findSeed } from '../v4Tx';
import { LocalWifSigner } from '../../signer';
import { lockingBytecodeOf } from '../../poolTx';
import type { V4MigratePlan, V4Plan, V4PositionView, V4WithdrawPlan } from '../types';

const PUSD = 'dfe50223c8d5cba8dcef8dff6d92b61deb88a8ba44947367f2b746487b56039b';
const wifOf = (seed: string) => encodePrivateKeyWif(sha256.hash(utf8ToBin(seed)), 'testnet');
const txid = (n: number) => n.toString(16).padStart(64, '0');
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

// ── Encoder parity ────────────────────────────────────────────────────────────

describe('MeshBinV4 encoder: parity with the contracts repo vectors', () => {
  for (const v of (binVectors as any).vectors) {
    it(v.name, () => {
      const p = parseBinV4(v.params);
      expect(binV4Args(p)).toEqual(v.args);
      expect(binV4Prefix(p)).toBe(v.prefixHex);
      expect(binV4RedeemHex(p)).toBe(v.redeemScriptHex);
      expect(binV4ScriptHash(p)).toBe(v.scriptHash);
      expect(binV4LockingBytecode(p)).toBe(v.lockingBytecodeHex);
      expect(binV4Address(p, 'chipnet')).toBe(v.chipnet.address);
      expect(binV4Address(p, 'chipnet', true)).toBe(v.chipnet.tokenAddress);
      expect(binV4Address(p, 'mainnet')).toBe(v.mainnet.address);
      expect(binV4FillUnlocking(p, p.variant === 'feeSchedule' ? 1 : 0)).toBe(v.unlocking.fill);
      if (v.unlocking.fillTier0) expect(binV4FillUnlocking(p, 0)).toBe(v.unlocking.fillTier0);
      expect(binV4ManageUnlocking(p)).toBe(v.unlocking.manage);
      if (v.unlocking.owner1) {
        expect(binV4OwnerUnlocking(p, 1)).toBe(v.unlocking.owner1);
        expect(binV4OwnerUnlocking(p, 17)).toBe(v.unlocking.owner17);
      } else {
        expect(() => binV4OwnerUnlocking(p, 1)).toThrow(BinV4ParamError);
      }
    });
  }
  // the encoder's own rules, on the params as given (parseBinV4 also lowercases API input)
  for (const v of (binVectors as any).invalid) {
    it(`refuses: ${v.name}`, () => {
      const q = v.params;
      const p: any = { ...q, bidNum: BigInt(q.bidNum), bidDen: BigInt(q.bidDen), askNum: BigInt(q.askNum), askDen: BigInt(q.askDen),
        ...(q.sizeFee ? { sizeFee: { ...q.sizeFee, refSize: BigInt(q.sizeFee.refSize) } } : {}) };
      expect(() => validateBinV4(p)).toThrow(BinV4ParamError);
    });
  }
});

describe('position commitment and grid', () => {
  for (const v of (nftVectors as any).vectors) {
    it(`commitment ${v.name}`, () => {
      expect(encodeCommitment(v.fields)).toBe(v.hex);
      expect(decodeCommitment(v.hex)).toEqual(v.fields);
    });
  }
  for (const v of (nftVectors as any).invalid ?? []) {
    if (typeof v.hex === 'string') it(`refuses commitment: ${v.name}`, () => expect(() => decodeCommitment(v.hex)).toThrow());
  }
  it('grid: level 0 is 1, levels compose, fractions bracket the price', () => {
    expect(gridPrice(100, 0)).toBe(ONE);
    expect(Number(gridPrice(100, 1)) / Number(ONE)).toBeCloseTo(1.01, 12);
    const p = gridPrice(100, 762);
    const d = gridFraction(100, 762, 'down'), u = gridFraction(100, 762, 'up');
    expect(d.num * ONE <= p * d.den).toBe(true);
    expect(u.num * ONE >= p * u.den).toBe(true);
    expect(levelOf(Number(p) / Number(ONE), 100)).toBe(762);
  });
  it('a V3 range maps to the same V4 levels as the server migration', () => {
    const at = (i: number) => Number(gridPrice(100, i)) / Number(ONE);
    expect(v4Levels(at(758), at(767), at(763), 100)).toEqual({ lowIndex: 758, highIndex: 766, marketIndex: 762 });
  });
});

// ── Plan verification ────────────────────────────────────────────────────────

const plan = (planFixture as any).plan as V4Plan;
const lp = () => new LocalWifSigner(wifOf('lp'), 'chipnet', new MockNetworkProvider());
const expectFor = (p: V4Plan = plan): PlanExpect => ({
  category: p.category, tokenCat: PUSD, ownerLock: binToHex(lp().lockingBytecode), binStepBps: 100,
  maxSats: 60_000n + 4n * 1000n, maxTokens: 40n, lowIndex: 758, highIndex: 766,
});
const refuses = (mutate: (p: V4Plan) => void, msg: RegExp) => {
  const p = clone(plan);
  mutate(p);
  expect(() => verifyPlan(p, expectFor(p))).toThrow(PlanCheckError);
  expect(() => verifyPlan(p, expectFor(p))).toThrow(msg);
};

describe('verifyPlan: the server proposes, the browser checks', () => {
  it('accepts the planner\'s own plan and returns every bin', () => {
    const bins = verifyPlan(plan, expectFor());
    expect(bins).toHaveLength(9);
    expect(plan.metadata.uri).toBe(`ipfs://${cidOfSha256(plan.metadata.sha256)}`);
  });
  it('refuses an NFT sent to someone else', () => refuses(p => { p.outputs[1]!.lockingBytecode = '76a914' + '11'.repeat(20) + '88ac'; }, /NFT does not go to this wallet/));
  it('refuses a minting NFT', () => refuses(p => { p.outputs[1]!.token!.nft!.capability = 'minting'; }, /must be mutable/));
  it('refuses a bin address that is not its parameters', () => refuses(p => {
    const o = p.outputs.find(o => o.role === 'bin')!; o.lockingBytecode = 'aa20' + '22'.repeat(32) + '87'; p.bins[o.binIndex!]!.lockingBytecode = o.lockingBytecode;
  }, /address does not match/));
  it('refuses a bin owned by another position', () => refuses(p => { (p.bins[0]!.params as any).ownerCat = '33'.repeat(32); }, /owned by another position|address does not match/));
  it('refuses a cheap ask (a price off the grid)', () => refuses(p => {
    const b = p.bins.find(b => b.side === 'ask')!;
    (b.params as any).askNum = (b.params as any).bidNum; (b.params as any).askDen = (b.params as any).bidDen;
  }, /ask is not the grid price|address does not match/));
  it('refuses bins outside the range asked for', () => {
    expect(() => verifyPlan(plan, { ...expectFor(), lowIndex: 760 })).toThrow(/below the range/);
  });
  it('refuses a plan that takes more than the deposit', () => {
    expect(() => verifyPlan(plan, { ...expectFor(), maxSats: 50_000n })).toThrow(/bins take/);
    expect(() => verifyPlan(plan, { ...expectFor(), maxTokens: 39n })).toThrow(/token units/);
  });
  it('refuses an extra or a fat identity output', () => {
    refuses(p => { p.outputs[0]!.valueSatoshis = '50000'; }, /identity output/);
    refuses(p => { p.outputs.splice(2, 0, { role: 'identity', lockingBytecode: p.outputs[0]!.lockingBytecode, valueSatoshis: '500' }); }, /identity output must be output 0|output 1/);
  });
  it('refuses a metadata output that is not the planned publication', () => {
    refuses(p => { p.metadata.uri = 'ipfs://bafkreiattacker'; }, /IPFS address|BCMR publication/);
    refuses(p => { const m = p.outputs[p.outputs.length - 1]!; m.valueSatoshis = '1000'; }, /must carry nothing/);
  });
  it('refuses a bin funded twice or not at all', () => {
    refuses(p => { const o = p.outputs.find(o => o.role === 'bin')!; p.outputs.splice(3, 0, { ...o }); }, /funded twice/);
    refuses(p => { p.outputs = p.outputs.filter(o => !(o.role === 'bin' && o.binIndex === 8)); }, /not funded/);
  });
  it('refuses a manager or variant the LP did not ask for', () => refuses(p => { (p.bins[0]!.params as any).managerHash = '44'.repeat(32); }, /manager or variant|address does not match/));
});

// ── Transactions ─────────────────────────────────────────────────────────────

let provider: MockNetworkProvider;
let signer: LocalWifSigner;
beforeEach(() => {
  provider = new MockNetworkProvider();
  signer = new LocalWifSigner(wifOf('lp'), 'chipnet', provider);
});

describe('genesis transaction', () => {
  it('finds a seed, or makes one at output 0', async () => {
    provider.addUtxo(signer.address, { txid: txid(7), vout: 1, satoshis: 50_000n });
    expect(findSeed(await signer.getUtxos())).toBeNull();
    const built = await buildSeed(signer);
    expect(built.outputs[0]!.to).toBe(signer.address);
    expect(built.outputs).toHaveLength(1);
  });

  it('lays out seed at input 0, the plan\'s outputs in order, token and BCH change after', async () => {
    provider.addUtxo(signer.address, { txid: txid(100), vout: 0, satoshis: 5_000n });               // the seed
    provider.addUtxo(signer.address, { txid: txid(101), vout: 0, satoshis: 200_000n });
    provider.addUtxo(signer.address, { txid: txid(102), vout: 1, satoshis: 1_000n, token: { category: PUSD, amount: 100n } });
    const seed = findSeed(await signer.getUtxos())!;
    expect(seed.txid).toBe(txid(101));                                    // the largest output #0 …
    const s100 = (await signer.getUtxos()).find(u => u.txid === txid(100))!;  // … but the plan's seed is txid(100)
    const built = await buildGenesis(signer, plan, s100);
    const tx = decodeTransaction(hexToBin(built.builder.build()));
    if (typeof tx === 'string') throw new Error(tx);
    expect(binToHex(tx.inputs[0]!.outpointTransactionHash)).toBe(plan.category);
    expect(tx.inputs[0]!.outpointIndex).toBe(0);
    plan.outputs.forEach((o, j) => {
      expect(binToHex(tx.outputs[j]!.lockingBytecode)).toBe(o.lockingBytecode);
      expect(tx.outputs[j]!.valueSatoshis).toBe(BigInt(o.valueSatoshis));
    });
    // NFT at output 1 with the commitment; 60 PUSD change back to the token address
    expect(binToHex(tx.outputs[1]!.token!.category)).toBe(plan.category);
    expect(binToHex(tx.outputs[1]!.token!.nft!.commitment)).toBe(plan.commitmentHex);
    const rest = tx.outputs.slice(plan.outputs.length);
    expect(rest[0]!.token?.amount).toBe(60n);
    expect(binToHex(rest[0]!.lockingBytecode)).toBe(binToHex(lockingBytecodeOf(signer.tokenAddress)));
    // the fee is paid and nothing else leaves the wallet
    const inSats = 5_000n + 200_000n + 1_000n;
    const outSats = tx.outputs.reduce((a, o) => a + o.valueSatoshis, 0n);
    expect(inSats - outSats).toBe(built.fee);
    expect(Number(built.fee)).toBeLessThan(built.size * 2);
  });

  it('refuses a seed that is not the plan\'s output #0', async () => {
    const wrong: Utxo = { txid: txid(100), vout: 1, satoshis: 5_000n };
    await expect(buildGenesis(signer, plan, wrong)).rejects.toThrow(/seed/);
  });
});

/** A registered-position view built from the plan (what GET /v4/positions/:category returns). */
function viewOf(p: V4Plan, live: Array<{ k: number; sats: bigint; tokens: bigint }>): V4PositionView {
  return {
    category: p.category, genesisTxid: txid(500), nftOutput: 1, pairName: null, commitment: p.commitment as any, metadata: null, holder: null,
    totals: { sats: '0', tokens: '0', valueAtBidSats: '0', bins: p.bins.length, binsWithTokens: 0 },
    bins: p.bins.map((b, k) => {
      const pp = parseBinV4(b.params);
      const l = live.find(x => x.k === k);
      return {
        index: k, address: b.address, lockingBytecode: b.lockingBytecode, variant: 'default',
        bid: { num: pp.bidNum.toString(), den: pp.bidDen.toString(), satsPerUnit: b.bidSatsPerUnit },
        ask: { num: pp.askNum.toString(), den: pp.askDen.toString(), satsPerUnit: b.askSatsPerUnit },
        utxos: l ? [{ txid: txid(600 + k), vout: 0, sats: l.sats.toString(), tokens: l.tokens.toString() }] : [],
        sats: (l?.sats ?? 0n).toString(), tokens: (l?.tokens ?? 0n).toString(), canBuyTokensForSats: '0', canSellTokens: '0',
      };
    }),
    registeredAt: new Date(0).toISOString(),
  };
}

function withdrawPlanFor(p: V4Plan, holderLock: string, live: Array<{ k: number; sats: bigint; tokens: bigint }>): V4WithdrawPlan {
  const bins = paramsOfView(viewOf(p, live));
  const nftIndex = live.length;
  const nft = { capability: 'mutable' as const, commitment: p.commitmentHex };
  const sats = live.reduce((a, l) => a + l.sats, 0n), tokens = live.reduce((a, l) => a + l.tokens, 0n);
  const fee = 2_000n;
  return {
    category: p.category, nftInputIndex: nftIndex, feeSats: fee.toString(), estimatedBytes: 1500, note: '',
    inputs: [
      ...live.map(l => ({
        role: 'bin' as const, binIndex: l.k, txid: txid(600 + l.k), vout: 0, satoshis: l.sats.toString(),
        ...(l.tokens > 0n ? { token: { category: PUSD, amount: l.tokens.toString() } } : {}),
        lockingBytecode: binV4LockingBytecode(bins[l.k]!), unlockingBytecode: binV4OwnerUnlocking(bins[l.k]!, nftIndex),
      })),
      { role: 'nft' as const, txid: txid(700), vout: 1, satoshis: '1000', lockingBytecode: holderLock, token: { category: p.category, amount: '0', nft }, unlockingBytecode: null, sign: true },
    ],
    outputs: [
      { role: 'bch', lockingBytecode: holderLock, valueSatoshis: (sats - fee - 1000n).toString() },
      { role: 'tokens', lockingBytecode: holderLock, valueSatoshis: '1000', token: { category: PUSD, amount: tokens.toString() } },
      { role: 'nft', lockingBytecode: holderLock, valueSatoshis: '1000', token: { category: p.category, amount: '0', nft } },
    ],
  };
}

describe('withdrawal', () => {
  const live = [{ k: 0, sats: 9_000n, tokens: 0n }, { k: 6, sats: 1_000n, tokens: 10n }, { k: 8, sats: 3_000n, tokens: 2n }];
  it('verifies the server plan against the rebuilt bins and builds it unchanged', () => {
    const holderLock = binToHex(signer.lockingBytecode);
    const view = viewOf(plan, live);
    const bins = paramsOfView(view);
    const w = withdrawPlanFor(plan, holderLock, live);
    verifyWithdrawPlan(w, bins, { category: plan.category, holderLock });
    const built = buildWithdrawV4(signer, w);
    const tx = decodeTransaction(hexToBin(built.builder.build()));
    if (typeof tx === 'string') throw new Error(tx);
    expect(tx.inputs).toHaveLength(4);
    expect(binToHex(tx.inputs[0]!.unlockingBytecode)).toBe(w.inputs[0]!.unlockingBytecode);
    expect(tx.outputs).toHaveLength(3);
    expect(built.fee).toBe(2_000n);
  });
  it('refuses a plan that pays someone else, burns tokens or keeps the NFT', () => {
    const holderLock = binToHex(signer.lockingBytecode);
    const bins = paramsOfView(viewOf(plan, live));
    const bad1 = withdrawPlanFor(plan, holderLock, live); bad1.outputs[0]!.lockingBytecode = '76a914' + '55'.repeat(20) + '88ac';
    expect(() => verifyWithdrawPlan(bad1, bins, { category: plan.category, holderLock })).toThrow(/goes elsewhere/);
    const bad2 = withdrawPlanFor(plan, holderLock, live); bad2.outputs[1]!.token!.amount = '1';
    expect(() => verifyWithdrawPlan(bad2, bins, { category: plan.category, holderLock })).toThrow(/burned/);
    const bad3 = withdrawPlanFor(plan, holderLock, live); bad3.outputs[2]!.lockingBytecode = '76a914' + '55'.repeat(20) + '88ac';
    expect(() => verifyWithdrawPlan(bad3, bins, { category: plan.category, holderLock })).toThrow(/NFT does not come back/);
    const bad4 = withdrawPlanFor(plan, holderLock, live); bad4.inputs[0]!.unlockingBytecode = binV4FillUnlocking(bins[0]!);
    expect(() => verifyWithdrawPlan(bad4, bins, { category: plan.category, holderLock })).toThrow(/unlocking/);
  });
  it('a view whose bins do not hash to their addresses is refused', () => {
    const v = viewOf(plan, live); v.bins[3]!.ask.num = (BigInt(v.bins[3]!.ask.num) * 2n).toString();
    expect(() => paramsOfView(v)).toThrow(/does not match/);
  });
});

describe('transfer', () => {
  it('sends the NFT unchanged to the new holder; the wallet pays the fee', async () => {
    provider.addUtxo(signer.address, { txid: txid(101), vout: 0, satoshis: 20_000n });
    const nft: Utxo = { txid: txid(700), vout: 1, satoshis: 1000n, token: { category: plan.category, amount: 0n, nft: { capability: 'mutable', commitment: plan.commitmentHex } } };
    const to = new LocalWifSigner(wifOf('friend'), 'chipnet', provider).tokenAddress;
    const built = await buildTransferV4(signer, nft, to);
    expect(built.outputs[0]).toMatchObject({ amount: 1000n, token: { category: plan.category, amount: 0n, nft: { capability: 'mutable', commitment: plan.commitmentHex } } });
    expect(binToHex(built.outputs[0]!.to as Uint8Array)).toBe(binToHex(lockingBytecodeOf(to)));
    await expect(buildTransferV4(signer, nft, 'not-an-address')).rejects.toThrow(/valid address/);
  });
});

describe('migration', () => {
  it('verifies the plan and returns undocked tokens to the wallet', async () => {
    const m: V4MigratePlan = {
      strategy: 'stg-x', note: '', leftSats: '0', v4: plan,
      available: { sats: '70000', tokens: '45' },
      close: [{ address: 'bchtest:p…', contractName: 'MeshPoolV3', utxos: [
        { txid: txid(800), vout: 0, sats: '60000', tokens: '0', category: null },
        { txid: txid(801), vout: 0, sats: '10000', tokens: '45', category: PUSD },
      ] }],
    };
    const x = expectFor();
    expect(verifyMigratePlan(m, { category: x.category, tokenCat: PUSD, ownerLock: x.ownerLock, binStepBps: 100 })).toHaveLength(9);
    const lie = clone(m); lie.available.sats = '90000';
    expect(() => verifyMigratePlan(lie, { category: x.category, tokenCat: PUSD, ownerLock: x.ownerLock, binStepBps: 100 })).toThrow(/other sats/);

    // the builder: a stand-in V3 contract (dock unlocker from the signer) is enough to lay the transaction out
    const fakeContract = { address: 'bchtest:pq', unlock: { dock: () => ({ generateLockingBytecode: () => hexToBin('aa20' + '66'.repeat(32) + '87'), generateUnlockingBytecode: () => hexToBin('00') }) } } as any;
    provider.addUtxo(signer.address, { txid: txid(100), vout: 0, satoshis: 3_000n });
    const seed = (await signer.getUtxos()).find(u => u.txid === txid(100))!;
    const close = [{ contract: fakeContract, utxos: [
      { txid: txid(800), vout: 0, satoshis: 60_000n },
      { txid: txid(801), vout: 0, satoshis: 10_000n, token: { category: PUSD, amount: 45n } },
    ] as Utxo[] }];
    const built = await buildMigrate(signer, m, seed, close);
    const extra = built.outputs.slice(plan.outputs.length);
    expect(extra[0]).toMatchObject({ token: { category: PUSD, amount: 5n } });   // 45 docked − 40 in the position
    expect(built.inputs).toBe(3);
  });
});
