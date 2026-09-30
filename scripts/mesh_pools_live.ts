/**
 * Live chipnet test of the Mesh pool pages' transaction code and the pool API.
 *
 * Uses the FRONTEND's own modules (src/lib/mesh: pool, poolTx, signer, meshApi)
 * with a LocalWifSigner — the same code the pages run — against a meshserver.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/mesh_pools_live.ts
 *
 * Env:
 *   MESH_URL    default http://localhost:3001
 *   FUNDER_WIF  default RELAYER_PRIVATE_KEY_WIF from ../cashtoken-relayer/.env
 *               (on :3001 this is also the solver wallet: seeding happens before
 *               any test intent is open, and everything is swept back at the end)
 *   OUT_DIR     default ../BCHMesh/meshserver/data/pool_pages_run_<timestamp> (gitignored)
 *   RECOVER_DIR recovery only: withdraw every pool listed in <dir>/pools.json with the
 *               keys in <dir>/keys.json and sweep the wallets back to the funder
 *
 * Flow: seed → preview parity → create two-sided pools (1 tx) → register →
 * fill each pool with a real intent → top-up → reprice → partial withdraw →
 * full withdraw → negative/API checks → sweep funds back.
 */
import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { ElectrumNetworkProvider, TransactionBuilder, type Utxo } from 'cashscript';
import { encodePrivateKeyWif } from '@bitauth/libauth';
import { LocalWifSigner } from '../src/lib/mesh/signer';
import {
  buildCreatePools, buildFundPools, buildPayment, buildReprice, buildWithdraw, sendPoolTx, voutOf, lockingBytecodeOf,
  DEFAULT_FEE_RATE,
} from '../src/lib/mesh/poolTx';
import {
  TOKEN_DUST, artifactHash, buildPoolContract, contractFromArgs, poolOutputFor, priceFromTokenPerBch, sideParams,
  tokenPerBchFromSatsPerUnit, type PoolParams,
} from '../src/lib/mesh/pool';
import { createMeshApi, MeshApiError, meshWsUrl, type Pool, type PoolEvent } from '../src/lib/mesh/meshApi';

const PUSD = 'dfe50223c8d5cba8dcef8dff6d92b61deb88a8ba44947367f2b746487b56039b';
const DECIMALS = 2;
const MESH = process.env.MESH_URL ?? 'http://localhost:3001';
const STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const OUT = path.resolve(process.env.OUT_DIR ?? `../BCHMesh/meshserver/data/pool_pages_run_${STAMP}`);
const EXPLORER = 'https://chipnet.imaginary.cash/tx/';

function envFile(file: string, key: string): string {
  const line = fs.readFileSync(file, 'utf8').split(/\r?\n/).find(l => l.startsWith(`${key}=`));
  return (line?.slice(key.length + 1) ?? '').trim().replace(/^["']|["']$/g, '');
}
const FUNDER_WIF = process.env.FUNDER_WIF ?? envFile(path.resolve('../cashtoken-relayer/.env'), 'RELAYER_PRIVATE_KEY_WIF');

const provider = new ElectrumNetworkProvider('chipnet');
const api = createMeshApi(MESH);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ── Reporting ────────────────────────────────────────────────────────────────
interface Check { id: string; name: string; ok: boolean; detail?: string; tx?: string }
const checks: Check[] = [];
const txs: Record<string, string> = {};
function check(id: string, name: string, ok: boolean, detail?: string, tx?: string) {
  checks.push({ id, name, ok, detail, tx });
  console.log(`${ok ? '✅' : '❌'} ${id} ${name}${detail ? ` — ${detail}` : ''}${tx ? `\n     ${EXPLORER}${tx}` : ''}`);
}
function save(extra: Record<string, unknown> = {}) {
  fs.mkdirSync(OUT, { recursive: true });
  const j = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x), 2);
  fs.writeFileSync(path.join(OUT, 'results.json'), j({ server: MESH, stamp: STAMP, checks, txs, ...extra }));
}

async function waitFor<T>(what: string, fn: () => Promise<T | undefined | null | false>, timeoutMs = 60_000, everyMs = 3_000): Promise<T> {
  const end = Date.now() + timeoutMs;
  let lastErr: unknown;
  while (Date.now() < end) {
    try { const v = await fn(); if (v) return v; } catch (e) { lastErr = e; }
    await sleep(everyMs);
  }
  throw new Error(`timed out waiting for ${what}${lastErr ? `: ${(lastErr as Error).message}` : ''}`);
}

