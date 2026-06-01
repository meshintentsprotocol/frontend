import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { X, Zap, CheckCircle2, AlertCircle, Loader2, Sparkles, Mail } from 'lucide-react';

// ─────────────────────────────────────────────
// WaitlistModal — Dual-path waitlist signup
// Route 1: Verified X handle (OAuth 2.0 via /api/x-auth)
// Route 2: Email (direct Supabase insert)
// ─────────────────────────────────────────────

interface WaitlistModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Pre-set the modal to success state (used after X OAuth redirect) */
    initialSuccess?: { message: string } | null;
}

type ModalState = 'choose' | 'email' | 'loading' | 'success' | 'error';

export function WaitlistModal({ isOpen, onClose, initialSuccess }: WaitlistModalProps) {
    const [email, setEmail] = useState('');
    const [state, setState] = useState<ModalState>(initialSuccess ? 'success' : 'choose');
    const [errorMsg, setErrorMsg] = useState('');
    const [successMessage, setSuccessMessage] = useState(initialSuccess?.message || '');
    const emailRef = useRef<HTMLInputElement>(null);

    // Sync initialSuccess prop
    useEffect(() => {
        if (initialSuccess) {
            setSuccessMessage(initialSuccess.message);
            setState('success');
        }
    }, [initialSuccess]);

    // Focus input when switching to email mode
    useEffect(() => {
        if (state === 'email' && emailRef.current) {
            setTimeout(() => emailRef.current?.focus(), 200);
        }
    }, [state]);

    // Reset on close (only if not from OAuth)
    useEffect(() => {
        if (!isOpen && !initialSuccess) {
            setTimeout(() => {
                setState('choose');
                setEmail('');
                setErrorMsg('');
                setSuccessMessage('');
            }, 300);
        }
    }, [isOpen, initialSuccess]);

    // Escape to close
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = email.trim().toLowerCase();
        if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
            setState('error');
            setErrorMsg('Please enter a valid email address.');
            return;
        }

        setState('loading');
        try {
            const { error } = await supabase
                .from('waitlist')
                .insert({ email: trimmed });

            if (error) {
                if (error.code === '23505') {
                    setSuccessMessage(trimmed);
                    setState('success');
                    return;
                }
                throw error;
            }
            setSuccessMessage(trimmed);
            setState('success');
        } catch (err: any) {
            setState('error');
            setErrorMsg(err?.message || 'Something went wrong. Please try again.');
        }
    };

    const handleXConnect = () => {
        // Redirect to our Vercel serverless OAuth route
        window.location.href = '/api/x-auth';
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                >
                    {/* Backdrop */}
                    <motion.div
                        className="absolute inset-0 bg-black/70 backdrop-blur-md"
                        onClick={onClose}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    />

                    {/* Modal Card */}
                    <motion.div
                        className={cn(
                            "relative w-full max-w-md rounded-3xl overflow-hidden",
                            "bg-[#0a0a0a]/95 backdrop-blur-2xl",
                            "border border-white/10",
                            "shadow-[0_0_80px_-20px_rgba(16,185,129,0.25),0_0_30px_-10px_rgba(0,0,0,0.8)]"
                        )}
                        initial={{ opacity: 0, scale: 0.9, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Ambient glow */}
                        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-64 h-64 bg-emerald-500/20 rounded-full blur-[100px] pointer-events-none" />
                        <div className="absolute -bottom-20 right-0 w-40 h-40 bg-teal-500/10 rounded-full blur-[80px] pointer-events-none" />
                        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.08] mix-blend-overlay pointer-events-none" />

                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all duration-200 text-white/50 hover:text-white"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        {/* Content */}
                        <div className="relative z-10 p-8 pt-10">
                            <AnimatePresence mode="wait">

                                {/* ── SUCCESS ── */}
                                {state === 'success' && (
                                    <motion.div
                                        key="success"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="flex flex-col items-center text-center py-6"
                                    >
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ type: 'spring', damping: 10, stiffness: 200, delay: 0.1 }}
                                            className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mb-6"
                                        >
                                            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                                        </motion.div>

                                        <h3 className="text-2xl font-black tracking-tight text-white mb-2">
                                            You're on the list!
                                        </h3>
                                        {successMessage && (
                                            <p className="text-emerald-400 font-mono text-sm mb-2">
                                                {successMessage}
                                            </p>
                                        )}
                                        <p className="text-muted-foreground leading-relaxed max-w-xs">
                                            We'll notify you when BCH Intents launches. Stay tuned for the bridgeless future of DeFi.
                                        </p>

                                        <motion.button
                                            onClick={onClose}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            className="mt-8 px-8 py-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold text-sm tracking-wide hover:bg-emerald-500/30 transition-all duration-200"
                                        >
                                            GOT IT
                                        </motion.button>
                                    </motion.div>
                                )}

                                {/* ── LOADING ── */}
                                {state === 'loading' && (
                                    <motion.div
                                        key="loading"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="flex flex-col items-center text-center py-12"
                                    >
                                        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-4" />
                                        <p className="text-muted-foreground text-sm">Joining waitlist...</p>
                                    </motion.div>
                                )}

                                {/* ── CHOOSE MODE ── */}
                                {state === 'choose' && (
                                    <motion.div
                                        key="choose"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                    >
                                        {/* Header */}
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
                                                <Zap className="w-5 h-5 text-emerald-400" />
                                            </div>
                                            <h3 className="text-xl font-black tracking-tight text-white">
                                                Join the Waitlist
                                            </h3>
                                        </div>

                                        <p className="text-muted-foreground text-sm leading-relaxed mb-8 ml-[52px]">
                                            Be the first to trade when we go live.
                                            <br />
                                            <span className="text-emerald-400/80 flex items-center gap-1 mt-1">
                                                <Sparkles className="w-3 h-3" />
                                                Early access + exclusive perks
                                            </span>
                                        </p>

                                        <div className="space-y-3">
                                            {/* Connect with X */}
                                            <motion.button
                                                onClick={handleXConnect}
                                                whileHover={{ scale: 1.01 }}
                                                whileTap={{ scale: 0.99 }}
                                                className={cn(
                                                    "w-full py-4 px-5 rounded-xl font-bold text-sm tracking-wide",
                                                    "flex items-center justify-center gap-3",
                                                    "bg-white text-black",
                                                    "hover:bg-white/90",
                                                    "transition-all duration-300",
                                                    "shadow-[0_0_20px_-5px_rgba(255,255,255,0.15)]",
                                                    "hover:shadow-[0_0_30px_-5px_rgba(255,255,255,0.25)]",
                                                    "border border-white/20"
                                                )}
                                            >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                                </svg>
                                                Connect with X
                                            </motion.button>

                                            {/* Divider */}
                                            <div className="flex items-center gap-3 py-1">
                                                <div className="flex-1 h-px bg-white/10" />
                                                <span className="text-xs text-white/30 font-medium uppercase tracking-widest">or</span>
                                                <div className="flex-1 h-px bg-white/10" />
                                            </div>

                                            {/* Email */}
                                            <motion.button
                                                onClick={() => setState('email')}
                                                whileHover={{ scale: 1.01 }}
                                                whileTap={{ scale: 0.99 }}
                                                className={cn(
                                                    "w-full py-4 px-5 rounded-xl font-bold text-sm tracking-wide",
                                                    "flex items-center justify-center gap-3",
                                                    "bg-white/5 text-white/80",
                                                    "hover:bg-white/10 hover:text-white",
                                                    "transition-all duration-300",
                                                    "border border-white/10 hover:border-white/20"
                                                )}
                                            >
                                                <Mail className="w-4.5 h-4.5" />
                                                Continue with Email
                                            </motion.button>
                                        </div>

                                        <p className="text-center text-[11px] text-white/20 mt-6 tracking-wide">
                                            No spam. Unsubscribe anytime.
                                        </p>
                                    </motion.div>
                                )}

                                {/* ── EMAIL FORM ── */}
                                {state === 'email' && (
                                    <motion.div
                                        key="email"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                    >
                                        <div className="flex items-center gap-3 mb-6">
                                            <button
                                                onClick={() => setState('choose')}
                                                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all text-white/50 hover:text-white"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="15 18 9 12 15 6" />
                                                </svg>
                                            </button>
                                            <h3 className="text-lg font-black tracking-tight text-white">
                                                Enter your email
                                            </h3>
                                        </div>

                                        <form onSubmit={handleEmailSubmit} className="space-y-4">
                                            <input
                                                ref={emailRef}
                                                type="email"
                                                placeholder="satoshi@example.com"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className={cn(
                                                    "w-full px-5 py-4 rounded-xl bg-white/5 border text-white placeholder:text-white/25",
                                                    "font-mono text-sm tracking-wide",
                                                    "outline-none transition-all duration-300",
                                                    "focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 focus:bg-white/[0.07]",
                                                    "border-white/10"
                                                )}
                                            />

                                            <motion.button
                                                type="submit"
                                                whileHover={{ scale: 1.01 }}
                                                whileTap={{ scale: 0.99 }}
                                                className={cn(
                                                    "w-full py-4 rounded-xl font-black text-sm tracking-widest uppercase",
                                                    "transition-all duration-300 relative overflow-hidden",
                                                    "bg-gradient-to-r from-emerald-600 to-emerald-500",
                                                    "hover:from-emerald-500 hover:to-emerald-400",
                                                    "text-white shadow-[0_0_30px_-5px_rgba(16,185,129,0.4)]",
                                                    "hover:shadow-[0_0_40px_-5px_rgba(16,185,129,0.6)]",
                                                    "border border-emerald-400/20"
                                                )}
                                            >
                                                <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                                                <span className="relative z-10 flex items-center justify-center gap-2">
                                                    <Zap className="w-4 h-4" />
                                                    JOIN WAITLIST
                                                </span>
                                            </motion.button>
                                        </form>

                                        <p className="text-center text-[11px] text-white/20 mt-5 tracking-wide">
                                            No spam. Unsubscribe anytime.
                                        </p>
                                    </motion.div>
                                )}

                                {/* ── ERROR ── */}
                                {state === 'error' && (
                                    <motion.div
                                        key="error"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="flex flex-col items-center text-center py-6"
                                    >
                                        <div className="w-14 h-14 rounded-full bg-red-500/15 border border-red-500/25 flex items-center justify-center mb-5">
                                            <AlertCircle className="w-7 h-7 text-red-400" />
                                        </div>
                                        <h3 className="text-lg font-bold text-white mb-2">Something went wrong</h3>
                                        <p className="text-red-400/80 text-sm mb-6">{errorMsg}</p>
                                        <motion.button
                                            onClick={() => setState('choose')}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            className="px-8 py-3 rounded-xl bg-white/5 border border-white/10 text-white/80 font-bold text-sm tracking-wide hover:bg-white/10 transition-all duration-200"
                                        >
                                            TRY AGAIN
                                        </motion.button>
                                    </motion.div>
                                )}

                            </AnimatePresence>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
