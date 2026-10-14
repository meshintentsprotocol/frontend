/**
 * Advanced mode: one account that supplies assets to earn and borrows against everything it has supplied.
 * Three tabs (Supply, Borrow, Portfolio) under a health card.
 *
 * Supports Demo mode and Real Liquidium mode (with wallet profile signature authentication).
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, CheckCircle2, ChevronDown, ChevronRight, Copy, ExternalLink, LogOut, RefreshCw, ShieldCheck, Wallet } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useWDK } from '@/context/WDKProvider';
import { notifyToast } from '@/lib/notify-toast';
import { cn } from '@/lib/utils';
import { useLend } from '../LendProvider';
import { activationFee, fmt, fmtPct, fmtUsd, fromUnits, toNumber, toUnits, usdOf } from '../math';
import { CHAIN_INFO, type AdvancedReceipt, type Portfolio, type Position } from '../types';
import { AmountCard, AssetIcon, AssetPicker, Hint, Notice, Panel, PrimaryButton, Row } from '../components/parts';

type Action = 'supply' | 'withdraw' | 'borrow' | 'repay';
const ACTION_DONE: Record<Action, string> = { supply: 'supply was initiated', withdraw: 'withdrawal was initiated', borrow: 'borrow was initiated', repay: 'repayment was initiated' };

/** The portfolio, reloaded on a short timer the way Liquidium's health card counts down. */
function usePortfolio() {
    const { provider, profileId, demo } = useLend();
    const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
    const [age, setAge] = useState(0);
    const reload = useCallback(async () => {
        if (!provider.advanced) { setPortfolio(null); return; }
        try {
            const p = await provider.advanced.portfolio(demo ? undefined : (profileId ?? undefined));
            setPortfolio(p);
            setAge(0);
        } catch (e) {
            console.warn('[usePortfolio] failed to load:', e);
        }
    }, [provider, profileId, demo]);
    useEffect(() => { reload(); }, [reload]);
    useEffect(() => {
        const id = setInterval(() => setAge(a => { if (a >= 29) { reload(); return 0; } return a + 1; }), 1000);
        return () => clearInterval(id);
    }, [reload]);
    return { portfolio, age, reload };
}

function Unavailable() {
    const { setDemo } = useLend();
    return (
        <Panel className="text-center" data-testid="advanced-unavailable">
            <p className="text-lg font-semibold">Supply and account borrowing are unavailable</p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-zinc-400">
                Advanced cross-collateral mode is not configured for this network. You can try all features in Demo mode, or borrow for real in Simple mode.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
                <button type="button" onClick={() => setDemo(true)} className="h-11 rounded-full bg-emerald-400 px-5 text-sm font-semibold text-zinc-950 outline-none hover:bg-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-300" data-testid="advanced-demo">Try it in demo</button>
                <Link to="/borrow" className="inline-flex h-11 items-center rounded-full border border-white/15 px-5 text-sm font-semibold outline-none hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-emerald-400">Simple mode</Link>
            </div>
        </Panel>
    );
}

