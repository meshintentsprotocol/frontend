/**
 * Deploy a range as a V4 position: in-place bins owned by an NFT.
 *
 *   range form → server plan (/v4/positions/preview) → every bin, the NFT and
 *   the metadata output verified locally → seed output #0 (made first if the
 *   wallet has none) → one genesis transaction → metadata pinned (best effort)
 *   → registered → position page.
 *
 * Used by the strategy builder when its engine is "V4 bins" (BCH↔token ranges).
 */
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight, Gem, Info, Loader2, ShieldCheck, TriangleAlert } from 'lucide-react';
import { binToHex } from '@bitauth/libauth';
import type { Utxo } from 'cashscript';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Panel } from '@/components/mesh/pools/shared';
import { DistributionChart } from '@/components/mesh/strategies/RangeDistribution';
import { meshApi, useInvalidateMesh, useMeshSigner, useSignerBalances } from '@/hooks/useMesh';
import { MeshApiError } from '@/lib/mesh/meshApi';
import { formatNumber, formatSatsCompact, formatUnits, shortHex } from '@/lib/mesh/format';
import { sendPoolTx, type BuiltTx } from '@/lib/mesh/poolTx';
import { registerWithRetry } from '@/lib/mesh/pendingRegistrations';
import { v4Levels } from '@/lib/mesh/v4/position';
import { verifyPlan, type PlanExpect } from '@/lib/mesh/v4/verify';
import { buildGenesis, findSeed } from '@/lib/mesh/v4/v4Tx';
import { ensureSeed } from '@/lib/mesh/v4/seed';
import { addPendingV4, binBars, positionUrl, removePendingV4, tokenPerBch } from '@/lib/mesh/v4/display';
import type { V4Plan, V4PreviewInput, V4Shape, V4Strength } from '@/lib/mesh/v4/types';

/** Shown while the wallet has no seed yet: any txid works for a preview (the category changes, nothing else). */
const PREVIEW_SEED = '00'.repeat(31) + '01';
/** Measured on chipnet (MeshBinV4 spec §7): bytes a trade adds per bin it crosses. */
const V4_BYTES_PER_BIN = 430;
const V3_BYTES_PER_BIN = 1100;
const ASK_CARRIER = 1000n;

