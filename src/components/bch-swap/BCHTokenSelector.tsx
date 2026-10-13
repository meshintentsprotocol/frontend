import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ChevronDown, Search, Loader2, Layers, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Token } from "@/types";
import { CauldronService } from "@/lib/cauldron";
import { TokenChainIcon } from "@/components/common/TokenChainIcon";

// ============================================================================
// Token Lists
// ============================================================================

export const BCH_TOKENS: Token[] = [
    {
        symbol: "BCH",
        name: "Bitcoin Cash",
        icon: "/logos/bitcoin-cash-bch-logo.svg",
        decimals: 8,
        type: "native",
        chain: "bch",
    },
];

export const SOLANA_TOKENS: Token[] = [
    {
        symbol: "SOL",
        name: "Solana",
        icon: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
        decimals: 9,
        type: "11111111111111111111111111111111",
        chain: "solana",
        address: "So11111111111111111111111111111111111111112",
    },
    {
        symbol: "USDC",
        name: "USD Coin (Devnet)",
        icon: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
        decimals: 6,
        type: "spl-token",
        chain: "solana",
        address: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    },
];

export const MOVEMENT_TOKENS: Token[] = [
    {
        symbol: "MOVE",
        name: "Movement",
        icon: "/logos/movement.svg",
        decimals: 8,
        type: "0x1::aptos_coin::AptosCoin",
        chain: "movement",
        address: "0x1::aptos_coin::AptosCoin",
    },
    {
        symbol: "USDC",
        name: "USD Coin (Movement)",
        icon: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
        decimals: 6,
        type: "0x1::aptos_coin::AptosCoin",
        chain: "movement",
        address: "0x1::aptos_coin::AptosCoin",
    },
    {
        symbol: "USDT",
        name: "Tether USD (Movement)",
        icon: "/logos/usdt-svgrepo-com.svg",
        decimals: 6,
        type: "0x1::aptos_coin::AptosCoin",
        chain: "movement",
        address: "0x1::aptos_coin::AptosCoin",
    },
    {
        symbol: "WETH",
        name: "Wrapped Ether (Movement)",
        icon: "/logos/ethereum-eth-logo.svg",
        decimals: 8,
        type: "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::WETH",
        chain: "movement",
        address: "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::WETH",
    },
];

export const XMR_TOKENS: Token[] = [
    {
        symbol: "XMR",
        name: "Monero",
        icon: "/logos/monero.svg",
        decimals: 12,
        type: "native",
        chain: "xmr",
    },
];

// ── Active EVM chains ────────────────────────────────────────────────────────

export const ETH_TOKENS: Token[] = [
    {
        symbol: "ETH",
        name: "Ethereum",
        icon: "/logos/ethereum-eth-logo.svg",
        decimals: 18,
        type: "native",
        chain: "ethereum",
    },
    {
        symbol: "USDC",
        name: "USD Coin (Sepolia)",
        icon: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
        decimals: 6,
        type: "erc20",
        chain: "ethereum",
        address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    },
    {
        symbol: "USDT",
        name: "Tether USD (Sepolia)",
        icon: "/logos/usdt-svgrepo-com.svg",
        decimals: 6,
        type: "erc20",
        chain: "ethereum",
        address: "0xd077a400968890eacc75cdc901f0356c943e4fdb",
    },
];

// ── Cross-chain EVM chains ────────────────────────────────────────────────────

export const BSC_TOKENS: Token[] = [
    {
        symbol: "BNB",
        name: "BNB",
        icon: "/logos/bnb-bnb-logo.svg",
        decimals: 18,
        type: "native",
        chain: "bsc",
    },
    {
        symbol: "USDT",
        name: "Tether USD (BSC)",
        icon: "/logos/usdt-svgrepo-com.svg",
        decimals: 6,
        type: "erc20",
        chain: "bsc",
        address: "0x55d398326f99059fF775485246999027B3197955",
    },
];

export const BASE_TOKENS: Token[] = [
    {
        symbol: "ETH",
        name: "Ethereum (Base)",
        icon: "/logos/Base_square_blue.svg",
        decimals: 18,
        type: "native",
        chain: "base",
    },
    {
        symbol: "USDC",
        name: "USD Coin (Base)",
        icon: "/logos/usd-coin-usdc-logo.svg",
        decimals: 6,
        type: "erc20",
        chain: "base",
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    },
];

