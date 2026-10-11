/**
 * Referral and Points — demo pages, in the spirit of /borrow's demo mode.
 *
 * Everything here is mocked: there is no referral or points backend yet. A demo
 * banner says so, so nobody mistakes the numbers for real ones. Styled with the
 * wallet's liquid-glass look and Cham, so it reads like the rest of the wallet.
 */

import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
    ArrowLeft, Check, Copy, Crown, Flame, Gift, Repeat, Share2, Sparkles, TrendingUp, Trophy,
    Users, Zap, Droplets, CalendarCheck, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { notifyToast as toast } from '@/lib/notify-toast';
import { Chameleon } from '@/components/wallet/Chameleon';

// ── shared bits ──────────────────────────────────────────────────────────────

function Shell({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="container mx-auto max-w-[920px] p-4 md:p-8">
            <Link to="/portfolio" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
                <ArrowLeft className="h-4 w-4" /> Back to Portfolio
            </Link>
            <div role="status" className="mx-auto mb-5 flex w-fit max-w-full items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm text-amber-200">
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                <span>Demo · sample numbers. {title} is not live yet.</span>
            </div>
            {children}
        </div>
    );
}

function StatTile({ icon, label, value, sub, tone }: { icon: ReactNode; label: string; value: string; sub?: string; tone?: string }) {
    return (
        <div className="lg-card rounded-2xl p-4" style={tone ? ({ ['--lg-tint' as string]: tone }) : undefined}>
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/45">
                <span className="text-white/60">{icon}</span>{label}
            </div>
            <div className="text-2xl font-bold tracking-tight text-white tabular-nums">{value}</div>
            {sub && <div className="mt-0.5 text-[11px] text-white/45">{sub}</div>}
        </div>
    );
}

function Progress({ value, max, tone = '#10b981' }: { value: number; max: number; tone?: string }) {
    const pct = Math.min(100, Math.round((value / max) * 100));
    return (
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.08]">
            <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${tone}, color-mix(in srgb, ${tone} 55%, #ffffff))` }} />
        </div>
    );
}

// ── Referral ─────────────────────────────────────────────────────────────────

const REFERRAL_CODE = 'CHAM-7FAB3D';
const REFERRAL_URL = 'https://wallet.chamwallet.xyz/r/CHAM-7FAB3D';

const FRIENDS = [
    { addr: 'bitcoincash:qz9…k4r8', joined: '2d ago', volume: '$1,240', earned: '$12.40', status: 'active' },
    { addr: 'bitcoincash:qp2…8vn1', joined: '5d ago', volume: '$860', earned: '$8.60', status: 'active' },
    { addr: 'bitcoincash:qr7…m2x9', joined: '1w ago', volume: '$3,100', earned: '$31.00', status: 'active' },
    { addr: 'bitcoincash:qq0…j5t3', joined: '2w ago', volume: '$120', earned: '$1.20', status: 'pending' },
];

