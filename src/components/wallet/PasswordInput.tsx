import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// PasswordInput — password field with a show/hide toggle
// ============================================================================

interface PasswordInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    onEnter?: () => void;
    autoFocus?: boolean;
    invalid?: boolean;
}

export function PasswordInput({ value, onChange, placeholder, onEnter, autoFocus, invalid }: PasswordInputProps) {
    const [show, setShow] = useState(false);

    return (
        <div className="relative">
            <input
                type={show ? 'text' : 'password'}
                value={value}
                onChange={e => onChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') onEnter?.(); }}
                placeholder={placeholder}
                autoFocus={autoFocus}
                autoComplete="off"
                className={cn(
                    'w-full px-4 py-3 pr-11 rounded-xl text-sm bg-white/[0.04] border text-white placeholder:text-white/30',
                    'outline-none transition-all',
                    invalid
                        ? 'border-red-500/50 focus:border-red-500/60 focus:ring-1 focus:ring-red-500/30'
                        : 'border-white/10 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30',
                )}
            />
            <button
                type="button"
                tabIndex={-1}
                onClick={() => setShow(s => !s)}
                aria-label={show ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
            >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
        </div>
    );
}

// ----------------------------------------------------------------------------
// Password strength — lightweight heuristic for the new-password field
// ----------------------------------------------------------------------------

export interface PasswordStrength {
    score: number; // 0-4
    label: string;
    barClass: string;
}

export function getPasswordStrength(pw: string): PasswordStrength {
    if (!pw) return { score: 0, label: '', barClass: 'bg-white/10' };
    let score = 0;
    if (pw.length >= 6) score++;
    if (pw.length >= 10) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score++;
    score = Math.min(score, 4);

    const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
    const colors = ['bg-red-500', 'bg-red-500', 'bg-amber-500', 'bg-yellow-400', 'bg-emerald-500'];
    return { score, label: labels[score], barClass: colors[score] };
}

/** Renders a 4-segment strength bar + label. */
export function PasswordStrengthMeter({ password }: { password: string }) {
    if (!password) return null;
    const { score, label, barClass } = getPasswordStrength(password);
    return (
        <div className="space-y-1">
            <div className="flex gap-1">
                {[0, 1, 2, 3].map(i => (
                    <div
                        key={i}
                        className={cn(
                            'h-1 flex-1 rounded-full transition-colors',
                            i < score ? barClass : 'bg-white/10',
                        )}
                    />
                ))}
            </div>
            <p className="text-[10px] text-white/40">Password strength: <span className="text-white/60 font-medium">{label}</span></p>
        </div>
    );
}
