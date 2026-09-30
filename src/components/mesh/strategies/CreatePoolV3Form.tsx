/**
 * Custom MeshPoolV3 pool: pick what the pool gives (its reserve), up to three
 * assets it accepts at their own prices, and where proceeds go (your wallet,
 * or recycled into the mirror pool that sells them back). The client computes
 * the covenant, the server's preview must match it, one transaction funds it
 * and the server registers it after checking the chain.
 */
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, ChevronDown, Loader2, Plus, ShieldCheck, TriangleAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { TokenSelectModal, CHIPNET_DEFAULT_TOKENS, type MeshToken } from '@/components/mesh/TokenSelectModal';
import { meshApi, useInvalidateMesh, useMeshSigner, useSignerBalances } from '@/hooks/useMesh';
import {
  buildV3Contract, slotPriceFromRate, slotPriceFromTokenPerBch, v3ArtifactHash, v3ToJson, validateV3Params, type V3Params,
} from '@/lib/mesh/v3/v3Pool';
import { buildDeployV3 } from '@/lib/mesh/v3/v3Tx';
import { sendPoolTx } from '@/lib/mesh/poolTx';
import { toBaseUnits } from '@/lib/mesh/v3/strategyForms';
import { addPending, registerWithRetry, removePending } from '@/lib/mesh/pendingRegistrations';
import { formatSatsCompact, formatUnits, shortHex } from '@/lib/mesh/format';
import { Panel, TokenAvatar, poolUrl, useTokenInfo, type TokenInfo } from '@/components/mesh/pools/shared';

const FEE_TIERS = [5, 30, 50, 100];
const ZERO32 = '00'.repeat(32);
interface Row { cat: string; price: string; back: string }

