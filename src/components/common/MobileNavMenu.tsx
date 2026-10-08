import { useEffect, useId, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeftRight, ArrowUpRight, ChevronDown, Compass, Droplets, Github, Menu, Wallet } from 'lucide-react';
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { useWDK } from '@/context/WDKProvider';
import { MESH_PAGES } from '@/components/common/MeshNavDropdown';
import { TRADE_PAGES } from '@/components/common/TradeNavDropdown';
import { PORTFOLIO_PAGES } from '@/components/common/PortfolioNavDropdown';

// ============================================================================
// Mobile navigation — bottom sheet opened from the header's menu button
// ============================================================================
// App destinations first as large rows, then collapsible link groups, then the
// network switch and socials.

const APP_VERSION = '0.1.0';

type IconType = ComponentType<{ className?: string }>;

interface SubLink {
    name: string;
    path: string;
    icon?: IconType;
    badge?: string;
    external?: boolean;
}

interface AppItem {
    name: string;
    path: string;
    icon: IconType;
    /** Pathnames this destination owns, for the active state. */
    matches: (pathname: string) => boolean;
    children?: SubLink[];
}

const under = (base: string) => (pathname: string) => pathname === base || pathname.startsWith(`${base}/`);

const APP_ITEMS: AppItem[] = [
    { name: 'Trade', path: '/trade', icon: ArrowLeftRight, matches: p => p === '/trade' || p === '/twap', children: TRADE_PAGES },
    { name: 'Explore', path: '/explore', icon: Compass, matches: under('/explore') },
    { name: 'Pool', path: '/mesh', icon: Droplets, matches: p => p.startsWith('/mesh') || p === '/orderbook', children: MESH_PAGES },
    { name: 'Portfolio', path: '/portfolio', icon: Wallet, matches: under('/portfolio'), children: PORTFOLIO_PAGES },
];

const LINK_GROUPS: { title: string; links: SubLink[] }[] = [
    {
        title: 'Products',
        links: [
            { name: 'Intent Wallet', path: '/wallet' },
            { name: 'Features', path: '/features' },
            { name: 'Ecosystem', path: '/ecosystem' },
            { name: 'Integrate', path: '/integrate' },
            { name: 'MCP for AI Agents', path: '/mcp' },
            { name: 'Pool Overview', path: '/mesh-landing' },
        ],
    },
    {
        title: 'Resources',
        links: [
            { name: 'Knowledgehub', path: '/kb' },
            { name: 'Documentation', path: 'https://docs.intentsprotocol.xyz/', external: true },
            { name: 'Monitor', path: '/monitor' },
            { name: 'Admin Analytics', path: '/admin' },
        ],
    },
    {
        title: 'Legal & Privacy',
        links: [
            { name: 'Terms of Service', path: '/terms' },
            { name: 'Privacy Policy', path: '/privacy' },
        ],
    },
];

const XIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]" aria-hidden><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" /></svg>
);
const MediumIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden><path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42c1.87 0 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z" /></svg>
);

const SOCIALS: { label: string; href: string; icon: ReactNode }[] = [
    { label: 'GitHub', href: 'https://github.com/Intents-Swaps', icon: <Github className="h-5 w-5" /> },
    { label: 'X', href: 'https://x.com/bchintents', icon: <XIcon /> },
    { label: 'Medium', href: 'https://medium.com/@bchintents', icon: <MediumIcon /> },
];

/** Height-animated container; collapsed content is hidden from focus and screen readers. */
function Collapse({ open, id, children }: { open: boolean; id: string; children: ReactNode }) {
    return (
        <div
            id={id}
            className={cn(
                'grid transition-[grid-template-rows,visibility] duration-200 ease-out motion-reduce:transition-none',
                open ? 'grid-rows-[1fr] visible' : 'grid-rows-[0fr] invisible',
            )}
        >
            <div className="overflow-hidden">{children}</div>
        </div>
    );
}

