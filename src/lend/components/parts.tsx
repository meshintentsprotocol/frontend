/**
 * The small pieces the borrow and supply pages are built from. Layout follows Liquidium's app (stacked cards,
 * a pill asset button, a three-colour LTV track); colours and controls are this app's.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, ChevronDown, Copy, Info, QrCode, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { fmt, fmtPct, fmtUsd, toNumber } from '../math';
import type { Market } from '../types';

const ASSET_STYLE: Record<string, { bg: string; glyph: string }> = {
    BTC: { bg: 'bg-orange-500', glyph: '₿' },
    ETH: { bg: 'bg-indigo-500', glyph: 'Ξ' },
    USDC: { bg: 'bg-blue-500', glyph: '$' },
    USDT: { bg: 'bg-emerald-500', glyph: '₮' },
    ICP: { bg: 'bg-fuchsia-500', glyph: '∞' },
    BCH: { bg: 'bg-green-500', glyph: 'Ƀ' },
    PUSD: { bg: 'bg-teal-500', glyph: 'P' },
};

export function AssetIcon({ asset, size = 28 }: { asset: string; size?: number }) {
    const s = ASSET_STYLE[asset] ?? { bg: 'bg-zinc-600', glyph: asset[0] ?? '?' };
    return (
        <span aria-hidden className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white', s.bg)} style={{ width: size, height: size, fontSize: size * 0.5 }}>
            {s.glyph}
        </span>
    );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={cn('rounded-3xl border border-white/[0.07] bg-white/[0.035] p-5 sm:p-6', className)}>{children}</div>;
}

/** A word with an explanation behind an (i). The explanation is also the control's accessible description. */
export function Hint({ text }: { text: string }) {
    return (
        <span className="group relative inline-flex align-middle">
            <button type="button" aria-label={text} className="ml-1 rounded-full text-zinc-500 outline-none hover:text-zinc-300 focus-visible:ring-2 focus-visible:ring-emerald-400">
                <Info className="h-3.5 w-3.5" />
            </button>
            <span role="tooltip" className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-60 -translate-x-1/2 rounded-xl border border-white/10 bg-zinc-900 p-3 text-xs font-normal leading-relaxed text-zinc-300 shadow-xl group-focus-within:block group-hover:block">
                {text}
            </span>
        </span>
    );
}

export function Row({ label, hint, children, strong }: { label: string; hint?: string; children: ReactNode; strong?: boolean }) {
    return (
        <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
            <span className="text-zinc-400">{label}{hint ? <Hint text={hint} /> : null}</span>
            <span className={cn('text-right tabular-nums', strong ? 'font-semibold text-white' : 'text-zinc-200')}>{children}</span>
        </div>
    );
}

// ── asset picker ──

export function AssetButton({ asset, onClick, disabled }: { asset: string; onClick?: () => void; disabled?: boolean }) {
    return (
        <button
            type="button" onClick={onClick} disabled={disabled || !onClick} aria-label={`Asset: ${asset}. Change`}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-white/10 bg-zinc-900 pl-1.5 pr-3 text-[15px] font-semibold text-white outline-none transition hover:border-white/25 focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-60"
        >
            <AssetIcon asset={asset} />
            {asset}
            {onClick ? <ChevronDown className="h-4 w-4 text-zinc-400" /> : null}
        </button>
    );
}

export function AssetPicker({ open, onClose, markets, side, selected, onPick, balances }: {
    open: boolean; onClose: () => void; markets: Market[]; side: 'borrow' | 'supply'; selected?: string; onPick: (asset: string) => void;
    /** Base units by asset, shown on the right when given. */
    balances?: Record<string, string>;
}) {
    const [q, setQ] = useState('');
    const shown = useMemo(() => markets.filter(m => `${m.asset} ${m.name}`.toLowerCase().includes(q.trim().toLowerCase())), [markets, q]);
    return (
        <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
            <DialogContent className="max-w-md border-white/10 bg-zinc-950 p-0 text-white">
                <DialogHeader className="px-5 pt-5">
                    <DialogTitle>Select a token</DialogTitle>
                    <DialogDescription className="text-zinc-400">{side === 'borrow' ? 'Borrow rate per year' : 'Supply rate per year'}, and what is available.</DialogDescription>
                </DialogHeader>
                <div className="px-5">
                    <label className="flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 focus-within:border-emerald-400/60">
                        <Search className="h-4 w-4 text-zinc-500" />
                        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search" aria-label="Search tokens" className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-500" />
                    </label>
                </div>
                <ul className="max-h-[50vh] overflow-y-auto px-2 pb-3">
                    {shown.map(m => {
                        const right = balances ? balances[m.asset] : m.availableLiquidity;
                        return (
                            <li key={m.asset}>
                                <button
                                    type="button" disabled={m.frozen} onClick={() => { onPick(m.asset); onClose(); }} data-testid={`asset-${m.asset}`}
                                    className={cn('flex min-h-[56px] w-full items-center gap-3 rounded-2xl px-3 text-left outline-none transition hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-40', m.asset === selected && 'bg-emerald-400/10')}
                                >
                                    <AssetIcon asset={m.asset} size={34} />
                                    <span className="flex-1">
                                        <span className="block font-semibold">{m.name}</span>
                                        <span className="block text-xs text-zinc-400">{(side === 'borrow' ? m.borrowApy : m.supplyApy).toFixed(3)}%{m.frozen ? ' · paused' : ''}</span>
                                    </span>
                                    <span className="text-sm tabular-nums text-zinc-300">{right ? fmt(toNumber(right, m.decimals), 4) : ''}</span>
                                    {m.asset === selected ? <Check className="h-4 w-4 text-emerald-400" /> : null}
                                </button>
                            </li>
                        );
                    })}
                    {!shown.length ? <li className="px-3 py-6 text-center text-sm text-zinc-500">No tokens match.</li> : null}
                </ul>
            </DialogContent>
        </Dialog>
    );
}

