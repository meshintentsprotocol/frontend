import { lazy, Suspense } from "react"
import { useLanguage } from "@/context/language-provider"
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import LandingPage from "./pages/LandingPage"
import FeaturesPage from "./pages/FeaturesPage"
import { Header } from "./components/common/Header"
import PortfolioPage from './pages/PortfolioPage';
import { ReferralPage, PointsPage } from './pages/ReferralPointsPages';
import { adminRoutes } from "./admin/AdminRoutes"
import { AnalyticsTracker } from "@/components/common/AnalyticsTracker"
import { ScrollToTop } from "@/components/common/ScrollToTop"

import TermsOfService from '@/pages/TermsOfService';
import PrivacyPolicy from '@/pages/PrivacyPolicy';
import { KnowledgeBasePage } from "./pages/KnowledgeBasePage"
import { KBTagPage } from "./pages/KBTagPage"
import { KBCategoryPage } from "./pages/KBCategoryPage"
import { KBArticlePage } from "./pages/KBArticlePage"
import { KBSearchPage } from "./pages/KBSearchPage"
import { ExplorePage } from "./pages/ExplorePage"
import { TokenDetailPage } from "./pages/TokenDetailPage"
import EcosystemPage from "./pages/EcosystemPage"
import IntegratePage from "./pages/IntegratePage"
import { SolanaWalletProvider } from "./context/SolanaWalletProvider"
import { BCHWalletProvider } from "./context/BCHWalletProvider"
import { BCHSwapProvider } from "./context/BCHSwapContext"
import { SwapServerRoot } from "./swap-server/SwapServerRoot"
import BchSwapPage from "./pages/BchSwapPage"
// WalletPage removed — now served externally at https://cham-wallet-web.vercel.app
import { MeshLegacyRedirect } from "./pages/MeshPage"
import MeshPositionsPage from "./pages/MeshPositionsPage"
import MeshPoolsPage from "./pages/MeshPoolsPage"
import MeshLeaderboardPage from "./pages/MeshLeaderboardPage"
import MeshCreatePage from "./pages/MeshCreatePage"
import MeshPoolDetailPage, { MeshPoolOutpointRedirect } from "./pages/MeshPoolDetailPage"
import MeshLandingPage from "./pages/MeshLandingPage"
import MeshProviderDetailPage from "./pages/MeshProviderDetailPage"
import MeshStrategyPage from "./pages/MeshStrategyPage"
import MeshPositionPage from "./pages/MeshPositionPage"
import MeshPairPage from "./pages/MeshPairPage"
import OrderbookPage from "./pages/OrderbookPage"
import { WDKProvider } from "./context/WDKProvider"
import { ExternalBCHWalletProvider } from "./context/ExternalBCHWalletProvider"
import { PWAUpdatePrompt } from "./components/common/PWAUpdatePrompt"
import { WalletUiRoot } from "./components/wallet/WalletUiRoot"

// Developer docs are a self-contained subtree, loaded on demand.
const DocsApp = lazy(() => import("./docs/DocsApp"))
// The MCP page (with its tool catalog) and the funding page its orders link to.
const McpPage = lazy(() => import("./pages/McpPage"))
const FundOrderPage = lazy(() => import("./pages/FundOrderPage"))
// Borrow & supply: its own chunk, with its own nested routes (see lend/LendRoot.tsx).
const LendRoot = lazy(() => import("./lend/LendRoot"))

/** Opens an external URL in a new tab, then navigates back to home. */
function ExternalRedirect({ url }: { url: string }) {
    window.open(url, '_blank', 'noopener,noreferrer');
    // Send the user back to home so the current tab isn't left blank
    window.location.replace('/');
    return null;
}

