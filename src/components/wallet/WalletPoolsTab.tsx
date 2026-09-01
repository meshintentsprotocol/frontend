import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Layers,
  TrendingUp,
  Activity,
  RotateCcw,
  RefreshCw,
  PlusCircle,
  ArrowUpRight,
  ExternalLink,
  ChevronRight,
  Zap,
  DollarSign,
  ShieldCheck,
} from 'lucide-react';
import { useMeshServer, type MeshPosition } from '@/hooks/useMeshServer';
import { useWDK } from '@/context/WDKProvider';
import { derivePkh, tokenSymbol, getTokenMetadata } from '@/lib/meshContracts';
import { binToHex, cashAddressToLockingBytecode } from '@bitauth/libauth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
    label: 'Oracle Spot',
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
    label: 'Multi-Pair',
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

interface WalletPoolsTabProps {
  onClose?: () => void;
}

export function WalletPoolsTab({ onClose }: WalletPoolsTabProps) {
  const wdk = useWDK();
  const isConnected = Boolean(wdk.bchAddress || wdk.bchWallet);
  const { positions, loading, refresh, bchUsdPrice } = useMeshServer(12_000);

  const [filterMode, setFilterMode] = useState<'all' | 'mine'>('all');
  const [userPkhHex, setUserPkhHex] = useState<string>('');

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

  const displayedPositions = useMemo(() => {
    return filterMode === 'mine' ? myPositions : positions;
  }, [positions, filterMode, myPositions]);

  // Aggregate total locked in displayed list
  const totalLockedUsd = useMemo(() => {
    const totalSats = displayedPositions.reduce(
      (acc, p) => acc + (Number(p.reserveSats) || 0),
      0,
    );
    return ((totalSats / 1e8) * liveBchPrice).toFixed(0);
  }, [displayedPositions, liveBchPrice]);

  return (
    <div className="space-y-3 pt-2">
      {/* ─── Top Filter & Summary Strip ─── */}
      <div className="flex items-center justify-between gap-2 px-1">
        {/* Toggle Pills */}
        <div className="flex bg-white/[0.04] p-0.5 rounded-lg border border-white/[0.06] text-[10px]">
          <button
            onClick={() => setFilterMode('all')}
            className={cn(
              'px-2.5 py-1 rounded-md transition-all font-semibold',
              filterMode === 'all'
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200',
            )}
          >
            All Network ({positions.length})
          </button>
          <button
            onClick={() => setFilterMode('mine')}
            className={cn(
              'px-2.5 py-1 rounded-md transition-all font-semibold flex items-center gap-1',
              filterMode === 'mine'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-zinc-200',
            )}
          >
            <span>My Pools</span>
            {myPositions.length > 0 && (
              <span className="px-1 text-[9px] rounded-full bg-emerald-400 text-black font-bold">
                {myPositions.length}
              </span>
            )}
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => void refresh()}
            className="p-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors"
            title="Refresh pools"
          >
            <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
          </button>
          <Link
            to="/mesh?tab=create"
            onClick={onClose}
            className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold flex items-center gap-1 transition-all"
          >
            <PlusCircle className="w-3 h-3" />
            <span>New</span>
          </Link>
        </div>
      </div>

      {/* ─── Compact Network TVL Info ─── */}
      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.05] text-[11px]">
        <div className="flex items-center gap-1.5 text-zinc-400">
          <Zap className="w-3.5 h-3.5 text-emerald-400" />
          <span>Mode 4 Shared Depth</span>
        </div>
        <div className="font-mono font-bold text-white">${totalLockedUsd} USD</div>
      </div>

      {/* ─── Positions List ─── */}
      {displayedPositions.length === 0 ? (
        <div className="text-center py-8 px-4 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400">
            <Layers className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="text-xs font-bold text-white">No active liquidity covenants</div>
            <p className="text-[11px] text-zinc-400 max-w-[220px] mx-auto">
              {filterMode === 'mine'
                ? "You haven't deployed any LP strategy covenants yet."
                : 'No network liquidity covenants active.'}
            </p>
          </div>
          <Link
            to="/mesh?tab=create"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-400 hover:bg-emerald-300 text-black font-bold text-xs transition-all shadow-md shadow-emerald-500/20"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Provide Liquidity</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {displayedPositions.map((pos) => {
            const tokenSymIn = tokenSymbol(pos.tokenCategoryIn);
            const tokenSymOut = tokenSymbol(pos.tokenCategoryOut);
            const baseSym = tokenSymOut !== 'BCH' ? 'BCH' : tokenSymIn;
            const quoteSym = tokenSymOut !== 'BCH' ? tokenSymOut : tokenSymIn;

            const baseMeta = getTokenMetadata(baseSym);
            const quoteMeta = getTokenMetadata(quoteSym);

            const bchReserve = satsToBch(pos.reserveSats || 0);
            const usdReserve = (bchReserve * liveBchPrice).toFixed(0);
            const feePercent = (pos.feeBps / 100).toFixed(2);
            const inRange = isInRange(pos, liveBchPrice);

            const meta = COVENANT_META[pos.contractType] || COVENANT_META.StrategyCovenant!;
            const Icon = meta.icon;

            return (
              <div
                key={`${pos.txid}:${pos.vout}`}
                className="p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.06] transition-all group space-y-2.5"
              >
                {/* Top Row: Pair & Badges */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {/* Overlapping Token Circles */}
                    <div className="flex -space-x-1.5 relative">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-[#0A0A0A] flex items-center justify-center overflow-hidden">
                        <img
                          src={baseMeta.icon || '/logos/bitcoin-cash-bch-logo.svg'}
                          alt={baseSym}
                          className="w-3.5 h-3.5"
                        />
                      </div>
                      <div className="w-5 h-5 rounded-full bg-cyan-500/20 border border-[#0A0A0A] flex items-center justify-center font-mono text-[8px] font-bold text-cyan-300">
                        {quoteSym.slice(0, 3)}
                      </div>
                    </div>

                    <span className="font-bold text-xs text-white">
                      {baseSym} / {quoteSym}
                    </span>

                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white/5 text-zinc-400">
                      {feePercent}%
                    </span>
                  </div>

                  {/* In Range status pill */}
                  <div className="flex items-center gap-1">
                    <span
                      className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        inRange ? 'bg-emerald-400' : 'bg-red-400',
                      )}
                    />
                    <span
                      className={cn(
                        'text-[9px] font-mono font-semibold',
                        inRange ? 'text-emerald-400' : 'text-red-400',
                      )}
                    >
                      {inRange ? 'In Range' : 'Out'}
                    </span>
                  </div>
                </div>

                {/* Middle Row: Reserve Values & Strategy */}
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1 text-zinc-400">
                    <span
                      className={cn(
                        'px-1.5 py-0.5 rounded text-[9px] font-mono border flex items-center gap-1',
                        meta.color,
                        meta.bg,
                      )}
                    >
                      <Icon className="w-2.5 h-2.5" />
                      {meta.label}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="font-mono font-bold text-white">${usdReserve}</span>
                    <span className="text-[10px] text-zinc-500 font-mono ml-1">
                      ({bchReserve.toFixed(3)} BCH)
                    </span>
                  </div>
                </div>

                {/* Bottom Row: Actions */}
                <div className="flex items-center justify-between pt-1 border-t border-white/[0.04] text-[10px]">
                  <span className="font-mono text-zinc-500 truncate max-w-[120px]">
                    UTXO: {pos.txid.slice(0, 6)}...
                  </span>

                  <Link
                    to={`/mesh/pool/${pos.txid}/${pos.vout}`}
                    onClick={onClose}
                    className="inline-flex items-center gap-1 font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    <span>Manage Pool</span>
                    <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Footer Hub CTA ─── */}
      <div className="pt-2">
        <Link
          to="/mesh"
          onClick={onClose}
          className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-xs font-semibold text-zinc-300 hover:text-white transition-all group"
        >
          <span>Open Full BCHMesh Hub</span>
          <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-emerald-400 transition-colors" />
        </Link>
      </div>
    </div>
  );
}

export default WalletPoolsTab;
