/**
 * Footer - Premium DeFi Modern Footer
 * 
 * Features:
 * - Stark dark theme with minimal borders
 * - Giant low-opacity background typography
 * - Clean geometric layout
 * - Comprehensive live protocol, explore and resource links
 */

import { Link, useLocation } from 'react-router-dom';
import { Twitter, Github, BookOpen, ArrowUpRight, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const footerLinks = {
    app: [
        { label: 'Trade', href: '/trade' },
        { label: 'Explore', href: '/explore' },
        { label: 'Pool', href: '/mesh' },
        { label: 'Portfolio', href: '/portfolio' },
        { label: 'Positions', href: '/mesh?tab=positions' },
        { label: 'Leaderboard', href: '/mesh?tab=leaderboard' },
        { label: 'Order Book', href: '/orderbook' },
    ],
    explore: [
        { label: 'Intent Wallet', href: '/wallet' },
        { label: 'Features', href: '/features' },
        { label: 'Ecosystem', href: '/ecosystem' },
        { label: 'Integrate', href: '/integrate' },
        { label: 'MCP for AI Agents', href: '/mcp' },
        { label: 'Pool Overview', href: '/mesh-landing' },
        { label: 'Explore Markets', href: '/explore' },
    ],
    resources: [
        { label: 'Knowledgehub', href: '/kb' },
        { label: 'Documentation', href: 'https://docs.intentsprotocol.xyz/', external: true },
        { label: 'GitHub', href: 'https://github.com/Intents-Swaps', external: true },
        { label: 'Monitor', href: '/monitor' },
        { label: 'Terms of Service', href: '/terms' },
        { label: 'Privacy Policy', href: '/privacy' },
    ],
};

const socialLinks = [
    {
        icon: Twitter,
        href: 'https://x.com/bchintents',
        label: 'Twitter / X',
        color: 'hover:text-[#1DA1F2] hover:bg-[#1DA1F2]/10 hover:border-[#1DA1F2]/30'
    },
    {
        icon: BookOpen,
        href: 'https://docs.intentsprotocol.xyz/',
        label: 'Docs',
        color: 'hover:text-emerald-400 hover:bg-emerald-400/10 hover:border-emerald-400/30'
    },
    {
        icon: Github,
        href: 'https://github.com/Intents-Swaps',
        label: 'GitHub',
        color: 'hover:text-white hover:bg-white/10 hover:border-white/30'
    },
    {
        icon: Mail,
        href: 'mailto:hello@intentprotocol.xyz',
        label: 'Email',
        color: 'hover:text-orange-400 hover:bg-orange-400/10 hover:border-orange-400/30'
    },
];

interface FooterLinkProps {
    label: string;
    href: string;
    external?: boolean;
}

function FooterLink({ label, href, external }: FooterLinkProps) {
    const className = cn(
        "text-sm font-medium text-zinc-400 hover:text-white transition-colors duration-200",
        "flex items-center gap-1.5 group w-fit"
    );

    if (external) {
        return (
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
            >
                {label}
                <ArrowUpRight className="w-3.5 h-3.5 opacity-0 -translate-y-0.5 translate-x-0.5 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 transition-all text-emerald-400" />
            </a>
        );
    }

    return (
        <Link to={href} className={className}>
            {label}
        </Link>
    );
}

export function Footer() {
    return (
        <footer className="relative bg-[#050505] border-t border-white/5 mt-auto overflow-hidden">
            {/* Ambient Background Glows */}
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none -translate-y-1/2" />
            <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-emerald-900/10 rounded-full blur-[120px] pointer-events-none translate-y-1/2" />
            <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-10 mix-blend-overlay pointer-events-none" />

            <div className="container mx-auto px-6 relative z-10 pt-16 pb-8">
                {/* Giant Typography Background Text */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden">
                    <span className="text-[14vw] font-black leading-none tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white/[0.03] to-transparent translate-y-12">
                        BCH INTENTS
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8 relative z-10">
                    
                    {/* Brand Column */}
                    <div className="lg:col-span-4 flex flex-col justify-between space-y-6">
                        <div>
                            <Link to="/" className="flex items-center gap-3 mb-4 group w-fit">
                                <div className="p-2 rounded-xl bg-white/5 border border-white/10 group-hover:border-emerald-500/30 transition-colors">
                                    <img
                                        src="/assets/bchintentslogo.png"
                                        alt="BCH Intents Logo"
                                        className="w-10 h-10 object-contain group-hover:scale-110 transition-transform duration-500"
                                    />
                                </div>
                                <span className="font-heading font-black text-2xl tracking-tight text-white flex items-baseline">
                                    BCH <span className="text-emerald-500 ml-1">INTENTS</span>
                                    <span className="relative -top-2.5 ml-1.5 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-[4px] shadow-[0_0_8px_rgba(16,185,129,0.2)] leading-none select-none">
                                        BETA
                                    </span>
                                </span>
                            </Link>

                            <p className="text-zinc-400 max-w-sm text-sm leading-relaxed font-normal">
                                The permissionless intent execution layer and UTXO-native liquidity curve protocol for Bitcoin Cash. Trustless, instant, and bridge-less.
                            </p>
                        </div>

                        {/* Social Links */}
                        <div className="flex items-center gap-3 pt-2">
                            {socialLinks.map((social) => (
                                <motion.a
                                    key={social.label}
                                    href={social.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    whileHover={{ y: -2 }}
                                    className={cn(
                                        "w-10 h-10 rounded-xl flex items-center justify-center",
                                        "bg-zinc-900/60 border border-white/5 text-zinc-400 backdrop-blur-sm",
                                        "transition-all duration-200",
                                        social.color
                                    )}
                                    aria-label={social.label}
                                >
                                    <social.icon className="w-4 h-4" />
                                </motion.a>
                            ))}
                        </div>
                    </div>

                    {/* Spacer for Desktop */}
                    <div className="hidden lg:block lg:col-span-1"></div>

                    {/* Column 1: App */}
                    <div className="lg:col-span-2">
                        <h4 className="font-bold text-white uppercase tracking-widest text-xs mb-5 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            App
                        </h4>
                        <ul className="space-y-3">
                            {footerLinks.app.map((link) => (
                                <li key={link.label}>
                                    <FooterLink {...link} />
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Column 2: Explore */}
                    <div className="lg:col-span-2">
                        <h4 className="font-bold text-white uppercase tracking-widest text-xs mb-5 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Explore
                        </h4>
                        <ul className="space-y-3">
                            {footerLinks.explore.map((link) => (
                                <li key={link.label}>
                                    <FooterLink {...link} />
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Column 3: Resources */}
                    <div className="lg:col-span-3">
                        <h4 className="font-bold text-white uppercase tracking-widest text-xs mb-5 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Resources
                        </h4>
                        <ul className="space-y-3">
                            {footerLinks.resources.map((link) => (
                                <li key={link.label}>
                                    <FooterLink {...link} />
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-8 mt-12 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 relative z-10">
                    <p className="text-xs text-zinc-500 font-medium">
                        © {new Date().getFullYear()} BCH Intents Protocol. All rights reserved.
                    </p>

                    <div className="flex items-center gap-3">
                        <span className="text-[11px] text-zinc-500 font-medium uppercase tracking-widest">
                            Powered by
                        </span>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-white/5">
                            <img src="/logos/bitcoin-cash-bch-logo.svg" alt="BCH" className="w-4 h-4" />
                            <span className="text-xs font-bold text-white">Bitcoin Cash</span>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}

export default Footer;
