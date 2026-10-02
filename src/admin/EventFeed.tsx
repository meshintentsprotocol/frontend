/**
 * The operations event stream as a list: when, what (category + severity, as
 * icon and text), the summary, the subject and related links, and the raw
 * payload on demand. Used on the Events page and every detail page.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OpsEvent } from './api';
import { CATEGORY, CategoryIcon, SeverityIcon, TimeAgo, EmptyBlock, refUrl, TxLink } from './kit';
import { shortHex } from '@/lib/mesh/format';

const REF_LABEL: Record<string, string> = { intent: 'Intent', pool: 'Pool', strategy: 'Strategy', twap: 'TWAP', lp: 'Owner', tx: 'Tx', route: 'Route', system: 'System' };

function RefChip({ kind, id }: { kind: string; id: string }) {
  if (kind === 'tx') return <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500">Tx <TxLink txid={id} /></span>;
  const to = refUrl({ kind: kind as any, id });
  const text = `${REF_LABEL[kind] ?? kind} ${id.length > 20 ? shortHex(id, 6, 4) : id}`;
  return to
    ? <Link to={to} onClick={e => e.stopPropagation()} className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-white/[0.08] text-zinc-400 hover:text-emerald-300 hover:border-emerald-400/30">{text}</Link>
    : <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-white/[0.06] text-zinc-500">{text}</span>;
}

export function EventRow({ e, compact }: { e: OpsEvent; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const related = (e.related ?? []).filter((r, i, a) => a.findIndex(x => x.kind === r.kind && x.id === r.id) === i && !(r.kind === e.subject.kind && r.id === e.subject.id));
  return (
    <li className={cn('group border-b border-white/[0.04] last:border-0', e.severity === 'error' && 'bg-rose-500/[0.03]')}>
      <div className="flex items-start gap-3 py-2.5">
        <div className="pt-0.5 flex items-center gap-1.5 shrink-0">
          <CategoryIcon category={e.category} />
          <SeverityIcon severity={e.severity} className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-[13px] text-zinc-100 leading-snug break-words">{e.summary}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-mono text-zinc-500">{e.type}</span>
            <span className="text-[10px] text-zinc-600">· {CATEGORY[e.category]?.label ?? e.category}</span>
            {!compact && <RefChip kind={e.subject.kind} id={e.subject.id} />}
            {!compact && related.slice(0, 6).map(r => <RefChip key={`${r.kind}:${r.id}`} kind={r.kind} id={r.id} />)}
            {!compact && related.length > 6 && <span className="text-[10px] text-zinc-600">+{related.length - 6}</span>}
          </div>
          {open && e.data && (
            <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-black/40 border border-white/[0.06] p-3 text-[11px] leading-relaxed text-zinc-300 font-mono whitespace-pre-wrap break-all">
              {JSON.stringify(e.data, null, 2)}
            </pre>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <TimeAgo at={e.at} unit="ms" />
          {e.data && (
            <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label={open ? 'Hide details' : 'Show details'}
              className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-white/5">
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-200', open && 'rotate-180')} />
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

export function EventFeed({ events, compact, empty }: { events: OpsEvent[]; compact?: boolean; empty?: string }) {
  if (!events.length) return <EmptyBlock title={empty ?? 'No events yet'}>Events are recorded from the moment the server runs this version.</EmptyBlock>;
  return <ul className="divide-y-0">{events.map(e => <EventRow key={e.id} e={e} compact={compact} />)}</ul>;
}

export function Timeline({ items }: { items: Array<{ at: number | null; label: string; detail?: string; txid?: string; tone?: 'emerald' | 'sky' | 'amber' | 'rose' | 'violet' | 'zinc' }> }) {
  const dot: Record<string, string> = { emerald: 'bg-emerald-400', sky: 'bg-sky-400', amber: 'bg-amber-400', rose: 'bg-rose-400', violet: 'bg-violet-400', zinc: 'bg-zinc-500' };
  return (
    <ol className="relative ml-1.5 border-l border-white/[0.08] space-y-4">
      {items.map((it, i) => (
        <li key={i} className="pl-4 relative">
          <span className={cn('absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full ring-4 ring-[#0b0d12]', dot[it.tone ?? 'sky'])} aria-hidden />
          <div className="flex flex-wrap items-center gap-x-2">
            <span className="text-[13px] font-medium text-zinc-100">{it.label}</span>
            {it.at ? <span className="text-[11px] text-zinc-500 tabular-nums">{new Date(it.at * 1000).toLocaleString()}</span> : null}
          </div>
          {it.detail && <div className="text-xs text-zinc-500 mt-0.5 break-words">{it.detail}</div>}
          {it.txid && <div className="mt-0.5"><TxLink txid={it.txid} /></div>}
        </li>
      ))}
    </ol>
  );
}
