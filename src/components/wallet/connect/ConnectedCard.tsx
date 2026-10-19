/**
 * ConnectedCard — Step 4 of Connect flow.
 *
 * Shows the newly connected wallet details:
 * - Name and icon from the wallet session
 * - Address (shortened)
 * - "Now the active <chain> wallet" indicator
 * - Protocol note:
 *   - WizardConnect: "Cham uses this wallet's first address."
 *   - WalletConnect: "Only this one address is used."
 * - Look editor: colour swatches & custom name
 * - "Done" button to finish and close the connect view
 *
 * Phase 2: The connect screen
 */

import { Check, ShieldCheck, ExternalLink } from 'lucide-react';
import { useWallets, shortAddress, ConnectedWallet } from '@/hooks/useWallets';
import { ExternalWallet } from '@/lib/wallets/types';
import { defaultWalletColor } from '@/lib/walletStore';
import { WalletIcon, WalletGlyph } from '../WalletIcon';
import { WalletLookEditor } from '../WalletLookEditor';
import { addressSet as wizAddressSet } from '@/lib/wallets/wizardconnect';

interface ConnectedCardProps {
    wallet: ExternalWallet;
    onDone: () => void;
}

const CHAIN_NAMES: Record<string, string> = {
    bch: 'Bitcoin Cash',
    evm: 'Ethereum & EVM',
    solana: 'Solana',
    btc: 'Bitcoin',
};

export function ConnectedCard({ wallet, onDone }: ConnectedCardProps) {
    const { wallets } = useWallets();

    // Find the ConnectedWallet shape or fall back to sensible defaults
    const found = wallets.find(w => w.id === wallet.id);
    const connectedWallet: ConnectedWallet = found || {
        id: wallet.id,
        family: wallet.family,
        kind: wallet.source as any,
        iconId: wallet.source === 'wizardconnect' ? 'paytaca' : 'walletconnect',
        iconUrl: wallet.icon,
        name: wallet.label,
        address: wallet.address,
        color: defaultWalletColor(wallet.address),
        active: true,
        lookKey: wallet.address,
    };

    const chainName = CHAIN_NAMES[wallet.family] || wallet.family.toUpperCase();

    return (
        <div className="space-y-4" data-connect-step="connected">
            {/* Success banner */}
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.08] p-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30">
                    <Check className="h-5 w-5" strokeWidth={2.5} />
                </div>
                <div>
                    <h3 className="text-sm font-semibold text-white">Connected successfully</h3>
                    <p className="text-xs text-emerald-300/90">
                        Now the active {chainName} wallet
                    </p>
                </div>
            </div>

            {/* Wallet summary row */}
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <WalletIcon
                    src={connectedWallet.iconUrl}
                    iconId={connectedWallet.iconId}
                    color={connectedWallet.color}
                    className="h-10 w-10 shrink-0 text-white"
                />
                <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-white truncate">
                        {connectedWallet.name}
                    </div>
                    <div className="font-mono text-[11px] text-white/50 truncate">
                        {shortAddress(connectedWallet.address)}
                    </div>
                </div>
                <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                    Active
                </div>
            </div>

            {/* Protocol notes */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] text-white/50">
                {wallet.source === 'wizardconnect' ? (
                    <span>Cham scans and uses all {wizAddressSet(wallet.id).length} addresses in this HD wallet.</span>
                ) : wallet.source === 'walletconnect' ? (
                    <span>Only this one address is used.</span>
                ) : (
                    <span>Connected via browser extension.</span>
                )}
            </div>

            {/* Look editor (Colour swatches and custom rename) */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
                <WalletLookEditor wallet={connectedWallet} />
            </div>

            {/* Done button */}
            <button
                type="button"
                onClick={onDone}
                className="flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-xs font-semibold text-[#050505] shadow-lg shadow-emerald-500/20 transition-all hover:brightness-110 active:scale-[0.99]"
            >
                Done
            </button>
        </div>
    );
}
