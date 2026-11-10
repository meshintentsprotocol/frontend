/**
 * Step ②: the strategy's own settings (registry of settings forms), then what
 * the server said about them with trial deposits (errors, through-market
 * warnings, dropped pools), then Continue.
 */
import type { ComponentType } from 'react';
import { ArrowRight } from 'lucide-react';
import type { StrategyId } from '@/lib/mesh/create/registry';
import { ActionButton, NoteBox, StickyActionBar } from '@/components/mesh/kit';
import type { CreateFlow } from './useCreateFlow';
import { RangeSettings } from './strategies/RangeSettings';
import { FixedSettings, fixedSummary } from './strategies/FixedSettings';
import { GridSettings, gridSummary } from './strategies/GridSettings';
import { LadderSettings, ladderSummary } from './strategies/LadderSettings';
import { TwoPriceSettings, twoPriceSummary } from './strategies/TwoPriceSettings';
import { MultiPairSettings, multiPairSummary } from './strategies/MultiPairSettings';
import { StablePairSettings, stablePairSummary } from './strategies/StablePairSettings';

/** Strategies whose step ② is built. */
export const SETTINGS: Partial<Record<StrategyId, ComponentType<{ flow: CreateFlow }>>> = {
  range: RangeSettings,
  grid: GridSettings,
  'recycling-pair': TwoPriceSettings,
  fixed: FixedSettings,
  spread: TwoPriceSettings,
  'take-profit': LadderSettings,
  accumulate: LadderSettings,
  'multi-pair': MultiPairSettings,
  'stable-pair': StablePairSettings,
};

export const hasNewFlow = (id: StrategyId) => id in SETTINGS;

/** A short line for the step list and the pinned action bar ("10 bins · ±5%"). */
export function settingsSummary(flow: CreateFlow): string {
  switch (flow.strategy) {
    case 'range': {
      const l = flow.rangeLayout;
      if (l && !l.error) {
        const unit = flow.engine === 'v4' ? 'bin' : 'pool';
        const w = flow.marketP ? Math.max(Math.abs(l.minP / flow.marketP - 1), Math.abs(l.maxP / flow.marketP - 1)) * 100 : null;
        return `${l.bins.length} ${unit}${l.bins.length === 1 ? '' : 's'}${w !== null ? ` · ±${w.toFixed(w < 10 ? 1 : 0)}%` : ''}`;
      }
      return flow.def.settingsHint;
    }
    case 'grid':
      return gridSummary(flow);
    case 'fixed':
      return fixedSummary(flow);
    case 'spread':
    case 'recycling-pair':
      return twoPriceSummary(flow);
    case 'take-profit':
    case 'accumulate':
      return ladderSummary(flow);
    case 'multi-pair':
      return multiPairSummary(flow);
    case 'stable-pair':
      return stablePairSummary(flow);
    default:
      return flow.def.settingsHint;
  }
}

export function SettingsStep({ flow }: { flow: CreateFlow }) {
  const Settings = SETTINGS[flow.strategy];
  const err = flow.settingsError;
  const label = err ? (err.length <= 42 ? err : 'Fix the settings above') : 'Continue';
  return (
    <>
      {Settings ? <Settings flow={flow} /> : null}

      {err && !flow.rangeLayout?.error && (
        <NoteBox tone="error" title="These settings can't be used yet">{err}</NoteBox>
      )}
      {flow.settingsWarnings.length > 0 && (
        <NoteBox tone="warn" title="Priced through the market">
          {flow.settingsWarnings.map(w => <p key={w}>{w}</p>)}
          <p className="text-amber-200/80">Arbitrage would take these at once. Move the range, or confirm on the next step that you want them filled.</p>
        </NoteBox>
      )}
      {flow.settingsNotes.length > 0 && (
        <NoteBox tone="info">{flow.settingsNotes.map(n => <p key={n}>{n}</p>)}</NoteBox>
      )}
      {flow.strategy === 'range' && (
        <NoteBox tone="info">If the price leaves the range, the position stops earning and holds only one asset until the price comes back or you re-centre it.</NoteBox>
      )}

      <StickyActionBar summary={<>{settingsSummary(flow)}{flow.settingsChecking ? ' · checking…' : ''}</>}>
        <ActionButton onClick={() => flow.setStep(3)} disabled={!!err} testId="settings-continue">
          {label}{!err && <ArrowRight className="h-4 w-4" aria-hidden />}
        </ActionButton>
      </StickyActionBar>
    </>
  );
}
