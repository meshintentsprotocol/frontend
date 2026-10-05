import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Client-side paging over an in-memory list. The page snaps back into range
 * when the list shrinks, and to the first page when `resetKey` changes (a
 * filter or tab switch).
 */
export function usePagination<T>(items: T[], pageSize: number, resetKey?: unknown) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  useEffect(() => { setPage(1); }, [resetKey]);
  const current = Math.min(page, pageCount);
  return {
    page: current,
    pageCount,
    setPage,
    pageItems: items.slice((current - 1) * pageSize, current * pageSize),
  };
}

/** Previous / next controls with a "2 / 5" readout. Renders nothing for a single page. */
export function Pager({ page, pageCount, onPage, className }: {
  page: number; pageCount: number; onPage: (page: number) => void; className?: string;
}) {
  if (pageCount <= 1) return null;
  const button = 'flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-zinc-400 transition-colors hover:bg-white/[0.07] hover:text-white disabled:opacity-30 disabled:hover:bg-white/[0.03] disabled:hover:text-zinc-400';
  return (
    <nav aria-label="Pagination" className={cn('flex items-center justify-center gap-3', className)}>
      <button type="button" className={button} onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      <span className="font-mono text-[11px] text-zinc-400 tabular-nums" aria-live="polite">{page} / {pageCount}</span>
      <button type="button" className={button} onClick={() => onPage(page + 1)} disabled={page >= pageCount} aria-label="Next page">
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </nav>
  );
}
