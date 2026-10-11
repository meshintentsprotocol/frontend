/**
 * WalletOnboardingView — the built-in wallet's create, import and unlock steps,
 * as a view of the wallet frame (WalletPopup).
 *
 * Cham watches: it covers its eye while a password or the recovery phrase is on
 * screen, shakes its head at a wrong password, and its tail turns while the wallet
 * is being derived.
 */

import { useState } from 'react';
import { AlertTriangle, Check, ChevronLeft, Copy, Download, EyeOff, Loader2, Lock, Plus } from 'lucide-react';
import { useWDK } from '@/context/WDKProvider';
import { useWallets } from '@/hooks/useWallets';
import { cn } from '@/lib/utils';
import { Chameleon, type ChamMood } from './Chameleon';
import { PasswordInput, PasswordStrengthMeter } from './PasswordInput';

type Step = 'choose' | 'create-show' | 'create-password' | 'import' | 'unlock';

const TITLE: Record<Step, string> = {
    choose: 'Cham Wallet',
    'create-show': 'Your recovery phrase',
    'create-password': 'Set a password',
    import: 'Import a wallet',
    unlock: 'Welcome back',
};

const PRIMARY = 'flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 text-sm font-bold text-[#04130b] transition-all duration-300 hover:from-emerald-400 hover:to-emerald-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50';
const SECONDARY = 'flex h-12 w-full items-center justify-center gap-2 rounded-xl px-6 text-sm font-semibold text-white/80 transition-all lg-well hover:bg-white/[0.08] hover:text-white disabled:opacity-50';
const ERROR = 'rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400';

