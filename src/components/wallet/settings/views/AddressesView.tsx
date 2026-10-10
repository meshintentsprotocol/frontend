import { useState, ReactNode } from 'react';
import { useWDK } from '@/context/WDKProvider';
import { useBCHWallet } from '@/context/BCHWalletProvider';
import { useExternalBCHWallet } from '@/context/ExternalBCHWalletProvider';
import { useBchAddressBalance } from '@/hooks/useBchAddressBalance';
import { Copy, ExternalLink, KeyRound, Wallet, Check, Loader2, Plus, WifiOff, Wifi } from 'lucide-react';
import { notifyToast as toast } from '@/lib/notify-toast';
import { cn } from '@/lib/utils';

// ============================================================================
// Addresses view — every chain address derived from the seed, plus any
// connected external BCH wallets
// ============================================================================

function copyAddress(address: string, label: string) {
    navigator.clipboard.writeText(address);
    toast.success(`${label} address copied!`);
}

function formatAddr(addr: string) {
    if (addr.length <= 20) return addr;
    return `${addr.slice(0, 10)}…${addr.slice(-6)}`;
}

// ============================================================================
// ChainAddressRow — Polished per-chain card
// ============================================================================
type NetworkColor = 'emerald' | 'blue' | 'yellow' | 'purple' | 'orange';

