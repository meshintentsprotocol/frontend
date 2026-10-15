/**
 * Mesh Finance — Strategy Gallery & Archetype Directory
 *
 * Explore and configure strategy templates (MeshPoolV3 covenant pools).
 * Every strategy is a sovereign set of pools funded in a single atomic
 * transaction and verified on-chain.
 */
import { useMemo, useState } from 'react';
import { BookOpen, Loader2, Sparkles, Wrench, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStrategyTemplates } from '@/hooks/useMesh';
import { TEMPLATE_FORMS } from '@/lib/mesh/v3/strategyForms';
import { DefiCard, RecyclePill, TemplateIcon, TEMPLATE_META } from '@/components/mesh/ui/defi';

const CATEGORIES = ['All', 'Range', 'Market making', 'Limit', 'Directional', 'Stable', 'Multi-asset'] as const;
/** Templates whose proceeds stay in Mesh (spread: by default, with proceeds = recycle). */
const RECYCLES = new Set(['recycling-pair', 'grid', 'range', 'spread']);

type Expect = 'range' | 'up' | 'down' | 'peg';
type Hold = 'bch' | 'token' | 'both';
type Keep = 'mesh' | 'wallet';

/** Score templates against the helper's answers; top fits are highlighted. */
function recommend(expect: Expect | null, hold: Hold | null, keep: Keep | null): string[] {
  if (!expect && !hold && !keep) return [];
  const score = new Map<string, number>(TEMPLATE_FORMS.map(f => [f.id, 0]));
  const add = (ids: string[], w = 1) => ids.forEach(id => score.set(id, (score.get(id) ?? 0) + w));
  if (expect === 'range') add(['range', 'grid', 'recycling-pair', 'spread'], 2);
  if (expect === 'up') add(['take-profit', 'fixed'], 2);
  if (expect === 'down') add(['accumulate', 'fixed'], 2);
  if (expect === 'peg') add(['stable-pair'], 3);
  if (hold === 'bch') add(['grid', 'recycling-pair', 'accumulate', 'multi-pair', 'fixed']);
  if (hold === 'token') add(['take-profit', 'recycling-pair', 'fixed', 'stable-pair']);
  if (hold === 'both') add(['range', 'spread', 'stable-pair']);
  if (keep === 'mesh') add([...RECYCLES]);
  if (keep === 'wallet') add(['fixed', 'take-profit', 'accumulate', 'multi-pair']);
  const top = Math.max(...score.values());
  return top > 0 ? [...score].filter(([, v]) => v === top || (v >= top - 1 && top >= 3)).sort((a, b) => b[1] - a[1]).map(([k]) => k).slice(0, 3) : [];
}

