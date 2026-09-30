/**
 * Build and deploy a strategy (a template of MeshPoolV3 pools):
 *   form → server preview → every pool recomputed and checked locally (address
 *   and owner) → one transaction funds every pool → the server registers the
 *   strategy from that transaction → strategy dashboard.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, Info, Loader2, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { TokenSelectModal, CHIPNET_DEFAULT_TOKENS, type MeshToken } from '@/components/mesh/TokenSelectModal';
import { meshApi, useInvalidateMesh, useMarketRef, useMeshHealth, useMeshSigner, useSignerBalances, useStrategyTemplates } from '@/hooks/useMesh';
import { formFor, toServerParams, type FieldSpec } from '@/lib/mesh/v3/strategyForms';
import { parseV3Params, v3ContractFor } from '@/lib/mesh/v3/v3Pool';
import { poolLevels } from '@/lib/mesh/v3/v3Display';
import { buildDeployV3, type V3Deposit } from '@/lib/mesh/v3/v3Tx';
import { sendPoolTx, type BuiltTx } from '@/lib/mesh/poolTx';
import type { StrategyInput, StrategyPreview } from '@/lib/mesh/meshApi';
import { addPending, registerWithRetry, removePending } from '@/lib/mesh/pendingRegistrations';
import { formatNumber, formatSatsCompact, formatUnits, shortHex } from '@/lib/mesh/format';
import { tokenPerBchFromSatsPerUnit } from '@/lib/mesh/pool';
import { Panel, TokenAvatar, useTokenInfo, type TokenInfo } from '@/components/mesh/pools/shared';
import { PriceLadder } from './PriceLadder';

const FEE_TIERS = [5, 30, 50, 100];
const PUSD = CHIPNET_DEFAULT_TOKENS[1]!.categoryId!;
const MUSD = CHIPNET_DEFAULT_TOKENS[2]!.categoryId!;

export const strategyUrl = (id: string) => `/mesh/strategy/${encodeURIComponent(id)}`;

function defaults(fields: FieldSpec[]): Record<string, string> {
  const v: Record<string, string> = {};
  for (const f of fields) {
    if (f.default !== undefined) v[f.key] = f.default;
    if (f.kind === 'token' && !f.optional) v[f.key] = /2|B$/.test(f.key) ? MUSD : PUSD;
  }
  return v;
}

function useDebounced<T>(value: T, ms = 400): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export function StrategyBuilder({ templateId, onBack }: { templateId: string; onBack: () => void }) {
  const navigate = useNavigate();
  const invalidate = useInvalidateMesh();
  const wallet = useMeshSigner();
  const health = useMeshHealth();
  const balances = useSignerBalances(wallet.signer);
  const templates = useStrategyTemplates();
  const form = formFor(templateId);
  const meta = templates.data?.templates.find(t => t.id === templateId);

  const [values, setValues] = useState<Record<string, string>>(() => defaults(form?.fields ?? []));
  const [tokenModal, setTokenModal] = useState<string | null>(null);
  const [review, setReview] = useState<{ built: BuiltTx; input: StrategyInput; preview: StrategyPreview } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const set = (k: string, v: string) => setValues(prev => ({ ...prev, [k]: v }));

  const tokenCats = useMemo(() => (form?.fields ?? []).filter(f => f.kind === 'token').map(f => values[f.key]).filter(Boolean) as string[], [form, values]);
  const { get } = useTokenInfo(tokenCats);
  const fallback = (cat: string) => CHIPNET_DEFAULT_TOKENS.find(t => t.categoryId === cat);
  const infoOf = (cat: string): TokenInfo => {
    const i = get(cat);
    const f = fallback(cat);
    return i.known ? i : f ? { ...i, symbol: f.symbol, decimals: f.decimals, icon: f.icon ?? null, known: true } : i;
  };
  const mainToken = values.token ?? values.token1 ?? values.tokenA ?? '';
  const main = infoOf(mainToken);
  const market = useMarketRef(mainToken || undefined);
  const marketPrice = market.data?.cauldron ? tokenPerBchFromSatsPerUnit(market.data.cauldron.satsPerToken, main.decimals) : null;

  // Form → server params (exact unit conversion)
  const input = useMemo((): { input?: StrategyInput; error?: string } => {
    if (!form) return { error: `Unknown template ${templateId}` };
    if (!wallet.pkh) return { error: wallet.unavailable ?? 'Connect a wallet' };
    try {
      return { input: { template: templateId, ownerPkh: wallet.pkh, params: toServerParams(templateId, values, c => infoOf(c).decimals) } };
    } catch (e: any) { return { error: e?.message ?? String(e) }; }
  }, [form, templateId, wallet.pkh, values, tokenCats.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const debounced = useDebounced(input.input);

  const preview = useQuery({
    queryKey: ['mesh', 'strategy-preview', debounced],
    enabled: !!debounced,
    queryFn: () => meshApi.previewStrategy(debounced!),
    retry: false,
  });

  // Every pool recomputed here: address must match, owner must be this wallet.
  const verified = useMemo(() => {
    if (!preview.data || !wallet.signer || !wallet.pkh) return null;
    try {
      const deposits: V3Deposit[] = preview.data.pools.map(p => {
        const { params } = v3ContractFor(p.v3, p.address, wallet.signer!.provider);
        if (params.ownerPkh !== wallet.pkh) throw new Error(`pool ${p.role} is not owned by this wallet`);
        return { params, sats: BigInt(p.deposit.sats), tokens: BigInt(p.deposit.token?.amount ?? '0') };
      });
      return { ok: true as const, deposits };
    } catch (e: any) { return { ok: false as const, error: e?.message ?? String(e) }; }
  }, [preview.data, wallet.signer, wallet.pkh]);

  const levels = useMemo(() => (preview.data?.pools ?? []).flatMap(p => poolLevels(p.address, p.v3, c => infoOf(c).decimals, p.role))
    .filter(l => l.token === mainToken), [preview.data, mainToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const networkMismatch = health.data && wallet.signer && health.data.network !== wallet.network;
  const validation = useMemo(() => {
    if (!wallet.signer) return wallet.unavailable ?? 'Connect a wallet';
    if (networkMismatch) return `The Mesh server runs on ${health.data!.network}; switch your wallet to ${health.data!.network}`;
    if (input.error) return input.error;
    if (preview.isError) return (preview.error as Error).message;
    if (verified && !verified.ok) return `Refusing to deploy: ${verified.error}`;
    const t = preview.data?.totals; const b = balances.data;
    if (t && b) {
      if (BigInt(t.sats) > b.sats) return 'Not enough BCH in the wallet';
      for (const [cat, amt] of Object.entries(t.tokens)) if (BigInt(amt) > (b.tokens[cat] ?? 0n)) return `Not enough ${infoOf(cat).symbol} in the wallet`;
    }
    return null;
  }, [wallet, networkMismatch, input, preview.isError, preview.error, preview.data, verified, balances.data, health.data]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onReview() {
    setFormError(null);
    if (!wallet.signer || !verified?.ok || !input.input || !preview.data) return;
    setBusy('Building transaction…');
    try {
      const built = await buildDeployV3(wallet.signer, verified.deposits);
      setReview({ built, input: input.input, preview: preview.data });
    } catch (e: any) { setFormError(e?.message ?? String(e)); } finally { setBusy(null); }
  }

  async function onConfirm() {
    if (!review || !wallet.signer) return;
    setBusy(wallet.kind === 'external' ? 'Approve the transaction in your wallet…' : 'Signing and broadcasting…');
    let txid: string | null = null;
    try {
      txid = await sendPoolTx(wallet.signer, review.built, `Deploy ${meta?.name ?? templateId} (${review.preview.pools.length} Mesh pool${review.preview.pools.length > 1 ? 's' : ''})`);
      addPending({ txid, strategy: review.input, createdAt: Date.now() });
      setBusy('Registering with the Mesh server…');
      const r = await registerWithRetry(() => meshApi.registerStrategy({ ...review.input, txid: txid! }));
      removePending(txid);
      invalidate();
      toast.success('Strategy live', { description: `${review.preview.pools.length} pool(s) funded and verified on-chain · ${shortHex(txid)}` });
      setReview(null);
      navigate(strategyUrl(r.strategy.id));
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      toast.error(txid ? 'Funded, registration pending' : 'Transaction not sent',
        { description: txid ? `${msg}. Your funds are in the pools; retry from My positions.` : msg, duration: 12_000 });
      setFormError(msg);
    } finally { setBusy(null); }
  }

  if (!form) return <Panel><p className="text-sm text-zinc-400">Unknown template.</p></Panel>;

  const field = (f: FieldSpec) => {
    const v = values[f.key] ?? '';
    const tokenOf = f.token ? infoOf(values[f.token] ?? '') : null;
    if (f.kind === 'token') {
      const i = v ? infoOf(v) : null;
      return (
        <button type="button" onClick={() => setTokenModal(f.key)}
          className="w-full flex items-center justify-between gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20">
          <span className="flex items-center gap-2 text-sm">{i ? <><TokenAvatar info={i} size={20} /><span className="font-semibold text-white">{i.symbol}</span></> : <span className="text-zinc-500">Choose a token</span>}</span>
          <span className="flex items-center gap-1 text-xs text-zinc-400">{v && f.optional ? <span onClick={(e) => { e.stopPropagation(); set(f.key, ''); }} className="hover:text-white">clear</span> : null}<ChevronDown className="w-3.5 h-3.5" /></span>
        </button>
      );
    }
    if (f.kind === 'choice') {
      return (
        <div className="grid grid-cols-2 gap-2">
          {f.choices!.map(c => (
            <button key={c.value} type="button" onClick={() => set(f.key, c.value)}
              className={cn('p-2.5 rounded-xl border text-left text-xs font-semibold', v === c.value ? 'border-emerald-500/50 bg-emerald-500/[0.06] text-white' : 'border-white/[0.08] text-zinc-400 hover:border-white/20')}>{c.label}</button>
          ))}
        </div>
      );
    }
    if (f.key === 'feeBps') {
      return (
        <div className="flex flex-wrap gap-2">
          {FEE_TIERS.map(t => (
            <button key={t} type="button" onClick={() => set('feeBps', String(t))}
              className={cn('px-3 py-1.5 rounded-xl text-xs font-mono font-semibold border', v === String(t) ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' : 'border-white/10 text-zinc-400 hover:text-white')}>
              {(t / 100).toFixed(2)}%
            </button>
          ))}
        </div>
      );
    }
    const suffix = f.kind === 'price' ? tokenOf?.symbol : f.kind === 'bch' ? 'BCH' : f.kind === 'tokenAmount' ? tokenOf?.symbol : f.kind === 'bps' ? 'bps' : f.kind === 'rate' ? 'B' : '';
    const bal = balances.data;
    const walletHint = f.kind === 'bch' && bal ? formatSatsCompact(bal.sats)
      : f.kind === 'tokenAmount' && bal && tokenOf ? `${formatUnits(bal.tokens[tokenOf.category] ?? 0n, tokenOf.decimals)} ${tokenOf.symbol}` : null;
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          {f.kind === 'price' && <span className="text-xs text-zinc-500 shrink-0">1 BCH =</span>}
          <Input value={v} inputMode="decimal" placeholder={f.kind === 'count' ? String(f.min ?? '') : '0.0'}
            onChange={e => set(f.key, e.target.value.replace(/[^0-9.]/g, ''))} className="font-mono bg-black/40 border-white/10" />
          {suffix && <span className="text-xs font-semibold text-zinc-300 shrink-0">{suffix}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {f.kind === 'price' && marketPrice && tokenOf?.category === mainToken && [-2, -1, 0, 1, 2].map(d => (
            <button key={d} type="button" onClick={() => set(f.key, (marketPrice * (1 + d / 100)).toFixed(Math.min(4, Math.max(2, main.decimals))))}
              className="px-2 py-0.5 rounded-md text-[10px] font-mono border border-white/10 text-zinc-400 hover:text-white">{d === 0 ? 'Market' : `${d > 0 ? '+' : ''}${d}%`}</button>
          ))}
          {walletHint && <span className="text-[10px] text-zinc-500 font-mono">Wallet: {walletHint}</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white"><ArrowLeft className="w-4 h-4" />All strategies</button>
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{meta?.name ?? templateId}</h1>
        <p className="text-xs text-zinc-400 mt-1">{meta?.summary ?? form.earns}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <Panel title="Parameters" className="lg:col-span-6">
          {form.fields.map(f => (
            <div key={f.key} className="space-y-1.5">
              <div className="text-xs font-semibold text-zinc-400">{f.label}{f.optional ? <span className="text-zinc-600 font-normal"> · optional</span> : null}</div>
              {field(f)}
              {f.help && <p className="text-[10px] text-zinc-500">{f.help}</p>}
            </div>
          ))}
          <p className="text-[11px] text-zinc-500 flex gap-1.5"><Info className="w-3.5 h-3.5 shrink-0 mt-px" />
            Prices are yours before the fee. The covenant enforces every price on-chain; only your key can withdraw.
          </p>
        </Panel>

        <div className="lg:col-span-6 space-y-6 lg:sticky lg:top-20">
          <Panel title="Preview" action={market.data?.cauldron && marketPrice ? <span className="text-[11px] text-zinc-500">Cauldron: 1 BCH ≈ <span className="font-mono text-zinc-300">{formatNumber(marketPrice, 2)}</span> {main.symbol}</span> : undefined}>
            {levels.length > 0 && <PriceLadder levels={levels} market={marketPrice} symbol={main.symbol} />}
            {preview.isFetching && <div className="flex items-center gap-2 text-xs text-zinc-500"><Loader2 className="w-3.5 h-3.5 animate-spin" />Computing pools…</div>}
            {preview.data && (
              <div className="space-y-2">
                {preview.data.pools.map(p => {
                  const reserve = p.v3.reserve === '0x' ? 'BCH' : infoOf(p.v3.reserve).symbol;
                  const accepts = p.v3.slots.map(s => (s.cat === '0x' ? 'BCH' : infoOf(s.cat).symbol)).join(', ');
                  return (
                    <div key={p.address} className="p-3 rounded-xl bg-black/30 border border-white/[0.06] text-xs space-y-1">
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold text-white capitalize">{p.role.replace('-', ' ')}</span>
                        <span className="font-mono text-zinc-300">{p.deposit.token ? `${formatUnits(p.deposit.token.amount, infoOf(p.deposit.token.category).decimals)} ${infoOf(p.deposit.token.category).symbol}` : formatSatsCompact(p.deposit.sats)}</span>
                      </div>
                      <div className="flex justify-between gap-2 text-zinc-500">
                        <span>Gives {reserve} for {accepts}{p.v3.modeName === 'mirror' ? ' · recycles' : ''}</span>
                        <span className="font-mono">{shortHex(p.address, 8, 6)}</span>
                      </div>
                    </div>
                  );
                })}
                <div className="flex justify-between text-xs text-zinc-400 px-1">
                  <span>You deposit</span>
                  <span className="font-mono text-zinc-200">
                    {formatSatsCompact(preview.data.totals.sats)}
                    {Object.entries(preview.data.totals.tokens).map(([c, a]) => ` + ${formatUnits(a, infoOf(c).decimals)} ${infoOf(c).symbol}`)}
                  </span>
                </div>
              </div>
            )}
            {verified?.ok && (
              <div className="flex items-center gap-2 text-[11px] text-emerald-400"><ShieldCheck className="w-4 h-4" />Every pool recomputed here: same address as the server, owned by your wallet</div>
            )}
            {(validation || formError) && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-200 flex gap-2"><TriangleAlert className="w-4 h-4 shrink-0" />{formError ?? validation}</div>
            )}
            <Button className="w-full h-11 rounded-xl font-bold" disabled={!!validation || !verified?.ok || !!busy} onClick={onReview}>
              {busy && !review ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />{busy}</> : <>Review <ArrowRight className="w-4 h-4 ml-1.5" /></>}
            </Button>
          </Panel>
        </div>
      </div>

      <TokenSelectModal open={!!tokenModal} onOpenChange={o => { if (!o) setTokenModal(null); }} title="Choose a token"
        selectedToken={tokenModal ? CHIPNET_DEFAULT_TOKENS.find(t => t.categoryId === values[tokenModal]) : undefined}
        onSelect={(t: MeshToken) => { if (tokenModal && !t.isNativeBch && t.categoryId) set(tokenModal, t.categoryId); setTokenModal(null); }} />

      <Dialog open={!!review} onOpenChange={o => { if (!o && !busy) setReview(null); }}>
        <DialogContent className="max-w-md bg-[#0c0c10] border border-white/10 rounded-3xl text-white">
          <DialogHeader>
            <DialogTitle>Deploy {meta?.name ?? templateId}</DialogTitle>
            <DialogDescription className="text-zinc-400">One transaction funds every pool; the server then verifies each one on-chain.</DialogDescription>
          </DialogHeader>
          {review && (
            <div className="space-y-2 text-xs">
              {review.preview.pools.map((p, i) => (
                <div key={p.address} className="flex justify-between p-2.5 rounded-lg bg-white/[0.03]">
                  <span>Output {i} · <span className="capitalize">{p.role.replace('-', ' ')}</span></span>
                  <span className="font-mono">{p.deposit.token ? `${formatUnits(p.deposit.token.amount, infoOf(p.deposit.token.category).decimals)} ${infoOf(p.deposit.token.category).symbol}` : formatSatsCompact(p.deposit.sats)}</span>
                </div>
              ))}
              <div className="flex justify-between px-2.5 text-zinc-400"><span>Network fee</span><span className="font-mono">{review.built.fee.toString()} sats ({review.built.size} B)</span></div>
              <Button className="w-full h-11 rounded-xl font-bold mt-2" disabled={!!busy} onClick={onConfirm}>
                {busy ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />{busy}</> : <><CheckCircle2 className="w-4 h-4 mr-2" />Sign and deploy</>}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