export function CreatePoolV3Form({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const invalidate = useInvalidateMesh();
  const wallet = useMeshSigner();
  const balances = useSignerBalances(wallet.signer);
  const PUSD = CHIPNET_DEFAULT_TOKENS[1]!.categoryId!;

  const [reserve, setReserve] = useState('0x');
  const [rows, setRows] = useState<Row[]>([{ cat: PUSD, price: '', back: '' }]);
  const [recycle, setRecycle] = useState(false);
  const [feeBps, setFeeBps] = useState(30);
  const [deposit, setDeposit] = useState('');
  const [picker, setPicker] = useState<{ target: 'reserve' | number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const cats = [reserve, ...rows.map(r => r.cat)].filter(c => c && c !== '0x');
  const { get } = useTokenInfo(cats);
  const info = (c: string): TokenInfo => {
    const i = get(c); const f = CHIPNET_DEFAULT_TOKENS.find(t => t.categoryId === c);
    return i.known ? i : f ? { ...i, symbol: f.symbol, decimals: f.decimals, icon: f.icon ?? null, known: true } : i;
  };
  const sym = (c: string) => (c === '0x' ? 'BCH' : info(c).symbol);
  const reserveIsBch = reserve === '0x';

  // What the LP typed → V3 params
  const built = useMemo((): { params?: V3Params; error?: string } => {
    if (!wallet.pkh) return { error: wallet.unavailable ?? 'Connect a wallet' };
    try {
      const slots = rows.map((r, k) => {
        if (!r.cat) throw new Error(`asset ${k + 1}: choose it`);
        if (!r.price) throw new Error(`asset ${k + 1}: enter a price`);
        let price; let back = { num: 0n, den: 0n };
        if (reserveIsBch && r.cat !== '0x') {
          price = slotPriceFromTokenPerBch(r.price, info(r.cat).decimals, true);
          if (recycle) back = slotPriceFromTokenPerBch(r.back || '0', info(r.cat).decimals, false);
        } else if (!reserveIsBch && r.cat === '0x') {
          price = slotPriceFromTokenPerBch(r.price, info(reserve).decimals, false);
          if (recycle) back = slotPriceFromTokenPerBch(r.back || '0', info(reserve).decimals, true);
        } else {
          if (recycle) throw new Error('recycling is available for BCH ↔ token pools');
          price = slotPriceFromRate(r.price, info(reserve).decimals, info(r.cat).decimals);
        }
        return { cat: r.cat, num: price.num, den: price.den, rNum: back.num, rDen: back.den };
      });
      const p: V3Params = { ownerPkh: wallet.pkh, reserve, slots, feeBps, mode: recycle ? 2 : 0, proceedsHash: ZERO32 };
      const bad = validateV3Params(p);
      return bad ? { error: bad } : { params: p };
    } catch (e: any) { return { error: e?.message ?? String(e) }; }
  }, [wallet.pkh, reserve, rows, recycle, feeBps, cats.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const contract = useMemo(() => (built.params && wallet.signer ? buildV3Contract(built.params, wallet.signer.provider) : null), [built.params, wallet.signer]);
  const preview = useQuery({
    queryKey: ['mesh', 'preview-v3', built.params ? v3ToJson(built.params) : null],
    enabled: !!built.params,
    queryFn: () => meshApi.previewV3(v3ToJson(built.params!)),
    retry: false,
  });
  const previewOk = !!preview.data && !!contract && preview.data.address === contract.address && preview.data.artifactHash === v3ArtifactHash();

  const amount = useMemo(() => {
    try { return deposit ? toBaseUnits(deposit, reserveIsBch ? 8 : info(reserve).decimals) : 0n; } catch { return -1n; }
  }, [deposit, reserve]); // eslint-disable-line react-hooks/exhaustive-deps

  const validation = (() => {
    if (!wallet.signer) return wallet.unavailable ?? 'Connect a wallet';
    if (built.error) return built.error;
    if (amount < 0n) return 'Invalid deposit';
    if (reserveIsBch ? amount <= 1000n : amount < 2n) return reserveIsBch ? 'Deposit more than 0.00001 BCH' : `Deposit at least 2 base units of ${sym(reserve)}`;
    const b = balances.data;
    if (b && (reserveIsBch ? amount > b.sats : amount > (b.tokens[reserve] ?? 0n))) return `Not enough ${sym(reserve)} in the wallet`;
    if (preview.isError) return (preview.error as Error).message;
    return null;
  })();

  async function onDeploy() {
    if (!wallet.signer || !built.params || validation || !previewOk) return;
    setErr(null);
    setBusy('Building transaction…');
    let txid: string | null = null;
    try {
      const tx = await buildDeployV3(wallet.signer, [{ params: built.params, sats: reserveIsBch ? amount : 1000n, tokens: reserveIsBch ? 0n : amount }]);
      setBusy(wallet.kind === 'external' ? 'Approve the transaction in your wallet…' : 'Signing and broadcasting…');
      txid = await sendPoolTx(wallet.signer, tx, 'Create a Mesh V3 pool');
      const item = { v3: v3ToJson(built.params), txid, vout: 0, pairName: `${sym(reserve)} for ${rows.map(r => sym(r.cat)).join('/')}` };
      addPending({ txid, v3Items: [item], createdAt: Date.now() });
      setBusy('Registering with the Mesh server…');
      const res = await registerWithRetry(() => meshApi.registerV3([item]));
      if (!res.success) throw new Error(res.error ?? 'registration failed');
      removePending(txid);
      invalidate();
      toast.success('Pool live', { description: `Funded and verified on-chain · ${shortHex(txid)}` });
      navigate(poolUrl(res.pools[0]!.address));
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      toast.error(txid ? 'Funded, registration pending' : 'Transaction not sent', { description: txid ? `${msg}. Retry from My positions.` : msg });
      setErr(msg);
    } finally { setBusy(null); }
  }

  const tokenButton = (cat: string, onClick: () => void, allowBch: boolean) => (
    <button type="button" onClick={onClick} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 min-w-[130px]">
      <span className="flex items-center gap-2 text-sm">{cat === '0x' ? <TokenAvatar info="BCH" size={20} /> : <TokenAvatar info={info(cat)} size={20} />}<span className="font-semibold text-white">{sym(cat)}</span></span>
      <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />{allowBch ? null : null}
    </button>
  );

  const priceLabel = (r: Row) => reserveIsBch
    ? { main: `1 BCH =`, unit: sym(r.cat), back: `Sell back at 1 BCH =` }
    : r.cat === '0x'
      ? { main: `1 BCH =`, unit: sym(reserve), back: `Buy back at 1 BCH =` }
      : { main: `1 ${sym(reserve)} =`, unit: sym(r.cat), back: '' };

  return (
    <div className="space-y-6">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white"><ArrowLeft className="w-4 h-4" />All strategies</button>
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Custom pool</h1>
        <p className="text-xs text-zinc-400 mt-1">One reserve, up to three assets it accepts at their own prices. What it receives goes to your wallet, or recycles into a pool that sells it back.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-6">
          <Panel title="1 · The pool gives">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { setReserve('0x'); setRows(rs => rs.map(r => ({ ...r, cat: r.cat === '0x' ? PUSD : r.cat }))); }}
                className={cn('px-3 py-2 rounded-xl border text-sm font-semibold', reserveIsBch ? 'border-emerald-500/50 bg-emerald-500/10 text-white' : 'border-white/10 text-zinc-400')}>BCH</button>
              <button type="button" onClick={() => setPicker({ target: 'reserve' })}
                className={cn('px-3 py-2 rounded-xl border text-sm font-semibold', !reserveIsBch ? 'border-emerald-500/50 bg-emerald-500/10 text-white' : 'border-white/10 text-zinc-400')}>
                {reserveIsBch ? 'A token…' : sym(reserve)}
              </button>
            </div>
          </Panel>

          <Panel title="2 · It accepts" action={rows.length < 3 ? (
            <Button size="sm" variant="outline" className="h-7 rounded-lg text-[11px]" onClick={() => setRows(rs => [...rs, { cat: reserveIsBch ? '' : '0x', price: '', back: '' }])}><Plus className="w-3 h-3 mr-1" />Asset</Button>
          ) : undefined}>
            {rows.map((r, k) => {
              const l = priceLabel(r);
              return (
                <div key={k} className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                  <div className="flex items-center gap-2">
                    {tokenButton(r.cat || PUSD, () => setPicker({ target: k }), !reserveIsBch)}
                    {!reserveIsBch && r.cat !== '0x' && (
                      <button type="button" onClick={() => setRows(rs => rs.map((x, i) => (i === k ? { ...x, cat: '0x' } : x)))} className="text-[11px] text-zinc-500 hover:text-white">use BCH</button>
                    )}
                    {rows.length > 1 && <button type="button" onClick={() => setRows(rs => rs.filter((_, i) => i !== k))} className="ml-auto text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 shrink-0">{l.main}</span>
                    <Input value={r.price} inputMode="decimal" onChange={e => setRows(rs => rs.map((x, i) => (i === k ? { ...x, price: e.target.value.replace(/[^0-9.]/g, '') } : x)))} className="font-mono bg-black/40 border-white/10" />
                    <span className="text-xs font-semibold text-zinc-300 shrink-0">{l.unit}</span>
                  </div>
                  {recycle && l.back && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-amber-300/80 shrink-0">{l.back}</span>
                      <Input value={r.back} inputMode="decimal" onChange={e => setRows(rs => rs.map((x, i) => (i === k ? { ...x, back: e.target.value.replace(/[^0-9.]/g, '') } : x)))} className="font-mono bg-black/40 border-white/10" />
                      <span className="text-xs font-semibold text-zinc-300 shrink-0">{reserveIsBch ? sym(r.cat) : sym(reserve)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </Panel>

          <Panel title="3 · Proceeds and fee">
            <div className="grid grid-cols-2 gap-2">
              {[[false, 'To my wallet', 'Every fill pays you directly'], [true, 'Recycle', 'Fills flip into a pool that sells back at your price']].map(([v, t, d]) => (
                <button key={String(v)} type="button" onClick={() => setRecycle(v as boolean)}
                  className={cn('p-3 rounded-2xl border text-left', recycle === v ? 'border-emerald-500/50 bg-emerald-500/[0.06]' : 'border-white/[0.08] hover:border-white/20')}>
                  <div className="text-sm font-bold text-white">{t as string}</div><div className="text-[11px] text-zinc-500 mt-0.5">{d as string}</div>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {FEE_TIERS.map(f => (
                <button key={f} type="button" onClick={() => setFeeBps(f)}
                  className={cn('px-3 py-1.5 rounded-xl text-xs font-mono font-semibold border', feeBps === f ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' : 'border-white/10 text-zinc-400 hover:text-white')}>
                  {(f / 100).toFixed(2)}%
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="4 · Deposit">
            <div className="flex items-center gap-2">
              <Input value={deposit} inputMode="decimal" placeholder="0.0" onChange={e => setDeposit(e.target.value.replace(/[^0-9.]/g, ''))} className="font-mono bg-black/40 border-white/10" />
              <span className="text-sm text-zinc-300">{sym(reserve)}</span>
            </div>
            {balances.data && (
              <p className="text-[11px] text-zinc-500 font-mono">Wallet: {reserveIsBch ? formatSatsCompact(balances.data.sats) : `${formatUnits(balances.data.tokens[reserve] ?? 0n, info(reserve).decimals)} ${sym(reserve)}`}</p>
            )}
          </Panel>
        </div>

        <Panel title="Summary" className="lg:col-span-5 lg:sticky lg:top-20">
          <div className="text-xs text-zinc-400 space-y-1">
            <div className="flex justify-between"><span>Gives</span><span className="text-zinc-200">{sym(reserve)}</span></div>
            <div className="flex justify-between"><span>Accepts</span><span className="text-zinc-200">{rows.map(r => sym(r.cat)).join(', ')}</span></div>
            <div className="flex justify-between"><span>Proceeds</span><span className="text-zinc-200">{recycle ? 'recycled (mirror pool)' : 'your wallet'}</span></div>
            <div className="flex justify-between"><span>Covenant</span><span className="font-mono text-zinc-300">{contract ? shortHex(contract.address, 8, 6) : '—'}</span></div>
          </div>
          {built.params && (
            <div className={cn('flex items-center gap-2 text-[11px]', previewOk ? 'text-emerald-400' : 'text-zinc-500')}>
              {previewOk ? <ShieldCheck className="w-4 h-4" /> : preview.isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <TriangleAlert className="w-4 h-4" />}
              {previewOk ? 'Server computes the same covenant address' : preview.isFetching ? 'Checking with the server…' : 'Address check pending'}
            </div>
          )}
          {(validation || err) && <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-200">{err ?? validation}</div>}
          <Button className="w-full h-11 rounded-xl font-bold" disabled={!!validation || !previewOk || !!busy} onClick={onDeploy}>
            {busy ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />{busy}</> : <><CheckCircle2 className="w-4 h-4 mr-2" />Create pool</>}
          </Button>
        </Panel>
      </div>

      <TokenSelectModal open={!!picker} onOpenChange={o => { if (!o) setPicker(null); }} title="Choose a token"
        onSelect={(t: MeshToken) => {
          if (picker && !t.isNativeBch && t.categoryId) {
            if (picker.target === 'reserve') { setReserve(t.categoryId); setRows(rs => rs.map(r => ({ ...r, cat: r.cat === t.categoryId ? '0x' : r.cat }))); }
            else setRows(rs => rs.map((x, i) => (i === picker.target ? { ...x, cat: t.categoryId! } : x)));
          }
          setPicker(null);
        }} />
    </div>
  );
}
