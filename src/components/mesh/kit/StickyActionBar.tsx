/**
 * The step's main action. On phones and tablets it is pinned to the bottom of
 * the screen with a one-line summary ("20 bins · ±5% · Continue"); on wide
 * screens it renders where it is placed.
 */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function StickyActionBar({ summary, children, className }: { summary?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <>
      {/* wide screens: inline */}
      <div className={cn('hidden lg:flex items-center justify-between gap-3', className)}>
        {summary ? <div className="min-w-0 text-xs text-zinc-400">{summary}</div> : <span />}
        <div className="flex items-center gap-2">{children}</div>
      </div>
      {/* narrow screens: pinned; the spacer keeps the last field above the bar */}
      <div className="h-20 lg:hidden" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[#0c0c10]/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))' }}>
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-4 pt-3">
          {summary ? <div className="min-w-0 truncate text-xs text-zinc-300">{summary}</div> : <span />}
          <div className="flex shrink-0 items-center gap-2">{children}</div>
        </div>
      </div>
    </>
  );
}
