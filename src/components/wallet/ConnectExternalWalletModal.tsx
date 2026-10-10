/**
 * ConnectExternalWalletModal — the one place a wallet gets connected.
 *
 * Offers, in this order:
 *   - the built-in BCH Intents Wallet (create / import / unlock), when the
 *     caller passes `onUseBuiltIn` and it is not unlocked yet
 *   - Cashonize (WalletConnect v2) with QR + web wallet deep-link
 *   - Paytaca (WizardConnect default tab, WalletConnect secondary tab)
 *   - Other Wallet (generic WalletConnect v2)
 *   - BCH Intents Wallet (our browser extension, window.bchIntents — no QR)
 *
 * An external wallet can be connected with or without the built-in wallet;
 * the one just connected becomes the active wallet.
 *
 * Icons come from public/logos/wallets/ (placeholders, replaceable).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
    X, Check, Loader2, ChevronLeft, ChevronRight, Unplug, Link2, Smartphone, Globe,
    ShieldCheck, Puzzle, RotateCw, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useExternalBCHWallet } from '@/context/ExternalBCHWalletProvider';
import { useWDK } from '@/context/WDKProvider';
import { useWallets, shortAddress } from '@/hooks/useWallets';
import { notifyToast as toast } from '@/lib/notify-toast';
import { WalletIcon } from './WalletIcon';

// ── Types ────────────────────────────────────────────────────────────────────

type ModalStep = 'pick-wallet' | 'qr-display' | 'extension' | 'connected';

interface WalletOption {
    id: 'cashonize' | 'paytaca' | 'other' | 'extension';
    name: string;
    description: string;
    /** File name in public/logos/wallets/. */
    iconId: string;
    /** Hex accent used for the icon ring and hover glow. */
    accent: string;
    /** How it connects, shown as a small tag. */
    method: string;
    recommended?: boolean;
}

const WALLET_OPTIONS: WalletOption[] = [
    {
        id: 'cashonize',
        name: 'Cashonize',
        description: 'Full CashTokens + BCMR support',
        iconId: 'cashonize',
        accent: '#4ade80',
        method: 'WalletConnect',
        recommended: true,
    },
    {
        id: 'paytaca',
        name: 'Paytaca',
        description: 'Mobile BCH wallet with WizardConnect',
        iconId: 'paytaca',
        accent: '#60a5fa',
        method: 'WizardConnect',
    },
    {
        id: 'other',
        name: 'Other Wallet',
        description: 'Any BCH wallet with WalletConnect v2',
        iconId: 'walletconnect',
        accent: '#a5b4fc',
        method: 'WalletConnect',
    },
    {
        id: 'extension',
        name: 'BCH Intents Wallet',
        description: 'Browser extension — approve in the wallet, no QR code',
        iconId: 'bch-intents',
        accent: '#fbbf24',
        method: 'Extension',
    },
];

type PaytacaTab = 'wizard' | 'wc';

const extensionPresent = () => !!(window as unknown as { bchIntents?: { isBCHIntents?: boolean } }).bchIntents?.isBCHIntents;

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
    open: boolean;
    onClose: () => void;
    /**
     * Shows the built-in wallet as the first choice (while it is not unlocked)
     * and is called when the user picks it. Leave out to list external wallets only.
     */
    onUseBuiltIn?: () => void;
}

