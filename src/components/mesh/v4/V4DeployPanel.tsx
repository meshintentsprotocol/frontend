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
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Gem, Info, Loader2, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Panel } from '@/components/mesh/pools/shared';
import { DistributionChart } from '@/components/mesh/strategies/RangeDistribution';
import { useMeshSigner, useSignerBalances } from '@/hooks/useMesh';
import { useV4Deploy } from '@/hooks/mesh/useV4Deploy';
import { formatNumber, formatSatsCompact, formatUnits, shortHex } from '@/lib/mesh/format';
import { binBars, positionUrl, tokenPerBch } from '@/lib/mesh/v4/display';

/** Measured on chipnet (MeshBinV4 spec §7): bytes a trade adds per bin it crosses. */
const V4_BYTES_PER_BIN = 430;
const V3_BYTES_PER_BIN = 1100;

// the engine badge lives in the shared kit; re-exported for existing imports
export { EngineBadge } from '@/components/mesh/kit/EngineBadge';
import { EngineBadge } from '@/components/mesh/kit/EngineBadge';

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
  const wallet = useMeshSigner();
  const balances = useSignerBalances(wallet.signer);
  // plan → check every bin here → seed → genesis → pin → register (shared with the create flow)
  const v4 = useV4Deploy({
    wallet, balances: balances.data, params, paramsError, token, symbol,
    onDone: category => navigate(positionUrl(category)),
  });
  const { req, preview, verified, notEnabled, validation, error, busy, review } = v4;
  const onReview = v4.openReview;
  const onConfirm = v4.confirm;
  const setReview = (_: null) => v4.closeReview();

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

      {v4.needsSeed && (
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
