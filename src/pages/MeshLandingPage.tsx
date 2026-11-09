import { useEffect, useState } from 'react';
import { Header } from '@/components/common/Header';
import { Footer } from '@/components/common/Footer';
import {
  MeshHeroSection,
  MeshHowItWorksSection,
  MeshStrategyTypesSection,
  MeshBenefitsSection,
  MeshFAQ,
  MeshCTASection,
} from '@/components/mesh-landing';

// Subtle top scroll progress bar matching other pages
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
        className="h-full bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 transition-[width] duration-75"
        style={{ width: `${progress * 100}%` }}
      />
    </div>
  );
}

export default function MeshLandingPage() {
  return (
    <>
      <title>Mesh Protocol — V4 DLMM Discrete Liquidity & V3 Pools on Bitcoin Cash</title>

      <div className="flex flex-col min-h-screen bg-[#050505] selection:bg-primary/30 text-foreground">
        <ScrollProgressBar />
        <Header />

        <main className="flex-1">
          <MeshHeroSection />
          <MeshHowItWorksSection />
          <MeshStrategyTypesSection />
          <MeshBenefitsSection />
          <MeshFAQ />
          <MeshCTASection />
        </main>

        <Footer />
      </div>
    </>
  );
}
