/**
 * Mesh Finance — Strategy Studio & Configuration Engine
 *
 * Build and deploy a strategy (a template of MeshPoolV3 covenant pools):
 *   form → server preview → every pool recomputed and checked locally (address
 *   and owner) → one transaction funds every pool → the server registers the
 *   strategy from that transaction → strategy dashboard.
 *
 * With `replaces`, the same form rebalances an existing strategy: one
 * transaction docks all of its pools and funds the new set (the wallet adds
 * any shortfall and the fee); the new strategy is registered as its successor.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Info,
  Loader2,
  ShieldCheck,
  TriangleAlert,
  Repeat,
  Wallet,
  Sparkles,
  SlidersHorizontal,
  Flame,
  Scale,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  TokenSelectModal,
  CHIPNET_DEFAULT_TOKENS,
  type MeshToken,
} from '@/components/mesh/TokenSelectModal';
import {
  meshApi,
  useInvalidateMesh,
  useMarketRef,
  useMeshHealth,
  useMeshSigner,
  useSignerBalances,
  useStrategy,
  useStrategySuggest,
  useStrategyTemplates,
} from '@/hooks/useMesh';
import {
  formFor,
  fromServerParams,
  toServerParams,
  type FieldSpec,
} from '@/lib/mesh/v3/strategyForms';
import { pusdCategory } from '@/lib/pusd';
import { MarketStrip, RecyclePill, VsMid, TemplateIcon } from '@/components/mesh/ui/defi';
import { v3ContractFor } from '@/lib/mesh/v3/v3Pool';
import { poolLevels } from '@/lib/mesh/v3/v3Display';
import {
  buildDeployV3,
  buildRebalanceV3,
  type ClosePool,
  type V3Deposit,
} from '@/lib/mesh/v3/v3Tx';
import { sendPoolTx, type BuiltTx } from '@/lib/mesh/poolTx';
import type { StrategyInput, StrategyPreview } from '@/lib/mesh/meshApi';
import {
  addPending,
  registerWithRetry,
  removePending,
} from '@/lib/mesh/pendingRegistrations';
import {
  formatNumber,
  formatSatsCompact,
  formatUnits,
  shortHex,
} from '@/lib/mesh/format';
import { tokenPerBchFromSatsPerUnit } from '@/lib/mesh/pool';
import { Panel, TokenAvatar, useTokenInfo, type TokenInfo } from '@/components/mesh/pools/shared';
import { PriceLadder } from './PriceLadder';
import { RangeDistribution } from './RangeDistribution';

const FEE_TIERS = [
  { bps: 5, label: '0.05%', name: 'Peg / Stables', desc: 'Ultra-low fee for correlated or pegged assets' },
  { bps: 30, label: '0.30%', name: 'Standard', desc: 'Optimal for major pairs like BCH/pUSD' },
  { bps: 50, label: '0.50%', name: 'Volatile', desc: 'Compensates for rapid directional price swings' },
  { bps: 100, label: '1.00%', name: 'Exotic', desc: 'High fee capture on low-liquidity CashTokens' },
];

const RANGE_PRESETS = [
  { id: 'tight', label: 'Tight', pct: 1.5, icon: Zap, desc: '±1.5% · Maximum fee velocity' },
  { id: 'balanced', label: 'Balanced', pct: 5.0, icon: Scale, desc: '±5.0% · Recommended standard' },
  { id: 'wide', label: 'Wide', pct: 15.0, icon: Flame, desc: '±15.0% · Low maintenance' },
  { id: 'custom', label: 'Custom', pct: null, icon: SlidersHorizontal, desc: 'Granular input' },
];

const PUSD = CHIPNET_DEFAULT_TOKENS[1]!.categoryId!;
const MUSD = CHIPNET_DEFAULT_TOKENS[2]!.categoryId!;

import { strategyUrl } from './StrategyCard';
export { strategyUrl };

/** Form defaults: pUSD of the wallet's network as the main token (MUSD as the second one on chipnet). */
function defaults(fields: FieldSpec[], network: string): Record<string, string> {
  const v: Record<string, string> = {};
  const main = network === 'mainnet' ? pusdCategory(true) : PUSD;
  for (const f of fields) {
    if (f.default !== undefined) v[f.key] = f.default;
    if (f.kind === 'token' && !f.optional) {
      v[f.key] = /2|B$/.test(f.key) ? (network === 'mainnet' ? '' : MUSD) : main;
    }
  }
  return v;
}

