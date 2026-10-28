/**
 * /mesh/positions — the LP's positions: V3 strategies, V4 positions and
 * standalone pools (?view=pools).
 */
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MeshMyPools, type PositionsView } from '@/components/mesh/pools/MeshMyPools';
import { meshPaths } from '@/lib/mesh/routes';

export function MeshPositionsPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const view: PositionsView = params.get('view') === 'pools' ? 'pools' : 'strategies';
  return (
    <div className="container mx-auto py-4 sm:py-6 px-4 md:px-8 max-w-[1200px] space-y-6">
      <MeshMyPools view={view} onView={v => navigate(meshPaths.positions(v), { replace: true })} onCreateNew={() => navigate(meshPaths.create())} />
    </div>
  );
}

export default MeshPositionsPage;
