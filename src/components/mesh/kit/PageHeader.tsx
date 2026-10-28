/**
 * A Mesh page header: back link, title, one line under it, actions on the right
 * (stacked under the title on phones).
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PageHeader({ back, title, sub, actions, badges, className }: {
  back?: { to: string; label: string };
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  badges?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('space-y-3', className)}>
      {back && (
        <Link to={back.to} className="inline-flex items-center gap-1.5 rounded text-xs text-zinc-400 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-emerald-400">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />{back.label}
        </Link>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-white sm:text-3xl [text-wrap:balance]">{title}</h1>
          {badges && <div className="flex flex-wrap items-center gap-2">{badges}</div>}
          {sub && <p className="max-w-2xl text-[13px] text-zinc-400">{sub}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
