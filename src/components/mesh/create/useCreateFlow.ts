/**
 * The state of one create flow (/mesh/new/:strategy): form values, tokens and
 * their decimals, the market, the step, the engine, the step-2 settings check,
 * the step-3 deposits and the deploy hooks (MeshDocs/meshv3v4flow/09 §2.3–2.4).
 *
 * Values are the same map the old builder edits (lib/mesh/v3/strategyForms.ts),
 * so the params sent to the server are unchanged. Drafts survive a refresh.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { meshApi, useMarketRef, useMeshSigner, usePairDepth, useSignerBalances, useStrategy, useStrategySuggest } from '@/hooks/useMesh';
import { useDebounced } from '@/hooks/mesh/useDebounced';
import { useV3Deploy } from '@/hooks/mesh/useV3Deploy';
import { PREVIEW_SEED, useV4Deploy, v4RequestOf } from '@/hooks/mesh/useV4Deploy';
import { useTokenInfo, type TokenInfo } from '@/components/mesh/pools/shared';
import { CHIPNET_DEFAULT_TOKENS } from '@/components/mesh/TokenSelectModal';
import { pusdCategory } from '@/lib/pusd';
import { MeshApiError, type StrategyInput, type StrategyPreview } from '@/lib/mesh/meshApi';
import type { V4Plan, V4PreviewInput } from '@/lib/mesh/v4/types';
import { STRATEGIES, type StrategyDef, type StrategyId } from '@/lib/mesh/create/registry';
import { defaultEngineCaps, enginesFor, pickEngine, type Engine } from '@/lib/mesh/create/engine';
import { formDefaults, mainTokenOf, priceKeysFor, suggestQueryFor, tokenCatsOf, tokenValuesOf, trialDeposits } from '@/lib/mesh/create/forms';
import { clearDraft, draftKey, loadDraft, saveDraft } from '@/lib/mesh/create/draft';
import { depositCards, oneSidedNote, type DepositCard } from '@/lib/mesh/create/deposits';
import { amountText, fromServerParams, satsPerUnitFromTokenPerBch, shareOf, toBaseUnits, toServerParams } from '@/lib/mesh/v3/strategyForms';
import { formatPrice, tokensPerBchFromSats } from '@/lib/mesh/create/price';
import {
  depthBins, sideWeights, v3RangeLayout, v4RangeLayout,
  type ChartBin, type RangeLayout, type ShapeName, type StrengthName,
} from '@/lib/mesh/create/layout';
import { bchMaxReserve, linkedSats, linkedTokens } from '@/lib/mesh/create/linked';
import { meshPaths } from '@/lib/mesh/routes';

/** an owner for step-2 trial previews when no wallet is connected (the preview is a pure calculation) */
const TRIAL_OWNER = '00'.repeat(20);

export interface Created { kind: 'strategy' | 'position'; id: string; url: string; pending?: boolean }

/** "1 BCH = P" text → sats per token unit (0 when empty or invalid). */
function satsOf(text: string | undefined, decimals: number): number {
  try { return text ? Number(satsPerUnitFromTokenPerBch(text, decimals)) : 0; } catch { return 0; }
}

/** Base units of an amount field (0 when empty or invalid). */
function unitsOf(text: string | undefined, decimals: number): bigint {
  try { return toBaseUnits(text ?? '', decimals); } catch { return 0n; }
}

