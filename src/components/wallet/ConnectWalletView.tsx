/**
 * ConnectWalletView — the one place a wallet gets connected, as a view of the
 * wallet frame (WalletPopup). It is also the app's "Connect" screen: with no
 * wallet yet, the frame opens on it.
 *
 * Offers, in this order:
 *   - the built-in BCH Intents Wallet (create / import / unlock), while it is not unlocked
 *   - Cashonize (WalletConnect v2) with QR + web wallet deep-link
 *   - Paytaca (WizardConnect default tab, WalletConnect secondary tab)
 *   - Other Wallet (generic WalletConnect v2)
 *   - BCH Intents Wallet (our browser extension, window.bchIntents — no QR)
 *
 * An external wallet can be connected with or without the built-in wallet; the
 * one just connected becomes the active wallet, and its colour and name are
 * chosen on the last step.
 *
 * Icons come from public/logos/wallets/ (placeholders, replaceable).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
    Check, Loader2, ChevronLeft, ChevronRight, Link2, Smartphone, Globe,
    ShieldCheck, Puzzle, RotateCw, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useExternalBCHWallet } from '@/context/ExternalBCHWalletProvider';
import { useWDK } from '@/context/WDKProvider';
import { useWallets, shortAddress } from '@/hooks/useWallets';
import { walletUi } from '@/lib/walletUi';
import { notifyToast as toast } from '@/lib/notify-toast';
import { Chameleon } from './Chameleon';
import { WalletGlyph, WalletIcon } from './WalletIcon';
import { WalletLookEditor } from './WalletLookEditor';

type Step = 'pick-wallet' | 'qr-display' | 'extension' | 'connected';

interface WalletOption {
    id: 'cashonize' | 'paytaca' | 'other' | 'extension';
    name: string;
    description: string;
    /** File name in public/logos/wallets/. */
    iconId: string;
    /** Hex accent used for the icon ring. */
    accent: string;
    /** How it connects, shown as a small tag. */
    method: string;
    recommended?: boolean;
}

const WALLET_OPTIONS: WalletOption[] = [
    { id: 'cashonize', name: 'Cashonize', description: 'Full CashTokens + BCMR support', iconId: 'cashonize', accent: '#4ade80', method: 'WalletConnect', recommended: true },
    { id: 'paytaca', name: 'Paytaca', description: 'Mobile BCH wallet with WizardConnect', iconId: 'paytaca', accent: '#60a5fa', method: 'WizardConnect' },
    { id: 'other', name: 'Other Wallet', description: 'Any BCH wallet with WalletConnect v2', iconId: 'walletconnect', accent: '#a5b4fc', method: 'WalletConnect' },
    { id: 'extension', name: 'BCH Intents Wallet', description: 'Browser extension — approve in the wallet, no QR code', iconId: 'bch-intents', accent: '#fbbf24', method: 'Extension' },
];

type PaytacaTab = 'wizard' | 'wc';

const extensionPresent = () => !!(window as unknown as { bchIntents?: { isBCHIntents?: boolean } }).bchIntents?.isBCHIntents;

const OPTION = 'group flex w-full items-center gap-3 rounded-xl p-3 text-left transition-all duration-200 lg-well hover:border-white/[0.16] hover:bg-white/[0.06] active:scale-[0.99]';
const TAG = 'rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider';
const SECONDARY = 'flex h-11 w-full items-center justify-center gap-2 rounded-xl text-xs font-semibold text-white/75 transition-colors lg-well hover:bg-white/[0.07] hover:text-white disabled:opacity-40';