function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<[T, string]>;
  value: T | null;
  onChange: (v: T | null) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-medium text-neutral-400">{label}</div>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {options.map(([v, l]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(value === v ? null : v)}
            className={cn(
              'rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all',
              value === v
                ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200'
                : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:text-white hover:border-neutral-700'
            )}
          >
            {l}
          </button>
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
      {/* Header with Mesh Finance Branding */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-neutral-700 text-neutral-400">
              Mesh Finance Protocol V3
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
              Autonomous Strategies
            </span>
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Strategy Studio
          </h1>
          <p className="text-xs text-neutral-400 mt-1 max-w-2xl">
            Deploy autonomous liquidity strategies governed by Bitcoin Cash UTXO covenants. Each strategy funds multiple discrete covenant pools in a single atomic transaction.
          </p>
        </div>

        <a
          href="/docs/mesh/strategies/configuration-guide"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-800 bg-neutral-900 text-xs font-semibold text-neutral-300 hover:text-white hover:border-neutral-700 transition-colors shrink-0"
        >
          <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
          <span>Strategy Guide & Design Docs</span>
        </a>
      </div>

      {/* Interactive Recommendation Wizard */}
      <DefiCard className="space-y-3.5 border-neutral-800 bg-neutral-950/60">
        <div className="flex items-center gap-2 font-heading text-sm font-semibold text-white">
          <Sparkles className="h-4 w-4 text-emerald-400" />
          <span>Strategy Matchmaker — Find the Optimal Archetype</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Choice
            label="1. You expect the asset price to…"
            value={expect}
            onChange={setExpect}
            options={[
              ['range', 'Oscillate in a range'],
              ['up', 'Rise steadily'],
              ['down', 'Dip / Consolidate'],
              ['peg', 'Maintain 1:1 Peg'],
            ]}
          />
          <Choice
            label="2. Assets you currently hold…"
            value={hold}
            onChange={setHold}
            options={[
              ['bch', 'BCH only'],
              ['token', 'CashTokens only'],
              ['both', 'Both BCH & Token'],
            ]}
          />
          <Choice
            label="3. Strategy proceeds should…"
            value={keep}
            onChange={setKeep}
            options={[
              ['mesh', 'Recycle & Compound in Mesh'],
              ['wallet', 'Sweep directly to Wallet'],
            ]}
          />
        </div>
        {picks.length > 0 && (
          <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-[11px] text-emerald-300 flex items-center justify-between">
            <span>
              Recommended strategy archetype(s):{' '}
              <span className="font-bold">
                {picks.map(id => TEMPLATE_META[id]?.name ?? id).join(', ')}
              </span>
            </span>
            <span className="text-[10px] text-emerald-400/80">Ranked by risk/return profile</span>
          </div>
        )}
      </DefiCard>

      {/* Category Tabs & Recycling Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Category">
          {CATEGORIES.map(c => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={category === c}
              onClick={() => setCategory(c)}
              className={cn(
                'rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors',
                category === c
                  ? 'border-white/30 bg-white/10 text-white'
                  : 'border-neutral-800 bg-neutral-900/50 text-neutral-400 hover:text-neutral-200'
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <label className="inline-flex items-center gap-2 text-[11px] text-neutral-400 cursor-pointer">
          <input
            type="checkbox"
            checked={keepOnly}
            onChange={e => setKeepOnly(e.target.checked)}
            className="h-3.5 w-3.5 accent-emerald-500 rounded"
          />
          Show only autonomous recycling strategies
        </label>
      </div>

      {templates.isLoading && (
        <div className="flex items-center gap-2 text-xs text-neutral-400 py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
          Loading strategy archetypes from Mesh Finance…
        </div>
      )}

      {templates.isError && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200">
          The Mesh server did not return its templates: {(templates.error as Error).message}
        </div>
      )}

      {/* Archetype Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {forms.map(f => {
          const t = byId.get(f.id);
          const best = picks.includes(f.id);
          return (
            <div key={f.id} className="relative group">
              <button
                type="button"
                onClick={() => onPick(f.id)}
                className="block w-full text-left rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
              >
                <DefiCard
                  interactive
                  className={cn(
                    'h-full space-y-3.5 border-neutral-800 bg-neutral-950/70 p-5 transition-all',
                    best && 'border-emerald-500/50 ring-1 ring-emerald-500/20'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <TemplateIcon id={f.id} />
                      <div>
                        <div className="font-heading font-semibold text-white">
                          {t?.name ?? TEMPLATE_META[f.id]?.name ?? f.id}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">
                          {TEMPLATE_META[f.id]?.category}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {best && (
                        <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
                          BEST FIT
                        </span>
                      )}
                      {RECYCLES.has(f.id) && <RecyclePill />}
                    </div>
                  </div>

                  <p className="text-xs text-neutral-300 leading-relaxed min-h-[36px]">
                    {t?.summary ?? f.earns}
                  </p>

                  <div className="space-y-1.5 text-[11px] pt-2 border-t border-neutral-800/80">
                    <div className="flex justify-between gap-1.5">
                      <span className="text-neutral-500">Deposit:</span>
                      <span className="text-neutral-200 font-mono">{t?.deposit ?? f.deposit}</span>
                    </div>
                    <div className="flex justify-between gap-1.5">
                      <span className="text-neutral-500">Earning Method:</span>
                      <span className="text-emerald-300 font-medium text-right">
                        {t?.earns ?? f.earns}
                      </span>
                    </div>
                    {t?.risk && (
                      <div className="flex justify-between gap-1.5">
                        <span className="text-neutral-500">Risk Profile:</span>
                        <span className="text-amber-300/90">{t.risk}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex items-center justify-between text-xs font-semibold text-neutral-300 group-hover:text-emerald-400 transition-colors">
                    <span>Configure Strategy</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </DefiCard>
              </button>
            </div>
          );
        })}

        {category === 'All' && !keepOnly && (
          <button
            type="button"
            onClick={() => onPick('custom')}
            className="block text-left rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <DefiCard
              interactive
              className="h-full space-y-3.5 border-dashed border-neutral-800 bg-neutral-950/40 p-5 hover:border-neutral-600"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center">
                  <Wrench className="w-4 h-4 text-neutral-300" />
                </div>
                <div>
                  <div className="font-heading font-semibold text-white">Custom V3 Pool</div>
                  <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">
                    Advanced Modular
                  </div>
                </div>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed min-h-[36px]">
                Build a standalone pool with custom reserves, multi-slot assets, and bespoke proceed routing.
              </p>
              <div className="pt-4 flex items-center justify-between text-xs font-semibold text-neutral-300">
                <span>Open Custom Builder</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </DefiCard>
          </button>
        )}
      </div>
    </div>
  );
}

export default StrategyGallery;
