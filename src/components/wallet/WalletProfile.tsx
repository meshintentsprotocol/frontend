/**
 * WalletProfile — the top of the wallet panel.
 *
 * One card that answers "who am I acting as, on which network, and what is it
 * worth", and is the only place wallets are added, switched, named, coloured and
 * disconnected. The card takes the active wallet's colour, and so does Cham.
 *
 *   identity   icon, name, address (copy), edit (colour and name, in a pop-up card),
 *              and the list of wallets behind the chevron
 *   network    Testnet / Mainnet
 *   balance    the value, hide and refresh
 *   actions    send, receive, add a wallet, log out
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
    ArrowDownLeft, ArrowUpRight, Check, ChevronDown, Copy, Eye, EyeOff, KeyRound, Lock, LogOut, Pencil,
    Plus, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWDK } from '@/context/WDKProvider';
import { useExternalBCHWallet } from '@/context/ExternalBCHWalletProvider';
import { useBchAddressBalance } from '@/hooks/useBchAddressBalance';
import { useBchWalletBalance } from '@/hooks/useBchWalletBalance';
import { useWallets, shortAddress, type ConnectedWallet } from '@/hooks/useWallets';
import { usePendingSign } from '@/lib/wallets/signRequest';
import { walletUi } from '@/lib/walletUi';
import { notifyToast as toast } from '@/lib/notify-toast';
import { SendModal } from '@/components/portfolio/SendModal';
import { ReceiveModal } from '@/components/portfolio/ReceiveModal';
import { Chameleon, type ChamMood } from './Chameleon';
import { NetworkSwitch } from './NetworkControl';
import { WalletIcon } from './WalletIcon';
import { WalletEditCard } from './WalletLookEditor';

const KIND_LABEL: Record<ConnectedWallet['kind'], string> = {
    main: 'Built-in',
    walletconnect: 'WalletConnect',
    wizardconnect: 'WizardConnect',
    extension: 'Extension',
    appkit: 'AppKit',
};

const BRAND = '#10b981';

function WalletBalance({ wallet, isMainnet, live, hidden }: { wallet: ConnectedWallet; isMainnet: boolean; live: boolean; hidden: boolean }) {
    const extWallet = useMemo(() => {
        if (wallet.kind === 'main') return null;
        return {
            id: wallet.id,
            family: wallet.family,
            source: wallet.kind,
            address: wallet.address,
            label: wallet.name,
            createdAt: 0,
        };
    }, [wallet.id, wallet.family, wallet.kind, wallet.address, wallet.name]);

    const isExt = wallet.kind !== 'main';
    const extBal = useBchWalletBalance({ wallet: isExt ? extWallet : null, isMainnet, refetchMs: live ? 20_000 : 0 });
    const mainBal = useBchAddressBalance({ address: !isExt ? wallet.address : null, isMainnet, refetchMs: live ? 20_000 : 0 });

    const data = isExt ? extBal.data : mainBal.data;
    const isLoading = isExt ? extBal.isLoading : mainBal.isLoading;
    const isError = isExt ? extBal.isError : mainBal.isError;

    if (hidden) return <span className="text-[11px] font-semibold text-white/50">••••</span>;
    if (isLoading) return <span className="inline-block h-3 w-14 rounded bg-white/[0.07] animate-pulse" />;
    if (isError) return <span className="text-[10px] text-white/30">—</span>;
    const tokenCount = Object.keys(data.tokens).length;
    return (
        <span className="text-[11px] font-semibold tabular-nums text-white/80">
            {(data.sats / 1e8).toLocaleString(undefined, { maximumFractionDigits: 6 })} BCH
            {tokenCount > 0 && <span className="ml-1 font-medium text-white/35">+{tokenCount}</span>}
        </span>
    );
}

/** One wallet in the list: pick it, copy its address, or open its edit card. */
function WalletRow({ wallet, isMainnet, hidden, onPick, onEdit, isPending }: {
    wallet: ConnectedWallet; isMainnet: boolean; hidden: boolean; onPick: () => void; onEdit: () => void; isPending?: boolean;
}) {
    const copy = () => {
        navigator.clipboard.writeText(wallet.address);
        toast.success('Address copied');
    };

    return (
        <li
            className={cn('flex items-center gap-2 rounded-xl border p-2 transition-colors', wallet.active ? 'bg-white/[0.06]' : 'border-transparent hover:bg-white/[0.03]')}
            style={wallet.active ? { borderColor: `${wallet.color}55` } : undefined}
        >
            <button type="button" onClick={onPick} aria-pressed={wallet.active} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                <WalletIcon id={wallet.iconId} color={wallet.color} size={36} active={wallet.active} />
                <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-bold text-white">{wallet.name}</span>
                        <span className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.03] px-1.5 py-px text-[8.5px] font-bold uppercase tracking-wider text-white/40">
                            {KIND_LABEL[wallet.kind]}
                        </span>
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                        <span className="truncate font-mono text-[10px] text-white/40">{shortAddress(wallet.address, 8, 6)}</span>
                        <div className="flex items-center gap-1.5">
                            {isPending && (
                                <span className="animate-pulse rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-300 bg-amber-500/10 border border-amber-500/20">
                                    Signing…
                                </span>
                            )}
                            <WalletBalance wallet={wallet} isMainnet={isMainnet} live hidden={hidden} />
                        </div>
                    </span>
                </span>
            </button>
            <div className="flex shrink-0 items-center">
                {wallet.active && <Check className="mr-1 h-3.5 w-3.5" style={{ color: wallet.color }} aria-label="Active" />}
                <button type="button" onClick={copy} title="Copy address" aria-label={`Copy the address of ${wallet.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-white/35 hover:bg-white/[0.06] hover:text-white">
                    <Copy className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={onEdit} title="Colour, name, disconnect" aria-label={`Edit ${wallet.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-white/35 hover:bg-white/[0.06] hover:text-white">
                    <Pencil className="h-3.5 w-3.5" />
                </button>
            </div>
        </li>
    );
}

const ACTION = 'group flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.05] px-1.5 text-[11px] font-semibold text-white/80 transition-colors hover:bg-white/[0.1] hover:text-white focus-visible:bg-white/[0.12] focus-visible:outline-none active:scale-[0.98]';
const ACTION_ICON = 'flex shrink-0 items-center justify-center [&>svg]:h-3.5 [&>svg]:w-3.5';

function Action({ icon, label, onClick, tone }: { icon: ReactNode; label: string; onClick?: () => void; tone?: 'danger' }) {
    return (
        <button type="button" onClick={onClick} className={cn(ACTION, tone === 'danger' && 'hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-300')}>
            <span className={ACTION_ICON}>{icon}</span>
            <span className="truncate">{label}</span>
        </button>
    );
}

interface WalletProfileProps {
    totalValue: number;
    loading: boolean;
    /** The user asked for a refresh and it has not come back yet. */
    busy: boolean;
    onRefresh: () => void;
    balanceVisible: boolean;
    onBalanceVisibleChange: (visible: boolean) => void;
}

export function WalletProfile({ totalValue, loading, busy, onRefresh, balanceVisible, onBalanceVisibleChange }: WalletProfileProps) {
    const wdk = useWDK();
    const ext = useExternalBCHWallet();
    const { wallets, active, setActive } = useWallets();
    const pendingSign = usePendingSign();
    const [expanded, setExpanded] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const isMainnet = wdk.bchNetwork === 'mainnet';
    const closeEdit = useCallback(() => setEditingId(null), []);
    const listRef = useRef<HTMLDivElement>(null);
    const toggleRef = useRef<HTMLButtonElement>(null);

    // The wallet list is a dropdown: a pointer down anywhere else — another part of the wallet, or outside it —
    // folds it away. (The whole profile unmounts when the wallet closes, so reopening always starts folded.)
    useEffect(() => {
        if (!expanded) return;
        const onDown = (e: PointerEvent) => {
            const t = e.target as Node;
            if (listRef.current?.contains(t) || toggleRef.current?.contains(t)) return;
            setExpanded(false);
        };
        document.addEventListener('pointerdown', onDown);
        return () => document.removeEventListener('pointerdown', onDown);
    }, [expanded]);

    // Cham reacts for a moment (a copy, a switch), then goes back to what the card is showing.
    const [flash, setFlash] = useState<ChamMood | null>(null);
    const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const react = (mood: ChamMood) => {
        clearTimeout(flashTimer.current);
        setFlash(mood);
        flashTimer.current = setTimeout(() => setFlash(null), 1100);
    };
    useEffect(() => () => clearTimeout(flashTimer.current), []);
    const mood: ChamMood = flash ?? (!balanceVisible ? 'shy' : busy || loading ? 'busy' : 'idle');

    const color = active?.color ?? BRAND;
    const mainLocked = !wdk.isInitialized && wdk.hasStoredWallet;
    const externals = ext.wallets.length;

    const copyActive = () => {
        if (!active) return;
        navigator.clipboard.writeText(active.address);
        toast.success('Address copied');
        react('happy');
    };

    const pick = (id: string) => {
        if (id === active?.id) return;
        if (pendingSign && pendingSign.walletId === active?.id) {
            const ok = typeof window !== 'undefined' ? window.confirm(`Cancel the request open in ${pendingSign.walletLabel}?`) : true;
            if (!ok) return;
            pendingSign.cancel('Switched wallet');
        }
        setActive(id);
        react('happy');
    };

    const logOut = () => {
        const hadMain = wdk.isInitialized;
        if (hadMain) wdk.disconnect();
        if (externals > 0) ext.disconnectAll();
        toast.success(hadMain && externals === 0 ? 'Wallet locked' : 'Wallets disconnected');
        walletUi.closeWallet();
    };

    return (
        <section
            aria-label="Wallet profile"
            data-wallet-profile
            className="lg-card shrink-0 rounded-none border-x-0 border-t-0 transition-[background,box-shadow] duration-500"
            style={{ '--lg-tint': color } as CSSProperties}
        >
            <div className="px-3 pb-2 pt-2.5 sm:px-4">
                {/* ── identity + network ── */}
                <div className="flex items-center justify-between gap-2">
                    {active ? (
                        <div className="flex min-w-0 items-center gap-2.5">
                            <button
                                ref={toggleRef}
                                type="button"
                                onClick={() => setExpanded(v => !v)}
                                aria-expanded={expanded}
                                aria-controls="wallet-profile-list"
                                title="Your wallets"
                                className="flex min-w-0 items-center gap-2.5 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                            >
                                <WalletIcon id={active.iconId} color={active.color} size={34} active />
                                <span className="min-w-0">
                                    <span className="flex items-center gap-1">
                                        <span className="truncate text-sm font-bold leading-tight text-white">{active.name}</span>
                                        {wallets.length > 1 && (
                                            <span className="shrink-0 rounded-full bg-white/[0.1] px-1.5 text-[9px] font-bold tabular-nums text-white/70">{wallets.length}</span>
                                        )}
                                        <ChevronDown className={cn('h-4 w-4 shrink-0 text-white/50 transition-transform duration-200', expanded && 'rotate-180')} />
                                    </span>
                                    <span className="block text-[9px] font-semibold uppercase tracking-wider" style={{ color }}>{KIND_LABEL[active.kind]}</span>
                                </span>
                            </button>
                        </div>
                    ) : (
                        <div className="min-w-0">
                            <div className="text-[15px] font-bold text-white">No wallet connected</div>
                            <div className="mt-0.5 text-[11px] text-white/50">Add one to see balances and trade.</div>
                        </div>
                    )}
                    <NetworkSwitch />
                </div>

                {/* ── balance, with Cham on its branch ── */}
                <div className="mt-2 flex items-end justify-between gap-2">
                    <div className="min-w-0">
                        <div className="flex items-center gap-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                                {active && active.kind !== 'main' ? 'Wallet balance' : 'Total balance'}
                            </span>
                            <button type="button" onClick={() => onBalanceVisibleChange(!balanceVisible)}
                                title={balanceVisible ? 'Hide balances' : 'Show balances'} aria-label={balanceVisible ? 'Hide balances' : 'Show balances'} aria-pressed={!balanceVisible}
                                className="flex h-6 w-6 items-center justify-center rounded-md text-white/40 hover:bg-white/[0.06] hover:text-white">
                                {balanceVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                            </button>
                            <button type="button" onClick={onRefresh} disabled={busy} title="Refresh" aria-label="Refresh balances"
                                className="flex h-6 w-6 items-center justify-center rounded-md text-white/40 hover:bg-white/[0.06] hover:text-white disabled:opacity-60">
                                <RefreshCw className={cn('h-3.5 w-3.5', busy && 'animate-spin')} />
                            </button>
                        </div>
                        <div className="truncate text-2xl font-bold leading-tight tracking-tight text-white tabular-nums sm:text-[28px]" data-wallet-total>
                            {!balanceVisible
                                ? '••••••'
                                : loading
                                    ? <span className="inline-block h-6 w-28 rounded-md bg-white/[0.08] align-middle animate-pulse" />
                                    : `$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        </div>
                    {active && (
                        <div className="mt-1.5 flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={copyActive}
                                title="Copy address"
                                className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-white/[0.08] bg-black/20 py-0.5 pl-2 pr-1.5 font-mono text-[10px] text-white/60 transition-colors hover:border-white/20 hover:text-white"
                            >
                                <span className="truncate">{shortAddress(active.address, 10, 8)}</span>
                                <Copy className="h-3 w-3 shrink-0" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setEditingId(active.id)}
                                title="Edit colour and name"
                                aria-label={`Edit ${active.name}`}
                                data-wallet-edit
                                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/[0.08] bg-black/20 px-2 py-0.5 text-[10px] font-semibold text-white/60 transition-colors hover:border-white/20 hover:text-white"
                            >
                                <Pencil className="h-3 w-3" /> Edit
                            </button>
                        </div>
                    )}
                    </div>
                    <Chameleon size={76} tone={color} mood={mood} className="shrink-0 text-white/40" />
                </div>
            </div>

            {/* ── actions ── */}
            <div className="flex items-stretch gap-1.5 px-3 pb-2.5 sm:px-4">
                {wdk.isInitialized ? (
                    <>
                        <SendModal>
                            <button type="button" className={ACTION}>
                                <span className={ACTION_ICON}><ArrowUpRight className="h-4 w-4" /></span>
                                Send
                            </button>
                        </SendModal>
                        <ReceiveModal>
                            <button type="button" className={ACTION}>
                                <span className={ACTION_ICON}><ArrowDownLeft className="h-4 w-4" /></span>
                                Receive
                            </button>
                        </ReceiveModal>
                    </>
                ) : (
                    <Action
                        icon={<KeyRound className="h-4 w-4" />}
                        label={mainLocked ? 'Unlock Cham' : 'Cham Wallet'}
                        onClick={() => walletUi.openOnboarding()}
                    />
                )}
                <Action icon={<Plus className="h-4 w-4" />} label="Add" onClick={() => walletUi.openConnect()} />
                {active && (
                    <Action
                        tone="danger"
                        icon={externals > 0 || !wdk.hasStoredWallet ? <LogOut className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                        label={externals > 0 || !wdk.hasStoredWallet ? 'Log out' : 'Lock'}
                        onClick={logOut}
                    />
                )}
            </div>

            {/* ── wallets ── */}
            {expanded && (
                <div ref={listRef} id="wallet-profile-list" className="border-t border-white/[0.07] p-2 animate-in fade-in-50 slide-in-from-top-1 duration-200">
                    <div className="flex items-center justify-between px-1.5 pb-1.5 pt-0.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Wallets · {wallets.length}</span>
                        <span className="text-[10px] text-white/35">Tap one to make it active</span>
                    </div>
                    <ul className="max-h-[200px] space-y-1 overflow-y-auto lg-scroll">
                        {wallets.map(w => (
                            <WalletRow key={w.id} wallet={w} isMainnet={isMainnet} hidden={!balanceVisible} onPick={() => pick(w.id)} onEdit={() => setEditingId(w.id)} isPending={pendingSign?.walletId === w.id} />
                        ))}
                        {mainLocked && (
                            <li>
                                <button type="button" onClick={() => walletUi.openOnboarding()}
                                    className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left hover:bg-white/[0.03]">
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] border border-white/[0.08] bg-white/[0.04] text-white/40"><Lock className="h-4 w-4" /></span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-[13px] font-bold text-white/70">Cham Wallet</span>
                                        <span className="block text-[10px] text-white/40">Locked on this device</span>
                                    </span>
                                    <span className="rounded-full border border-white/[0.1] bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold text-white">Unlock</span>
                                </button>
                            </li>
                        )}
                    </ul>
                    <button type="button" onClick={() => walletUi.openConnect()}
                        className="mt-1.5 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/[0.16] text-[11px] font-semibold text-white/70 transition-colors hover:border-white/30 hover:bg-white/[0.05] hover:text-white">
                        <Plus className="h-3.5 w-3.5" /> Add a wallet
                    </button>
                </div>
            )}

            <WalletEditCard walletId={editingId} onClose={closeEdit} />
        </section>
    );
}