export const ARBITRUM_TOKENS: Token[] = [
    {
        symbol: "ETH",
        name: "Ethereum (Arbitrum)",
        icon: "/logos/arbitrum-arb-logo.svg",
        decimals: 18,
        type: "native",
        chain: "arbitrum",
    },
    {
        symbol: "USDC",
        name: "USD Coin (Arbitrum)",
        icon: "/logos/usd-coin-usdc-logo.svg",
        decimals: 6,
        type: "erc20",
        chain: "arbitrum",
        address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    },
];

export const OPTIMISM_TOKENS: Token[] = [
    {
        symbol: "ETH",
        name: "Ethereum (Optimism)",
        icon: "/logos/optimism.svg",
        decimals: 18,
        type: "native",
        chain: "optimism",
    },
    {
        symbol: "USDC",
        name: "USD Coin (Optimism)",
        icon: "/logos/usd-coin-usdc-logo.svg",
        decimals: 6,
        type: "erc20",
        chain: "optimism",
        address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    },
];

export const NEAR_TOKENS: Token[] = [
    {
        symbol: "wNEAR",
        name: "Wrapped NEAR",
        icon: "/logos/near.svg",
        decimals: 24,
        type: "nep141",
        chain: "near",
        address: "wrap.near",
    },
    {
        symbol: "USDC",
        name: "USD Coin (NEAR)",
        icon: "/logos/usd-coin-usdc-logo.svg",
        decimals: 6,
        type: "nep141",
        chain: "near",
        address: "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
    },
];

export const ALL_BCH_SWAP_TOKENS: Token[] = [
    ...BCH_TOKENS,
    ...ETH_TOKENS,
    ...BSC_TOKENS,
    ...BASE_TOKENS,
    ...ARBITRUM_TOKENS,
    ...OPTIMISM_TOKENS,
    ...NEAR_TOKENS,
    ...SOLANA_TOKENS,
    ...MOVEMENT_TOKENS,
    ...XMR_TOKENS,
];

// Mainnet list: BCH + cross-chain tokens
export const MAINNET_SWAP_TOKENS: Token[] = [
    ...BCH_TOKENS,
    ...ETH_TOKENS,
    ...BSC_TOKENS,
    ...BASE_TOKENS,
    ...ARBITRUM_TOKENS,
    ...OPTIMISM_TOKENS,
    ...NEAR_TOKENS,
    ...SOLANA_TOKENS,
    ...MOVEMENT_TOKENS,
];

// ============================================================================
// Component
// ============================================================================

interface BCHTokenSelectorProps {
    value?: Token;
    onSelect: (token: Token) => void;
    tokens?: Token[];
    className?: string;
    label?: string;
    evmNetworkLabel?: string;
    /** Whether to fetch from BCH mainnet Cauldron (true) or chipnet (false) */
    isMainnet?: boolean;
    /** Finds tokens beyond the list (Solana mainnet tokens from the swap server), by name, symbol or mint. */
    searchTokens?: (query: string) => Promise<Token[]>;
}

type ChainFilter = 'all' | 'bch' | 'ethereum' | 'near' | 'bsc' | 'base' | 'arbitrum' | 'optimism' | 'solana' | 'polygon' | 'avalanche' | 'arc' | 'movement' | 'xmr';

const CHAIN_FILTERS: { key: ChainFilter; label: string; logo: string | null }[] = [
    { key: 'all',       label: 'All',      logo: null },
    { key: 'bch',       label: 'BCH',      logo: '/logos/bitcoin-cash-bch-logo.svg' },
    { key: 'near',      label: 'NEAR',     logo: '/logos/near.svg' },
    { key: 'ethereum',  label: 'Ethereum', logo: '/logos/ethereum-eth-logo.svg' },
    { key: 'solana',    label: 'Solana',   logo: '/logos/solana.svg' },
    { key: 'base',      label: 'Base',     logo: '/logos/Base_square_blue.svg' },
    { key: 'arbitrum',  label: 'Arbitrum', logo: '/logos/arbitrum-arb-logo.svg' },
    { key: 'bsc',       label: 'BNB',      logo: '/logos/bnb-bnb-logo.svg' },
    { key: 'optimism',  label: 'Optimism', logo: '/logos/optimism.svg' },
    { key: 'polygon',   label: 'Polygon',  logo: '/logos/polygon-matic-logo.svg' },
    { key: 'avalanche', label: 'Avalanche',logo: '/logos/avalanche-avax-logo.svg' },
    { key: 'arc',       label: 'Arc',      logo: '/logos/arc.svg' },
    { key: 'movement',  label: 'Movement', logo: '/logos/movement.svg' },
    { key: 'xmr',       label: 'Monero',   logo: '/logos/monero.svg' },
];

