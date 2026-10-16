/**
 * Move a V3 range to a V4 position in one signature (v4plan 04 §2.6).
 *
 *   Pick: this strategy (a range). The server plans the V4 position with the
 *         same range, step and shape, funded from what the V3 pools hold.
 *   Compare: pools and UTXOs now vs bins after, cost per bin crossed, value
 *         before and after (equal less the network fee).
 *   Sign once: one transaction docks every V3 pool (owner signature), mints
 *         the NFT and funds the bins; tokens the position does not take and
 *         the BCH left over come back to the wallet.
 *
 * Checked in the browser before signing: the V4 plan (bins rebuilt, NFT to this
 * wallet, nothing paid elsewhere), and every docked UTXO belongs to a pool of
 * this strategy rebuilt locally from its parameters.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight, Gem, Loader2, ShieldCheck, TriangleAlert } from 'lucide-react';
import { binToHex } from '@bitauth/libauth';
import type { Utxo } from 'cashscript';
import { Button } from '@/components/ui/button';
import { meshApi, useInvalidateMesh, useMeshSigner } from '@/hooks/useMesh';
import type { Pool, StrategySummary } from '@/lib/mesh/meshApi';
import { formatNumber, formatSatsCompact, formatUnits, shortHex } from '@/lib/mesh/format';
import { sendPoolTx, type BuiltTx } from '@/lib/mesh/poolTx';
import { registerWithRetry } from '@/lib/mesh/pendingRegistrations';
import { v3ContractFor } from '@/lib/mesh/v3/v3Pool';
import { v4Levels } from '@/lib/mesh/v4/position';
import { verifyMigratePlan } from '@/lib/mesh/v4/verify';
import { buildMigrate, type MigrateClose } from '@/lib/mesh/v4/v4Tx';
import { ensureSeed } from '@/lib/mesh/v4/seed';
import { addPendingV4, positionUrl, removePendingV4 } from '@/lib/mesh/v4/display';
import type { V4MigratePlan } from '@/lib/mesh/v4/types';
import { useTokenInfo } from '@/components/mesh/pools/shared';

const V4_BYTES_PER_BIN = 430;
const V3_BYTES_PER_POOL = 1100;

export function MigrateToV4({ strategy, pools }: { strategy: StrategySummary; pools: Pool[] }) {
  const wallet = useMeshSigner();
  const navigate = useNavigate();
  const invalidate = useInvalidateMesh();
  const p = strategy.params as Record<string, any>;
  const token = String(p.token ?? '').toLowerCase();
  const { get } = useTokenInfo([token]);
  const info = get(token);
  const [prepared, setPrepared] = useState<{ m: V4MigratePlan; built: BuiltTx; seed: Utxo; utxosBefore: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function prepare() {
    const signer = wallet.signer;
    if (!signer) return;
    setError(null); setPrepared(null);
    try {
      const seed = await ensureSeed(signer, setBusy);
      setBusy('Planning the V4 position…');
      const m = await meshApi.v4MigratePlan({ strategyId: strategy.id, seedTxid: seed.txid, owner: signer.tokenAddress });
      const step = Number(p.binStepBps ?? 100);
      const lv = v4Levels(Number(p.lowSatsPerToken), Number(p.highSatsPerToken), Number(p.centerSatsPerToken), step);
      verifyMigratePlan(m, { category: seed.txid, tokenCat: token, ownerLock: binToHex(signer.lockingBytecode), binStepBps: step, lowIndex: lv.lowIndex, highIndex: lv.highIndex });
      // every UTXO to dock: a live UTXO of a pool of this strategy, contract rebuilt here
      const byAddr = new Map(pools.map(x => [x.address, x]));
      const close: MigrateClose[] = [];
      let utxosBefore = 0;
      for (const c of m.close) {
        const pool = byAddr.get(c.address);
        if (!pool?.v3) throw new Error(`the plan docks ${shortHex(c.address, 12, 6)}, which is not a pool of this strategy`);
        const contract = v3ContractFor(pool.v3, c.address, signer.provider).contract;
        const live = await signer.provider.getUtxos(c.address);
        const utxos = c.utxos.map(u => live.find(x => x.txid === u.txid && x.vout === u.vout));
        if (utxos.some(u => !u)) throw new Error('A trade just changed one of these pools. Prepare again.');
        close.push({ contract, utxos: utxos as Utxo[] });
        utxosBefore += utxos.length;
      }
      setBusy('Building the transaction…');
      const built = await buildMigrate(signer, m, seed, close);
      setPrepared({ m, built, seed, utxosBefore });
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally { setBusy(null); }
  }

  async function confirm() {
    const signer = wallet.signer;
    if (!prepared || !signer) return;
    const { m, built } = prepared;
    let txid: string | null = null;
    try {
      setBusy('Publishing the NFT metadata…');
      await meshApi.v4PinMetadata(m.v4.category).catch(() => undefined);
      setBusy(wallet.kind === 'external' ? 'Approve in your wallet…' : 'Signing and broadcasting…');
      txid = await sendPoolTx(signer, built, `Mesh: move this V3 range to a V4 position (${m.v4.bins.length} bins, one NFT)`, { raw: true });
      const pairName = `BCH/${info.symbol}`;
      addPendingV4({ category: m.v4.category, genesisTxid: txid, bins: m.v4.register.body.bins, pairName, createdAt: Date.now() });
      setBusy('Registering the V4 position…');
      await registerWithRetry(() => meshApi.v4Register({ genesisTxid: txid!, bins: m.v4.register.body.bins, pairName }));
      removePendingV4(m.v4.category);
      for (const pool of pools) await meshApi.sync(pool.address).catch(() => undefined);
      invalidate();
      toast.success('Moved to V4', { description: `${m.v4.bins.length} bins · NFT ${shortHex(m.v4.category)} · ${shortHex(txid)}` });
      navigate(positionUrl(m.v4.category));
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setError(msg);
      if (txid) { toast.error('Moved, registration pending', { description: msg }); navigate(positionUrl(m.v4.category)); }
    } finally { setBusy(null); }
  }

  if (strategy.template !== 'range') {
    return <p className="text-xs text-zinc-400">Only range strategies move to V4 for now. Grids and ladders come later.</p>;
  }
  const m = prepared?.m;
  // what the wallet gets back: every output after the V4 genesis outputs
  const back = m && prepared ? prepared.built.outputs.slice(m.v4.outputs.length) : [];
  const bchBack = back.reduce((x, o) => x + o.amount, 0n);
  const tokensBack = back.reduce((x, o) => x + (o.token?.category === token ? o.token.amount : 0n), 0n);

  return (
    <div className="space-y-3 text-xs">
      <p className="text-zinc-400">One signature docks every pool of this range and opens a V4 position with the same range, step and shape: in-place bins owned by an NFT in your wallet.</p>
      {!prepared ? (
        <Button className="w-full rounded-xl" disabled={!!busy || !wallet.signer} onClick={prepare}>
          {busy ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />{busy}</> : <><Gem className="w-4 h-4 mr-2" />Preview the V4 position</>}
        </Button>
      ) : m && (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">Now (V3)</div>
              <div className="font-mono text-white">{m.close.length} pools · {prepared.utxosBefore} UTXOs</div>
              <div className="font-mono text-[10px] text-zinc-500">~{formatNumber(V3_BYTES_PER_POOL, 0)} B per pool crossed</div>
            </div>
            <ArrowRight className="w-4 h-4 text-zinc-500" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-violet-300">After (V4)</div>
              <div className="font-mono text-white">{m.v4.bins.length} bins · 1 UTXO each</div>
              <div className="font-mono text-[10px] text-zinc-500">~{V4_BYTES_PER_BIN} B per bin crossed</div>
            </div>
          </div>
          <Line k="The pools hold" v={`${formatSatsCompact(m.available.sats)} + ${formatUnits(m.available.tokens, info.decimals)} ${info.symbol}`} />
          <Line k="Into the V4 position" v={`${formatSatsCompact(m.v4.totals.sats)} + ${formatUnits(m.v4.totals.tokens, info.decimals)} ${info.symbol}`} />
          <Line k="NFT + metadata key" v={formatSatsCompact(BigInt(m.v4.outputs[0]!.valueSatoshis) + BigInt(m.v4.outputs[1]!.valueSatoshis))} />
          <Line k="Back to your wallet" v={`${formatSatsCompact(bchBack)}${tokensBack > 0n ? ` + ${formatUnits(tokensBack, info.decimals)} ${info.symbol}` : ''}`} />
          <Line k="Network fee" v={`${prepared.built.fee.toString()} sats`} />
          {m.v4.warnings.length > 0 && <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-200">{m.v4.warnings.join(' · ')}</div>}
          <div className="flex items-center gap-2 text-[11px] text-emerald-400"><ShieldCheck className="w-4 h-4 shrink-0" />Checked in your browser: bins, NFT and every pool docked.</div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1 rounded-lg" disabled={!!busy} onClick={() => setPrepared(null)}>Cancel</Button>
            <Button size="sm" className="flex-1 rounded-lg" disabled={!!busy} onClick={confirm}>{busy ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />{busy}</> : 'Sign once and move'}</Button>
          </div>
        </div>
      )}
      {error && <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-200 flex gap-2"><TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span></div>}
    </div>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-3 px-1"><span className="text-zinc-500">{k}</span><span className="font-mono text-zinc-200 text-right">{v}</span></div>;
}
