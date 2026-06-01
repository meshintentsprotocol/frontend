import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBCHWallet } from '@/context/BCHWalletProvider';
import { useWDK } from '@/context/WDKProvider';
import { Badge } from '@/components/ui/badge';
import { ArrowUpRight, ArrowDownRight, ArrowDownLeft, ArrowLeftRight, Copy, Check, ChevronDown, Loader2, Wallet, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PortfolioToken } from '@/hooks/usePortfolio';
import { CauldronService } from '@/lib/cauldron';
import { TokenChainIcon } from '@/components/common/TokenChainIcon';
import { SendModal } from '@/components/portfolio/SendModal';
import { ReceiveModal } from '@/components/portfolio/ReceiveModal';
import { toast } from 'sonner';

// ============================================================================
// Wallet Tokens Tab — WDK-driven token list
//
// Balances AND USD values come straight from usePortfolio (passed in as
// `activeTokens`). The tab never re-prices a token itself, so every row's
// value is consistent with the "Total Portfolio Value" header — the total is
// always the strict aggregate of these rows.
// ============================================================================

interface WalletTokenDef {
    symbol: string;
    name: string;
    chain: string;
    icon: string;
    decimals: number;
}

// Network-aware base token list. The EVM tokens are BNB Chain on mainnet and
// Ethereum (Sepolia) on testnet, so the chain badge always reflects reality.
function getWalletTokens(isMainnet: boolean): WalletTokenDef[] {
    const evm: WalletTokenDef[] = isMainnet
        ? [
            { symbol: 'BNB', name: 'BNB (BSC)', chain: 'BSC', icon: '/logos/bnb-bnb-logo.svg', decimals: 18 },
            { symbol: 'USDT', name: 'Tether USD (BSC)', chain: 'BSC', icon: '/logos/usdt-svgrepo-com.svg', decimals: 6 },
        ]
        : [
            { symbol: 'ETH', name: 'Ethereum (Sepolia)', chain: 'Ethereum', icon: '/logos/ethereum-eth-logo.svg', decimals: 18 },
            { symbol: 'USDT', name: 'Tether USD (Sepolia)', chain: 'Ethereum', icon: '/logos/usdt-svgrepo-com.svg', decimals: 6 },
        ];
    return [
        { symbol: 'BCH', name: 'Bitcoin Cash', chain: 'Bitcoin Cash', icon: '/logos/bitcoin-cash-bch-logo.svg', decimals: 8 },
        { symbol: 'BTC', name: 'Bitcoin', chain: 'Bitcoin', icon: '/logos/bitcoin-btc-logo.svg', decimals: 8 },
        ...evm,
        { symbol: 'SOL', name: 'Solana', chain: 'Solana', icon: '/assets/solanaLogo.png', decimals: 9 },
        { symbol: 'USDC', name: 'USD Coin', chain: 'Solana', icon: '/logos/usd-coin-usdc-logo.svg', decimals: 6 },
        { symbol: 'USDT (SOL)', name: 'Tether USD', chain: 'Solana', icon: '/logos/usdt-svgrepo-com.svg', decimals: 6 },
    ];
}

interface WalletTokensTabProps {
    balanceVisible: boolean;
    activeTokens: PortfolioToken[];
    loading?: boolean;
    /** Closes the wallet popup — used when navigating away (Swap). */
    onClose?: () => void;
}

// Action card inside an expanded token row.
const ACTION_CARD =
    'flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-emerald-500/30 text-white/70 hover:text-white transition-colors';

interface TokenData {
    balance: number;
    valueUsd: number;
    change24h: number;
}

