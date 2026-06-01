import { Toaster } from "@/components/ui/sonner"
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
import { AnalyticsTracker } from "@/components/common/AnalyticsTracker"
import { ScrollToTop } from "@/components/common/ScrollToTop"

import TermsOfService from '@/pages/TermsOfService';
import PrivacyPolicy from '@/pages/PrivacyPolicy';
import { KnowledgeBasePage } from "./pages/KnowledgeBasePage"
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
import BchSwapPage from "./pages/BchSwapPage"
import { WDKProvider } from "./context/WDKProvider"

function App() {
    useLanguage();
    useWallet();

    return (
        <Router>
            <ScrollToTop />
            <AnalyticsTracker />
            <div className="flex min-h-screen flex-col bg-background font-sans antialiased">
                <WDKProvider>
                    <SolanaWalletProvider>
                        <SwapProvider>
                            <CrossChainProvider>
                                <CashonizeProvider>
                                    <BCHWalletProvider>
                                        <BCHSwapProvider>
                                            <Routes>
                                                <Route path="/" element={<LandingPage />} />
                                                <Route path="/home" element={<LandingPage />} />
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
                                                <Route path="/portfolio" element={
                                                    <div className="flex flex-col min-h-screen">
                                                        <Header />
                                                        <main className="flex-1 pt-24"><PortfolioPage /></main>
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
                                        </BCHSwapProvider>
                                    </BCHWalletProvider>
                                </CashonizeProvider>
                            </CrossChainProvider>
                        </SwapProvider>
                    </SolanaWalletProvider>
                </WDKProvider>
            </div>
            <Toaster />
        </Router>
    )
}

export default App
