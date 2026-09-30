/**
 * Create: the strategy templates (from the server) plus a custom V3 pool.
 * A strategy is a set of MeshPoolV3 pools deployed in one transaction and
 * managed as one position.
 */
import React from 'react';
import {
  ArrowLeftRight, Grid3x3, Network, Repeat, Scale, Target, TrendingDown, TrendingUp, Wrench, Loader2, type LucideIcon,
} from 'lucide-react';
import { useStrategyTemplates } from '@/hooks/useMesh';
import { TEMPLATE_FORMS } from '@/lib/mesh/v3/strategyForms';

const ICONS: Record<string, LucideIcon> = { Target, ArrowLeftRight, Network, Scale, Repeat, Grid3x3, TrendingUp, TrendingDown };

export function StrategyGallery({ onPick }: { onPick: (id: string) => void }) {
  const templates = useStrategyTemplates();
  const byId = new Map((templates.data?.templates ?? []).map(t => [t.id, t]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">New position</h1>
        <p className="text-xs text-zinc-400 mt-1">Pick a strategy. Each one is a set of pools deployed in one transaction; the covenant enforces every price and only you can withdraw.</p>
      </div>
      {templates.isLoading && <div className="flex items-center gap-2 text-xs text-zinc-500"><Loader2 className="w-4 h-4 animate-spin" />Loading templates…</div>}
      {templates.isError && <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200">The Mesh server did not return its templates: {(templates.error as Error).message}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TEMPLATE_FORMS.filter(f => !templates.data || byId.has(f.id)).map(f => {
          const t = byId.get(f.id);
          const Icon = ICONS[f.icon] ?? Target;
          return (
            <button key={f.id} type="button" onClick={() => onPick(f.id)}
              className="group text-left p-5 rounded-3xl bg-[#0c0c10] border border-white/[0.08] hover:border-emerald-500/40 transition-colors space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center"><Icon className="w-4.5 h-4.5 text-emerald-300" /></div>
                <div className="font-bold text-white">{t?.name ?? f.id}</div>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">{t?.summary ?? f.earns}</p>
              <div className="text-[11px] text-zinc-500 space-y-0.5">
                <div><span className="text-zinc-400">You deposit:</span> {f.deposit}</div>
                <div><span className="text-zinc-400">It earns:</span> {f.earns}</div>
              </div>
            </button>
          );
        })}
        <button type="button" onClick={() => onPick('custom')}
          className="text-left p-5 rounded-3xl bg-[#0c0c10] border border-dashed border-white/[0.12] hover:border-white/30 transition-colors space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"><Wrench className="w-4.5 h-4.5 text-zinc-300" /></div>
            <div className="font-bold text-white">Custom pool</div>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">One pool, your rules: any reserve, up to three accepted assets with their own prices, proceeds to your wallet or recycled.</p>
        </button>
      </div>
    </div>
  );
}