// Section metadata for each chain grouping
const SECTIONS: {
    chain: string;
    label: string;
    dotColor: string;
}[] = [
    { chain: 'bch',       label: 'Bitcoin Cash',    dotColor: 'bg-emerald-400' },
    { chain: 'near',      label: 'NEAR Protocol',   dotColor: 'bg-emerald-400' },
    { chain: 'ethereum',  label: 'Ethereum',         dotColor: 'bg-blue-400' },
    { chain: 'solana',    label: 'Solana',           dotColor: 'bg-purple-400' },
    { chain: 'base',      label: 'Base',             dotColor: 'bg-blue-500' },
    { chain: 'arbitrum',  label: 'Arbitrum',         dotColor: 'bg-sky-400' },
    { chain: 'bsc',       label: 'BNB Chain',        dotColor: 'bg-yellow-400' },
    { chain: 'optimism',  label: 'Optimism',         dotColor: 'bg-red-400' },
    { chain: 'polygon',   label: 'Polygon',          dotColor: 'bg-purple-500' },
    { chain: 'avalanche', label: 'Avalanche',        dotColor: 'bg-red-500' },
    { chain: 'arc',       label: 'Arc',              dotColor: 'bg-sky-300' },
    { chain: 'movement',  label: 'Movement',         dotColor: 'bg-yellow-300' },
    { chain: 'xmr',       label: 'Monero',           dotColor: 'bg-orange-400' },
];

const CHAIN_BADGE_STYLE: Record<string, string> = {
    bch:      'bg-emerald-500/15 text-emerald-400',
    near:     'bg-teal-500/15 text-teal-300',
    ethereum: 'bg-blue-500/15 text-blue-400',
    eth:      'bg-blue-500/15 text-blue-400',
    bsc:      'bg-yellow-500/15 text-yellow-400',
    base:     'bg-blue-600/15 text-blue-300',
    arbitrum: 'bg-sky-500/15 text-sky-400',
    arb:      'bg-sky-500/15 text-sky-400',
    optimism: 'bg-red-500/15 text-red-400',
    op:       'bg-red-500/15 text-red-400',
    arc:      'bg-sky-500/15 text-sky-300',
    solana:   'bg-purple-500/15 text-purple-400',
    sol:      'bg-purple-500/15 text-purple-400',
    polygon:  'bg-purple-500/15 text-purple-400',
    pol:      'bg-purple-500/15 text-purple-400',
    avalanche:'bg-red-500/15 text-red-400',
    avax:     'bg-red-500/15 text-red-400',
    movement: 'bg-yellow-500/15 text-yellow-400',
    xmr:      'bg-orange-500/15 text-orange-400',
};

const CHAIN_BADGE_LABEL: Record<string, string> = {
    bch: 'BCH', near: 'NEAR', ethereum: 'ETH', eth: 'ETH', bsc: 'BNB', base: 'BASE',
    arbitrum: 'ARB', arb: 'ARB', optimism: 'OP', op: 'OP', arc: 'ARC', solana: 'SOL', sol: 'SOL',
    polygon: 'POL', pol: 'POL', avalanche: 'AVAX', avax: 'AVAX', movement: 'MOVE', xmr: 'XMR',
};

