import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerTrigger, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWDK } from '@/context/WDKProvider';
import { MAINNET_SWAP_TOKENS, ALL_BCH_SWAP_TOKENS } from '@/components/bch-swap/BCHTokenSelector';
import { TokenChainIcon } from '@/components/common/TokenChainIcon';
import type { Token } from '@/types';
import { useIsMobile } from '@/hooks/use-mobile';

const CHAIN_LABELS: Record<string, string> = {
    bch: 'Bitcoin Cash',
    eth: 'EVM',
    solana: 'Solana',
    movement: 'Movement',
    xmr: 'Monero',
};

interface TokenSearchModalProps {
    children?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function TokenSearchModal({ children, open: controlledOpen, onOpenChange: controlledOnOpenChange }: TokenSearchModalProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
    const setOpen = controlledOnOpenChange !== undefined ? controlledOnOpenChange : setInternalOpen;
    const [searchQuery, setSearchQuery] = useState('');
    const navigate = useNavigate();
    const wdk = useWDK();
    const isMobile = useIsMobile();

    const isMainnet = wdk.bchNetwork === 'mainnet';
    const tokens: Token[] = isMainnet ? MAINNET_SWAP_TOKENS : ALL_BCH_SWAP_TOKENS;

    // Dedupe by symbol+chain so duplicate entries (e.g. USDT on multiple chains) all show
    const uniqueTokens = useMemo(() => {
        const seen = new Set<string>();
        return tokens.filter(t => {
            const k = `${t.symbol}-${t.chain || ''}-${t.address || ''}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        });
    }, [tokens]);

    const filteredTokens = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return uniqueTokens;
        return uniqueTokens.filter(token => {
            const chainKey = token.chain || '';
            const chainLabel = chainKey ? (CHAIN_LABELS[chainKey] || chainKey) : '';
            return token.name.toLowerCase().includes(q) ||
                token.symbol.toLowerCase().includes(q) ||
                (token.address || '').toLowerCase().includes(q) ||
                chainLabel.toLowerCase().includes(q);
        });
    }, [uniqueTokens, searchQuery]);

    const handleSelectToken = (token: Token) => {
        setOpen(false);
        setSearchQuery('');
        const slug = token.categoryId ? `ct-${token.categoryId}` : token.symbol.toUpperCase();
        navigate(`/explore/tokens/${slug}`);
    };

    const modalContent = (
        <>
            <div className="p-4 border-b border-white/[0.08] relative">
                <Search className="absolute left-8 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                    placeholder={`Search tokens on ${isMainnet ? 'Mainnet' : 'Testnet'}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-12 h-14 bg-white/[0.03] border-white/10 hover:border-white/20 focus-visible:ring-1 focus-visible:ring-primary rounded-xl text-base transition-colors"
                    autoFocus={!isMobile}
                />
                <div className="flex items-center justify-between mt-3 px-1">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {filteredTokens.length} {filteredTokens.length === 1 ? 'token' : 'tokens'}
                    </span>
                    <span className={
                        "text-[10px] font-semibold px-2 py-0.5 rounded-full border " +
                        (isMainnet
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20")
                    }>
                        {isMainnet ? 'BCH Mainnet' : 'BCH Chipnet'}
                    </span>
                </div>
            </div>
            <div className="max-h-[350px] overflow-y-auto p-2 pb-4">
                {filteredTokens.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                        No tokens found.
                    </div>
                ) : (
                    filteredTokens.map((token) => (
                        <button
                            key={`${token.symbol}-${token.chain}-${token.address || 'native'}`}
                            onClick={() => handleSelectToken(token)}
                            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition-colors text-left"
                        >
                            <TokenChainIcon tokenIcon={token.icon} tokenName={token.name} chain={token.chain} size="lg" />
                            <div className="flex flex-col flex-1 min-w-0">
                                <span className="font-semibold text-foreground truncate">{token.name}</span>
                                <span className="text-xs text-muted-foreground tracking-wide">
                                    {token.symbol}{token.chain ? ` · ${CHAIN_LABELS[token.chain] || token.chain}` : ''}
                                </span>
                            </div>
                        </button>
                    ))
                )}
            </div>
        </>
    );

    if (isMobile) {
        return (
            <Drawer open={open} onOpenChange={setOpen}>
                {children ? (
                    <DrawerTrigger asChild>
                        {children}
                    </DrawerTrigger>
                ) : null}
                <DrawerContent className="p-0">
                    <DrawerTitle className="sr-only">Search tokens</DrawerTitle>
                    {modalContent}
                </DrawerContent>
            </Drawer>
        );
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {children ? (
                <DialogTrigger asChild>
                    {children}
                </DialogTrigger>
            ) : null}
            <DialogContent className="max-w-md p-0 overflow-hidden bg-[#0A0A0A]/95 backdrop-blur-2xl border-white/10 rounded-2xl shadow-2xl shadow-black/80 top-[20%] translate-y-0">
                <DialogTitle className="sr-only">Search tokens</DialogTitle>
                {modalContent}
            </DialogContent>
        </Dialog>
    );
}