export function ReferralPage() {
    const [copied, setCopied] = useState<string | null>(null);
    const copy = (what: 'code' | 'link', value: string) => {
        navigator.clipboard.writeText(value);
        setCopied(what);
        toast.success('Copied');
        setTimeout(() => setCopied(null), 1600);
    };

    return (
        <Shell title="The referral program">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                {/* Invite card */}
                <div className="lg-card rounded-[24px] p-5 lg:col-span-2" style={{ ['--lg-tint' as string]: '#10b981' }}>
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 text-emerald-300">
                                <Gift className="h-4 w-4" />
                                <span className="text-[11px] font-bold uppercase tracking-wider">Invite &amp; earn</span>
                            </div>
                            <h1 className="mt-2 text-2xl font-bold text-white">Earn 10% of every friend's swap fees</h1>
                            <p className="mt-1 text-sm text-white/55">Share your link. When a friend trades with Cham Wallet, you both earn — forever.</p>
                        </div>
                        <Chameleon size={92} mood="happy" className="-mt-2 shrink-0 text-white/35" />
                    </div>

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                            <div className="lg-well flex items-center gap-2 rounded-xl p-2.5">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Code</span>
                                <span className="flex-1 truncate font-mono text-sm font-bold text-white">{REFERRAL_CODE}</span>
                                <button onClick={() => copy('code', REFERRAL_CODE)} className="flex h-7 w-7 items-center justify-center rounded-lg text-white/50 hover:bg-white/[0.08] hover:text-white">
                                    {copied === 'code' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                                </button>
                            </div>
                            <div className="lg-well flex items-center gap-2 rounded-xl p-2.5">
                                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-white/60">{REFERRAL_URL}</span>
                                <button onClick={() => copy('link', REFERRAL_URL)} className="flex h-7 w-7 items-center justify-center rounded-lg text-white/50 hover:bg-white/[0.08] hover:text-white">
                                    {copied === 'link' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                                </button>
                            </div>
                            <div className="flex gap-2">
                                <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent('Trade cross-chain with Cham Wallet')}&url=${encodeURIComponent(REFERRAL_URL)}`} target="_blank" rel="noopener noreferrer"
                                    className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-xs font-semibold text-white/80 transition-colors hover:bg-white/[0.08] hover:text-white">
                                    <Share2 className="h-3.5 w-3.5" /> Share on X
                                </a>
                                <a href={`https://t.me/share/url?url=${encodeURIComponent(REFERRAL_URL)}`} target="_blank" rel="noopener noreferrer"
                                    className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-xs font-semibold text-white/80 transition-colors hover:bg-white/[0.08] hover:text-white">
                                    <Share2 className="h-3.5 w-3.5" /> Telegram
                                </a>
                            </div>
                        </div>
                        <div className="flex shrink-0 items-center justify-center rounded-2xl bg-white p-2.5">
                            <QRCodeSVG value={REFERRAL_URL} size={120} level="M" bgColor="#ffffff" fgColor="#04110a" />
                        </div>
                    </div>
                </div>

                {/* Tier card */}
                <div className="lg-card rounded-[24px] p-5" style={{ ['--lg-tint' as string]: '#a78bfa' }}>
                    <div className="flex items-center gap-2 text-violet-300">
                        <Crown className="h-4 w-4" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">Silver tier</span>
                    </div>
                    <div className="mt-3 text-3xl font-bold text-white tabular-nums">$248.50</div>
                    <div className="text-[11px] text-white/45">earned so far</div>
                    <div className="mt-4 space-y-1.5">
                        <div className="flex justify-between text-[11px] text-white/55"><span>12 friends</span><span>Gold at 25</span></div>
                        <Progress value={12} max={25} tone="#a78bfa" />
                        <div className="text-[10px] text-white/40">13 more friends unlocks 15% fee share</div>
                    </div>
                </div>
            </div>

            {/* Stat row */}
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile icon={<Users className="h-3.5 w-3.5" />} label="Friends" value="12" sub="joined" />
                <StatTile icon={<TrendingUp className="h-3.5 w-3.5" />} label="Volume" value="$5.3k" sub="their trades" />
                <StatTile icon={<Gift className="h-3.5 w-3.5" />} label="Earned" value="$248.50" sub="all time" tone="#10b981" />
                <StatTile icon={<Sparkles className="h-3.5 w-3.5" />} label="Pending" value="$18.20" sub="this cycle" tone="#fbbf24" />
            </div>

            {/* Friends list */}
            <div className="lg-panel mt-5 overflow-hidden rounded-[24px]">
                <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-3.5">
                    <h2 className="text-sm font-semibold text-white">Referred friends</h2>
                    <span className="text-[11px] text-white/40">{FRIENDS.length} total</span>
                </div>
                <div className="divide-y divide-white/[0.04]">
                    {FRIENDS.map(f => (
                        <div key={f.addr} className="flex items-center justify-between gap-3 px-5 py-3.5">
                            <div className="min-w-0">
                                <div className="truncate font-mono text-sm text-white">{f.addr}</div>
                                <div className="text-[11px] text-white/40">joined {f.joined} · {f.volume} traded</div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                <span className="font-mono text-sm font-semibold text-emerald-400">{f.earned}</span>
                                <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                                    f.status === 'active' ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/25 bg-amber-500/10 text-amber-300')}>
                                    {f.status}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </Shell>
    );
}

// ── Points ───────────────────────────────────────────────────────────────────

const EARN = [
    { icon: <Zap className="h-4 w-4" />, label: 'Swap', detail: '1 pt per $1 traded', pts: '+1 / $1' },
    { icon: <Droplets className="h-4 w-4" />, label: 'Provide liquidity', detail: 'Mesh pools', pts: '+5 / $1 / day' },
    { icon: <Gift className="h-4 w-4" />, label: 'Refer a friend', detail: 'when they first trade', pts: '+500' },
    { icon: <Repeat className="h-4 w-4" />, label: 'Bridge USDC', detail: 'cross-chain', pts: '+50' },
    { icon: <CalendarCheck className="h-4 w-4" />, label: 'Daily check-in', detail: 'open the wallet', pts: '+10' },
];

const LEADERS = [
    { rank: 1, name: 'cham.bch', pts: '184,200' },
    { rank: 2, name: 'qz9…k4r8', pts: '142,880' },
    { rank: 3, name: 'solver.eth', pts: '98,500' },
    { rank: 342, name: 'You', pts: '12,480', you: true },
];

export function PointsPage() {
    return (
        <Shell title="The points program">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                {/* Balance hero */}
                <div className="lg-card rounded-[24px] p-5 lg:col-span-2" style={{ ['--lg-tint' as string]: '#2dd4bf' }}>
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2 text-teal-300">
                                <Trophy className="h-4 w-4" />
                                <span className="text-[11px] font-bold uppercase tracking-wider">Your points</span>
                            </div>
                            <div className="mt-2 text-5xl font-bold tracking-tight text-white tabular-nums">12,480</div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-white/55">
                                <span className="inline-flex items-center gap-1"><Crown className="h-3.5 w-3.5 text-teal-300" /> Rank #342</span>
                                <span className="inline-flex items-center gap-1"><Flame className="h-3.5 w-3.5 text-orange-400" /> 7-day streak</span>
                            </div>
                        </div>
                        <Chameleon size={96} mood="happy" tone="#2dd4bf" className="-mt-2 shrink-0 text-white/35" />
                    </div>
                    <div className="mt-5 space-y-1.5">
                        <div className="flex justify-between text-[11px] text-white/55"><span>Level 4 · Explorer</span><span>Level 5 at 15,000</span></div>
                        <Progress value={12480} max={15000} tone="#2dd4bf" />
                        <div className="text-[10px] text-white/40">2,520 points to the next level</div>
                    </div>
                </div>

                {/* Leaderboard */}
                <div className="lg-panel overflow-hidden rounded-[24px]">
                    <div className="border-b border-white/[0.07] px-4 py-3 text-sm font-semibold text-white">Leaderboard</div>
                    <div className="divide-y divide-white/[0.04]">
                        {LEADERS.map(l => (
                            <div key={l.rank} className={cn('flex items-center gap-3 px-4 py-3', l.you && 'bg-teal-500/[0.06]')}>
                                <span className={cn('w-8 shrink-0 text-center font-mono text-sm font-bold', l.rank <= 3 ? 'text-teal-300' : 'text-white/40')}>#{l.rank}</span>
                                <span className={cn('min-w-0 flex-1 truncate text-sm', l.you ? 'font-bold text-white' : 'text-white/80')}>{l.name}</span>
                                <span className="shrink-0 font-mono text-xs font-semibold text-white/70">{l.pts}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Ways to earn */}
            <div className="lg-panel mt-5 overflow-hidden rounded-[24px]">
                <div className="border-b border-white/[0.07] px-5 py-3.5 text-sm font-semibold text-white">Ways to earn</div>
                <div className="divide-y divide-white/[0.04]">
                    {EARN.map(e => (
                        <div key={e.label} className="flex items-center gap-3 px-5 py-3.5">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-teal-500/20 bg-teal-500/10 text-teal-300">{e.icon}</span>
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold text-white">{e.label}</div>
                                <div className="text-[11px] text-white/45">{e.detail}</div>
                            </div>
                            <span className="shrink-0 rounded-full border border-teal-500/25 bg-teal-500/10 px-2.5 py-1 font-mono text-xs font-bold text-teal-300">{e.pts}</span>
                        </div>
                    ))}
                </div>
                <Link to="/trade" className="flex items-center justify-center gap-1.5 border-t border-white/[0.07] py-3.5 text-sm font-semibold text-teal-300 transition-colors hover:bg-white/[0.03]">
                    Start earning — make a swap <ChevronRight className="h-4 w-4" />
                </Link>
            </div>
        </Shell>
    );
}
