/**
 * /fund?intent=<id> | /fund?twap=<id> — fund an order that was prepared elsewhere.
 *
 * An AI agent (through the MCP server) or any other client of the Mesh API can
 * prepare an order, but only its maker can fund it. This page shows what the
 * order is, checks the funding list against it, and has the connected wallet
 * sign the one funding transaction. Afterwards it follows the order to its end.
 */
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, Check, Copy, ExternalLink, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '@/components/common/Header';
import { ConnectWalletButton } from '@/components/connect-wallet-button';
import { Button } from '@/components/ui/button';
import { useBCHWallet } from '@/context/BCHWalletProvider';
import { useWDK } from '@/context/WDKProvider';
import { useActiveWallet } from '@/hooks/useActiveWallet';
import { useFundCovenants } from '@/hooks/useFundCovenants';
import { useTokenMetadata } from '@/hooks/useTokenMetadata';
import { pkhOfAddress } from '@/hooks/useTWAP';
import { BCH_MESH_SERVER_URL } from '@/lib/config';
import {
    awaitingParts, fundingProblem, isOpen, networkOfAddress, recallFunding, rememberFunding, statusView,
    targetFromIntent, targetFromTwap, type FundNetwork, type FundTarget, type StatusTone,
} from '@/lib/fundOrder';
import { explorerTx, formatUnits, shortHex } from '@/lib/mesh/format';
import { siteOf } from '@/lib/sanity';
import { useSeo } from '@/lib/useSeo';
import { cn } from '@/lib/utils';
import { fundSeo } from '@/shared/seo';

const TONE: Record<StatusTone, string> = {
    wait: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    live: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
    done: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    back: 'border-violet-500/40 bg-violet-500/10 text-violet-300',
    dead: 'border-white/10 bg-white/5 text-zinc-400',
};

class NotFound extends Error {}

async function loadTarget(kind: 'intent' | 'twap', id: string): Promise<FundTarget> {
    const res = await fetch(`${BCH_MESH_SERVER_URL}/api/v1/${kind}/${encodeURIComponent(id)}`);
    if (res.status === 404) throw new NotFound();
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `The server answered ${res.status}`);
    return kind === 'intent' ? targetFromIntent(data) : targetFromTwap(data);
}

function StatusChip({ status }: { status: string }) {
    const v = statusView(status);
    return (
        <span title={v.hint} className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold', TONE[v.tone])}>
            {v.tone === 'live' && <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />}
            {v.label}
        </span>
    );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-4 py-2.5">
            <dt className="shrink-0 text-sm text-zinc-500">{label}</dt>
            <dd className="min-w-0 text-right text-sm text-zinc-100">{children}</dd>
        </div>
    );
}

function CopyText({ text, short }: { text: string; short?: string }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        void navigator.clipboard?.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };
    return (
        <button type="button" onClick={copy} title={text} className="inline-flex max-w-full items-center gap-1.5 font-mono text-xs text-zinc-300 hover:text-white">
            <span className="truncate">{short ?? text}</span>
            {copied ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 shrink-0 text-zinc-500" />}
        </button>
    );
}

