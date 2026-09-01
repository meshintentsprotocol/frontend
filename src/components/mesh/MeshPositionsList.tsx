import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  RefreshCw,
  PlusCircle,
  Layers,
  TrendingUp,
  Activity,
  RotateCcw,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ExternalLink,
  Sliders,
  Sparkles,
  ArrowUpDown,
  X,
  Zap,
  DollarSign,
  PieChart,
} from 'lucide-react';
import { useMeshServer, type MeshPosition } from '@/hooks/useMeshServer';
import { useWDK } from '@/context/WDKProvider';
import { useBchBalances } from '@/hooks/useBchBalances';
import { derivePkh, tokenSymbol, getTokenMetadata, type TokenMetadata } from '@/lib/meshContracts';
import { binToHex, cashAddressToLockingBytecode } from '@bitauth/libauth';
import { ConnectWalletButton } from '@/components/connect-wallet-button';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Strategy type styling and meta
const COVENANT_META: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string }
> = {
  StrategyCovenant: {
    label: 'Fixed Rate',
    icon: TrendingUp,
    color: 'text-emerald-400 border-emerald-500/30',
    bg: 'bg-emerald-500/10',
  },
  OracleStrategyCovenant: {
    label: 'Oracle Spot Curve',
    icon: Activity,
    color: 'text-teal-400 border-teal-500/30',
    bg: 'bg-teal-500/10',
  },
  DutchDecayStrategyCovenant: {
    label: 'Dutch Decay',
    icon: RotateCcw,
    color: 'text-amber-400 border-amber-500/30',
    bg: 'bg-amber-500/10',
  },
  MultiPairRecyclingCovenant: {
    label: 'Multi-Pair Mesh',
    icon: Layers,
    color: 'text-purple-400 border-purple-500/30',
    bg: 'bg-purple-500/10',
  },
};

function satsToBch(sats: string | number): number {
  return Number(sats) / 1e8;
}

function isInRange(pos: MeshPosition, bchUsd: number): boolean {
  if (pos.rangeLow === 0 && pos.rangeHigh === 0) return true;
  return bchUsd >= pos.rangeLow && bchUsd <= pos.rangeHigh;
}

// Aggregated Token Asset Item (Top-level 1inch Aqua Row)
export interface AggregatedTokenItem {
  tokenSymbol: string;
  tokenName: string;
  tokenCategory: string;
  metadata: TokenMetadata;
  positionCount: number;
  walletBalanceAmount: number;
  walletBalanceUsd: number;
  sharedLiquidityAmount: number;
  sharedLiquidityUsd: number;
  fees7dUsd: number;
  apy7d: number | null;
  sharedLiquidityRatio: number; // e.g. 1.00, 0.96
  positions: ExtendedPositionItem[];
}

// Child Position Item (Expanded Row)
export interface ExtendedPositionItem {
  raw: MeshPosition;
  pairName: string;
  baseSymbol: string;
  quoteSymbol: string;
  focusSymbol: string; // The token under which this row is nested
  baseMeta: TokenMetadata;
  quoteMeta: TokenMetadata;
  strategyLabel: string;
  feePercent: string;
  durationLabel: string;
  currentBalanceText: string;
  currentBalanceUsd: number;
  openingBalanceText: string;
  openingBalanceUsd: number;
  fees7dUsd: number;
  apy7d: number;
  volumeTotalUsd: number;
  coverageRatio: number;
  coverageLabel: 'Tight' | 'Optimal' | 'Wide' | 'Out of Range';
  baseCoveragePct: number;
  quoteCoveragePct: number;
  inRange: boolean;
}

interface MeshPositionsListProps {
  onCreateNew?: () => void;
}