function SubLinkRow({ link, active, onNavigate, className }: { link: SubLink; active: boolean; onNavigate: () => void; className?: string }) {
    const Icon = link.icon;
    const body = (
        <>
            {Icon && <Icon className="h-4 w-4 shrink-0 opacity-70" />}
            <span className="truncate">{link.name}</span>
            {link.badge && (
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-zinc-400">
                    {link.badge}
                </span>
            )}
            {link.external && <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-zinc-500" />}
        </>
    );
    const rowClass = cn(
        'flex min-h-[40px] items-center gap-2.5 rounded-lg px-2 text-[15px] transition-colors active:bg-white/[0.06]',
        active ? 'font-semibold text-emerald-400' : 'text-zinc-300 hover:text-white',
        className,
    );
    return link.external ? (
        <a href={link.path} target="_blank" rel="noopener noreferrer" onClick={onNavigate} className={rowClass}>{body}</a>
    ) : (
        <Link to={link.path} onClick={onNavigate} aria-current={active ? 'page' : undefined} className={rowClass}>{body}</Link>
    );
}

function LinkGroup({ title, links, currentUrl, pathname, defaultOpen, onNavigate }: {
    title: string; links: SubLink[]; currentUrl: string; pathname: string; defaultOpen: boolean; onNavigate: () => void;
}) {
    const [open, setOpen] = useState(defaultOpen);
    const id = useId();
    return (
        <div>
            <button
                type="button"
                aria-expanded={open}
                aria-controls={id}
                onClick={() => setOpen(o => !o)}
                className="flex min-h-[44px] w-full items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-zinc-400 transition-colors hover:text-white active:bg-white/[0.06]"
            >
                {title}
                <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', open && 'rotate-180')} />
            </button>
            <Collapse open={open} id={id}>
                <div className="grid grid-cols-1 gap-x-2 pb-2 min-[400px]:grid-cols-2">
                    {links.map(link => (
                        <SubLinkRow key={link.path} link={link} active={!link.external && isSubLinkActive(link.path, currentUrl, pathname)} onNavigate={onNavigate} />
                    ))}
                </div>
            </Collapse>
        </div>
    );
}

/** A sub-link is active on an exact URL match; /mesh with no tab counts as Positions. */
function isSubLinkActive(path: string, currentUrl: string, pathname: string) {
    if (currentUrl === path) return true;
    return path === '/mesh?tab=positions' && pathname === '/mesh'
        && (currentUrl === '/mesh' || currentUrl.startsWith('/mesh?tab=positions&'));
}

export function MobileNavMenu() {
    const [open, setOpen] = useState(false);
    const [expanded, setExpanded] = useState<string | null>(null);
    const location = useLocation();
    const wdk = useWDK();
    const isMainnet = wdk.bchNetwork === 'mainnet';
    const currentUrl = location.pathname + location.search;
    const listId = useId();

    const close = () => setOpen(false);

    // Close when the viewport grows into the desktop layout (>= 1024px)
    useEffect(() => {
        const onResize = () => { if (window.innerWidth >= 1024) setOpen(false); };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    // Each time the sheet opens, expand the section the user is currently in
    useEffect(() => {
        if (!open) return;
        const current = APP_ITEMS.find(item => item.children && item.matches(location.pathname));
        setExpanded(current?.name ?? null);
    }, [open, location.pathname]);

    return (
        <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
            <DrawerTrigger asChild>
                <button
                    type="button"
                    aria-label="Open menu"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/5 bg-white/[0.02] text-zinc-300 transition-colors hover:bg-white/10 hover:text-emerald-400 active:scale-95"
                >
                    <Menu className="h-6 w-6" />
                </button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[88dvh] p-0">
                <DrawerTitle className="sr-only">Navigation menu</DrawerTitle>
                <DrawerDescription className="sr-only">Site navigation, network and social links</DrawerDescription>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1 sm:px-6">
                    <div className="mx-auto w-full max-w-md">
                        {/* ─── App ─── */}
                        <nav aria-label="App">
                            <div className="px-2 pb-1 text-sm font-medium text-zinc-500">App</div>
                            <ul>
                                {APP_ITEMS.map(item => {
                                    const Icon = item.icon;
                                    const active = item.matches(location.pathname);
                                    const isExpanded = expanded === item.name;
                                    const childrenId = `${listId}-${item.name}`;
                                    return (
                                        <li key={item.name}>
                                            <div className="flex items-center">
                                                <Link
                                                    to={item.path}
                                                    onClick={close}
                                                    aria-current={active ? 'page' : undefined}
                                                    className="flex min-h-[48px] flex-1 items-center gap-3 rounded-xl px-2 transition-colors active:bg-white/[0.06]"
                                                >
                                                    <span className={cn(
                                                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                                                        active ? 'bg-emerald-500 text-[#050505]' : 'bg-emerald-500/10 text-emerald-400',
                                                    )}>
                                                        <Icon className="h-[18px] w-[18px]" />
                                                    </span>
                                                    <span className={cn('text-lg font-medium tracking-tight', active ? 'text-white' : 'text-zinc-200')}>
                                                        {item.name}
                                                    </span>
                                                </Link>
                                                {item.children && (
                                                    <button
                                                        type="button"
                                                        aria-label={`${isExpanded ? 'Hide' : 'Show'} ${item.name} pages`}
                                                        aria-expanded={isExpanded}
                                                        aria-controls={childrenId}
                                                        onClick={() => setExpanded(isExpanded ? null : item.name)}
                                                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-zinc-500 transition-colors hover:text-white active:bg-white/[0.06]"
                                                    >
                                                        <ChevronDown className={cn('h-5 w-5 transition-transform duration-200', isExpanded && 'rotate-180 text-emerald-400')} />
                                                    </button>
                                                )}
                                            </div>
                                            {item.children && (
                                                <Collapse open={isExpanded} id={childrenId}>
                                                    <div className="mb-1 ml-6 grid grid-cols-1 gap-x-2 border-l border-white/10 pl-4 min-[400px]:grid-cols-2">
                                                        {item.children.map(child => (
                                                            <SubLinkRow
                                                                key={child.path}
                                                                link={child}
                                                                active={isSubLinkActive(child.path, currentUrl, location.pathname)}
                                                                onNavigate={close}
                                                            />
                                                        ))}
                                                    </div>
                                                </Collapse>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </nav>

                        {/* ─── Link groups ─── */}
                        <div className="mt-3 border-t border-white/[0.08] pt-2">
                            {LINK_GROUPS.map(group => (
                                <LinkGroup
                                    key={group.title}
                                    title={group.title}
                                    links={group.links}
                                    currentUrl={currentUrl}
                                    pathname={location.pathname}
                                    defaultOpen={group.links.some(l => !l.external && under(l.path)(location.pathname))}
                                    onNavigate={close}
                                />
                            ))}
                        </div>

                        {/* ─── Network ─── */}
                        <div className="mt-2 flex items-center justify-between gap-3 border-t border-white/[0.08] px-2 pt-4">
                            <span className="text-sm font-medium text-zinc-400">Network</span>
                            <div role="radiogroup" aria-label="Network" className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
                                {([['chipnet', 'Testnet'], ['mainnet', 'Mainnet']] as const).map(([net, label]) => {
                                    const selected = wdk.bchNetwork === net;
                                    return (
                                        <button
                                            key={net}
                                            type="button"
                                            role="radio"
                                            aria-checked={selected}
                                            onClick={() => wdk.setBchNetwork(net)}
                                            className={cn(
                                                'flex h-9 items-center gap-1.5 rounded-lg px-4 text-xs font-semibold transition-colors',
                                                selected
                                                    ? net === 'mainnet' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white'
                                                    : 'text-zinc-500 hover:text-zinc-300',
                                            )}
                                        >
                                            {net === 'mainnet' && isMainnet && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ─── Footer: version + socials ─── */}
                        <div className="mt-4 flex items-center justify-between px-2">
                            <span className="text-xs text-zinc-500">BCH Intents · v{APP_VERSION} · Beta</span>
                            <div className="flex items-center">
                                {SOCIALS.map(s => (
                                    <a
                                        key={s.label}
                                        href={s.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label={s.label}
                                        className="flex h-11 w-11 items-center justify-center rounded-xl text-zinc-300 transition-colors hover:text-white active:bg-white/[0.06]"
                                    >
                                        {s.icon}
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    );
}
