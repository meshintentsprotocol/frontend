/**
 * /mesh/leaderboard — providers ranked from pool history (?view=fills for recent fills).
 */
import { MeshLeaderboard } from '@/components/mesh/pools/MeshLeaderboard';

export function MeshLeaderboardPage() {
  return (
    <div className="container mx-auto py-4 sm:py-6 px-4 md:px-8 max-w-[1200px] space-y-6">
      <MeshLeaderboard />
    </div>
  );
}

export default MeshLeaderboardPage;
