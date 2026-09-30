/**
 * Offline checks of the pool transaction builders against the real
 * StrategyCovenantV2 bytecode (cashscript MockNetworkProvider + VM debug).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockNetworkProvider, SignatureTemplate, TransactionBuilder, type Utxo } from 'cashscript';
import { binToHex, encodePrivateKeyWif, sha256, utf8ToBin } from '@bitauth/libauth';
import { buildPoolContract, sideParams, type PoolParams } from '../pool';
import { LocalWifSigner, ExternalWcSigner } from '../signer';
import {
  PoolTxError, buildCreatePools, buildFundPools, buildReprice, buildWithdraw, lockingBytecodeOf, voutOf, type Out,
} from '../poolTx';

const PUSD = 'dfe50223c8d5cba8dcef8dff6d92b61deb88a8ba44947367f2b746487b56039b';
const wifOf = (seed: string) => encodePrivateKeyWif(sha256.hash(utf8ToBin(seed)), 'testnet');
const hex = (b: Uint8Array) => binToHex(b);
const txid = (n: number) => n.toString(16).padStart(64, '0');

let provider: MockNetworkProvider;
let lp: LocalWifSigner;
let other: LocalWifSigner;
let sellBch: PoolParams;
let sellTok: PoolParams;

beforeEach(() => {
  provider = new MockNetworkProvider();
  lp = new LocalWifSigner(wifOf('lp'), 'chipnet', provider);
  other = new LocalWifSigner(wifOf('attacker'), 'chipnet', provider);
  sellBch = sideParams('SELL_BCH', PUSD, lp.pkh, { num: 2000n, den: 1n }, 30);
  sellTok = sideParams('SELL_TOKEN', PUSD, lp.pkh, { num: 1n, den: 2100n }, 30);
});

function fundWallet(signer: LocalWifSigner, sats: bigint[], tokens: bigint[] = []) {
  let n = 100;
  for (const s of sats) provider.addUtxo(signer.address, { txid: txid(n++), vout: 0, satoshis: s });
  for (const t of tokens) provider.addUtxo(signer.address, { txid: txid(n++), vout: 0, satoshis: 1000n, token: { category: PUSD, amount: t } });
}

/** Token and sats conservation across the built outputs. */
function totals(outs: Out[]) {
  return {
    sats: outs.reduce((a, o) => a + o.amount, 0n),
    tokens: outs.reduce((a, o) => a + (o.token?.amount ?? 0n), 0n),
  };
}

describe('create pools', () => {
  it('funds a two-sided market in one tx with raw locking bytecode outputs', async () => {
    fundWallet(lp, [1_000_000n], [1_000n]);
    const built = await buildCreatePools(lp, [
      { params: sellBch, sats: 200_000n, tokens: 0n },
      { params: sellTok, sats: 1_000n, tokens: 400n },
    ]);
    expect(built.vouts).toEqual([0, 1]);
    const [a, b] = built.contracts;
    expect(voutOf(built.outputs, a!.address)).toBe(0);
    expect(voutOf(built.outputs, b!.address)).toBe(1);
    expect(built.outputs[0]).toMatchObject({ amount: 200_000n });
    expect(built.outputs[0]!.token).toBeUndefined();
    expect(built.outputs[1]).toMatchObject({ amount: 1_000n, token: { category: PUSD, amount: 400n } });
    // token change back to the wallet's token-aware address, nothing burned
    const tokenOuts = built.outputs.filter(o => o.token);
    expect(tokenOuts.reduce((s, o) => s + o.token!.amount, 0n)).toBe(1_000n);
    expect(tokenOuts.find(o => o.to === lp.tokenAddress)?.token?.amount).toBe(600n);
    // fee is small and positive, and the tx builds with real signatures
    expect(built.fee).toBeGreaterThan(0n);
    expect(built.fee).toBeLessThan(2_000n);
    expect(() => built.builder.build()).not.toThrow();
  });

  it('rejects funding below the covenant minimums', async () => {
    fundWallet(lp, [1_000_000n], [10n]);
    await expect(buildCreatePools(lp, [{ params: sellBch, sats: 1_000n, tokens: 0n }])).rejects.toBeInstanceOf(PoolTxError);
    await expect(buildCreatePools(lp, [{ params: sellTok, sats: 1_000n, tokens: 1n }])).rejects.toThrow(/at least 2/);
  });

  it('reports insufficient BCH and tokens', async () => {
    fundWallet(lp, [5_000n], [10n]);
    await expect(buildCreatePools(lp, [{ params: sellBch, sats: 200_000n, tokens: 0n }])).rejects.toThrow(/Not enough BCH/);
    await expect(buildCreatePools(lp, [{ params: sellTok, sats: 1_000n, tokens: 50n }])).rejects.toThrow(/Not enough tokens/);
  });

  it('top-up adds another UTXO at the same pool address', async () => {
    fundWallet(lp, [500_000n]);
    const contract = buildPoolContract(sellBch, provider);
    const built = await buildFundPools(lp, [{ contract, side: 'SELL_BCH', token: PUSD, sats: 50_000n, tokens: 0n }]);
    expect(hex(built.outputs[0]!.to as Uint8Array)).toBe(hex(lockingBytecodeOf(contract.address)));
    expect(built.outputs[0]!.amount).toBe(50_000n);
  });
});

