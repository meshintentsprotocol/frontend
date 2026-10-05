import { useState } from 'react';
import { AlertTriangle, Check, Copy, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWDK } from '@/context/WDKProvider';
import { decryptFromStorage, hasStoredWallet } from '@/lib/crypto';
import { notifyToast as toast } from '@/lib/notify-toast';

// ============================================================================
// Recovery phrase view — password-gated seed phrase reveal
// ============================================================================

export function RecoveryPhraseView() {
    const wdk = useWDK();
    const [password, setPassword] = useState('');
    const [revealedSeed, setRevealedSeed] = useState<string | null>(null);
    const [unlocking, setUnlocking] = useState(false);
    const [unlockError, setUnlockError] = useState<string | null>(null);
    const [copiedSeed, setCopiedSeed] = useState(false);
    const hasEncrypted = hasStoredWallet();

    const handleUnlock = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password) return;
        setUnlocking(true);
        setUnlockError(null);
        try {
            const seed = await decryptFromStorage(password);
            if (!seed) {
                setUnlockError('Incorrect password');
                return;
            }
            setRevealedSeed(seed);
            setPassword('');
        } catch {
            setUnlockError('Failed to decrypt — wrong password');
        } finally {
            setUnlocking(false);
        }
    };

    const hideSeed = () => {
        setRevealedSeed(null);
        setCopiedSeed(false);
    };

    const copySeed = () => {
        if (!revealedSeed) return;
        navigator.clipboard.writeText(revealedSeed);
        setCopiedSeed(true);
        toast.success('Seed phrase copied');
        setTimeout(() => setCopiedSeed(false), 1500);
    };

    if (!wdk.seedPhrase) {
        return (
            <p className="px-2 py-8 text-center text-xs text-white/50">
                No recovery phrase is available for this wallet.
            </p>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-start gap-2 text-[11px] text-yellow-400/90 bg-yellow-500/[0.06] border border-yellow-500/15 rounded-lg p-2.5">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>Anyone with your seed phrase can drain your wallet. Never share it.</span>
            </div>

            {revealedSeed ? (
                <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                        <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold">
                            Seed phrase
                        </span>
                        <button
                            type="button"
                            onClick={hideSeed}
                            className="text-[10px] text-white/50 hover:text-white flex items-center gap-1"
                        >
                            <EyeOff className="w-3 h-3" /> Hide
                        </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1 p-2.5 rounded-lg bg-red-500/[0.04] border border-red-500/15">
                        {revealedSeed.split(' ').map((word, i) => (
                            <span key={i} className="font-mono text-[10px] px-1.5 py-1 rounded bg-white/[0.04] text-white/80">
                                <span className="text-white/30">{i + 1}.</span> {word}
                            </span>
                        ))}
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="w-full h-8 text-[11px] text-white/60 hover:text-white bg-white/[0.03] border border-white/10"
                        onClick={copySeed}
                    >
                        {copiedSeed
                            ? <><Check className="w-3 h-3 mr-1 text-emerald-400" /> Copied</>
                            : <><Copy className="w-3 h-3 mr-1" /> Copy seed phrase</>}
                    </Button>
                </div>
            ) : hasEncrypted ? (
                <form onSubmit={handleUnlock} className="space-y-2">
                    <label htmlFor="recovery-phrase-password" className="block px-1 text-[10px] uppercase tracking-wider text-white/50 font-semibold">
                        Wallet password
                    </label>
                    <input
                        id="recovery-phrase-password"
                        type="password"
                        autoFocus
                        value={password}
                        onChange={e => { setPassword(e.target.value); setUnlockError(null); }}
                        placeholder="Enter the password you set"
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder:text-white/30 focus:border-emerald-500/40 focus:outline-none"
                    />
                    {unlockError && (
                        <p className="px-1 text-[10px] text-red-400">{unlockError}</p>
                    )}
                    <Button
                        type="submit"
                        size="sm"
                        className="w-full h-9 text-[11px] bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30"
                        disabled={unlocking || !password}
                    >
                        {unlocking ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Eye className="w-3 h-3 mr-1" />}
                        {unlocking ? 'Unlocking…' : 'Reveal seed phrase'}
                    </Button>
                </form>
            ) : (
                <div className="space-y-2">
                    <p className="px-1 text-[11px] text-white/60">
                        This wallet wasn't saved with a password (session-only). The seed is held in memory for this session.
                    </p>
                    <Button
                        type="button"
                        size="sm"
                        className="w-full h-9 text-[11px] bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30"
                        onClick={() => setRevealedSeed(wdk.seedPhrase)}
                    >
                        <Eye className="w-3 h-3 mr-1" /> Reveal anyway
                    </Button>
                </div>
            )}

            <p className="text-[10px] text-white/40 text-center">
                All addresses derive from a single BIP-39 seed.
            </p>
        </div>
    );
}
