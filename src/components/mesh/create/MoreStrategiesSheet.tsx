/**
 * Every strategy, grouped, in a sheet (bottom sheet on phones): for LPs who
 * know what they want. Picking one opens its settings on the chosen pair.
 */
import { ChevronRight } from 'lucide-react';
import { EngineBadge, ResponsiveDialog } from '@/components/mesh/kit';
import { STRATEGIES, STRATEGY_GROUPS, type StrategyId } from '@/lib/mesh/create/registry';
import { defaultEngineCaps, enginesFor } from '@/lib/mesh/create/engine';

export function MoreStrategiesSheet({ open, onOpenChange, onPick }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPick: (id: StrategyId) => void;
}) {
  const caps = defaultEngineCaps();
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title="All strategies" description="Each one opens its own settings on the pair you chose." className="max-w-2xl">
      <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
        {STRATEGY_GROUPS.map(g => (
          <section key={g.name} aria-label={g.name} className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{g.name}</h3>
            <ul className="space-y-2">
              {g.strategies.map(id => {
                const s = STRATEGIES[id];
                const engines = enginesFor(id, caps);
                return (
                  <li key={id}>
                    <button type="button" onClick={() => onPick(id)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5 text-left outline-none transition hover:border-white/20 focus-visible:ring-2 focus-visible:ring-emerald-400">
                      <span className="min-w-0 flex-1 space-y-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-heading text-sm font-semibold text-white">{s.name}</span>
                          {engines.map(e => <EngineBadge key={e} engine={e} />)}
                        </span>
                        <span className="block text-xs leading-relaxed text-zinc-300">{s.line}</span>
                        <span className="block text-[11px] text-zinc-500">Deposit: {s.deposit} · Earns: {s.earns}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </ResponsiveDialog>
  );
}
