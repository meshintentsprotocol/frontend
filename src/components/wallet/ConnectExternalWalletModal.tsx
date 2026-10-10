/**
 * ConnectExternalWalletModal — Premium modal for connecting external BCH wallets.
 *
 * Supports:
 *   - Cashonize (WalletConnect v2) with QR + web wallet deep-link
 *   - Paytaca (WizardConnect default tab, WalletConnect secondary tab)
 *   - Other Wallet (generic WalletConnect v2)
 *   - BCH Intents Wallet (our browser extension, window.bchIntents — no QR)
 *
 * Follows the ParyonUSD reference design documented in wallet-docs.
 */

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
    X, Copy, Check, Loader2, ExternalLink, ChevronLeft,
    Wifi, WifiOff, Link2, Smartphone, Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useExternalBCHWallet, type ExternalWalletSource } from '@/context/ExternalBCHWalletProvider';
import { notifyToast as toast } from '@/lib/notify-toast';
// ── Types ────────────────────────────────────────────────────────────────────

type ModalStep = 'pick-wallet' | 'qr-display' | 'extension' | 'connected';

interface WalletOption {
    id: string;
    name: string;
    description: string;
    icon: string;       // emoji or icon path
    color: string;      // tailwind ring/bg color class prefix
    recommended?: boolean;
    hasSubTabs?: boolean; // Paytaca has WizardConnect / WalletConnect tabs
}

const WALLET_OPTIONS: WalletOption[] = [
    {
        id: 'cashonize',
        name: 'Cashonize',
        description: 'Full CashTokens + BCMR support',
        icon: '🟢',
        color: 'emerald',
        recommended: true,
    },
    {
        id: 'paytaca',
        name: 'Paytaca',
        description: 'Mobile BCH wallet with WizardConnect',
        icon: '🔵',
        color: 'blue',
        hasSubTabs: true,
    },
    {
        id: 'other',
        name: 'Other Wallet',
        description: 'Any BCH wallet with WalletConnect v2',
        icon: '🔗',
        color: 'violet',
    },
    {
        id: 'extension',
        name: 'BCH Intents Wallet',
        description: 'Browser extension — approve in the wallet, no QR code',
        icon: '🧩',
        color: 'amber',
    },
];

type PaytacaTab = 'wizard' | 'wc';

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
    open: boolean;
    onClose: () => void;
}

