import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, ShieldCheck, AlertCircle, Sparkles, RefreshCw, Copy, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useWDK } from '@/context/WDKProvider';
import { useActiveWallet } from '@/hooks/useActiveWallet';
import { useExternalBCHWallet } from '@/context/ExternalBCHWalletProvider';
import { useBCHWallet } from '@/context/BCHWalletProvider';
import { useMeshSigner } from '@/hooks/useMesh';
import { buildAndSendBch } from '@/lib/bchSend';
import { useLend } from '../LendProvider';
import { signParyonTx } from '../signBch';
import type { LoanView } from '../types';
import type { ParyonStep } from '../provider';

interface BorrowSigningModalProps {
    open: boolean;
    onClose: () => void;
    borrowCents: string;
    collateralSats: string;
    startingRate?: number;
    onSuccess: (loan: LoanView) => void;
}

export function BorrowSigningModal({
    open,
    onClose,
    borrowCents,
    collateralSats,
    startingRate,
    onSuccess,
}: BorrowSigningModalProps) {
    const { provider, refresh, upsert } = useLend();
    const wdk = useWDK();
    const { isMainActive, activeExtWallet } = useActiveWallet();
    const bchWallet = useBCHWallet();
    const extBCH = useExternalBCHWallet();
    const { signer } = useMeshSigner();

    const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1); // 1 = tx1, 2 = tx2, 3 = submitting, 4 = success
    const [loading, setLoading] = useState(false);
    const [preparingUtxo, setPreparingUtxo] = useState(false);
    const [copiedAddress, setCopiedAddress] = useState(false);
    const [error, setError] = useState('');
    const [steps, setSteps] = useState<ParyonStep[]>([]);
    const [loanTokenId, setLoanTokenId] = useState('');
    const [tx1SignedHex, setTx1SignedHex] = useState('');
    const [tx2SignedHex, setTx2SignedHex] = useState('');
    const [finalTxids, setFinalTxids] = useState<string[]>([]);

    const userAddress = (isMainActive ? bchWallet.address || wdk.bchAddress : activeExtWallet?.address) || '';
    const userTokenAddress = bchWallet.tokenAddress || userAddress;
    const isMainnet = wdk.bchNetwork === 'mainnet';

    const walletLabel = isMainActive ? 'In-App Wallet' : (activeExtWallet?.label || 'BCH Wallet');

    const isGenesisError = error.toLowerCase().includes('outpoint index 0') ||
        error.toLowerCase().includes('vout: 0') ||
        error.toLowerCase().includes('genesis a new cashtoken category');

    const loadPrepareBorrow = useCallback(async () => {
        if (!provider.paryon || !userAddress) return;
        setLoading(true);
        setError('');
        try {
            const res = await provider.paryon.prepareBorrow({
                userAddress,
                userTokenAddress,
                borrowCents,
                collateralSats,
                startingRate,
            });
            setLoanTokenId(res.loanTokenId);
            setSteps(res.steps);
            setCurrentStep(1);
        } catch (err: any) {
            setError(err?.message || 'Failed to prepare borrow transactions.');
        } finally {
            setLoading(false);
        }
    }, [provider.paryon, userAddress, userTokenAddress, borrowCents, collateralSats, startingRate]);

    // Prepare transactions when modal opens
    useEffect(() => {
        if (!open) {
            setCurrentStep(1);
            setLoading(false);
            setPreparingUtxo(false);
            setError('');
            setSteps([]);
            setLoanTokenId('');
            setTx1SignedHex('');
            setTx2SignedHex('');
            setFinalTxids([]);
            return;
        }

        if (!provider.paryon) {
            setError('Paryon borrowing is not supported by current provider.');
            return;
        }

        if (!userAddress) {
            setError('Please connect your BCH wallet first.');
            return;
        }

        loadPrepareBorrow();
    }, [open, provider.paryon, userAddress, loadPrepareBorrow]);

    const handleSelfSendGenesisUtxo = async () => {
        if (!userAddress) return;
        setPreparingUtxo(true);
        setError('');
        try {
            if (signer) {
                await buildAndSendBch(
                    signer,
                    userAddress,
                    { sats: 10000n },
                    'Self-send 10,000 sats to create genesis UTXO'
                );
            } else if (isMainActive && wdk.bchWallet) {
                await (wdk.bchWallet as any).send([{ cashaddr: userAddress, value: 10000, unit: 'sat' }]);
            } else {
                throw new Error('Please send 0.0001 BCH to your wallet address to create a genesis UTXO.');
            }
            // Wait 2.5s for mempool / Electrum indexing
            await new Promise(r => setTimeout(r, 2500));
            await loadPrepareBorrow();
        } catch (e: any) {
            setError(e?.message || 'Failed to create genesis UTXO. Please send a small amount to your own address.');
        } finally {
            setPreparingUtxo(false);
        }
    };

    const handleCopyAddress = () => {
        if (!userAddress) return;
        navigator.clipboard.writeText(userAddress).then(() => {
            setCopiedAddress(true);
            setTimeout(() => setCopiedAddress(false), 2000);
        });
    };

    const handleSignStep1 = async () => {
        if (!steps[0]) return;
        setLoading(true);
        setError('');
        try {
            const res = await signParyonTx(steps[0].wcPayload, {
                isMainActive,
                getWIF: () => bchWallet.getWIF(),
                signExternal: activeExtWallet ? (p) => extBCH.signTransaction(activeExtWallet.id, p) : undefined,
                userAddress,
            });
            setTx1SignedHex(res.signedHex);
            setCurrentStep(2);
        } catch (e) {
            setError((e as Error).message || 'Signing Step 1 failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleSignStep2 = async () => {
        if (!steps[1] || !tx1SignedHex) return;
        setLoading(true);
        setError('');
        try {
            const res = await signParyonTx(steps[1].wcPayload, {
                isMainActive,
                getWIF: () => bchWallet.getWIF(),
                signExternal: activeExtWallet ? (p) => extBCH.signTransaction(activeExtWallet.id, p) : undefined,
                userAddress,
            });
            setTx2SignedHex(res.signedHex);
            setCurrentStep(3);

            // Immediately broadcast both
            if (!provider.paryon) throw new Error('Paryon provider missing');
            const submitRes = await provider.paryon.submit({
                kind: 'borrow',
                loanTokenId,
                userAddress,
                signedTxs: [tx1SignedHex, res.signedHex],
            });

            setFinalTxids(submitRes.txids);
            setCurrentStep(4);

            // Fetch loan and upsert
            setTimeout(async () => {
                try {
                    const l = await provider.getLoan(loanTokenId);
                    upsert(l);
                    onSuccess(l);
                } catch {
                    refresh();
                }
            }, 1500);
        } catch (e) {
            setError((e as Error).message || 'Signing or submitting Step 2 failed.');
            setCurrentStep(2);
        } finally {
            setLoading(false);
        }
    };

    const pusdAmount = (Number(borrowCents) / 100).toFixed(2);
    const bchAmount = (Number(collateralSats) / 1e8).toFixed(4);

    const explorerUrl = (txid: string) =>
        isMainnet
            ? `https://3xpl.com/bitcoin-cash/transaction/${txid}`
            : `https://chipnet.imaginary.cash/tx/${txid}`;

    return (
        <Dialog open={open} onOpenChange={o => { if (!o && !loading && !preparingUtxo) onClose(); }}>
            <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto border-white/10 bg-zinc-950 text-white">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-emerald-400" />
                        <span>Sign Borrow Transaction</span>
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Paryon loans use a 2-step bundle to mint your non-custodial Loan Key NFT and borrow PUSD.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm space-y-2">
                        <div className="flex justify-between">
                            <span className="text-zinc-400">Borrowing:</span>
                            <span className="font-semibold text-white">{pusdAmount} PUSD</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-zinc-400">Locking Collateral:</span>
                            <span className="font-semibold text-emerald-400">{bchAmount} BCH</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-zinc-400">Signer Wallet:</span>
                            <span className="font-mono text-xs text-zinc-300">{walletLabel}</span>
                        </div>
                    </div>

                    {/* Stepper Progress */}
                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                        <div className={`p-2.5 rounded-xl border transition-all ${currentStep === 1 ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-300 font-semibold' : currentStep > 1 ? 'border-white/10 bg-white/[0.04] text-zinc-400' : 'border-white/5 opacity-40'}`}>
                            1. Create Loan Key
                        </div>
                        <div className={`p-2.5 rounded-xl border transition-all ${currentStep === 2 ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-300 font-semibold' : currentStep > 2 ? 'border-white/10 bg-white/[0.04] text-zinc-400' : 'border-white/5 opacity-40'}`}>
                            2. Lock & Borrow
                        </div>
                    </div>

                    {isGenesisError ? (
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200 space-y-3">
                            <div className="flex items-start gap-2">
                                <Sparkles className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                                <div className="space-y-1">
                                    <div className="font-semibold text-amber-300">Paryon Genesis UTXO Required</div>
                                    <p className="text-zinc-300 leading-relaxed text-[11px]">
                                        The on-chain smart contract requires input 0 to spend an output with index 0 (vout: 0) to deterministically derive your non-custodial Loan Key NFT category.
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={handleSelfSendGenesisUtxo}
                                    disabled={preparingUtxo || loading}
                                    className="w-full h-10 rounded-xl bg-amber-400 text-zinc-950 font-semibold hover:bg-amber-300 transition flex items-center justify-center gap-2 text-xs disabled:opacity-50"
                                >
                                    {preparingUtxo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                                    {preparingUtxo ? 'Creating UTXO on-chain...' : 'Self-Send 10,000 sats (Create vout:0)'}
                                </button>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleCopyAddress}
                                        className="flex-1 h-8 rounded-lg border border-white/10 hover:bg-white/5 text-zinc-300 transition flex items-center justify-center gap-1.5 text-[11px]"
                                    >
                                        {copiedAddress ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                                        {copiedAddress ? 'Address Copied' : 'Copy My Address'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => loadPrepareBorrow()}
                                        disabled={preparingUtxo || loading}
                                        className="h-8 px-3 rounded-lg border border-white/10 hover:bg-white/5 text-zinc-300 transition flex items-center justify-center gap-1.5 text-[11px] disabled:opacity-50"
                                    >
                                        <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                                        Retry
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300 flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    ) : null}

                    {currentStep === 1 && (
                        <div className="space-y-3">
                            <p className="text-xs text-zinc-400 leading-relaxed">
                                Step 1 mints your unique Loan Key NFT and sets up the origin proof. Please approve the request in your wallet.
                            </p>
                            <button
                                type="button"
                                onClick={handleSignStep1}
                                disabled={loading || !steps.length || preparingUtxo}
                                className="w-full h-12 rounded-full bg-emerald-400 text-zinc-950 font-semibold hover:bg-emerald-300 transition flex items-center justify-center gap-2 disabled:opacity-40"
                            >
                                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                                {loading ? 'Waiting for signature in wallet...' : 'Sign Step 1 in Wallet'}
                            </button>
                        </div>
                    )}

                    {currentStep === 2 && (
                        <div className="space-y-3">
                            <p className="text-xs text-zinc-400 leading-relaxed">
                                Step 2 deposits {bchAmount} BCH into the covenant and mints {pusdAmount} PUSD to your wallet.
                            </p>
                            <button
                                type="button"
                                onClick={handleSignStep2}
                                disabled={loading}
                                className="w-full h-12 rounded-full bg-emerald-400 text-zinc-950 font-semibold hover:bg-emerald-300 transition flex items-center justify-center gap-2 disabled:opacity-40"
                            >
                                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                                {loading ? 'Signing & Submitting...' : 'Sign Step 2 & Confirm Loan'}
                            </button>
                        </div>
                    )}

                    {currentStep === 3 && (
                        <div className="p-6 text-center space-y-3">
                            <Loader2 className="h-8 w-8 animate-spin text-emerald-400 mx-auto" />
                            <p className="font-semibold text-sm">Broadcasting transactions on-chain...</p>
                            <p className="text-xs text-zinc-400">Submitting to the Bitcoin Cash network.</p>
                        </div>
                    )}

                    {currentStep === 4 && (
                        <div className="p-4 text-center space-y-4">
                            <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
                            <div>
                                <h3 className="font-bold text-lg text-white">Loan Successfully Opened!</h3>
                                <p className="text-xs text-zinc-400 mt-1">
                                    Your {pusdAmount} PUSD has been delivered to your wallet.
                                </p>
                            </div>

                            {finalTxids[1] && (
                                <a
                                    href={explorerUrl(finalTxids[1])}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:underline"
                                >
                                    <span>View on BCH Explorer</span>
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                            )}

                            <button
                                type="button"
                                onClick={onClose}
                                className="w-full h-11 rounded-full bg-white/10 text-white font-semibold hover:bg-white/15 transition text-sm"
                            >
                                Close & View Loan
                            </button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