const COLOR_MAP: Record<NetworkColor, { ring: string; badge: string; text: string; glow: string }> = {
    emerald: { ring: 'ring-emerald-500/20', badge: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25', text: 'text-emerald-300', glow: 'shadow-emerald-500/10' },
    blue:    { ring: 'ring-blue-500/20',    badge: 'bg-blue-500/10 text-blue-300 border-blue-500/25',         text: 'text-blue-300',    glow: 'shadow-blue-500/10' },
    yellow:  { ring: 'ring-yellow-500/20',  badge: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/25',   text: 'text-yellow-300',  glow: 'shadow-yellow-500/10' },
    purple:  { ring: 'ring-purple-500/20',  badge: 'bg-purple-500/10 text-purple-300 border-purple-500/25',   text: 'text-purple-300',  glow: 'shadow-purple-500/10' },
    orange:  { ring: 'ring-orange-500/20',  badge: 'bg-orange-500/10 text-orange-300 border-orange-500/25',   text: 'text-orange-300',  glow: 'shadow-orange-500/10' },
};

interface ChainAddressRowProps {
    icon?: string;
    iconNode?: ReactNode;
    chainName: string;
    networkLabel: string;
    networkColor: NetworkColor;
    address: string;
    explorerUrl?: string;
    balance?: string;
    footer?: ReactNode;
    onCopy: () => void;
}

function ChainAddressRow({ icon, iconNode, chainName, networkLabel, networkColor, address, explorerUrl, balance, footer, onCopy }: ChainAddressRowProps) {
    const [copied, setCopied] = useState(false);
    const c = COLOR_MAP[networkColor];

    const handleCopy = () => {
        onCopy();
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
    };

    return (
        <div className={cn(
            "group relative rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.12] p-3 transition-all duration-200 shadow-sm hover:-translate-y-[1px] hover:shadow-md",
            c.glow
        )}>
            <div className="flex items-center gap-3">
                {/* Chain icon */}
                <div className={cn(
                    "h-9 w-9 rounded-xl bg-black/40 p-1.5 flex items-center justify-center flex-shrink-0 ring-1 transition-all",
                    c.ring
                )}>
                    {iconNode ?? (icon && <img src={icon} alt={chainName} className="h-full w-full object-contain" />)}
                </div>

                {/* Name + network badge + address */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={cn("text-xs font-semibold tracking-tight", c.text)}>{chainName}</span>
                        <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-wider", c.badge)}>
                            {networkLabel}
                        </span>
                    </div>
                    <div className="text-[10px] font-mono text-white/50 truncate" title={address}>
                        {formatAddr(address)}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                        onClick={handleCopy}
                        title="Copy address"
                        className="h-7 w-7 rounded-md flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.06] transition-all"
                    >
                        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                    {explorerUrl && (
                        <a
                            href={explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View in explorer"
                            className="h-7 w-7 rounded-md flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.06] transition-all"
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                    )}
                </div>
            </div>

            {/* Balance + footer */}
            {(balance || footer) && (
                <div className="mt-2 pt-2 border-t border-white/[0.04] flex items-center justify-between gap-2">
                    {balance && (
                        <span className={cn("text-[11px] font-mono font-semibold", c.text)}>{balance}</span>
                    )}
                    {footer && <div className="ml-auto">{footer}</div>}
                </div>
            )}
        </div>
    );
}

interface AddressesViewProps {
    /** Opens the connect-external-wallet modal (wired by WalletPopup). */
    onConnectExternal?: () => void;
}

export function AddressesView({ onConnectExternal }: AddressesViewProps) {
    const wdk = useWDK();
    const bchWallet = useBCHWallet();
    const extBCH = useExternalBCHWallet();
    const isMainnet = wdk.bchNetwork === 'mainnet';

    if (!wdk.isInitialized) {
        return (
            <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <Wallet className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No wallet connected</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                    Connect a WDK wallet to view addresses
                </p>
            </div>
        );
    }

    // Active BCH address tracks the currently-selected network (driven by the navbar toggle)
    const activeBchAddress = isMainnet ? wdk.bchMainnetAddress : wdk.bchChipnetAddress;

    const connectedChainCount = [wdk.evmAddress, activeBchAddress, wdk.solanaAddress, wdk.btcAddress, wdk.movementAddress]
        .filter(Boolean).length;

    return (
        <div className="space-y-4">
            {/* ─── Self-custodial header — compact identity strip ─── */}
            <div className="relative rounded-xl bg-gradient-to-br from-emerald-500/[0.06] via-emerald-500/[0.02] to-transparent border border-emerald-500/20 p-3 overflow-hidden">
                <div className="absolute -top-10 -right-10 w-28 h-28 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="relative flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="h-7 w-7 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                            <KeyRound className="h-3.5 w-3.5 text-emerald-300" />
                        </div>
                        <div className="flex flex-col min-w-0 leading-tight">
                            <span className="text-xs font-semibold text-emerald-300 tracking-tight">WDK Self-Custodial</span>
                            <span className="text-[10px] text-emerald-300/50 uppercase tracking-wider">BIP-39 · {connectedChainCount} {connectedChainCount === 1 ? 'chain' : 'chains'} active</span>
                        </div>
                    </div>
                    {connectedChainCount > 0 && (
                        <span className="shrink-0 inline-flex items-center gap-1 h-6 px-2 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[10px] font-semibold text-emerald-300 uppercase tracking-wider">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70" />
                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            </span>
                            Live
                        </span>
                    )}
                </div>
            </div>

            {/* ═══════════════ NETWORKS ═══════════════ */}
            <div>
                <div className="flex items-center justify-between px-1 mb-2">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-[0.14em] text-white/40 font-bold">Networks</span>
                        <span className="flex-1 h-px bg-white/[0.06]" />
                    </div>
                    {onConnectExternal && (
                        <button
                            onClick={onConnectExternal}
                            className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400/80 hover:text-emerald-300 transition-colors px-2 py-1 rounded-md hover:bg-emerald-500/10"
                        >
                            <Plus className="h-3 w-3" />
                            Add Wallet
                        </button>
                    )}
                </div>
                <div className="space-y-2">
                    {/* EVM */}
                    {wdk.evmAddress && (
                        <ChainAddressRow
                            icon={isMainnet ? '/logos/bnb-bnb-logo.svg' : '/logos/ethereum-eth-logo.svg'}
                            chainName={isMainnet ? 'BNB Smart Chain' : 'Ethereum'}
                            networkLabel={isMainnet ? 'Mainnet' : 'Sepolia'}
                            networkColor={isMainnet ? 'yellow' : 'blue'}
                            address={wdk.evmAddress}
                            explorerUrl={isMainnet
                                ? `https://bscscan.com/address/${wdk.evmAddress}`
                                : `https://sepolia.etherscan.io/address/${wdk.evmAddress}`}
                            onCopy={() => copyAddress(wdk.evmAddress!, isMainnet ? 'BNB' : 'ETH')}
                        />
                    )}

                    {/* BCH — single address based on active network */}
                    {activeBchAddress && (
                        <ChainAddressRow
                            icon="/logos/bitcoin-cash-bch-logo.svg"
                            chainName="Bitcoin Cash"
                            networkLabel={isMainnet ? 'Mainnet' : 'Chipnet'}
                            networkColor="emerald"
                            address={activeBchAddress}
                            explorerUrl={isMainnet
                                ? `https://blockchair.com/bitcoin-cash/address/${activeBchAddress}`
                                : `https://chipnet.chaingraph.cash/address/${activeBchAddress}`}
                            onCopy={() => copyAddress(activeBchAddress, `BCH ${isMainnet ? 'Mainnet' : 'Chipnet'}`)}
                            balance={bchWallet.connected ? `${(bchWallet.balance / 1e8).toFixed(6)} BCH` : undefined}
                            footer={!isMainnet && (
                                <a href="https://tbch4.googol.cash/" target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors">
                                    <ExternalLink className="h-2.5 w-2.5" /> Get Chipnet BCH (Faucet)
                                </a>
                            )}
                        />
                    )}

                    {/* Solana */}
                    {wdk.solanaAddress && (
                        <ChainAddressRow
                            icon="/assets/solanaLogo.png"
                            chainName="Solana"
                            networkLabel={isMainnet ? 'Mainnet' : 'Devnet'}
                            networkColor="purple"
                            address={wdk.solanaAddress}
                            explorerUrl={isMainnet
                                ? `https://explorer.solana.com/address/${wdk.solanaAddress}`
                                : `https://explorer.solana.com/address/${wdk.solanaAddress}?cluster=devnet`}
                            onCopy={() => copyAddress(wdk.solanaAddress!, 'Solana')}
                        />
                    )}

                    {/* Movement */}
                    {wdk.movementAddress && (
                        <ChainAddressRow
                            icon="/logos/movement.svg"
                            chainName="Movement"
                            networkLabel={isMainnet ? 'Mainnet' : 'Bardock Testnet'}
                            networkColor="yellow"
                            address={wdk.movementAddress}
                            explorerUrl={`https://explorer.movementnetwork.xyz/account/${wdk.movementAddress}?network=testnet`}
                            onCopy={() => copyAddress(wdk.movementAddress!, 'Movement')}
                            balance={wdk.movementBalance ? `${Number(wdk.movementBalance).toFixed(4)} MOVE` : undefined}
                            footer={!isMainnet && (
                                <a href="https://faucet.movementnetwork.xyz" target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] text-yellow-400 hover:text-yellow-300 transition-colors">
                                    <ExternalLink className="h-2.5 w-2.5" /> Get Bardock MOVE (Faucet)
                                </a>
                            )}
                        />
                    )}

                    {/* BTC */}
                    {wdk.btcAddress && (
                        <ChainAddressRow
                            icon="/logos/bitcoin-btc-logo.svg"
                            chainName="Bitcoin"
                            networkLabel="Testnet"
                            networkColor="orange"
                            address={wdk.btcAddress}
                            explorerUrl={`https://mempool.space/testnet/address/${wdk.btcAddress}`}
                            onCopy={() => copyAddress(wdk.btcAddress!, 'Bitcoin')}
                        />
                    )}

                    {/* ── External BCH Wallets ── */}
                    {extBCH.wallets.map(extWallet => (
                        <ExternalWalletCard
                            key={extWallet.id}
                            wallet={extWallet}
                            isMainnet={isMainnet}
                            onDisconnect={() => extBCH.disconnectWallet(extWallet.id)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// ExternalWalletCard — shows a connected external BCH wallet (WC / Wizard)
// ============================================================================

interface ExternalWalletCardProps {
    wallet: import('@/context/ExternalBCHWalletProvider').ExternalBCHWallet;
    isMainnet: boolean;
    onDisconnect: () => void;
}

function ExternalWalletCard({ wallet, isMainnet, onDisconnect }: ExternalWalletCardProps) {
    const { data: balData, isLoading } = useBchAddressBalance({
        address: wallet.address,
        isMainnet,
        refetchMs: 15_000,
    });
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(wallet.address);
        setCopied(true);
        toast.success('Address copied!');
        setTimeout(() => setCopied(false), 1200);
    };

    const explorerUrl = isMainnet
        ? `https://blockchair.com/bitcoin-cash/address/${wallet.address}`
        : `https://chipnet.chaingraph.cash/address/${wallet.address}`;

    const sourceLabel = wallet.source === 'wizardconnect' ? 'WizardConnect' : wallet.source === 'extension' ? 'Extension' : 'WalletConnect';

    return (
        <div className="relative rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-blue-500/15 hover:border-blue-500/25 p-3 transition-all duration-200 shadow-sm hover:-translate-y-[1px] shadow-blue-500/5">
            {/* "External" ribbon */}
            <div className="absolute top-2 right-2">
                <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 font-bold uppercase tracking-wider">
                    {sourceLabel}
                </span>
            </div>

            <div className="flex items-center gap-3 pr-20">
                {/* Icon */}
                <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/20 ring-1 ring-blue-500/10 flex items-center justify-center flex-shrink-0 text-base">
                    {wallet.source === 'wizardconnect' ? '🔵' : wallet.source === 'extension' ? '🧩' : '🟢'}
                </div>

                {/* Name + address */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs font-semibold tracking-tight text-blue-300">
                            {wallet.label}
                        </span>
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded border bg-emerald-500/10 text-emerald-300 border-emerald-500/25 uppercase tracking-wider">
                            {isMainnet ? 'Mainnet' : 'Chipnet'}
                        </span>
                    </div>
                    <div className="text-[10px] font-mono text-white/50 truncate" title={wallet.address}>
                        {formatAddr(wallet.address)}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                        onClick={handleCopy}
                        title="Copy address"
                        className="h-7 w-7 rounded-md flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.06] transition-all"
                    >
                        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                    <a
                        href={explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="View in explorer"
                        className="h-7 w-7 rounded-md flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.06] transition-all"
                    >
                        <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                </div>
            </div>

            {/* Balance + disconnect */}
            <div className="mt-2 pt-2 border-t border-white/[0.04] flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                    <Wifi className="h-3 w-3 text-blue-400/70" />
                    {isLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin text-white/30" />
                    ) : (
                        <span className="text-[11px] font-mono font-semibold text-blue-300">
                            {(balData.sats / 1e8).toFixed(6)} BCH
                        </span>
                    )}
                </div>
                <button
                    onClick={onDisconnect}
                    className="flex items-center gap-1 text-[10px] font-semibold text-red-400/60 hover:text-red-400 transition-colors px-2 py-1 rounded-md hover:bg-red-500/10"
                    title="Disconnect wallet"
                >
                    <WifiOff className="h-3 w-3" />
                    Disconnect
                </button>
            </div>
        </div>
    );
}
