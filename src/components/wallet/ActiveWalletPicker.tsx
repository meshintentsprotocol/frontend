/**
 * ActiveWalletPicker — a compact switch between connected BCH wallets, for
 * places where the choice matters right there (the swap card).
 *
 * It reads and writes the same shared state as the header's WalletSwitcher, so
 * the two always agree. Renders nothing while only one wallet is connected.
 */

import { Check, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useWallets, shortAddress } from '@/hooks/useWallets';
import { WalletIcon } from './WalletIcon';

export function ActiveWalletPicker({ className }: { className?: string }) {
    const { wallets, active, setActive } = useWallets();
    if (wallets.length < 2 || !active) return null;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    title="Active BCH wallet"
                    className={cn(
                        'flex items-center gap-1.5 h-7 pl-1 pr-2 rounded-lg text-xs font-bold transition-all border bg-white/[0.04] hover:bg-white/[0.07]',
                        className,
                    )}
                    style={{ color: active.color, borderColor: `${active.color}55` }}
                >
                    <WalletIcon id={active.iconId} color={active.color} size={18} />
                    <span className="truncate max-w-[80px]">{active.name}</span>
                    <ChevronDown className="h-3 w-3 opacity-50" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-60 bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-2 text-xs">
                <div className="space-y-1">
                    <p className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-white/40 font-semibold">Active BCH Wallet</p>
                    {wallets.map(w => (
                        <button
                            key={w.id}
                            type="button"
                            onClick={() => setActive(w.id)}
                            aria-pressed={w.active}
                            className={cn(
                                'w-full flex items-center gap-2 px-2 py-2 rounded-xl transition-colors text-left',
                                w.active ? 'bg-white/[0.06]' : 'hover:bg-white/[0.06]',
                            )}
                        >
                            <WalletIcon id={w.iconId} color={w.color} size={24} />
                            <span className="flex-1 min-w-0">
                                <span className="block truncate font-semibold" style={{ color: w.active ? w.color : undefined }}>{w.name}</span>
                                <span className="block text-[10px] opacity-60 font-mono">{shortAddress(w.address, 6, 4)}</span>
                            </span>
                            {w.active && <Check className="h-3.5 w-3.5 shrink-0" style={{ color: w.color }} />}
                        </button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}
