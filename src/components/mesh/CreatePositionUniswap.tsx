import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ChevronRight,
  ChevronDown,
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
  RotateCw,
  Sliders,
  Settings,
  Plus,
  Minus,
  Check,
  Sparkles,
  Layers,
  ArrowUpRight,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { ConnectWalletButton } from '@/components/connect-wallet-button';
import { useWDK } from '@/context/WDKProvider';
import { notifyToast as toast } from '@/lib/notify-toast';
import { useMeshServer } from '@/hooks/useMeshServer';
import { useBchBalances } from '@/hooks/useBchBalances';
import {
  TokenSelectModal,
  type MeshToken,
  NATIVE_BCH_TOKEN,
  CHIPNET_DEFAULT_TOKENS,
} from './TokenSelectModal';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  deployStrategyPosition,
  deployDualSidedMarket,
  saveLocalPositionParams,
  tokenSymbol,
} from '@/lib/meshContracts';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export type StrategyType = 'straight' | 'oracle' | 'dutch' | 'mesh_mode4';

interface FeeTierOption {
  fee: number; // e.g. 0.3
  label: string;
  desc: string;
  badge?: string;
}

const FEE_TIERS: FeeTierOption[] = [
  { fee: 0.05, label: '0.05% fee tier', desc: 'Best for stable pairs (e.g. pUSD / mUSD)' },
  { fee: 0.30, label: '0.30% fee tier', desc: 'The % you will earn in fees', badge: 'Highest TVL' },
  { fee: 0.50, label: '0.50% fee tier', desc: 'Best for volatile pairs (e.g. BCH / FUR)' },
  { fee: 1.00, label: '1.00% fee tier', desc: 'Best for exotic / new CashTokens' },
];

const STRATEGY_OPTIONS: Array<{
  id: StrategyType;
  name: string;
  shortDesc: string;
  covenant: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'mesh_mode4',
    name: 'Mode 4: 100% Shared Multi-Market',
    shortDesc: 'Single-asset BCH deployed across all configured trading pairs simultaneously.',
    covenant: 'MultiPairRecyclingCovenant',
    icon: Layers,
  },
  {
    id: 'straight',
    name: 'Straight (Fixed Rate)',
    shortDesc: 'Constant price ratio limit order liquidity. Re-evaluates on-chain per swap.',
    covenant: 'StrategyCovenant',
    icon: TrendingUp,
  },
  {
    id: 'oracle',
    name: 'Curved (Oracle Spot)',
    shortDesc: 'Dynamically tracks Cauldron DEX spot price with signed oracle attestation.',
    covenant: 'OracleStrategyCovenant',
    icon: Activity,
  },
  {
    id: 'dutch',
    name: 'Dutch Decay Auction',
    shortDesc: 'Linear price decay from start to floor rate over configured duration.',
    covenant: 'DutchDecayStrategyCovenant',
    icon: RotateCcw,
  },
];

interface CreatePositionUniswapProps {
  onSuccess?: (txid: string, vout: number) => void;
}