const newWif = () => encodePrivateKeyWif(new Uint8Array(randomBytes(32)), 'testnet');

// Every pool this run funds, persisted as soon as it exists so an interrupted run can be recovered.
const createdPools: PoolParams[] = [];
function rememberPool(dir: string, p: PoolParams) {
  createdPools.push(p);
  fs.writeFileSync(path.join(dir, 'pools.json'), JSON.stringify(createdPools, null, 2));
}

/** Withdraw whatever is still in `pools` (read from chain, not from the server) back to the LP. */
async function recoverPools(lp: LocalWifSigner, pools: PoolParams[]) {
  for (const params of pools) {
    const contract = buildPoolContract(params, provider);
    try {
      const utxos = await provider.getUtxos(contract.address);
      if (utxos.length === 0) continue;
      const w = await buildWithdraw(lp, { contract, params }, utxos, 100);
      console.log(`recovered ${utxos.length} UTXO(s) from ${contract.address}: ${await sendPoolTx(lp, w, 'recover')}`);
      await sleep(2000);
    } catch (e) { console.warn(`recover ${contract.address}: ${(e as Error).message}`); }
  }
}

/** Send every UTXO of `from` to `to` (tokens to its token address). */
async function sweep(from: LocalWifSigner, to: LocalWifSigner): Promise<string | null> {
  const utxos = await from.getUtxos();
  if (utxos.length === 0) return null;
  const byCat = new Map<string, bigint>();
  for (const u of utxos) if (u.token && !u.token.nft) byCat.set(u.token.category, (byCat.get(u.token.category) ?? 0n) + u.token.amount);
  const total = utxos.reduce((a, u) => a + u.satoshis, 0n);
  const make = (bch: bigint) => {
    const b = new TransactionBuilder({ provider });
    for (const u of utxos) b.addInput(u, from.p2pkhUnlocker());
    for (const [category, amount] of byCat) b.addOutput({ to: to.tokenAddress, amount: TOKEN_DUST, token: { category, amount } });
    b.addOutput({ to: to.address, amount: bch });
    return b;
  };
  const dust = TOKEN_DUST * BigInt(byCat.size);
  const size = make(total - dust - 1000n).build().length / 2;
  const fee = BigInt(Math.ceil(size * DEFAULT_FEE_RATE));
  if (total - dust - fee < 546n) return null;
  return (await make(total - dust - fee).send()).txid;
}

async function registerWithRetry(items: Parameters<typeof api.register>[0]) {
  return waitFor('registration', async () => {
    try { return await api.register(items); }
    catch (e) { if (e instanceof MeshApiError && e.status === 404) return undefined; throw e; }
  }, 45_000);
}

async function syncUntil(address: string, txid: string): Promise<{ pool: Pool; event: PoolEvent }> {
  return waitFor(`pool ${address} to see ${txid.slice(0, 12)}`, async () => {
    const { pool } = await api.sync(address);
    const { events } = await api.activity(address, { limit: 50 });
    const event = events.find(e => e.txid === txid);
    return event ? { pool, event } : undefined;
  }, 60_000, 4_000);
}

