/**
 * /mesh/new and /mesh/new/:strategy — create a position
 * (MeshDocs/meshv3v4flow/09 §3.1).
 *
 * - /mesh/new: step ① (pair and goal), or Simple mode.
 * - /mesh/new/:strategy: steps ② and ③ for strategies on the new flow (range
 *   today); the others keep the classic builder until phase P3 moves them.
 * - /mesh/new/custom: the hand-built V3 pool.
 */
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { StrategyBuilder } from '@/components/mesh/strategies/StrategyBuilder';
import { CreatePoolV3Form } from '@/components/mesh/strategies/CreatePoolV3Form';
import { CreateFlow } from '@/components/mesh/create/CreateFlow';
import { PairGoalStep } from '@/components/mesh/create/PairGoalStep';
import { SimpleCreate } from '@/components/mesh/create/SimpleCreate';
import { hasNewFlow } from '@/components/mesh/create/SettingsStep';
import { useCreateMode } from '@/components/mesh/create/mode';
import { defaultToken, useNetwork } from '@/components/mesh/create/usePairInfo';
import { isStrategyId } from '@/lib/mesh/create/registry';
import { meshPaths, tokenParam } from '@/lib/mesh/routes';

export function MeshCreatePage() {
  const { strategy } = useParams<{ strategy?: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const network = useNetwork();
  const [mode, setMode] = useCreateMode();
  const token = tokenParam(params.get('token'));
  const replaces = params.get('replaces') ?? undefined;
  const back = () => navigate(meshPaths.create(undefined, { token }));

  if (!strategy) {
    const t = token ?? defaultToken(network);
    return mode === 'simple'
      ? <SimpleCreate key={t} token={t} mode={mode} onMode={setMode} />
      : <PairGoalStep token={t} mode={mode} onMode={setMode} />;
  }

  if (isStrategyId(strategy) && hasNewFlow(strategy)) {
    return <CreateFlow key={`${strategy}-${replaces ?? ''}-${token ?? ''}`} strategy={strategy} token={token} replaces={replaces} />;
  }

  return (
    <div className="container mx-auto py-4 sm:py-6 px-4 md:px-8 max-w-[1200px] space-y-6">
      {strategy === 'custom' ? (
        <CreatePoolV3Form key={token ?? ''} initialToken={token} onBack={back} />
      ) : (
        <StrategyBuilder key={`${strategy}-${replaces ?? ''}-${token ?? ''}`} templateId={strategy} replaces={replaces} initialToken={token} onBack={back} />
      )}
    </div>
  );
}

export default MeshCreatePage;
