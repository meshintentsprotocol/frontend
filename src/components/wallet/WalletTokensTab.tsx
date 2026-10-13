import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBCHWallet } from '@/context/BCHWalletProvider';
import { useWDK } from '@/context/WDKProvider';
import { useExternalBCHWallet, type ExternalBCHWallet } from '@/context/ExternalBCHWalletProvider';
import { useBchAddressBalance } from '@/hooks/useBchAddressBalance';
import { useActiveWallet } from '@/hooks/useActiveWallet';
import { Badge } from '@/components/ui/badge';
import { ArrowUpRight, ArrowDownRight, ArrowDownLeft, ArrowLeftRight, Copy, Check, ChevronDown, Loader2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PortfolioToken } from '@/hooks/usePortfolio';
import { CauldronService } from '@/lib/cauldron';
import { TokenChainIcon } from '@/components/common/TokenChainIcon';
import { SendModal } from '@/components/portfolio/SendModal';
import { ReceiveModal } from '@/components/portfolio/ReceiveModal';
import { notifyToast as toast } from '@/lib/notify-toast';
import { pusdCategory } from '@/lib/pusd';
import { EmptyState } from '@/components/common/EmptyState';
// pUSD per network (always shown alongside BCH for external wallets)
const getPusdCategory = pusdCategory;

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

// Network-aware base token list. The EVM tokens are BNB Chain, Base, Arbitrum on mainnet
// and Ethereum (Sepolia) on testnet, so the chain badge always reflects reality.
function getWalletTokens(isMainnet: boolean): WalletTokenDef[] {
    const evm: WalletTokenDef[] = isMainnet
        ? [
            { symbol: 'ETH', name: 'Ethereum', chain: 'Ethereum', icon: '/logos/ethereum-eth-logo.svg', decimals: 18 },
            { symbol: 'BNB', name: 'BNB (BSC)', chain: 'BSC', icon: '/logos/bnb-bnb-logo.svg', decimals: 18 },
            { symbol: 'USDT', name: 'Tether USD (BSC)', chain: 'BSC', icon: '/logos/usdt-svgrepo-com.svg', decimals: 6 },
            { symbol: 'USDC', name: 'USD Coin (Base)', chain: 'Base', icon: '/logos/usd-coin-usdc-logo.svg', decimals: 6 },
            { symbol: 'USDC', name: 'USD Coin (Arbitrum)', chain: 'Arbitrum', icon: '/logos/usd-coin-usdc-logo.svg', decimals: 6 },
            { symbol: 'wNEAR', name: 'Wrapped NEAR', chain: 'NEAR', icon: '/logos/near.svg', decimals: 24 },
        ]
        : [
            { symbol: 'ETH', name: 'Ethereum (Sepolia)', chain: 'Ethereum', icon: '/logos/ethereum-eth-logo.svg', decimals: 18 },
            { symbol: 'USDT', name: 'Tether USD (Sepolia)', chain: 'Ethereum', icon: '/logos/usdt-svgrepo-com.svg', decimals: 6 },
        ];
    return [
        { symbol: 'BCH', name: 'Bitcoin Cash', chain: 'Bitcoin Cash', icon: '/logos/bitcoin-cash-bch-logo.svg', decimals: 8 },
        { symbol: 'BTC', name: 'Bitcoin', chain: 'Bitcoin', icon: '/logos/bitcoin-btc-logo.svg', decimals: 8 },
        ...evm,
        { symbol: 'SOL', name: 'Solana', chain: 'Solana', icon: '/logos/solana.svg', decimals: 9 },
        { symbol: 'USDC', name: 'USD Coin', chain: 'Solana', icon: '/logos/usd-coin-usdc-logo.svg', decimals: 6 },
        { symbol: 'USDT (SOL)', name: 'Tether USD', chain: 'Solana', icon: '/logos/usdt-svgrepo-com.svg', decimals: 6 },
        { symbol: 'MOVE', name: 'Movement', chain: 'Movement', icon: '/logos/movement.svg', decimals: 8 },
        { symbol: 'USDC (MOVE)', name: 'USD Coin (Movement)', chain: 'Movement', icon: '/logos/usd-coin-usdc-logo.svg', decimals: 6 },
        { symbol: 'USDT (MOVE)', name: 'Tether USD (Movement)', chain: 'Movement', icon: '/logos/usdt-svgrepo-com.svg', decimals: 6 },
        { symbol: 'WETH (MOVE)', name: 'Wrapped Ether (Movement)', chain: 'Movement', icon: '/logos/ethereum-eth-logo.svg', decimals: 8 },
    ];
}