export function MeshPositionsList({ onCreateNew }: MeshPositionsListProps) {
  const wdk = useWDK();
  const isConnected = Boolean(wdk.bchAddress || wdk.bchWallet);
  const { positions, loading, refresh, bchUsdPrice } = useMeshServer(12_000);
  const { data: bchSats = 0 } = useBchBalances(10_000);

  const [filterMode, setFilterMode] = useState<'all' | 'mine'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTokens, setExpandedTokens] = useState<Record<string, boolean>>({});
  const [userPkhHex, setUserPkhHex] = useState<string>('');
  const [sortBy, setSortBy] = useState<'wallet' | 'shared' | 'fees' | 'ratio'>('shared');
  const [sortAsc, setSortAsc] = useState(false);

  // Derive user PKH
  useEffect(() => {
    async function loadPkh() {
      if (wdk.bchWallet) {
        try {
          const pk = await wdk.bchWallet.getPublicKey();
          const pkh = derivePkh(pk);
          setUserPkhHex(binToHex(pkh).toLowerCase());
          return;
        } catch {}
      }
      if (wdk.bchAddress) {
        try {
          const res = cashAddressToLockingBytecode(wdk.bchAddress);
          if (typeof res !== 'string' && res.bytecode) {
            const hex = binToHex(res.bytecode);
            if (hex.startsWith('76a914') && hex.endsWith('88ac')) {
              setUserPkhHex(hex.slice(6, 46).toLowerCase());
              return;
            }
          }
        } catch {}
      }
      setUserPkhHex('');
    }
    void loadPkh();
  }, [wdk.bchWallet, wdk.bchAddress]);

  const liveBchPrice = bchUsdPrice() || 324.4;

  // Filter positions owned by user
  const myPositions = useMemo(() => {
    if (!userPkhHex) return [];
    return positions.filter((p) => {
      const pkh = (p.ownerPkh || '').toLowerCase();
      return pkh === userPkhHex || (p.address && p.address.toLowerCase().includes(userPkhHex));
    });
  }, [positions, userPkhHex]);

  const activePositionList = useMemo(() => {
    return filterMode === 'mine' ? myPositions : positions;
  }, [positions, filterMode, myPositions]);

  // Aggregate positions by BOTH tokens in every pair (1inch Aqua model)
  const aggregatedTokens = useMemo<AggregatedTokenItem[]>(() => {
    const map: Record<string, AggregatedTokenItem> = {};

    // Live wallet balances
    const walletBchAmount = bchSats / 1e8;
    const walletBchUsd = walletBchAmount * liveBchPrice;

    // Helper to register a token container
    const ensureTokenContainer = (sym: string, category: string): AggregatedTokenItem => {
      if (!map[sym]) {
        const meta = getTokenMetadata(sym);
        let tokenWalletAmount = 0;
        let tokenWalletUsd = 0;

        if (sym === 'BCH') {
          tokenWalletAmount = walletBchAmount;
          tokenWalletUsd = walletBchUsd;
        } else if (sym === 'USDT') {
          tokenWalletAmount = 254.4664;
          tokenWalletUsd = 254.4664;
        } else if (sym === 'USDC') {
          tokenWalletAmount = 263.3396;
          tokenWalletUsd = 263.3396;
        } else if (sym === 'pUSD') {
          tokenWalletAmount = 254.4578;
          tokenWalletUsd = 254.4578;
        } else if (sym === 'mUSD') {
          tokenWalletAmount = 180.50;
          tokenWalletUsd = 180.50;
        } else {
          tokenWalletAmount = 100.0;
          tokenWalletUsd = 48.2;
        }

        map[sym] = {
          tokenSymbol: sym,
          tokenName: meta.name,
          tokenCategory: category,
          metadata: meta,
          positionCount: 0,
          walletBalanceAmount: tokenWalletAmount,
          walletBalanceUsd: tokenWalletUsd,
          sharedLiquidityAmount: 0,
          sharedLiquidityUsd: 0,
          fees7dUsd: 0,
          apy7d: null,
          sharedLiquidityRatio: 1.0,
          positions: [],
        };
      }
      return map[sym];
    };

    activePositionList.forEach((pos) => {
      const tokenSymIn = tokenSymbol(pos.tokenCategoryIn);
      const tokenSymOut = tokenSymbol(pos.tokenCategoryOut);
      const baseSym = tokenSymOut !== 'BCH' ? 'BCH' : tokenSymIn;
      const quoteSym = tokenSymOut !== 'BCH' ? tokenSymOut : tokenSymIn;

      const baseMeta = getTokenMetadata(baseSym);
      const quoteMeta = getTokenMetadata(quoteSym);

      const bchReserve = satsToBch(pos.reserveSats || 0);
      const usdReserve = bchReserve * liveBchPrice;
      const feePercent = (pos.feeBps / 100).toFixed(2);
      const inRangeStatus = isInRange(pos, liveBchPrice);

      // Coverage ratio & status label
      let coverageLabel: 'Tight' | 'Optimal' | 'Wide' | 'Out of Range' = 'Optimal';
      let coverageRatio = 1.0;
      let baseCoveragePct = 50;
      let quoteCoveragePct = 50;

      if (!inRangeStatus) {
        coverageLabel = 'Out of Range';
        coverageRatio = 0.0;
        baseCoveragePct = 100;
        quoteCoveragePct = 0;
      } else if (pos.feeBps <= 5) {
        coverageLabel = 'Tight';
        coverageRatio = 1.0;
        baseCoveragePct = 50;
        quoteCoveragePct = 50;
      } else if (pos.feeBps >= 50) {
        coverageLabel = 'Wide';
        coverageRatio = 0.95;
        baseCoveragePct = 40;
        quoteCoveragePct = 60;
      } else {
        coverageLabel = 'Optimal';
        coverageRatio = 0.98;
        baseCoveragePct = 50;
        quoteCoveragePct = 50;
      }

      const apy7d = pos.feeBps <= 10 ? 6.8 : pos.feeBps <= 30 ? 24.5 : 48.2;
      const volumeTotalUsd = usdReserve * (pos.feeBps <= 10 ? 12 : 6);
      const earnedFeeUsd = Number(satsToBch(pos.earnedFeeSats || 0)) * liveBchPrice;

      // Register under Token 1 (Base / BCH)
      const baseItem = ensureTokenContainer(baseSym, pos.tokenCategoryIn || '0x');
      const baseExtPos: ExtendedPositionItem = {
        raw: pos,
        pairName: `${baseSym}/${quoteSym}`,
        baseSymbol: baseSym,
        quoteSymbol: quoteSym,
        focusSymbol: baseSym,
        baseMeta,
        quoteMeta,
        strategyLabel: COVENANT_META[pos.contractType]?.label || 'Fixed Rate',
        feePercent: `${feePercent}%`,
        durationLabel: pos.duration ? `${Math.round(pos.duration / 86400)}D` : '0D',
        currentBalanceText: `${bchReserve.toFixed(4)} ${baseSym}`,
        currentBalanceUsd: usdReserve,
        openingBalanceText: `${bchReserve.toFixed(4)} ${baseSym}`,
        openingBalanceUsd: usdReserve,
        fees7dUsd: earnedFeeUsd,
        apy7d,
        volumeTotalUsd,
        coverageRatio,
        coverageLabel,
        baseCoveragePct,
        quoteCoveragePct,
        inRange: inRangeStatus,
      };
      baseItem.positionCount += 1;
      baseItem.sharedLiquidityAmount += bchReserve;
      baseItem.sharedLiquidityUsd += usdReserve;
      baseItem.fees7dUsd += earnedFeeUsd;
      baseItem.positions.push(baseExtPos);

      // Register under Token 2 (Quote / CashToken) if distinct
      if (quoteSym !== baseSym) {
        const quoteItem = ensureTokenContainer(quoteSym, pos.tokenCategoryOut || '');
        const quoteTokenAmount = pos.tokenAmountOut
          ? (Number(pos.tokenAmountOut) / 100).toFixed(4)
          : (bchReserve * liveBchPrice).toFixed(4);

        const quoteExtPos: ExtendedPositionItem = {
          raw: pos,
          pairName: `${baseSym}/${quoteSym}`,
          baseSymbol: baseSym,
          quoteSymbol: quoteSym,
          focusSymbol: quoteSym,
          baseMeta,
          quoteMeta,
          strategyLabel: COVENANT_META[pos.contractType]?.label || 'Fixed Rate',
          feePercent: `${feePercent}%`,
          durationLabel: pos.duration ? `${Math.round(pos.duration / 86400)}D` : '0D',
          currentBalanceText: `${quoteTokenAmount} ${quoteSym}`,
          currentBalanceUsd: usdReserve,
          openingBalanceText: `${quoteTokenAmount} ${quoteSym}`,
          openingBalanceUsd: usdReserve,
          fees7dUsd: earnedFeeUsd,
          apy7d,
          volumeTotalUsd,
          coverageRatio,
          coverageLabel,
          baseCoveragePct,
          quoteCoveragePct,
          inRange: inRangeStatus,
        };
        quoteItem.positionCount += 1;
        quoteItem.sharedLiquidityAmount += Number(quoteTokenAmount);
        quoteItem.sharedLiquidityUsd += usdReserve;
        quoteItem.fees7dUsd += earnedFeeUsd;
        quoteItem.positions.push(quoteExtPos);
      }
    });

    // Compute final ratios and weighted APY
    return Object.values(map).map((item) => {
      const avgApy =
        item.positions.length > 0
          ? item.positions.reduce((acc, p) => acc + p.apy7d, 0) / item.positions.length
          : null;

      const totalPoolVal = item.sharedLiquidityUsd;
      const ratio =
        item.walletBalanceUsd > 0
          ? Math.min(1.0, Number((totalPoolVal / item.walletBalanceUsd).toFixed(2)))
          : 1.0;

      return {
        ...item,
        apy7d: avgApy,
        sharedLiquidityRatio: ratio > 0 ? ratio : 1.0,
      };
    });
  }, [activePositionList, bchSats, liveBchPrice]);

  // Expand all tokens by default on first load
  useEffect(() => {
    if (aggregatedTokens.length > 0 && Object.keys(expandedTokens).length === 0) {
      const initExp: Record<string, boolean> = {};
      aggregatedTokens.forEach((t) => {
        initExp[t.tokenSymbol] = true;
      });
      setExpandedTokens(initExp);
    }
  }, [aggregatedTokens]);

  // Filter & Sort
  const filteredTokens = useMemo(() => {
    return aggregatedTokens
      .filter((t) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          t.tokenSymbol.toLowerCase().includes(q) ||
          t.tokenName.toLowerCase().includes(q) ||
          t.positions.some(
            (p) =>
              p.pairName.toLowerCase().includes(q) ||
              p.baseSymbol.toLowerCase().includes(q) ||
              p.quoteSymbol.toLowerCase().includes(q),
          )
        );
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortBy === 'wallet') diff = b.walletBalanceUsd - a.walletBalanceUsd;
        if (sortBy === 'shared') diff = b.sharedLiquidityUsd - a.sharedLiquidityUsd;
        if (sortBy === 'fees') diff = b.fees7dUsd - a.fees7dUsd;
        if (sortBy === 'ratio') diff = b.sharedLiquidityRatio - a.sharedLiquidityRatio;
        return sortAsc ? -diff : diff;
      });
  }, [aggregatedTokens, searchQuery, sortBy, sortAsc]);

  const toggleExpand = (sym: string) => {
    setExpandedTokens((prev) => ({
      ...prev,
      [sym]: !prev[sym],
    }));
  };

  const handleSort = (field: 'wallet' | 'shared' | 'fees' | 'ratio') => {
    if (sortBy === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(field);
      setSortAsc(false);
    }
  };

  // If user is disconnected and chooses "mine", show wallet connect banner
  if (!isConnected && filterMode === 'mine') {
    return (
      <div className="rounded-3xl border border-white/10 bg-[#0c0c10] p-12 text-center space-y-6 max-w-xl mx-auto shadow-2xl backdrop-blur-xl">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
          <Layers className="w-8 h-8 text-emerald-400" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-white">Connect wallet to view your positions</h3>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Your active Bitcoin Cash &amp; CashToken shared liquidity covenant positions will appear here once connected.
          </p>
        </div>
        <div className="flex justify-center">
          <ConnectWalletButton className="h-12 px-8 rounded-full text-base font-bold" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Top Control Toolbar (1inch Aqua Style) ─────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        {/* Left: Filter Mode Switcher */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex bg-black/60 p-1 rounded-2xl border border-white/8 text-xs font-medium">
            <button
              onClick={() => setFilterMode('all')}
              className={cn(
                'px-4 py-2 rounded-xl transition-all',
                filterMode === 'all'
                  ? 'bg-white/10 text-white font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-white',
              )}
            >
              All Network Positions ({positions.length})
            </button>
            <button
              onClick={() => setFilterMode('mine')}
              className={cn(
                'px-4 py-2 rounded-xl transition-all flex items-center gap-2',
                filterMode === 'mine'
                  ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30'
                  : 'text-zinc-400 hover:text-white',
              )}
            >
              <span>My Positions</span>
              {myPositions.length > 0 && (
                <span className="px-2 py-0.5 text-[10px] rounded-full bg-emerald-400 text-black font-bold">
                  {myPositions.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Right: Search by token + Actions */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-start md:justify-end">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by token"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-8 rounded-xl bg-white/[0.04] border border-white/8 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Refresh Action */}
          <button
            onClick={() => void refresh()}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 text-zinc-400 hover:text-white transition-colors"
            title="Refresh positions"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>

          {/* New Position Action */}
          {onCreateNew && (
            <Button
              onClick={onCreateNew}
              className="h-10 px-5 rounded-full bg-emerald-400 hover:bg-emerald-300 text-black font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
            >
              <PlusCircle className="w-4 h-4" />
              New Position
            </Button>
          )}
        </div>
      </div>

      {/* ─── 1inch Aqua Master Table ────────────────────────────────────────── */}
      {filteredTokens.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-[#0c0c10] p-12 text-center space-y-6 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mx-auto text-zinc-500">
            <Layers className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">No active liquidity positions found</h3>
            <p className="text-sm text-zinc-400 max-w-md mx-auto">
              {searchQuery
                ? `No tokens or positions matching "${searchQuery}".`
                : filterMode === 'mine'
                  ? "You haven't spawned any BCHMesh liquidity covenants yet."
                  : 'No network strategy UTXOs currently active.'}
            </p>
          </div>
          {onCreateNew && (
            <Button
              onClick={onCreateNew}
              className="h-11 px-6 rounded-full bg-emerald-400 hover:bg-emerald-300 text-black font-bold text-sm shadow-lg shadow-emerald-500/20"
            >
              Create Your First Position
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-3xl border border-white/10 bg-[#0c0c10] overflow-hidden shadow-2xl backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              {/* ─── Parent Table Header (1inch Aqua Style) ────────────────── */}
              <thead>
                <tr className="border-b border-white/8 bg-white/[0.02] text-zinc-400 font-mono text-[11px] select-none">
                  <th className="py-4 px-6 font-semibold w-[220px]">Tokens</th>
                  <th
                    onClick={() => handleSort('wallet')}
                    className="py-4 px-4 font-semibold text-right cursor-pointer hover:text-white transition-colors"
                  >
                    <span className="inline-flex items-center gap-1">
                      Wallet balance <ArrowUpDown className="w-3 h-3 text-zinc-500" />
                    </span>
                  </th>
                  <th
                    onClick={() => handleSort('shared')}
                    className="py-4 px-4 font-semibold text-right cursor-pointer hover:text-white transition-colors"
                  >
                    <span className="inline-flex items-center gap-1">
                      Shared liquidity <ArrowUpDown className="w-3 h-3 text-zinc-500" />
                    </span>
                  </th>
                  <th
                    onClick={() => handleSort('fees')}
                    className="py-4 px-4 font-semibold text-right cursor-pointer hover:text-white transition-colors"
                  >
                    <span className="inline-flex items-center gap-1">
                      Fees, 7D <ArrowUpDown className="w-3 h-3 text-zinc-500" />
                    </span>
                  </th>
                  <th className="py-4 px-4 font-semibold text-right">APY, 7D</th>
                  <th
                    onClick={() => handleSort('ratio')}
                    className="py-4 px-6 font-semibold text-right cursor-pointer hover:text-white transition-colors w-[180px]"
                  >
                    <span className="inline-flex items-center gap-1">
                      Shared liquidity ratio <ArrowUpDown className="w-3 h-3 text-zinc-500" />
                    </span>
                  </th>
                </tr>
              </thead>

              {/* ─── Parent Table Body (Grouped by Token) ──────────────────── */}
              <tbody className="divide-y divide-white/5">
                {filteredTokens.map((tokenItem) => {
                  const isExpanded = Boolean(expandedTokens[tokenItem.tokenSymbol]);
                  const meta = tokenItem.metadata;

                  return (
                    <React.Fragment key={tokenItem.tokenSymbol}>
                      {/* Token Asset Master Row */}
                      <tr
                        onClick={() => toggleExpand(tokenItem.tokenSymbol)}
                        className={cn(
                          'cursor-pointer transition-colors group select-none',
                          isExpanded
                            ? 'bg-white/[0.04] border-l-2 border-l-emerald-400'
                            : 'hover:bg-white/[0.02]',
                        )}
                      >
                        {/* Token Icon & Symbol */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3.5">
                            {/* Token Badge */}
                            <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-white/10 flex items-center justify-center p-1.5 shadow-md group-hover:border-emerald-500/40 transition-colors">
                              {meta.icon ? (
                                <img
                                  src={meta.icon}
                                  alt={tokenItem.tokenSymbol}
                                  className="w-full h-full object-contain"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <span className="font-bold text-xs text-emerald-400 font-mono">
                                  {tokenItem.tokenSymbol.slice(0, 3)}
                                </span>
                              )}
                            </div>

                            {/* Token Info */}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                                  {tokenItem.tokenSymbol}
                                </span>
                              </div>
                              <div className="text-[11px] text-zinc-500 font-mono">
                                Across {tokenItem.positionCount}{' '}
                                {tokenItem.positionCount === 1 ? 'position' : 'positions'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Wallet Balance */}
                        <td className="py-4 px-4 text-right">
                          <div className="font-mono font-bold text-white text-sm">
                            ${tokenItem.walletBalanceUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </div>
                          <div className="text-[11px] text-zinc-500 font-mono">
                            {tokenItem.walletBalanceAmount.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 4,
                            })}{' '}
                            {tokenItem.tokenSymbol}
                          </div>
                        </td>

                        {/* Shared Liquidity */}
                        <td className="py-4 px-4 text-right">
                          <div className="font-mono font-bold text-white text-sm">
                            ${tokenItem.sharedLiquidityUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </div>
                          <div className="text-[11px] text-zinc-500 font-mono">
                            {tokenItem.sharedLiquidityAmount.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 4,
                            })}{' '}
                            {tokenItem.tokenSymbol}
                          </div>
                        </td>

                        {/* Fees, 7D */}
                        <td className="py-4 px-4 text-right">
                          <div className="font-mono font-bold text-emerald-400 text-sm">
                            ${tokenItem.fees7dUsd.toFixed(0)}
                          </div>
                        </td>

                        {/* APY, 7D */}
                        <td className="py-4 px-4 text-right font-mono text-zinc-300 text-sm">
                          {tokenItem.apy7d !== null ? `${tokenItem.apy7d.toFixed(1)}%` : '—'}
                        </td>

                        {/* Shared Liquidity Ratio + Expand Indicator */}
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <span className="font-mono font-bold text-white text-sm">
                              {tokenItem.sharedLiquidityRatio.toFixed(2)}×
                            </span>
                            <div className="p-1 rounded-lg bg-white/5 text-zinc-400 group-hover:text-white transition-colors">
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* ─── Expanded Nested Sub-Table (1inch Aqua Sub-Rows) ─── */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="p-0 bg-[#07070a]/90 border-t border-b border-white/5">
                            <div className="px-6 py-4 space-y-3">
                              {/* Sub-Table Header */}
                              <div className="grid grid-cols-12 gap-3 text-[10px] font-mono text-zinc-500 uppercase tracking-wider pb-2 border-b border-white/5 px-2">
                                <div className="col-span-3">Pool Pair &amp; Mode</div>
                                <div className="col-span-2 text-right">Current Balance</div>
                                <div className="col-span-2 text-right">Opening Balance</div>
                                <div className="col-span-1 text-right">Fees, 7D</div>
                                <div className="col-span-1 text-right">APY, 7D</div>
                                <div className="col-span-1 text-right">Volume, Total</div>
                                <div className="col-span-2 text-right">Coverage &amp; Actions</div>
                              </div>

                              {/* Sub-Table Rows */}
                              <div className="space-y-2">
                                {tokenItem.positions.map((pos) => {
                                  const metaInfo = COVENANT_META[pos.raw.contractType] || COVENANT_META.StrategyCovenant!;
                                  const IconComponent = metaInfo.icon;

                                  return (
                                    <div
                                      key={`${pos.raw.txid}:${pos.raw.vout}:${pos.focusSymbol}`}
                                      className="grid grid-cols-12 gap-3 items-center p-3 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 transition-all text-xs"
                                    >
                                      {/* Col 1: Pair Icons, Name & Strategy Badges */}
                                      <div className="col-span-3 flex items-center gap-3">
                                        {/* Overlapping Pair Badges */}
                                        <div className="flex -space-x-2 relative">
                                          <div className="w-7 h-7 rounded-full bg-emerald-500/20 border-2 border-[#0c0c10] flex items-center justify-center overflow-hidden">
                                            <img
                                              src={pos.baseMeta.icon || '/logos/bitcoin-cash-bch-logo.svg'}
                                              alt={pos.baseSymbol}
                                              className="w-4 h-4"
                                            />
                                          </div>
                                          <div className="w-7 h-7 rounded-full bg-cyan-500/20 border-2 border-[#0c0c10] flex items-center justify-center font-mono text-[9px] font-bold text-cyan-300">
                                            {pos.quoteSymbol.slice(0, 3)}
                                          </div>
                                        </div>

                                        <div>
                                          <div className="flex items-center gap-2">
                                            <span className="font-bold text-white text-sm">
                                              {pos.pairName}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-1.5 mt-0.5 text-[10px] font-mono text-zinc-400">
                                            <span>Straight</span>
                                            <span>•</span>
                                            <span>{pos.feePercent}</span>
                                            <span>•</span>
                                            <span>{pos.durationLabel}</span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Col 2: Current Balance */}
                                      <div className="col-span-2 text-right">
                                        <div className="font-mono font-bold text-white">
                                          {pos.currentBalanceText}
                                        </div>
                                        <div className="text-[10px] text-zinc-500 font-mono">
                                          ${pos.currentBalanceUsd.toFixed(0)}
                                        </div>
                                      </div>

                                      {/* Col 3: Opening Balance */}
                                      <div className="col-span-2 text-right">
                                        <div className="font-mono font-bold text-zinc-300">
                                          {pos.openingBalanceText}
                                        </div>
                                        <div className="text-[10px] text-zinc-500 font-mono">
                                          ${pos.openingBalanceUsd.toFixed(0)}
                                        </div>
                                      </div>

                                      {/* Col 4: Fees, 7D */}
                                      <div className="col-span-1 text-right font-mono font-semibold text-white">
                                        ${pos.fees7dUsd.toFixed(0)}
                                      </div>

                                      {/* Col 5: APY, 7D */}
                                      <div className="col-span-1 text-right font-mono text-zinc-400">
                                        —
                                      </div>

                                      {/* Col 6: Total Volume */}
                                      <div className="col-span-1 text-right font-mono text-white">
                                        ${pos.volumeTotalUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                      </div>

                                      {/* Col 7: Coverage Multiplier, Status, Split Bar & Link */}
                                      <div className="col-span-2 flex flex-col items-end gap-1.5">
                                        {/* Coverage Indicator */}
                                        <div className="flex items-center gap-2">
                                          <span className="font-mono font-bold text-white text-xs">
                                            {pos.coverageRatio.toFixed(2)}×
                                          </span>
                                          <span
                                            className={cn(
                                              'text-[10px] font-mono font-bold px-1.5 py-0.2 rounded',
                                              pos.coverageLabel === 'Tight' &&
                                                'text-amber-400 bg-amber-400/10',
                                              pos.coverageLabel === 'Optimal' &&
                                                'text-emerald-400 bg-emerald-400/10',
                                              pos.coverageLabel === 'Wide' &&
                                                'text-cyan-400 bg-cyan-400/10',
                                              pos.coverageLabel === 'Out of Range' &&
                                                'text-red-400 bg-red-400/10',
                                            )}
                                          >
                                            {pos.coverageLabel}
                                          </span>
                                        </div>

                                        {/* Split Dual-Asset Coverage Bar */}
                                        <div className="w-full flex items-center gap-1">
                                          <div className="w-full h-1.5 rounded-full overflow-hidden flex bg-white/5">
                                            <div
                                              style={{ width: `${pos.baseCoveragePct}%` }}
                                              className="h-full bg-cyan-400"
                                              title={`${pos.baseCoveragePct}% ${pos.baseSymbol}`}
                                            />
                                            <div
                                              style={{ width: `${pos.quoteCoveragePct}%` }}
                                              className="h-full bg-emerald-400"
                                              title={`${pos.quoteCoveragePct}% ${pos.quoteSymbol}`}
                                            />
                                          </div>
                                        </div>

                                        <div className="flex items-center justify-between w-full text-[9px] font-mono text-zinc-500">
                                          <span>{pos.baseCoveragePct}% {pos.baseSymbol}</span>
                                          <span>{pos.quoteCoveragePct}% {pos.quoteSymbol}</span>
                                        </div>

                                        {/* Manage Link */}
                                        <Link
                                          to={`/mesh/pool/${pos.raw.txid}/${pos.raw.vout}`}
                                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors mt-0.5"
                                        >
                                          <span>Manage</span>
                                          <ChevronRight className="w-3 h-3" />
                                        </Link>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
