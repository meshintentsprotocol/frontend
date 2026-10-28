/**
 * One signing modal for every Mesh transaction: the review (children) on top,
 * then the steps — build, check, sign and send, list with Mesh, done — each
 * ticked as it completes. A failed step stops with its message and a retry.
 */
import type { ReactNode } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ResponsiveDialog } from './ResponsiveDialog';

export type SignPhase = 'review' | 'building' | 'checking' | 'publishing' | 'signing' | 'listing' | 'done';

export interface SignStepDef { phase: Exclude<SignPhase, 'review'>; label: string; sub?: string }

export interface SignProgress {
  phase: SignPhase;
  /** set when a step failed: the phase it failed in, and why */
  failed?: { phase: SignPhase; message: string };
  txid?: string;
}

export const V3_SIGN_STEPS: SignStepDef[] = [
  { phase: 'building', label: 'Build the transaction' },
  { phase: 'checking', label: 'Check every pool in this browser' },
  { phase: 'signing', label: 'Sign and send', sub: 'One signature in your wallet' },
  { phase: 'listing', label: 'List with Mesh', sub: 'So solvers can route trades to it' },
  { phase: 'done', label: 'Done' },
];

export const V4_SIGN_STEPS: SignStepDef[] = [
  { phase: 'building', label: 'Plan the bins and the NFT' },
  { phase: 'checking', label: 'Check every bin in this browser' },
  { phase: 'publishing', label: 'Publish the NFT metadata' },
  { phase: 'signing', label: 'Sign and send', sub: 'One signature in your wallet' },
  { phase: 'listing', label: 'List with Mesh', sub: 'So solvers can route trades to it' },
  { phase: 'done', label: 'Done', sub: 'The position NFT is in your wallet' },
];

const ORDER: SignPhase[] = ['review', 'building', 'checking', 'publishing', 'signing', 'listing', 'done'];

function stateOf(step: SignStepDef, p: SignProgress): 'done' | 'current' | 'todo' | 'failed' {
  if (p.failed && p.failed.phase === step.phase) return 'failed';
  const at = ORDER.indexOf(p.failed?.phase ?? p.phase);
  const me = ORDER.indexOf(step.phase);
  if (p.phase === 'done') return 'done';
  if (me < at) return 'done';
  if (me === at) return p.failed ? 'todo' : 'current';
  return 'todo';
}

export function SignSteps({ steps, progress, className }: { steps: SignStepDef[]; progress: SignProgress; className?: string }) {
  if (progress.phase === 'review' && !progress.failed) return null;
  return (
    <ol className={cn('space-y-1', className)} aria-label="Progress">
      {steps.map(s => {
        const st = stateOf(s, progress);
        return (
          <li key={s.phase} className="flex items-start gap-3 py-1.5" aria-current={st === 'current' ? 'step' : undefined}>
            <span aria-hidden className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs',
              st === 'done' && 'bg-emerald-500/15 text-emerald-300',
              st === 'current' && 'border-2 border-emerald-400 text-emerald-300',
              st === 'failed' && 'bg-rose-500/15 text-rose-300',
              st === 'todo' && 'border border-white/15 text-zinc-500',
            )}>
              {st === 'done' ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : st === 'current' ? <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" /> : st === 'failed' ? <X className="h-3.5 w-3.5" /> : null}
            </span>
            <span className="flex flex-col">
              <span className={cn('text-sm', st === 'todo' ? 'text-zinc-400' : 'text-white')}>{s.label}</span>
              {st === 'failed' && progress.failed ? <span className="text-xs text-rose-300">{progress.failed.message}</span>
                : s.sub ? <span className="text-xs text-zinc-500">{s.sub}</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function SigningModal({ open, onOpenChange, title, description, steps, progress, children, footer }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  steps: SignStepDef[];
  progress: SignProgress;
  /** the review: what is deposited, owned, paid */
  children?: ReactNode;
  /** the action buttons (Sign / Retry / View position) */
  footer?: ReactNode;
}) {
  const busy = progress.phase !== 'review' && progress.phase !== 'done' && !progress.failed;
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title={title} description={description} busy={busy}>
      <div className="space-y-4 text-sm">
        {children}
        <SignSteps steps={steps} progress={progress} />
        {footer && <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </ResponsiveDialog>
  );
}