async function runIntent(trader: LocalWifSigner, body: Record<string, unknown>, fund: { sats?: bigint; tokens?: bigint }) {
  const res = await fetch(`${MESH}/api/v1/intent/create`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ makerAddress: trader.address, orderType: 'limit', duration: 3600, ...body }),
  });
  const it: any = await res.json();
  if (res.status !== 201) throw new Error(`intent create ${res.status}: ${it.error}`);
  const out = fund.tokens
    ? { to: it.tokenAddress as string, amount: TOKEN_DUST, token: { category: PUSD, amount: fund.tokens } }
    : { to: lockingBytecodeOf(it.contractAddress), amount: fund.sats! };
  const fundTx = await sendPoolTx(trader, await buildPayment(trader, [out]), 'fund intent');
  const t0 = Date.now();
  const final: any = await waitFor(`intent ${it.intentId} to fill`, async () => {
    const r = await fetch(`${MESH}/api/v1/intent/${it.intentId}`);
    const v: any = await r.json();
    return ['filled', 'refunded', 'cancelled', 'closed_external'].includes(v.status) ? v : undefined;
  }, 180_000, 3_000);
  return { intentId: it.intentId as string, fundTx, status: final.status as string, fillTxid: final.fillTxid as string, fillMethod: final.fillMethod as string, latencySec: Math.round((Date.now() - t0) / 1000) };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  if (!FUNDER_WIF) throw new Error('no funder WIF (set FUNDER_WIF or ../cashtoken-relayer/.env)');
  const funder = new LocalWifSigner(FUNDER_WIF, 'chipnet', provider);
  const lpWif = newWif();
  const traderWif = newWif();
  const lp = new LocalWifSigner(lpWif, 'chipnet', provider);
  const trader = new LocalWifSigner(traderWif, 'chipnet', provider);
  // Throwaway chipnet keys, written only to the gitignored run folder so funds can be recovered
  // (RECOVER_DIR=<this folder>) if a run dies before its cleanup.
  fs.writeFileSync(path.join(OUT, 'keys.json'), JSON.stringify({ network: 'chipnet', note: 'throwaway test keys for fund recovery', lpWif, traderWif, lp: lp.address, trader: trader.address }, null, 2));
  console.log(`server ${MESH}\nfunder ${funder.address}\nLP     ${lp.address}\ntrader ${trader.address}\nout    ${OUT}\n`);

  // Pre-flight: the funder is the solver wallet on :3001 — never seed while intents are open.
  const open: any = await (await fetch(`${MESH}/intents`)).json();
  if ((open.active ?? []).length > 0) throw new Error(`${open.active.length} intents are open on the server; run when idle`);
  const ref = await api.marketRef(PUSD);
  if (!ref.cauldron) throw new Error('no Cauldron reference price for pUSD');
  const M = tokenPerBchFromSatsPerUnit(ref.cauldron.satsPerToken, DECIMALS);
  console.log(`market: 1 BCH ≈ ${M.toFixed(2)} pUSD (${ref.cauldron.satsPerToken} sats/unit)\n`);

  // WebSocket: collect pool events
  const wsEvents: any[] = [];
  const ws = new WebSocket(meshWsUrl(MESH));
  ws.onopen = () => ws.send(JSON.stringify({ action: 'subscribe', channel: 'pools' }));
  ws.onmessage = (m) => { try { const d = JSON.parse(String(m.data)); if (String(d.type).startsWith('pool:')) wsEvents.push(d); } catch { /* ignore */ } };

  try {
    // S1 seed
    const seedTx = await sendPoolTx(funder, await buildPayment(funder, [
      { to: lp.address, amount: 400_000n }, { to: lp.address, amount: 300_000n },
      { to: lp.tokenAddress, amount: TOKEN_DUST, token: { category: PUSD, amount: 500n } },
      { to: trader.address, amount: 300_000n },
      { to: trader.tokenAddress, amount: TOKEN_DUST, token: { category: PUSD, amount: 50n } },
    ]), 'seed');
    txs.seed = seedTx;
    check('S1', 'seed LP and trader from funder', true, undefined, seedTx);
    await waitFor('seed UTXOs', async () => (await lp.getUtxos()).length >= 3 && (await trader.getUtxos()).length >= 2, 60_000, 2_000);

    // P1 preview parity
    const pA = sideParams('SELL_BCH', PUSD, lp.pkh, priceFromTokenPerBch(M.toFixed(4), DECIMALS, 'SELL_BCH'), 30);
    const pB = sideParams('SELL_TOKEN', PUSD, lp.pkh, priceFromTokenPerBch((M * 0.98).toFixed(4), DECIMALS, 'SELL_TOKEN'), 30);
    const prevA = await api.preview(pA);
    const cA = buildPoolContract(pA, provider);
    const cB = buildPoolContract(pB, provider);
    check('P1', 'server preview = client contract (address, args, bytecode hash)',
      prevA.address === cA.address && prevA.artifactHash === artifactHash() && prevA.tokenAddress === cA.tokenAddress,
      `${prevA.address} · ${pA.priceNum}/${pA.priceDen}`);

    // C1 create both sides in one transaction
    rememberPool(OUT, pA);
    rememberPool(OUT, pB);
    const created = await buildCreatePools(lp, [
      { params: pA, sats: 300_000n, tokens: 0n },
      { params: pB, sats: 1_000n, tokens: 400n },
    ]);
    const createTx = await sendPoolTx(lp, created, 'create pools');
    txs.create = createTx;
    check('C1', 'create SELL_BCH + SELL_TOKEN pools in one tx', voutOf(created.outputs, cA.address) === 0 && voutOf(created.outputs, cB.address) === 1,
      `fee ${created.fee} sats, ${created.size} B`, createTx);

    // C2 register (bundle)
    const bundleId = `bundle-${createTx.slice(0, 8)}`;
    const reg = await registerWithRetry([
      { ...pA, txid: createTx, vout: 0, bundleId, pairRole: 'FORWARD', pairName: 'pUSD/BCH' },
      { ...pB, txid: createTx, vout: 1, bundleId, pairRole: 'REVERSE', pairName: 'pUSD/BCH' },
    ]);
    const A0 = reg.pools.find(p => p.address === cA.address);
    const B0 = reg.pools.find(p => p.address === cB.address);
    check('C2', 'register both pools (201, verified on-chain)', reg.success && !!A0 && !!B0 && A0.status === 'active' && B0.status === 'active',
      `A reserves ${A0?.reserves.sats} sats · B reserves ${B0?.reserves.tokens} units`);
    check('C3', 'reserves are read from chain', A0?.reserves.sats === '300000' && B0?.reserves.tokens === '400' && B0?.reserves.sats === '1000');
    const actA = await api.activity(cA.address);
    check('C4', 'ledger has the DEPOSIT event', actA.events.some(e => e.type === 'DEPOSIT' && e.txid === createTx && e.deltaSats === '300000'));
    const detA = await api.get(cA.address);
    check('C5', 'pool detail exposes constructor args that rebuild the same contract',
      contractFromArgs(detA.pool.constructorArgs, cA.address, provider).address === cA.address && detA.bundle.includes(cB.address));
    const pairs = await api.pairs();
    const pp = pairs.pairs.find(p => p.tokenCategory === PUSD);
    check('C6', 'pair summary shows both sides', pp?.bestBid?.address === cA.address && pp?.bestAsk?.address === cB.address,
      `bid ${pp?.bestBid?.satsPerToken} / ask ${pp?.bestAsk?.satsPerToken} sats per unit`);

    // F1 fill pool A (trader sells 10 pUSD units for BCH)
    const minA = (poolOutputFor(pA, 10n) * 90n) / 100n;
    const f1 = await runIntent(trader, { sellToken: PUSD, buyToken: 'BCH', sellAmount: '10', buyAmount: minA.toString() }, { tokens: 10n });
    txs.fillA = f1.fillTxid;
    check('F1', 'intent pUSD→BCH fills via Mesh pool A', f1.status === 'filled' && f1.fillMethod === 'MESH_POOL', `${f1.latencySec}s`, f1.fillTxid);
    const fa = await syncUntil(cA.address, f1.fillTxid);
    check('F2', 'pool A ledger: FILL with intent id, exact covenant amounts, LP fee > 0',
      fa.event.type === 'FILL' && fa.event.intentId === f1.intentId && fa.event.amountIn === '10'
        && BigInt(fa.event.amountOut!) <= poolOutputFor(pA, 10n) && BigInt(fa.event.lpEdge!) > 0n,
      `in ${fa.event.amountIn} units, out ${fa.event.amountOut} sats, LP edge ${fa.event.lpEdge} sats`);
    check('F3', 'pool A stats count the fill', fa.pool.stats.fillCount === 1 && BigInt(fa.pool.stats.volumeAllSats) > 0n && BigInt(fa.pool.stats.feesAllSats) > 0n,
      `volume ${fa.pool.stats.volumeAllSats} · fees ${fa.pool.stats.feesAllSats} sats`);
    const moved = await api.byOutpoint(createTx, 0);
    check('F4', 'old outpoint resolves to the pool address after the fill', moved.address === cA.address);

    // F5 fill pool B (trader sells 150,000 sats for pUSD)
    const minB = (poolOutputFor(pB, 150_000n) * 90n) / 100n;
    const f2 = await runIntent(trader, { sellToken: 'BCH', buyToken: PUSD, sellAmount: '150000', buyAmount: minB.toString() }, { sats: 150_000n });
    txs.fillB = f2.fillTxid;
    check('F5', 'intent BCH→pUSD fills via Mesh pool B', f2.status === 'filled' && f2.fillMethod === 'MESH_POOL', `${f2.latencySec}s`, f2.fillTxid);
    const fb = await syncUntil(cB.address, f2.fillTxid);
    check('F6', 'pool B ledger: FILL of the token-giving side', fb.event.type === 'FILL' && fb.event.amountIn === '150000' && BigInt(fb.event.amountOut!) <= poolOutputFor(pB, 150_000n),
      `in ${fb.event.amountIn} sats, out ${fb.event.amountOut} units`);
    const lpDetail = await api.lp(lp.pkh);
    check('F7', 'LP aggregates include both fills', lpDetail.lp.fillCount === 2 && lpDetail.pools.length === 2 && BigInt(lpDetail.lp.feesAllSats) > 0n,
      `fees ${lpDetail.lp.feesAllSats} sats, P&L ${lpDetail.lp.pnlSats} sats`);
    const stats = await api.stats();
    check('F8', '/stats reports pools and fill latency', stats.activePools >= 2 && stats.poolFillsTotal >= 2 && stats.avgFillLatencySec !== null,
      `active ${stats.activePools}, tvl ${stats.tvlSats}, avg latency ${stats.avgFillLatencySec}s`);
    const poolWs = wsEvents.filter(e => e.type === 'pool:updated' && e.event?.type === 'FILL');
    check('F9', 'WebSocket pushed pool:updated for the fills', poolWs.some(e => e.address === cA.address) && poolWs.some(e => e.address === cB.address),
      `${wsEvents.length} pool events`);

    // T1 top-up pool A
    const top = await buildFundPools(lp, [{ contract: cA, side: 'SELL_BCH', token: PUSD, sats: 50_000n, tokens: 0n }]);
    const topTx = await sendPoolTx(lp, top, 'top up');
    txs.topUp = topTx;
    const t1 = await syncUntil(cA.address, topTx);
    check('T1', 'top-up adds a DEPOSIT and a second UTXO', t1.event.type === 'DEPOSIT' && t1.event.deltaSats === '50000' && t1.pool.utxos.length === 2,
      `reserves ${t1.pool.reserves.sats} sats in ${t1.pool.utxos.length} UTXOs`, topTx);

    // R1 reprice pool A (both UTXOs consolidated into the new pool)
    const pC = sideParams('SELL_BCH', PUSD, lp.pkh, priceFromTokenPerBch((M * 1.01).toFixed(4), DECIMALS, 'SELL_BCH'), 30);
    rememberPool(OUT, pC);
    const aUtxos = await provider.getUtxos(cA.address);
    const rep = await buildReprice(lp, { contract: cA, params: pA }, aUtxos, pC);
    const repTx = await sendPoolTx(lp, rep, 'reprice');
    txs.reprice = repTx;
    const cC = rep.contract;
    const regC = await registerWithRetry([{ ...pC, txid: repTx, vout: rep.vout, pairName: 'pUSD/BCH' }]);
    const r1 = await syncUntil(cA.address, repTx);
    const detC = await api.get(cC.address);
    check('R1', 'reprice: old pool closed with successor, new pool active with predecessor',
      regC.success && r1.pool.status === 'closed' && r1.event.type === 'REPRICE' && r1.pool.successor === cC.address && detC.pool.predecessor === cA.address,
      `new reserves ${detC.pool.reserves.sats} sats`, repTx);

    // W1 partial withdraw 50% of the new pool
    const cUtxos = await provider.getUtxos(cC.address);
    const before = cUtxos.reduce((a, u) => a + u.satoshis, 0n);
    const w1 = await buildWithdraw(lp, { contract: cC, params: pC }, cUtxos, 50);
    const w1Tx = await sendPoolTx(lp, w1, 'withdraw 50%');
    txs.withdrawPartial = w1Tx;
    const s1 = await syncUntil(cC.address, w1Tx);
    check('W1', 'partial withdraw leaves one consolidated remainder', s1.event.type === 'WITHDRAW' && s1.pool.utxos.length === 1 && s1.pool.status === 'active'
      && BigInt(s1.pool.reserves.sats) === before - before / 2n,
      `${before} → ${s1.pool.reserves.sats} sats`, w1Tx);

    // W2 full withdraw of the new pool and pool B
    for (const [label, contract, params] of [['C', cC, pC], ['B', cB, pB]] as const) {
      const utxos = await provider.getUtxos(contract.address);
      const w = await buildWithdraw(lp, { contract, params: params as PoolParams }, utxos, 100);
      const tx = await sendPoolTx(lp, w, `withdraw ${label}`);
      txs[`withdraw${label}`] = tx;
      const s = await syncUntil(contract.address, tx);
      check(`W2${label}`, `full withdraw closes pool ${label}`, s.event.type === 'WITHDRAW' && s.pool.status === 'closed', undefined, tx);
    }
    const lpTokens = (await lp.getUtxos()).filter(u => u.token?.category === PUSD).reduce((a, u) => a + u.token!.amount, 0n);
    check('W3', 'LP received the pools\' tokens back at its token address', lpTokens > 0n, `${lpTokens} pUSD units in LP wallet`);

    // N negative / API checks
    const status = async (p: Promise<unknown>) => { try { await p; return 200; } catch (e) { return e instanceof MeshApiError ? e.status : -1; } };
    check('N1', 'register a fake outpoint → 404', await status(api.register([{ ...pA, txid: 'ab'.repeat(32), vout: 0 }])) === 404);
    check('N2', 'register with inflated params → 404', await status(api.register([{ ...pA, priceNum: pA.priceNum + 1, txid: createTx, vout: 0 }])) === 404);
    check('N3', 'register a V1 contract type → 400', await status(api.register([{ ...pA, txid: createTx, vout: 0, contractType: 'StrategyCovenant' } as any])) === 400);
    check('N4', 'unknown pool → 404', await status(api.get('bchtest:pzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz')) === 404);
    let limited = 0;
    await Promise.all(Array.from({ length: 130 }, async () => { if (await status(api.preview(pA)) === 429) limited++; }));
    check('N5', 'preview burst is rate limited (429)', limited > 0, `${limited}/130 limited`);
  } finally {
    // Recover anything still in this run's pools (from chain), then sweep LP and trader back to the funder.
    await recoverPools(lp, createdPools);
    for (const [name, s] of [['lp', lp], ['trader', trader]] as const) {
      try { const tx = await sweep(s, funder); if (tx) { txs[`sweep_${name}`] = tx; console.log(`swept ${name}: ${EXPLORER}${tx}`); } }
      catch (e) { console.warn(`sweep ${name}: ${(e as Error).message}`); }
    }
    ws.close();
    save({ wsEventCount: wsEvents.length, wsEventTypes: [...new Set(wsEvents.map(e => e.type))] });
  }
}

