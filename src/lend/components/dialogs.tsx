/**
 * The dialogs of a simple loan: what to send after creating it, repaying,
 * adding collateral, withdrawing collateral, and adjusting interest rate.
 *
 * For Liquidium/Demo loans, it displays the address QR codes or simulates actions.
 * For Paryon (LendBCH) loans, it directly triggers non-custodial wallet signatures.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { ShieldCheck, Percent, ArrowUpFromLine, ArrowDownToLine } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { notifyToast } from '@/lib/notify-toast';
import { useWDK } from '@/context/WDKProvider';
import { useActiveWallet } from '@/hooks/useActiveWallet';
import { useBCHWallet } from '@/context/BCHWalletProvider';
import { useExternalBCHWallet } from '@/context/ExternalBCHWalletProvider';
import { useLend } from '../LendProvider';
import { signParyonTx } from '../signBch';
import { distancePct, fmt, fmtPct, fromUnits, loanFigures, project, toNumber, toUnits } from '../math';
import { DEMO_TIMING } from '../providers/demo';
import { CHAIN_INFO, type LoanView } from '../types';
import { AddressQr, AssetButton, CopyButton, Notice, PrimaryButton, Row } from './parts';

function Shell({ open, onClose, title, description, children }: { open: boolean; onClose: () => void; title: string; description: string; children: ReactNode }) {
    return (
        <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
            <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto border-white/10 bg-zinc-950 text-white">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription className="text-zinc-400">{description}</DialogDescription>
                </DialogHeader>
                {children}
            </DialogContent>
        </Dialog>
    );
}

const eta = (chain: string) => { const c = CHAIN_INFO[chain]; return c ? `${c.confirmations} blocks (~${c.minutes} min)` : '—'; };

/** Shown once, right after a loan is created: its ID and where the collateral goes. */
export function LoanCreatedDialog({ loan, onClose, onSendFromWallet }: { loan: LoanView | null; onClose: () => void; onSendFromWallet?: (loan: LoanView) => Promise<void> }) {
    const [sending, setSending] = useState(false);
    if (!loan) return null;
    const demo = loan.provider === 'demo';
    const isParyon = loan.provider === 'paryon';
    const deposit = loan.deposit.targets[0];
    const repay = loan.repayment.targets[0];
    const amount = deposit ? fromUnits(deposit.amount, loan.collateral.decimals) : fromUnits(loan.deposit.amount, loan.collateral.decimals);

    return (
        <Shell open onClose={onClose} title="Loan created" description="Send the collateral to start the loan.">
            <div className="space-y-4" data-testid="loan-created">
                <div className="rounded-2xl border border-white/15 p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className="text-xs text-zinc-400">Loan ID</div>
                            <div className="font-mono text-xl font-bold tracking-wider" data-testid="loan-ref">{loan.ref}</div>
                        </div>
                        <CopyButton text={loan.ref} label="Copy loan ID" />
                    </div>
                    <p className="mt-3 flex gap-2 border-t border-white/10 pt-3 text-xs leading-relaxed text-zinc-400">
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                        Keep your loan ID with the addresses below. With it you can check the loan's health, add collateral or repay from anywhere.
                    </p>
                </div>

                <div className="rounded-2xl bg-white/[0.04] px-4 py-2">
                    <Row label="Minimum to send" strong>
                        <span className="inline-flex items-center gap-2">{amount} {loan.collateral.asset}<CopyButton text={amount} label="Copy amount" /></span>
                    </Row>
                    <Row label="Network fee" hint="Paid to the network by your wallet when it sends. Not included in the amount above.">{CHAIN_INFO[loan.collateral.chain]?.networkFee ?? '—'}</Row>
                    <Row label="ETA">{eta(loan.collateral.chain)}</Row>
                </div>

                {!isParyon && deposit ? <AddressQr title="Send collateral here" address={deposit.address} asset={loan.collateral.asset} demo={demo} /> : null}
                {!isParyon && repay ? <AddressQr title="Send repayment here (after loan started)" address={repay.address} asset={loan.borrow.asset} demo={demo} /> : null}

                {isParyon ? (
                    <Notice tone="info">This is an active on-chain Paryon BCH loan. Collateral has been deposited and PUSD debt is active.</Notice>
                ) : demo ? (
                    <Notice>This is a demo loan. In about {Math.round((DEMO_TIMING.depositMs + DEMO_TIMING.confirmations * DEMO_TIMING.perConfirmationMs) / 1000)} seconds it will show its deposit as received and become active on its own.</Notice>
                ) : (
                    <Notice tone="warn">Send only {loan.collateral.asset} on the {loan.collateral.chain} network, and at least the amount shown. A wrong asset or network cannot be recovered. The loan expires if nothing arrives in time.</Notice>
                )}

                {!demo && !isParyon && onSendFromWallet && deposit ? (
                    <PrimaryButton variant="outline" loading={sending} testId="send-from-wallet" onClick={async () => {
                        setSending(true);
                        try { await onSendFromWallet(loan); } catch (e) { notifyToast.error('The collateral was not sent', { description: (e as Error)?.message }); } finally { setSending(false); }
                    }}>Send {amount} {loan.collateral.asset} from my wallet</PrimaryButton>
                ) : null}
                <PrimaryButton onClick={onClose} testId="loan-created-close">Close</PrimaryButton>
            </div>
        </Shell>
    );
}

