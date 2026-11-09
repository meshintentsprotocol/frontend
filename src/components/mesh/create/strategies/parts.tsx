/**
 * Parts every step-② form shares: the pool fee, where proceeds go, where the
 * position lives, the market line and the server's preview drawn as bars.
 */
import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { StepCard } from '../CreateShell';
import type { CreateFlow } from '../useCreateFlow';
import { BinChart, BinLegend, type RangeHandles } from '@/components/mesh/charts/BinChart';
import { ChoiceCards, EngineLine, LinkButton, NoteBox, TierChips } from '@/components/mesh/kit';
import { FEE_TIERS } from '@/lib/mesh/presets';
import { formatPrice } from '@/lib/mesh/create/price';

/** "Market price 1 BCH = 269.27 pUSD", or that there is none. */
export function marketSub(flow: CreateFlow): ReactNode {
  return flow.marketP
    ? <>Market price 1 BCH = <span className="font-mono text-sky-300">{formatPrice(flow.marketP)}</span> {flow.main.symbol}</>
    : `No market price for ${flow.main.symbol}: set the prices by hand`;
}

export function FeeCard({ flow, sub }: { flow: CreateFlow; sub?: ReactNode }) {
  return (
    <StepCard id="fee" title="Pool fee" sub={sub ?? 'Charged to the trader on every fill, on top of your price.'}>
      <TierChips
        label="Pool fee"
        value={flow.values.feeBps ?? '30'}
        onChange={v => flow.set('feeBps', v)}
        options={FEE_TIERS.map(t => ({ value: String(t.bps), label: t.label, hint: t.name }))}
      />
    </StepCard>
  );
}

export function ProceedsCard({ flow, wallet, recycle, title = 'What happens after a fill' }: {
  flow: CreateFlow;
  /** what "to my wallet" means here */
  wallet: { title: string; line: string };
  /** what "keep in Mesh" means here */
  recycle: { title: string; line: string };
  title?: string;
}) {
  return (
    <StepCard id="proceeds" title={title}>
      <ChoiceCards
        label="Proceeds"
        value={flow.values.proceeds === 'recycle' ? 'recycle' : 'wallet'}
        onChange={v => flow.set('proceeds', v)}
        options={[
          { value: 'wallet', title: wallet.title, line: wallet.line },
          { value: 'recycle', title: recycle.title, line: recycle.line },
        ]}
      />
    </StepCard>
  );
}

export function EngineCard({ flow, note }: { flow: CreateFlow; note?: ReactNode }) {
  const { engine, engines } = flow;
  return (
    <StepCard id="engine" title="Where it lives">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <EngineLine engine={engine} />
        {engines.length > 1 && (
          <LinkButton onClick={() => flow.setEngine(engine === 'v4' ? 'v3' : 'v4')}>
            {engine === 'v4' ? 'Use V3 pools instead' : 'Use V4 bins instead'}
          </LinkButton>
        )}
      </div>
      <p className="mt-2 text-xs text-zinc-400">
        {engine === 'v4'
          ? 'The bins trade in place, both ways. Whoever holds the position NFT controls them: sending the NFT sends the position.'
          : 'Each pool is a covenant only this wallet can withdraw from. Solvers trade with it at its prices.'}
      </p>
      {note}
      {flow.v4Off && flow.def.engines.includes('v4') && (
        <NoteBox tone="info" className="mt-3">V4 bins are not set up on this Mesh server, so this uses V3 pools.</NoteBox>
      )}
      {flow.replaces && (
        <NoteBox tone="info" className="mt-3">A rebalance stays on V3 pools: one transaction closes the old pools and funds the new ones.</NoteBox>
      )}
    </StepCard>
  );
}

/** The server's preview of these settings as bars on the price axis (grid rungs, ladder steps). */
export function PreviewChart({ flow, handles, unit, height = 220 }: { flow: CreateFlow; handles?: RangeHandles; unit: string; height?: number }) {
  const bins = flow.previewBins;
  const loading = flow.settingsChecking && bins.length === 0;
  return (
    <div className="space-y-2">
      <div className="relative">
        <BinChart
          bins={bins}
          marketP={flow.marketP}
          handles={handles}
          symbol={flow.main.symbol}
          height={height}
          ariaLabel={bins.length ? `${bins.length} ${unit}s from 1 BCH = ${formatPrice(Math.min(...bins.map(b => b.minP)))} to ${formatPrice(Math.max(...bins.map(b => b.maxP)))} ${flow.main.symbol}` : `${unit}s chart`}
          emptyText={flow.settingsError ?? (loading ? '' : `Set the prices to see the ${unit}s`)}
        />
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center gap-2 text-xs text-zinc-400" aria-live="polite">
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />Asking Mesh for the {unit}s…
          </span>
        )}
      </div>
      <BinLegend symbol={flow.main.symbol} />
    </div>
  );
}

/** Count line under a ladder chart: "4 rungs · 3 hold BCH · 1 holds pUSD". */
export function SideCounts({ flow, unit }: { flow: CreateFlow; unit: string }) {
  const pools = flow.layoutPreview.data?.pools;
  if (!pools?.length) return null;
  const ask = pools.filter(p => p.deposit.token).length;
  const bid = pools.length - ask;
  const plural = (n: number) => `${n} ${unit}${n === 1 ? '' : 's'}`;
  return (
    <p className="text-xs text-zinc-300" aria-live="polite">
      <span className="font-mono font-semibold text-white">{plural(pools.length)}</span>
      {bid > 0 && <> · <span className="text-emerald-300">{bid} hold{bid === 1 ? 's' : ''} BCH</span></>}
      {ask > 0 && <> · <span className="text-cyan-300">{ask} hold{ask === 1 ? 's' : ''} {flow.main.symbol}</span></>}
    </p>
  );
}
