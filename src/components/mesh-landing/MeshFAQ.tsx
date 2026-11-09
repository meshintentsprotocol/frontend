/**
 * MeshFAQ - Dedicated FAQ Component for BCHMesh Protocol
 * 
 * Tailored for Mesh DLMM, discrete price bins, V3 proceeds separation,
 * sovereign CashToken NFT custody, and Bitcoin Cash covenant mechanics.
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, ChevronDown, ChevronUp } from 'lucide-react';

const MESH_FAQ_DATA = [
  {
    question: "What is Mesh Protocol?",
    answer: "Mesh Protocol is an on-chain Discrete Liquidity Market Maker (DLMM) and concentrated liquidity engine built natively on Bitcoin Cash. Powered by CashScript covenants, it enables liquidity providers to deploy single-asset or multi-pair capital into discrete price bins with zero curve slippage, sub-cent rebalancing costs, and automated fee compounding."
  },
  {
    question: "How do V4 DLMM discrete bins work?",
    answer: "Unlike traditional constant-product AMMs (x · y = k) that stretch liquidity across an infinite price range, DLMM discretizes price curves into discrete price bins. Each bin acts as a localized zero-slippage market. When market trades cross your bin, your capital is executed at that exact fixed price, maximizing fee generation while eliminating curve slippage."
  },
  {
    question: "What is V3 proceeds separation?",
    answer: "Proceeds separation is a UTXO-native covenant mechanism that physically separates your principal capital from earned trading fees. As trades execute against your bin, fee revenues route into a dedicated proceeds covenant rather than diluting your active trading liquidity. You can harvest or compound accrued fees at any time without closing or altering your active position."
  },
  {
    question: "How are my liquidity positions custody-managed?",
    answer: "All Mesh liquidity positions are 100% self-custodial and tokenized as sovereign CashToken NFTs held directly in your wallet. There is no protocol multisig, admin proxy, or centralized operator holding your assets. Your position NFT is the sole cryptographic bearer key required to modify, rebalance, or withdraw your liquidity and collected fees."
  },
  {
    question: "How does sub-cent rebalancing benefit liquidity providers?",
    answer: "On high-gas chains, rebalancing concentrated liquidity can cost upwards of $20 to $100 per transaction, quickly erasing LP profits. On Bitcoin Cash, CashScript covenants execute complex bin migrations and range updates for less than $0.01 in miner fees, making active algorithmic liquidity management profitable even for smaller deposits."
  },
  {
    question: "How does Mesh help mitigate Impermanent Loss (IL)?",
    answer: "Mesh provides flexible liquidity distributions (Spot, Curve, and Bid-Ask shapes) and single-asset deposit capabilities. By concentrating liquidity tightly inside active price bands or high-volatility trading ranges, LPs capture significantly higher fee-to-TVL yields that offset directional price drift much more effectively than passive AMMs."
  },
  {
    question: "Which tokens can I provide liquidity for?",
    answer: "Mesh supports native Bitcoin Cash (BCH) and any standard CashTokens token—including stablecoins (such as PUSD, MUSD) and cross-chain bridged assets. You can deploy standard two-sided token pairs or single-sided pure BCH liquidity bins across supported pools."
  },
  {
    question: "How do intent solvers and aggregators route through Mesh?",
    answer: "Mesh pools expose public CashScript covenant state directly on-chain and via Nostr relays. Cross-chain intent solvers and DEX aggregators continuously query bin depth to route multi-hop swaps with deterministic execution and atomic UTXO settlement."
  }
];

const INITIAL_DISPLAY_COUNT = 5;

interface FAQItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
  index: number;
}

function FAQItem({ question, answer, isOpen, onToggle, index }: FAQItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'border-b border-white/10 last:border-b-0',
        'transition-colors duration-200'
      )}
    >
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-start gap-4 py-6 text-left',
          'group transition-colors duration-200',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505] rounded-lg'
        )}
        aria-expanded={isOpen}
      >
        {/* Toggle Icon */}
        <span
          className={cn(
            'flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full border border-white/10',
            'text-zinc-400 group-hover:text-white group-hover:border-white/30 transition-colors',
            isOpen && 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
          )}
        >
          {isOpen ? (
            <Minus className="w-3.5 h-3.5" strokeWidth={2.5} />
          ) : (
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
          )}
        </span>

        {/* Question Text */}
        <span
          className={cn(
            'flex-1 text-lg font-medium',
            'text-zinc-200 group-hover:text-white transition-colors',
            isOpen && 'text-white font-semibold'
          )}
        >
          {question}
        </span>
      </button>

      {/* Answer with smooth animation */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
            className="overflow-hidden"
          >
            <div className="pb-6 pl-10 pr-4">
              <p className="text-zinc-400 leading-relaxed text-base">
                {answer}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function MeshFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0); // First item open by default
  const [showAll, setShowAll] = useState(false);

  const displayedFAQs = showAll ? MESH_FAQ_DATA : MESH_FAQ_DATA.slice(0, INITIAL_DISPLAY_COUNT);
  const hasMoreFAQs = MESH_FAQ_DATA.length > INITIAL_DISPLAY_COUNT;

  const handleToggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="py-24 md:py-32 relative bg-gradient-to-b from-[#050505] via-[#050608] to-[#040608] overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[20%] right-[10%] w-[35vw] h-[35vw] bg-emerald-500/5 rounded-full blur-[140px]" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto">
          {/* Two-column layout */}
          <div className="grid md:grid-cols-[280px_1fr] gap-12 md:gap-16">
            {/* Left Column - Title */}
            <div className="md:sticky md:top-32 md:self-start">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="space-y-3"
              >
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
                  Mesh Protocol FAQ
                </div>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight">
                  Questions?{' '}
                  <span className="text-zinc-500">Answers.</span>
                </h2>
                <p className="text-sm text-zinc-400 leading-relaxed pt-1">
                  Everything you need to know about DLMM discrete bins, proceeds separation, and liquidity provision on Bitcoin Cash.
                </p>
              </motion.div>
            </div>

            {/* Right Column - FAQ Items */}
            <div>
              <div className="divide-y-0">
                {displayedFAQs.map((faq, index) => (
                  <FAQItem
                    key={index}
                    question={faq.question}
                    answer={faq.answer}
                    isOpen={openIndex === index}
                    onToggle={() => handleToggle(index)}
                    index={index}
                  />
                ))}
              </div>

              {/* Show More / Show Less Button */}
              {hasMoreFAQs && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="mt-6"
                >
                  <button
                    onClick={() => setShowAll(!showAll)}
                    className={cn(
                      'inline-flex items-center gap-2',
                      'text-emerald-400 hover:text-emerald-300 transition-colors',
                      'font-medium text-sm focus:outline-none focus-visible:underline'
                    )}
                  >
                    {showAll ? (
                      <>
                        Show less
                        <ChevronUp className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        Show more
                        <ChevronDown className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pre-CTA Emerald Bloom: Soft upward light crescendo leading directly into the emerald banner */}
      <div className="absolute bottom-0 left-0 right-0 h-72 bg-gradient-to-b from-transparent via-emerald-950/20 to-emerald-500/15 pointer-events-none" />
      <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-[70vw] h-48 bg-emerald-500/15 rounded-full blur-[110px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent pointer-events-none" />
    </section>
  );
}

export default MeshFAQ;