function ProfileLoginCard() {
    const { login, profileLoading, addresses, setDemo, provider } = useLend();
    const [chain, setChain] = useState<'ETH' | 'BTC'>(addresses.evm ? 'ETH' : 'BTC');
    const [error, setError] = useState('');
    const [existingPid, setExistingPid] = useState<string | null>(null);

    const account = chain === 'ETH' ? addresses.evm : addresses.btc;

    useEffect(() => {
        let active = true;
        if (!account || !provider.advanced?.getProfileId) {
            setExistingPid(null);
            return;
        }
        provider.advanced.getProfileId(account).then(pid => {
            if (active) setExistingPid(pid);
        }).catch(() => {
            if (active) setExistingPid(null);
        });
        return () => { active = false; };
    }, [account, provider]);

    const handleLogin = async () => {
        setError('');
        try {
            await login(chain);
            notifyToast.success(existingPid ? 'Liquidium profile connected!' : 'Liquidium profile initialized!', {
                description: 'Cross-collateral lending is active',
            });
        } catch (e: any) {
            setError(e?.message ?? 'Failed to initialize profile');
        }
    };

    return (
        <Panel className="text-center" data-testid="profile-login-card">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
                <ShieldCheck className="h-7 w-7" />
            </div>
            <p className="mt-3 text-xl font-bold">{existingPid ? 'Connect Lending Profile' : 'Initialize Lending Profile'}</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-400">
                {existingPid ? (
                    <>Your wallet is linked to profile <span className="font-mono text-emerald-400 font-semibold">{existingPid.slice(0, 8)}...{existingPid.slice(-6)}</span>. Connect to view your positions and borrow capacity.</>
                ) : (
                    'Liquidium Advanced Mode uses a unified cross-collateral profile on the canister. Sign a 1-click verification with your wallet to activate your account.'
                )}
            </p>

            <div className="mx-auto mt-6 max-w-sm space-y-3">
                <div className="flex rounded-full bg-white/[0.06] p-1 text-xs">
                    <button
                        type="button"
                        onClick={() => setChain('ETH')}
                        className={cn('flex-1 rounded-full py-2 font-medium transition', chain === 'ETH' ? 'bg-white/15 text-white' : 'text-zinc-400 hover:text-white')}
                    >
                        EVM ({addresses.evm ? `${addresses.evm.slice(0, 6)}...${addresses.evm.slice(-4)}` : 'Not connected'})
                    </button>
                    <button
                        type="button"
                        onClick={() => setChain('BTC')}
                        className={cn('flex-1 rounded-full py-2 font-medium transition', chain === 'BTC' ? 'bg-white/15 text-white' : 'text-zinc-400 hover:text-white')}
                    >
                        BTC ({addresses.btc ? `${addresses.btc.slice(0, 6)}...${addresses.btc.slice(-4)}` : 'Not connected'})
                    </button>
                </div>

                {error ? <Notice tone="error">{error}</Notice> : null}

                <PrimaryButton onClick={handleLogin} loading={profileLoading} testId="initialize-profile-btn">
                    {existingPid ? 'Connect Profile' : 'Sign to Initialize Profile'}
                </PrimaryButton>
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-3 border-t border-white/10 pt-4 text-xs">
                <button type="button" onClick={() => setDemo(true)} className="font-semibold text-emerald-400 hover:underline">
                    Explore with Demo Mode
                </button>
                <span className="text-zinc-600">·</span>
                <Link to="/borrow" className="font-semibold text-zinc-400 hover:text-white">
                    Use Simple Mode (No Account Required)
                </Link>
            </div>
        </Panel>
    );
}