export function ConnectExternalWalletModal({ open, onClose, onUseBuiltIn }: Props) {
    const ext = useExternalBCHWallet();
    const wdk = useWDK();
    const { wallets } = useWallets();

    const [step, setStep] = useState<ModalStep>('pick-wallet');
    const [selectedWallet, setSelectedWallet] = useState<WalletOption['id'] | null>(null);
    const [paytacaTab, setPaytacaTab] = useState<PaytacaTab>('wizard');
    const [uri, setUri] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [waiting, setWaiting] = useState(false);
    const [hasExtension, setHasExtension] = useState(false);

    // Each connection attempt gets a number; a result that arrives after the
    // user went back or picked something else belongs to an older attempt and is dropped.
    const attempt = useRef(0);

    // Reset state when modal opens/closes
    useEffect(() => {
        attempt.current++;
        if (open) {
            setStep('pick-wallet');
            setSelectedWallet(null);
            setUri(null);
            setError(null);
            setWaiting(false);
            setCopied(false);
            setHasExtension(extensionPresent());
        } else {
            ext.cancelConnecting();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // The extension announces itself a moment after the page loads.
    useEffect(() => {
        if (!open) return;
        const onReady = () => setHasExtension(true);
        window.addEventListener('bchIntents#initialized', onReady);
        return () => window.removeEventListener('bchIntents#initialized', onReady);
    }, [open]);

    // Escape closes
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    // ── Handlers ─────────────────────────────────────────────────────────────

    const finish = useCallback(() => {
        setStep('connected');
        toast.success('Wallet connected!');
        setTimeout(() => onClose(), 1800);
    }, [onClose]);

    const handleSelectWallet = useCallback(async (walletId: WalletOption['id'], subTab?: PaytacaTab) => {
        const mine = ++attempt.current;
        const current = () => attempt.current === mine;

        setSelectedWallet(walletId);
        setError(null);
        setUri(null);

        if (walletId === 'extension') {
            // No pairing URI: the extension opens its own approval screen.
            setStep('extension');
            setWaiting(true);
            try {
                await ext.connectExtension();
                if (current()) finish();
            } catch (e: any) {
                if (!current()) return;
                setError(
                    e?.code === 'NOT_INSTALLED' ? 'not-installed'
                    : e?.code === 4001 ? 'You declined the connection in the extension.'
                    : e?.message || 'Connection failed'
                );
            } finally {
                if (current()) setWaiting(false);
            }
            return;
        }

        setStep('qr-display');
        const wizard = walletId === 'paytaca' && (subTab ?? paytacaTab) === 'wizard';

        try {
            const label = walletId === 'cashonize' ? 'Cashonize' : walletId === 'paytaca' ? 'Paytaca' : 'External Wallet';
            const generatedUri = wizard ? await ext.startWizardConnect() : await ext.startWalletConnect(label);
            if (!current()) return;
            setUri(generatedUri);
            setWaiting(true);
        } catch (e: any) {
            if (!current()) return;
            setError(e?.message || 'Failed to generate connection URI');
            return;
        }

        try {
            if (wizard) await ext.waitForWizardConnect();
            else await ext.waitForWalletConnect();
            if (current()) finish();
        } catch (e: any) {
            if (current()) setError(e?.message || 'Connection failed');
        } finally {
            if (current()) setWaiting(false);
        }
    }, [ext, paytacaTab, finish]);

    const handlePaytacaTabSwitch = useCallback((tab: PaytacaTab) => {
        setPaytacaTab(tab);
        if (step === 'qr-display' && selectedWallet === 'paytaca') {
            handleSelectWallet('paytaca', tab);
        }
    }, [step, selectedWallet, handleSelectWallet]);

    const handleBack = useCallback(() => {
        attempt.current++;
        ext.cancelConnecting();
        setStep('pick-wallet');
        setUri(null);
        setError(null);
        setWaiting(false);
    }, [ext]);

    const copyUri = useCallback(() => {
        if (!uri) return;
        navigator.clipboard.writeText(uri);
        setCopied(true);
        toast.success('Link copied!');
        setTimeout(() => setCopied(false), 2000);
    }, [uri]);

    if (!open) return null;

    // ── Render ───────────────────────────────────────────────────────────────

    const selectedOption = WALLET_OPTIONS.find(w => w.id === selectedWallet);
    const isWizardMode = selectedWallet === 'paytaca' && paytacaTab === 'wizard';
    const cashonizeDeepLink = uri && selectedWallet === 'cashonize' ? ext.getCashonizeDeepLink(uri) : null;
    const paytacaDeepLink = uri && selectedWallet === 'paytaca' ? ext.getPaytacaDeepLink(uri, isWizardMode) : null;
    const showBuiltIn = !!onUseBuiltIn && !wdk.isInitialized;
    const externalWallets = wallets.filter(w => w.kind !== 'main');
    const justConnected = externalWallets[externalWallets.length - 1];

    const selectedHeader = selectedOption && (
        <div className="flex items-center gap-3 pb-3 border-b border-white/[0.06]">
            <WalletIcon id={selectedOption.iconId} color={selectedOption.accent} size={40} />
            <div className="min-w-0">
                <span className="text-sm font-bold text-white">{selectedOption.name}</span>
                <p className="text-[10px] text-white/40">
                    {selectedOption.id === 'extension' ? 'Browser extension' : isWizardMode ? 'WizardConnect' : 'WalletConnect v2'}
                </p>
            </div>
        </div>
    );

    const modal = (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Card */}
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Connect a wallet"
                className="fixed z-[201] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-24px)] max-w-[460px] max-h-[90vh] overflow-y-auto rounded-[24px] bg-[#0a0a0a]/95 border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.7)] animate-in fade-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* ── Header ── */}
                <div className="flex items-center justify-between px-6 pt-6 pb-2">
                    <div className="flex items-center gap-2">
                        {step !== 'pick-wallet' && step !== 'connected' && (
                            <button
                                onClick={handleBack}
                                aria-label="Back"
                                className="h-8 w-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                        )}
                        <h2 className="text-lg font-black tracking-tight text-white">
                            {step === 'connected' ? 'Connected!' : 'Connect a wallet'}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="px-6 pb-6">
                    {/* ═══════ STEP: Pick Wallet ═══════ */}
                    {step === 'pick-wallet' && (
                        <div className="space-y-3 mt-2">
                            <p className="text-xs text-white/50">
                                {showBuiltIn
                                    ? 'Use the built-in wallet for every chain, or connect a Bitcoin Cash wallet you already have. You can add more later.'
                                    : 'Connect another Bitcoin Cash wallet. It is added next to the wallets you already use.'}
                            </p>

                            {/* Built-in wallet */}
                            {showBuiltIn && (
                                <button
                                    onClick={() => { onClose(); onUseBuiltIn!(); }}
                                    className="group relative w-full overflow-hidden flex items-center gap-3.5 p-4 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.12] to-emerald-500/[0.02] hover:from-emerald-500/[0.18] hover:border-emerald-400/50 transition-all duration-200 hover:-translate-y-[1px] hover:shadow-lg hover:shadow-emerald-500/10"
                                >
                                    <WalletIcon id="main" color="#10b981" size={44} />
                                    <div className="flex-1 text-left min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-white">BCH Intents Wallet</span>
                                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 font-bold uppercase tracking-wider">
                                                Built-in
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-white/50 mt-0.5">
                                            {wdk.hasStoredWallet ? 'Unlock your wallet on this device' : 'Create or import — BCH, EVM, Solana and Bitcoin'}
                                        </p>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-emerald-400/60 group-hover:text-emerald-300 transition-colors" />
                                </button>
                            )}

                            {showBuiltIn && (
                                <div className="flex items-center gap-3 pt-1">
                                    <span className="h-px flex-1 bg-white/[0.06]" />
                                    <span className="text-[10px] text-white/30 uppercase tracking-wider font-semibold">or an external BCH wallet</span>
                                    <span className="h-px flex-1 bg-white/[0.06]" />
                                </div>
                            )}

                            {WALLET_OPTIONS.map(option => (
                                <button
                                    key={option.id}
                                    onClick={() => handleSelectWallet(option.id)}
                                    className="group w-full flex items-center gap-3.5 p-3.5 rounded-2xl border transition-all duration-200 bg-white/[0.02] hover:bg-white/[0.05] border-white/[0.06] hover:border-white/[0.14] hover:-translate-y-[1px] hover:shadow-lg"
                                >
                                    <WalletIcon id={option.iconId} color={option.accent} size={42} />

                                    {/* Text */}
                                    <div className="flex-1 text-left min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm font-bold text-white">{option.name}</span>
                                            {option.recommended && (
                                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 font-bold uppercase tracking-wider">
                                                    Recommended
                                                </span>
                                            )}
                                            {option.id === 'extension' && (
                                                <span className={cn(
                                                    "text-[9px] px-1.5 py-0.5 rounded-full border font-bold uppercase tracking-wider",
                                                    hasExtension
                                                        ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-400"
                                                        : "bg-white/[0.04] border-white/[0.08] text-white/40"
                                                )}>
                                                    {hasExtension ? 'Detected' : 'Not installed'}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-white/40 mt-0.5">{option.description}</p>
                                    </div>

                                    <span className="hidden sm:inline text-[9px] font-semibold uppercase tracking-wider text-white/25">{option.method}</span>
                                    <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-white/50 transition-colors" />
                                </button>
                            ))}

                            {externalWallets.length > 0 && (
                                <div className="pt-3 border-t border-white/[0.06]">
                                    <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-2">
                                        Connected ({externalWallets.length})
                                    </p>
                                    <div className="space-y-1">
                                        {externalWallets.map(w => (
                                            <div key={w.id} className="flex items-center justify-between gap-2 py-2 px-2.5 rounded-xl bg-white/[0.02]">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <WalletIcon id={w.iconId} color={w.color} size={28} active={w.active} />
                                                    <div className="min-w-0">
                                                        <span className="text-xs font-semibold text-white">{w.name}</span>
                                                        <p className="text-[10px] font-mono text-white/40 truncate">{shortAddress(w.address, 10, 6)}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); ext.disconnectWallet(w.id); }}
                                                    title="Disconnect"
                                                    aria-label={`Disconnect ${w.name}`}
                                                    className="h-7 w-7 flex items-center justify-center rounded-lg text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                                >
                                                    <Unplug className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex items-start gap-2 text-[10px] text-white/35 pt-1">
                                <ShieldCheck className="h-3.5 w-3.5 mt-px flex-shrink-0 text-emerald-400/60" />
                                <span>Connecting shares your address only. Every transaction is approved in your wallet.</span>
                            </div>
                        </div>
                    )}

                    {/* ═══════ STEP: QR Display ═══════ */}
                    {step === 'qr-display' && (
                        <div className="space-y-4 mt-2">
                            {selectedHeader}

                            {/* Paytaca sub-tabs */}
                            {selectedWallet === 'paytaca' && (
                                <div className="flex bg-white/[0.03] rounded-xl p-1 border border-white/[0.06]">
                                    {(['wizard', 'wc'] as PaytacaTab[]).map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => handlePaytacaTabSwitch(tab)}
                                            className={cn(
                                                "flex-1 py-2 rounded-lg text-xs font-semibold transition-all",
                                                paytacaTab === tab
                                                    ? "bg-white/[0.08] text-white border border-white/[0.1]"
                                                    : "text-white/40 hover:text-white/70"
                                            )}
                                        >
                                            {tab === 'wizard' ? 'WizardConnect' : 'WalletConnect'}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* QR Code */}
                            <div className="flex flex-col items-center">
                                {uri ? (
                                    <div className="p-4 bg-white rounded-2xl shadow-lg shadow-black/20 animate-in fade-in zoom-in-95 duration-300">
                                        <QRCodeSVG
                                            value={uri}
                                            size={220}
                                            level="M"
                                            bgColor="#ffffff"
                                            fgColor="#000000"
                                            includeMargin={false}
                                        />
                                    </div>
                                ) : error ? (
                                    <div className="w-[252px] h-[252px] rounded-2xl bg-red-500/[0.04] border border-red-500/20 flex flex-col items-center justify-center gap-3 px-6 text-center">
                                        <p className="text-xs text-red-400">{error}</p>
                                        <button
                                            onClick={() => selectedWallet && handleSelectWallet(selectedWallet)}
                                            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-semibold bg-white/[0.06] border border-white/[0.1] text-white hover:bg-white/[0.1] transition-colors"
                                        >
                                            <RotateCw className="h-3.5 w-3.5" /> Try again
                                        </button>
                                    </div>
                                ) : (
                                    <div className="relative w-[252px] h-[252px] rounded-2xl bg-white/[0.03] border border-white/[0.06] overflow-hidden flex flex-col items-center justify-center gap-3">
                                        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-white/[0.05] to-transparent" />
                                        <Loader2 className="relative h-7 w-7 text-white/30 animate-spin" />
                                        <span className="relative text-[11px] text-white/35">Preparing a secure link…</span>
                                    </div>
                                )}

                                {/* Status */}
                                <div className="flex items-center gap-2 mt-4 h-7 px-3 rounded-full bg-white/[0.03] border border-white/[0.06] text-[11px] text-white/60">
                                    {waiting ? (
                                        <>
                                            <span className="relative flex h-2 w-2">
                                                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70" />
                                                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                                            </span>
                                            <span>Waiting for approval in your wallet…</span>
                                        </>
                                    ) : error && uri ? (
                                        <span className="text-red-400">{error}</span>
                                    ) : (
                                        <>
                                            <Smartphone className="h-3.5 w-3.5" />
                                            <span>Scan with your wallet app</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Action buttons */}
                            <div className="space-y-2">
                                {/* Cashonize web wallet deep-link */}
                                {cashonizeDeepLink && (
                                    <a
                                        href={cashonizeDeepLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full flex items-center justify-center gap-2 h-11 rounded-xl text-xs font-semibold bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200 transition-all"
                                    >
                                        <Globe className="h-4 w-4" />
                                        Open in Cashonize Web Wallet
                                    </a>
                                )}

                                {/* Paytaca deep-link */}
                                {paytacaDeepLink && (
                                    <a
                                        href={paytacaDeepLink}
                                        className="w-full flex items-center justify-center gap-2 h-11 rounded-xl text-xs font-semibold bg-blue-500/10 border border-blue-500/25 text-blue-300 hover:bg-blue-500/20 hover:text-blue-200 transition-all"
                                    >
                                        <Smartphone className="h-4 w-4" />
                                        Open Paytaca App
                                    </a>
                                )}

                                {/* Copy Link */}
                                <button
                                    onClick={copyUri}
                                    disabled={!uri}
                                    className="w-full flex items-center justify-center gap-2 h-10 rounded-xl text-xs font-semibold bg-white/[0.04] border border-white/[0.08] text-white/70 hover:bg-white/[0.07] hover:text-white transition-all disabled:opacity-40"
                                >
                                    {copied
                                        ? <><Check className="h-3.5 w-3.5 text-emerald-400" /> Copied!</>
                                        : <><Link2 className="h-3.5 w-3.5" /> Copy Link</>
                                    }
                                </button>
                            </div>

                            {/* Info banner */}
                            <div className="flex items-start gap-2 text-[10px] text-amber-400/80 bg-amber-500/[0.06] border border-amber-500/15 rounded-xl p-3">
                                <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                <span>
                                    {isWizardMode
                                        ? 'WizardConnect uses encrypted Nostr relays. Delegated features may be limited.'
                                        : 'WalletConnect connects a single address only. Only funds on that address will be detected.'
                                    }
                                </span>
                            </div>
                        </div>
                    )}

                    {/* ═══════ STEP: Browser extension ═══════ */}
                    {step === 'extension' && (
                        <div className="space-y-4 mt-2">
                            {selectedHeader}

                            <div className="flex flex-col items-center py-6 space-y-3 text-center">
                                {waiting ? (
                                    <>
                                        <div className="relative flex h-16 w-16 items-center justify-center">
                                            <span className="absolute inset-0 rounded-2xl border border-amber-400/30 animate-ping" />
                                            <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/25">
                                                <Loader2 className="h-7 w-7 animate-spin text-amber-300" />
                                            </span>
                                        </div>
                                        <p className="text-sm font-bold text-white">Approve in the extension</p>
                                        <p className="text-[11px] text-white/40 max-w-[300px]">
                                            The wallet opened a request in its side panel or in a small window. Unlock it if it asks, then choose Connect.
                                        </p>
                                    </>
                                ) : error === 'not-installed' ? (
                                    <>
                                        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.03] border border-white/[0.08]">
                                            <Puzzle className="h-7 w-7 text-white/30" />
                                        </span>
                                        <p className="text-sm font-bold text-white">Extension not found</p>
                                        <p className="text-[11px] text-white/40 max-w-[300px]">
                                            Install the BCH Intents Wallet extension in this browser (or load its dist folder at chrome://extensions), reload this page, and try again.
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-xs text-red-400 max-w-[320px]">{error}</p>
                                )}
                            </div>

                            {!waiting && (
                                <button
                                    onClick={() => handleSelectWallet('extension')}
                                    className="w-full flex items-center justify-center gap-2 h-10 rounded-xl text-xs font-semibold bg-white/[0.04] border border-white/[0.08] text-white/70 hover:bg-white/[0.07] hover:text-white transition-all"
                                >
                                    <RotateCw className="h-3.5 w-3.5" /> Try again
                                </button>
                            )}
                        </div>
                    )}

                    {/* ═══════ STEP: Connected ═══════ */}
                    {step === 'connected' && (
                        <div className="flex flex-col items-center py-6 space-y-4 animate-in fade-in zoom-in-95 duration-300">
                            <div className="relative">
                                {justConnected
                                    ? <WalletIcon id={justConnected.iconId} color={justConnected.color} size={64} />
                                    : <span className="flex h-16 w-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30" />}
                                <span className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 ring-4 ring-[#0a0a0a]">
                                    <Check className="h-3.5 w-3.5 text-[#050505]" strokeWidth={3} />
                                </span>
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-bold text-white">{justConnected?.name ?? 'Wallet'} connected</p>
                                {justConnected && (
                                    <p className="text-[11px] font-mono text-white/40 mt-1">{shortAddress(justConnected.address, 12, 8)}</p>
                                )}
                                <p className="text-[11px] text-white/40 mt-1">
                                    It is now the active wallet. Switch any time from the header.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );

    return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}
