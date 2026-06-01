/**
 * Footer - Premium DeFi Modern Footer
 * 
 * Features:
 * - Stark dark theme with minimal borders
 * - Giant low-opacity background typography
 * - Clean geometric layout
 * - Subtle emerald glows
 */

import { Link, useLocation } from 'react-router-dom';
import { Twitter, Github, BookOpen, Zap, ArrowUpRight, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const footerLinks = {
    protocol: [
        { label: 'Swap (Coming Soon)', href: '#' },
        { label: 'Oracle (Coming Soon)', href: '#' },
        { label: 'Explorer (Coming Soon)', href: '#' },
        { label: 'Monitor', href: '/monitor' },
    ],
    resources: [
        { label: 'Documentation', href: 'https://docs.intentsprotocol.xyz/', external: true },
        { label: 'GitHub', href: 'https://github.com/Intents-Swaps', external: true },
        { label: 'API Reference', href: 'https://docs.intentsprotocol.xyz/', external: true },
    ],
};

const socialLinks = [
    {
        icon: Twitter,
        href: 'https://x.com/bchintents',
        label: 'Twitter',
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
        "text-[15px] font-medium text-zinc-400 hover:text-white transition-colors duration-300",
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
                <ArrowUpRight className="w-3.5 h-3.5 opacity-0 -translate-y-1 translate-x-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 transition-all text-emerald-400" />
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
    const location = useLocation();

    return (
        <footer className="relative bg-[#050505] border-t border-white/5 mt-auto overflow-hidden">
            {/* Ambient Background Glows */}
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none -translate-y-1/2" />
            <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-emerald-900/10 rounded-full blur-[120px] pointer-events-none translate-y-1/2" />
            <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-10 mix-blend-overlay pointer-events-none" />

            <div className="container mx-auto px-6 relative z-10 pt-16 pb-8">
                {/* Giant Typography Background Text */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden">
                    <span className="text-[15vw] font-black leading-none tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white/[0.04] to-transparent translate-y-12">
                        INTENTS
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-8 relative z-10">
                    
                    {/* Brand Column */}
                    <div className="lg:col-span-5 flex flex-col justify-between">
                        <div>
                            <Link to="/" className="flex items-center gap-3 mb-6 group w-fit">
                                <div className="p-2 rounded-xl bg-white/5 border border-white/10 group-hover:border-emerald-500/30 transition-colors">
                                    <img
                                        src="/assets/bchintentslogo.png"
                                        alt="BCH Intents Protocol Logo"
                                        className="w-10 h-10 object-contain group-hover:scale-110 transition-transform duration-500"
                                    />
                                </div>
                                <span className="font-heading font-black text-2xl tracking-tight text-white">
                                    INTENTS <span className="text-emerald-500">PROTOCOL</span>
                                </span>
                            </Link>

                            <p className="text-zinc-400 max-w-sm text-lg leading-relaxed font-medium">
                                The permissionless intent execution layer for Bitcoin Cash and beyond. Atomic, secure, and bridge-less.
                            </p>
                        </div>

                        {/* Social Links */}
                        <div className="flex items-center gap-3 mt-10">
                            {socialLinks.map((social) => (
                                <motion.a
                                    key={social.label}
                                    href={social.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    whileHover={{ y: -3 }}
                                    className={cn(
                                        "w-12 h-12 rounded-xl flex items-center justify-center",
                                        "bg-zinc-900/50 border border-white/5 text-zinc-400 backdrop-blur-sm",
                                        "transition-all duration-300",
                                        social.color
                                    )}
                                    aria-label={social.label}
                                >
                                    <social.icon className="w-5 h-5" />
                                </motion.a>
                            ))}
                        </div>
                    </div>

                    {/* Spacer for Desktop */}
                    <div className="hidden lg:block lg:col-span-3"></div>

                    {/* Links Columns */}
                    <div className="lg:col-span-2">
                        <h4 className="font-bold text-white uppercase tracking-widest text-sm mb-6 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            Protocol
                        </h4>
                        <ul className="space-y-4">
                            {footerLinks.protocol.map((link) => (
                                <li key={link.label}>
                                    <FooterLink {...link} />
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="lg:col-span-2">
                        <h4 className="font-bold text-white uppercase tracking-widest text-sm mb-6 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            Resources
                        </h4>
                        <ul className="space-y-4">
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
                    <p className="text-sm text-zinc-500 font-medium">
                        © {new Date().getFullYear()} Intents Protocol. All rights reserved.
                    </p>

                    <div className="flex items-center gap-3">
                        <span className="text-xs text-zinc-500 font-medium uppercase tracking-widest">
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
