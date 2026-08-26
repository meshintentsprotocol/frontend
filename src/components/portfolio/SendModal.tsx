import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWDK } from '@/context/WDKProvider';
import { useBCHWallet } from '@/context/BCHWalletProvider';
import { usePortfolio } from '@/hooks/usePortfolio';
import { Navigation, Loader2, ChevronLeft, ArrowRight } from 'lucide-react';
import { notifyToast as toast } from '@/lib/notify-toast';
import { ActivityService } from '@/lib/activity';
import { USDT_SEPOLIA, USDT_BSC, getEvmConfig } from '@/lib/intentHTLC';

// ============================================================================
// Types
// ============================================================================

type ChainId = 'eth' | 'bch' | 'sol' | 'btc' | 'move';
type SendStep = 'chain' | 'token' | 'form';

interface SendToken {
    id: string;
    symbol: string;
    name: string;
    icon: string;
    decimals: number;
    chain: ChainId;
    address?: string;       // ERC-20 contract
    bchCategory?: string;   // CashToken category hex
    balance: number;
}

const STEPS: SendStep[] = ['chain', 'token', 'form'];

function getChainMeta(isMainnet: boolean): Record<ChainId, { name: string; label: string; icon: string }> {
    return {
        eth: {
            name: isMainnet ? 'BNB Smart Chain' : 'Ethereum',
            label: isMainnet ? 'BSC Mainnet' : 'Sepolia Testnet',
            icon: isMainnet ? '/logos/bnb-bnb-logo.svg' : '/logos/ethereum-eth-logo.svg',
        },
        bch: {
            name: 'Bitcoin Cash',
            label: isMainnet ? 'Mainnet' : 'Chipnet',
            icon: '/logos/bitcoin-cash-bch-logo.svg',
        },
        sol: { name: 'Solana', label: 'Devnet', icon: '/assets/solanaLogo.png' },
        move: { name: 'Movement', label: isMainnet ? 'Mainnet' : 'Bardock Testnet', icon: '/logos/movement.svg' },
        btc: { name: 'Bitcoin', label: 'Testnet', icon: '/logos/bitcoin-btc-logo.svg' },
    };
}

function getExplorerUrl(chain: ChainId, txHash: string, isMainnet: boolean) {
    if (chain === 'eth') return isMainnet ? `https://bscscan.com/tx/${txHash}` : `https://sepolia.etherscan.io/tx/${txHash}`;
    if (chain === 'bch') return isMainnet ? `https://blockchair.com/bitcoin-cash/transaction/${txHash}` : `https://chipnet.imaginary.cash/tx/${txHash}`;
    if (chain === 'move') return `https://explorer.movementnetwork.xyz/txn/${txHash}?network=testnet`;
    if (chain === 'btc') return `https://blockstream.info/testnet/tx/${txHash}`;
    return `https://solscan.io/tx/${txHash}?cluster=devnet`;
}

// ============================================================================
// SendModal
// ============================================================================

