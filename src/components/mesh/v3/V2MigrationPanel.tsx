/**
 * V2 pools in the V3 app: withdraw, or migrate to V3 in one transaction.
 *
 *   Migrate            dock the V2 pool; its reserve funds a V3 pool at the same
 *                      price and fee (proceeds to your wallet from then on);
 *                      what it had collected goes to your wallet
 *   Migrate + recycle  the V3 pool recycles (mirror mode) at your sell-back
 *                      price, and what the V2 pool had collected seeds that
 *                      mirror pool right away
 *
 * The full V2 interface (top-up, reprice) stays in the V2 app (alpha branch).
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { ArrowRightCircle, Loader2, MinusCircle, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { meshApi, useInvalidateMesh, useMeshSigner } from '@/hooks/useMesh';
import type { Pool, RegisterItemV3 } from '@/lib/mesh/meshApi';
import { contractFromArgs, type PoolParams } from '@/lib/mesh/pool';
import { buildWithdraw, sendPoolTx, voutOf, type BuiltTx } from '@/lib/mesh/poolTx';
import { buildV3Contract, mirrorOf, slotPriceFromTokenPerBch, v3ToJson, type V3Params } from '@/lib/mesh/v3/v3Pool';
import { buildMigrateV2 } from '@/lib/mesh/v3/v3Tx';
import { addPending, registerWithRetry, removePending } from '@/lib/mesh/pendingRegistrations';
import { formatSatsCompact, formatUnits, shortHex } from '@/lib/mesh/format';
import { Panel, PoolPairLabel, poolUrl, useTokenInfo } from '@/components/mesh/pools/shared';
import { Link } from 'react-router-dom';

const ZERO32 = '00'.repeat(32);

/** The V3 pool a V2 pool becomes: same reserve side, price and fee. */
export function v3FromV2(p: Pool, reverse?: { num: bigint; den: bigint }): V3Params {
  const sellBch = p.side === 'SELL_BCH';
  return {
    ownerPkh: p.ownerPkh,
    reserve: sellBch ? '0x' : p.tokenCategory,
    feeBps: p.feeBps,
    mode: reverse ? 2 : 0,
    proceedsHash: ZERO32,
    slots: [{ cat: sellBch ? p.tokenCategory : '0x', num: BigInt(p.priceNum), den: BigInt(p.priceDen), rNum: reverse?.num ?? 0n, rDen: reverse?.den ?? 0n }],
  };
}

export function V2MigrationPanel({ pools }: { pools: Pool[] }) {
  const v2 = pools.filter(p => p.contractName === 'StrategyCovenantV2' && p.status !== 'closed');
  if (v2.length === 0) return null;
  return (
    <Panel title="Your V2 pools" action={<span className="text-[11px] text-zinc-500">withdraw or move them to V3</span>}>
      <p className="text-[11px] text-zinc-500">V2 pools keep what they collect inside the pool. Migrating moves the reserve into a V3 pool at the same price; with recycling, what was collected starts selling back straight away.</p>
      <div className="space-y-3">{v2.map(p => <V2Row key={p.address} pool={p} />)}</div>
    </Panel>
  );
}