/** RECOVER_DIR mode: return everything from an interrupted run to the funder. */
async function recoverRun(dir: string) {
  const keys = JSON.parse(fs.readFileSync(path.join(dir, 'keys.json'), 'utf8'));
  if (!keys.lpWif) throw new Error(`${dir}/keys.json has no WIFs (run predates key persistence)`);
  const pools: PoolParams[] = fs.existsSync(path.join(dir, 'pools.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'pools.json'), 'utf8')) : [];
  const funder = new LocalWifSigner(FUNDER_WIF, 'chipnet', provider);
  const lp = new LocalWifSigner(keys.lpWif, 'chipnet', provider);
  const trader = new LocalWifSigner(keys.traderWif, 'chipnet', provider);
  await recoverPools(lp, pools);
  await sleep(3000);
  for (const [name, s] of [['lp', lp], ['trader', trader]] as const) {
    const tx = await sweep(s, funder);
    console.log(`${name}: ${tx ? EXPLORER + tx : 'nothing to sweep'}`);
  }
}

if (process.env.RECOVER_DIR) {
  recoverRun(path.resolve(process.env.RECOVER_DIR)).then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
} else main()
  .then(() => {
    const failed = checks.filter(c => !c.ok);
    console.log(`\n${checks.length - failed.length}/${checks.length} checks passed · report ${path.join(OUT, 'results.json')}`);
    process.exit(failed.length ? 1 : 0);
  })
  .catch((e) => {
    console.error(`\nFATAL: ${e?.stack ?? e}`);
    check('X', 'run aborted', false, String(e?.message ?? e));
    save();
    process.exit(2);
  });