// Chain filter chips. BCH is the default view; 'all' shows every chain.
const ALL_CHAINS = 'all';
const DEFAULT_CHAIN = 'Bitcoin Cash';
const CHAIN_CHIPS: Record<string, { label: string; icon: string }> = {
    'Bitcoin Cash': { label: 'BCH', icon: '/logos/bitcoin-cash-bch-logo.svg' },
    'Bitcoin': { label: 'BTC', icon: '/logos/bitcoin-btc-logo.svg' },
    'Ethereum': { label: 'ETH', icon: '/logos/ethereum-eth-logo.svg' },
    'BSC': { label: 'BSC', icon: '/logos/bnb-bnb-logo.svg' },
    'Base': { label: 'BASE', icon: '/logos/Base_square_blue.svg' },
    'Arbitrum': { label: 'ARB', icon: '/logos/arbitrum-arb-logo.svg' },
    'Solana': { label: 'Solana', icon: '/logos/solana.svg' },
    'NEAR': { label: 'NEAR', icon: '/logos/near.svg' },
    'Movement': { label: 'Movement', icon: '/logos/movement.svg' },
};

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
    const extBCH = useExternalBCHWallet();
    const navigate = useNavigate();

    const [dynamicTokens, setDynamicTokens] = useState<any[]>([]);
    const [isLoadingDynamic, setIsLoadingDynamic] = useState(false);
    const [expandedKey, setExpandedKey] = useState<string | null>(null);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [chainFilter, setChainFilter] = useState<string>(DEFAULT_CHAIN);
    
    // Global active wallet state
    const { activeWalletId } = useActiveWallet();

    const activeExtWallet = extBCH.wallets.find(w => w.id === activeWalletId);
    
    // Always call hook, but it only fetches if address is not null
    const { data: extData, isLoading: isExtLoading } = useBchAddressBalance({
        address: activeExtWallet?.address || null,
        isMainnet: wdk.bchNetwork === 'mainnet',
        refetchMs: 15_000,
    });

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

    // True empty state: no main wallet AND no external wallets at all
    if (!wdk.isInitialized && extBCH.wallets.length === 0) {
        return (
            <EmptyState title="No wallet connected" hint="Create a Cham Wallet or connect an external one." />
        );
    }

    // Single source of truth for token data depending on active wallet
    const getTokenData = (token: any): TokenData => {
        if (activeWalletId === 'main') {
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
        } else {
            // External wallet logic
            if (token.symbol === 'BCH') {
                return { balance: extData.sats / 1e8, valueUsd: 0, change24h: 0 };
            }
            if (token.type) {
                const raw = extData.tokens[token.type];
                if (raw) {
                    return {
                        balance: Number(raw) / Math.pow(10, token.decimals || 0),
                        valueUsd: 0,
                        change24h: 0,
                    };
                }
            }
            return { balance: 0, valueUsd: 0, change24h: 0 };
        }
    };

    const getChainColor = (chain: string) => {
        switch (chain) {
            case 'Ethereum': return 'bg-blue-500/15 text-blue-400 border-blue-500/20';
            case 'BSC': return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20';
            case 'Base': return 'bg-blue-600/15 text-blue-300 border-blue-600/20';
            case 'Arbitrum': return 'bg-sky-500/15 text-sky-400 border-sky-500/20';
            case 'Optimism': return 'bg-red-500/15 text-red-400 border-red-500/20';
            case 'Solana': return 'bg-purple-500/15 text-purple-400 border-purple-500/20';
            case 'NEAR': return 'bg-teal-500/15 text-teal-300 border-teal-500/20';
            case 'Movement': return 'bg-amber-500/15 text-amber-300 border-amber-500/20';
            case 'Bitcoin Cash': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';
            case 'Bitcoin': return 'bg-orange-500/15 text-orange-400 border-orange-500/20';
            default: return '';
        }
    };

    const isChainConnected = (chain: string) => {
        switch (chain) {
            case 'Ethereum':
            case 'BSC':
            case 'Base':
            case 'Arbitrum':
            case 'Optimism': return !!wdk.evmAddress;
            case 'Solana': return !!wdk.solanaAddress;
            case 'Bitcoin Cash': return !!wdk.bchAddress;
            case 'Bitcoin': return !!wdk.btcAddress;
            case 'Movement': return !!wdk.movementAddress;
            case 'NEAR': return true; // Intent route target
            default: return false;
        }
    };

    // USDC on the swap server's chains and Solana mainnet tokens the wallet holds (from usePortfolio).
    const heldSwapServer = activeTokens
        .filter(t => t.swapServer)
        .map(t => ({ symbol: t.symbol, name: t.name, chain: t.chain, icon: t.icon, decimals: t.decimals ?? 0, held: true }));

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

    // Render tokens based on the active wallet context
    const displayTokens = useMemo(() => {
        const seen = new Set<string>();
        const out: any[] = [];
        
        if (activeWalletId === 'main') {
            for (const t of [...WALLET_TOKENS, ...heldCashTokens, ...heldSwapServer, ...dynamicTokens]) {
                if (!(t as any).held && !isChainConnected(t.chain)) continue;
                const key = (t as any).type ? `cat-${(t as any).type}` : `${t.chain}-${t.symbol}`;
                if (seen.has(key)) continue;
                seen.add(key);
                out.push(t);
            }
        } else {
            // External wallet: Always show BCH + PUSD + held tokens
            const pusdCat = getPusdCategory(wdk.bchNetwork === 'mainnet');
            
            // Push BCH
            const bchToken = WALLET_TOKENS.find(t => t.symbol === 'BCH')!;
            out.push(bchToken);
            seen.add(`Bitcoin Cash-BCH`);

            // Push PUSD if available in top tokens or manually crafted
            if (pusdCat) {
                const pusdToken = dynamicTokens.find(t => t.type === pusdCat) || {
                    symbol: 'PUSD',
                    name: 'ParyonUSD',
                    chain: 'Bitcoin Cash',
                    icon: '/assets/paryonlogo.jpg',
                    decimals: 0,
                    type: pusdCat
                };
                out.push(pusdToken);
                seen.add(`cat-${pusdCat}`);
            }

            // Push any other held tokens in the external wallet
            for (const [category, amountStr] of Object.entries(extData.tokens)) {
                if (seen.has(`cat-${category}`)) continue;
                if (Number(amountStr) <= 0) continue;

                // Try to enrich from dynamic cauldron list
                const known = dynamicTokens.find(t => t.type === category);
                if (known) {
                    out.push(known);
                } else {
                    out.push({
                        symbol: `${category.slice(0, 4)}…`,
                        name: `CashToken (${category.slice(0, 8)}…)`,
                        chain: 'Bitcoin Cash',
                        icon: `https://api.dicebear.com/7.x/identicon/svg?seed=${category}`,
                        decimals: 0,
                        type: category,
                    });
                }
                seen.add(`cat-${category}`);
            }
        }
        
        return out;
    }, [activeWalletId, WALLET_TOKENS, heldCashTokens, heldSwapServer, dynamicTokens, extData, wdk.bchNetwork]);

    // Chains that have at least one row, in list order. If the selected chain is
    // gone (wallet or network switch), fall back to BCH, then to everything.
    const chains = [...new Set<string>(displayTokens.map(t => t.chain))];
    const activeChain = chainFilter === ALL_CHAINS || chains.includes(chainFilter)
        ? chainFilter
        : chains.includes(DEFAULT_CHAIN) ? DEFAULT_CHAIN : ALL_CHAINS;
    const visibleTokens = activeChain === ALL_CHAINS ? displayTokens : displayTokens.filter(t => t.chain === activeChain);
    const chipClass = (selected: boolean) => cn(
        'flex shrink-0 items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-semibold border transition-colors',
        selected
            ? 'bg-white/[0.1] text-white border-white/[0.16]'
            : 'bg-white/[0.02] text-white/45 border-white/[0.06] hover:bg-white/[0.05] hover:text-white/70',
    );

    return (
        <div className="space-y-1 pt-2">
            {/* Chain filter — only when there is more than one chain to choose from */}
            {chains.length > 1 && (
                <div role="tablist" aria-label="Filter by chain" className="flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <button type="button" role="tab" aria-selected={activeChain === ALL_CHAINS} onClick={() => setChainFilter(ALL_CHAINS)} className={chipClass(activeChain === ALL_CHAINS)}>
                        All
                    </button>
                    {chains.map(chain => {
                        const chip = CHAIN_CHIPS[chain];
                        return (
                            <button key={chain} type="button" role="tab" aria-selected={activeChain === chain} onClick={() => setChainFilter(chain)} className={chipClass(activeChain === chain)}>
                                {chip && <img src={chip.icon} alt="" className="h-3.5 w-3.5 object-contain" />}
                                {chip?.label ?? chain}
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="flex items-center justify-between px-1 py-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-2">
                    {visibleTokens.length} Assets
                    {(isLoadingDynamic || loading || isExtLoading) && <Loader2 className="animate-spin h-3 w-3" />}
                </span>
            </div>

            {visibleTokens.length === 0 && <EmptyState title="No assets to display" hint="Tokens this wallet holds show up here." size="sm" />}

            {visibleTokens.map((token) => {
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
                                    <span className="block truncate text-[11px] text-muted-foreground">{token.name}</span>
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

// The ExternalWalletsTokenSection and ExternalWalletTokenBag have been fully deprecated 
// in favor of the unified rendering in WalletTokensTab.
