/**
 * Create StrategyCovenantV2 pools: pick a token, a side (sell BCH, sell the
 * token, or both with a spread), a price and deposits. The client computes the
 * covenant, the server's preview must produce the same address, the wallet
 * funds it in one transaction and the pools are registered (verified on-chain).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight, CheckCircle2, ChevronDown, Info, Loader2, Lock, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { TokenSelectModal, CHIPNET_DEFAULT_TOKENS, type MeshToken } from '@/components/mesh/TokenSelectModal';
import {
  meshApi, useInvalidateMesh, useMarketRef, useMeshHealth, useMeshSigner, useMeshStats, useSignerBalances,
} from '@/hooks/useMesh';
import {
  artifactHash, buildPoolContract, minFunding, priceFromTokenPerBch, sideParams, tokenPerBchFromSatsPerUnit,
  traderTokenPerBch, type PoolParams, type PoolSide,
} from '@/lib/mesh/pool';
import { buildCreatePools, sendPoolTx, type BuiltTx } from '@/lib/mesh/poolTx';
import { MeshApiError, type RegisterItem } from '@/lib/mesh/meshApi';
import { addPending, removePending } from '@/lib/mesh/pendingRegistrations';
import { explorerTx, formatNumber, formatSatsCompact, formatUnits, parseUnits, shortHex } from '@/lib/mesh/format';
import { Panel, PoolPairLabel, TokenAvatar, poolUrl, useTokenInfo } from './shared';

type SideChoice = PoolSide | 'BOTH';
const FEE_TIERS = [5, 30, 50, 100];
const COMING_SOON = [
  { name: 'Oracle-tracking', text: 'Price follows a signed oracle feed' },
  { name: 'Dutch decay', text: 'Price moves toward a floor over time' },
  { name: 'Multi-pair', text: 'One reserve quoted against several tokens' },
];

function pctVs(a: number, b: number): number { return b > 0 ? (a / b - 1) * 100 : 0; }

/** Register with retries: the server may not see a fresh transaction for a few seconds. */
async function registerWithRetry(items: RegisterItem[], attempts = 8): Promise<Awaited<ReturnType<typeof meshApi.register>>> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await meshApi.register(items);
    } catch (e) {
      last = e;
      const retryable = e instanceof MeshApiError && (e.status === 404 || e.status === 0 || e.status >= 500);
      if (!retryable) throw e;
      await new Promise(r => setTimeout(r, 3_000));
    }
  }
  throw last;
}

