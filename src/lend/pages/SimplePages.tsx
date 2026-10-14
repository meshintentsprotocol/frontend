/**
 * Simple mode: borrow against collateral without an account. Three pages: the borrow form, the list of loans,
 * and one loan. The flow is Liquidium's; see borrow&lend/frontendflowdev/01-liquidium-ui-flows.md.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowDownToLine, ArrowLeft, ArrowUpFromLine, ChevronDown, ChevronRight, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useWDK } from '@/context/WDKProvider';
import { notifyToast } from '@/lib/notify-toast';
import { useLend } from '../LendProvider';
import { activationFee, collateralForLtv, distancePct, fmt, fmtPct, fmtUsd, fromUnits, liquidationPrice, loanFigures, ltvBps, toNumber, toUnits, usdOf } from '../math';
import { notifyLoanCreated } from '../notify';
import { CHAIN_INFO, OPEN_PHASES, type LendQuote, type LoanPhase, type LoanView } from '../types';
import { DepositMoreDialog, LoanCreatedDialog, RepayDialog } from '../components/dialogs';
import { AmountCard, AssetIcon, AssetPicker, CopyButton, Hint, LtvSlider, Notice, Panel, PrimaryButton, Row } from '../components/parts';
import { cn } from '@/lib/utils';

const PHASE_LABEL: Record<LoanPhase, string> = {
    awaiting_deposit: 'Awaiting deposit', confirming: 'Confirming', active: 'Active', repaying: 'Repayment in progress',
    closed: 'Closed', expired: 'Expired', failed: 'Failed', liquidated: 'Liquidated',
};

const timeAgo = (ms: number) => {
    const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
    if (s < 60) return 'less than a minute ago';
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
    return `${Math.floor(s / 86_400)} d ago`;
};

// ── Borrow ───────────────────────────────────────────────────────────────────

export function BorrowPage() {
    const { provider, demo, demoProvider, markets, marketsError, market, addresses, upsert } = useLend();
    const wdk = useWDK();
    const [borrowAsset, setBorrowAsset] = useState('USDC');
    const [collateralAsset, setCollateralAsset] = useState('BTC');
    const [borrowText, setBorrowText] = useState('');
    const [collateralText, setCollateralText] = useState('');
    const [picker, setPicker] = useState<'borrow' | 'collateral' | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [showFees, setShowFees] = useState(true);
    const [bufferPct, setBufferPct] = useState('2');
    const [windowMin, setWindowMin] = useState('60');
    const [destination, setDestination] = useState('');
    const [refund, setRefund] = useState('');
    const [quote, setQuote] = useState<LendQuote | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [created, setCreated] = useState<LoanView | null>(null);

    const b = market(borrowAsset), c = market(collateralAsset);
    const borrow = b ? toUnits(borrowText, b.decimals) : 0n;
    const collateral = c ? toUnits(collateralText, c.decimals) : 0n;
    const fee = b ? activationFee(borrow, b.activationFeeBps) : 0n;
    const debtUsd = b ? usdOf(borrow + fee, b) : 0;
    const collateralUsd = c ? usdOf(collateral, c) : 0;
    const ltv = ltvBps(debtUsd, collateralUsd);
    const bufferBps = Math.max(200, Math.round((Number(bufferPct) || 2) * 100));
    const maxLtv = c ? c.maxLtvBps - bufferBps : 6300;
    const liq = c ? liquidationPrice(debtUsd, toNumber(collateral, c.decimals), c.liquidationThresholdBps) : 0;

    // The wallet's own addresses are the default for a real loan; the user can type others.
    useEffect(() => { if (!destination && addresses.evm && b?.chain === 'ETH') setDestination(addresses.evm); }, [addresses.evm, b?.chain, destination]);
    useEffect(() => { if (!refund && addresses.btc && c?.chain === 'BTC') setRefund(addresses.btc); }, [addresses.btc, c?.chain, refund]);

    // The provider's own check of the pair: limits, liquidity, pauses. Asked once typing settles.
    const quoteKey = `${borrowAsset}|${collateralAsset}|${borrow}|${collateral}|${bufferBps}`;
    const latest = useRef(quoteKey);
    useEffect(() => {
        latest.current = quoteKey;
        setQuote(null);
        setError('');
        if (borrow <= 0n || collateral <= 0n) return;
        const id = setTimeout(() => {
            provider.quote({ borrowAsset, collateralAsset, borrowAmount: borrow.toString(), collateralAmount: collateral.toString(), ltvBufferBps: bufferBps })
                .then(q => { if (latest.current === quoteKey) setQuote(q); })
                .catch(e => { if (latest.current === quoteKey) setError((e as Error).message); });
        }, 400);
        return () => clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [quoteKey, provider]);

    const setLtv = (bps: number) => {
        if (!c || debtUsd <= 0 || bps <= 0) return;
        setCollateralText(fromUnits(collateralForLtv(debtUsd, bps, c), c.decimals, 8));
    };
    const flip = () => {
        setBorrowAsset(collateralAsset); setCollateralAsset(borrowAsset);
        setBorrowText(collateralText); setCollateralText(borrowText);
        setDestination(''); setRefund('');
    };

    const needsAddresses = !demo;
    const isEvmAddress = (addr: string) => /^0x[0-9a-fA-F]{40}$/.test(addr.trim());
    const isBtcAddress = (addr: string) => /^((bc1|tb1)[a-z0-9]{25,87}|[132mn][a-km-zA-HJ-NP-Z1-9]{25,34})$/i.test(addr.trim());
    const isBtcTestnet = (addr: string) => /^(tb1|[2mn])/i.test(addr.trim());

    const problem =
        marketsError ? marketsError
        : !b || !c ? 'Loading markets'
        : borrowAsset === collateralAsset ? 'Pick two different assets'
        : borrow <= 0n ? 'Enter an amount to borrow'
        : collateral <= 0n ? 'Enter your collateral'
        : quote?.errors.length ? quote.errors[0]
        : ltv > maxLtv ? `LTV is over ${fmtPct(maxLtv, 0)}: add collateral`
        : needsAddresses && !destination.trim() ? `Enter the ${b.chain} address to receive ${b.asset}`
        : needsAddresses && b.chain === 'ETH' && !isEvmAddress(destination) ? 'Enter a valid ETH address (0x…)'
        : needsAddresses && !refund.trim() ? `Enter the ${c.chain} address your collateral returns to`
        : needsAddresses && c.chain === 'BTC' && isBtcTestnet(refund) ? 'Refund requires a mainnet Bitcoin address (starts with bc1, 1, or 3)'
        : needsAddresses && c.chain === 'BTC' && !isBtcAddress(refund) ? 'Enter a valid Bitcoin address for collateral refund'
        : error ? error
        : !quote ? 'Checking'
        : '';

    const submit = async () => {
        if (problem || !b || !c) return;
        setBusy(true);
        setError('');
        try {
            const loan = await provider.createLoan({
                borrowAsset, collateralAsset, borrowAmount: borrow.toString(), collateralAmount: collateral.toString(), ltvBufferBps: bufferBps,
                borrowDestination: destination.trim() || 'demo', refundDestination: refund.trim() || 'demo',
                depositWindowMinutes: Math.max(15, Math.min(1440, Number(windowMin) || 60)),
            });
            upsert(loan);
            notifyLoanCreated(loan);
            setCreated(loan);
            setBorrowText(''); setCollateralText('');
        } catch (e) {
            setError((e as Error).message);
            notifyToast.error('The loan was not created', { description: (e as Error).message });
        } finally {
            setBusy(false);
        }
    };

    /** Pay the collateral from the in-app wallet: Bitcoin only, and only to the address the loan gave. */
    const canSendFromWallet = !!wdk.btcAccount && !!addresses.btc?.startsWith('bc1');
    const sendFromWallet = async (loan: LoanView) => {
        const target = loan.deposit.targets.find(x => x.chain === 'BTC');
        if (!target || loan.collateral.asset !== 'BTC') throw new Error('Only a Bitcoin deposit can be sent from the wallet here.');
        if (!window.confirm(`Send ${fromUnits(target.amount, 8)} BTC from your wallet to ${target.address}? This is real Bitcoin and cannot be undone.`)) return;
        const result = await wdk.btcAccount.sendTransaction({ to: target.address, value: BigInt(target.amount) });
        notifyToast.success('Collateral sent', { description: `Transaction ${String(result?.hash ?? result?.txid ?? '').slice(0, 16)}… It needs 4 confirmations.` });
    };

    const balances = demoProvider?.wallet();
    const balanceOf = (asset: string, decimals: number) => (balances?.[asset] ? `Balance: ${fmt(toNumber(balances[asset], decimals), 6)}` : null);

    return (
        <div className="space-y-3" data-testid="borrow-page">
            <AmountCard
                label="Borrow" hint="What you receive. Interest accrues on it until you repay." testId="borrow" asset={borrowAsset} value={borrowText} onChange={setBorrowText}
                onPickAsset={() => setPicker('borrow')} usd={b && borrow > 0n ? usdOf(borrow, b) : 0}
                right={b ? <>APY: <span className="font-semibold text-white">{b.borrowApy.toFixed(2)}%</span></> : null}
            />
            <div className="relative z-10 -my-5 flex justify-center">
                <button type="button" onClick={flip} aria-label="Switch borrow and collateral assets" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-zinc-950 text-zinc-200 outline-none transition hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-emerald-400" data-testid="flip">
                    <ChevronDown className="h-5 w-5" />
                </button>
            </div>
            <AmountCard
                label="Collateral" hint="What you lock. It comes back when the loan is fully repaid. If its value falls too far it can be sold to cover the debt." testId="collateral"
                asset={collateralAsset} value={collateralText} onChange={setCollateralText} onPickAsset={() => setPicker('collateral')} usd={collateralUsd}
                right={c ? balanceOf(c.asset, c.decimals) : null}
                footer={<LtvSlider bps={ltv} maxBps={maxLtv} thresholdBps={c?.liquidationThresholdBps ?? 7400} onChange={debtUsd > 0 ? setLtv : undefined} />}
            />

            {needsAddresses && b && c ? (
                <Panel className="space-y-3">
                    <label className="block text-sm">
                        <div className="mb-1.5 flex items-center justify-between">
                            <span className="text-zinc-300">Receive {b.asset} at ({b.chain} address)</span>
                            {addresses.evm && b.chain === 'ETH' && destination !== addresses.evm && (
                                <button type="button" onClick={() => setDestination(addresses.evm!)} className="text-xs text-emerald-400 hover:underline">
                                    Use wallet ({addresses.evm.slice(0, 6)}…{addresses.evm.slice(-4)})
                                </button>
                            )}
                        </div>
                        <input value={destination} onChange={e => setDestination(e.target.value)} placeholder={b.chain === 'ETH' ? '0x…' : 'Address'} spellCheck={false} data-testid="destination"
                            className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 font-mono text-sm outline-none focus:border-emerald-400/60" />
                    </label>
                    <label className="block text-sm">
                        <div className="mb-1.5 flex items-center justify-between">
                            <span className="text-zinc-300">Return collateral to ({c.chain} address)</span>
                            {addresses.btc && c.chain === 'BTC' && refund !== addresses.btc && (
                                <button type="button" onClick={() => setRefund(addresses.btc!)} className="text-xs text-emerald-400 hover:underline">
                                    Use wallet ({addresses.btc.slice(0, 6)}…{addresses.btc.slice(-4)})
                                </button>
                            )}
                        </div>
                        <input value={refund} onChange={e => setRefund(e.target.value)} placeholder={c.chain === 'BTC' ? 'bc1…' : 'Address'} spellCheck={false} data-testid="refund"
                            className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 font-mono text-sm outline-none focus:border-emerald-400/60" />
                    </label>
                    <p className="text-xs leading-relaxed text-zinc-500">These cannot be changed after the loan is created. They are filled in from your wallet when it has an address on that network.</p>
                </Panel>
            ) : null}

            <div className="flex items-center gap-3 pt-1">
                <button type="button" onClick={() => setShowSettings(v => !v)} aria-expanded={showSettings} aria-label="Advanced settings" data-testid="advanced-settings"
                    className={cn('inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full border outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-400', showSettings ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-300' : 'border-white/15 text-zinc-200 hover:bg-white/[0.06]')}>
                    <SlidersHorizontal className="h-5 w-5" />
                </button>
                <PrimaryButton onClick={submit} disabled={!!problem} loading={busy} testId="borrow-submit">{busy ? 'Creating loan' : problem || 'Borrow'}</PrimaryButton>
            </div>

            {showSettings ? (
                <Panel className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm">
                        <span className="mb-1.5 block text-zinc-300">Max LTV buffer<Hint text="How far under the pool's maximum LTV the loan must open. A larger buffer leaves more room before liquidation. At least 2%." /></span>
                        <span className="flex h-12 items-center rounded-xl border border-white/10 bg-white/[0.04] px-3">
                            <input value={bufferPct} onChange={e => { if (/^\d*\.?\d*$/.test(e.target.value)) setBufferPct(e.target.value); }} inputMode="decimal" aria-label="Max LTV buffer, percent" className="w-full bg-transparent outline-none" data-testid="buffer" />
                            <span className="text-zinc-500">%</span>
                        </span>
                    </label>
                    <label className="block text-sm">
                        <span className="mb-1.5 block text-zinc-300">Loan delivery window<Hint text="How long the loan waits for your collateral before it expires. Nothing is borrowed if it expires." /></span>
                        <span className="flex h-12 items-center rounded-xl border border-white/10 bg-white/[0.04] px-3">
                            <input value={windowMin} onChange={e => { if (/^\d*$/.test(e.target.value)) setWindowMin(e.target.value); }} inputMode="numeric" aria-label="Loan delivery window, minutes" className="w-full bg-transparent outline-none" data-testid="window" />
                            <span className="text-zinc-500">minutes</span>
                        </span>
                    </label>
                </Panel>
            ) : null}

            <div className="rounded-2xl border border-white/10 px-4 py-2">
                <button type="button" onClick={() => setShowFees(v => !v)} aria-expanded={showFees} className="flex w-full items-center justify-between py-1.5 text-sm text-zinc-300 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
                    <span>Fees and terms</span>
                    <ChevronDown className={cn('h-4 w-4 transition', showFees && 'rotate-180')} />
                </button>
                {showFees && b && c ? (
                    <div data-testid="fees">
                        <Row label="Supply network fee" hint="Paid by your wallet to the network when you send the collateral.">{CHAIN_INFO[c.chain]?.networkFee ?? '—'}</Row>
                        <Row label="Borrow network fee" hint="Taken from the amount borrowed to deliver it.">{CHAIN_INFO[b.chain]?.networkFee ?? '—'}</Row>
                        <Row label={`Activation fee (${fmtPct(b.activationFeeBps, 1)})`} hint="Charged once when the loan opens, and added to what you owe.">{fee > 0n ? `${fromUnits(fee, b.decimals, 4)} ${b.asset}` : '—'}</Row>
                        <Row label="You will owe" strong>{borrow > 0n ? `${fmt(toNumber(borrow + fee, b.decimals))} ${b.asset}` : '—'}</Row>
                        <Row label="Liquidation" hint={`If ${c.asset} falls to this price, part of your collateral can be sold to cover the debt, with a ${fmtPct(c.liquidationBonusBps, 0)} penalty.`}>
                            {liq > 0 ? <>{`$ ${fmt(liq, 0)}`} <span className="text-zinc-500">({distancePct(liq, c.priceUsd).toFixed(1)}%) · at {fmtPct(c.liquidationThresholdBps, 0)} LTV</span></> : `at ${fmtPct(c.liquidationThresholdBps, 0)} LTV`}
                        </Row>
                    </div>
                ) : null}
            </div>

            <AssetPicker open={picker === 'borrow'} onClose={() => setPicker(null)} markets={markets.filter(m => m.asset !== collateralAsset)} side="borrow" selected={borrowAsset} onPick={a => { setBorrowAsset(a); setDestination(''); }} />
            <AssetPicker open={picker === 'collateral'} onClose={() => setPicker(null)} markets={markets.filter(m => m.asset !== borrowAsset)} side="supply" selected={collateralAsset} onPick={a => { setCollateralAsset(a); setRefund(''); }} balances={balances} />
            <LoanCreatedDialog loan={created} onClose={() => setCreated(null)} onSendFromWallet={canSendFromWallet ? sendFromWallet : undefined} />
        </div>
    );
}

// ── Portfolio ────────────────────────────────────────────────────────────────

function LoanRow({ loan, onRemove }: { loan: LoanView; onRemove: () => void }) {
    const debt = BigInt(loan.position.totalDebt || '0') > 0n ? loan.position.totalDebt : loan.borrow.amount;
    return (
        <li className="flex items-center gap-1">
            <Link to={`/borrow/loan/${loan.ref}`} data-testid={`loan-${loan.ref}`}
                className="flex min-h-[64px] flex-1 items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 outline-none transition hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-emerald-400">
                <AssetIcon asset={loan.borrow.asset} size={32} />
                <span className="flex-1">
                    <span className="block font-mono font-semibold tracking-wide">{loan.ref}</span>
                    <span className="block text-xs text-zinc-400">{OPEN_PHASES.includes(loan.phase) ? `${fmtPct(loan.ltvBps, 0)} LTV` : PHASE_LABEL[loan.phase]}{loan.phase === 'confirming' && loan.status.confirmations !== null ? ` · ${loan.status.confirmations} of ${loan.status.requiredConfirmations}` : ''}</span>
                </span>
                <span className="text-right text-sm font-semibold tabular-nums">{fmt(toNumber(debt, loan.borrow.decimals))} {loan.borrow.asset}</span>
                <ChevronRight className="h-4 w-4 text-zinc-500" />
            </Link>
            <button type="button" onClick={onRemove} aria-label={`Remove ${loan.ref} from history`} className="inline-flex h-11 w-11 items-center justify-center rounded-full text-zinc-500 outline-none hover:bg-white/10 hover:text-zinc-200 focus-visible:ring-2 focus-visible:ring-emerald-400">
                <Trash2 className="h-4 w-4" />
            </button>
        </li>
    );
}

export function PortfolioPage() {
    const { loans, loansLoading, markets, provider, upsert, forget, demo } = useLend();
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [finding, setFinding] = useState(false);
    const [findError, setFindError] = useState('');
    const [showClosed, setShowClosed] = useState(false);

    const groups = useMemo(() => ({
        active: loans.filter(l => l.phase === 'active' || l.phase === 'repaying'),
        waiting: loans.filter(l => l.phase === 'awaiting_deposit' || l.phase === 'confirming'),
        closed: loans.filter(l => !OPEN_PHASES.includes(l.phase)),
    }), [loans]);
    const totals = useMemo(() => {
        let collateral = 0, debt = 0;
        for (const l of groups.active) { const f = loanFigures(l, markets); collateral += f.collateralUsd; debt += f.debtUsd; }
        return { collateral, debt, ltv: ltvBps(debt, collateral) };
    }, [groups.active, markets]);

    const find = async () => {
        const q = query.trim();
        if (!q) return;
        setFinding(true);
        setFindError('');
        try {
            const found = await provider.findLoans(q);
            if (!found.length) { setFindError('No loan found for that ID or address.'); return; }
            found.forEach(upsert);
            setQuery('');
            if (found.length === 1) navigate(`/borrow/loan/${found[0].ref}`);
        } catch (e) { setFindError((e as Error).message); } finally { setFinding(false); }
    };

    const section = (title: string, list: LoanView[], right: string) => (list.length ? (
        <section>
            <div className="mb-2 flex items-baseline justify-between px-1 text-sm"><h2 className="font-semibold text-zinc-200">{title}</h2><span className="tabular-nums text-zinc-400">{right}</span></div>
            <ul className="space-y-2">{list.map(l => <LoanRow key={l.ref} loan={l} onRemove={() => forget(l.ref)} />)}</ul>
        </section>
    ) : null);

    return (
        <div className="space-y-5" data-testid="portfolio-page">
            <Panel className="grid grid-cols-3 gap-3 text-center">
                <div><div className="text-xs text-zinc-400">Collateral</div><div className="mt-1 text-lg font-semibold tabular-nums" data-testid="total-collateral">{fmtUsd(totals.collateral)}</div></div>
                <div><div className="text-xs text-zinc-400">Borrowed</div><div className="mt-1 text-lg font-semibold tabular-nums" data-testid="total-borrowed">{fmtUsd(totals.debt)}</div></div>
                <div><div className="text-xs text-zinc-400">Blended LTV</div><div className="mt-1 text-lg font-semibold tabular-nums">{fmtPct(totals.ltv)}</div></div>
            </Panel>

            <form onSubmit={e => { e.preventDefault(); find(); }} className="flex h-12 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] pl-4 pr-1.5 focus-within:border-emerald-400/60">
                <Search className="h-4 w-4 shrink-0 text-zinc-500" />
                <input value={query} onChange={e => { setQuery(e.target.value); setFindError(''); }} placeholder="Find a loan by ID or address" aria-label="Find a loan by ID or address" className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-500" data-testid="find-loan" />
                <button type="submit" disabled={!query.trim() || finding} className="h-9 rounded-full bg-white/10 px-4 text-sm font-semibold outline-none hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-40">{finding ? 'Finding' : 'Find'}</button>
            </form>
            {findError ? <Notice tone="warn">{findError}</Notice> : null}

            {loansLoading && !loans.length ? <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/[0.05]" />)}</div> : null}
            {!loansLoading && !loans.length ? (
                <Panel className="text-center">
                    <p className="font-semibold">No loans yet</p>
                    <p className="mt-1 text-sm text-zinc-400">{demo ? 'Create a demo loan to see how it works.' : 'A loan you create appears here. You can also look one up by its ID or by the address it pays out to.'}</p>
                    <Link to="/borrow" className="mt-4 inline-flex h-11 items-center rounded-full bg-emerald-400 px-5 text-sm font-semibold text-zinc-950 outline-none hover:bg-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-300">Borrow</Link>
                </Panel>
            ) : null}

            {section('Active', groups.active, fmtUsd(totals.debt))}
            {section('Awaiting deposit', groups.waiting, String(groups.waiting.length))}
            {groups.closed.length ? (
                <section>
                    <button type="button" onClick={() => setShowClosed(v => !v)} aria-expanded={showClosed} className="mb-2 flex w-full items-baseline justify-between px-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-400" data-testid="toggle-closed">
                        <span className="font-semibold text-zinc-200">Closed</span><span className="text-zinc-400">{groups.closed.length} <ChevronDown className={cn('inline h-4 w-4 transition', showClosed && 'rotate-180')} /></span>
                    </button>
                    {showClosed ? <ul className="space-y-2">{groups.closed.map(l => <LoanRow key={l.ref} loan={l} onRemove={() => forget(l.ref)} />)}</ul> : null}
                </section>
            ) : null}

            <Link to="/borrow/advanced/portfolio" className="flex min-h-[56px] items-center justify-between rounded-2xl border border-white/[0.07] px-4 text-sm text-zinc-300 outline-none hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-emerald-400">
                <span>Advanced positions: supply and borrow</span><ChevronRight className="h-4 w-4" />
            </Link>
        </div>
    );
}

// ── One loan ─────────────────────────────────────────────────────────────────

export function LoanDetailPage() {
    const { ref = '' } = useParams();
    const navigate = useNavigate();
    const { loans, provider, markets, upsert, forget, demoProvider } = useLend();
    const [fetched, setFetched] = useState<LoanView | null>(null);
    const [missing, setMissing] = useState(false);
    const [dialog, setDialog] = useState<'repay' | 'deposit' | 'created' | null>(null);
    const [inQuote, setInQuote] = useState(false);
    const loan = loans.find(l => l.ref === ref) ?? fetched;

    // A loan opened by link that is not in the list yet.
    useEffect(() => {
        if (loans.some(l => l.ref === ref)) return;
        let on = true;
        provider.getLoan(ref).then(l => { if (on) { setFetched(l); upsert(l); } }).catch(() => { if (on) setMissing(true); });
        return () => { on = false; };
    }, [ref, provider, loans, upsert]);

    if (missing && !loan) {
        return <Panel className="text-center"><p className="font-semibold">Loan not found</p><p className="mt-1 text-sm text-zinc-400">Check the ID, or look the loan up by its address in your portfolio.</p><Link to="/borrow/portfolio" className="mt-4 inline-block text-sm font-semibold text-emerald-400">Back to portfolio</Link></Panel>;
    }
    if (!loan) return <div className="h-80 animate-pulse rounded-3xl bg-white/[0.05]" />;

    const f = loanFigures(loan, markets);
    const open = OPEN_PHASES.includes(loan.phase);
    const active = loan.phase === 'active';
    const price = f.collateralPrice;
    const liq = loan.liquidationPrice;
    const barPct = Math.min(100, (loan.ltvBps / (loan.liquidationThresholdBps || 7400)) * 100);
    const zone = loan.ltvBps >= loan.liquidationThresholdBps - 600 ? 'bg-red-400' : loan.ltvBps >= loan.liquidationThresholdBps - 1800 ? 'bg-amber-300' : 'bg-emerald-400';
    const activity = demoProvider && loan.provider === 'demo' ? demoProvider.activity(loan.ref) : [];
    const decimalsOf = (asset: string) => markets.find(m => m.asset === asset)?.decimals ?? 8;

    return (
        <div className="space-y-4" data-testid="loan-page">
            <div className="flex items-center gap-2">
                <button type="button" onClick={() => navigate('/borrow/portfolio')} aria-label="Back" className="inline-flex h-11 w-11 items-center justify-center rounded-full outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-emerald-400"><ArrowLeft className="h-5 w-5" /></button>
                <h1 className="font-mono text-2xl font-bold tracking-wider" data-testid="loan-title">{loan.ref}</h1>
                <CopyButton text={loan.ref} label="Copy loan ID" />
                <span className={cn('ml-auto rounded-full px-3 py-1 text-xs font-semibold', active ? 'bg-emerald-400/15 text-emerald-300' : open ? 'bg-amber-400/15 text-amber-200' : 'bg-white/10 text-zinc-300')} data-testid="loan-phase">{PHASE_LABEL[loan.phase]}</span>
            </div>

            {loan.phase === 'awaiting_deposit' ? (
                <Notice tone="warn">
                    Waiting for your collateral. <button type="button" onClick={() => setDialog('created')} className="font-semibold text-white underline underline-offset-4">Show the deposit address</button>
                    {loan.deposit.expiresAt ? <> The loan expires {new Date(loan.deposit.expiresAt).toLocaleTimeString()} if nothing arrives.</> : null}
                </Notice>
            ) : null}
            {loan.phase === 'confirming' ? <Notice>Deposit seen{loan.status.confirmations !== null ? `: ${loan.status.confirmations} of ${loan.status.requiredConfirmations} confirmations` : ''}. Your {loan.borrow.asset} is sent once it confirms.</Notice> : null}
            {loan.phase === 'repaying' ? <Notice>Repayment seen. Waiting for it to confirm; your collateral is released after a full repayment.</Notice> : null}
            {loan.phase === 'liquidated' ? <Notice tone="error">This loan was liquidated: collateral was sold to cover the debt.</Notice> : null}

            <Panel>
                <div className="flex items-end justify-between">
                    <div><div className="text-xs text-zinc-400">Borrow LTV<Hint text="What you owe as a share of what your collateral is worth." /></div><div className="text-4xl font-bold tabular-nums" data-testid="loan-ltv">{fmtPct(loan.ltvBps)}</div></div>
                    <div className="text-right"><div className="text-xs text-zinc-400">Liquidates at<Hint text="If the LTV reaches this, part of the collateral can be sold to repay the debt." /></div><div className="text-4xl font-bold tabular-nums text-zinc-500">{fmtPct(loan.liquidationThresholdBps, 0)}</div></div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(barPct)} aria-label="Distance to liquidation">
                    <div className={cn('h-full rounded-full transition-all', zone)} style={{ width: `${barPct}%` }} />
                </div>
                <div className="mt-5 border-t border-white/10 pt-3">
                    <Row label="Collateral">{fmt(toNumber(f.collateral, loan.collateral.decimals), 8)} {loan.collateral.asset} <span className="text-zinc-500">{fmtUsd(f.collateralUsd)}</span></Row>
                    <Row label="Borrowed">{fmt(toNumber(f.debt, loan.borrow.decimals))} {loan.borrow.asset} <span className="text-zinc-500">{fmtUsd(f.debtUsd)}</span></Row>
                    <Row label="Borrowing APY" hint="Variable. It moves with how much of the pool is borrowed.">{loan.borrowApy.toFixed(2)}%</Row>
                    <Row label="Interest accrued">{fmt(toNumber(f.interest, loan.borrow.decimals), 4)} {loan.borrow.asset}</Row>
                    <Row label={inQuote ? `Liquidation ${loan.borrow.asset}/${loan.collateral.asset}` : `Liquidation ${loan.collateral.asset}/${loan.borrow.asset}`}>
                        {liq > 0 ? (
                            <button type="button" onClick={() => setInQuote(v => !v)} aria-label="Switch liquidation price quote" className="outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
                                {inQuote ? (1 / liq).toFixed(8) : fmt(liq, 0)} <span className="text-zinc-500">{distancePct(liq, price).toFixed(1)}%</span>
                            </button>
                        ) : '—'}
                    </Row>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                    <PrimaryButton variant="outline" onClick={() => setDialog('deposit')} disabled={!active} testId="deposit-more"><ArrowDownToLine className="h-4 w-4" />Deposit more</PrimaryButton>
                    <PrimaryButton onClick={() => setDialog('repay')} disabled={!active} testId="repay-loan"><ArrowUpFromLine className="h-4 w-4" />Repay loan</PrimaryButton>
                </div>
            </Panel>

            <div className="flex justify-end">
                <button type="button" onClick={() => { forget(loan.ref); navigate('/borrow/portfolio'); }} className="inline-flex h-11 items-center gap-2 rounded-full px-3 text-xs text-zinc-500 outline-none hover:text-zinc-200 focus-visible:ring-2 focus-visible:ring-emerald-400" data-testid="remove-loan">
                    <Trash2 className="h-3.5 w-3.5" />Remove from history
                </button>
            </div>

            {activity.length ? (
                <ul className="space-y-2" aria-label="Loan activity">
                    {activity.map((a, i) => (
                        <li key={i} className="flex items-center gap-3 rounded-2xl border border-white/[0.07] px-4 py-3">
                            {a.kind === 'Supply' ? <ArrowDownToLine className="h-4 w-4 text-zinc-400" /> : <ArrowUpFromLine className="h-4 w-4 text-zinc-400" />}
                            <AssetIcon asset={a.asset} size={22} />
                            <span className="flex-1"><span className="block font-semibold tabular-nums">{fmt(toNumber(a.amount, decimalsOf(a.asset)), 8)} {a.asset}</span><span className="block text-xs text-zinc-500">{timeAgo(a.at)}</span></span>
                            <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', a.kind === 'Supply' ? 'bg-emerald-400/15 text-emerald-300' : a.kind === 'Borrow' ? 'bg-amber-400/15 text-amber-200' : 'bg-white/10 text-zinc-300')}>{a.kind}</span>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="rounded-2xl border border-white/[0.07] px-4 py-2 text-sm">
                    <Row label="Funds sent to"><span className="font-mono text-xs">{loan.borrow.destination}</span></Row>
                    <Row label="Collateral returns to"><span className="font-mono text-xs">{loan.refundDestination}</span></Row>
                    <Row label="Created">{new Date(loan.createdAt).toLocaleString()}</Row>
                </div>
            )}

            <RepayDialog loan={loan} open={dialog === 'repay'} onClose={() => setDialog(null)} />
            <DepositMoreDialog loan={loan} open={dialog === 'deposit'} onClose={() => setDialog(null)} />
            <LoanCreatedDialog loan={dialog === 'created' ? loan : null} onClose={() => setDialog(null)} />
        </div>
    );
}