describe('a funded pool is fillable exactly at its price', () => {
  function fillTx(payout: bigint) {
    const pool = buildPoolContract(sellBch, provider);
    const trader = new SignatureTemplate(wifOf('trader'));
    const traderAddr = new LocalWifSigner(wifOf('trader'), 'chipnet', provider).address;
    const poolUtxo: Utxo = { txid: txid(1), vout: 0, satoshis: 200_000n };
    const traderUtxo: Utxo = { txid: txid(2), vout: 0, satoshis: 5_000n, token: { category: PUSD, amount: 10n } };
    return new TransactionBuilder({ provider })
      .addInput(poolUtxo, pool.unlock.fill())
      .addInput(traderUtxo, trader.unlockP2PKH())
      .addOutput({ to: pool.tokenAddress, amount: 200_000n - payout, token: { category: PUSD, amount: 10n } })
      .addOutput({ to: traderAddr, amount: payout + 5_000n - 1_000n });
  }
  it('accepts the covenant price (10 units → 19,940 sats)', () => {
    expect(() => fillTx(19_940n).debug()).not.toThrow();
  });
  it('rejects one sat more', () => {
    expect(() => fillTx(19_941n).debug()).toThrow();
  });
});

describe('withdraw', () => {
  const poolUtxo = (sats: bigint, tokens = 0n): Utxo =>
    ({ txid: txid(7), vout: 1, satoshis: sats, ...(tokens > 0n ? { token: { category: PUSD, amount: tokens } } : {}) });

  it('full withdraw returns the reserve and received tokens to the owner', async () => {
    const pool = buildPoolContract(sellBch, provider);
    const built = await buildWithdraw(lp, { contract: pool, params: sellBch }, [poolUtxo(180_060n, 10n)], 100);
    expect(built.remainderVout).toBeNull();
    expect(built.outputs.find(o => o.token)).toMatchObject({ to: lp.tokenAddress, token: { amount: 10n } });
    expect(built.outputs.find(o => !o.token)?.to).toBe(lp.address);
    expect(totals(built.outputs).sats + built.fee).toBe(180_060n);
    expect(() => built.builder.debug()).not.toThrow();
  });

  it('partial withdraw leaves one valid remainder at the pool address (output 0)', async () => {
    const pool = buildPoolContract(sellBch, provider);
    const built = await buildWithdraw(lp, { contract: pool, params: sellBch },
      [poolUtxo(100_000n, 10n), { txid: txid(8), vout: 0, satoshis: 60_000n }], 50);
    expect(built.remainderVout).toBe(0);
    const rem = built.outputs[0]!;
    expect(hex(rem.to as Uint8Array)).toBe(hex(lockingBytecodeOf(pool.address)));
    expect(rem.amount).toBe(80_000n);                 // half of 160,000
    expect(rem.token).toMatchObject({ amount: 5n });  // half of the received tokens
    expect(() => built.builder.debug()).not.toThrow();
  });

  it('refuses a partial withdraw that would leave an invalid pool', async () => {
    const pool = buildPoolContract(sellTok, provider);
    await expect(buildWithdraw(lp, { contract: pool, params: sellTok }, [poolUtxo(1_000n, 3n)], 90)).rejects.toThrow(/withdraw 100%/);
  });

  it('a token pool withdraw pays tokens to the token-aware address and fee from wallet BCH if needed', async () => {
    fundWallet(lp, [20_000n]);
    const pool = buildPoolContract(sellTok, provider);
    const built = await buildWithdraw(lp, { contract: pool, params: sellTok }, [poolUtxo(1_000n, 400n)], 100);
    expect(built.outputs.find(o => o.token)).toMatchObject({ to: lp.tokenAddress, token: { amount: 400n } });
    expect(built.inputs).toBe(2); // pool + one wallet UTXO for the fee
    expect(() => built.builder.debug()).not.toThrow();
  });

  it('a non-owner cannot dock the pool', async () => {
    fundWallet(other, [20_000n]);
    const pool = buildPoolContract(sellBch, provider);
    const built = await buildWithdraw(other, { contract: pool, params: sellBch }, [poolUtxo(180_060n)], 100);
    expect(() => built.builder.debug()).toThrow();
  });
});