export function SendModal({ children }: { children?: React.ReactNode }) {
    const wdk = useWDK();
    const bchWallet = useBCHWallet();
    const { tokens: portfolioTokens } = usePortfolio();
    const isMainnet = wdk.bchNetwork === 'mainnet';
    const CHAIN_META = getChainMeta(isMainnet);

    const [isOpen, setIsOpen] = useState(false);
    const [step, setStep] = useState<SendStep>('chain');
    const [selectedChain, setSelectedChain] = useState<ChainId | null>(null);
    const [selectedToken, setSelectedToken] = useState<SendToken | null>(null);
    const [recipient, setRecipient] = useState('');
    const [amount, setAmount] = useState('');
    const [isSending, setIsSending] = useState(false);

    // Only show chains where WDK has a key
    const availableChains = useMemo(
        () => ([
            wdk.evmAddress ? 'eth' : null,
            bchWallet.connected ? 'bch' : null,
            wdk.movementAddress ? 'move' : null,
            wdk.btcAddress ? 'btc' : null,
            wdk.solanaAddress ? 'sol' : null,
        ] as (ChainId | null)[]).filter((c): c is ChainId => !!c),
        [wdk.evmAddress, bchWallet.connected, wdk.movementAddress, wdk.btcAddress, wdk.solanaAddress]
    );

    // Token list for the selected chain, with live balances
    const availableTokens = useMemo((): SendToken[] => {
        if (!selectedChain) return [];

        if (selectedChain === 'eth') {
            const nativeSymbol = isMainnet ? 'BNB' : 'ETH';
            const nativeBal = portfolioTokens.find(t => t.symbol === nativeSymbol)?.balance ?? 0;
            const usdtBal = portfolioTokens.find(t => t.symbol === 'USDT')?.balance ?? 0;
            const usdtAddress = isMainnet ? USDT_BSC : USDT_SEPOLIA;
            return [
                {
                    id: 'native',
                    symbol: nativeSymbol,
                    name: isMainnet ? 'BNB Smart Chain' : 'Ethereum',
                    icon: isMainnet ? '/logos/bnb-bnb-logo.svg' : '/logos/ethereum-eth-logo.svg',
                    decimals: 18,
                    chain: 'eth' as ChainId,
                    balance: nativeBal,
                },
                { id: 'usdt-evm', symbol: 'USDT', name: 'Tether USD', icon: '/logos/usdt-svgrepo-com.svg', decimals: 6, chain: 'eth' as ChainId, address: usdtAddress, balance: usdtBal },
            ];
        }

        if (selectedChain === 'bch') {
            const nativeBal = bchWallet.balance / 1e8;
            const tokens: SendToken[] = [
                { id: 'bch', symbol: 'BCH', name: 'Bitcoin Cash', icon: '/logos/bitcoin-cash-bch-logo.svg', decimals: 8, chain: 'bch', balance: nativeBal },
            ];
            for (const [cat, amt] of Object.entries(bchWallet.tokenBalances)) {
                if (amt > 0n) {
                    const shortCat = `${cat.slice(0, 8)}…`;
                    tokens.push({
                        id: cat,
                        symbol: shortCat,
                        name: `CashToken ${shortCat}`,
                        icon: '/logos/bitcoin-cash-bch-logo.svg',
                        decimals: 0,
                        chain: 'bch',
                        bchCategory: cat,
                        balance: Number(amt),
                    });
                }
            }
            return tokens;
        }

        if (selectedChain === 'sol') {
            const solBal = portfolioTokens.find(t => t.symbol === 'SOL')?.balance ?? 0;
            const usdcBal = portfolioTokens.find(t => t.symbol === 'USDC')?.balance ?? 0;
            const usdtBal = portfolioTokens.find(t => t.symbol === 'USDT (SOL)')?.balance ?? 0;
            return [
                { id: 'sol-native', symbol: 'SOL', name: 'Solana', icon: '/assets/solanaLogo.png', decimals: 9, chain: 'sol', balance: solBal },
                { id: 'sol-usdc', symbol: 'USDC', name: 'USD Coin', icon: '/logos/usd-coin-usdc-logo.svg', decimals: 6, chain: 'sol', balance: usdcBal },
                { id: 'sol-usdt', symbol: 'USDT', name: 'Tether USD', icon: '/logos/usdt-svgrepo-com.svg', decimals: 6, chain: 'sol', balance: usdtBal },
            ];
        }

        if (selectedChain === 'move') {
            const moveBal = portfolioTokens.find(t => t.symbol === 'MOVE')?.balance ?? 0;
            const usdcBal = portfolioTokens.find(t => t.symbol === 'USDC (MOVE)')?.balance ?? 0;
            const usdtBal = portfolioTokens.find(t => t.symbol === 'USDT (MOVE)')?.balance ?? 0;
            return [
                { id: 'move-native', symbol: 'MOVE', name: 'Movement', icon: '/logos/movement.svg', decimals: 8, chain: 'move', balance: moveBal },
                { id: 'move-usdc', symbol: 'USDC', name: 'USD Coin (Movement)', icon: '/logos/usd-coin-usdc-logo.svg', decimals: 6, chain: 'move', balance: usdcBal },
                { id: 'move-usdt', symbol: 'USDT', name: 'Tether USD (Movement)', icon: '/logos/usdt-svgrepo-com.svg', decimals: 6, chain: 'move', balance: usdtBal },
            ];
        }

        if (selectedChain === 'btc') {
            const btcBal = portfolioTokens.find(t => t.symbol === 'BTC')?.balance ?? 0;
            return [
                { id: 'btc-native', symbol: 'BTC', name: 'Bitcoin', icon: '/logos/bitcoin-btc-logo.svg', decimals: 8, chain: 'btc', balance: btcBal },
            ];
        }

        return [];
    }, [selectedChain, isMainnet, portfolioTokens, bchWallet.balance, bchWallet.tokenBalances]);

    const reset = () => {
        setStep('chain');
        setSelectedChain(null);
        setSelectedToken(null);
        setRecipient('');
        setAmount('');
    };

    const goBack = () => {
        if (step === 'form') {
            setStep('token');
            setSelectedToken(null);
            setAmount('');
            setRecipient('');
        } else if (step === 'token') {
            setStep('chain');
            setSelectedChain(null);
        }
    };

    const selectChain = (chainId: ChainId) => {
        setSelectedChain(chainId);
        setStep('token');
    };

    const selectToken = (token: SendToken) => {
        setSelectedToken(token);
        setStep('form');
    };

    const handleSend = async () => {
        if (!selectedToken || !selectedChain || !recipient || !amount) return;
        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            toast.error('Enter a valid amount');
            return;
        }
        if (parsedAmount > selectedToken.balance) {
            toast.error('Insufficient balance');
            return;
        }

        setIsSending(true);
        let txHash = '';

        try {
            if (selectedChain === 'eth') {
                if (!wdk.evmSigner) throw new Error('EVM signer not available');
                const { ethers } = await import('ethers');
                const evmCfg = getEvmConfig(isMainnet);
                const provider = new ethers.JsonRpcProvider(evmCfg.rpc, evmCfg.chainId);
                const signer = wdk.evmSigner.connect(provider);

                if (!selectedToken.address) {
                    const tx = await signer.sendTransaction({
                        to: recipient,
                        value: ethers.parseEther(amount),
                    });
                    await tx.wait();
                    txHash = tx.hash;
                } else {
                    const iface = new ethers.Interface(['function transfer(address to, uint256 amount) returns (bool)']);
                    const data = iface.encodeFunctionData('transfer', [
                        recipient,
                        ethers.parseUnits(amount, selectedToken.decimals),
                    ]);
                    const tx = await signer.sendTransaction({ to: selectedToken.address, data });
                    await tx.wait();
                    txHash = tx.hash;
                }

            } else if (selectedChain === 'bch') {
                const wallet = wdk.bchWallet;
                if (!wallet) throw new Error('BCH wallet not available');

                if (!selectedToken.bchCategory) {
                    const satoshis = Math.round(parsedAmount * 1e8);
                    const result = await wallet.send([{ cashaddr: recipient, value: satoshis, unit: 'sat' }]);
                    txHash = (result as any).txId ?? '';
                } else {
                    const result = await wallet.send([{
                        cashaddr: recipient,
                        tokenId: selectedToken.bchCategory,
                        amount: Math.round(parsedAmount),
                    }]);
                    txHash = (result as any).txId ?? '';
                }

            } else if (selectedChain === 'sol') {
                if (!wdk.solanaSigner?.secretKey) throw new Error('Solana signer not available');
                const { Keypair, Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
                const keypair = Keypair.fromSecretKey(wdk.solanaSigner.secretKey);
                const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
                const tx = new Transaction().add(
                    SystemProgram.transfer({
                        fromPubkey: keypair.publicKey,
                        toPubkey: new PublicKey(recipient),
                        lamports: Math.floor(parsedAmount * LAMPORTS_PER_SOL),
                    })
                );
                const { blockhash } = await connection.getLatestBlockhash();
                tx.recentBlockhash = blockhash;
                tx.feePayer = keypair.publicKey;
                txHash = await connection.sendTransaction(tx, [keypair]);
                await connection.confirmTransaction(txHash, 'confirmed');

            } else if (selectedChain === 'move') {
                if (!wdk.movementAccount) throw new Error('Movement account not available');
                const { Aptos, AptosConfig, Network, AccountAddress } = await import('@aptos-labs/ts-sdk');
                const aptos = new Aptos(new AptosConfig({
                    network: Network.CUSTOM,
                    fullnode: 'https://testnet.movementnetwork.xyz/v1'
                }));
                const rawAmount = Math.floor(parsedAmount * Math.pow(10, selectedToken.decimals));
                const coinType = (selectedToken.address && selectedToken.address.includes('::'))
                    ? selectedToken.address
                    : (selectedToken.symbol.includes('USDC')
                        ? '0x45142fb00dde90b950183d8ac2815597892f665c254c3f42b5768bc6ae4c8489'
                        : (selectedToken.symbol.includes('USDT')
                            ? '0xa663e903b11931807045423e25847425466a0c9777021464e104e845e1123963'
                            : (selectedToken.symbol.includes('ETH') || selectedToken.symbol.includes('WETH')
                                ? '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::WETH'
                                : '0x1::aptos_coin::AptosCoin')));

                const transaction = await aptos.transferCoinTransaction({
                    sender: wdk.movementAccount.accountAddress,
                    recipient: AccountAddress.fromString(recipient),
                    amount: rawAmount,
                    coinType: coinType as any,
                });
                const pendingTx = await aptos.signAndSubmitTransaction({
                    signer: wdk.movementAccount,
                    transaction,
                });
                const executedTx = await aptos.waitForTransaction({ transactionHash: pendingTx.hash });
                txHash = executedTx.hash;

            } else if (selectedChain === 'btc') {
                if (!wdk.btcAccount) throw new Error('Bitcoin account not available');
                const satoshis = BigInt(Math.round(parsedAmount * 1e8));
                const res = await wdk.btcAccount.sendTransaction({
                    recipient,
                    amount: satoshis,
                });
                txHash = res.txId ?? res.hash ?? '';
            }

            // Log activity
            ActivityService.addActivity({
                type: 'send',
                description: `Sent ${amount} ${selectedToken.symbol} on ${CHAIN_META[selectedChain].name}`,
                txHash,
                status: 'confirmed',
                metadata: {
                    recipient,
                    amount,
                    token: selectedToken.symbol,
                    chain: selectedChain,
                },
            });

            toast.success(
                <div>
                    <p className="font-semibold">Transaction Sent!</p>
                    <p className="text-xs text-muted-foreground">
                        {amount} {selectedToken.symbol} sent to {recipient.slice(0, 8)}…
                    </p>
                    {txHash && (
                        <a
                            href={getExplorerUrl(selectedChain, txHash, isMainnet)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary underline mt-1 inline-block"
                        >
                            View on Explorer →
                        </a>
                    )}
                </div>
            );

            setIsOpen(false);
            reset();
            wdk.refreshBalances();
        } catch (e: any) {
            console.error('[Send] Error:', e);
            toast.error(e.message ?? 'Transaction failed');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={open => { setIsOpen(open); if (!open) reset(); }}>
            <DialogTrigger asChild>
                {children ?? (
                    <button className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] transition-colors group">
                        <div className="text-primary group-hover:scale-110 transition-transform">
                            <Navigation className="h-5 w-5 rotate-45" />
                        </div>
                        <span className="text-sm font-medium text-foreground">Send</span>
                    </button>
                )}
            </DialogTrigger>

            <DialogContent className="sm:max-w-md bg-[#0A0A0A] border-white/10 rounded-2xl p-0 overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b border-white/5 flex items-center gap-3">
                    {step !== 'chain' && (
                        <button
                            onClick={goBack}
                            className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                    )}
                    <div>
                        <DialogTitle className="text-lg font-semibold">
                            {step === 'chain' && 'Select Network'}
                            {step === 'token' && `Select Token · ${selectedChain ? CHAIN_META[selectedChain].name : ''}`}
                            {step === 'form' && `Send ${selectedToken?.symbol}`}
                        </DialogTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {step === 'chain' && 'Choose the network to send assets from'}
                            {step === 'token' && 'Choose which token to send'}
                            {step === 'form' && `Enter recipient and amount on ${selectedChain ? CHAIN_META[selectedChain].name : ''}`}
                        </p>
                    </div>
                </div>

                {/* Step indicator */}
                <div className="flex gap-1 px-5 pt-3">
                    {STEPS.map((s, i) => (
                        <div
                            key={s}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                                STEPS.indexOf(step) >= i ? 'bg-primary' : 'bg-white/10'
                            }`}
                        />
                    ))}
                </div>

                <div className="p-5">
                    {/* STEP 1: Select Chain */}
                    {step === 'chain' && (
                        <div className="space-y-2">
                            {availableChains.map(chainId => {
                                const meta = CHAIN_META[chainId];
                                return (
                                    <button
                                        key={chainId}
                                        onClick={() => selectChain(chainId)}
                                        className="w-full flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05] hover:border-primary/30 transition-all text-left group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <img src={meta.icon} alt={meta.name} className="h-8 w-8 object-contain rounded-full p-1 bg-white/5" />
                                            <div>
                                                <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                                                    {meta.name}
                                                </p>
                                                <p className="text-xs text-muted-foreground">{meta.label}</p>
                                            </div>
                                        </div>
                                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* STEP 2: Select Token */}
                    {step === 'token' && (
                        <div className="space-y-2">
                            {availableTokens.length === 0 ? (
                                <p className="text-center text-sm text-muted-foreground py-8">
                                    No tokens found with balance on this network.
                                </p>
                            ) : (
                                availableTokens.map(token => (
                                    <button
                                        key={token.id}
                                        onClick={() => selectToken(token)}
                                        className="w-full flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05] hover:border-primary/30 transition-all text-left group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <img src={token.icon} alt={token.symbol} className="h-8 w-8 object-contain rounded-full p-1 bg-white/5" />
                                            <div>
                                                <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                                                    {token.name}
                                                </p>
                                                <p className="text-xs text-muted-foreground">{token.symbol}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-mono font-medium text-foreground">
                                                {token.balance.toFixed(token.decimals > 6 ? 4 : 2)}
                                            </p>
                                            <p className="text-xs text-muted-foreground">Available</p>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    )}

                    {/* STEP 3: Form */}
                    {step === 'form' && selectedToken && (
                        <div className="space-y-4">
                            {/* Selected token pill */}
                            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                                <div className="flex items-center gap-2.5">
                                    <img src={selectedToken.icon} alt={selectedToken.symbol} className="h-6 w-6 object-contain" />
                                    <span className="text-sm font-medium">{selectedToken.name}</span>
                                </div>
                                <span className="text-xs font-mono text-muted-foreground">
                                    Bal: {selectedToken.balance.toFixed(4)} {selectedToken.symbol}
                                </span>
                            </div>

                            {/* Recipient */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Recipient Address</label>
                                <Input
                                    placeholder={
                                        selectedChain === 'bch' ? 'bchtest:...' :
                                        selectedChain === 'sol' ? 'Solana public key...' :
                                        selectedChain === 'move' ? '0x... (Movement address)' :
                                        selectedChain === 'btc' ? 'tb1q... or 2N...' :
                                        '0x...'
                                    }
                                    value={recipient}
                                    onChange={e => setRecipient(e.target.value.trim())}
                                    className="bg-white/5 border-white/10 font-mono text-xs h-10"
                                />
                            </div>

                            {/* Amount */}
                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-medium text-muted-foreground">Amount</label>
                                    <button
                                        type="button"
                                        onClick={() => setAmount(selectedToken.balance.toString())}
                                        className="text-xs text-primary hover:underline"
                                    >
                                        Max ({selectedToken.balance.toFixed(4)})
                                    </button>
                                </div>
                                <div className="relative">
                                    <Input
                                        type="number"
                                        step="any"
                                        placeholder="0.0"
                                        value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                        className="bg-white/5 border-white/10 font-mono text-sm h-10 pr-16"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                                        {selectedToken.symbol}
                                    </span>
                                </div>
                            </div>

                            {/* Submit */}
                            <Button
                                onClick={handleSend}
                                disabled={isSending || !recipient || !amount || parseFloat(amount) <= 0}
                                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl"
                            >
                                {isSending ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        Sending...
                                    </>
                                ) : (
                                    `Send ${selectedToken.symbol}`
                                )}
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
