import React, { useState, useMemo } from 'react';
import { PriceRangeChart } from './PriceRangeChart';
import {
  ChevronRight,
  Info,
  Zap,
  TrendingUp,
  Activity,
  RotateCcw,
  Loader2,
  ArrowRightLeft,
  Coins,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { ConnectWalletButton } from '@/components/connect-wallet-button';
import { useWDK } from '@/context/WDKProvider';
import { notifyToast as toast } from '@/lib/notify-toast';
import { useMeshServer } from '@/hooks/useMeshServer';
import {
  TokenSelectModal,
  type MeshToken,
  NATIVE_BCH_TOKEN,
  CHIPNET_DEFAULT_TOKENS,
} from './TokenSelectModal';

export type StrategyType = 'straight' | 'oracle' | 'dutch';
export type DepositMode = 'base_only' | 'quote_only' | 'dual_sided';

const STRATEGY_TYPES: Array<{
  id: StrategyType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
}> = [
  {
    id: 'straight',
    label: 'Straight (Fixed Rate)',
    icon: TrendingUp,
    desc: 'Constant price ratio — StrategyCovenant. Ideal for limit-order-style grid liquidity.',
  },
  {
    id: 'oracle',
    label: 'Curved (Oracle Spot)',
    icon: Activity,
    desc: 'Dynamically tracks Cauldron DEX pool price or Pyth feed — OracleStrategyCovenant.',
  },
  {
    id: 'dutch',
    label: 'Dutch Decay',
    icon: RotateCcw,
    desc: 'Linear price decay from start to floor over time — DutchDecayStrategyCovenant.',
  },
];

export function CreatePositionCard() {
  const wdk = useWDK();
  const isConnected = Boolean(wdk.bchAddress || wdk.evmAddress || wdk.solanaAddress);
  const { bchUsdPrice, getPrice, health, refresh, registerPosition } = useMeshServer(15_000);

  // Pair token states
  const [baseToken, setBaseToken] = useState<MeshToken>(NATIVE_BCH_TOKEN);
  const [quoteToken, setQuoteToken] = useState<MeshToken>(CHIPNET_DEFAULT_TOKENS[1]!); // pUSD default

  // Modals for token selection
  const [selectingTarget, setSelectingTarget] = useState<'base' | 'quote' | null>(null);

  // Strategy configuration
  const [strategyType, setStrategyType] = useState<StrategyType>('straight');
  const [depositMode, setDepositMode]   = useState<DepositMode>('base_only');
  const [feeTier, setFeeTier]           = useState<number>(0.30);
  const [preset, setPreset]             = useState<'10' | '20' | 'custom' | 'full'>('10');

  // Pricing rates
  const [customRate, setCustomRate]     = useState<string>('320'); // sats per quote token or quote per base

  // Amount inputs
  const [baseAmount, setBaseAmount]     = useState<string>('0.005');
  const [quoteAmount, setQuoteAmount]   = useState<string>('15.0');

  // Dutch-specific
  const [dutchStartPct, setDutchStartPct] = useState<number>(20);
  const [dutchDuration, setDutchDuration] = useState<number>(300); // seconds

  // Oracle-specific
  const [spreadBps, setSpreadBps] = useState<number>(50);

  const [spawning, setSpawning] = useState(false);

  // ── Live price data ────────────────────────────────────────────────────────
  const liveBchUsd = bchUsdPrice() || 300;
  const pusdBchEntry = getPrice('pUSD_BCH');

  const currentPrice = useMemo(() => {
    if (baseToken.isNativeBch && quoteToken.symbol === 'pUSD') {
      return liveBchUsd;
    }
    if (quoteToken.priceUsd && baseToken.priceUsd) {
      return baseToken.priceUsd / quoteToken.priceUsd;
    }
    return liveBchUsd;
  }, [baseToken, quoteToken, liveBchUsd]);

  const minPrice =
    preset === '10' ? currentPrice * 0.90
    : preset === '20' ? currentPrice * 0.80
    : preset === 'full' ? 0
    : currentPrice * 0.75;

  const maxPrice =
    preset === '10' ? currentPrice * 1.10
    : preset === '20' ? currentPrice * 1.20
    : preset === 'full' ? currentPrice * 3
    : currentPrice * 1.40;

  // Swap / Invert pair
  const handleInvertPair = () => {
    const temp = baseToken;
    setBaseToken(quoteToken);
    setQuoteToken(temp);
    toast.info(`Swapped pair to ${quoteToken.symbol}/${temp.symbol}`);
  };

  // Quick percentage balance fill
  const handleSetPercent = (target: 'base' | 'quote', pct: number) => {
    if (target === 'base') {
      const val = (0.01 * (pct / 100)).toFixed(4);
      setBaseAmount(val);
    } else {
      const val = (100 * (pct / 100)).toFixed(2);
      setQuoteAmount(val);
    }
  };

  // ── Action: Spawn Strategy Position ─────────────────────────────────────────
  const handleSpawn = async () => {
    if (!isConnected || !wdk.bchWallet) {
      toast.error('Connect your BCH wallet first');
      return;
    }

    setSpawning(true);

    const covenantName =
      strategyType === 'oracle' ? 'OracleStrategyCovenant'
      : strategyType === 'dutch' ? 'DutchDecayStrategyCovenant'
      : 'StrategyCovenant';

    const depositDesc =
      depositMode === 'base_only'
        ? `${baseAmount} ${baseToken.symbol}`
        : depositMode === 'quote_only'
        ? `${quoteAmount} ${quoteToken.symbol}`
        : `${baseAmount} ${baseToken.symbol} + ${quoteAmount} ${quoteToken.symbol}`;

    toast.info(`Deploying ${covenantName} with ${depositDesc} reserve on Chipnet…`);

    try {
      const { deployStrategyPosition, saveLocalPositionParams } = await import('@/lib/meshContracts');
      const ownerPkHex = await wdk.bchWallet.getPublicKey();
      const feeBps = BigInt(Math.round(feeTier * 100));

      const isBaseBch = baseToken.isNativeBch;
      const quoteTokenId = quoteToken.tokenId || 'dfe50223c8d5cba8dcef8dff6d92b61deb88a8ba44947367f2b746487b56039b';

      const baseSats = BigInt(Math.round(parseFloat(baseAmount || '0.001') * 1e8));
      const quoteUnits = BigInt(Math.round(parseFloat(quoteAmount || '1') * 100)); // assuming 2-decimal token

      const priceRatio = currentPrice || 300;
      const priceDen = 10000n;
      // When selling BCH for quoteToken: price in sats per token unit
      const satsPerToken = Math.max(1, Math.round((1e8 / priceRatio) / 100));
      const priceNum = BigInt(satsPerToken);

      const deployedTxids: string[] = [];

      if (depositMode === 'base_only' || depositMode === 'dual_sided') {
        const nowSec = Math.floor(Date.now() / 1000);
        const floorPrice = (priceNum * 80n) / 100n;

        // Deploy BCH reserve pool (sells BCH, receives quote token)
        const res = await deployStrategyPosition(wdk.bchWallet, {
          strategyType,
          ownerPkHex,
          tokenCategoryIn: isBaseBch ? quoteTokenId : '0x',
          tokenCategoryOut: isBaseBch ? '0x' : (baseToken.tokenId || '0x'),
          priceNum,
          priceDen: 1n,
          feeBps,
          reserveSats: baseSats,
          network: wdk.bchNetwork || 'chipnet',
          // Dutch
          startTime: nowSec,
          duration: dutchDuration,
          floorPriceNum: floorPrice,
          // Oracle
          spreadBps: BigInt(spreadBps),
        });
        deployedTxids.push(res.txid);

        const basePosParams = {
          txid: res.txid,
          vout: 0,
          address: res.contractAddress,
          contractType: res.contractType,
          ownerPkh: res.ownerPkh,
          reserveSats: baseSats.toString(),
          tokenCategoryIn: isBaseBch ? quoteTokenId : '0x',
          tokenCategoryOut: isBaseBch ? '0x' : (baseToken.tokenId || '0x'),
          tokenAmountIn: '0',
          tokenAmountOut: '0',
          priceNum: Number(priceNum),
          priceDen: 1,
          feeBps: Number(feeBps),
          curveType: strategyType === 'oracle' ? 1 : strategyType === 'dutch' ? 2 : 0,
          rangeLow: 0,
          rangeHigh: 0,
          startTime: nowSec,
          duration: dutchDuration,
          floorPriceNum: Number(floorPrice),
          spreadBps: Number(spreadBps),
        };

        saveLocalPositionParams(res.txid, basePosParams);
        await registerPosition(basePosParams);
      }

      if (depositMode === 'quote_only' || depositMode === 'dual_sided') {
        const nowSec = Math.floor(Date.now() / 1000);

        // Deploy Quote token reserve pool (sells quote token, receives BCH)
        const resQuote = await deployStrategyPosition(wdk.bchWallet, {
          strategyType,
          ownerPkHex,
          tokenCategoryIn: '0x',
          tokenCategoryOut: quoteTokenId,
          priceNum: 1n,
          priceDen: priceNum,
          feeBps,
          reserveSats: 1500n,
          reserveTokenAmount: quoteUnits,
          network: wdk.bchNetwork || 'chipnet',
        });
        deployedTxids.push(resQuote.txid);

        const quotePosParams = {
          txid: resQuote.txid,
          vout: 0,
          address: resQuote.contractAddress,
          contractType: resQuote.contractType,
          ownerPkh: resQuote.ownerPkh,
          reserveSats: '1500',
          tokenCategoryIn: '0x',
          tokenCategoryOut: quoteTokenId,
          tokenAmountIn: '0',
          tokenAmountOut: quoteUnits.toString(),
          priceNum: 1,
          priceDen: Number(priceNum),
          feeBps: Number(feeBps),
          curveType: strategyType === 'oracle' ? 1 : strategyType === 'dutch' ? 2 : 0,
          rangeLow: 0,
          rangeHigh: 0,
          startTime: nowSec,
          duration: dutchDuration,
          spreadBps: Number(spreadBps),
        };

        saveLocalPositionParams(resQuote.txid, quotePosParams);
        await registerPosition(quotePosParams);
      }

      toast.success(
        `🎉 ${covenantName} deployed on Chipnet! TXID: ${deployedTxids[0]?.slice(0, 10)}…`,
        {
          duration: 7000,
          action: {
            label: 'View on Explorer',
            onClick: () => window.open(`https://chipnet.chaingraph.cash/tx/${deployedTxids[0]}`, '_blank'),
          },
        }
      );

      // Refresh server state to index new position
      void refresh();
    } catch (e: any) {
      console.error('[Mesh] Spawn failed:', e);
      toast.error(`Spawn failed: ${e?.message ?? 'Unknown error'}`);
    } finally {
      setSpawning(false);
    }
  };

  const estimatedGasSats = 1500;
  const estimatedGasUsd = (estimatedGasSats / 1e8) * liveBchUsd;

  return (
    <div className="w-full max-w-[1240px] mx-auto space-y-6">
      {/* ── Main 2-Column Layout ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* ── Left Column: Strategy Type + Liquidity Pair + Fee ─────────────── */}
        <div className="lg:col-span-4 space-y-6">

          {/* Strategy Type Selector */}
          <div className="p-6 bg-[#0D0D0E]/80 backdrop-blur-xl border border-white/10 rounded-3xl shadow-xl space-y-3">
            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
              <span>Strategy Model</span>
              <span className="text-[10px] text-emerald-400 font-mono">BCH Covenants</span>
            </div>
            {STRATEGY_TYPES.map(({ id, label, icon: Icon, desc }) => (
              <button
                key={id}
                onClick={() => setStrategyType(id)}
                className={`w-full p-3.5 rounded-2xl border text-left transition-all space-y-1 ${
                  strategyType === id
                    ? 'bg-emerald-500/10 border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                    : 'bg-white/[0.02] border-white/5 hover:border-white/15'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${strategyType === id ? 'text-emerald-400' : 'text-zinc-400'}`} />
                  <span className={`text-sm font-bold ${strategyType === id ? 'text-white' : 'text-zinc-300'}`}>{label}</span>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">{desc}</p>
              </button>
            ))}
          </div>

          {/* Pair Selector Card with Popups */}
          <div className="p-6 bg-[#0D0D0E]/80 backdrop-blur-xl border border-white/10 rounded-3xl shadow-xl space-y-4">
            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
              <span>Trading Pair</span>
              <span className="text-[11px] font-mono text-zinc-500">Cauldron DEX</span>
            </div>

            {/* Interactive Pair Selector Box */}
            <div className="flex items-center gap-2">
              {/* Base Token Button */}
              <button
                onClick={() => setSelectingTarget('base')}
                className="flex-1 flex items-center justify-between p-3 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-emerald-500/40 rounded-2xl transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  {baseToken.icon ? (
                    <img src={baseToken.icon} alt={baseToken.symbol} className="w-7 h-7 rounded-full object-contain bg-black/40" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-xs">
                      {baseToken.symbol.slice(0, 2)}
                    </div>
                  )}
                  <div className="text-left">
                    <div className="font-bold text-sm text-white group-hover:text-emerald-300 transition-colors">
                      {baseToken.symbol}
                    </div>
                    <div className="text-[10px] text-zinc-500">Base Asset</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
              </button>

              {/* Swap Button */}
              <button
                onClick={handleInvertPair}
                className="p-2.5 bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/40 rounded-2xl text-zinc-400 hover:text-emerald-400 transition-all shrink-0"
                title="Invert pair"
              >
                <ArrowRightLeft className="w-4 h-4" />
              </button>

              {/* Quote Token Button */}
              <button
                onClick={() => setSelectingTarget('quote')}
                className="flex-1 flex items-center justify-between p-3 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-emerald-500/40 rounded-2xl transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  {quoteToken.icon ? (
                    <img src={quoteToken.icon} alt={quoteToken.symbol} className="w-7 h-7 rounded-full object-contain bg-black/40" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-purple-500/20 text-purple-400 font-bold flex items-center justify-center text-xs">
                      {quoteToken.symbol.slice(0, 2)}
                    </div>
                  )}
                  <div className="text-left">
                    <div className="font-bold text-sm text-white group-hover:text-emerald-300 transition-colors">
                      {quoteToken.symbol}
                    </div>
                    <div className="text-[10px] text-zinc-500">Quote Asset</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
              </button>
            </div>

            {/* Live Price Feed Badge */}
            <div className="flex items-center justify-between p-3 bg-black/30 rounded-2xl border border-white/5">
              <span className="text-xs text-zinc-500 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-zinc-400" />
                <span>Reference Spot</span>
                {health.ok && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
              </span>
              <span className="text-xs font-mono font-bold text-emerald-400">
                1 {baseToken.symbol} ≈ ${liveBchUsd.toFixed(2)} USD
              </span>
            </div>

            {/* Fee Tier Selector */}
            <div className="pt-3 border-t border-white/10 space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-zinc-400">LP Fee Tier</span>
                <span className="font-bold text-emerald-400">{feeTier}% ({Math.round(feeTier * 100)} bps)</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[0.05, 0.30, 1.00].map(tier => (
                  <button
                    key={tier}
                    onClick={() => setFeeTier(tier)}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all ${
                      feeTier === tier
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-sm'
                        : 'bg-white/[0.02] border-white/10 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {tier}%
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Column: Chart + Deposit Mode + Amount Cards + Spawn ────── */}
        <div className="lg:col-span-8 space-y-6">
          <div className="p-6 bg-[#0D0D0E]/80 backdrop-blur-xl border border-white/10 rounded-3xl shadow-xl space-y-6">

            {/* Price Range Chart */}
            <PriceRangeChart
              currentPrice={currentPrice}
              minPrice={minPrice}
              maxPrice={maxPrice}
              baseSymbol={baseToken.symbol}
              quoteSymbol={quoteToken.symbol}
            />

            {/* Strategy Parameters (Dutch / Oracle) */}
            {strategyType === 'dutch' && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-white/[0.02] border border-white/10 rounded-2xl">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400">Start Premium Above Spot (%)</label>
                  <input
                    type="number"
                    value={dutchStartPct}
                    onChange={e => setDutchStartPct(Number(e.target.value))}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm font-mono text-white outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400">Decay Duration (Seconds)</label>
                  <input
                    type="number"
                    value={dutchDuration}
                    onChange={e => setDutchDuration(Number(e.target.value))}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm font-mono text-white outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>
            )}

            {strategyType === 'oracle' && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-white/[0.02] border border-white/10 rounded-2xl">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400">Oracle Source</label>
                  <div className="p-2 bg-black/40 border border-white/10 rounded-xl text-xs font-mono text-emerald-400">
                    {pusdBchEntry ? `${pusdBchEntry.source} (${pusdBchEntry.pairName})` : 'Pyth / Cauldron Spot'}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400">Spread Above Spot (bps)</label>
                  <input
                    type="number"
                    value={spreadBps}
                    onChange={e => setSpreadBps(Number(e.target.value))}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm font-mono text-white outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>
            )}

            {/* ── Liquidity Deposit Mode Selector (Single vs Dual Sided) ────── */}
            <div className="space-y-3 pt-2">
              <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                <span>Deposit Liquidity Option</span>
                <span className="text-[11px] text-zinc-500 font-normal">Single-Sided or Pair</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setDepositMode('base_only')}
                  className={`p-3 rounded-2xl border text-center transition-all ${
                    depositMode === 'base_only'
                      ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-md'
                      : 'bg-white/[0.02] border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  <div className="font-bold text-xs">Deposit {baseToken.symbol} Only</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">Provides buy liquidity for {quoteToken.symbol}</div>
                </button>

                <button
                  onClick={() => setDepositMode('quote_only')}
                  className={`p-3 rounded-2xl border text-center transition-all ${
                    depositMode === 'quote_only'
                      ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-md'
                      : 'bg-white/[0.02] border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  <div className="font-bold text-xs">Deposit {quoteToken.symbol} Only</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">Provides buy liquidity for {baseToken.symbol}</div>
                </button>

                <button
                  onClick={() => setDepositMode('dual_sided')}
                  className={`p-3 rounded-2xl border text-center transition-all ${
                    depositMode === 'dual_sided'
                      ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-md'
                      : 'bg-white/[0.02] border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  <div className="font-bold text-xs">Deposit Both</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">Two-sided round-trip mesh</div>
                </button>
              </div>
            </div>

            {/* ── Deposit Amount Cards ──────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Base Token Amount Card */}
              {(depositMode === 'base_only' || depositMode === 'dual_sided') && (
                <div className="p-4 bg-[#050507] border border-white/10 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-zinc-400">Deposit {baseToken.symbol}</span>
                    <div className="flex items-center gap-1">
                      {[25, 50, 75, 100].map(pct => (
                        <button
                          key={pct}
                          onClick={() => handleSetPercent('base', pct)}
                          className="px-2 py-0.5 bg-white/5 hover:bg-white/15 border border-white/10 rounded-md text-[10px] font-mono text-zinc-400 hover:text-white"
                        >
                          {pct === 100 ? 'MAX' : `${pct}%`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <input
                      type="number"
                      value={baseAmount}
                      onChange={e => setBaseAmount(e.target.value)}
                      className="w-full bg-transparent text-xl font-mono font-bold text-white outline-none"
                      placeholder="0.0"
                    />
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {baseToken.icon && (
                        <img src={baseToken.icon} alt={baseToken.symbol} className="w-5 h-5 rounded-full" />
                      )}
                      <span className="text-sm font-bold text-white">{baseToken.symbol}</span>
                    </div>
                  </div>

                  <div className="text-xs font-mono text-zinc-500 text-right">
                    ≈ ${(parseFloat(baseAmount || '0') * liveBchUsd).toFixed(2)} USD
                  </div>
                </div>
              )}

              {/* Quote Token Amount Card */}
              {(depositMode === 'quote_only' || depositMode === 'dual_sided') && (
                <div className="p-4 bg-[#050507] border border-white/10 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-zinc-400">Deposit {quoteToken.symbol}</span>
                    <div className="flex items-center gap-1">
                      {[25, 50, 75, 100].map(pct => (
                        <button
                          key={pct}
                          onClick={() => handleSetPercent('quote', pct)}
                          className="px-2 py-0.5 bg-white/5 hover:bg-white/15 border border-white/10 rounded-md text-[10px] font-mono text-zinc-400 hover:text-white"
                        >
                          {pct === 100 ? 'MAX' : `${pct}%`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <input
                      type="number"
                      value={quoteAmount}
                      onChange={e => setQuoteAmount(e.target.value)}
                      className="w-full bg-transparent text-xl font-mono font-bold text-white outline-none"
                      placeholder="0.0"
                    />
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {quoteToken.icon && (
                        <img src={quoteToken.icon} alt={quoteToken.symbol} className="w-5 h-5 rounded-full" />
                      )}
                      <span className="text-sm font-bold text-white">{quoteToken.symbol}</span>
                    </div>
                  </div>

                  <div className="text-xs font-mono text-zinc-500 text-right">
                    ≈ ${(parseFloat(quoteAmount || '0') * (quoteToken.priceUsd || 1.0)).toFixed(2)} USD
                  </div>
                </div>
              )}
            </div>

            {/* Fee & Network Banner */}
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-emerald-400 font-medium">
                <Zap className="w-4 h-4 fill-emerald-400" />
                <span>On-Chain Deposit (Non-Custodial P2SH32 Covenant)</span>
              </div>
              <span className="font-mono font-bold text-emerald-300">
                ~{estimatedGasSats} sats (~${estimatedGasUsd.toFixed(3)})
              </span>
            </div>

            {/* Spawn Primary Button */}
            {isConnected ? (
              <button
                onClick={handleSpawn}
                disabled={spawning}
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-black font-heading font-black text-base md:text-lg rounded-2xl shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-300 active:scale-[0.99] flex items-center justify-center gap-3"
              >
                {spawning ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Deploying Strategy to Chipnet…
                  </>
                ) : (
                  `Deploy ${baseToken.symbol}/${quoteToken.symbol} Strategy (${depositMode === 'dual_sided' ? '2 Covenants' : '1 Covenant'})`
                )}
              </button>
            ) : (
              <ConnectWalletButton className="w-full h-14 text-base font-bold rounded-2xl" />
            )}
          </div>
        </div>
      </div>

      {/* ── Token Select Modal Popup ──────────────────────────────────────── */}
      <TokenSelectModal
        open={selectingTarget !== null}
        onOpenChange={open => !open && setSelectingTarget(null)}
        onSelect={token => {
          if (selectingTarget === 'base') {
            setBaseToken(token);
          } else if (selectingTarget === 'quote') {
            setQuoteToken(token);
          }
        }}
        selectedToken={selectingTarget === 'base' ? baseToken : quoteToken}
        otherSelectedToken={selectingTarget === 'base' ? quoteToken : baseToken}
        title={selectingTarget === 'base' ? 'Select Base Asset' : 'Select Quote Asset'}
      />
    </div>
  );
}
export default CreatePositionCard;