/** The /suggest query for a template's current tokens. */
function suggestQuery(templateId: string, v: Record<string, string>) {
  if (templateId === 'multi-pair') {
    return { template: templateId, tokens: [v.token1, v.token2, v.token3].filter(Boolean) as string[] };
  }
  if (templateId === 'stable-pair') {
    return { template: templateId, tokenA: v.tokenA, tokenB: v.tokenB };
  }
  return { template: templateId, token: v.token };
}

function useDebounced<T>(value: T, ms = 400): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function StrategyBuilder({
  templateId,
  onBack,
  replaces,
}: {
  templateId: string;
  onBack: () => void;
  replaces?: string;
}) {
  const navigate = useNavigate();
  const invalidate = useInvalidateMesh();
  const wallet = useMeshSigner();
  const health = useMeshHealth();
  const balances = useSignerBalances(wallet.signer);
  const templates = useStrategyTemplates();
  const form = formFor(templateId);
  const meta = templates.data?.templates.find(t => t.id === templateId);

  const [values, setValues] = useState<Record<string, string>>(() =>
    defaults(form?.fields ?? [], wallet.network)
  );
  const [tokenModal, setTokenModal] = useState<string | null>(null);
  const [review, setReview] = useState<{
    built: BuiltTx;
    input: StrategyInput;
    preview: StrategyPreview;
  } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<string>('custom');
  /** The LP saw the through-market warnings and wants to deploy anyway. */
  const [acceptCross, setAcceptCross] = useState(false);

  const set = (k: string, v: string) => setValues(prev => ({ ...prev, [k]: v }));

  const tokenCats = useMemo(
    () =>
      (form?.fields ?? [])
        .filter(f => f.kind === 'token')
        .map(f => values[f.key])
        .filter(Boolean) as string[],
    [form, values]
  );
  const { get } = useTokenInfo(tokenCats);
  const fallback = (cat: string) => CHIPNET_DEFAULT_TOKENS.find(t => t.categoryId === cat);
  const infoOf = (cat: string): TokenInfo => {
    const i = get(cat);
    const f = fallback(cat);
    return i.known
      ? i
      : f
      ? { ...i, symbol: f.symbol, decimals: f.decimals, icon: f.icon ?? null, known: true }
      : i;
  };
  const mainToken = values.token ?? values.token1 ?? values.tokenA ?? '';
  const main = infoOf(mainToken);
  const market = useMarketRef(mainToken || undefined);

  // Market mid per token from /suggest (Cauldron, else Mesh); Cauldron ref as fallback
  const suggest = useStrategySuggest(form ? suggestQuery(templateId, values) : null);
  const ctxOf = (cat: string) => suggest.data?.market?.[cat] ?? null;
  const midOf = (cat: string): number | null =>
    ctxOf(cat)?.midSatsPerToken ??
    (cat === mainToken && market.data?.cauldron
      ? Number(market.data.cauldron.satsPerToken)
      : null);
  const mainMid = midOf(mainToken);
  const marketPrice = mainMid
    ? Number(tokenPerBchFromSatsPerUnit(String(mainMid), main.decimals))
    : null;

  const applySuggestion = (onlyEmpty: boolean) => {
    const p = suggest.data?.params;
    if (!p) return;
    const next = fromServerParams(templateId, p, c => infoOf(c).decimals, values);
    setValues(prev => {
      const merged = { ...prev };
      for (const [k, v] of Object.entries(next)) {
        if (!onlyEmpty || !prev[k]) merged[k] = v;
      }
      return merged;
    });
  };

  // Fill empty prices from the market once suggestion arrives
  useEffect(() => {
    applySuggestion(true);
  }, [suggest.data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply Range Preset (Tight, Balanced, Wide)
  const applyPreset = (presetId: string, pct: number | null) => {
    setActivePreset(presetId);
    if (!pct || !marketPrice) return;

    const round = (n: number) => (n >= 1000 ? n.toFixed(2) : n >= 1 ? n.toFixed(4) : n.toFixed(6));

    if (templateId === 'spread' || templateId === 'recycling-pair') {
      const buyKey = templateId === 'spread' ? 'bid' : 'buy';
      const sellKey = templateId === 'spread' ? 'ask' : 'sell';
      // Buy: more tokens per BCH (cheaper token)
      set(buyKey, round(marketPrice * (1 + pct / 100)));
      // Sell: fewer tokens per BCH (expensive token)
      set(sellKey, round(marketPrice * (1 - pct / 100)));
    } else if (templateId === 'grid' || templateId === 'range') {
      set('low', round(marketPrice * (1 + pct / 100)));
      set('high', round(marketPrice * (1 - pct / 100)));
      // pools past the market price start on the token side
      set('center', round(marketPrice));
    } else if (templateId === 'take-profit') {
      set('from', round(marketPrice * 0.99));
      set('to', round(marketPrice * (1 - pct / 100)));
    } else if (templateId === 'accumulate') {
      set('from', round(marketPrice * 1.01));
      set('to', round(marketPrice * (1 + pct / 100)));
    }
  };

  // Rebalancing: the strategy being replaced, so its holdings can fund the new set
  const current = useStrategy(replaces);
  /** Fill the deposits with what the position holds, less the new token pools' carriers and a fee margin. */
  const applyHoldings = () => {
    const inv = current.data?.strategy.inventory;
    if (!inv) return;
    const tokenPools = (preview.data?.pools ?? []).filter(p => p.deposit.token).length || 1;
    const sats = BigInt(inv.sats) - BigInt(tokenPools) * 1000n - 3000n;
    const toks = mainToken ? inv.tokens[mainToken] : undefined;
    setValues(prev => ({
      ...prev,
      ...(form?.fields.some(f => f.key === 'depositBch') && sats > 0n ? { depositBch: formatUnits(sats.toString(), 8).replace(/,/g, '') } : {}),
      ...(form?.fields.some(f => f.key === 'depositTokens') && toks ? { depositTokens: formatUnits(toks, main.decimals).replace(/,/g, '') } : {}),
    }));
  };

  // Form → server params (exact unit conversion)
  const input = useMemo((): { input?: StrategyInput; error?: string } => {
    if (!form) return { error: `Unknown template ${templateId}` };
    if (!wallet.pkh) return { error: wallet.unavailable ?? 'Connect a wallet' };
    try {
      return {
        input: {
          template: templateId,
          ownerPkh: wallet.pkh,
          params: toServerParams(templateId, values, c => infoOf(c).decimals),
        },
      };
    } catch (e: any) {
      return { error: e?.message ?? String(e) };
    }
  }, [form, templateId, wallet.pkh, values, tokenCats.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const debounced = useDebounced(input.input);

  const preview = useQuery({
    queryKey: ['mesh', 'strategy-preview', debounced],
    enabled: !!debounced,
    queryFn: () => meshApi.previewStrategy(debounced!),
    retry: false,
  });

  // An override applies to the warnings the LP saw: new warnings need a new tick
  const warningKey = preview.data?.warnings?.join('|') ?? '';
  useEffect(() => { setAcceptCross(false); }, [warningKey]);

  // Every pool recomputed locally: address must match, owner must be this wallet
  const verified = useMemo(() => {
    if (!preview.data || !wallet.signer || !wallet.pkh) return null;
    try {
      const deposits: V3Deposit[] = preview.data.pools.map(p => {
        const { params } = v3ContractFor(p.v3, p.address, wallet.signer!.provider);
        if (params.ownerPkh !== wallet.pkh) {
          throw new Error(`pool ${p.role} is not owned by this wallet`);
        }
        return {
          params,
          sats: BigInt(p.deposit.sats),
          tokens: BigInt(p.deposit.token?.amount ?? '0'),
        };
      });
      return { ok: true as const, deposits };
    } catch (e: any) {
      return { ok: false as const, error: e?.message ?? String(e) };
    }
  }, [preview.data, wallet.signer, wallet.pkh]);

  const levels = useMemo(
    () =>
      (preview.data?.pools ?? [])
        .flatMap(p => poolLevels(p.address, p.v3, c => infoOf(c).decimals, p.role))
        .filter(l => l.token === mainToken),
    [preview.data, mainToken]
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const networkMismatch =
    health.data && wallet.signer && health.data.network !== wallet.network;
  const validation = useMemo(() => {
    if (!wallet.signer) return wallet.unavailable ?? 'Connect a wallet';
    if (networkMismatch)
      return `The Mesh server runs on ${health.data!.network}; switch your wallet to ${health.data!.network}`;
    if (input.error) return input.error;
    if (preview.isError) return (preview.error as Error).message;
    if (verified && !verified.ok) return `Refusing to deploy: ${verified.error}`;
    if (preview.data?.warnings?.length && !acceptCross) {
      return 'Some pools are priced through the market and would be taken by arbitrage as soon as they are funded. Change the prices, or tick “Deploy anyway” below.';
    }
    const t = preview.data?.totals;
    const b = balances.data;
    if (t && b && !replaces) {
      if (BigInt(t.sats) > b.sats) return 'Not enough BCH in the wallet';
      for (const [cat, amt] of Object.entries(t.tokens)) {
        if (BigInt(amt) > (b.tokens[cat] ?? 0n)) {
          return `Not enough ${infoOf(cat).symbol} in the wallet`;
        }
      }
    }
    return null;
  }, [wallet, networkMismatch, input, preview.isError, preview.error, preview.data, verified, balances.data, health.data, acceptCross]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Live UTXOs of the strategy being replaced */
  async function closeCurrent(id: string): Promise<ClosePool[]> {
    const cur = await meshApi.strategy(id);
    if (cur.strategy.ownerPkh !== wallet.pkh) {
      throw new Error('You do not own the strategy being rebalanced');
    }
    const out: ClosePool[] = [];
    for (const p of cur.pools) {
      if (!p.v3) continue;
      const utxos = await wallet.signer!.provider.getUtxos(p.address);
      if (utxos.length) {
        out.push({
          contract: v3ContractFor(p.v3, p.address, wallet.signer!.provider).contract,
          utxos,
        });
      }
    }
    return out;
  }

  async function onReview() {
    setFormError(null);
    if (!wallet.signer || !verified?.ok || !input.input || !preview.data) return;
    setBusy('Building transaction…');
    try {
      const built = replaces
        ? await buildRebalanceV3(
            wallet.signer,
            await closeCurrent(replaces),
            verified.deposits
          )
        : await buildDeployV3(wallet.signer, verified.deposits);
      setReview({ built, input: input.input, preview: preview.data });
    } catch (e: any) {
      setFormError(e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  async function onConfirm() {
    if (!review || !wallet.signer) return;
    setBusy(
      wallet.kind === 'external'
        ? 'Approve the transaction in your wallet…'
        : 'Signing and broadcasting…'
    );
    let txid: string | null = null;
    try {
      txid = await sendPoolTx(
        wallet.signer,
        review.built,
        `${replaces ? 'Rebalance into' : 'Deploy'} ${meta?.name ?? templateId} (${review.preview.pools.length} Mesh pool${review.preview.pools.length > 1 ? 's' : ''})`
      );
      addPending({
        txid,
        strategy: { ...review.input, replaces },
        createdAt: Date.now(),
      });
      setBusy('Registering with Mesh Finance…');
      const r = await registerWithRetry(() =>
        meshApi.registerStrategy({ ...review.input, txid: txid!, replaces })
      );
      if (replaces) {
        const old = await meshApi.strategy(replaces).catch(() => null);
        for (const p of old?.pools ?? []) await meshApi.sync(p.address).catch(() => undefined);
      }
      removePending(txid);
      invalidate();
      toast.success('Strategy live on Mesh Finance', {
        description: `${review.preview.pools.length} covenant pool(s) verified on-chain · ${shortHex(txid)}`,
      });
      setReview(null);
      navigate(strategyUrl(r.strategy.id));
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      toast.error(txid ? 'Funded, registration pending' : 'Transaction not sent', {
        description: txid
          ? `${msg}. Your funds are in the pools; retry from My positions.`
          : msg,
        duration: 12_000,
      });
      setFormError(msg);
    } finally {
      setBusy(null);
    }
  }

  // Quick balance setter
  const setBalanceFraction = (key: string, fraction: number, isBch: boolean, tokenCat?: string) => {
    const bal = balances.data;
    if (!bal) return;
    if (isBch) {
      // Leave 5000 sats for carrier/gas
      const availableSats = Math.max(0, Number(bal.sats) - 5000);
      const targetBch = (availableSats * fraction) / 1e8;
      set(key, targetBch > 0 ? targetBch.toFixed(6) : '0');
    } else if (tokenCat) {
      const dec = infoOf(tokenCat).decimals;
      const tBal = bal.tokens[tokenCat] ?? 0n;
      const target = (Number(tBal) * fraction) / 10 ** dec;
      set(key, target > 0 ? target.toFixed(dec > 4 ? 4 : dec) : '0');
    }
  };

  if (!form) {
    return (
      <Panel>
        <p className="text-sm text-neutral-400">Unknown strategy template.</p>
      </Panel>
    );
  }

  const isRangeTemplate = ['spread', 'recycling-pair', 'grid', 'range', 'take-profit', 'accumulate'].includes(
    templateId
  );

  const field = (f: FieldSpec) => {
    const v = values[f.key] ?? '';
    const tokenOf = f.token ? infoOf(values[f.token] ?? '') : null;

    // Token Selector
    if (f.kind === 'token') {
      const i = v ? infoOf(v) : null;
      return (
        <button
          type="button"
          onClick={() => setTokenModal(f.key)}
          className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-neutral-900/80 border border-neutral-700/80 hover:border-neutral-500 transition-colors shadow-xs"
        >
          <span className="flex items-center gap-2.5 text-sm">
            {i ? (
              <>
                <TokenAvatar info={i} size={22} />
                <span className="font-semibold text-white">{i.symbol}</span>
                <span className="font-mono text-[10px] text-neutral-500 bg-neutral-800 px-1.5 py-0.5 rounded">
                  {shortHex(v, 6, 4)}
                </span>
              </>
            ) : (
              <span className="text-neutral-500">Choose a CashToken</span>
            )}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-neutral-400">
            {v && f.optional ? (
              <span
                onClick={e => {
                  e.stopPropagation();
                  set(f.key, '');
                }}
                className="hover:text-white px-1"
              >
                clear
              </span>
            ) : null}
            <ChevronDown className="w-4 h-4 text-neutral-500" />
          </span>
        </button>
      );
    }

    // Proceeds Mode (Recycle vs Wallet) or Choice
    if (f.kind === 'choice') {
      if (f.key === 'proceeds') {
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {f.choices!.map(c => {
              const isRecycle = c.value === 'recycle';
              const isSelected = v === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => set(f.key, c.value)}
                  className={cn(
                    'p-3 rounded-xl border text-left transition-all relative overflow-hidden',
                    isSelected
                      ? 'border-emerald-500/60 bg-emerald-950/20 shadow-xs'
                      : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700'
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span
                      className={cn(
                        'text-xs font-bold flex items-center gap-1.5',
                        isSelected ? 'text-white' : 'text-neutral-300'
                      )}
                    >
                      {isRecycle ? <Repeat className="w-3.5 h-3.5 text-emerald-400" /> : <Wallet className="w-3.5 h-3.5 text-neutral-400" />}
                      {c.label}
                    </span>
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    )}
                  </div>
                  <p className="text-[10px] text-neutral-400 leading-normal">
                    {isRecycle
                      ? 'Fills automatically fund the reverse mirror pool (Autonomous LP compounding).'
                      : 'Fills sweep directly into your CashAddress wallet.'}
                  </p>
                </button>
              );
            })}
          </div>
        );
      }

      return (
        <div className="grid grid-cols-2 gap-2">
          {f.choices!.map(c => (
            <button
              key={c.value}
              type="button"
              onClick={() => set(f.key, c.value)}
              className={cn(
                'p-2.5 rounded-xl border text-left text-xs font-semibold transition-colors',
                v === c.value
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-white'
                  : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700'
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      );
    }

    // Fee Tier Selector Chips
    if (f.key === 'feeBps') {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {FEE_TIERS.map(t => {
            const isSelected = v === String(t.bps);
            return (
              <button
                key={t.bps}
                type="button"
                onClick={() => set('feeBps', String(t.bps))}
                className={cn(
                  'p-2.5 rounded-xl text-left border transition-all',
                  isSelected
                    ? 'border-emerald-500/60 bg-emerald-950/30 text-white shadow-xs'
                    : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-emerald-400">{t.label}</span>
                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                </div>
                <div className="text-[10px] font-medium text-neutral-300 mt-0.5">{t.name}</div>
              </button>
            );
          })}
        </div>
      );
    }

    // Number / Price / Amount Inputs
    const suffix =
      f.kind === 'price'
        ? tokenOf?.symbol
        : f.kind === 'bch'
        ? 'BCH'
        : f.kind === 'tokenAmount'
        ? tokenOf?.symbol
        : f.kind === 'bps'
        ? 'bps'
        : f.kind === 'rate'
        ? 'B'
        : '';
    const fieldMid = f.kind === 'price' && tokenOf?.category ? midOf(tokenOf.category) : null;
    const fieldMarket = fieldMid && tokenOf ? 1e8 / (fieldMid * 10 ** tokenOf.decimals) : null;
    const priceSats =
      Number(v) > 0 && tokenOf ? 1e8 / (Number(v) * 10 ** tokenOf.decimals) : null;
    const vsMidBps =
      fieldMid && priceSats ? Math.round((priceSats / fieldMid - 1) * 10_000) : null;
    const bal = balances.data;

    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          {f.kind === 'price' && (
            <span className="text-xs font-mono text-neutral-500 shrink-0">1 BCH =</span>
          )}
          <Input
            value={v}
            inputMode="decimal"
            placeholder={f.kind === 'count' ? String(f.min ?? '') : '0.0'}
            onChange={e => set(f.key, e.target.value.replace(/[^0-9.]/g, ''))}
            className="font-mono bg-black/60 border-neutral-700/80 focus-visible:border-emerald-500/80 text-white"
          />
          {suffix && (
            <span className="text-xs font-mono font-semibold text-neutral-300 shrink-0 px-1">
              {suffix}
            </span>
          )}
        </div>

        {/* Quick Percent Adjusters for Price */}
        {f.kind === 'price' && fieldMarket && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {[-5, -2, -1, 0, 1, 2, 5].map(d => (
              <button
                key={d}
                type="button"
                onClick={() =>
                  set(
                    f.key,
                    (fieldMarket / (1 + d / 100)).toFixed(fieldMarket >= 1000 ? 2 : 4)
                  )
                }
                className="px-1.5 py-0.5 rounded text-[10px] font-mono border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white hover:border-neutral-600 transition-colors"
              >
                {d === 0 ? 'Mid' : `${d > 0 ? '+' : ''}${d}%`}
              </button>
            ))}
            {v && fieldMid && <VsMid bps={vsMidBps} />}
          </div>
        )}

        {/* Balance Fractions for Deposit */}
        {(f.kind === 'bch' || f.kind === 'tokenAmount') && bal && (
          <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500 pt-0.5">
            <span>
              Available:{' '}
              <span className="text-neutral-300">
                {f.kind === 'bch'
                  ? formatSatsCompact(bal.sats)
                  : tokenOf
                  ? `${formatUnits(bal.tokens[tokenOf.category] ?? 0n, tokenOf.decimals)} ${tokenOf.symbol}`
                  : '—'}
              </span>
            </span>
            <div className="flex items-center gap-1">
              {[0.25, 0.5, 0.75, 1.0].map(frac => (
                <button
                  key={frac}
                  type="button"
                  onClick={() =>
                    setBalanceFraction(
                      f.key,
                      frac,
                      f.kind === 'bch',
                      tokenOf?.category
                    )
                  }
                  className="px-1.5 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white"
                >
                  {frac === 1 ? 'MAX' : `${frac * 100}%`}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Strategy Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> All Strategies
        </button>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-neutral-700 text-neutral-400">
            Mesh Finance V3
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
            Sovereign Covenant
          </span>
        </div>
      </div>

      <div className="flex items-start gap-4">
        <TemplateIcon id={templateId} className="w-12 h-12" />
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {replaces ? 'Rebalance into: ' : ''}
            {meta?.name ?? templateId}
          </h1>
          {replaces && (
            <p className="text-[11px] text-amber-300/90 mt-1">
              One atomic transaction closes every pool of the current strategy and funds this new set.
            </p>
          )}
          <p className="text-xs text-neutral-400 mt-1">{meta?.summary ?? form.earns}</p>
        </div>
      </div>

      {/* Range Presets Selector (for range strategies) */}
      {isRangeTemplate && marketPrice && (
        <div className="p-3.5 rounded-2xl bg-neutral-900/70 border border-neutral-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Range & Volatility Presets
            </span>
            <span className="font-mono text-[10px] text-neutral-400">
              Market Mid: 1 BCH ≈{' '}
              <span className="text-sky-300 font-bold">{formatNumber(marketPrice, 2)}</span> {main.symbol}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {RANGE_PRESETS.map(p => {
              const isSelected = activePreset === p.id;
              const Icon = p.icon;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id, p.pct)}
                  className={cn(
                    'p-2 rounded-xl border text-left transition-all',
                    isSelected
                      ? 'border-emerald-500/60 bg-emerald-950/30 text-white ring-1 ring-emerald-500/30'
                      : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:border-neutral-700'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-200 flex items-center gap-1">
                      <Icon className="w-3 h-3 text-emerald-400" />
                      {p.label}
                    </span>
                    {p.pct && (
                      <span className="font-mono text-[10px] text-emerald-400">±{p.pct}%</span>
                    )}
                  </div>
                  <div className="text-[9px] text-neutral-500 mt-0.5">{p.desc}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Studio Grid: Parameters + Real-Time Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Strategy Form Parameters */}
        <Panel title="Configuration Parameters" className="lg:col-span-6 space-y-4">
          {mainToken && (
            <div className="space-y-2">
              <MarketStrip
                ctx={ctxOf(mainToken)}
                symbol={main.symbol}
                decimals={main.decimals}
                loading={suggest.isLoading && !market.data}
              />
              {suggest.data?.params && (
                <button
                  type="button"
                  onClick={() => applySuggestion(false)}
                  className="text-[11px] font-semibold text-sky-400 hover:text-sky-300 underline-offset-2 hover:underline"
                >
                  Auto-fill prices from market mid
                </button>
              )}
            </div>
          )}
          {suggest.data?.caution && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-200 flex gap-2">
              <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" /><span>{suggest.data.caution}</span>
            </div>
          )}
          {!suggest.data?.params && suggest.data?.reason && /moved/.test(suggest.data.reason) && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-[11px] text-rose-200 flex gap-2">
              <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" /><span>{suggest.data.reason}</span>
            </div>
          )}
          {replaces && current.data?.strategy.inventory && (form.fields.some(f => f.key === 'depositBch') || form.fields.some(f => f.key === 'depositTokens')) && (
            <button type="button" onClick={applyHoldings}
              className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 underline-offset-2 hover:underline">
              Use what the position holds ({formatSatsCompact(current.data.strategy.inventory.sats)}{mainToken && current.data.strategy.inventory.tokens[mainToken] ? ` + ${formatUnits(current.data.strategy.inventory.tokens[mainToken]!, main.decimals)} ${main.symbol}` : ''}): no top-up needed
            </button>
          )}

          {form.fields
            .filter(f => f.key !== 'recyclePrice' || values.proceeds === 'recycle')
            .map(f => (
              <div key={f.key} className="space-y-1.5">
                <div className="text-xs font-semibold text-neutral-300">
                  {f.label}
                  {f.optional ? (
                    <span className="text-neutral-500 font-normal"> · optional</span>
                  ) : null}
                </div>
                {field(f)}
                {f.help && <p className="text-[10px] text-neutral-500">{f.help}</p>}
              </div>
            ))}

          <p className="text-[11px] text-neutral-500 flex gap-1.5 pt-2 border-t border-neutral-800">
            <Info className="w-3.5 h-3.5 shrink-0 mt-px text-neutral-400" />
            Prices are executed via native UTXO covenants at 1 sat/byte gas efficiency. Only your wallet key can withdraw.
          </p>
        </Panel>

        {/* Right Column: Live Depth Preview & Review CTA */}
        <div className="lg:col-span-6 space-y-6 lg:sticky lg:top-20">
          <Panel
            title="Position Preview & Price Ladder"
            action={
              market.data?.cauldron && marketPrice ? (
                <span className="text-[11px] text-neutral-500">
                  Cauldron: 1 BCH ≈{' '}
                  <span className="font-mono text-neutral-300">
                    {formatNumber(marketPrice, 2)}
                  </span>{' '}
                  {main.symbol}
                </span>
              ) : undefined
            }
          >
            {levels.length > 0 && (
              <PriceLadder levels={levels} market={marketPrice} symbol={main.symbol} />
            )}

            {preview.data && ['grid', 'range', 'take-profit', 'accumulate'].includes(templateId) && (
              <div className="mt-3">
                <RangeDistribution pools={preview.data.pools} token={mainToken} decimals={main.decimals} symbol={main.symbol} market={marketPrice} />
              </div>
            )}

            {preview.data?.warnings?.length ? (
              <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-[11px] text-rose-200 space-y-1.5">
                <div className="flex gap-2 font-semibold"><TriangleAlert className="w-4 h-4 shrink-0" />Priced through the market</div>
                {preview.data.warnings.map(w => <p key={w}>{w}</p>)}
                <label className="flex items-center gap-2 pt-1 text-rose-100 cursor-pointer">
                  <input type="checkbox" checked={acceptCross} onChange={e => setAcceptCross(e.target.checked)} />
                  Deploy anyway: I want these pools filled at these prices
                </label>
              </div>
            ) : null}

            {preview.data?.notes?.length ? (
              <div className="mt-3 p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 text-[11px] text-neutral-400 space-y-1">
                {preview.data.notes.map(n => <p key={n}>{n}</p>)}
              </div>
            ) : null}

            {preview.isFetching && (
              <div className="flex items-center gap-2 text-xs text-neutral-400 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                Computing covenant pools…
              </div>
            )}

            {preview.data && (
              <div className="space-y-2 mt-3">
                <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                  Covenant Pools to Open ({preview.data.pools.length})
                </div>

                {preview.data.pools.map(p => {
                  const reserve = p.v3.reserve === '0x' ? 'BCH' : infoOf(p.v3.reserve).symbol;
                  const accepts = p.v3.slots
                    .map(s => (s.cat === '0x' ? 'BCH' : infoOf(s.cat).symbol))
                    .join(', ');
                  return (
                    <div
                      key={p.address}
                      className="p-3 rounded-xl bg-black/40 border border-neutral-800 text-xs space-y-1.5 hover:border-neutral-700 transition-colors"
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold text-white capitalize">
                          {p.role.replace('-', ' ')}
                        </span>
                        <span className="font-mono text-neutral-200">
                          {p.deposit.token
                            ? `${formatUnits(p.deposit.token.amount, infoOf(p.deposit.token.category).decimals)} ${infoOf(p.deposit.token.category).symbol}`
                            : formatSatsCompact(p.deposit.sats)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2 text-neutral-500 font-mono text-[11px]">
                        <span>Gives {reserve} for {accepts}</span>
                        <span>{shortHex(p.address, 6, 4)}</span>
                      </div>
                      {(p.market?.length || p.v3.modeName === 'mirror') && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {p.market?.[0] && <VsMid bps={p.market[0].vsMidBps} />}
                          {p.v3.modeName === 'mirror' && <RecyclePill />}
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="flex justify-between text-xs text-neutral-300 px-1 pt-2 border-t border-neutral-800 font-mono">
                  <span>Required Deposit:</span>
                  <span className="text-white font-bold">
                    {formatSatsCompact(preview.data.totals.sats)}
                    {Object.entries(preview.data.totals.tokens).map(
                      ([c, a]) =>
                        ` + ${formatUnits(a, infoOf(c).decimals)} ${infoOf(c).symbol}`
                    )}
                  </span>
                </div>
                {preview.data.deployBytes ? (
                  <div className="flex justify-between text-[11px] text-neutral-500 px-1 font-mono">
                    <span>Deploy transaction (estimate):</span>
                    <span>~{formatNumber(preview.data.deployBytes, 0)} bytes</span>
                  </div>
                ) : null}
              </div>
            )}

            {verified?.ok && (
              <div className="flex items-center gap-2 text-[11px] text-emerald-400 p-2 rounded-lg bg-emerald-950/20 border border-emerald-800/40">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>All covenant outputs verified locally: matching contract bytecode and owned by your wallet</span>
              </div>
            )}

            {(validation || formError) && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-200 flex gap-2">
                <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError ?? validation}</span>
              </div>
            )}

            <Button
              className="w-full h-12 rounded-xl font-bold bg-white text-neutral-900 hover:bg-neutral-200 dark:bg-white dark:text-neutral-900 transition-all shadow-md mt-2"
              disabled={!!validation || !verified?.ok || !!busy}
              onClick={onReview}
            >
              {busy && !review ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {busy}
                </>
              ) : (
                <>
                  Review Strategy Deployment
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </>
              )}
            </Button>
          </Panel>
        </div>
      </div>

      {/* Token Select Modal */}
      <TokenSelectModal
        open={!!tokenModal}
        onOpenChange={o => {
          if (!o) setTokenModal(null);
        }}
        title="Choose a CashToken"
        selectedToken={
          tokenModal
            ? CHIPNET_DEFAULT_TOKENS.find(t => t.categoryId === values[tokenModal])
            : undefined
        }
        onSelect={(t: MeshToken) => {
          if (tokenModal && !t.isNativeBch && t.categoryId) set(tokenModal, t.categoryId);
          setTokenModal(null);
        }}
      />

      {/* Pre-Flight Transaction Confirmation Dialog */}
      <Dialog
        open={!!review}
        onOpenChange={o => {
          if (!o && !busy) setReview(null);
        }}
      >
        <DialogContent className="max-w-md bg-[#0a0a0d] border border-neutral-800 rounded-3xl text-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {replaces ? 'Rebalance Strategy' : 'Deploy Strategy on Mesh Finance'}
            </DialogTitle>
            <DialogDescription className="text-neutral-400 text-xs">
              One atomic Bitcoin Cash transaction funds all covenant pools. Solvers will immediately match order intents against your positions.
            </DialogDescription>
          </DialogHeader>

          {review && (
            <div className="space-y-3 text-xs pt-2">
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {review.preview.pools.map((p, i) => (
                  <div
                    key={p.address}
                    className="flex justify-between items-center p-2.5 rounded-lg bg-neutral-900/80 border border-neutral-800"
                  >
                    <div>
                      <div className="font-semibold text-white capitalize">
                        Output #{i} · {p.role.replace('-', ' ')}
                      </div>
                      <div className="font-mono text-[10px] text-neutral-500">
                        {shortHex(p.address, 6, 4)}
                      </div>
                    </div>
                    <span className="font-mono text-neutral-200">
                      {p.deposit.token
                        ? `${formatUnits(p.deposit.token.amount, infoOf(p.deposit.token.category).decimals)} ${infoOf(p.deposit.token.category).symbol}`
                        : formatSatsCompact(p.deposit.sats)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-1 font-mono text-[11px]">
                <div className="flex justify-between text-neutral-400">
                  <span>Network Gas Fee:</span>
                  <span className="text-white font-bold">
                    {review.built.fee.toString()} sats (~{review.built.size} B)
                  </span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>Sovereign Exit:</span>
                  <span className="text-emerald-400">Guaranteed (`dock` spend path)</span>
                </div>
              </div>

              <Button
                className="w-full h-12 rounded-xl font-bold bg-emerald-500 hover:bg-emerald-400 text-black mt-2"
                disabled={!!busy}
                onClick={onConfirm}
              >
                {busy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    {busy}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    {replaces ? 'Sign and Rebalance' : 'Sign and Deploy Strategy'}
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default StrategyBuilder;