function App() {
    useLanguage();

    return (
        <Router>
            <ScrollToTop />
            <AnalyticsTracker />
            <div className="flex min-h-screen flex-col bg-background font-sans antialiased">
                <WDKProvider>
                    <ExternalBCHWalletProvider>
                        <SolanaWalletProvider>
                            <BCHWalletProvider>
                                <BCHSwapProvider>
                                    {/* Cross-chain USDC and Solana swaps through cctp-swap-server: a module of its own, next to BCHSwapProvider. */}
                                    <SwapServerRoot>
                                        <Routes>
                                            <Route path="/" element={<LandingPage />} />
                                            <Route path="/home" element={<LandingPage />} />
                                            {/* /wallet now redirects to the standalone Cham Wallet site */}
                                            <Route path="/wallet" element={
                                                <ExternalRedirect url="https://cham-wallet-web.vercel.app/" />
                                            } />
                                            <Route path="/features" element={<FeaturesPage />} />
                                            <Route path="/swap" element={<Navigate to="/" replace />} />
                                            <Route path="/orders" element={<Navigate to="/" replace />} />

                                            <Route path="/explore" element={
                                                <div className="flex flex-col min-h-screen">
                                                    <Header />
                                                    <main className="flex-1 pt-24"><ExplorePage /></main>
                                                </div>
                                            } />
                                            <Route path="/explore/tokens/:id" element={
                                                <div className="flex flex-col min-h-screen bg-[#050505]">
                                                    <Header />
                                                    <main className="flex-1 pt-20"><TokenDetailPage /></main>
                                                </div>
                                            } />
                                            <Route path="/ecosystem" element={<EcosystemPage />} />
                                            <Route path="/ecosystem/:id" element={<EcosystemPage />} />
                                            <Route path="/integrate" element={<IntegratePage />} />
                                            <Route path="/mcp" element={
                                                <Suspense fallback={<div className="min-h-screen bg-[#050505]" />}>
                                                    <McpPage />
                                                </Suspense>
                                            } />
                                            <Route path="/borrow/*" element={
                                                <div className="flex flex-col min-h-screen bg-[#050505]">
                                                    <Header />
                                                    <main className="flex-1 pt-24">
                                                        <Suspense fallback={<div className="min-h-[60vh]" />}>
                                                            <LendRoot />
                                                        </Suspense>
                                                    </main>
                                                </div>
                                            } />
                                            <Route path="/fund" element={
                                                <Suspense fallback={<div className="min-h-screen bg-[#050505]" />}>
                                                    <FundOrderPage />
                                                </Suspense>
                                            } />
                                            <Route path="/overview" element={<Navigate to="/portfolio" replace />} />
                                            <Route path="/portfolio" element={
                                                <div className="flex flex-col min-h-screen">
                                                    <Header />
                                                    <main className="flex-1 pt-24"><PortfolioPage /></main>
                                                </div>
                                            } />
                                            {/* /mesh?tab=… links (nav, wallet, Order Book, Overview, shared URLs) redirect to their own routes */}
                                            <Route path="/mesh" element={<MeshLegacyRedirect />} />
                                            <Route path="/mesh/positions" element={
                                                <div className="flex flex-col min-h-screen bg-[#050505]">
                                                    <Header />
                                                    <main className="flex-1 pt-24"><MeshPositionsPage /></main>
                                                </div>
                                            } />
                                            <Route path="/mesh/pools" element={
                                                <div className="flex flex-col min-h-screen bg-[#050505]">
                                                    <Header />
                                                    <main className="flex-1 pt-24"><MeshPoolsPage /></main>
                                                </div>
                                            } />
                                            <Route path="/mesh/new" element={
                                                <div className="flex flex-col min-h-screen bg-[#050505]">
                                                    <Header />
                                                    <main className="flex-1 pt-24"><MeshCreatePage /></main>
                                                </div>
                                            } />
                                            <Route path="/mesh/new/:strategy" element={
                                                <div className="flex flex-col min-h-screen bg-[#050505]">
                                                    <Header />
                                                    <main className="flex-1 pt-24"><MeshCreatePage /></main>
                                                </div>
                                            } />
                                            <Route path="/mesh/leaderboard" element={
                                                <div className="flex flex-col min-h-screen bg-[#050505]">
                                                    <Header />
                                                    <main className="flex-1 pt-24"><MeshLeaderboardPage /></main>
                                                </div>
                                            } />
                                            <Route path="/mesh/provider/:address" element={
                                                <div className="flex flex-col min-h-screen bg-[#050505]">
                                                    <Header />
                                                    <main className="flex-1 pt-24"><MeshProviderDetailPage /></main>
                                                </div>
                                            } />
                                            <Route path="/mesh/leaderboard/:address" element={
                                                <div className="flex flex-col min-h-screen bg-[#050505]">
                                                    <Header />
                                                    <main className="flex-1 pt-24"><MeshProviderDetailPage /></main>
                                                </div>
                                            } />
                                            <Route path="/mesh/strategy/:id" element={
                                                <div className="flex flex-col min-h-screen bg-[#050505]">
                                                    <Header />
                                                    <main className="flex-1 pt-24"><MeshStrategyPage /></main>
                                                </div>
                                            } />
                                            <Route path="/mesh/position/:category" element={
                                                <div className="flex flex-col min-h-screen bg-[#050505]">
                                                    <Header />
                                                    <main className="flex-1 pt-24"><MeshPositionPage /></main>
                                                </div>
                                            } />
                                            <Route path="/mesh/pair/:token" element={
                                                <div className="flex flex-col min-h-screen bg-[#050505]">
                                                    <Header />
                                                    <main className="flex-1 pt-24"><MeshPairPage /></main>
                                                </div>
                                            } />
                                            <Route path="/mesh/pool/:address" element={
                                                <div className="flex flex-col min-h-screen bg-[#050505]">
                                                    <Header />
                                                    <main className="flex-1 pt-24"><MeshPoolDetailPage /></main>
                                                </div>
                                            } />
                                            {/* legacy outpoint links: V2 pools move to a new outpoint on every fill */}
                                            <Route path="/mesh/pool/:txid/:vout" element={
                                                <div className="flex flex-col min-h-screen bg-[#050505]">
                                                    <Header />
                                                    <main className="flex-1 pt-24"><MeshPoolOutpointRedirect /></main>
                                                </div>
                                            } />
                                            <Route path="/mesh-landing" element={<MeshLandingPage />} />
                                            <Route path="/orderbook" element={
                                                <div className="flex flex-col min-h-screen bg-[#050505]">
                                                    <Header />
                                                    <main className="flex-1 pt-24"><OrderbookPage /></main>
                                                </div>
                                            } />
                                            <Route path="/portfolio/referral" element={
                                                <div className="flex flex-col min-h-screen">
                                                    <Header />
                                                    <main className="flex-1 pt-24"><ReferralPage /></main>
                                                </div>
                                            } />
                                            <Route path="/portfolio/points" element={
                                                <div className="flex flex-col min-h-screen">
                                                    <Header />
                                                    <main className="flex-1 pt-24"><PointsPage /></main>
                                                </div>
                                            } />
                                            {/* Admin console disabled in production - redirects to home */}
                                            {import.meta.env.DEV && adminRoutes}
                                            <Route path="/admin/*" element={<Navigate to="/" replace />} />
                                            <Route path="/admin" element={<Navigate to="/" replace />} />
                                            <Route path="/adminpool" element={<Navigate to="/" replace />} />
                                            <Route path="/resolver" element={<Navigate to="/" replace />} />
                                            <Route path="/monitor" element={<Navigate to="/" replace />} />
                                            <Route path="/solver" element={<Navigate to="/" replace />} />
                                            <Route path="/oracle" element={<Navigate to="/" replace />} />
                                            <Route path="/crossswap" element={<Navigate to="/" replace />} />
                                            <Route path="/crossorders" element={<Navigate to="/" replace />} />
                                            <Route path="/pro" element={<Navigate to="/" replace />} />
                                            <Route path="/trade" element={
                                                <div className="flex flex-col min-h-screen bg-[#050505]">
                                                    <Header />
                                                    <main className="flex-1 pt-24">
                                                        <BchSwapPage />
                                                    </main>
                                                </div>
                                            } />
                                            <Route path="/twap" element={
                                                <div className="flex flex-col min-h-screen bg-[#050505]">
                                                    <Header />
                                                    <main className="flex-1 pt-24">
                                                        <BchSwapPage />
                                                    </main>
                                                </div>
                                            } />
                                            <Route path="/bchswap" element={<Navigate to="/trade" replace />} />

                                            <Route path="/docs/*" element={
                                                <Suspense fallback={<div className="min-h-screen bg-[#050505]" />}>
                                                    <DocsApp />
                                                </Suspense>
                                            } />

                                            <Route path="/terms" element={<TermsOfService />} />
                                            <Route path="/privacy" element={<PrivacyPolicy />} />

                                            <Route path="/add-token" element={<Navigate to="/" replace />} />

                                            {/* Knowledge Base Routes */}
                                            <Route path="/kb" element={
                                                <div className="flex flex-col min-h-screen">
                                                    <Header />
                                                    <KnowledgeBasePage />
                                                </div>
                                            } />
                                            <Route path="/kb/search" element={
                                                <div className="flex flex-col min-h-screen">
                                                    <Header />
                                                    <KBSearchPage />
                                                </div>
                                            } />
                                            <Route path="/kb/tag/:tagSlug" element={
                                                <div className="flex flex-col min-h-screen">
                                                    <Header />
                                                    <KBTagPage />
                                                </div>
                                            } />
                                            <Route path="/kb/:categoryId" element={
                                                <div className="flex flex-col min-h-screen">
                                                    <Header />
                                                    <KBCategoryPage />
                                                </div>
                                            } />
                                            <Route path="/kb/:categoryId/:articleId" element={
                                                <div className="flex flex-col min-h-screen">
                                                    <Header />
                                                    <KBArticlePage />
                                                </div>
                                            } />
                                        </Routes>
                                        {/* The wallet frame, the orders board and the order card: one of each for the whole app. */}
                                        <WalletUiRoot />
                                    </SwapServerRoot>
                                </BCHSwapProvider>
                            </BCHWalletProvider>
                        </SolanaWalletProvider>
                    </ExternalBCHWalletProvider>
                </WDKProvider>
            </div>
            <PWAUpdatePrompt />
            {/* <Toaster /> lives in main.tsx only. Mounting it here as well made
                sonner render every toast twice, since App is inside main's tree. */}
        </Router>
    )
}

export default App
