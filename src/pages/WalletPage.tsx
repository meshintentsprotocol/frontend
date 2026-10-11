import { useEffect, useState } from 'react';
import { Header } from '@/components/common/Header';
import { Footer } from '@/components/common/Footer';
import { WalletHero } from '@/components/wallet/WalletHero';
import { WalletBentoOverview } from '@/components/wallet/WalletBentoOverview';
import { WalletChainsArc } from '@/components/wallet/WalletChainsArc';
import { WalletFeaturesBento } from '@/components/wallet/WalletFeaturesBento';
import { WalletSecuritySection } from '@/components/wallet/WalletSecuritySection';
import { WalletFAQ } from '@/components/wallet/WalletFAQ';
import { WalletDownloadBanner } from '@/components/wallet/WalletDownloadBanner';

// Scroll progress bar
function ScrollProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const scrollTop = el.scrollTop || document.body.scrollTop;
      const scrollHeight = el.scrollHeight - el.clientHeight;
      setProgress(scrollHeight > 0 ? scrollTop / scrollHeight : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 h-[2px] z-[100] bg-transparent pointer-events-none">
      <div
        className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-violet-500 transition-[width] duration-75 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
        style={{ width: `${progress * 100}%` }}
      />
    </div>
  );
}

export default function WalletPage() {
  return (
    <>
      <title>Cham Wallet — The Multi-Chain Self-Custody App for BCH, EVM & Solana</title>
      <meta 
        name="description" 
        content="Cham Wallet is a multi-chain, self-custody mobile app and browser extension for cross-chain swaps, native CashTokens, and automated yield across Bitcoin Cash, EVM, and Solana." 
      />

      <div className="flex flex-col min-h-screen bg-[#050505] selection:bg-emerald-500/30 text-foreground">
        {/* Scroll Progress */}
        <ScrollProgressBar />

        {/* Global Navigation Header */}
        <Header />

        <main className="flex-1">
          {/* Hero Section with 3D Phones & Download Badges */}
          <WalletHero />

          {/* Bento Overview: Designed for everything you do onchain */}
          <WalletBentoOverview />

          {/* Interactive Multi-Chain Arc & Portfolio Viewer */}
          <WalletChainsArc />

          {/* Comprehensive Features Matrix Bento */}
          <WalletFeaturesBento />

          {/* Institutional-Grade Security & Verification */}
          <WalletSecuritySection />

          {/* Interactive FAQ Accordion */}
          <WalletFAQ />

          {/* Bottom Download Banner with CTAs */}
          <WalletDownloadBanner />
        </main>

        {/* Global Footer */}
        <Footer />
      </div>
    </>
  );
}
