/**
 * /mesh — the old single Mesh page, now a redirect. Every /mesh?tab=… link
 * (navigation, wallet, Order Book, Overview, shared URLs) lands on its own
 * route: see lib/mesh/routes.ts.
 */
import { Navigate, useLocation } from 'react-router-dom';
import { legacyMeshTarget } from '@/lib/mesh/routes';

export function MeshLegacyRedirect() {
  const { search } = useLocation();
  return <Navigate to={legacyMeshTarget(search)} replace />;
}

export default MeshLegacyRedirect;