export function RepayDialog({ loan, open, onClose }: { loan: LoanView; open: boolean; onClose: () => void }) {
    const { markets, provider, upsert, refresh } = useLend();
    const wdk = useWDK();
    const { isMainActive, activeExtWallet } = useActiveWallet();
    const bchWallet = useBCHWallet();
    const extBCH = useExternalBCHWallet();

    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const now = useMemo(() => loanFigures(loan, markets), [loan, markets]);
    const decimals = loan.borrow.decimals;
    const amount = toUnits(text, decimals);
    const after = project(loan, markets, { repay: amount });
    const demo = loan.provider === 'demo';
    const isParyon = loan.provider === 'paryon';
    const target = loan.repayment.targets[0];
    const full = amount >= now.debt && now.debt > 0n;
    const pct = (share: number) => setText(fromUnits((now.debt * BigInt(share)) / 100n, decimals));

    const userAddress = (isMainActive ? bchWallet.address || wdk.bchAddress : activeExtWallet?.address) || '';
    const userTokenAddress = bchWallet.tokenAddress || userAddress;

    const simulate = async () => {
        setBusy(true);
        setError('');
        try { upsert(await provider.simulate!.repay(loan.ref, amount)); onClose(); setText(''); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    };

    const executeParyonRepay = async () => {
        if (!provider.paryon) return;
        if (!userAddress) { setError('Connect your BCH wallet first.'); return; }
        setBusy(true);
        setError('');
        try {
            const loanTokenId = loan.paryon?.loanTokenId || loan.ref;
            const prep = await provider.paryon.prepareManage({
                userAddress,
                userTokenAddress,
                loanTokenId,
                actionType: full ? 'close' : 'repay',
                repayCents: amount.toString(),
            });

            const signed = await signParyonTx(prep.wcPayload, {
                isMainActive,
                getWIF: () => bchWallet.getWIF(),
                signExternal: activeExtWallet ? (p) => extBCH.signTransaction(activeExtWallet.id, p) : undefined,
                userAddress,
            });

            await provider.paryon.submit({
                kind: 'manage',
                loanTokenId,
                userAddress,
                signedTxs: [signed.signedHex],
            });

            notifyToast.success(full ? 'Loan closed & collateral released!' : 'Repayment submitted successfully');
            onClose();
            setText('');

            setTimeout(async () => {
                try {
                    const updated = await provider.getLoan(loanTokenId);
                    upsert(updated);
                } catch {
                    refresh();
                }
            }, 1500);
        } catch (e: any) {
            setError(e.message || 'Repayment failed.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Shell open={open} onClose={onClose} title="Repay loan" description={`Loan ${loan.ref}. Repay part of it, or all of it to get your collateral back.`}>
            <div className="space-y-4" data-testid="repay-dialog">
                <div className="rounded-2xl bg-white/[0.04] p-4">
                    <div className="flex items-center gap-3">
                        <input value={text} onChange={e => { const v = e.target.value.replace(',', '.'); if (/^\d*\.?\d*$/.test(v)) setText(v); }} inputMode="decimal" placeholder="0" aria-label="Amount to repay" data-testid="repay-amount"
                            className="h-12 w-full min-w-0 bg-transparent text-3xl font-semibold tabular-nums outline-none placeholder:text-zinc-600" />
                        <AssetButton asset={loan.borrow.asset} />
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-2">
                        {[25, 50, 75, 100].map(p => (
                            <button key={p} type="button" onClick={() => pct(p)} className="h-10 rounded-full border border-white/10 text-sm font-medium text-zinc-200 outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-emerald-400" data-testid={`repay-${p}`}>{p}%</button>
                        ))}
                    </div>
                </div>

                <div className="rounded-2xl bg-white/[0.04] px-4 py-2">
                    <Row label="Total to fully repay" strong>{fmt(toNumber(now.debt, decimals))} {loan.borrow.asset}</Row>
                    <Row label="Network fee">{CHAIN_INFO[loan.borrow.chain]?.networkFee ?? '—'}</Row>
                    <Row label="ETA">{eta(loan.borrow.chain)}</Row>
                </div>
                <div className="rounded-2xl bg-white/[0.04] px-4 py-2">
                    <Row label="Projected LTV">{fmtPct(loan.ltvBps)} → <span className="font-semibold text-white">{fmtPct(after.ltvBps)}</span></Row>
                    <Row label="Remaining debt">{fmt(toNumber(after.debt, decimals))} {loan.borrow.asset}</Row>
                    <Row label="Liquidation price">{after.liquidationPrice > 0 ? `$ ${fmt(after.liquidationPrice, 0)}` : '—'}</Row>
                </div>

                {!isParyon && target ? <AddressQr title="Repay address" address={target.address} asset={loan.borrow.asset} demo={demo} note={`${loan.borrow.asset} on ${target.chain} only`} /> : null}

                <Notice>{full ? 'Full repayment releases all of your collateral.' : 'A partial repayment lowers the debt and the LTV. Collateral is released only when the loan is fully repaid.'}</Notice>
                {error ? <Notice tone="error">{error}</Notice> : null}

                {isParyon ? (
                    <PrimaryButton onClick={executeParyonRepay} loading={busy} disabled={amount <= 0n} testId="repay-confirm">
                        {full ? 'Repay in Full & Release BCH' : 'Repay PUSD'}
                    </PrimaryButton>
                ) : demo ? (
                    <PrimaryButton onClick={simulate} loading={busy} disabled={amount <= 0n} testId="repay-confirm">
                        {full ? 'Repay in full (demo)' : 'Repay (demo)'}
                    </PrimaryButton>
                ) : (
                    <PrimaryButton onClick={onClose} variant="outline">Close</PrimaryButton>
                )}
            </div>
        </Shell>
    );
}

export function DepositMoreDialog({ loan, open, onClose }: { loan: LoanView; open: boolean; onClose: () => void }) {
    const { markets, provider, upsert, refresh } = useLend();
    const wdk = useWDK();
    const { isMainActive, activeExtWallet } = useActiveWallet();
    const bchWallet = useBCHWallet();
    const extBCH = useExternalBCHWallet();

    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const decimals = loan.collateral.decimals;
    const amount = toUnits(text, decimals);
    const now = loanFigures(loan, markets);
    const after = project(loan, markets, { addCollateral: amount });
    const demo = loan.provider === 'demo';
    const isParyon = loan.provider === 'paryon';
    const target = loan.deposit.targets[0];

    const userAddress = (isMainActive ? bchWallet.address || wdk.bchAddress : activeExtWallet?.address) || '';
    const userTokenAddress = bchWallet.tokenAddress || userAddress;

    const simulate = async () => {
        setBusy(true);
        setError('');
        try { upsert(await provider.simulate!.depositMore(loan.ref, amount)); onClose(); setText(''); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    };

    const executeParyonDeposit = async () => {
        if (!provider.paryon) return;
        if (!userAddress) { setError('Connect your BCH wallet first.'); return; }
        setBusy(true);
        setError('');
        try {
            const loanTokenId = loan.paryon?.loanTokenId || loan.ref;
            const prep = await provider.paryon.prepareManage({
                userAddress,
                userTokenAddress,
                loanTokenId,
                actionType: 'addCollateral',
                collateralDeltaSats: amount.toString(),
            });

            const signed = await signParyonTx(prep.wcPayload, {
                isMainActive,
                getWIF: () => bchWallet.getWIF(),
                signExternal: activeExtWallet ? (p) => extBCH.signTransaction(activeExtWallet.id, p) : undefined,
                userAddress,
            });

            await provider.paryon.submit({
                kind: 'manage',
                loanTokenId,
                userAddress,
                signedTxs: [signed.signedHex],
            });

            notifyToast.success('Collateral deposited successfully');
            onClose();
            setText('');

            setTimeout(async () => {
                try {
                    const updated = await provider.getLoan(loanTokenId);
                    upsert(updated);
                } catch {
                    refresh();
                }
            }, 1500);
        } catch (e: any) {
            setError(e.message || 'Deposit failed.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Shell open={open} onClose={onClose} title="Deposit more collateral" description={`Loan ${loan.ref}. More collateral lowers the LTV and the liquidation price.`}>
            <div className="space-y-4" data-testid="deposit-dialog">
                <div className="rounded-2xl bg-white/[0.04] p-4">
                    <div className="flex items-center gap-3">
                        <input value={text} onChange={e => { const v = e.target.value.replace(',', '.'); if (/^\d*\.?\d*$/.test(v)) setText(v); }} inputMode="decimal" placeholder="0" aria-label="Collateral to add" data-testid="deposit-amount"
                            className="h-12 w-full min-w-0 bg-transparent text-3xl font-semibold tabular-nums outline-none placeholder:text-zinc-600" />
                        <AssetButton asset={loan.collateral.asset} />
                    </div>
                </div>
                <div className="rounded-2xl bg-white/[0.04] px-4 py-2">
                    <Row label="You send" strong>{amount > 0n ? `${fromUnits(amount, decimals)} ${loan.collateral.asset}` : '—'}</Row>
                    <Row label="Network fee">{CHAIN_INFO[loan.collateral.chain]?.networkFee ?? '—'}</Row>
                    <Row label="ETA">{eta(loan.collateral.chain)}</Row>
                </div>
                <div className="rounded-2xl bg-white/[0.04] px-4 py-2">
                    <Row label="Projected LTV">{fmtPct(loan.ltvBps)} → <span className="font-semibold text-white">{fmtPct(after.ltvBps)}</span></Row>
                    <Row label="New collateral">{fromUnits(after.collateral, decimals)} {loan.collateral.asset}</Row>
                    <Row label={`Liquidation ${loan.collateral.asset}/USD`}>
                        {after.liquidationPrice > 0 ? <>{`$ ${fmt(after.liquidationPrice, 0)}`} <span className="text-zinc-500">{distancePct(after.liquidationPrice, now.collateralPrice).toFixed(1)}%</span></> : '—'}
                    </Row>
                </div>
                {!isParyon && target ? <AddressQr title="Deposit address" address={target.address} asset={loan.collateral.asset} demo={demo} note={`${loan.collateral.asset} on ${target.chain} only`} /> : null}
                <Notice>Any amount works. Your LTV updates as soon as the deposit confirms on-chain.</Notice>
                {error ? <Notice tone="error">{error}</Notice> : null}

                {isParyon ? (
                    <PrimaryButton onClick={executeParyonDeposit} loading={busy} disabled={amount <= 0n} testId="deposit-confirm">
                        Deposit BCH Collateral
                    </PrimaryButton>
                ) : demo ? (
                    <PrimaryButton onClick={simulate} loading={busy} disabled={amount <= 0n} testId="deposit-confirm">
                        Deposit (demo)
                    </PrimaryButton>
                ) : (
                    <PrimaryButton onClick={onClose} variant="outline">Close</PrimaryButton>
                )}
            </div>
        </Shell>
    );
}

export function WithdrawCollateralDialog({ loan, open, onClose }: { loan: LoanView; open: boolean; onClose: () => void }) {
    const { markets, provider, upsert, refresh } = useLend();
    const wdk = useWDK();
    const { isMainActive, activeExtWallet } = useActiveWallet();
    const bchWallet = useBCHWallet();
    const extBCH = useExternalBCHWallet();

    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const decimals = loan.collateral.decimals;
    const amount = toUnits(text, decimals);
    const now = loanFigures(loan, markets);
    const newCollateralSats = now.collateral > amount ? now.collateral - amount : 0n;

    const userAddress = (isMainActive ? bchWallet.address || wdk.bchAddress : activeExtWallet?.address) || '';
    const userTokenAddress = bchWallet.tokenAddress || userAddress;

    const executeWithdraw = async () => {
        if (!provider.paryon) return;
        if (!userAddress) { setError('Connect your BCH wallet first.'); return; }
        setBusy(true);
        setError('');
        try {
            const loanTokenId = loan.paryon?.loanTokenId || loan.ref;
            const prep = await provider.paryon.prepareManage({
                userAddress,
                userTokenAddress,
                loanTokenId,
                actionType: 'withdrawCollateral',
                collateralDeltaSats: amount.toString(),
            });

            const signed = await signParyonTx(prep.wcPayload, {
                isMainActive,
                getWIF: () => bchWallet.getWIF(),
                signExternal: activeExtWallet ? (p) => extBCH.signTransaction(activeExtWallet.id, p) : undefined,
                userAddress,
            });

            await provider.paryon.submit({
                kind: 'manage',
                loanTokenId,
                userAddress,
                signedTxs: [signed.signedHex],
            });

            notifyToast.success('Collateral withdrawn to wallet');
            onClose();
            setText('');

            setTimeout(async () => {
                try {
                    const updated = await provider.getLoan(loanTokenId);
                    upsert(updated);
                } catch {
                    refresh();
                }
            }, 1500);
        } catch (e: any) {
            setError(e.message || 'Withdrawal failed.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Shell open={open} onClose={onClose} title="Withdraw collateral" description={`Loan ${loan.ref}. You can withdraw surplus collateral as long as the ratio stays above 110%.`}>
            <div className="space-y-4" data-testid="withdraw-dialog">
                <div className="rounded-2xl bg-white/[0.04] p-4">
                    <div className="flex items-center gap-3">
                        <input value={text} onChange={e => { const v = e.target.value.replace(',', '.'); if (/^\d*\.?\d*$/.test(v)) setText(v); }} inputMode="decimal" placeholder="0" aria-label="Collateral to withdraw"
                            className="h-12 w-full min-w-0 bg-transparent text-3xl font-semibold tabular-nums outline-none placeholder:text-zinc-600" />
                        <AssetButton asset={loan.collateral.asset} />
                    </div>
                </div>
                <div className="rounded-2xl bg-white/[0.04] px-4 py-2">
                    <Row label="Current collateral">{fromUnits(now.collateral, decimals)} {loan.collateral.asset}</Row>
                    <Row label="New collateral">{fromUnits(newCollateralSats, decimals)} {loan.collateral.asset}</Row>
                    <Row label="Network fee">{CHAIN_INFO[loan.collateral.chain]?.networkFee ?? '—'}</Row>
                </div>
                <Notice>Withdrawn BCH is immediately returned to your connected wallet.</Notice>
                {error ? <Notice tone="error">{error}</Notice> : null}
                <PrimaryButton onClick={executeWithdraw} loading={busy} disabled={amount <= 0n}>
                    Withdraw BCH
                </PrimaryButton>
            </div>
        </Shell>
    );
}

export function ChangeRateDialog({ loan, open, onClose }: { loan: LoanView; open: boolean; onClose: () => void }) {
    const { provider, upsert, refresh } = useLend();
    const wdk = useWDK();
    const { isMainActive, activeExtWallet } = useActiveWallet();
    const bchWallet = useBCHWallet();
    const extBCH = useExternalBCHWallet();

    const [aprText, setAprText] = useState(() => (loan.borrowApy || 3.5).toFixed(2));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const userAddress = (isMainActive ? bchWallet.address || wdk.bchAddress : activeExtWallet?.address) || '';
    const userTokenAddress = bchWallet.tokenAddress || userAddress;

    const aprNum = Number(aprText) || 0;
    // Conversion: rate = round(aprPct / 100 * 10_000_000 / 365)
    const targetRate = Math.round((aprNum / 100) * 10_000_000 / 365);

    const executeChangeRate = async () => {
        if (!provider.paryon) return;
        if (!userAddress) { setError('Connect your BCH wallet first.'); return; }
        setBusy(true);
        setError('');
        try {
            const loanTokenId = loan.paryon?.loanTokenId || loan.ref;
            const prep = await provider.paryon.prepareRate({
                userAddress,
                userTokenAddress,
                loanTokenId,
                nextRate: targetRate,
            });

            const signed = await signParyonTx(prep.wcPayload, {
                isMainActive,
                getWIF: () => bchWallet.getWIF(),
                signExternal: activeExtWallet ? (p) => extBCH.signTransaction(activeExtWallet.id, p) : undefined,
                userAddress,
            });

            await provider.paryon.submit({
                kind: 'rate',
                loanTokenId,
                userAddress,
                signedTxs: [signed.signedHex],
            });

            notifyToast.success(`Next period rate updated to ${aprNum.toFixed(2)}% APR`);
            onClose();

            setTimeout(async () => {
                try {
                    const updated = await provider.getLoan(loanTokenId);
                    upsert(updated);
                } catch {
                    refresh();
                }
            }, 1500);
        } catch (e: any) {
            setError(e.message || 'Rate change failed.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Shell open={open} onClose={onClose} title="Adjust next period rate" description={`Loan ${loan.ref}. In Paryon, interest rates are set by borrowers. A higher rate protects against redemption.`}>
            <div className="space-y-4" data-testid="change-rate-dialog">
                <div className="rounded-2xl bg-white/[0.04] p-4">
                    <div className="flex items-center gap-3">
                        <input value={aprText} onChange={e => { const v = e.target.value.replace(',', '.'); if (/^\d*\.?\d*$/.test(v)) setAprText(v); }} inputMode="decimal" placeholder="3.50" aria-label="Target APR"
                            className="h-12 w-full min-w-0 bg-transparent text-3xl font-semibold tabular-nums outline-none placeholder:text-zinc-600" />
                        <span className="font-semibold text-lg text-emerald-400">% APR</span>
                    </div>
                    <div className="mt-3 flex gap-2">
                        {[1.5, 3.5, 5.0, 8.0].map(r => (
                            <button key={r} type="button" onClick={() => setAprText(r.toFixed(2))} className="h-9 px-3 rounded-full border border-white/10 text-xs font-medium text-zinc-300 hover:bg-white/10">
                                {r.toFixed(1)}%
                            </button>
                        ))}
                    </div>
                </div>

                <div className="rounded-2xl bg-white/[0.04] px-4 py-2 text-sm">
                    <Row label="Current period APR">{loan.borrowApy.toFixed(2)}%</Row>
                    <Row label="New next period APR" strong>{aprNum.toFixed(2)}%</Row>
                    <Row label="On-chain integer rate">{targetRate} units</Row>
                </div>

                <Notice>
                    The new rate takes effect at the beginning of the next daily interest period (144 blocks).
                </Notice>
                {error ? <Notice tone="error">{error}</Notice> : null}

                <PrimaryButton onClick={executeChangeRate} loading={busy} disabled={aprNum <= 0}>
                    Update Interest Rate
                </PrimaryButton>
            </div>
        </Shell>
    );
}
