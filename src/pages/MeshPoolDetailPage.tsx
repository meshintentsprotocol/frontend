import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Header } from '@/components/common/Header';
import { Footer } from '@/components/common/Footer';
import { useMeshServer, type MeshPosition } from '@/hooks/useMeshServer';
import { useWDK } from '@/context/WDKProvider';
import { usePoolFills } from '@/hooks/usePoolFills';
import {
  executeDockPosition,
  executeTopUpPosition,
  fetchLivePoolBalance,
  tokenSymbol,
  getLocalPositionParams,
  type LivePoolBalance,
} from '@/lib/meshContracts';
import { notifyToast as toast } from '@/lib/notify-toast';
import { MeshPoolHeader } from '@/components/mesh/MeshPoolHeader';
import { MeshPoolMetrics } from '@/components/mesh/MeshPoolMetrics';
import { MeshPoolManageCard } from '@/components/mesh/MeshPoolManageCard';
import { MeshPoolActivityTable } from '@/components/mesh/MeshPoolActivityTable';
import {
  ShieldCheck,
  AlertTriangle,
  Loader2,
  ArrowLeft,
  Copy,
  Check,
  Layers,
  Sparkles,
  TrendingUp,
  RotateCcw,
  Activity,
  Zap,
} from 'lucide-react';

