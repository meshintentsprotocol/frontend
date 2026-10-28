/**
 * Step ③ (MeshDocs/meshv3v4flow/08 §2): the deposit cards the strategy needs,
 * linked for a two-sided range, the plan the server returns for these amounts
 * (checked in this browser), warnings, then "Review and sign".
 */
import { useState } from 'react';
import { Link2, Link2Off, Loader2 } from 'lucide-react';
import { AmountCard, BigButton, LinkButton, NoteBox, StickyActionBar, SummaryRows, ActionButton, type SummaryRow } from '@/components/mesh/kit';
import { formatNumber, formatSatsCompact, formatUnits, formatUsd } from '@/lib/mesh/format';
import { toBaseUnits } from '@/lib/mesh/v3/strategyForms';
import type { DepositCard } from '@/lib/mesh/create/deposits';
import type { CreateFlow } from './useCreateFlow';
import { StepCard } from './CreateShell';
import { SignFlow } from './SignFlow';
import { depositTotals } from './CreateSummary';

function units(text: string | undefined, dec: number): bigint | null {
  try { return toBaseUnits(text ?? '', dec); } catch { return null; }
}

/** The short label of the main button: what to do next, or "Review and sign". */
function actionLabel(flow: CreateFlow): string {
  const d = flow.deploy;
  if (!flow.wallet.signer) return 'Connect a wallet';
  if (flow.input.error) return flow.input.error.length <= 40 ? flow.input.error : 'Check the amounts';
  if (d.previewing && !d.verified) return 'Checking…';
  if (d.validation) {
    if (/^Not enough/.test(d.validation)) return d.validation.replace(/ \(.*\)$/, '');
    if (d.needsCross && /Deploy anyway/.test(d.validation)) return 'Confirm the warning above';
    return "Can't create yet";
  }
  if (!d.verified?.ok) return 'Checking…';
  return flow.replaces ? 'Review and rebalance' : 'Review and sign';
}

