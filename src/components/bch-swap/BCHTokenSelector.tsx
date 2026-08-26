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

// ── Coming-soon EVM chains ────────────────────────────────────────────────────

export const BSC_TOKENS: Token[] = [
    {
        symbol: "BNB",
        name: "BNB",
        icon: "/logos/bnb-bnb-logo.svg",
        decimals: 18,
        type: "native",
        chain: "bsc",
        disabled: true,
        comingSoon: true,
    },
    {
        symbol: "USDT",
        name: "Tether USD (BSC)",
        icon: "/logos/usdt-svgrepo-com.svg",
        decimals: 6,
        type: "erc20",
        chain: "bsc",
        address: "0x55d398326f99059fF775485246999027B3197955",
        disabled: true,
        comingSoon: true,
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
        disabled: true,
        comingSoon: true,
    },
    {
        symbol: "USDC",
        name: "USD Coin (Base)",
        icon: "/logos/usd-coin-usdc-logo.svg",
        decimals: 6,
        type: "erc20",
        chain: "base",
        disabled: true,
        comingSoon: true,
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
        disabled: true,
        comingSoon: true,
    },
    {
        symbol: "USDC",
        name: "USD Coin (Arbitrum)",
        icon: "/logos/usd-coin-usdc-logo.svg",
        decimals: 6,
        type: "erc20",
        chain: "arbitrum",
        disabled: true,
        comingSoon: true,
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
        disabled: true,
        comingSoon: true,
    },
    {
        symbol: "USDC",
        name: "USD Coin (Optimism)",
        icon: "/logos/usd-coin-usdc-logo.svg",
        decimals: 6,
        type: "erc20",
        chain: "optimism",
        disabled: true,
        comingSoon: true,
    },
];

export const ALL_BCH_SWAP_TOKENS: Token[] = [
    ...BCH_TOKENS,
    ...ETH_TOKENS,
    ...BSC_TOKENS,
    ...BASE_TOKENS,
    ...ARBITRUM_TOKENS,
    ...OPTIMISM_TOKENS,
    ...SOLANA_TOKENS,
    ...MOVEMENT_TOKENS,
    ...XMR_TOKENS,
];

// Mainnet list: BCH + EVM tokens (Solana/Movement/XMR excluded until mainnet deploy)
export const MAINNET_SWAP_TOKENS: Token[] = [
    ...BCH_TOKENS,
    ...ETH_TOKENS,
    ...BSC_TOKENS,
    ...BASE_TOKENS,
    ...ARBITRUM_TOKENS,
    ...OPTIMISM_TOKENS,
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
}

type ChainFilter = 'all' | 'bch' | 'ethereum' | 'bsc' | 'base' | 'arbitrum' | 'optimism' | 'solana' | 'movement' | 'xmr';

const CHAIN_FILTERS: { key: ChainFilter; label: string; logo: string | null }[] = [
    { key: 'all',       label: 'All',      logo: null },
    { key: 'bch',       label: 'BCH',      logo: '/logos/bitcoin-cash-bch-logo.svg' },
    { key: 'ethereum',  label: 'Ethereum', logo: '/logos/ethereum-eth-logo.svg' },
    { key: 'bsc',       label: 'BNB',      logo: '/logos/bnb-bnb-logo.svg' },
    { key: 'base',      label: 'Base',     logo: '/logos/Base_square_blue.svg' },
    { key: 'arbitrum',  label: 'Arbitrum', logo: '/logos/arbitrum-arb-logo.svg' },
    { key: 'optimism',  label: 'Optimism', logo: '/logos/optimism.svg' },
    { key: 'solana',    label: 'Solana',   logo: '/logos/solana.svg' },
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
    { chain: 'ethereum',  label: 'Ethereum',         dotColor: 'bg-blue-400' },
    { chain: 'bsc',       label: 'BNB Chain',        dotColor: 'bg-yellow-400' },
    { chain: 'base',      label: 'Base',             dotColor: 'bg-blue-500' },
    { chain: 'arbitrum',  label: 'Arbitrum',         dotColor: 'bg-sky-400' },
    { chain: 'optimism',  label: 'Optimism',         dotColor: 'bg-red-400' },
    { chain: 'solana',    label: 'Solana',           dotColor: 'bg-purple-400' },
    { chain: 'movement',  label: 'Movement',         dotColor: 'bg-yellow-300' },
    { chain: 'xmr',       label: 'Monero',           dotColor: 'bg-orange-400' },
];

const CHAIN_BADGE_STYLE: Record<string, string> = {
    bch:      'bg-emerald-500/15 text-emerald-400',
    ethereum: 'bg-blue-500/15 text-blue-400',
    bsc:      'bg-yellow-500/15 text-yellow-400',
    base:     'bg-blue-600/15 text-blue-300',
    arbitrum: 'bg-sky-500/15 text-sky-400',
    optimism: 'bg-red-500/15 text-red-400',
    solana:   'bg-purple-500/15 text-purple-400',
    movement: 'bg-yellow-500/15 text-yellow-400',
    xmr:      'bg-orange-500/15 text-orange-400',
};

const CHAIN_BADGE_LABEL: Record<string, string> = {
    bch: 'BCH', ethereum: 'ETH', bsc: 'BNB', base: 'BASE',
    arbitrum: 'ARB', optimism: 'OP', solana: 'SOL', movement: 'MOVE', xmr: 'XMR',
};

export function BCHTokenSelector({
    value,
    onSelect,
    tokens = ALL_BCH_SWAP_TOKENS,
    className,
    label,
    isMainnet = false,
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

    const baseList = [...(tokens || ALL_BCH_SWAP_TOKENS), ...dynamicTokens];
    const displayTokens = (value?.categoryId && !baseList.some(t => t.categoryId === value.categoryId))
        ? [value, ...baseList]
        : baseList;

    const filteredTokens = displayTokens.filter(t => {
        const q = search.toLowerCase();
        const matchesSearch = !q ||
            t.name.toLowerCase().includes(q) ||
            t.symbol.toLowerCase().includes(q);
        const matchesChain = chainFilter === 'all' || t.chain === chainFilter;
        return matchesSearch && matchesChain;
    });

    const handleSelect = (token: Token) => {
        if (token.disabled) return;
        onSelect(token);
        setOpen(false);
    };

    const handleOpenChange = (next: boolean) => {
        setOpen(next);
        if (!next) {
            setSearch("");
            setChainFilter('all');
        }
    };

    const isSelected = (token: Token) => value?.categoryId
        ? value.categoryId === token.categoryId
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
                            placeholder="Search token name or symbol"
                            className="pl-9 bg-muted/50 border-none focus-visible:ring-1"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                {/* Chain filter chips */}
                <div className="px-4 pb-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                        {CHAIN_FILTERS.map(f => {
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
                            {isLoadingDynamic
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
                                            {sectionTokens.map(token => (
                                                <TokenRow
                                                    key={`${token.chain}-${token.categoryId || token.address || token.symbol}`}
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
