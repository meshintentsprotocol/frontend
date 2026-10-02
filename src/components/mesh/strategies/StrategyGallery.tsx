/**
 * Create: the strategy templates (from the server) plus a custom V3 pool.
 * A strategy is a set of MeshPoolV3 pools deployed in one transaction and
 * managed as one position. Filters by category, a "keeps liquidity in Mesh"
 * toggle, and a three-question helper that highlights the best fits.
 */
import { useMemo, useState } from 'react';
import { BookOpen, Loader2, Sparkles, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStrategyTemplates } from '@/hooks/useMesh';
import { TEMPLATE_FORMS } from '@/lib/mesh/v3/strategyForms';
import { DefiCard, RecyclePill, TemplateIcon, TEMPLATE_META } from '@/components/mesh/ui/defi';

const CATEGORIES = ['All', 'Range', 'Market making', 'Limit', 'Directional', 'Stable', 'Multi-asset'] as const;
/** Templates whose proceeds stay in Mesh (spread: by default, with proceeds = recycle). */
const RECYCLES = new Set(['recycling-pair', 'grid', 'spread']);

type Expect = 'range' | 'up' | 'down' | 'peg';
type Hold = 'bch' | 'token' | 'both';
type Keep = 'mesh' | 'wallet';

/** Score templates against the helper's answers; the top ones are highlighted. */
function recommend(expect: Expect | null, hold: Hold | null, keep: Keep | null): string[] {
  if (!expect && !hold && !keep) return [];
  const score = new Map<string, number>(TEMPLATE_FORMS.map(f => [f.id, 0]));
  const add = (ids: string[], w = 1) => ids.forEach(id => score.set(id, (score.get(id) ?? 0) + w));
  if (expect === 'range') add(['grid', 'recycling-pair', 'spread'], 2);
  if (expect === 'up') add(['take-profit', 'fixed'], 2);
  if (expect === 'down') add(['accumulate', 'fixed'], 2);
  if (expect === 'peg') add(['stable-pair'], 3);
  if (hold === 'bch') add(['grid', 'recycling-pair', 'accumulate', 'multi-pair', 'fixed']);
  if (hold === 'token') add(['take-profit', 'recycling-pair', 'fixed', 'stable-pair']);
  if (hold === 'both') add(['spread', 'stable-pair']);
  if (keep === 'mesh') add([...RECYCLES]);
  if (keep === 'wallet') add(['fixed', 'take-profit', 'accumulate', 'multi-pair']);
  const top = Math.max(...score.values());
  return top > 0 ? [...score].filter(([, v]) => v === top || v >= top - 1 && top >= 3).sort((a, b) => b[1] - a[1]).map(([k]) => k).slice(0, 3) : [];
}

function Choice<T extends string>({ label, options, value, onChange }: { label: string; options: Array<[T, string]>; value: T | null; onChange: (v: T | null) => void }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-medium text-zinc-400">{label}</div>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {options.map(([v, l]) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(value === v ? null : v)}
            className={cn('rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors',
              value === v ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-200' : 'border-white/10 text-zinc-400 hover:text-white')}>{l}</button>
        ))}
      </div>
    </div>
  );
}

