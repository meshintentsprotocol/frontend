import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWDK } from '@/context/WDKProvider';
import { useBCHWallet } from '@/context/BCHWalletProvider';
import { usePortfolio } from '@/hooks/usePortfolio';
import { Navigation, Loader2, ChevronLeft, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { ActivityService } from '@/lib/activity';
import { USDT_SEPOLIA, USDT_BSC, getEvmConfig } from '@/lib/intentHTLC';

// ============================================================================
// Types
// ============================================================================

type ChainId = 'eth' | 'bch' | 'sol' | 'btc';
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
        btc: { name: 'Bitcoin', label: 'Testnet', icon: '/logos/bitcoin-btc-logo.svg' },
    };
}

function getExplorerUrl(chain: ChainId, txHash: string, isMainnet: boolean) {
    if (chain === 'eth') return isMainnet ? `https://bscscan.com/tx/${txHash}` : `https://sepolia.etherscan.io/tx/${txHash}`;
    if (chain === 'bch') return isMainnet ? `https://blockchair.com/bitcoin-cash/transaction/${txHash}` : `https://chipnet.imaginary.cash/tx/${txHash}`;
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
            wdk.btcAddress ? 'btc' : null,
            wdk.solanaAddress ? 'sol' : null,
        ] as (ChainId | null)[]).filter((c): c is ChainId => !!c),
        [wdk.evmAddress, bchWallet.connected, wdk.btcAddress, wdk.solanaAddress]
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

        if (selectedChain === 'btc') {
            const btcBal = portfolioTokens.find(t => t.symbol === 'BTC')?.balance ?? 0;
            return [
                { id: 'btc', symbol: 'BTC', name: 'Bitcoin', icon: '/logos/bitcoin-btc-logo.svg', decimals: 8, chain: 'btc', balance: btcBal },
            ];
        }

        // sol
        const solBal = portfolioTokens.find(t => t.symbol === 'SOL')?.balance ?? 0;
        return [
            { id: 'sol', symbol: 'SOL', name: 'Solana', icon: '/assets/solanaLogo.png', decimals: 9, chain: 'sol', balance: solBal },
        ];
    }, [selectedChain, portfolioTokens, bchWallet.balance, bchWallet.tokenBalances]);

    const resetState = () => {
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
                tx.sign(keypair);
                const sig = await connection.sendRawTransaction(tx.serialize());
                await connection.confirmTransaction(sig, 'processed');
                txHash = sig;

            } else if (selectedChain === 'btc') {
                if (!wdk.btcAccount) throw new Error('Bitcoin account not available');
                const sats = BigInt(Math.round(parsedAmount * 1e8));
                const result = await wdk.btcAccount.sendTransaction({ to: recipient, value: sats });
                txHash = (result as any)?.hash ?? '';
            }

            const explorerUrl = getExplorerUrl(selectedChain, txHash, isMainnet);
            ActivityService.addActivity({
                type: 'send',
                asset: selectedToken.symbol,
                amount: parsedAmount,
                valueUsd: 0,
                txHash,
                network: CHAIN_META[selectedChain].name,
                explorerUrl,
            });

            toast.success(
                <div className="flex flex-col gap-0.5">
                    <span>Sent {amount} {selectedToken.symbol}</span>
                    {explorerUrl && (
                        <a href={explorerUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                            View on Explorer →
                        </a>
                    )}
                </div>
            );
            setIsOpen(false);
            setTimeout(resetState, 300);

        } catch (e: any) {
            console.error('[Send]', e);
            toast.error('Transaction failed', { description: e.message });
        } finally {
            setIsSending(false);
        }
    };

    const parsedAmt = parseFloat(amount);
    const amountValid = !isNaN(parsedAmt) && parsedAmt > 0;
    const canSend = !isSending && !!recipient && amountValid && !!selectedToken && parsedAmt <= selectedToken.balance;
    const stepIndex = STEPS.indexOf(step);

    return (
        <Dialog open={isOpen} onOpenChange={(v) => { setIsOpen(v); if (!v) setTimeout(resetState, 300); }}>
            <DialogTrigger asChild>
                {children ?? (
                    <button className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] transition-colors group">
                        <div className="text-primary group-hover:-translate-y-0.5 transition-transform">
                            <Navigation className="h-5 w-5" />
                        </div>
                        <span className="text-sm font-medium text-foreground">Send</span>
                    </button>
                )}
            </DialogTrigger>

            <DialogContent className="sm:max-w-md bg-[#0A0A0A] border-white/10 rounded-2xl p-0 overflow-hidden">
                <div className="p-6">
                    <DialogHeader className="mb-5">
                        <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                            {step !== 'chain' && (
                                <button onClick={goBack} className="text-muted-foreground hover:text-foreground transition-colors -ml-1">
                                    <ChevronLeft className="h-5 w-5" />
                                </button>
                            )}
                            {step === 'chain' && 'Send Assets'}
                            {step === 'token' && `Send on ${selectedChain ? CHAIN_META[selectedChain].name : ''}`}
                            {step === 'form' && `Send ${selectedToken?.symbol ?? ''}`}
                        </DialogTitle>
                        {/* Progress bar */}
                        <div className="flex gap-1.5 mt-2">
                            {STEPS.map((s, i) => (
                                <div
                                    key={s}
                                    className={`h-0.5 flex-1 rounded-full transition-colors duration-300 ${i <= stepIndex ? 'bg-emerald-500' : 'bg-white/10'}`}
                                />
                            ))}
                        </div>
                    </DialogHeader>

                    {!wdk.isInitialized ? (
                        <div className="text-center py-10 text-sm text-muted-foreground">
                            Connect a WDK wallet to send assets.
                        </div>
                    ) : step === 'chain' ? (
                        <div className="space-y-2 animate-in fade-in-50 duration-200">
                            <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wider font-medium">Select chain</p>
                            {availableChains.length === 0 ? (
                                <p className="text-sm text-center text-muted-foreground py-6">No chains available in your WDK wallet.</p>
                            ) : availableChains.map(chainId => {
                                const meta = CHAIN_META[chainId];
                                return (
                                    <button
                                        key={chainId}
                                        onClick={() => selectChain(chainId)}
                                        className="flex items-center gap-3 p-4 w-full bg-white/[0.03] border border-white/10 rounded-xl hover:bg-white/[0.07] hover:border-emerald-500/30 transition-all group text-left"
                                    >
                                        <img src={meta.icon} alt={meta.name} className="w-9 h-9 rounded-full bg-white/10 p-1 object-contain group-hover:scale-105 transition-transform" />
                                        <div className="flex-1">
                                            <div className="font-semibold text-sm">{meta.name}</div>
                                            <div className="text-[11px] text-muted-foreground">{meta.label}</div>
                                        </div>
                                        <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-emerald-400 transition-colors" />
                                    </button>
                                );
                            })}
                        </div>

                    ) : step === 'token' ? (
                        <div className="space-y-2 animate-in fade-in-50 duration-200">
                            <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wider font-medium">Select token</p>
                            {availableTokens.map(token => {
                                const balDisplay = token.balance.toFixed(Math.min(token.decimals, 6));
                                return (
                                    <button
                                        key={token.id}
                                        onClick={() => selectToken(token)}
                                        className="flex items-center gap-3 p-3.5 w-full bg-white/[0.03] border border-white/10 rounded-xl hover:bg-white/[0.07] hover:border-emerald-500/30 transition-all group text-left"
                                    >
                                        <img src={token.icon} alt={token.symbol} className="w-8 h-8 rounded-full bg-white/10 p-0.5 object-contain" />
                                        <div className="flex-1">
                                            <div className="font-semibold text-sm">{token.symbol}</div>
                                            <div className="text-[11px] text-muted-foreground">{token.name}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-mono tabular-nums">{balDisplay}</div>
                                            <div className="text-[10px] text-muted-foreground">balance</div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                    ) : (
                        <div className="space-y-4 animate-in fade-in-50 duration-200">
                            {/* Selected token pill */}
                            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                                <img src={selectedToken?.icon} alt={selectedToken?.symbol} className="w-6 h-6 rounded-full object-contain" />
                                <span className="text-sm font-semibold">{selectedToken?.symbol}</span>
                                <span className="text-[11px] text-muted-foreground ml-auto font-mono">
                                    {selectedToken?.balance.toFixed(Math.min(selectedToken.decimals, 6))} available
                                </span>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recipient address</label>
                                <Input
                                    placeholder={
                                        selectedChain === 'eth' ? '0x...' :
                                        selectedChain === 'bch' ? 'bitcoincash:q...' :
                                        selectedChain === 'btc' ? 'tb1q...' : 'Solana address'
                                    }
                                    value={recipient}
                                    onChange={e => setRecipient(e.target.value)}
                                    className="bg-white/[0.03] border-white/10 h-11 rounded-xl focus-visible:ring-1 focus-visible:ring-emerald-500/50 font-mono text-[13px]"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</label>
                                    <button
                                        onClick={() => selectedToken && setAmount(selectedToken.balance.toFixed(Math.min(selectedToken.decimals, 8)))}
                                        className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold"
                                    >
                                        MAX
                                    </button>
                                </div>
                                <Input
                                    type="number"
                                    placeholder="0.0"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    className="bg-white/[0.03] border-white/10 h-14 text-2xl font-bold rounded-xl focus-visible:ring-1 focus-visible:ring-emerald-500/50"
                                />
                                {amount && selectedToken && parsedAmt > selectedToken.balance && (
                                    <p className="text-xs text-red-400">Amount exceeds balance</p>
                                )}
                            </div>

                            <Button
                                className="w-full h-12 mt-1 text-base font-semibold bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 rounded-xl disabled:opacity-40"
                                onClick={handleSend}
                                disabled={!canSend}
                            >
                                {isSending
                                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…</>
                                    : `Send ${selectedToken?.symbol ?? ''}`}
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
