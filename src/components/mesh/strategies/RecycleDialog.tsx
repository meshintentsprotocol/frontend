/**
 * Recycle idle liquidity (MeshDocs/AlphaV3/11) in one signature:
 *   choose items → server plan (close / reopen as recycling pairs around the mid)
 *   → every pool rebuilt and checked here → one transaction docks the idle pools
 *   and funds the new ones (wallet adds the fee, wallet proceeds and carriers)
 *   → each new strategy registered with its part index.
 */
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, Moon, Recycle, ShieldCheck, TriangleAlert, Wallet, Waves, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { meshApi, useInvalidateMesh, useMeshSigner } from '@/hooks/useMesh';
import type { IdleItem, IdleKind, IdleReport, RecyclePlan } from '@/lib/mesh/meshApi';
import { v3ContractFor } from '@/lib/mesh/v3/v3Pool';
import { buildRebalanceV3, type ClosePool, type V3Deposit } from '@/lib/mesh/v3/v3Tx';
import { sendPoolTx, type BuiltTx } from '@/lib/mesh/poolTx';
import { addPending, registerWithRetry, removePending } from '@/lib/mesh/pendingRegistrations';
import { formatNumber, formatSatsCompact, formatUnits, formatUsd, satsToUsd, shortHex } from '@/lib/mesh/format';
import type { TokenInfo } from '@/components/mesh/pools/shared';
import { VsMid, tokensPerBch } from '@/components/mesh/ui/defi';

const KIND: Record<IdleKind, { label: string; icon: typeof Moon }> = {
  wallet: { label: 'In your wallet', icon: Wallet },
  stale: { label: 'Not filling', icon: Moon },
  'one-sided': { label: 'Out of range', icon: Waves },
  dust: { label: 'Dust', icon: Sparkles },
};
const SPREADS = [50, 100, 200];