// ── amount card ──

export function AmountCard({ label, hint, right, value, onChange, asset, onPickAsset, usd, footer, testId, readOnly }: {
    label: string; hint?: string; right?: ReactNode; value: string; onChange?: (v: string) => void; asset: string; onPickAsset?: () => void;
    usd?: number; footer?: ReactNode; testId: string; readOnly?: boolean;
}) {
    return (
        <Panel>
            <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-zinc-200">{label}{hint ? <Hint text={hint} /> : null}</span>
                <span className="text-zinc-400">{right}</span>
            </div>
            <div className="mt-3 flex items-center gap-3">
                <input
                    value={value} readOnly={readOnly} inputMode="decimal" autoComplete="off" placeholder="0" aria-label={`${label} amount`} data-testid={`${testId}-amount`}
                    onChange={e => { const v = e.target.value.replace(',', '.'); if (/^\d*\.?\d*$/.test(v)) onChange?.(v); }}
                    className="h-12 w-full min-w-0 bg-transparent text-4xl font-semibold tabular-nums text-white outline-none placeholder:text-zinc-600"
                />
                <AssetButton asset={asset} onClick={onPickAsset} />
            </div>
            <div className="mt-1 min-h-[20px] text-sm tabular-nums text-zinc-500">{usd !== undefined ? fmtUsd(usd) : ''}</div>
            {footer}
        </Panel>
    );
}

// ── LTV slider ──

/**
 * The loan-to-value control: a track that is green while the loan is comfortable, amber as it nears the most a
 * loan may open at, red beyond. Dragging it sets the collateral for the amount being borrowed.
 */
export function LtvSlider({ bps, maxBps, thresholdBps, onChange, disabled }: { bps: number; maxBps: number; thresholdBps: number; onChange?: (bps: number) => void; disabled?: boolean }) {
    const top = thresholdBps;                       // the track ends at the liquidation point
    const pct = (v: number) => `${Math.min(100, (v / top) * 100)}%`;
    const safeEnd = maxBps * 0.77;
    const zone = bps >= maxBps ? 'text-red-400' : bps >= safeEnd ? 'text-amber-300' : 'text-emerald-400';
    return (
        <div className="mt-4 flex items-center gap-4">
            <div className="relative h-6 flex-1">
                <div aria-hidden className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full"
                    style={{ background: `linear-gradient(to right, #34d399 0 ${pct(safeEnd)}, #fbbf24 ${pct(safeEnd)} ${pct(maxBps)}, #f87171 ${pct(maxBps)} 100%)` }} />
                <input
                    type="range" min={0} max={top} step={50} value={Math.min(bps, top)} disabled={disabled || !onChange}
                    onChange={e => onChange?.(Number(e.target.value))}
                    aria-label="Loan to value" aria-valuetext={`${fmtPct(bps)} loan to value. Liquidation at ${fmtPct(thresholdBps, 0)}`} data-testid="ltv-slider"
                    className="lend-range absolute inset-0 h-6 w-full cursor-pointer appearance-none bg-transparent outline-none disabled:cursor-default"
                />
            </div>
            <span className="w-24 shrink-0 text-right text-sm text-zinc-400">LTV: <span className={cn('font-semibold tabular-nums', zone)} data-testid="ltv-value">{fmtPct(bps)}</span></span>
        </div>
    );
}

// ── address with QR ──

export function CopyButton({ text, label }: { text: string; label: string }) {
    const [done, setDone] = useState(false);
    return (
        <button
            type="button" aria-label={done ? 'Copied' : label}
            onClick={() => { navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }).catch(() => {}); }}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-zinc-300 outline-none transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
            {done ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
        </button>
    );
}