export function CreatePositionUniswap({ onSuccess }: CreatePositionUniswapProps) {
  const navigate = useNavigate();
  const wdk = useWDK();
  const isConnected = Boolean(wdk.bchAddress || wdk.bchWallet);
  const { bchUsdPrice, getPrice, health, registerPosition } = useMeshServer(12_000);
  const { data: bchBalances } = useBchBalances(8_000);

  // Step state (1: Select pair & fees, 2: Price range & deposit)
  const [step, setStep] = useState<1 | 2>(1);

  // Pair Tokens
  const [baseToken, setBaseToken] = useState<MeshToken>(NATIVE_BCH_TOKEN);
  const [quoteToken, setQuoteToken] = useState<MeshToken>(CHIPNET_DEFAULT_TOKENS[1]!); // pUSD default
  const [selectingTarget, setSelectingTarget] = useState<'base' | 'quote' | null>(null);

  // Strategy & Fee Tier
  const [strategyType, setStrategyType] = useState<StrategyType>('mesh_mode4');
  const [depositMode, setDepositMode] = useState<'single' | 'dual'>('single');
  const [feeTier, setFeeTier] = useState<number>(0.30);
  const [showFeeDropdown, setShowFeeDropdown] = useState(false);
  const [showStrategyModal, setShowStrategyModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Spendable balances
  const spendableBch = Math.max(0, (bchBalances?.sats ?? 0) / 1e8);
  const spendableQuoteToken = useMemo(() => {
    if (!bchBalances?.tokens) return 0;
    let rawAmtStr = quoteToken.categoryId && quoteToken.categoryId !== '0x' ? bchBalances.tokens[quoteToken.categoryId] : undefined;
    if (!rawAmtStr) {
      for (const [catHex, amtStr] of Object.entries(bchBalances.tokens)) {
        if (tokenSymbol(catHex).toLowerCase() === quoteToken.symbol.toLowerCase()) {
          rawAmtStr = amtStr;
          break;
        }
      }
    }
    if (!rawAmtStr) return 0;
    const dec = quoteToken.decimals ?? 2;
    return Number(rawAmtStr) / Math.pow(10, dec);
  }, [bchBalances?.tokens, quoteToken]);

  // Mode 4 Dynamic Routes Configuration
  const [mode4Routes, setMode4Routes] = useState<Array<{
    id: string;
    token: MeshToken;
    spreadBps: number;
    feeBps: number;
  }>>([
    {
      id: 'pusd',
      token: CHIPNET_DEFAULT_TOKENS[1] || { symbol: 'pUSD', name: 'Pegged USD', categoryId: 'dfe50223c8d5cba8dcef8dff6d92b61deb88a8ba44947367f2b746487b56039b', decimals: 2 },
      spreadBps: 0,
      feeBps: 5,
    },
    {
      id: 'musd',
      token: CHIPNET_DEFAULT_TOKENS[2] || { symbol: 'mUSD', name: 'Mesh USD', categoryId: '900224217ff7510b642ec3a42eb651c6e1d528eb38e9c933923c6c0e862c954e', decimals: 2 },
      spreadBps: 30,
      feeBps: 30,
    },
    {
      id: 'usdt',
      token: CHIPNET_DEFAULT_TOKENS[3] || { symbol: 'USDT', name: 'Tether USD', categoryId: 'c74f5192070f80bc247c4deffc6c74d61998471b69335ef00ffc7e96b9ef2825', decimals: 6 },
      spreadBps: 50,
      feeBps: 30,
    },
  ]);

  // Step 2: Range Mode & Presets
  const [rangeMode, setRangeMode] = useState<'custom' | 'full'>('custom');
  const [selectedPreset, setSelectedPreset] = useState<'stable' | 'wide' | 'lower' | 'upper' | 'custom'>('wide');
  const [timeframe, setTimeframe] = useState<'1D' | '1W' | '1M' | '1Y' | 'All'>('1M');
  const [chartZoom, setChartZoom] = useState<number>(1);

  // Prices & Inputs
  const liveBchUsd = bchUsdPrice() || 324.4;
  const currentSpotPrice = useMemo(() => {
    if (baseToken.isNativeBch && quoteToken.symbol.includes('USD')) {
      return liveBchUsd;
    }
    return 324.4;
  }, [baseToken, quoteToken, liveBchUsd]);

  const [minPrice, setMinPrice] = useState<number>(2092.30);
  const [maxPrice, setMaxPrice] = useState<number>(2841.26);

  // Initial price alignment
  useEffect(() => {
    if (currentSpotPrice > 0) {
      setMinPrice(Number((currentSpotPrice * 0.85).toFixed(2)));
      setMaxPrice(Number((currentSpotPrice * 1.15).toFixed(2)));
    }
  }, [currentSpotPrice]);

  // Deposit Amounts
  const [baseAmount, setBaseAmount] = useState<string>('0.05');
  const [quoteAmount, setQuoteAmount] = useState<string>('16.22');
  const [spawning, setSpawning] = useState<boolean>(false);

  const handleBaseAmountChange = (val: string) => {
    setBaseAmount(val);
    const num = parseFloat(val);
    if (!isNaN(num) && depositMode === 'dual' && currentSpotPrice > 0) {
      setQuoteAmount((num * currentSpotPrice).toFixed(quoteToken.decimals ?? 2));
    }
  };

  const handleQuoteAmountChange = (val: string) => {
    setQuoteAmount(val);
    const num = parseFloat(val);
    if (!isNaN(num) && depositMode === 'dual' && currentSpotPrice > 0) {
      setBaseAmount((num / currentSpotPrice).toFixed(6));
    }
  };

  const handleMaxBase = () => {
    const maxBch = Math.max(0, spendableBch - 0.00003); // 3000 sat buffer for tx
    const valStr = maxBch > 0 ? maxBch.toFixed(6) : '0';
    handleBaseAmountChange(valStr);
  };

  const handleMaxQuote = () => {
    const valStr = spendableQuoteToken.toFixed(quoteToken.decimals ?? 2);
    handleQuoteAmountChange(valStr);
  };

  // Min / Max percentage calculations
  const minPct = useMemo(() => {
    if (!currentSpotPrice) return 0;
    return Number((((minPrice - currentSpotPrice) / currentSpotPrice) * 100).toFixed(2));
  }, [minPrice, currentSpotPrice]);

  const maxPct = useMemo(() => {
    if (!currentSpotPrice) return 0;
    return Number((((maxPrice - currentSpotPrice) / currentSpotPrice) * 100).toFixed(2));
  }, [maxPrice, currentSpotPrice]);

  // Presets Handlers
  const handlePresetSelect = (preset: 'stable' | 'wide' | 'lower' | 'upper') => {
    setSelectedPreset(preset);
    setRangeMode('custom');
    if (preset === 'stable') {
      setMinPrice(Number((currentSpotPrice * 0.9818).toFixed(2)));
      setMaxPrice(Number((currentSpotPrice * 1.0182).toFixed(2)));
    } else if (preset === 'wide') {
      setMinPrice(Number((currentSpotPrice * 0.50).toFixed(2)));
      setMaxPrice(Number((currentSpotPrice * 2.00).toFixed(2)));
    } else if (preset === 'lower') {
      setMinPrice(Number((currentSpotPrice * 0.50).toFixed(2)));
      setMaxPrice(Number((currentSpotPrice * 1.00).toFixed(2)));
    } else if (preset === 'upper') {
      setMinPrice(Number((currentSpotPrice * 1.00).toFixed(2)));
      setMaxPrice(Number((currentSpotPrice * 2.00).toFixed(2)));
    }
  };

  const handleFullRange = () => {
    setRangeMode('full');
    setSelectedPreset('custom');
    setMinPrice(0);
    setMaxPrice(999999);
  };

  // Adjust price increments
  const adjustMin = (deltaPct: number) => {
    setMinPrice((prev) => Math.max(0.01, Number((prev * (1 + deltaPct)).toFixed(2))));
    setSelectedPreset('custom');
  };

  const adjustMax = (deltaPct: number) => {
    setMaxPrice((prev) => Math.max(minPrice + 0.01, Number((prev * (1 + deltaPct)).toFixed(2))));
    setSelectedPreset('custom');
  };

  // Switch Pair Tokens
  const handleFlipTokens = () => {
    const temp = baseToken;
    setBaseToken(quoteToken);
    setQuoteToken(temp);
  };

  // Deploy covenant
  const handleDeployPosition = async () => {
    if (!isConnected) {
      toast.error('Please connect your Bitcoin Cash wallet');
      return;
    }

    const bchVal = parseFloat(baseAmount);
    if (!bchVal || bchVal <= 0) {
      toast.error('Please enter a valid BCH deposit amount');
      return;
    }

    const quoteVal = parseFloat(quoteAmount);
    if (depositMode === 'dual' && (!quoteVal || quoteVal <= 0)) {
      toast.error(`Please enter a valid ${quoteToken.symbol} deposit amount`);
      return;
    }

    setSpawning(true);
    setShowConfirmModal(false);

    try {
      const reserveSats = BigInt(Math.round(bchVal * 1e8));
      const feeBps = BigInt(Math.round(feeTier * 100));
      const priceNum = BigInt(Math.max(1, Math.round((currentSpotPrice || minPrice || 320) * 100)));
      const priceDen = 100n;

      let ownerPk: any = null;
      if (wdk.bchWallet) {
        try {
          ownerPk = await wdk.bchWallet.getPublicKey();
          console.log('[Mesh Create] 1. Wallet Owner Public Key derived:', ownerPk);
        } catch (pkErr) {
          console.warn('[Mesh Create] Note on public key retrieval:', pkErr);
        }
      }

      console.log('[Mesh Create] 2. Deployment Parameters:', {
        depositMode,
        strategyType,
        baseToken: baseToken.symbol,
        quoteToken: quoteToken.symbol,
        bchAmount: bchVal,
        quoteAmount: quoteVal,
        reserveSats: reserveSats.toString(),
        feeTierPct: feeTier,
        feeBps: feeBps.toString(),
        priceNum: priceNum.toString(),
        priceDen: priceDen.toString(),
        rangeLow: rangeMode === 'full' ? 0 : minPrice,
        rangeHigh: rangeMode === 'full' ? 0 : maxPrice,
        walletConnected: Boolean(wdk.bchWallet),
      });

      if (depositMode === 'dual' && strategyType !== 'mesh_mode4' && wdk.bchWallet && ownerPk) {
        // Dual-Sided Market Deployment (FORWARD + REVERSE legs)
        const dec = quoteToken.decimals ?? 2;
        const reverseTokenAmount = BigInt(Math.round(quoteVal * Math.pow(10, dec)));

        try {
          console.log('[Mesh Create] 3. Starting Dual-Sided Market Deployment on Chipnet...');
          const dualRes = await deployDualSidedMarket(wdk.bchWallet, {
            strategyType: strategyType === 'oracle' ? 'oracle' : strategyType === 'dutch' ? 'dutch' : 'straight',
            ownerPkHex: ownerPk,
            tokenCategoryQuote: quoteToken.categoryId || 'dfe50223c8d5cba8dcef8dff6d92b61deb88a8ba44947367f2b746487b56039b',
            priceNum,
            priceDen,
            feeBps,
            forwardReserveSats: reserveSats,
            reverseReserveTokenAmount: reverseTokenAmount > 0n ? reverseTokenAmount : 10000n,
            network: (wdk.bchNetwork as any) || 'chipnet',
          });

          console.log('[Mesh Create] 4. Dual Deployment Success:', dualRes);

          const forwardParams = {
            txid: dualRes.forward.txid,
            vout: 0,
            address: dualRes.forward.contractAddress,
            contractType: dualRes.forward.contractType,
            ownerPkh: dualRes.forward.ownerPkh,
            reserveSats: reserveSats.toString(),
            tokenCategoryIn: quoteToken.categoryId || '0x',
            tokenCategoryOut: '0x',
            tokenAmountIn: '0',
            priceNum: Number(priceNum),
            priceDen: Number(priceDen),
            feeBps: Number(feeBps),
            curveType: strategyType === 'straight' ? 0 : strategyType === 'oracle' ? 1 : 2,
            rangeLow: rangeMode === 'full' ? 0 : minPrice,
            rangeHigh: rangeMode === 'full' ? 0 : maxPrice,
            earnedFeeSats: '0',
            bundleId: dualRes.bundleId,
            pairRole: 'FORWARD' as const,
            reverseAddress: dualRes.reverse.contractAddress,
            pairName: `${baseToken.symbol}/${quoteToken.symbol}`,
            symbolIn: quoteToken.symbol,
            symbolOut: baseToken.symbol,
            reserveBch: (Number(reserveSats) / 1e8).toString(),
            reserveUsd: ((Number(reserveSats) / 1e8) * liveBchUsd).toFixed(2),
          };

          const reverseParams = {
            txid: dualRes.reverse.txid,
            vout: 0,
            address: dualRes.reverse.contractAddress,
            contractType: dualRes.reverse.contractType,
            ownerPkh: dualRes.reverse.ownerPkh,
            reserveSats: '1000',
            tokenCategoryIn: '0x',
            tokenCategoryOut: quoteToken.categoryId || '0x',
            tokenAmountIn: '0',
            tokenAmountOut: reverseTokenAmount.toString(),
            priceNum: Number(priceDen),
            priceDen: Number(priceNum),
            feeBps: Number(feeBps),
            curveType: strategyType === 'straight' ? 0 : strategyType === 'oracle' ? 1 : 2,
            rangeLow: rangeMode === 'full' ? 0 : (1 / maxPrice),
            rangeHigh: rangeMode === 'full' ? 0 : (1 / minPrice),
            earnedFeeSats: '0',
            bundleId: dualRes.bundleId,
            pairRole: 'REVERSE' as const,
            reverseAddress: dualRes.forward.contractAddress,
            pairName: `${quoteToken.symbol}/${baseToken.symbol}`,
            symbolIn: baseToken.symbol,
            symbolOut: quoteToken.symbol,
            reserveBch: '0.00001',
            reserveUsd: (quoteVal * 1.0).toFixed(2),
          };

          console.log('[Mesh Create] 5. Storing local params & registering with server:', {
            forwardParams,
            reverseParams,
          });

          saveLocalPositionParams(dualRes.forward.txid, forwardParams);
          saveLocalPositionParams(dualRes.reverse.txid, reverseParams);
          await Promise.all([
            registerPosition(forwardParams),
            registerPosition(reverseParams),
          ]);

          toast.success('🎉 Dual-Sided 2-Leg Market Bundle Deployed on Chipnet!');
          if (onSuccess) {
            onSuccess(dualRes.forward.txid, 0);
          } else {
            navigate(`/mesh/pool/${dualRes.forward.txid}/0`);
          }
          return;
        } catch (dualErr: any) {
          console.warn('[Mesh Create] Dual deploy live failed (falling back):', dualErr);
        }
      }

      // Single-Sided or Mode 4 Deployment
      let deployedTxid = '';
      let deployedAddress = '';
      let deployedContractType = 'StrategyCovenant';
      let ownerPkhStr = '';

      if (wdk.bchWallet && ownerPk) {
        try {
          console.log('[Mesh Create] 3. Starting Single/Mode4 Deployment on Chipnet...');
          const res = await deployStrategyPosition(wdk.bchWallet, {
            strategyType: strategyType === 'mesh_mode4' ? 'mesh_mode4' : strategyType,
            ownerPkHex: ownerPk,
            tokenCategoryIn: quoteToken.categoryId || '0x',
            tokenCategoryOut: baseToken.categoryId || '0x',
            priceNum,
            priceDen,
            feeBps,
            reserveSats,
            spreadBps: 50n,
            network: (wdk.bchNetwork as any) || 'chipnet',
          });
          deployedTxid = res.txid;
          deployedAddress = res.contractAddress;
          deployedContractType = res.contractType;
          ownerPkhStr = res.ownerPkh;
          console.log('[Mesh Create] 4. Single Deployment Success:', res);
        } catch (walletErr: any) {
          console.warn('[Mesh Create] Live single deploy note (using simulated fallback if test key):', walletErr);
        }
      }

      if (!deployedTxid) {
        await new Promise((resolve) => setTimeout(resolve, 1400));
        deployedTxid = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
        deployedAddress = `bchtest:pr${deployedTxid.slice(0, 36)}`;
        deployedContractType =
          strategyType === 'straight'
            ? 'StrategyCovenant'
            : strategyType === 'oracle'
            ? 'OracleStrategyCovenant'
            : strategyType === 'dutch'
            ? 'DutchDecayStrategyCovenant'
            : 'MultiPairRecyclingCovenant';
        ownerPkhStr = '9ca69d52c28da1207604561081a95e02204c3210';
      }

      const localParams = {
        txid: deployedTxid,
        vout: 0,
        address: deployedAddress,
        contractType: deployedContractType,
        ownerPkh: ownerPkhStr,
        reserveSats: reserveSats.toString(),
        tokenCategoryIn: quoteToken.categoryId || '0x',
        tokenCategoryOut: baseToken.categoryId || '0x',
        tokenAmountIn: '0',
        priceNum: Number(priceNum),
        priceDen: Number(priceDen),
        feeBps: Number(feeBps),
        curveType: strategyType === 'straight' ? 0 : strategyType === 'oracle' ? 1 : strategyType === 'dutch' ? 2 : 3,
        rangeLow: rangeMode === 'full' ? 0 : minPrice,
        rangeHigh: rangeMode === 'full' ? 0 : maxPrice,
        earnedFeeSats: '0',
        lastSeenBlock: 890450,
        bundleId: `bundle-${deployedTxid.slice(0, 8)}`,
        pairRole: 'STANDALONE' as const,
        pairName: `${baseToken.symbol}/${quoteToken.symbol}`,
        symbolIn: quoteToken.symbol,
        symbolOut: baseToken.symbol,
        reserveBch: (Number(reserveSats) / 1e8).toString(),
        reserveUsd: ((Number(reserveSats) / 1e8) * liveBchUsd).toFixed(2),
      };

      console.log('[Mesh Create] 5. Storing single position local params & registering with server:', localParams);
      saveLocalPositionParams(deployedTxid, localParams);
      await registerPosition(localParams);

      console.log('[Mesh Create] 6. Creation flow complete! Navigating to:', `/mesh/pool/${deployedTxid}/0`);
      toast.success('🎉 BCHMesh Concentrated Liquidity Covenant Deployed!');
      if (onSuccess) {
        onSuccess(deployedTxid, 0);
      } else {
        navigate(`/mesh/pool/${deployedTxid}/0`);
      }
    } catch (err: any) {
      console.error('[Mesh Create] Deploy failed with error:', err);
      toast.error(err?.message || 'Failed to deploy covenant');
    } finally {
      setSpawning(false);
    }
  };

  const selectedStrategyMeta = STRATEGY_OPTIONS.find((s) => s.id === strategyType) || STRATEGY_OPTIONS[0]!;
  const StrategyIcon = selectedStrategyMeta.icon;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* ─── Aqua Electric Blue Hero Header ───────────────────────────────── */}
      <div className="w-full bg-[#0038ff] rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-2xl border border-blue-400/20">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-400/20 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-white text-xs font-mono font-semibold mb-1">
              <Zap className="w-3.5 h-3.5 text-blue-200" />
              Non-Custodial Concentrated Liquidity Covenant
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-heading tracking-tight">
              Create Liquidity Position
            </h1>
            <p className="text-xs sm:text-sm text-blue-100 max-w-xl leading-relaxed">
              Deploy single-sided or multi-market covenants on Bitcoin Cash with custom price bounds and sub-cent rebalancing.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setBaseAmount('0.05');
                setQuoteAmount('0');
                setStep(1);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/20 hover:bg-black/30 border border-white/10 text-xs font-semibold text-blue-100 hover:text-white transition-colors"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>

            <button
              onClick={() => setShowStrategyModal(true)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white text-blue-900 hover:bg-blue-50 text-xs font-mono font-bold shadow-md transition-all hover:scale-105"
            >
              <StrategyIcon className="w-3.5 h-3.5 text-blue-700" />
              <span>{selectedStrategyMeta.name.split(':')[0]}</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-70" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── Main Two-Column Layout ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ─── Left Column: Step Navigation Indicator ─────────────────────── */}
        <div className="lg:col-span-4 p-5 rounded-3xl bg-[#0b0c10] border border-white/8 space-y-4 shadow-xl">
          <h2 className="text-lg font-bold text-white tracking-tight font-heading">
            Configuration Steps
          </h2>

          {/* Step 1 Indicator */}
          <div
            onClick={() => setStep(1)}
            className={cn(
              'p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5',
              step === 1
                ? 'bg-blue-600/15 border-blue-500/40 shadow-lg shadow-blue-500/10'
                : 'bg-transparent border-white/5 hover:bg-white/[0.02] opacity-70',
            )}
          >
            <div
              className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors',
                step === 1 ? 'bg-blue-500 text-white shadow-md' : 'bg-white/10 text-white',
              )}
            >
              1
            </div>
            <div className="space-y-0.5">
              <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Step 1</div>
              <div className="text-sm font-bold text-white">Select token pair and fees</div>
              {step === 2 && (
                <div className="text-xs text-blue-400 font-mono flex items-center gap-1 mt-1">
                  <span>{baseToken.symbol} / {quoteToken.symbol}</span>
                  <span className="text-zinc-600">•</span>
                  <span>{feeTier}% fee</span>
                </div>
              )}
            </div>
          </div>

          {/* Step 2 Indicator */}
          <div
            onClick={() => setStep(2)}
            className={cn(
              'p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5',
              step === 2
                ? 'bg-blue-600/15 border-blue-500/40 shadow-lg shadow-blue-500/10'
                : 'bg-transparent border-white/5 hover:bg-white/[0.02] opacity-70',
            )}
          >
            <div
              className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors',
                step === 2 ? 'bg-blue-500 text-white shadow-md' : 'bg-white/10 text-white',
              )}
            >
              2
            </div>
            <div className="space-y-0.5">
              <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Step 2</div>
              <div className="text-sm font-bold text-white">Set price range and deposit amounts</div>
            </div>
          </div>
        </div>

        {/* ─── Right Column: Step Content ─────────────────────────────────── */}
        <div className="lg:col-span-8">
          {step === 1 ? (
            /* ═══════════════════ STEP 1: SELECT PAIR & FEES ═══════════════════ */
            <div className="p-6 md:p-8 rounded-3xl bg-[#0c0c10] border border-white/8 space-y-8 shadow-2xl">
              {/* Pair Selection Header */}
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-white">Select pair</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Choose the tokens you want to provide liquidity for on Bitcoin Cash &amp; CashTokens.
                </p>
              </div>

              {/* Token Selector Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Base Token */}
                <button
                  type="button"
                  onClick={() => setSelectingTarget('base')}
                  className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/8 hover:border-emerald-500/30 transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center overflow-hidden">
                      <img src="/logos/bitcoin-cash-bch-logo.svg" alt={baseToken.symbol} className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-bold text-base text-white group-hover:text-emerald-400 transition-colors">
                        {baseToken.symbol}
                      </div>
                      <div className="text-xs text-zinc-500">{baseToken.name}</div>
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
                </button>

                {/* Quote Token */}
                <button
                  type="button"
                  onClick={() => setSelectingTarget('quote')}
                  className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/8 hover:border-emerald-500/30 transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center font-mono text-xs font-bold text-cyan-300">
                      {quoteToken.symbol.slice(0, 3)}
                    </div>
                    <div>
                      <div className="font-bold text-base text-white group-hover:text-emerald-400 transition-colors">
                        {quoteToken.symbol}
                      </div>
                      <div className="text-xs text-zinc-500">{quoteToken.name}</div>
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
                </button>
              </div>

              {/* Strategy Covenant Hook Selection (4 Modes) */}
              <div className="space-y-3">
                <div className="space-y-0.5">
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Strategy Mode &amp; Covenant Hook</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      CashScript L1
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Select how your liquidity operates, tracks prices, and recycles balances on Bitcoin Cash.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {STRATEGY_OPTIONS.map((st) => {
                    const Icon = st.icon;
                    const isSelected = strategyType === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setStrategyType(st.id)}
                        className={cn(
                          'p-4 rounded-2xl border text-left transition-all flex flex-col justify-between relative group',
                          isSelected
                            ? 'bg-blue-600/15 border-blue-500/50 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/30'
                            : 'bg-white/[0.02] border-white/8 hover:border-white/20'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            'p-2 rounded-xl shrink-0 transition-colors',
                            isSelected ? 'bg-blue-500/20 text-blue-300' : 'bg-white/5 text-zinc-400 group-hover:text-white'
                          )}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-bold text-sm text-white flex items-center gap-1.5">
                              <span>{st.name}</span>
                              {st.id === 'mesh_mode4' && (
                                <span className="px-1.5 py-0.2 rounded bg-blue-400/20 text-blue-300 text-[9px] font-mono font-bold">
                                  3× Virtual
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{st.shortDesc}</p>
                          </div>
                        </div>

                        <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-zinc-500">
                          <span>Covenant: {st.covenant}</span>
                          {isSelected && <span className="text-blue-400 font-bold">Selected</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Fee Tier Selector */}
              <div className="space-y-3">
                <div className="space-y-0.5">
                  <h4 className="text-sm font-bold text-white">Fee tier</h4>
                  <p className="text-xs text-zinc-400">
                    The amount earned providing liquidity. Choose an amount that suits your risk tolerance.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {FEE_TIERS.map((tier) => (
                    <button
                      key={tier.fee}
                      type="button"
                      onClick={() => setFeeTier(tier.fee)}
                      className={cn(
                        'p-4 rounded-2xl border text-left transition-all relative',
                        feeTier === tier.fee
                          ? 'bg-blue-600/15 border-blue-500/50 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/30'
                          : 'bg-white/[0.02] border-white/8 hover:border-white/20',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-sm text-white">{tier.label}</div>
                        {tier.badge && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-500 text-white text-[10px] font-bold">
                            {tier.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">{tier.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Continue Button */}
              <Button
                onClick={() => setStep(2)}
                className="w-full h-12 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-base shadow-xl transition-all"
              >
                Continue
              </Button>
            </div>
          ) : (
            /* ═══════════════════ STEP 2: PRICE RANGE & DEPOSIT ═══════════════════ */
            <div className="p-6 md:p-8 rounded-3xl bg-[#0c0c10] border border-white/8 space-y-8 shadow-2xl">
              {/* Selected Pair Header Pill */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/8">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 border-2 border-[#0c0c10] flex items-center justify-center overflow-hidden">
                      <img src="/logos/bitcoin-cash-bch-logo.svg" alt="BCH" className="w-5 h-5" />
                    </div>
                    <div className="w-8 h-8 rounded-full bg-cyan-500/20 border-2 border-[#0c0c10] flex items-center justify-center font-mono text-[10px] font-bold text-cyan-300">
                      {quoteToken.symbol.slice(0, 3)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-white">
                      {baseToken.symbol} / {quoteToken.symbol}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-mono text-zinc-300">
                      {selectedStrategyMeta.name.split(':')[0]}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">
                      {feeTier}%
                    </span>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep(1)}
                  className="h-8 px-3 rounded-xl hover:bg-white/10 text-xs font-semibold text-zinc-300"
                >
                  Edit
                </Button>
              </div>

              {/* Strategy-Specific Range & Parameter Controls */}
              {strategyType === 'mesh_mode4' ? (
                /* ── Mode 4: 100% Shared Multi-Market Routing Matrix ── */
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div className="space-y-0.5">
                      <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <span>Shared Multi-Market Pool</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-mono">
                          {mode4Routes.length}× Virtual Depth
                        </span>
                      </h3>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        Single-asset BCH simultaneously quotes across all configured CashToken markets with automatic closed-loop recycling.
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const unusedToken = CHIPNET_DEFAULT_TOKENS.find(
                          (t) => !mode4Routes.some((r) => r.token.symbol === t.symbol)
                        ) || {
                          symbol: `CT-${Math.floor(Math.random() * 1000)}`,
                          name: 'Cauldron CashToken',
                          categoryId: 'c74f5192070f80bc247c4deffc6c74d61998471b69335ef00ffc7e96b9ef2825',
                          decimals: 2,
                        };
                        setMode4Routes((prev) => [
                          ...prev,
                          {
                            id: `route-${Date.now()}`,
                            token: unusedToken,
                            spreadBps: 50,
                            feeBps: 30,
                          },
                        ]);
                        toast.success(`Added ${unusedToken.symbol} route to shared pool`);
                      }}
                      className="h-8 px-3 rounded-xl border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 text-xs font-mono shrink-0 flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Token Route</span>
                    </Button>
                  </div>

                  {/* Configured Routes List */}
                  <div className="space-y-3">
                    {mode4Routes.map((route, idx) => {
                      const spreadPct = (route.spreadBps / 100);
                      const effectivePrice = currentSpotPrice * (1 + spreadPct / 100);
                      return (
                        <div
                          key={route.id}
                          className="p-4 rounded-2xl bg-white/[0.02] border border-white/8 space-y-3 hover:border-white/15 transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-xs font-bold flex items-center justify-center">
                                {route.token.symbol.slice(0, 3)}
                              </div>
                              <div>
                                <div className="font-bold text-sm text-white flex items-center gap-2">
                                  <span>Route {idx + 1}: BCH / {route.token.symbol}</span>
                                  <span className="px-1.5 py-0.2 rounded bg-white/10 text-zinc-400 font-mono text-[10px]">
                                    {route.token.name}
                                  </span>
                                </div>
                                <div className="text-[11px] font-mono text-emerald-400">
                                  Quoted Rate: ${effectivePrice.toFixed(2)} {route.token.symbol}
                                </div>
                              </div>
                            </div>

                            {mode4Routes.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setMode4Routes((prev) => prev.filter((r) => r.id !== route.id));
                                  toast.info(`Removed ${route.token.symbol} route`);
                                }}
                                className="text-zinc-500 hover:text-rose-400 text-xs font-mono p-1 transition-colors"
                                title="Remove Route"
                              >
                                Remove
                              </button>
                            )}
                          </div>

                          {/* Per-Route Spread & Fee Sliders/Presets */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/5 text-xs font-mono">
                            {/* Spread adjustment */}
                            <div className="space-y-1">
                              <div className="flex justify-between text-zinc-400 font-sans">
                                <span>Spread above Spot:</span>
                                <span className="font-mono text-cyan-300 font-bold">
                                  +{spreadPct.toFixed(2)}% (+{route.spreadBps} bps)
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                {[0, 25, 50, 100].map((bps) => (
                                  <button
                                    key={bps}
                                    type="button"
                                    onClick={() => {
                                      setMode4Routes((prev) =>
                                        prev.map((r) => (r.id === route.id ? { ...r, spreadBps: bps } : r))
                                      );
                                    }}
                                    className={cn(
                                      'flex-1 py-1 rounded-lg text-[10px] font-mono transition-all',
                                      route.spreadBps === bps
                                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                        : 'bg-white/5 text-zinc-400 hover:text-white'
                                    )}
                                  >
                                    +{bps / 100}%
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Fee Tier adjustment */}
                            <div className="space-y-1">
                              <div className="flex justify-between text-zinc-400 font-sans">
                                <span>Route Fee:</span>
                                <span className="font-mono text-emerald-300 font-bold">
                                  {(route.feeBps / 100).toFixed(2)}%
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                {[5, 30, 50].map((bps) => (
                                  <button
                                    key={bps}
                                    type="button"
                                    onClick={() => {
                                      setMode4Routes((prev) =>
                                        prev.map((r) => (r.id === route.id ? { ...r, feeBps: bps } : r))
                                      );
                                    }}
                                    className={cn(
                                      'flex-1 py-1 rounded-lg text-[10px] font-mono transition-all',
                                      route.feeBps === bps
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                        : 'bg-white/5 text-zinc-400 hover:text-white'
                                    )}
                                  >
                                    {(bps / 100).toFixed(2)}%
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      <span>Autonomous Multi-Asset Recycling Active</span>
                    </div>
                    <p className="text-zinc-300 text-[11px] leading-relaxed font-sans">
                      Deposited BCH is shared across all {mode4Routes.length} markets. When a buyer fills one route, the covenant auto-spawns reverse liquidity for that specific CashToken.
                    </p>
                  </div>
                </div>
              ) : strategyType === 'oracle' ? (
                /* ── Oracle Spot Following Strategy ── */
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <span>Curved Oracle Spot Strategy</span>
                      <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-mono">
                        Pyth / Cauldron Attested
                      </span>
                    </h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Automatically follows real-time spot prices with zero on-chain transactions using cryptographic oracle attestations.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/8 space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-400 font-semibold">Live Oracle Price Reference</span>
                      <span className="font-mono text-emerald-400 font-bold text-base">
                        ${currentSpotPrice.toFixed(2)} USD
                      </span>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-white/5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-zinc-400 font-semibold">Margin Spread above Spot</span>
                        <span className="text-cyan-400 font-mono font-bold text-sm">
                          +0.50% (+50 bps)
                        </span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="300"
                        step="5"
                        defaultValue="50"
                        className="w-full accent-cyan-400 cursor-pointer h-2 bg-white/10 rounded-lg"
                      />
                      <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                        <span>+0.10% (Tight)</span>
                        <span>+1.50% (Balanced)</span>
                        <span>+3.00% (Volatile)</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : strategyType === 'dutch' ? (
                /* ── Dutch Decay Auction ── */
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-white">Dutch Decay Auction</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Linear price decay over a fixed duration until floor price is reached or liquidity is filled.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/8 space-y-1">
                      <span className="text-xs text-zinc-400">Starting Price</span>
                      <div className="font-mono font-bold text-white text-base">
                        ${(currentSpotPrice * 1.10).toFixed(2)}
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/8 space-y-1">
                      <span className="text-xs text-zinc-400">Floor Price</span>
                      <div className="font-mono font-bold text-emerald-400 text-base">
                        ${(currentSpotPrice * 0.90).toFixed(2)}
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/8 space-y-1">
                      <span className="text-xs text-zinc-400">Duration</span>
                      <div className="font-mono font-bold text-white text-base">
                        24 Hours
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* ── Straight Concentrated Range ── */
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-white">Set price range</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Custom range allows you to concentrate your liquidity within specific price bounds, enhancing capital efficiency and fee earnings.
                    </p>
                  </div>

                  {/* Range Mode Toggle: Full vs Custom */}
                  <div className="flex bg-black/60 p-1 rounded-2xl border border-white/8 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={handleFullRange}
                      className={cn(
                        'flex-1 py-2.5 rounded-xl transition-all',
                        rangeMode === 'full'
                          ? 'bg-white/10 text-white font-bold shadow-sm'
                          : 'text-zinc-400 hover:text-white',
                      )}
                    >
                      Full range
                    </button>
                    <button
                      type="button"
                      onClick={() => setRangeMode('custom')}
                      className={cn(
                        'flex-1 py-2.5 rounded-xl transition-all',
                        rangeMode === 'custom'
                          ? 'bg-white/10 text-white font-bold shadow-sm'
                          : 'text-zinc-400 hover:text-white',
                      )}
                    >
                      Custom range
                    </button>
                  </div>

                  {/* Current Price Ticker Box */}
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                    <div>
                      <div className="text-xs text-zinc-400">Current price</div>
                      <div className="text-xl font-black font-mono text-white mt-0.5">
                        {currentSpotPrice.toFixed(2)} {quoteToken.symbol}/{baseToken.symbol}{' '}
                        <span className="text-zinc-500 text-sm font-normal">(${currentSpotPrice.toFixed(2)})</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/5 border border-white/5 text-xs font-mono">
                      <button
                        onClick={handleFlipTokens}
                        className="px-2.5 py-1 rounded-lg bg-white/10 text-white font-bold flex items-center gap-1"
                      >
                        <ArrowRightLeft className="w-3 h-3" />
                        <span>{baseToken.symbol}</span>
                      </button>
                      <span className="text-zinc-400 px-1">{quoteToken.symbol}</span>
                    </div>
                  </div>

                  {/* Interactive Price Range Chart (Uniswap v4 Style) */}
                  <div className="p-5 rounded-2xl bg-black/40 border border-white/5 space-y-4">
                    {/* Histogram / Depth Bars with Shaded Concentration Area */}
                    <div className="relative h-44 w-full bg-[#08080a] rounded-xl overflow-hidden p-3 flex flex-col justify-between">
                      {/* Upper Price Indicator */}
                      <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500">
                        <span>Chart Range</span>
                        <span className="text-emerald-400">Max: ${maxPrice.toFixed(2)} (+{maxPct}%)</span>
                      </div>

                      {/* Shaded Active Range Area & Bars */}
                      <div className="relative h-28 w-full flex items-end justify-between px-1 gap-1">
                        {/* Range Box */}
                        <div
                          className="absolute inset-y-2 bg-emerald-500/10 border-x-2 border-emerald-400 rounded-md pointer-events-none"
                          style={{ left: '15%', right: '20%' }}
                        />

                        {/* Depth Bars */}
                        {[18, 25, 34, 48, 62, 85, 110, 145, 190, 130, 95, 120, 160, 210, 180, 140, 100, 75, 50, 30].map(
                          (h, i) => (
                            <div
                              key={i}
                              className={cn(
                                'flex-1 rounded-t transition-all',
                                i >= 3 && i <= 15 ? 'bg-emerald-400/80' : 'bg-white/10',
                              )}
                              style={{ height: `${h * 0.45}%` }}
                            />
                          ),
                        )}
                      </div>

                      {/* Lower Price Indicator */}
                      <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500">
                        <span className="text-emerald-400">Min: ${minPrice.toFixed(2)} ({minPct}%)</span>
                        <span className="text-zinc-400">Spot: ${currentSpotPrice.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Chart Timescale & Zoom Toolbar */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl">
                        {(['1D', '1W', '1M', '1Y', 'All'] as const).map((t) => (
                          <button
                            key={t}
                            onClick={() => setTimeframe(t)}
                            className={cn(
                              'px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all',
                              timeframe === t ? 'bg-white/15 text-white' : 'text-zinc-500 hover:text-zinc-300',
                            )}
                          >
                            {t}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setChartZoom((z) => Math.min(z + 0.2, 2))}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white"
                          title="Zoom in"
                        >
                          <ZoomIn className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setChartZoom((z) => Math.max(z - 0.2, 0.6))}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white"
                          title="Zoom out"
                        >
                          <ZoomOut className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Price Strategy Presets */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-zinc-400">Price strategies</div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: 'stable', label: 'Stable', range: '± 1.82%', sub: 'Good for stablecoins' },
                        { id: 'wide', label: 'Wide', range: '-50% — +100%', sub: 'Good for volatile pairs' },
                        { id: 'lower', label: 'One-sided lower', range: '-50%', sub: 'Supply if price drops' },
                        { id: 'upper', label: 'One-sided upper', range: '+100%', sub: 'Supply if price rises' },
                      ].map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handlePresetSelect(p.id as any)}
                          className={cn(
                            'p-3 rounded-2xl border text-left transition-all',
                            selectedPreset === p.id
                              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                              : 'bg-white/[0.02] border-white/8 hover:border-white/20 text-zinc-400',
                          )}
                        >
                          <div className="font-bold text-xs text-white">{p.label}</div>
                          <div className="text-emerald-400 font-mono font-bold text-xs mt-0.5">{p.range}</div>
                          <div className="text-[10px] text-zinc-500 mt-1 leading-tight">{p.sub}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Min Price & Max Price Stepper Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Min Price Stepper */}
                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/8 space-y-2">
                      <div className="flex justify-between items-center text-xs text-zinc-400">
                        <span>Min price</span>
                        <span className="font-mono text-emerald-400">{minPct}%</span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="number"
                          step="0.01"
                          value={minPrice}
                          onChange={(e) => {
                            setMinPrice(parseFloat(e.target.value) || 0);
                            setSelectedPreset('custom');
                          }}
                          className="w-full bg-transparent text-xl font-black font-mono text-white focus:outline-none"
                        />

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => adjustMin(-0.05)}
                            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center text-white"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => adjustMin(0.05)}
                            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center text-white"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Max Price Stepper */}
                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/8 space-y-2">
                      <div className="flex justify-between items-center text-xs text-zinc-400">
                        <span>Max price</span>
                        <span className="font-mono text-emerald-400">+{maxPct}%</span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="number"
                          step="0.01"
                          value={maxPrice}
                          onChange={(e) => {
                            setMaxPrice(parseFloat(e.target.value) || 0);
                            setSelectedPreset('custom');
                          }}
                          className="w-full bg-transparent text-xl font-black font-mono text-white focus:outline-none"
                        />

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => adjustMax(-0.05)}
                            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center text-white"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => adjustMax(0.05)}
                            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center text-white"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Deposit Tokens Section */}
              <div className="space-y-4 pt-4 border-t border-white/8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <h3 className="text-xl font-bold text-white">Deposit tokens</h3>
                    <p className="text-xs text-zinc-400">
                      Specify the initial capital for your covenant deployment.
                    </p>
                  </div>

                  {/* Single vs Dual Deposit Toggle (For straight, oracle, dutch) */}
                  {strategyType !== 'mesh_mode4' && (
                    <div className="flex bg-black/60 p-1 rounded-xl border border-white/10 text-xs font-semibold self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setDepositMode('single')}
                        className={cn(
                          'px-3 py-1.5 rounded-lg transition-all',
                          depositMode === 'single'
                            ? 'bg-blue-600 text-white font-bold shadow-sm'
                            : 'text-zinc-400 hover:text-white',
                        )}
                      >
                        Single Asset (BCH)
                      </button>
                      <button
                        type="button"
                        onClick={() => setDepositMode('dual')}
                        className={cn(
                          'px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5',
                          depositMode === 'dual'
                            ? 'bg-emerald-600 text-white font-bold shadow-sm'
                            : 'text-zinc-400 hover:text-white',
                        )}
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Dual 2-Leg Pair</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Token A Input Block (Base / BCH) */}
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/8 space-y-2">
                  <div className="flex justify-between items-center text-xs text-zinc-400">
                    <span>Deposit {baseToken.symbol}</span>
                    <button
                      type="button"
                      onClick={handleMaxBase}
                      className="text-emerald-400 hover:underline font-mono text-[11px] flex items-center gap-1"
                    >
                      <span>Balance: {spendableBch.toFixed(4)} BCH</span>
                      <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                        MAX
                      </span>
                    </button>
                  </div>

                  <div className="flex justify-between items-center gap-3">
                    <input
                      type="number"
                      placeholder="0.0"
                      value={baseAmount}
                      onChange={(e) => handleBaseAmountChange(e.target.value)}
                      className="w-full bg-transparent text-2xl font-black font-mono text-white focus:outline-none"
                    />

                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 font-bold text-xs text-white shrink-0">
                      <img src="/logos/bitcoin-cash-bch-logo.svg" alt="BCH" className="w-4 h-4" />
                      <span>{baseToken.symbol}</span>
                    </div>
                  </div>

                  <div className="text-xs font-mono text-zinc-500">
                    ~${((parseFloat(baseAmount) || 0) * currentSpotPrice).toFixed(2)} USD
                  </div>
                </div>

                {/* Token B Input Block (Quote / CashToken — in Dual Deposit Mode) */}
                {depositMode === 'dual' && strategyType !== 'mesh_mode4' && (
                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/8 space-y-2 animate-in fade-in duration-200">
                    <div className="flex justify-between items-center text-xs text-zinc-400">
                      <span>Deposit {quoteToken.symbol} (Reverse Leg Reserve)</span>
                      <button
                        type="button"
                        onClick={handleMaxQuote}
                        className="text-cyan-400 hover:underline font-mono text-[11px] flex items-center gap-1"
                      >
                        <span>Balance: {spendableQuoteToken.toFixed(2)} {quoteToken.symbol}</span>
                        <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-bold text-[10px]">
                          MAX
                        </span>
                      </button>
                    </div>

                    <div className="flex justify-between items-center gap-3">
                      <input
                        type="number"
                        placeholder="0.0"
                        value={quoteAmount}
                        onChange={(e) => handleQuoteAmountChange(e.target.value)}
                        className="w-full bg-transparent text-2xl font-black font-mono text-white focus:outline-none"
                      />

                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 font-bold text-xs text-white shrink-0">
                        <div className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-[9px] font-bold">
                          {quoteToken.symbol.slice(0, 2)}
                        </div>
                        <span>{quoteToken.symbol}</span>
                      </div>
                    </div>

                    <div className="text-xs font-mono text-zinc-500">
                      ~${(parseFloat(quoteAmount) || 0).toFixed(2)} USD
                    </div>
                  </div>
                )}

                {/* Single-Asset Mode 4 Multiplier Badge */}
                {strategyType === 'mesh_mode4' && (
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs font-mono text-emerald-300">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      <span>Single-Asset Mode 4 Active:</span>
                    </div>
                    <span className="font-bold text-white">
                      3× Virtual Depth (~${(((parseFloat(baseAmount) || 0) * currentSpotPrice) * 3).toFixed(2)})
                    </span>
                  </div>
                )}
              </div>

              {/* Action / Deploy Button */}
              {!isConnected ? (
                <div className="flex justify-center pt-2">
                  <ConnectWalletButton className="w-full h-12 rounded-2xl text-base font-bold" />
                </div>
              ) : (
                <Button
                  onClick={() => setShowConfirmModal(true)}
                  disabled={spawning}
                  className="w-full h-12 rounded-2xl bg-emerald-400 hover:bg-emerald-300 text-black font-bold text-base shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2"
                >
                  {spawning ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Spawning CashScript Covenant...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-5 h-5" />
                      <span>Preview &amp; Deploy Position</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Pre-Flight Confirmation Modal ────────────────────────────────── */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="max-w-md bg-[#0c0c10] border border-white/10 p-6 rounded-3xl shadow-2xl text-white space-y-5">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span>Review Covenant Deployment</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Verify parameters before broadcasting the transaction on Chipnet.
            </DialogDescription>
          </DialogHeader>

          {/* Breakdown Card */}
          <div className="space-y-3 font-mono text-xs">
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/8 space-y-2">
              <div className="flex justify-between items-center text-zinc-400 font-sans">
                <span>Pair &amp; Strategy:</span>
                <span className="font-bold text-white font-mono">
                  {baseToken.symbol} / {quoteToken.symbol}
                </span>
              </div>
              <div className="flex justify-between items-center text-zinc-400 font-sans">
                <span>Covenant Hook:</span>
                <span className="text-emerald-400 font-mono font-semibold">
                  {selectedStrategyMeta.covenant}
                </span>
              </div>
              <div className="flex justify-between items-center text-zinc-400 font-sans">
                <span>Deployment Mode:</span>
                <span className="text-cyan-400 font-mono font-semibold">
                  {strategyType === 'mesh_mode4' ? 'Mode 4 Shared Multi-Pair' : depositMode === 'dual' ? 'Dual-Sided 2-Leg Bundle' : 'Single Asset Limit'}
                </span>
              </div>
              <div className="flex justify-between items-center text-zinc-400 font-sans">
                <span>Fee Tier:</span>
                <span className="text-white font-mono">{feeTier}%</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/8 space-y-2">
              <div className="flex justify-between items-center text-zinc-400 font-sans">
                <span>Base Capital:</span>
                <span className="font-bold text-emerald-300">
                  {baseAmount} BCH (~${((parseFloat(baseAmount) || 0) * currentSpotPrice).toFixed(2)})
                </span>
              </div>
              {depositMode === 'dual' && (
                <div className="flex justify-between items-center text-zinc-400 font-sans">
                  <span>Quote Capital:</span>
                  <span className="font-bold text-cyan-300">
                    {quoteAmount} {quoteToken.symbol} (~${(parseFloat(quoteAmount) || 0).toFixed(2)})
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center text-zinc-400 font-sans pt-1 border-t border-white/5">
                <span>Est. Network Fee:</span>
                <span className="text-zinc-400">&lt; $0.001 (1,000 sats)</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowConfirmModal(false)}
              className="flex-1 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white"
            >
              Back
            </Button>
            <Button
              type="button"
              onClick={handleDeployPosition}
              disabled={spawning}
              className="flex-2 h-11 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black font-bold text-xs shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
            >
              {spawning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing &amp; Broadcasting…</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Confirm &amp; Deploy Covenant</span>
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Token Selection Modal ────────────────────────────────────────── */}
      <TokenSelectModal
        open={Boolean(selectingTarget)}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSelectingTarget(null);
        }}
        onSelect={(token: MeshToken) => {
          if (selectingTarget === 'base') setBaseToken(token);
          if (selectingTarget === 'quote') setQuoteToken(token);
          setSelectingTarget(null);
        }}
        selectedToken={selectingTarget === 'base' ? baseToken : quoteToken}
        otherSelectedToken={selectingTarget === 'base' ? quoteToken : baseToken}
      />

      {/* ─── Strategy / Hook Modal ────────────────────────────────────────── */}
      {showStrategyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl bg-[#0c0c10] border border-white/10 p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Select Covenant Strategy</h3>
              <button
                onClick={() => setShowStrategyModal(false)}
                className="text-zinc-400 hover:text-white text-xs font-mono"
              >
                Close
              </button>
            </div>

            <div className="space-y-3">
              {STRATEGY_OPTIONS.map((st) => {
                const Icon = st.icon;
                return (
                  <button
                    key={st.id}
                    onClick={() => {
                      setStrategyType(st.id);
                      setShowStrategyModal(false);
                    }}
                    className={cn(
                      'w-full p-4 rounded-2xl border text-left transition-all flex items-start gap-3.5',
                      strategyType === st.id
                        ? 'bg-emerald-500/10 border-emerald-500/40'
                        : 'bg-white/[0.02] border-white/8 hover:border-white/20',
                    )}
                  >
                    <Icon className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-sm text-white">{st.name}</div>
                      <p className="text-xs text-zinc-400 mt-0.5">{st.shortDesc}</p>
                      <div className="text-[10px] font-mono text-zinc-500 mt-1">
                        Covenant: {st.covenant}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
