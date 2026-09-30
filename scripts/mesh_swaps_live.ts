/**
 * Live chipnet test: do Mesh pools fill real orders?
 *
 * Pauses the Cauldron and solver-inventory routes (admin API) so only Mesh
 * pools can fill, submits 10 limit orders against the pools that are live on
 * the server, and checks every fill: route, which pool, covenant price, maker
 * payout ≥ minimum, and the pool ledger's FILL event. Routes are restored and
 * the trader wallet is swept back to the funder at the end, even on failure.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/mesh_swaps_live.ts
 *
 * Env: MESH_URL (default http://localhost:3001) · ADMIN_KEY (default ADMIN_API_KEY
 * from ../BCHMesh/meshserver/.env) · FUNDER_WIF (default RELAYER_PRIVATE_KEY_WIF
 * from ../cashtoken-relayer/.env — the :3001 solver wallet; runs only with no open intents)
 */
import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { ElectrumNetworkProvider, TransactionBuilder } from 'cashscript';
import { decodeTransaction, encodePrivateKeyWif, hexToBin, binToHex } from '@bitauth/libauth';
import { LocalWifSigner } from '../src/lib/mesh/signer';
import { buildPayment, sendPoolTx, lockingBytecodeOf, DEFAULT_FEE_RATE, type Out } from '../src/lib/mesh/poolTx';
import { TOKEN_DUST, poolOutputFor } from '../src/lib/mesh/pool';
import { createMeshApi, type Pool } from '../src/lib/mesh/meshApi';

const MESH = process.env.MESH_URL ?? 'http://localhost:3001';
const EXPLORER = 'https://chipnet.imaginary.cash/tx/';
const STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const OUT = path.resolve(process.env.OUT_DIR ?? `../BCHMesh/meshserver/data/mesh_swaps_run_${STAMP}`);
const TOKENS: Record<string, { symbol: string; cat: string }> = {
  pUSD: { symbol: 'pUSD', cat: 'dfe50223c8d5cba8dcef8dff6d92b61deb88a8ba44947367f2b746487b56039b' },
  TEST3: { symbol: 'TEST3', cat: '09227c14464e28a07de14a1d7f78b30c76a78e6fed0022c56182f3ff774376e0' },
  TT7: { symbol: 'TT7', cat: 'c5ad759778a34cbb5600e2f0f39a30514401ef1af4010bb5526a7e2ab4be6f6e' },
};

function envFile(file: string, key: string): string {
  const line = fs.readFileSync(file, 'utf8').split(/\r?\n/).find(l => l.startsWith(`${key}=`));
  return (line?.slice(key.length + 1) ?? '').trim().replace(/^["']|["']$/g, '');
}
const FUNDER_WIF = process.env.FUNDER_WIF ?? envFile(path.resolve('../cashtoken-relayer/.env'), 'RELAYER_PRIVATE_KEY_WIF');
const ADMIN_KEY = process.env.ADMIN_KEY ?? envFile(path.resolve('../BCHMesh/meshserver/.env'), 'ADMIN_API_KEY');

const provider = new ElectrumNetworkProvider('chipnet');
const api = createMeshApi(MESH);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const j = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x), 2);

