/**
 * PairingQr — Step 3 of Connect flow (BCH QR + Protocol selection).
 *
 * Supports:
 * - Protocol tabs: WizardConnect (recommended) / WalletConnect
 * - QR code: QRCodeSVG with aria-label
 * - Full URI text (selectable, monospace, data-connect-uri) + Copy link button
 * - Mobile layout: Copy first, QR second on touch screens
 * - WalletConnect: Cashonize web deep link + countdown timer
 * - Status indicator: Waiting for approval in your wallet
 *
 * Phase 2: The connect screen
 */

import { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
    ChevronLeft, Copy, Check, ExternalLink, RotateCw, Loader2,
    Clock, Smartphone
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BchProtocol } from './useConnectFlow';
import { useExternalBCHWallet } from '@/context/ExternalBCHWalletProvider';
import { notifyToast as toast } from '@/lib/notify-toast';

interface PairingQrProps {
    protocol: BchProtocol;
    qrValue: string | null;
    linkText: string | null;
    expiresAt?: number;
    isLoading: boolean;
    error: string | null;
    onSelectProtocol: (protocol: BchProtocol) => void;
    onRetry: () => void;
    onBack: () => void;
}

export function PairingQr({
    protocol,
    qrValue,
    linkText,
    expiresAt,
    isLoading,
    error,
    onSelectProtocol,
    onRetry,
    onBack,
}: PairingQrProps) {
    const { getCashonizeDeepLink } = useExternalBCHWallet();
    const [copied, setCopied] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

    // Detect touch / coarse pointer for mobile layout ordering
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mq = window.matchMedia('(pointer: coarse)');
        setIsMobile(mq.matches);
        const listener = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        mq.addEventListener?.('change', listener);
        return () => mq.removeEventListener?.('change', listener);
    }, []);

    // Expiry countdown timer (for WalletConnect)
    useEffect(() => {
        if (!expiresAt) {
            setSecondsLeft(null);
            return;
        }

        const update = () => {
            const diff = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
            setSecondsLeft(diff);
        };

        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [expiresAt]);

    const isExpired = secondsLeft !== null && secondsLeft <= 0;

    const copyLink = useCallback(async () => {
        if (!linkText) return;
        try {
            await navigator.clipboard.writeText(linkText);
            setCopied(true);
            toast.success('Link copied to clipboard');
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback for blocked clipboard
            setCopied(true);
            toast.info('Press Ctrl+C to copy link');
            setTimeout(() => setCopied(false), 2000);
        }
    }, [linkText]);

    return (
        <div className="space-y-4" data-connect-step="qr">
            {/* Header with back button */}
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={onBack}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/60 transition-colors hover:border-white/20 hover:text-white"
                    aria-label="Back to chain selection"
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>
                <div>
                    <h3 className="text-base font-semibold text-white">Connect Bitcoin Cash</h3>
                    <p className="text-xs text-white/50">Scan the QR code or copy the connection link</p>
                </div>
            </div>

            {/* Protocol tabs */}
            <div className="flex rounded-xl bg-white/[0.04] p-1 border border-white/10">
                <button
                    type="button"
                    onClick={() => onSelectProtocol('wizardconnect')}
                    className={cn(
                        'flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all',
                        protocol === 'wizardconnect'
                            ? 'bg-emerald-500/20 text-emerald-300 shadow-sm border border-emerald-500/30'
                            : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
                    )}
                >
                    WizardConnect <span className="text-[10px] opacity-75">· recommended</span>
                </button>
                <button
                    type="button"
                    onClick={() => onSelectProtocol('walletconnect')}
                    className={cn(
                        'flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all',
                        protocol === 'walletconnect'
                            ? 'bg-sky-500/20 text-sky-300 shadow-sm border border-sky-500/30'
                            : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
                    )}
                >
                    WalletConnect
                </button>
            </div>

            {/* Loading or Error */}
            {isLoading && !qrValue && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-white/40" />
                    <p className="mt-3 text-xs text-white/50">Generating pairing link…</p>
                </div>
            )}

            {error && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.08] p-4 text-center">
                    <p className="text-xs text-rose-300 font-medium">{error}</p>
                    <button
                        type="button"
                        onClick={onRetry}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/30"
                    >
                        <RotateCw className="h-3.5 w-3.5" />
                        Retry
                    </button>
                </div>
            )}

            {/* Main pairing body: on mobile, Copy comes first; on desktop, QR comes first */}
            {qrValue && linkText && !error && (
                <div className="space-y-4">
                    {/* Expiry / renewal notice */}
                    {isExpired ? (
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.08] p-3 text-center text-xs text-amber-300">
                            <span>Link expired. Please generate a new link to connect.</span>
                            <div className="mt-2">
                                <button
                                    type="button"
                                    onClick={onRetry}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-500/30"
                                >
                                    <RotateCw className="h-3.5 w-3.5" />
                                    New link
                                </button>
                            </div>
                        </div>
                    ) : secondsLeft !== null && secondsLeft < 60 ? (
                        <div className="flex items-center justify-center gap-1.5 text-[11px] text-amber-400">
                            <Clock className="h-3 w-3" />
                            <span>Link expires in {secondsLeft}s</span>
                        </div>
                    ) : null}

                    {/* Content ordering based on isMobile */}
                    <div className={cn('flex flex-col gap-4', isMobile && 'flex-col-reverse')}>
                        {/* QR Code Container */}
                        <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white p-4 shadow-xl">
                            <QRCodeSVG
                                value={qrValue}
                                size={200}
                                level="M"
                                includeMargin={false}
                                aria-label="QR code for connecting a wallet"
                            />
                        </div>

                        {/* Copy Link & URI text */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-medium text-white/50">Pairing URI:</span>
                                <button
                                    type="button"
                                    onClick={copyLink}
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                                >
                                    {copied ? (
                                        <>
                                            <Check className="h-3 w-3" />
                                            <span>Copied!</span>
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="h-3 w-3" />
                                            <span>Copy link</span>
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* Full selectable URI text node */}
                            <div
                                data-connect-uri={linkText}
                                className="max-h-20 select-all overflow-y-auto break-all rounded-xl border border-white/10 bg-white/[0.03] p-2.5 font-mono text-[10px] leading-relaxed text-white/70"
                            >
                                {linkText}
                            </div>
                        </div>
                    </div>

                    {/* Protocol specific action (Open in Cashonize Web for WalletConnect) */}
                    {protocol === 'walletconnect' && (
                        <a
                            href={getCashonizeDeepLink(linkText)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20"
                        >
                            <ExternalLink className="h-4 w-4" />
                            Open in Cashonize Web
                        </a>
                    )}

                    {/* Waiting status */}
                    <div className="flex items-center justify-center gap-2 text-xs text-white/60">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                        </span>
                        <span>Waiting for approval in your wallet…</span>
                    </div>

                    {/* Supported wallets note */}
                    <p className="text-center text-[11px] text-white/40">
                        {protocol === 'wizardconnect'
                            ? 'Works with: Paytaca Mobile, and any WizardConnect-enabled BCH wallet.'
                            : 'Works with: Cashonize, Zapit, and any WalletConnect v2 BCH wallet.'}
                    </p>
                </div>
            )}
        </div>
    );
}
