/** Layout route for /admin/swap/*: provides the swap server's API and key, and gates the pages on it. */
import { Outlet } from 'react-router-dom';
import { SwapAdminProvider } from './SwapAdminContext';

export function SwapArea() {
  return <SwapAdminProvider><Outlet /></SwapAdminProvider>;
}