async function http(method: string, p: string, body?: unknown, admin = false): Promise<any> {
  const res = await fetch(`${MESH}${p}`, {
    method, headers: { 'Content-Type': 'application/json', ...(admin ? { 'x-admin-key': ADMIN_KEY } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${p} → ${res.status}: ${data.error ?? JSON.stringify(data)}`);
  return data;
}

async function waitFor<T>(what: string, fn: () => Promise<T | undefined | null | false>, timeoutMs: number, everyMs = 3_000): Promise<T> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try { const v = await fn(); if (v) return v; } catch { /* retry */ }
    await sleep(everyMs);
  }
  throw new Error(`timed out waiting for ${what}`);
}

// ── Orders ───────────────────────────────────────────────────────────────────
interface Order {
  n: number; label: string; sell: 'BCH' | keyof typeof TOKENS; buy: 'BCH' | keyof typeof TOKENS; amount: bigint; round: 1 | 2;
  // filled in as the run goes
  intentId?: string; contract?: string; tokenAddress?: string; quote?: bigint; min?: bigint; expectedPool?: string;
  fundedAt?: number; status?: string; fillMethod?: string; fillTxid?: string; latencySec?: number;
  pool?: string; poolOwner?: string; makerPaid?: bigint; gross?: bigint; lpEdge?: bigint; checks?: string[]; ok?: boolean;
}
const ORDERS: Order[] = [
  { n: 1, label: 'sell 10 pUSD units → BCH', sell: 'pUSD', buy: 'BCH', amount: 10n, round: 1 },
  { n: 2, label: 'sell 25 pUSD units → BCH', sell: 'pUSD', buy: 'BCH', amount: 25n, round: 1 },
  { n: 3, label: 'sell 50 pUSD units → BCH', sell: 'pUSD', buy: 'BCH', amount: 50n, round: 1 },
  { n: 4, label: 'buy pUSD with 60,000 sats', sell: 'BCH', buy: 'pUSD', amount: 60_000n, round: 1 },
  { n: 5, label: 'buy pUSD with 120,000 sats', sell: 'BCH', buy: 'pUSD', amount: 120_000n, round: 1 },
  { n: 6, label: 'buy TEST3 with 50,000 sats', sell: 'BCH', buy: 'TEST3', amount: 50_000n, round: 1 },
  { n: 7, label: 'buy TT7 with 40,000 sats', sell: 'BCH', buy: 'TT7', amount: 40_000n, round: 1 },
  { n: 8, label: 'buy TT7 with 20,000 sats', sell: 'BCH', buy: 'TT7', amount: 20_000n, round: 1 },
  { n: 9, label: 'sell 300,000 TEST3 units → BCH', sell: 'TEST3', buy: 'BCH', amount: 300_000n, round: 2 },
  { n: 10, label: 'sell 150,000 TEST3 units → BCH', sell: 'TEST3', buy: 'BCH', amount: 150_000n, round: 2 },
];
const catOf = (a: Order['sell']) => (a === 'BCH' ? '0x' : TOKENS[a]!.cat);

/** Best live Mesh pool for an order — the same choice the server's matcher makes. */
function bestPool(pools: Pool[], o: Order): { pool: Pool; out: bigint } | null {
  let best: { pool: Pool; out: bigint } | null = null;
  for (const p of pools) {
    if (p.status !== 'active' || p.tokenCategoryIn !== catOf(o.sell) || p.tokenCategoryOut !== catOf(o.buy)) continue;
    const out = poolOutputFor(p, o.amount);
    if (out <= 0n || out > BigInt(p.availableOut)) continue;
    if (!best || out > best.out) best = { pool: p, out };
  }
  return best;
}

async function makerPayout(txid: string, buyIsBch: boolean): Promise<bigint> {
  const tx = decodeTransaction(hexToBin(await provider.getRawTransaction(txid)));
  if (typeof tx === 'string') throw new Error(tx);
  const o = tx.outputs[0]!;
  return buyIsBch ? o.valueSatoshis : o.token?.amount ?? 0n;
}

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
  const fee = BigInt(Math.ceil((make(total - dust - 1000n).build().length / 2) * DEFAULT_FEE_RATE));
  if (total - dust - fee < 546n) return null;
  return (await make(total - dust - fee).send()).txid;
}

// ── Run ──────────────────────────────────────────────────────────────────────
async function runRound(round: 1 | 2, trader: LocalWifSigner) {
  const orders = ORDERS.filter(o => o.round === round);
  const { pools } = await api.list({ status: 'active', limit: 500 });
  console.log(`\n── Round ${round}: ${orders.length} orders ──`);
  for (const o of orders) {
    const best = bestPool(pools, o);
    if (!best) throw new Error(`#${o.n}: no live Mesh pool can fill "${o.label}"`);
    o.quote = best.out;
    o.min = (best.out * 98n) / 100n || 1n;
    o.expectedPool = best.pool.address;
    const it = await http('POST', '/api/v1/intent/create', {
      makerAddress: trader.address, orderType: 'limit', duration: 3600,
      sellToken: o.sell === 'BCH' ? 'BCH' : catOf(o.sell), buyToken: o.buy === 'BCH' ? 'BCH' : catOf(o.buy),
      sellAmount: o.amount.toString(), buyAmount: o.min.toString(),
    });
    o.intentId = it.intentId; o.contract = it.contractAddress; o.tokenAddress = it.tokenAddress;
    console.log(`#${String(o.n).padStart(2)} ${o.label.padEnd(32)} quote ${o.quote} min ${o.min} via ${best.pool.address.slice(8, 20)} → ${o.intentId}`);
  }
  // Fund every order of the round in one transaction.
  const outs: Out[] = orders.map(o => o.sell === 'BCH'
    ? { to: lockingBytecodeOf(o.contract!), amount: o.amount }
    : { to: o.tokenAddress!, amount: TOKEN_DUST, token: { category: catOf(o.sell), amount: o.amount } });
  const fundTx = await sendPoolTx(trader, await buildPayment(trader, outs), `fund round ${round}`);
  const t0 = Date.now();
  orders.forEach(o => { o.fundedAt = t0; });
  console.log(`funded ${orders.length} orders in one tx: ${EXPLORER}${fundTx}`);

  await waitFor(`round ${round} orders to settle`, async () => {
    for (const o of orders) {
      if (o.status && ['filled', 'refunded', 'cancelled', 'closed_external'].includes(o.status)) continue;
      const v = await http('GET', `/api/v1/intent/${o.intentId}`);
      if (v.status !== o.status) {
        o.status = v.status;
        if (v.status === 'filled') {
          o.fillMethod = v.fillMethod; o.fillTxid = v.fillTxid; o.latencySec = Math.round((Date.now() - t0) / 1000);
          console.log(`   #${o.n} filled in ${o.latencySec}s via ${v.fillMethod} ${EXPLORER}${v.fillTxid}`);
        } else if (v.lastFillError) console.log(`   #${o.n} ${v.status} (${v.lastFillError})`);
      }
    }
    return orders.every(o => o.status === 'filled');
  }, 300_000, 4_000).catch(e => console.warn(`⚠ ${e.message}`));
  return fundTx;
}

async function verify(orders: Order[]) {
  // Pool ledger fill events (synced right after each local fill; give the indexer a moment).
  let fills: Awaited<ReturnType<typeof api.recentActivity>>['events'] = [];
  await waitFor('ledger FILL events', async () => {
    fills = (await api.recentActivity({ type: 'FILL', limit: 500 })).events;
    return orders.filter(o => o.fillTxid).every(o => fills.some(f => f.txid === o.fillTxid));
  }, 90_000, 5_000).catch(() => undefined);

  for (const o of orders) {
    const c: string[] = [];
    if (o.status !== 'filled') { o.ok = false; o.checks = [`not filled (status ${o.status})`]; continue; }
    const ev = fills.find(f => f.txid === o.fillTxid);
    o.pool = ev?.address;
    o.poolOwner = (ev as any)?.ownerPkh;
    o.gross = ev?.amountOut ? BigInt(ev.amountOut) : undefined;
    o.lpEdge = ev?.lpEdge ? BigInt(ev.lpEdge) : undefined;
    o.makerPaid = await makerPayout(o.fillTxid!, o.buy === 'BCH');
    const intentDust = o.sell !== 'BCH' && o.buy === 'BCH' ? TOKEN_DUST : 0n; // token→BCH: the intent's carrier sats go back to the maker
    const route = o.fillMethod === 'MESH_POOL';
    const ledger = !!ev && ev.intentId === o.intentId && BigInt(ev.amountIn ?? '0') === o.amount;
    const price = o.gross !== undefined && o.quote !== undefined && o.gross <= o.quote;
    const minOk = o.makerPaid - intentDust >= o.min!;
    const samePool = o.pool === o.expectedPool;
    if (!route) c.push(`route ${o.fillMethod}`);
    if (!ledger) c.push('no matching ledger FILL');
    if (!price) c.push(`pool paid ${o.gross} > covenant quote ${o.quote}`);
    if (!minOk) c.push(`maker got ${o.makerPaid - intentDust} < min ${o.min}`);
    if (!samePool) c.push(`filled by ${o.pool?.slice(8, 20)} (expected ${o.expectedPool?.slice(8, 20)})`);
    o.checks = c;
    o.ok = route && ledger && price && minOk; // a different (better) pool is informational, not a failure
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  if (!FUNDER_WIF) throw new Error('no funder WIF');
  if (!ADMIN_KEY) throw new Error('no ADMIN_API_KEY');
  const funder = new LocalWifSigner(FUNDER_WIF, 'chipnet', provider);
  const traderWif = encodePrivateKeyWif(new Uint8Array(randomBytes(32)), 'testnet');
  const trader = new LocalWifSigner(traderWif, 'chipnet', provider);
  // throwaway chipnet key in the gitignored run folder (RECOVER_DIR of mesh_pools_live.ts can sweep it)
  fs.writeFileSync(path.join(OUT, 'keys.json'), j({ network: 'chipnet', lpWif: traderWif, traderWif, trader: trader.address }));

  const open = await http('GET', '/intents');
  if ((open.active ?? []).length) throw new Error(`${open.active.length} intents open on the server; run when idle`);

  const before = await api.list({ status: 'active', limit: 500 });
  const routesBefore = (await http('GET', '/api/v1/admin/routes/status')).routes;
  console.log(`server ${MESH} · funder ${funder.address} · trader ${trader.address}`);
  console.log(`live pools: ${before.pools.length} · routes before: mesh=${routesBefore.meshEnabled} cauldron=${routesBefore.cauldronEnabled} solver=${routesBefore.solverEnabled}`);

  let restored = false;
  const restore = async () => {
    if (restored) return;
    await http('POST', '/api/v1/admin/routes/control', {
      meshEnabled: routesBefore.meshEnabled, cauldronEnabled: routesBefore.cauldronEnabled, solverEnabled: routesBefore.solverEnabled, reason: 'mesh-only swap test finished',
    }, true);
    restored = true;
    console.log('routes restored');
  };
  const txs: Record<string, string> = {};
  try {
    await http('POST', '/api/v1/admin/routes/control', { meshEnabled: true, cauldronEnabled: false, solverEnabled: false, reason: 'mesh-only swap test' }, true);
    const r = (await http('GET', '/api/v1/admin/routes/status')).routes;
    console.log(`routes now: mesh=${r.meshEnabled} cauldron=${r.cauldronEnabled} solver=${r.solverEnabled}`);
    if (r.cauldronEnabled || r.solverEnabled || !r.meshEnabled) throw new Error('could not isolate the Mesh route');

    // Seed the trader: BCH for 5 buys + carrier sats, and pUSD for 3 sells.
    txs.seed = await sendPoolTx(funder, await buildPayment(funder, [
      { to: trader.address, amount: 250_000n }, { to: trader.address, amount: 150_000n },
      { to: trader.tokenAddress, amount: TOKEN_DUST, token: { category: TOKENS.pUSD!.cat, amount: 100n } },
    ]), 'seed');
    console.log(`seeded trader: ${EXPLORER}${txs.seed}`);
    await waitFor('seed UTXOs', async () => (await trader.getUtxos()).length >= 3, 60_000, 2_000);

    txs.fundRound1 = await runRound(1, trader);
    // Round 2 sells the TEST3 bought in order #6.
    await waitFor('TEST3 in the trader wallet', async () =>
      (await trader.getUtxos()).some(u => u.token?.category === TOKENS.TEST3!.cat && u.token.amount >= 450_000n), 60_000, 3_000);
    txs.fundRound2 = await runRound(2, trader);

    await verify(ORDERS);
  } finally {
    await restore().catch(e => console.error(`⚠ ROUTES NOT RESTORED: ${e.message}`));
    await sleep(3_000);
    try { const t = await sweep(trader, funder); if (t) { txs.sweep = t; console.log(`swept trader back: ${EXPLORER}${t}`); } }
    catch (e) { console.warn(`sweep: ${(e as Error).message} (keys in ${OUT}/keys.json)`); }
  }

  // Pools that traded: before → after
  const after = await api.list({ status: 'all', limit: 500 });
  const traded = [...new Set(ORDERS.map(o => o.pool).filter(Boolean))] as string[];
  const poolRows = traded.map(a => {
    const b = before.pools.find(p => p.address === a); const x = after.pools.find(p => p.address === a);
    return { pool: a, side: x?.side, token: Object.values(TOKENS).find(t => t.cat === x?.tokenCategory)?.symbol,
      before: b?.reserves, after: x?.reserves, fills: x?.stats.fillCount, feesSats: x?.stats.feesAllSats, volumeSats: x?.stats.volumeAllSats };
  });

  console.log('\n#   order                             route      pool           min        maker got  pool paid  LP edge  latency  ok');
  for (const o of ORDERS) {
    const got = o.makerPaid !== undefined ? (o.makerPaid - (o.sell !== 'BCH' && o.buy === 'BCH' ? TOKEN_DUST : 0n)).toString() : '-';
    console.log(`${String(o.n).padStart(2)}  ${o.label.padEnd(32)}  ${(o.fillMethod ?? o.status ?? '-').padEnd(9)}  ${(o.pool ?? '-').slice(8, 20).padEnd(13)}  ${String(o.min ?? '-').padStart(9)}  ${got.padStart(9)}  ${String(o.gross ?? '-').padStart(9)}  ${String(o.lpEdge ?? '-').padStart(7)}  ${String(o.latencySec ?? '-').padStart(5)}s  ${o.ok ? '✅' : '❌'} ${o.checks?.join('; ') ?? ''}`);
  }
  console.log('\nPools that traded (reserves before → after):');
  for (const p of poolRows) console.log(`  ${p.pool.slice(8, 20)} ${p.side} ${p.token}: ${j(p.before)} → ${j(p.after)} · fills ${p.fills} · fees ${p.feesSats} sats · volume ${p.volumeSats} sats`);

  fs.writeFileSync(path.join(OUT, 'results.json'), j({ server: MESH, stamp: STAMP, txs, orders: ORDERS, pools: poolRows }));
  const passed = ORDERS.filter(o => o.ok).length;
  console.log(`\n${passed}/${ORDERS.length} orders filled by Mesh pools at covenant prices · report ${path.join(OUT, 'results.json')}`);
  process.exit(passed === ORDERS.length ? 0 : 1);
}

main().catch(e => { console.error(`FATAL: ${e?.stack ?? e}`); process.exit(2); });
