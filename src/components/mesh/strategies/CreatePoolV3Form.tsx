/**
 * Custom MeshPoolV3 pool: pick what the pool gives (its reserve), up to three
 * assets it accepts at their own prices, and where proceeds go (your wallet,
 * or recycled into the mirror pool that sells them back). The client computes
 * the covenant, the server's preview must match it, one transaction funds it
 * and the server registers it after checking the chain.
 */
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ChevronDown, Loader2, Plus, ShieldCheck, TriangleAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { TokenSelectModal, CHIPNET_DEFAULT_TOKENS, type MeshToken } from '@/components/mesh/TokenSelectModal';
import { useMeshSigner, useSignerBalances } from '@/hooks/useMesh';
import { useCustomPoolDeploy } from '@/hooks/mesh/useCustomPoolDeploy';
import { customPoolParams, type CustomRow } from '@/lib/mesh/create/customPool';
import { toBaseUnits } from '@/lib/mesh/v3/strategyForms';
import { FEE_TIERS } from '@/lib/mesh/presets';
import { pusdCategory } from '@/lib/pusd';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatSatsCompact, formatUnits, shortHex } from '@/lib/mesh/format';
import { Panel, TokenAvatar, poolUrl, useTokenInfo, type TokenInfo } from '@/components/mesh/pools/shared';

type Row = CustomRow;

