import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Loader2, Sparkles, Check, Globe, AlertCircle } from 'lucide-react';
import { CauldronService, type CauldronTokenData } from '@/lib/cauldron';
import { useWDK } from '@/context/WDKProvider';

export interface MeshToken {
  symbol: string;
  name: string;
  decimals: number;
  icon?: string;
  categoryId?: string;
  tokenId?: string;
  isNativeBch?: boolean;
  priceUsd?: number;
  priceSats?: number;
  change24hBp?: number;
  tvlSats?: number;
}

// Native Bitcoin Cash definition
export const NATIVE_BCH_TOKEN: MeshToken = {
  symbol: 'BCH',
  name: 'Bitcoin Cash',
  decimals: 8,
  icon: '/logos/bitcoin-cash-bch-logo.svg',
  isNativeBch: true,
};

// Known Chipnet test tokens
export const CHIPNET_DEFAULT_TOKENS: MeshToken[] = [
  NATIVE_BCH_TOKEN,
  {
    symbol: 'pUSD',
    name: 'Pegged USD (Chipnet Test)',
    decimals: 2,
    icon: '/assets/bchintentslogo.png',
    categoryId: 'dfe50223c8d5cba8dcef8dff6d92b61deb88a8ba44947367f2b746487b56039b',
    priceUsd: 1.00,
  },
  {
    symbol: 'mUSD',
    name: 'Mesh USD Testnet',
    decimals: 2,
    icon: '/assets/bchintentslogo.png',
    categoryId: 'b4863d5773c7a269b6fe3b9f7ce2ce1098ab71c0b046ef2a39058d5e30b1f353',
    priceUsd: 1.00,
  },
];

interface TokenSelectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (token: MeshToken) => void;
  selectedToken?: MeshToken;
  otherSelectedToken?: MeshToken;
  title?: string;
}

