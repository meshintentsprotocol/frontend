import { useState, useMemo, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWDK } from '@/context/WDKProvider';
import { useBCHWallet } from '@/context/BCHWalletProvider';
import { usePortfolio } from '@/hooks/usePortfolio';
import { ArrowUpRight, ChevronLeft, ChevronRight, Loader2, Search, Wallet2 } from 'lucide-react';
import { notifyToast as toast } from '@/lib/notify-toast';
import { ActivityService } from '@/lib/activity';
import { getEVMChainConfig } from '@/lib/evmChains';
import { cn } from '@/lib/utils';
import { Chameleon, type ChamMood } from '@/components/wallet/Chameleon';
import { useActiveAccounts } from '@/hooks/useActiveAccounts';
import { useMeshSigner } from '@/hooks/useMesh';
import { useBchAddressBalance } from '@/hooks/useBchAddressBalance';
import { buildAndSendBch } from '@/lib/bchSend';
import { AppNetwork } from '@/lib/wallets/types';
import {
    getEvmSignerForChain, readBalances, sendChains, tokensForChain, type SendChain, type SendToken,
} from './sendChains';

// ============================================================================
// Send — pick a network, then a token, then send. EVM is one entry per chain.
// ============================================================================

type Step = 'chain' | 'token' | 'form';
const STEPS: Step[] = ['chain', 'token', 'form'];

function explorerTxUrl(chain: SendChain, hash: string, isMainnet: boolean): string | undefined {
    if (!hash) return undefined;
    if (chain.family === 'evm' && chain.evmKey) return `${getEVMChainConfig(chain.evmKey, isMainnet)?.explorer}/tx/${hash}`;
    if (chain.family === 'bch') return isMainnet ? `https://blockchair.com/bitcoin-cash/transaction/${hash}` : `https://chipnet.imaginary.cash/tx/${hash}`;
    if (chain.family === 'move') return `https://explorer.movementnetwork.xyz/txn/${hash}?network=${isMainnet ? 'mainnet' : 'testnet'}`;
    if (chain.family === 'btc') return `https://blockstream.info/testnet/tx/${hash}`;
    return `https://solscan.io/tx/${hash}?cluster=devnet`;
}

const fmtBal = (n: number | undefined) => (n === undefined || Number.isNaN(n) ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: 6 }));

