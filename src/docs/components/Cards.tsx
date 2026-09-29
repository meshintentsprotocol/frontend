import { Link } from 'react-router-dom';
import {
    ArrowUpRight, BookOpen, Bot, Boxes, Code2, FileCode2, KeyRound, Layers, Network, Package, Rocket,
    Server, ShieldCheck, Timer, Wallet, Zap, type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
    rocket: Rocket, zap: Zap, network: Network, contract: FileCode2, package: Package, server: Server,
    bot: Bot, wallet: Wallet, code: Code2, book: BookOpen, layers: Layers, shield: ShieldCheck,
    key: KeyRound, timer: Timer, boxes: Boxes,
};

export interface CardItem {
    title: string;
    description?: string;
    href: string;
    icon?: string;
}

/** Grid of link cards. Internal links are docs slugs ("intents/overview") or app routes ("/trade"). */
export function Cards({ items, cols = 2 }: { items: CardItem[]; cols?: 2 | 3 }) {
    return (
        <div className={`not-prose my-6 grid gap-3 sm:grid-cols-2 ${cols === 3 ? 'lg:grid-cols-3' : ''}`}>
            {items.map(item => {
                const Icon = ICONS[item.icon ?? ''] ?? BookOpen;
                const external = /^https?:/.test(item.href);
                const to = external || item.href.startsWith('/') ? item.href : `/docs/${item.href}`;
                const inner = (
                    <>
                        <div className="flex items-start justify-between">
                            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-zinc-400 transition-colors group-hover:border-emerald-500/30 group-hover:text-emerald-400">
                                <Icon className="h-4 w-4" />
                            </span>
                            <ArrowUpRight className="h-4 w-4 text-zinc-600 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-emerald-400" />
                        </div>
                        <p className="mt-4 text-[15px] font-semibold text-zinc-100">{item.title}</p>
                        {item.description && <p className="mt-1 text-[13.5px] leading-6 text-zinc-500">{item.description}</p>}
                    </>
                );
                const cls = 'group block rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 transition-all hover:border-emerald-500/25 hover:bg-emerald-500/[0.03]';
                return external ? (
                    <a key={item.title} href={to} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
                ) : (
                    <Link key={item.title} to={to} className={cls}>{inner}</Link>
                );
            })}
        </div>
    );
}
