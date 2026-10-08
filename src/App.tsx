import { lazy, Suspense } from "react"
import { useLanguage } from "@/context/language-provider"
import { useWallet } from "@/context/wallet-provider"
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { SwapProvider } from "./context/SwapContext"
import { CrossChainProvider } from "./context/CrossChainContext"
import { OraclePage } from "./pages/OraclePage"
import SwapPage from "./pages/SwapPage"
import OrdersPage from "./pages/OrdersPage"
import LandingPage from "./pages/LandingPage"
import FeaturesPage from "./pages/FeaturesPage"
import { Header } from "./components/common/Header"
import { ResolverPage } from "./pages/ResolverPage"
import CrossChainPage from "./pages/CrossChainPage"
import CrossOrders from "./pages/CrossOrders"
import PortfolioPage from './pages/PortfolioPage';
import PortfolioComingSoonPage from './pages/PortfolioComingSoonPage';
import ProPage from "./pages/ProPage"
import { MonitorPage } from "./pages/MonitorPage"
import { SolverPage } from "./pages/SolverPage"
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
import { AddTokenPage } from "./pages/AddTokenPage"
import { ExplorePage } from "./pages/ExplorePage"
import { TokenDetailPage } from "./pages/TokenDetailPage"
import EcosystemPage from "./pages/EcosystemPage"
import IntegratePage from "./pages/IntegratePage"
import { SolanaWalletProvider } from "./context/SolanaWalletProvider"
import { BCHWalletProvider, CashonizeProvider } from "./context/BCHWalletProvider"
import { BCHSwapProvider } from "./context/BCHSwapContext"
import { SwapServerRoot } from "./swap-server/SwapServerRoot"
import BchSwapPage from "./pages/BchSwapPage"
import WalletPage from "./pages/WalletPage"
import OverviewPage from "./pages/OverviewPage"
import MeshPage from "./pages/MeshPage"
import MeshPoolDetailPage, { MeshPoolOutpointRedirect } from "./pages/MeshPoolDetailPage"
import MeshLandingPage from "./pages/MeshLandingPage"
import MeshProviderDetailPage from "./pages/MeshProviderDetailPage"
import MeshStrategyPage from "./pages/MeshStrategyPage"
import OrderbookPage from "./pages/OrderbookPage"
import { AdminPoolPage } from "./pages/AdminPoolPage"
import { WDKProvider } from "./context/WDKProvider"
import { ExternalBCHWalletProvider } from "./context/ExternalBCHWalletProvider"
import { PWAUpdatePrompt } from "./components/common/PWAUpdatePrompt"

// Developer docs are a self-contained subtree, loaded on demand.
const DocsApp = lazy(() => import("./docs/DocsApp"))
// The MCP page (with its tool catalog) and the funding page its orders link to.
const McpPage = lazy(() => import("./pages/McpPage"))
const FundOrderPage = lazy(() => import("./pages/FundOrderPage"))

function App() {
    useLanguage();
    useWallet();

    return (
        <Router>
            <ScrollToTop />
            <AnalyticsTracker />
            <div className="flex min-h-screen flex-col bg-background font-sans antialiased">
                <WDKProvider>
                    <ExternalBCHWalletProvider>
                        <SolanaWalletProvider>
                            <SwapProvider>
                                <CrossChainProvider>
                                    <CashonizeProvider>
                                        <BCHWalletProvider>
                                            <BCHSwapProvider>
                                                {/* Cross-chain USDC and Solana swaps through cctp-swap-server: a module of its own, next to BCHSwapProvider. */}
                                                <SwapServerRoot>
                                                <Routes>
                                                    <Route path="/" element={<LandingPage />} />
                                                    <Route path="/home" element={<LandingPage />} />
                                                    <Route path="/wallet" element={<WalletPage />} />
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
                                                    <Route path="/integrate" element={<IntegratePage />} />
                                                    <Route path="/mcp" element={
                                                        <Suspense fallback={<div className="min-h-screen bg-[#050505]" />}>
                                                            <McpPage />
                                                        </Suspense>
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
                                                     <Route path="/mesh" element={
                                                         <div className="flex flex-col min-h-screen bg-[#050505]">
                                                             <Header />
                                                             <main className="flex-1 pt-24"><MeshPage /></main>
                                                         </div>
                                                     } />
                                                     <Route path="/mesh/leaderboard" element={<Navigate to="/mesh?tab=leaderboard" replace />} />
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
                                                            <main className="flex-1 pt-24"><PortfolioComingSoonPage variant="referral" /></main>
                                                        </div>
                                                    } />
                                                    <Route path="/portfolio/points" element={
                                                        <div className="flex flex-col min-h-screen">
                                                            <Header />
                                                            <main className="flex-1 pt-24"><PortfolioComingSoonPage variant="points" /></main>
                                                        </div>
                                                    } />
                                                    {adminRoutes}
                                                    <Route path="/adminpool" element={
                                                        <div className="flex flex-col min-h-screen bg-[#050505]">
                                                            <Header />
                                                            <main className="flex-1 pt-20"><AdminPoolPage /></main>
                                                        </div>
                                                    } />
                                                    <Route path="/resolver" element={<Navigate to="/" replace />} />
                                                    <Route path="/monitor" element={
                                                        <div className="flex flex-col min-h-screen">
                                                            <Header />
                                                            <main className="flex-1 pt-24"><MonitorPage /></main>
                                                        </div>
                                                    } />
                                                    <Route path="/solver" element={<Navigate to="/" replace />} />
                                                    <Route path="/oracle" element={
                                                        <div className="flex flex-col min-h-screen">
                                                            <Header />
                                                            <main className="flex-1 pt-24"><OraclePage /></main>
                                                        </div>
                                                    } />
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


                                                    <Route path="/add-token" element={
                                                        <div className="flex flex-col min-h-screen">
                                                            <Header />
                                                            <main className="flex-1 container mx-auto p-8 mt-20">
                                                                <AddTokenPage />
                                                            </main>
                                                        </div>
                                                    } />

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
                                                </SwapServerRoot>
                                            </BCHSwapProvider>
                                        </BCHWalletProvider>
                                    </CashonizeProvider>
                                </CrossChainProvider>
                            </SwapProvider>
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