export function ConnectWalletView({ onDone }: {
    /** The user is finished here: go to the wallet. */
    onDone: () => void;
}) {
    const ext = useExternalBCHWallet();
    const wdk = useWDK();
    const { wallets, hasWallet } = useWallets();

    const [step, setStep] = useState<Step>('pick-wallet');
    const [selectedWallet, setSelectedWallet] = useState<WalletOption['id'] | null>(null);
    const [paytacaTab, setPaytacaTab] = useState<PaytacaTab>('wizard');
    const [uri, setUri] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [waiting, setWaiting] = useState(false);
    const [hasExtension, setHasExtension] = useState(extensionPresent);

    // Each connection attempt gets a number; a result that arrives after the
    // user went back or picked something else belongs to an older attempt and is dropped.
    const attempt = useRef(0);

    // Leaving the view abandons whatever was being paired.
    const cancel = ext.cancelConnecting;
    useEffect(() => () => { attempt.current++; cancel(); }, [cancel]);

    // The extension announces itself a moment after the page loads.
    useEffect(() => {
        const onReady = () => setHasExtension(true);
        window.addEventListener('bchIntents#initialized', onReady);
        return () => window.removeEventListener('bchIntents#initialized', onReady);
    }, []);

    const finish = useCallback(() => {
        setStep('connected');
        toast.success('Wallet connected!');
    }, []);

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
        if (step === 'qr-display' && selectedWallet === 'paytaca') handleSelectWallet('paytaca', tab);
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

    const selectedOption = WALLET_OPTIONS.find(w => w.id === selectedWallet);
    const isWizardMode = selectedWallet === 'paytaca' && paytacaTab === 'wizard';
    const cashonizeDeepLink = uri && selectedWallet === 'cashonize' ? ext.getCashonizeDeepLink(uri) : null;
    const paytacaDeepLink = uri && selectedWallet === 'paytaca' ? ext.getPaytacaDeepLink(uri, isWizardMode) : null;
    const showBuiltIn = !wdk.isInitialized;
    const externalWallets = wallets.filter(w => w.kind !== 'main');
    const justConnected = externalWallets[externalWallets.length - 1];

    // Back goes one step up; from the list it returns to the wallet, when there is one.
    const back = step === 'qr-display' || step === 'extension' ? handleBack : step === 'pick-wallet' && hasWallet ? onDone : null;

    const selectedHeader = selectedOption && (
        <div className="flex items-center gap-3 border-b border-white/[0.06] pb-3">
            <WalletIcon id={selectedOption.iconId} color={selectedOption.accent} size={40} />
            <div className="min-w-0">
                <span className="text-sm font-bold text-white">{selectedOption.name}</span>
                <p className="text-[10px] text-white/40">
                    {selectedOption.id === 'extension' ? 'Browser extension' : isWizardMode ? 'WizardConnect' : 'WalletConnect v2'}
                </p>
            </div>
        </div>
    );

    return (
        <div className="flex min-h-0 flex-1 flex-col" data-wallet-view="connect">
            <div className="flex h-12 shrink-0 items-center gap-1 px-3">
                {back && (
                    <button type="button" onClick={back} aria-label="Back"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white">
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                )}
                <h2 className={cn('text-sm font-bold tracking-tight text-white', !back && 'pl-1.5')}>
                    {step === 'connected' ? 'Connected' : hasWallet ? 'Add a wallet' : 'Connect a wallet'}
                </h2>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 lg-scroll">
                {/* ═══════ Pick a wallet ═══════ */}
                {step === 'pick-wallet' && (
                    <div className="space-y-2.5">
                        {!hasWallet && (
                            <div className="lg-card mb-3 flex items-center gap-3 rounded-xl p-4">
                                <div className="min-w-0 flex-1">
                                    <div className="text-lg font-bold leading-tight text-white">Welcome</div>
                                    <p className="mt-1 text-xs leading-relaxed text-white/55">
                                        Use the built-in wallet for every chain, or connect a Bitcoin Cash wallet you already have. You can add more later.
                                    </p>
                                </div>
                                <Chameleon size={96} className="-mr-1 text-white/40" />
                            </div>
                        )}
                        {hasWallet && (
                            <p className="pb-1 text-xs text-white/50">
                                Connect another Bitcoin Cash wallet. It is added next to the wallets you already use.
                            </p>
                        )}

                        {showBuiltIn && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => walletUi.openOnboarding()}
                                    className="group flex w-full items-center gap-3 rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.14] to-emerald-500/[0.02] p-3.5 text-left transition-all duration-200 hover:border-emerald-400/50 hover:from-emerald-500/[0.2] active:scale-[0.99]"
                                >
                                    <WalletGlyph size={44} />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm font-bold text-white">BCH Intents Wallet</span>
                                            <span className={cn(TAG, 'border-emerald-500/25 bg-emerald-500/15 text-emerald-400')}>Built-in</span>
                                        </div>
                                        <p className="mt-0.5 text-[11px] text-white/50">
                                            {wdk.hasStoredWallet ? 'Unlock your wallet on this device' : 'Create or import — BCH, EVM, Solana and Bitcoin'}
                                        </p>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-emerald-400/60 transition-colors group-hover:text-emerald-300" />
                                </button>
                                <div className="flex items-center gap-3 py-1">
                                    <span className="h-px flex-1 bg-white/[0.06]" />
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">or an external BCH wallet</span>
                                    <span className="h-px flex-1 bg-white/[0.06]" />
                                </div>
                            </>
                        )}

                        {WALLET_OPTIONS.map(option => (
                            <button key={option.id} type="button" onClick={() => handleSelectWallet(option.id)} className={OPTION}>
                                <WalletIcon id={option.iconId} color={option.accent} size={42} />
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-bold text-white">{option.name}</span>
                                        {option.recommended && <span className={cn(TAG, 'border-emerald-500/25 bg-emerald-500/15 text-emerald-400')}>Recommended</span>}
                                        {option.id === 'extension' && (
                                            <span className={cn(TAG, hasExtension ? 'border-emerald-500/25 bg-emerald-500/15 text-emerald-400' : 'border-white/[0.08] bg-white/[0.04] text-white/40')}>
                                                {hasExtension ? 'Detected' : 'Not installed'}
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-0.5 text-[11px] text-white/40">{option.description}</p>
                                </div>
                                <ChevronRight className="h-4 w-4 shrink-0 text-white/20 transition-colors group-hover:text-white/50" />
                            </button>
                        ))}

                        <div className="flex items-start gap-2 pt-2 text-[10px] text-white/35">
                            <ShieldCheck className="mt-px h-3.5 w-3.5 flex-shrink-0 text-emerald-400/60" />
                            <span>Connecting shares your address only. Every transaction is approved in your wallet.</span>
                        </div>
                    </div>
                )}

                {/* ═══════ QR ═══════ */}
                {step === 'qr-display' && (
                    <div className="space-y-4">
                        {selectedHeader}

                        {selectedWallet === 'paytaca' && (
                            <div className="flex rounded-xl p-1 lg-well">
                                {(['wizard', 'wc'] as PaytacaTab[]).map(tab => (
                                    <button key={tab} type="button" onClick={() => handlePaytacaTabSwitch(tab)}
                                        className={cn('flex-1 rounded-xl py-2 text-xs font-semibold transition-all', paytacaTab === tab ? 'bg-white/[0.1] text-white' : 'text-white/40 hover:text-white/70')}>
                                        {tab === 'wizard' ? 'WizardConnect' : 'WalletConnect'}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="flex flex-col items-center">
                            {uri ? (
                                <div className="rounded-xl bg-white p-4 shadow-lg shadow-black/20 animate-in fade-in zoom-in-95 duration-300">
                                    <QRCodeSVG value={uri} size={212} level="M" bgColor="#ffffff" fgColor="#000000" includeMargin={false} />
                                </div>
                            ) : error ? (
                                <div className="flex h-[244px] w-[244px] flex-col items-center justify-center gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.04] px-6 text-center">
                                    <p className="text-xs text-red-400">{error}</p>
                                    <button type="button" onClick={() => selectedWallet && handleSelectWallet(selectedWallet)}
                                        className="flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.06] px-3 text-[11px] font-semibold text-white transition-colors hover:bg-white/[0.1]">
                                        <RotateCw className="h-3.5 w-3.5" /> Try again
                                    </button>
                                </div>
                            ) : (
                                <div className="relative flex h-[244px] w-[244px] flex-col items-center justify-center gap-3 overflow-hidden rounded-xl lg-well">
                                    <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-white/[0.05] to-transparent" />
                                    <Loader2 className="relative h-7 w-7 animate-spin text-white/30" />
                                    <span className="relative text-[11px] text-white/35">Preparing a secure link…</span>
                                </div>
                            )}

                            <div className="mt-4 flex h-7 items-center gap-2 rounded-full px-3 text-[11px] text-white/60 lg-well">
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

                        <div className="space-y-2">
                            {cashonizeDeepLink && (
                                <a href={cashonizeDeepLink} target="_blank" rel="noopener noreferrer"
                                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-xs font-semibold text-emerald-300 transition-all hover:bg-emerald-500/20 hover:text-emerald-200">
                                    <Globe className="h-4 w-4" /> Open in Cashonize Web Wallet
                                </a>
                            )}
                            {paytacaDeepLink && (
                                <a href={paytacaDeepLink}
                                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-blue-500/25 bg-blue-500/10 text-xs font-semibold text-blue-300 transition-all hover:bg-blue-500/20 hover:text-blue-200">
                                    <Smartphone className="h-4 w-4" /> Open Paytaca App
                                </a>
                            )}
                            <button type="button" onClick={copyUri} disabled={!uri} className={SECONDARY}>
                                {copied ? <><Check className="h-3.5 w-3.5 text-emerald-400" /> Copied!</> : <><Link2 className="h-3.5 w-3.5" /> Copy Link</>}
                            </button>
                        </div>

                        <div className="flex items-start gap-2 rounded-xl border border-amber-500/15 bg-amber-500/[0.06] p-3 text-[10px] text-amber-400/80">
                            <Info className="mt-0.5 h-3 w-3 flex-shrink-0" />
                            <span>
                                {isWizardMode
                                    ? 'WizardConnect uses encrypted Nostr relays. Delegated features may be limited.'
                                    : 'WalletConnect connects a single address only. Only funds on that address will be detected.'}
                            </span>
                        </div>
                    </div>
                )}

                {/* ═══════ Browser extension ═══════ */}
                {step === 'extension' && (
                    <div className="space-y-4">
                        {selectedHeader}
                        <div className="flex flex-col items-center space-y-3 py-4 text-center">
                            {waiting ? (
                                <>
                                    <Chameleon size={120} tone="#fbbf24" mood="busy" className="text-white/40" />
                                    <p className="text-sm font-bold text-white">Approve in the extension</p>
                                    <p className="max-w-[300px] text-[11px] text-white/40">
                                        The wallet opened a request in its side panel or in a small window. Unlock it if it asks, then choose Connect.
                                    </p>
                                </>
                            ) : error === 'not-installed' ? (
                                <>
                                    <span className="flex h-16 w-16 items-center justify-center rounded-xl lg-well">
                                        <Puzzle className="h-7 w-7 text-white/30" />
                                    </span>
                                    <p className="text-sm font-bold text-white">Extension not found</p>
                                    <p className="max-w-[300px] text-[11px] text-white/40">
                                        Install the BCH Intents Wallet extension in this browser (or load its dist folder at chrome://extensions), reload this page, and try again.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <Chameleon size={110} tone="#f87171" mood="error" className="text-white/40" />
                                    <p className="max-w-[320px] text-xs text-red-400">{error}</p>
                                </>
                            )}
                        </div>
                        {!waiting && (
                            <button type="button" onClick={() => handleSelectWallet('extension')} className={SECONDARY}>
                                <RotateCw className="h-3.5 w-3.5" /> Try again
                            </button>
                        )}
                    </div>
                )}

                {/* ═══════ Connected: give it a colour and a name ═══════ */}
                {step === 'connected' && (
                    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                        <div className="lg-card flex items-center gap-3 rounded-xl p-4" style={{ ['--lg-tint' as string]: justConnected?.color }}>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2.5">
                                    <WalletGlyph color={justConnected?.color} size={44} />
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-bold text-white">{justConnected?.name ?? 'Wallet'}</p>
                                        {justConnected && <p className="truncate font-mono text-[11px] text-white/45">{shortAddress(justConnected.address, 8, 6)}</p>}
                                    </div>
                                </div>
                                <p className="mt-2.5 text-[11px] text-white/50">It is now the active wallet. Pick the colour it shows in everywhere.</p>
                            </div>
                            <Chameleon size={92} tone={justConnected?.color} mood="happy" className="-mr-1 text-white/40" />
                        </div>

                        {justConnected && <WalletLookEditor wallet={justConnected} />}

                        <button type="button" onClick={onDone} data-connect-done
                            className="h-12 w-full rounded-xl text-sm font-bold text-[#050505] transition-transform active:scale-[0.98]"
                            style={{ background: justConnected?.color ?? '#10b981' }}>
                            Done
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
