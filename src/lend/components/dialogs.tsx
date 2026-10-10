/**
 * The three dialogs of a simple loan: what to send after creating it, repaying, and adding collateral.
 *
 * A real loan is paid by sending to its addresses from any wallet, so the dialogs show the address, the amount
 * and what the loan will look like afterwards. In demo mode nothing is sent: a button stands in for the transfer.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { notifyToast } from '@/lib/notify-toast';
import { useLend } from '../LendProvider';
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

                {deposit ? <AddressQr title="Send collateral here" address={deposit.address} asset={loan.collateral.asset} demo={demo} /> : <Notice tone="warn">The deposit address is not available yet. Open the loan from your portfolio in a moment.</Notice>}
                {repay
                    ? <AddressQr title="Send repayment here (after loan started)" address={repay.address} asset={loan.borrow.asset} demo={demo} />
                    : <p className="text-xs text-zinc-500">The repayment address appears on the loan's page once the loan has started.</p>}

                {demo ? <Notice>This is a demo loan. In about {Math.round((DEMO_TIMING.depositMs + DEMO_TIMING.confirmations * DEMO_TIMING.perConfirmationMs) / 1000)} seconds it will show its deposit as received and become active on its own.</Notice> : (
                    <Notice tone="warn">Send only {loan.collateral.asset} on the {loan.collateral.chain} network, and at least the amount shown. A wrong asset or network cannot be recovered. The loan expires if nothing arrives in time.</Notice>
                )}

                {!demo && onSendFromWallet && deposit ? (
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
    const { markets, provider, upsert } = useLend();
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const now = useMemo(() => loanFigures(loan, markets), [loan, markets]);
    const decimals = loan.borrow.decimals;
    const amount = toUnits(text, decimals);
    const after = project(loan, markets, { repay: amount });
    const demo = loan.provider === 'demo';
    const target = loan.repayment.targets[0];
    const full = amount >= now.debt && now.debt > 0n;
    const pct = (share: number) => setText(fromUnits((now.debt * BigInt(share)) / 100n, decimals));

    const simulate = async () => {
        setBusy(true);
        setError('');
        try { upsert(await provider.simulate!.repay(loan.ref, amount)); onClose(); setText(''); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
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

                {target ? <AddressQr title="Repay address" address={target.address} asset={loan.borrow.asset} demo={demo} note={`${loan.borrow.asset} on ${target.chain} only`} />
                    : <Notice tone="warn">Repayment is not available for this loan right now. Nothing is owed until the loan has started.</Notice>}

                <Notice>{full ? 'Full repayment releases all of your collateral.' : 'A partial repayment lowers the debt and the LTV. Collateral is released only when the loan is fully repaid.'}</Notice>
                {error ? <Notice tone="error">{error}</Notice> : null}

                {demo
                    ? <PrimaryButton onClick={simulate} loading={busy} disabled={amount <= 0n} testId="repay-confirm">{full ? 'Repay in full (demo)' : 'Repay (demo)'}</PrimaryButton>
                    : <PrimaryButton onClick={onClose} variant="outline">Close</PrimaryButton>}
            </div>
        </Shell>
    );
}

export function DepositMoreDialog({ loan, open, onClose }: { loan: LoanView; open: boolean; onClose: () => void }) {
    const { markets, provider, upsert } = useLend();
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const decimals = loan.collateral.decimals;
    const amount = toUnits(text, decimals);
    const now = loanFigures(loan, markets);
    const after = project(loan, markets, { addCollateral: amount });
    const demo = loan.provider === 'demo';
    const target = loan.deposit.targets[0];

    const simulate = async () => {
        setBusy(true);
        setError('');
        try { upsert(await provider.simulate!.depositMore(loan.ref, amount)); onClose(); setText(''); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
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
                {target ? <AddressQr title="Deposit address" address={target.address} asset={loan.collateral.asset} demo={demo} note={`${loan.collateral.asset} on ${target.chain} only`} /> : null}
                <Notice>Any amount works. Your LTV updates as soon as the deposit confirms on-chain.</Notice>
                {error ? <Notice tone="error">{error}</Notice> : null}
                {demo
                    ? <PrimaryButton onClick={simulate} loading={busy} disabled={amount <= 0n} testId="deposit-confirm">Deposit (demo)</PrimaryButton>
                    : <PrimaryButton onClick={onClose} variant="outline">Close</PrimaryButton>}
            </div>
        </Shell>
    );
}