export function EngineBadge({ engine, className }: { engine: 'v4' | 'v3'; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${engine === 'v4' ? 'bg-violet-500/10 border-violet-500/30 text-violet-300' : 'bg-neutral-800/60 border-neutral-700 text-neutral-400'} ${className ?? ''}`}>
      {engine === 'v4' ? <><Gem className="w-3 h-3" />V4 bins</> : 'V3 pools'}
    </span>
  );
}

interface Props {
  /** The range template's server params (prices in sats per token unit), or why they can't be built. */
  params?: Record<string, unknown>;
  paramsError?: string;
  token: string;
  symbol: string;
  decimals: number;
  /** market price in tokens per BCH, for the chart */
  market: number | null;
  onUseV3: () => void;
}

export function V4DeployPanel({ params, paramsError, token, symbol, decimals, market, onUseV3 }: Props) {
  const navigate = useNavigate();
  const invalidate = useInvalidateMesh();
  const wallet = useMeshSigner();
  const balances = useSignerBalances(wallet.signer);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<{ plan: V4Plan; built: BuiltTx; seed: Utxo } | null>(null);

  // the range in grid levels, and the most the bins may take from the wallet
  const req = useMemo(() => {
    if (!params) return null;
    const step = Number(params.binStepBps ?? 100);
    const low = Number(params.lowSatsPerToken), high = Number(params.highSatsPerToken), center = Number(params.centerSatsPerToken);
    if (!(low > 0 && high > low && center > 0)) return null;
    const lv = v4Levels(low, high, center, step);
    const depositSats = BigInt(String(params.depositSats ?? '0'));
    const depositTokens = BigInt(String(params.depositTokens ?? '0'));
    const askLevels = Math.max(0, lv.highIndex - Math.max(lv.marketIndex, lv.lowIndex - 1));
    return {
      step, ...lv, depositSats, depositTokens,
      shape: (String(params.shape ?? 'spot') as V4Shape), strength: (params.strength as V4Strength | undefined),
      maxSats: depositSats + BigInt(askLevels) * ASK_CARRIER,
    };
  }, [params]);

  const seedQ = useQuery({
    queryKey: ['mesh', 'v4-seed', wallet.signer?.address ?? ''],
    enabled: !!wallet.signer,
    queryFn: async () => findSeed(await wallet.signer!.getUtxos()),
    staleTime: 30_000,
  });

  const input = useMemo((): V4PreviewInput | null => {
    if (!req || !wallet.signer) return null;
    return {
      tokenCat: token, binStepBps: req.step, lowIndex: req.lowIndex, highIndex: req.highIndex, marketIndex: req.marketIndex,
      depositSats: req.depositSats.toString(), depositTokens: req.depositTokens.toString(), shape: req.shape, strength: req.strength,
      seedTxid: seedQ.data?.txid ?? PREVIEW_SEED, owner: wallet.signer.tokenAddress,
    };
  }, [req, wallet.signer, token, seedQ.data]);

  const preview = useQuery({
    queryKey: ['mesh', 'v4-preview', input],
    enabled: !!input,
    queryFn: () => meshApi.v4Preview(input!),
    retry: false,
  });

  const expectOf = (category: string): PlanExpect | null => (req && wallet.signer ? {
    category, tokenCat: token, ownerLock: binToHex(wallet.signer.lockingBytecode), binStepBps: req.step,
    maxSats: req.maxSats, maxTokens: req.depositTokens, lowIndex: req.lowIndex, highIndex: req.highIndex,
  } : null);

  const verified = useMemo(() => {
    if (!preview.data || !input) return null;
    try {
      verifyPlan(preview.data, expectOf(input.seedTxid)!);
      return { ok: true as const };
    } catch (e: any) {
      return { ok: false as const, error: e?.message ?? String(e) };
    }
  }, [preview.data, input]); // eslint-disable-line react-hooks/exhaustive-deps

  const notEnabled = preview.error instanceof MeshApiError && preview.error.status === 503;
  const validation = (() => {
    if (!wallet.signer) return wallet.unavailable ?? 'Connect a wallet';
    if (paramsError) return paramsError;
    if (!req) return 'Set the low, high and market prices';
    if (notEnabled) return 'V4 positions are not enabled on this Mesh server yet.';
    if (preview.isError) return (preview.error as Error).message;
    if (verified && !verified.ok) return `Refusing to deploy: ${verified.error}`;
    const b = balances.data, t = preview.data?.totals;
    if (b && t) {
      if (BigInt(t.sats) + 2_000n > b.sats) return 'Not enough BCH in the wallet (the bins, the NFT and the fee)';
      if (BigInt(t.tokens) > (b.tokens[token] ?? 0n)) return `Not enough ${symbol} in the wallet`;
    }
    return null;
  })();

  async function onReview() {
    if (!wallet.signer || !input) return;
    setError(null);
    try {
      const seed = await ensureSeed(wallet.signer, setBusy);
      if (seed.txid !== seedQ.data?.txid) void seedQ.refetch();
      setBusy('Planning the position…');
      const plan = await meshApi.v4Preview({ ...input, seedTxid: seed.txid });
      verifyPlan(plan, expectOf(seed.txid)!);
      setBusy('Building the transaction…');
      const built = await buildGenesis(wallet.signer, plan, seed);
      setReview({ plan, built, seed });
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  async function onConfirm() {
    if (!review || !wallet.signer) return;
    const { plan, built } = review;
    let txid: string | null = null;
    try {
      // pin first: a 503 (no pinning key on the server) still leaves the https copy
      setBusy('Publishing the NFT metadata…');
      await meshApi.v4PinMetadata(plan.category).catch(() => undefined);
      setBusy(wallet.kind === 'external' ? 'Approve the transaction in your wallet…' : 'Signing and broadcasting…');
      txid = await sendPoolTx(wallet.signer, built, `Mesh V4: open a position (${plan.bins.length} bins) and mint its NFT`, { raw: true });
      const pairName = `BCH/${symbol}`;
      addPendingV4({ category: plan.category, genesisTxid: txid, bins: plan.register.body.bins, pairName, createdAt: Date.now() });
      setBusy('Registering with Mesh…');
      await registerWithRetry(() => meshApi.v4Register({ genesisTxid: txid!, bins: plan.register.body.bins, pairName }));
      removePendingV4(plan.category);
      invalidate();
      toast.success('V4 position live', { description: `${plan.bins.length} bins · NFT ${shortHex(plan.category)} in your wallet · ${shortHex(txid)}` });
      setReview(null);
      navigate(positionUrl(plan.category));
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      toast.error(txid ? 'Funded, registration pending' : 'Transaction not sent', {
        description: txid ? `${msg}. The NFT and the bins are on chain; the position page retries the registration.` : msg,
        duration: 12_000,
      });
      setError(msg);
      if (txid) { setReview(null); navigate(positionUrl(plan.category)); }
    } finally {
      setBusy(null);
    }
  }

  const plan = preview.data;
  const bars = useMemo(() => (plan ? binBars(plan.bins.map(b => ({ ...b, label: `bin @ level ${b.level}` })), decimals) : []), [plan, decimals]);
  const fmtTok = (units: string) => `${formatUnits(units, decimals)} ${symbol}`;

  return (
    <Panel
      title="V4 position preview"
      action={<EngineBadge engine="v4" />}
    >
      <div className="p-3 rounded-xl bg-violet-500/5 border border-violet-500/20 text-[11px] text-violet-100/90 space-y-1">
        <div className="flex gap-2 font-semibold text-violet-200"><Gem className="w-4 h-4 shrink-0" />Position NFT goes to this wallet</div>
        <p>Whoever holds the NFT controls the bins: sending it sends the position. Each bin trades in place, both ways, and earns the {req ? `${(req.step / 100).toFixed(2)}%` : ''} step between its buy and sell price on every round trip.</p>
      </div>

      {bars.length > 1 && <div className="mt-3"><DistributionChart bars={bars} symbol={symbol} market={market} /></div>}

      {preview.isFetching && (
        <div className="flex items-center gap-2 text-xs text-neutral-400 py-2"><Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />Planning bins…</div>
      )}

      {plan && (
        <div className="space-y-2 mt-3 text-xs">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Bins" value={`${plan.bins.length}`} sub={`${plan.totals.bidBins} buy · ${plan.totals.askBins} sell`} />
            <Stat label="Range" value={`${formatNumber(tokenPerBch(plan.bins[plan.bins.length - 1]!.askSatsPerUnit, decimals), 2)}–${formatNumber(tokenPerBch(plan.bins[0]!.bidSatsPerUnit, decimals), 2)}`} sub={`${symbol} per BCH`} />
            <Stat label="Deposit" value={formatSatsCompact(plan.totals.sats)} sub={BigInt(plan.totals.tokens) > 0n ? `+ ${fmtTok(plan.totals.tokens)}` : 'BCH only'} />
          </div>
          <div className="flex justify-between text-[11px] text-neutral-400 px-1 pt-2 border-t border-neutral-800 font-mono">
            <span>Cost per bin a trade crosses</span>
            <span className="text-neutral-200">~{V4_BYTES_PER_BIN} B <span className="text-neutral-500">(V3: ~{formatNumber(V3_BYTES_PER_BIN, 0)})</span></span>
          </div>
          <div className="flex justify-between text-[11px] text-neutral-500 px-1 font-mono">
            <span>Deploy transaction (estimate)</span><span>~{formatNumber(plan.estimatedBytes, 0)} bytes</span>
          </div>
          {plan.warnings.length > 0 && (
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-200 space-y-1">
              {plan.warnings.map(w => <p key={w}>{w}</p>)}
            </div>
          )}
        </div>
      )}

      {verified?.ok && (
        <div className="mt-3 flex items-center gap-2 text-[11px] text-emerald-400 p-2 rounded-lg bg-emerald-950/20 border border-emerald-800/40">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>Checked in your browser: every bin rebuilt from the audited contract, priced on the grid and owned by the new NFT; the NFT goes to your wallet.</span>
        </div>
      )}

      {(validation || error) && (
        <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-200 flex gap-2">
          <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error ?? validation}{notEnabled && <> <button type="button" onClick={onUseV3} className="underline font-semibold">Use V3 pools instead</button></>}</span>
        </div>
      )}

      {!seedQ.data && wallet.signer && plan && (
        <p className="mt-2 text-[11px] text-neutral-500 flex gap-1.5"><Info className="w-3.5 h-3.5 shrink-0 mt-px" />Your wallet first pays itself once to make the output the NFT is minted from (a few hundred sats of fee).</p>
      )}

      <Button
        className="w-full h-12 rounded-xl font-bold bg-white text-neutral-900 hover:bg-neutral-200 transition-all shadow-md mt-3"
        disabled={!!validation || !verified?.ok || !!busy}
        onClick={onReview}
      >
        {busy && !review ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />{busy}</> : <>Review V4 position<ArrowRight className="w-4 h-4 ml-1.5" /></>}
      </Button>

      <Dialog open={!!review} onOpenChange={o => { if (!o && !busy) setReview(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Open a V4 position</DialogTitle>
            <DialogDescription>One transaction mints the position NFT and funds every bin. Everything below was checked in your browser.</DialogDescription>
          </DialogHeader>
          {review && (
            <div className="space-y-2 text-xs">
              <Row k="NFT" v={<>to your wallet · category {shortHex(review.plan.category)}</>} />
              <Row k="Bins" v={`${review.plan.bins.length} (${review.plan.totals.bidBins} buying, ${review.plan.totals.askBins} selling)`} />
              <Row k="Into the bins" v={`${formatSatsCompact(review.plan.totals.sats)}${BigInt(review.plan.totals.tokens) > 0n ? ` + ${fmtTok(review.plan.totals.tokens)}` : ''}`} />
              <Row k="NFT + metadata key" v={`${formatSatsCompact(BigInt(review.plan.outputs[0]!.valueSatoshis) + BigInt(review.plan.outputs[1]!.valueSatoshis))} (the NFT keeps 1,000; 800 to Mesh's metadata key)`} />
              <Row k="Network fee" v={`${review.built.fee.toString()} sats · ${formatNumber(review.built.size, 0)} bytes`} />
              <Row k="Metadata" v={<span className="font-mono">{review.plan.metadata.uri.slice(0, 24)}…</span>} />
              <p className="text-[11px] text-neutral-400 pt-2 border-t border-neutral-800">The position is an NFT. Sending it sends the position; burning it locks the funds for good.</p>
              <Button className="w-full h-11 rounded-xl font-bold bg-white text-neutral-900 hover:bg-neutral-200 mt-2" disabled={!!busy} onClick={onConfirm}>
                {busy ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />{busy}</> : 'Sign and open the position'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="p-2.5 rounded-xl bg-black/40 border border-neutral-800">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">{label}</div>
      <div className="font-mono text-white text-sm mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-neutral-500 font-mono">{sub}</div>}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-neutral-500">{k}</span>
      <span className="text-neutral-200 text-right">{v}</span>
    </div>
  );
}
