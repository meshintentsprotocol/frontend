import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    ArrowDown, Loader2, Zap, Globe, AlertTriangle, Settings2, History,
    Sparkles, ChevronDown, ChevronUp, Wallet, ShoppingBag
} from 'lucide-react';
import { Token, BCHSwapParams, BCHSwapType, BCHOrderType } from '@/types';
import { BCHTokenSelector, BCH_TOKENS, SOLANA_TOKENS, ETH_TOKENS, ALL_BCH_SWAP_TOKENS, MAINNET_SWAP_TOKENS } from './BCHTokenSelector';
import { isEvmChain, getEVMChainConfig, EVM_CHAINS_TESTNET } from '@/lib/evmChains';
import { useBCHWallet } from '@/context/BCHWalletProvider';
import { useBCHSwap } from '@/context/BCHSwapContext';
import { useWDK } from '@/context/WDKProvider';
import { usePortfolio } from '@/hooks/usePortfolio';
import { ConnectWalletButton } from '@/components/connect-wallet-button';
import { useLocation } from 'react-router-dom';
import { PriceService, PRICE_FEEDS } from '@/lib/pyth';
import { CauldronService } from '@/lib/cauldron';
import { CASHTOKEN_RELAYER_URL, CASHTOKEN_RELAYER_MAINNET_URL, EVM_RELAYER_URL, EVM_RELAYER_MAINNET_URL, BCH_SOLANA_RELAYER_URL } from '@/lib/config';
import axios from 'axios';
import { AUCTION_DURATION, AUCTION_DURATION_PRESETS, formatAuctionDuration, getDefaultAuctionDuration } from '@/lib/appSettings';
import { PriceData } from '@/types';
import { cn } from '@/lib/utils';
import {
    Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { useActiveWallet } from '@/hooks/useActiveWallet';
import { useExternalBCHWallet } from '@/context/ExternalBCHWalletProvider';
import { TWAPOrderForm } from './TWAPOrderForm';
import { cashAddressToLockingBytecode, binToHex } from '@bitauth/libauth';

// ============================================================================
// BCH Swap Card — Uniswap-style unified swap card
// ============================================================================

export interface BCHSwapCardProps {
    orderType: BCHOrderType;
    onOrderTypeChange: (type: BCHOrderType) => void;
    /** Whether the Open & Orders panel is currently shown. */
    ordersVisible?: boolean;
    /** Toggles the Open & Orders panel. */
    onToggleOrders?: () => void;
    /**
     * Token detail page embedding:
     * - anchorToken: the token this page is "about" — pinned to one side
     * - anchorSide: which side the anchor starts on (default 'buy')
     * - onAnchorTokenChange: fires when the user picks a new token on the anchor side → parent navigates
     * - compact: hides header chrome for embedding
     */
    anchorToken?: Token;
    anchorSide?: 'sell' | 'buy';
    onAnchorTokenChange?: (token: Token) => void;
    compact?: boolean;
    /** Remove outer card background/border — renders as floating transparent UI */
    transparent?: boolean;
}

/** Limit-order expiry is capped at 30 days (2592000s) — both the presets below and the custom input. */
const EXPIRY_MAX_SECONDS = 2592000;

const EXPIRY_PRESETS = [
    { value: '3600', label: '1H' },
    { value: '86400', label: '1D' },
    { value: '604800', label: '7D' },
    { value: String(EXPIRY_MAX_SECONDS), label: '30D' },
];

/**
 * Limit-price presets, as multiples of the reference ratio.
 *
 * The reference is the relayer's quote — the price a solver will actually fill at —
 * not USD mid. These used to be multiples of mid, labelled "Market, +1%, +5%, +10%",
 * where every option was at-or-worse-than-mid from the solver's side and therefore
 * unfillable. "Market" in particular sat exactly on the profit floor and never filled.
 *
 * Anything above 1× asks for more buyToken than a solver will currently pay, so it
 * rests until the market moves — which is a legitimate thing to want from a limit
 * order, just not a sensible default.
 */
const PRICE_PRESETS = [
    { label: 'Fills now', mult: 1 },
    { label: '+1%', mult: 1.01 },
    { label: '+5%', mult: 1.05 },
    { label: '+10%', mult: 1.10 },
];

export function BCHSwapCard({ orderType, onOrderTypeChange, ordersVisible, onToggleOrders, anchorToken, anchorSide: anchorSideProp = 'buy', onAnchorTokenChange, compact, transparent }: BCHSwapCardProps) {
    // Track which side currently holds the anchor token (flips when user hits the flip button)
    const [anchorSide, setAnchorSide] = useState<'sell' | 'buy'>(anchorSideProp);
    const location = useLocation();
    const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

    const initialSellToken = useMemo(() => {
        if (anchorToken && anchorSideProp === 'sell') return anchorToken;
        const sellParam = queryParams.get('sell');
        if (sellParam) {
            return ALL_BCH_SWAP_TOKENS.find(t => t.symbol.toUpperCase() === sellParam.toUpperCase()) || BCH_TOKENS[0];
        }
        return BCH_TOKENS[0];
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const initialBuyToken = useMemo(() => {
        if (anchorToken && anchorSideProp === 'buy') return anchorToken;
        // CashToken sell-side anchor → pair with BCH so the swap makes sense
        if (anchorToken && anchorSideProp === 'sell' && anchorToken.type === 'cashtoken') return BCH_TOKENS[0];
        const buyParam = queryParams.get('buy');
        if (buyParam) {
            return ALL_BCH_SWAP_TOKENS.find(t => t.symbol.toUpperCase() === buyParam.toUpperCase()) || SOLANA_TOKENS[0];
        }
        return SOLANA_TOKENS[0];
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [sellToken, setSellToken] = useState<Token>(initialSellToken);
    const [buyToken, setBuyToken] = useState<Token>(initialBuyToken);
    const [sellAmount, setSellAmount] = useState('');
    const [buyAmount, setBuyAmount] = useState('');

    const [duration, setDuration] = useState(() => getDefaultAuctionDuration());
    const durationPct = ((duration - AUCTION_DURATION.min) / (AUCTION_DURATION.max - AUCTION_DURATION.min)) * 100;
    const [limitPrice, setLimitPrice] = useState<string>('');
    const [expiryValue, setExpiryValue] = useState<string>('86400');
    const [customExpiryValue, setCustomExpiryValue] = useState<string>('');

    const [xmrAddress, setXmrAddress] = useState('');
    const [xmrViewKey, setXmrViewKey] = useState('');
    const [xmrSpendKey, setXmrSpendKey] = useState('');

    const [prices, setPrices] = useState<Record<string, PriceData>>({});
    const [cauldronPrices, setCauldronPrices] = useState<Record<string, number>>({});
    const [flipping, setFlipping] = useState(false);
    const [routeExpanded, setRouteExpanded] = useState(false);

    const { activeWalletId, setActiveWallet, isMainActive, activeExtWallet } = useActiveWallet();
    const extBCH = useExternalBCHWallet();
    const bchWallet = useBCHWallet();
    const { detectSwapType, executeSwap, isLoading, swapStep } = useBCHSwap();
    const wdk = useWDK();

    const userAddress = isMainActive
        ? (bchWallet.address || wdk.bchAddress || '')
        : (activeExtWallet?.address || bchWallet.address || wdk.bchAddress || '');

    const userPkhHex = useMemo(() => {
        if (!userAddress) return '';
        try {
            const decoded = cashAddressToLockingBytecode(userAddress);
            if (typeof decoded !== 'string') {
                if (decoded.bytecode.length === 25) {
                    return binToHex(decoded.bytecode.slice(3, 23));
                } else if (decoded.bytecode.length === 23) {
                    return binToHex(decoded.bytecode.slice(2, 22));
                } else {
                    return binToHex(decoded.bytecode.slice(3, 23));
                }
            }
        } catch {}
        return '';
    }, [userAddress]);
    const isMainnet = wdk.bchNetwork === 'mainnet';
    const portfolio = usePortfolio({ pollingMs: 30_000 });

    const toggleNetwork = () => {
        wdk.setBchNetwork(isMainnet ? 'chipnet' : 'mainnet');
    };

    const availableTokens = isMainnet ? MAINNET_SWAP_TOKENS : ALL_BCH_SWAP_TOKENS;

    // Resolve a human-readable EVM chain label from the active sell/buy token
    const activeEvmChain = isEvmChain(sellToken.chain) ? sellToken.chain
        : isEvmChain(buyToken.chain) ? buyToken.chain
        : 'ethereum';
    const evmCfg = getEVMChainConfig(activeEvmChain, isMainnet) ?? EVM_CHAINS_TESTNET['ethereum'];
    const activeEvmLabel = evmCfg.name;

    // Reset selected tokens when switching networks if current selection isn't available.
    // Skip the anchor side — anchor tokens can be dynamic CashTokens absent from the
    // static list; resetting them would override the token-detail-page pin.
    useEffect(() => {
        const allowed = new Set(availableTokens.map(t => `${t.chain}:${t.symbol}`));
        const anchorIsSell = !!anchorToken && anchorSide === 'sell';
        const anchorIsBuy  = !!anchorToken && anchorSide === 'buy';
        if (!anchorIsSell && !allowed.has(`${sellToken.chain}:${sellToken.symbol}`)) {
            setSellToken(BCH_TOKENS[0]);
        }
        if (!anchorIsBuy && !allowed.has(`${buyToken.chain}:${buyToken.symbol}`)) {
            setBuyToken(isMainnet ? ETH_TOKENS[0] : SOLANA_TOKENS[0]);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMainnet]);

    const swapType: BCHSwapType = useMemo(
        () => detectSwapType(sellToken.chain, buyToken.chain),
        [sellToken, buyToken, detectSwapType]
    );

    useEffect(() => {
        const sellParam = queryParams.get('sell');
        const buyParam = queryParams.get('buy');
        if (sellParam) {
            const token = ALL_BCH_SWAP_TOKENS.find(t => t.symbol.toUpperCase() === sellParam.toUpperCase());
            if (token) setSellToken(token);
        }
        if (buyParam) {
            const token = ALL_BCH_SWAP_TOKENS.find(t => t.symbol.toUpperCase() === buyParam.toUpperCase());
            if (token) setBuyToken(token);
        }
    }, [queryParams]);

    useEffect(() => {
        const fetchAllPrices = async () => {
            const pythData = await PriceService.getLatestPrices();
            setPrices(pythData);

            const bchPriceUsd = pythData['BCH'] ? PriceService.formatPrice(pythData['BCH']) : 0;

            try {
                const rawTokens = await CauldronService.getTopCashTokens(50, isMainnet);
                const priceMap: Record<string, number> = {};
                for (const t of rawTokens) {
                    const sym = (t.bcmr?.token?.symbol || t.display_symbol || '').toUpperCase();
                    const tokenBchPrice = t.price_now ? t.price_now / 1e8 : 0;
                    const priceUsd = t.price_now_usd > 0 ? t.price_now_usd : (bchPriceUsd > 0 ? tokenBchPrice * bchPriceUsd : 0);
                    if (priceUsd <= 0) continue;
                    if (sym && priceUsd > (priceMap[sym] || 0)) priceMap[sym] = priceUsd;
                    if (t.token_id) priceMap[t.token_id] = priceUsd;
                }
                setCauldronPrices(priceMap);
            } catch { /* non-fatal */ }
        };
        fetchAllPrices();
        const interval = setInterval(fetchAllPrices, 15000);
        return () => clearInterval(interval);
    }, [isMainnet]);

    const getTokenPrice = useCallback((token: Token): number => {
        const cleanSymbol = token.symbol.replace('.b', '').toUpperCase();
        const feedKey = Object.keys(PRICE_FEEDS).find(k => k.toUpperCase() === cleanSymbol);
        if (feedKey && prices[feedKey]) {
            const formatted = PriceService.formatPrice(prices[feedKey]);
            if (formatted > 0) return formatted;
        }
        if (cauldronPrices[token.symbol] > 0) return cauldronPrices[token.symbol];
        if (cauldronPrices[cleanSymbol] > 0) return cauldronPrices[cleanSymbol];
        if (token.categoryId && cauldronPrices[token.categoryId] > 0) return cauldronPrices[token.categoryId];
        if (token.priceUsd && token.priceUsd > 0) return token.priceUsd;
        if (cleanSymbol === 'BCH') return 390.0;
        return 0;
    }, [prices, cauldronPrices]);

    /** USD mid from Pyth/CoinGecko. Indicative only — the solver does not trade at this. */
    const currentMarketRatio = useMemo(() => {
        const sellPrice = getTokenPrice(sellToken);
        const buyPrice = getTokenPrice(buyToken);
        if (sellPrice > 0 && buyPrice > 0) return (sellPrice / buyPrice);
        return 0;
    }, [sellToken, buyToken, getTokenPrice]);

    /**
     * The ratio a solver will actually fill at, from the relayer's own quote.
     *
     * This matters because the two numbers are not the same. `currentMarketRatio` is
     * USD mid with no solver margin, and limit orders used to be seeded from it — so
     * the default limit order sat exactly at mid, below the solver's profit floor,
     * and could never fill. The relayer's quote already nets off its margin *and*
     * (since the recent relayer work) the on-chain fill costs, so a price anchored
     * here is genuinely fillable.
     *
     * 0 while unknown — no quote yet, cross-chain, or the relayer is unreachable.
     */
    const [fillableRatio, setFillableRatio] = useState(0);
    const [quoteUnavailable, setQuoteUnavailable] = useState(false);

    const getRelayerTokenSymbol = useCallback((token: Token) => {
        if (token.chain === 'solana') {
            return token.symbol === 'SOL' ? 'SOL' : (token.address || 'SOL');
        }
        if (token.chain === 'movement') {
            return token.symbol === 'MOVE' ? 'MOVE' : (token.address || 'MOVE');
        }
        if (token.chain === 'bch') {
            return token.symbol === 'BCH' ? 'BCH' : (token.categoryId || 'BCH');
        }
        return token.symbol;
    }, []);

    useEffect(() => {
        if (!sellAmount || Number(sellAmount) <= 0) {
            setFillableRatio(0);
            setQuoteUnavailable(false);
            return;
        }
        let cancelled = false;
        const isMainnet = wdk.bchNetwork === 'mainnet';
        const isRelayerCross = ['bch-to-sol', 'sol-to-bch', 'bch-to-mov', 'mov-to-bch', 'sol-to-mov', 'mov-to-sol'].includes(swapType);

        if (swapType === 'same-chain') {
            const relayerUrl = isMainnet ? CASHTOKEN_RELAYER_MAINNET_URL : CASHTOKEN_RELAYER_URL;
            const sellCategoryId = sellToken.categoryId || 'BCH';
            const buyCategoryId = buyToken.categoryId || 'BCH';
            const sellBaseUnits = Math.floor(Number(sellAmount) * Math.pow(10, sellToken.decimals || 0));

            axios.post(`${relayerUrl}/router/quote`, {
                sellToken: sellCategoryId || 'BCH',
                buyToken: buyCategoryId || 'BCH',
                sellAmount: sellBaseUnits.toString(),
                network: isMainnet ? 'mainnet' : 'chipnet',
            }).then(res => {
                if (cancelled) return;
                const units = Number(res.data?.buyAmount ?? 0) / Math.pow(10, buyToken.decimals || 0);
                setFillableRatio(units > 0 ? units / Number(sellAmount) : 0);
                setQuoteUnavailable(false);
            }).catch(() => {
                if (cancelled) return;
                setFillableRatio(0);
                setQuoteUnavailable(true);
            });
        } else if (isRelayerCross) {
            const sellSym = getRelayerTokenSymbol(sellToken);
            const buySym = getRelayerTokenSymbol(buyToken);
            const sellBaseUnits = Math.floor(Number(sellAmount) * Math.pow(10, sellToken.decimals || 0));

            axios.post(`${BCH_SOLANA_RELAYER_URL}/quote`, {
                sellToken: sellSym,
                buyToken: buySym,
                sellAmount: sellBaseUnits.toString(),
            }).then(res => {
                if (cancelled) return;
                const units = Number(res.data?.buyAmount ?? 0) / Math.pow(10, buyToken.decimals || 0);
                setFillableRatio(units > 0 ? units / Number(sellAmount) : 0);
                setQuoteUnavailable(false);
            }).catch(() => {
                if (cancelled) return;
                setFillableRatio(0);
                setQuoteUnavailable(false);
            });
        } else {
            setFillableRatio(0);
            setQuoteUnavailable(false);
        }

        return () => { cancelled = true; };
    }, [swapType, sellAmount, sellToken, buyToken, wdk.bchNetwork, getRelayerTokenSymbol]);

    /** What the limit-price input and its presets are anchored to. */
    const referenceRatio = fillableRatio > 0 ? fillableRatio : currentMarketRatio;
    const referenceIsFillable = fillableRatio > 0;

    /**
     * A limit price above the reference asks for MORE buyToken per sellToken than a
     * solver will pay, so it will not fill until the market moves. Small tolerance so
     * the "Fills now" preset does not immediately warn about itself.
     */
    const priceAboveFillable = referenceIsFillable
        && !!limitPrice && Number(limitPrice) > referenceRatio * 1.0005;

    /**
     * Has the user set the price themselves (typed it, or picked a preset)?
     *
     * Needed because the two candidate references do not arrive together: USD mid is
     * available on mount, the solver quote only after an amount is entered and the
     * request returns. Seeding on `!limitPrice` alone therefore locked in USD mid and
     * never replaced it — orders were still created at an unfillable price, which is
     * exactly what F4 was meant to fix. Observed live: two browser-created orders at
     * 0.000224 and 0.000220 units/sat against a fillable 0.000218, both rejected.
     */
    const [priceTouched, setPriceTouched] = useState(false);

    // A new pair is a new pricing context, so the user's old choice no longer applies.
    useEffect(() => { setPriceTouched(false); }, [sellToken, buyToken]);

    useEffect(() => {
        if (!priceTouched && referenceRatio > 0 && orderType === 'limit') {
            setLimitPrice(referenceRatio.toFixed(6));
        }
    }, [referenceRatio, priceTouched, orderType]);

    // Market auto-fill: derive buyAmount from current USD spot or relayer quote.
    // Skipped when any limit order has an explicit limitPrice — the dedicated
    // limit-price effect below drives buyAmount in that case.
    useEffect(() => {
        if (!sellAmount || Number(sellAmount) <= 0) { setBuyAmount(''); return; }
        if (orderType === 'limit' && limitPrice && Number(limitPrice) > 0) return;
        
        if (swapType === 'same-chain') {
            const isMainnet = wdk.bchNetwork === 'mainnet';
            const relayerUrl = isMainnet ? CASHTOKEN_RELAYER_MAINNET_URL : CASHTOKEN_RELAYER_URL;
            const sellCategoryId = sellToken.categoryId || (sellToken.chain === 'bch' && sellToken.symbol !== 'BCH' ? sellToken.categoryId : 'BCH');
            const buyCategoryId = buyToken.categoryId || (buyToken.chain === 'bch' && buyToken.symbol !== 'BCH' ? buyToken.categoryId : 'BCH');
            const sellBaseUnits = Math.floor(Number(sellAmount) * Math.pow(10, sellToken.decimals || 0));

            axios.post(`${relayerUrl}/router/quote`, {
                sellToken: sellCategoryId || 'BCH',
                buyToken: buyCategoryId || 'BCH',
                sellAmount: sellBaseUnits.toString(),
                network: isMainnet ? 'mainnet' : 'chipnet'
            }).then(res => {
                const quoteBuyAmount = res.data.buyAmount;
                const buyDecimals = buyToken.decimals || 0;
                if (quoteBuyAmount && Number(quoteBuyAmount) > 0) {
                    setBuyAmount((Number(quoteBuyAmount) / Math.pow(10, buyDecimals)).toFixed(6));
                } else {
                    setBuyAmount('0'); // Relayer says no route / unprofitable
                }
            }).catch(e => {
                console.error("Failed to get quote from relayer", e);
                setBuyAmount('0'); // Relayer unreachable/paused — don't leave a stale buyAmount on screen
            });
            return;
        }

        // Cross-chain quotes
        const isMainnet = wdk.bchNetwork === 'mainnet';
        const isEvmCross = isEvmChain(sellToken.chain) || isEvmChain(buyToken.chain);

        if (isEvmCross) {
            const relayerUrl = isMainnet ? EVM_RELAYER_MAINNET_URL : EVM_RELAYER_URL;
            const isEvmNative = (t: Token) => t.type === 'native';
            const sellCat = isEvmChain(sellToken.chain) ? (isEvmNative(sellToken) ? 'EVM' : sellToken.address || 'EVM') : (sellToken.categoryId || 'BCH');
            const buyCat = isEvmChain(buyToken.chain) ? (isEvmNative(buyToken) ? 'EVM' : buyToken.address || 'EVM') : (buyToken.categoryId || 'BCH');
            const sellBaseUnits = Math.floor(Number(sellAmount) * Math.pow(10, sellToken.decimals || 0));

            axios.post(`${relayerUrl}/quote`, {
                sellToken: sellCat,
                buyToken: buyCat,
                sellAmount: sellBaseUnits.toString()
            }).then(res => {
                const quoteBuyAmount = res.data.buyAmount;
                const buyDecimals = buyToken.decimals || 0;
                if (quoteBuyAmount && Number(quoteBuyAmount) > 0) {
                    setBuyAmount((Number(quoteBuyAmount) / Math.pow(10, buyDecimals)).toFixed(6));
                } else {
                    setBuyAmount('0'); // Unprofitable or no route
                }
            }).catch(e => {
                console.error("Failed to get cross-chain EVM quote", e);
                setBuyAmount('0');
            });
            return;
        }

        // SOL ↔ BCH ↔ Movement cross-chain: hit bch-solana-relayer /quote endpoint
        const isRelayerCross = ['bch-to-sol', 'sol-to-bch', 'bch-to-mov', 'mov-to-bch', 'sol-to-mov', 'mov-to-sol'].includes(swapType)
            || sellToken.chain === 'solana' || buyToken.chain === 'solana'
            || sellToken.chain === 'movement' || buyToken.chain === 'movement';

        if (isRelayerCross) {
            const sellSym = getRelayerTokenSymbol(sellToken);
            const buySym = getRelayerTokenSymbol(buyToken);
            const sellBaseUnits = Math.floor(Number(sellAmount) * Math.pow(10, sellToken.decimals || 0));

            axios.post(`${BCH_SOLANA_RELAYER_URL}/quote`, {
                sellToken: sellSym,
                buyToken: buySym,
                sellAmount: sellBaseUnits.toString()
            }).then(res => {
                const quoteBuyAmount = res.data.buyAmount;
                const buyDecimals = buyToken.decimals || 0;
                if (quoteBuyAmount && Number(quoteBuyAmount) > 0) {
                    setBuyAmount((Number(quoteBuyAmount) / Math.pow(10, buyDecimals)).toFixed(6));
                } else {
                    setBuyAmount('0');
                }
            }).catch(e => {
                console.warn('Relayer quote endpoint error, using fallback oracle price:', e?.message);
                const sellPrice = getTokenPrice(sellToken);
                const buyPrice = getTokenPrice(buyToken);
                if (sellPrice > 0 && buyPrice > 0) {
                    const usdValue = Number(sellAmount) * sellPrice;
                    let estimated = (usdValue / buyPrice) * 0.997; // 0.3% fee
                    setBuyAmount(estimated.toFixed(6));
                } else {
                    setBuyAmount('0');
                }
            });
            return;
        }

        // Generic fallback for any other unrecognised cross-chain pair
        const sellPrice = getTokenPrice(sellToken);
        const buyPrice = getTokenPrice(buyToken);
        if (sellPrice > 0 && buyPrice > 0) {
            const usdValue = Number(sellAmount) * sellPrice;
            let estimated = usdValue / buyPrice;
            const SOLVER_EDGE = import.meta.env.VITE_SOLVER_EDGE ? Number(import.meta.env.VITE_SOLVER_EDGE) : 0.005;
            estimated = estimated * (1 - SOLVER_EDGE);
            setBuyAmount(estimated.toFixed(6));
        }
    }, [sellAmount, sellToken, buyToken, getTokenPrice, orderType, limitPrice, swapType, wdk.bchNetwork]);

    // Limit order: explicit limitPrice drives buyAmount across same-chain and cross-chain pairs.
    // limitPrice means "1 sellToken = N buyToken" (matches the on-screen mkt-ratio display).
    useEffect(() => {
        if (orderType !== 'limit') return;
        if (!sellAmount || Number(sellAmount) <= 0) return;
        if (!limitPrice || Number(limitPrice) <= 0) return;
        const buyAmt = Number(sellAmount) * Number(limitPrice);
        setBuyAmount(buyAmt.toFixed(6));
    }, [limitPrice, sellAmount, orderType, swapType]);

    const flipTokens = () => {
        setFlipping(true);
        setSellToken(buyToken);
        setBuyToken(sellToken);
        setSellAmount(buyAmount);
        setBuyAmount(sellAmount);
        // Flip the anchor side tracking too
        if (anchorToken) setAnchorSide(s => s === 'sell' ? 'buy' : 'sell');
        setTimeout(() => setFlipping(false), 300);
    };

    // Wrapped token selectors that fire onAnchorTokenChange when the anchor side is changed
    const handleSellTokenSelect = (token: Token) => {
        if (anchorToken && anchorSide === 'sell' && onAnchorTokenChange) {
            onAnchorTokenChange(token);
        } else {
            setSellToken(token);
        }
    };

    const handleBuyTokenSelect = (token: Token) => {
        if (anchorToken && anchorSide === 'buy' && onAnchorTokenChange) {
            onAnchorTokenChange(token);
        } else {
            setBuyToken(token);
        }
    };

    const needsBCHWallet = sellToken.chain === 'bch' || buyToken.chain === 'bch';
    const needsSolanaWallet = sellToken.chain === 'solana' || buyToken.chain === 'solana';
    const needsEthWallet = isEvmChain(sellToken.chain) || isEvmChain(buyToken.chain);
    const needsMovementWallet = sellToken.chain === 'movement' || buyToken.chain === 'movement';

    // bchConnected represents if there's any active BCH wallet
    const bchConnected = isMainActive ? bchWallet.connected : !!activeExtWallet;
    
    const solanaConnected = !!wdk.solanaAddress;
    const ethConnected = !!wdk.evmAddress;
    const movementConnected = !!wdk.movementAddress;

    const canSubmit = useMemo(() => {
        if (!sellAmount || Number(sellAmount) <= 0) return false;
        if (!buyAmount || Number(buyAmount) <= 0) return false;
        if (needsBCHWallet && !bchConnected) return false;
        if (needsSolanaWallet && !solanaConnected) return false;
        if (needsEthWallet && !ethConnected) return false;
        if (needsMovementWallet && !movementConnected) return false;
        if (swapType === 'bch-to-xmr' && (!xmrAddress || !xmrViewKey || !xmrSpendKey)) return false;
        if (swapType === 'xmr-to-bch' && !bchConnected) return false;
        return true;
    }, [sellAmount, buyAmount, needsBCHWallet, bchConnected, needsSolanaWallet, solanaConnected, needsEthWallet, ethConnected, needsMovementWallet, movementConnected, swapType, xmrAddress, xmrViewKey, xmrSpendKey]);

    const parseCustomExpiry = (val: string): number => {
        const str = val.trim().toLowerCase();
        const match = str.match(/^([\d.]+)\s*(m|h|d|min|mins|hr|hrs|day|days)?$/);
        if (!match) return 3600; // fallback 1 hour
        const num = parseFloat(match[1]);
        if (isNaN(num)) return 3600;
        const unit = match[2];
        const seconds = unit?.startsWith('h') ? num * 3600
            : unit?.startsWith('d') ? num * 86400
            : num * 60; // default to minutes
        return Math.min(EXPIRY_MAX_SECONDS, Math.max(60, Math.floor(seconds)));
    };

    const handleSwap = async () => {
        if (!canSubmit) return;
        const params: BCHSwapParams = {
            sellToken, buyToken,
            sellAmount: Number(sellAmount), buyAmount: Number(buyAmount),
            swapType, orderType,
            duration: orderType === 'market' ? duration : undefined,
            expiryTime: orderType === 'limit'
                ? (expiryValue === 'custom' ? Math.floor(Date.now() / 1000) + parseCustomExpiry(customExpiryValue)
                  : Math.floor(Date.now() / 1000) + Math.min(EXPIRY_MAX_SECONDS, parseInt(expiryValue)))
                : undefined,
            xmr: swapType === 'bch-to-xmr'
                ? { viewKey: xmrViewKey, spendKey: xmrSpendKey } : undefined,
        };
        let recipientAddress: string | undefined;
        if (swapType === 'bch-to-sol' && wdk.solanaAddress) recipientAddress = wdk.solanaAddress;
        else if (swapType === 'bch-to-mov' && wdk.movementAddress) recipientAddress = wdk.movementAddress;
        else if (swapType === 'sol-to-mov' && wdk.movementAddress) recipientAddress = wdk.movementAddress;
        else if (swapType === 'mov-to-sol' && wdk.solanaAddress) recipientAddress = wdk.solanaAddress;
        else if (swapType === 'bch-to-xmr' && xmrAddress) recipientAddress = xmrAddress;
        else if ((swapType === 'sol-to-bch' || swapType === 'mov-to-bch' || swapType === 'xmr-to-bch') && bchWallet.address) recipientAddress = bchWallet.address;
        else if (swapType === 'eth-to-bch' && wdk.bchAddress) recipientAddress = wdk.bchAddress;
        else if (swapType === 'bch-to-eth' && wdk.evmAddress) recipientAddress = wdk.evmAddress;

        try {
            await executeSwap(params, recipientAddress || '');
            setSellAmount('');
            setBuyAmount('');
        } catch { /* toast handled in context */ }
    };

    const swapTypeInfo: Record<string, { icon: React.ReactNode; label: string; color: string; desc: string }> = {
        'same-chain': { icon: <Zap className="h-3 w-3" />, label: 'Same Chain', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', desc: `BCH covenant atomic swap (${isMainnet ? 'mainnet' : 'chipnet'})` },
        'bch-to-sol': { icon: <Sparkles className="h-3 w-3" />, label: 'ZK Swap', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20', desc: `FRI ZK BCH → Solana (auto, ${isMainnet ? 'mainnet' : 'chipnet'})` },
        'sol-to-bch': { icon: <Sparkles className="h-3 w-3" />, label: 'ZK Swap', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20', desc: `FRI ZK Solana → BCH (auto, ${isMainnet ? 'devnet' : 'devnet'})` },
        'bch-to-mov': { icon: <Globe className="h-3 w-3" />, label: 'Cross Chain', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20', desc: 'HTLC relay BCH → Movement' },
        'mov-to-bch': { icon: <Globe className="h-3 w-3" />, label: 'Cross Chain', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20', desc: 'HTLC relay Movement → BCH' },
        'sol-to-mov': { icon: <Globe className="h-3 w-3" />, label: 'Cross Chain', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20', desc: 'HTLC relay Solana → Movement' },
        'mov-to-sol': { icon: <Globe className="h-3 w-3" />, label: 'Cross Chain', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20', desc: 'HTLC relay Movement → Solana' },
        'bch-to-xmr': { icon: <Sparkles className="h-3 w-3" />, label: 'Adaptor Sig', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20', desc: 'Adaptor signature swap BCH → XMR' },
        'xmr-to-bch': { icon: <Sparkles className="h-3 w-3" />, label: 'Adaptor Sig', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20', desc: 'Adaptor signature swap XMR → BCH' },
        'eth-to-bch': { icon: <Sparkles className="h-3 w-3" />, label: 'ZK Swap', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20', desc: `FRI ZK swap ${activeEvmLabel} → BCH (auto)` },
        'bch-to-eth': { icon: <Sparkles className="h-3 w-3" />, label: 'ZK Swap', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20', desc: `FRI ZK swap BCH → ${activeEvmLabel} (auto)` },
    };
    const typeInfo = swapTypeInfo[swapType] ?? { icon: <Zap className="h-3 w-3" />, label: 'Swap', color: 'text-muted-foreground bg-muted/30 border-border', desc: '' };

    const sellUSD = sellAmount ? Number(sellAmount) * getTokenPrice(sellToken) : 0;
    const buyUSD = buyAmount ? Number(buyAmount) * getTokenPrice(buyToken) : 0;
    const priceImpact = sellUSD > 0 && buyUSD > 0 ? ((buyUSD - sellUSD) / sellUSD) * 100 : 0;

    // Maps token.chain (lowercase) → portfolio chain label (title-case)
    const PORTFOLIO_CHAIN: Record<string, string> = useMemo(() => ({
        ethereum: isMainnet ? 'Ethereum' : 'Ethereum',
        bsc:      isMainnet ? 'BSC' : 'BSC',
        solana:   'Solana',
    }), [isMainnet]);

    // Wallet balance helpers
    const sellBalance: number | null = useMemo(() => {
        if (sellToken.chain === 'bch' && bchConnected && sellToken.type === 'native') {
            return bchWallet.balance / 1e8;
        }
        if (sellToken.chain === 'bch' && bchConnected && isMainActive && sellToken.type && bchWallet.tokenBalances[sellToken.type]) {
            return Number(bchWallet.tokenBalances[sellToken.type]) / Math.pow(10, sellToken.decimals || 0);
        }
        // If an external wallet is active, we don't have token balances immediately available in the provider yet
        if (sellToken.chain === 'bch' && activeExtWallet) {
            // Note: In the future, we should fetch token balances for external wallets.
            // For now, allow swap but don't show max balance accurately if it's a token
            if (sellToken.type === 'native') return 0; // we don't track native balance in external provider currently either, fallback
            return null;
        }
        // Movement (MOVE/USDC/USDT) — look up directly in WDK Movement token balances
        if (sellToken.chain === 'movement' && wdk.movementAddress) {
            const sym = sellToken.symbol?.toUpperCase();
            if (sym === 'MOVE') return wdk.movementTokenBalances?.MOVE ?? null;
            if (sym === 'USDC') return wdk.movementTokenBalances?.USDC ?? null;
            if (sym === 'USDT') return wdk.movementTokenBalances?.USDT ?? null;
        }
        // EVM (ETH/USDC/USDT) and Solana (SOL/USDC) — look up in portfolio
        const portfolioChain = sellToken.chain ? PORTFOLIO_CHAIN[sellToken.chain] : undefined;
        if (portfolioChain && portfolio.tokens.length > 0) {
            const entry = portfolio.tokens.find(
                t => t.symbol === sellToken.symbol && t.chain === portfolioChain,
            );
            return entry?.balance ?? null;
        }
        return null;
    }, [sellToken, bchConnected, bchWallet.balance, bchWallet.tokenBalances, PORTFOLIO_CHAIN, portfolio.tokens, wdk.movementAddress, wdk.movementTokenBalances]);

    const setPercent = (pct: number) => {
        if (sellBalance === null) return;
        const v = sellBalance * pct;
        setSellAmount(v.toFixed(Math.min(sellToken.decimals ?? 6, 8)));
    };

    // ──────────────────────────────────────────────────────────────────
    // CTA button
    // ──────────────────────────────────────────────────────────────────
    const renderCTA = () => {
        const needsWallet =
            (needsBCHWallet && !bchConnected) ||
            (needsSolanaWallet && !solanaConnected) ||
            (needsEthWallet && !ethConnected);

        if (needsWallet) {
            return <ConnectWalletButton className="w-full h-14 rounded-2xl" />;
        }
        if (!sellAmount || Number(sellAmount) <= 0) {
            return <Button className="w-full h-14 text-base font-semibold rounded-2xl bg-white/[0.04] text-white/40 hover:bg-white/[0.04]" disabled>Enter an amount</Button>;
        }
        if (sellBalance !== null && Number(sellAmount) > sellBalance) {
            return <Button className="w-full h-14 text-base font-semibold rounded-2xl bg-red-500/15 text-red-300 hover:bg-red-500/15" disabled>Insufficient {sellToken.symbol} balance</Button>;
        }
        return (
            <Button
                className="w-full h-14 text-base font-semibold bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 rounded-2xl shadow-lg shadow-emerald-500/20 disabled:from-white/[0.04] disabled:to-white/[0.04] disabled:text-white/40 disabled:shadow-none transition-all"
                onClick={handleSwap}
                disabled={!canSubmit || isLoading}
            >
                {isLoading
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {swapStep || 'Processing…'}</>
                    : orderType === 'limit'
                        ? `Place limit · ${sellToken.symbol} → ${buyToken.symbol}`
                        : (!isMainActive && swapType === 'same-chain')
                            ? `Sign ${sellToken.symbol} → ${buyToken.symbol} (External Wallet)`
                            : `Swap ${sellToken.symbol} → ${buyToken.symbol}`}
            </Button>
        );
    };

    const formatAddress = (addr: string) => {
        if (addr.length <= 16) return addr;
        return `${addr.slice(0, 12)}...${addr.slice(-6)}`;
    };

    return (
        <div className={cn(
            'overflow-hidden',
            transparent 
                ? 'rounded-none' 
                : 'rounded-none sm:rounded-3xl bg-transparent sm:bg-card/80 sm:backdrop-blur-sm sm:border sm:border-muted/50 sm:shadow-lg'
        )}>
            {/* ─── Header: Segmented order-type tabs + settings ─── */}
            <div className="flex items-center justify-between p-4 pb-3">
                <div className="inline-flex rounded-full bg-white/[0.04] p-1 border border-white/[0.06]">
                    <button
                        onClick={() => onOrderTypeChange('market')}
                        className={cn(
                            'px-4 py-1.5 text-xs font-semibold rounded-full transition-all',
                            orderType === 'market'
                                ? 'bg-white/[0.08] text-white shadow-sm'
                                : 'text-white/50 hover:text-white/80'
                        )}
                    >
                        Swap
                    </button>
                    <button
                        onClick={() => onOrderTypeChange('limit')}
                        className={cn(
                            'px-4 py-1.5 text-xs font-semibold rounded-full transition-all',
                            orderType === 'limit'
                                ? 'bg-white/[0.08] text-white shadow-sm'
                                : 'text-white/50 hover:text-white/80'
                        )}
                    >
                        Limit
                    </button>
                    <button
                        onClick={() => onOrderTypeChange('twap')}
                        className={cn(
                            'px-4 py-1.5 text-xs font-semibold rounded-full transition-all',
                            orderType === 'twap'
                                ? 'bg-white/[0.08] text-white shadow-sm'
                                : 'text-white/50 hover:text-white/80'
                        )}
                    >
                        TWAP
                    </button>
                </div>

                <div className="flex items-center gap-1">
                    {/* Wallet Selector Dropdown */}
                    {((bchWallet.connected && bchWallet.address ? 1 : 0) + extBCH.wallets.length > 1) && (
                        <Popover>
                            <PopoverTrigger asChild>
                                <button className={cn(
                                    "flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-bold transition-all",
                                    isMainActive 
                                        ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                                        : "bg-blue-500/15 text-blue-300 border border-blue-500/30"
                                )}>
                                    {isMainActive 
                                        ? <Wallet className="h-3.5 w-3.5 text-emerald-400" />
                                        : <ShoppingBag className="h-3.5 w-3.5 text-blue-400" />
                                    }
                                    <span className="truncate max-w-[80px]">
                                        {isMainActive ? 'Main Wallet' : (activeExtWallet?.label || 'External')}
                                    </span>
                                    <ChevronDown className="h-3 w-3 opacity-50" />
                                </button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-56 bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-2 text-xs">
                                <div className="space-y-1">
                                    <p className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-white/40 font-semibold">Active BCH Wallet</p>
                                    
                                    {bchWallet.connected && bchWallet.address && (
                                        <button
                                            onClick={() => setActiveWallet('main')}
                                            className={cn(
                                                "w-full flex items-center justify-between px-2.5 py-2 rounded-xl transition-colors",
                                                isMainActive ? "bg-emerald-500/10 text-emerald-300" : "hover:bg-white/[0.06] text-white/80"
                                            )}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Wallet className={cn("h-3.5 w-3.5", isMainActive ? "text-emerald-400" : "text-white/40")} />
                                                <span>Main Wallet</span>
                                            </div>
                                            <span className="text-[10px] opacity-60 font-mono">{formatAddress(bchWallet.address)}</span>
                                        </button>
                                    )}

                                    {extBCH.wallets.map((w, idx) => (
                                        <button
                                            key={w.id}
                                            onClick={() => setActiveWallet(w.id)}
                                            className={cn(
                                                "w-full flex items-center justify-between px-2.5 py-2 rounded-xl transition-colors",
                                                activeWalletId === w.id ? "bg-blue-500/10 text-blue-300" : "hover:bg-white/[0.06] text-white/80"
                                            )}
                                        >
                                            <div className="flex items-center gap-2">
                                                <ShoppingBag className={cn("h-3.5 w-3.5", activeWalletId === w.id ? "text-blue-400" : "text-white/40")} />
                                                <span>{w.label}</span>
                                            </div>
                                            <span className="text-[10px] opacity-60 font-mono">{formatAddress(w.address)}</span>
                                        </button>
                                    ))}
                                </div>
                            </PopoverContent>
                        </Popover>
                    )}

                    {/* Network toggle pill */}
                    <button
                        onClick={toggleNetwork}
                        title={isMainnet ? 'Switch to testnet' : 'Switch to mainnet'}
                        className={cn(
                            'h-7 px-2.5 rounded-full text-[11px] font-semibold border transition-colors',
                            isMainnet
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                                : 'bg-white/[0.04] text-white/50 border-white/[0.08] hover:text-white/80 hover:bg-white/[0.07]'
                        )}
                    >
                        {isMainnet ? 'Mainnet' : 'Testnet'}
                    </button>

                    {/* Orders & History toggle — hidden in compact/embedded mode */}
                    {onToggleOrders && !compact && (
                        <button
                            onClick={onToggleOrders}
                            title={ordersVisible ? 'Hide Orders & History' : 'Show Orders & History'}
                            aria-pressed={!!ordersVisible}
                            className={cn(
                                'p-2 rounded-xl transition-colors',
                                ordersVisible
                                    ? 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15'
                                    : 'text-white/60 hover:text-white hover:bg-white/[0.06]'
                            )}
                        >
                            <History className="h-4 w-4" />
                        </button>
                    )}

                    <Popover>
                        <PopoverTrigger asChild>
                            <button className="p-2 rounded-xl hover:bg-white/[0.06] text-white/60 hover:text-white transition-colors">
                                <Settings2 className="h-4 w-4" />
                            </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-72 bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 text-xs">
                        <div className="space-y-3">
                            <p className="text-xs uppercase tracking-wider text-white/40 font-semibold">Settings</p>
                            {orderType === 'market' && (
                                <div className="space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-white/60 flex items-center gap-1.5">
                                            <Zap className="h-3 w-3 text-emerald-400" />
                                            Auction duration
                                        </span>
                                        <span className="font-mono text-[11px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md tabular-nums">
                                            {formatAuctionDuration(duration)}
                                        </span>
                                    </div>

                                    <input
                                        type="range"
                                        min={AUCTION_DURATION.min}
                                        max={AUCTION_DURATION.max}
                                        step={AUCTION_DURATION.step}
                                        value={duration}
                                        onChange={e => setDuration(Number(e.target.value))}
                                        style={{
                                            background: `linear-gradient(to right, #10b981 ${durationPct}%, rgba(255,255,255,0.08) ${durationPct}%)`,
                                        }}
                                        className="defi-range w-full"
                                    />

                                    <div className="flex gap-1">
                                        {AUCTION_DURATION_PRESETS.map(p => (
                                            <button
                                                key={p}
                                                type="button"
                                                onClick={() => setDuration(p)}
                                                className={cn(
                                                    'flex-1 py-1 rounded-md text-[10px] font-bold border transition-colors',
                                                    duration === p
                                                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                                        : 'bg-white/[0.03] text-white/50 border-white/[0.06] hover:text-white hover:bg-white/[0.06]',
                                                )}
                                            >
                                                {formatAuctionDuration(p)}
                                            </button>
                                        ))}
                                    </div>

                                    <p className="text-xs text-white/40 leading-relaxed">
                                        Dutch auction: price walks down over this period until a solver fills it.
                                    </p>
                                </div>
                            )}
                            {orderType === 'limit' && (
                                <p className="text-xs text-white/40 leading-relaxed">
                                    Limit orders fill only at your price or better, before the expiry.
                                </p>
                            )}
                        </div>
                    </PopoverContent>
                    </Popover>
                </div>
            </div>

            {/* ─── Limit price card (limit mode only) ─── */}
            {orderType === 'limit' && (
                <div className="mx-4 mb-3 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-3 animate-in fade-in-50 slide-in-from-top-1 duration-200">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-white/50">When 1 {sellToken.symbol} is worth</span>
                        {/* Show the price a solver will actually fill at when we have it,
                            and say which number is on screen. USD mid was previously shown
                            as "mkt" and used as the default, which is why the default limit
                            order could never fill. */}
                        {referenceIsFillable ? (
                            <span className="text-xs text-emerald-400/70 font-mono" title="Best price a solver will fill at right now, from the relayer's quote">
                                fills at {referenceRatio.toFixed(6)} {buyToken.symbol}
                            </span>
                        ) : currentMarketRatio > 0 && (
                            <span className="text-xs text-white/30 font-mono" title="Indicative USD mid — a solver needs a margin on top, so an order at this price may not fill">
                                mkt {currentMarketRatio.toFixed(6)} {buyToken.symbol}
                            </span>
                        )}
                    </div>
                    <div className="flex items-baseline gap-2">
                        <Input
                            type="number"
                            placeholder="0.00"
                            value={limitPrice}
                            onChange={e => { setLimitPrice(e.target.value); setPriceTouched(true); }}
                            inputMode="decimal"
                            className="border-none bg-transparent text-xl sm:text-2xl font-bold p-0 h-auto focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none flex-1 min-w-0"
                        />
                        <span className="text-sm font-semibold text-white/70 shrink-0">{buyToken.symbol}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {PRICE_PRESETS.map(preset => (
                            <button
                                key={preset.label}
                                disabled={referenceRatio <= 0}
                                onClick={() => {
                                    if (referenceRatio <= 0) return;
                                    setLimitPrice((referenceRatio * preset.mult).toFixed(6));
                                    // A preset is a deliberate choice; stop re-seeding over it.
                                    setPriceTouched(true);
                                }}
                                title={preset.mult === 1
                                    ? 'Price this to fill at the current best solver quote'
                                    : `Ask ${Math.round((preset.mult - 1) * 100)}% above the fillable price — rests until the market moves`}
                                className="px-2.5 py-1 rounded-full text-xs font-semibold bg-white/[0.04] hover:bg-emerald-500/15 hover:text-emerald-300 text-white/60 border border-white/[0.06] hover:border-emerald-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>

                    {/* The order is still submittable — the maker may well intend to rest
                        above the market — but silently creating an unfillable order is
                        what made limit orders look broken. */}
                    {priceAboveFillable && (
                        <div className="flex items-start gap-2 text-xs text-amber-400/90 bg-amber-500/[0.07] border border-amber-500/20 rounded-lg px-2.5 py-2">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
                            <span>
                                Above the fillable price ({referenceRatio.toFixed(6)} {buyToken.symbol}).
                                This will rest until the market moves rather than filling now.
                            </span>
                        </div>
                    )}
                    {quoteUnavailable && (
                        <div className="flex items-start gap-2 text-xs text-white/40 bg-white/[0.03] border border-white/[0.06] rounded-lg px-2.5 py-2">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
                            <span>Solver quote unavailable — the price shown is indicative USD mid, not a fillable quote.</span>
                        </div>
                    )}
                    <div className="flex flex-col gap-2 pt-2 border-t border-white/[0.04]">
                        <div className="flex flex-wrap items-center gap-y-2 justify-between">
                            <span className="text-sm text-white/50 shrink-0">Expires in</span>
                            <div className="flex flex-wrap gap-1 justify-end">
                                {EXPIRY_PRESETS.map(p => (
                                    <button
                                        key={p.value}
                                        onClick={() => setExpiryValue(p.value)}
                                        className={cn(
                                            'px-2.5 py-0.5 rounded-md text-xs font-semibold transition-colors',
                                            expiryValue === p.value
                                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                                : 'text-white/50 hover:text-white border border-transparent'
                                        )}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setExpiryValue('custom')}
                                    className={cn(
                                        'px-2.5 py-0.5 rounded-md text-xs font-semibold transition-colors',
                                        expiryValue === 'custom'
                                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                            : 'text-white/50 hover:text-white border border-transparent'
                                    )}
                                >
                                    Custom
                                </button>
                            </div>
                        </div>
                        {expiryValue === 'custom' && (
                            <div className="flex justify-end">
                                <Input
                                    type="text"
                                    placeholder="e.g. 5m, 4.5h, 2d (max 30d)"
                                    value={customExpiryValue}
                                    onChange={e => setCustomExpiryValue(e.target.value)}
                                    className="h-7 w-36 text-right text-xs bg-black/40 border-white/10 focus-visible:ring-1 focus-visible:ring-emerald-500/50"
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ─── Sell input ─── */}
            <div className="mx-4 mb-1">
                <div className={cn(
                    "p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] transition-all space-y-2",
                    flipping && "scale-[0.99]"
                )}>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-white/50 font-medium">Sell</span>
                        {sellBalance !== null && (
                            <div className="flex items-center gap-1.5 text-xs text-white/40">
                                <span>Balance: {sellBalance.toFixed(Math.min(sellToken.decimals ?? 6, 6))}</span>
                                <button onClick={() => setPercent(0.5)} className="px-1.5 py-0.5 rounded text-emerald-400 hover:bg-emerald-500/10 font-semibold">50%</button>
                                <button onClick={() => setPercent(1)} className="px-1.5 py-0.5 rounded text-emerald-400 hover:bg-emerald-500/10 font-semibold">Max</button>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                        <Input
                            type="number"
                            placeholder="0"
                            value={sellAmount}
                            onChange={e => setSellAmount(e.target.value)}
                            inputMode="decimal"
                            className="border-none bg-transparent text-2xl sm:text-3xl font-bold p-0 h-auto focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none flex-1 min-w-0 text-white placeholder:text-white/20"
                        />
                        <BCHTokenSelector value={sellToken} onSelect={handleSellTokenSelect} tokens={availableTokens} evmNetworkLabel={activeEvmLabel} isMainnet={isMainnet} />
                    </div>
                    <div className="text-sm text-white/40 font-mono">
                        ≈ ${sellUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                </div>
            </div>

            {/* ─── Flip ─── */}
            <div className="flex justify-center -my-2 relative z-10">
                <button
                    onClick={flipTokens}
                    className={cn(
                        "h-9 w-9 rounded-xl bg-card border-4 border-card flex items-center justify-center",
                        "ring-1 ring-white/[0.08] hover:ring-emerald-500/40 hover:bg-emerald-500/5",
                        "transition-all duration-200 group"
                    )}
                    aria-label="Flip tokens"
                >
                    <ArrowDown className={cn(
                        "h-4 w-4 text-white/60 group-hover:text-emerald-400 transition-all duration-300",
                        flipping && "rotate-180"
                    )} />
                </button>
            </div>

            {/* ─── Buy input ─── */}
            <div className="mx-4 mt-1">
                <div className={cn(
                    "p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] transition-all space-y-2",
                    flipping && "scale-[0.99]"
                )}>
                    <span className="text-sm text-white/50 font-medium">Buy</span>
                    <div className="flex items-center gap-2 sm:gap-3">
                        <Input
                            type="number"
                            placeholder="0"
                            value={buyAmount}
                            onChange={e => setBuyAmount(e.target.value)}
                            readOnly={orderType === 'market'}
                            inputMode="decimal"
                            className="border-none bg-transparent text-2xl sm:text-3xl font-bold p-0 h-auto focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none flex-1 min-w-0 text-white placeholder:text-white/20"
                        />
                        <BCHTokenSelector value={buyToken} onSelect={handleBuyTokenSelect} tokens={availableTokens} evmNetworkLabel={activeEvmLabel} isMainnet={isMainnet} />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-white/40 font-mono">
                            ≈ ${buyUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        {priceImpact !== 0 && Math.abs(priceImpact) > 0.01 && (
                            <span className={cn(
                                "font-mono",
                                priceImpact < -2 ? "text-red-400" : priceImpact < -0.5 ? "text-yellow-400" : "text-white/40"
                            )}>
                                {priceImpact > 0 ? '+' : ''}{priceImpact.toFixed(2)}%
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* ─── XMR params ─── */}
            {swapType === 'bch-to-xmr' && (
                <div className="mx-4 mt-3 p-4 rounded-2xl bg-orange-500/[0.04] border border-orange-500/20 space-y-3 animate-in fade-in-50 slide-in-from-top-1 duration-200">
                    <div className="flex items-center gap-2 text-xs text-orange-400 font-semibold">
                        <Sparkles className="h-3.5 w-3.5" />
                        Monero adaptor parameters
                    </div>
                    <div className="space-y-2">
                        <div>
                            <label className="text-xs uppercase tracking-wider text-white/40 font-semibold">Recipient XMR address</label>
                            <Input type="text" placeholder="4..." className="mt-1 h-9 bg-black/40 border-white/10 text-xs focus-visible:ring-1 focus-visible:ring-orange-500/50"
                                value={xmrAddress} onChange={e => setXmrAddress(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs uppercase tracking-wider text-white/40 font-semibold">View key</label>
                                <Input type="password" placeholder="hex" className="mt-1 h-9 bg-black/40 border-white/10 text-xs focus-visible:ring-1 focus-visible:ring-orange-500/50"
                                    value={xmrViewKey} onChange={e => setXmrViewKey(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-xs uppercase tracking-wider text-white/40 font-semibold">Spend key</label>
                                <Input type="password" placeholder="hex" className="mt-1 h-9 bg-black/40 border-white/10 text-xs focus-visible:ring-1 focus-visible:ring-orange-500/50"
                                    value={xmrSpendKey} onChange={e => setXmrSpendKey(e.target.value)} />
                            </div>
                        </div>
                        <p className="text-xs text-white/40 leading-relaxed">
                            Keys stay client-side to derive adaptor params and decrypt your XMR.
                        </p>
                    </div>
                </div>
            )}

            {swapType === 'xmr-to-bch' && (
                <div className="mx-4 mt-3 p-4 rounded-2xl bg-orange-500/[0.04] border border-orange-500/20 space-y-2 animate-in fade-in-50 slide-in-from-top-1 duration-200">
                    <div className="flex items-center gap-2 text-xs text-orange-400 font-semibold">
                        <Sparkles className="h-3.5 w-3.5" /> Monero deposit
                    </div>
                    <p className="text-sm text-white/60 leading-relaxed">
                        After clicking Swap, the relayer generates a one-time Monero Stagenet deposit address. You have 2 hours to send the exact XMR amount.
                    </p>
                </div>
            )}

            {/* ─── TWAP Form / Route summary / CTA ─── */}
            {orderType === 'twap' ? (
                <div className="mx-4 mt-2 mb-2">
                    <TWAPOrderForm
                        sellToken={sellToken}
                        buyToken={buyToken}
                        sellAmount={sellAmount}
                        onSellAmountChange={setSellAmount}
                        onOrderPlaced={() => {
                            if (onToggleOrders && !ordersVisible) onToggleOrders();
                        }}
                        userAddress={userAddress}
                        userPkh={userPkhHex}
                        isConnected={!!userAddress}
                        sellBalance={sellBalance}
                    />
                </div>
            ) : (
                <>
                    {/* ─── Route summary ─── */}
                    {sellAmount && Number(sellAmount) > 0 && (
                        <div className="mx-4 mt-3 rounded-2xl bg-white/[0.02] border border-white/[0.05] overflow-hidden">
                            <button
                                onClick={() => setRouteExpanded(v => !v)}
                                className="w-full flex items-center justify-between px-4 py-3 text-xs hover:bg-white/[0.02] transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className={cn("text-[10px] h-4 px-1.5 gap-1 border", typeInfo.color)}>
                                        {typeInfo.icon}{typeInfo.label}
                                    </Badge>
                                    <span className="font-mono text-white/70">
                                        1 {sellToken.symbol} ≈ {
                                            getTokenPrice(sellToken) > 0 && getTokenPrice(buyToken) > 0
                                                ? (getTokenPrice(sellToken) / getTokenPrice(buyToken)).toFixed(6)
                                                : '…'
                                        } {buyToken.symbol}
                                    </span>
                                </div>
                                {routeExpanded ? <ChevronUp className="h-3 w-3 text-white/40" /> : <ChevronDown className="h-3 w-3 text-white/40" />}
                            </button>
                            {routeExpanded && (
                                <div className="px-4 pb-3 space-y-1.5 text-sm border-t border-white/[0.04] pt-2 animate-in fade-in-50 duration-200">
                                    <div className="flex justify-between text-white/50">
                                        <span>Route</span>
                                        <span className="text-white/80">{typeInfo.desc}</span>
                                    </div>
                                    <div className="flex justify-between text-white/50">
                                        <span>Order type</span>
                                        <span className="text-white/80 capitalize">{orderType}{orderType === 'market' ? ' (Dutch auction)' : ''}</span>
                                    </div>
                                    {orderType === 'market' && (
                                        <div className="flex justify-between text-white/50">
                                            <span>Auction duration</span>
                                            <span className="text-white/80">{formatAuctionDuration(duration)}</span>
                                        </div>
                                    )}
                                    {orderType === 'limit' && limitPrice && (
                                        <div className="flex justify-between text-white/50">
                                            <span>Limit price</span>
                                            <span className="text-white/80">{limitPrice} {buyToken.symbol}</span>
                                        </div>
                                    )}
                                    {swapType !== 'same-chain' && (
                                        <div className="flex items-center gap-1 text-yellow-400/80 pt-1">
                                            <AlertTriangle className="h-3 w-3" />
                                            <span>Cross-chain — relies on solver/relayer fill</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ─── CTA ─── */}
                    <div className="p-4 pt-3">{renderCTA()}</div>
                </>
            )}

            {/* ─── In-progress step indicator ─── */}
            {isLoading && swapStep && (
                <div className="mx-4 mb-4 rounded-2xl bg-blue-500/[0.06] border border-blue-500/20 p-3 animate-in fade-in-50 slide-in-from-bottom-1 duration-200">
                    <div className="flex items-center gap-2 text-sm text-blue-300 font-medium">
                        <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                        <span className="truncate">{swapStep}</span>
                    </div>
                    <div className="text-sm text-white/50 mt-1 leading-relaxed">
                        {swapType === 'same-chain' && `Deploying CashToken covenant on BCH ${isMainnet ? 'mainnet' : 'chipnet'}. Solver fills your order atomically.`}
                        {swapType === 'bch-to-sol' && 'Deploying HTLC covenant on BCH, then notifying relayer to fill on Solana.'}
                        {swapType === 'sol-to-bch' && 'Creating escrow on Solana, then notifying relayer to fill on BCH.'}
                        {swapType === 'eth-to-bch' && `Locking ${evmCfg.nativeCurrency} in FRI escrow on ${activeEvmLabel}. Server fills BCH and claims via ZK proof.`}
                        {swapType === 'bch-to-eth' && `Funding BCH ZK covenant. Server fills ${evmCfg.nativeCurrency} on ${activeEvmLabel} and claims covenant via STARK proof.`}
                        {(swapType === 'bch-to-mov' || swapType === 'mov-to-bch') && 'HTLC relay with Movement settlement.'}
                        {(swapType === 'bch-to-xmr' || swapType === 'xmr-to-bch') && 'Adaptor signature swap — keys never leave your browser.'}
                    </div>
                </div>
            )}
        </div>
    );
}
