import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useWDK } from '@/context/WDKProvider';
import { decryptFromStorage } from '@/lib/crypto';
import { KeyRound, Loader2, X, CheckCircle2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { PasswordInput, PasswordStrengthMeter } from './PasswordInput';

// ============================================================================
// ChangePasswordModal — re-encrypt the stored wallet under a new password
// ============================================================================
// The password never leaves the device — it derives the AES-GCM key that
// encrypts the seed in localStorage. Changing it: verify the current password
// can decrypt the wallet, then re-encrypt the in-memory seed with the new one.

interface Props {
    open: boolean;
    onClose: () => void;
}

export function ChangePasswordModal({ open, onClose }: Props) {
    const wdk = useWDK();
    const [current, setCurrent] = useState('');
    const [next, setNext] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);

    if (!open) return null;

    const reset = () => {
        setCurrent(''); setNext(''); setConfirm(''); setError(''); setDone(false);
    };

    const close = () => { reset(); onClose(); };

    const handleSubmit = async () => {
        setError('');
        if (!current) { setError('Enter your current password'); return; }
        if (next.length < 6) { setError('New password must be at least 6 characters'); return; }
        if (next !== confirm) { setError('New passwords do not match'); return; }
        if (next === current) { setError('New password must be different from the current one'); return; }

        setLoading(true);
        try {
            // Verify the current password by attempting to decrypt the wallet.
            const seed = await decryptFromStorage(current);
            if (!seed) {
                setError('Current password is incorrect');
                setLoading(false);
                return;
            }
            // Re-encrypt the active wallet under the new password.
            await wdk.saveWallet(next);
            setDone(true);
            toast.success('Password changed');
            setTimeout(close, 1300);
        } catch (e: any) {
            setError(e?.message || 'Could not change password');
        } finally {
            setLoading(false);
        }
    };

    const errorField = error.toLowerCase();
    const currentInvalid = errorField.includes('current');
    const newInvalid = errorField.includes('new password') || errorField.includes('match') || errorField.includes('different');

    const modal = (
        <>
            <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-md" onClick={close} />

            <div
                className="fixed z-[111] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[420px] max-h-[90vh] overflow-y-auto rounded-[24px] p-7 bg-[#0a0a0a]/95 border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.7)]"
                onClick={e => e.stopPropagation()}
            >
                <button
                    onClick={close}
                    className="absolute right-4 top-4 text-white/30 hover:text-white/70 transition-colors"
                    aria-label="Close"
                >
                    <X className="w-4 h-4" />
                </button>

                {done ? (
                    <div className="flex flex-col items-center text-center py-6 space-y-3">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                            <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                        </div>
                        <h2 className="text-lg font-black text-white">Password Changed</h2>
                        <p className="text-xs text-white/50">Your wallet is now encrypted with the new password.</p>
                    </div>
                ) : (
                    <div className="space-y-5">
                        <div className="text-center space-y-2.5">
                            <div className="w-12 h-12 rounded-2xl mx-auto bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-[0_0_24px_rgba(16,185,129,0.3)]">
                                <KeyRound className="w-6 h-6 text-white" />
                            </div>
                            <h2 className="text-lg font-black tracking-tight text-white">Change Password</h2>
                            <p className="text-xs text-white/50">
                                Enter your current password, then choose a new one.
                            </p>
                        </div>

                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Current password</label>
                                <PasswordInput
                                    value={current}
                                    onChange={setCurrent}
                                    placeholder="Current password"
                                    invalid={currentInvalid}
                                    autoFocus
                                />
                            </div>

                            <div className="h-px bg-white/[0.06]" />

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-semibold uppercase tracking-wider text-white/40">New password</label>
                                <PasswordInput
                                    value={next}
                                    onChange={setNext}
                                    placeholder="New password (min 6 characters)"
                                    invalid={newInvalid}
                                />
                                <PasswordStrengthMeter password={next} />
                            </div>

                            <div className="space-y-1.5">
                                <PasswordInput
                                    value={confirm}
                                    onChange={setConfirm}
                                    placeholder="Confirm new password"
                                    onEnter={handleSubmit}
                                    invalid={newInvalid}
                                />
                                {confirm.length > 0 && next !== confirm && (
                                    <p className="text-[10px] text-red-400">Passwords don't match</p>
                                )}
                            </div>
                        </div>

                        {error && (
                            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                                {error}
                            </p>
                        )}

                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 h-12 px-6 rounded-xl text-sm font-bold bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                            Update Password
                        </button>

                        <p className="flex items-center justify-center gap-1.5 text-[10px] text-white/30">
                            <ShieldCheck className="w-3 h-3" />
                            Encrypted on this device — your password is never sent anywhere.
                        </p>
                    </div>
                )}
            </div>
        </>
    );

    return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}