export function WalletTokensTab({ balanceVisible, activeTokens, loading, onClose }: WalletTokensTabProps) {
    const bchWallet = useBCHWallet();
    const wdk = useWDK();
    const navigate = useNavigate();

    const [dynamicTokens, setDynamicTokens] = useState<any[]>([]);
    const [isLoadingDynamic, setIsLoadingDynamic] = useState(false);
    const [expandedKey, setExpandedKey] = useState<string | null>(null);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const copyTokenId = (token: any, key: string) => {
        const id = token.type || token.symbol;
        navigator.clipboard.writeText(id);
        setCopiedKey(key);
        toast.success('Token ID copied');
        setTimeout(() => setCopiedKey(c => (c === key ? null : c)), 1500);
    };

    const goToSwap = () => {
        navigate('/trade');
        onClose?.();
    };

    const WALLET_TOKENS = useMemo(() => getWalletTokens(wdk.bchNetwork === 'mainnet'), [wdk.bchNetwork]);

    useEffect(() => {
        let mounted = true;
        const fetchTokens = async () => {
            setIsLoadingDynamic(true);
            const rawTokens = await CauldronService.getTopCashTokens(10, wdk.bchNetwork === 'mainnet');
            if (mounted) {
                const mapped = CauldronService.mapToTokens(rawTokens).map(t => ({
                    symbol: t.symbol,
                    name: t.name,
                    chain: 'Bitcoin Cash',
                    icon: t.icon,
                    decimals: t.decimals,
                    type: t.type,
                }));
                const existing = new Set(WALLET_TOKENS.map(w => w.symbol));
                setDynamicTokens(mapped.filter(m => !existing.has(m.symbol)));
                setIsLoadingDynamic(false);
            }
        };
        fetchTokens();
        return () => { mounted = false; };
    }, [wdk.bchNetwork]);

    // Empty state — nothing connected via WDK
    if (!wdk.isInitialized) {
        return (
            <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <Wallet className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No wallet connected</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                    Connect a WDK wallet to see your tokens
                </p>
            </div>
        );
    }

    // Single source of truth: held assets are looked up in usePortfolio's
    // `activeTokens`. CashTokens (which have no price feed) fall back to the
    // BCH wallet's token UTXO balances with a zero USD value.
    const getTokenData = (token: any): TokenData => {
        const found = activeTokens.find(t => t.chain === token.chain && t.symbol === token.symbol);
        if (found) {
            return { balance: found.balance, valueUsd: found.valueUsd, change24h: found.change24h };
        }
        if (token.type) {
            const raw = bchWallet.tokenBalances[token.type];
            if (raw) {
                return {
                    balance: Number(raw) / Math.pow(10, token.decimals || 0),
                    valueUsd: 0,
                    change24h: 0,
                };
            }
        }
        return { balance: 0, valueUsd: 0, change24h: 0 };
    };

    const getChainColor = (chain: string) => {
        switch (chain) {
            case 'Ethereum': return 'bg-blue-500/15 text-blue-400 border-blue-500/20';
            case 'BSC': return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20';
            case 'Solana': return 'bg-purple-500/15 text-purple-400 border-purple-500/20';
            case 'Bitcoin Cash': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';
            case 'Bitcoin': return 'bg-orange-500/15 text-orange-400 border-orange-500/20';
            default: return '';
        }
    };

    const isChainConnected = (chain: string) => {
        switch (chain) {
            case 'Ethereum':
            case 'BSC': return !!wdk.evmAddress;
            case 'Solana': return !!wdk.solanaAddress;
            case 'Bitcoin Cash': return !!wdk.bchAddress;
            case 'Bitcoin': return !!wdk.btcAddress;
            default: return false;
        }
    };

    // CashTokens the user actually holds — sourced from usePortfolio so they
    // always appear (and carry a USD value) even if outside the Cauldron top list.
    const heldCashTokens = activeTokens
        .filter(t => t.chain === 'Bitcoin Cash' && t.symbol !== 'BCH')
        .map(t => ({
            symbol: t.symbol,
            name: t.name,
            chain: 'Bitcoin Cash',
            icon: t.icon,
            decimals: t.decimals ?? 0,
            type: t.category,
        }));

    // Render tokens whose chain has a WDK address. Held CashTokens take priority
    // over the Cauldron discovery list; duplicates are removed by category.
    const displayTokens = (() => {
        const seen = new Set<string>();
        const out: any[] = [];
        for (const t of [...WALLET_TOKENS, ...heldCashTokens, ...dynamicTokens]) {
            if (!isChainConnected(t.chain)) continue;
            const key = (t as any).type ? `cat-${(t as any).type}` : `${t.chain}-${t.symbol}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(t);
        }
        return out;
    })();

    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between px-1 py-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-2">
                    {displayTokens.length} Assets
                    {(isLoadingDynamic || loading) && <Loader2 className="animate-spin h-3 w-3" />}
                </span>
            </div>

            {displayTokens.length === 0 && (
                <div className="text-center py-8 text-xs text-muted-foreground">
                    No assets to display
                </div>
            )}

            {displayTokens.map((token) => {
                const { balance, valueUsd, change24h } = getTokenData(token);
                const decimals = token.decimals > 6 ? 6 : token.decimals;
                const rowKey = token.type ? `${token.chain}-${token.type}` : `${token.chain}-${token.symbol}`;
                const isExpanded = expandedKey === rowKey;

                return (
                    <div key={rowKey}>
                        {/* Token row */}
                        <div
                            className={cn(
                                "group flex items-center gap-2 p-2.5 rounded-lg transition-colors",
                                isExpanded ? "bg-white/[0.05]" : "hover:bg-white/[0.03]"
                            )}
                        >
                            {/* Left: icon + name → navigate to token detail page */}
                            <div
                                className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                                onClick={() => {
                                    const isCT = typeof token.type === 'string' && token.type.length === 64;
                                    const slug = isCT ? `ct-${token.type}` : token.symbol.toUpperCase();
                                    navigate(`/explore/tokens/${slug}`);
                                    onClose?.();
                                }}
                            >
                                <TokenChainIcon tokenIcon={token.icon} tokenName={token.name} chain={token.chain} size="md" />
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-sm font-semibold">{token.symbol}</span>
                                        <Badge variant="outline" className={cn('text-[8px] h-3.5 px-1 border', getChainColor(token.chain))}>
                                            {token.chain === 'Bitcoin Cash' ? 'BCH' : token.chain === 'Ethereum' ? 'ETH' : token.chain === 'Bitcoin' ? 'BTC' : token.chain}
                                        </Badge>
                                        <ExternalLink className="h-2.5 w-2.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
                                    </div>
                                    <span className="text-[11px] text-muted-foreground">{token.name}</span>
                                </div>
                            </div>

                            {/* Right: balance + chevron → toggle expand */}
                            <div
                                className="flex items-center gap-1.5 flex-shrink-0 cursor-pointer"
                                onClick={() => setExpandedKey(k => (k === rowKey ? null : rowKey))}
                            >
                                <div className="text-right">
                                    <div className="text-sm font-semibold">
                                        {balanceVisible ? `$${valueUsd.toFixed(2)}` : '••••'}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground">
                                        {balanceVisible
                                            ? `${balance.toFixed(decimals)} ${token.symbol}`
                                            : '••••'
                                        }
                                    </div>
                                    {change24h !== 0 && (
                                        <div className={cn(
                                            'flex items-center justify-end text-[10px] font-medium',
                                            change24h >= 0 ? 'text-emerald-400' : 'text-red-400'
                                        )}>
                                            {change24h >= 0
                                                ? <ArrowUpRight className="h-2.5 w-2.5" />
                                                : <ArrowDownRight className="h-2.5 w-2.5" />
                                            }
                                            {Math.abs(change24h).toFixed(2)}%
                                        </div>
                                    )}
                                </div>
                                <ChevronDown className={cn(
                                    "h-3.5 w-3.5 transition-transform duration-200",
                                    isExpanded ? "rotate-180 text-emerald-400/70" : "text-muted-foreground/40"
                                )} />
                            </div>
                        </div>

                        {/* Expanded action cards */}
                        {isExpanded && (
                            <div className="grid grid-cols-5 gap-1.5 px-2 pb-2 pt-1 animate-in fade-in-50 slide-in-from-top-1 duration-150">
                                <SendModal>
                                    <button className={ACTION_CARD} title="Send">
                                        <ArrowUpRight className="h-4 w-4" />
                                        <span className="text-[9px] font-medium">Send</span>
                                    </button>
                                </SendModal>
                                <ReceiveModal>
                                    <button className={ACTION_CARD} title="Receive">
                                        <ArrowDownLeft className="h-4 w-4" />
                                        <span className="text-[9px] font-medium">Receive</span>
                                    </button>
                                </ReceiveModal>
                                <button className={ACTION_CARD} title="Swap" onClick={goToSwap}>
                                    <ArrowLeftRight className="h-4 w-4" />
                                    <span className="text-[9px] font-medium">Swap</span>
                                </button>
                                <button
                                    className={ACTION_CARD}
                                    title="View token info"
                                    onClick={() => {
                                        const isCT = typeof token.type === 'string' && token.type.length === 64;
                                        const slug = isCT ? `ct-${token.type}` : token.symbol.toUpperCase();
                                        navigate(`/explore/tokens/${slug}`);
                                        onClose?.();
                                    }}
                                >
                                    <ExternalLink className="h-4 w-4" />
                                    <span className="text-[9px] font-medium">Info</span>
                                </button>
                                <button className={ACTION_CARD} title="Copy token ID" onClick={() => copyTokenId(token, rowKey)}>
                                    {copiedKey === rowKey
                                        ? <Check className="h-4 w-4 text-emerald-400" />
                                        : <Copy className="h-4 w-4" />}
                                    <span className="text-[9px] font-medium">{copiedKey === rowKey ? 'Copied' : 'Copy ID'}</span>
                                </button>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
