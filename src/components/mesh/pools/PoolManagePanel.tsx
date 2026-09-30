/**
 * Owner actions for one pool: top up, withdraw (partial / full), reprice.
 * Every action reads the pool's UTXOs from chain at the moment it builds the
 * transaction, rebuilds the covenant from the server's constructor args and
 * refuses to sign unless it reproduces the pool address.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, Lock, PlusCircle, MinusCircle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { meshApi, useInvalidateMesh, useMarketRef, useMeshSigner, useSignerBalances } from '@/hooks/useMesh';
import type { Pool } from '@/lib/mesh/meshApi';
import {
  contractFromArgs, priceFromTokenPerBch, sideParams, tokenPerBchFromParams, tokenPerBchFromSatsPerUnit, traderTokenPerBch,
} from '@/lib/mesh/pool';
import { buildFundPools, buildReprice, buildWithdraw, sendPoolTx, type BuiltTx } from '@/lib/mesh/poolTx';
import { formatNumber, formatSatsCompact, formatUnits, parseUnits, shortHex } from '@/lib/mesh/format';
import { Panel, poolUrl, tokenAmount, type TokenInfo } from './shared';

type Tab = 'topup' | 'withdraw' | 'reprice';

export function PoolManagePanel({ pool, token }: { pool: Pool; token: TokenInfo }) {
  const wallet = useMeshSigner();
  const navigate = useNavigate();
  const invalidate = useInvalidateMesh();
  const balances = useSignerBalances(wallet.signer);
  const market = useMarketRef(pool.tokenCategory);
  const [tab, setTab] = useState<Tab>(pool.status === 'active' ? 'topup' : 'withdraw');
  const [amount, setAmount] = useState('');
  const [percent, setPercent] = useState(100);
  const [newPrice, setNewPrice] = useState(() => token.known ? tokenPerBchFromParams(pool, token.decimals).toFixed(Math.min(4, Math.max(2, token.decimals))) : '');
  const [newFee, setNewFee] = useState(pool.feeBps);
  const [pending, setPending] = useState<{ label: string; built: BuiltTx; run: (txid: string) => Promise<void> } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Token metadata can arrive after the first render; start the reprice input from the current price.
  useEffect(() => {
    if (!newPrice && token.known) setNewPrice(tokenPerBchFromParams(pool, token.decimals).toFixed(Math.min(4, Math.max(2, token.decimals))));
  }, [token.known, token.decimals]); // eslint-disable-line react-hooks/exhaustive-deps

  const isOwner = !!wallet.pkh && wallet.pkh === pool.ownerPkh;
  const sellBch = pool.side === 'SELL_BCH';
  const totals = useMemo(() => pool.utxos.reduce((a, u) => ({ sats: a.sats + BigInt(u.sats), tokens: a.tokens + BigInt(u.tokens) }), { sats: 0n, tokens: 0n }), [pool.utxos]);

  if (!wallet.signer || !isOwner) {
    return (
      <Panel title="Manage">
        <div className="flex gap-3 text-xs text-zinc-400 leading-relaxed">
          <Lock className="w-4 h-4 shrink-0 text-zinc-500 mt-0.5" />
          <div>
            {!wallet.signer
              ? <>Connect the wallet that created this pool to top it up, withdraw or change its price. {wallet.unavailable && <span className="text-zinc-500">({wallet.unavailable})</span>}</>
              : <>Only the LP who created this pool can manage it. Its funds can only be moved with that key (<span className="font-mono">{shortHex(pool.ownerAddress, 8, 6)}</span>).</>}
          </div>
        </div>
      </Panel>
    );
  }
  const signer = wallet.signer;

  async function prepare(label: string, build: () => Promise<BuiltTx>, run: (txid: string) => Promise<void>) {
    setError(null);
    setBusy('Building transaction…');
    try {
      const built = await build();
      setPending({ label, built, run });
    } catch (e: any) { setError(e?.message ?? String(e)); } finally { setBusy(null); }
  }

  async function confirm() {
    if (!pending) return;
    setBusy(wallet.kind === 'external' ? 'Approve in your wallet…' : 'Signing and broadcasting…');
    setError(null);
    try {
      const txid = await sendPoolTx(signer, pending.built, pending.label);
      setBusy('Waiting for the server to index it…');
      await pending.run(txid);
      toast.success(pending.label, { description: `tx ${shortHex(txid)}` });
      setPending(null);
      setAmount('');
      invalidate();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally { setBusy(null); }
  }

  /** Ask the server to re-read the pool until it has seen `txid` (it may lag the broadcast by a few seconds). */
  async function syncUntilSeen(address: string, txid: string) {
    for (let i = 0; i < 10; i++) {
      await meshApi.sync(address).catch(() => undefined);
      const act = await meshApi.activity(address, { limit: 20 }).catch(() => null);
      if (act?.events.some(e => e.txid === txid)) return;
      await new Promise(r => setTimeout(r, 3_000));
    }
  }

  const contract = () => contractFromArgs(pool.constructorArgs, pool.address, signer.provider);
  const chainUtxos = async () => {
    const u = await signer.provider.getUtxos(pool.address);
    if (u.length === 0) throw new Error('The pool has no funds on-chain right now');
    return u;
  };

  // ── Top up ───────────────────────────────────────────────────────────────
  const topUp = () => prepare('Top up pool', async () => {
    const units = parseUnits(amount || '0', sellBch ? 8 : token.decimals);
    return buildFundPools(signer, [{
      contract: contract(), side: pool.side, token: pool.tokenCategory,
      sats: sellBch ? units : 1_000n, tokens: sellBch ? 0n : units,
    }]);
  }, (txid) => syncUntilSeen(pool.address, txid));

  // ── Withdraw ─────────────────────────────────────────────────────────────
  const withdraw = () => prepare(percent === 100 ? 'Withdraw all' : `Withdraw ${percent}%`,
    async () => buildWithdraw(signer, { contract: contract(), params: pool }, await chainUtxos(), percent),
    (txid) => syncUntilSeen(pool.address, txid));

  // ── Reprice ──────────────────────────────────────────────────────────────
  const reprice = () => prepare('Reprice pool', async () => {
    const next = sideParams(pool.side, pool.tokenCategory, pool.ownerPkh, priceFromTokenPerBch(newPrice, token.decimals, pool.side), newFee);
    return buildReprice(signer, { contract: contract(), params: pool }, await chainUtxos(), next);
  }, async (txid) => {
    const next = sideParams(pool.side, pool.tokenCategory, pool.ownerPkh, priceFromTokenPerBch(newPrice, token.decimals, pool.side), newFee);
    let reg: Awaited<ReturnType<typeof meshApi.register>> | null = null;
    for (let i = 0; i < 8 && !reg; i++) {
      try { reg = await meshApi.register([{ ...next, txid, vout: 0, pairName: pool.pairName, bundleId: pool.bundleId, pairRole: pool.pairRole }]); }
      catch { await new Promise(r => setTimeout(r, 3_000)); }
    }
    await syncUntilSeen(pool.address, txid);
    if (reg?.pools[0]) navigate(poolUrl(reg.pools[0].address));
    else throw new Error(`Repriced on-chain (tx ${shortHex(txid)}) but the new pool is not registered yet — open it from your positions to retry`);
  });

  const marketPrice = market.data?.cauldron && token.known ? tokenPerBchFromSatsPerUnit(market.data.cauldron.satsPerToken, token.decimals) : null;
  const previewTrader = (() => {
    try { return traderTokenPerBch(sideParams(pool.side, pool.tokenCategory, pool.ownerPkh, priceFromTokenPerBch(newPrice, token.decimals, pool.side), newFee), token.decimals); }
    catch { return null; }
  })();
  const bps = BigInt(percent * 100);
  const outSats = percent === 100 ? totals.sats : (totals.sats * bps) / 10_000n;
  const outTokens = percent === 100 ? totals.tokens : (totals.tokens * bps) / 10_000n;
  const walletAsset = sellBch ? balances.data?.sats : balances.data?.tokens[pool.tokenCategory];

  return (
    <Panel title="Manage your pool">
      <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-black/40 border border-white/[0.06]">
        {([['topup', 'Top up', PlusCircle], ['withdraw', 'Withdraw', MinusCircle], ['reprice', 'Reprice', RefreshCcw]] as const).map(([k, l, Icon]) => (
          <button key={k} type="button" onClick={() => { setTab(k); setError(null); }} disabled={k !== 'withdraw' && pool.status === 'closed'}
            className={cn('flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-30',
              tab === k ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300')}>
            <Icon className="w-3.5 h-3.5" />{l}
          </button>
        ))}
      </div>

      {tab === 'topup' && (
        <div className="space-y-3">
          <p className="text-[11px] text-zinc-500">Adds {sellBch ? 'BCH' : token.symbol} to the pool's reserve (a second UTXO at the same covenant; withdraw merges them).</p>
          <div className="flex justify-between text-xs text-zinc-400">
            <span>Amount</span>
            <span className="font-mono">Wallet: {walletAsset === undefined ? '—' : sellBch ? formatSatsCompact(walletAsset) : tokenAmount(walletAsset, token)}</span>
          </div>
          <div className="flex gap-2 items-center">
            <Input value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0.0" className="font-mono bg-black/40 border-white/10" />
            <span className="text-sm text-zinc-300">{sellBch ? 'BCH' : token.symbol}</span>
          </div>
          <Button className="w-full rounded-xl" disabled={!amount || !!busy} onClick={topUp}>{busy && !pending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Review top-up'}</Button>
        </div>
      )}

      {tab === 'withdraw' && (
        <div className="space-y-3">
          <div className="flex justify-between text-xs text-zinc-400"><span>Share to withdraw</span><span className="font-mono text-white">{percent}%</span></div>
          <Slider value={[percent]} min={1} max={100} step={1} onValueChange={v => setPercent(v[0] ?? 100)} />
          <div className="flex gap-2">
            {[25, 50, 75, 100].map(p => (
              <button key={p} type="button" onClick={() => setPercent(p)} className={cn('flex-1 py-1 rounded-lg text-[11px] font-mono border', percent === p ? 'border-white/30 text-white' : 'border-white/10 text-zinc-500')}>{p}%</button>
            ))}
          </div>
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs space-y-1">
            <div className="flex justify-between text-zinc-400"><span>You receive (before network fee)</span></div>
            <div className="flex justify-between font-mono text-zinc-200"><span>BCH</span><span>{formatSatsCompact(outSats)}</span></div>
            {outTokens > 0n && <div className="flex justify-between font-mono text-zinc-200"><span>{token.symbol}</span><span>{tokenAmount(outTokens, token)}</span></div>}
            {percent < 100 && <div className="text-[11px] text-zinc-500 pt-1">The rest stays in the pool as one UTXO and keeps trading.</div>}
          </div>
          <Button className="w-full rounded-xl" variant={percent === 100 ? 'destructive' : 'default'} disabled={!!busy || pool.utxos.length === 0} onClick={withdraw}>
            {busy && !pending ? <Loader2 className="w-4 h-4 animate-spin" /> : percent === 100 ? 'Review full withdraw' : `Review ${percent}% withdraw`}
          </Button>
        </div>
      )}

      {tab === 'reprice' && (
        <div className="space-y-3">
          <p className="text-[11px] text-zinc-500">
            Moves the reserve to a new pool with the new terms in one transaction ({sellBch ? `received ${token.symbol}` : 'received BCH'} goes to your wallet). The new pool links back to this one.
          </p>
          <label className="text-xs text-zinc-400">New price: 1 BCH =</label>
          <div className="flex gap-2 items-center">
            <Input value={newPrice} onChange={e => setNewPrice(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" className="font-mono bg-black/40 border-white/10" />
            <span className="text-sm text-zinc-300">{token.symbol}</span>
          </div>
          {marketPrice && <div className="text-[11px] text-zinc-500">Cauldron: 1 BCH ≈ <span className="font-mono">{formatNumber(marketPrice, 4)}</span> {token.symbol}
            <button type="button" className="ml-2 underline" onClick={() => setNewPrice(marketPrice.toFixed(Math.min(4, Math.max(2, token.decimals))))}>use</button></div>}
          <div className="flex gap-2">
            {[5, 30, 50, 100].map(f => (
              <button key={f} type="button" onClick={() => setNewFee(f)} className={cn('flex-1 py-1 rounded-lg text-[11px] font-mono border', newFee === f ? 'border-white/30 text-white' : 'border-white/10 text-zinc-500')}>{(f / 100).toFixed(2)}%</button>
            ))}
          </div>
          {previewTrader !== null && <div className="text-[11px] text-zinc-400">Trader {sellBch ? 'pays' : 'gets'} <span className="font-mono text-zinc-200">{formatNumber(previewTrader, 4)}</span> {token.symbol} per BCH after fee</div>}
          <Button className="w-full rounded-xl" disabled={!!busy || !newPrice || pool.utxos.length === 0} onClick={reprice}>{busy && !pending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Review reprice'}</Button>
        </div>
      )}

      {pending && (
        <div className="p-3 rounded-xl border border-white/15 bg-white/[0.03] space-y-2 text-xs">
          <div className="flex justify-between"><span className="font-semibold text-white">{pending.label}</span><span className="font-mono text-zinc-400">fee {pending.built.fee.toString()} sats</span></div>
          <div className="text-zinc-500">{pending.built.inputs} input(s) → {pending.built.outputs.length} output(s)</div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1 rounded-lg" disabled={!!busy} onClick={() => setPending(null)}>Cancel</Button>
            <Button size="sm" className="flex-1 rounded-lg" disabled={!!busy} onClick={confirm}>{busy ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />{busy}</> : 'Sign and send'}</Button>
          </div>
        </div>
      )}
      {error && <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-200">{error}</div>}
    </Panel>
  );
}

export function formatReserveLine(pool: Pool, token: TokenInfo): string {
  return pool.side === 'SELL_BCH'
    ? `${formatSatsCompact(pool.reserves.sats)}${BigInt(pool.reserves.tokens) > 0n ? ` + ${formatUnits(pool.reserves.tokens, token.decimals)} ${token.symbol}` : ''}`
    : `${formatUnits(pool.reserves.tokens, token.decimals)} ${token.symbol}`;
}