function V2Row({ pool }: { pool: Pool }) {
  const wallet = useMeshSigner();
  const invalidate = useInvalidateMesh();
  const { get } = useTokenInfo([pool.tokenCategory]);
  const token = get(pool.tokenCategory);
  const [open, setOpen] = useState<null | 'withdraw' | 'migrate'>(null);
  const [recycle, setRecycle] = useState(false);
  const [back, setBack] = useState('');
  const [pending, setPending] = useState<{ label: string; built: BuiltTx; after: (txid: string, built: BuiltTx) => Promise<void> } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sellBch = pool.side === 'SELL_BCH';
  const collected = sellBch ? BigInt(pool.reserves.tokens) : BigInt(pool.reserves.sats) - 1000n;
  const isOwner = wallet.pkh === pool.ownerPkh;

  async function prepare(label: string, build: () => Promise<BuiltTx>, after: (txid: string, built: BuiltTx) => Promise<void>) {
    setError(null); setBusy('Building transaction…');
    try { setPending({ label, built: await build(), after }); } catch (e: any) { setError(e?.message ?? String(e)); } finally { setBusy(null); }
  }
  async function confirm() {
    if (!pending || !wallet.signer) return;
    setBusy(wallet.kind === 'external' ? 'Approve in your wallet…' : 'Signing and broadcasting…');
    try {
      const txid = await sendPoolTx(wallet.signer, pending.built, pending.label);
      setBusy('Updating the Mesh server…');
      await pending.after(txid, pending.built);
      toast.success(pending.label, { description: `tx ${shortHex(txid)}` });
      setPending(null); setOpen(null); invalidate();
    } catch (e: any) { setError(e?.message ?? String(e)); } finally { setBusy(null); }
  }

  const v2Contract = () => contractFromArgs(pool.constructorArgs, pool.address, wallet.signer!.provider);
  const utxos = async () => {
    const u = await wallet.signer!.provider.getUtxos(pool.address);
    if (!u.length) throw new Error('The pool has no funds on-chain right now');
    return u;
  };

  const withdraw = () => prepare('Withdraw V2 pool', async () =>
    buildWithdraw(wallet.signer!, { contract: v2Contract(), params: pool as unknown as PoolParams }, await utxos(), 100),
  async () => { await new Promise(r => setTimeout(r, 2_000)); await meshApi.sync(pool.address).catch(() => undefined); });

  const migrate = () => prepare(recycle ? 'Migrate to V3 and recycle' : 'Migrate to V3', async () => {
    const reverse = recycle ? slotPriceFromTokenPerBch(back, token.decimals, !sellBch) : undefined;
    const reserveTo = v3FromV2(pool, reverse);
    const collectedTo = recycle ? mirrorOf(reserveTo) : undefined;
    return buildMigrateV2(wallet.signer!, { contract: v2Contract(), params: pool as unknown as PoolParams, utxos: await utxos() }, reserveTo, collectedTo);
  }, async (txid, built) => {
    const reverse = recycle ? slotPriceFromTokenPerBch(back, token.decimals, !sellBch) : undefined;
    const reserveTo = v3FromV2(pool, reverse);
    const provider = wallet.signer!.provider;
    const items: RegisterItemV3[] = [];
    const outputs = built.outputs;
    for (const p of recycle ? [reserveTo, mirrorOf(reserveTo)] : [reserveTo]) {
      const vout = voutOf(outputs, buildV3Contract(p, provider).address);
      if (vout >= 0) items.push({ v3: v3ToJson(p), txid, vout, pairName: `migrated from ${shortHex(pool.address, 6, 4)}` });
    }
    addPending({ txid, v3Items: items, createdAt: Date.now() });
    const r = await registerWithRetry(() => meshApi.registerV3(items));
    if (!r.success) throw new Error(r.error ?? 'registration failed');
    removePending(txid);
    await meshApi.sync(pool.address).catch(() => undefined);
  });

  return (
    <div className="p-3 rounded-2xl bg-black/30 border border-white/[0.06] space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to={poolUrl(pool.address)} className="min-w-0"><PoolPairLabel token={token} side={pool.side} size={22} /></Link>
        <div className="text-xs font-mono text-zinc-300 text-right">
          <div>{sellBch ? formatSatsCompact(pool.reserves.sats) : `${formatUnits(pool.reserves.tokens, token.decimals)} ${token.symbol}`}</div>
          {collected > 0n && <div className="text-[10px] text-zinc-500">+ {sellBch ? `${formatUnits(collected, token.decimals)} ${token.symbol}` : formatSatsCompact(collected)} collected</div>}
        </div>
        {isOwner && wallet.signer && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs" onClick={() => setOpen(open === 'withdraw' ? null : 'withdraw')}><MinusCircle className="w-3.5 h-3.5 mr-1" />Withdraw</Button>
            <Button size="sm" className="h-8 rounded-lg text-xs" onClick={() => setOpen(open === 'migrate' ? null : 'migrate')}><ArrowRightCircle className="w-3.5 h-3.5 mr-1" />Migrate to V3</Button>
          </div>
        )}
      </div>

      {open === 'withdraw' && (
        <div className="space-y-2 text-xs">
          <p className="text-zinc-400">Returns the whole pool (reserve and everything it collected) to your wallet.</p>
          <Button size="sm" variant="destructive" className="rounded-lg" disabled={!!busy} onClick={withdraw}>{busy && !pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Review withdraw'}</Button>
        </div>
      )}
      {open === 'migrate' && (
        <div className="space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-2">
            {[[false, 'Same terms', 'V3 pool at the same price and fee; proceeds to your wallet'], [true, 'Same terms + recycle', 'What it collected sells back at your price']].map(([v, t, d]) => (
              <button key={String(v)} type="button" onClick={() => setRecycle(v as boolean)}
                className={cn('p-2.5 rounded-xl border text-left', recycle === v ? 'border-emerald-500/50 bg-emerald-500/[0.06]' : 'border-white/[0.08]')}>
                <div className="font-bold text-white flex items-center gap-1">{v ? <Repeat className="w-3.5 h-3.5 text-amber-300" /> : null}{t as string}</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">{d as string}</div>
              </button>
            ))}
          </div>
          {recycle && (
            <div className="flex items-center gap-2">
              <span className="text-zinc-400 shrink-0">{sellBch ? 'Sell back at' : 'Buy back at'} 1 BCH =</span>
              <Input value={back} onChange={e => setBack(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" className="font-mono bg-black/40 border-white/10 h-8" />
              <span className="text-zinc-300 shrink-0">{token.symbol}</span>
            </div>
          )}
          <Button size="sm" className="rounded-lg" disabled={!!busy || (recycle && !back)} onClick={migrate}>{busy && !pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Review migration'}</Button>
        </div>
      )}
      {pending && (
        <div className="p-3 rounded-xl border border-white/15 bg-white/[0.03] space-y-2 text-xs">
          <div className="flex justify-between"><span className="font-semibold text-white">{pending.label}</span><span className="font-mono text-zinc-400">fee {pending.built.fee.toString()} sats</span></div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1 rounded-lg" disabled={!!busy} onClick={() => setPending(null)}>Cancel</Button>
            <Button size="sm" className="flex-1 rounded-lg" disabled={!!busy} onClick={confirm}>{busy ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />{busy}</> : 'Sign and send'}</Button>
          </div>
        </div>
      )}
      {error && <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-200">{error}</div>}
    </div>
  );
}