export function CreatePoolV3Form({ onBack, initialToken }: { onBack: () => void; initialToken?: string }) {
  const navigate = useNavigate();
  const wallet = useMeshSigner();
  const balances = useSignerBalances(wallet.signer);
  // the token the LP came with, else pUSD of the wallet's network
  const DEFAULT_TOKEN = initialToken ?? pusdCategory(wallet.network === 'mainnet');

  const [reserve, setReserve] = useState('0x');
  const [rows, setRows] = useState<Row[]>([{ cat: DEFAULT_TOKEN, price: '', back: '' }]);
  const [recycle, setRecycle] = useState(false);
  const [feeBps, setFeeBps] = useState(30);
  const [deposit, setDeposit] = useState('');
  const [picker, setPicker] = useState<{ target: 'reserve' | number } | null>(null);

  const cats = [reserve, ...rows.map(r => r.cat)].filter(c => c && c !== '0x');
  const { get } = useTokenInfo(cats);
  const info = (c: string): TokenInfo => {
    const i = get(c); const f = CHIPNET_DEFAULT_TOKENS.find(t => t.categoryId === c);
    return i.known ? i : f ? { ...i, symbol: f.symbol, decimals: f.decimals, icon: f.icon ?? null, known: true } : i;
  };
  const sym = (c: string) => (c === '0x' ? 'BCH' : info(c).symbol);
  const reserveIsBch = reserve === '0x';

  // What the LP typed → V3 params (shared with the create flow)
  const built = useMemo(
    () => customPoolParams({ ownerPkh: wallet.pkh ? wallet.pkh : null, reserve, rows, recycle, feeBps, decimalsOf: c => info(c).decimals, symbolOf: sym }),
    [wallet.pkh, reserve, rows, recycle, feeBps, cats.join(',')], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const builtError = !wallet.pkh ? (wallet.unavailable ?? 'Connect a wallet') : built.error;

  const amount = useMemo(() => {
    try { return deposit ? toBaseUnits(deposit, reserveIsBch ? 8 : info(reserve).decimals) : 0n; } catch { return -1n; }
  }, [deposit, reserve]); // eslint-disable-line react-hooks/exhaustive-deps

  // covenant check with the server → review → sign → register (shared with the create flow)
  const deploy = useCustomPoolDeploy({
    wallet, balances: balances.data, params: built.params, paramsError: builtError, amount, reserveIsBch, reserve,
    reserveSymbol: sym(reserve), pairName: `${sym(reserve)} for ${rows.map(r => sym(r.cat)).join('/')}`,
    onDone: address => navigate(poolUrl(address)),
  });
  const { contract, preview, previewOk, validation, review, busy } = deploy;
  const err = deploy.error;
  const onReview = deploy.openReview;
  const onDeploy = deploy.confirm;
  const setReview = (_: null) => deploy.closeReview();

  const tokenButton = (cat: string, onClick: () => void) => (
    <button type="button" onClick={onClick} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 min-w-[130px]">
      {cat
        ? <span className="flex items-center gap-2 text-sm">{cat === '0x' ? <TokenAvatar info="BCH" size={20} /> : <TokenAvatar info={info(cat)} size={20} />}<span className="font-semibold text-white">{sym(cat)}</span></span>
        : <span className="text-sm text-zinc-400">Choose a token</span>}
      <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
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
              <button type="button" onClick={() => { setReserve('0x'); setRows(rs => rs.map(r => ({ ...r, cat: r.cat === '0x' ? '' : r.cat }))); }}
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
                    {tokenButton(r.cat, () => setPicker({ target: k }))}
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
              {[[false, 'To my wallet', 'Every fill pays you directly'], [true, 'Keep in Mesh', 'What the pool receives opens a pool that trades it back at your price']].map(([v, t, d]) => (
                <button key={String(v)} type="button" onClick={() => setRecycle(v as boolean)}
                  className={cn('p-3 rounded-2xl border text-left', recycle === v ? 'border-emerald-500/50 bg-emerald-500/[0.06]' : 'border-white/[0.08] hover:border-white/20')}>
                  <div className="text-sm font-bold text-white">{t as string}</div><div className="text-[11px] text-zinc-500 mt-0.5">{d as string}</div>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {FEE_TIERS.map(t => (
                <button key={t.bps} type="button" onClick={() => setFeeBps(t.bps)} title={t.name}
                  className={cn('px-3 py-1.5 rounded-xl text-xs font-mono font-semibold border', feeBps === t.bps ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' : 'border-white/10 text-zinc-400 hover:text-white')}>
                  {t.label}
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
            <div className="flex justify-between"><span>Proceeds</span><span className="text-zinc-200">{recycle ? 'kept in Mesh (trades back)' : 'your wallet'}</span></div>
            <div className="flex justify-between"><span>Pool address</span><span className="font-mono text-zinc-300">{contract ? shortHex(contract.address, 8, 6) : '—'}</span></div>
          </div>
          {built.params && (
            <div className={cn('flex items-center gap-2 text-[11px]', previewOk ? 'text-emerald-400' : 'text-zinc-500')}>
              {previewOk ? <ShieldCheck className="w-4 h-4" /> : preview.isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <TriangleAlert className="w-4 h-4" />}
              {previewOk ? 'Mesh computes the same pool address' : preview.isFetching ? 'Checking with Mesh…' : 'Address check pending'}
            </div>
          )}
          {(validation || err) && <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-200">{err ?? validation}</div>}
          <Button className="w-full h-11 rounded-xl font-bold" disabled={!!validation || !previewOk || !!busy} onClick={onReview}>
            {busy && !review ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />{busy}</> : <>Review pool</>}
          </Button>
        </Panel>
      </div>

      <Dialog open={!!review} onOpenChange={o => { if (!o && !busy) setReview(null); }}>
        <DialogContent className="max-w-md bg-[#0a0a0d] border border-neutral-800 rounded-3xl text-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Create pool</DialogTitle>
            <DialogDescription className="text-neutral-400 text-xs">One transaction funds the pool. Solvers can trade with it as soon as Mesh lists it.</DialogDescription>
          </DialogHeader>
          {review && (
            <div className="space-y-3 text-xs pt-1">
              <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-1.5">
                <div className="flex justify-between gap-3"><span className="text-neutral-400">Gives</span><span className="font-mono">{deposit} {sym(reserve)}</span></div>
                {rows.map((r, k) => {
                  const l = priceLabel(r);
                  return (
                    <div key={k} className="flex justify-between gap-3">
                      <span className="text-neutral-400">Accepts {sym(r.cat)}</span>
                      <span className="font-mono text-right">{l.main} {r.price} {l.unit}{recycle && l.back ? <><br /><span className="text-amber-300/80">{l.back} {r.back}</span></> : null}</span>
                    </div>
                  );
                })}
                <div className="flex justify-between gap-3"><span className="text-neutral-400">Fee</span><span className="font-mono">{(feeBps / 100).toFixed(2)}%</span></div>
                <div className="flex justify-between gap-3"><span className="text-neutral-400">Proceeds</span><span>{recycle ? 'Kept in Mesh' : 'To this wallet'}</span></div>
                <div className="flex justify-between gap-3"><span className="text-neutral-400">Network fee</span><span className="font-mono">{review.fee.toString()} sats (~{review.size} B)</span></div>
                <div className="flex justify-between gap-3"><span className="text-neutral-400">Pool address</span><span className="font-mono">{contract ? shortHex(contract.address, 8, 6) : '—'}</span></div>
                <div className="flex justify-between gap-3"><span className="text-neutral-400">Withdraw</span><span className="text-emerald-400">Any time, by this wallet only</span></div>
              </div>
              <Button className="w-full h-12 rounded-xl font-bold bg-emerald-500 hover:bg-emerald-400 text-black" disabled={!!busy} onClick={onDeploy}>
                {busy ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />{busy}</> : <><CheckCircle2 className="w-4 h-4 mr-2" />Sign and create</>}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
