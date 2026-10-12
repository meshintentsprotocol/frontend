import { useEffect, useState } from 'react';
import { Header } from '@/components/common/Header';
import { Footer } from '@/components/common/Footer';
import { FAQ } from '@/components/landing/FAQ';
import {
  MeshHeroSection,
  MeshStatsBar,
  MeshHowItWorksSection,
  MeshStrategyTypesSection,
  MeshBenefitsSection,
  MeshCTASection,
} from '@/components/mesh-landing';
import { KnowledgeBaseLandingSection } from '@/components/landing/KnowledgeBaseLandingSection';

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
        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-[width] duration-75 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
        style={{ width: `${progress * 100}%` }}
      />
    </div>
  );
}

export default function MeshLandingPage() {
  return (
    <>
      {/* SEO meta */}
      <title>Mesh Finance — Non-Custodial Concentrated Liquidity & Strategies on Bitcoin Cash</title>

      <div className="flex flex-col min-h-screen bg-[#050505] selection:bg-primary/30 text-foreground">
        {/* Scroll progress indicator */}
        <ScrollProgressBar />

        {/* Shared header */}
        <Header />

        <main className="flex-1">
          {/* Section 1: Hero */}
          <MeshHeroSection />

          {/* Section 2: Stats ticker bar */}
          <MeshStatsBar />

          {/* Section 3: How it works */}
          <MeshHowItWorksSection />

          {/* Section 4: Strategy types */}
          <MeshStrategyTypesSection />

          {/* Section 5: Benefits bento (Why BCHMesh) */}
          <MeshBenefitsSection />

          {/* Section 6: Knowledge Base & Guides */}
          <KnowledgeBaseLandingSection />

          {/* Section 7: CTA */}
          <MeshCTASection />

          {/* Section 8: FAQ */}
          <FAQ />
        </main>

        {/* Shared Footer across the app */}
        <Footer />
      </div>
    </>
  );
}

