/**
 * The signing modal for a create flow: what the transaction does (built and
 * checked in this browser), then the steps as they run, then the result.
 * Wraps the deploy hooks; no signing code of its own.
 */
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gem, ShieldCheck } from 'lucide-react';
import { ActionButton, SigningModal, SummaryRows, V3_SIGN_STEPS, V4_SIGN_STEPS } from '@/components/mesh/kit';
import { formatNumber, formatSatsCompact, formatUnits, shortHex } from '@/lib/mesh/format';
import { meshPaths } from '@/lib/mesh/routes';
import type { CreateFlow } from './useCreateFlow';

function V3Review({ flow }: { flow: CreateFlow }) {
  const r = flow.v3.review;
  if (!r) return null;
  const pools = r.preview.pools;
  const tokens = Object.entries(r.preview.totals.tokens);
  return (
    <div className="space-y-3">
      <SummaryRows rows={[
        { label: 'Into the pools', value: `${formatSatsCompact(r.preview.totals.sats)}${tokens.map(([c, a]) => ` + ${formatUnits(a, flow.infoOf(c).decimals)} ${flow.infoOf(c).symbol}`).join('')}`, strong: true },
        { label: 'Pools', value: `${pools.length}` },
        flow.replaces ? { label: 'Closes', value: 'Every pool of the current strategy' } : null,
        { label: 'Network fee', value: `${r.built.fee.toString()} sats · ${formatNumber(r.built.size, 0)} bytes` },
        { label: 'Withdraw', value: 'Any time, by this wallet only', tone: 'good' },
      ]} />
      <details className="rounded-xl border border-white/[0.06] bg-black/30 px-3 py-2 text-xs">
        <summary className="cursor-pointer select-none text-zinc-300 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">Show the {pools.length} outputs</summary>
        <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto pr-1 font-mono text-[11px]">
          {pools.map((p, i) => (
            <li key={p.address} className="flex justify-between gap-3 text-zinc-400">
              <span>#{i} {p.role}</span>
              <span className="text-zinc-200">{p.deposit.token ? `${formatUnits(p.deposit.token.amount, flow.infoOf(p.deposit.token.category).decimals)} ${flow.infoOf(p.deposit.token.category).symbol}` : formatSatsCompact(p.deposit.sats)}</span>
            </li>
          ))}
        </ul>
      </details>
      <p className="flex gap-2 text-[11px] text-emerald-300"><ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />Every pool was rebuilt in this browser from the audited contract and is owned by this wallet.</p>
    </div>
  );
}

function V4Review({ flow }: { flow: CreateFlow }) {
  const r = flow.v4.review;
  if (!r) return null;
  const { plan, built } = r;
  const sym = flow.main.symbol;
  const nftSats = BigInt(plan.outputs[0]?.valueSatoshis ?? '0') + BigInt(plan.outputs[1]?.valueSatoshis ?? '0');
  return (
    <div className="space-y-3">
      <div className="flex gap-2 rounded-xl border border-violet-500/25 bg-violet-500/10 px-3 py-2.5 text-xs text-violet-100">
        <Gem className="h-4 w-4 shrink-0 text-violet-300" aria-hidden />
        <span>The position NFT goes to this wallet (category {shortHex(plan.category)}). Sending it sends the position; burning it locks the funds for good.</span>
      </div>
      <SummaryRows rows={[
        { label: 'Into the bins', value: `${formatSatsCompact(plan.totals.sats)}${BigInt(plan.totals.tokens) > 0n ? ` + ${formatUnits(plan.totals.tokens, flow.main.decimals)} ${sym}` : ''}`, strong: true },
        { label: 'Bins', value: `${plan.bins.length} (${plan.totals.bidBins} BCH · ${plan.totals.askBins} ${sym})` },
        { label: 'NFT and metadata', value: formatSatsCompact(nftSats), hint: 'The NFT output keeps 1,000 sats; 800 go to the Mesh metadata key' },
        { label: 'Network fee', value: `${built.fee.toString()} sats · ${formatNumber(built.size, 0)} bytes` },
      ]} />
      <p className="flex gap-2 text-[11px] text-emerald-300"><ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />Every bin was rebuilt in this browser, priced on the grid and owned by the new NFT.</p>
    </div>
  );
}

export function SignFlow({ flow, open, onOpenChange }: { flow: CreateFlow; open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const d = flow.deploy;
  const p = d.progress;
  const v4 = flow.engine === 'v4';
  const close = () => { d.closeReview(); onOpenChange(false); };
  const retry = () => {
    if (!p.failed) return;
    if (p.failed.phase === 'signing' && d.hasReview) void d.confirm();
    else void d.openReview();
  };
  const busy = p.phase !== 'review' && p.phase !== 'done' && !p.failed;

  let footer: ReactNode = null;
  if (p.phase === 'done' && flow.created) {
    footer = (
      <>
        <ActionButton variant="outline" onClick={() => onOpenChange(false)}>Close</ActionButton>
        <ActionButton onClick={() => navigate(flow.created!.url)}>{v4 ? 'View position' : 'View strategy'}</ActionButton>
      </>
    );
  } else if (p.failed?.phase === 'listing') {
    footer = (
      <>
        <ActionButton variant="outline" onClick={() => onOpenChange(false)}>Close</ActionButton>
        {flow.created
          ? <ActionButton onClick={() => navigate(flow.created!.url)}>View position</ActionButton>
          : <ActionButton onClick={() => navigate(meshPaths.positions())}>My positions</ActionButton>}
      </>
    );
  } else if (p.failed) {
    footer = (
      <>
        <ActionButton variant="outline" onClick={close}>Close</ActionButton>
        <ActionButton onClick={retry}>Try again</ActionButton>
      </>
    );
  } else if (d.hasReview && p.phase === 'review') {
    footer = (
      <>
        <ActionButton variant="outline" onClick={close}>Cancel</ActionButton>
        <ActionButton onClick={() => void d.confirm()} testId="sign-confirm">
          {flow.replaces ? 'Sign and rebalance' : v4 ? 'Sign and open the position' : 'Sign and create'}
        </ActionButton>
      </>
    );
  }

  return (
    <SigningModal
      open={open}
      onOpenChange={o => (o ? onOpenChange(true) : busy ? undefined : close())}
      title={flow.replaces ? 'Rebalance the strategy' : v4 ? 'Open a V4 position' : `Create ${flow.def.name.toLowerCase()}`}
      description={v4
        ? 'One transaction mints the position NFT and funds every bin.'
        : flow.replaces
          ? 'One transaction closes the current pools and funds the new ones.'
          : 'One transaction funds every pool. Solvers can trade with them as soon as Mesh lists them.'}
      steps={v4 ? V4_SIGN_STEPS : V3_SIGN_STEPS}
      progress={p}
      footer={footer}
    >
      {p.phase === 'review' && !p.failed ? (v4 ? <V4Review flow={flow} /> : <V3Review flow={flow} />) : null}
      {p.failed?.phase === 'listing' && (
        <p className="text-xs text-amber-200">
          The transaction is on chain{p.txid ? ` (${shortHex(p.txid)})` : ''}, but Mesh hasn't listed it yet. {v4 ? 'The position page keeps retrying.' : 'My positions keeps retrying.'}
        </p>
      )}
    </SigningModal>
  );
}