export function HealthCard({ portfolio, age, onRefresh }: { portfolio: Portfolio; age: number; onRefresh: () => void }) {
    const { profileId, logout, demo } = useLend();
    const h = portfolio.healthPct;
    const tone = h >= 60 ? 'bg-emerald-400 text-emerald-400' : h >= 30 ? 'bg-amber-300 text-amber-300' : 'bg-red-400 text-red-400';
    const [bar, text] = tone.split(' ');
    return (
        <Panel data-testid="health-card">
            <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-200">Portfolio health<Hint text="How far your borrowing is from liquidation. 100% means no debt; at 0% your collateral can be sold." /></span>
                    {!demo && profileId ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                            Profile: {profileId.slice(0, 5)}...{profileId.slice(-4)}
                            <button type="button" onClick={logout} title="Disconnect profile" className="text-zinc-400 hover:text-zinc-200"><LogOut className="h-3 w-3" /></button>
                        </span>
                    ) : null}
                </div>
                <button type="button" onClick={onRefresh} aria-label="Refresh portfolio" className="inline-flex h-9 items-center gap-1.5 rounded-full px-2 text-xs tabular-nums text-zinc-500 outline-none hover:text-zinc-200 focus-visible:ring-2 focus-visible:ring-emerald-400">{30 - age}s <RefreshCw className="h-3.5 w-3.5" /></button>
            </div>
            <div className="mt-2 flex items-center gap-3">
                <span className={cn('w-16 text-lg font-bold tabular-nums', text)} data-testid="health-pct">{h.toFixed(1).replace(/\.0$/, '')}%</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(h)} aria-label="Portfolio health">
                    <div className={cn('h-full rounded-full transition-all', bar)} style={{ width: `${h}%` }} />
                </div>
            </div>
            <div className="mt-2 flex justify-between text-xs tabular-nums text-zinc-400"><span>Supplied: {fmtUsd(portfolio.suppliedUsd)}</span><span>Borrowed: {fmtUsd(portfolio.borrowedUsd)}</span></div>
            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/10 pt-4 text-center">
                <div><div className="text-xs text-zinc-400">Net APY</div><div className="mt-0.5 font-semibold tabular-nums">{portfolio.netApy.toFixed(2)}%</div></div>
                <div><div className="text-xs text-zinc-400">Net value</div><div className="mt-0.5 font-semibold tabular-nums">{fmtUsd(portfolio.netValueUsd)}</div></div>
                <div><div className="text-xs text-zinc-400">Net interest</div><div className="mt-0.5 font-semibold tabular-nums">{fmtUsd(portfolio.netInterestUsd)}</div></div>
            </div>
        </Panel>
    );
}

