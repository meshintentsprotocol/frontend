import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useMeshServer, type MeshPosition } from '@/hooks/useMeshServer';
import { useWDK } from '@/context/WDKProvider';
import { usePoolFills } from '@/hooks/usePoolFills';
import {
  executeDockPosition,
  executeTopUpPosition,
  fetchLivePoolBalance,
  tokenSymbol,
  getLocalPositionParams,
  derivePkh,
  toHex,
  type LivePoolBalance,
} from '@/lib/meshContracts';
import { notifyToast as toast } from '@/lib/notify-toast';
import {
  ArrowLeft,
  Layers,
  Activity,
  Zap,
  ExternalLink,
  Copy,
  CheckCircle2,
  TrendingUp,
  RotateCcw,
  ShieldCheck,
  Coins,
  Sliders,
  DollarSign,
  AlertTriangle,
  Loader2,
  Clock,
  ArrowDownToLine,
  PlusCircle,
  Lock,
  RefreshCw,
  BarChart3,
  Flame,
  Check,
  Info,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import { binToHex } from '@bitauth/libauth';

const COVENANT_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bgGlow: string; desc: string }> = {
  StrategyCovenant: {
    label: 'Fixed Rate Strategy',
    icon: TrendingUp,
    color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    bgGlow: 'from-emerald-500/10 to-teal-500/5',
    desc: 'Provides constant-rate limit liquidity. Re-evaluates floor division per swap on Bitcoin Cash VM.',
  },
  OracleStrategyCovenant: {
    label: 'Oracle Spot Curve',
    icon: Activity,
    color: 'text-teal-400 border-teal-500/30 bg-teal-500/10',
    bgGlow: 'from-teal-500/10 to-cyan-500/5',
    desc: 'Dynamically tracks off-chain/on-chain spot price with configured spread and signed oracle attestation.',
  },
  DutchDecayStrategyCovenant: {
    label: 'Dutch Decay Auction',
    icon: RotateCcw,
    color: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    bgGlow: 'from-amber-500/10 to-orange-500/5',
    desc: 'Linearly decays price from start rate to floor rate over auction duration to guarantee discovery.',
  },
  MultiPairRecyclingCovenant: {
    label: 'Multi-Pair Recycling',
    icon: Layers,
    color: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
    bgGlow: 'from-purple-500/10 to-pink-500/5',
    desc: 'Atomically creates reverse liquidity UTXOs upon fill for continuous, perpetual market-making cycles.',
  },
};

type ActiveTab = 'overview' | 'manage' | 'fills' | 'strategy';