export function RecycleDialog({ open, onOpenChange, report, infoOf, bchUsd }: {
  open: boolean; onOpenChange: (o: boolean) => void; report: IdleReport; infoOf: (cat: string) => TokenInfo; bchUsd?: number | null;
}) {
  const wallet = useMeshSigner();
  const invalidate = useInvalidateMesh();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(report.items.map(i => i.id)));
  const [spreadBps, setSpreadBps] = useState(100);
  const [plan, setPlan] = useState<RecyclePlan | null>(null);
  const [built, setBuilt] = useState<BuiltTx | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (open) { setSelected(new Set(report.items.map(i => i.id))); setPlan(null); setBuilt(null); setError(null); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPlan(null); setBuilt(null); }, [selected, spreadBps]);

  const chosenValue = useMemo(() => report.items.filter(i => selected.has(i.id)).reduce((a, i) => a + BigInt(i.valueSats), 0n), [report, selected]);
  const amount = (cat: string, units: string) => (cat === '0x' ? formatSatsCompact(units) : `${formatUnits(units, infoOf(cat).decimals)} ${infoOf(cat).symbol}`);
  const toggle = (id: string) => setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function onPlan() {
    if (!wallet.pkh) return;
    setError(null); setBusy('Planning…');
    try {
      const p = await meshApi.recyclePlan({ owner: wallet.pkh, items: [...selected], spreadBps });
      setPlan(p);
      // build right away so the review shows the real fee
      setBusy('Building transaction…');
      setBuilt(await build(p));
    } catch (e: any) { setError(e?.message ?? String(e)); } finally { setBusy(null); }
  }

  /** Every pool rebuilt here: closed pools from their params, opened pools checked for address and owner. */
  async function build(p: RecyclePlan): Promise<BuiltTx> {
    const signer = wallet.signer!;
    const close: ClosePool[] = [];
    for (const c of p.close) {
      const { pool } = await meshApi.get(c.address);
      if (!pool.v3) throw new Error(`${shortHex(c.address)} is not a V3 pool`);
      if (pool.ownerPkh !== wallet.pkh) throw new Error(`${shortHex(c.address)} is not yours`);
      const wanted = new Set(c.utxos.map(u => `${u.txid}:${u.vout}`));
      const utxos = (await signer.provider.getUtxos(c.address)).filter(u => wanted.has(`${u.txid}:${u.vout}`));
      if (utxos.length) close.push({ contract: v3ContractFor(pool.v3, c.address, signer.provider).contract, utxos });
    }
    const deposits: V3Deposit[] = p.open.flatMap(o => o.pools.map(sp => {
      const { params } = v3ContractFor(sp.v3, sp.address, signer.provider);
      if (params.ownerPkh !== wallet.pkh) throw new Error(`new pool ${shortHex(sp.address)} is not owned by this wallet`);
      return { params, sats: BigInt(sp.deposit.sats), tokens: BigInt(sp.deposit.token?.amount ?? '0') };
    }));
    return buildRebalanceV3(signer, close, deposits);
  }

  async function onSign() {
    if (!plan || !built || !wallet.signer || !wallet.pkh) return;
    setError(null);
    setBusy(wallet.kind === 'external' ? 'Approve the transaction in your wallet…' : 'Signing and broadcasting…');
    let txid: string | null = null;
    const strategies = plan.open.map(o => ({ template: o.template, ownerPkh: wallet.pkh!, params: o.params, part: o.part, recycledFrom: plan.recycledFrom }));
    try {
      txid = await sendPoolTx(wallet.signer, { builder: built.builder }, `Recycle ${plan.close.length} idle pool${plan.close.length === 1 ? '' : 's'} into ${plan.open.length} recycling pair${plan.open.length === 1 ? '' : 's'}`);
      addPending({ txid, strategies, createdAt: Date.now() });
      setBusy('Registering the new strategies…');
      for (const s of strategies) {
        await registerWithRetry(() => meshApi.registerStrategy({ ...s, txid: txid! }).catch((e: any) => { if (e?.status === 409) return null as any; throw e; }));
      }
      for (const c of plan.close) await meshApi.sync(c.address).catch(() => undefined);
      removePending(txid);
      invalidate();
      toast.success('Liquidity recycled', { description: `${plan.open.length} recycling pair${plan.open.length === 1 ? '' : 's'} live · ${shortHex(txid)}` });
      onOpenChange(false);
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      toast.error(txid ? 'Recycled on-chain, registration pending' : 'Transaction not sent',
        { description: txid ? `${msg}. Funds are in the new pools; retry from My pools.` : msg, duration: 12_000 });
      setError(msg);
    } finally { setBusy(null); }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="max-w-xl bg-[#0b0d12] border border-white/10 rounded-3xl text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2"><Recycle className="w-5 h-5 text-emerald-300" />Recycle idle liquidity</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Idle liquidity reopens as recycling pairs around today&apos;s price, so it keeps earning inside Mesh. One signature.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {report.items.map((i: IdleItem) => {
            const K = KIND[i.kind];
            const on = selected.has(i.id);
            return (
              <label key={i.id} className={cn('flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors',
                on ? 'border-emerald-400/30 bg-emerald-500/[0.05]' : 'border-white/[0.08] hover:border-white/20')}>
                <input type="checkbox" checked={on} onChange={() => toggle(i.id)} className="mt-1 h-4 w-4 accent-emerald-500" />
                <K.icon className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold">{K.label}{i.token ? ` · ${infoOf(i.token).symbol}` : ''}</span>
                    <span className="font-mono text-xs tabular-nums">{formatSatsCompact(i.valueSats)}</span>
                  </div>
                  <div className="text-[11px] text-zinc-400">{i.reason}{i.kind === 'wallet' && i.asset && i.amount ? ` · ${amount(i.asset, i.amount)}` : ''}</div>
                </div>
              </label>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-zinc-400">Buy / sell around the market</span>
          <div className="flex gap-1.5" role="radiogroup" aria-label="Spread">
            {SPREADS.map(b => (
              <button key={b} type="button" role="radio" aria-checked={spreadBps === b} onClick={() => setSpreadBps(b)}
                className={cn('rounded-lg border px-2.5 py-1 font-mono text-[11px]', spreadBps === b ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-200' : 'border-white/10 text-zinc-400 hover:text-white')}>
                ±{(b / 100).toFixed(1)}%
              </button>
            ))}
          </div>
        </div>

        {plan && (
          <div className="space-y-3 rounded-2xl border border-white/[0.08] bg-black/30 p-3">
            <div className="text-[11px] text-zinc-400">
              Close <span className="font-mono text-zinc-200">{plan.close.length}</span> pool{plan.close.length === 1 ? '' : 's'} (frees <span className="font-mono text-zinc-200">{formatSatsCompact(plan.freed.sats)}</span>
              {Object.entries(plan.freed.tokens).map(([c, a]) => <span key={c} className="font-mono text-zinc-200"> + {amount(c, a)}</span>)})
              {(BigInt(plan.fromWallet.sats) > 0n || Object.keys(plan.fromWallet.tokens).length > 0) && <> · from your wallet <span className="font-mono text-zinc-200">
                {BigInt(plan.fromWallet.sats) > 0n ? formatSatsCompact(plan.fromWallet.sats) : ''}{Object.entries(plan.fromWallet.tokens).map(([c, a]) => ` ${amount(c, a)}`)}</span></>}
            </div>
            {plan.open.map(o => {
              const t = infoOf(String(o.params.token));
              const buy = Number(o.params.buySatsPerToken); const sell = Number(o.params.sellSatsPerToken);
              const m = o.pools[0]?.market?.[0];
              return (
                <div key={o.part} className="rounded-xl border border-emerald-400/15 bg-emerald-500/[0.04] p-3 text-[11px] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-emerald-200 flex items-center gap-1.5"><Recycle className="h-3.5 w-3.5" />Recycling pair · {t.symbol} · starts in {o.params.start === 'bch' ? 'BCH' : t.symbol}</span>
                    <span className="font-mono">{o.params.start === 'bch' ? formatSatsCompact(String(o.params.deposit)) : amount(t.category, String(o.params.deposit))}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-zinc-400">
                    <span>Buys at 1 BCH = <span className="font-mono text-zinc-200">{formatNumber(tokensPerBch(buy, t.decimals), 2)}</span> · sells at <span className="font-mono text-zinc-200">{formatNumber(tokensPerBch(sell, t.decimals), 2)}</span> {t.symbol}</span>
                    {m && <span className="flex gap-2"><VsMid bps={m.vsMidBps} /><VsMid bps={m.reverseVsMidBps} /></span>}
                  </div>
                </div>
              );
            })}
            {plan.notes.map(n => <p key={n} className="text-[11px] text-zinc-500">{n}</p>)}
            {built && <div className="flex justify-between text-[11px] text-zinc-400"><span>Network fee</span><span className="font-mono">{built.fee.toString()} sats ({built.size} B)</span></div>}
            {built && <div className="flex items-center gap-1.5 text-[11px] text-emerald-300"><ShieldCheck className="h-4 w-4" />Every pool rebuilt here and owned by your wallet</div>}
          </div>
        )}

        {error && <div className="flex gap-2 rounded-xl border border-amber-400/25 bg-amber-500/10 p-3 text-[11px] text-amber-200"><TriangleAlert className="h-4 w-4 shrink-0" />{error}</div>}

        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-[11px] text-zinc-500">{selected.size} selected · <span className="font-mono">{formatSatsCompact(chosenValue)}</span>{satsToUsd(chosenValue, bchUsd) !== null ? ` · ${formatUsd(satsToUsd(chosenValue, bchUsd))}` : ''}</span>
          {!plan || !built ? (
            <Button className="rounded-xl font-bold" disabled={!selected.size || !!busy || !wallet.signer} onClick={onPlan}>
              {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{busy}</> : 'Review recycle'}
            </Button>
          ) : (
            <Button className="rounded-xl font-bold" disabled={!!busy} onClick={onSign}>
              {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{busy}</> : <><CheckCircle2 className="mr-2 h-4 w-4" />Sign and recycle</>}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