function SupplyTargetDialog({ target, asset, action, onClose }: { target: { targetAddress: string; poolId: string; action: string; chain: string } | null; asset: string; action: 'supply' | 'repay'; onClose: () => void }) {
    const { provider } = useLend();
    const [copied, setCopied] = useState(false);
    const [txid, setTxid] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    if (!target) return null;

    const copy = () => {
        navigator.clipboard?.writeText(target.targetAddress);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleRegisterInflow = async () => {
        if (!txid.trim() || !provider.advanced?.submitInflow) return;
        setSubmitting(true);
        try {
            await provider.advanced.submitInflow(txid.trim(), action === 'supply' ? 'deposit' : 'repayment', target.chain);
            setSubmitted(true);
            notifyToast.success('Transaction registered with Liquidium!');
        } catch (e: any) {
            notifyToast.error(e?.message ?? 'Failed to register transaction');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
            <DialogContent className="max-w-md border-white/10 bg-zinc-950 text-white" data-testid="supply-target-dialog">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                        {action === 'supply' ? 'Deposit Collateral Target' : 'Repayment Target'}
                    </DialogTitle>
                    <DialogDescription className="text-zinc-300">
                        Send {asset} to the protocol deposit address below from your wallet.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col items-center justify-center p-3">
                    <div className="rounded-2xl bg-white p-3">
                        <QRCodeSVG value={target.targetAddress} size={150} level="M" />
                    </div>
                </div>

                <div className="rounded-2xl bg-white/[0.04] p-3 text-xs">
                    <div className="text-zinc-400">{target.chain} Deposit Address</div>
                    <div className="mt-1 flex items-center justify-between gap-2 font-mono text-zinc-200">
                        <span className="truncate">{target.targetAddress}</span>
                        <button type="button" onClick={copy} className="inline-flex h-8 items-center gap-1 rounded-lg bg-white/10 px-2.5 text-xs text-white hover:bg-white/20">
                            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                            {copied ? 'Copied' : 'Copy'}
                        </button>
                    </div>
                </div>

                <div className="space-y-2 border-t border-white/10 pt-3">
                    <label className="text-xs text-zinc-400">Broadcasted Transaction ID (Optional):</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Paste tx hash / txid"
                            value={txid}
                            onChange={e => setTxid(e.target.value)}
                            className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-emerald-400"
                        />
                        <button
                            type="button"
                            onClick={handleRegisterInflow}
                            disabled={!txid.trim() || submitting || submitted}
                            className="rounded-xl bg-emerald-400 px-3 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-300 disabled:opacity-50"
                        >
                            {submitted ? 'Registered' : submitting ? '...' : 'Register'}
                        </button>
                    </div>
                </div>

                <PrimaryButton onClick={onClose} testId="supply-target-close">Done</PrimaryButton>
            </DialogContent>
        </Dialog>
    );
}

function ReceiptDialog({ receipt, action, onClose }: { receipt: AdvancedReceipt | null; action: Action; onClose: () => void }) {
    const { market } = useLend();
    if (!receipt) return null;
    const mk = market(receipt.asset);
    return (
        <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
            <DialogContent className="max-w-md border-white/10 bg-zinc-950 text-white" data-testid="receipt">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-400" />Success</DialogTitle>
                    <DialogDescription className="text-zinc-300">{mk?.name ?? receipt.asset} {ACTION_DONE[action]}</DialogDescription>
                </DialogHeader>
                <div className="rounded-2xl bg-white/[0.04] px-4 py-2">
                    <Row label="Asset">{mk?.name ?? receipt.asset}</Row>
                    <Row label="Amount" strong>{fromUnits(receipt.amount, mk?.decimals ?? 8, 8)} {receipt.asset} <span className="font-normal text-zinc-500">{fmtUsd(receipt.usd)}</span></Row>
                    <Row label="Estimated time">~{receipt.etaMinutes} minutes</Row>
                    <Row label="Transaction"><span className="font-mono text-xs">#{receipt.txid}</span></Row>
                </div>
                <PrimaryButton onClick={onClose} testId="receipt-close">Close</PrimaryButton>
            </DialogContent>
        </Dialog>
    );
}

/** The form shared by Supply and Borrow (and reused for Withdraw and Repay from the portfolio rows). */
function ActionForm({ action, initialAsset, portfolio, onDone }: { action: Action; initialAsset?: string; portfolio: Portfolio; onDone: () => void }) {
    const { provider, markets, market, demo, profileId, addresses } = useLend();
    const wdk = useWDK();
    const [asset, setAsset] = useState(initialAsset ?? (action === 'borrow' ? 'USDC' : 'BTC'));
    const [text, setText] = useState('');
    const [picker, setPicker] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [receipt, setReceipt] = useState<AdvancedReceipt | null>(null);
    const [targetDialog, setTargetDialog] = useState<{ targetAddress: string; poolId: string; action: string; chain: string } | null>(null);

    const mk = market(asset);
    const amount = mk ? toUnits(text, mk.decimals) : 0n;

    const max = BigInt(
        action === 'supply' ? portfolio.wallet[asset] ?? '0'
        : action === 'borrow' ? portfolio.borrowable[asset] ?? '0'
        : action === 'withdraw' ? portfolio.supplied.find(p => p.asset === asset)?.amount ?? '0'
        : portfolio.borrowed.find(p => p.asset === asset)?.amount ?? '0',
    );
    const share = max > 0n && amount > 0n ? Math.min(100, Number((amount * 100n) / max)) : 0;
    const sameToken = action === 'borrow' ? portfolio.supplied.some(p => p.asset === asset) : action === 'supply' ? portfolio.borrowed.some(p => p.asset === asset) : false;
    const blocked = sameToken ? (action === 'borrow' ? 'You cannot borrow while supplying the same token.' : 'You cannot supply a token you are borrowing.') : '';
    const fee = mk && action === 'borrow' ? activationFee(amount, mk.activationFeeBps) : 0n;
    const label = { supply: 'Supply', withdraw: 'Withdraw', borrow: 'Borrow', repay: 'Repay' }[action];
    const problem = blocked || (amount <= 0n ? 'Enter an amount' : (max > 0n && amount > max ? `More than the ${fmt(toNumber(max, mk?.decimals ?? 8), 6)} ${asset} available` : ''));

    const submit = async () => {
        if (problem || !provider.advanced || !mk) return;
        setBusy(true);
        setError('');
        try {
            if (demo) {
                const r = await provider.advanced[action](asset, amount);
                setReceipt(r);
                setText('');
                notifyToast.success(`${mk?.name ?? asset} ${ACTION_DONE[action]}`, { description: `${fromUnits(r.amount, mk?.decimals ?? 8, 8)} ${asset} · demo` });
                onDone();
                return;
            }

            if (!profileId) throw new Error('Liquidium profile required');

            // Real mode actions
            if (action === 'supply' || action === 'repay') {
                if (!provider.advanced.supplyTarget) throw new Error('Supply target not supported');
                const t = await provider.advanced.supplyTarget({
                    profileId,
                    poolId: mk.poolId,
                    action: action === 'supply' ? 'deposit' : 'repay',
                    chain: mk.chain,
                });
                setTargetDialog(t);
                setText('');
                onDone();
            } else if (action === 'borrow') {
                if (!provider.advanced.prepareBorrow || !provider.advanced.submitBorrow) throw new Error('Borrow not supported');
                const receiver = mk.chain === 'BTC' ? (addresses.btc ?? '') : (addresses.evm ?? '');
                const signerWallet = addresses.evm || addresses.btc;
                if (!signerWallet) throw new Error('Wallet not connected');

                const prep = await provider.advanced.prepareBorrow({
                    profileId,
                    poolId: mk.poolId,
                    amount: amount.toString(),
                    chain: mk.chain,
                    receiver,
                    signerWalletAddress: signerWallet,
                });

                let signature = '';
                if (addresses.evm && wdk.evmSigner?.signMessage) {
                    signature = await wdk.evmSigner.signMessage(prep.message);
                } else if (wdk.btcAccount?.sign) {
                    signature = await wdk.btcAccount.sign(prep.message);
                } else {
                    throw new Error('Wallet cannot sign message');
                }

                const r = await provider.advanced.submitBorrow({
                    ...prep.data,
                    signature,
                    signingChain: addresses.evm ? 'ETH' : 'BTC',
                });
                setReceipt(r);
                setText('');
                notifyToast.success(`${mk.name} borrow initiated!`);
                onDone();
            } else if (action === 'withdraw') {
                if (!provider.advanced.prepareWithdraw || !provider.advanced.submitWithdraw) throw new Error('Withdraw not supported');
                const receiver = mk.chain === 'BTC' ? (addresses.btc ?? '') : (addresses.evm ?? '');
                const signerWallet = addresses.evm || addresses.btc;
                if (!signerWallet) throw new Error('Wallet not connected');

                const prep = await provider.advanced.prepareWithdraw({
                    profileId,
                    poolId: mk.poolId,
                    amount: amount.toString(),
                    chain: mk.chain,
                    receiver,
                    signerWalletAddress: signerWallet,
                });

                let signature = '';
                if (addresses.evm && wdk.evmSigner?.signMessage) {
                    signature = await wdk.evmSigner.signMessage(prep.message);
                } else if (wdk.btcAccount?.sign) {
                    signature = await wdk.btcAccount.sign(prep.message);
                } else {
                    throw new Error('Wallet cannot sign message');
                }

                const r = await provider.advanced.submitWithdraw({
                    ...prep.data,
                    signature,
                    signingChain: addresses.evm ? 'ETH' : 'BTC',
                });
                setReceipt(r);
                setText('');
                notifyToast.success(`${mk.name} withdrawal initiated!`);
                onDone();
            }
        } catch (e: any) {
            setError(e?.message ?? 'Operation failed');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-3" data-testid={`form-${action}`}>
            <AmountCard
                label={label} testId={action} asset={asset} value={text} onChange={setText} onPickAsset={initialAsset ? undefined : () => setPicker(true)} usd={mk ? usdOf(amount, mk) : 0}
                hint={action === 'supply' ? 'Supplied assets earn interest and count as collateral for borrowing.' : action === 'borrow' ? 'Borrowed against everything you have supplied.' : undefined}
                right={mk && (action === 'supply' || action === 'borrow') ? <>APY: <span className="font-semibold text-white">{(action === 'supply' ? mk.supplyApy : mk.borrowApy).toFixed(3)}%</span></> : null}
                footer={(
                    <div className="mt-2 flex items-center justify-between text-sm text-zinc-400">
                        <button type="button" onClick={() => mk && setText(fromUnits(max, mk.decimals, 8))} className="rounded outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-emerald-400" data-testid={`${action}-max`}>
                            Max: <span className="font-semibold tabular-nums text-zinc-200">{fmt(toNumber(max, mk?.decimals ?? 8), 6)}</span>
                        </button>
                        <span className="tabular-nums">{share}%</span>
                    </div>
                )}
            />
            {blocked ? <Notice tone="warn">{blocked} <Link to="/borrow/advanced/portfolio" className="font-semibold text-white underline underline-offset-4">Manage positions</Link></Notice> : null}
            {error ? <Notice tone="error">{error}</Notice> : null}
            <PrimaryButton onClick={submit} disabled={!!problem} loading={busy} testId={`${action}-submit`}>{blocked ? label : problem || label}</PrimaryButton>
            {mk ? (
                <div className="rounded-2xl border border-white/10 px-4 py-2">
                    {action === 'supply' ? <Row label="Supply APY" hint="Variable. Paid by borrowers of this asset.">{mk.supplyApy.toFixed(3)}%</Row> : null}
                    {action !== 'supply' ? <Row label="Network fee">{CHAIN_INFO[mk.chain]?.networkFee ?? '—'}</Row> : null}
                    {action === 'borrow' ? <Row label={`Activation fee (${fmtPct(mk.activationFeeBps, 1)})`}>{fee > 0n ? `${fromUnits(fee, mk.decimals, 4)} ${asset}` : '—'}</Row> : null}
                </div>
            ) : null}
            <AssetPicker open={picker} onClose={() => setPicker(false)} markets={markets} side={action === 'borrow' ? 'borrow' : 'supply'} selected={asset} onPick={a => { setAsset(a); setText(''); }}
                balances={action === 'supply' ? portfolio.wallet : action === 'borrow' ? portfolio.borrowable : undefined} />
            <ReceiptDialog receipt={receipt} action={action} onClose={() => setReceipt(null)} />
            <SupplyTargetDialog target={targetDialog} asset={asset} action={action === 'supply' ? 'supply' : 'repay'} onClose={() => setTargetDialog(null)} />
        </div>
    );
}

function Frame({ children }: { children: (p: { portfolio: Portfolio; reload: () => void }) => React.ReactNode }) {
    const { provider, demo, profileId } = useLend();
    const { portfolio, age, reload } = usePortfolio();
    if (!provider.advanced) return <Unavailable />;
    if (!demo && !profileId) return <ProfileLoginCard />;
    if (!portfolio) return <div className="h-72 animate-pulse rounded-3xl bg-white/[0.05]" />;
    return <div className="space-y-4"><HealthCard portfolio={portfolio} age={age} onRefresh={reload} />{children({ portfolio, reload })}</div>;
}

export function AdvancedSupplyPage() {
    return <Frame>{({ portfolio, reload }) => <ActionForm action="supply" portfolio={portfolio} onDone={reload} />}</Frame>;
}

export function AdvancedBorrowPage() {
    return <Frame>{({ portfolio, reload }) => <ActionForm action="borrow" portfolio={portfolio} onDone={reload} />}</Frame>;
}

function PositionRow({ position, side, portfolio, reload }: { position: Position; side: 'supplied' | 'borrowed'; portfolio: Portfolio; reload: () => void }) {
    const { market } = useLend();
    const [open, setOpen] = useState(false);
    const [action, setAction] = useState<Action | null>(null);
    const mk = market(position.asset);
    const decimals = mk?.decimals ?? 8;
    const actions: Action[] = side === 'supplied' ? ['supply', 'withdraw'] : ['repay', 'borrow'];
    const label: Record<Action, string> = { supply: 'Supply more', withdraw: 'Withdraw', repay: 'Repay', borrow: 'Borrow more' };
    return (
        <li className="rounded-2xl border border-white/[0.07] bg-white/[0.03]">
            <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} data-testid={`position-${side}-${position.asset}`}
                className="flex min-h-[64px] w-full items-center gap-3 px-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
                <AssetIcon asset={position.asset} size={32} />
                <span className="flex-1"><span className="block font-semibold">{position.asset}</span><span className="block text-xs text-zinc-400">APY: {position.apy.toFixed(2)}%</span></span>
                <span className="text-right"><span className="block font-semibold tabular-nums">{fmt(toNumber(position.amount, decimals), 6)}</span><span className="block text-xs tabular-nums text-zinc-400">{fmtUsd(position.usd)}</span></span>
                <ChevronDown className={cn('h-4 w-4 text-zinc-500 transition', open && 'rotate-180')} />
            </button>
            {open ? (
                <div className="border-t border-white/[0.07] px-4 py-3">
                    <Row label={side === 'supplied' ? 'Interest earned' : 'Interest accrued'}>{fmt(toNumber(position.interest, decimals), 6)} {position.asset}</Row>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                        {actions.map(a => (
                            <button key={a} type="button" onClick={() => setAction(a)} data-testid={`${a}-${position.asset}`}
                                className={cn('h-11 rounded-full text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-emerald-300', a === actions[0] && side === 'borrowed' || a === 'supply' ? 'bg-emerald-400 text-zinc-950 hover:bg-emerald-300' : 'border border-white/15 hover:bg-white/[0.06]')}>
                                {label[a]}
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}
            <Dialog open={!!action} onOpenChange={o => { if (!o) setAction(null); }}>
                <DialogContent className="max-w-lg border-white/10 bg-zinc-950 text-white">
                    <DialogHeader><DialogTitle>{action ? label[action] : ''}</DialogTitle><DialogDescription className="text-zinc-400">{position.asset}</DialogDescription></DialogHeader>
                    {action ? <ActionForm action={action} initialAsset={position.asset} portfolio={portfolio} onDone={reload} /> : null}
                </DialogContent>
            </Dialog>
        </li>
    );
}

export function AdvancedPortfolioPage() {
    const { loans } = useLend();
    const simple = loans.filter(l => l.phase === 'active');
    return (
        <Frame>
            {({ portfolio, reload }) => (
                <div className="space-y-5" data-testid="advanced-portfolio">
                    {(['supplied', 'borrowed'] as const).map(side => (
                        <section key={side}>
                            <div className="mb-2 flex items-baseline justify-between px-1 text-sm">
                                <h2 className="font-semibold capitalize text-zinc-200">{side}</h2>
                                <span className="tabular-nums text-zinc-400">{fmtUsd(side === 'supplied' ? portfolio.suppliedUsd : portfolio.borrowedUsd)}</span>
                            </div>
                            {portfolio[side].length
                                ? <ul className="space-y-2">{portfolio[side].map(p => <PositionRow key={p.asset} position={p} side={side} portfolio={portfolio} reload={reload} />)}</ul>
                                : <p className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-center text-sm text-zinc-500">Nothing {side} yet.</p>}
                        </section>
                    ))}
                    <Link to="/borrow/portfolio" className="flex min-h-[56px] items-center justify-between rounded-2xl border border-white/[0.07] px-4 text-sm text-zinc-300 outline-none hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-emerald-400">
                        <span>{simple.length} Simple {simple.length === 1 ? 'loan' : 'loans'}</span><ChevronRight className="h-4 w-4" />
                    </Link>
                </div>
            )}
        </Frame>
    );
}