export function TokenSelectModal({
  open,
  onOpenChange,
  onSelect,
  selectedToken,
  otherSelectedToken,
  title = 'Select a Token',
}: TokenSelectModalProps) {
  const { bchNetwork, bchAddress } = useWDK();
  const isMainnet = bchNetwork === 'mainnet';

  const [search, setSearch] = useState('');
  const [cauldronTokens, setCauldronTokens] = useState<MeshToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch tokens from Cauldron indexer
  useEffect(() => {
    let mounted = true;
    const fetchTokens = async () => {
      setLoading(true);
      setError(null);
      try {
        const rawTokens = await CauldronService.getTopCashTokens(50, isMainnet);
        if (mounted) {
          const mapped: MeshToken[] = rawTokens
            .filter(t => {
              const sym = t.bcmr?.token?.symbol || t.display_symbol || '';
              return sym && sym !== 'UNKNOWN';
            })
            .map(t => {
              const symbol = t.bcmr?.token?.symbol || t.display_symbol || 'TOKEN';
              const name = t.bcmr?.name || t.display_name || symbol;
              const decimals = t.bcmr?.token?.decimals ?? 0;
              let icon = t.bcmr?.uris?.icon;
              if (icon?.startsWith('ipfs://')) {
                icon = `https://ipfs.io/ipfs/${icon.replace('ipfs://', '')}`;
              }
              return {
                symbol,
                name,
                decimals,
                icon,
                categoryId: t.token_id,
                priceUsd: t.price_now_usd,
                priceSats: t.price_now,
                change24hBp: t.change_24h_bp,
                tvlSats: t.tvl_sats,
              };
            });

          setCauldronTokens(mapped);
        }
      } catch (err: any) {
        if (mounted) setError('Failed to load Cauldron tokens');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    if (open) {
      void fetchTokens();
    }

    return () => {
      mounted = false;
    };
  }, [isMainnet, open]);

  // Combined token list
  const allTokens = useMemo(() => {
    const defaultList = isMainnet ? [NATIVE_BCH_TOKEN] : CHIPNET_DEFAULT_TOKENS;
    const existingIds = new Set(defaultList.map(t => t.categoryId || (t.isNativeBch ? 'BCH' : '')));
    const filteredCauldron = cauldronTokens.filter(t => !existingIds.has(t.categoryId || ''));
    return [...defaultList, ...filteredCauldron];
  }, [isMainnet, cauldronTokens]);

  // Filtered by search query
  const filteredTokens = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allTokens;
    return allTokens.filter(t => {
      const matchSym = t.symbol.toLowerCase().includes(q);
      const matchName = t.name.toLowerCase().includes(q);
      const matchCategory = t.categoryId?.toLowerCase().includes(q);
      return matchSym || matchName || matchCategory;
    });
  }, [allTokens, search]);

  const handleSelectToken = (token: MeshToken) => {
    onSelect(token);
    onOpenChange(false);
    setSearch('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full bg-[#0E0E11] border border-white/15 rounded-3xl p-6 shadow-2xl text-white">
        <DialogHeader className="space-y-1 pb-3 border-b border-white/10">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-heading font-black text-white tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              <span>{title}</span>
            </DialogTitle>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 border border-white/10 rounded-xl text-[11px] font-semibold text-zinc-400">
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isMainnet ? 'BCH Mainnet' : 'BCH Chipnet'}</span>
            </div>
          </div>
          <p className="text-xs text-zinc-400">
            Choose Bitcoin Cash or verified CashTokens indexed on Cauldron DEX.
          </p>
        </DialogHeader>

        {/* Search Bar */}
        <div className="relative mt-3">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, symbol, or tokenId..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-2xl text-sm text-white placeholder:text-zinc-500 outline-none focus:border-emerald-500/50 transition-all font-mono"
            autoFocus
          />
        </div>

        {/* Popular / Quick-select Chips */}
        <div className="flex flex-wrap gap-2 pt-1">
          {allTokens.slice(0, 4).map(t => {
            const isSelected = selectedToken?.symbol === t.symbol;
            return (
              <button
                key={t.categoryId || t.symbol}
                onClick={() => handleSelectToken(t)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                    : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                {t.icon ? (
                  <img src={t.icon} alt={t.symbol} className="w-4 h-4 rounded-full object-contain" />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center text-[9px] text-emerald-400 font-bold">
                    {t.symbol.slice(0, 1)}
                  </div>
                )}
                <span>{t.symbol}</span>
              </button>
            );
          })}
        </div>

        {/* Token List Container */}
        <div className="mt-2 max-h-[340px] overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
          {loading && allTokens.length <= 3 && (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-zinc-500">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
              <span className="text-xs">Fetching tokens from Cauldron DEX…</span>
            </div>
          )}

          {filteredTokens.map(token => {
            const isSelected = selectedToken?.symbol === token.symbol;
            const isOther = otherSelectedToken?.symbol === token.symbol;

            return (
              <button
                key={token.categoryId || token.symbol}
                onClick={() => handleSelectToken(token)}
                disabled={isOther}
                className={`w-full flex items-center justify-between p-3 rounded-2xl border text-left transition-all group ${
                  isSelected
                    ? 'bg-emerald-500/15 border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                    : isOther
                    ? 'opacity-40 cursor-not-allowed bg-white/[0.01] border-white/5'
                    : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.06] hover:border-white/15'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Token Icon */}
                  <div className="relative">
                    {token.icon ? (
                      <img
                        src={token.icon}
                        alt={token.symbol}
                        className="w-9 h-9 rounded-full object-contain bg-black/40 border border-white/10 p-0.5"
                        onError={e => {
                          // Fallback to initial
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-sm font-bold text-emerald-400">
                        {token.symbol.slice(0, 2)}
                      </div>
                    )}
                    {token.isNativeBch && (
                      <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-[#0E0E11]" />
                    )}
                  </div>

                  {/* Symbol & Name */}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white group-hover:text-emerald-300 transition-colors">
                        {token.symbol}
                      </span>
                      {token.isNativeBch ? (
                        <span className="px-1.5 py-0.2 text-[9px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded">
                          Native
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 text-[9px] font-bold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded">
                          CashToken
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-400 line-clamp-1 max-w-[180px]">
                      {token.name}
                    </div>
                  </div>
                </div>

                {/* Right: Price & Selection state */}
                <div className="text-right flex items-center gap-3">
                  <div>
                    {token.priceUsd ? (
                      <div className="text-xs font-mono font-bold text-white">
                        ${token.priceUsd < 0.01 ? token.priceUsd.toPrecision(3) : token.priceUsd.toFixed(2)}
                      </div>
                    ) : token.priceSats ? (
                      <div className="text-xs font-mono font-bold text-emerald-400">
                        {token.priceSats} sats
                      </div>
                    ) : null}
                    {token.categoryId && (
                      <div className="text-[10px] font-mono text-zinc-500">
                        {token.categoryId.slice(0, 6)}…{token.categoryId.slice(-4)}
                      </div>
                    )}
                  </div>

                  {isSelected && (
                    <div className="p-1 bg-emerald-500 rounded-full text-black">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}

          {!loading && filteredTokens.length === 0 && (
            <div className="py-10 text-center space-y-2 text-zinc-500">
              <AlertCircle className="w-6 h-6 mx-auto text-zinc-600" />
              <p className="text-xs">No tokens match "{search}"</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
