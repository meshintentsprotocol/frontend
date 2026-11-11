/**
 * /mesh/positions — Unified LP positions: V4 discrete bins, V3 strategies,
 * and standalone pools in one searchable, filterable dashboard (MeshDocs/meshv3v4flow/09 §3.2).
 */
import { MeshPositionsView } from '@/components/mesh/positions/MeshPositionsView';

export function MeshPositionsPage() {
  return (
    <div className="container mx-auto py-4 sm:py-6 px-4 md:px-8 max-w-[1200px] space-y-6">
      <MeshPositionsView />
    </div>
  );
}

export default MeshPositionsPage;