function Notice({ tone, children }: { tone: 'warn' | 'info'; children: React.ReactNode }) {
    return (
        <div className={cn('flex gap-3 rounded-2xl border p-4 text-sm leading-relaxed', tone === 'warn' ? 'border-amber-500/30 bg-amber-500/[0.07] text-amber-100' : 'border-white/10 bg-white/[0.03] text-zinc-300')}>
            {tone === 'warn' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" /> : <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />}
            <div className="min-w-0 space-y-2">{children}</div>
        </div>
    );
}

function Shell({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen flex-col bg-[#050505]">
            <Header />
            <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-20 pt-28">{children}</main>
        </div>
    );
}

function Message({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
            <h1 className="text-xl font-bold text-white">{title}</h1>
            <div className="mt-3 space-y-4 text-sm leading-relaxed text-zinc-400">{children}</div>
        </div>
    );
}

const when = (unixSec?: number) => (unixSec ? new Date(unixSec * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—');

export default function FundOrderPage() {
    useSeo(fundSeo(siteOf()));
    const [params] = useSearchParams();
    const intentId = params.get('intent')?.trim() || null;
    const twapId = params.get('twap')?.trim() || null;
    const kind = intentId ? 'intent' : 'twap';
    const id = intentId ?? twapId;

    const wdk = useWDK();
    const bchWallet = useBCHWallet();
    const { isMainActive, activeExtWallet } = useActiveWallet();
    const fund = useFundCovenants();
    const appNetwork: FundNetwork = wdk.bchNetwork === 'mainnet' ? 'mainnet' : 'chipnet';

    const query = useQuery<FundTarget, Error>({
        queryKey: ['fund-target', kind, id],
        enabled: !!id,
        queryFn: () => loadTarget(kind, id!),
        retry: (count, err) => !(err instanceof NotFound) && count < 2,
        refetchInterval: q => (q.state.data && !isOpen(q.state.data.status) ? false : 5000),
    });
    const target = query.data;

    const sellMeta = useTokenMetadata(target && target.sellToken !== 'BCH' ? target.sellToken : null).data;
    const buyMeta = useTokenMetadata(target && target.buyToken !== 'BCH' ? target.buyToken : null).data;
    const amount = (base: string, token: string, meta: typeof sellMeta) => {
        if (token === 'BCH') return `${formatUnits(base, 8)} BCH`;
        if (meta) return `${formatUnits(base, meta.decimals)} ${meta.symbol}`;
        return `${formatUnits(base, 0)} units of ${shortHex(token)}`;
    };

    const [busy, setBusy] = useState(false);
    const [sentNow, setSentNow] = useState<string | null>(null);
    const [ownsMaker, setOwnsMaker] = useState(false);
    const sentTxid = useMemo(() => sentNow ?? (target ? recallFunding(target) : null), [sentNow, target]);

    if (!id) {
        return (
            <Shell>
                <Message title="Nothing to fund">
                    <p>This page funds an order that was prepared elsewhere, for example by an AI agent connected to BCH Intents. Open it from the funding link the agent gave you.</p>
                    <div className="flex flex-wrap justify-center gap-3">
                        <Button asChild variant="outline" className="rounded-full border-white/15 bg-white/5 text-white hover:bg-white/10"><Link to="/trade">Trade in the app</Link></Button>
                        <Button asChild className="rounded-full bg-emerald-400 font-bold text-black hover:bg-emerald-300"><Link to="/mcp">Connect an AI agent</Link></Button>
                    </div>
                </Message>
            </Shell>
        );
    }
    if (query.isLoading) {
        return <Shell><div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-zinc-500" /></div></Shell>;
    }
    if (!target) {
        const missing = query.error instanceof NotFound;
        return (
            <Shell>
                <Message title={missing ? 'Order not found' : 'Could not load the order'}>
                    {missing
                        ? <p>No order <span className="font-mono text-zinc-300">{id}</span> on this server. It may belong to the other network, or the link may be incomplete.</p>
                        : <p>{query.error?.message ?? 'The Mesh Server did not answer.'}</p>}
                    <Button variant="outline" className="rounded-full border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={() => void query.refetch()}>Try again</Button>
                </Message>
            </Shell>
        );
    }

    const orderNetwork = networkOfAddress(target.parts[0]?.covenant ?? '') ?? appNetwork;
    const wrongNetwork = orderNetwork !== appNetwork;
    const userAddress = (isMainActive ? bchWallet.address || wdk.bchAddress : activeExtWallet?.address) || '';
    const userPkh = pkhOfAddress(userAddress, appNetwork);
    const isMaker = !!userPkh && userPkh === target.makerPkh;

    const waiting = awaitingParts(target);
    const awaiting = waiting.length > 0 && !sentTxid;
    const problem = awaiting ? fundingProblem(target) : null;
    const canFund = awaiting && !problem && !wrongNetwork && !!userAddress && (isMaker || ownsMaker) && !busy;
    const isTwap = target.kind === 'twap';
    const typeLabel = isTwap ? `TWAP · ${target.parts.length} slices` : target.orderType === 'limit' ? 'Limit order' : 'Dutch auction';

    const onFund = async () => {
        setBusy(true);
        try {
            const txid = await fund(target.funding, isTwap ? `Fund ${target.funding.length} TWAP slices` : 'Fund swap order');
            rememberFunding(target, txid);
            setSentNow(txid);
            toast.success('Funding transaction sent');
            void query.refetch();
        } catch (e: any) {
            toast.error(e?.message || 'The funding transaction was not sent');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Shell>
            <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-white">{awaiting ? 'Fund your order' : 'Order status'}</h1>
                        <p className="mt-1 font-mono text-xs text-zinc-500">{target.id}</p>
                    </div>
                    <StatusChip status={sentTxid && waiting.length ? 'funding_sent' : target.status} />
                </div>

                <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                        <div>
                            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">You sell</div>
                            <div className="mt-1 break-words text-xl font-bold text-white">{amount(target.sellAmount, target.sellToken, sellMeta)}</div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-zinc-600" />
                        <div className="text-right">
                            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">You receive at least</div>
                            <div className="mt-1 break-words text-xl font-bold text-emerald-300">{amount(target.minReceive, target.buyToken, buyMeta)}</div>
                        </div>
                    </div>

                    <dl className="mt-5 divide-y divide-white/5 border-t border-white/5">
                        <Row label="Type">{typeLabel}</Row>
                        {target.startReceive && target.startReceive !== target.minReceive && (
                            <Row label="Opens asking">{amount(target.startReceive, target.buyToken, buyMeta)}</Row>
                        )}
                        <Row label="Network">{orderNetwork === 'mainnet' ? 'Mainnet' : 'Chipnet (testnet)'}</Row>
                        <Row label="Open until">{when(target.expiresAt)}</Row>
                        <Row label="Paid out to"><CopyText text={target.makerAddress || target.makerPkh} short={shortHex(target.makerAddress || target.makerPkh, 10, 8)} /></Row>
                        {!isTwap && <Row label="Covenant"><CopyText text={target.parts[0]!.covenant} short={shortHex(target.parts[0]!.covenant, 10, 8)} /></Row>}
                    </dl>
                </section>

                {isTwap && (
                    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                        <h2 className="text-sm font-bold text-white">Slices</h2>
                        <ul className="mt-3 divide-y divide-white/5">
                            {target.parts.map((p, i) => (
                                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                                    <span className="text-zinc-400">#{i + 1} · {amount(p.sellAmount, target.sellToken, sellMeta)} · opens {when(p.startTime)}</span>
                                    <span className="flex shrink-0 items-center gap-2">
                                        {(p.fillTxid || p.refundTxid) && (
                                            <a href={explorerTx(orderNetwork, (p.fillTxid || p.refundTxid)!)} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-white" aria-label="View transaction"><ExternalLink className="h-3.5 w-3.5" /></a>
                                        )}
                                        <StatusChip status={p.status} />
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {awaiting && (
                    <>
                        <Notice tone="info">
                            <p>This order was prepared outside the app. Check the amounts and the payout address: they are what you are agreeing to.</p>
                            <p>Once funded, your coins sit in a covenant that can only be spent by a fill paying <span className="font-semibold text-white">at least the amount above</span> to the payout address, or returned to it after the deadline.</p>
                        </Notice>

                        {problem && <Notice tone="warn"><p className="font-semibold">This order cannot be funded safely.</p><p>{problem}</p></Notice>}

                        {wrongNetwork && (
                            <Notice tone="warn">
                                <p>The order is on <span className="font-semibold">{orderNetwork}</span> but the app is set to {appNetwork}.</p>
                                <Button size="sm" className="rounded-full bg-amber-400 font-bold text-black hover:bg-amber-300" onClick={() => wdk.setBchNetwork(orderNetwork)}>Switch to {orderNetwork}</Button>
                            </Notice>
                        )}

                        {!wrongNetwork && userAddress && !isMaker && (
                            <Notice tone="warn">
                                <p>The payout address is not the connected wallet ({shortHex(userAddress, 8, 6)}). The bought asset, and any refund, go to the payout address, not to the wallet that funds.</p>
                                <label className="flex cursor-pointer items-start gap-2.5">
                                    <input type="checkbox" checked={ownsMaker} onChange={e => setOwnsMaker(e.target.checked)} className="mt-0.5 h-4 w-4 accent-amber-400" />
                                    <span>The payout address is mine. Fund the order from this wallet.</span>
                                </label>
                            </Notice>
                        )}

                        {userAddress ? (
                            <Button disabled={!canFund} onClick={onFund} className="h-14 w-full rounded-2xl bg-emerald-400 text-base font-bold text-black hover:bg-emerald-300 disabled:opacity-40">
                                {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Waiting for your wallet…</> : `Fund ${amount(target.sellAmount, target.sellToken, sellMeta)}`}
                            </Button>
                        ) : (
                            <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center text-sm text-zinc-400">
                                <p>Connect the wallet that holds the coins to fund this order.</p>
                                <ConnectWalletButton />
                            </div>
                        )}
                    </>
                )}

                {sentTxid && (
                    <Notice tone="info">
                        <p className="font-semibold text-white">Funding transaction sent.</p>
                        <p>{waiting.length ? 'The server picks it up within a few seconds; this page updates on its own.' : 'The order is funded.'}</p>
                        <a href={explorerTx(orderNetwork, sentTxid)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-mono text-xs text-emerald-300 hover:text-emerald-200">
                            {shortHex(sentTxid, 10, 8)} <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                    </Notice>
                )}

                {!awaiting && (
                    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-sm leading-relaxed text-zinc-300 sm:p-6">
                        <p>{statusView(target.status).hint}</p>
                        {!isTwap && (target.parts[0]!.fillTxid || target.parts[0]!.refundTxid) && (
                            <a href={explorerTx(orderNetwork, (target.parts[0]!.fillTxid || target.parts[0]!.refundTxid)!)} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 font-semibold text-emerald-300 hover:text-emerald-200">
                                View the {target.parts[0]!.fillTxid ? 'fill' : 'refund'} transaction <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                        )}
                        {isOpen(target.status) && target.refundEligibleAt && (
                            <p className="mt-3 text-zinc-500">If it does not fill, the funds return to the payout address after {when(target.refundEligibleAt)}.</p>
                        )}
                    </section>
                )}
            </div>
        </Shell>
    );
}