export function BCHTokenSelector({
    value,
    onSelect,
    tokens = ALL_BCH_SWAP_TOKENS,
    className,
    label,
    isMainnet = false,
    searchTokens,
}: BCHTokenSelectorProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [chainFilter, setChainFilter] = useState<ChainFilter>('all');
    const [dynamicTokens, setDynamicTokens] = useState<Token[]>([]);
    const [isLoadingDynamic, setIsLoadingDynamic] = useState(false);

    useEffect(() => {
        let mounted = true;
        const fetchTokens = async () => {
            setIsLoadingDynamic(true);
            const rawTokens = await CauldronService.getTopCashTokens(25, isMainnet);
            if (mounted) {
                const mapped = CauldronService.mapToTokens(rawTokens) as Token[];
                const baseTokens = tokens || ALL_BCH_SWAP_TOKENS;
                const existingTypes = new Set(baseTokens.map(t => t.type));
                const filtered = mapped.filter(t =>
                    !existingTypes.has(t.type) && t.symbol !== 'UNKNOWN'
                );
                setDynamicTokens(filtered);
                setIsLoadingDynamic(false);
            }
        };
        fetchTokens();
        return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMainnet]);

    // Remote search, a moment after the typing stops; an answer for an older query is dropped.
    const [found, setFound] = useState<Token[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const query = search.trim();
    useEffect(() => {
        if (!open || !searchTokens || query.length < 2 || (chainFilter !== 'all' && chainFilter !== 'solana')) { setFound([]); setIsSearching(false); return; }
        let live = true;
        setIsSearching(true);
        const t = setTimeout(() => {
            searchTokens(query).then(r => { if (live) setFound(r); }).catch(() => { if (live) setFound([]); }).finally(() => { if (live) setIsSearching(false); });
        }, 350);
        return () => { live = false; clearTimeout(t); };
    }, [open, searchTokens, query, chainFilter]);

    const normChain = (c?: string) => {
        if (!c) return 'bch';
        const lc = c.toLowerCase().trim();
        if (lc === 'eth') return 'ethereum';
        if (lc === 'arb') return 'arbitrum';
        if (lc === 'op') return 'optimism';
        if (lc === 'sol') return 'solana';
        if (lc === 'pol') return 'polygon';
        if (lc === 'avax') return 'avalanche';
        return lc;
    };

    const rawList = [...(tokens || ALL_BCH_SWAP_TOKENS), ...dynamicTokens];
    const initialList = (value?.categoryId && !rawList.some(t => t.categoryId === value.categoryId))
        ? [value, ...rawList]
        : rawList;

    // Strict deduplication to prevent repetition between hardcoded and catalog tokens
    const seenKeys = new Set<string>();
    const displayTokens = initialList.filter(t => {
        const k = t.categoryId ? `cat:${t.categoryId}` : `${normChain(t.chain)}:${t.symbol.toUpperCase()}`;
        if (seenKeys.has(k)) return false;
        seenKeys.add(k);
        return true;
    });

    const localMatches = displayTokens.filter(t => {
        const q = query.toLowerCase();
        const matchesSearch = !q ||
            t.name.toLowerCase().includes(q) ||
            t.symbol.toLowerCase().includes(q) ||
            (q.length >= 32 && t.address?.toLowerCase() === q);
        const matchesChain = chainFilter === 'all' || normChain(t.chain) === chainFilter;
        return matchesSearch && matchesChain;
    });
    const listed = new Set(localMatches.filter(t => t.address).map(t => `${t.chain}:${t.address}`));
    const filteredTokens = [...localMatches, ...found.filter(t => !listed.has(`${t.chain}:${t.address}`))];

    const handleOpenChange = (next: boolean) => {
        setOpen(next);
        if (!next) {
            setSearch("");
            setChainFilter('all');
        }
    };

    const handleSelect = (token: Token) => {
        if (token.disabled) return;
        onSelect(token);
        // Same as closing: the next open starts from the whole list, not from this pick's chain or search.
        handleOpenChange(false);
    };

    // By category for CashTokens, by address where both rows have one (several tokens can share a symbol),
    // otherwise by symbol and chain.
    const isSelected = (token: Token) => value?.categoryId
        ? value.categoryId === token.categoryId
        : value?.address && token.address
            ? value.address === token.address && value.chain === token.chain
            : value?.symbol === token.symbol && value?.chain === token.chain;

    const TokenRow = ({ token }: { token: Token }) => (
        <Button
            variant="ghost"
            disabled={token.disabled}
            className={cn(
                "w-full justify-start h-14 px-4",
                token.disabled
                    ? "opacity-40 cursor-not-allowed hover:bg-transparent"
                    : "hover:bg-muted/50"
            )}
            onClick={() => handleSelect(token)}
        >
            <TokenChainIcon
                tokenIcon={token.icon}
                tokenName={token.symbol}
                chain={token.chain || 'bch'}
                size="md"
                className="mr-3"
            />
            <div className="text-left flex flex-col flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-semibold">{token.symbol}</span>
                    {token.chain && CHAIN_BADGE_STYLE[token.chain] && (
                        <span className={cn(
                            "text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0",
                            CHAIN_BADGE_STYLE[token.chain]
                        )}>
                            {CHAIN_BADGE_LABEL[token.chain]}
                        </span>
                    )}
                </div>
                <span className="text-xs text-muted-foreground truncate">{token.name}</span>
            </div>
            <div className="ml-auto flex items-center gap-2 shrink-0">
                {token.swapServer?.suspicious ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400">Flagged</span>
                ) : token.swapServer?.product === 'jupiter' && token.swapServer.verified === false ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400">Unverified</span>
                ) : null}
                {token.comingSoon && (
                    <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                        <Lock className="h-2.5 w-2.5" />
                        Soon
                    </span>
                )}
                {isSelected(token) && (
                    <div className="w-2 h-2 rounded-full bg-primary" />
                )}
            </div>
        </Button>
    );

    const triggerChain = value?.chain || 'bch';

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-fit min-w-[140px] justify-between rounded-full pl-2 pr-3 py-6", className)}
                >
                    {value ? (
                        <div className="flex items-center gap-2">
                            <TokenChainIcon
                                tokenIcon={value.icon}
                                tokenName={value.symbol}
                                chain={triggerChain}
                                size="sm"
                            />
                            <span className="font-semibold text-lg">{value.symbol}</span>
                        </div>
                    ) : (
                        <span className="text-muted-foreground">{label || "Select Token"}</span>
                    )}
                    <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[425px] p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-4 pb-2">
                    <DialogTitle>Select a token</DialogTitle>
                </DialogHeader>

                {/* Search */}
                <div className="px-4 pt-2 pb-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder={searchTokens ? "Search name, symbol or Solana mint" : "Search token name or symbol"}
                            className="pl-9 bg-muted/50 border-none focus-visible:ring-1"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                {/* Chain filter chips */}
                <div className="px-4 pb-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                        {/* Arc has tokens only while the swap server offers it (testnet mode): no empty chip otherwise. */}
                        {CHAIN_FILTERS.filter(f => f.key !== 'arc' || displayTokens.some(t => t.chain === 'arc')).map(f => {
                            const active = chainFilter === f.key;
                            return (
                                <button
                                    key={f.key}
                                    onClick={() => setChainFilter(f.key)}
                                    className={cn(
                                        "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-semibold border transition-colors",
                                        active
                                            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                            : "bg-white/[0.03] text-white/60 border-white/[0.06] hover:text-white hover:bg-white/[0.06]"
                                    )}
                                >
                                    {f.logo ? (
                                        <img src={f.logo} alt={f.label} className="h-3 w-3 object-contain" />
                                    ) : (
                                        <Layers className="h-3 w-3" />
                                    )}
                                    <span>{f.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Token list */}
                <div className="max-h-[350px] overflow-y-auto p-2">
                    {filteredTokens.length === 0 ? (
                        <div className="text-center text-sm text-muted-foreground py-8">
                            {isLoadingDynamic || isSearching
                                ? <div className="flex justify-center items-center gap-2"><Loader2 className="animate-spin h-4 w-4" /> Fetching tokens...</div>
                                : "No tokens found"}
                        </div>
                    ) : (
                        <>
                            {SECTIONS.map(section => {
                                const sectionTokens = filteredTokens.filter(t => t.chain === section.chain);
                                if (sectionTokens.length === 0) return null;
                                return (
                                    <div key={section.chain} className="mt-2 first:mt-0">
                                        <div className="px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                            <div className={cn("w-1.5 h-1.5 rounded-full", section.dotColor)} />
                                            {section.label}
                                        </div>
                                        <div className="grid gap-0.5">
                                            {sectionTokens.map((token, idx) => (
                                                <TokenRow
                                                    key={`${token.chain}-${token.symbol}-${token.categoryId || token.address || 'native'}-${idx}`}
                                                    token={token}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                            {/* Dynamic CashTokens that don't match a named section */}
                            {(() => {
                                const dynamicOnly = filteredTokens.filter(t =>
                                    t.categoryId && !SECTIONS.some(s => s.chain === t.chain)
                                );
                                if (!dynamicOnly.length) return null;
                                return (
                                    <div className="mt-2">
                                        <div className="px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                            CashTokens
                                        </div>
                                        <div className="grid gap-0.5">
                                            {dynamicOnly.map(token => (
                                                <TokenRow
                                                    key={`ct-${token.categoryId || token.symbol}`}
                                                    token={token}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
