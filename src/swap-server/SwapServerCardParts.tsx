/**
 * The pieces the swap card renders for a swap-server pair: the quote details and the button. Styled with the
 * card's own classes so a routed pair looks like any other pair.
 */
import { AlertTriangle, ArrowLeftRight, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PAIR_NOT_AVAILABLE } from './routing';
import { useSwapServerOptional } from './context';
import type { SwapServerCardState } from './useSwapServerCard';

const BUTTON = 'w-full h-14 text-base font-semibold rounded-2xl';
const BUTTON_OFF = 'bg-white/[0.04] text-white/40 hover:bg-white/[0.04]';

function Notice({ tone, children }: { tone: 'amber' | 'red'; children: React.ReactNode }) {
    return (
        <div className={cn(
            'flex items-start gap-2 text-xs rounded-lg px-2.5 py-2 border',
            tone === 'amber' ? 'text-amber-200/80 bg-amber-500/[0.06] border-amber-500/20' : 'text-red-200/80 bg-red-500/[0.06] border-red-500/20',
        )}>
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
            <span>{children}</span>
        </div>
    );
}

/** The card's button for a swap-server pair, or for a pair that has no flow at all. */
export function SwapServerButton({ state, onClick }: { state: SwapServerCardState; onClick: () => void }) {
    if (state.blocked) {
        // A reason worth reading goes above the button; the plain one is the button.
        const plain = state.blocked === PAIR_NOT_AVAILABLE;
        return (
            <div className="space-y-2">
                {!plain && <Notice tone="amber">{state.blocked}</Notice>}
                <Button className={cn(BUTTON, BUTTON_OFF)} disabled>{plain ? 'This pair is not available' : 'Not available'}</Button>
            </div>
        );
    }
    return (
        <div className="space-y-2">
            {state.notice && <Notice tone={state.problem?.endsWith('paused') || state.problem?.endsWith('for gas') || state.solQuote ? 'amber' : 'red'}>{state.notice}</Notice>}
            {state.busy ? (
                <Button className={cn(BUTTON, BUTTON_OFF)} disabled><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing…</Button>
            ) : state.problem ? (
                <Button className={cn(BUTTON, BUTTON_OFF)} disabled>
                    {state.problem === 'Getting quote…' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {state.problem}
                </Button>
            ) : (
                <Button
                    className={cn(BUTTON, 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-lg shadow-emerald-500/20 disabled:from-white/[0.04] disabled:to-white/[0.04] disabled:text-white/40 disabled:shadow-none transition-all')}
                    onClick={onClick}
                    disabled={!state.canSubmit}
                >
                    {state.actionLabel}
                </Button>
            )}
        </div>
    );
}

const short = (a: string) => (a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

function eta(sec: number): string {
    if (sec < 90) return `about ${Math.max(5, Math.round(sec / 5) * 5)} seconds`;
    return `about ${Math.round(sec / 60)} minutes`;
}

function Row({ label, value, strong, hint }: { label: string; value: React.ReactNode; strong?: boolean; hint?: string }) {
    return (
        <div className="flex justify-between gap-3 text-white/50">
            <span>{label}{hint && <span className="text-white/30"> · {hint}</span>}</span>
            <span className={cn('text-right', strong ? 'text-white font-semibold' : 'text-white/80')}>{value}</span>
        </div>
    );
}

const trim = (v: string | undefined, digits = 6) => {
    if (v === undefined) return '?';
    const n = Number(v);
    return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: n >= 1000 ? 2 : digits }) : v;
};

/** A Jupiter quote: rate, the least the user can receive, price impact, the route and Jupiter's warnings. */
function JupiterDetails({ state }: { state: SwapServerCardState }) {
    const q = state.solQuote;
    const d = q?.display;
    const rate = q && Number(d?.inAmount) > 0 ? Number(d?.outAmount) / Number(d?.inAmount) : undefined;
    const impact = q?.priceImpactPct;
    const venues = q ? [...new Set(q.route.map(r => r.label))] : [];
    return (
        <div className="mx-4 mt-3 rounded-2xl bg-white/[0.02] border border-white/[0.05] overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-4 py-3 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 gap-1 border text-purple-300 bg-purple-500/10 border-purple-500/20 shrink-0">
                        <ArrowLeftRight className="h-3 w-3" />Solana swap
                    </Badge>
                    <span className="text-white/50 truncate">Jupiter · Mainnet</span>
                </div>
                {q && <span className="text-white/50 shrink-0">{q.gasless ? 'Gasless' : 'A few seconds'}</span>}
            </div>
            {q && d && (
                <div className="px-4 pb-3 space-y-1.5 text-sm border-t border-white/[0.04] pt-2">
                    {rate !== undefined && <Row label="Rate" value={`1 ${d.inSymbol ?? ''} ≈ ${trim(String(rate))} ${d.outSymbol ?? ''}`} />}
                    <Row label="You receive" value={`≈ ${trim(d.outAmount)} ${d.outSymbol ?? ''}`} strong />
                    <Row label="At least" value={`${trim(d.minOutAmount)} ${d.outSymbol ?? ''}`} hint={`${q.slippageBps / 100}% slippage`} />
                    {impact !== undefined && Math.abs(impact) >= 0.01 && (
                        <Row label="Price impact" value={<span className={cn(impact <= -3 ? 'text-red-400' : impact <= -1 ? 'text-amber-300' : undefined)}>{impact.toFixed(2)}%</span>} />
                    )}
                    <Row label="Service fee" value={q.referralFeeBps > 0 ? `${q.referralFeeBps / 100}%` : 'None'} />
                    {venues.length > 0 && <Row label="Route" value={<span className="text-xs">{venues.slice(0, 3).join(', ')}{venues.length > 3 ? ` +${venues.length - 3}` : ''}</span>} />}
                    {q.warnings.map(w => (
                        <div key={w} className="flex items-start gap-1.5 text-xs text-yellow-400/80 pt-1">
                            <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                            <span>{w}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/** What the user sends, both fees, what arrives and when. Takes the place of the card's route summary. */
export function SwapServerDetails({ state }: { state: SwapServerCardState }) {
    const ctx = useSwapServerOptional();
    const route = state.route;
    if (!ctx || !route) return null;
    if (route.kind === 'sol-jupiter') return <JupiterDetails state={state} />;
    if (route.kind !== 'usdc-cctp') return null;
    const q = state.quote;
    const d = q?.display;
    const recipient = route.dst.kind === 'evm' ? ctx.evmAddress : ctx.solanaAddress;
    const network = ctx.config?.cctp.network === 'testnet' ? 'Testnet' : 'Mainnet';
    return (
        <div className="mx-4 mt-3 rounded-2xl bg-white/[0.02] border border-white/[0.05] overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-4 py-3 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 gap-1 border text-sky-400 bg-sky-500/10 border-sky-500/20 shrink-0">
                        <ArrowLeftRight className="h-3 w-3" />USDC bridge
                    </Badge>
                    <span className="text-white/50 truncate">Circle CCTP · {network}</span>
                </div>
                {q && <span className="text-white/50 shrink-0">{q.speed === 'fast' ? 'Fast' : 'Standard'} · {eta(q.etaSec)}</span>}
            </div>
            {q && d && (
                <div className="px-4 pb-3 space-y-1.5 text-sm border-t border-white/[0.04] pt-2">
                    <Row label="You send" value={`${d.amount} USDC`} hint={route.src.name} />
                    <Row label="Service fee" value={q.protocolFee === '0' ? 'None' : `${d.protocolFee} USDC`} />
                    <Row label="Network fee" value={q.expectedFee === '0' ? 'None' : `${d.expectedFee} USDC`} hint="Circle" />
                    <Row label="You receive" value={`${d.expectedReceive} USDC`} hint={route.dst.name} strong />
                    {recipient && <Row label="To" value={<span className="font-mono text-xs" title={recipient}>{short(recipient)}</span>} hint="your wallet" />}
                    {q.warnings.map(w => (
                        <div key={w} className="flex items-start gap-1.5 text-xs text-yellow-400/80 pt-1">
                            <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                            <span>{w}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
