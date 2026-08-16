// LEGACY — only used by ProPage/SwapPage, both unreachable ("/pro" and "/swap"
// redirect to "/" in App.tsx). The live swap UI is BCHSwapCard
// (components/bch-swap/), routed at "/trade".
import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Loader2 } from 'lucide-react';
import { useSwap } from '@/context/SwapContext';
import { TokenPair } from './TokenPairSelector';
import { TOKENS } from '@/components/intent-swap/forms/TokenSelector';
import { PriceService } from '@/lib/pyth';
import { PriceData, Token } from '@/types';
import { notifyToast as toast } from '@/lib/notify-toast';
interface ProOrderFormProps {
    selectedPair: TokenPair;
}

type OrderSide = 'buy' | 'sell';
type OrderStep = 'idle' | 'depositing' | 'signing';

// Map base symbol to actual token from TOKENS array
const getTokenBySymbol = (symbol: string): Token | undefined => {
    // Map chart symbols to actual token symbols
    const symbolMap: Record<string, string> = {
        'ETH': 'WETH.e',
        'USDC': 'USDC.e',
        'USDT': 'USDT.e',
        'MOVE': 'MOVE',
    };
    const mappedSymbol = symbolMap[symbol] || symbol;
    return TOKENS.find(t => t.symbol === mappedSymbol);
};

