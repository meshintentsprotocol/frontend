/**
 * After a create flow signs: what was made, where to see it, and the next
 * thing to do (MeshDocs/meshv3v4flow/04 §2 "Success").
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, CheckCircle2, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { ActionButton, BigButton, EngineBadge, NoteBox, SummaryRows } from '@/components/mesh/kit';
import { explorerTx, shortHex } from '@/lib/mesh/format';
import { meshPaths } from '@/lib/mesh/routes';
import type { CreateFlow } from './useCreateFlow';
import { depositTotals } from './CreateSummary';
import { settingsSummary } from './SettingsStep';

export function SuccessView({ flow }: { flow: CreateFlow }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const c = flow.created!;
  const txid = flow.deploy.progress.txid;
  const totals = depositTotals(flow);
  const link = typeof window !== 'undefined' ? `${window.location.origin}${c.url}` : c.url;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy the link', { description: link });
    }
  };

  const what = flow.replaces ? 'Strategy rebalanced' : c.kind === 'position' ? 'Position created' : 'Strategy created';
  return (
    <div className="mx-auto max-w-[560px] space-y-5 rounded-3xl border border-white/[0.07] bg-white/[0.035] p-5 sm:p-7" role="status">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300" aria-hidden>
          <CheckCircle2 className="h-7 w-7" />
        </span>
        <h2 className="font-heading text-2xl font-bold text-white">{what}</h2>
        <p className="max-w-sm text-sm text-zinc-400">
          {c.kind === 'position'
            ? 'Your bins are on chain and the position NFT is in your wallet. Solvers can trade with it as soon as Mesh lists it.'
            : 'Your pools are on chain. Solvers can trade with them as soon as Mesh lists them.'}
        </p>
      </div>

      {c.pending && (
        <NoteBox tone="warn">The transaction is on chain but Mesh hasn't listed it yet. The position page keeps retrying.</NoteBox>
      )}

      <SummaryRows rows={[
        { label: 'Pair', value: `BCH / ${flow.main.symbol}` },
        { label: 'Strategy', value: <span className="inline-flex items-center gap-2 font-sans">{flow.def.name}<EngineBadge engine={flow.engine} /></span> },
        { label: flow.strategy === 'range' ? 'Range' : 'Settings', value: settingsSummary(flow) },
        totals.text ? { label: 'Deposited', value: totals.text, strong: true } : null,
        txid ? {
          label: 'Transaction',
          value: (
            <a href={explorerTx(flow.wallet.network, txid)} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-emerald-300 underline-offset-2 hover:underline">
              {shortHex(txid)}<ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          ),
        } : null,
      ]} />

      <div className="space-y-2.5">
        <BigButton onClick={() => navigate(c.url)}>{c.kind === 'position' ? 'View position' : 'View strategy'}</BigButton>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ActionButton variant="outline" onClick={copy}>
            {copied ? <Check className="h-4 w-4 text-emerald-300" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            {copied ? 'Link copied' : 'Copy link'}
          </ActionButton>
          <ActionButton variant="outline" onClick={() => navigate(meshPaths.create(undefined, { token: flow.mainToken }))}>
            Create another on BCH/{flow.main.symbol}
          </ActionButton>
        </div>
        <ActionButton variant="ghost" className="w-full" onClick={() => navigate(meshPaths.positions())}>Go to my positions</ActionButton>
      </div>
    </div>
  );
}
