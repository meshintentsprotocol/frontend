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
import { Header } from "./components/common/Header"
import { ResolverPage } from "./pages/ResolverPage"
import CrossChainPage from "./pages/CrossChainPage"
import CrossOrders from "./pages/CrossOrders"
import PortfolioPage from './pages/PortfolioPage';
import ProPage from "./pages/ProPage"
import { MonitorPage } from "./pages/MonitorPage"
import { SolverPage } from "./pages/SolverPage"
import { AnalyticsTracker } from "@/components/common/AnalyticsTracker"

import TermsOfService from '@/pages/TermsOfService';
import PrivacyPolicy from '@/pages/PrivacyPolicy';
import { KnowledgeBasePage } from "./pages/KnowledgeBasePage"
import { KBCategoryPage } from "./pages/KBCategoryPage"
import { KBArticlePage } from "./pages/KBArticlePage"
import { KBSearchPage } from "./pages/KBSearchPage"
import { AddTokenPage } from "./pages/AddTokenPage"
import { ExplorePage } from "./pages/ExplorePage"
import EcosystemPage from "./pages/EcosystemPage"
import IntegratePage from "./pages/IntegratePage"
import { SolanaWalletProvider } from "./context/SolanaWalletProvider"
import { BCHWalletProvider, CashonizeProvider } from "./context/BCHWalletProvider"
import { BCHSwapProvider } from "./context/BCHSwapContext"
import BchSwapPage from "./pages/BchSwapPage"

function App() {
    useLanguage();
    useWallet();

    return (
        <Router>
            <AnalyticsTracker />
            <div className="flex min-h-screen flex-col bg-background font-sans antialiased">
                <SolanaWalletProvider>
                    <SwapProvider>
                        <CrossChainProvider>
                            <CashonizeProvider>
                                <BCHWalletProvider>
                                    <Routes>
                                        <Route path="/" element={<LandingPage />} />
                                        <Route path="/home" element={<LandingPage />} />
                                        <Route path="/swap" element={<Navigate to="/" replace />} />
                                        <Route path="/orders" element={<Navigate to="/" replace />} />
                                        <Route path="/explore" element={<Navigate to="/" replace />} />
                                        <Route path="/ecosystem" element={<EcosystemPage />} />
                                        <Route path="/integrate" element={<IntegratePage />} />
                                        <Route path="/portfolio" element={<Navigate to="/" replace />} />
                                        <Route path="/resolver" element={<Navigate to="/" replace />} />
                                        <Route path="/monitor" element={<Navigate to="/" replace />} />
                                        <Route path="/solver" element={<Navigate to="/" replace />} />
                                        <Route path="/oracle" element={<Navigate to="/" replace />} />
                                        <Route path="/crossswap" element={<Navigate to="/" replace />} />
                                        <Route path="/crossorders" element={<Navigate to="/" replace />} />
                                        <Route path="/pro" element={<Navigate to="/" replace />} />
                                        <Route path="/trade" element={<Navigate to="/" replace />} />

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
                                </BCHWalletProvider>
                            </CashonizeProvider>
                        </CrossChainProvider>
                    </SwapProvider>
                </SolanaWalletProvider>
            </div>
            <Toaster />
        </Router>
    )
}

export default App
