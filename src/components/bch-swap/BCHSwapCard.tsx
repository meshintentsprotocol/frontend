import { useTokenCatalog } from '@/hooks/useTokenCatalog';
import { tokenKey, tokensInMode, type SwapTokenMode } from '@/swap-server/tokens';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    ArrowDown, Loader2, Zap, Globe, AlertTriangle, Settings2, History,
    Sparkles, Target
} from 'lucide-react';
import { Token, BCHSwapParams, BCHSwapType, BCHOrderType } from '@/types';
import { BCHTokenSelector, BCH_TOKENS, ALL_BCH_SWAP_TOKENS, MAINNET_SWAP_TOKENS } from './BCHTokenSelector';
import { isEvmChain, getEVMChainConfig, EVM_CHAINS_TESTNET } from '@/lib/evmChains';
import { useBCHWallet } from '@/context/BCHWalletProvider';
import { useBCHSwap } from '@/context/BCHSwapContext';
import { useWDK } from '@/context/WDKProvider';
import { usePortfolio } from '@/hooks/usePortfolio';
import { ConnectWalletButton } from '@/components/connect-wallet-button';
import { useLocation } from 'react-router-dom';
import { PriceService } from '@/lib/pyth';
import { marketSymbolFor } from '@/lib/marketData';
import { CASHTOKEN_RELAYER_URL, CASHTOKEN_RELAYER_MAINNET_URL, EVM_RELAYER_URL, EVM_RELAYER_MAINNET_URL, BCH_SOLANA_RELAYER_URL } from '@/lib/config';
import axios from 'axios';
import { AUCTION_DURATION, AUCTION_DURATION_PRESETS, formatAuctionDuration, getDefaultAuctionDuration } from '@/lib/appSettings';
import { PriceData } from '@/types';
import { cn } from '@/lib/utils';
import {
    Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { useActiveWallet } from '@/hooks/useActiveWallet';
import { useBchWalletBalance } from '@/hooks/useBchWalletBalance';
import { ActiveWalletChip } from '@/components/wallet/ActiveWalletChip';
import { QuoteCard, QuoteRow, QuoteWarning } from './QuoteCard';
import { TWAPOrderForm } from './TWAPOrderForm';
import { cashAddressToLockingBytecode, binToHex } from '@bitauth/libauth';
import { pusdToken, PUSD_MAINNET, PUSD_CHIPNET } from '@/lib/pusd';
import { useSwapServerCard } from '@/swap-server/useSwapServerCard';
import { SwapServerButton, SwapServerDetails } from '@/swap-server/SwapServerCardParts';
import { walletUi } from '@/lib/walletUi';
import { triggerBalanceRefresh } from '@/lib/balanceRefresh';
import { useMeshQuote } from './useMeshQuote';
import { ExpiryPicker } from './ExpiryPicker';
import { toBaseUnits, fromBaseUnits, ratioString, limitBuyUnits, plainDecimal } from '@/lib/units';
import { DEFAULT_EXPIRY_SECONDS, describeDuration, formatExpiryAt } from '@/lib/expiry';

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

/** A limit price as a plain decimal with 8 significant digits. */
const priceString = (n: number): string => (n > 0 && Number.isFinite(n) ? plainDecimal(Number(n.toPrecision(8))) : '');

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

    const initialNetwork = useWDK().bchNetwork;
    const initialTokens = tokensInMode(initialNetwork === 'mainnet' ? MAINNET_SWAP_TOKENS : ALL_BCH_SWAP_TOKENS, initialNetwork === 'mainnet');
    const initialSellToken = useMemo(() => {
        if (anchorToken && anchorSideProp === 'sell') return anchorToken;
        const sellParam = queryParams.get('sell');
        if (sellParam) {
            return initialTokens.find(t => tokenKey(t) === sellParam) ?? initialTokens.find(t => t.symbol.toUpperCase() === sellParam.toUpperCase()) ?? BCH_TOKENS[0];
        }
        return BCH_TOKENS[0];
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Default pair: BCH → pUSD of the active network (PUSD on mainnet, PUSDTEST on chipnet).
    const initialBuyToken = useMemo(() => {
        if (anchorToken && anchorSideProp === 'buy') return anchorToken;
        // CashToken sell-side anchor → pair with BCH so the swap makes sense
        if (anchorToken && anchorSideProp === 'sell' && anchorToken.type === 'cashtoken') return BCH_TOKENS[0];
        const buyParam = queryParams.get('buy');
        if (buyParam) {
            return initialTokens.find(t => tokenKey(t) === buyParam) ?? initialTokens.find(t => t.symbol.toUpperCase() === buyParam.toUpperCase()) ?? pusdToken(initialNetwork === 'mainnet');
        }
        return pusdToken(initialNetwork === 'mainnet');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [sellToken, setSellToken] = useState<Token>(initialSellToken);
    const [buyToken, setBuyToken] = useState<Token>(initialBuyToken);
    const [sellAmount, setSellAmount] = useState('');
    const [buyAmount, setBuyAmount] = useState('');

    const [duration, setDuration] = useState(() => getDefaultAuctionDuration());
    const durationPct = ((duration - AUCTION_DURATION.min) / (AUCTION_DURATION.max - AUCTION_DURATION.min)) * 100;
    const [limitPrice, setLimitPrice] = useState<string>('');
    /** Seconds a limit order stays open; null while a custom entry is invalid. */
    const [expirySeconds, setExpirySeconds] = useState<number | null>(DEFAULT_EXPIRY_SECONDS);

    const [xmrAddress, setXmrAddress] = useState('');
    const [xmrViewKey, setXmrViewKey] = useState('');
    const [xmrSpendKey, setXmrSpendKey] = useState('');

    const [prices, setPrices] = useState<Record<string, PriceData>>({});
    const [cauldronPrices, setCauldronPrices] = useState<Record<string, number>>({});
    const [flipping, setFlipping] = useState(false);

    const { isMainActive, activeExtWallet } = useActiveWallet();
    const bchWallet = useBCHWallet();
    const { detectSwapType, executeSwap, isLoading, swapStep, pendingOrders } = useBCHSwap();
    const wdk = useWDK();

    // A new BCH order (market or limit) opens its own step card, on this page or embedded on a token page.
    // The swap server's pairs and TWAP open theirs from their own flows.
    const seenOrderIds = useRef<Set<string> | null>(null);
    useEffect(() => {
        const ids = new Set((pendingOrders ?? []).map(o => o.id));
        if (seenOrderIds.current) {
            const fresh = (pendingOrders ?? []).find(o => !seenOrderIds.current!.has(o.id) && Date.now() - o.createdAt < 60_000);
            if (fresh) walletUi.openOrder({ source: 'bch', id: fresh.id });
        }
        seenOrderIds.current = ids;
    }, [pendingOrders]);

    // An external wallet's holdings are read from chain; WizardConnect aggregates across all HD addresses.
    const extBalance = useBchWalletBalance({
        wallet: isMainActive ? null : (activeExtWallet ?? null),
        isMainnet: wdk.bchNetwork === 'mainnet',
        refetchMs: 15_000,
    });

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
        } catch { /* Invalid addresses have no public-key hash. */ }
        return '';
    }, [userAddress]);
    const isMainnet = wdk.bchNetwork === 'mainnet';
    const portfolio = usePortfolio({ pollingMs: 30_000 });

    // Pairs the swap server handles (cross-chain USDC through Circle CCTP, Solana swaps through Jupiter) are
    // routed before any flow below; see src/swap-server/routing.ts. `ssHandled` is false for every other pair,
    // and then nothing in this card changes.
    const ss = useSwapServerCard({ sellToken, buyToken, sellAmount, isMainnet });
    const ssHandled = ss.active || !!ss.blocked;

    const staticTokens = isMainnet ? MAINNET_SWAP_TOKENS : ALL_BCH_SWAP_TOKENS;
    const ssTokens = ss.tokens;
    const modeTokens = useMemo(() => tokensInMode(staticTokens, isMainnet), [staticTokens, isMainnet]);
    const catalog = useTokenCatalog(modeTokens, isMainnet);
    const availableTokens = useMemo(() => ssTokens(catalog.tokens), [ssTokens, catalog.tokens]);

    useEffect(() => {
        const refresh = (current: Token) => {
            const row = availableTokens.find(t => tokenKey(t) === tokenKey(current));
            return row && JSON.stringify(row) !== JSON.stringify(current) ? row : current;
        };
        setSellToken(refresh);
        setBuyToken(refresh);
    }, [availableTokens]);

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
        const pusd = pusdToken(isMainnet);
        const allowed = new Set([...availableTokens, pusd].map(t => `${t.chain}:${t.symbol}`));
        const anchorIsSell = !!anchorToken && anchorSide === 'sell';
        const anchorIsBuy  = !!anchorToken && anchorSide === 'buy';
        // pUSD of the other network → this network's pUSD
        const otherPusd = (t: Token) => (t.categoryId === PUSD_MAINNET || t.categoryId === PUSD_CHIPNET) && t.categoryId !== pusd.categoryId;
        if (!anchorIsSell && (otherPusd(sellToken) || (sellToken.network && sellToken.network !== (isMainnet ? 'mainnet' : 'testnet')) || !allowed.has(`${sellToken.chain}:${sellToken.symbol}`))) {
            setSellToken(otherPusd(sellToken) ? pusd : BCH_TOKENS[0]);
        }
        if (!anchorIsBuy && (otherPusd(buyToken) || (buyToken.network && buyToken.network !== (isMainnet ? 'mainnet' : 'testnet')) || !allowed.has(`${buyToken.chain}:${buyToken.symbol}`))) {
            setBuyToken(pusd);
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
            const token = availableTokens.find(t => tokenKey(t) === sellParam) ?? availableTokens.find(t => t.symbol.toUpperCase() === sellParam.toUpperCase());
            if (token) setSellToken(token);
        }
        if (buyParam) {
            const token = availableTokens.find(t => tokenKey(t) === buyParam) ?? availableTokens.find(t => t.symbol.toUpperCase() === buyParam.toUpperCase());
            if (token) setBuyToken(token);
        }
    // Apply URL selections on navigation, without overriding later user picks on catalog refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [queryParams]);

    useEffect(() => {
        const fetchAllPrices = async () => {
            const pythData = await PriceService.getLatestPrices();
            setPrices(pythData);

        };
        fetchAllPrices();
        const interval = setInterval(fetchAllPrices, 15000);
        return () => clearInterval(interval);
    }, [isMainnet]);

    useEffect(() => {
        const pricesByCategory: Record<string, number> = {};
        for (const token of catalog.tokens) if (token.categoryId && token.priceUsd) pricesByCategory[token.categoryId] = token.priceUsd;
        setCauldronPrices(pricesByCategory);
    }, [catalog.tokens]);

    const getTokenPrice = useCallback((token: Token): number => {
        // A Solana mainnet token from the swap server is priced by its mint, never by its symbol.
        if (token.swapServer?.product === 'jupiter') return token.priceUsd ?? 0;
        const cleanSymbol = token.symbol.replace('.b', '').toUpperCase();
        // CashTokens are priced by Cauldron; only native/bridged assets use the market feed.
        const feedKey = token.chain === 'bch' && token.categoryId ? null : marketSymbolFor(token.symbol);
        if (feedKey && prices[feedKey]) {
            const formatted = PriceService.formatPrice(prices[feedKey]);
            if (formatted > 0) return formatted;
        }
        if (token.categoryId) return cauldronPrices[token.categoryId] ?? token.priceUsd ?? 0;
        if (cauldronPrices[token.symbol] > 0) return cauldronPrices[token.symbol];
        if (cauldronPrices[cleanSymbol] > 0) return cauldronPrices[cleanSymbol];
        if (token.categoryId && cauldronPrices[token.categoryId] > 0) return cauldronPrices[token.categoryId];
        if (token.priceUsd && token.priceUsd > 0) return token.priceUsd;
        return 0; // unknown — callers show "–" rather than a guessed price
    }, [prices, cauldronPrices]);

    /** USD mid from Pyth/CoinGecko. Indicative only — the solver does not trade at this. */
    const currentMarketRatio = useMemo(() => {
        const sellPrice = getTokenPrice(sellToken);
        const buyPrice = getTokenPrice(buyToken);
        if (sellPrice > 0 && buyPrice > 0) return (sellPrice / buyPrice);
        return 0;
    }, [sellToken, buyToken, getTokenPrice]);

    const sameChain = swapType === 'same-chain' && !ssHandled;
    const network: 'mainnet' | 'chipnet' = wdk.bchNetwork === 'mainnet' ? 'mainnet' : 'chipnet';

    /** What the user typed, in base units. Null while empty or not a number. */
    const sellUnits = useMemo(() => {
        const u = toBaseUnits(sellAmount, sellToken.decimals || 0);
        return u !== null && u > 0n ? u : null;
    }, [sellAmount, sellToken.decimals]);

    /**
     * The Mesh server's quote: the route the solver takes for this order right now.
     * It prices market swaps and is the reference for limit prices. See useMeshQuote
     * for the debounce, the cancelling of stale answers and the 15 s refresh.
     */
    const meshQuote = useMeshQuote({
        relayerUrl: network === 'mainnet' ? CASHTOKEN_RELAYER_MAINNET_URL : CASHTOKEN_RELAYER_URL,
        network,
        sellCategory: sellToken.categoryId || 'BCH',
        buyCategory: buyToken.categoryId || 'BCH',
        sellUnits,
        enabled: sameChain,
    });
    const quoteUnits = meshQuote.current?.buyUnits;

    /**
     * The ratio a solver will actually fill at ("1 sell = N buy"), from the quote.
     * USD mid has no solver margin, so a limit order seeded from it may never fill.
     * 0 while unknown.
     */
    const [crossFillableRatio, setCrossFillableRatio] = useState(0);
    const fillableRatio = sameChain
        ? (quoteUnits && sellUnits ? Number(ratioString(quoteUnits, buyToken.decimals || 0, sellUnits, sellToken.decimals || 0)) : 0)
        : crossFillableRatio;
    const quoteUnavailable = sameChain && meshQuote.status === 'error';
    /**
     * Set when the mesh server priced the pair but settles intents on a different
     * BCH network (e.g. a chipnet server asked for a mainnet quote).
     */
    const settlementBlocked = sameChain ? (meshQuote.settlementBlocked ?? null) : null;

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

    // Cross-chain reference price (the BCH-Solana/Movement relayer).
    useEffect(() => {
        const isRelayerCross = ['bch-to-sol', 'sol-to-bch', 'bch-to-mov', 'mov-to-bch', 'sol-to-mov', 'mov-to-sol'].includes(swapType);
        if (ssHandled || !isRelayerCross || !sellAmount || Number(sellAmount) <= 0) {
            setCrossFillableRatio(0);
            return;
        }
        let cancelled = false;
        const timer = setTimeout(() => {
            axios.post(`${BCH_SOLANA_RELAYER_URL}/quote`, {
                sellToken: getRelayerTokenSymbol(sellToken),
                buyToken: getRelayerTokenSymbol(buyToken),
                sellAmount: (toBaseUnits(sellAmount, sellToken.decimals || 0) ?? 0n).toString(),
            }).then(res => {
                if (cancelled) return;
                const units = Number(res.data?.buyAmount ?? 0) / Math.pow(10, buyToken.decimals || 0);
                setCrossFillableRatio(units > 0 ? units / Number(sellAmount) : 0);
            }).catch(() => { if (!cancelled) setCrossFillableRatio(0); });
        }, 350);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [swapType, sellAmount, sellToken, buyToken, getRelayerTokenSymbol, ssHandled]);

    /** What the limit-price input and its presets are anchored to. */
    const referenceRatio = fillableRatio > 0 ? fillableRatio : currentMarketRatio;
    const referenceIsFillable = fillableRatio > 0;

    /** The quote's own price, rounded down so an order at it never asks for more than the quote pays. */
    const quotePrice = sameChain && quoteUnits && sellUnits
        ? ratioString(quoteUnits, buyToken.decimals || 0, sellUnits, sellToken.decimals || 0)
        : '';
    /**
     * A same-chain limit order's buy amount, exact, rounded down. At the quote's own
     * price it is the quoted amount itself (the rounded price string would lose a unit).
     */
    const limitUnits = useMemo(() => {
        if (!sellUnits || !limitPrice) return null;
        if (quoteUnits && limitPrice === quotePrice) return quoteUnits;
        return limitBuyUnits(sellUnits, sellToken.decimals || 0, limitPrice, buyToken.decimals || 0);
    }, [sellUnits, limitPrice, quotePrice, quoteUnits, sellToken.decimals, buyToken.decimals]);
    /**
     * A limit price above the quote asks for more than a solver pays right now, so the
     * order rests until the market moves. Same-chain compares exact base units.
     */
    const priceAboveFillable = sameChain
        ? (!!quoteUnits && !!limitUnits && limitUnits > quoteUnits)
        : referenceIsFillable && !!limitPrice && Number(limitPrice) > referenceRatio * 1.0005;
    const fillsNowPrice = quotePrice || priceString(referenceRatio);

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
        if (!priceTouched && referenceRatio > 0 && orderType === 'limit' && fillsNowPrice) {
            setLimitPrice(fillsNowPrice);
        }
    }, [referenceRatio, fillsNowPrice, priceTouched, orderType]);

    // Market auto-fill: derive buyAmount from current USD spot or relayer quote.
    // Skipped when any limit order has an explicit limitPrice — the dedicated
    // limit-price effect below drives buyAmount in that case.
    useEffect(() => {
        if (ssHandled) return;
        if (!sellAmount || Number(sellAmount) <= 0) { setBuyAmount(''); return; }
        if (orderType === 'limit' && limitPrice && Number(limitPrice) > 0) return;

        if (swapType === 'same-chain') {
            // From useMeshQuote: '' while the price for this exact amount is not in yet.
            setBuyAmount(quoteUnits ? fromBaseUnits(quoteUnits, buyToken.decimals || 0) : '');
            return;
        }
        let cancelled = false;

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
                if (cancelled) return;
                const quoteBuyAmount = res.data.buyAmount;
                const buyDecimals = buyToken.decimals || 0;
                if (quoteBuyAmount && Number(quoteBuyAmount) > 0) {
                    setBuyAmount((Number(quoteBuyAmount) / Math.pow(10, buyDecimals)).toFixed(6));
                } else {
                    setBuyAmount('0'); // Unprofitable or no route
                }
            }).catch(e => {
                if (cancelled) return;
                console.error("Failed to get cross-chain EVM quote", e);
                setBuyAmount('0');
            });
            return () => { cancelled = true; };
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
                if (cancelled) return;
                const quoteBuyAmount = res.data.buyAmount;
                const buyDecimals = buyToken.decimals || 0;
                if (quoteBuyAmount && Number(quoteBuyAmount) > 0) {
                    setBuyAmount((Number(quoteBuyAmount) / Math.pow(10, buyDecimals)).toFixed(6));
                } else {
                    setBuyAmount('0');
                }
            }).catch(e => {
                if (cancelled) return;
                // No solver quote → no amount. A USD-mid estimate here looked like a
                // real quote and produced intents no relayer would fill.
                console.warn('Relayer quote endpoint error:', e?.message);
                setBuyAmount('0');
            });
            return () => { cancelled = true; };
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
    }, [sellAmount, sellToken, buyToken, getTokenPrice, orderType, limitPrice, swapType, wdk.bchNetwork, ssHandled, quoteUnits]);

    // A routed pair shows what the swap server quotes ('' until it has).
    const ssBuyAmount = ss.buyAmount;
    useEffect(() => { if (ssHandled) setBuyAmount(ssBuyAmount); }, [ssHandled, ssBuyAmount]);

    // The swap server's pairs are immediate: there is no limit or TWAP form of them.
    useEffect(() => { if (ssHandled && orderType !== 'market') onOrderTypeChange('market'); }, [ssHandled, orderType, onOrderTypeChange]);

    // Limit order: explicit limitPrice drives buyAmount across same-chain and cross-chain pairs.
    // limitPrice means "1 sellToken = N buyToken" (matches the on-screen mkt-ratio display).
    useEffect(() => {
        if (orderType !== 'limit') return;
        if (!sellAmount || Number(sellAmount) <= 0) return;
        if (!limitPrice || Number(limitPrice) <= 0) return;
        if (swapType === 'same-chain') {
            setBuyAmount(limitUnits ? fromBaseUnits(limitUnits, buyToken.decimals || 0) : '');
            return;
        }
        const buyAmt = Number(sellAmount) * Number(limitPrice);
        setBuyAmount(buyAmt.toFixed(6));
    }, [limitPrice, sellAmount, orderType, swapType, limitUnits, buyToken.decimals]);

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

    // Preserve the chosen pair; only bridge-only rows need a default counterpart.
    const pairAcross = (picked: Token, other: Token, setOther: (t: Token) => void, mode?: SwapTokenMode, pickedIsSell = true) => {
        if (anchorToken) return;
        const fix = ss.pair(picked, other, availableTokens, mode, pickedIsSell);
        if (fix.other) setOther(fix.other);
        else if (fix.reset) setOther(picked.chain === 'bch' && picked.type === 'native' ? pusdToken(isMainnet) : BCH_TOKENS[0]);
    };

    // Wrapped token selectors that fire onAnchorTokenChange when the anchor side is changed
    const handleSellTokenSelect = (token: Token, mode?: SwapTokenMode) => {
        if (anchorToken && anchorSide === 'sell' && onAnchorTokenChange) {
            onAnchorTokenChange(token);
        } else {
            setSellToken(token);
            pairAcross(token, buyToken, setBuyToken, mode, true);
        }
    };

    const handleBuyTokenSelect = (token: Token, mode?: SwapTokenMode) => {
        if (anchorToken && anchorSide === 'buy' && onAnchorTokenChange) {
            onAnchorTokenChange(token);
        } else {
            setBuyToken(token);
            pairAcross(token, sellToken, setSellToken, mode, false);
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
        if (ssHandled) return ss.canSubmit;
        if (!sellAmount || Number(sellAmount) <= 0) return false;
        if (!buyAmount || Number(buyAmount) <= 0) return false;
        if (swapType === 'same-chain' && settlementBlocked) return false;
        // A same-chain swap goes out at the quote for exactly this amount, never a stale one.
        if (sameChain && orderType === 'market' && !quoteUnits) return false;
        if (sameChain && orderType === 'limit' && (!limitUnits || limitUnits <= 0n)) return false;
        if (orderType === 'limit' && expirySeconds === null) return false;
        if (needsBCHWallet && !bchConnected) return false;
        if (needsSolanaWallet && !solanaConnected) return false;
        if (needsEthWallet && !ethConnected) return false;
        if (needsMovementWallet && !movementConnected) return false;
        if (swapType === 'bch-to-xmr' && (!xmrAddress || !xmrViewKey || !xmrSpendKey)) return false;
        if (swapType === 'xmr-to-bch' && !bchConnected) return false;
        return true;
    }, [sellAmount, buyAmount, settlementBlocked, needsBCHWallet, bchConnected, needsSolanaWallet, solanaConnected, needsEthWallet, ethConnected, needsMovementWallet, movementConnected, swapType, xmrAddress, xmrViewKey, xmrSpendKey, ssHandled, ss.canSubmit, sameChain, orderType, quoteUnits, limitUnits, expirySeconds]);

    const handleSwap = async () => {
        if (!canSubmit) return;
        if (ssHandled) {
            // The swap server's flow: its own executor, dialog and history (src/swap-server).
            if (await ss.execute()) {
                setSellAmount('');
                setBuyAmount('');
                triggerBalanceRefresh();
            }
            return;
        }
        const params: BCHSwapParams = {
            sellToken, buyToken,
            sellAmount: Number(sellAmount), buyAmount: Number(buyAmount),
            swapType, orderType,
            duration: orderType === 'market' ? duration : undefined,
            expirySeconds: orderType === 'limit' ? (expirySeconds ?? undefined) : undefined,
            expiryTime: orderType === 'limit' && expirySeconds ? Math.floor(Date.now() / 1000) + expirySeconds : undefined,
            // Exact base units for same-chain orders: the quote's own amount for a swap,
            // the limit price's amount (rounded down) for a limit order.
            sellUnits: sameChain && sellUnits ? sellUnits.toString() : undefined,
            buyUnits: !sameChain ? undefined
                : orderType === 'limit' ? limitUnits?.toString()
                : quoteUnits?.toString(),
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
            triggerBalanceRefresh();
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
        if (ss.active) return ss.sellBalance;
        // External wallet in charge: its own BCH and CashTokens, never the built-in wallet's.
        if (sellToken.chain === 'bch' && !isMainActive && activeExtWallet) {
            if (sellToken.type === 'native') return extBalance.data.sats / 1e8;
            const raw = sellToken.type ? extBalance.data.tokens[sellToken.type.toLowerCase()] : undefined;
            return raw ? Number(raw) / Math.pow(10, sellToken.decimals || 0) : 0;
        }
        if (sellToken.chain === 'bch' && bchConnected && sellToken.type === 'native') {
            return bchWallet.balance / 1e8;
        }
        if (sellToken.chain === 'bch' && bchConnected && isMainActive && sellToken.type && bchWallet.tokenBalances[sellToken.type]) {
            return Number(bchWallet.tokenBalances[sellToken.type]) / Math.pow(10, sellToken.decimals || 0);
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
    }, [sellToken, bchConnected, isMainActive, activeExtWallet, extBalance.data, bchWallet.balance, bchWallet.tokenBalances, PORTFOLIO_CHAIN, portfolio.tokens, wdk.movementAddress, wdk.movementTokenBalances, ss.active, ss.sellBalance]);

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
        // A pair with no flow at all says so before an amount is asked for.
        if (ss.blocked) return <SwapServerButton state={ss} onClick={handleSwap} />;
        if (!sellAmount || Number(sellAmount) <= 0) {
            return <Button className="w-full h-14 text-base font-semibold rounded-2xl bg-white/[0.04] text-white/40 hover:bg-white/[0.04]" disabled>Enter an amount</Button>;
        }
        if (swapType === 'same-chain' && settlementBlocked) {
            return (
                <div className="space-y-2">
                    <div className="flex items-start gap-2 text-xs text-amber-200/80 bg-amber-500/[0.06] border border-amber-500/20 rounded-lg px-2.5 py-2">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
                        <span>{settlementBlocked}</span>
                    </div>
                    <Button className="w-full h-14 text-base font-semibold rounded-2xl bg-white/[0.04] text-white/40 hover:bg-white/[0.04]" disabled>Swaps unavailable on this network</Button>
                </div>
            );
        }
        if (sellBalance !== null && Number(sellAmount) > sellBalance) {
            return <Button className="w-full h-14 text-base font-semibold rounded-2xl bg-red-500/15 text-red-300 hover:bg-red-500/15" disabled>Insufficient {sellToken.symbol} balance</Button>;
        }
        if (ss.active) return <SwapServerButton state={ss} onClick={handleSwap} />;
        const muted = 'w-full h-14 text-base font-semibold rounded-2xl bg-white/[0.04] text-white/40 hover:bg-white/[0.04]';
        if (sameChain && !isLoading && meshQuote.loading && (orderType === 'market' || !limitPrice)) {
            return <Button className={muted} disabled><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Fetching price…</Button>;
        }
        if (sameChain && !isLoading && orderType === 'market' && meshQuote.status === 'error' && !quoteUnits) {
            return <Button className={muted} disabled>{meshQuote.error ?? 'No price right now'}</Button>;
        }
        if (orderType === 'limit' && expirySeconds === null) {
            return <Button className={muted} disabled>Choose when the order expires</Button>;
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

    const expiryLabel = expirySeconds ? describeDuration(expirySeconds) : '—';

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
                        disabled={ssHandled}
                        title={ssHandled ? 'Not available for this pair' : undefined}
                        className={cn(
                            'px-4 py-1.5 text-xs font-semibold rounded-full transition-all disabled:opacity-40 disabled:cursor-not-allowed',
                            orderType === 'limit'
                                ? 'bg-white/[0.08] text-white shadow-sm'
                                : 'text-white/50 hover:text-white/80'
                        )}
                    >
                        Limit
                    </button>
                    <button
                        onClick={() => onOrderTypeChange('twap')}
                        disabled={ssHandled}
                        title={ssHandled ? 'Not available for this pair' : undefined}
                        className={cn(
                            'px-4 py-1.5 text-xs font-semibold rounded-full transition-all disabled:opacity-40 disabled:cursor-not-allowed',
                            orderType === 'twap'
                                ? 'bg-white/[0.08] text-white shadow-sm'
                                : 'text-white/50 hover:text-white/80'
                        )}
                    >
                        TWAP
                    </button>
                </div>

                <div className="flex items-center gap-1">
                    {/* Which BCH wallet signs here. It opens the wallet, where wallets and the network are switched. */}
                    <ActiveWalletChip />

                    {/* Orders & History toggle — hidden in compact/embedded mode */}
                    {onToggleOrders && !compact && (
                        <button
                            onClick={onToggleOrders}
                            title={ordersVisible ? 'Hide Orders & History' : 'Orders & History'}
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
                        <BCHTokenSelector value={sellToken} onSelect={handleSellTokenSelect} supportsMode={ss.supportsMode} canSelect={(t, mode) => ss.canPair?.(t, buyToken, availableTokens, true, mode) ?? true} tokens={availableTokens} evmNetworkLabel={activeEvmLabel} isMainnet={isMainnet} searchTokens={ss.searchTokens} />
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
                        <BCHTokenSelector value={buyToken} onSelect={handleBuyTokenSelect} supportsMode={ss.supportsMode} canSelect={(t, mode) => ss.canPair?.(t, sellToken, availableTokens, false, mode) ?? true} tokens={availableTokens} evmNetworkLabel={activeEvmLabel} isMainnet={isMainnet} searchTokens={ss.searchTokens} />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-white/40 font-mono">
                            ≈ ${buyUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        {/* Not for a bridge: what is taken off there is fees, listed line by line below. */}
                        {!ss.active && priceImpact !== 0 && Math.abs(priceImpact) > 0.01 && (
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

            {/* ─── Limit price card (limit mode only: placed cleanly below the two inputs) ─── */}
            {orderType === 'limit' && (
                <div className="mx-4 mt-3 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.07] space-y-3.5 shadow-sm animate-in fade-in-50 slide-in-from-top-1 duration-200" data-limit-card>
                    {/* Header: Label and reference price badge */}
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-xs uppercase tracking-wider font-semibold text-white/50">When 1 {sellToken.symbol} is worth</span>
                        {referenceIsFillable ? (
                            <span className="text-xs text-emerald-400 font-mono font-medium truncate bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full" title="Best fillable price right now">
                                fills at {fillsNowPrice} {buyToken.symbol}
                            </span>
                        ) : currentMarketRatio > 0 ? (
                            <span className="text-xs text-white/40 font-mono truncate bg-white/[0.04] px-2.5 py-0.5 rounded-full" title="Indicative market mid">
                                mkt {priceString(currentMarketRatio)} {buyToken.symbol}
                            </span>
                        ) : sameChain && meshQuote.loading ? (
                            <span className="text-xs text-white/30">fetching price…</span>
                        ) : null}
                    </div>

                    {/* Target Price input row */}
                    <div className="flex items-center justify-between gap-3 bg-black/30 border border-white/[0.06] rounded-xl px-3.5 py-2.5">
                        <Input
                            type="text"
                            placeholder="0.00"
                            value={limitPrice}
                            onChange={e => {
                                const v = e.target.value.replace(',', '.');
                                if (!/^\d*\.?\d*$/.test(v)) return;
                                setLimitPrice(v);
                                setPriceTouched(true);
                            }}
                            inputMode="decimal"
                            autoComplete="off"
                            aria-label={`Limit price in ${buyToken.symbol} per ${sellToken.symbol}`}
                            className="border-none bg-transparent text-xl sm:text-2xl font-bold p-0 h-auto focus-visible:ring-0 flex-1 min-w-0 text-white placeholder:text-white/20"
                        />
                        <span className="text-xs font-semibold px-2 py-1 rounded-md bg-white/[0.08] text-white/80 shrink-0">{buyToken.symbol}</span>
                    </div>

                    {/* Quick percentage adjustment presets */}
                    <div className="flex flex-wrap items-center gap-1.5">
                        {PRICE_PRESETS.map(preset => {
                            const base = Number(fillsNowPrice);
                            const target = preset.mult === 1 ? fillsNowPrice : priceString(base * preset.mult);
                            const active = !!limitPrice && limitPrice === target;
                            return (
                                <button
                                    key={preset.label}
                                    type="button"
                                    disabled={!(base > 0)}
                                    onClick={() => {
                                        if (!(base > 0)) return;
                                        setLimitPrice(target);
                                        setPriceTouched(true);
                                    }}
                                    title={preset.mult === 1
                                        ? 'Match current best quote for immediate execution'
                                        : `Target ${Math.round((preset.mult - 1) * 100)}% above current quote`}
                                    className={cn(
                                        'px-3 py-1 rounded-full text-xs font-semibold border transition-all disabled:opacity-40 disabled:cursor-not-allowed',
                                        active
                                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                                            : 'bg-white/[0.04] hover:bg-emerald-500/15 hover:text-emerald-300 text-white/60 border-white/[0.06] hover:border-emerald-500/30',
                                    )}
                                >
                                    {preset.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Price warnings */}
                    {priceAboveFillable && (
                        <div className="flex items-start gap-2 text-xs text-amber-400/90 bg-amber-500/[0.07] border border-amber-500/20 rounded-xl px-3 py-2">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <span>
                                Above current price ({fillsNowPrice} {buyToken.symbol}).
                                The order will rest on-chain and execute once the market reaches your target.
                            </span>
                        </div>
                    )}
                    {quoteUnavailable && (
                        <div className="flex items-start gap-2 text-xs text-white/50 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <span>{meshQuote.error ?? 'No quote right now'}. You can still place the order; it fills once the market reaches your price.</span>
                        </div>
                    )}

                    {/* Expiration picker */}
                    <div className="pt-2.5 border-t border-white/[0.05]">
                        <ExpiryPicker value={expirySeconds} onChange={setExpirySeconds} />
                    </div>
                </div>
            )}

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
                    {ss.active && <SwapServerDetails state={ss} />}
                    {!ssHandled && sellAmount && Number(sellAmount) > 0 && (
                        <QuoteCard
                            className="mx-4 mt-3"
                            icon={orderType === 'limit' ? <Target className="h-3 w-3" /> : typeInfo.icon}
                            tone={orderType === 'limit' ? 'violet' : swapType === 'same-chain' ? 'emerald' : 'indigo'}
                            label={orderType === 'limit' ? 'Limit order' : swapType === 'same-chain' ? 'CashToken swap' : typeInfo.label}
                            provider={`${orderType === 'limit' ? 'Fills at your price or better' : swapType === 'same-chain' ? 'Dutch auction' : typeInfo.desc} · ${isMainnet ? 'Mainnet' : 'Testnet'}`}
                            aside={orderType === 'limit' ? `Expires in ${expiryLabel}` : `Up to ${formatAuctionDuration(duration)}`}
                        >
                            <QuoteRow label="You send" value={`${sellAmount} ${sellToken.symbol}`} />
                            {orderType === 'limit' ? (
                                <QuoteRow
                                    label="Limit price"
                                    value={limitPrice ? `1 ${sellToken.symbol} = ${limitPrice} ${buyToken.symbol}` : '…'}
                                    hint={!referenceIsFillable ? undefined : priceAboveFillable ? 'rests until the market moves' : 'fillable now'}
                                />
                            ) : (
                                <QuoteRow
                                    label="Rate"
                                    value={Number(buyAmount) > 0 ? `1 ${sellToken.symbol} ≈ ${(Number(buyAmount) / Number(sellAmount)).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${buyToken.symbol}` : '…'}
                                    hint={sameChain ? (meshQuote.loading ? 'updating…' : quoteUnits ? 'live quote' : undefined) : referenceIsFillable ? 'solver quote' : undefined}
                                />
                            )}
                            <QuoteRow
                                label="You receive"
                                strong
                                value={Number(buyAmount) > 0 ? `${orderType === 'limit' ? 'at least ' : '≈ '}${Number(buyAmount).toLocaleString(undefined, { maximumFractionDigits: 8 })} ${buyToken.symbol}`
                                    : sameChain && meshQuote.loading ? 'Fetching…' : sameChain && meshQuote.error ? meshQuote.error : 'No quote'}
                            />
                            {sameChain && orderType === 'market' && quoteUnits && (
                                <QuoteRow
                                    label="Minimum"
                                    value={`${Number(fromBaseUnits((quoteUnits * 98n) / 100n, buyToken.decimals || 0)).toLocaleString(undefined, { maximumFractionDigits: 8 })} ${buyToken.symbol}`}
                                    hint="where the auction ends"
                                />
                            )}
                            {orderType === 'limit' && expirySeconds && (
                                <QuoteRow label="Expires" value={formatExpiryAt(Math.floor(Date.now() / 1000) + expirySeconds)} hint="refunded automatically if not filled" />
                            )}
                            {orderType === 'market' && <QuoteRow label="Auction" value={formatAuctionDuration(duration)} hint="price walks down until a solver fills" />}
                            {userAddress && swapType === 'same-chain' && (
                                <QuoteRow label="To" value={<span className="font-mono text-xs" title={userAddress}>{formatAddress(userAddress.includes(':') ? userAddress.split(':')[1] : userAddress)}</span>} hint="your wallet" />
                            )}
                            {swapType !== 'same-chain' && <QuoteWarning>Cross-chain: it relies on a solver or relayer filling the other side.</QuoteWarning>}
                            {orderType === 'limit' && quoteUnavailable && <QuoteWarning>No quote right now. The order still fills once the market reaches your price.</QuoteWarning>}
                        </QuoteCard>
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
