import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useWDK } from '@/context/WDKProvider';
import { ArrowDownLeft, Copy, Check, ExternalLink } from 'lucide-react';
import { notifyToast as toast } from '@/lib/notify-toast';
// ============================================================================
// ReceiveModal — WDK-powered: shows all derived addresses
// ============================================================================

interface AddressEntry {
    key: string;
    label: string;
    sublabel: string;
    address: string;
    icon: string | null;
    explorerUrl?: string;
    borderColor: string;
    bgColor: string;
}

export function ReceiveModal({ children }: { children?: React.ReactNode }) {
    const wdk = useWDK();
    const [copied, setCopied] = useState<string | null>(null);

    const handleCopy = (key: string, address: string, label: string) => {
        navigator.clipboard.writeText(address);
        setCopied(key);
        toast.success(`${label} address copied!`);
        setTimeout(() => setCopied(null), 2000);
    };

    const isMainnet = wdk.bchNetwork === 'mainnet';

    const addresses = ([
        wdk.evmAddress ? {
            key: 'evm',
            label: isMainnet ? 'BNB Smart Chain' : 'Ethereum',
            sublabel: isMainnet ? 'BSC Mainnet · BNB, USDT' : 'Sepolia Testnet · ETH, USDT',
            address: wdk.evmAddress,
            icon: isMainnet ? '/logos/bnb-bnb-logo.svg' : '/logos/ethereum-eth-logo.svg',
            explorerUrl: isMainnet
                ? `https://bscscan.com/address/${wdk.evmAddress}`
                : `https://sepolia.etherscan.io/address/${wdk.evmAddress}`,
            borderColor: isMainnet ? 'border-yellow-500/20' : 'border-blue-500/20',
            bgColor: isMainnet ? 'bg-yellow-500/[0.04]' : 'bg-blue-500/[0.04]',
        } : null,
        wdk.bchAddress ? {
            key: 'bch',
            label: 'Bitcoin Cash',
            sublabel: isMainnet ? 'Mainnet · BCH, CashTokens' : 'Chipnet · BCH, CashTokens',
            address: wdk.bchAddress,
            icon: '/logos/bitcoin-cash-bch-logo.svg',
            explorerUrl: isMainnet
                ? `https://blockchair.com/bitcoin-cash/address/${wdk.bchAddress}`
                : `https://chipnet.imaginary.cash/address/${wdk.bchAddress}`,
            borderColor: 'border-emerald-500/20',
            bgColor: 'bg-emerald-500/[0.04]',
        } : null,
        wdk.solanaAddress ? {
            key: 'sol',
            label: 'Solana',
            sublabel: 'Devnet · SOL, SPL tokens',
            address: wdk.solanaAddress,
            icon: '/assets/solanaLogo.png',
            explorerUrl: `https://solscan.io/account/${wdk.solanaAddress}?cluster=devnet`,
            borderColor: 'border-purple-500/20',
            bgColor: 'bg-purple-500/[0.04]',
        } : null,
        wdk.movementAddress ? {
            key: 'mov',
            label: 'Movement',
            sublabel: isMainnet ? 'Mainnet · MOVE, Tokens' : 'Bardock Testnet · MOVE, USDC, USDT',
            address: wdk.movementAddress,
            icon: '/logos/movement.svg',
            explorerUrl: `https://explorer.movementnetwork.xyz/account/${wdk.movementAddress}?network=testnet`,
            borderColor: 'border-yellow-500/20',
            bgColor: 'bg-yellow-500/[0.04]',
        } : null,
        wdk.btcAddress ? {
            key: 'btc',
            label: 'Bitcoin',
            sublabel: 'Testnet',
            address: wdk.btcAddress,
            icon: null, // BTC uses inline ₿ badge
            explorerUrl: undefined,
            borderColor: 'border-orange-500/20',
            bgColor: 'bg-orange-500/[0.04]',
        } : null,
    ] as (AddressEntry | null)[]).filter(Boolean) as AddressEntry[];

    return (
        <Dialog>
            <DialogTrigger asChild>
                {children ?? (
                    <button className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] transition-colors group">
                        <div className="text-primary group-hover:scale-110 transition-transform">
                            <ArrowDownLeft className="h-5 w-5" />
                        </div>
                        <span className="text-sm font-medium text-foreground">Receive</span>
                    </button>
                )}
            </DialogTrigger>

            <DialogContent className="sm:max-w-md bg-[#0A0A0A] border-white/10 rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="text-lg font-semibold">Receive Assets</DialogTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">Share an address to receive funds into your wallet</p>
                </DialogHeader>

                <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-0.5 mt-1">
                    {!wdk.isInitialized ? (
                        <div className="text-center py-10 text-sm text-muted-foreground">
                            Connect a WDK wallet to view your receive addresses.
                        </div>
                    ) : addresses.length === 0 ? (
                        <div className="text-center py-10 text-sm text-muted-foreground">
                            No addresses derived yet.
                        </div>
                    ) : (
                        addresses.map(entry => (
                            <div
                                key={entry.key}
                                className={`flex flex-col gap-2 p-4 border rounded-xl ${entry.borderColor} ${entry.bgColor}`}
                            >
                                {/* Chain header row */}
                                <div className="flex items-center gap-3">
                                    {entry.icon === null ? (
                                        <span className="w-8 h-8 rounded-full bg-[#F7931A] flex items-center justify-center text-white text-[11px] font-black shrink-0">
                                            ₿
                                        </span>
                                    ) : (
                                        <img
                                            src={entry.icon}
                                            alt={entry.label}
                                            className="w-8 h-8 rounded-full bg-white/10 p-1 object-contain shrink-0"
                                        />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-semibold">{entry.label}</div>
                                        <div className="text-[11px] text-muted-foreground">{entry.sublabel}</div>
                                    </div>
                                    {entry.explorerUrl && (
                                        <a
                                            href={entry.explorerUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                            title="View on explorer"
                                        >
                                            <ExternalLink className="h-3.5 w-3.5" />
                                        </a>
                                    )}
                                </div>

                                {/* Address + copy row */}
                                <div className="flex items-center gap-2 pl-11">
                                    <span className="text-[11px] font-mono text-muted-foreground flex-1 truncate select-all">
                                        {entry.address}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-white/10 shrink-0"
                                        onClick={() => handleCopy(entry.key, entry.address, entry.label)}
                                    >
                                        {copied === entry.key
                                            ? <Check className="h-3.5 w-3.5 text-emerald-400" />
                                            : <Copy className="h-3.5 w-3.5" />}
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
