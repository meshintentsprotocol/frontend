import { useState } from 'react';
import { Activity, StickyNote } from 'lucide-react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useAdmin } from '../AdminContext';
import { useAdminAction, useOverview } from '../hooks';
import { PageHeader, Section, QueryState, Segmented, SearchBox, useUrlState, CATEGORY, ActionButton } from '../kit';
import { EventFeed } from '../EventFeed';
import { HourlyEventsChart } from '../charts';
import type { EventCategory, OpsEvent } from '../api';

const PAGE = 100;

function NoteForm() {
  const { api } = useAdmin();
  const [text, setText] = useState('');
  const note = useAdminAction((t: string) => api.note(t), { label: 'Note', success: () => 'Note added to the event log' });
  return (
    <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (text.trim()) { note.run(text.trim()); setText(''); } }}>
      <label htmlFor="ops-note" className="sr-only">Operator note</label>
      <input id="ops-note" value={text} onChange={e => setText(e.target.value)} maxLength={500} placeholder="Add an operator note (e.g. deploy, incident, config change)"
        className="flex-1 h-8 px-3 rounded-lg bg-white/[0.03] border border-white/[0.08] text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-400/50" />
      <ActionButton icon={<StickyNote className="w-3.5 h-3.5" />} pending={note.isPending} disabled={!text.trim()} onClick={() => { if (text.trim()) { note.run(text.trim()); setText(''); } }}>Add note</ActionButton>
    </form>
  );
}

export function EventsPage() {
  const { api, interval } = useAdmin();
  const overview = useOverview();
  const [f, set] = useUrlState({ category: '', severity: '', q: '', subject: '' });
  const [older, setOlder] = useState<OpsEvent[]>([]);
  const query = { category: f.category, severity: f.severity, q: f.q, subject: f.subject, limit: PAGE };
  const q = useQuery({
    queryKey: ['admin', 'events', query], queryFn: () => api.events(query), refetchInterval: interval(), placeholderData: keepPreviousData,
  });
  const counts = q.data?.counts24h.byCategory ?? {};
  const loadOlder = async () => {
    const last = [...(q.data?.events ?? []), ...older].at(-1);
    if (!last) return;
    const r = await api.events({ ...query, before: last.seq });
    setOlder(o => [...o, ...r.events]);
  };
  const reset = (patch: Record<string, string>) => { setOlder([]); set(patch); };

  return (
    <>
      <PageHeader title="Events" icon={<Activity className="w-5 h-5 text-emerald-300" />}
        description="Everything the server did: intent transitions, fills and who filled them, refunds, pool deposits / fills / withdrawals, strategy deploys, rebalances and recycles, route changes, TWAP orders and admin actions." />
      {overview.data && (
        <Section title="Last 24 hours" description={`${overview.data.events.h24.total} events`}>
          <HourlyEventsChart hourly={overview.data.events.hourly} height={150} />
        </Section>
      )}
      <Section
        title="Event log"
        description={q.data ? `${q.data.total} matching · newest first · refreshes with the console` : undefined}
        actions={<SearchBox value={f.q} onChange={v => reset({ q: v })} placeholder="Search summary or id" className="w-56" />}>
        <div className="space-y-3">
          <Segmented label="Category" value={f.category} onChange={v => reset({ category: v })}
            options={[{ value: '', label: 'All', count: q.data?.counts24h.total }, ...(Object.keys(CATEGORY) as EventCategory[]).map(c => ({ value: c, label: CATEGORY[c].label, count: counts[c] ?? 0 }))]} />
          <div className="flex flex-wrap items-center gap-3">
            <Segmented label="Severity" value={f.severity} onChange={v => reset({ severity: v })}
              options={[{ value: '', label: 'Any' }, { value: 'error', label: 'Errors' }, { value: 'warn', label: 'Warnings' }, { value: 'success', label: 'Success' }, { value: 'info', label: 'Info' }]} />
            {f.subject && <button type="button" onClick={() => reset({ subject: '' })} className="text-xs text-emerald-300 hover:underline">Subject {f.subject.slice(0, 14)}… ✕</button>}
            <span className="text-[11px] text-zinc-600">Counts are for the last 24 h.</span>
          </div>
          <NoteForm />
          <QueryState q={q} rows={10}>
            {d => (
              <>
                <EventFeed events={[...d.events, ...older]} />
                {d.total > d.events.length + older.length && (
                  <div className="pt-3 text-center"><ActionButton onClick={() => void loadOlder()}>Load older events</ActionButton></div>
                )}
              </>
            )}
          </QueryState>
        </div>
      </Section>
    </>
  );
}
