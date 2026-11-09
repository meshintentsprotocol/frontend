import { Header } from '@/components/common/Header';
import { Footer } from '@/components/common/Footer';
import { FAQ } from '@/components/landing/FAQ';
import { BentoSection } from '@/components/landing/bento';
import { LiveOnSection } from '@/components/landing/LiveOnSection';
import { HeroStatsSection } from '@/components/landing/HeroStatsSection';
import { OneEcosystemSection } from '@/components/landing/OneEcosystemSection';
import { TryBetaBanner } from '@/components/landing/TryBetaBanner';

export default function LandingPage() {
    return (
        <div className="min-h-screen flex flex-col bg-[#050505] selection:bg-primary/30 text-foreground">
            <Header />

            <main className="flex-1">
                {/* New Hero Section with Stats */}
                <HeroStatsSection />

                {/* Bento Grid Section - Uniswap-inspired feature cards */}
                <BentoSection />

                {/* Live On Network Banner */}
                <LiveOnSection />

                {/* One Ecosystem Section (1inch-style product pillars) */}
                <OneEcosystemSection />

                <FAQ />

                {/* Try Beta Banner */}
                <TryBetaBanner />
            </main>

            <Footer />
        </div>
    );
}
