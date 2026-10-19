/**
 * A wallet's colour and name: the swatches and the name field, and the pop-up card
 * that holds them for a wallet that is already connected.
 *
 * The same editor is shown right after a wallet is added (ConnectWalletView), so a
 * wallet gets its colour when it arrives. Looks are stored per address
 * (lib/walletStore.ts), so they come back when the wallet is reconnected.
 */

import { useEffect, useState } from 'react';
import { Check, Lock, Unplug, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useWDK } from '@/context/WDKProvider';
import { useExternalBCHWallet } from '@/context/ExternalBCHWalletProvider';
import { useWallets, shortAddress, type ConnectedWallet } from '@/hooks/useWallets';
import { WALLET_COLORS, forgetLook } from '@/lib/walletStore';
import { ActivityService } from '@/lib/activity';
import { forgetWalletNotifications } from '@/lib/notifications';
import { forgetWalletOrders } from '@/context/BCHSwapContext';
import { notifyToast as toast } from '@/lib/notify-toast';
import { cn } from '@/lib/utils';
import { WalletGlyph } from './WalletIcon';

/** Swatches and a name field. Colour is saved as it is picked; the name when the field is left or Enter is pressed. */
export function WalletLookEditor({ wallet, className }: { wallet: ConnectedWallet; className?: string }) {
    const { setColor, rename } = useWallets();
    const [name, setName] = useState(wallet.name);
    useEffect(() => { setName(wallet.name); }, [wallet.name]);
    const save = () => { if (name.trim() !== wallet.name) rename(wallet, name); };

    return (
        <div className={cn('space-y-3', className)}>
            <div>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">Colour</div>
                <div role="radiogroup" aria-label="Wallet colour" className="flex flex-wrap items-center gap-2">
                    {WALLET_COLORS.map(c => {
                        const selected = wallet.color === c.hex;
                        return (
                            <button
                                key={c.id}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                aria-label={c.id}
                                title={c.id}
                                onClick={() => setColor(wallet, c.hex)}
                                className="flex h-8 w-8 items-center justify-center rounded-full transition-transform duration-150 hover:scale-110 active:scale-95"
                                style={{ background: c.hex, boxShadow: selected ? `0 0 0 2px #101014, 0 0 0 4px ${c.hex}` : 'inset 0 1px 0 rgba(255,255,255,0.35)' }}
                            >
                                {selected && <Check className="h-4 w-4 text-[#050505]" strokeWidth={3} />}
                            </button>
                        );
                    })}
                </div>
            </div>
            <div>
                <label htmlFor={`wallet-name-${wallet.id}`} className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-white/40">Name</label>
                <input
                    id={`wallet-name-${wallet.id}`}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onBlur={save}
                    onKeyDown={e => { if (e.key === 'Enter') { save(); (e.target as HTMLInputElement).blur(); } }}
                    maxLength={24}
                    placeholder="Wallet name"
                    className="lg-well h-10 w-full rounded-xl px-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/25"
                />
            </div>
        </div>
    );
}

/** The edit card: the wallet as it will look, its colour and name, and the way to remove it. */
export function WalletEditCard({ walletId, onClose }: { walletId: string | null; onClose: () => void }) {
    const wdk = useWDK();
    const ext = useExternalBCHWallet();
    const { wallets } = useWallets();
    const wallet = wallets.find(w => w.id === walletId) ?? null;
    const [confirmForget, setConfirmForget] = useState(false);

    // The wallet went away (disconnected elsewhere): nothing left to edit.
    useEffect(() => { if (walletId && !wallet) onClose(); }, [walletId, wallet, onClose]);
    useEffect(() => { setConfirmForget(false); }, [walletId]);

    const remove = () => {
        if (!wallet) return;
        if (wallet.kind === 'main') {
            wdk.disconnect();
            toast.success('Cham Wallet locked');
        } else {
            ext.disconnectWallet(wallet.id);
            toast.success(`${wallet.name} disconnected. Its history comes back if you connect it again.`);
        }
        onClose();
    };

    const forget = () => {
        if (!wallet) return;
        const { id, address, family, lookKey, name } = wallet;
        ext.disconnectWallet(id);
        forgetLook(lookKey);
        ActivityService.forgetWallet(address, family);
        forgetWalletNotifications(address, family);
        forgetWalletOrders(address);
        try {
            localStorage.removeItem(`wizardconnect-${id}`);
        } catch { /* ignore */ }
        toast.success(`${name} forgotten`);
        onClose();
    };

    return (
        <Dialog open={!!wallet} onOpenChange={o => { if (!o) onClose(); }}>
            <DialogContent className="lg-panel w-[calc(100%-24px)] max-w-[380px] gap-4 rounded-xl p-5 sm:rounded-xl">
                {wallet && (
                    <>
                        <div className="flex items-center gap-3 pr-8">
                            <WalletGlyph color={wallet.color} size={48} />
                            <div className="min-w-0">
                                <DialogTitle className="truncate text-base font-bold text-white">{wallet.name}</DialogTitle>
                                <DialogDescription className="truncate font-mono text-[11px] text-white/45">{shortAddress(wallet.address, 10, 8)}</DialogDescription>
                            </div>
                        </div>
                        <WalletLookEditor wallet={wallet} />
                        {confirmForget ? (
                            <div className="rounded-xl border border-red-500/30 bg-red-500/[0.08] p-3 text-xs">
                                <p className="font-semibold text-red-300">Forget this wallet?</p>
                                <p className="mt-1 text-[11px] text-white/60">
                                    This disconnects the wallet and permanently deletes its activity records, notifications, and orders from this device.
                                </p>
                                <div className="mt-3 flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setConfirmForget(false)}
                                        className="h-9 flex-1 rounded-lg border border-white/10 bg-white/5 text-xs font-semibold text-white/70 transition-colors hover:bg-white/10"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={forget}
                                        className="h-9 flex-1 rounded-lg bg-red-500 text-xs font-semibold text-white transition-colors hover:bg-red-600"
                                    >
                                        Forget
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex gap-2">
                                    <button type="button" onClick={remove}
                                        className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/[0.06] text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/15">
                                        {wallet.kind === 'main' ? <><Lock className="h-3.5 w-3.5" /> Lock</> : <><Unplug className="h-3.5 w-3.5" /> Disconnect</>}
                                    </button>
                                    <button type="button" onClick={onClose}
                                        className="h-11 flex-1 rounded-xl text-xs font-bold text-[#050505] transition-transform active:scale-[0.98]"
                                        style={{ background: wallet.color }}>
                                        Done
                                    </button>
                                </div>
                                {wallet.kind !== 'main' && (
                                    <div className="flex justify-center pt-1">
                                        <button
                                            type="button"
                                            onClick={() => setConfirmForget(true)}
                                            className="flex items-center gap-1 text-[11px] font-medium text-white/35 transition-colors hover:text-red-400"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                            Forget this wallet
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