export function CreatePoolForm({ initialToken }: { initialToken?: string }) {
  const navigate = useNavigate();
  const invalidate = useInvalidateMesh();
  const wallet = useMeshSigner();
  const health = useMeshHealth();
  const stats = useMeshStats();
  const balances = useSignerBalances(wallet.signer);

  const [token, setToken] = useState<MeshToken>(() => {
    const t = initialToken && CHIPNET_DEFAULT_TOKENS.find(x => x.categoryId === initialToken);
    return t || CHIPNET_DEFAULT_TOKENS[1]!;
  });
  const [tokenModal, setTokenModal] = useState(false);
  const [feeBps, setFeeBps] = useState(30);
  const [side, setSide] = useState<SideChoice>('BOTH');
  const [price, setPrice] = useState('');
  const [spreadPct, setSpreadPct] = useState('1');
  const [bchIn, setBchIn] = useState('');
  const [tokIn, setTokIn] = useState('');
  const [review, setReview] = useState<{ built: BuiltTx; pools: Array<{ params: PoolParams; sats: bigint; tokens: bigint }> } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const category = token.categoryId ?? '';
  const { get } = useTokenInfo([category]);
  const info = get(category);
  const decimals = info.known ? info.decimals : token.decimals;
  const tokenInfo = { ...info, decimals, symbol: info.known ? info.symbol : token.symbol, icon: info.icon ?? token.icon ?? null };

  const market = useMarketRef(category || undefined);
  const marketPrice = market.data?.cauldron ? tokenPerBchFromSatsPerUnit(market.data.cauldron.satsPerToken, decimals) : null;

  // Start from the market price when it arrives (or the token changes).
  useEffect(() => {
    if (marketPrice && !price) setPrice(marketPrice.toFixed(Math.min(4, Math.max(2, decimals))));
  }, [marketPrice, category]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pools implied by the form ──────────────────────────────────────────────
  const plan = useMemo(() => {
    if (!wallet.pkh || !category) return { pools: [] as Array<{ params: PoolParams; sats: bigint; tokens: bigint; lpPrice: number }>, error: null as string | null };
    try {
      const mid = Number(price);
      if (!(mid > 0)) return { pools: [], error: 'Enter a price' };
      const s = side === 'BOTH' ? Number(spreadPct) / 100 : 0;
      if (side === 'BOTH' && !(s >= 0 && s < 0.5)) return { pools: [], error: 'Spread must be between 0% and 50%' };
      const fmt = (v: number) => v.toFixed(Math.min(8, decimals + 4));
      const out: Array<{ params: PoolParams; sats: bigint; tokens: bigint; lpPrice: number }> = [];
      if (side === 'SELL_BCH' || side === 'BOTH') {
        const lpPrice = mid * (1 + s / 2); // LP asks more tokens per BCH it sells
        const params = sideParams('SELL_BCH', category, wallet.pkh, priceFromTokenPerBch(fmt(lpPrice), decimals, 'SELL_BCH'), feeBps);
        out.push({ params, sats: bchIn ? parseUnits(bchIn, 8) : 0n, tokens: 0n, lpPrice });
      }
      if (side === 'SELL_TOKEN' || side === 'BOTH') {
        const lpPrice = mid * (1 - s / 2); // LP gives fewer tokens per BCH it receives
        const params = sideParams('SELL_TOKEN', category, wallet.pkh, priceFromTokenPerBch(fmt(lpPrice), decimals, 'SELL_TOKEN'), feeBps);
        out.push({ params, sats: 1_000n, tokens: tokIn ? parseUnits(tokIn, decimals) : 0n, lpPrice });
      }
      return { pools: out, error: null };
    } catch (e: any) {
      return { pools: [], error: e?.message ?? String(e) };
    }
  }, [wallet.pkh, category, price, side, spreadPct, feeBps, bchIn, tokIn, decimals]);

  // Server preview for each pool: the address must match what this page computes.
  const previews = useQuery({
    queryKey: ['mesh', 'preview', plan.pools.map(p => p.params)],
    enabled: plan.pools.length > 0,
    queryFn: () => Promise.all(plan.pools.map(p => meshApi.preview(p.params))),
    staleTime: 60_000,
  });
  const clientAddresses = useMemo(() => {
    if (!wallet.signer) return [];
    try { return plan.pools.map(p => buildPoolContract(p.params, wallet.signer!.provider).address); } catch { return []; }
  }, [plan.pools, wallet.signer]);
  const previewOk = !!previews.data && previews.data.every((pv, i) => pv.address === clientAddresses[i] && pv.artifactHash === artifactHash());

  const networkMismatch = health.data && wallet.signer && health.data.network !== wallet.network;

  const validation = useMemo(() => {
    if (!wallet.signer) return wallet.unavailable ?? 'Connect a wallet';
    if (networkMismatch) return `The Mesh server runs on ${health.data!.network}; switch your wallet to ${health.data!.network}`;
    if (plan.error) return plan.error;
    for (const p of plan.pools) {
      const min = minFunding(p.params.tokenCategoryOut === '0x' ? 'SELL_BCH' : 'SELL_TOKEN');
      if (p.params.tokenCategoryOut === '0x' && p.sats < min.sats) return `Deposit more than ${formatUnits(1000n, 8)} BCH into the BCH side`;
      if (p.params.tokenCategoryOut !== '0x' && p.tokens < min.tokens) return `Deposit at least ${formatUnits(2n, decimals)} ${tokenInfo.symbol} into the token side`;
    }
    const b = balances.data;
    if (b) {
      const needSats = plan.pools.reduce((a, p) => a + p.sats, 0n);
      const needTok = plan.pools.reduce((a, p) => a + p.tokens, 0n);
      if (needTok > (b.tokens[category] ?? 0n)) return `Not enough ${tokenInfo.symbol} in the wallet`;
      if (needSats > b.sats) return 'Not enough BCH in the wallet';
    }
    return null;
  }, [wallet, networkMismatch, plan, balances.data, category, decimals, tokenInfo.symbol, health.data]);

  async function onReview() {
    setFormError(null);
    if (!wallet.signer || validation) return;
    setBusy('Building transaction…');
    try {
      const built = await buildCreatePools(wallet.signer, plan.pools);
      setReview({ built, pools: plan.pools });
    } catch (e: any) {
      setFormError(e?.message ?? String(e));
    } finally { setBusy(null); }
  }

  async function onConfirm() {
    if (!review || !wallet.signer) return;
    setBusy(wallet.kind === 'external' ? 'Approve the transaction in your wallet…' : 'Signing and broadcasting…');
    let txid: string | null = null;
    try {
      txid = await sendPoolTx(wallet.signer, review.built, `Create ${review.pools.length} Mesh pool${review.pools.length > 1 ? 's' : ''}`);
      const bundleId = review.pools.length > 1 ? `bundle-${txid.slice(0, 8)}` : undefined;
      const items: RegisterItem[] = review.pools.map((p, i) => ({
        ...p.params, txid: txid!, vout: i, bundleId,
        pairRole: review.pools.length > 1 ? (p.params.tokenCategoryOut === '0x' ? 'FORWARD' : 'REVERSE') : 'STANDALONE',
        pairName: `BCH/${tokenInfo.symbol}`,
      }));
      addPending({ txid, items, createdAt: Date.now() });
      setBusy('Registering with the Mesh server…');
      const res = await registerWithRetry(items);
      if (!res.success) throw new Error(res.error ?? 'registration failed');
      removePending(txid);
      invalidate();
      toast.success('Pool live', { description: `Funded and verified on-chain · ${shortHex(txid)}` });
      setReview(null);
      navigate(poolUrl(res.pools[0]!.address));
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      if (txid) {
        toast.error('Pool funded, registration pending', { description: `${msg}. Your funds are in the covenant; retry registration from the Pools page.`, duration: 12_000 });
      } else {
        toast.error('Transaction not sent', { description: msg });
      }
      setFormError(msg);
    } finally { setBusy(null); }
  }

  const bal = balances.data;
  const tokenBal = bal ? bal.tokens[category] ?? 0n : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div className="lg:col-span-7 space-y-6">
        <Panel title="1 · Pair and strategy">
          <button type="button" onClick={() => setTokenModal(true)}
            className="w-full flex items-center justify-between gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-colors">
            <PoolPairLabel token={tokenInfo} showSide={false} />
            <span className="flex items-center gap-1 text-xs text-zinc-400">Change token <ChevronDown className="w-3.5 h-3.5" /></span>
          </button>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/[0.06] space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">Fixed price</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">V2 · live</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">You set the price. Every fill is priced and paid by the covenant itself; only you can withdraw.</p>
            </div>
            {COMING_SOON.map(s => (
              <div key={s.name} className="p-4 rounded-2xl border border-white/[0.06] bg-white/[0.01] space-y-1 opacity-60 cursor-not-allowed">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-zinc-300">{s.name}</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-500/15 text-zinc-400 flex items-center gap-1"><Lock className="w-2.5 h-2.5" />Coming soon</span>
                </div>
                <p className="text-[11px] text-zinc-500">{s.text}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-zinc-400">Pool fee (earned by you on every fill)</div>
            <div className="flex flex-wrap gap-2">
              {FEE_TIERS.map(f => (
                <button key={f} type="button" onClick={() => setFeeBps(f)}
                  className={cn('px-3 py-1.5 rounded-xl text-xs font-mono font-semibold border transition-colors',
                    feeBps === f ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' : 'border-white/10 text-zinc-400 hover:text-white')}>
                  {(f / 100).toFixed(2)}%
                </button>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="2 · What the pool sells">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {([
              ['SELL_BCH', 'Sell BCH', `Buys ${tokenInfo.symbol} with your BCH`],
              ['SELL_TOKEN', `Sell ${tokenInfo.symbol}`, `Buys BCH with your ${tokenInfo.symbol}`],
              ['BOTH', 'Both sides', 'Two pools, bid and ask around one price'],
            ] as Array<[SideChoice, string, string]>).map(([v, t, d]) => (
              <button key={v} type="button" onClick={() => setSide(v)}
                className={cn('p-3 rounded-2xl border text-left transition-colors',
                  side === v ? 'border-emerald-500/50 bg-emerald-500/[0.06]' : 'border-white/[0.08] hover:border-white/20')}>
                <div className="text-sm font-bold text-white">{t}</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">{d}</div>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="3 · Price" action={
          <span className="text-[11px] text-zinc-500">
            {market.isLoading ? 'Loading market…' : marketPrice ? <>Cauldron: 1 BCH ≈ <span className="font-mono text-zinc-300">{formatNumber(marketPrice, 4)}</span> {tokenInfo.symbol}</> : 'No Cauldron market for this token'}
          </span>
        }>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-400">{side === 'BOTH' ? 'Mid price' : 'Your price'}: 1 BCH =</label>
            <div className="flex items-center gap-2">
              <Input value={price} onChange={e => setPrice(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal"
                className="font-mono text-lg h-12 bg-black/40 border-white/10" placeholder="0.00" />
              <span className="text-sm font-semibold text-zinc-300 shrink-0">{tokenInfo.symbol}</span>
            </div>
            {marketPrice && (
              <div className="flex flex-wrap gap-2">
                {[-2, -1, 0, 1, 2].map(d => (
                  <button key={d} type="button" onClick={() => setPrice((marketPrice * (1 + d / 100)).toFixed(Math.min(4, Math.max(2, decimals))))}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-mono border border-white/10 text-zinc-400 hover:text-white">
                    {d === 0 ? 'Market' : `${d > 0 ? '+' : ''}${d}%`}
                  </button>
                ))}
              </div>
            )}
          </div>
          {side === 'BOTH' && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-400">Spread between the two sides</label>
              <div className="flex items-center gap-2">
                <Input value={spreadPct} onChange={e => setSpreadPct(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal"
                  className="font-mono w-28 bg-black/40 border-white/10" />
                <span className="text-sm text-zinc-400">%</span>
                {['0.5', '1', '2'].map(s => (
                  <button key={s} type="button" onClick={() => setSpreadPct(s)} className="px-2.5 py-1 rounded-lg text-[11px] font-mono border border-white/10 text-zinc-400 hover:text-white">{s}%</button>
                ))}
              </div>
            </div>
          )}
          {plan.pools.length > 0 && (
            <div className="space-y-2">
              {plan.pools.map((p, i) => {
                const trader = traderTokenPerBch(p.params, decimals);
                const vs = marketPrice ? pctVs(trader, marketPrice) : null;
                const sellBch = p.params.tokenCategoryOut === '0x';
                // selling BCH: trader pays tokens (more = worse for them); selling tokens: trader receives tokens (more = better)
                const better = vs === null ? null : sellBch ? vs < 0 : vs > 0;
                return (
                  <div key={i} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs flex flex-wrap items-center justify-between gap-2">
                    <span className={sellBch ? 'text-emerald-400 font-semibold' : 'text-cyan-400 font-semibold'}>{sellBch ? 'Sell-BCH pool' : `Sell-${tokenInfo.symbol} pool`}</span>
                    <span className="text-zinc-400">
                      Trader {sellBch ? 'pays' : 'gets'} <span className="font-mono text-zinc-200">{formatNumber(trader, 4)}</span> {tokenInfo.symbol} per BCH
                      {vs !== null && <span className={cn('ml-1.5', better ? 'text-emerald-400' : 'text-amber-400')}>({vs >= 0 ? '+' : ''}{vs.toFixed(2)}% vs Cauldron)</span>}
                    </span>
                  </div>
                );
              })}
              <p className="text-[11px] text-zinc-500 flex gap-1.5"><Info className="w-3.5 h-3.5 shrink-0 mt-px" />
                Prices include your {(feeBps / 100).toFixed(2)}% fee. A pool fills when an order's minimum is met at its price; prices better for traders than Cauldron fill first.
              </p>
            </div>
          )}
        </Panel>

        <Panel title="4 · Deposit">
          {(side === 'SELL_BCH' || side === 'BOTH') && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs"><span className="font-semibold text-zinc-400">BCH for the sell-BCH pool</span>
                <button type="button" className="text-zinc-500 hover:text-zinc-300 font-mono" disabled={!bal}
                  onClick={() => bal && setBchIn(formatUnits(bal.sats > 20_000n ? bal.sats - 20_000n : 0n, 8).replace(/,/g, ''))}>
                  Wallet: {bal ? formatSatsCompact(bal.sats) : '—'}
                </button></div>
              <div className="flex items-center gap-2">
                <Input value={bchIn} onChange={e => setBchIn(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0.0" className="font-mono bg-black/40 border-white/10" />
                <TokenAvatar info="BCH" size={22} /><span className="text-sm text-zinc-300">BCH</span>
              </div>
            </div>
          )}
          {(side === 'SELL_TOKEN' || side === 'BOTH') && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs"><span className="font-semibold text-zinc-400">{tokenInfo.symbol} for the sell-{tokenInfo.symbol} pool</span>
                <button type="button" className="text-zinc-500 hover:text-zinc-300 font-mono" disabled={tokenBal === null}
                  onClick={() => tokenBal !== null && setTokIn(formatUnits(tokenBal, decimals).replace(/,/g, ''))}>
                  Wallet: {tokenBal !== null ? `${formatUnits(tokenBal, decimals)} ${tokenInfo.symbol}` : '—'}
                </button></div>
              <div className="flex items-center gap-2">
                <Input value={tokIn} onChange={e => setTokIn(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0.0" className="font-mono bg-black/40 border-white/10" />
                <TokenAvatar info={tokenInfo} size={22} /><span className="text-sm text-zinc-300">{tokenInfo.symbol}</span>
              </div>
              <p className="text-[11px] text-zinc-500">Plus 1,000 sats that carry the tokens. One {tokenInfo.symbol} base unit always stays in the pool.</p>
            </div>
          )}
        </Panel>
      </div>

      <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-20">
        <Panel title="Summary">
          <div className="text-xs text-zinc-400 space-y-1">
            <div className="flex justify-between"><span>Wallet</span><span className="font-mono text-zinc-300">{wallet.address ? shortHex(wallet.address, 8, 6) : '—'} · {wallet.label}</span></div>
            <div className="flex justify-between"><span>Network</span><span className="text-zinc-300">{wallet.network}{health.data ? ` (server: ${health.data.network})` : ''}</span></div>
            <div className="flex justify-between"><span>Fee tier</span><span className="font-mono text-zinc-300">{(feeBps / 100).toFixed(2)}%</span></div>
          </div>
          {plan.pools.map((p, i) => (
            <div key={i} className="p-3 rounded-xl bg-black/30 border border-white/[0.06] space-y-1 text-xs">
              <div className="flex justify-between"><span className="font-semibold text-white">{p.params.tokenCategoryOut === '0x' ? 'Sell-BCH pool' : `Sell-${tokenInfo.symbol} pool`}</span>
                <span className="font-mono text-zinc-300">{p.params.tokenCategoryOut === '0x' ? formatSatsCompact(p.sats) : `${formatUnits(p.tokens, decimals)} ${tokenInfo.symbol}`}</span></div>
              <div className="flex justify-between text-zinc-500"><span>Covenant</span><span className="font-mono">{clientAddresses[i] ? shortHex(clientAddresses[i]!, 8, 6) : '—'}</span></div>
            </div>
          ))}
          {plan.pools.length > 0 && (
            <div className={cn('flex items-center gap-2 text-[11px]', previewOk ? 'text-emerald-400' : previews.isError ? 'text-amber-400' : 'text-zinc-500')}>
              {previewOk ? <ShieldCheck className="w-4 h-4" /> : previews.isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <TriangleAlert className="w-4 h-4" />}
              {previewOk ? 'Server computes the same covenant address' : previews.isError ? `Server preview failed: ${(previews.error as Error).message}` : previews.isFetching ? 'Checking with the server…' : 'Address check pending'}
            </div>
          )}
          {(validation || formError) && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-200">{formError ?? validation}</div>
          )}
          <Button className="w-full h-11 rounded-xl font-bold" disabled={!!validation || !previewOk || !!busy} onClick={onReview}>
            {busy && !review ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />{busy}</> : <>Review <ArrowRight className="w-4 h-4 ml-1.5" /></>}
          </Button>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            Funds go to a StrategyCovenantV2 address derived from your key. The server never holds them; it only indexes the pool so solvers can route orders to it.
          </p>
        </Panel>
      </div>

      <TokenSelectModal open={tokenModal} onOpenChange={setTokenModal} selectedToken={token} title="Pool token"
        onSelect={(t) => { if (!t.isNativeBch && t.categoryId) { setToken(t); setPrice(''); setTokIn(''); } setTokenModal(false); }} />

      <Dialog open={!!review} onOpenChange={(o) => { if (!o && !busy) setReview(null); }}>
        <DialogContent className="max-w-md bg-[#0c0c10] border border-white/10 rounded-3xl text-white">
          <DialogHeader>
            <DialogTitle>Create {review?.pools.length === 2 ? 'two pools' : 'pool'}</DialogTitle>
            <DialogDescription className="text-zinc-400">One transaction funds {review?.pools.length === 2 ? 'both covenants' : 'the covenant'}; the server then verifies it on-chain.</DialogDescription>
          </DialogHeader>
          {review && (
            <div className="space-y-2 text-xs">
              {review.pools.map((p, i) => (
                <div key={i} className="flex justify-between p-2.5 rounded-lg bg-white/[0.03]">
                  <span>Output {i} · {p.params.tokenCategoryOut === '0x' ? 'sell-BCH pool' : `sell-${tokenInfo.symbol} pool`}</span>
                  <span className="font-mono">{p.params.tokenCategoryOut === '0x' ? formatSatsCompact(p.sats) : `${formatUnits(p.tokens, decimals)} ${tokenInfo.symbol}`}</span>
                </div>
              ))}
              <div className="flex justify-between px-2.5 text-zinc-400"><span>Network fee</span><span className="font-mono">{review.built.fee.toString()} sats ({review.built.size} B)</span></div>
              <Button className="w-full h-11 rounded-xl font-bold mt-2" disabled={!!busy} onClick={onConfirm}>
                {busy ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />{busy}</> : <><CheckCircle2 className="w-4 h-4 mr-2" />Sign and create</>}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Link helper for an explorer transaction, used in toasts / banners. */
export function TxLink({ network, txid }: { network: 'chipnet' | 'mainnet'; txid: string }) {
  return <a href={explorerTx(network, txid)} target="_blank" rel="noreferrer" className="font-mono underline">{shortHex(txid)}</a>;
}
