import { useState, useMemo, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useWDK } from '@/context/WDKProvider';
import { ArrowDownLeft, Check, Copy, ExternalLink } from 'lucide-react';
import { notifyToast as toast } from '@/lib/notify-toast';
import { cn } from '@/lib/utils';
import { Chameleon, type ChamMood } from '@/components/wallet/Chameleon';

// ============================================================================
// Receive — pick a network, show its QR and address. One EVM address serves
// every EVM chain, so it is listed once.
// ============================================================================

interface ReceiveChain {
    key: string;
    label: string;
    sublabel: string;
    address: string;
    icon: string | null;
    color: string;
    explorerUrl?: string;
}

export function ReceiveModal({ children }: { children?: React.ReactNode }) {
    const wdk = useWDK();
    const isMainnet = wdk.bchNetwork === 'mainnet';
    const [copied, setCopied] = useState(false);
    const [mood, setMood] = useState<ChamMood>('idle');

    const chains = useMemo<ReceiveChain[]>(() => ([
        wdk.bchAddress && {
            key: 'bch', label: 'Bitcoin Cash', sublabel: isMainnet ? 'Mainnet · BCH, CashTokens' : 'Chipnet · BCH, CashTokens',
            address: wdk.bchAddress, icon: '/logos/bitcoin-cash-bch-logo.svg', color: '#0ac18e',
            explorerUrl: isMainnet ? `https://blockchair.com/bitcoin-cash/address/${wdk.bchAddress}` : `https://chipnet.imaginary.cash/address/${wdk.bchAddress}`,
        },
        wdk.evmAddress && {
            key: 'evm', label: 'EVM', sublabel: isMainnet ? 'Ethereum, Base, Arbitrum, Optimism, BNB' : 'Sepolia, Base, Arbitrum, Optimism',
            address: wdk.evmAddress, icon: '/logos/ethereum-eth-logo.svg', color: '#627eea',
            explorerUrl: isMainnet ? `https://etherscan.io/address/${wdk.evmAddress}` : `https://sepolia.etherscan.io/address/${wdk.evmAddress}`,
        },
        wdk.solanaAddress && {
            key: 'sol', label: 'Solana', sublabel: 'Devnet · SOL, SPL tokens',
            address: wdk.solanaAddress, icon: '/assets/solanaLogo.png', color: '#9945ff',
            explorerUrl: `https://solscan.io/account/${wdk.solanaAddress}?cluster=devnet`,
        },
        wdk.movementAddress && {
            key: 'move', label: 'Movement', sublabel: isMainnet ? 'Mainnet · MOVE, tokens' : 'Bardock Testnet · MOVE, USDC, USDT',
            address: wdk.movementAddress, icon: '/logos/movement.svg', color: '#f7b500',
            explorerUrl: `https://explorer.movementnetwork.xyz/account/${wdk.movementAddress}?network=testnet`,
        },
        wdk.btcAddress && {
            key: 'btc', label: 'Bitcoin', sublabel: 'Testnet', address: wdk.btcAddress, icon: '/logos/bitcoin-btc-logo.svg', color: '#f7931a',
        },
    ] as (ReceiveChain | false)[]).filter(Boolean) as ReceiveChain[], [wdk.bchAddress, wdk.evmAddress, wdk.solanaAddress, wdk.movementAddress, wdk.btcAddress, isMainnet]);

    const [selected, setSelected] = useState<string | null>(null);
    const active = chains.find(c => c.key === selected) ?? chains[0];
    useEffect(() => { if (chains.length && !chains.some(c => c.key === selected)) setSelected(chains[0].key); }, [chains, selected]);

    const copy = () => {
        if (!active) return;
        navigator.clipboard.writeText(active.address);
        setCopied(true);
        toast.success(`${active.label} address copied`);
        setMood('happy');
        setTimeout(() => { setCopied(false); setMood('idle'); }, 2000);
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                {children ?? (
                    <button className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/[0.05] bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.06]">
                        <ArrowDownLeft className="h-5 w-5 text-primary transition-transform group-hover:scale-110" />
                        <span className="text-sm font-medium text-foreground">Receive</span>
                    </button>
                )}
            </DialogTrigger>

            <DialogContent className="lg-panel w-[calc(100vw-24px)] max-w-md gap-0 overflow-hidden rounded-xl bg-transparent p-0">
                <div className="flex items-start gap-3 border-b border-white/[0.07] p-4 pr-12">
                    <div className="min-w-0 flex-1">
                        <DialogTitle className="text-base font-semibold text-white">Receive</DialogTitle>
                        <DialogDescription className="mt-0.5 text-xs text-white/50">Share an address to receive funds</DialogDescription>
                    </div>
                    <Chameleon size={56} mood={mood} tone={active?.color} className="-mt-1 shrink-0 text-white/30" />
                </div>

                {!wdk.isInitialized || !active ? (
                    <div className="p-10 text-center text-sm text-white/50">Unlock the wallet to see your receive addresses.</div>
                ) : (
                    <div className="p-4">
                        {/* Chain chips */}
                        <div className="mb-4 flex flex-wrap gap-1.5">
                            {chains.map(c => {
                                const on = c.key === active.key;
                                return (
                                    <button key={c.key} onClick={() => setSelected(c.key)}
                                        className={cn('flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold transition-colors',
                                            on ? 'text-white' : 'border-white/[0.07] bg-white/[0.02] text-white/55 hover:bg-white/[0.06] hover:text-white')}
                                        style={on ? { background: `${c.color}22`, borderColor: `${c.color}66`, color: '#fff' } : undefined}>
                                        {c.icon && <img src={c.icon} alt="" className="h-4 w-4 object-contain" />}
                                        {c.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* QR */}
                        <div className="flex flex-col items-center">
                            <div className="rounded-2xl bg-white p-3 shadow-lg shadow-black/30">
                                <QRCodeSVG value={active.address} size={184} level="M" bgColor="#ffffff" fgColor="#04110a" includeMargin={false} />
                            </div>
                            <p className="mt-3 text-center text-[11px] text-white/45">{active.sublabel}</p>
                        </div>

                        {/* Address + copy */}
                        <div className="lg-well mt-4 flex items-center gap-2 rounded-xl p-2.5">
                            <span className="min-w-0 flex-1 select-all break-all font-mono text-[11px] text-white/70">{active.address}</span>
                            <button onClick={copy} title="Copy address" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white">
                                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                            </button>
                            {active.explorerUrl && (
                                <a href={active.explorerUrl} target="_blank" rel="noopener noreferrer" title="View on explorer" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white">
                                    <ExternalLink className="h-4 w-4" />
                                </a>
                            )}
                        </div>

                        <p className="mt-3 text-center text-[10px] text-white/35">Send only {active.label} assets to this address.</p>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
