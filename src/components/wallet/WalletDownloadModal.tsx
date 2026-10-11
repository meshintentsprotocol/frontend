/**
 * WalletDownloadModal - Platform download modal for iOS, Android & Browser Extension
 *
 * Features:
 * - Tab-based UI for Extension, iOS, Android
 * - QR codes (placeholder) & direct download links
 * - Early access waitlist integration
 * - Glassmorphic dark overlay with smooth animations
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Chrome, Smartphone, Apple, Download, ExternalLink, ArrowRight, Shield } from 'lucide-react';

type Platform = 'extension' | 'ios' | 'android';

interface WalletDownloadModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const PLATFORMS: { id: Platform; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'extension', label: 'Browser', icon: Chrome },
    { id: 'ios', label: 'iOS', icon: Apple },
    { id: 'android', label: 'Android', icon: Smartphone },
];

export function WalletDownloadModal({ isOpen, onClose }: WalletDownloadModalProps) {
    const [activePlatform, setActivePlatform] = useState<Platform>('extension');

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Overlay */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100]"
                        onClick={onClose}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        className="fixed inset-0 flex items-center justify-center z-[101] p-4"
                    >
                        <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                                <div>
                                    <h3 className="text-lg font-bold text-white">Get Cham Wallet</h3>
                                    <p className="text-xs text-zinc-500">Available on all platforms</p>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Platform Tabs */}
                            <div className="flex items-center gap-1 px-6 py-3 border-b border-white/5">
                                {PLATFORMS.map(({ id, label, icon: Icon }) => (
                                    <button
                                        key={id}
                                        onClick={() => setActivePlatform(id)}
                                        className={cn(
                                            'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200',
                                            activePlatform === id
                                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                                : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
                                        )}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {/* Content */}
                            <div className="px-6 py-6">
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={activePlatform}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        {activePlatform === 'extension' && (
                                            <div className="space-y-4">
                                                <div className="bg-zinc-800/50 rounded-2xl p-4 border border-white/5 text-center">
                                                    {/* QR Placeholder */}
                                                    <div className="w-32 h-32 mx-auto rounded-2xl bg-white p-2 mb-3">
                                                        <div className="w-full h-full rounded-xl bg-zinc-100 flex items-center justify-center">
                                                            <Chrome className="w-10 h-10 text-zinc-400" />
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-zinc-400">Scan to install or click below</p>
                                                </div>
                                                <button className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-sm font-bold text-black flex items-center justify-center gap-2 hover:brightness-110 transition-all">
                                                    <Chrome className="w-4 h-4" />
                                                    Add to Chrome / Brave
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </button>
                                                <p className="text-center text-[10px] text-zinc-500">
                                                    Also supports Firefox, Edge & Opera
                                                </p>
                                            </div>
                                        )}

                                        {activePlatform === 'ios' && (
                                            <div className="space-y-4">
                                                <div className="bg-zinc-800/50 rounded-2xl p-4 border border-white/5 text-center">
                                                    <div className="w-32 h-32 mx-auto rounded-2xl bg-white p-2 mb-3">
                                                        <div className="w-full h-full rounded-xl bg-zinc-100 flex items-center justify-center">
                                                            <Apple className="w-10 h-10 text-zinc-400" />
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-zinc-400">Scan QR with your iPhone camera</p>
                                                </div>
                                                <button className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-sm font-bold text-black flex items-center justify-center gap-2 hover:brightness-110 transition-all">
                                                    <Apple className="w-4 h-4" />
                                                    Download on App Store
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </button>
                                                <button className="w-full py-3 rounded-2xl border border-white/10 text-sm font-bold text-white flex items-center justify-center gap-2 hover:bg-white/5 transition-all">
                                                    Join TestFlight Beta
                                                    <ArrowRight className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}

                                        {activePlatform === 'android' && (
                                            <div className="space-y-4">
                                                <div className="bg-zinc-800/50 rounded-2xl p-4 border border-white/5 text-center">
                                                    <div className="w-32 h-32 mx-auto rounded-2xl bg-white p-2 mb-3">
                                                        <div className="w-full h-full rounded-xl bg-zinc-100 flex items-center justify-center">
                                                            <Smartphone className="w-10 h-10 text-zinc-400" />
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-zinc-400">Scan QR or download below</p>
                                                </div>
                                                <button className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-sm font-bold text-black flex items-center justify-center gap-2 hover:brightness-110 transition-all">
                                                    <Smartphone className="w-4 h-4" />
                                                    Get on Google Play
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </button>
                                                <button className="w-full py-3 rounded-2xl border border-white/10 text-sm font-bold text-white flex items-center justify-center gap-2 hover:bg-white/5 transition-all">
                                                    <Download className="w-4 h-4" />
                                                    Download APK Directly
                                                </button>
                                            </div>
                                        )}
                                    </motion.div>
                                </AnimatePresence>
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-3 border-t border-white/5 flex items-center justify-center gap-2 text-[10px] text-zinc-500">
                                <Shield className="w-3 h-3 text-emerald-400" />
                                <span>Self-custodial · Open source · No tracking</span>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

export default WalletDownloadModal;
