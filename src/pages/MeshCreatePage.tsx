/**
 * /mesh/new and /mesh/new/:strategy — create a position.
 *
 * Phase P1 routes the existing gallery and builders here; P2/P3 replace them
 * with the three-step create flow (MeshDocs/meshv3v4flow/09 §3.1).
 */
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { StrategyGallery } from '@/components/mesh/strategies/StrategyGallery';
import { StrategyBuilder } from '@/components/mesh/strategies/StrategyBuilder';
import { CreatePoolV3Form } from '@/components/mesh/strategies/CreatePoolV3Form';
import { meshPaths, tokenParam } from '@/lib/mesh/routes';

export function MeshCreatePage() {
  const { strategy } = useParams<{ strategy?: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = tokenParam(params.get('token'));
  const replaces = params.get('replaces') ?? undefined;
  const back = () => navigate(meshPaths.create(undefined, { token }));

  return (
    <div className="container mx-auto py-4 sm:py-6 px-4 md:px-8 max-w-[1200px] space-y-6">
      {!strategy ? (
        <StrategyGallery onPick={id => navigate(meshPaths.create(id, { token }))} />
      ) : strategy === 'custom' ? (
        <CreatePoolV3Form key={token ?? ''} initialToken={token} onBack={back} />
      ) : (
        <StrategyBuilder key={`${strategy}-${replaces ?? ''}-${token ?? ''}`} templateId={strategy} replaces={replaces} initialToken={token} onBack={back} />
      )}
    </div>
  );
}

export default MeshCreatePage;
