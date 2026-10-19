/**
 * ConnectStart — Step 1 of Connect flow.
 *
 * Options:
 * 1. Cham Wallet (Built-in · Recommended) — shown when built-in wallet is not unlocked.
 * 2. Cham Wallet Extension (BCH, detected / not installed, no QR).
 * 3. "Connect another wallet" -> proceeds to ChainPicker (step 2).
 *    Disabled when 5 external wallets limit is reached.
 *
 * Phase 2: The connect screen
 */

import { useState, useEffect } from 'react';
import { ChevronRight, ShieldCheck, Puzzle, Plus, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWDK } from '@/context/WDKProvider';
import { walletUi } from '@/lib/walletUi';
import { Chameleon } from '../Chameleon';
import { WalletGlyph } from '../WalletIcon';

interface ConnectStartProps {
    canAdd: boolean;
    onConnectAnother: () => void;
    onConnectExtension: () => void;
    isConnectingExtension?: boolean;
}

const OPTION_CARD = 'group flex w-full items-center gap-3 rounded-xl p-3 text-left transition-all duration-200 lg-well hover:border-white/[0.16] hover:bg-white/[0.06] active:scale-[0.99]';
const TAG = 'rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider';

const extensionPresent = () =>
    typeof window !== 'undefined' &&
    !!(window as unknown as { bchIntents?: { isBCHIntents?: boolean } }).bchIntents?.isBCHIntents;

export function ConnectStart({
    canAdd,
    onConnectAnother,
    onConnectExtension,
    isConnectingExtension = false,
}: ConnectStartProps) {
    const wdk = useWDK();
    const [hasExtension, setHasExtension] = useState(extensionPresent);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const onReady = () => setHasExtension(true);
        window.addEventListener('bchIntents#initialized', onReady);
        return () => window.removeEventListener('bchIntents#initialized', onReady);
    }, []);

    return (
        <div className="space-y-4" data-connect-step="pick">
            <div>
                <h3 className="text-base font-semibold text-white">Connect a wallet</h3>
                <p className="mt-0.5 text-xs text-white/50">
                    Use our built-in multi-chain wallet, browser extension, or connect external wallets.
                </p>
            </div>

            <div className="space-y-2">
                {/* 1. Cham Wallet Built-in (hidden when unlocked) */}
                {!wdk.isInitialized && (
                    <button
                        type="button"
                        onClick={() => walletUi.openOnboarding()}
                        className={cn(
                            OPTION_CARD,
                            'border-emerald-500/25 bg-gradient-to-r from-emerald-500/[0.08] via-transparent to-transparent hover:border-emerald-500/40'
                        )}
                    >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400/20 to-teal-500/20 text-emerald-300 ring-1 ring-emerald-400/30">
                            <Chameleon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-white">Cham Wallet</span>
                                <span className={cn(TAG, 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300')}>
                                    Built-in · Recommended
                                </span>
                            </div>
                            <p className="mt-0.5 truncate text-[11px] text-white/50">
                                {wdk.hasStoredWallet ? 'Unlock with your password' : 'Create or import from seed phrase'}
                            </p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-white/30 transition-transform group-hover:translate-x-0.5 group-hover:text-white/60" />
                    </button>
                )}

                {/* 2. Cham Wallet Extension */}
                <button
                    type="button"
                    onClick={onConnectExtension}
                    disabled={isConnectingExtension}
                    className={OPTION_CARD}
                >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300 ring-1 ring-amber-400/20">
                        {isConnectingExtension ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <WalletGlyph iconId="bch-intents" className="h-5 w-5" />
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-white">Cham Wallet Extension</span>
                            <span
                                className={cn(
                                    TAG,
                                    hasExtension
                                        ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                                        : 'border-white/10 bg-white/[0.04] text-white/40'
                                )}
                            >
                                {hasExtension ? 'Detected' : 'Not installed'}
                            </span>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-white/50">
                            Browser extension for BCH · approve in wallet, no QR
                        </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-white/30 transition-transform group-hover:translate-x-0.5 group-hover:text-white/60" />
                </button>

                {/* 3. Connect another wallet */}
                <button
                    type="button"
                    onClick={onConnectAnother}
                    disabled={!canAdd}
                    className={cn(
                        OPTION_CARD,
                        !canAdd && 'opacity-50 cursor-not-allowed hover:bg-transparent hover:border-white/[0.08]'
                    )}
                >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-400/10 text-sky-300 ring-1 ring-sky-400/20">
                        <Plus className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <span className="text-xs font-semibold text-white">Connect another wallet</span>
                        <p className="mt-0.5 truncate text-[11px] text-white/50">
                            Bitcoin Cash, EVM, Solana, or Bitcoin
                        </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-white/30 transition-transform group-hover:translate-x-0.5 group-hover:text-white/60" />
                </button>
            </div>

            {/* Limit warning if 5 wallets reached */}
            {!canAdd && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-3 text-[11px] text-rose-300">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>You have 5 wallets connected. Disconnect one to add another.</span>
                </div>
            )}

            {/* Privacy notice */}
            <div className="flex items-start gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] text-white/45">
                <ShieldCheck className="h-4 w-4 shrink-0 text-white/40 mt-0.5" />
                <span>Connecting shares your address only. Every transaction is approved in your wallet.</span>
            </div>
        </div>
    );
}
