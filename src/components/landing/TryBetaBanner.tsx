import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, ExternalLink } from 'lucide-react';
import React from 'react';

export interface TryBetaBannerProps {
    title?: React.ReactNode;
    subtitle?: React.ReactNode;
    primaryCtaText?: string;
    primaryCtaHref?: string;
    secondaryCtaText?: string;
    secondaryCtaHref?: string;
}

export function TryBetaBanner({
    title = 'Your account is seconds away.',
    subtitle = "No email. No KYC. Pick a wallet and you're in.",
    primaryCtaText = 'Launch Beta',
    primaryCtaHref = '/trade',
    secondaryCtaText,
    secondaryCtaHref,
}: TryBetaBannerProps = {}) {
    const isSecondaryExternal = secondaryCtaHref?.startsWith('http');

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
                            {title}
                        </h2>

                        {/* Subtitle */}
                        {subtitle && (
                            <p className="text-sm sm:text-base md:text-lg text-[#050505]/85 font-medium max-w-2xl mx-auto leading-relaxed">
                                {subtitle}
                            </p>
                        )}

                        {/* Buttons */}
                        <div className="pt-2 sm:pt-3 flex items-center justify-center gap-3.5 flex-wrap">
                            {primaryCtaHref.startsWith('http') ? (
                                <a
                                    href={primaryCtaHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-block"
                                >
                                    <button
                                        type="button"
                                        className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#050505] px-7 py-3.5 text-sm sm:text-base font-bold text-white transition-all duration-200 hover:bg-black/90 hover:shadow-xl active:scale-95 shadow-md shadow-black/20"
                                    >
                                        <span>{primaryCtaText}</span>
                                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                    </button>
                                </a>
                            ) : (
                                <Link to={primaryCtaHref} className="inline-block">
                                    <button
                                        type="button"
                                        className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#050505] px-7 py-3.5 text-sm sm:text-base font-bold text-white transition-all duration-200 hover:bg-black/90 hover:shadow-xl active:scale-95 shadow-md shadow-black/20"
                                    >
                                        <span>{primaryCtaText}</span>
                                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                    </button>
                                </Link>
                            )}

                            {secondaryCtaText && secondaryCtaHref && (
                                isSecondaryExternal ? (
                                    <a
                                        href={secondaryCtaHref}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-block"
                                    >
                                        <button
                                            type="button"
                                            className="group inline-flex items-center justify-center gap-2 rounded-full border border-black/25 bg-black/5 hover:bg-black/10 px-6 py-3.5 text-sm sm:text-base font-bold text-[#050505] transition-all duration-200 active:scale-95"
                                        >
                                            <span>{secondaryCtaText}</span>
                                            <ExternalLink className="w-4 h-4" />
                                        </button>
                                    </a>
                                ) : (
                                    <Link to={secondaryCtaHref} className="inline-block">
                                        <button
                                            type="button"
                                            className="group inline-flex items-center justify-center gap-2 rounded-full border border-black/25 bg-black/5 hover:bg-black/10 px-6 py-3.5 text-sm sm:text-base font-bold text-[#050505] transition-all duration-200 active:scale-95"
                                        >
                                            <span>{secondaryCtaText}</span>
                                            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                        </button>
                                    </Link>
                                )
                            )}
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}

export default TryBetaBanner;
