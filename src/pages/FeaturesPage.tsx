import React, { useRef } from 'react';
import { Header } from '@/components/common/Header';
import { Footer } from '@/components/common/Footer';
import { cn } from '@/lib/utils';
import { motion, useScroll, useTransform } from 'framer-motion';

interface FeatureSection {
  id: string;
  title: string;
  description: string;
  bgColor: string;
  image: string;
}

const features: FeatureSection[] = [
  {
    id: 'crosschain-swaps',
    title: 'Crosschain swaps',
    description: 'Seamlessly swap assets across different blockchain networks with our intuitive interface. Experience fast, secure, and decentralized cross-chain liquidity without leaving the app.',
    bgColor: 'bg-zinc-950 bg-gradient-to-br from-zinc-950 to-emerald-950/20 grainy',
    image: '/featuresimages/chainsonintents.png'
  },
  {
    id: 'cashtoken-swaps',
    title: 'Cashtoken swaps',
    description: 'Native support for CashTokens. Swap your tokens efficiently with full transparency and minimal fees. The easiest way to interact with the CashToken ecosystem.',
    bgColor: 'bg-zinc-950 bg-gradient-to-bl from-zinc-950 to-teal-950/20 grainy',
    image: '/featuresimages/crosschainswap.png'
  },
  {
    id: 'limit-order-swaps',
    title: 'Limit Order swaps',
    description: 'Set your price and let the protocol do the rest. Our advanced limit order functionality ensures you get the exact rate you want, completely trustless and automated.',
    bgColor: 'bg-zinc-950 bg-gradient-to-tr from-zinc-950 to-emerald-900/10 grainy',
    image: '/featuresimages/limitordercashtokens.png'
  },
  {
    id: 'mobile-first',
    title: 'Mobile first',
    description: 'Designed from the ground up for mobile users. A completely responsive and app-like experience that you can use anywhere, anytime directly from your browser.',
    bgColor: 'bg-zinc-950 bg-gradient-to-tl from-zinc-950 to-teal-900/10 grainy',
    image: '/featuresimages/mobilefirst.png'
  },
  {
    id: 'crosschain-wallet',
    title: 'Crosschain Wallet',
    description: 'Manage all your assets across multiple chains in one unified view. Your universal key to the multi-chain universe with robust security built-in.',
    bgColor: 'bg-zinc-950 bg-gradient-to-b from-zinc-950 to-emerald-950/30 grainy',
    image: '/featuresimages/walletcrosschain.png'
  },
  {
    id: 'sdk',
    title: 'SDK for Frontends & Solvers',
    description: 'Developers can easily integrate our powerful SDK to build custom frontends or plug in their own solvers to execute intents natively.',
    bgColor: 'bg-zinc-950 bg-gradient-to-t from-zinc-950 to-teal-950/30 grainy',
    image: '/featuresimages/sdkimage.png'
  }
];

const PhoneImage = ({ feature, index, sectionRef }: { feature: FeatureSection, index: number, sectionRef: React.RefObject<HTMLDivElement | null> }) => {
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end end"]
  });

  const insetTop = useTransform(scrollYProgress, [0, 1], ["100%", "0%"]);
  const clipPath = useTransform(insetTop, (val) => `inset(${val} 0 0 0)`);

  return (
    <motion.img
      src={feature.image}
      alt={feature.title}
      style={{ 
        clipPath: index === 0 ? "none" : clipPath,
        zIndex: index 
      }}
      className="absolute top-6 sm:top-7 left-0 w-full h-[calc(100%-24px)] sm:h-[calc(100%-28px)] object-contain object-top"
    />
  );
};

export const FeaturesPage: React.FC = () => {
  const ref0 = useRef<HTMLDivElement>(null);
  const ref1 = useRef<HTMLDivElement>(null);
  const ref2 = useRef<HTMLDivElement>(null);
  const ref3 = useRef<HTMLDivElement>(null);
  const ref4 = useRef<HTMLDivElement>(null);
  const ref5 = useRef<HTMLDivElement>(null);
  const refs = [ref0, ref1, ref2, ref3, ref4, ref5];

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-sans overflow-x-clip">
      <Header />

      <main className="flex-1 relative grid">
        {/* Scrolling Feature Sections */}
        <div className="col-start-1 row-start-1 w-full relative z-10">
          {features.map((feature, index) => (
            <div
              key={feature.id}
              id={feature.id}
              ref={refs[index]}
              className={`min-h-[100svh] w-full flex items-center ${feature.bgColor} transition-colors duration-500`}
            >
              <div className="w-2/3 lg:w-1/2 px-6 py-24 md:px-12 lg:px-24">
                <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-4 md:mb-6 tracking-tight leading-tight">
                  <span className="text-gradient-primary">{feature.title}</span>
                </h2>
                <p className="text-base md:text-xl lg:text-2xl text-muted-foreground leading-relaxed font-medium">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Grid Container limiting sticky scroll to Main */}
        <div className="col-start-1 row-start-1 w-full pointer-events-none z-30 flex justify-end">
          <div className="w-1/3 lg:w-1/2 h-full">
            <div className="sticky top-0 h-[100svh] flex items-center justify-start lg:justify-center translate-x-8 sm:translate-x-4 lg:translate-x-0">
              {/* Phone Mockup */}
              <div className="w-[220px] h-[460px] sm:w-[260px] sm:h-[550px] lg:w-[340px] lg:h-[700px] shrink-0 bg-zinc-100 rounded-[2rem] sm:rounded-[2.5rem] lg:rounded-[3rem] border-[8px] sm:border-[10px] lg:border-[12px] border-zinc-200 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden flex flex-col pointer-events-auto transition-transform duration-300 hover:scale-[1.02]">
                {/* Notch */}
                <div className="absolute top-0 inset-x-0 h-6 w-24 sm:h-7 sm:w-32 bg-zinc-200 rounded-b-2xl mx-auto z-20"></div>
                
                {/* Screen Content */}
                <div className="flex-1 flex flex-col bg-[#050505] relative overflow-hidden pt-6 sm:pt-7">
                  {features.map((feature, index) => (
                    <PhoneImage 
                      key={feature.id} 
                      feature={feature} 
                      index={index} 
                      sectionRef={refs[index]} 
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer ensures the page is consistent with other landing pages */}
      <div className="relative z-40 bg-background">
        <Footer />
      </div>
    </div>
  );
};

export default FeaturesPage;
