/**
 * /mesh/pools — every pair, pool and strategy on Mesh (?view=pools|strategies).
 */
import { useNavigate } from 'react-router-dom';
import { MeshPoolsOverview } from '@/components/mesh/pools/MeshPoolsOverview';
import { meshPaths } from '@/lib/mesh/routes';

export function MeshPoolsPage() {
  const navigate = useNavigate();
  return (
    <div className="container mx-auto py-4 sm:py-6 px-4 md:px-8 max-w-[1200px] space-y-6">
      <MeshPoolsOverview
        onTab={(tab, token) =>
          navigate(tab === 'create' ? meshPaths.create(undefined, { token }) : tab === 'leaderboard' ? meshPaths.leaderboard() : meshPaths.positions())
        }
      />
    </div>
  );
}

export default MeshPoolsPage;
