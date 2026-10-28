/**
 * An inline message next to what it is about: info, warning, error or success.
 * Errors say what went wrong and what to do next.
 */
import type { ReactNode } from 'react';
import { CheckCircle2, Info, TriangleAlert, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type NoteTone = 'info' | 'warn' | 'error' | 'success';

const TONE: Record<NoteTone, { cls: string; Icon: typeof Info }> = {
  info: { cls: 'border-white/10 bg-white/[0.04] text-zinc-300', Icon: Info },
  warn: { cls: 'border-amber-400/30 bg-amber-500/10 text-amber-100', Icon: TriangleAlert },
  error: { cls: 'border-rose-400/30 bg-rose-500/10 text-rose-100', Icon: XCircle },
  success: { cls: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100', Icon: CheckCircle2 },
};

export function NoteBox({ tone = 'info', title, children, className, icon = true }: {
  tone?: NoteTone; title?: ReactNode; children?: ReactNode; className?: string; icon?: boolean;
}) {
  const { cls, Icon } = TONE[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'note'} className={cn('flex gap-2.5 rounded-xl border px-3.5 py-3 text-[13px] leading-relaxed', cls, className)}>
      {icon && <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
      <div className="min-w-0 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  );
}