export function useCreateFlow({ strategy, token, tokenB, replaces, simple = false }: {
  strategy: StrategyId;
  token?: string;
  tokenB?: string;
  replaces?: string;
  /** Simple mode: one screen, so the deploy preview runs as soon as there are amounts */
  simple?: boolean;
}) {
  const def: StrategyDef = STRATEGIES[strategy];
  const template = def.template ?? 'fixed';
  const [params, setParams] = useSearchParams();
  const wallet = useMeshSigner();
  const balancesQ = useSignerBalances(wallet.signer);
  const balances = balancesQ.data;

  // ── step and engine (in the URL) ─────────────────────────────────────────
  const step: 2 | 3 = params.get('step') === '3' ? 3 : 2;
  /** the step-2 checks run on step 2 of the full flow; the deploy preview on step 3 (or at once in Simple mode) */
  const checkOn = step === 2 && !simple;
  const deployOn = simple || step === 3;
  const setStep = useCallback((s: 2 | 3) => {
    setParams(prev => { const n = new URLSearchParams(prev); n.set('step', String(s)); return n; });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setParams]);
  /** the server answered 503 to a V4 plan: V4 isn't set up there, so V3 pools it is */
  const [v4Off, setV4Off] = useState(false);
  const caps = useMemo(() => ({ ...defaultEngineCaps(), ...(v4Off ? { v4Enabled: false } : {}) }), [v4Off]);
  const engines = enginesFor(strategy, caps, { replaces });
  const engine: Engine = pickEngine(strategy, caps, params.get('engine'), { replaces });
  const setEngine = useCallback((e: Engine) => {
    setParams(prev => { const n = new URLSearchParams(prev); n.set('engine', e); return n; }, { replace: true });
  }, [setParams]);

  // ── values: defaults → draft → URL tokens ────────────────────────────────
  const tokenField = template === 'multi-pair' ? 'token1' : template === 'stable-pair' ? 'tokenA' : 'token';
  const key = draftKey(simple ? `simple-${strategy}` : strategy, token, replaces ?? tokenB);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const base = formDefaults(template, wallet.network, { token, tokenB, mainnetPusd: pusdCategory(true) });
    const draft = replaces ? null : loadDraft(key);
    return { ...base, ...(draft ?? {}), ...(token ? { [tokenField]: token.toLowerCase() } : {}) };
  });
  const set = useCallback((k: string, v: string) => setValues(prev => (prev[k] === v ? prev : { ...prev, [k]: v })), []);
  const patch = useCallback((p: Record<string, string>) => setValues(prev => ({ ...prev, ...p })), []);
  const [created, setCreated] = useState<Created | null>(null);
  useEffect(() => {
    if (replaces || created) return;
    const t = setTimeout(() => saveDraft(key, values), 300);
    return () => clearTimeout(t);
  }, [key, values, replaces, created]);

  // ── tokens and decimals ──────────────────────────────────────────────────
  const tokenCats = useMemo(() => tokenCatsOf(template, values), [template, values]);
  const { get, loading: tokenInfoLoading } = useTokenInfo(tokenCats);
  const infoOf = useCallback((cat: string): TokenInfo => {
    const i = get(cat);
    const f = CHIPNET_DEFAULT_TOKENS.find(t => t.categoryId === cat);
    return i.known ? i : f ? { ...i, symbol: f.symbol, decimals: f.decimals, icon: f.icon ?? null, known: true } : i;
  }, [get]);
  /** prices convert with each token's decimals: wait for metadata (a token without any really has 0 decimals) */
  const decimalsReady = !tokenInfoLoading || tokenCats.every(c => infoOf(c).known);
  const decimalsKey = `${decimalsReady}|` + tokenCats.map(c => `${c}:${infoOf(c).decimals}`).join(',');
  const decimalsOf = useCallback((c: string) => infoOf(c).decimals, [infoOf]);
  const mainToken = mainTokenOf(values);
  const main = infoOf(mainToken);

  /** Pick a token for a field: its old prices no longer apply, so they clear and refill from the market. */
  const setToken = useCallback((field: string, category: string) => {
    setValues(prev => {
      if (prev[field] === category) return prev;
      const next = { ...prev, [field]: category };
      for (const k of priceKeysFor(template, field)) next[k] = '';
      return next;
    });
  }, [template]);

  // ── market ───────────────────────────────────────────────────────────────
  const suggest = useStrategySuggest(def.template ? suggestQueryFor(template, values) : null);
  const marketRef = useMarketRef(mainToken || undefined);
  const ctxOf = useCallback((cat: string) => suggest.data?.market?.[cat] ?? null, [suggest.data]);
  const midOf = useCallback((cat: string): number | null =>
    ctxOf(cat)?.midSatsPerToken ?? (cat === mainToken && marketRef.data?.cauldron ? Number(marketRef.data.cauldron.satsPerToken) : null),
  [ctxOf, mainToken, marketRef.data]);
  const mainMid = midOf(mainToken);
  const marketP = mainMid ? tokensPerBchFromSats(mainMid, main.decimals) : null;
  const marketCtx = ctxOf(mainToken);

  const applySuggestion = useCallback((onlyEmpty: boolean) => {
    const p = suggest.data?.params;
    if (!p || !decimalsReady) return;
    setValues(prev => {
      const next = fromServerParams(template, p, decimalsOf, prev);
      const merged = { ...prev };
      for (const [k, v] of Object.entries(next)) if (!onlyEmpty || !prev[k]) merged[k] = v;
      return merged;
    });
  }, [suggest.data, decimalsReady, template, decimalsOf]);
  // fill empty prices from the market once the suggestion and the token details are in
  useEffect(() => { if (!replaces) applySuggestion(true); }, [suggest.data, decimalsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── rebalance: start from the strategy being replaced ────────────────────
  const current = useStrategy(replaces);
  const prefilledId = useRef<string | null>(null);
  const pendingParams = useRef<Record<string, unknown> | null>(null);
  useEffect(() => {
    const s = current.data?.strategy;
    if (!s || prefilledId.current === s.id) return;
    prefilledId.current = s.id;
    pendingParams.current = s.params;
    setValues(prev => ({ ...prev, ...tokenValuesOf(template, s.params) }));
  }, [current.data?.strategy.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const p = pendingParams.current;
    if (!p || !decimalsReady) return;
    // the stored tokens must be in place (and their decimals known) before prices convert
    const want = tokenCatsOf(template, tokenValuesOf(template, p));
    if (!want.every(c => tokenCats.includes(c))) return;
    pendingParams.current = null;
    setValues(prev => ({ ...prev, ...fromServerParams(template, p, decimalsOf, prev) }));
  }, [decimalsKey, current.data?.strategy.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── range layout, computed here so the chart follows every change ────────
  const shape = (values.shape || 'spot') as ShapeName;
  const strength = (values.strength || 'standard') as StrengthName;
  const rangeLayout = useMemo((): RangeLayout | null => {
    if (strategy !== 'range' || !decimalsReady) return null;
    const dec = main.decimals;
    const args = {
      lowSats: satsOf(values.low, dec), highSats: satsOf(values.high, dec), centerSats: satsOf(values.center, dec),
      stepBps: Number(values.binStepBps || 100), decimals: dec, shape, strength,
    };
    return engine === 'v4' ? v4RangeLayout(args) : v3RangeLayout({ ...args, feeBps: Number(values.feeBps || 30) });
  }, [strategy, decimalsKey, main.decimals, values.low, values.high, values.center, values.binStepBps, values.feeBps, shape, strength, engine]); // eslint-disable-line react-hooks/exhaustive-deps

  const depth = usePairDepth(strategy === 'range' && mainToken ? mainToken : undefined, Number(values.binStepBps || 100));
  const depthChart = useMemo((): ChartBin[] => (depth.data && decimalsReady ? depthBins(depth.data.levels, depth.data.stepBps, main.decimals) : []),
    [depth.data, decimalsKey, main.decimals]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── step 2: the settings, checked with trial deposits ────────────────────
  const trial = useMemo((): { params?: Record<string, unknown>; error?: string; sides: 'both' | 'bch' | 'token' } => {
    const sides = rangeLayout && !rangeLayout.error ? (rangeLayout.askCount === 0 ? 'bch' : rangeLayout.bidCount === 0 ? 'token' : 'both') : 'both';
    if (!def.template) return { sides, error: 'Custom pools use their own form' };
    if (!decimalsReady) return { sides, error: 'Loading token details…' };
    if (rangeLayout?.error) return { sides, error: rangeLayout.error };
    try {
      return { sides, params: toServerParams(template, trialDeposits(template, values, sides), decimalsOf) };
    } catch (e: any) {
      return { sides, error: e?.message ?? String(e) };
    }
  }, [def.template, template, values, decimalsKey, rangeLayout]); // eslint-disable-line react-hooks/exhaustive-deps

  // V3: the server previews the exact pools (warnings, notes) with the trial deposits
  const trialInput = useMemo((): StrategyInput | undefined => (trial.params && engine === 'v3' && def.template
    ? { template, ownerPkh: wallet.pkh ?? TRIAL_OWNER, params: trial.params } : undefined),
  [trial.params, engine, def.template, template, wallet.pkh]);
  const trialDebounced = useDebounced(trialInput, 350);
  const layoutPreview = useQuery<StrategyPreview, Error>({
    queryKey: ['mesh', 'strategy-layout', trialDebounced],
    enabled: !!trialDebounced && checkOn && engine === 'v3',
    queryFn: async () => {
      const first = trialDebounced!;
      try {
        return await meshApi.previewStrategy(first);
      } catch (e) {
        // a ladder with every pool on one side refuses the other side's trial deposit: retry without it
        const msg = e instanceof MeshApiError ? e.message : '';
        const leave = /leave (depositSats|depositTokens) empty/.exec(msg)?.[1];
        if (!leave) throw e;
        const p2 = { ...first.params };
        delete p2[leave];
        return meshApi.previewStrategy({ ...first, params: p2 });
      }
    },
    retry: false,
    placeholderData: keepPreviousData,
  });

  // V4: plan the bins with the trial deposits (needs the wallet's address): catches a server without V4 early
  const v4TrialInput = useMemo((): V4PreviewInput | null => {
    if (engine !== 'v4' || !trial.params || !wallet.signer || !mainToken) return null;
    const r = v4RequestOf(trial.params);
    if (!r) return null;
    return {
      tokenCat: mainToken, binStepBps: r.step, lowIndex: r.lowIndex, highIndex: r.highIndex, marketIndex: r.marketIndex,
      depositSats: r.depositSats.toString(), depositTokens: r.depositTokens.toString(), shape: r.shape, strength: r.strength,
      seedTxid: PREVIEW_SEED, owner: wallet.signer.tokenAddress,
    };
  }, [engine, trial.params, wallet.signer, mainToken]);
  const v4TrialDebounced = useDebounced(v4TrialInput, 450);
  const v4Probe = useQuery<V4Plan, Error>({
    queryKey: ['mesh', 'v4-layout', v4TrialDebounced],
    enabled: !!v4TrialDebounced && checkOn && engine === 'v4',
    queryFn: () => meshApi.v4Preview(v4TrialDebounced!),
    retry: false,
    placeholderData: keepPreviousData,
  });
  useEffect(() => {
    if (v4Probe.error instanceof MeshApiError && v4Probe.error.status === 503) setV4Off(true);
  }, [v4Probe.error]);

  const settingsError: string | null = (() => {
    if (trial.error) return trial.error;
    if (engine === 'v3' && layoutPreview.isError) return layoutPreview.error.message;
    if (engine === 'v4' && v4Probe.isError && !(v4Probe.error instanceof MeshApiError && v4Probe.error.status === 503)) return v4Probe.error.message;
    return null;
  })();
  const settingsChecking = engine === 'v3' ? layoutPreview.isFetching || trialInput !== trialDebounced : v4Probe.isFetching;
  const settingsWarnings: string[] = engine === 'v3' ? layoutPreview.data?.warnings ?? [] : v4Probe.data?.warnings ?? [];
  const settingsNotes: string[] = engine === 'v3' ? layoutPreview.data?.notes ?? [] : [];

  // ── step 3: deposits ─────────────────────────────────────────────────────
  const counts: { bidCount?: number; askCount?: number } = rangeLayout && !rangeLayout.error ? { bidCount: rangeLayout.bidCount, askCount: rangeLayout.askCount } : {};
  const marketText = marketP ? formatPrice(marketP) : undefined;
  const symbolOfKey = useCallback((k: string) => infoOf(values[k] ?? '').symbol, [infoOf, values]);
  const cards: DepositCard[] = useMemo(() => depositCards(strategy, values, { ...counts, marketText, symbol: symbolOfKey }, engine),
    [strategy, values, counts.bidCount, counts.askCount, marketText, symbolOfKey, engine]); // eslint-disable-line react-hooks/exhaustive-deps
  const oneSided = oneSidedNote(strategy, counts, main.symbol);
  const twoSided = cards.length === 2 && strategy === 'range';
  const [linked, setLinked] = useState(true);
  const weights = useMemo(() => sideWeights({ bidCount: counts.bidCount ?? 0, askCount: counts.askCount ?? 0 }, shape, strength),
    [counts.bidCount, counts.askCount, shape, strength]); // eslint-disable-line react-hooks/exhaustive-deps

  /** decimals of a deposit card's asset */
  const decOfCard = useCallback((c: DepositCard) => (c.asset === 'bch' ? 8 : decimalsOf(values[c.asset] ?? '')), [decimalsOf, values]);

  /** Type into a deposit card; a linked range fills the other side from the plan. */
  const setDeposit = useCallback((k: string, text: string) => {
    const card = cards.find(c => c.key === k);
    if (!card || !twoSided || !linked) { set(k, text); return; }
    const other = cards.find(c => c.key !== k)!;
    if (card.asset === 'bch') {
      const t = linkedTokens(unitsOf(text, 8), weights, mainMid);
      patch({ [k]: text, [other.key]: text.trim() && t > 0n ? amountText(t, main.decimals) : '' });
    } else {
      const s = linkedSats(unitsOf(text, main.decimals), weights, mainMid);
      patch({ [k]: text, [other.key]: text.trim() && s > 0n ? amountText(s, 8) : '' });
    }
  }, [cards, twoSided, linked, weights, mainMid, main.decimals, set, patch]);

  /** 25 / 50 / 75 / 100 % of the balance, in integer math; BCH keeps room for carriers and the fee. */
  const setFraction = useCallback((k: string, fraction: number) => {
    const card = cards.find(c => c.key === k);
    if (!card || !balances) return;
    const units = card.asset === 'bch'
      ? shareOf(balances.sats, fraction, bchMaxReserve(counts.askCount ?? 0, engine))
      : shareOf(balances.tokens[values[card.asset] ?? ''] ?? 0n, fraction);
    setDeposit(k, units > 0n ? amountText(units, decOfCard(card)) : '');
  }, [cards, balances, decOfCard, counts.askCount, engine, values, setDeposit]);

  /** Rebalance: deposit what the old strategy holds, less the new token pools' carriers and a fee margin. */
  const holdings = current.data?.strategy.inventory ?? null;
  const applyHoldings = useCallback(() => {
    if (!holdings) return;
    const next: Record<string, string> = {};
    for (const c of cards) {
      if (c.asset === 'bch') {
        const s = BigInt(holdings.sats) - BigInt(Math.max(1, counts.askCount ?? 1)) * 1000n - 3000n;
        next[c.key] = s > 0n ? amountText(s, 8) : '';
      } else {
        const cat = values[c.asset] ?? '';
        const t = holdings.tokens[cat];
        next[c.key] = t ? amountText(BigInt(t), decimalsOf(cat)) : '';
      }
    }
    setLinked(false);
    patch(next);
  }, [holdings, cards, counts.askCount, values, decimalsOf, patch]);

  // ── server params with the LP's deposits (what step 3 previews and signs) ─
  const input = useMemo((): { input?: StrategyInput; error?: string } => {
    if (!def.template) return { error: 'Custom pools use their own form' };
    if (!wallet.pkh) return { error: wallet.unavailable ?? 'Connect a wallet' };
    if (!decimalsReady) return { error: 'Loading token details…' };
    for (const c of cards) if (c.required && !(values[c.key] ?? '').trim()) return { error: `Enter the ${c.asset === 'bch' ? 'BCH' : symbolOfKey(c.asset)} to deposit` };
    if (strategy === 'range' && cards.length && cards.every(c => !(values[c.key] ?? '').trim())) return { error: 'Enter an amount to deposit' };
    // both sides of a two-sided range hold something: the bins on the empty side would have nothing to trade
    if (twoSided) {
      for (const c of cards) {
        if (!(values[c.key] ?? '').trim()) return { error: c.asset === 'bch' ? 'Enter the BCH for the bins above the price' : `Enter the ${main.symbol} for the bins below the price` };
      }
    }
    try {
      // a one-sided range takes no deposit for the side it doesn't have
      const v = { ...values };
      if (strategy === 'range' || strategy === 'grid') {
        for (const k of ['depositBch', 'depositTokens']) if (!cards.some(c => c.key === k)) v[k] = '';
      }
      return { input: { template, ownerPkh: wallet.pkh, params: toServerParams(template, v, decimalsOf) } };
    } catch (e: any) {
      return { error: e?.message ?? String(e) };
    }
  }, [def.template, template, strategy, wallet.pkh, wallet.unavailable, values, cards, twoSided, main.symbol, decimalsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── deploy ───────────────────────────────────────────────────────────────
  const symbolOf = useCallback((c: string) => infoOf(c).symbol, [infoOf]);
  const v3 = useV3Deploy({
    wallet, balances, input: input.input, inputError: input.error, replaces,
    enabled: engine === 'v3' && deployOn, symbolOf, title: def.name,
    onDone: id => { clearDraft(key); setCreated({ kind: 'strategy', id, url: meshPaths.strategy(id) }); },
  });
  const v4 = useV4Deploy({
    wallet, balances, params: engine === 'v4' ? input.input?.params : undefined, paramsError: input.error,
    token: mainToken, symbol: main.symbol, enabled: engine === 'v4' && deployOn,
    onDone: cat => { clearDraft(key); setCreated({ kind: 'position', id: cat, url: meshPaths.position(cat) }); },
  });
  useEffect(() => { if (v4.notEnabled) setV4Off(true); }, [v4.notEnabled]);
  // a V4 genesis that was funded but not yet registered still lands on its page (it retries there)
  useEffect(() => {
    if (created && engine === 'v4' && v4.progress.failed?.phase === 'listing') setCreated(c => (c && !c.pending ? { ...c, pending: true } : c));
  }, [created, engine, v4.progress.failed]);

  /** the active engine's deploy, in one shape for the review step */
  const deploy = engine === 'v4'
    ? {
      validation: v4.validation, verified: v4.verified, busy: v4.busy, error: v4.error, progress: v4.progress,
      hasReview: !!v4.review, previewing: v4.preview.isFetching,
      openReview: v4.openReview, closeReview: v4.closeReview, confirm: v4.confirm,
      warnings: v4.preview.data?.warnings ?? [], notes: [] as string[], needsCross: false,
    }
    : {
      validation: v3.validation, verified: v3.verified, busy: v3.busy, error: v3.error, progress: v3.progress,
      hasReview: !!v3.review, previewing: v3.preview.isFetching,
      openReview: v3.openReview, closeReview: v3.closeReview, confirm: v3.confirm,
      warnings: v3.preview.data?.warnings ?? [], notes: v3.preview.data?.notes ?? [], needsCross: !!v3.preview.data?.warnings?.length,
    };
  const canReview = !deploy.validation && !!deploy.verified?.ok && !deploy.busy;

  return {
    def, strategy, template, step, setStep, engine, engines, setEngine, v4Off, replaces, current, holdings, applyHoldings,
    wallet, balances, balancesLoading: balancesQ.isLoading,
    values, set, patch, setToken, applySuggestion,
    tokenCats, infoOf, decimalsOf, decimalsReady, mainToken, main,
    suggest, marketCtx, midOf, mainMid, marketP, marketText,
    rangeLayout, depthChart, layoutPreview, v4Probe, trial, settingsError, settingsChecking, settingsWarnings, settingsNotes,
    cards, oneSided, twoSided, linked, setLinked, setDeposit, setFraction, decOfCard,
    input, v3, v4, deploy, canReview,
    created, resetCreated: () => setCreated(null),
  };
}

export type CreateFlow = ReturnType<typeof useCreateFlow>;