export function AddressQr({ title, address, asset, demo, note }: { title: string; address: string; asset: string; demo?: boolean; note?: string }) {
    const [showQr, setShowQr] = useState(false);
    return (
        <div>
            <div className="mb-2 flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="font-medium text-zinc-100">{title}</span>
                {demo ? <span className="text-xs font-medium text-red-400">Don't send in Demo mode</span> : note ? <span className="text-xs text-zinc-500">{note}</span> : null}
            </div>
            <div className="flex items-center gap-2">
                <button
                    type="button" onClick={() => setShowQr(v => !v)} aria-expanded={showQr} aria-label={`${showQr ? 'Hide' : 'Show'} QR code for ${title}`}
                    className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                    <QrCode className="h-6 w-6" />
                </button>
                <div className="flex min-h-[48px] min-w-0 flex-1 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] pl-3 pr-1">
                    <AssetIcon asset={asset} size={20} />
                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-200" data-testid="address">{address}</span>
                    <CopyButton text={address} label={`Copy ${title}`} />
                </div>
            </div>
            {showQr ? (
                <div className="mt-3 flex justify-center">
                    {/* Cameras read dark on light, whatever the theme. */}
                    <div className="rounded-2xl bg-white p-3"><QRCodeSVG value={address} size={168} level="M" /></div>
                </div>
            ) : null}
        </div>
    );
}

// ── mode and demo controls ──

export function Segmented<V extends string>({ value, options, onChange, label }: { value: V; options: { value: V; label: string }[]; onChange: (v: V) => void; label: string }) {
    return (
        <div role="tablist" aria-label={label} className="inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1">
            {options.map(o => (
                <button
                    key={o.value} type="button" role="tab" aria-selected={o.value === value} onClick={() => onChange(o.value)} data-testid={`tab-${o.value}`}
                    className={cn('h-10 rounded-full px-4 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-400', o.value === value ? 'bg-white text-zinc-950' : 'text-zinc-400 hover:text-white')}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

export function DemoToggle({ on, onChange, locked }: { on: boolean; onChange: (on: boolean) => void; locked?: boolean }) {
    return (
        <label className={cn('inline-flex h-11 items-center gap-3 rounded-full border border-white/10 bg-zinc-950/90 px-4 text-sm font-medium text-zinc-200 shadow-lg backdrop-blur', locked ? 'opacity-80' : 'cursor-pointer')}>
            Demo
            <input type="checkbox" role="switch" className="peer sr-only" checked={on} disabled={locked} onChange={e => onChange(e.target.checked)} aria-label="Toggle demo mode" data-testid="demo-toggle" />
            <span aria-hidden className="relative h-6 w-10 rounded-full bg-zinc-700 transition peer-checked:bg-emerald-500 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-300 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4" />
        </label>
    );
}

export function DemoBanner({ onExit, onReset, reason }: { onExit?: () => void; onReset?: () => void; reason?: string }) {
    return (
        <div role="status" className="mx-auto mb-4 flex w-fit max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm text-amber-200" data-testid="demo-banner">
            <span>Demo mode is on{reason ? ` · ${reason}` : ''}</span>
            {onReset ? <button type="button" onClick={onReset} className="font-semibold text-amber-300 underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-emerald-400">Reset Demo</button> : null}
            {onExit ? <button type="button" onClick={onExit} className="font-semibold text-white underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-emerald-400">Exit</button> : null}
        </div>
    );
}

export function PrimaryButton({ children, onClick, disabled, loading, testId, variant = 'primary' }: { children: ReactNode; onClick?: () => void; disabled?: boolean; loading?: boolean; testId?: string; variant?: 'primary' | 'outline' }) {
    return (
        <button
            type="button" onClick={onClick} disabled={disabled || loading} aria-busy={loading} data-testid={testId}
            className={cn(
                'inline-flex h-14 w-full items-center justify-center gap-2 rounded-full px-6 text-base font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed',
                variant === 'primary' ? 'bg-emerald-400 text-zinc-950 hover:bg-emerald-300 disabled:bg-zinc-700 disabled:text-zinc-400' : 'border border-white/15 text-white hover:bg-white/[0.06] disabled:opacity-50',
            )}
        >
            {loading ? <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
            {children}
        </button>
    );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'error'; children: ReactNode }) {
    const style = { info: 'border-white/10 bg-white/[0.04] text-zinc-300', warn: 'border-amber-400/30 bg-amber-400/10 text-amber-100', error: 'border-red-400/30 bg-red-400/10 text-red-200' }[tone];
    return <div role={tone === 'error' ? 'alert' : 'note'} className={cn('rounded-2xl border px-4 py-3 text-sm leading-relaxed', style)}>{children}</div>;
}