export function ProOrderForm({ selectedPair }: ProOrderFormProps) {
    const { buildAndSubmitIntent, isLoading, escrowBalance, depositToEscrow } = useSwap();
    const [orderSide, setOrderSide] = useState<OrderSide>('buy');
    const [amount, setAmount] = useState('');
    const [sliderValue, setSliderValue] = useState([0]);
    const [prices, setPrices] = useState<Record<string, PriceData>>({});
    const [priceLoading, setPriceLoading] = useState(false);
    const [orderStep, setOrderStep] = useState<OrderStep>('idle');

    // Fetch prices
    useEffect(() => {
        const fetchPrices = async () => {
            setPriceLoading(true);
            const data = await PriceService.getLatestPrices();
            setPrices(data);
            setPriceLoading(false);
        };
        fetchPrices();
        const interval = setInterval(fetchPrices, 15000);
        return () => clearInterval(interval);
    }, []);

    const currentPrice = PriceService.formatPrice(prices[selectedPair.baseSymbol]);

    // Calculate if deposit is needed
    const getSellTokenAndAmount = () => {
        const baseToken = getTokenBySymbol(selectedPair.baseSymbol);
        const quoteToken = getTokenBySymbol(selectedPair.quoteSymbol);
        if (!baseToken || !quoteToken || !amount) return { sellToken: null, sellAmount: 0 };

        const baseAmount = parseFloat(amount);
        const quoteAmount = baseAmount * (currentPrice || 1);

        const sellToken = orderSide === 'sell' ? baseToken : quoteToken;
        const sellAmount = orderSide === 'sell' ? baseAmount : quoteAmount;
        return { sellToken, sellAmount };
    };

    const { sellToken, sellAmount } = getSellTokenAndAmount();
    const sellTokenEscrowBalance = sellToken ? (escrowBalance[sellToken.type] || 0) : 0;
    const needsDeposit = sellAmount > sellTokenEscrowBalance;

    const handleSubmit = async () => {
        if (!amount || isNaN(parseFloat(amount))) {
            toast.error('Please enter a valid amount');
            return;
        }

        // Get actual tokens from the TOKENS array
        const baseToken = getTokenBySymbol(selectedPair.baseSymbol);
        const quoteToken = getTokenBySymbol(selectedPair.quoteSymbol); // Dynamic Quote

        if (!baseToken || !quoteToken) {
            toast.error('Token not found');
            return;
        }

        try {
            // Determine sell/buy based on order side
            const sellTokenFinal = orderSide === 'sell' ? baseToken : quoteToken;
            const buyToken = orderSide === 'buy' ? baseToken : quoteToken;

            const baseAmount = parseFloat(amount);
            const quoteAmount = baseAmount * (currentPrice || 1);

            const sellAmountFinal = orderSide === 'sell' ? baseAmount : quoteAmount;
            const buyAmount = orderSide === 'buy' ? baseAmount : quoteAmount;

            // Step 1: Check if deposit is needed
            const currentEscrowBalance = escrowBalance[sellTokenFinal.type] || 0;
            const needsDepositNow = sellAmountFinal > currentEscrowBalance;
            const depositAmountNow = needsDepositNow ? sellAmountFinal - currentEscrowBalance : 0;

            if (needsDepositNow) {
                setOrderStep('depositing');
                toast.info(`Depositing ${depositAmountNow.toFixed(4)} ${sellTokenFinal.symbol}...`, {
                    description: "Please approve the deposit transaction"
                });

                await depositToEscrow(depositAmountNow, sellTokenFinal.type, sellTokenFinal.decimals);
                toast.success(`Deposited ${depositAmountNow.toFixed(4)} ${sellTokenFinal.symbol}`);

                // Wait for wallet adapter to reset after transaction
                toast.info("Syncing wallet state...");
                await new Promise(resolve => setTimeout(resolve, 3000));
            }

            // Step 2: Sign and submit intent
            setOrderStep('signing');
            toast.info('Please sign the order intent in your wallet');

            await buildAndSubmitIntent({
                sellToken: sellTokenFinal.type,
                buyToken: buyToken.type,
                sellAmount: sellAmountFinal,
                buyAmount,
                slippage: 0.5,
                sellDecimals: sellTokenFinal.decimals,
                buyDecimals: buyToken.decimals,
            });

            toast.success('Order Submitted', {
                description: `${orderSide === 'buy' ? 'Buying' : 'Selling'} ${amount} ${selectedPair.baseSymbol}`,
            });
            setAmount('');
            setSliderValue([0]);
        } catch (e: any) {
            // Handle user rejection gracefully
            if (e.message?.includes('rejected') || e.message?.includes('cancelled')) {
                toast.info('Transaction cancelled');
            } else {
                toast.error('Order Failed', { description: e.message });
            }
        } finally {
            setOrderStep('idle');
        }
    };

    // Button text based on state
    const getButtonText = () => {
        if (orderStep === 'depositing') return "Depositing...";
        if (orderStep === 'signing' || isLoading) return "Signing...";
        if (!amount) return "Enter an amount";
        if (needsDeposit) return `Deposit & ${orderSide === 'buy' ? 'Buy' : 'Sell'}`;
        return `${orderSide === 'buy' ? 'Buy' : 'Sell'} ${selectedPair.baseSymbol}`;
    };

    return (
        <Card className="border-muted bg-card/50">
            <CardContent className="p-4 space-y-4">
                {/* Buy/Sell Tabs */}
                <Tabs value={orderSide} onValueChange={(v) => setOrderSide(v as OrderSide)}>
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger
                            value="buy"
                            className="data-[state=active]:bg-green-600 data-[state=active]:text-white"
                        >
                            Buy
                        </TabsTrigger>
                        <TabsTrigger
                            value="sell"
                            className="data-[state=active]:bg-red-600 data-[state=active]:text-white"
                        >
                            Sell
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                {/* Price Display */}
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Market Price</span>
                    <span className="font-mono">
                        {priceLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin inline" />
                        ) : currentPrice ? (
                            `$${currentPrice.toFixed(2)}`
                        ) : (
                            '-'
                        )}
                    </span>
                </div>

                {/* Amount Input */}
                <div className="space-y-2">
                    <div className="flex justify-between">
                        <label className="text-sm text-muted-foreground">Amount ({selectedPair.baseSymbol})</label>
                        <span className="text-xs text-muted-foreground">
                            {orderSide === 'buy' ? selectedPair.quoteSymbol : selectedPair.baseSymbol} Balance: {
                                (() => {
                                    const token = getTokenBySymbol(orderSide === 'buy' ? selectedPair.quoteSymbol : selectedPair.baseSymbol);
                                    return escrowBalance[token?.type || '']?.toFixed(4) || '0.00';
                                })()
                            }
                        </span>
                    </div>
                    <Input
                        type="number"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="h-12 text-lg font-mono"
                    />
                </div>

                {/* Percentage Slider */}
                <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>0%</span>
                        <span>25%</span>
                        <span>50%</span>
                        <span>75%</span>
                        <span>100%</span>
                    </div>
                    <Slider
                        value={sliderValue}
                        onValueChange={(val) => {
                            setSliderValue(val);
                            const percentage = val[0] / 100;

                            const payToken = getTokenBySymbol(orderSide === 'buy' ? selectedPair.quoteSymbol : selectedPair.baseSymbol);
                            const balance = escrowBalance[payToken?.type || ''] || 0;

                            let newAmount = 0;
                            if (orderSide === 'buy') {
                                // Buying Base: Pay Quote. Limit by Quote Balance.
                                // Amount Input is Base.
                                // Base = (QuoteBalance * %) / Price
                                if (currentPrice) {
                                    newAmount = (balance * percentage) / currentPrice;
                                }
                            } else {
                                // Selling Base: Pay Base. Limit by Base Balance.
                                // Amount Input is Base.
                                newAmount = balance * percentage;
                            }

                            // Safe rounding down to avoid "Insufficient Balance"
                            const safeFixed = (num: number, decimals: number) => {
                                const multiplier = Math.pow(10, decimals);
                                return (Math.floor(num * multiplier) / multiplier).toFixed(decimals);
                            };

                            // Format to manageable decimals (e.g. 6)
                            setAmount(newAmount > 0 ? safeFixed(newAmount, 6) : '');
                        }}
                        max={100}
                        step={25}
                        className="w-full"
                    />
                </div>

                {/* Summary: Pay & Receive */}
                <div className="bg-muted/30 p-3 rounded-md space-y-2 mt-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">You Pay</span>
                        <span className="font-mono">
                            {orderSide === 'buy' ? (
                                <>
                                    {amount && currentPrice ? (parseFloat(amount) * currentPrice).toFixed(6) : '0.00'}{' '}
                                    <span className="text-xs text-muted-foreground">{selectedPair.quoteSymbol}</span>
                                </>
                            ) : (
                                <>
                                    {amount || '0.00'}{' '}
                                    <span className="text-xs text-muted-foreground">{selectedPair.baseSymbol}</span>
                                </>
                            )}
                        </span>
                    </div>
                    <div className="flex justify-between text-sm font-medium">
                        <span className="text-muted-foreground">You Receive</span>
                        <span className="font-mono text-green-500">
                            {orderSide === 'buy' ? (
                                <>
                                    {amount || '0.00'}{' '}
                                    <span className="text-xs text-green-500/70">{selectedPair.baseSymbol}</span>
                                </>
                            ) : (
                                <>
                                    {amount && currentPrice ? (parseFloat(amount) * currentPrice).toFixed(6) : '0.00'}{' '}
                                    <span className="text-xs text-green-500/70">{selectedPair.quoteSymbol}</span>
                                </>
                            )}
                        </span>
                    </div>
                </div>

                {/* Submit Button */}
                <Button
                    className={`w-full h-12 font-semibold ${orderSide === 'buy'
                        ? 'bg-green-600 hover:bg-green-700'
                        : 'bg-red-600 hover:bg-red-700'
                        }`}
                    onClick={handleSubmit}
                    disabled={isLoading || orderStep !== 'idle' || !amount}
                >
                    {(isLoading || orderStep !== 'idle') ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {getButtonText()}
                        </>
                    ) : (
                        getButtonText()
                    )}
                </Button>
            </CardContent>
        </Card>
    );
}
