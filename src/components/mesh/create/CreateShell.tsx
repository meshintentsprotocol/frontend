/**
 * The create flow's page layout (MeshDocs/meshv3v4flow/09 §4):
 *
 * - ≥ 1280 px: step list | the step | sticky summary
 * - 1024–1279: step bar on top; the step | sticky summary
 * - < 1024: step bar on top; the step; the summary as a card under it (the
 *   step's main action is pinned to the bottom of the screen)
 */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { PageHeader, StepBar, StepList, type StepItem } from '@/components/mesh/kit';

export function CreateShell({ title, sub, back, actions, badges, steps, summary, children, className }: {
  title: ReactNode;
  sub?: ReactNode;
  back?: { to: string; label: string };
  actions?: ReactNode;
  badges?: ReactNode;
  steps?: StepItem[];
  summary?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mx-auto w-full max-w-[1200px] px-4 py-4 sm:py-6 md:px-8', className)}>
      <PageHeader back={back} title={title} sub={sub} actions={actions} badges={badges} />
      {steps && <StepBar steps={steps} className="mt-5 xl:hidden" />}
      <div className={cn(
        'mt-5 grid items-start gap-6 xl:mt-8',
        steps && summary ? 'lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[200px_minmax(0,1fr)_320px]'
          : steps ? 'xl:grid-cols-[200px_minmax(0,1fr)]'
          : summary ? 'lg:grid-cols-[minmax(0,1fr)_320px]' : '',
      )}>
        {steps && (
          <nav aria-label="Create steps" className="sticky top-24 hidden xl:block">
            <StepList steps={steps} />
          </nav>
        )}
        <div className="min-w-0 space-y-5">{children}</div>
        {summary && <aside className="min-w-0 space-y-4 lg:sticky lg:top-24" aria-label="Summary">{summary}</aside>}
      </div>
    </div>
  );
}

/** A section card inside a step: title, one line, then its controls. */
export function StepCard({ title, sub, action, children, className, id }: {
  title?: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn('rounded-3xl border border-white/[0.07] bg-white/[0.035] p-4 sm:p-5', className)} aria-labelledby={id && title ? `${id}-title` : undefined}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="min-w-0 space-y-0.5">
            {title && <h2 id={id ? `${id}-title` : undefined} className="font-heading text-[15px] font-semibold text-white">{title}</h2>}
            {sub && <p className="text-xs text-zinc-400">{sub}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