export function MeshPoolDetailPage() {
  const { txid, vout } = useParams<{ txid: string; vout: string }>();
  const navigate = useNavigate();
  const wdk = useWDK();
  const isConnected = Boolean(wdk.bchAddress || wdk.bchWallet);
  const { positions, loading: serverLoading, refresh: refreshServer, bchUsdPrice } = useMeshServer(10_000);

  const [isDocking, setIsDocking] = useState<boolean>(false);
  const [isToppingUp, setIsToppingUp] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Live on-chain balance state
  const [liveBalance, setLiveBalance] = useState<LivePoolBalance | null>(null);
  const [isRefreshingBalance, setIsRefreshingBalance] = useState<boolean>(false);

  const voutNum = Number(vout || 0);

  // Match position from live indexer or client cache
  const position = useMemo<MeshPosition | null>(() => {
    if (!txid) return null;
    const found = positions.find((p) => p.txid === txid && p.vout === voutNum);
    if (found) return found;

    const local = getLocalPositionParams(txid);
    if (local) {
      return {
        txid,
        vout: voutNum,
        address: local.address || '',
        contractType: local.contractType || 'StrategyCovenant',
        ownerPkh: local.ownerPkh,
        reserveSats: local.reserveSats || '10000',
        tokenCategoryIn: local.tokenCategoryIn || '0x',
        tokenCategoryOut: local.tokenCategoryOut || '0x',
        tokenAmountIn: local.tokenAmountIn || '0',
        tokenAmountOut: local.tokenAmountOut || '0',
        priceNum: local.priceNum || 300,
        priceDen: local.priceDen || 1,
        feeBps: local.feeBps || 30,
        curveType: local.curveType || 0,
        rangeLow: local.rangeLow || 0,
        rangeHigh: local.rangeHigh || 0,
        startTime: local.startTime,
        duration: local.duration,
        floorPriceNum: local.floorPriceNum,
        oraclePkHex: local.oraclePkHex,
        pairId: local.pairId,
        spreadBps: local.spreadBps,
        earnedFeeSats: '0',
        lastSeenBlock: 220000,
      };
    }

    return null;
  }, [positions, txid, voutNum]);

  // Query live pool on-chain balance
  const refreshLiveBalance = useCallback(async () => {
    if (!position?.address) return;
    setIsRefreshingBalance(true);
    try {
      const bal = await fetchLivePoolBalance(
        position.address,
        (wdk.bchNetwork as any) || 'chipnet'
      );
      setLiveBalance(bal);
    } catch (e) {
      console.warn('[Mesh] Error refreshing live balance:', e);
    } finally {
      setIsRefreshingBalance(false);
    }
  }, [position?.address, wdk.bchNetwork]);

  useEffect(() => {
    void refreshLiveBalance();
    const timer = setInterval(() => {
      void refreshLiveBalance();
    }, 10_000);
    return () => clearInterval(timer);
  }, [refreshLiveBalance]);

  // Fill activity hook
  const {
    fills,
    totalFills,
    totalBchVolume,
    totalFeesEarnedBch,
    loading: fillsLoading,
    refresh: refreshFills,
  } = usePoolFills(position?.address, position?.txid, position?.tokenCategoryOut, 12_000);

  const livePrice = bchUsdPrice() || 324.4;
  const tokenOutName = tokenSymbol(position?.tokenCategoryOut);

  // Effective reserves
  const effectiveReserveSats = liveBalance
    ? liveBalance.satoshis
    : BigInt(position?.reserveSats || '0');

  const effectiveReserveBch = Number(effectiveReserveSats) / 1e8;
  const effectiveReserveUsd = effectiveReserveBch * livePrice;

  const effectiveTokenAmount =
    liveBalance?.tokenAmount && liveBalance.tokenAmount > 0n
      ? liveBalance.tokenAmount
      : BigInt(position?.tokenAmountOut || '0');

  const isDrained = effectiveReserveSats < 546n && effectiveTokenAmount <= 0n;

  // Copy helper
  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    toast.success(`Copied ${label} to clipboard`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Execution: Partial / Full Docking
  const handleDock = async (dockPercent: number) => {
    if (!position || !wdk.bchWallet) {
      toast.error('Connect your BCH wallet to dock this position');
      return;
    }

    if (position.isMock) {
      toast.error(
        'This is a seeded demo position. Deploy your own pool to test live docking on Chipnet.',
        { duration: 8000 }
      );
      return;
    }

    setIsDocking(true);
    const actionLabel = dockPercent === 100 ? '100% Full Dock' : `${dockPercent}% Partial Dock`;
    toast.info(`Executing ${actionLabel} on Chipnet…`);

    try {
      const res = await executeDockPosition(wdk.bchWallet, position, {
        percentToDock: dockPercent,
        network: (wdk.bchNetwork as any) || 'chipnet',
      });

      const dockedBch = (Number(res.dockedSats) / 1e8).toFixed(6);
      const tokenMsg = res.dockedTokens ? ` & ${res.dockedTokens} ${tokenOutName}` : '';

      toast.success(
        `🎉 Successfully docked ${dockedBch} BCH${tokenMsg}! TXID: ${res.txid.slice(0, 10)}…`,
        {
          duration: 9000,
          action: {
            label: 'View on Explorer',
            onClick: () =>
              window.open(`https://chipnet.chaingraph.cash/tx/${res.txid}`, '_blank'),
          },
        }
      );

      // Refresh on-chain balance & server
      await Promise.all([refreshLiveBalance(), refreshServer(), refreshFills()]);

      if (dockPercent === 100 || (res.remainSats && BigInt(res.remainSats) < 546n)) {
        toast.info('Position fully drained and returned to wallet.');
      }
    } catch (e: any) {
      console.error('[Mesh] Dock execution failed:', e);
      toast.error(`Dock failed: ${e?.message ?? 'Unknown error'}`);
    } finally {
      setIsDocking(false);
    }
  };

  // Execution: Top Up Pool Capital
  const handleTopUp = async (amountStr: string) => {
    if (!position || !wdk.bchWallet) {
      toast.error('Connect your BCH wallet to top up this pool');
      return;
    }

    const bchAmount = parseFloat(amountStr);
    if (isNaN(bchAmount) || bchAmount <= 0) {
      toast.error('Enter a valid BCH amount to deposit');
      return;
    }

    setIsToppingUp(true);
    toast.info(`Sending ${bchAmount} BCH to covenant address…`);

    try {
      const txid = await executeTopUpPosition(wdk.bchWallet, position, bchAmount);

      toast.success(
        `🎉 Reserve topped up with ${bchAmount} BCH! TXID: ${txid.slice(0, 10)}…`,
        {
          duration: 8000,
          action: {
            label: 'View on Explorer',
            onClick: () =>
              window.open(`https://chipnet.chaingraph.cash/tx/${txid}`, '_blank'),
          },
        }
      );

      setTimeout(async () => {
        await Promise.all([refreshLiveBalance(), refreshServer(), refreshFills()]);
      }, 3000);
    } catch (e: any) {
      console.error('[Mesh] Top up failed:', e);
      toast.error(`Top up failed: ${e?.message ?? 'Unknown error'}`);
    } finally {
      setIsToppingUp(false);
    }
  };

  const handleSyncAll = async () => {
    await Promise.all([refreshLiveBalance(), refreshServer(), refreshFills()]);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#050505] selection:bg-primary/30 text-foreground overflow-x-hidden">
      <Header />

      <main className="flex-1">
        <div className="container mx-auto p-4 md:p-8 max-w-[1200px] mt-4 space-y-6">
          {serverLoading && !position ? (
            <div className="text-center py-28 space-y-3">
              <Loader2 className="w-10 h-10 animate-spin mx-auto text-teal-400" />
              <p className="text-zinc-400 text-sm font-medium">Loading pool covenant state…</p>
            </div>
          ) : !position ? (
            <div className="p-12 text-center bg-[#0C0C0F] border border-white/10 rounded-3xl space-y-4 max-w-lg mx-auto my-16 shadow-2xl">
              <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
              <h2 className="text-2xl font-bold text-white">Pool Position Not Found</h2>
              <p className="text-zinc-400 text-xs leading-relaxed">
                The requested UTXO (<code className="font-mono text-teal-400">{txid?.slice(0, 10)}…:{vout}</code>) has either been fully docked or has not yet been indexed.
              </p>
              <Link
                to="/mesh"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all shadow-lg"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to Pools</span>
              </Link>
            </div>
          ) : (
            <>
              {/* 1. Uniswap-Style Pool Header */}
              <MeshPoolHeader
                position={position}
                isRefreshing={isRefreshingBalance}
                onRefresh={handleSyncAll}
                isDrained={isDrained}
              />

              {/* 2. Key Metrics Strip */}
              <MeshPoolMetrics
                position={position}
                effectiveReserveBch={effectiveReserveBch}
                effectiveReserveUsd={effectiveReserveUsd}
                effectiveTokenAmount={effectiveTokenAmount}
                liveBchPrice={livePrice}
                totalFills={totalFills}
                totalBchVolume={totalBchVolume}
                totalFeesEarnedBch={totalFeesEarnedBch}
              />

              {/* 3. Main Workstation: 2-Column Uniswap Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Pool Analytics & Covenant Details (7 cols) */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Reserve Composition Bar */}
                  <div className="p-6 bg-gradient-to-br from-[#0D0D10] to-[#121216] border border-white/10 rounded-3xl space-y-4 shadow-xl backdrop-blur-xl">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-white flex items-center gap-2">
                        <Layers className="w-4 h-4 text-emerald-400" />
                        <span>Liquidity Composition</span>
                      </span>
                      <span className="text-zinc-400 font-mono">
                        TVL: ≈ ${(effectiveReserveUsd + (tokenOutName === 'pUSD' ? Number(effectiveTokenAmount) : 0)).toFixed(2)} USD
                      </span>
                    </div>

                    {/* Visual Ratio Progress Bar */}
                    <div className="h-3.5 bg-black/50 rounded-full overflow-hidden flex border border-white/5 p-0.5">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${
                            effectiveTokenAmount > 0n
                              ? Math.max(
                                  10,
                                  Math.min(
                                    90,
                                    (effectiveReserveUsd /
                                      (effectiveReserveUsd + Number(effectiveTokenAmount) + 0.001)) *
                                      100
                                  )
                                )
                              : 100
                          }%`,
                        }}
                      />
                      {effectiveTokenAmount > 0n && (
                        <div className="bg-teal-400 h-full rounded-full flex-1 ml-0.5" />
                      )}
                    </div>

                    {/* Breakdown legend */}
                    <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
                      <div className="p-3 bg-white/[0.02] border border-white/5 rounded-2xl space-y-1">
                        <div className="flex items-center gap-1.5 text-zinc-400">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                          <span>Bitcoin Cash (BCH)</span>
                        </div>
                        <div className="text-base font-black font-mono text-white">
                          {effectiveReserveBch.toFixed(4)}{' '}
                          <span className="text-xs text-zinc-400 font-normal">BCH</span>
                        </div>
                        <div className="text-xs text-emerald-400 font-mono">
                          ≈ ${effectiveReserveUsd.toFixed(2)} USD
                        </div>
                      </div>

                      <div className="p-3 bg-white/[0.02] border border-white/5 rounded-2xl space-y-1">
                        <div className="flex items-center gap-1.5 text-zinc-400">
                          <span className="w-2.5 h-2.5 rounded-full bg-teal-400" />
                          <span>CashToken ({tokenOutName})</span>
                        </div>
                        <div className="text-base font-black font-mono text-white">
                          {effectiveTokenAmount.toString()}{' '}
                          <span className="text-xs text-zinc-400 font-normal">{tokenOutName}</span>
                        </div>
                        <div className="text-xs text-teal-400 font-mono">
                          {tokenOutName === 'pUSD'
                            ? `≈ $${(Number(effectiveTokenAmount) * 1.0).toFixed(2)} USD`
                            : 'Fungible Token'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Covenant Technical Architecture & Parameters */}
                  <div className="p-6 bg-gradient-to-br from-[#0D0D10] to-[#121216] border border-white/10 rounded-3xl space-y-4 shadow-xl backdrop-blur-xl">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>Covenant Technical Parameters</span>
                      </h3>
                      <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Bitcoin Cash VM Enforced
                      </span>
                    </div>

                    <p className="text-xs text-zinc-400 leading-relaxed">
                      This stateless UTXO covenant calculates floor divisions and output recreation
                      checks directly on the Bitcoin Cash VM for each taker fill with zero off-chain counterparty risk.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs font-mono">
                      <div className="p-3 bg-white/[0.02] border border-white/5 rounded-2xl space-y-1">
                        <span className="text-zinc-500 font-sans font-semibold">P2SH32 Address</span>
                        <div className="flex items-center justify-between text-zinc-300">
                          <span className="truncate pr-1">{position.address.slice(0, 16)}…{position.address.slice(-6)}</span>
                          <button
                            onClick={() => copyText(position.address, 'Address')}
                            className="text-zinc-500 hover:text-white shrink-0"
                          >
                            {copiedField === 'Address' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div className="p-3 bg-white/[0.02] border border-white/5 rounded-2xl space-y-1">
                        <span className="text-zinc-500 font-sans font-semibold">Maker Key (Owner PKH)</span>
                        <div className="flex items-center justify-between text-zinc-300">
                          <span className="truncate pr-1">
                            {position.ownerPkh ? `${position.ownerPkh.slice(0, 12)}…${position.ownerPkh.slice(-6)}` : 'Derived from wallet'}
                          </span>
                          {position.ownerPkh && (
                            <button
                              onClick={() => copyText(position.ownerPkh!, 'Owner PKH')}
                              className="text-zinc-500 hover:text-white shrink-0"
                            >
                              {copiedField === 'Owner PKH' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="p-3 bg-white/[0.02] border border-white/5 rounded-2xl space-y-1">
                        <span className="text-zinc-500 font-sans font-semibold">Exchange Rate Ratio</span>
                        <div className="text-white font-bold">
                          {position.priceNum} / {position.priceDen} sats/token (Rate: {(position.priceNum / position.priceDen).toFixed(2)})
                        </div>
                      </div>

                      <div className="p-3 bg-white/[0.02] border border-white/5 rounded-2xl space-y-1">
                        <span className="text-zinc-500 font-sans font-semibold">Maker Fee Config</span>
                        <div className="text-emerald-400 font-bold">
                          {position.feeBps} bps ({(position.feeBps / 100).toFixed(2)}%)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Manage LP Card (Dock & Top-up) (5 cols) */}
                <div className="lg:col-span-5 space-y-6">
                  <MeshPoolManageCard
                    position={position}
                    isConnected={isConnected}
                    isDrained={isDrained}
                    effectiveReserveSats={effectiveReserveSats}
                    effectiveTokenAmount={effectiveTokenAmount}
                    liveBchPrice={livePrice}
                    isDocking={isDocking}
                    isToppingUp={isToppingUp}
                    onDock={handleDock}
                    onTopUp={handleTopUp}
                  />

                  {/* Mode 4 Rebalance & Efficiency Banner */}
                  <div className="p-5 bg-gradient-to-br from-[#0D0D10] to-[#121216] border border-purple-500/20 rounded-3xl space-y-2 text-xs shadow-xl">
                    <div className="flex items-center gap-2 text-purple-400 font-bold">
                      <Sparkles className="w-4 h-4" />
                      <span>Single-Tx Rebalance Advantage</span>
                    </div>
                    <p className="text-zinc-400 leading-relaxed">
                      Because BCHMesh covenants are stateless UTXOs, you can update your price rate, withdraw liquidity, or rebalance your whole grid with a single sub-cent ($0.01) transaction.
                    </p>
                  </div>
                </div>
              </div>

              {/* 4. Full-Width Activity Table (Uniswap Style) */}
              <MeshPoolActivityTable
                fills={fills}
                totalFills={totalFills}
                totalBchVolume={totalBchVolume}
                loading={fillsLoading}
                onRefresh={refreshFills}
              />
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default MeshPoolDetailPage;
