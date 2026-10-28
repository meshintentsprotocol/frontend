/**
 * /mesh/new/:strategy for strategies on the new flow: steps ② and ③ in the
 * shared shell, then the success view.
 */
import { useLocation, useNavigate } from 'react-router-dom';
import { EngineBadge, type StepItem } from '@/components/mesh/kit';
import { meshPaths } from '@/lib/mesh/routes';
import type { StrategyId } from '@/lib/mesh/create/registry';
import { useCreateFlow } from './useCreateFlow';
import { CreateShell } from './CreateShell';
import { CreateSummary, depositTotals } from './CreateSummary';
import { SettingsStep, settingsSummary } from './SettingsStep';
import { DepositReviewStep } from './DepositReviewStep';
import { SuccessView } from './SuccessView';

export function CreateFlow({ strategy, token, replaces }: { strategy: StrategyId; token?: string; replaces?: string }) {
  const flow = useCreateFlow({ strategy, token, replaces });
  const navigate = useNavigate();
  const location = useLocation();
  const pair = `BCH/${flow.main.symbol}`;
  const pairStep = () => navigate(meshPaths.create(undefined, { token: flow.mainToken || undefined }));

  if (flow.created) {
    return (
      <CreateShell title={flow.replaces ? 'Rebalance' : 'New position'} back={{ to: meshPaths.positions(), label: 'My positions' }}>
        <SuccessView flow={flow} />
      </CreateShell>
    );
  }

  const deposit = depositTotals(flow).text;
  const steps: StepItem[] = [
    {
      key: 'pair', label: 'Pair and goal', sub: `${pair} · ${flow.def.name}`, state: 'done',
      onSelect: flow.replaces ? undefined : pairStep,
    },
    {
      key: 'settings', label: flow.def.settingsLabel,
      sub: flow.step === 2 ? flow.def.settingsHint : settingsSummary(flow),
      state: flow.step === 2 ? 'current' : 'done', onSelect: () => flow.setStep(2),
    },
    { key: 'deposit', label: 'Deposit and review', sub: flow.step === 3 ? deposit || 'Enter the amounts' : 'Amounts and signing', state: flow.step === 3 ? 'current' : 'todo' },
  ];

  const step2Url = (() => {
    const q = new URLSearchParams(location.search);
    q.set('step', '2');
    return `${location.pathname}?${q.toString()}`;
  })();
  const back = flow.step === 3
    ? { to: step2Url, label: flow.def.settingsLabel }
    : flow.replaces
      ? { to: meshPaths.strategy(flow.replaces), label: 'Back to the strategy' }
      : { to: meshPaths.create(undefined, { token: flow.mainToken || undefined }), label: 'Pair and goal' };

  return (
    <CreateShell
      back={back}
      title={flow.replaces ? `Rebalance into a new ${flow.def.name.toLowerCase()}` : `New ${flow.def.name.toLowerCase()} on ${pair}`}
      sub={flow.def.line}
      badges={<EngineBadge engine={flow.engine} />}
      steps={steps}
      summary={<CreateSummary flow={flow} />}
    >
      {flow.step === 2 ? <SettingsStep flow={flow} /> : <DepositReviewStep flow={flow} />}
    </CreateShell>
  );
}
