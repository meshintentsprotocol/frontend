/**
 * Route table for the admin console (mounted at /admin/* in App.tsx).
 */
import { Route } from 'react-router-dom';
import { AdminShell } from './AdminShell';
import { OverviewPage } from './pages/OverviewPage';
import { EventsPage } from './pages/EventsPage';
import { IntentsPage } from './pages/IntentsPage';
import { IntentDetailPage } from './pages/IntentDetailPage';
import { FillsPage } from './pages/FillsPage';
import { TwapListPage, TwapDetailPage, TradersPage } from './pages/TwapPages';
import { PoolsPage, PoolDetailPage } from './pages/PoolPages';
import { StrategiesPage, StrategyDetailPage, LpsPage, LpDetailPage, IdlePage } from './pages/LiquidityPages';
import { OperationsPage, RefundsPage, SystemPage } from './pages/OperationsPages';
import { AdminPage } from '@/pages/AdminPage';

export const adminRoutes = (
  <Route path="/admin" element={<AdminShell />}>
    <Route index element={<OverviewPage />} />
    <Route path="events" element={<EventsPage />} />
    <Route path="intents" element={<IntentsPage />} />
    <Route path="intents/:id" element={<IntentDetailPage />} />
    <Route path="fills" element={<FillsPage />} />
    <Route path="twap" element={<TwapListPage />} />
    <Route path="twap/:id" element={<TwapDetailPage />} />
    <Route path="traders" element={<TradersPage />} />
    <Route path="pools" element={<PoolsPage />} />
    <Route path="pools/:address" element={<PoolDetailPage />} />
    <Route path="strategies" element={<StrategiesPage />} />
    <Route path="strategies/:id" element={<StrategyDetailPage />} />
    <Route path="lps" element={<LpsPage />} />
    <Route path="lps/:owner" element={<LpDetailPage />} />
    <Route path="idle" element={<IdlePage />} />
    <Route path="operations" element={<OperationsPage />} />
    <Route path="refunds" element={<RefundsPage />} />
    <Route path="system" element={<SystemPage />} />
    <Route path="legacy" element={<AdminPage />} />
  </Route>
);