export function DepositReviewStep({ flow }: { flow: CreateFlow }) {
  const [signOpen, setSignOpen] = useState(false);
  const [typed, setTyped] = useState<string | null>(null);
  const { cards, values, balances, deploy: d, engine, main } = flow;
  const sym = main.symbol;
  const usdBch = flow.marketCtx?.bchUsd ?? null;
  const usdToken = flow.marketCtx?.tokenUsd ?? null;

  const balanceOf = (c: DepositCard): bigint | null => {
    if (!balances) return null;
    return c.asset === 'bch' ? balances.sats : balances.tokens[values[c.asset] ?? ''] ?? 0n;
  };
  const cardError = (c: DepositCard): string | null => {
    const raw = (values[c.key] ?? '').trim();
    if (!raw) return null;
    const u = units(raw, flow.decOfCard(c));
    if (u === null) return `At most ${flow.decOfCard(c)} decimals`;
    const b = balanceOf(c);
    if (b !== null && u > b) return 'More than your balance';
    return null;
  };
  const usdOf = (c: DepositCard): string | null => {
    const u = units(values[c.key], flow.decOfCard(c));
    if (!u) return null;
    const rate = c.asset === 'bch' ? usdBch : c.asset === 'token' ? usdToken : null;
    return rate ? `≈ ${formatUsd((Number(u) / 10 ** flow.decOfCard(c)) * rate)}` : null;
  };

  const review = () => { setSignOpen(true); void d.openReview(); };

  // the plan for these amounts, from the server, checked here
  const v3p = engine === 'v3' ? flow.v3.preview.data : undefined;
  const v4p = engine === 'v4' ? flow.v4.preview.data : undefined;
  const unit = engine === 'v4' ? 'Bins' : 'Pools';
  const planRows: Array<SummaryRow | null> = [];
  if (v3p) {
    const tokens = Object.entries(v3p.totals.tokens);
    planRows.push(
      { key: 'in', label: 'Into the pools', value: `${formatSatsCompact(v3p.totals.sats)}${tokens.map(([c, a]) => ` + ${formatUnits(a, flow.infoOf(c).decimals)} ${flow.infoOf(c).symbol}`).join('')}`, strong: true },
      { key: 'n', label: unit, value: `${v3p.pools.length}` },
      v3p.deployBytes ? { key: 'size', label: 'Transaction size', value: `~${formatNumber(v3p.deployBytes, 0)} bytes`, tone: 'muted' } : null,
    );
  }
  if (v4p) {
    planRows.push(
      { key: 'in', label: 'Into the bins', value: `${formatSatsCompact(v4p.totals.sats)}${BigInt(v4p.totals.tokens) > 0n ? ` + ${formatUnits(v4p.totals.tokens, main.decimals)} ${sym}` : ''}`, strong: true, hint: 'BCH includes the 1,000-sat carrier each token bin holds' },
      { key: 'n', label: unit, value: `${v4p.bins.length} (${v4p.totals.bidBins} BCH · ${v4p.totals.askBins} ${sym})` },
      { key: 'nft', label: 'You will own', value: 'A position NFT in this wallet' },
      { key: 'size', label: 'Transaction size', value: `~${formatNumber(v4p.estimatedBytes, 0)} bytes`, tone: 'muted' },
    );
  }
  if (d.verified) {
    planRows.push(d.verified.ok
      ? { key: 'check', label: 'Checked in this browser', value: engine === 'v4' ? 'Every bin and the NFT' : 'Every pool and its owner', tone: 'good' }
      : { key: 'check', label: 'Checked in this browser', value: 'Refused', tone: 'bad' });
  }
  if (!v3p && !v4p && d.previewing) {
    planRows.push({ key: 'checking', label: engine === 'v4' ? 'Planning the bins' : 'Previewing the pools', value: <span className="inline-flex items-center gap-1.5 font-sans text-zinc-400"><Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden />Checking with Mesh…</span> });
  }
  planRows.push({ key: 'fee', label: 'Network fee', value: 'Shown before you sign', tone: 'muted' });

  const totals = depositTotals(flow);
  const label = actionLabel(flow);

  return (
    <>
      <StepCard id="deposit" title="Deposit" sub={flow.oneSided ?? (flow.twoSided ? 'Each side of the range holds one asset.' : undefined)}>
        {flow.replaces && (
          <NoteBox tone="info" className="mb-4" title="Rebalance">
            <p>One transaction closes the current strategy's pools and funds these. The wallet adds whatever the new pools need beyond what the old ones hold, plus the fee.</p>
            {flow.holdings && (
              <LinkButton className="mt-1" onClick={flow.applyHoldings}>
                Use what the position holds ({formatSatsCompact(flow.holdings.sats)}{flow.mainToken && flow.holdings.tokens[flow.mainToken] ? ` + ${formatUnits(flow.holdings.tokens[flow.mainToken]!, main.decimals)} ${sym}` : ''})
              </LinkButton>
            )}
          </NoteBox>
        )}
        <div className="space-y-3">
          {cards.map(c => {
            const info = c.asset === 'bch' ? 'BCH' as const : flow.infoOf(values[c.asset] ?? '');
            const b = balanceOf(c);
            const auto = flow.twoSided && flow.linked && typed !== null && typed !== c.key && !!(values[c.key] ?? '').trim();
            return (
              <AmountCard
                key={c.key}
                id={`deposit-${c.key}`}
                label={c.label}
                asset={info}
                value={values[c.key] ?? ''}
                onChange={v => { setTyped(c.key); flow.setDeposit(c.key, v); }}
                balance={b !== null ? formatUnits(b, flow.decOfCard(c)) : flow.wallet.signer ? '…' : null}
                onFraction={b !== null ? f => { setTyped(c.key); flow.setFraction(c.key, f); } : undefined}
                usd={usdOf(c)}
                linkedNote={auto ? `Filled in to match the ${c.asset === 'bch' ? sym : 'BCH'} amount` : null}
                error={cardError(c)}
              />
            );
          })}
        </div>
        {flow.twoSided && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
            <span className="inline-flex items-center gap-1.5">
              {flow.linked ? <Link2 className="h-3.5 w-3.5 text-emerald-300" aria-hidden /> : <Link2Off className="h-3.5 w-3.5" aria-hidden />}
              {flow.linked ? 'Linked: every bin holds the same value at the market price' : 'Set separately'}
            </span>
            <LinkButton onClick={() => flow.setLinked(!flow.linked)}>{flow.linked ? 'Set separately' : 'Link the amounts'}</LinkButton>
          </div>
        )}
        {!flow.wallet.signer && (
          <NoteBox tone="info" className="mt-3">Connect a BCH wallet to see your balances and create the position.</NoteBox>
        )}
      </StepCard>

      <StepCard id="review" title="Review" sub={engine === 'v4' ? 'Planned by Mesh for these amounts, then checked here.' : 'Previewed by Mesh for these amounts, then checked here.'}>
        <SummaryRows rows={planRows} />
        {flow.wallet.signer && flow.input.error && flow.input.error.length > 40 && (
          <NoteBox tone="info" className="mt-3">{flow.input.error}</NoteBox>
        )}
        {d.warnings.length > 0 && (
          <NoteBox tone="warn" className="mt-3" title={engine === 'v3' ? 'Priced through the market' : 'From the planner'}>
            {d.warnings.map(w => <p key={w}>{w}</p>)}
            {engine === 'v3' && (
              <label className="mt-2 flex cursor-pointer items-start gap-2 text-amber-50">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-amber-400" checked={flow.v3.acceptCross} onChange={e => flow.v3.setAcceptCross(e.target.checked)} />
                Deploy anyway: I want these pools filled at these prices
              </label>
            )}
          </NoteBox>
        )}
        {d.notes.length > 0 && <NoteBox tone="info" className="mt-3">{d.notes.map(n => <p key={n}>{n}</p>)}</NoteBox>}
        {d.validation && flow.wallet.signer && !flow.input.error && !(d.needsCross && /Deploy anyway/.test(d.validation)) && (
          <NoteBox tone={/^Not enough/.test(d.validation) ? 'warn' : 'error'} className="mt-3">{d.validation}</NoteBox>
        )}
        {engine === 'v4' && flow.v4.needsSeed && (
          <NoteBox tone="info" className="mt-3">Your wallet first pays itself once to make the output the NFT is minted from (a few hundred sats of fee).</NoteBox>
        )}
        {d.error && !signOpen && <NoteBox tone="error" className="mt-3">{d.error}</NoteBox>}
      </StepCard>

      <div className="hidden lg:block">
        <BigButton onClick={review} disabled={!flow.canReview} loading={!!d.busy && !signOpen} testId="review-sign">{label}</BigButton>
        {totals.text && <p className="mt-2 text-center text-xs text-zinc-500">{totals.text}{totals.usd !== null ? ` · ${formatUsd(totals.usd)}` : ''}</p>}
      </div>
      <StickyActionBar inline={false} summary={totals.text || 'Enter an amount'}>
        <ActionButton onClick={review} disabled={!flow.canReview}>{label}</ActionButton>
      </StickyActionBar>

      <SignFlow flow={flow} open={signOpen} onOpenChange={setSignOpen} />
    </>
  );
}