export function ConnectExternalWalletModal({ open, onClose }: Props) {
    const ext = useExternalBCHWallet();

    const [step, setStep] = useState<ModalStep>('pick-wallet');
    const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
    const [paytacaTab, setPaytacaTab] = useState<PaytacaTab>('wizard');
    const [uri, setUri] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [waiting, setWaiting] = useState(false);

    // Reset state when modal opens/closes
    useEffect(() => {
        if (open) {
            setStep('pick-wallet');
            setSelectedWallet(null);
            setUri(null);
            setError(null);
            setWaiting(false);
            setCopied(false);
        } else {
            ext.cancelConnecting();
        }
    }, [open]);

    // ── Handlers ─────────────────────────────────────────────────────────────

    const handleSelectWallet = useCallback(async (walletId: string, subTab?: PaytacaTab) => {
        setSelectedWallet(walletId);
        setError(null);
        setUri(null);

        if (walletId === 'extension') {
            // No pairing URI: the extension opens its own approval screen.
            setStep('extension');
            setWaiting(true);
            try {
                await ext.connectExtension();
                setStep('connected');
                toast.success('Wallet connected!');
                setTimeout(() => onClose(), 1800);
            } catch (e: any) {
                setError(
                    e?.code === 'NOT_INSTALLED' ? 'not-installed'
                    : e?.code === 4001 ? 'You declined the connection in the extension.'
                    : e?.message || 'Connection failed'
                );
            } finally {
                setWaiting(false);
            }
            return;
        }

        setStep('qr-display');

        try {
            let generatedUri: string;

            if (walletId === 'paytaca' && (subTab ?? paytacaTab) === 'wizard') {
                // WizardConnect for Paytaca
                generatedUri = await ext.startWizardConnect();
            } else {
                // WalletConnect v2 for everything else
                const label = walletId === 'cashonize' ? 'Cashonize'
                    : walletId === 'paytaca' ? 'Paytaca'
                    : 'External Wallet';
                generatedUri = await ext.startWalletConnect(label);
            }

            setUri(generatedUri);

            // Start waiting for approval
            setWaiting(true);
            try {
                if (walletId === 'paytaca' && (subTab ?? paytacaTab) === 'wizard') {
                    await ext.waitForWizardConnect();
                } else {
                    await ext.waitForWalletConnect();
                }
                // Connected!
                setStep('connected');
                toast.success('Wallet connected!');
                setTimeout(() => onClose(), 1800);
            } catch (e: any) {
                if (step !== 'pick-wallet') {
                    setError(e.message || 'Connection failed');
                }
            } finally {
                setWaiting(false);
            }
        } catch (e: any) {
            setError(e.message || 'Failed to generate connection URI');
            setStep('pick-wallet');
        }
    }, [ext, paytacaTab, onClose, step]);

    const handlePaytacaTabSwitch = useCallback((tab: PaytacaTab) => {
        setPaytacaTab(tab);
        if (step === 'qr-display' && selectedWallet === 'paytaca') {
            handleSelectWallet('paytaca', tab);
        }
    }, [step, selectedWallet, handleSelectWallet]);

    const handleBack = useCallback(() => {
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

    const modal = (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-md"
                onClick={onClose}
            />

            {/* Card */}
            <div
                className="fixed z-[201] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[460px] max-h-[90vh] overflow-y-auto rounded-[24px] bg-[#0a0a0a]/95 border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.7)]"
                onClick={e => e.stopPropagation()}
            >
                {/* ── Header ── */}
                <div className="flex items-center justify-between px-6 pt-6 pb-2">
                    <div className="flex items-center gap-2">
                        {step !== 'pick-wallet' && step !== 'connected' && (
                            <button
                                onClick={handleBack}
                                className="h-8 w-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                        )}
                        <h2 className="text-lg font-black tracking-tight text-white">
                            {step === 'connected' ? 'Connected!' : 'Connect BCH Wallet'}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
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
                                Connect an external Bitcoin Cash wallet to use alongside your web wallet.
                            </p>

                            {WALLET_OPTIONS.map(option => (
                                <button
                                    key={option.id}
                                    onClick={() => handleSelectWallet(option.id)}
                                    className={cn(
                                        "group w-full flex items-center gap-3.5 p-4 rounded-2xl border transition-all duration-200",
                                        "bg-white/[0.02] hover:bg-white/[0.05] border-white/[0.06] hover:border-white/[0.14]",
                                        "hover:-translate-y-[1px] hover:shadow-lg",
                                        option.recommended && `hover:shadow-${option.color}-500/10`
                                    )}
                                >
                                    {/* Icon */}
                                    <div className={cn(
                                        "h-11 w-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 transition-all",
                                        `bg-${option.color}-500/10 ring-1 ring-${option.color}-500/20`,
                                        `group-hover:ring-${option.color}-500/40 group-hover:shadow-sm group-hover:shadow-${option.color}-500/10`
                                    )}>
                                        {option.icon}
                                    </div>

                                    {/* Text */}
                                    <div className="flex-1 text-left min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-white">{option.name}</span>
                                            {option.recommended && (
                                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 font-bold uppercase tracking-wider">
                                                    Recommended
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-white/40 mt-0.5">{option.description}</p>
                                    </div>

                                    {/* Arrow */}
                                    <ChevronLeft className="h-4 w-4 text-white/20 group-hover:text-white/50 rotate-180 transition-colors" />
                                </button>
                            ))}

                            {ext.wallets.length > 0 && (
                                <div className="pt-2 border-t border-white/[0.06]">
                                    <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-2">
                                        Connected ({ext.wallets.length})
                                    </p>
                                    {ext.wallets.map(w => (
                                        <div key={w.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02]">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Wifi className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                                                <div className="min-w-0">
                                                    <span className="text-xs font-semibold text-white">{w.label}</span>
                                                    <p className="text-[10px] font-mono text-white/40 truncate">
                                                        {w.address.slice(0, 18)}…{w.address.slice(-6)}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); ext.disconnectWallet(w.id); }}
                                                className="text-[10px] text-red-400/70 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-500/10"
                                            >
                                                <WifiOff className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ═══════ STEP: QR Display ═══════ */}
                    {step === 'qr-display' && (
                        <div className="space-y-4 mt-2">
                            {/* Wallet header */}
                            {selectedOption && (
                                <div className="flex items-center gap-3 pb-3 border-b border-white/[0.06]">
                                    <div className={cn(
                                        "h-9 w-9 rounded-xl flex items-center justify-center text-lg",
                                        `bg-${selectedOption.color}-500/10 ring-1 ring-${selectedOption.color}-500/20`
                                    )}>
                                        {selectedOption.icon}
                                    </div>
                                    <div>
                                        <span className="text-sm font-bold text-white">{selectedOption.name}</span>
                                        <p className="text-[10px] text-white/40">
                                            {isWizardMode ? 'WizardConnect' : 'WalletConnect v2'}
                                        </p>
                                    </div>
                                </div>
                            )}

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
                                    <div className="p-4 bg-white rounded-2xl shadow-lg shadow-black/20">
                                        <QRCodeSVG
                                            value={uri}
                                            size={220}
                                            level="M"
                                            bgColor="#ffffff"
                                            fgColor="#000000"
                                            includeMargin={false}
                                        />
                                    </div>
                                ) : (
                                    <div className="w-[252px] h-[252px] rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                                        <Loader2 className="h-8 w-8 text-white/20 animate-spin" />
                                    </div>
                                )}

                                {/* Waiting status */}
                                <div className="flex items-center gap-2 mt-4 text-xs text-white/50">
                                    {waiting ? (
                                        <>
                                            <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                                            <span>Waiting for connection…</span>
                                        </>
                                    ) : error ? (
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
                                <ExternalLink className="h-3 w-3 mt-0.5 flex-shrink-0" />
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
                            {selectedOption && (
                                <div className="flex items-center gap-3 pb-3 border-b border-white/[0.06]">
                                    <div className="h-9 w-9 rounded-xl flex items-center justify-center text-lg bg-amber-500/10 ring-1 ring-amber-500/20">
                                        {selectedOption.icon}
                                    </div>
                                    <div>
                                        <span className="text-sm font-bold text-white">{selectedOption.name}</span>
                                        <p className="text-[10px] text-white/40">Browser extension</p>
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-col items-center py-6 space-y-3 text-center">
                                {waiting ? (
                                    <>
                                        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                                        <p className="text-sm font-bold text-white">Approve in the extension</p>
                                        <p className="text-[11px] text-white/40 max-w-[300px]">
                                            The wallet opened a request in its side panel or in a small window. Unlock it if it asks, then choose Connect.
                                        </p>
                                    </>
                                ) : error === 'not-installed' ? (
                                    <>
                                        <WifiOff className="h-8 w-8 text-white/30" />
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
                                    Try again
                                </button>
                            )}
                        </div>
                    )}

                    {/* ═══════ STEP: Connected ═══════ */}
                    {step === 'connected' && (
                        <div className="flex flex-col items-center py-6 space-y-4">
                            <div className="h-16 w-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                                <Check className="h-8 w-8 text-emerald-400" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-bold text-white">Wallet Connected</p>
                                <p className="text-[11px] text-white/40 mt-1">
                                    Your external wallet has been added successfully.
                                </p>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="relative flex h-2 w-2">
                                    <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70" />
                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                                </span>
                                <span className="text-xs text-emerald-400 font-semibold">Active</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );

    return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}