export function WalletOnboardingView({ onDone, onBack }: {
    /** The wallet is unlocked: go to it. */
    onDone: () => void;
    /** Leave without finishing (back to the connect list). */
    onBack: () => void;
}) {
    const wdk = useWDK();
    const { hasWallet } = useWallets();
    const [step, setStep] = useState<Step>(wdk.hasStoredWallet ? 'unlock' : 'choose');
    const [seedPhrase, setSeedPhrase] = useState('');
    const [importPhrase, setImportPhrase] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showSeed, setShowSeed] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const run = async (work: () => Promise<void>) => {
        setLoading(true);
        setError('');
        try { await work(); } catch (e: any) { setError(e?.message || 'Something went wrong'); } finally { setLoading(false); }
    };

    const handleCreate = () => run(async () => {
        setSeedPhrase(await wdk.createWallet());
        setStep('create-show');
    });

    const handleSavePassword = () => {
        if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
        if (password !== confirmPassword) { setError('Passwords do not match'); return; }
        void run(async () => { await wdk.saveWallet(password); onDone(); });
    };

    const handleImport = () => {
        const words = importPhrase.trim().split(/\s+/);
        if (words.length !== 12 && words.length !== 24) { setError('Enter a valid 12 or 24 word seed phrase'); return; }
        void run(async () => { await wdk.importWallet(importPhrase); setStep('create-password'); });
    };

    const handleUnlock = () => {
        if (!password) { setError('Enter your password'); return; }
        void run(async () => {
            if (await wdk.unlockWallet(password)) onDone();
            else setError('Wrong password');
        });
    };

    const copySeed = () => {
        navigator.clipboard.writeText(seedPhrase);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const goto = (next: Step) => { setStep(next); setError(''); };
    // The steps before the wallet exists can be walked back; the phrase and password steps finish what was started.
    const back = step === 'import' ? () => goto('choose') : step === 'choose' || step === 'unlock' ? onBack : null;

    const secret = (step === 'unlock' || step === 'create-password') ? password.length > 0 : step === 'create-show' ? showSeed : step === 'import' && importPhrase.length > 0;
    const mood: ChamMood = error ? 'error' : loading ? 'busy' : secret ? 'shy' : 'idle';

    return (
        <div className="flex min-h-0 flex-1 flex-col" data-wallet-view="onboarding">
            <div className="flex h-12 shrink-0 items-center gap-1 px-3">
                {back && (
                    <button type="button" onClick={back} aria-label="Back"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white">
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                )}
                <h2 className={cn('text-sm font-bold tracking-tight text-white', !back && 'pl-1.5')}>{TITLE[step]}</h2>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 lg-scroll">
                <div className="lg-card mb-4 flex flex-col items-center rounded-xl px-4 pb-4 pt-5 text-center">
                    {/* key: the head shake replays on every new error */}
                    <Chameleon key={error || 'ok'} size={148} mood={mood} className="text-white/40" />
                    <p className="mt-2 max-w-[300px] text-xs leading-relaxed text-white/55">
                        {step === 'choose' && 'One seed phrase. All chains. Self-custodial.'}
                        {step === 'create-show' && 'Write these words down and keep them somewhere safe. Never share them.'}
                        {step === 'create-password' && 'Your wallet is encrypted and saved on this device. This password unlocks it next time.'}
                        {step === 'import' && 'Paste your 12 or 24 word seed phrase.'}
                        {step === 'unlock' && 'Enter your password to unlock your wallet.'}
                    </p>
                    {step === 'choose' && (
                        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                            {['BCH', 'EVM', 'Solana', 'Bitcoin'].map(chain => (
                                <span key={chain} className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">{chain}</span>
                            ))}
                        </div>
                    )}
                </div>

                {step === 'choose' && (
                    <div className="space-y-2.5">
                        <button type="button" className={PRIMARY} onClick={handleCreate} disabled={loading}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            Create New Wallet
                        </button>
                        <button type="button" className={SECONDARY} onClick={() => goto('import')} disabled={loading}>
                            <Download className="h-4 w-4" /> Import Seed Phrase
                        </button>
                        {error && <p className={ERROR}>{error}</p>}
                    </div>
                )}

                {step === 'create-show' && (
                    <div className="space-y-3">
                        <p className="flex items-center gap-1.5 text-xs text-amber-400">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Anyone with these words can take your funds.
                        </p>
                        <div className="relative rounded-xl p-3 lg-well">
                            {!showSeed && (
                                <button type="button" onClick={() => setShowSeed(true)}
                                    className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl bg-black/80 backdrop-blur-sm">
                                    <EyeOff className="h-5 w-5 text-white/40" />
                                    <span className="text-sm text-white/40">Click to reveal</span>
                                </button>
                            )}
                            <div className="grid grid-cols-3 gap-1.5">
                                {seedPhrase.split(' ').map((word, i) => (
                                    <div key={i} className="rounded-lg bg-white/[0.04] px-2 py-1.5 font-mono text-xs text-white">
                                        <span className="mr-1 text-white/30">{i + 1}.</span>{word}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <button type="button" className={SECONDARY} onClick={copySeed}>
                            {copied ? <><Check className="h-4 w-4 text-emerald-400" /> Copied!</> : <><Copy className="h-4 w-4" /> Copy Seed Phrase</>}
                        </button>
                        <button type="button" className={PRIMARY} onClick={() => goto('create-password')}>I've Saved It — Continue</button>
                    </div>
                )}

                {step === 'create-password' && (
                    <div className="space-y-3">
                        <PasswordInput value={password} onChange={setPassword} placeholder="Password (min 6 characters)" autoFocus />
                        <PasswordStrengthMeter password={password} />
                        <PasswordInput
                            value={confirmPassword} onChange={setConfirmPassword} placeholder="Confirm password"
                            onEnter={handleSavePassword} invalid={confirmPassword.length > 0 && password !== confirmPassword}
                        />
                        {error && <p className={ERROR}>{error}</p>}
                        <button type="button" className={PRIMARY} onClick={handleSavePassword} disabled={loading}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                            Encrypt & Save
                        </button>
                    </div>
                )}

                {step === 'import' && (
                    <div className="space-y-3">
                        <textarea
                            placeholder="word1 word2 word3 ..."
                            value={importPhrase}
                            onChange={e => setImportPhrase(e.target.value)}
                            rows={4}
                            aria-label="Seed phrase"
                            className="w-full resize-none rounded-xl px-4 py-3 font-mono text-sm leading-relaxed text-white outline-none transition-all lg-well placeholder:text-white/30 focus:border-emerald-500/50"
                        />
                        {error && <p className={ERROR}>{error}</p>}
                        <button type="button" className={PRIMARY} onClick={handleImport} disabled={loading}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            Import
                        </button>
                    </div>
                )}

                {step === 'unlock' && (
                    <div className="space-y-3">
                        <PasswordInput value={password} onChange={v => { setPassword(v); setError(''); }} placeholder="Password" onEnter={handleUnlock} autoFocus invalid={!!error} />
                        {error && <p className={ERROR}>{error}</p>}
                        <button type="button" className={PRIMARY} onClick={handleUnlock} disabled={loading}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                            Unlock
                        </button>
                        <button type="button" className="w-full py-2 text-xs text-white/35 transition-colors hover:text-white/60" onClick={() => goto('choose')}>
                            Use a different wallet
                        </button>
                        {hasWallet && <p className="text-center text-[10px] text-white/30">Your connected wallets stay connected.</p>}
                    </div>
                )}
            </div>
        </div>
    );
}