describe('reprice', () => {
  it('SELL_BCH: moves the reserve to the new pool (output 0), received tokens to the owner', async () => {
    const oldPool = buildPoolContract(sellBch, provider);
    const next = { ...sellBch, priceNum: 2100 };
    const built = await buildReprice(lp, { contract: oldPool, params: sellBch }, [{ txid: txid(9), vout: 1, satoshis: 180_060n, token: { category: PUSD, amount: 10n } }], next);
    expect(built.vout).toBe(0);
    expect(hex(built.outputs[0]!.to as Uint8Array)).toBe(hex(lockingBytecodeOf(built.contract.address)));
    expect(built.outputs[0]!.amount).toBe(180_060n - 1_000n - built.fee);
    expect(built.outputs.find(o => o.token)).toMatchObject({ to: lp.tokenAddress, token: { amount: 10n } });
    expect(() => built.builder.debug()).not.toThrow();
  });

  it('SELL_TOKEN: moves the tokens, received BCH goes to the owner', async () => {
    const oldPool = buildPoolContract(sellTok, provider);
    const next = { ...sellTok, priceDen: 2000 };
    const built = await buildReprice(lp, { contract: oldPool, params: sellTok }, [{ txid: txid(9), vout: 1, satoshis: 151_000n, token: { category: PUSD, amount: 355n } }], next);
    expect(built.outputs[0]).toMatchObject({ amount: 1_000n, token: { amount: 355n } });
    expect(built.outputs.find(o => o.to === lp.address)?.amount).toBe(150_000n - built.fee);
    expect(() => built.builder.debug()).not.toThrow();
  });

  it('refuses to change side or token', async () => {
    const oldPool = buildPoolContract(sellBch, provider);
    await expect(buildReprice(lp, { contract: oldPool, params: sellBch }, [{ txid: txid(9), vout: 1, satoshis: 180_060n }], sellTok)).rejects.toThrow(/side and token/);
  });
});

describe('external wallet signer', () => {
  it('builds a WalletConnect request with the covenant input described for the wallet', async () => {
    let captured: any = null;
    const ext = new ExternalWcSigner(lp.address, 'chipnet', provider, async (payload) => { captured = payload; return { signedTransactionHash: 'ff'.repeat(32) }; });
    expect(ext.pkh).toBe(lp.pkh);
    fundWallet(lp, [20_000n]);
    const pool = buildPoolContract(sellTok, provider);
    const built = await buildWithdraw(ext, { contract: pool, params: sellTok }, [{ txid: txid(7), vout: 1, satoshis: 1_000n, token: { category: PUSD, amount: 400n } }], 100);
    const txidOut = await ext.send(built.builder, 'Withdraw pool');
    expect(txidOut).toBe('ff'.repeat(32));
    expect(captured.broadcast).toBe(true);
    expect(captured.userPrompt).toBe('Withdraw pool');
    expect(captured.sourceOutputs).toHaveLength(2);
    expect(captured.sourceOutputs[0].contract.abiFunction.name).toBe('dock');
    expect(captured.sourceOutputs[1].contract).toBeUndefined();
    // JSON-safe (WalletConnect transport)
    expect(() => JSON.stringify(captured)).not.toThrow();
  });
});
