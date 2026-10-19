// OLD — retired 2026-10-19, kept until the clean-up. Not part of the live app. See devrel-agent-context/walletuidocs/connect/old-code.md.
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { ArrowDown, ArrowLeftRight, Loader2, RotateCw } from 'lucide-react';
import { notifyToast as toast } from '@/lib/notify-toast';
import { useWallet as useAptosWallet } from "@/context/wallet-provider";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton, useWalletModal as useWalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PriceService } from '@/lib/pyth';
import { Token } from '@/types';
import { useCrossChain } from '@/context/CrossChainContext';

// Token Definitions (Simplified for Demo)
// Token Definitions (Simplified for Demo)
const MOV_TOKENS: Token[] = [
    { symbol: "MOVE", type: "0x1::aptos_coin::AptosCoin", decimals: 8, name: "Movement", icon: "https://raw.githubusercontent.com/hippospace/aptos-coin-list/main/icons/MOVE.svg" },
    { symbol: "USDC", type: "0x45142fb00dde90b950183d8ac2815597892f665c254c3f42b5768bc6ae4c8489", decimals: 6, name: "USDC (M)", icon: "https://raw.githubusercontent.com/hippospace/aptos-coin-list/main/icons/USDC.svg" },
];

const SOL_TOKENS: Token[] = [
    { symbol: "SOL", type: "11111111111111111111111111111111", decimals: 9, name: "Solana", icon: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png" },
    { symbol: "USDC", type: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", decimals: 6, name: "USDC (S)", icon: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png" }, // Devnet USDC-ish
];

export default function CrossChainPage() {
    // Chain Direction: 'MOV_TO_SOL' or 'SOL_TO_MOV'
    const [direction, setDirection] = useState<'MOV_TO_SOL' | 'SOL_TO_MOV'>('MOV_TO_SOL');

    const { createMovementToSolanaSwap, createSolanaToMovementSwap, isLoading: isContextLoading } = useCrossChain();

    // Wallets
    const aptos = useAptosWallet();
    const solana = useSolanaWallet();
    const { setVisible } = useWalletMultiButton();

    // Constant imports handled above

    // Form State
    const [sellAmount, setSellAmount] = useState("");
    const [buyAmount, setBuyAmount] = useState("");

    // Combine local loading with context loading
    const [isLocalLoading, setIsLocalLoading] = useState(false);
    const isLoading = isContextLoading || isLocalLoading;

    // Tokens
    const sourceTokens = direction === 'MOV_TO_SOL' ? MOV_TOKENS : SOL_TOKENS;
    const destTokens = direction === 'MOV_TO_SOL' ? SOL_TOKENS : MOV_TOKENS;

    const [sellToken, setSellToken] = useState(sourceTokens[0]);
    const [buyToken, setBuyToken] = useState(destTokens[0]);

    // Update tokens when direction changes
    useEffect(() => {
        setSellToken(sourceTokens[0]);
        setBuyToken(destTokens[0]);
    }, [direction, sourceTokens, destTokens]);

    // Prices
    const [prices, setPrices] = useState<Record<string, number>>({});

    // Network Switching Logic
    useEffect(() => {
        if (direction === 'MOV_TO_SOL' && aptos.connected && aptos.network) {
            // ... logic ...
        }
    }, [direction, aptos.connected, aptos.network]);


    // Fetch Prices (Pyth)
    useEffect(() => {
        const fetchPrices = async () => {
            try {
                const data = await PriceService.getLatestPrices();
                const formatted: Record<string, number> = {};

                if (data['MOVE']) formatted['MOVE'] = PriceService.formatPrice(data['MOVE']);
                if (data['SOL']) formatted['SOL'] = PriceService.formatPrice(data['SOL']);
                if (data['USDC']) formatted['USDC'] = PriceService.formatPrice(data['USDC']);

                setPrices(formatted);
            } catch (e) {
                console.error("Price fetch failed", e);
            }
        };
        fetchPrices();
        const interval = setInterval(fetchPrices, 10000);
        return () => clearInterval(interval);
    }, []);

    // Calc Output
    useEffect(() => {
        if (!sellAmount || isNaN(parseFloat(sellAmount))) {
            setBuyAmount("");
            return;
        }

        const sPrice = prices[sellToken.symbol] || (sellToken.symbol === "SOL" ? 150 : 1);
        const bPrice = prices[buyToken.symbol] || (buyToken.symbol === "SOL" ? 150 : 1);

        const valUSD = parseFloat(sellAmount) * sPrice;
        const bAmount = valUSD / bPrice;

        // Apply 1% Slippage/Fee for cross chain
        const afterFee = bAmount * 0.99;

        setBuyAmount(afterFee.toFixed(6));
    }, [sellAmount, sellToken, buyToken, prices]);


    const handleSwap = async () => {
        if (!aptos.account || !aptos.wallet) {
            toast.error("Please connect your Movement wallet");
            return;
        }
        if (!solana.publicKey) {
            toast.error("Please connect your Solana wallet");
            return;
        }

        setIsLocalLoading(true);
        try {
            if (direction === 'MOV_TO_SOL') {
                await createMovementToSolanaSwap(sellAmount, buyAmount, solana.publicKey.toString());
            } else {
                await createSolanaToMovementSwap(sellAmount, buyAmount, aptos.account.address.toString());
            }

            setSellAmount("");
        } catch (e: any) {
            console.error(e);
            toast.error("Swap Failed");
        } finally {
            setIsLocalLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] gap-8">
            <h1 className="text-4xl font-heading font-bold gradient-text">Cross-Chain Instant Swap</h1>

            <div className="flex flex-wrap gap-8 justify-center w-full max-w-5xl">

                {/* SWAP CARD */}
                <Card className="w-full max-w-[480px] shadow-2xl border-primary/20 bg-card/60 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex justify-between items-center">
                            <span>Swap</span>
                            <div className="flex items-center gap-2 text-sm font-normal">
                                <div className={`flex items-center gap-1 ${direction === 'MOV_TO_SOL' ? "text-primary font-bold" : "text-muted-foreground"}`}>
                                    <img src="https://raw.githubusercontent.com/kitelabs-io/mvmt-tokens/main/logos/MOVE.png" className="w-4 h-4 rounded-full" alt="Movement" />
                                    <span>Movement</span>
                                </div>
                                <ArrowLeftRight className="h-4 w-4" />
                                <div className={`flex items-center gap-1 ${direction === 'SOL_TO_MOV' ? "text-primary font-bold" : "text-muted-foreground"}`}>
                                    <img src="/assets/solanaLogo.png" className="w-4 h-4" alt="Solana" />
                                    <span>Solana</span>
                                </div>
                            </div>
                        </CardTitle>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        {/* Source Input */}
                        <div className="bg-muted/40 p-4 rounded-xl space-y-2">
                            <Label className="text-xs text-muted-foreground">From ({direction === 'MOV_TO_SOL' ? 'Movement' : 'Solana'})</Label>
                            <div className="flex gap-2">
                                <Input
                                    type="number"
                                    className="text-2xl font-bold border-none bg-transparent p-0 focus-visible:ring-0 shadow-none h-auto"
                                    placeholder="0.00"
                                    value={sellAmount}
                                    onChange={e => setSellAmount(e.target.value)}
                                />
                                <Button variant="outline" className="min-w-[100px] font-bold">
                                    {sellToken.symbol}
                                </Button>
                            </div>
                            <div className="text-xs text-muted-foreground flex justify-between">
                                <span>$ --</span>
                                <span>Balance: --</span>
                            </div>
                        </div>

                        {/* Switcher */}
                        <div className="flex justify-center -my-2 relative z-10">
                            <Button
                                size="icon"
                                variant="secondary"
                                className="rounded-full border-4 border-background h-10 w-10"
                                onClick={() => setDirection(d => d === 'MOV_TO_SOL' ? 'SOL_TO_MOV' : 'MOV_TO_SOL')}
                            >
                                <ArrowDown className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Dest Input */}
                        <div className="bg-muted/40 p-4 rounded-xl space-y-2">
                            <Label className="text-xs text-muted-foreground">To ({direction === 'MOV_TO_SOL' ? 'Solana' : 'Movement'})</Label>
                            <div className="flex gap-2">
                                <Input
                                    type="number"
                                    className="text-2xl font-bold border-none bg-transparent p-0 focus-visible:ring-0 shadow-none h-auto"
                                    placeholder="0.00"
                                    value={buyAmount}
                                    readOnly
                                />
                                <Button variant="outline" className="min-w-[100px] font-bold">
                                    {buyToken.symbol}
                                </Button>
                            </div>
                            <div className="text-xs text-muted-foreground flex justify-between">
                                <span>~ $ --</span>
                                <span className="text-green-500 flex items-center gap-1"><Zap className="h-3 w-3" /> Instant Fill by Relayer</span>
                            </div>
                        </div>

                    </CardContent>

                    <CardFooter className="flex flex-col gap-4">
                        <Button
                            className="w-full h-12 text-lg font-bold"
                            disabled={isLoading || (!sellAmount && (
                                (direction === 'MOV_TO_SOL' && aptos.connected) ||
                                (direction === 'SOL_TO_MOV' && solana.connected)
                            ))}
                            onClick={() => {
                                if (direction === 'MOV_TO_SOL') {
                                    if (!aptos.connected) {
                                        aptos.connect();
                                    } else {
                                        handleSwap();
                                    }
                                } else {
                                    if (!solana.connected) {
                                        setVisible(true);
                                    } else {
                                        handleSwap();
                                    }
                                }
                            }}
                        >
                            {isLoading ? <><Loader2 className="mr-2 animate-spin" /> Processing</> :
                                (direction === 'MOV_TO_SOL' && !aptos.connected) ? "Connect Movement Wallet" :
                                    (direction === 'SOL_TO_MOV' && !solana.connected) ? "Connect Solana Wallet" :
                                        "Swap Now"}
                        </Button>

                        {/* WALLET STATUS */}
                        <div className="grid grid-cols-2 gap-4 w-full">
                            <div className="flex flex-col items-center gap-2 p-2 rounded-lg bg-muted/50">
                                <span className="text-xs font-bold text-muted-foreground">Movement</span>
                                {aptos.connected ? (
                                    <div className="text-xs text-green-500 font-mono truncate w-full text-center">
                                        {aptos.account?.address.toString().slice(0, 6)}...
                                    </div>
                                ) : (
                                    <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => (document.querySelector('.wallet-adapter-button') as HTMLElement)?.click()}>
                                        Connect
                                    </Button>
                                )}
                            </div>

                            <div className="flex flex-col items-center gap-2 p-2 rounded-lg bg-muted/50">
                                <span className="text-xs font-bold text-muted-foreground">Solana</span>
                                {solana.connected ? (
                                    <div className="text-xs text-green-500 font-mono truncate w-full text-center">
                                        {solana.publicKey?.toBase58().slice(0, 6)}...
                                    </div>
                                ) : (
                                    <WalletMultiButton style={{ height: '24px', fontSize: '12px', padding: '0 12px' }} />
                                )}
                            </div>
                        </div>
                    </CardFooter>
                </Card>

                {/* INFO / ORACLE PANEL */}
                <div className="w-full max-w-[350px] space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">Live Oracle Rates (Pyth)</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>MOVE/USD</span>
                                <span className="font-mono text-green-400">
                                    {prices['MOVE'] ? `$${prices['MOVE']}` : <Loader2 className="h-3 w-3 animate-spin" />}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>SOL/USD</span>
                                <span className="font-mono text-blue-400">
                                    {prices['SOL'] ? `$${prices['SOL']}` : <Loader2 className="h-3 w-3 animate-spin" />}
                                </span>
                            </div>
                            <div className="border-t border-border/50 my-2 pt-2"></div>
                            <div className="flex justify-between text-sm font-semibold">
                                <span>Rate</span>
                                <span className="font-mono text-yellow-400">
                                    {prices['SOL'] && prices['MOVE']
                                        ? `1 SOL ≈ ${(prices['SOL'] / prices['MOVE']).toFixed(2)} MOVE`
                                        : <Loader2 className="h-3 w-3 animate-spin" />
                                    }
                                </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-4">
                                * Prices updated every 15s via Pyth Network.
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
                        <CardHeader>
                            <CardTitle className="text-sm flex items-center gap-2"><RotateCw className="h-4 w-4" /> How it works</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground space-y-2">
                            <p>1. You sign an intent to swap {sellToken.symbol} for {buyToken.symbol}.</p>
                            <p>2. Our <strong>Intent Relayer</strong> detects your order.</p>
                            <p>3. The Relayer <strong>instantly fills</strong> your order on the destination chain using its own liquidity.</p>
                            <p>4. No waiting for bridges. Atomic & Trustless.</p>
                        </CardContent>
                    </Card>
                </div>

            </div>
        </div>
    );
}

// Icon Helper
function Zap({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.75a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.913-.143z" clipRule="evenodd" />
        </svg>
    )
}
