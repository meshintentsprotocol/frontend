/**
 * WalletSwitcher — the wallet "profile" in the header.
 *
 * Shows the active BCH wallet (icon, colour, name, address) and opens a menu
 * listing every connected wallet with its BCH balance. Choosing one switches
 * the active wallet for the whole app (lib/walletStore.ts). Each wallet can be
 * given a colour and a name so it is easy to tell apart, and removed.
 */

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Copy, Lock, Palette, Plus, Unplug, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWDK } from '@/context/WDKProvider';
import { useExternalBCHWallet } from '@/context/ExternalBCHWalletProvider';
import { useBchAddressBalance } from '@/hooks/useBchAddressBalance';
import { useWallets, shortAddress, type ConnectedWallet } from '@/hooks/useWallets';
import { WALLET_COLORS } from '@/lib/walletStore';
import { notifyToast as toast } from '@/lib/notify-toast';
import { WalletIcon } from './WalletIcon';

const KIND_LABEL: Record<ConnectedWallet['kind'], string> = {
    main: 'Built-in',
    walletconnect: 'WalletConnect',
    wizardconnect: 'WizardConnect',
    extension: 'Extension',
};

function WalletBalance({ address, isMainnet, live }: { address: string; isMainnet: boolean; live: boolean }) {
    const { data, isLoading, isError } = useBchAddressBalance({ address, isMainnet, refetchMs: live ? 20_000 : 0 });
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

function WalletRow({ wallet, isMainnet, open, onPick, onClose }: {
    wallet: ConnectedWallet; isMainnet: boolean; open: boolean; onPick: () => void; onClose: () => void;
}) {
    const wdk = useWDK();
    const ext = useExternalBCHWallet();
    const { setColor, rename } = useWallets();
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(wallet.name);

    useEffect(() => { if (!open) setEditing(false); }, [open]);
    useEffect(() => { setName(wallet.name); }, [wallet.name]);

    const copy = () => {
        navigator.clipboard.writeText(wallet.address);
        toast.success('Address copied');
    };

    const remove = () => {
        if (wallet.kind === 'main') {
            wdk.disconnect();
            toast.success('Main wallet locked');
        } else {
            ext.disconnectWallet(wallet.id);
            toast.success(`${wallet.name} disconnected`);
        }
        onClose();
    };

    return (
        <div
            className={cn(
                'rounded-xl border transition-colors',
                wallet.active ? 'bg-white/[0.05]' : 'border-transparent hover:bg-white/[0.03]',
            )}
            style={wallet.active ? { borderColor: `${wallet.color}55` } : undefined}
        >
            <div className="flex items-center gap-2.5 p-2">
                <button
                    type="button"
                    onClick={onPick}
                    className="flex flex-1 min-w-0 items-center gap-2.5 text-left"
                    aria-pressed={wallet.active}
                >
                    <WalletIcon id={wallet.iconId} color={wallet.color} size={36} active={wallet.active} />
                    <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-1.5">
                            <span className="truncate text-[13px] font-bold text-white">{wallet.name}</span>
                            <span className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.03] px-1.5 py-px text-[8.5px] font-bold uppercase tracking-wider text-white/40">
                                {KIND_LABEL[wallet.kind]}
                            </span>
                        </span>
                        <span className="mt-0.5 flex items-center justify-between gap-2">
                            <span className="truncate font-mono text-[10px] text-white/40">{shortAddress(wallet.address, 8, 6)}</span>
                            <WalletBalance address={wallet.address} isMainnet={isMainnet} live={open} />
                        </span>
                    </span>
                </button>
                <div className="flex shrink-0 items-center">
                    {wallet.active && <Check className="mr-1 h-3.5 w-3.5" style={{ color: wallet.color }} />}
                    <button type="button" onClick={copy} title="Copy address" aria-label="Copy address"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-white/35 hover:bg-white/[0.06] hover:text-white">
                        <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => setEditing(v => !v)} title="Colour and name" aria-label="Colour and name" aria-expanded={editing}
                        className={cn('flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white/[0.06] hover:text-white', editing ? 'bg-white/[0.06] text-white' : 'text-white/35')}>
                        <Palette className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {editing && (
                <div className="space-y-2.5 border-t border-white/[0.06] px-2.5 pb-2.5 pt-2">
                    <div className="flex items-center gap-1.5">
                        {WALLET_COLORS.map(c => (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => setColor(wallet, c.hex)}
                                title={c.id}
                                aria-label={`Colour ${c.id}`}
                                aria-pressed={wallet.color === c.hex}
                                className="h-6 w-6 rounded-full transition-transform hover:scale-110"
                                style={{
                                    background: c.hex,
                                    boxShadow: wallet.color === c.hex ? `0 0 0 2px #0A0A0A, 0 0 0 4px ${c.hex}` : undefined,
                                }}
                            />
                        ))}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { rename(wallet, name); setEditing(false); } }}
                            maxLength={24}
                            placeholder="Wallet name"
                            aria-label="Wallet name"
                            className="h-8 min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 text-xs text-white outline-none placeholder:text-white/25 focus:border-white/25"
                        />
                        <button type="button" onClick={() => { rename(wallet, name); setEditing(false); }}
                            className="h-8 rounded-lg border border-white/[0.1] bg-white/[0.06] px-3 text-[11px] font-semibold text-white hover:bg-white/[0.1]">
                            Save
                        </button>
                    </div>
                    <button type="button" onClick={remove}
                        className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg text-[11px] font-semibold text-red-400/80 hover:bg-red-500/10 hover:text-red-400">
                        {wallet.kind === 'main' ? <><Lock className="h-3.5 w-3.5" /> Lock main wallet</> : <><Unplug className="h-3.5 w-3.5" /> Disconnect</>}
                    </button>
                </div>
            )}
        </div>
    );
}

