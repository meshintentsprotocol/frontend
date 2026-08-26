import { useEffect, useRef, useState } from 'react';
import { Header } from '@/components/common/Header';
import {
  MeshHeroSection,
  MeshStatsBar,
  MeshHowItWorksSection,
  MeshStrategyTypesSection,
  MeshLiveNetworkSection,
  MeshBenefitsSection,
  MeshCTASection,
} from '@/components/mesh-landing';

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
      <title>BCHMesh — Non-Custodial Concentrated Liquidity on Bitcoin Cash</title>

      <div className="flex flex-col min-h-screen bg-[#050505]">
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

          {/* Section 5: Live network orbital */}
          <MeshLiveNetworkSection />

          {/* Section 6: Benefits bento */}
          <MeshBenefitsSection />

          {/* Section 7: CTA */}
          <MeshCTASection />
        </main>

        {/* Footer */}
        <footer className="border-t border-white/5 bg-[#050505] py-8">
          <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img src="/assets/bchintentslogo.png" alt="BCH Intents" className="w-8 h-8 object-contain" />
              <span className="text-sm font-bold text-zinc-400">
                BCH<span className="text-emerald-400">Mesh</span>
              </span>
            </div>
            <p className="text-xs text-zinc-600 text-center">
              Non-custodial concentrated liquidity on Bitcoin Cash. Built with CashScript.
            </p>
            <div className="flex items-center gap-4 text-xs text-zinc-600">
              <a href="https://docs.intentsprotocol.xyz/" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors">Docs</a>
              <a href="https://x.com/bchintents" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors">Twitter</a>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors">GitHub</a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
