import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export function TryBetaBanner() {
    return (
        <section className="relative w-full overflow-hidden bg-emerald-500">
            {/* ── Sleek Compact Banner with App Connect Green ── */}
            <div className="relative w-full py-14 sm:py-16 md:py-20 min-h-[220px] md:min-h-[260px] flex items-center justify-center">
                {/* Subtle lighting / depth overlay */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/[0.04] via-transparent to-black/[0.08]" />

                <div className="container mx-auto px-4 sm:px-6 relative z-10 max-w-4xl">
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        className="flex flex-col items-center text-center space-y-3 sm:space-y-4"
                    >
                        {/* Heading */}
                        <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-[42px] font-black tracking-tight text-[#050505] leading-tight">
                            Your account is seconds away.
                        </h2>

                        {/* Subtitle */}
                        <p className="text-sm sm:text-base md:text-lg text-[#050505]/85 font-medium max-w-xl mx-auto leading-relaxed">
                            No email. No KYC. Pick a wallet and you're in.
                        </p>

                        {/* Centered Launch Beta Button */}
                        <div className="pt-2 sm:pt-3">
                            <Link to="/trade" className="inline-block">
                                <button
                                    type="button"
                                    className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#050505] px-7 py-3.5 text-sm sm:text-base font-bold text-white transition-all duration-200 hover:bg-black/90 hover:shadow-xl active:scale-95 shadow-md shadow-black/20"
                                >
                                    <span>Launch Beta</span>
                                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                </button>
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}

export default TryBetaBanner;