export function WalletSwitcher({ onAddWallet, onOpenWallet }: {
    /** Opens the connect flow. */
    onAddWallet: () => void;
    /** Opens the wallet panel (balances, orders, history, settings). */
    onOpenWallet: () => void;
}) {
    const { bchNetwork } = useWDK();
    const { wallets, active, setActive } = useWallets();
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const isMainnet = bchNetwork === 'mainnet';

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    if (!active) return null;

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                aria-haspopup="menu"
                aria-expanded={open}
                title={`${active.name} · ${shortAddress(active.address, 6, 4)}`}
                data-wallet-profile
                className="group inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-white/15 bg-[#111111] pl-1.5 pr-2 shadow-[0_0_0_1px_rgba(255,255,255,0.05)_inset,0_4px_16px_-6px_rgba(0,0,0,0.8)] transition-all duration-300 hover:border-white/25 hover:bg-[#181818]"
            >
                <WalletIcon id={active.iconId} color={active.color} size={28} />
                <span className="hidden min-w-0 flex-col items-start leading-tight 2xl:flex">
                    <span className="max-w-[110px] truncate text-[11px] font-bold text-white">{active.name}</span>
                    <span className="font-mono text-[9.5px] text-white/40">{shortAddress(active.address, 5, 4)}</span>
                </span>
                {wallets.length > 1 && (
                    <span className="hidden rounded-full bg-white/[0.07] px-1.5 text-[9px] font-bold tabular-nums text-white/60 sm:inline">{wallets.length}</span>
                )}
                <ChevronDown className={cn('h-3.5 w-3.5 text-white/40 transition-transform duration-200', open && 'rotate-180')} />
            </button>

            {open && (
                <div
                    role="menu"
                    className="fixed inset-x-3 top-[76px] z-[110] flex max-h-[calc(100vh-96px)] flex-col rounded-2xl border border-white/[0.08] bg-[#0A0A0A]/95 shadow-2xl shadow-black/60 backdrop-blur-2xl animate-in fade-in slide-in-from-top-2 duration-200 sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[340px]"
                >
                    <div className="flex items-center justify-between px-3.5 pb-1.5 pt-3">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                            Wallets · {wallets.length}
                        </span>
                        <span className="flex items-center gap-1.5 text-[10px] font-semibold text-white/40">
                            <span className={cn('h-1.5 w-1.5 rounded-full', isMainnet ? 'bg-emerald-400' : 'bg-amber-400')} />
                            {isMainnet ? 'Mainnet' : 'Chipnet'}
                        </span>
                    </div>

                    <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-2" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
                        {wallets.map(w => (
                            <WalletRow key={w.id} wallet={w} isMainnet={isMainnet} open={open} onPick={() => setActive(w.id)} onClose={() => setOpen(false)} />
                        ))}
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 border-t border-white/[0.06] p-2">
                        <button type="button" onClick={() => { setOpen(false); onAddWallet(); }}
                            className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/[0.15] text-[11px] font-semibold text-white/70 transition-colors hover:border-white/30 hover:bg-white/[0.05] hover:text-white">
                            <Plus className="h-3.5 w-3.5" /> Add wallet
                        </button>
                        <button type="button" onClick={() => { setOpen(false); onOpenWallet(); }}
                            className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-white/[0.1] bg-white/[0.06] text-[11px] font-semibold text-white transition-colors hover:bg-white/[0.1]">
                            <Wallet className="h-3.5 w-3.5" /> Open wallet
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
