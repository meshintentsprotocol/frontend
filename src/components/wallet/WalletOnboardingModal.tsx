import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useWDK } from '@/context/WDKProvider';
import { KeyRound, Plus, Download, EyeOff, Lock, Loader2, Copy, Check, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PasswordInput, PasswordStrengthMeter } from './PasswordInput';

type Step = 'choose' | 'create-show' | 'create-password' | 'import' | 'unlock';

interface Props {
    open: boolean;
    onClose: () => void;
}

export function WalletOnboardingModal({ open, onClose }: Props) {
    const wdk = useWDK();
    const [step, setStep] = useState<Step>(wdk.hasStoredWallet ? 'unlock' : 'choose');
    const [seedPhrase, setSeedPhrase] = useState('');
    const [importPhrase, setImportPhrase] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showSeed, setShowSeed] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    if (!open) return null;

    const reset = () => {
        setPassword('');
        setConfirmPassword('');
        setError('');
        setShowSeed(false);
    };

    const handleCreate = async () => {
        setLoading(true);
        setError('');
        try {
            const phrase = await wdk.createWallet();
            setSeedPhrase(phrase);
            setStep('create-show');
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSavePassword = async () => {
        if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
        if (password !== confirmPassword) { setError('Passwords do not match'); return; }
        setLoading(true);
        setError('');
        try {
            await wdk.saveWallet(password);
            reset();
            onClose();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async () => {
        const words = importPhrase.trim().split(/\s+/);
        if (words.length !== 12 && words.length !== 24) {
            setError('Enter a valid 12 or 24 word seed phrase');
            return;
        }
        setLoading(true);
        setError('');
        try {
            await wdk.importWallet(importPhrase);
            setStep('create-password');
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUnlock = async () => {
        if (!password) { setError('Enter your password'); return; }
        setLoading(true);
        setError('');
        try {
            const ok = await wdk.unlockWallet(password);
            if (ok) { reset(); onClose(); }
            else setError('Wrong password');
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const copySeed = () => {
        navigator.clipboard.writeText(seedPhrase);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const inputClass = "w-full px-4 py-3 rounded-xl text-sm bg-white/[0.04] border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all";
    const btnPrimary = "w-full flex items-center justify-center gap-2 h-12 px-6 rounded-xl text-sm font-bold bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed";
    const btnSecondary = "w-full flex items-center justify-center gap-2 h-12 px-6 rounded-xl text-sm font-semibold bg-white/[0.05] border border-white/10 text-white/80 hover:bg-white/[0.08] hover:text-white transition-all disabled:opacity-50";

    const modal = (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md"
                onClick={onClose}
            />

            {/* Card */}
            <div
                className="fixed z-[101] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[440px] max-h-[90vh] overflow-y-auto rounded-[24px] p-8 bg-[#0a0a0a]/95 border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.7)]"
                onClick={e => e.stopPropagation()}
            >
                {/* STEP: Choose */}
                {step === 'choose' && (
                    <div className="space-y-6">
                        <div className="text-center space-y-3">
                            <div className="w-14 h-14 rounded-2xl mx-auto bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                                <KeyRound className="w-7 h-7 text-white" />
                            </div>
                            <h2 className="text-xl font-black tracking-tight text-white">BCH Intents Wallet</h2>
                            <p className="text-sm text-white/50">One seed phrase. All chains. Self-custodial.</p>
                            <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                                {['BCH Chipnet', 'BCH Mainnet', 'EVM', 'Solana', 'BTC'].map(chain => (
                                    <span key={chain} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">
                                        {chain}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <button className={btnPrimary} onClick={handleCreate} disabled={loading}>
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                Create New Wallet
                            </button>
                            <button className={btnSecondary} onClick={() => setStep('import')} disabled={loading}>
                                <Download className="w-4 h-4" />
                                Import Seed Phrase
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP: Show Seed Phrase */}
                {step === 'create-show' && (
                    <div className="space-y-5">
                        <div className="space-y-1">
                            <h2 className="text-lg font-black text-white">Your Seed Phrase</h2>
                            <p className="text-xs flex items-center gap-1.5 text-amber-400">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                Write this down and store it safely. Never share it.
                            </p>
                        </div>

                        <div className="relative rounded-2xl p-4 bg-white/[0.03] border border-white/10">
                            {!showSeed && (
                                <div
                                    className="absolute inset-0 rounded-2xl z-10 flex flex-col items-center justify-center gap-2 cursor-pointer bg-black/80 backdrop-blur-sm"
                                    onClick={() => setShowSeed(true)}
                                >
                                    <EyeOff className="w-5 h-5 text-white/40" />
                                    <span className="text-sm text-white/40">Click to reveal</span>
                                </div>
                            )}
                            <div className="grid grid-cols-3 gap-2">
                                {seedPhrase.split(' ').map((word, i) => (
                                    <div key={i} className="text-xs font-mono px-2 py-1.5 rounded-lg bg-white/[0.04] text-white">
                                        <span className="text-white/30 mr-1">{i + 1}.</span>{word}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button className={btnSecondary} onClick={copySeed}>
                            {copied ? <><Check className="w-4 h-4 text-emerald-400" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Seed Phrase</>}
                        </button>

                        <button className={btnPrimary} onClick={() => setStep('create-password')}>
                            I've Saved It — Continue
                        </button>
                    </div>
                )}

                {/* STEP: Set Password */}
                {step === 'create-password' && (
                    <div className="space-y-5">
                        <div className="text-center space-y-3">
                            <Lock className="w-8 h-8 text-emerald-400 mx-auto" />
                            <h2 className="text-lg font-black text-white">Set a Password</h2>
                            <p className="text-xs text-white/50">
                                Your wallet will be encrypted and saved locally. Use this password to unlock next time.
                            </p>
                        </div>

                        <div className="space-y-3">
                            <PasswordInput
                                value={password}
                                onChange={setPassword}
                                placeholder="Password (min 6 characters)"
                                autoFocus
                            />
                            <PasswordStrengthMeter password={password} />
                            <PasswordInput
                                value={confirmPassword}
                                onChange={setConfirmPassword}
                                placeholder="Confirm password"
                                onEnter={handleSavePassword}
                                invalid={confirmPassword.length > 0 && password !== confirmPassword}
                            />
                        </div>

                        {error && (
                            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
                        )}

                        <button className={btnPrimary} onClick={handleSavePassword} disabled={loading}>
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                            Encrypt & Save
                        </button>
                    </div>
                )}

                {/* STEP: Import */}
                {step === 'import' && (
                    <div className="space-y-5">
                        <div className="space-y-1">
                            <h2 className="text-lg font-black text-white">Import Wallet</h2>
                            <p className="text-xs text-white/50">Paste your 12 or 24 word seed phrase below.</p>
                        </div>

                        <textarea
                            placeholder="word1 word2 word3 ..."
                            value={importPhrase}
                            onChange={e => setImportPhrase(e.target.value)}
                            rows={4}
                            className={cn(inputClass, 'resize-none font-mono leading-relaxed')}
                        />

                        {error && <p className="text-xs text-red-400">{error}</p>}

                        <div className="flex gap-3">
                            <button
                                className={cn(btnSecondary, 'flex-1')}
                                onClick={() => { setStep('choose'); setError(''); }}
                            >
                                Back
                            </button>
                            <button className={cn(btnPrimary, 'flex-[2]')} onClick={handleImport} disabled={loading}>
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                Import
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP: Unlock */}
                {step === 'unlock' && (
                    <div className="space-y-5">
                        <div className="text-center space-y-3">
                            <Lock className="w-8 h-8 text-emerald-400 mx-auto" />
                            <h2 className="text-lg font-black text-white">Welcome Back</h2>
                            <p className="text-xs text-white/50">Enter your password to unlock your wallet.</p>
                        </div>

                        <PasswordInput
                            value={password}
                            onChange={setPassword}
                            placeholder="Password"
                            onEnter={handleUnlock}
                            autoFocus
                            invalid={!!error}
                        />

                        {error && (
                            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
                        )}

                        <button className={btnPrimary} onClick={handleUnlock} disabled={loading}>
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                            Unlock
                        </button>

                        <button
                            className="w-full text-xs text-white/30 hover:text-white/50 transition-colors py-2"
                            onClick={() => { setStep('choose'); setError(''); }}
                        >
                            Use a different wallet
                        </button>
                    </div>
                )}
            </div>
        </>
    );

    return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}
