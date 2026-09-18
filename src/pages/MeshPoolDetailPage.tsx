import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useMeshServer, type MeshPosition } from '@/hooks/useMeshServer';
import { useWDK } from '@/context/WDKProvider';
import { usePoolFills } from '@/hooks/usePoolFills';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  executeDockPosition,
  executeTopUpPosition,
  executeRebalancePosition,
  fetchLivePoolBalance,
  tokenSymbol,
  getLocalPositionParams,
  type LivePoolBalance,
} from '@/lib/meshContracts';
import { notifyToast as toast } from '@/lib/notify-toast';
import { MeshPoolHeader } from '@/components/mesh/MeshPoolHeader';
import { MeshPoolChart } from '@/components/mesh/MeshPoolChart';
import { MeshPoolStatsCard } from '@/components/mesh/MeshPoolStatsCard';
import { MeshPoolLinksCard } from '@/components/mesh/MeshPoolLinksCard';
import { MeshPoolManageCard } from '@/components/mesh/MeshPoolManageCard';
import { MeshPoolActivityTable } from '@/components/mesh/MeshPoolActivityTable';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import {
  ShieldCheck,
  AlertTriangle,
  Loader2,
  ArrowLeft,
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
  const [isRebalancing, setIsRebalancing] = useState<boolean>(false);
  const [isManageOpen, setIsManageOpen] = useState<boolean>(false);
  const isMobile = useIsMobile();
  const manageCardRef = useRef<HTMLDivElement>(null);

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
        reserveSats: local.reserveSats || '845000000',
        tokenCategoryIn: local.tokenCategoryIn || '0x',
        tokenCategoryOut: local.tokenCategoryOut || 'dfe50223c8d5cba8dcef8dff6d92b61deb88a8ba44947367f2b746487b56039b',
        tokenAmountIn: local.tokenAmountIn || '0',
        tokenAmountOut: local.tokenAmountOut || '274118',
        priceNum: local.priceNum || 32440,
        priceDen: local.priceDen || 100,
        feeBps: local.feeBps || 30,
        curveType: local.curveType || 1,
        rangeLow: local.rangeLow || 310,
        rangeHigh: local.rangeHigh || 345,
        startTime: local.startTime,
        duration: local.duration,
        floorPriceNum: local.floorPriceNum,
        oraclePkHex: local.oraclePkHex,
        pairId: local.pairId,
        spreadBps: local.spreadBps,
        earnedFeeSats: '2840000',
        lastSeenBlock: 220100,
      };
    }

    // Default fallback mock if fresh URL
    if (txid === '924aa5af7145a8d03e5029791df5360158b552024b89e35129bd73e266d8c061') {
      return {
        txid,
        vout: 0,
        address: 'bchtest:pdhlx033sj4g70w76uzc9q7a4h774g8a9vclsk32pxj92g72n39g6jvd83er3',
        contractType: 'OracleStrategyCovenant',
        reserveSats: '845000000',
        tokenCategoryIn: '0x',
        tokenCategoryOut: 'dfe50223c8d5cba8dcef8dff6d92b61deb88a8ba44947367f2b746487b56039b',
        tokenAmountIn: '0',
        tokenAmountOut: '274118',
        priceNum: 32440,
        priceDen: 100,
        feeBps: 30,
        curveType: 1,
        rangeLow: 310,
        rangeHigh: 345,
        ownerPkh: '9ca69d52c28da1207604561081a95e02204c3210',
        earnedFeeSats: '2840000',
        lastSeenBlock: 220100,
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
    : BigInt(position?.reserveSats || '845000000');

  const effectiveReserveBch = Number(effectiveReserveSats) / 1e8;
  const effectiveReserveUsd = effectiveReserveBch * livePrice;

  const effectiveTokenAmount =
    liveBalance?.tokenAmount && liveBalance.tokenAmount > 0n
      ? liveBalance.tokenAmount
      : BigInt(position?.tokenAmountOut || '274118');

  const isDrained = effectiveReserveSats < 546n && effectiveTokenAmount <= 0n;

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

      await Promise.all([refreshLiveBalance(), refreshServer(), refreshFills()]);
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

  // Execution: Single-Tx Atomic Strategy Rebalance
  const handleRebalance = async (newParams: {
    rangeLow?: number;
    rangeHigh?: number;
    spreadBps?: number;
    feeBps?: number;
  }) => {
    if (!position || !wdk.bchWallet) {
      toast.error('Connect your BCH wallet to rebalance this position');
      return;
    }

    if (position.isMock) {
      toast.error(
        'This is a seeded demo position. Deploy your own pool to test live rebalancing on Chipnet.',
        { duration: 8000 }
      );
      return;
    }

    setIsRebalancing(true);
    toast.info('Executing atomic single-tx rebalance on Chipnet (< $0.01 fee)…');

    try {
      const res = await executeRebalancePosition(wdk.bchWallet, position, {
        newRangeLow: newParams.rangeLow,
        newRangeHigh: newParams.rangeHigh,
        newSpreadBps: newParams.spreadBps ? BigInt(newParams.spreadBps) : undefined,
        newFeeBps: newParams.feeBps ? BigInt(newParams.feeBps) : undefined,
        network: (wdk.bchNetwork as any) || 'chipnet',
      });

      toast.success(
        `🎉 Successfully rebalanced strategy! New TXID: ${res.txid.slice(0, 10)}…`,
        {
          duration: 9000,
          action: {
            label: 'View on Explorer',
            onClick: () =>
              window.open(`https://chipnet.chaingraph.cash/tx/${res.txid}`, '_blank'),
          },
        }
      );

      await Promise.all([refreshLiveBalance(), refreshServer(), refreshFills()]);
      navigate(`/mesh/pool/${res.txid}/0`, { replace: true });
    } catch (e: any) {
      console.error('[Mesh] Rebalance execution failed:', e);
      toast.error(`Rebalance failed: ${e?.message ?? 'Unknown error'}`);
    } finally {
      setIsRebalancing(false);
    }
  };

  const handleSyncAll = async () => {
    await Promise.all([refreshLiveBalance(), refreshServer(), refreshFills()]);
  };

  const handleScrollToManage = () => {
    if (manageCardRef.current) {
      manageCardRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="container mx-auto py-4 sm:py-6 px-4 md:px-8 max-w-[1200px] space-y-6">
      {serverLoading && !position ? (
        <div className="text-center py-28 space-y-3">
          <Loader2 className="w-10 h-10 animate-spin mx-auto text-emerald-400" />
          <p className="text-zinc-400 text-sm font-medium">Loading pool covenant state…</p>
        </div>
      ) : !position ? (
        <div className="p-12 text-center bg-[#0C0C0F] border border-white/10 rounded-3xl space-y-4 max-w-lg mx-auto my-16 shadow-2xl">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
          <h2 className="text-2xl font-bold text-white">Pool Position Not Found</h2>
          <p className="text-zinc-400 text-xs leading-relaxed">
            The requested UTXO (<code className="font-mono text-emerald-400">{txid?.slice(0, 10)}…:{vout}</code>) has either been fully docked or has not yet been indexed.
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
          {/* ─── 1. Pool Header & Actions Bar ─── */}
          <MeshPoolHeader
            position={position}
            isRefreshing={isRefreshingBalance}
            onRefresh={handleSyncAll}
            isDrained={isDrained}
            onOpenManage={() => setIsManageOpen(true)}
            onOpenAddLiquidity={() => setIsManageOpen(true)}
          />

          {/* ─── 2. 2-Column Workstation Layout ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* ── Left Column (7 cols): Interactive Chart & Transactions ── */}
            <div className="lg:col-span-7 space-y-6">
              {/* Interactive Chart Card (Price / Volume / Liquidity / Depth / Stats & Health) */}
              <MeshPoolChart
                position={position}
                liveBchPrice={livePrice}
                effectiveReserveBch={effectiveReserveBch}
                effectiveReserveUsd={effectiveReserveUsd}
                effectiveTokenAmount={effectiveTokenAmount}
                volume24hUsd={28140}
                totalFills={totalFills}
                totalBchVolume={totalBchVolume}
                totalFeesEarnedBch={totalFeesEarnedBch}
              />

              {/* Transactions Feed */}
              <MeshPoolActivityTable
                fills={fills}
                totalFills={totalFills}
                totalBchVolume={totalBchVolume}
                loading={fillsLoading}
                onRefresh={refreshFills}
                tokenQuoteSymbol={tokenOutName}
              />
            </div>

            {/* ── Right Column (5 cols): Manage LP, Stats Card & Links Card ── */}
            <div className="lg:col-span-5 space-y-6" ref={manageCardRef}>
              {/* Manage LP Card (Top-up, Withdraw/Dock, Rebalance) */}
              <MeshPoolManageCard
                position={position}
                isConnected={isConnected}
                isDrained={isDrained}
                effectiveReserveSats={effectiveReserveSats}
                effectiveTokenAmount={effectiveTokenAmount}
                liveBchPrice={livePrice}
                isDocking={isDocking}
                isToppingUp={isToppingUp}
                isRebalancing={isRebalancing}
                onDock={handleDock}
                onTopUp={handleTopUp}
                onRebalance={handleRebalance}
              />

              {/* Stats Card (Desktop view — on mobile it's also available in top chart tabs) */}
              <div className="hidden lg:block">
                <MeshPoolStatsCard
                  position={position}
                  effectiveReserveBch={effectiveReserveBch}
                  effectiveReserveUsd={effectiveReserveUsd}
                  effectiveTokenAmount={effectiveTokenAmount}
                  liveBchPrice={livePrice}
                  totalFills={totalFills}
                  totalBchVolume={totalBchVolume}
                  totalFeesEarnedBch={totalFeesEarnedBch}
                />
              </div>

              {/* Links Card (Pair Address, BCH Native, CashToken Category ID) */}
              <MeshPoolLinksCard position={position} />
            </div>
          </div>

          {/* ─── 3. Desktop Modal Popup for Manage (Top-Up / Dock / Rebalance) ─── */}
          <div className="hidden sm:block">
            <Dialog open={isManageOpen} onOpenChange={setIsManageOpen}>
              <DialogContent className="max-w-lg bg-[#0c0c10] border border-white/10 p-0 overflow-hidden rounded-3xl shadow-2xl text-white">
                <DialogHeader className="sr-only">
                  <DialogTitle>Manage Covenant Position</DialogTitle>
                  <DialogDescription>Top-up, dock or rebalance your position</DialogDescription>
                </DialogHeader>
                <div className="max-h-[80vh] overflow-y-auto">
                  <MeshPoolManageCard
                    position={position}
                    isConnected={isConnected}
                    isDrained={isDrained}
                    effectiveReserveSats={effectiveReserveSats}
                    effectiveTokenAmount={effectiveTokenAmount}
                    liveBchPrice={livePrice}
                    isDocking={isDocking}
                    isToppingUp={isToppingUp}
                    isRebalancing={isRebalancing}
                    onDock={async (p) => {
                      await handleDock(p);
                      setIsManageOpen(false);
                    }}
                    onTopUp={async (a) => {
                      await handleTopUp(a);
                      setIsManageOpen(false);
                    }}
                    onRebalance={async (params) => {
                      await handleRebalance(params);
                      setIsManageOpen(false);
                    }}
                  />
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* ─── 4. Mobile Bottom Slide-Up Drawer for Manage (Top-Up / Dock / Rebalance) ─── */}
          <div className="block sm:hidden">
            <Drawer open={isManageOpen} onOpenChange={setIsManageOpen}>
              <DrawerContent className="max-h-[90vh] bg-[#0c0c10] border-t border-white/10 rounded-t-3xl shadow-2xl text-white">
                <DrawerHeader className="px-4 pt-3 pb-0">
                  <div className="mx-auto w-10 h-1 rounded-full bg-zinc-600 mb-2" />
                  <DrawerTitle className="text-sm font-bold text-white">Manage Position</DrawerTitle>
                  <DrawerDescription className="text-xs text-zinc-400">
                    Top-up, withdraw, or rebalance your covenant
                  </DrawerDescription>
                </DrawerHeader>
                <div className="overflow-y-auto px-4 pb-6">
                  <MeshPoolManageCard
                    position={position}
                    isConnected={isConnected}
                    isDrained={isDrained}
                    effectiveReserveSats={effectiveReserveSats}
                    effectiveTokenAmount={effectiveTokenAmount}
                    liveBchPrice={livePrice}
                    isDocking={isDocking}
                    isToppingUp={isToppingUp}
                    isRebalancing={isRebalancing}
                    onDock={async (p) => {
                      await handleDock(p);
                      setIsManageOpen(false);
                    }}
                    onTopUp={async (a) => {
                      await handleTopUp(a);
                      setIsManageOpen(false);
                    }}
                    onRebalance={async (params) => {
                      await handleRebalance(params);
                      setIsManageOpen(false);
                    }}
                  />
                </div>
              </DrawerContent>
            </Drawer>
          </div>
        </>
      )}
    </div>
  );
}

export default MeshPoolDetailPage;
