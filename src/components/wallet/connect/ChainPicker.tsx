/**
 * ChainPicker — Step 2 of Connect flow.
 *
 * Lets the user select the chain family:
 * - Bitcoin Cash: moves to Step 3 (QR / protocol selection).
 * - EVM / Solana / Bitcoin: disabled with "Coming soon" badge until P6-P8.
 *
 * Phase 2: The connect screen
 */

import { ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChainFamily, AppNetwork } from '@/lib/wallets/types';
import { useWDK } from '@/context/WDKProvider';
import { appNetworkOf } from '@/lib/wallets/types';

interface ChainPickerProps {
    onBack: () => void;
    onPickChain: (family: ChainFamily) => void;
}

interface ChainOption {
    family: ChainFamily;
    name: string;
    description: string;
    icon: string;
    accent: string;
    available: boolean;
}

const CHAINS: ChainOption[] = [
    {
        family: 'bch',
        name: 'Bitcoin Cash',
        description: 'Paytaca, Cashonize, Zapit',
        icon: 'bch',
        accent: '#10b981',
        available: true,
    },
    {
        family: 'evm',
        name: 'Ethereum & EVM',
        description: 'MetaMask, Rabby, Coinbase and mobile wallets · Ethereum, Base, Arbitrum, Optimism, Arc, BNB',
        icon: 'eth',
        accent: '#6366f1',
        available: true,
    },
    {
        family: 'solana',
        name: 'Solana',
        description: 'Phantom, Solflare, Backpack and mobile wallets',
        icon: 'solana',
        accent: '#a855f7',
        available: true,
    },
    {
        family: 'btc',
        name: 'Bitcoin',
        description: 'Xverse, Leather, OKX, Phantom',
        icon: 'btc',
        accent: '#f59e0b',
        available: false,
    },
];

const OPTION_CARD = 'group flex w-full items-center gap-3 rounded-xl p-3 text-left transition-all duration-200 lg-well hover:border-white/[0.16] hover:bg-white/[0.06] active:scale-[0.99]';
const TAG = 'rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider';

export function ChainPicker({ onBack, onPickChain }: ChainPickerProps) {
    const { bchNetwork } = useWDK();
    const appNetwork: AppNetwork = appNetworkOf(bchNetwork);

    return (
        <div className="space-y-4" data-connect-step="chain">
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={onBack}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/60 transition-colors hover:border-white/20 hover:text-white"
                    aria-label="Back to wallet selection"
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>
                <div>
                    <h3 className="text-base font-semibold text-white">Which chain?</h3>
                    <p className="text-xs text-white/50">Pick the network your wallet connects to</p>
                </div>
            </div>

            <div className="space-y-2">
                {CHAINS.map((chain) => (
                    <button
                        key={chain.family}
                        type="button"
                        onClick={() => chain.available && onPickChain(chain.family)}
                        disabled={!chain.available}
                        className={cn(
                            OPTION_CARD,
                            !chain.available && 'opacity-60 cursor-not-allowed hover:border-white/[0.08] hover:bg-transparent active:scale-100'
                        )}
                    >
                        <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-xs ring-1 ring-white/10"
                            style={{ backgroundColor: `${chain.accent}15`, color: chain.accent }}
                        >
                            {chain.name.slice(0, 3).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-white">{chain.name}</span>
                                {!chain.available && (
                                    <span className={cn(TAG, 'border-white/10 bg-white/[0.04] text-white/40')}>
                                        Coming soon
                                    </span>
                                )}
                            </div>
                            <p className="mt-0.5 truncate text-[11px] text-white/50">
                                {chain.description}
                            </p>
                        </div>
                        {chain.available && (
                            <ChevronRight className="h-4 w-4 shrink-0 text-white/30 transition-transform group-hover:translate-x-0.5 group-hover:text-white/60" />
                        )}
                    </button>
                ))}
            </div>

            {/* Network mode note */}
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] text-white/45">
                <Info className="h-4 w-4 shrink-0 text-white/40" />
                <span>
                    {appNetwork === 'testnet'
                        ? 'Testnet mode: your wallet must be on chipnet / Sepolia / devnet / BTC testnet.'
                        : 'Mainnet mode: your wallet must be on mainnet.'}
                </span>
            </div>
        </div>
    );
}
