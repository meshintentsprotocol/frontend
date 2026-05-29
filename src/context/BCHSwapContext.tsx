import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { notifyToast as toast } from '@/lib/notify-toast';
import { useBCHWallet } from './BCHWalletProvider';
import { useWDK } from '@/context/WDKProvider';
import { useConnection } from '@solana/wallet-adapter-react';
import { Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { BCHSwapParams, BCHSwapType, BCHOrder } from '@/types';
import { BCH_SOLANA_RELAYER_URL, CASHTOKEN_RELAYER_URL, CASHTOKEN_RELAYER_MAINNET_URL, SOL_BCH_ZK_SERVER_URL, SOL_BCH_ZK_SERVER_MAINNET_URL } from '@/lib/config';
import axios from 'axios';
import * as anchor from '@coral-xyz/anchor';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAccount } from '@solana/spl-token';
import idl from '@/lib/intent_swap_idl.json';
import {
    getStarkCovenantAddress,
    createEVMToBCHIntent,
    createBCHToEVMIntent,
    getOrder as getETHOrder,
    getSolverInfo,
    toWei,
    getRefundBCH,
    postRefundBCH,
} from '@/lib/bscBchApi';
import { createStarkEscrow, getEvmConfig } from '@/lib/intentHTLC';

// Lazy-loaded imports for CashScript (large bundle)
let cashscriptModule: any = null;
const getCashScript = async () => {
    if (!cashscriptModule) {
        cashscriptModule = await import('cashscript');
    }
    return cashscriptModule;
};

// ============================================================================
// Constants
// ============================================================================
const getOrdersKey = (network: string) => `bch_orders_${network}`;
const SOLANA_PROGRAM_ID = 'G3F8TFjuxCAkTv8zZcPLJWmeAabTx7pasgmePcJa4pEL';

// ============================================================================
// Context Type
// ============================================================================
interface BCHSwapContextType {
    isLoading: boolean;
    swapStep: string;  // Current step description for UI feedback
    pendingOrders: BCHOrder[];
    completedOrders: BCHOrder[];
    executeSwap: (params: BCHSwapParams, recipientAddress: string) => Promise<void>;
    claimOrder: (orderId: string) => Promise<void>;
    requestRefund: (orderId: string) => Promise<void>;
    refreshOrders: () => Promise<void>;
    detectSwapType: (sellChain?: string, buyChain?: string) => BCHSwapType;
}

export const BCHSwapContext = createContext<BCHSwapContextType | undefined>(undefined);