export function StrategyGallery({ onPick }: { onPick: (id: string) => void }) {
  const templates = useStrategyTemplates();
  const byId = new Map((templates.data?.templates ?? []).map(t => [t.id, t]));
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('All');
  const [keepOnly, setKeepOnly] = useState(false);
  const [expect, setExpect] = useState<Expect | null>(null);
  const [hold, setHold] = useState<Hold | null>(null);
  const [keep, setKeep] = useState<Keep | null>(null);
  const picks = useMemo(() => recommend(expect, hold, keep), [expect, hold, keep]);

  const forms = TEMPLATE_FORMS
    .filter(f => !templates.data || byId.has(f.id))
    .filter(f => category === 'All' || TEMPLATE_META[f.id]?.category === category)
    .filter(f => !keepOnly || RECYCLES.has(f.id))
    .sort((a, b) => Number(picks.includes(b.id)) - Number(picks.includes(a.id)));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-white tracking-tight">New position</h1>
        <p className="text-xs text-zinc-400 mt-1">Pick a strategy. Each one is a set of pools deployed in one transaction; the covenant enforces every price and only you can withdraw.</p>
      </div>

      <DefiCard className="space-y-3">
        <div className="flex items-center gap-2 font-heading text-sm font-semibold text-white"><Sparkles className="h-4 w-4 text-emerald-300" />Which one fits?</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Choice label="You expect the price to…" value={expect} onChange={setExpect}
            options={[['range', 'Move in a range'], ['up', 'Rise'], ['down', 'Fall'], ['peg', 'Hold a peg']]} />
          <Choice label="You hold…" value={hold} onChange={setHold} options={[['bch', 'BCH'], ['token', 'The token'], ['both', 'Both']]} />
          <Choice label="Proceeds should…" value={keep} onChange={setKeep} options={[['mesh', 'Stay in Mesh'], ['wallet', 'Come to my wallet']]} />
        </div>
        {picks.length > 0 && <p className="text-[11px] text-emerald-200">Best fits: {picks.map(id => TEMPLATE_META[id]?.name ?? id).join(', ')}</p>}
      </DefiCard>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Category">
          {CATEGORIES.map(c => (
            <button key={c} type="button" role="tab" aria-selected={category === c} onClick={() => setCategory(c)}
              className={cn('rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors',
                category === c ? 'border-white/20 bg-white/10 text-white' : 'border-white/[0.08] text-zinc-500 hover:text-zinc-300')}>{c}</button>
          ))}
        </div>
        <label className="inline-flex items-center gap-2 text-[11px] text-zinc-400 cursor-pointer">
          <input type="checkbox" checked={keepOnly} onChange={e => setKeepOnly(e.target.checked)} className="h-3.5 w-3.5 accent-emerald-500" />
          Keeps liquidity in Mesh
        </label>
      </div>

      {templates.isLoading && <div className="flex items-center gap-2 text-xs text-zinc-500"><Loader2 className="w-4 h-4 animate-spin" />Loading templates…</div>}
      {templates.isError && <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200">The Mesh server did not return its templates: {(templates.error as Error).message}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {forms.map(f => {
          const t = byId.get(f.id);
          const best = picks.includes(f.id);
          return (
            <div key={f.id} className="relative">
              <button type="button" onClick={() => onPick(f.id)} className="block w-full text-left rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60">
                <DefiCard interactive className={cn('h-full space-y-3', best && 'border-emerald-400/40')}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <TemplateIcon id={f.id} />
                      <div>
                        <div className="font-heading font-semibold text-white">{t?.name ?? TEMPLATE_META[f.id]?.name ?? f.id}</div>
                        <div className="text-[10px] uppercase tracking-wider text-zinc-500">{TEMPLATE_META[f.id]?.category}</div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {best && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">Best fit</span>}
                      {RECYCLES.has(f.id) && <RecyclePill />}
                    </div>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">{t?.summary ?? f.earns}</p>
                  <dl className="space-y-1 text-[11px]">
                    <div className="flex gap-1.5"><dt className="text-zinc-500 shrink-0">Deposit</dt><dd className="text-zinc-300">{t?.deposit ?? f.deposit}</dd></div>
                    <div className="flex gap-1.5"><dt className="text-zinc-500 shrink-0">Earns</dt><dd className="text-emerald-200/90">{t?.earns ?? f.earns}</dd></div>
                    {t?.risk && <div className="flex gap-1.5"><dt className="text-zinc-500 shrink-0">Risk</dt><dd className="text-amber-200/80">{t.risk}</dd></div>}
                  </dl>
                </DefiCard>
              </button>
              <a href={`/docs/mesh/strategies/${f.id}`} target="_blank" rel="noreferrer"
                className="absolute bottom-4 right-4 inline-flex items-center gap-1 text-[10px] text-zinc-500 hover:text-sky-300">
                <BookOpen className="h-3 w-3" />Guide
              </a>
            </div>
          );
        })}
        {(category === 'All' && !keepOnly) && (
          <button type="button" onClick={() => onPick('custom')} className="block text-left rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40">
            <DefiCard interactive className="h-full space-y-3 border-dashed">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"><Wrench className="w-4 h-4 text-zinc-300" /></div>
                <div className="font-heading font-semibold text-white">Custom pool</div>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">One pool, your rules: any reserve, up to three accepted assets with their own prices, proceeds to your wallet or recycled.</p>
            </DefiCard>
          </button>
        )}
      </div>
    </div>
  );
}
