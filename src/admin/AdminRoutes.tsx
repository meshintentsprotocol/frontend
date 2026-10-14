/**
 * Route table for the admin console (mounted at /admin/* in App.tsx).
 */
import { Route } from 'react-router-dom';
import { LendLoanDetailPage, LendLoansPage, LendOverviewPage, LendUsersPage, LendUserDetailPage } from './swap/LendPages';
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
import { BalancerOverviewPage, BalancerTradesPage, BalancerTradeDetailPage, BalancerOpportunitiesPage, BalancerWalletPage, BalancerSettingsPage } from './pages/BalancerPages';
import { AdminPage } from '@/pages/AdminPage';
import { SwapArea } from './swap/SwapArea';
import { SwapOverviewPage, SwapEventsPage, SwapSettingsPage } from './swap/SwapOverviewPages';
import { CctpTransfersPage, CctpTransferDetailPage, CctpChainsPage } from './swap/CctpPages';
import { SolanaSwapsPage, SolanaSwapDetailPage, SolanaTokensPage } from './swap/SolanaPages';
import { BchSwapsPage, BchSwapDetailPage, BchTokensPage, BchChainsPage } from './swap/BchPages';
import { ProfitsPage } from './swap/ProfitPages';

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
    <Route path="balancer" element={<BalancerOverviewPage />} />
    <Route path="balancer/trades" element={<BalancerTradesPage />} />
    <Route path="balancer/trades/:id" element={<BalancerTradeDetailPage />} />
    <Route path="balancer/opportunities" element={<BalancerOpportunitiesPage />} />
    <Route path="balancer/wallet" element={<BalancerWalletPage />} />
    <Route path="balancer/settings" element={<BalancerSettingsPage />} />
    <Route path="legacy" element={<AdminPage />} />
    {/* cctp-swap-server: its own server and key, so it is not gated by the mesh key */}
    <Route path="swap" element={<SwapArea />}>
      <Route index element={<SwapOverviewPage />} />
      <Route path="events" element={<SwapEventsPage />} />
      <Route path="settings" element={<SwapSettingsPage />} />
      <Route path="profits" element={<ProfitsPage />} />
      <Route path="cctp" element={<CctpTransfersPage />} />
      <Route path="cctp/chains" element={<CctpChainsPage />} />
      <Route path="cctp/:id" element={<CctpTransferDetailPage />} />
      <Route path="bch" element={<BchSwapsPage />} />
      <Route path="bch/chains" element={<BchChainsPage />} />
      <Route path="bch/tokens" element={<BchTokensPage />} />
      <Route path="bch/:id" element={<BchSwapDetailPage />} />
      <Route path="solana" element={<SolanaSwapsPage />} />
      <Route path="solana/tokens" element={<SolanaTokensPage />} />
      <Route path="solana/:id" element={<SolanaSwapDetailPage />} />
      <Route path="lend" element={<LendOverviewPage />} />
      <Route path="lend/users" element={<LendUsersPage />} />
      <Route path="lend/users/:profileId" element={<LendUserDetailPage />} />
      <Route path="lend/loans" element={<LendLoansPage />} />
      <Route path="lend/loans/:ref" element={<LendLoanDetailPage />} />
    </Route>
  </Route>
);
