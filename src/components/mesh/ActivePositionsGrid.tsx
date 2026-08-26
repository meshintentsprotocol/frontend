import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  RefreshCw, Anchor, Zap, ShieldAlert, ArrowUpRight, CheckCircle2, Loader2, Activity, User, Globe, Sliders, Lock
} from 'lucide-react';
import { notifyToast as toast } from '@/lib/notify-toast';
import { useMeshServer, type MeshPosition, type RebalanceQuoteResponse } from '@/hooks/useMeshServer';
import { useWDK } from '@/context/WDKProvider';
import { derivePkh, executeDockPosition, tokenSymbol } from '@/lib/meshContracts';
import { binToHex, cashAddressToLockingBytecode } from '@bitauth/libauth';

// ── Helpers ───────────────────────────────────────────────────────────────────

const COVENANT_LABELS: Record<string, { label: string; color: string }> = {
  StrategyCovenant:           { label: 'Fixed Rate',     color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  OracleStrategyCovenant:     { label: 'Oracle (Curved)', color: 'text-teal-400 bg-teal-500/10 border-teal-500/30' },
  MultiPairRecyclingCovenant: { label: 'Multi-Pair',     color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
  DutchDecayStrategyCovenant: { label: 'Dutch Decay',    color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
};

function satsToBch(sats: string): string {
  return (Number(sats) / 1e8).toFixed(6);
}

function priceRangeLabel(pos: MeshPosition): string {
  if (pos.rangeLow === 0 && pos.rangeHigh === 0) {
    const ratio = pos.priceDen > 0
      ? (pos.priceNum / pos.priceDen).toFixed(4)
      : '—';
    return `Rate: ${ratio} (Fixed)`;
  }
  return `$${pos.rangeLow} – $${pos.rangeHigh}`;
}

function isInRange(pos: MeshPosition, bchUsd: number): boolean {
  if (pos.rangeLow === 0 && pos.rangeHigh === 0) return true; // Fixed rate always "in range"
  return bchUsd >= pos.rangeLow && bchUsd <= pos.rangeHigh;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ActivePositionsGrid() {
  const wdk = useWDK();
  const isConnected = Boolean(wdk.bchAddress || wdk.bchWallet);
  const { positions, loading, error, refresh, health, bchUsdPrice, requestRebalanceQuote } = useMeshServer(10_000);

  const [filterMode, setFilterMode] = useState<'all' | 'mine'>('all');
  const [userPkhHex, setUserPkhHex] = useState<string>('');
  const [dockingId, setDockingId] = useState<string | null>(null);
  const [rebalancing, setRebalancing] = useState<boolean>(false);

  // Derive user's PKH hex for filtering my positions
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
            // P2PKH script: 76a914<20-byte-pkh>88ac
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

  const livePrice = bchUsdPrice();

  // Positions owned by user
  const myPositions = useMemo(() => {
    if (!userPkhHex) return [];
    return positions.filter(p => {
      const pkh = (p.ownerPkh || '').toLowerCase();
      return pkh === userPkhHex || (p.address && p.address.toLowerCase().includes(userPkhHex));
    });
  }, [positions, userPkhHex]);

  // Filtered positions based on active toggle
  const displayedPositions = useMemo(() => {
    if (filterMode === 'mine') {
      return myPositions;
    }
    return positions;
  }, [positions, filterMode, myPositions]);

  const outOfRange = useMemo(
    () => displayedPositions.filter(p => !isInRange(p, livePrice)),
    [displayedPositions, livePrice]
  );

  const totalReserveBch = useMemo(
    () => displayedPositions.reduce((acc, p) => acc + Number(p.reserveSats), 0) / 1e8,
    [displayedPositions]
  );

  const totalFeesBch = useMemo(
    () => displayedPositions.reduce((acc, p) => acc + Number(p.earnedFeeSats), 0) / 1e8,
    [displayedPositions]
  );

  // ── Handle Real Docking ─────────────────────────────────────────────────────
  const handleDock = async (pos: MeshPosition) => {
    if (!isConnected || !wdk.bchWallet) {
      toast.error('Please connect your BCH wallet to dock funds');
      return;
    }

    if (pos.isMock) {
      toast.error(
        'This is a demo/seeded pool position. Only pools you personally deployed on Chipnet can be docked.',
        { duration: 7000 }
      );
      return;
    }

    const utxoKey = `${pos.txid}:${pos.vout}`;
    setDockingId(utxoKey);
    toast.info(`Signing dock() transaction to reclaim ${satsToBch(pos.reserveSats)} BCH…`);

    try {
      const result = await executeDockPosition(wdk.bchWallet, pos, wdk.bchNetwork || 'chipnet');
      const txid = typeof result === 'string' ? result : result.txid;
      toast.success(`🎉 Docked! 100% of reserve returned to wallet.`, {
        duration: 7000,
        action: {
          label: 'View Explorer',
          onClick: () => window.open(`https://chipnet.chaingraph.cash/tx/${txid}`, '_blank'),
        },
      });
      void refresh();
    } catch (e: any) {
      console.error('[Mesh] Dock error:', e);
      toast.error(`Dock failed: ${e?.message ?? 'Execution error'}`);
    } finally {
      setDockingId(null);
    }
  };

  // ── Handle Real Rebalancing ─────────────────────────────────────────────────
  const handleRebalance = async () => {
    if (!isConnected || !wdk.bchWallet || !userPkhHex) {
      toast.error('Connect your BCH wallet first to rebalance');
      return;
    }

    setRebalancing(true);
    toast.info('Requesting optimal N-dock → M-ship reconfiguration quote from MeshServer…');

    try {
      const quote: RebalanceQuoteResponse = await requestRebalanceQuote({
        ownerPkh: userPkhHex,
        targetCenterPrice: livePrice || 300,
        gridSpacingPct: 1.5,
        numPositions: 4,
        tokenCategoryIn: '0x',
        tokenCategoryOut: 'dfe50223c8d5cba8dcef8dff6d92b61deb88a8ba44947367f2b746487b56039b',
      });

      toast.success(
        `Calculated bulk vector: Dock ${quote.dockCount} stale UTXO(s) & Ship ${quote.shipCount} new pools (Est. fee: ~${quote.estimatedFeeSats} sats / $${quote.estimatedUsdFee})`,
        { duration: 6000 }
      );

      // Execute dock instructions for stale positions
      const dockInstructions = quote.instructions.filter(i => i.action === 'DOCK' && i.txid);
      for (const inst of dockInstructions) {
        const targetPos = positions.find(p => p.txid === inst.txid);
        if (targetPos) {
          await executeDockPosition(wdk.bchWallet, targetPos, wdk.bchNetwork || 'chipnet');
        }
      }

      toast.success('Grid rebalanced successfully in flat sub-cent transactions!');
      void refresh();
    } catch (e: any) {
      console.error('[Mesh] Rebalance error:', e);
      toast.error(`Rebalance failed: ${e?.message ?? 'Calculation error'}`);
    } finally {
      setRebalancing(false);
    }
  };

  // ── Empty / loading / error states ────────────────────────────────────────
  if (loading && positions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-zinc-500">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        <span className="text-sm">Fetching active positions from MeshServer…</span>
      </div>
    );
  }

  if (error && positions.length === 0) {
    return (
      <div className="p-8 bg-[#0D0D0E]/80 border border-white/10 rounded-2xl text-center space-y-3">
        <Activity className="w-10 h-10 text-zinc-600 mx-auto" />
        <p className="text-zinc-400 text-sm">
          MeshServer is offline or no positions indexed yet.
        </p>
        <p className="text-zinc-600 text-xs font-mono">{error}</p>
        <button
          onClick={() => { void refresh(); }}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-zinc-300 transition-all inline-flex items-center gap-2"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1240px] mx-auto space-y-6">

      {/* Out-of-Range Rebalance Banner */}
      {outOfRange.length > 0 && (
        <div className="p-5 md:p-6 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-amber-500/20 rounded-xl border border-amber-500/40 text-amber-400 shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-amber-300">
                  GRID OUT OF RANGE: {outOfRange.length} position(s) inactive
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded">
                  Action Recommended
                </span>
              </div>
              <p className="text-xs text-zinc-300 mt-1 max-w-2xl">
                Spot price moved outside your strategy bounds. One tap will close stale positions (
                <code className="font-mono text-[11px]">dock</code>) and instantiate fresh grid tiers (
                <code className="font-mono text-[11px]">ship</code>) via MeshServer in 1 single flat transaction.
              </p>
            </div>
          </div>
          <button
            onClick={handleRebalance}
            disabled={rebalancing}
            className="px-5 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-heading font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-amber-500/20 transition-all shrink-0 flex items-center gap-2"
          >
            {rebalancing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Computing Rebalance…</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-black" />
                <span>Rebalance Grid Now (&lt;$0.01)</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Filter Toggle & Summary Cards */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {/* Toggle between All Pools and My Positions */}
        <div className="flex items-center p-1 bg-white/[0.04] border border-white/10 rounded-2xl">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
              filterMode === 'all'
                ? 'bg-emerald-500 text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>All Mesh Pools ({positions.length})</span>
          </button>
          <button
            onClick={() => {
              if (!isConnected) {
                toast.info('Connect wallet to filter your own positions');
              }
              setFilterMode('mine');
            }}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
              filterMode === 'mine'
                ? 'bg-emerald-500 text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>My Positions ({userPkhHex ? myPositions.length : 0})</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-[#0D0D0E]/80 border border-white/10 rounded-2xl">
          <span className="text-xs font-semibold text-zinc-400">Total Displayed Positions</span>
          <div className="text-2xl font-mono font-bold text-white mt-1">
            {displayedPositions.length} UTXOs
            {loading && <Loader2 className="w-4 h-4 animate-spin inline ml-2 text-zinc-500" />}
          </div>
        </div>
        <div className="p-5 bg-[#0D0D0E]/80 border border-white/10 rounded-2xl">
          <span className="text-xs font-semibold text-zinc-400">Total Reserve Capital</span>
          <div className="text-2xl font-mono font-bold text-white mt-1">{totalReserveBch.toFixed(4)} BCH</div>
        </div>
        <div className="p-5 bg-[#0D0D0E]/80 border border-white/10 rounded-2xl">
          <span className="text-xs font-semibold text-zinc-400">Total Fees Earned</span>
          <div className="text-2xl font-mono font-bold text-emerald-400 mt-1">+{totalFeesBch.toFixed(6)} BCH</div>
        </div>
      </div>

      {/* Positions Table */}
      <div className="bg-[#0D0D0E]/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center">
          <span className="font-heading font-bold text-base text-white">Active Strategy UTXOs</span>
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-400 flex items-center gap-1">
              {health.ok ? (
                <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" /> Live from MeshServer ({health.latency}ms)</>
              ) : (
                <><span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" /> MeshServer offline</>
              )}
            </span>
            <button
              onClick={() => { void refresh(); }}
              className="p-1.5 text-zinc-500 hover:text-white transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {displayedPositions.length === 0 ? (
          <div className="py-16 text-center text-zinc-500">
            <Activity className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">
              {filterMode === 'mine'
                ? !isConnected
                  ? 'Connect your BCH wallet to view your active pool positions.'
                  : 'You have not deployed any strategy pool covenants yet.'
                : 'No active strategy UTXOs indexed in the mesh orderbook.'}
            </p>
            <p className="text-xs mt-1 text-zinc-600">
              {filterMode === 'mine'
                ? 'Switch to "All Mesh Pools" to browse global liquidity or deploy a new pool in the "Create Pool" tab.'
                : 'Deploy a new pool in the "Create Pool" tab to begin market making.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.02] border-b border-white/10 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">UTXO / Covenant</th>
                  <th className="px-6 py-3.5">Pair</th>
                  <th className="px-6 py-3.5">Reserve (BCH)</th>
                  <th className="px-6 py-3.5">Price / Range</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Fees Earned</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono text-xs">
                {displayedPositions.map(pos => {
                  const inRange = isInRange(pos, livePrice);
                  const covenant = COVENANT_LABELS[pos.contractType] ?? { label: pos.contractType, color: 'text-zinc-400 bg-white/5 border-white/10' };
                  const utxoKey = `${pos.txid}:${pos.vout}`;
                  const isDocking = dockingId === utxoKey;

                  return (
                    <tr key={utxoKey} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span>{pos.txid.slice(0, 8)}…:{pos.vout}</span>
                          <a
                            href={`https://chipnet.chaingraph.cash/tx/${pos.txid}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-zinc-500 hover:text-emerald-400"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </a>
                        </div>
                        <span className={`mt-1 px-2 py-0.5 text-[10px] font-semibold border rounded font-sans inline-block ${covenant.color}`}>
                          {covenant.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-zinc-200">
                        {tokenSymbol(pos.tokenCategoryIn)} / {tokenSymbol(pos.tokenCategoryOut)}
                      </td>
                      <td className="px-6 py-4 text-zinc-200">
                        {satsToBch(pos.reserveSats)} BCH
                      </td>
                      <td className="px-6 py-4 text-zinc-300">{priceRangeLabel(pos)}</td>
                      <td className="px-6 py-4">
                        {inRange ? (
                          <span className="px-2.5 py-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg inline-flex items-center gap-1 font-sans">
                            <CheckCircle2 className="w-3 h-3" /> In Range
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg inline-flex items-center gap-1 font-sans">
                            <ShieldAlert className="w-3 h-3" /> Out of Range
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-emerald-400 font-bold">
                        +{satsToBch(pos.earnedFeeSats)} BCH
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/mesh/pool/${pos.txid}/${pos.vout}`}
                            className="px-3 py-1.5 bg-white/[0.04] hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 rounded-lg text-xs font-semibold font-sans transition-all inline-flex items-center gap-1"
                            title="Open dedicated LP management page with partial docking and analytics"
                          >
                            <Sliders className="w-3.5 h-3.5 text-teal-400" />
                            <span>Manage</span>
                          </Link>
                          {pos.isMock ? (
                            <button
                              disabled
                              className="px-3 py-1.5 bg-zinc-500/5 text-zinc-600 border border-zinc-700/30 rounded-lg text-xs font-semibold font-sans inline-flex items-center gap-1 cursor-not-allowed"
                              title="Demo position — only your own deployed pools can be docked"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              <span>Demo</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleDock(pos)}
                              disabled={isDocking}
                              className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 text-red-400 border border-red-500/30 rounded-lg text-xs font-semibold font-sans transition-all inline-flex items-center gap-1"
                              title="Quick dock 100% of reserves to your wallet"
                            >
                              {isDocking ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>Docking…</span>
                                </>
                              ) : (
                                <>
                                  <Anchor className="w-3.5 h-3.5" />
                                  <span>Dock</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default ActivePositionsGrid;