// ============================================================================
// Provider
// ============================================================================
export function BCHSwapProvider({ children }: { children: ReactNode }) {
    const bchWallet = useBCHWallet();
    const wdk = useWDK();
    const { connection: solanaConnection } = useConnection();

    // Build a wallet-adapter-compatible signer from the WDK Solana keypair.
    // This replaces the external Solana wallet adapter for all signing operations.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const solanaWallet: any = (() => {
        if (!wdk.solanaSigner?.secretKey || !wdk.solanaAddress) return null;
        const keypair = Keypair.fromSecretKey(wdk.solanaSigner.secretKey);
        const publicKey = new PublicKey(wdk.solanaAddress);
        return {
            publicKey,
            signTransaction: async (tx: any) => { tx.partialSign(keypair); return tx; },
            signAllTransactions: async (txs: any[]) => txs.map(tx => { tx.partialSign(keypair); return tx; }),
            sendTransaction: async (tx: any, connection: any) => {
                if (!tx.recentBlockhash) {
                    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
                }
                if (!tx.feePayer) tx.feePayer = publicKey;
                tx.sign(keypair);
                return connection.sendRawTransaction(tx.serialize());
            },
        };
    })();

    // Mutable refs so stale useCallback closures always read current wallet state
    const wdkRef = useRef(wdk);
    wdkRef.current = wdk;
    const bchWalletRef = useRef(bchWallet);
    bchWalletRef.current = bchWallet;
    const solanaWalletRef = useRef(solanaWallet);
    solanaWalletRef.current = solanaWallet;
    const [isLoading, setIsLoading] = useState(false);
    const [swapStep, setSwapStep] = useState('');
    const [pendingOrders, setPendingOrders] = useState<BCHOrder[]>([]);
    const [completedOrders, setCompletedOrders] = useState<BCHOrder[]>([]);

    // Load orders from localStorage — keyed per network so mainnet/chipnet stay separate
    useEffect(() => {
        try {
            const key = getOrdersKey(wdk.bchNetwork);
            const saved = localStorage.getItem(key);
            if (saved) {
                const all: BCHOrder[] = JSON.parse(saved);
                setPendingOrders(all.filter(o => o.status === 'pending' || o.status === 'claimable'));
                setCompletedOrders(all.filter(o => o.status !== 'pending' && o.status !== 'claimable'));
            } else {
                setPendingOrders([]);
                setCompletedOrders([]);
            }
        } catch { /* ignore */ }
    }, [wdk.bchNetwork]);

    // =========================================================================
    // Helpers
    // =========================================================================
    const saveOrder = (order: BCHOrder) => {
        try {
            const key = getOrdersKey(wdkRef.current.bchNetwork);
            const saved = localStorage.getItem(key);
            const all: BCHOrder[] = saved ? JSON.parse(saved) : [];
            all.unshift(order);
            if (all.length > 50) all.pop();
            localStorage.setItem(key, JSON.stringify(all));
            if (order.status === 'pending') {
                setPendingOrders(prev => [order, ...prev]);
            } else {
                setCompletedOrders(prev => [order, ...prev]);
            }
        } catch { /* ignore */ }
    };

    const generateHashlock = async () => {
        const secretBytes = crypto.getRandomValues(new Uint8Array(32));
        const hashBuffer = await crypto.subtle.digest('SHA-256', secretBytes);
        const hashlockArray = new Uint8Array(hashBuffer);
        const secretHex = Array.from(secretBytes).map(b => b.toString(16).padStart(2, '0')).join('');
        const hashlockHex = Array.from(hashlockArray).map(b => b.toString(16).padStart(2, '0')).join('');
        return { secretBytes, secretHex, hashlockHex, hashlockArray };
    };

    const detectSwapType = useCallback((sellChain?: string, buyChain?: string): BCHSwapType => {
        if (sellChain === 'bch' && buyChain === 'bch') return 'same-chain';
        if (sellChain === 'bch' && buyChain === 'solana') return 'bch-to-sol';
        if (sellChain === 'solana' && buyChain === 'bch') return 'sol-to-bch';
        if (sellChain === 'bch' && buyChain === 'movement') return 'bch-to-mov';
        if (sellChain === 'movement' && buyChain === 'bch') return 'mov-to-bch';
        if (sellChain === 'bch' && buyChain === 'xmr') return 'bch-to-xmr';
        if (sellChain === 'xmr' && buyChain === 'bch') return 'xmr-to-bch';
        if (sellChain === 'eth' && buyChain === 'bch') return 'eth-to-bch';
        if (sellChain === 'bch' && buyChain === 'eth') return 'bch-to-eth';
        return 'same-chain';
    }, []);

    // =========================================================================
    // BCH → Solana: ZK-only path via sol-bch-zk-server (no HTLC)
    //   1. POST /swap/bch-to-sol — solver pre-signs SOL tx, returns bchCovenantAddr
    //   2. Fund P2SH32 covenant via TransactionBuilder + raw lockingBytecode
    //   3. Relayer detects funding, broadcasts SOL tx, generates FRI proof, claims BCH
    // =========================================================================
    const executeBCHToSolana = async (params: BCHSwapParams, recipientSolAddress: string) => {
        const currentBchWallet = bchWalletRef.current;
        if (!currentBchWallet.address) throw new Error('Connect your BCH wallet first');
        if (!recipientSolAddress) throw new Error('Solana recipient address required');

        const wif = currentBchWallet.getWIF();
        if (!wif) throw new Error('Cannot sign: WIF not available — please reconnect your BCH wallet');

        const isMainnet = wdkRef.current.bchNetwork === 'mainnet';
        const lamports = Math.floor(params.buyAmount * Math.pow(10, params.buyToken.decimals || 9));

        // CashToken → SOL when the BCH-side token carries a CashToken category id.
        // Native BCH otherwise. For a CashToken covenant the swapped value lives
        // in bchToken.amount, but the covenant UTXO still needs enough BCH to
        // cover the solver's FRI claim fee (~5000 sats) — fund it with
        // COVENANT_FUND_SATS, not bare token-dust.
        const bchToken = params.sellToken.categoryId
            ? {
                category: params.sellToken.categoryId,
                amount:   String(Math.floor(params.sellAmount * Math.pow(10, params.sellToken.decimals || 0))),
            }
            : undefined;
        const TOKEN_DUST = 1000;          // dust for a plain token-change output
        const COVENANT_FUND_SATS = 8000;  // sats the covenant UTXO carries (≥ FRI claim fee + dust)
        const sats = bchToken ? COVENANT_FUND_SATS : Math.floor(params.sellAmount * 1e8);

        // Solana leg delivers USDC (SPL) when the buy token is a non-SOL
        // Solana token; the solver handles the SPL transfer server-side.
        const buyTokenMint = (params.buyToken.chain === 'solana'
            && params.buyToken.symbol !== 'SOL'
            && params.buyToken.address)
            ? params.buyToken.address
            : undefined;

        // 1. Create intent — solver pre-signs the Solana payment (~1-2s, live devnet)
        const buyLabel = buyTokenMint ? params.buyToken.symbol : 'SOL';
        setSwapStep(`Creating ZK swap intent (${bchToken ? 'CashToken' : 'BCH'} → ${buyLabel})...`);

        const payload = {
            makerAddress:     currentBchWallet.address,
            recipientAddress: recipientSolAddress,
            sellAmount:       String(sats),
            buyAmount:        String(lamports),
            sourceTimelock:   Math.floor(Date.now() / 1000) + 3600,
            ...(bchToken ? { bchToken } : {}),
            ...(buyTokenMint ? { buyToken: buyTokenMint } : {}),
        };
        console.log('[BCH→SOL ZK] Payload:', payload);

        // Client-side pre-flight — tell the user which specific field is missing
        for (const [k, v] of Object.entries(payload)) {
            if (!v) throw new Error(`Missing required field for ZK swap: ${k}`);
        }

        const zkUrl = isMainnet ? SOL_BCH_ZK_SERVER_MAINNET_URL : SOL_BCH_ZK_SERVER_URL;
        const networkQuery = isMainnet ? '?network=mainnet' : '';

        let covenantAddr: string;
        let covenantTokenAddr: string;
        let intentId: string;
        try {
            const { data } = await axios.post(`${zkUrl}/swap/bch-to-sol${networkQuery}`, payload);
            const intent = data.intent;
            if (!intent?.id || !intent?.bchCovenantAddr) {
                throw new Error('ZK server did not return covenant address');
            }
            covenantAddr      = intent.bchCovenantAddr;
            covenantTokenAddr = intent.bchCovenantTokenAddr || intent.bchCovenantAddr;
            intentId          = intent.id;
            console.log('[BCH→SOL ZK] Covenant:', covenantAddr, bchToken ? `(token: ${covenantTokenAddr})` : '');
        } catch (e: any) {
            throw new Error(`ZK server error: ${e.response?.data?.error || e.message}`);
        }

        // 2. Fund the P2SH32 covenant. Native BCH funds the plain address; a
        //    CashToken covenant funds the token-aware address with a token rider.
        setSwapStep(`Funding ${bchToken ? 'CashToken' : 'BCH'} ZK covenant...`);
        let fundTxId: string;
        try {
            const { TransactionBuilder, ElectrumNetworkProvider, SignatureTemplate } = await getCashScript();
            const provider = new ElectrumNetworkProvider(isMainnet ? 'mainnet' : 'chipnet');
            const allUtxos = await provider.getUtxos(currentBchWallet.address!);
            const sigTemplate = new SignatureTemplate(wif);
            const fee = 1000n;
            const builder = new TransactionBuilder({ provider });

            if (!bchToken) {
                // ── Native-BCH covenant ─────────────────────────────────────
                const { cashAddressToLockingBytecode } = await import('@bitauth/libauth');
                const lockResult = cashAddressToLockingBytecode(covenantAddr);
                if (typeof lockResult === 'string') throw new Error(`Invalid covenant address: ${lockResult}`);
                const bchUtxos = allUtxos.filter((u: any) => !u.token);
                if (!bchUtxos.length) throw new Error('No plain BCH UTXOs available — fund your wallet or consolidate UTXOs first');
                const amountSats = BigInt(sats);
                const totalInput = bchUtxos.reduce((acc: bigint, u: any) => acc + u.satoshis, 0n);
                const change = totalInput - amountSats - fee;
                if (change < 0n) throw new Error('Insufficient BCH balance');
                builder.addInputs(bchUtxos, sigTemplate.unlockP2PKH());
                builder.addOutput({ to: lockResult.bytecode, amount: amountSats });
                if (change >= 546n) builder.addOutput({ to: currentBchWallet.address!, amount: change });
            } else {
                // ── CashToken covenant ──────────────────────────────────────
                const dust = BigInt(TOKEN_DUST);
                const tokAmount = BigInt(bchToken.amount);
                const tokenUtxos = allUtxos.filter(
                    (u: any) => u.token && u.token.category === bchToken.category && !u.token.nft,
                ).sort((a: any, b: any) => Number(BigInt(b.token.amount) - BigInt(a.token.amount)));
                const bchUtxos = allUtxos.filter((u: any) => !u.token)
                    .sort((a: any, b: any) => Number(b.satoshis - a.satoshis));

                const selected: any[] = [];
                let tokAcc = 0n, satAcc = 0n;
                for (const u of tokenUtxos) {
                    selected.push(u); tokAcc += BigInt(u.token.amount); satAcc += u.satoshis;
                    if (tokAcc >= tokAmount) break;
                }
                if (tokAcc < tokAmount) throw new Error(`Insufficient ${params.sellToken.symbol} balance`);
                const tokenChange = tokAcc - tokAmount;
                const covenantSats = BigInt(sats);   // COVENANT_FUND_SATS — covers the solver's FRI claim fee
                const satsNeeded = covenantSats + (tokenChange > 0n ? dust : 0n) + fee;
                for (const u of bchUtxos) {
                    if (satAcc >= satsNeeded) break;
                    selected.push(u); satAcc += u.satoshis;
                }
                if (satAcc < satsNeeded) throw new Error('Insufficient BCH balance to cover token covenant fees');

                // Token change must return to a token-aware address — convert
                // the user's plain cashaddr to its p2pkhWithTokens form.
                const { cashAddressToLockingBytecode, lockingBytecodeToCashAddress } = await import('@bitauth/libauth');
                const selfDecoded = cashAddressToLockingBytecode(currentBchWallet.address!);
                if (typeof selfDecoded === 'string') throw new Error(`Invalid wallet address: ${selfDecoded}`);
                const selfTokenAddr = lockingBytecodeToCashAddress({
                    bytecode: selfDecoded.bytecode,
                    prefix: (isMainnet ? 'bitcoincash' : 'bchtest') as any,
                    tokenSupport: true,
                });
                if (typeof selfTokenAddr === 'string') throw new Error(`Cannot derive token address: ${selfTokenAddr}`);

                builder.addInputs(selected, sigTemplate.unlockP2PKH());
                builder.addOutput({
                    to: covenantTokenAddr,
                    amount: covenantSats,
                    token: { category: bchToken.category, amount: tokAmount },
                });
                let bchChange = satAcc - covenantSats - fee;
                if (tokenChange > 0n) {
                    builder.addOutput({
                        to: selfTokenAddr.address,
                        amount: dust,
                        token: { category: bchToken.category, amount: tokenChange },
                    });
                    bchChange -= dust;
                }
                if (bchChange >= 546n) builder.addOutput({ to: currentBchWallet.address!, amount: bchChange });
            }

            const tx = await builder.send();
            fundTxId = tx.txid;
            console.log('[BCH→SOL ZK] Covenant funded:', fundTxId);
            toast.success(`${bchToken ? params.sellToken.symbol : 'BCH'} locked in ZK covenant!`, { description: `Tx: ${fundTxId.slice(0, 16)}...` });
        } catch (e: any) {
            throw new Error(`Failed to fund BCH covenant: ${e.message}`);
        }

        const order: BCHOrder = {
            id:               intentId,
            swapType:         'bch-to-sol',
            orderType:        params.orderType,
            sellToken:        params.sellToken,
            buyToken:         params.buyToken,
            sellAmount:       params.sellAmount,
            buyAmount:        params.buyAmount,
            status:           'pending',
            contractAddress:  covenantAddr,
            txid:             fundTxId,
            intentId,
            explorerUrl: isMainnet
                ? `https://blockchair.com/bitcoin-cash/transaction/${fundTxId}`
                : `https://chipnet.chaingraph.cash/tx/${fundTxId}`,
            createdAt:   Date.now(),
            claimData:   { direction: 'BCH_TO_SOL' },
        };

        saveOrder(order);
        setSwapStep('');
        toast.success('ZK swap initiated!', {
            description: 'The solver will deliver SOL and claim your BCH covenant automatically via FRI proof.',
        });
    };

    // =========================================================================
    // Solana → BCH: Trustless ZK path via Solana FRI escrow
    //   1. POST /swap/sol-to-bch — solver pre-signs BCH tx, returns FRI escrow PDA
    //   2. User calls lock_sol_fri — SOL locked on-chain in Solana FRI escrow
    //   3. Solver detects funding, broadcasts BCH tx, generates FRI proof, claims SOL
    // =========================================================================
    const executeSolanaToBCH = async (params: BCHSwapParams, recipientBCHAddress: string) => {
        const sw = solanaWalletRef.current;
        if (!sw?.publicKey) throw new Error('Connect your WDK wallet first');
        if (!recipientBCHAddress) throw new Error('BCH recipient address required');

        const lamports = Math.floor(params.sellAmount * Math.pow(10, params.sellToken.decimals || 9));

        // USDC → * when the Solana-side sell token is a non-SOL Solana token.
        // The user then locks USDC via lock_token_fri instead of lock_sol_fri.
        const sellTokenMint = (params.sellToken.chain === 'solana'
            && params.sellToken.symbol !== 'SOL'
            && params.sellToken.address)
            ? params.sellToken.address
            : undefined;

        // SOL → CashToken when the BCH-side token carries a CashToken category.
        // The solver delivers the token; the BCH leg only moves token-dust sats.
        const bchToken = params.buyToken.categoryId
            ? {
                category: params.buyToken.categoryId,
                amount:   String(Math.floor(params.buyAmount * Math.pow(10, params.buyToken.decimals || 0))),
            }
            : undefined;
        const sats = bchToken ? 1000 : Math.floor(params.buyAmount * 1e8);
        const isMainnet = wdkRef.current.bchNetwork === 'mainnet';

        // A CashToken can only be delivered to a token-aware address — convert
        // the user's plain cashaddr to its p2pkhWithTokens form when needed.
        let deliveryAddress = recipientBCHAddress;
        if (bchToken) {
            const { cashAddressToLockingBytecode, lockingBytecodeToCashAddress } = await import('@bitauth/libauth');
            const decoded = cashAddressToLockingBytecode(recipientBCHAddress);
            if (typeof decoded === 'string') throw new Error(`Invalid BCH recipient address: ${decoded}`);
            const tokenAddr = lockingBytecodeToCashAddress({
                bytecode: decoded.bytecode,
                prefix: (isMainnet ? 'bitcoincash' : 'bchtest') as any,
                tokenSupport: true,
            });
            if (typeof tokenAddr === 'string') throw new Error(`Cannot derive token address: ${tokenAddr}`);
            deliveryAddress = tokenAddr.address;
        }
        const zkUrl = isMainnet ? SOL_BCH_ZK_SERVER_MAINNET_URL : SOL_BCH_ZK_SERVER_URL;
        const networkQuery = isMainnet ? '?network=mainnet' : '';

        // 1. Create intent — server pre-signs BCH payment and returns FRI escrow info
        setSwapStep('Creating ZK swap intent (server pre-signing BCH delivery)...');
        let escrowPDA: string;
        let bchTxSigHash: string;
        let programHash: string;
        let taker: string;
        let intentId: string;
        let intentTimelock: number;
        let resolvedProgramId: string = SOLANA_PROGRAM_ID;
        try {
            const { data } = await axios.post(`${zkUrl}/swap/sol-to-bch${networkQuery}`, {
                makerAddress:     sw.publicKey.toBase58(),
                recipientAddress: deliveryAddress,
                sellAmount:       String(lamports),
                buyAmount:        String(sats),
                sourceTimelock:   Math.floor(Date.now() / 1000) + 3600,
                ...(bchToken ? { bchToken } : {}),
                ...(sellTokenMint ? { sellToken: sellTokenMint } : {}),
            });
            if (!data.escrow?.pda || !data.intent?.id) {
                throw new Error('ZK server did not return FRI escrow info');
            }
            escrowPDA      = data.escrow.pda;
            bchTxSigHash   = data.escrow.bchTxSigHash;
            programHash    = data.escrow.programHash;
            taker          = data.escrow.taker;
            intentId       = data.intent.id;
            intentTimelock = data.escrow.timelock || Math.floor(Date.now() / 1000) + 3600;
            // Server returns the program ID for the active network (devnet/mainnet) so the
            // frontend doesn't need to hardcode it per environment.
            if (data.escrow.programId) resolvedProgramId = data.escrow.programId;
            console.log('[SOL→BCH ZK] FRI escrow PDA:', escrowPDA);
            console.log('[SOL→BCH ZK] bchTxSigHash:', bchTxSigHash);
            console.log('[SOL→BCH ZK] programId:', resolvedProgramId);
        } catch (e: any) {
            throw new Error(`ZK server error: ${e.response?.data?.error || e.message}`);
        }

        // 2. Lock funds in the Solana FRI escrow.
        //    Native SOL → lock_sol_fri;  USDC (SPL) → lock_token_fri.
        const lockKind = sellTokenMint ? 'USDC' : 'SOL';
        setSwapStep(`Locking ${lockKind} in Solana FRI escrow...`);
        let lockTxSig: string;
        try {
            const programId    = new PublicKey(resolvedProgramId);
            const takerPubkey  = new PublicKey(taker);
            const escrowPubkey = new PublicKey(escrowPDA);

            // Anchor discriminator = sha256("global:<ix_name>")[0..8]
            const ixName = sellTokenMint ? 'global:lock_token_fri' : 'global:lock_sol_fri';
            const hashBuf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ixName) as unknown as BufferSource);
            const discriminator = new Uint8Array(hashBuf).slice(0, 8);

            // Borsh-serialize instruction args (identical for SOL + token locks)
            const timelockBuf = Buffer.alloc(8); timelockBuf.writeBigInt64LE(BigInt(intentTimelock));
            const amountBuf   = Buffer.alloc(8); amountBuf.writeBigUInt64LE(BigInt(lamports));
            const ixData = Buffer.concat([
                Buffer.from(discriminator),
                Buffer.from(bchTxSigHash, 'hex'),
                Buffer.from(programHash, 'hex'),
                timelockBuf,
                amountBuf,
            ]);

            let ix: anchor.web3.TransactionInstruction;
            if (!sellTokenMint) {
                ix = new anchor.web3.TransactionInstruction({
                    programId,
                    keys: [
                        { pubkey: sw.publicKey,            isSigner: true,  isWritable: true  },
                        { pubkey: takerPubkey,             isSigner: false, isWritable: false },
                        { pubkey: escrowPubkey,            isSigner: false, isWritable: true  },
                        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                    ],
                    data: ixData,
                });
            } else {
                // lock_token_fri — accounts per the intent_swap IDL.
                const { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } = await import('@solana/spl-token');
                const { SYSVAR_RENT_PUBKEY } = await import('@solana/web3.js');
                const mint            = new PublicKey(sellTokenMint);
                const makerTokenAcct  = getAssociatedTokenAddressSync(mint, sw.publicKey);
                const [friVault]      = PublicKey.findProgramAddressSync(
                    [new TextEncoder().encode('fri_vault'), escrowPubkey.toBuffer()], programId,
                );
                ix = new anchor.web3.TransactionInstruction({
                    programId,
                    keys: [
                        { pubkey: sw.publicKey,            isSigner: true,  isWritable: true  },
                        { pubkey: takerPubkey,             isSigner: false, isWritable: false },
                        { pubkey: mint,                    isSigner: false, isWritable: false },
                        { pubkey: escrowPubkey,            isSigner: false, isWritable: true  },
                        { pubkey: makerTokenAcct,          isSigner: false, isWritable: true  },
                        { pubkey: friVault,                isSigner: false, isWritable: true  },
                        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                        { pubkey: TOKEN_PROGRAM_ID,        isSigner: false, isWritable: false },
                        { pubkey: SYSVAR_RENT_PUBKEY,      isSigner: false, isWritable: false },
                    ],
                    data: ixData,
                });
            }

            const tx = new Transaction().add(ix);
            lockTxSig = await sw.sendTransaction(tx, solanaConnection);
            console.log(`[SOL→BCH ZK] ${lockKind} locked in FRI escrow:`, lockTxSig);
            toast.success(`${lockKind} locked in FRI escrow!`, { description: `Tx: ${lockTxSig.slice(0, 16)}...` });
        } catch (e: any) {
            throw new Error(`Failed to lock ${lockKind} in FRI escrow: ${e.message}`);
        }

        const order: BCHOrder = {
            id:              intentId,
            swapType:        'sol-to-bch',
            orderType:       params.orderType,
            sellToken:       params.sellToken,
            buyToken:        params.buyToken,
            sellAmount:      params.sellAmount,
            buyAmount:       params.buyAmount,
            status:          'pending',
            contractAddress: escrowPDA,
            txid:            lockTxSig,
            intentId,
            explorerUrl: `https://explorer.solana.com/tx/${lockTxSig}?cluster=devnet`,
            createdAt:   Date.now(),
            claimData:   { direction: 'SOL_TO_BCH' },
        };

        saveOrder(order);
        setSwapStep('');
        toast.success('ZK swap initiated!', {
            description: 'SOL locked in FRI escrow. Solver will deliver BCH and claim SOL via FRI proof automatically.',
        });
    };

    // =========================================================================
    // Same-chain BCH swap — Deploy CashToken covenant via relayer API
    // =========================================================================
    const executeSameChainSwap = async (params: BCHSwapParams) => {
        const currentBchWallet = bchWalletRef.current;
        if (!currentBchWallet.address) {
            throw new Error('Connect your BCH wallet first');
        }

        const isMainnet = wdkRef.current.bchNetwork === 'mainnet';
        const relayerUrl = isMainnet ? CASHTOKEN_RELAYER_MAINNET_URL : CASHTOKEN_RELAYER_URL;

        setSwapStep(`Creating intent on CashToken relayer (${isMainnet ? 'mainnet' : 'chipnet'})...`);

        // Determine token category IDs
        const sellCategoryId = params.sellToken.categoryId || (params.sellToken.chain === 'bch' && params.sellToken.symbol !== 'BCH' ? params.sellToken.categoryId : 'BCH');
        const buyCategoryId = params.buyToken.categoryId || (params.buyToken.chain === 'bch' && params.buyToken.symbol !== 'BCH' ? params.buyToken.categoryId : 'BCH');

        // Convert amounts to satoshis / token base units
        const sellBaseUnits = Math.floor(params.sellAmount * Math.pow(10, params.sellToken.decimals || 0));
        const buyBaseUnits = Math.floor(params.buyAmount * Math.pow(10, params.buyToken.decimals || 0));

        try {
            const response = await axios.post(`${relayerUrl}/intent/create`, {
                makerAddress: currentBchWallet.address,
                sellToken: sellCategoryId || 'BCH',
                buyToken: buyCategoryId || 'BCH',
                sellAmount: sellBaseUnits.toString(),
                buyAmount: buyBaseUnits.toString(),
                orderType: params.orderType === 'limit' ? 'limit' : 'dutch',
                duration: params.duration || 3600,
                expiryTime: params.expiryTime || Math.floor(Date.now() / 1000) + 3600,
                network: isMainnet ? 'mainnet' : 'chipnet',
            });

            const data = response.data;

            // 2. Fund the contract address via TransactionBuilder (avoids mainnet-js
            //    creating a competing Electrum connection that races with existing ones)
            setSwapStep('Signing funding transaction...');
            let fundTxId: string;

            const wif = currentBchWallet.getWIF();
            if (!wif) throw new Error('WIF not available — please reconnect your BCH wallet');

            {
                const { TransactionBuilder, ElectrumNetworkProvider, SignatureTemplate } = await getCashScript();
                const provider = new ElectrumNetworkProvider(isMainnet ? 'mainnet' : 'chipnet');

                const allUtxos = await provider.getUtxos(currentBchWallet.address!);
                if (!allUtxos.length) throw new Error('No BCH UTXOs found — fund your wallet first');

                const sigTemplate = new SignatureTemplate(wif);
                const builder = new TransactionBuilder({ provider });

                const isTokenSell = !!sellCategoryId && sellCategoryId !== 'BCH';
                let fee = 1000n;

                if (isTokenSell) {
                    // Token sell: pick token UTXOs of this category + BCH UTXOs for fees
                    const tokenUtxos = allUtxos.filter((u: any) =>
                        u.token?.category === sellCategoryId
                    );
                    const bchUtxos = allUtxos.filter((u: any) => !u.token);
                    if (!tokenUtxos.length) throw new Error(`No ${sellCategoryId} token UTXOs in wallet`);

                    const totalTokenIn = tokenUtxos.reduce(
                        (s: bigint, u: any) => s + BigInt(u.token!.amount), 0n
                    );
                    if (totalTokenIn < BigInt(sellBaseUnits)) {
                        throw new Error(`Insufficient token balance: have ${totalTokenIn}, need ${sellBaseUnits}`);
                    }
                    const totalTokenSats = tokenUtxos.reduce(
                        (s: bigint, u: any) => s + BigInt(u.satoshis), 0n
                    );

                    builder.addInputs(tokenUtxos, sigTemplate.unlockP2PKH());
                    // Check if token UTXOs alone cover dust + fee + token change dust
                    let bchIn = 0n;
                    const selectedBch: any[] = [];
                    const baseFee = BigInt(tokenUtxos.length * 150 + 250);
                    const baseNeed = 1000n + baseFee + 1000n;

                    if (totalTokenSats < baseNeed) {
                        // Need additional BCH inputs
                        const sortedBch = [...bchUtxos].sort(
                            (a: any, b: any) => Number(BigInt(b.satoshis) - BigInt(a.satoshis))
                        );
                        
                        for (const u of sortedBch) {
                            selectedBch.push(u);
                            bchIn += BigInt(u.satoshis);
                            const dynamicFee = BigInt((tokenUtxos.length + selectedBch.length) * 150 + 250);
                            const needSats = 1000n + dynamicFee + 1000n;
                            if (totalTokenSats + bchIn >= needSats) {
                                fee = dynamicFee;
                                break;
                            }
                        }
                    } else {
                        fee = baseFee;
                    }
                    
                    const finalNeed = 1000n + fee + 1000n;
                    if (totalTokenSats + bchIn < finalNeed) {
                        throw new Error('Insufficient BCH for token transfer fees');
                    }
                    if (selectedBch.length > 0) {
                        builder.addInputs(selectedBch, sigTemplate.unlockP2PKH());
                    }

                    // Output 0: token dust to contract
                    builder.addOutput({
                        to: data.tokenAddress,
                        amount: 1000n,
                        token: { category: sellCategoryId, amount: BigInt(sellBaseUnits) },
                    });

                    // Output 1: token change back to user (if any).
                    // CashScript rejects token outputs to non-token addresses (q-prefix),
                    // so the change MUST go to the token-aware z-prefix address.
                    const tokenChange = totalTokenIn - BigInt(sellBaseUnits);
                    let satChangeRemaining = totalTokenSats + bchIn - 1000n - fee;
                    if (tokenChange > 0n) {
                        const tokenChangeAddr = currentBchWallet.tokenAddress || currentBchWallet.address!;
                        const tokenChangeSats = satChangeRemaining > 1000n ? 1000n : satChangeRemaining;
                        builder.addOutput({
                            to: tokenChangeAddr,
                            amount: tokenChangeSats,
                            token: { category: sellCategoryId, amount: tokenChange },
                        });
                        satChangeRemaining -= tokenChangeSats;
                    }
                    // Output 2: BCH change
                    if (satChangeRemaining >= 546n) {
                        builder.addOutput({ to: currentBchWallet.address!, amount: satChangeRemaining });
                    }
                } else {
                    // BCH sell: only use plain BCH UTXOs (no tokens) to avoid burning user tokens
                    const bchUtxos = allUtxos.filter((u: any) => !u.token);
                    if (!bchUtxos.length) throw new Error('No plain BCH UTXOs — consolidate or fund wallet');

                    const sortedBch = [...bchUtxos].sort((a: any, b: any) => Number(BigInt(b.satoshis) - BigInt(a.satoshis)));
                    const selectedBch = [];
                    let bchIn = 0n;
                    
                    for (const u of sortedBch) {
                        selectedBch.push(u);
                        bchIn += BigInt(u.satoshis);
                        const dynamicFee = BigInt(selectedBch.length * 150 + 250);
                        if (bchIn >= BigInt(sellBaseUnits) + dynamicFee) {
                            fee = dynamicFee;
                            break;
                        }
                    }
                    
                    if (bchIn < BigInt(sellBaseUnits) + fee) {
                        throw new Error('Insufficient BCH balance');
                    }

                    builder.addInputs(selectedBch, sigTemplate.unlockP2PKH());
                    builder.addOutput({ to: data.contractAddress, amount: BigInt(sellBaseUnits) });

                    const change = bchIn - BigInt(sellBaseUnits) - fee;
                    if (change >= 546n) builder.addOutput({ to: currentBchWallet.address!, amount: change });
                }

                setSwapStep(`Sending ${params.sellAmount} ${params.sellToken.symbol} to contract...`);
                const tx = await builder.send();
                fundTxId = tx.txid;
                console.log('[Same-chain] Contract funded:', fundTxId);
            }

            // Fallback explorer URL if relayer doesn't provide one
            const explorerUrl = data.explorerUrl || (data.contractAddress
                ? (isMainnet
                    ? `https://blockchair.com/bitcoin-cash/address/${data.contractAddress}`
                    : `https://chipnet.chaingraph.cash/address/${data.contractAddress}`)
                : undefined);

            const order: BCHOrder = {
                id: data.intentId || `bch_${Date.now()}`,
                swapType: 'same-chain',
                orderType: params.orderType,
                sellToken: params.sellToken,
                buyToken: params.buyToken,
                sellAmount: params.sellAmount,
                buyAmount: params.buyAmount,
                status: 'pending',
                contractAddress: data.contractAddress,
                tokenAddress: data.tokenAddress,
                intentId: data.intentId,
                txid: fundTxId,
                explorerUrl,
                createdAt: Date.now(),
                expiryTime: params.expiryTime,
                duration: params.duration,
            };

            saveOrder(order);
            setSwapStep('');
            toast.success(
                params.orderType === 'limit' ? 'Limit order created!' : 'Dutch auction created!',
                {
                    description: `Contract: ${data.contractAddress?.slice(0, 24)}...`,
                    action: explorerUrl ? {
                        label: 'View on Explorer',
                        onClick: () => window.open(explorerUrl, '_blank'),
                    } : undefined,
                }
            );

        } catch (e: any) {
            console.error('[Same-chain] Intent creation failed:', e);
            throw new Error(`CashToken relayer error: ${e.response?.data?.error || e.message}`);
        }
    };

    // =========================================================================
    // BCH → Movement: Deploy CrossChainHTLC covenant on BCH, notify relayer
    // =========================================================================
    const executeBCHToMovement = async (params: BCHSwapParams, recipientMovAddress: string) => {
        const currentBchWallet = bchWalletRef.current;
        if (!currentBchWallet.address) {
            throw new Error('BCH wallet not connected');
        }

        const { secretHex, hashlockHex, hashlockArray } = await generateHashlock();
        console.log('[BCH→MOV] Starting BCH to Movement swap');

        // 1. Get relayer BCH address
        setSwapStep('Getting relayer info...');
        let relayerBchAddress: string;
        try {
            const healthRes = await axios.get(`${BCH_SOLANA_RELAYER_URL}/orders`);
            const anyIntent = [...(healthRes.data.active || []), ...(healthRes.data.completed || [])]
                .find((i: any) => i.direction?.includes('BCH'));
            relayerBchAddress = anyIntent?.takerAddress || 'bchtest:qzufsn0wtcmc4lhc3s3trhl0nxn6dgkpmgvzngkxl7';
        } catch {
            relayerBchAddress = 'bchtest:qzufsn0wtcmc4lhc3s3trhl0nxn6dgkpmgvzngkxl7';
        }
        console.log('[BCH→MOV] Relayer BCH address:', relayerBchAddress);

        // 2. Deploy BCH HTLC (same pattern as BCH→SOL)
        setSwapStep('Deploying HTLC on BCH...');
        const { Contract, ElectrumNetworkProvider } = await getCashScript();
        const artifactModule = await import('@/lib/CrossChainHTLC.json');
        const artifact = artifactModule.default || artifactModule;
        const { cashAddressToLockingBytecode } = await import('@bitauth/libauth');

        const derivePkh = (address: string): Uint8Array => {
            const result = cashAddressToLockingBytecode(address);
            if (typeof result === 'string') throw new Error(`Invalid BCH address: ${result}`);
            const bytecode = result.bytecode;
            if (bytecode.length === 25 && bytecode[0] === 0x76 && bytecode[1] === 0xa9 && bytecode[2] === 0x14) {
                return bytecode.slice(3, 23);
            }
            throw new Error(`Not a standard P2PKH address`);
        };

        const userPkh = derivePkh(currentBchWallet.address);
        const relayerPkh = derivePkh(relayerBchAddress);
        const timelock = BigInt(Math.floor(Date.now() / 1000) + 7200);

        const bchNet = wdkRef.current.bchNetwork === 'mainnet' ? 'mainnet' : 'chipnet';
        const provider = new ElectrumNetworkProvider(bchNet);
        const contract = new Contract(
            artifact,
            [userPkh, relayerPkh, hashlockArray, timelock],
            { provider }
        );
        const contractAddress = contract.address;
        console.log('[BCH→MOV] HTLC address:', contractAddress);

        // 3. Fund HTLC (same pattern as BCH→SOL)
        setSwapStep('Signing BCH transaction...');
        let fundTxId: string;
        try {
            const amountSats = Math.floor(params.sellAmount * 1e8);
            const wif = currentBchWallet.getWIF();
            if (!wif) throw new Error('WIF not available — please reconnect your BCH wallet');

            const { TestNetWallet, Wallet } = await import('mainnet-js');
            const wallet = bchNet === 'mainnet' ? await Wallet.fromWIF(wif) : await TestNetWallet.fromWIF(wif);

            setSwapStep(`Sending ${params.sellAmount} BCH to HTLC...`);
            const tx = await wallet.send([{
                cashaddr: contractAddress,
                value: amountSats,
                unit: 'sat',
            } as any]);

            fundTxId = tx.txId as string;
            console.log('[BCH→MOV] HTLC funded:', fundTxId);
            toast.success('BCH locked in HTLC!', { description: `Tx: ${fundTxId.slice(0, 16)}...` });
        } catch (e: any) {
            throw new Error(`Failed to deploy BCH HTLC: ${e.message}`);
        }

        // 4. Notify relayer
        setSwapStep('Notifying relayer...');
        try {
            const response = await axios.post(`${BCH_SOLANA_RELAYER_URL}/swap/bch-to-move`, {
                makerAddress: currentBchWallet.address,
                recipientAddress: recipientMovAddress,
                sellAmount: Math.floor(params.sellAmount * 1e8).toString(),
                buyAmount: Math.floor(params.buyAmount * Math.pow(10, params.buyToken.decimals || 8)).toString(),
                hashlock: hashlockHex,
                bchContractAddress: contractAddress,
            });

            const intent = response.data.intent;
            const order: BCHOrder = {
                id: intent?.id || `bch_mov_${Date.now()}`,
                swapType: 'bch-to-mov',
                orderType: params.orderType,
                sellToken: params.sellToken,
                buyToken: params.buyToken,
                sellAmount: params.sellAmount,
                buyAmount: params.buyAmount,
                status: 'pending',
                contractAddress: contractAddress,
                txid: fundTxId,
                intentId: intent?.id,
                explorerUrl: `https://chipnet.chaingraph.cash/tx/${fundTxId}`,
                createdAt: Date.now(),
                claimData: {
                    hashlock: hashlockHex,
                    secret: secretHex,
                    bchContractAddress: contractAddress,
                    movementEscrowId: intent?.movementEscrowId,
                    direction: 'BCH_TO_MOV',
                },
            };

            saveOrder(order);
            setSwapStep('');
            toast.success('Cross-chain swap initiated!', {
                description: 'The relayer will fill your order on Movement.'
            });
        } catch (e: any) {
            throw new Error(`Relayer error: ${e.response?.data?.error || e.message}`);
        }
    };

    // =========================================================================
    // Movement → BCH: Notify relayer (Movement escrow created externally or via wallet)
    // =========================================================================
    const executeMovementToBCH = async (params: BCHSwapParams, recipientBCHAddress: string) => {
        // Movement wallet connection is handled by the main wallet context
        // The relayer handles the on-chain escrow detection
        const { secretHex, hashlockHex } = await generateHashlock();
        console.log('[MOV→BCH] Starting Movement to BCH swap');

        setSwapStep('Notifying relayer...');
        try {
            const response = await axios.post(`${BCH_SOLANA_RELAYER_URL}/swap/move-to-bch`, {
                makerAddress: 'movement-user', // Will be filled by Movement wallet
                recipientAddress: recipientBCHAddress,
                sellAmount: Math.floor(params.sellAmount * Math.pow(10, params.sellToken.decimals || 8)).toString(),
                buyAmount: Math.floor(params.buyAmount * 1e8).toString(),
                hashlock: hashlockHex,
                sourceEscrowId: `mov_escrow_${Date.now()}`, // Placeholder until on-chain escrow is implemented
            });

            const intent = response.data.intent;
            const order: BCHOrder = {
                id: intent?.id || `mov_bch_${Date.now()}`,
                swapType: 'mov-to-bch',
                orderType: params.orderType,
                sellToken: params.sellToken,
                buyToken: params.buyToken,
                sellAmount: params.sellAmount,
                buyAmount: params.buyAmount,
                status: 'pending',
                intentId: intent?.id,
                explorerUrl: intent?.movementEscrowId ? `https://explorer.movementnetwork.xyz/txn/${intent.movementEscrowId}?network=testnet` : undefined,
                createdAt: Date.now(),
                claimData: {
                    hashlock: hashlockHex,
                    secret: secretHex,
                    movementEscrowId: intent?.movementEscrowId,
                    direction: 'MOV_TO_BCH',
                },
            };

            saveOrder(order);
            setSwapStep('');
            toast.success('Cross-chain swap initiated!', {
                description: 'The relayer will fill your order on BCH.'
            });
        } catch (e: any) {
            throw new Error(`Relayer error: ${e.response?.data?.error || e.message}`);
        }
    };

    // =========================================================================
    // ETH → BCH: Create STARK escrow on Sepolia, notify bsc-bch-server (ZK, auto-complete)
    // =========================================================================
    const executeETHToBCH = async (params: BCHSwapParams, recipientAddress: string) => {
        const currentWdk = wdkRef.current;
        if (!currentWdk.isInitialized || !currentWdk.seedPhrase) throw new Error('Connect WDK wallet first');
        if (!recipientAddress) throw new Error('BCH recipient address required');

        // Derive EVM signer on-demand — handles case where session restore had an ethers init failure
        let evmSigner: any = currentWdk.evmSigner;
        if (!evmSigner) {
            const { HDNodeWallet } = await import('ethers');
            evmSigner = HDNodeWallet.fromPhrase(currentWdk.seedPhrase, undefined, "m/44'/60'/0'/0/0");
        }
        const makerEvmAddress: string = evmSigner.address;
        const isMainnet = currentWdk.bchNetwork === 'mainnet';

        setSwapStep('Fetching solver address...');
        const solverInfo = await getSolverInfo(isMainnet);
        const solverEvmAddr = solverInfo.wallets.evm.address;

        const now = Math.floor(Date.now() / 1000);
        const timelockDuration = params.orderType === 'limit' && params.expiryTime
            ? Math.max(params.expiryTime - now, 3600)
            : 3600;

        const tokenAddress = (params.sellToken.chain === 'eth' && params.sellToken.symbol !== 'ETH' && params.sellToken.symbol !== 'BNB' && params.sellToken.address)
            ? params.sellToken.address
            : '0x0000000000000000000000000000000000000000';

        const sellAmountWei = toWei(params.sellAmount.toString(), params.sellToken.decimals || 18);

        setSwapStep(`Creating STARK escrow on ${isMainnet ? 'BSC' : 'Sepolia'}...`);
        let starkEscrowId: string;
        try {
            starkEscrowId = await createStarkEscrow(
                evmSigner,
                solverEvmAddr,
                timelockDuration,
                tokenAddress,
                sellAmountWei,
                isMainnet,
            );
            toast.success('ETH locked in STARK escrow!', { description: `Escrow ID: ${starkEscrowId}` });
        } catch (e: any) {
            throw new Error(`STARK escrow failed: ${e.message}`);
        }

        setSwapStep('Notifying solver...');
        try {
            const buyAmountSats = Math.floor(params.buyAmount * 1e8).toString();
            const evmTokenAddress = (params.sellToken.chain === 'eth' && params.sellToken.symbol !== 'ETH' && params.sellToken.symbol !== 'BNB') ? params.sellToken.address : undefined;

            const { intentId } = await createEVMToBCHIntent({
                makerAddress: makerEvmAddress,
                recipientAddress,
                sellAmount: sellAmountWei,
                buyAmount: buyAmountSats,
                evmEscrowId: starkEscrowId,
                useStark: true,
                evmTokenAddress,
                expiryTime: params.orderType === 'limit' ? params.expiryTime : undefined,
            }, isMainnet);

            const order: BCHOrder = {
                id: intentId || `eth_bch_${Date.now()}`,
                swapType: 'eth-to-bch',
                orderType: params.orderType,
                sellToken: params.sellToken,
                buyToken: params.buyToken,
                sellAmount: params.sellAmount,
                buyAmount: params.buyAmount,
                status: 'pending',
                intentId,
                explorerUrl: `${getEvmConfig(isMainnet).explorerUrl}/address/${starkEscrowId}`,
                createdAt: Date.now(),
                claimData: { evmEscrowId: starkEscrowId, direction: 'ETH_TO_BCH' },
            };

            saveOrder(order);
            setSwapStep('');
            toast.success('ZK swap initiated!', {
                description: `Server fills BCH and claims ${isMainnet ? 'BSC' : 'ETH'} escrow via STARK proof automatically.`,
            });
        } catch (e: any) {
            throw new Error(`Solver error: ${e.message}`);
        }
    };

    // =========================================================================
    // BCH → ETH: Fund StarkVerifierFRIPhaseB P2SH32 covenant, notify bsc-bch-server (ZK, auto-complete)
    // =========================================================================
    const executeBCHToETH = async (params: BCHSwapParams, _recipientAddress: string) => {
        const currentBchWallet = bchWalletRef.current;
        const currentWdk = wdkRef.current;
        if (!currentBchWallet.address) throw new Error('Connect your BCH wallet first');
        if (!currentWdk.evmAddress) throw new Error('EVM address not available in WDK wallet');

        const wif = currentBchWallet.getWIF();
        if (!wif) throw new Error('Cannot sign: WIF not available');

        const isMainnet = currentWdk.bchNetwork === 'mainnet';

        // 1. Get per-user StarkVerifierFRIPhaseB covenant address (includes userPkh + timelock
        //    in the redeemScript so the OP_ELSE refund branch is tied to this user's key)
        setSwapStep('Fetching ZK covenant address...');
        const covenantTimelock = Math.floor(Date.now() / 1000) + 7200; // 2 hours from now
        const covenantInfo = await getStarkCovenantAddress(isMainnet, currentBchWallet.address!, covenantTimelock);
        const starkCovenantAddress = covenantInfo.address;
        console.log('[BCH→ETH] STARK covenant address:', starkCovenantAddress, 'timelock:', covenantTimelock);

        // 2. Fund the P2SH32 covenant using TransactionBuilder + raw lockingBytecode
        setSwapStep('Funding BCH ZK covenant...');
        let fundTxId: string;
        try {
            const { cashAddressToLockingBytecode } = await import('@bitauth/libauth');
            const lockResult = cashAddressToLockingBytecode(starkCovenantAddress);
            if (typeof lockResult === 'string') throw new Error(`Invalid covenant address: ${lockResult}`);
            const lockingBytecode = lockResult.bytecode;

            const { TransactionBuilder, ElectrumNetworkProvider, SignatureTemplate } = await getCashScript();
            const provider = new ElectrumNetworkProvider(isMainnet ? 'mainnet' : 'chipnet');

            const allUtxos = await provider.getUtxos(currentBchWallet.address!);
            const bchUtxos = allUtxos.filter((u: any) => !u.token);
            if (!bchUtxos.length) throw new Error('No plain BCH UTXOs available — fund your wallet or consolidate UTXOs first');

            const sigTemplate = new SignatureTemplate(wif);
            const amountSats = BigInt(Math.floor(params.sellAmount * 1e8));
            const fee = 1000n;
            const totalInput = bchUtxos.reduce((acc: bigint, u: any) => acc + u.satoshis, 0n);
            const change = totalInput - amountSats - fee;
            if (change < 0n) throw new Error('Insufficient BCH balance');

            const builder = new TransactionBuilder({ provider });
            builder.addInputs(bchUtxos, sigTemplate.unlockP2PKH());
            builder.addOutput({ to: lockingBytecode, amount: amountSats });
            if (change >= 546n) {
                builder.addOutput({ to: currentBchWallet.address!, amount: change });
            }

            const tx = await builder.send();
            fundTxId = tx.txid;
            console.log('[BCH→ETH] Covenant funded:', fundTxId);
            toast.success('BCH locked in ZK covenant!', { description: `Tx: ${fundTxId.slice(0, 16)}...` });
        } catch (e: any) {
            throw new Error(`Failed to fund BCH covenant: ${e.message}`);
        }

        // 3. Notify solver
        setSwapStep('Notifying solver...');
        try {
            const sellAmountSats = Math.floor(params.sellAmount * 1e8).toString();
            const buyAmountWei = toWei(params.buyAmount.toString(), params.buyToken.decimals || 18);
            const evmTokenAddress = (params.buyToken.chain === 'eth' && params.buyToken.symbol !== 'ETH' && params.buyToken.symbol !== 'BNB') ? params.buyToken.address : undefined;

            const { intentId } = await createBCHToEVMIntent({
                makerAddress: currentBchWallet.address!,
                recipientAddress: currentWdk.evmAddress!,
                sellAmount: sellAmountSats,
                buyAmount: buyAmountWei,
                hashlock: 'dummy',
                timelock: covenantTimelock,
                bchContractAddress: starkCovenantAddress,
                evmTokenAddress,
                expiryTime: params.orderType === 'limit' ? params.expiryTime : undefined,
            }, isMainnet);

            const order: BCHOrder = {
                id: intentId || `bch_eth_${Date.now()}`,
                swapType: 'bch-to-eth',
                orderType: params.orderType,
                sellToken: params.sellToken,
                buyToken: params.buyToken,
                sellAmount: params.sellAmount,
                buyAmount: params.buyAmount,
                status: 'pending',
                txid: fundTxId,
                intentId,
                explorerUrl: isMainnet
                    ? `https://blockchair.com/bitcoin-cash/transaction/${fundTxId}`
                    : `https://chipnet.imaginary.cash/tx/${fundTxId}`,
                createdAt: Date.now(),
                claimData: {
                    starkCovenantAddress,
                    evmRecipient: currentWdk.evmAddress!,
                    direction: 'BCH_TO_ETH',
                    bchCovenantTimelock: covenantTimelock,
                },
            };

            saveOrder(order);
            setSwapStep('');
            toast.success('ZK swap initiated!', {
                description: `Server fills ${isMainnet ? 'BNB on BSC' : 'ETH on Sepolia'} and claims BCH covenant via STARK proof automatically.`,
            });
        } catch (e: any) {
            throw new Error(`Solver error: ${e.message}`);
        }
    };

    // =========================================================================
    // BCH → XMR: Deploy XmrAdaptorSwap covenant on BCH
    // TODO: Plug back in when @bch-intents/sdk-xmr-swap build issue is resolved.
    //       The SDK is published on npm as @bch-intents/sdk-xmr-swap@^1.0.0
    //       and @bch-intents/sdk-contracts@^0.1.0. Uncomment the original
    //       implementation below once the vite-plugin-node-polyfills buffer
    //       shim resolution is fixed for the published package.
    // =========================================================================
    const executeBCHToXMR = async (_params: BCHSwapParams, _recipientXmrAddress: string) => {
        toast.info('XMR swaps coming soon', {
            description: 'Monero adaptor signature swaps are under development.',
        });
        throw new Error('XMR swaps are not yet available in this build.');
    };

    /* ---- ORIGINAL executeBCHToXMR implementation (commented out) ----
        // 1. Generate Adaptor Keys
        const xmrSdk = await import('@bch-intents/sdk-xmr-swap');
        const { XmrAdaptorSwapContract } = await import('@bch-intents/sdk-contracts');
        const bchSecretKeyBytes = crypto.getRandomValues(new Uint8Array(32));
        const bchSecretKey = Array.from(bchSecretKeyBytes).map(b => b.toString(16).padStart(2, '0')).join('');
        const bchPublicKey = xmrSdk.getPublicKey(bchSecretKeyBytes);
        // ... full implementation preserved in git history
    ---- END ORIGINAL ---- */

    // =========================================================================
    // XMR → BCH: Request XMR Deposit Address
    // =========================================================================
    const executeXMRToBCH = async (params: BCHSwapParams, recipientBCHAddress: string) => {
        setSwapStep('Requesting Monero deposit address...');
        try {
            const response = await axios.post(`${BCH_SOLANA_RELAYER_URL}/swap/xmr-to-bch`, {
                makerAddress: 'xmr-user', // Will be determined when funds arrive
                recipientAddress: recipientBCHAddress,
                sellAmount: Math.floor(params.sellAmount * 1e12).toString(), // XMR piconeros
                buyAmount: Math.floor(params.buyAmount * 1e8).toString(), // BCH satoshis
            });

            const intent = response.data.intent;
            const order: BCHOrder = {
                id: intent?.id || `xmr_bch_${Date.now()}`,
                swapType: 'xmr-to-bch',
                orderType: params.orderType,
                sellToken: params.sellToken,
                buyToken: params.buyToken,
                sellAmount: params.sellAmount,
                buyAmount: params.buyAmount,
                status: 'pending',
                intentId: intent?.id,
                createdAt: Date.now(),
                claimData: {
                    direction: 'XMR_TO_BCH',
                    xmrDepositAddress: intent?.xmrDepositAddress, // Auto-generated deposit address
                },
            };

            saveOrder(order);
            setSwapStep('');
            toast.success('XMR deposit requested!', { description: 'Send XMR to the displayed address.' });
        } catch (e: any) {
            throw new Error(`Relayer error: ${e.response?.data?.error || e.message}`);
        }
    };


    // =========================================================================
    // Order refresh — check relayer for cross-chain status updates
    // =========================================================================
    // =========================================================================
    // Helper: Build explorer URL per chain
    // =========================================================================
    const buildExplorerUrl = (txid: string, chain: string): string => {
        const net = wdkRef.current.bchNetwork;
        switch (chain) {
            case 'bch': return net === 'mainnet'
                ? `https://blockchair.com/bitcoin-cash/transaction/${txid}`
                : `https://chipnet.chaingraph.cash/tx/${txid}`;
            case 'solana': return `https://explorer.solana.com/tx/${txid}?cluster=devnet`;
            case 'movement': return `https://explorer.movementnetwork.xyz/txn/${txid}?network=testnet`;
            case 'eth': return net === 'mainnet'
                ? `https://bscscan.com/tx/${txid}`
                : `https://sepolia.etherscan.io/tx/${txid}`;
            default: return net === 'mainnet'
                ? `https://blockchair.com/bitcoin-cash/transaction/${txid}`
                : `https://chipnet.chaingraph.cash/tx/${txid}`;
        }
    };

    const refreshOrders = useCallback(async () => {
        setIsLoading(true);
        try {
            const ordersKey = getOrdersKey(wdkRef.current.bchNetwork);
            const saved = localStorage.getItem(ordersKey);
            if (!saved) return;

            const all: BCHOrder[] = JSON.parse(saved);
            let updated = false;

            for (const order of all) {
                if (!order.intentId) continue;
                // Skip terminal states (refunded is terminal too — the relayer cancel() has burned the covenant)
                if (['filled', 'cancelled', 'expired', 'refunded'].includes(order.status)) continue;

                try {
                    if (order.swapType === 'eth-to-bch' || order.swapType === 'bch-to-eth') {
                        // Poll bsc-bch-server for ETH↔BCH ZK orders — both directions auto-complete, no user claim
                        const ethOrder = await getETHOrder(order.intentId);
                        const s = ethOrder.status;
                        if (s === 'COMPLETED') {
                            order.status = 'filled';
                            if (order.swapType === 'eth-to-bch') {
                                // Source = ETH escrow, dest = BCH fill
                                if (ethOrder.bchTxHash) {
                                    order.fillTxid = ethOrder.bchTxHash;
                                    order.destExplorerUrl = buildExplorerUrl(ethOrder.bchTxHash, 'bch');
                                }
                            } else {
                                // Source = BCH covenant, dest = EVM fill
                                if (ethOrder.evmFillTxHash) {
                                    order.fillTxid = ethOrder.evmFillTxHash;
                                    order.destExplorerUrl = buildExplorerUrl(ethOrder.evmFillTxHash, 'eth');
                                }
                            }
                            updated = true;
                        } else if (s === 'REFUNDED') {
                            order.status = 'refunded';
                            updated = true;
                        } else if (s === 'FAILED' || s === 'EXPIRED') {
                            order.status = 'cancelled';
                            updated = true;
                        }
                        // SOURCE_LOCKED, DEST_FILLED, GENERATING_PROOF → stay pending, no action needed
                    } else if (order.swapType === 'same-chain') {
                        // Poll CashToken relayer — use correct network endpoint
                        if (order.status !== 'pending') continue;
                        const ctNet = wdkRef.current.bchNetwork;
                        const ctRelayerUrl = ctNet === 'mainnet' ? CASHTOKEN_RELAYER_MAINNET_URL : CASHTOKEN_RELAYER_URL;
                        try {
                            const res = await axios.get(`${ctRelayerUrl}/intent/${order.intentId}`);
                            const intent = res.data;
                            if (intent) {
                                if (intent.status === 'filled') {
                                    order.status = 'filled';
                                    order.fillTxid = intent.fillTxid;
                                    order.explorerUrl = intent.explorerUrl || (intent.fillTxid
                                        ? buildExplorerUrl(intent.fillTxid, 'bch')
                                        : undefined);
                                    updated = true;
                                } else if (intent.status === 'refunded') {
                                    order.status = 'refunded';
                                    if (intent.fillTxid) {
                                        order.fillTxid = intent.fillTxid;
                                        order.destExplorerUrl = intent.explorerUrl || buildExplorerUrl(intent.fillTxid, 'bch');
                                    }
                                    updated = true;
                                } else if (intent.status === 'cancelled' || intent.status === 'expired') {
                                    order.status = intent.status;
                                    updated = true;
                                }
                            }
                        } catch (pollErr: any) {
                            // 404 = intent not found (relayer restarted / stale localStorage order)
                            if (pollErr?.response?.status === 404) {
                                order.status = 'expired';
                                updated = true;
                            }
                            // Other errors (network down etc.) → silently skip this cycle
                        }
                    } else if (order.swapType === 'bch-to-sol' || order.swapType === 'sol-to-bch') {
                        // ZK path — poll sol-bch-zk-server; auto-completes, no manual claim
                        const zkServerUrl = wdkRef.current.bchNetwork === 'mainnet'
                            ? SOL_BCH_ZK_SERVER_MAINNET_URL
                            : SOL_BCH_ZK_SERVER_URL;
                        const res = await axios.get(`${zkServerUrl}/intents/${order.intentId}`);
                        const intent = res.data.intent;
                        if (intent) {
                            if (intent.status === 'COMPLETED') {
                                order.status = 'filled';
                                if (order.swapType === 'sol-to-bch' && intent.destClaimTx) {
                                    order.fillTxid = intent.destClaimTx;
                                    order.destExplorerUrl = buildExplorerUrl(intent.destClaimTx, 'bch');
                                } else if (order.swapType === 'bch-to-sol' && intent.sourceLockTx) {
                                    order.fillTxid = intent.sourceLockTx;
                                    order.destExplorerUrl = buildExplorerUrl(intent.sourceLockTx, 'solana');
                                }
                                updated = true;
                                toast.success(`${order.sellToken?.symbol} → ${order.buyToken?.symbol} swap complete!`, {
                                    description: order.fillTxid
                                        ? `Delivery tx: ${order.fillTxid.slice(0, 16)}...`
                                        : 'Tokens delivered automatically.',
                                });
                            } else if (intent.status === 'FAILED' || intent.status === 'REFUNDED') {
                                order.status = intent.status === 'REFUNDED' ? 'refunded' : 'failed';
                                // Capture refund metadata so the UI can offer the refund button
                                order.claimData = {
                                    ...order.claimData,
                                    sourceTimelock: intent.bchCovenantTimelock ?? intent.sourceTimelock,
                                    pendingRefundTx: intent.pendingRefundTx,
                                };
                                updated = true;
                                if (intent.status === 'FAILED') {
                                    toast.info(`Swap timed out — refund available`, {
                                        description: `${order.sellToken?.symbol} can be recovered via the Refund button.`,
                                        duration: 10000,
                                    });
                                }
                            }
                        }
                    } else {
                        // Poll cross-chain relayer (HTLC path for other directions)
                        const res = await axios.get(`${BCH_SOLANA_RELAYER_URL}/intents/${order.intentId}`);
                        const intent = res.data.intent;
                        if (intent) {
                            // DEST_FILLED = relayer filled on destination, user can claim
                            if (intent.status === 'DEST_FILLED' && order.status === 'pending') {
                                order.status = 'claimable';
                                order.fillTxid = intent.destFillTx;
                                // Store claim data from relayer
                                order.claimData = {
                                    ...order.claimData,
                                    destFillTx: intent.destFillTx,
                                    solanaEscrowPda: intent.solanaEscrowPda || order.claimData?.solanaEscrowPda,
                                    bchContractAddress: intent.bchContractAddress || order.claimData?.bchContractAddress,
                                    movementEscrowId: intent.movementEscrowId || order.claimData?.movementEscrowId,
                                    destTimelock: intent.destTimelock || order.claimData?.destTimelock,
                                };
                                // Build destination explorer URL (HTLC path — always BCH destination here)
                                if (intent.destFillTx) {
                                    order.destExplorerUrl = buildExplorerUrl(intent.destFillTx, 'bch');
                                }
                                updated = true;

                                // 🔔 Toast notification with Claim button
                                toast.info(`Your ${order.sellToken?.symbol} → ${order.buyToken?.symbol} swap is ready!`, {
                                    description: 'Click to claim your tokens on the destination chain.',
                                    duration: 30000,
                                    action: {
                                        label: '⚡ Claim Now',
                                        onClick: () => claimOrder(order.id),
                                    },
                                });
                            }

                            // COMPLETED = fully done
                            if (intent.status === 'COMPLETED' || intent.status === 'DEST_CLAIMED' || intent.status === 'SOURCE_CLAIMED') {
                                if (order.status !== 'filled') {
                                    order.status = 'filled';
                                    if (intent.destFillTx && !order.fillTxid) order.fillTxid = intent.destFillTx;
                                    if (intent.destClaimTx) {
                                        order.destExplorerUrl = buildExplorerUrl(intent.destClaimTx, 'bch');
                                    }
                                    updated = true;
                                }
                            }

                            if (intent.status === 'REFUNDED') {
                                order.status = 'refunded';
                                updated = true;
                            } else if (intent.status === 'FAILED') {
                                order.status = 'cancelled';
                                updated = true;
                            }
                        }
                    }
                } catch (err: any) {
                    // If relayer returns 404, the intent doesn't exist — mark as expired to stop polling
                    if (err?.response?.status === 404) {
                        order.status = 'expired';
                        updated = true;
                    }
                    /* skip other errors */
                }
            }

            if (updated) {
                localStorage.setItem(ordersKey, JSON.stringify(all));
                setPendingOrders(all.filter(o => o.status === 'pending' || o.status === 'claimable'));
                setCompletedOrders(all.filter(o => !['pending', 'claimable'].includes(o.status)));
            }
        } catch { /* ignore */ }
        finally {
            setIsLoading(false);
        }
    }, []);

    // =========================================================================
    // Claim order — user claims tokens on the destination chain
    // =========================================================================
    const claimOrder = useCallback(async (orderId: string) => {
        setIsLoading(true);
        setSwapStep('Claiming tokens...');

        try {
            const claimKey = getOrdersKey(wdkRef.current.bchNetwork);
            const saved = localStorage.getItem(claimKey);
            if (!saved) throw new Error('No orders found');

            const all: BCHOrder[] = JSON.parse(saved);
            const order = all.find(o => o.id === orderId);
            if (!order) throw new Error('Order not found');
            if (!order.claimData?.secret) {
                toast.error('Cannot claim', { description: 'Secret not available for this order. It may have been created before the claim feature was added.' });
                return;
            }

            const secret = order.claimData.secret;
            const direction = order.claimData.direction || (order.swapType === 'bch-to-sol' ? 'BCH_TO_SOL' : 'SOL_TO_BCH');

            let claimTxid: string | undefined;

            if (direction === 'BCH_TO_SOL') {
                // User claims on Solana (destination)
                setSwapStep('Claiming on Solana...');

                // Use ref so we always get the live WDK-derived signer even inside useCallback
                const sw = solanaWalletRef.current;
                if (!sw || !sw.publicKey || !sw.signTransaction) {
                    throw new Error('WDK wallet not connected — Solana signer unavailable');
                }

                // Derive PDAs
                const makerPubKey = new PublicKey(order.claimData.solMaker || 'VBmpGVzabx8AsptQXrA2okEwqFVjbuosHvR2NkuBoaS'); // Relayer is Maker in BCH->SOL
                const hashBuf = Buffer.from(order.claimData.hashlock!.replace('0x', ''), 'hex');
                const secretBuf = Buffer.from(secret.replace('0x', ''), 'hex');

                // Get the token mint address (USDC or SOL NATIVE_MINT)
                const isBuyNativeSol = !order.buyToken?.address || order.buyToken.address === 'So11111111111111111111111111111111111111112';
                const tokenAddress = isBuyNativeSol ? 'So11111111111111111111111111111111111111112' : order.buyToken.address;
                const tokenMint = new PublicKey(tokenAddress!);

                let escrowPda: PublicKey;
                if (order.claimData.solanaEscrowPda) {
                    escrowPda = new PublicKey(order.claimData.solanaEscrowPda);
                } else {
                    [escrowPda] = PublicKey.findProgramAddressSync(
                        [Buffer.from('escrow'), makerPubKey.toBuffer(), hashBuf],
                        new PublicKey(SOLANA_PROGRAM_ID)
                    );
                }

                const [vaultPda] = PublicKey.findProgramAddressSync(
                    [Buffer.from('vault'), escrowPda.toBuffer()],
                    new PublicKey(SOLANA_PROGRAM_ID)
                );

                const takerTokenAccount = await getAssociatedTokenAddress(tokenMint, sw.publicKey);

                // Fetch intent from Relayer to confirm Taker identity
                console.log('[Claim] Fetching intent data to verify Taker identity...');
                const intentRes = await axios.get(`${BCH_SOLANA_RELAYER_URL}/intents/${order.intentId}`);
                const expectedTaker = intentRes.data?.intent?.recipientAddress;

                console.log('[Claim] Expected Token/Mint:', tokenMint.toBase58());
                console.log('[Claim] Expected Taker:', expectedTaker);
                console.log('[Claim] Connected Taker (Signing Wallet):', sw.publicKey.toBase58());

                if (expectedTaker && expectedTaker !== sw.publicKey.toBase58()) {
                    throw new Error(`Wallet Mismatch! You connected ${sw.publicKey.toBase58().slice(0, 6)}... but the escrow requires ${expectedTaker.slice(0, 6)}... to claim it.`);
                }

                // Check if user has an ATA, if not, create it first
                const accountInfo = await solanaConnection.getAccountInfo(takerTokenAccount);
                if (!accountInfo) {
                    console.log('[Claim] ATA does not exist, creating it now:', takerTokenAccount.toBase58());
                    setSwapStep('Creating Token Account (Transaction 1 of 2)...');

                    const ataTx = new anchor.web3.Transaction().add(
                        createAssociatedTokenAccountInstruction(
                            sw.publicKey, // Payer
                            takerTokenAccount,
                            sw.publicKey, // Owner
                            tokenMint
                        )
                    );

                    ataTx.recentBlockhash = (await solanaConnection.getLatestBlockhash()).blockhash;
                    ataTx.feePayer = sw.publicKey;

                    const ataSignature = await sw.sendTransaction(ataTx, solanaConnection);
                    await solanaConnection.confirmTransaction(ataSignature, 'processed');
                    console.log('[Claim] ATA Created successfully.');
                }

                const transaction = new anchor.web3.Transaction();

                const CLAIM_DISCRIMINATOR = Buffer.from([62, 198, 214, 193, 213, 159, 108, 210]);
                const data = Buffer.concat([CLAIM_DISCRIMINATOR, secretBuf]);

                const ix = new anchor.web3.TransactionInstruction({
                    programId: new PublicKey(SOLANA_PROGRAM_ID),
                    keys: [
                        { pubkey: sw.publicKey, isSigner: true, isWritable: true },
                        { pubkey: escrowPda, isSigner: false, isWritable: true },
                        { pubkey: vaultPda, isSigner: false, isWritable: true },
                        { pubkey: takerTokenAccount, isSigner: false, isWritable: true },
                        { pubkey: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'), isSigner: false, isWritable: false }
                    ],
                    data
                });

                transaction.add(ix);

                try {
                    transaction.recentBlockhash = (await solanaConnection.getLatestBlockhash()).blockhash;
                    transaction.feePayer = sw.publicKey;

                    setSwapStep(accountInfo ? 'Please sign the transaction in your wallet...' : 'Please sign the claim transaction (Transaction 2 of 2)...');

                    const signature = await sw.sendTransaction(transaction, solanaConnection);
                    claimTxid = signature;

                    setSwapStep('Waiting for confirmation...');
                    await solanaConnection.confirmTransaction(signature, 'processed');

                    // Notify relayer so it completes the BCH claim side quickly
                    try {
                        await axios.post(`${BCH_SOLANA_RELAYER_URL}/claim`, {
                            intentId: orderId,
                            secret,
                        });
                    } catch { }

                } catch (err: any) {
                    console.error('Solana Transaction Error:', err);
                    if (err.logs) console.error('Simulation Logs:', err.logs);
                    throw new Error(`Transaction failed: ${err.message}`);
                }

            } else if (direction === 'SOL_TO_BCH' || direction === 'MOV_TO_BCH') {
                // User claims on BCH (destination)
                setSwapStep('Claiming on BCH...');
                if (!bchWallet.connected || !order.claimData?.bchContractAddress) {
                    throw new Error('BCH Wallet not connected or contract address missing');
                }

                console.log('[Claim] Secret:', secret);
                const { Contract, ElectrumNetworkProvider, SignatureTemplate } = await getCashScript();
                const artifact = (await import('@/lib/CrossChainHTLC.json')).default;

                const { cashAddressToLockingBytecode } = await import('@bitauth/libauth');
                const derivePkh = (address: string): Uint8Array => {
                    const result = cashAddressToLockingBytecode(address);
                    if (typeof result === 'string') throw new Error(result);
                    const bytecode = result.bytecode;
                    if (bytecode.length === 25 && bytecode[0] === 0x76 && bytecode[1] === 0xa9 && bytecode[2] === 0x14) {
                        return bytecode.slice(3, 23);
                    }
                    throw new Error('Not a standard P2PKH address');
                };

                // In SOL_TO_BCH and MOV_TO_BCH, the Relayer is the Maker (locks BCH) and User is the Taker (claims BCH)
                let relayerSolAddress = '';
                try {
                    const healthRes = await axios.get(`${BCH_SOLANA_RELAYER_URL}/health`);
                    relayerSolAddress = healthRes.data?.pubkeys?.bch || '';
                } catch { }
                if (!relayerSolAddress) throw new Error('Could not fetch Relayer BCH address');

                const makerPkh = derivePkh(relayerSolAddress);
                const takerPkh = derivePkh(bchWallet.address!);
                const hashBuf = Buffer.from(order.claimData.hashlock!.replace('0x', ''), 'hex');
                const secretBuf = Buffer.from(secret.replace('0x', ''), 'hex');
                // Timelock: must match the one relayer used when deploying the HTLC
                const destTimelock = order.claimData?.destTimelock;
                if (!destTimelock) throw new Error('destTimelock missing from claim data. Cannot reconstruct HTLC contract.');
                const timelock = BigInt(destTimelock);

                const claimNet = wdkRef.current.bchNetwork === 'mainnet' ? 'mainnet' : 'chipnet';
                const provider = new ElectrumNetworkProvider(claimNet);
                const contract = new Contract(
                    artifact,
                    [makerPkh, takerPkh, hashBuf, timelock],
                    { provider }
                );

                const contractAddress = contract.address;
                console.log('[Claim] Reconstructed Contract Address:', contractAddress);
                if (contractAddress !== order.claimData.bchContractAddress) {
                    throw new Error('Contract address mismatch. Make sure you are using the correct account.');
                }

                const utxos = await provider.getUtxos(contractAddress);
                if (utxos.length === 0) throw new Error('No funds found in the HTLC contract.');

                const balance = utxos.reduce((acc: bigint, u: any) => acc + u.satoshis, 0n);
                console.log('[Claim] Found', balance, 'sats to claim');

                const wif = bchWallet.getWIF();
                if (!wif) throw new Error('Cannot sign BCH claim: WIF not available in wallet');

                const sigTemplate = new SignatureTemplate(wif);
                const recipientPubKey = sigTemplate.getPublicKey();

                const { TransactionBuilder } = await getCashScript();
                const builder = new TransactionBuilder({ provider });

                const unlocker = contract.unlock.claim(
                    recipientPubKey,
                    sigTemplate,
                    secretBuf
                );
                builder.addInputs(utxos, unlocker);

                const fee = 1000n;
                const outputAmount = balance - fee;
                if (outputAmount < 546n) throw new Error('Output amount below dust limit.');

                builder.addOutput({
                    to: bchWallet.address!,
                    amount: outputAmount
                });

                console.log('[Claim] Sending BCH transaction...');
                const tx = await builder.send();
                claimTxid = tx.txid;

                console.log('[Claim] BCH Claim successful! TX:', claimTxid);

                // Best effort notify relayer so it updates UI faster
                try {
                    await axios.post(`${BCH_SOLANA_RELAYER_URL}/claim`, {
                        intentId: orderId,
                        secret,
                    });
                } catch { }

            } else if (direction === 'BCH_TO_MOV') {
                // Movement chain claims (handled by Relayer API until Movement wallet integrated)
                setSwapStep('Claiming on Movement...');
                try {
                    const res = await axios.post(`${BCH_SOLANA_RELAYER_URL}/claim`, {
                        intentId: orderId,
                        secret,
                    });
                    claimTxid = res.data.txid || res.data.destClaimTx;
                } catch {
                    console.log('[Claim] Relayer claim endpoint not available');
                    claimTxid = 'auto-claim-pending';
                }
            }

            // Update order status
            order.status = 'claimed';
            if (claimTxid && claimTxid !== 'auto-claim-pending') {
                const destChain = order.swapType === 'bch-to-sol' ? 'solana' : 'bch';
                order.destExplorerUrl = buildExplorerUrl(claimTxid, destChain);
            }

            localStorage.setItem(claimKey, JSON.stringify(all));
            setPendingOrders(all.filter(o => o.status === 'pending' || o.status === 'claimable'));
            setCompletedOrders(all.filter(o => !['pending', 'claimable'].includes(o.status)));

            toast.success('Tokens claimed! 🎉', {
                description: claimTxid && claimTxid !== 'auto-claim-pending'
                    ? `Claim TX: ${claimTxid.slice(0, 16)}...`
                    : 'Claim is being processed by the relayer.',
            });

        } catch (e: any) {
            console.error('Claim failed:', e);
            toast.error('Claim failed', { description: e.message });
        } finally {
            setIsLoading(false);
            setSwapStep('');
        }
    }, [bchWallet.connected]);

    // =========================================================================
    // requestRefund — user-triggered refund for timed-out ZK swaps
    //   bch-to-sol: GET /intents/:id/refund-bch → sign sighash → POST refund-bch
    //   sol-to-bch: GET /intents/:id/refund-tx  → sign unsigned tx → submit
    // =========================================================================
    const requestRefund = useCallback(async (orderId: string) => {
        setIsLoading(true);
        setSwapStep('Preparing refund...');
        try {
            const key = getOrdersKey(wdkRef.current.bchNetwork);
            const saved = localStorage.getItem(key);
            if (!saved) throw new Error('No orders found');
            const all: BCHOrder[] = JSON.parse(saved);
            const order = all.find(o => o.id === orderId);
            if (!order || !order.intentId) throw new Error('Order not found');

            const zkUrl = wdkRef.current.bchNetwork === 'mainnet'
                ? SOL_BCH_ZK_SERVER_MAINNET_URL
                : SOL_BCH_ZK_SERVER_URL;
            const isMainnet = wdkRef.current.bchNetwork === 'mainnet';

            let refundTxid: string | undefined;
            let refundExplorerUrl: string | undefined;

            if (order.swapType === 'bch-to-sol') {
                // ── BCH covenant refund via OP_ELSE (CLTV) branch ─────────────
                const currentBchWallet = bchWalletRef.current;
                if (!currentBchWallet.address) throw new Error('Connect your BCH wallet to claim the refund');
                const wif = currentBchWallet.getWIF();
                if (!wif) throw new Error('WIF not available — reconnect your BCH wallet');

                setSwapStep('Fetching BCH refund transaction...');
                const { data } = await axios.get(`${zkUrl}/intents/${order.intentId}/refund-bch`);
                if (!data.timelockPassed) {
                    const mins = Math.ceil((data.timelock - Date.now() / 1000) / 60);
                    throw new Error(`Timelock not yet passed — available in ~${mins} min`);
                }

                // Sign the BIP143 sighash with user's BCH key via libauth secp256k1
                const { secp256k1: sec, decodePrivateKeyWif, hexToBin, binToHex } = await import('@bitauth/libauth');
                const wifResult = decodePrivateKeyWif(wif);
                if (typeof wifResult === 'string') throw new Error(`Invalid WIF: ${wifResult}`);
                const privKey = wifResult.privateKey;
                const pubKey = sec.derivePublicKeyCompressed(privKey);
                if (typeof pubKey === 'string') throw new Error(`Key derivation failed: ${pubKey}`);
                const sighash = hexToBin(data.sighashHex);
                const derSig = sec.signMessageHashDER(privKey, sighash);
                if (typeof derSig === 'string') throw new Error(`Signing failed: ${derSig}`);
                const userSig = new Uint8Array([...derSig, 0x41]); // SIGHASH_ALL|FORKID

                setSwapStep('Broadcasting BCH refund...');
                let refundData: any;
                try {
                    const res = await axios.post(
                        `${zkUrl}/intents/${order.intentId}/refund-bch`,
                        { userPk: binToHex(pubKey), userSig: binToHex(userSig) },
                    );
                    refundData = res.data;
                } catch (postErr: any) {
                    const serverMsg = postErr?.response?.data?.error ?? postErr.message;
                    throw new Error(serverMsg);
                }
                refundTxid = refundData.txid;
                refundExplorerUrl = isMainnet
                    ? `https://blockchair.com/bitcoin-cash/transaction/${refundTxid}`
                    : `https://chipnet.chaingraph.cash/tx/${refundTxid}`;

            } else if (order.swapType === 'sol-to-bch') {
                // ── Solana FRI escrow refund — sign prebuilt unsigned tx ───────
                const sw = solanaWalletRef.current;
                if (!sw?.publicKey) throw new Error('Connect your Solana wallet to claim the refund');

                setSwapStep('Fetching Solana refund transaction...');
                const { data } = await axios.get(`${zkUrl}/intents/${order.intentId}/refund-tx`);
                if (!data.timelockPassed) {
                    const mins = Math.ceil((data.timelock - Date.now() / 1000) / 60);
                    throw new Error(`Timelock not yet passed — available in ~${mins} min`);
                }

                setSwapStep('Sign the refund in your wallet...');
                const { Transaction } = await import('@solana/web3.js');
                const tx = Transaction.from(Buffer.from(data.refundTx, 'base64'));

                // Refresh blockhash — prebuilt tx may have a stale one
                const { blockhash, lastValidBlockHeight } = await solanaConnection.getLatestBlockhash();
                tx.recentBlockhash = blockhash;
                tx.feePayer = sw.publicKey;

                const signedTx = await sw.signTransaction(tx);
                setSwapStep('Submitting Solana refund...');
                const sig = await solanaConnection.sendRawTransaction(signedTx.serialize());
                await solanaConnection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
                refundTxid = sig;
                refundExplorerUrl = `https://explorer.solana.com/tx/${sig}?cluster=${isMainnet ? 'mainnet-beta' : 'devnet'}`;
            } else if (order.swapType === 'bch-to-eth') {
                // ── BCH→EVM covenant refund via OP_ELSE (CLTV) branch ─────────
                const currentBchWallet = bchWalletRef.current;
                if (!currentBchWallet.address) throw new Error('Connect your BCH wallet to claim the refund');
                const wif = currentBchWallet.getWIF();
                if (!wif) throw new Error('WIF not available — reconnect your BCH wallet');

                setSwapStep('Fetching BCH refund transaction...');
                const refundInfo = await getRefundBCH(order.intentId!, isMainnet);
                if (!refundInfo.timelockPassed) {
                    const mins = Math.ceil((refundInfo.timelock - Date.now() / 1000) / 60);
                    throw new Error(`Timelock not yet passed — available in ~${mins} min`);
                }

                // Sign the BIP143 sighash with user's BCH key via libauth secp256k1
                const { secp256k1: sec, decodePrivateKeyWif, hexToBin, binToHex } = await import('@bitauth/libauth');
                const wifResult = decodePrivateKeyWif(wif);
                if (typeof wifResult === 'string') throw new Error(`Invalid WIF: ${wifResult}`);
                const privKey = wifResult.privateKey;
                const pubKey = sec.derivePublicKeyCompressed(privKey);
                if (typeof pubKey === 'string') throw new Error(`Key derivation failed: ${pubKey}`);
                const sighash = hexToBin(refundInfo.sighashHex);
                const derSig = sec.signMessageHashDER(privKey, sighash);
                if (typeof derSig === 'string') throw new Error(`Signing failed: ${derSig}`);
                const userSig = new Uint8Array([...derSig, 0x41]); // SIGHASH_ALL|FORKID

                setSwapStep('Broadcasting BCH refund...');
                let refundData: { txid: string };
                try {
                    refundData = await postRefundBCH(
                        order.intentId!,
                        { userPk: binToHex(pubKey), userSig: binToHex(userSig) },
                        isMainnet,
                    );
                } catch (postErr: any) {
                    throw new Error(postErr.message);
                }
                refundTxid = refundData.txid;
                refundExplorerUrl = isMainnet
                    ? `https://blockchair.com/bitcoin-cash/transaction/${refundTxid}`
                    : `https://chipnet.chaingraph.cash/tx/${refundTxid}`;
            } else {
                throw new Error(`Refund not available for swap type: ${order.swapType}`);
            }

            if (refundTxid) {
                order.status = 'refunded';
                order.fillTxid = refundTxid;
                order.destExplorerUrl = refundExplorerUrl;
                localStorage.setItem(key, JSON.stringify(all));
                setPendingOrders(all.filter(o => o.status === 'pending' || o.status === 'claimable'));
                setCompletedOrders(all.filter(o => !['pending', 'claimable'].includes(o.status)));

                toast.success('Refund successful!', {
                    description: `Tx: ${refundTxid.slice(0, 16)}...`,
                    action: refundExplorerUrl ? {
                        label: 'View on Explorer',
                        onClick: () => window.open(refundExplorerUrl, '_blank'),
                    } : undefined,
                });
            }
        } catch (e: any) {
            console.error('[requestRefund] Error:', e);
            toast.error('Refund failed', { description: e.message });
        } finally {
            setIsLoading(false);
            setSwapStep('');
        }
    }, [solanaConnection]);

    // =========================================================================
    // executeSwap — Router that dispatches to the correct swap handler
    // =========================================================================
    const executeSwap = useCallback(async (params: BCHSwapParams, recipientAddress: string) => {
        setIsLoading(true);
        setSwapStep('Preparing swap...');
        try {
            switch (params.swapType) {
                case 'bch-to-sol':
                    await executeBCHToSolana(params, recipientAddress);
                    break;
                case 'sol-to-bch':
                    await executeSolanaToBCH(params, recipientAddress);
                    break;
                case 'same-chain':
                    await executeSameChainSwap(params);
                    break;
                case 'bch-to-mov':
                    await executeBCHToMovement(params, recipientAddress);
                    break;
                case 'mov-to-bch':
                    await executeMovementToBCH(params, recipientAddress);
                    break;
                case 'bch-to-xmr':
                    await executeBCHToXMR(params, recipientAddress);
                    break;
                case 'xmr-to-bch':
                    await executeXMRToBCH(params, recipientAddress);
                    break;
                case 'eth-to-bch':
                    await executeETHToBCH(params, recipientAddress);
                    break;
                case 'bch-to-eth':
                    await executeBCHToETH(params, recipientAddress);
                    break;
                default:
                    throw new Error(`Unsupported swap type: ${params.swapType}`);
            }
        } catch (e: any) {
            console.error('[executeSwap] Error:', e);
            toast.error('Swap failed', { description: e.message });
            throw e;
        } finally {
            setIsLoading(false);
            setSwapStep('');
        }
    }, []);

    return (
        <BCHSwapContext.Provider
            value={{
                isLoading,
                swapStep,
                pendingOrders,
                completedOrders,
                executeSwap,
                claimOrder,
                requestRefund,
                refreshOrders,
                detectSwapType,
            }}
        >
            {children}
        </BCHSwapContext.Provider>
    );
}

export const useBCHSwap = () => {
    const context = useContext(BCHSwapContext);
    if (!context) {
        throw new Error('useBCHSwap must be used within BCHSwapProvider');
    }
    return context;
};

// Safe version that returns null when outside BCHSwapProvider
export const useBCHSwapOptional = () => {
    return useContext(BCHSwapContext) || null;
};
