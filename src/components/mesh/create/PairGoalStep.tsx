/**
 * Step ① (/mesh/new): the pair, its market, and what the LP wants to do
 * (MeshDocs/meshv3v4flow/04 §2, canvas A1). Goal cards come from the
 * registry; a goal with more than one strategy asks which, then Continue
 * opens that strategy's settings on the pair.
 */
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, BarChart3, LayoutGrid, Network, Scale, Target, TrendingDown, TrendingUp } from 'lucide-react';
import { ChoiceCards, EngineBadge, LinkButton, SegmentedSwitch, StickyActionBar, ActionButton, type StepItem } from '@/components/mesh/kit';
import { GOALS, STRATEGIES, type GoalId, type StrategyId } from '@/lib/mesh/create/registry';
import { defaultEngineCaps, enginesFor } from '@/lib/mesh/create/engine';
import { meshPaths } from '@/lib/mesh/routes';
import { CreateShell, StepCard } from './CreateShell';
import { PairPicker } from './PairPicker';
import { MarketStrip } from './MarketStrip';
import { MoreStrategiesSheet } from './MoreStrategiesSheet';
import { usePairInfo } from './usePairInfo';
import type { CreateMode } from './mode';

const GOAL_ICON: Record<GoalId, typeof BarChart3> = {
  range: BarChart3, up: TrendingUp, down: TrendingDown, one: Target, peg: Scale, multi: Network, custom: LayoutGrid,
};

export function ModeSwitch({ mode, onMode }: { mode: CreateMode; onMode: (m: CreateMode) => void }) {
  return (
    <SegmentedSwitch label="Create mode" size="sm" value={mode} onChange={onMode}
      options={[{ value: 'simple', label: 'Simple' }, { value: 'advanced', label: 'Advanced' }]} />
  );
}

export function PairGoalStep({ token, mode, onMode }: { token: string; mode: CreateMode; onMode: (m: CreateMode) => void }) {
  const navigate = useNavigate();
  const [, setParams] = useSearchParams();
  const { info, ctx, suggest, infoLoading } = usePairInfo(token);
  const [goal, setGoal] = useState<GoalId>('range');
  const [choice, setChoice] = useState<Partial<Record<GoalId, StrategyId>>>({});
  const [more, setMore] = useState(false);
  const caps = defaultEngineCaps();

  const g = GOALS.find(x => x.id === goal)!;
  const strategy: StrategyId = choice[goal] ?? g.strategies[0]!;
  const needsTwoTokens = STRATEGIES[strategy].pair !== 'bch-token';

  const pickToken = (cat: string) => setParams(prev => { const n = new URLSearchParams(prev); n.set('token', cat); return n; }, { replace: true });
  const go = (id: StrategyId) => navigate(meshPaths.create(id, { token: token || undefined, step: 2 }));

  const steps: StepItem[] = [
    { key: 'pair', label: 'Pair and goal', sub: info && token ? `BCH/${info.symbol}` : 'Choose a token', state: 'current' },
    { key: 'settings', label: STRATEGIES[strategy].settingsLabel, sub: STRATEGIES[strategy].settingsHint, state: 'todo' },
    { key: 'deposit', label: 'Deposit and review', sub: 'Amounts and signing', state: 'todo' },
  ];

  return (
    <CreateShell
      back={{ to: meshPaths.positions(), label: 'My positions' }}
      title="New position"
      sub="Pick a pair and what you want it to do. You can change everything on the next steps."
      actions={<ModeSwitch mode={mode} onMode={onMode} />}
      steps={steps}
    >
      <StepCard id="pair" title="Pair" sub="Mesh pairs every token with BCH.">
        <PairPicker token={token} info={token ? info : null} onPick={pickToken} />
        {token && <MarketStrip className="mt-4" ctx={ctx} symbol={info.symbol} decimals={info.decimals} loading={suggest.isLoading || infoLoading} />}
      </StepCard>

      <StepCard id="goal" title="What do you want to do?" action={<LinkButton onClick={() => setMore(true)}>More strategies</LinkButton>}>
        <ChoiceCards
          label="Goal"
          value={goal}
          onChange={setGoal}
          columns={3}
          options={GOALS.map(x => {
            const Icon = GOAL_ICON[x.id];
            const v4 = x.strategies.some(id => enginesFor(id, caps)[0] === 'v4');
            return {
              value: x.id,
              title: x.name,
              line: x.line,
              note: x.best,
              art: <Icon className="h-5 w-5 text-emerald-300" aria-hidden />,
              badge: v4 ? <EngineBadge engine="v4" /> : undefined,
            };
          })}
        />

        {g.strategies.length > 1 && (
          <div className="mt-5 space-y-2">
            <h3 className="text-xs font-semibold text-zinc-300">How</h3>
            <ChoiceCards
              label="Strategy"
              value={strategy}
              onChange={id => setChoice(c => ({ ...c, [goal]: id }))}
              columns={g.strategies.length >= 3 ? 3 : 2}
              size="sm"
              options={g.strategies.map(id => {
                const s = STRATEGIES[id];
                const e = enginesFor(id, caps)[0]!;
                return { value: id, title: s.name, line: s.line, badge: <EngineBadge engine={e} /> };
              })}
            />
          </div>
        )}
        {needsTwoTokens && (
          <p className="mt-3 text-xs text-zinc-400">
            {STRATEGIES[strategy].pair === 'token-token' ? 'You pick the second token on the next step.' : 'You pick the other tokens on the next step.'}
          </p>
        )}
      </StepCard>

      <StickyActionBar summary={<>{STRATEGIES[strategy].name}{token ? ` on BCH/${info.symbol}` : ''}</>}>
        <ActionButton onClick={() => go(strategy)} disabled={!token} testId="goal-continue">
          {token ? 'Continue' : 'Choose a token'}{token && <ArrowRight className="h-4 w-4" aria-hidden />}
        </ActionButton>
      </StickyActionBar>

      <MoreStrategiesSheet open={more} onOpenChange={setMore} onPick={id => { setMore(false); go(id); }} />
    </CreateShell>
  );
}