export function MeshPoolDetailPage() {
  const { txid, vout } = useParams<{ txid: string; vout: string }>();
  const navigate = useNavigate();
  const wdk = useWDK();
  const isConnected = Boolean(wdk.bchAddress || wdk.bchWallet);
  const { positions, prices, health, loading: serverLoading, refresh: refreshServer, bchUsdPrice } = useMeshServer(10_000);

  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [dockPercent, setDockPercent] = useState<number>(100);
  const [customDockAmountBch, setCustomDockAmountBch] = useState<string>('');
  const [isDocking, setIsDocking] = useState<boolean>(false);
  const [topUpAmount, setTopUpAmount] = useState<string>('0.005');
  const [isToppingUp, setIsToppingUp] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Live balance state
  const [liveBalance, setLiveBalance] = useState<LivePoolBalance | null>(null);
  const [isRefreshingBalance, setIsRefreshingBalance] = useState<boolean>(false);

  const voutNum = Number(vout || 0);

  // Match position from live indexer or client cache
  const position = useMemo<MeshPosition | null>(() => {
    if (!txid) return null;
    const found = positions.find(p => p.txid === txid && p.vout === voutNum);
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
    }, 8_000);
    return () => clearInterval(timer);
  }, [refreshLiveBalance]);

  // Hook for fill history and activity
  const {
    fills,
    totalFills,
    totalBchVolume,
    totalTokenVolume,
    totalFeesEarnedBch,
    loading: fillsLoading,
    refresh: refreshFills,
  } = usePoolFills(position?.address, position?.txid, position?.tokenCategoryOut, 10_000);

  const livePrice = bchUsdPrice();
  const tokenOutName = tokenSymbol(position?.tokenCategoryOut);
  const tokenInName = tokenSymbol(position?.tokenCategoryIn);

  // Compute effective reserve amounts from live on-chain balance or fallback
  const effectiveReserveSats = liveBalance
    ? liveBalance.satoshis
    : BigInt(position?.reserveSats || '0');

  const effectiveReserveBch = Number(effectiveReserveSats) / 1e8;
  const effectiveReserveUsd = effectiveReserveBch * livePrice;

  const effectiveTokenAmount = liveBalance?.tokenAmount && liveBalance.tokenAmount > 0n
    ? liveBalance.tokenAmount
    : BigInt(position?.tokenAmountOut || '0');

  // Copy helper
  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    toast.success(`Copied ${label} to clipboard`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Execution: Partial / Full Docking
  const handleDock = async () => {
    if (!position || !wdk.bchWallet) {
      toast.error('Connect your BCH wallet to dock this position');
      return;
    }

    if (position.isMock) {
      toast.error(
        'This is a seeded demo position. Deploy your own pool using the Create Pool tab to test live docking.',
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
            onClick: () => window.open(`https://chipnet.chaingraph.cash/tx/${res.txid}`, '_blank'),
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
  const handleTopUp = async () => {
    if (!position || !wdk.bchWallet) {
      toast.error('Connect your BCH wallet to top up this pool');
      return;
    }

    const bchAmount = parseFloat(topUpAmount);
    if (isNaN(bchAmount) || bchAmount <= 0) {
      toast.error('Enter a valid BCH amount to deposit');
      return;
    }

    setIsToppingUp(true);
    toast.info(`Sending ${bchAmount} BCH to covenant address…`);

    try {
      const txid = await executeTopUpPosition(wdk.bchWallet, position, bchAmount);

      toast.success(`🎉 Reserve topped up with ${bchAmount} BCH! TXID: ${txid.slice(0, 10)}…`, {
        duration: 8000,
        action: {
          label: 'View on Explorer',
          onClick: () => window.open(`https://chipnet.chaingraph.cash/tx/${txid}`, '_blank'),
        },
      });

      // Poll live balance for confirmation
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

  if (serverLoading && !position) {
    return (
      <div className="container mx-auto p-8 max-w-[1280px] text-center py-28">
        <Loader2 className="w-10 h-10 animate-spin mx-auto text-teal-400 mb-4" />
        <p className="text-zinc-400 text-sm font-sans">Loading pool covenant position…</p>
      </div>
    );
  }

  if (!position) {
    return (
      <div className="container mx-auto p-8 max-w-[1280px] text-center py-28 space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
        <h2 className="text-2xl font-bold text-white font-heading">Pool Position Not Found</h2>
        <p className="text-zinc-400 text-sm max-w-md mx-auto leading-relaxed">
          The requested strategy UTXO (<code className="font-mono text-xs text-teal-400">{txid?.slice(0, 12)}…:{vout}</code>) is either spent or has not yet been indexed by MeshServer.
        </p>
        <Link
          to="/mesh"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all shadow-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Mesh Orderbook</span>
        </Link>
      </div>
    );
  }

  const meta = COVENANT_META[position.contractType] || COVENANT_META.StrategyCovenant;
  const MetaIcon = meta.icon;

  // Withdrawal math calculations
  const withdrawAmountSats = Math.round((Number(effectiveReserveSats) * dockPercent) / 100);
  const withdrawAmountBch = (withdrawAmountSats / 1e8).toFixed(6);
  const remainingAmountBch = Math.max(0, (Number(effectiveReserveSats) - withdrawAmountSats) / 1e8).toFixed(6);

  const withdrawTokenAmount = effectiveTokenAmount > 0n
    ? (effectiveTokenAmount * BigInt(dockPercent)) / 100n
    : 0n;
  const remainingTokenAmount = effectiveTokenAmount > 0n
    ? effectiveTokenAmount - withdrawTokenAmount
    : 0n;

  const isDrained = effectiveReserveSats < 546n && effectiveTokenAmount <= 0n;

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-[1280px] mt-2 space-y-6">
      {/* ── Top Header & Breadcrumb ────────────────────────────────────── */}
      <div className="p-6 bg-gradient-to-r from-zinc-950 via-[#0E0E11] to-zinc-950 border border-white/10 rounded-3xl backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className={`absolute inset-0 bg-gradient-to-br ${meta.bgGlow} opacity-30 pointer-events-none`} />

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/mesh')}
              className="p-2.5 bg-white/[0.04] hover:bg-white/10 border border-white/10 rounded-2xl text-zinc-400 hover:text-white transition-all shadow-md"
              title="Return to Orderbook"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              {/* Token Pair Icons */}
              <div className="flex items-center -space-x-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 border-2 border-zinc-900 flex items-center justify-center text-emerald-400 font-bold text-sm shadow-md">
                  ₿
                </div>
                <div className="w-10 h-10 rounded-full bg-teal-500/20 border-2 border-zinc-900 flex items-center justify-center text-teal-400 font-bold text-xs shadow-md">
                  {tokenOutName === 'pUSD' ? '$' : 'CT'}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-black font-heading text-white tracking-tight">
                    BCH / {tokenOutName} Pool
                  </h1>
                  <span className={`px-3 py-0.5 rounded-full text-xs font-bold border ${meta.color} flex items-center gap-1`}>
                    <MetaIcon className="w-3.5 h-3.5" />
                    <span>{meta.label}</span>
                  </span>
                  {isDrained ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-500/10 border border-red-500/30 text-red-400">
                      ● Drained
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Live on Chipnet</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1">
                  <span>Covenant: <span className="font-mono text-zinc-300">{position.address.slice(0, 16)}…{position.address.slice(-6)}</span></span>
                  <button
                    onClick={() => copyText(position.address, 'Address')}
                    className="hover:text-white transition-colors"
                  >
                    {copiedField === 'Address' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions & Live Refresh */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => { void refreshLiveBalance(); void refreshFills(); }}
              disabled={isRefreshingBalance}
              className="p-2 bg-white/[0.04] hover:bg-white/10 border border-white/10 rounded-xl text-zinc-400 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
              title="Refresh on-chain state"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingBalance ? 'animate-spin text-teal-400' : ''}`} />
              <span className="hidden sm:inline">Sync Chain</span>
            </button>

            <a
              href={`https://chipnet.chaingraph.cash/tx/${position.txid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 bg-white/[0.04] hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white flex items-center gap-1.5 transition-all"
            >
              <span>Explorer</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* ── Navigation Tabs ─────────────────────────────────────────── */}
        <div className="flex items-center gap-1 mt-6 border-t border-white/10 pt-4 overflow-x-auto">
          {[
            { id: 'overview', label: 'Pool Overview', icon: BarChart3 },
            { id: 'manage', label: 'Manage LP & Dock', icon: Sliders },
            { id: 'fills', label: `Fill Activity (${totalFills})`, icon: Activity },
            { id: 'strategy', label: 'Strategy Model', icon: ShieldCheck },
          ].map((tab) => {
            const TabIcon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ActiveTab)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                  active
                    ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                <TabIcon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab 1: Overview ────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Live BCH Reserve */}
            <div className="p-5 bg-gradient-to-br from-[#0D0D10] to-[#121216] border border-white/10 rounded-3xl space-y-1 relative overflow-hidden shadow-xl">
              <div className="flex justify-between items-center text-xs font-semibold text-zinc-400">
                <span>Live BCH Reserve</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              </div>
              <div className="text-2xl font-black font-mono text-white pt-1">
                {effectiveReserveBch.toFixed(6)} <span className="text-xs font-sans text-zinc-400">BCH</span>
              </div>
              <div className="text-xs font-mono text-emerald-400">
                ≈ ${effectiveReserveUsd.toFixed(2)} USD
              </div>
            </div>

            {/* Token Reserve */}
            <div className="p-5 bg-gradient-to-br from-[#0D0D10] to-[#121216] border border-white/10 rounded-3xl space-y-1 relative overflow-hidden shadow-xl">
              <div className="flex justify-between items-center text-xs font-semibold text-zinc-400">
                <span>CashToken Reserve</span>
                <Coins className="w-3.5 h-3.5 text-teal-400" />
              </div>
              <div className="text-2xl font-black font-mono text-white pt-1">
                {effectiveTokenAmount.toString()} <span className="text-xs font-sans text-zinc-400">{tokenOutName}</span>
              </div>
              <div className="text-xs text-zinc-400 font-mono">
                {tokenOutName === 'pUSD' ? `≈ $${(Number(effectiveTokenAmount) * 1.0).toFixed(2)} USD` : 'Fungible CashToken'}
              </div>
            </div>

            {/* Active Exchange Rate */}
            <div className="p-5 bg-gradient-to-br from-[#0D0D10] to-[#121216] border border-white/10 rounded-3xl space-y-1 relative overflow-hidden shadow-xl">
              <div className="flex justify-between items-center text-xs font-semibold text-zinc-400">
                <span>Strategy Rate</span>
                <TrendingUp className="w-3.5 h-3.5 text-teal-400" />
              </div>
              <div className="text-2xl font-black font-mono text-teal-400 pt-1">
                {position.priceDen > 0 ? (position.priceNum / position.priceDen).toFixed(2) : '300.00'}
              </div>
              <div className="text-xs text-zinc-400">
                Maker Fee: {(position.feeBps / 100).toFixed(2)}%
              </div>
            </div>

            {/* Total Accrued Fees */}
            <div className="p-5 bg-gradient-to-br from-[#0D0D10] to-[#121216] border border-white/10 rounded-3xl space-y-1 relative overflow-hidden shadow-xl">
              <div className="flex justify-between items-center text-xs font-semibold text-zinc-400">
                <span>Accrued Swap Fees</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="text-2xl font-black font-mono text-amber-400 pt-1">
                {(Number(position.earnedFeeSats || '0') / 1e8).toFixed(6)} <span className="text-xs font-sans text-zinc-400">BCH</span>
              </div>
              <div className="text-xs text-zinc-400">
                Auto-compounding in pool
              </div>
            </div>
          </div>

          {/* Quick Management Preview & Architecture */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Strategy Covenant Details */}
            <div className="lg:col-span-2 p-6 bg-[#0D0D0E]/80 border border-white/10 rounded-3xl space-y-4 backdrop-blur-xl">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span>Covenant Execution Parameters</span>
              </h3>

              <p className="text-xs text-zinc-400 leading-relaxed">
                {meta.desc} Bitcoin Cash Chipnet VM enforces floor division arithmetic and output recreation checks atomically on every taker swap with zero solver counterparty risk.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs">
                <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl space-y-1">
                  <span className="text-zinc-500 font-semibold">Covenant Address (P2SH32)</span>
                  <div className="flex items-center justify-between font-mono text-zinc-300">
                    <span>{position.address.slice(0, 18)}…{position.address.slice(-6)}</span>
                    <button onClick={() => copyText(position.address, 'Address')} className="text-zinc-500 hover:text-white">
                      {copiedField === 'Address' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl space-y-1">
                  <span className="text-zinc-500 font-semibold">Owner PKH (Maker Key)</span>
                  <div className="flex items-center justify-between font-mono text-zinc-300">
                    <span>{position.ownerPkh ? `${position.ownerPkh.slice(0, 12)}…${position.ownerPkh.slice(-6)}` : 'Derived from wallet'}</span>
                    {position.ownerPkh && (
                      <button onClick={() => copyText(position.ownerPkh!, 'Owner PKH')} className="text-zinc-500 hover:text-white">
                        {copiedField === 'Owner PKH' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl space-y-1">
                  <span className="text-zinc-500 font-semibold">Token In (Deposit)</span>
                  <div className="font-mono text-zinc-300">
                    {position.tokenCategoryIn === '0x' ? 'BCH (Native Satoshis)' : `CashToken (${position.tokenCategoryIn.slice(0, 10)}…)`}
                  </div>
                </div>

                <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl space-y-1">
                  <span className="text-zinc-500 font-semibold">Token Out (Reserve)</span>
                  <div className="font-mono text-zinc-300">
                    {position.tokenCategoryOut === '0x' ? 'BCH (Native Satoshis)' : `${tokenOutName} (${position.tokenCategoryOut.slice(0, 10)}…)`}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions Card */}
            <div className="p-6 bg-gradient-to-br from-[#0D0D10] to-[#121216] border border-emerald-500/20 rounded-3xl space-y-4 shadow-xl flex flex-col justify-between">
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-400" />
                  <span>LP Quick Action</span>
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Manage your capital with 1-click partial withdrawals or add top-up liquidity to increase market making depth.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  onClick={() => setActiveTab('manage')}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <ArrowDownToLine className="w-4 h-4" />
                  <span>Withdraw / Dock LP</span>
                </button>
                <button
                  onClick={() => setActiveTab('manage')}
                  className="w-full py-2.5 bg-white/[0.04] hover:bg-white/10 text-white font-semibold text-xs rounded-xl border border-white/10 transition-all flex items-center justify-center gap-2"
                >
                  <PlusCircle className="w-4 h-4 text-teal-400" />
                  <span>Deposit / Top-up</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 2: Manage LP (Dock & Top-Up) ────────────────────────────── */}
      {activeTab === 'manage' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Docking Card (Unilateral Exit) */}
          <div className="p-6 bg-gradient-to-br from-[#0D0D10] to-[#121216] border border-emerald-500/30 rounded-3xl space-y-5 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ArrowDownToLine className="w-5 h-5 text-emerald-400" />
                <span>Dock Position (Withdraw LP)</span>
              </h3>
              <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                100% Unilateral Exit
              </span>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Withdraw any percentage of your capital and accumulated maker fees back to your wallet instantly with 1 signature. You can execute multiple partial docks until drained.
            </p>

            {/* Percentage Slider & Quick Select Buttons */}
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400">Withdrawal Amount:</span>
                <span className="font-mono font-bold text-emerald-400 text-base">{dockPercent}%</span>
              </div>

              <input
                type="range"
                min="1"
                max="100"
                value={dockPercent}
                onChange={(e) => setDockPercent(Number(e.target.value))}
                className="w-full h-2.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />

              <div className="grid grid-cols-4 gap-2 pt-1">
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setDockPercent(pct)}
                    className={`py-2 text-xs font-mono font-bold rounded-xl border transition-all ${
                      dockPercent === pct
                        ? 'bg-emerald-500 text-black border-emerald-400 shadow-md'
                        : 'bg-white/[0.02] border-white/10 text-zinc-400 hover:text-white hover:bg-white/[0.06]'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            {/* Withdrawal Preview Breakdown */}
            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-2.5 text-xs">
              <div className="flex justify-between text-zinc-400">
                <span>Withdrawing to wallet:</span>
                <span className="font-mono font-bold text-white">{withdrawAmountBch} BCH</span>
              </div>
              {effectiveTokenAmount > 0n && (
                <div className="flex justify-between text-zinc-400">
                  <span>Withdrawing CashTokens:</span>
                  <span className="font-mono font-bold text-teal-400">{withdrawTokenAmount.toString()} {tokenOutName}</span>
                </div>
              )}
              <div className="flex justify-between text-zinc-400">
                <span>Remaining in pool:</span>
                <span className="font-mono text-zinc-300">{remainingAmountBch} BCH {effectiveTokenAmount > 0n ? `+ ${remainingTokenAmount} ${tokenOutName}` : ''}</span>
              </div>
              <div className="flex justify-between text-zinc-500 pt-1.5 border-t border-white/5 text-[11px]">
                <span>Est. Network Fee:</span>
                <span className="font-mono text-emerald-400">&lt; 0.00001 BCH (&lt; $0.01)</span>
              </div>
            </div>

            {/* Execute Dock Button */}
            {position.isMock ? (
              <div className="w-full py-3.5 px-4 bg-zinc-800/50 border border-zinc-700/30 rounded-xl flex items-center justify-center gap-2 text-zinc-500 text-xs font-semibold">
                <Lock className="w-4 h-4 text-zinc-600" />
                <span>Demo Position — Deploy your own pool to unlock docking</span>
              </div>
            ) : (
              <button
                onClick={handleDock}
                disabled={isDocking || !isConnected || isDrained}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-black font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
              >
                {isDocking ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Broadcasting Dock Signature…</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-black" />
                    <span>{dockPercent === 100 ? 'Dock 100% (Close Position)' : `Dock ${dockPercent}% (${withdrawAmountBch} BCH)`}</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Top-up Pool Capital Card */}
          <div className="p-6 bg-gradient-to-br from-[#0D0D10] to-[#121216] border border-teal-500/30 rounded-3xl space-y-5 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-teal-400" />
                <span>Top-up Pool Capital</span>
              </h3>
              <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">
                Deposit Liquidity
              </span>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Deposit additional BCH directly into this covenant address to increase your market making depth. Funds auto-compound into the active strategy.
            </p>

            {/* Quick Preset Buttons */}
            <div className="space-y-2">
              <span className="text-xs text-zinc-400 font-semibold">Select Deposit Preset:</span>
              <div className="grid grid-cols-4 gap-2">
                {['0.001', '0.005', '0.01', '0.05'].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setTopUpAmount(amt)}
                    className={`py-2 text-xs font-mono font-bold rounded-xl border transition-all ${
                      topUpAmount === amt
                        ? 'bg-teal-500 text-black border-teal-400 shadow-md'
                        : 'bg-white/[0.02] border-white/10 text-zinc-400 hover:text-white hover:bg-white/[0.06]'
                    }`}
                  >
                    {amt} BCH
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Input */}
            <div className="space-y-2">
              <span className="text-xs text-zinc-400 font-semibold">Or Enter Custom Amount:</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.001"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  placeholder="0.005"
                  className="flex-1 px-4 py-3 bg-white/[0.04] border border-white/10 rounded-xl text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-teal-500 transition-colors"
                />
                <button
                  onClick={handleTopUp}
                  disabled={isToppingUp || !isConnected}
                  className="px-6 py-3 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-black font-bold text-xs rounded-xl shadow-lg shadow-teal-500/20 transition-all flex items-center gap-1.5"
                >
                  {isToppingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coins className="w-4 h-4" />}
                  <span>Deposit</span>
                </button>
              </div>
            </div>

            {/* Direct Covenant Deposit Info */}
            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-2 text-xs">
              <span className="text-zinc-400 font-semibold">Direct Deposit Address:</span>
              <div className="flex items-center justify-between font-mono text-[11px] text-zinc-300 bg-black/40 p-2.5 rounded-xl border border-white/5">
                <span className="truncate pr-2">{position.address}</span>
                <button onClick={() => copyText(position.address, 'Address')} className="text-zinc-400 hover:text-white shrink-0">
                  {copiedField === 'Address' ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[11px] text-zinc-500 leading-normal">
                Any satoshis sent to this address become part of the covenant reserve automatically upon block confirmation.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 3: Fill Activity Feed ──────────────────────────────────── */}
      {activeTab === 'fills' && (
        <div className="p-6 bg-[#0D0D0E]/90 border border-white/10 rounded-3xl space-y-4 backdrop-blur-xl shadow-2xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-teal-400" />
                <span>Live Swaps &amp; Pool Fill Feed</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Real-time on-chain transaction history for this liquidity covenant on Chipnet.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-zinc-400">Total Fills: <strong className="text-white">{totalFills}</strong></span>
              <span className="text-zinc-400">Total Volume: <strong className="text-emerald-400">{totalBchVolume.toFixed(4)} BCH</strong></span>
            </div>
          </div>

          {fillsLoading ? (
            <div className="py-16 text-center text-zinc-400 text-xs">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-teal-400 mb-2" />
              <span>Scanning on-chain transactions…</span>
            </div>
          ) : fills.length === 0 ? (
            <div className="py-16 text-center text-zinc-500 text-xs space-y-2">
              <Activity className="w-8 h-8 mx-auto text-zinc-600 mb-1" />
              <p>No swap fills executed on this pool yet.</p>
              <p className="text-[11px] text-zinc-600">Run the fill test script or execute a taker swap to generate fill history.</p>
            </div>
          ) : (
            <div className="overflow-x-auto pt-2">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-zinc-400 font-semibold">
                    <th className="pb-3">Event Type</th>
                    <th className="pb-3">Flow In</th>
                    <th className="pb-3">Flow Out</th>
                    <th className="pb-3">Maker Fee Earned</th>
                    <th className="pb-3">Time</th>
                    <th className="pb-3 text-right">Transaction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {fills.map((f) => (
                    <tr key={f.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          f.type === 'SWAP_FILL'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : f.type === 'TOP_UP'
                            ? 'bg-teal-500/10 text-teal-400 border-teal-500/30'
                            : f.type === 'DOCK'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            : 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                        }`}>
                          {f.type}
                        </span>
                      </td>
                      <td className="py-3.5 font-mono text-zinc-300">
                        {f.tokenInAmount} {f.tokenInSymbol}
                      </td>
                      <td className="py-3.5 font-mono text-zinc-300">
                        {f.tokenOutAmount} {f.tokenOutSymbol}
                      </td>
                      <td className="py-3.5 font-mono text-emerald-400">
                        +{(parseInt(f.feeSats, 10) / 1e8).toFixed(6)} BCH
                      </td>
                      <td className="py-3.5 text-zinc-400">
                        {new Date(f.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-3.5 text-right">
                        <a
                          href={f.explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-teal-400 hover:text-teal-300 font-mono text-[11px]"
                        >
                          <span>{f.txid.slice(0, 8)}…</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab 4: Strategy Model & Analytics ─────────────────────────── */}
      {activeTab === 'strategy' && (
        <div className="p-6 bg-[#0D0D0E]/90 border border-white/10 rounded-3xl space-y-6 backdrop-blur-xl shadow-2xl">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span>Strategy Model &amp; Mathematics</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Deep breakdown of strategy mathematics, floor divisions, and VM execution proofs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-1">
              <span className="text-xs text-zinc-500 font-semibold">Strategy Model</span>
              <div className="text-sm font-bold text-white">{meta.label}</div>
              <div className="text-[11px] text-zinc-400">Evaluated on Bitcoin Cash VM</div>
            </div>

            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-1">
              <span className="text-xs text-zinc-500 font-semibold">Effective Price Ratio</span>
              <div className="text-sm font-bold font-mono text-teal-400">
                {position.priceNum} / {position.priceDen} sats/token
              </div>
              <div className="text-[11px] text-zinc-400">Rate: {(position.priceNum / position.priceDen).toFixed(2)}</div>
            </div>

            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-1">
              <span className="text-xs text-zinc-500 font-semibold">Maker Fee Config</span>
              <div className="text-sm font-bold font-mono text-emerald-400">
                {position.feeBps} bps ({(position.feeBps / 100).toFixed(2)}%)
              </div>
              <div className="text-[11px] text-zinc-400">Compounded directly into reserve</div>
            </div>

            {position.contractType === 'DutchDecayStrategyCovenant' && (
              <>
                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-1">
                  <span className="text-xs text-zinc-500 font-semibold">Floor Price</span>
                  <div className="text-sm font-bold font-mono text-amber-400">
                    {position.floorPriceNum ?? ((position.priceNum * 80) / 100)} sats
                  </div>
                  <div className="text-[11px] text-zinc-400">Minimum guaranteed clearing rate</div>
                </div>

                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-1">
                  <span className="text-xs text-zinc-500 font-semibold">Auction Duration</span>
                  <div className="text-sm font-bold font-mono text-white">
                    {position.duration ?? 3600} seconds
                  </div>
                  <div className="text-[11px] text-zinc-400">Linear slope decay</div>
                </div>
              </>
            )}

            {position.contractType === 'OracleStrategyCovenant' && (
              <>
                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-1">
                  <span className="text-xs text-zinc-500 font-semibold">Oracle Spread</span>
                  <div className="text-sm font-bold font-mono text-teal-400">
                    {position.spreadBps ?? 50} bps (0.50%)
                  </div>
                  <div className="text-[11px] text-zinc-400">Applied above/below oracle price</div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MeshPoolDetailPage;