export function SendModal({ children }: { children?: React.ReactNode }) {
    const wdk = useWDK();
    const bchWallet = useBCHWallet();
    const activeAccounts = useActiveAccounts();
    const meshSigner = useMeshSigner();
    const { tokens: portfolioTokens } = usePortfolio({ scope: 'active' });
    const isMainnet = wdk.bchNetwork === 'mainnet';

    const [isOpen, setIsOpen] = useState(false);
    const [step, setStep] = useState<Step>('chain');
    const [chain, setChain] = useState<SendChain | null>(null);
    const [token, setToken] = useState<SendToken | null>(null);
    const [query, setQuery] = useState('');
    const [recipient, setRecipient] = useState('');
    const [amount, setAmount] = useState('');
    const [sending, setSending] = useState(false);
    const [balances, setBalances] = useState<Record<string, number>>({});
    const [loadingBalances, setLoadingBalances] = useState(false);
    const [mood, setMood] = useState<ChamMood>('idle');
    const moodTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const flash = (m: ChamMood) => { clearTimeout(moodTimer.current); setMood(m); moodTimer.current = setTimeout(() => setMood('idle'), 1400); };
    useEffect(() => () => clearTimeout(moodTimer.current), []);

    const extBchActive = activeAccounts.bch?.source === 'external';
    const extBchQuery = useBchAddressBalance({
        address: extBchActive ? activeAccounts.bch?.address ?? null : null,
        isMainnet,
    });

    const bchHeld = useMemo<{ sats: number; tokens: Record<string, bigint> }>(() => {
        if (extBchActive && extBchQuery.data) {
            const rawTokens: Record<string, bigint> = {};
            for (const [k, v] of Object.entries(extBchQuery.data.tokens ?? {})) {
                try { rawTokens[k] = BigInt(v); } catch {}
            }
            return {
                sats: extBchQuery.data.sats,
                tokens: rawTokens,
            };
        }
        return {
            sats: bchWallet.balance,
            tokens: bchWallet.tokenBalances,
        };
    }, [extBchActive, extBchQuery.data, bchWallet.balance, bchWallet.tokenBalances]);

    const activeAccount = useMemo(() => {
        if (!chain) return undefined;
        if (chain.family === 'bch') return activeAccounts.bch;
        if (chain.family === 'evm') return activeAccounts.evm;
        if (chain.family === 'sol') return activeAccounts.solana;
        if (chain.family === 'btc') return activeAccounts.btc;
        if (chain.family === 'move') return activeAccounts.movement;
        return undefined;
    }, [chain, activeAccounts]);

    const chains = useMemo(() => sendChains({
        isMainnet,
        evmAddress: activeAccounts.evm?.address || wdk.evmAddress,
        bchConnected: !!activeAccounts.bch?.address || bchWallet.connected,
        solanaAddress: activeAccounts.solana?.address || wdk.solanaAddress,
        movementAddress: activeAccounts.movement?.address || wdk.movementAddress,
        btcAddress: activeAccounts.btc?.address || wdk.btcAddress,
    }), [isMainnet, activeAccounts, wdk.evmAddress, bchWallet.connected, wdk.solanaAddress, wdk.movementAddress, wdk.btcAddress]);

    // The tokens of the chosen chain: the fixed ones, plus the CashTokens the active BCH wallet actually holds.
    const tokens = useMemo<SendToken[]>(() => {
        if (!chain) return [];
        const base = tokensForChain(chain, isMainnet);
        if (chain.family === 'bch') {
            for (const [cat, amt] of Object.entries(bchHeld.tokens)) {
                if (amt > 0n) {
                    const short = `${cat.slice(0, 6)}…${cat.slice(-4)}`;
                    base.push({ id: `bch-${cat}`, symbol: short, name: `CashToken ${short}`, icon: '/logos/bitcoin-cash-bch-logo.svg', decimals: 0, bchCategory: cat });
                }
            }
        }
        return base;
    }, [chain, isMainnet, bchHeld.tokens]);

    const shownTokens = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q ? tokens.filter(t => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)) : tokens;
    }, [tokens, query]);

    const portfolioBalance = (symbol: string) => portfolioTokens.find(t => t.symbol === symbol)?.balance;

    // Read the chosen chain's balances when the token step opens.
    useEffect(() => {
        if (step !== 'token' || !chain) return;
        let cancelled = false;
        setLoadingBalances(true);
        setBalances({});
        readBalances(chain, tokens, {
            isMainnet,
            evmAddress: activeAccounts.evm?.address || wdk.evmAddress,
            bchSats: bchHeld.sats,
            bchTokenBalances: bchHeld.tokens,
            portfolioBalance,
        }).then(b => { if (!cancelled) setBalances(b); }).finally(() => { if (!cancelled) setLoadingBalances(false); });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step, chain, bchHeld.sats, bchHeld.tokens]);

    const reset = () => { setStep('chain'); setChain(null); setToken(null); setQuery(''); setRecipient(''); setAmount(''); setBalances({}); };
    const back = () => {
        if (step === 'form') { setStep('token'); setToken(null); setAmount(''); setRecipient(''); }
        else if (step === 'token') { setStep('chain'); setChain(null); setQuery(''); }
    };

    const selectedBalance = token ? balances[token.id] : undefined;
    const tooMuch = selectedBalance !== undefined && !Number.isNaN(selectedBalance) && amount !== '' && parseFloat(amount) > selectedBalance;

    const handleSend = async () => {
        if (!chain || !token || !recipient || !amount) return;
        const value = parseFloat(amount);
        if (Number.isNaN(value) || value <= 0) { toast.error('Enter a valid amount'); flash('error'); return; }
        if (tooMuch) { toast.error('Insufficient balance'); flash('error'); return; }

        setSending(true);
        setMood('busy');
        let hash = '';
        try {
            if (chain.family === 'evm') {
                if (!wdk.evmSigner) throw new Error('EVM signer not available');
                const { ethers } = await import('ethers');
                const signer = await getEvmSignerForChain(wdk.evmSigner, chain.evmKey!, isMainnet);
                if (!token.address) {
                    const tx = await signer.sendTransaction({ to: recipient, value: ethers.parseEther(amount) });
                    await tx.wait();
                    hash = tx.hash;
                } else {
                    const erc = new ethers.Contract(token.address, ['function transfer(address,uint256) returns (bool)'], signer);
                    const tx = await erc.transfer(recipient, ethers.parseUnits(amount, token.decimals));
                    await tx.wait();
                    hash = tx.hash;
                }
            } else if (chain.family === 'bch') {
                if (!meshSigner.signer) throw new Error(meshSigner.unavailable || 'BCH signer not available');
                const isMax = selectedBalance !== undefined && Math.abs(value - selectedBalance) < 1e-8;
                if (token.bchCategory) {
                    const baseAmount = BigInt(Math.round(value));
                    hash = await buildAndSendBch(
                        meshSigner.signer,
                        recipient,
                        { category: token.bchCategory, amount: baseAmount },
                        `Send ${amount} ${token.symbol}`
                    );
                } else {
                    const sats = BigInt(Math.round(value * 1e8));
                    hash = await buildAndSendBch(
                        meshSigner.signer,
                        recipient,
                        { sats },
                        `Send ${amount} BCH`,
                        { sendMax: isMax }
                    );
                }
            } else if (chain.family === 'sol') {
                if (!wdk.solanaSigner?.secretKey) throw new Error('Solana signer not available');
                const { Keypair, Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
                const keypair = Keypair.fromSecretKey(wdk.solanaSigner.secretKey);
                const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
                const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: keypair.publicKey, toPubkey: new PublicKey(recipient), lamports: Math.floor(value * LAMPORTS_PER_SOL) }));
                const { blockhash } = await connection.getLatestBlockhash();
                tx.recentBlockhash = blockhash;
                tx.feePayer = keypair.publicKey;
                hash = await connection.sendTransaction(tx, [keypair]);
                await connection.confirmTransaction(hash, 'confirmed');
            } else if (chain.family === 'move') {
                if (!wdk.movementAccount) throw new Error('Movement account not available');
                const { Aptos, AptosConfig, Network, AccountAddress } = await import('@aptos-labs/ts-sdk');
                const aptos = new Aptos(new AptosConfig({ network: Network.CUSTOM, fullnode: 'https://testnet.movementnetwork.xyz/v1' }));
                const coinType = token.moveType ?? '0x1::aptos_coin::AptosCoin';
                const transaction = await aptos.transferCoinTransaction({
                    sender: wdk.movementAccount.accountAddress,
                    recipient: AccountAddress.fromString(recipient),
                    amount: Math.floor(value * Math.pow(10, token.decimals)),
                    coinType: coinType as any,
                });
                const pending = await aptos.signAndSubmitTransaction({ signer: wdk.movementAccount, transaction });
                const done = await aptos.waitForTransaction({ transactionHash: pending.hash });
                hash = done.hash;
            } else if (chain.family === 'btc') {
                if (!wdk.btcAccount) throw new Error('Bitcoin account not available');
                const res = await wdk.btcAccount.sendTransaction({ recipient, amount: BigInt(Math.round(value * 1e8)) });
                hash = res.txId ?? res.hash ?? '';
            }

            const familyMap: Record<string, string> = {
                bch: 'bch',
                evm: 'evm',
                sol: 'solana',
                move: 'movement',
                btc: 'bitcoin',
            };
            ActivityService.addActivity({
                type: 'send',
                family: (familyMap[chain.family] || 'bch') as any,
                network: isMainnet ? AppNetwork.MAINNET : AppNetwork.CHIPNET,
                wallet: activeAccount?.address,
                asset: token.symbol,
                amount: value,
                description: `Sent ${amount} ${token.symbol} on ${chain.name}`,
                txHash: hash,
                status: 'confirmed',
                metadata: {
                    recipient,
                    amount,
                    token: token.symbol,
                    chain: chain.id,
                    walletLabel: activeAccount?.label,
                    walletSource: activeAccount?.source,
                },
            });

            const url = explorerTxUrl(chain, hash, isMainnet);
            toast.success(
                <div>
                    <p className="font-semibold">Sent {amount} {token.symbol}</p>
                    <p className="text-xs text-muted-foreground">to {recipient.slice(0, 10)}… on {chain.name}</p>
                    {url && <a href={url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-primary underline">View on explorer →</a>}
                </div>
            );
            setMood('happy');
            setTimeout(() => { setIsOpen(false); reset(); }, 700);
            wdk.refreshBalances();
        } catch (e: any) {
            console.error('[Send] Error:', e);
            toast.error(e?.shortMessage || e?.message || 'Transaction failed');
            flash('error');
        } finally {
            setSending(false);
        }
    };

    const title = step === 'chain' ? 'Send' : step === 'token' ? `Send on ${chain?.name}` : `Send ${token?.symbol}`;
    const subtitle = step === 'chain' ? 'Choose the network to send from' : step === 'token' ? 'Pick a token' : `On ${chain?.name}`;

    return (
        <Dialog open={isOpen} onOpenChange={o => { setIsOpen(o); if (!o) reset(); }}>
            <DialogTrigger asChild>
                {children ?? (
                    <button className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/[0.05] bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.06]">
                        <ArrowUpRight className="h-5 w-5 text-primary transition-transform group-hover:scale-110" />
                        <span className="text-sm font-medium text-foreground">Send</span>
                    </button>
                )}
            </DialogTrigger>

            <DialogContent className="lg-panel w-[calc(100vw-24px)] max-w-md gap-0 overflow-hidden rounded-xl bg-transparent p-0">
                {/* Header with Cham */}
                <div className="flex items-start gap-3 border-b border-white/[0.07] p-4 pr-12">
                    {step !== 'chain' && (
                        <button onClick={back} aria-label="Back" className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white">
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                    )}
                    <div className="min-w-0 flex-1">
                        <DialogTitle className="text-base font-semibold text-white">{title}</DialogTitle>
                        <DialogDescription className="mt-0.5 truncate text-xs text-white/50">{subtitle}</DialogDescription>
                    </div>
                    <Chameleon size={56} mood={mood} tone={chain?.color} className="-mt-1 shrink-0 text-white/30" />
                </div>

                {/* Step ticks */}
                <div className="flex gap-1 px-4 pt-3">
                    {STEPS.map((s, i) => (
                        <div key={s} className={cn('h-1 flex-1 rounded-full transition-colors', STEPS.indexOf(step) >= i ? 'bg-emerald-400' : 'bg-white/10')} />
                    ))}
                </div>

                <div className="max-h-[min(60vh,440px)] overflow-y-auto p-4 lg-scroll">
                    {/* STEP 1 — chain */}
                    {step === 'chain' && (
                        <div className="space-y-1.5">
                            {chains.length === 0 && <p className="py-8 text-center text-sm text-white/50">No networks available on this wallet.</p>}
                            {chains.map(c => (
                                <button key={c.id} onClick={() => { setChain(c); setStep('token'); }}
                                    className="group flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-left transition-all hover:bg-white/[0.05] active:scale-[0.99]">
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: `${c.color}1f`, boxShadow: `inset 0 0 0 1px ${c.color}44` }}>
                                        <img src={c.icon} alt="" className="h-5 w-5 object-contain" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-sm font-semibold text-white">{c.name}</span>
                                        <span className="block text-[11px] text-white/45">{c.sublabel}</span>
                                    </span>
                                    <ChevronRight className="h-4 w-4 text-white/25 transition-colors group-hover:text-white/60" />
                                </button>
                            ))}
                        </div>
                    )}

                    {/* STEP 2 — token */}
                    {step === 'token' && (
                        <div className="space-y-2">
                            {tokens.length > 4 && (
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
                                    <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search token" aria-label="Search token"
                                        className="lg-well h-9 w-full rounded-lg pl-8 pr-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/25" />
                                </div>
                            )}
                            {shownTokens.length === 0 ? (
                                <p className="py-8 text-center text-sm text-white/50">No tokens to send here.</p>
                            ) : shownTokens.map(t => {
                                const bal = balances[t.id];
                                return (
                                    <button key={t.id} onClick={() => { setToken(t); setStep('form'); }}
                                        className="group flex w-full items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-left transition-all hover:bg-white/[0.05] active:scale-[0.99]">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <img src={t.icon} alt="" className="h-8 w-8 shrink-0 rounded-full bg-white/5 p-1 object-contain" />
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold text-white">{t.name}</p>
                                                <p className="text-[11px] text-white/45">{t.symbol}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            {loadingBalances
                                                ? <span className="inline-block h-3.5 w-14 animate-pulse rounded bg-white/[0.07]" />
                                                : <p className="font-mono text-sm font-medium text-white">{fmtBal(bal)}</p>}
                                            <p className="text-[10px] text-white/40">Available</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* STEP 3 — form */}
                    {step === 'form' && token && chain && (
                        <div className="space-y-4">
                            <div className="lg-well flex items-center justify-between gap-3 rounded-xl p-3">
                                <div className="flex items-center gap-2.5">
                                    <img src={token.icon} alt="" className="h-7 w-7 object-contain" />
                                    <div>
                                        <p className="text-sm font-semibold text-white">{token.name}</p>
                                        <p className="text-[11px] text-white/45">{chain.name}</p>
                                    </div>
                                </div>
                                <span className="font-mono text-xs text-white/55">Bal: {fmtBal(selectedBalance)}</span>
                            </div>

                            {activeAccount && (
                                <div className="flex items-center gap-1.5 px-1 text-xs text-white/50">
                                    <span>From</span>
                                    <span className="font-semibold text-white/80">{activeAccount.label}</span>
                                    <span>·</span>
                                    <span className="font-mono text-white/60">
                                        {activeAccount.address.slice(0, 8)}…{activeAccount.address.slice(-6)}
                                    </span>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-white/55">Recipient address</label>
                                <Input placeholder={chain.recipientHint} value={recipient} onChange={e => setRecipient(e.target.value.trim())}
                                    className="lg-well h-10 border-0 font-mono text-xs text-white" />
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-medium text-white/55">Amount</label>
                                    {selectedBalance !== undefined && !Number.isNaN(selectedBalance) && (
                                        <button type="button" onClick={() => setAmount(String(selectedBalance))} className="text-xs font-semibold text-emerald-400 hover:text-emerald-300">
                                            Max ({fmtBal(selectedBalance)})
                                        </button>
                                    )}
                                </div>
                                <div className="relative">
                                    <Input type="number" step="any" placeholder="0.0" value={amount} onChange={e => setAmount(e.target.value)}
                                        className={cn('lg-well h-11 border-0 pr-16 font-mono text-base text-white', tooMuch && 'text-red-300')} />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-white/50">{token.symbol}</span>
                                </div>
                                {tooMuch && <p className="text-[11px] text-red-400">More than your balance.</p>}
                            </div>

                            <Button onClick={handleSend} disabled={sending || !recipient || !amount || parseFloat(amount) <= 0 || tooMuch}
                                className="h-12 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-base font-semibold text-[#04130b] hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50">
                                {sending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…</> : <><Wallet2 className="mr-2 h-4 w-4" /> Send {token.symbol}</>}
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
