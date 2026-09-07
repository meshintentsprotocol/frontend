import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { notifyToast as toast } from '@/lib/notify-toast';
import { useBCHWallet } from './BCHWalletProvider';
import { useActiveWallet } from '@/hooks/useActiveWallet';
import { useActiveSigner } from '@/hooks/useActiveSigner';
import { useExternalBCHWallet } from '@/context/ExternalBCHWalletProvider';
import { useWDK } from '@/context/WDKProvider';
import { useConnection } from '@solana/wallet-adapter-react';
import { Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { BCHSwapParams, BCHSwapType, BCHOrder, isTerminalOrderStatus, splitOrders } from '@/types';
import { useRelayerEvents, type RelayerEvent } from '@/hooks/useRelayerEvents';
import { BCH_SOLANA_RELAYER_URL, CASHTOKEN_RELAYER_URL, CASHTOKEN_RELAYER_MAINNET_URL } from '@/lib/config';
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
    postClaim,
} from '@/lib/bscBchApi';
import { createStarkEscrow, createHTLCEscrow, getEvmConfig } from '@/lib/intentHTLC';
import {
    isEvmChain,
    getEVMChainConfig,
    FRI_VERIFIER_ABI,
    CHAIN_TO_SERVER_NAME,
    CHAIN_TO_SERVER_NAME_MAINNET,
} from '@/lib/evmChains';

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

/**
 * Normalize a BCH address to ensure it carries the correct cashaddr prefix.
 *
 * External wallets (Cashonize, Paytaca via WC2/WizardConnect) sometimes return
 * only the payload part — e.g. `qpnxkp6yz...` without `bitcoincash:` or `bchtest:`.
 * libauth and the CashToken relayer both require the full `prefix:payload` form.
 *
 * @param address  Raw address string from wallet (may or may not have prefix)
 * @param isMainnet  Whether the active network is mainnet (default: chipnet)
 */
function normalizeBchAddress(address: string, isMainnet: boolean): string {
    if (!address) return address;
    if (address.includes(':')) return address;                        // already prefixed
    const prefix = isMainnet ? 'bitcoincash' : 'bchtest';
    return `${prefix}:${address}`;
}

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
    cancelSameChainOrder: (orderId: string) => Promise<void>;
    refreshOrders: () => Promise<void>;
    detectSwapType: (sellChain?: string, buyChain?: string) => BCHSwapType;
    /** True while the relayer WebSocket is connected — status is live, not polled. */
    relayerLive: boolean;
}

export const BCHSwapContext = createContext<BCHSwapContextType | undefined>(undefined);

// ============================================================================
// Provider
// ============================================================================
export function BCHSwapProvider({ children }: { children: ReactNode }) {
    const queryClient = useQueryClient();
    const bchWallet = useBCHWallet();
    const { activeWalletId, isMainActive, activeExtWallet } = useActiveWallet();
    const activeSigner = useActiveSigner();
    const extBCHCtx = useExternalBCHWallet();
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
    const activeWalletRef = useRef({ isMainActive, activeExtWallet });
    activeWalletRef.current = { isMainActive, activeExtWallet };
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
                {
                    const split = splitOrders(all);
                    setPendingOrders(split.pending);
                    setCompletedOrders(split.completed);
                }
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
        if (sellChain === 'solana' && buyChain === 'movement') return 'sol-to-mov';
        if (sellChain === 'movement' && buyChain === 'solana') return 'mov-to-sol';
        if (sellChain === 'bch' && buyChain === 'xmr') return 'bch-to-xmr';
        if (sellChain === 'xmr' && buyChain === 'bch') return 'xmr-to-bch';
        if (isEvmChain(sellChain) && buyChain === 'bch') return 'eth-to-bch';
        if (sellChain === 'bch' && isEvmChain(buyChain)) return 'bch-to-eth';
        return 'same-chain';
    }, []);

    // =========================================================================
    // BCH → Solana: HTLC path via CashScript covenant on BCH & Anchor on Solana
    //   1. User locks BCH in CashScript HTLC covenant
    //   2. Notifies bch-solana-relayer on /swap/bch-to-sol
    //   3. Relayer locks SOL / USDC on Solana Anchor program
    //   4. User claims Solana escrow on-chain with secret
    //   5. Relayer claims BCH covenant on Chipnet with secret
    // =========================================================================
    const executeBCHToSolana = async (params: BCHSwapParams, recipientSolAddress: string) => {
        const currentBchWallet = bchWalletRef.current;
        if (!currentBchWallet.address) throw new Error('Connect your BCH wallet first');
        if (!recipientSolAddress) throw new Error('Solana recipient address required');

        const wif = currentBchWallet.getWIF();
        if (!wif) throw new Error('Cannot sign: WIF not available — please reconnect your BCH wallet');

        const { secretHex, hashlockHex } = await generateHashlock();
        const hashlockArray = Array.from(Buffer.from(hashlockHex.replace('0x', ''), 'hex'));

        setSwapStep('Getting relayer info...');
        let relayerBchAddress = 'bchtest:qzufsn0wtcmc4lhc3s3trhl0nxn6dgkpmgvzngkxl7';
        try {
            const healthRes = await axios.get(`${BCH_SOLANA_RELAYER_URL}/health`);
            relayerBchAddress = healthRes.data?.pubkeys?.bch
                || healthRes.data?.wallets?.bch?.address
                || healthRes.data?.bch?.address
                || relayerBchAddress;
        } catch { }

        setSwapStep('Deploying HTLC covenant on BCH...');
        const { Contract, ElectrumNetworkProvider, SignatureTemplate } = await getCashScript();
        const artifactModule = await import('@/lib/CrossChainHTLC.json');
        const artifact = artifactModule.default || artifactModule;
        const { cashAddressToLockingBytecode, decodePrivateKeyWif } = await import('@bitauth/libauth');

        const derivePkh = (address: string): Uint8Array => {
            const result = cashAddressToLockingBytecode(address);
            if (typeof result === 'string') throw new Error(`Invalid BCH address: ${result}`);
            const bytecode = result.bytecode;
            if (bytecode.length === 25 && bytecode[0] === 0x76 && bytecode[1] === 0xa9 && bytecode[2] === 0x14) {
                return bytecode.slice(3, 23);
            }
            throw new Error('Not a standard P2PKH address');
        };

        const userPkh = derivePkh(currentBchWallet.address);
        const relayerPkh = derivePkh(relayerBchAddress);
        const timelock = BigInt(Math.floor(Date.now() / 1000) + 3600);

        const isMainnet = wdkRef.current.bchNetwork === 'mainnet';
        const provider = new ElectrumNetworkProvider(isMainnet ? 'mainnet' : 'chipnet');
        const contract = new Contract(artifact, [userPkh, relayerPkh, hashlockArray, timelock], { provider });

        const sats = BigInt(Math.floor(params.sellAmount * 1e8));
        const wifDecoded = decodePrivateKeyWif(wif);
        if (typeof wifDecoded === 'string') throw new Error('Invalid WIF');

        setSwapStep('Locking BCH in HTLC covenant...');
        const txDetails = await contract.functions
            .fund()
            .to(contract.address, sats)
            .send();

        const bchTxHash = txDetails.txid;
        toast.success('BCH locked in HTLC covenant!', { description: `Tx: ${bchTxHash.slice(0, 16)}...` });

        setSwapStep('Notifying relayer...');
        const buyAmountLamports = Math.floor(params.buyAmount * Math.pow(10, params.buyToken.decimals || 9)).toString();
        const response = await axios.post(`${BCH_SOLANA_RELAYER_URL}/swap/bch-to-sol`, {
            makerAddress: currentBchWallet.address,
            recipientAddress: recipientSolAddress,
            sellAmount: sats.toString(),
            buyAmount: buyAmountLamports,
            buyToken: params.buyToken.address || params.buyToken.symbol,
            hashlock: hashlockHex,
            bchContractAddress: contract.address,
            sourceTimelock: Number(timelock),
            sourceLockTx: bchTxHash,
        });

        const intent = response.data.intent;
        const order: BCHOrder = {
            id: intent?.id || `bch_sol_${Date.now()}`,
            swapType: 'bch-to-sol',
            orderType: params.orderType,
            sellToken: params.sellToken,
            buyToken: params.buyToken,
            sellAmount: params.sellAmount,
            buyAmount: params.buyAmount,
            status: 'pending',
            contractAddress: contract.address,
            txid: bchTxHash,
            intentId: intent?.id,
            explorerUrl: isMainnet
                ? `https://blockchair.com/bitcoin-cash/transaction/${bchTxHash}`
                : `https://chipnet.chaingraph.cash/tx/${bchTxHash}`,
            createdAt: Date.now(),
            claimData: {
                hashlock: hashlockHex,
                secret: secretHex,
                bchContractAddress: contract.address,
                destTimelock: Number(timelock),
                direction: 'BCH_TO_SOL',
            },
        };

        saveOrder(order);
        setSwapStep('');
        toast.success('Cross-chain swap initiated!', {
            description: 'Relayer is locking funds on Solana. You can claim once locked.',
        });
    };

    // =========================================================================
    // Solana → BCH: HTLC path via Anchor on Solana & CashScript on BCH
    //   1. User locks SOL/SPL in Solana Escrow PDA
    //   2. Notifies bch-solana-relayer on /swap/sol-to-bch
    //   3. Relayer locks BCH in HTLC covenant on Chipnet
    //   4. User claims BCH on Chipnet with secret
    //   5. Relayer claims Solana escrow with secret
    // =========================================================================
    const executeSolanaToBCH = async (params: BCHSwapParams, recipientBCHAddress: string) => {
        const sw = solanaWalletRef.current;
        if (!sw?.publicKey) throw new Error('Connect your Solana / WDK wallet first');
        if (!recipientBCHAddress) throw new Error('BCH recipient address required');

        const { secretHex, hashlockHex } = await generateHashlock();
        const hashlockBytes = Buffer.from(hashlockHex.replace('0x', ''), 'hex');

        setSwapStep('Getting relayer info...');
        let relayerSolAddress = 'VBmpGVzabx8AsptQXrA2okEwqFVjbuosHvR2NkuBoaS';
        try {
            const healthRes = await axios.get(`${BCH_SOLANA_RELAYER_URL}/health`);
            relayerSolAddress = healthRes.data?.pubkeys?.solana
                || healthRes.data?.wallets?.solana?.address
                || healthRes.data?.solana?.address
                || relayerSolAddress;
        } catch { }

        const { PublicKey, SystemProgram } = await import('@solana/web3.js');
        const { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createSyncNativeInstruction, NATIVE_MINT, TOKEN_PROGRAM_ID } = await import('@solana/spl-token');
        const anchor = await import('@coral-xyz/anchor');
        const idlModule = await import('@/lib/intent_swap.json');
        const idl = idlModule.default || idlModule;

        const programId = new PublicKey(idl.address || '5JAWumq5L4B8WrpF3CFox36SZ2bJF4xQvskLksmHRgs2');
        const relayerPubkey = new PublicKey(relayerSolAddress);

        const isNativeSol = params.sellToken.chain === 'solana' && (params.sellToken.symbol === 'SOL' || params.sellToken.type === 'native');
        const tokenMint = isNativeSol ? NATIVE_MINT : new PublicKey(params.sellToken.address || NATIVE_MINT.toBase58());
        const sellAmountLamports = new anchor.BN(Math.floor(params.sellAmount * Math.pow(10, params.sellToken.decimals || 9)));

        const [escrowPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("escrow"), sw.publicKey.toBuffer(), hashlockBytes],
            programId
        );
        const [vaultPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("vault"), escrowPda.toBuffer()],
            programId
        );

        const makerTokenAccount = await getAssociatedTokenAddress(tokenMint, sw.publicKey);

        setSwapStep('Creating Solana Escrow...');
        const timelockDuration = new anchor.BN(3600); // 1 hour

        const provider = new anchor.AnchorProvider(
            solanaConnection,
            sw as any,
            { preflightCommitment: 'confirmed' }
        );
        const program = new anchor.Program(idl as any, provider);

        const preIxs = [];
        const makerAtaInfo = await solanaConnection.getAccountInfo(makerTokenAccount);
        if (!makerAtaInfo) {
            preIxs.push(
                createAssociatedTokenAccountInstruction(
                    sw.publicKey,
                    makerTokenAccount,
                    sw.publicKey,
                    tokenMint
                )
            );
        }
        if (tokenMint.equals(NATIVE_MINT)) {
            preIxs.push(
                SystemProgram.transfer({
                    fromPubkey: sw.publicKey,
                    toPubkey: makerTokenAccount,
                    lamports: BigInt(sellAmountLamports.toString())
                })
            );
            preIxs.push(createSyncNativeInstruction(makerTokenAccount));
        }

        let solTxHash = '';
        try {
            const builder = (program.methods as any)
                .initialize(
                    [...hashlockBytes],
                    timelockDuration,
                    sellAmountLamports
                )
                .accounts({
                    maker: sw.publicKey,
                    taker: relayerPubkey,
                    tokenMint: tokenMint,
                    escrow: escrowPda,
                    makerTokenAccount: makerTokenAccount,
                    vault: vaultPda,
                    systemProgram: SystemProgram.programId,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                });

            if (preIxs.length > 0) {
                builder.preInstructions(preIxs);
            }

            solTxHash = await builder.rpc();
            console.log('[SOL→BCH] Solana Escrow Created:', solTxHash);
            toast.success('Funds locked on Solana!', { description: `Escrow PDA: ${escrowPda.toBase58().slice(0, 12)}...` });
        } catch (e: any) {
            throw new Error(`Failed to create Solana Escrow: ${e.message}`);
        }

        setSwapStep('Notifying relayer...');
        const buyAmountSats = Math.floor(params.buyAmount * Math.pow(10, params.buyToken.decimals || 8)).toString();
        const response = await axios.post(`${BCH_SOLANA_RELAYER_URL}/swap/sol-to-bch`, {
            makerAddress: sw.publicKey.toBase58(),
            recipientAddress: recipientBCHAddress,
            sellAmount: sellAmountLamports.toString(),
            sellToken: params.sellToken.address || params.sellToken.symbol,
            buyAmount: buyAmountSats,
            buyToken: params.buyToken.address || params.buyToken.symbol,
            hashlock: hashlockHex,
            solanaEscrowPda: escrowPda.toBase58(),
            escrowTxHash: solTxHash,
            sourceTimelock: Math.floor(Date.now() / 1000) + 3600,
        });

        const intent = response.data.intent;
        const order: BCHOrder = {
            id: intent?.id || `sol_bch_${Date.now()}`,
            swapType: 'sol-to-bch',
            orderType: params.orderType,
            sellToken: params.sellToken,
            buyToken: params.buyToken,
            sellAmount: params.sellAmount,
            buyAmount: params.buyAmount,
            status: 'pending',
            intentId: intent?.id,
            explorerUrl: `https://explorer.solana.com/tx/${solTxHash}?cluster=devnet`,
            createdAt: Date.now(),
            claimData: {
                hashlock: hashlockHex,
                secret: secretHex,
                solanaEscrowPda: escrowPda.toBase58(),
                direction: 'SOL_TO_BCH',
            },
        };

        saveOrder(order);
        setSwapStep('');
        toast.success('Cross-chain swap initiated!', {
            description: 'Relayer is locking BCH on Chipnet.',
        });
    };

    // =========================================================================
    // Same-chain BCH swap — Deploy CashToken covenant via relayer API
    // Supports both WDK main wallet (WIF signing) and external wallets
    // (Cashonize/Paytaca via WC2 bch_signTransaction).
    // =========================================================================
    const executeSameChainSwap = async (params: BCHSwapParams) => {
        const isMainnet = wdkRef.current.bchNetwork === 'mainnet';
        const relayerUrl = isMainnet ? CASHTOKEN_RELAYER_MAINNET_URL : CASHTOKEN_RELAYER_URL;

        const { isMainActive, activeExtWallet } = activeWalletRef.current;

        // Determine the signing address: main wallet or connected external wallet.
        // External wallets (WC2/WizardConnect) sometimes omit the cashaddr prefix
        // (e.g. "qp..."). Normalize so the relayer always gets "bitcoincash:qp..."
        // or "bchtest:qp..."
        const rawMakerAddress = isMainActive
            ? bchWalletRef.current.address
            : activeExtWallet?.address;
        const makerAddress = rawMakerAddress
            ? normalizeBchAddress(rawMakerAddress, isMainnet)
            : undefined;

        if (!makerAddress) {
            throw new Error(isMainActive
                ? 'Connect your BCH wallet first'
                : 'No external BCH wallet connected — connect Cashonize or Paytaca first');
        }

        setSwapStep(`Creating intent on BCHMesh server (${isMainnet ? 'mainnet' : 'chipnet'})...`);

        // Determine token category IDs
        const sellCategoryId = params.sellToken.categoryId || (params.sellToken.chain === 'bch' && params.sellToken.symbol !== 'BCH' ? params.sellToken.categoryId : 'BCH');
        const buyCategoryId = params.buyToken.categoryId || (params.buyToken.chain === 'bch' && params.buyToken.symbol !== 'BCH' ? params.buyToken.categoryId : 'BCH');

        // Convert amounts to satoshis / token base units
        const sellBaseUnits = Math.floor(params.sellAmount * Math.pow(10, params.sellToken.decimals || 0));
        const buyBaseUnits = Math.floor(params.buyAmount * Math.pow(10, params.buyToken.decimals || 0));
        const isLimit = params.orderType === 'limit';
        const startBuyUnits = buyBaseUnits;
        const endBuyUnits = Math.max(1, Math.floor(buyBaseUnits * 0.98));

        try {
            const response = await axios.post(`${relayerUrl}/intent/create`, {
                makerAddress,
                sellToken: sellCategoryId || 'BCH',
                buyToken: buyCategoryId || 'BCH',
                sellAmount: sellBaseUnits.toString(),
                buyAmount: buyBaseUnits.toString(),
                startBuyAmount: isLimit ? undefined : startBuyUnits.toString(),
                endBuyAmount: isLimit ? undefined : endBuyUnits.toString(),
                orderType: isLimit ? 'limit' : 'dutch',
                duration: params.duration || 3600,
                expiryTime: params.expiryTime || Math.floor(Date.now() / 1000) + 3600,
                network: isMainnet ? 'mainnet' : 'chipnet',
            });

            const data = response.data;

            // 2. Fund the contract address
            setSwapStep('Signing funding transaction...');
            let fundTxId: string;

            if (isMainActive) {
                // ── WDK main wallet: local WIF signing via CashScript builder ────────────────
                const currentBchWallet = bchWalletRef.current;
                const wif = currentBchWallet.getWIF();
                if (!wif) throw new Error('WIF not available — please reconnect your BCH wallet');
                const { TransactionBuilder, ElectrumNetworkProvider, SignatureTemplate } = await getCashScript();
                const provider = new ElectrumNetworkProvider(isMainnet ? 'mainnet' : 'chipnet');

                const allUtxos = await provider.getUtxos(currentBchWallet.address!);
                if (!allUtxos.length) throw new Error('No BCH UTXOs found — fund your wallet first');

                const sigTemplate = new SignatureTemplate(wif);
                const builder = new TransactionBuilder({ provider });

                const isTokenSell = !!sellCategoryId && sellCategoryId !== 'BCH';
                // Dynamic fee: 2 sat/byte. CashToken inputs ~180 bytes (P2PKH + token prefix),
                // outputs ~50 bytes (P2PKH + token metadata), overhead 10 bytes.
                // Prevents "mempool min fee not met" for token-bearing transactions.
                const estimateFee = (numIn: number, numOut: number) =>
                    BigInt(Math.ceil((numIn * 180 + numOut * 50 + 10) * 2));
                let fee = estimateFee(1, 2);

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
                    const baseFee = estimateFee(tokenUtxos.length, 3);
                    const baseNeed = 1000n + baseFee + 1000n;

                    if (totalTokenSats < baseNeed) {
                        // Need additional BCH inputs
                        const sortedBch = [...bchUtxos].sort(
                            (a: any, b: any) => Number(BigInt(b.satoshis) - BigInt(a.satoshis))
                        );
                        
                        for (const u of sortedBch) {
                            selectedBch.push(u);
                            bchIn += BigInt(u.satoshis);
                            const dynamicFee = estimateFee(tokenUtxos.length + selectedBch.length, 3);
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
                        const dynamicFee = estimateFee(selectedBch.length, 2);
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
            } else {
                // ── External wallet: build unsigned tx, send via WC2 bch_signTransaction ─────
                // We use CashScript TransactionBuilder to build + serialize the tx,
                // then pass the unsigned hex + source UTXOs to Cashonize via WalletConnect.
                if (!activeExtWallet) throw new Error('No active external wallet found.');

                const { buildWC2SourceOutputs, buildWC2Payload, getDummyUnlocker } = await import('@/lib/wc2Serialize');
                const { TransactionBuilder, ElectrumNetworkProvider } = await getCashScript();
                const provider = new ElectrumNetworkProvider(isMainnet ? 'mainnet' : 'chipnet');

                const allUtxos = await provider.getUtxos(makerAddress);
                if (!allUtxos.length) throw new Error('No BCH UTXOs found in external wallet \u2014 fund it first');

                const isTokenSell = !!sellCategoryId && sellCategoryId !== 'BCH';
                const estimateFee = (numIn: number, numOut: number) =>
                    BigInt(Math.ceil((numIn * 180 + numOut * 50 + 10) * 2));
                let fee = estimateFee(1, 2);
                const selectedUtxos: any[] = [];
                const dummyUnlocker = await getDummyUnlocker(makerAddress);

                // Build the transaction structure (outputs + UTXO selection)
                const builder = new TransactionBuilder({ provider });

                if (isTokenSell) {
                    const tokenUtxos = allUtxos.filter((u: any) => u.token?.category === sellCategoryId);
                    const bchUtxos = allUtxos.filter((u: any) => !u.token);
                    if (!tokenUtxos.length) throw new Error(`No ${sellCategoryId} token UTXOs in external wallet`);

                    const totalTokenIn = tokenUtxos.reduce((s: bigint, u: any) => s + BigInt(u.token!.amount), 0n);
                    if (totalTokenIn < BigInt(sellBaseUnits)) throw new Error('Insufficient token balance in external wallet');

                    const totalTokenSats = tokenUtxos.reduce((s: bigint, u: any) => s + BigInt(u.satoshis), 0n);
                    selectedUtxos.push(...tokenUtxos);

                    let bchIn = 0n;
                    const selectedBch: any[] = [];
                    const baseFee = estimateFee(tokenUtxos.length, 3);
                    const baseNeed = 1000n + baseFee + 1000n;
                    if (totalTokenSats < baseNeed) {
                        const sortedBch = [...bchUtxos].sort((a: any, b: any) => Number(BigInt(b.satoshis) - BigInt(a.satoshis)));
                        for (const u of sortedBch) {
                            selectedBch.push(u); bchIn += BigInt(u.satoshis);
                            const dynFee = estimateFee(tokenUtxos.length + selectedBch.length, 3);
                            if (totalTokenSats + bchIn >= 1000n + dynFee + 1000n) { fee = dynFee; break; }
                        }
                    } else { fee = baseFee; }
                    if (totalTokenSats + bchIn < 1000n + fee + 1000n) throw new Error('Insufficient BCH for token fees in external wallet');
                    if (selectedBch.length) selectedUtxos.push(...selectedBch);

                    // For external wallets, use a placeholder unlocker — the wallet will fill in signatures
                    // CashScript doesn't expose a raw "unsigned hex" API, so we temporarily use a dummy WIF
                    // to build a valid-structure tx, then strip signatures server-side. Cashonize re-signs
                    // inputs where unlockingBytecode is empty.

                    const tokenChange = totalTokenIn - BigInt(sellBaseUnits);
                    let satRem = totalTokenSats + bchIn - 1000n - fee;

                    builder.addInputs(selectedUtxos, dummyUnlocker);
                    builder.addOutput({ to: data.tokenAddress, amount: 1000n, token: { category: sellCategoryId, amount: BigInt(sellBaseUnits) } });
                    if (tokenChange > 0n) {
                        const tSats = satRem > 1000n ? 1000n : satRem;
                        builder.addOutput({ to: makerAddress, amount: tSats, token: { category: sellCategoryId, amount: tokenChange } });
                        satRem -= tSats;
                    }
                    if (satRem >= 546n) builder.addOutput({ to: makerAddress, amount: satRem });
                } else {
                    // BCH sell
                    const bchUtxos = allUtxos.filter((u: any) => !u.token);
                    if (!bchUtxos.length) throw new Error('No plain BCH UTXOs in external wallet');
                    const sortedBch = [...bchUtxos].sort((a: any, b: any) => Number(BigInt(b.satoshis) - BigInt(a.satoshis)));
                    let bchIn = 0n;
                    for (const u of sortedBch) {
                        selectedUtxos.push(u); bchIn += BigInt(u.satoshis);
                        const dynFee = estimateFee(selectedUtxos.length, 2);
                        if (bchIn >= BigInt(sellBaseUnits) + dynFee) { fee = dynFee; break; }
                    }
                    if (bchIn < BigInt(sellBaseUnits) + fee) throw new Error('Insufficient BCH in external wallet');

                    builder.addInputs(selectedUtxos, dummyUnlocker);
                    builder.addOutput({ to: data.contractAddress, amount: BigInt(sellBaseUnits) });
                    const change = bchIn - BigInt(sellBaseUnits) - fee;
                    if (change >= 546n) builder.addOutput({ to: makerAddress, amount: change });
                }

                setSwapStep('Waiting for wallet approval in Cashonize...');
                toast.info('Check your Cashonize wallet to approve the transaction.', { duration: 8000 });

                // Build sourceOutputs in WC2 libauth-stringify format
                const utxoIndices = selectedUtxos.map((_: any, i: number) => i);
                const sourceOutputs = await buildWC2SourceOutputs(selectedUtxos, utxoIndices, makerAddress);

                // Encode to get the raw unsigned tx hex that the wallet can sign
                const unsignedHex = builder.build();

                const payload = buildWC2Payload(
                    unsignedHex,
                    sourceOutputs,
                    `Fund ${params.sellToken.symbol} \u2192 ${params.buyToken.symbol} swap covenant`,
                );

                const result = await extBCHCtx.signTransaction(activeWalletId, payload);
                fundTxId = result.signedTransactionHash;
                console.log('[Same-chain External] Signed & broadcast via Cashonize:', fundTxId);
                toast.success('Transaction signed and broadcast by Cashonize!');
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
            queryClient.invalidateQueries({ queryKey: ['bch-balance'] });
            queryClient.invalidateQueries({ queryKey: ['bch-tokens'] });
            queryClient.invalidateQueries({ queryKey: ['portfolio'] });
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
    // Same-chain Limit Order: maker-initiated early cancellation
    //
    // Unlike a fill, this is entirely maker-side: we reconstruct the exact
    // LimitOrderSwap covenant this order created, unlock it with the
    // `cancelEarly(pubkey, sig)` branch (see contracts-bch-swap/docs/
    // limit-order-early-cancel.md), broadcast directly, then tell the relayer
    // so it stops watching the address. Fund safety never depends on the
    // relayer call succeeding — the covenant already guarantees the maker
    // gets their funds back correctly on-chain.
    //
    // Dutch Auctions are intentionally NOT supported here — only cancel()
    // (post-auction-end) exists for that contract.
    //
    // Currently WDK-wallet only. Covenant unlocking needs a real signature
    // over a custom redeem script, which generic external wallets (Cashonize/
    // WalletConnect) aren't set up to produce the way they handle plain
    // P2PKH funding transactions — see getDummyUnlocker in wc2Serialize.ts.
    // =========================================================================
    const cancelSameChainOrder = useCallback(async (orderId: string) => {
        setIsLoading(true);
        setSwapStep('Cancelling order...');
        try {
            const { isMainActive } = activeWalletRef.current;
            if (!isMainActive) {
                throw new Error('Early cancellation currently requires the main wallet — external wallets (Cashonize/WalletConnect) are not yet supported for this action.');
            }

            const key = getOrdersKey(wdkRef.current.bchNetwork);
            const saved = localStorage.getItem(key);
            if (!saved) throw new Error('No orders found');
            const all: BCHOrder[] = JSON.parse(saved);
            const order = all.find(o => o.id === orderId);
            if (!order) throw new Error('Order not found');
            if (order.swapType !== 'same-chain' || order.orderType !== 'limit') {
                throw new Error('Early cancellation is only available for same-chain Limit Orders.');
            }
            if (order.status !== 'pending') {
                throw new Error(`Cannot cancel — order status is already '${order.status}'.`);
            }
            if (!order.contractAddress || !order.intentId) {
                throw new Error('Order is missing contract details — cannot cancel.');
            }

            const isMainnet = wdkRef.current.bchNetwork === 'mainnet';
            const relayerUrl = isMainnet ? CASHTOKEN_RELAYER_MAINNET_URL : CASHTOKEN_RELAYER_URL;
            const currentBchWallet = bchWalletRef.current;
            const wif = currentBchWallet.getWIF();
            if (!wif) throw new Error('WIF not available — please reconnect your BCH wallet');
            const makerAddress = normalizeBchAddress(currentBchWallet.address!, isMainnet);
            const makerPk: Uint8Array | undefined =
                (wdkRef.current.bchWallet as any)?.publicKeyCompressed || (wdkRef.current.bchWallet as any)?.publicKey;
            if (!makerPk) throw new Error('Could not read wallet public key — please reconnect your BCH wallet');

            const { Contract, ElectrumNetworkProvider, SignatureTemplate, TransactionBuilder } = await getCashScript();
            const { cashAddressToLockingBytecode } = await import('@bitauth/libauth');
            const artifactModule = await import('@/lib/LimitOrderSwap.json');
            const artifact = (artifactModule as any).default || artifactModule;

            const derivePkh = (address: string): Uint8Array => {
                const result = cashAddressToLockingBytecode(address);
                if (typeof result === 'string') throw new Error(`Invalid BCH address: ${result}`);
                const bytecode = result.bytecode;
                if (bytecode.length === 25 && bytecode[0] === 0x76 && bytecode[1] === 0xa9 && bytecode[2] === 0x14) {
                    return bytecode.slice(3, 23);
                }
                throw new Error('Not a standard P2PKH address');
            };
            const reverseHex = (hex: string) => hex.match(/.{2}/g)!.reverse().join('');
            const stripHex = (s: string) => s.startsWith('0x') ? s.slice(2) : s;

            const makerPkh = derivePkh(makerAddress);
            const sellCategoryId = order.sellToken.categoryId;
            const buyCategoryId = order.buyToken.categoryId;
            const sellCatLE = sellCategoryId ? `0x${reverseHex(stripHex(sellCategoryId))}` : '0x';
            const buyCatLE = buyCategoryId ? `0x${reverseHex(stripHex(buyCategoryId))}` : '0x';
            const sellBaseUnits = BigInt(Math.floor(order.sellAmount * Math.pow(10, order.sellToken.decimals || 0)));
            const buyBaseUnits = BigInt(Math.floor(order.buyAmount * Math.pow(10, order.buyToken.decimals || 0)));
            const expiryTime = BigInt(order.expiryTime || Math.floor(Date.now() / 1000) + 3600);

            const provider = new ElectrumNetworkProvider(isMainnet ? 'mainnet' : 'chipnet');
            const contract = new Contract(artifact, [
                makerPkh, sellCatLE, buyCatLE, sellBaseUnits, buyBaseUnits, expiryTime,
            ], { provider });

            if (contract.address !== order.contractAddress) {
                throw new Error('Reconstructed contract does not match the stored order — refusing to cancel to avoid an unsafe transaction.');
            }

            // The covenant UTXO shows up under either address form (same script) — dedup.
            const [utxosA, utxosB] = await Promise.all([
                provider.getUtxos(contract.address),
                provider.getUtxos(contract.tokenAddress),
            ]);
            const seenOutpoints = new Set<string>();
            const covenantUtxos = [...utxosA, ...utxosB].filter((u: any) => {
                const k = `${u.txid}:${u.vout}`;
                if (seenOutpoints.has(k)) return false;
                seenOutpoints.add(k);
                return true;
            });
            if (!covenantUtxos.length) {
                throw new Error('No unspent covenant UTXO found — the order may already be filled, refunded, or not yet funded on-chain.');
            }
            const covenantUtxo = covenantUtxos[0] as any;

            // Fee-funding input from the maker's own wallet
            const walletUtxos = await provider.getUtxos(makerAddress);
            const bchUtxos = walletUtxos.filter((u: any) => !u.token);
            if (!bchUtxos.length) throw new Error('No plain BCH UTXOs in your wallet to pay the cancellation network fee.');
            const feeUtxo = [...bchUtxos].sort((a: any, b: any) => Number(BigInt(b.satoshis) - BigInt(a.satoshis)))[0];

            const sigTemplate = new SignatureTemplate(wif);
            const builder = new TransactionBuilder({ provider });
            builder.addInput(
                {
                    txid: covenantUtxo.txid,
                    vout: covenantUtxo.vout,
                    satoshis: BigInt(covenantUtxo.satoshis),
                    token: covenantUtxo.token
                        ? { amount: BigInt(covenantUtxo.token.amount), category: stripHex(covenantUtxo.token.category) }
                        : undefined,
                },
                contract.unlock.cancelEarly(makerPk, sigTemplate),
            );
            builder.addInput(
                { txid: feeUtxo.txid, vout: feeUtxo.vout, satoshis: BigInt(feeUtxo.satoshis) },
                sigTemplate.unlockP2PKH(),
            );

            const FEE = 1500n;
            const isBchSell = !sellCategoryId;
            if (isBchSell) {
                const totalIn = BigInt(covenantUtxo.satoshis) + BigInt(feeUtxo.satoshis);
                const change = totalIn - sellBaseUnits - FEE;
                builder.addOutput({ to: makerAddress, amount: sellBaseUnits });
                if (change >= 546n) builder.addOutput({ to: makerAddress, amount: change });
            } else {
                const { cashAddressToLockingBytecode, lockingBytecodeToCashAddress } = await import('@bitauth/libauth');
                const makerDecoded = cashAddressToLockingBytecode(makerAddress);
                if (typeof makerDecoded === 'string') throw new Error(`Invalid address: ${makerDecoded}`);
                const makerTokenAddr = lockingBytecodeToCashAddress({
                    bytecode: makerDecoded.bytecode,
                    prefix: (isMainnet ? 'bitcoincash' : 'bchtest') as any,
                    tokenSupport: true,
                });
                if (typeof makerTokenAddr === 'string') throw new Error(`Cannot derive token address: ${makerTokenAddr}`);

                const change = BigInt(feeUtxo.satoshis) - 1000n - FEE;
                builder.addOutput({
                    to: makerTokenAddr.address,
                    amount: 1000n,
                    token: { amount: sellBaseUnits, category: stripHex(sellCategoryId!) },
                });
                if (change >= 546n) builder.addOutput({ to: makerAddress, amount: change });
            }

            setSwapStep('Broadcasting cancellation...');
            const tx = await builder.send();
            const cancelTxid = tx.txid;
            console.log('[Cancel] cancelEarly() broadcast:', cancelTxid);

            // Best-effort: tell the relayer so it stops watching this address and the
            // order book reflects reality. If this fails, the funds are already safely
            // back with the maker on-chain — only the relayer's bookkeeping is stale.
            try {
                await axios.post(`${relayerUrl}/intent/${order.intentId}/cancel`, { txid: cancelTxid });
            } catch (notifyErr: any) {
                console.warn('[Cancel] Relayer notify failed (funds are already safe on-chain):', notifyErr.message);
            }

            order.status = 'cancelled';
            order.fillTxid = cancelTxid;
            order.explorerUrl = buildExplorerUrl(cancelTxid, 'bch');
            localStorage.setItem(key, JSON.stringify(all));
            {
                const split = splitOrders(all);
                setPendingOrders(split.pending);
                setCompletedOrders(split.completed);
            }

            toast.success('Order cancelled — funds returned to your wallet.', {
                description: `TX: ${cancelTxid.slice(0, 16)}...`,
            });
        } catch (e: any) {
            console.error('[Cancel] Same-chain order cancellation failed:', e);
            toast.error('Cancellation failed', { description: e.message });
        } finally {
            setIsLoading(false);
            setSwapStep('');
        }
    }, []);

    // =========================================================================
    // BCH → Movement: Deploy CrossChainHTLC covenant on BCH, notify relayer
    // =========================================================================
    const executeBCHToMovement = async (params: BCHSwapParams, recipientMovAddress: string) => {
        const { isMainActive, activeExtWallet } = activeWalletRef.current;
        // if (!isMainActive) throw new Error('External wallets cannot sign cross-chain HTLC swaps yet. Please use the WDK Main Wallet.');
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
            const healthRes = await axios.get(`${BCH_SOLANA_RELAYER_URL}/health`);
            relayerBchAddress = healthRes.data?.pubkeys?.bch
                || healthRes.data?.wallets?.bch?.address
                || healthRes.data?.bch?.address
                || '';
        } catch {
            relayerBchAddress = '';
        }
        if (!relayerBchAddress || !relayerBchAddress.includes(':')) {
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
            const amountSats = BigInt(Math.floor(params.sellAmount * 1e8));
            const wif = currentBchWallet.getWIF();

            const { TransactionBuilder, SignatureTemplate } = await getCashScript();
            const builder = new TransactionBuilder({ provider });
            const allUtxos = await provider.getUtxos(currentBchWallet.address);

            const sortedUtxos = allUtxos.filter((u: any) => !u.token)
                .sort((a: any, b: any) => Number(b.satoshis - a.satoshis));
            if (!sortedUtxos.length) throw new Error('No plain BCH UTXOs available');

            const estimateFee = (numIn: number, numOut: number) => BigInt(Math.ceil((numIn * 148 + numOut * 34 + 10) * 2));
            const selected: any[] = [];
            let totalInput = 0n;
            for (const u of sortedUtxos) {
                selected.push(u);
                totalInput += BigInt(u.satoshis);
                if (totalInput >= amountSats + estimateFee(selected.length, 2)) break;
            }
            const fee = estimateFee(selected.length, 2);
            const change = totalInput - amountSats - fee;
            if (change < 0n) throw new Error('Insufficient BCH balance');

            let unlocker: any;
            if (isMainActive) {
                unlocker = new SignatureTemplate(wif!).unlockP2PKH();
            } else {
                const { getDummyUnlocker } = await import('@/lib/wc2Serialize');
                unlocker = await getDummyUnlocker(currentBchWallet.address!);
            }

            builder.addInputs(selected, unlocker);
            builder.addOutput({ to: contractAddress, amount: amountSats });
            if (change >= 546n) builder.addOutput({ to: currentBchWallet.address, amount: change });

            if (isMainActive) {
                setSwapStep(`Sending ${params.sellAmount} BCH to HTLC...`);
                const tx = await builder.send();
                fundTxId = tx.txid;
                console.log('[BCH→MOV] HTLC funded:', fundTxId);
                toast.success('BCH locked in HTLC!', { description: `Tx: ${fundTxId.slice(0, 16)}...` });
            } else {
                if (!activeExtWallet) throw new Error('No active external wallet found.');
                const { buildWC2SourceOutputs, buildWC2Payload } = await import('@/lib/wc2Serialize');

                setSwapStep('Waiting for wallet approval...');
                toast.info('Check your external wallet to approve the transaction.', { duration: 8000 });

                const utxoIndices = selected.map((_: any, i: number) => i);
                const sourceOutputs = await buildWC2SourceOutputs(selected, utxoIndices, currentBchWallet.address);
                const unsignedHex = builder.build();

                const payload = buildWC2Payload(
                    unsignedHex,
                    sourceOutputs,
                    `Fund MOV swap covenant`
                );

                const result = await extBCHCtx.signTransaction(activeWalletId, payload);
                fundTxId = result.signedTransactionHash;
                console.log('[BCH→MOV] HTLC funded via external wallet:', fundTxId);
                toast.success('BCH locked in HTLC!');
            }
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
                buyToken: params.buyToken.address || params.buyToken.symbol,
                hashlock: hashlockHex,
                bchContractAddress: contractAddress,
                sourceTimelock: Number(timelock),
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
    // Movement → BCH: Create on-chain HTLC escrow on Movement, notify relayer
    // =========================================================================
    const executeMovementToBCH = async (params: BCHSwapParams, recipientBCHAddress: string) => {
        const currentWdk = wdkRef.current;

        // Require WDK Movement account
        if (!currentWdk.movementAddress || !currentWdk.movementAccount) {
            throw new Error('Connect your WDK wallet first — Movement account not available');
        }
        if (!recipientBCHAddress) throw new Error('BCH recipient address required');

        const { secretHex, hashlockHex, hashlockArray } = await generateHashlock();
        console.log('[MOV→BCH] Starting Movement to BCH swap, hashlock:', hashlockHex);

        // 1. Fetch relayer BCH address and Movement address from /health
        setSwapStep('Getting relayer info...');
        let relayerMovementAddress = '';
        try {
            const healthRes = await axios.get(`${BCH_SOLANA_RELAYER_URL}/health`);
            relayerMovementAddress =
                healthRes.data.movement?.address ||
                healthRes.data.wallets?.movement?.address ||
                healthRes.data.pubkeys?.movement ||
                '';
        } catch {
            // Fallback — relayer address should come from health check
            console.warn('[MOV→BCH] Could not fetch relayer health, proceeding without relayer Movement address');
        }

        if (!relayerMovementAddress) {
            throw new Error('Relayer Movement address not available — ensure bch-solana-relayer is running');
        }

        // 2. Create HTLC escrow on Movement
        setSwapStep('Creating HTLC escrow on Movement...');
        const MOVEMENT_HTLC_ADDR = '0x485ca1c12b5dfa01c282b9c7ef09fdfebbf877ed729bf999ce61a8ec5c5e69bd';
        const amountOctas = Math.floor(params.sellAmount * Math.pow(10, params.sellToken.decimals || 8));
        let coinType = '0x1::aptos_coin::AptosCoin';
        if (params.sellToken.address && params.sellToken.address.includes('::')) {
            coinType = params.sellToken.address;
        } else if (params.sellToken.type && params.sellToken.type.includes('::')) {
            coinType = params.sellToken.type;
        } else if (params.sellToken.symbol?.includes('ETH') || params.sellToken.symbol?.includes('WETH')) {
            coinType = '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::WETH';
        }

        let sourceEscrowId = 0;
        let escrowTxHash = '';
        try {
            const { Aptos, AptosConfig, Network } = await import('@aptos-labs/ts-sdk');
            const aptosClient = new Aptos(new AptosConfig({
                network: Network.CUSTOM,
                fullnode: 'https://testnet.movementnetwork.xyz/v1',
            }));

            // Get current escrow count BEFORE creating (to predict new ID)
            try {
                const registryStats = await aptosClient.view({
                    payload: {
                        function: `${MOVEMENT_HTLC_ADDR}::htlc_escrow::get_registry_stats`,
                        typeArguments: [coinType],
                        functionArguments: [MOVEMENT_HTLC_ADDR],
                    },
                });
                sourceEscrowId = parseInt(registryStats[0] as string);
                console.log('[MOV→BCH] Predicted escrow ID:', sourceEscrowId);
            } catch (e) {
                console.warn('[MOV→BCH] Could not get registry stats, using 0 as fallback:', e);
            }

            // Get chain time for expiry
            const ledgerInfo = await aptosClient.getLedgerInfo();
            const chainTime = Math.floor(parseInt(ledgerInfo.ledger_timestamp) / 1000000);
            const expireTimestamp = chainTime + 600; // 10 min tx window

            // Build and submit the create_escrow transaction signed by the WDK Movement account
            const rawTx = await aptosClient.transaction.build.simple({
                sender: currentWdk.movementAccount.accountAddress,
                data: {
                    function: `${MOVEMENT_HTLC_ADDR}::htlc_escrow::create_escrow`,
                    typeArguments: [coinType],
                    functionArguments: [
                        MOVEMENT_HTLC_ADDR,
                        hashlockArray,
                        relayerMovementAddress,
                        amountOctas.toString(),
                        3600, // 1 hour timelock
                    ],
                },
                options: { expireTimestamp },
            });

            const pendingTx = await aptosClient.signAndSubmitTransaction({
                signer: currentWdk.movementAccount,
                transaction: rawTx,
            });
            escrowTxHash = pendingTx.hash;
            console.log('[MOV→BCH] Escrow TX submitted:', escrowTxHash);

            // Wait for confirmation and refine escrow ID from events if available
            const confirmed = await aptosClient.waitForTransaction({ transactionHash: escrowTxHash });
            console.log('[MOV→BCH] Escrow TX confirmed:', (confirmed as any).success ? 'SUCCESS' : 'FAILED');
            if ('events' in confirmed) {
                const escrowEvent = (confirmed.events as any[]).find((e: any) =>
                    e.type?.includes('::htlc_escrow::NewEscrowEvent')
                );
                if (escrowEvent?.data?.escrow_id !== undefined) {
                    sourceEscrowId = Number(escrowEvent.data.escrow_id);
                    console.log('[MOV→BCH] ✅ Confirmed on-chain Escrow ID:', sourceEscrowId);
                }
            }

            toast.success(`${params.sellToken.symbol} locked in HTLC escrow!`, { description: `Tx: ${escrowTxHash.slice(0, 16)}...` });
        } catch (e: any) {
            throw new Error(`Failed to create Movement HTLC escrow: ${e.message}`);
        }

        // 3. Notify relayer — it will watch the escrow and deliver BCH
        setSwapStep('Notifying relayer...');
        try {
            const response = await axios.post(`${BCH_SOLANA_RELAYER_URL}/swap/move-to-bch`, {
                makerAddress: currentWdk.movementAddress,
                recipientAddress: recipientBCHAddress,
                sellAmount: amountOctas.toString(),
                sellToken: params.sellToken.address || params.sellToken.symbol,
                buyAmount: Math.floor(params.buyAmount * 1e8).toString(),
                hashlock: hashlockHex,
                sourceEscrowId: sourceEscrowId,
                escrowTxHash,
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
                explorerUrl: `https://explorer.movementnetwork.xyz/txn/${escrowTxHash}?network=testnet`,
                createdAt: Date.now(),
                claimData: {
                    hashlock: hashlockHex,
                    secret: secretHex,
                    movementEscrowId: String(sourceEscrowId),
                    escrowTxHash,
                    direction: 'MOV_TO_BCH',
                },
            };

            saveOrder(order);
            setSwapStep('');
            toast.success('Cross-chain swap initiated!', {
                description: 'The relayer will deliver BCH to your address.',
            });
        } catch (e: any) {
            throw new Error(`Relayer error: ${e.response?.data?.error || e.message}`);
        }
    };

    // =========================================================================
    // Solana → Movement: HTLC path via Anchor on Solana & Move module on Movement
    // =========================================================================
    const executeSolanaToMovement = async (params: BCHSwapParams, recipientMovAddress: string) => {
        const sw = solanaWalletRef.current;
        if (!sw?.publicKey) throw new Error('Connect your Solana / WDK wallet first');
        if (!recipientMovAddress) throw new Error('Movement recipient address required');

        const { secretHex, hashlockHex } = await generateHashlock();
        const hashlockBytes = Buffer.from(hashlockHex.replace('0x', ''), 'hex');

        setSwapStep('Getting relayer info...');
        let relayerSolAddress = '';
        try {
            const healthRes = await axios.get(`${BCH_SOLANA_RELAYER_URL}/health`);
            relayerSolAddress = healthRes.data?.pubkeys?.solana
                || healthRes.data?.wallets?.solana?.address
                || healthRes.data?.solana?.address
                || '';
        } catch { }
        if (!relayerSolAddress) {
            relayerSolAddress = 'VBmpGVzabx8AsptQXrA2okEwqFVjbuosHvR2NkuBoaS';
        }

        const { PublicKey, SystemProgram } = await import('@solana/web3.js');
        const { getAssociatedTokenAddress, createSyncNativeInstruction, NATIVE_MINT, TOKEN_PROGRAM_ID } = await import('@solana/spl-token');
        const anchor = await import('@coral-xyz/anchor');
        const idlModule = await import('@/lib/intent_swap.json');
        const idl = idlModule.default || idlModule;

        const programId = new PublicKey(idl.address || '5JAWumq5L4B8WrpF3CFox36SZ2bJF4xQvskLksmHRgs2');
        const relayerPubkey = new PublicKey(relayerSolAddress);

        const isNativeSol = params.sellToken.chain === 'solana' && (params.sellToken.symbol === 'SOL' || params.sellToken.type === 'native');
        const tokenMint = isNativeSol ? NATIVE_MINT : new PublicKey(params.sellToken.address || NATIVE_MINT.toBase58());
        const sellAmountLamports = new anchor.BN(Math.floor(params.sellAmount * Math.pow(10, params.sellToken.decimals || 9)));

        const [escrowPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("escrow"), sw.publicKey.toBuffer(), hashlockBytes],
            programId
        );
        const [vaultPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("vault"), escrowPda.toBuffer()],
            programId
        );

        const makerTokenAccount = await getAssociatedTokenAddress(tokenMint, sw.publicKey);

        setSwapStep('Creating Solana Escrow...');
        const timelockDuration = new anchor.BN(3600); // 1 hour

        const provider = new anchor.AnchorProvider(
            solanaConnection,
            sw as any,
            { preflightCommitment: 'confirmed' }
        );
        const program = new anchor.Program(idl as any, provider);

        const preIxs = [];
        const makerAtaInfo = await solanaConnection.getAccountInfo(makerTokenAccount);
        if (!makerAtaInfo) {
            const { createAssociatedTokenAccountInstruction } = await import('@solana/spl-token');
            preIxs.push(
                createAssociatedTokenAccountInstruction(
                    sw.publicKey,
                    makerTokenAccount,
                    sw.publicKey,
                    tokenMint
                )
            );
        }
        if (tokenMint.equals(NATIVE_MINT)) {
            preIxs.push(
                SystemProgram.transfer({
                    fromPubkey: sw.publicKey,
                    toPubkey: makerTokenAccount,
                    lamports: BigInt(sellAmountLamports.toString())
                })
            );
            preIxs.push(createSyncNativeInstruction(makerTokenAccount));
        }

        let solTxHash = '';
        try {
            const builder = (program.methods as any)
                .initialize(
                    [...hashlockBytes],
                    timelockDuration,
                    sellAmountLamports
                )
                .accounts({
                    maker: sw.publicKey,
                    taker: relayerPubkey,
                    tokenMint: tokenMint,
                    escrow: escrowPda,
                    makerTokenAccount: makerTokenAccount,
                    vault: vaultPda,
                    systemProgram: SystemProgram.programId,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                });

            if (preIxs.length > 0) {
                builder.preInstructions(preIxs);
            }

            solTxHash = await builder.rpc();
            console.log('[SOL→MOV] Solana Escrow Created:', solTxHash);
            toast.success('Funds locked on Solana!', { description: `Escrow PDA: ${escrowPda.toBase58().slice(0, 12)}...` });
        } catch (e: any) {
            throw new Error(`Failed to create Solana Escrow: ${e.message}`);
        }

        setSwapStep('Notifying relayer...');
        try {
            const buyAmountOctas = Math.floor(params.buyAmount * Math.pow(10, params.buyToken.decimals || 8)).toString();
            const response = await axios.post(`${BCH_SOLANA_RELAYER_URL}/swap/sol-to-move`, {
                makerAddress: sw.publicKey.toBase58(),
                recipientAddress: recipientMovAddress,
                sellAmount: sellAmountLamports.toString(),
                sellToken: params.sellToken.address || params.sellToken.symbol,
                buyAmount: buyAmountOctas,
                buyToken: params.buyToken.address || params.buyToken.symbol,
                hashlock: hashlockHex,
                solanaEscrowPda: escrowPda.toBase58(),
                escrowTxHash: solTxHash,
                sourceTimelock: Math.floor(Date.now() / 1000) + 3600,
            });

            const intent = response.data.intent;
            const order: BCHOrder = {
                id: intent?.id || `sol_mov_${Date.now()}`,
                swapType: 'sol-to-mov',
                orderType: params.orderType,
                sellToken: params.sellToken,
                buyToken: params.buyToken,
                sellAmount: params.sellAmount,
                buyAmount: params.buyAmount,
                status: 'pending',
                intentId: intent?.id,
                explorerUrl: `https://explorer.solana.com/tx/${solTxHash}?cluster=devnet`,
                createdAt: Date.now(),
                claimData: {
                    hashlock: hashlockHex,
                    secret: secretHex,
                    solanaEscrowPda: escrowPda.toBase58(),
                    direction: 'SOL_TO_MOV',
                },
            };

            saveOrder(order);
            setSwapStep('');
            toast.success('Cross-chain swap initiated!', {
                description: 'Relayer is locking funds on Movement.',
            });
        } catch (e: any) {
            throw new Error(`Relayer error: ${e.response?.data?.error || e.message}`);
        }
    };

    // =========================================================================
    // Movement → Solana: HTLC path via Move module on Movement & Anchor on Solana
    // =========================================================================
    const executeMovementToSolana = async (params: BCHSwapParams, recipientSolAddress: string) => {
        const currentWdk = wdkRef.current;
        if (!currentWdk.movementAddress || !currentWdk.movementAccount) {
            throw new Error('Connect your WDK wallet first — Movement account not available');
        }
        if (!recipientSolAddress) throw new Error('Solana recipient address required');

        const { secretHex, hashlockHex, hashlockArray } = await generateHashlock();

        setSwapStep('Getting relayer info...');
        let relayerMovementAddress = '';
        try {
            const healthRes = await axios.get(`${BCH_SOLANA_RELAYER_URL}/health`);
            relayerMovementAddress = healthRes.data?.wallets?.movement?.address
                || healthRes.data?.pubkeys?.movement
                || healthRes.data?.movement?.address
                || '';
        } catch { }
        if (!relayerMovementAddress) {
            relayerMovementAddress = '0xd57dba6e185993b1bdff1bd947b619d274690eecca18310f1fc911d7e35f1de6';
        }

        setSwapStep(`Locking ${params.sellToken.symbol} on Movement...`);
        const { Aptos, AptosConfig, Network } = await import('@aptos-labs/ts-sdk');
        const aptosClient = new Aptos(new AptosConfig({
            network: Network.CUSTOM,
            fullnode: 'https://testnet.movementnetwork.xyz/v1',
        }));

        const MOVEMENT_HTLC_ADDR = '0x485ca1c12b5dfa01c282b9c7ef09fdfebbf877ed729bf999ce61a8ec5c5e69bd';
        const decimals = params.sellToken.decimals || 8;
        const amountOctas = BigInt(Math.floor(params.sellAmount * Math.pow(10, decimals)));

        let coinType = '0x1::aptos_coin::AptosCoin';
        if (params.sellToken.address && params.sellToken.address.includes('::')) {
            coinType = params.sellToken.address;
        } else if (params.sellToken.symbol?.includes('ETH') || params.sellToken.symbol?.includes('WETH')) {
            coinType = '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::WETH';
        }

        let sourceEscrowId = 0;
        let escrowTxHash = '';
        try {
            try {
                const registryStats = await aptosClient.view({
                    payload: {
                        function: `${MOVEMENT_HTLC_ADDR}::htlc_escrow::get_registry_stats`,
                        typeArguments: [coinType],
                        functionArguments: [MOVEMENT_HTLC_ADDR],
                    },
                });
                sourceEscrowId = parseInt(registryStats[0] as string);
            } catch (e) {
                console.warn('[MOV→SOL] Could not get registry stats, using 0 as fallback:', e);
            }

            const ledgerInfo = await aptosClient.getLedgerInfo();
            const chainTime = Math.floor(parseInt(ledgerInfo.ledger_timestamp) / 1000000);
            const expireTimestamp = chainTime + 600;

            const rawTx = await aptosClient.transaction.build.simple({
                sender: currentWdk.movementAccount.accountAddress,
                data: {
                    function: `${MOVEMENT_HTLC_ADDR}::htlc_escrow::create_escrow`,
                    typeArguments: [coinType],
                    functionArguments: [
                        MOVEMENT_HTLC_ADDR,
                        hashlockArray,
                        relayerMovementAddress,
                        amountOctas.toString(),
                        3600,
                    ],
                },
                options: { expireTimestamp },
            });

            const pendingTx = await aptosClient.signAndSubmitTransaction({
                signer: currentWdk.movementAccount,
                transaction: rawTx,
            });
            escrowTxHash = pendingTx.hash;

            const confirmed = await aptosClient.waitForTransaction({ transactionHash: escrowTxHash });
            if ('events' in confirmed) {
                const escrowEvent = (confirmed.events as any[]).find((e: any) =>
                    e.type?.includes('::htlc_escrow::NewEscrowEvent')
                );
                if (escrowEvent?.data?.escrow_id !== undefined) {
                    sourceEscrowId = Number(escrowEvent.data.escrow_id);
                }
            }

            toast.success(`${params.sellToken.symbol} locked in HTLC escrow!`, { description: `Tx: ${escrowTxHash.slice(0, 16)}...` });
        } catch (e: any) {
            throw new Error(`Failed to create Movement HTLC escrow: ${e.message}`);
        }

        setSwapStep('Notifying relayer...');
        try {
            const buyAmountLamports = Math.floor(params.buyAmount * Math.pow(10, params.buyToken.decimals || 9)).toString();
            const response = await axios.post(`${BCH_SOLANA_RELAYER_URL}/swap/move-to-sol`, {
                makerAddress: currentWdk.movementAddress,
                recipientAddress: recipientSolAddress,
                sellAmount: amountOctas.toString(),
                sellToken: params.sellToken.address || params.sellToken.symbol,
                buyAmount: buyAmountLamports,
                buyToken: params.buyToken.address || params.buyToken.symbol,
                hashlock: hashlockHex,
                sourceEscrowId: sourceEscrowId,
                escrowTxHash,
                sourceTimelock: Math.floor(Date.now() / 1000) + 3600,
            });

            const intent = response.data.intent;
            const order: BCHOrder = {
                id: intent?.id || `mov_sol_${Date.now()}`,
                swapType: 'mov-to-sol',
                orderType: params.orderType,
                sellToken: params.sellToken,
                buyToken: params.buyToken,
                sellAmount: params.sellAmount,
                buyAmount: params.buyAmount,
                status: 'pending',
                intentId: intent?.id,
                explorerUrl: `https://explorer.movementnetwork.xyz/txn/${escrowTxHash}?network=testnet`,
                createdAt: Date.now(),
                claimData: {
                    hashlock: hashlockHex,
                    secret: secretHex,
                    movementEscrowId: String(sourceEscrowId),
                    escrowTxHash,
                    direction: 'MOV_TO_SOL',
                },
            };

            saveOrder(order);
            setSwapStep('');
            toast.success('Cross-chain swap initiated!', {
                description: 'Relayer is locking funds on Solana.',
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

        const sellChain = params.sellToken.chain || 'ethereum';
        const evmCfg = getEVMChainConfig(sellChain, isMainnet);
        if (!evmCfg) throw new Error(`Unknown EVM chain: ${sellChain}`);
        if (!evmCfg.deployed || !evmCfg.friVerifierHTLC) {
            throw new Error(`${evmCfg.name} swaps are not yet available — contract not deployed`);
        }

        const isNativeToken = params.sellToken.type === 'native';
        const tokenAddress = (!isNativeToken && params.sellToken.address)
            ? params.sellToken.address
            : '0x0000000000000000000000000000000000000000';

        const sellAmountWei = toWei(params.sellAmount.toString(), params.sellToken.decimals || 18);
        const chainServerName = isMainnet
            ? (CHAIN_TO_SERVER_NAME_MAINNET[sellChain] ?? sellChain)
            : (CHAIN_TO_SERVER_NAME[sellChain] ?? sellChain);

        const { secretHex, hashlockHex } = await generateHashlock();

        const sellTokenLabel = isNativeToken ? evmCfg.nativeCurrency : params.sellToken.symbol;
        setSwapStep(isNativeToken
            ? `Locking ${sellTokenLabel} in HTLC escrow on ${evmCfg.name}...`
            : `Approving & locking ${sellTokenLabel} in HTLC escrow on ${evmCfg.name}...`
        );
        let starkEscrowId: string;
        try {
            starkEscrowId = await createHTLCEscrow(
                evmSigner,
                hashlockHex,
                solverEvmAddr,
                timelockDuration,
                tokenAddress,
                sellAmountWei,
                isMainnet,
            );
            toast.success(`${sellTokenLabel} locked in HTLC escrow!`, { description: `Escrow ID: ${starkEscrowId}` });
        } catch (e: any) {
            throw new Error(`HTLC escrow failed: ${e.message}`);
        }

        setSwapStep('Notifying solver...');
        try {
            const buyAmountSats = Math.floor(params.buyAmount * 1e8).toString();
            const evmTokenAddress = isNativeToken ? undefined : params.sellToken.address;

            const { intentId } = await createEVMToBCHIntent({
                makerAddress: makerEvmAddress,
                recipientAddress,
                sellAmount: sellAmountWei,
                buyAmount: buyAmountSats,
                hashlock: hashlockHex,
                evmEscrowId: starkEscrowId,
                useStark: false,
                evmTokenAddress,
                chainName: chainServerName,
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
                explorerUrl: `${evmCfg.explorer}/address/${starkEscrowId}`,
                createdAt: Date.now(),
                claimData: { hashlock: hashlockHex, secret: secretHex, evmEscrowId: starkEscrowId, direction: 'ETH_TO_BCH' },
            };

            saveOrder(order);
            setSwapStep('');
            toast.success('HTLC swap initiated!', {
                description: `Server fills BCH. Reveal secret to claim payout.`,
            });
        } catch (e: any) {
            throw new Error(`Solver error: ${e.message}`);
        }
    };

    // =========================================================================
    // BCH → ETH: Fund StarkVerifierFRIPhaseB P2SH32 covenant, notify bsc-bch-server (ZK, auto-complete)
    // =========================================================================
    const executeBCHToETH = async (params: BCHSwapParams, _recipientAddress: string) => {
        const { isMainActive, activeExtWallet } = activeWalletRef.current;
        // if (!isMainActive) throw new Error('External wallets cannot sign advanced ZK swaps yet. Please use the WDK Main Wallet.');
        const currentBchWallet = bchWalletRef.current;
        const currentWdk = wdkRef.current;
        if (!currentBchWallet.address) throw new Error('Connect your BCH wallet first');
        if (!currentWdk.evmAddress) throw new Error('EVM address not available in WDK wallet');

        const wif = currentBchWallet.getWIF();

        const isMainnet = currentWdk.bchNetwork === 'mainnet';
        const { secretHex, hashlockHex, hashlockArray } = await generateHashlock();

        // 1. Get relayer BCH address and derive HTLC covenant
        setSwapStep('Getting relayer info...');
        let relayerBchAddress: string;
        try {
            const healthRes = await axios.get(`${BCH_SOLANA_RELAYER_URL}/solver`);
            relayerBchAddress = healthRes.data?.wallets?.bch?.address || 'bchtest:qzufsn0wtcmc4lhc3s3trhl0nxn6dgkpmgvzngkxl7';
        } catch {
            relayerBchAddress = 'bchtest:qzufsn0wtcmc4lhc3s3trhl0nxn6dgkpmgvzngkxl7';
        }

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

        const userPkh = derivePkh(currentBchWallet.address!);
        const relayerPkh = derivePkh(relayerBchAddress);
        const covenantTimelock = Math.floor(Date.now() / 1000) + 7200; // 2 hours from now

        const { Contract, ElectrumNetworkProvider, TransactionBuilder, SignatureTemplate } = await getCashScript();
        const provider = new ElectrumNetworkProvider(isMainnet ? 'mainnet' : 'chipnet');
        const contract = new Contract(
            artifact,
            [userPkh, relayerPkh, hashlockArray, BigInt(covenantTimelock)],
            { provider }
        );
        const starkCovenantAddress = contract.address;
        console.log('[BCH→ETH] HTLC covenant address:', starkCovenantAddress, 'timelock:', covenantTimelock);

        // 2. Fund the P2SH32 covenant using TransactionBuilder + raw lockingBytecode
        //    — supports both native BCH and CashToken (e.g. PUSD) sell side
        setSwapStep('Funding BCH HTLC covenant...');
        let fundTxId: string;
        const isCashToken = !!params.sellToken.categoryId;
        try {
            const lockResult = cashAddressToLockingBytecode(starkCovenantAddress);
            if (typeof lockResult === 'string') throw new Error(`Invalid covenant address: ${lockResult}`);
            const lockingBytecode = lockResult.bytecode;

            const allUtxos = await provider.getUtxos(currentBchWallet.address!);
            const unlocker = isMainActive
                ? new SignatureTemplate(wif!).unlockP2PKH()
                : { unlockingBytecode: new Uint8Array(0) } as any;

            // Dynamic fee: 2 sat/byte
            const estimateFee = (numIn: number, numOut: number) =>
                BigInt(Math.ceil((numIn * 148 + numOut * 34 + 10) * 2));

            const builder = new TransactionBuilder({ provider });
            // allInputs tracks every UTXO added to the builder so the WC2 path
            // (external wallet) can pass them to buildWC2SourceOutputs.
            const allInputs: any[] = [];

            if (isCashToken) {
                // ── CashToken path ────────────────────────────────────────────
                const sellDecimals = params.sellToken.decimals ?? 0;
                const tokenAmountRaw = BigInt(Math.round(params.sellAmount * Math.pow(10, sellDecimals)));
                const category = params.sellToken.categoryId!;

                const tokenUtxos = allUtxos.filter((u: any) =>
                    u.token?.category === category && BigInt(u.token.amount) >= tokenAmountRaw
                );
                if (!tokenUtxos.length) {
                    throw new Error(
                        `No ${params.sellToken.symbol} token UTXO with ≥ ${params.sellAmount} ${params.sellToken.symbol} found. ` +
                        `Make sure your wallet holds enough ${params.sellToken.symbol} on ${isMainnet ? 'mainnet' : 'chipnet'}.`
                    );
                }
                const tokenUtxo = tokenUtxos[0];

                const DUST = 1000n;
                const plainUtxos = allUtxos.filter((u: any) => !u.token)
                    .sort((a: any, b: any) => Number(b.satoshis - a.satoshis));
                if (!plainUtxos.length) throw new Error('No plain BCH UTXOs to cover dust + fee. Send a small amount of BCH to your wallet.');

                const tokenChange = BigInt(tokenUtxo.token.amount) - tokenAmountRaw;
                const TOKEN_CHANGE_DUST = tokenChange > 0n ? 1000n : 0n; // CashToken outputs require >= 657 sats

                const selectedPlain: any[] = [];
                let totalPlain = 0n;
                for (const u of plainUtxos) {
                    selectedPlain.push(u);
                    totalPlain += u.satoshis;
                    if (totalPlain >= DUST + TOKEN_CHANGE_DUST + estimateFee(selectedPlain.length + 1, 3)) break;
                }
                const fee = estimateFee(selectedPlain.length + 1, 3);
                const changeNative = totalPlain + tokenUtxo.satoshis - DUST - TOKEN_CHANGE_DUST - fee;
                if (changeNative < 0n) throw new Error('Insufficient BCH to cover dust and fee');

                builder.addInput(tokenUtxo, unlocker);
                builder.addInputs(selectedPlain, unlocker);
                allInputs.push(tokenUtxo, ...selectedPlain);

                // Token change must return to a token-aware address (p2pkhWithTokens)
                const { lockingBytecodeToCashAddress } = await import('@bitauth/libauth');
                const selfDecoded = cashAddressToLockingBytecode(currentBchWallet.address!);
                if (typeof selfDecoded === 'string') throw new Error(`Invalid wallet address: ${selfDecoded}`);
                const selfTokenAddr = lockingBytecodeToCashAddress({
                    bytecode: selfDecoded.bytecode,
                    prefix: (isMainnet ? 'bitcoincash' : 'bchtest') as any,
                    tokenSupport: true,
                });
                if (typeof selfTokenAddr === 'string') throw new Error(`Cannot derive token address: ${selfTokenAddr}`);

                builder.addOutput({ to: lockingBytecode, amount: DUST, token: { category, amount: tokenAmountRaw } });
                if (tokenChange > 0n) {
                    builder.addOutput({ to: selfTokenAddr.address, amount: TOKEN_CHANGE_DUST, token: { category, amount: tokenChange } });
                }
                if (changeNative >= 546n) {
                    builder.addOutput({ to: currentBchWallet.address!, amount: changeNative });
                }
                console.log(`[BCH→ETH] CashToken swap: ${tokenAmountRaw} × ${category.slice(0, 12)}… → covenant ${starkCovenantAddress}`);
            } else {
                // ── Native BCH path ───────────────────────────────────────────
                const sortedUtxos = allUtxos.filter((u: any) => !u.token)
                    .sort((a: any, b: any) => Number(b.satoshis - a.satoshis));
                if (!sortedUtxos.length) throw new Error('No plain BCH UTXOs available — fund your wallet or consolidate UTXOs first');

                const amountSats = BigInt(Math.floor(params.sellAmount * 1e8));
                const nativeSelected: any[] = [];
                let totalInput = 0n;
                for (const u of sortedUtxos) {
                    nativeSelected.push(u);
                    totalInput += u.satoshis;
                    if (totalInput >= amountSats + estimateFee(nativeSelected.length, 2)) break;
                }
                const fee = estimateFee(nativeSelected.length, 2);
                const change = totalInput - amountSats - fee;
                if (change < 0n) throw new Error('Insufficient BCH balance');

                builder.addInputs(nativeSelected, unlocker);
                allInputs.push(...nativeSelected);
                builder.addOutput({ to: lockingBytecode, amount: amountSats });
                if (change >= 546n) {
                    builder.addOutput({ to: currentBchWallet.address!, amount: change });
                }
            }

            if (isMainActive) {
                const tx = await builder.send();
                fundTxId = tx.txid;
                console.log('[BCH→ETH] Covenant funded:', fundTxId);
                toast.success('BCH locked in ZK covenant!', { description: `Tx: ${fundTxId.slice(0, 16)}...` });
            } else {
                if (!activeExtWallet) throw new Error('No active external wallet found.');
                const { buildWC2SourceOutputs, buildWC2Payload } = await import('@/lib/wc2Serialize');

                setSwapStep('Waiting for wallet approval...');
                toast.info('Check your external wallet to approve the transaction.', { duration: 8000 });

                const utxoIndices = allInputs.map((_: any, i: number) => i);
                const sourceOutputs = await buildWC2SourceOutputs(allInputs, utxoIndices, currentBchWallet.address!);
                const unsignedHex = builder.build();

                const payload = buildWC2Payload(
                    unsignedHex,
                    sourceOutputs,
                    `Fund ZK covenant`
                );

                const result = await extBCHCtx.signTransaction(activeWalletId, payload);
                fundTxId = result.signedTransactionHash;
                console.log('[BCH→ETH] Covenant funded via external wallet:', fundTxId);
                toast.success('BCH locked in ZK covenant!');
            }
        } catch (e: any) {
            throw new Error(`Failed to fund BCH covenant: ${e.message}`);
        }

        // 3. Notify solver
        setSwapStep('Notifying solver...');
        try {
            const buyChain = params.buyToken.chain || 'ethereum';
            const buyEvmCfg = getEVMChainConfig(buyChain, isMainnet);
            const chainServerName = isMainnet
                ? (CHAIN_TO_SERVER_NAME_MAINNET[buyChain] ?? buyChain)
                : (CHAIN_TO_SERVER_NAME[buyChain] ?? buyChain);

            const isBuyNative = params.buyToken.type === 'native';
            const evmTokenAddress = isBuyNative ? undefined : params.buyToken.address;

            // For CashToken sells: sellAmount is the human-readable token amount.
            // The solver needs the raw token units (respecting token decimals), and
            // we pass 1000 sat (DUST) as the on-chain satoshi amount.
            let sellAmountForServer: string;
            let bchTokenPayload: { category: string; amount: string } | undefined;
            if (isCashToken) {
                const sellDecimals = params.sellToken.decimals ?? 0;
                const tokenAmountRaw = Math.round(params.sellAmount * Math.pow(10, sellDecimals));
                bchTokenPayload = {
                    category: params.sellToken.categoryId!,
                    amount: tokenAmountRaw.toString(),
                };
                sellAmountForServer = '1000'; // dust sats locked with token
            } else {
                sellAmountForServer = Math.floor(params.sellAmount * 1e8).toString();
            }

            const buyAmountWei = toWei(params.buyAmount.toString(), params.buyToken.decimals || 18);

            const { intentId } = await createBCHToEVMIntent({
                makerAddress: currentBchWallet.address!,
                recipientAddress: currentWdk.evmAddress!,
                sellAmount: sellAmountForServer,
                buyAmount: buyAmountWei,
                hashlock: hashlockHex,
                timelock: covenantTimelock,
                bchContractAddress: starkCovenantAddress,
                evmTokenAddress,
                chainName: chainServerName,
                expiryTime: params.orderType === 'limit' ? params.expiryTime : undefined,
                useStark: false,
                bchToken: bchTokenPayload,
            }, isMainnet);

            const buyExplorer = buyEvmCfg?.explorer ?? 'https://sepolia.etherscan.io';

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
                destExplorerUrl: `${buyExplorer}/address/${currentWdk.evmAddress!}`,
                createdAt: Date.now(),
                claimData: {
                    hashlock: hashlockHex,
                    secret: secretHex,
                    starkCovenantAddress,
                    evmRecipient: currentWdk.evmAddress!,
                    direction: 'BCH_TO_ETH',
                    sourceTimelock: covenantTimelock,
                    ...(bchTokenPayload ? { bchToken: bchTokenPayload } : {}),
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
        const isMainnet = wdkRef.current.bchNetwork === 'mainnet';
        if (chain === 'bch') return isMainnet
            ? `https://blockchair.com/bitcoin-cash/transaction/${txid}`
            : `https://chipnet.chaingraph.cash/tx/${txid}`;
        if (chain === 'solana') return `https://explorer.solana.com/tx/${txid}?cluster=${isMainnet ? 'mainnet-beta' : 'devnet'}`;
        if (chain === 'movement') return `https://explorer.movementnetwork.xyz/txn/${txid}?network=testnet`;
        if (isEvmChain(chain)) {
            const cfg = getEVMChainConfig(chain, isMainnet);
            return cfg ? `${cfg.explorer}/tx/${txid}` : `https://sepolia.etherscan.io/tx/${txid}`;
        }
        return isMainnet
            ? `https://blockchair.com/bitcoin-cash/transaction/${txid}`
            : `https://chipnet.chaingraph.cash/tx/${txid}`;
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
                // If the order is already in a terminal state (filled, claimed, cancelled, refunded), do not poll or revert it!
                if (isTerminalOrderStatus(order.status)) continue;

                try {
                    if (order.swapType === 'eth-to-bch' || order.swapType === 'bch-to-eth') {
                        // Poll bsc-bch-server for ETH↔BCH orders
                        const ethOrder = await getETHOrder(order.intentId);
                        const s = ethOrder.status;

                        // Ensure claimData is preserved and populated from server intent
                        order.claimData = {
                            ...order.claimData,
                            bchContractAddress: (ethOrder.raw?.bchContractAddress as string | undefined) || order.claimData?.bchContractAddress,
                            destTimelock: (ethOrder.raw?.destTimelock as number | undefined) || order.claimData?.destTimelock,
                            evmEscrowId: ethOrder.evmEscrowId || (ethOrder.raw?.bscEscrowId as string | undefined) || order.claimData?.evmEscrowId,
                            destFillTx: ethOrder.bchTxHash || ethOrder.evmFillTxHash || order.claimData?.destFillTx,
                        };

                        if (s === 'COMPLETED') {
                            // Server completed its leg — if the user hasn't claimed yet, make it claimable, else filled
                            if (order.status !== 'claimed') {
                                order.status = 'claimable';
                            } else {
                                order.status = 'filled';
                            }
                            if (order.swapType === 'eth-to-bch') {
                                if (ethOrder.bchTxHash) {
                                    order.fillTxid = ethOrder.bchTxHash;
                                }
                                if (ethOrder.evmClaimTxHash) {
                                    order.explorerUrl = buildExplorerUrl(ethOrder.evmClaimTxHash, order.sellToken.chain || 'ethereum');
                                }
                            } else {
                                if (ethOrder.evmFillTxHash) {
                                    order.fillTxid = ethOrder.evmFillTxHash;
                                }
                            }
                            updated = true;
                        } else if (s === 'REFUNDED') {
                            order.status = 'refunded';
                            updated = true;
                        } else if (s === 'FAILED' || s === 'EXPIRED') {
                            order.status = 'cancelled';
                            updated = true;
                        } else if (s === 'DEST_FILLED' || s === 'DEST_CLAIMED') {
                            order.status = 'claimable';
                            order.fillTxid = ethOrder.bchTxHash || ethOrder.evmFillTxHash;
                            if (order.swapType === 'eth-to-bch' && ethOrder.bchTxHash && !order.destExplorerUrl) {
                                order.destExplorerUrl = buildExplorerUrl(ethOrder.bchTxHash, 'bch');
                            } else if (order.swapType === 'bch-to-eth' && ethOrder.evmFillTxHash && !order.destExplorerUrl) {
                                order.destExplorerUrl = buildExplorerUrl(ethOrder.evmFillTxHash, order.buyToken.chain || 'ethereum');
                            }
                            updated = true;

                            // 🔔 Toast notification with Claim button
                            toast.info(`Your ${order.sellToken?.symbol} → ${order.buyToken?.symbol} swap is ready!`, {
                                description: 'Click Claim to complete your swap and receive funds.',
                                duration: 30000,
                                action: {
                                    label: '⚡ Claim Now',
                                    onClick: () => claimOrder(order.id),
                                },
                            });
                        } else if (
                            (s === 'SOURCE_LOCKED' || s === 'GENERATING_PROOF') &&
                            order.status !== 'proving'
                        ) {
                            // Source funded; solver is processing
                            order.status = 'proving';
                            updated = true;
                        } else if (s === 'PENDING' && order.status === 'pending') {
                            // No change, keep pending
                        }
                    } else if (order.swapType === 'same-chain') {
                        // Poll the CashToken relayer. Every non-terminal status is polled, not
                        // just 'pending': an order can legitimately sit in 'active', 'expired'
                        // (refund retrying) or 'failed' (funded, retrying on backoff) and still
                        // move afterwards. Gating on 'pending' froze all three.
                        const ctNet = wdkRef.current.bchNetwork;
                        const ctRelayerUrl = ctNet === 'mainnet' ? CASHTOKEN_RELAYER_MAINNET_URL : CASHTOKEN_RELAYER_URL;
                        try {
                            const res = await axios.get(`${ctRelayerUrl}/intent/${order.intentId}`);
                            const intent = res.data;
                            if (intent) {
                                const prevStatus = order.status;

                                // Mirror the relayer's status directly — it is the source of
                                // truth and now has states this used to silently drop
                                // ('abandoned' was unmapped entirely, so those orders polled
                                // forever showing "pending").
                                switch (intent.status) {
                                    case 'filled':
                                        order.status = 'filled';
                                        order.fillTxid = intent.fillTxid;
                                        order.explorerUrl = intent.fillExplorerUrl || intent.explorerUrl
                                            || (intent.fillTxid ? buildExplorerUrl(intent.fillTxid, 'bch') : undefined);
                                        break;
                                    case 'refunded':
                                        order.status = 'refunded';
                                        // The relayer writes refundTxid (not fillTxid) for refunds —
                                        // reading fillTxid here meant the refund link was always absent.
                                        order.refundTxid = intent.refundTxid ?? intent.fillTxid;
                                        if (order.refundTxid) {
                                            order.destExplorerUrl = intent.fillExplorerUrl
                                                || buildExplorerUrl(order.refundTxid, 'bch');
                                        }
                                        break;
                                    case 'cancelled':
                                        order.status = 'cancelled';
                                        order.cancelTxid = intent.cancelTxid;
                                        if (order.cancelTxid) {
                                            order.destExplorerUrl = intent.fillExplorerUrl
                                                || buildExplorerUrl(order.cancelTxid, 'bch');
                                        }
                                        break;
                                    case 'abandoned':
                                        // Created but never funded before the relayer's deadline.
                                        order.status = 'abandoned';
                                        break;
                                    case 'expired':
                                        // NOT terminal: past the fill window with the refund still
                                        // being retried. Keep polling so 'refunded' is picked up.
                                        order.status = 'expired';
                                        break;
                                    case 'failed':
                                        order.status = 'failed';
                                        break;
                                    case 'active':
                                    case 'pending':
                                        order.status = 'pending';
                                        break;
                                }

                                // Detail the relayer already tracked but nothing displayed.
                                order.fillableUntil    = intent.fillableUntil    ?? order.fillableUntil;
                                order.refundableFrom   = intent.refundableFrom   ?? order.refundableFrom;
                                order.lastSkipCategory = intent.lastSkipCategory ?? order.lastSkipCategory;
                                order.lastSkipReason   = intent.lastSkipReason   ?? order.lastSkipReason;
                                order.routeType        = intent.routeType        ?? order.routeType;

                                if (order.status !== prevStatus) updated = true;
                                else updated = updated || !!intent.lastSkipReason;
                            }
                        } catch (pollErr: any) {
                            // 404 means the relayer has no record — it keeps a 500-entry ring
                            // buffer, so an old order ages out. That is not the same as expiry,
                            // and labelling it 'expired' claimed a covenant state that never
                            // happened. Mark it unknown and stop polling.
                            if (pollErr?.response?.status === 404) {
                                order.status = 'unknown';
                                updated = true;
                            }
                            // Other errors (network down etc.) → silently skip this cycle
                        }
                    } else {
                        // Poll cross-chain relayer (HTLC path for all cross-chain pairs)
                        const res = await axios.get(`${BCH_SOLANA_RELAYER_URL}/intents/${order.intentId}`);
                        const intent = res.data.intent;
                        if (intent) {
                            // DEST_FILLED = relayer filled on destination, user can claim
                            if (intent.status === 'DEST_FILLED') {
                                if (order.status !== 'claimable') {
                                    order.status = 'claimable';
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
                                order.fillTxid = intent.destFillTx;
                                // Store claim data from relayer
                                order.claimData = {
                                    ...order.claimData,
                                    destFillTx: intent.destFillTx,
                                    solanaEscrowPda: intent.solanaEscrowPda || order.claimData?.solanaEscrowPda,
                                    bchContractAddress: intent.bchContractAddress || order.claimData?.bchContractAddress,
                                    movementEscrowId: String(intent.movementEscrowId || order.claimData?.movementEscrowId || ''),
                                    destTimelock: intent.destTimelock || order.claimData?.destTimelock,
                                };
                                // Build destination explorer URL
                                if (intent.destFillTx) {
                                    const _st = order.swapType as string;
                                    const destChain = (_st === 'bch-to-mov' || _st === 'sol-to-mov') ? 'movement'
                                        : (_st === 'bch-to-sol' || _st === 'mov-to-sol') ? 'solana'
                                        : 'bch';
                                    order.destExplorerUrl = buildExplorerUrl(intent.destFillTx, destChain);
                                }
                            }

                            // COMPLETED = fully done
                            if (intent.status === 'COMPLETED' || intent.status === 'DEST_CLAIMED' || intent.status === 'SOURCE_CLAIMED') {
                                if (order.status !== 'filled') {
                                    order.status = 'filled';
                                    if (intent.destFillTx && !order.fillTxid) order.fillTxid = intent.destFillTx;
                                    if (intent.destClaimTx) {
                                        const _st2 = order.swapType as string;
                                        const destChain = (_st2 === 'bch-to-mov' || _st2 === 'sol-to-mov') ? 'movement'
                                            : (_st2 === 'bch-to-sol' || _st2 === 'mov-to-sol') ? 'solana'
                                            : 'bch';
                                        order.destExplorerUrl = buildExplorerUrl(intent.destClaimTx, destChain);
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
                {
                    const split = splitOrders(all);
                    setPendingOrders(split.pending);
                    setCompletedOrders(split.completed);
                }
            }
        } catch { /* ignore */ }
        finally {
            setIsLoading(false);
        }
    }, []);

    // =========================================================================
    // Live order updates from the relayer WebSocket
    //
    // The relayer has always broadcast intent:* events and nothing listened, so
    // status came only from a 15-30s poll. Fills now land in 8-24s, meaning the
    // poll interval — not the swap — was what users were waiting on.
    //
    // Polling is deliberately kept as a fallback (see the pollers in
    // BCHOrderTracker / LimitOrderHistory): a dropped socket should leave status
    // slightly stale, never silently frozen.
    // =========================================================================
    const handleRelayerEvent = useCallback((event: RelayerEvent) => {
        const intentId: string | undefined = event.data?.id ?? event.data?.intentId;
        if (!intentId) return;

        const key = getOrdersKey(wdkRef.current.bchNetwork);
        const saved = localStorage.getItem(key);
        if (!saved) return;

        let all: BCHOrder[];
        try { all = JSON.parse(saved); } catch { return; }

        const order = all.find(o => o.intentId === intentId);
        if (!order) return;   // an event for someone else's order, or another device

        // Trust the intent payload the relayer sends with the event; it is the same
        // shape /intent/:id returns, so this mirrors the polling path exactly rather
        // than inventing a second status mapping that could drift from it.
        const intent = event.data;
        const prev = order.status;

        switch (event.type) {
            case 'intent:filled':
                order.status = 'filled';
                order.fillTxid = intent.fillTxid ?? order.fillTxid;
                order.explorerUrl = intent.fillExplorerUrl ?? order.explorerUrl;
                break;
            case 'intent:refunded':
                order.status = 'refunded';
                order.refundTxid = intent.refundTxid ?? intent.fillTxid ?? order.refundTxid;
                order.destExplorerUrl = intent.fillExplorerUrl ?? order.destExplorerUrl;
                break;
            case 'intent:cancelled':
                order.status = 'cancelled';
                order.cancelTxid = intent.cancelTxid ?? order.cancelTxid;
                break;
            case 'intent:abandoned':
                order.status = 'abandoned';
                break;
            case 'intent:failed':
                order.status = 'failed';
                break;
            case 'intent:updated':
                // Covers pending→active and the 'expired' refund-pending state.
                if (intent.status === 'expired') order.status = 'expired';
                else if (intent.status === 'failed') order.status = 'failed';
                order.lastSkipCategory = intent.lastSkipCategory ?? order.lastSkipCategory;
                order.lastSkipReason = intent.lastSkipReason ?? order.lastSkipReason;
                order.routeType = intent.routeType ?? order.routeType;
                break;
            default:
                return;   // router:* events carry no per-order state
        }

        order.fillableUntil = intent.fillableUntil ?? order.fillableUntil;
        order.refundableFrom = intent.refundableFrom ?? order.refundableFrom;

        localStorage.setItem(key, JSON.stringify(all));
        const split = splitOrders(all);
        setPendingOrders(split.pending);
        setCompletedOrders(split.completed);

        if (order.status !== prev && isTerminalOrderStatus(order.status)) {
            const label = order.status === 'filled' ? 'Order filled'
                : order.status === 'refunded' ? 'Order refunded'
                : order.status === 'cancelled' ? 'Order cancelled'
                : 'Order closed';
            toast.success(label, {
                description: `${order.sellAmount} ${order.sellToken?.symbol} → ${order.buyAmount} ${order.buyToken?.symbol}`,
            });

            // Trigger immediate refresh of wallet balances
            queryClient.invalidateQueries({ queryKey: ['bch-balance'] });
            queryClient.invalidateQueries({ queryKey: ['bch-tokens'] });
            queryClient.invalidateQueries({ queryKey: ['portfolio'] });
        }
    }, [queryClient]);

    const { connected: relayerLive } = useRelayerEvents({
        network: wdk.bchNetwork === 'mainnet' ? 'mainnet' : 'chipnet',
        onEvent: handleRelayerEvent,
    });

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
            const direction = order.claimData.direction || (
                order.swapType === 'bch-to-sol' ? 'BCH_TO_SOL' :
                order.swapType === 'sol-to-bch' ? 'SOL_TO_BCH' :
                order.swapType === 'bch-to-mov' ? 'BCH_TO_MOV' :
                order.swapType === 'mov-to-bch' ? 'MOV_TO_BCH' :
                order.swapType === 'sol-to-mov' ? 'SOL_TO_MOV' :
                order.swapType === 'mov-to-sol' ? 'MOV_TO_SOL' :
                order.swapType === 'bch-to-eth' ? 'BCH_TO_ETH' :
                order.swapType === 'eth-to-bch' ? 'ETH_TO_BCH' : 'BCH_TO_SOL'
            );

            // If it's an ETH↔BCH swap, hydrate missing claim metadata from the relayer
            if ((order.swapType === 'bch-to-eth' || order.swapType === 'eth-to-bch' || direction === 'BCH_TO_ETH' || direction === 'ETH_TO_BCH') && order.intentId) {
                try {
                    const ethOrder = await getETHOrder(order.intentId, wdkRef.current.bchNetwork === 'mainnet');
                    order.claimData = {
                        ...order.claimData,
                        bchContractAddress: (ethOrder.raw?.bchContractAddress as string | undefined) || order.claimData?.bchContractAddress,
                        destTimelock: (ethOrder.raw?.destTimelock as number | undefined) || order.claimData?.destTimelock,
                        evmEscrowId: ethOrder.evmEscrowId || (ethOrder.raw?.bscEscrowId as string | undefined) || order.claimData?.evmEscrowId,
                        destFillTx: ethOrder.bchTxHash || ethOrder.evmFillTxHash || order.claimData?.destFillTx,
                        hashlock: (ethOrder.raw?.hashlock as string | undefined) || order.claimData?.hashlock,
                    };
                } catch (hydrateErr) {
                    console.warn('[Claim] Could not fetch intent from server:', hydrateErr);
                }
            }

            // If it's a Movement/Solana swap, hydrate missing claim metadata from the relayer
            if ((order.swapType === 'bch-to-mov' || order.swapType === 'mov-to-bch' || order.swapType === 'sol-to-mov' || order.swapType === 'mov-to-sol' || order.swapType === 'bch-to-sol' || order.swapType === 'sol-to-bch' || direction === 'BCH_TO_MOV' || direction === 'MOV_TO_BCH' || direction === 'SOL_TO_MOV' || direction === 'MOV_TO_SOL' || direction === 'BCH_TO_SOL' || direction === 'SOL_TO_BCH') && order.intentId) {
                try {
                    const movRes = await axios.get(`${BCH_SOLANA_RELAYER_URL}/intents/${order.intentId}`);
                    const intent = movRes.data?.intent;
                    if (intent) {
                        order.claimData = {
                            ...order.claimData,
                            movementEscrowId: String(intent.movementEscrowId || order.claimData?.movementEscrowId || ''),
                            solanaEscrowPda: intent.solanaEscrowPda || order.claimData?.solanaEscrowPda,
                            bchContractAddress: intent.bchContractAddress || order.claimData?.bchContractAddress,
                            destTimelock: intent.destTimelock || order.claimData?.destTimelock,
                            hashlock: intent.hashlock || order.claimData?.hashlock,
                            destFillTx: intent.destFillTx || order.claimData?.destFillTx,
                        };
                    }
                } catch (hydrateErr) {
                    console.warn('[Claim] Could not fetch intent from server:', hydrateErr);
                }
            }

            let claimTxid: string | undefined;

            if (direction === 'BCH_TO_SOL' || direction === 'MOV_TO_SOL') {
                // User claims on Solana (destination)
                setSwapStep('Claiming on Solana...');

                // Use ref so we always get the live WDK-derived signer even inside useCallback
                const sw = solanaWalletRef.current;
                if (!sw || !sw.publicKey || !sw.signTransaction) {
                    throw new Error('WDK wallet not connected — Solana signer unavailable');
                }

                // Derive PDAs
                const claimD = order.claimData ?? {};
                const makerPubKey = new PublicKey((claimD as any).solMaker || 'VBmpGVzabx8AsptQXrA2okEwqFVjbuosHvR2NkuBoaS'); // Relayer is Maker in BCH->SOL
                const hashBuf = Buffer.from(((claimD as any).hashlock ?? '').replace('0x', ''), 'hex');
                const secretBuf = Buffer.from(secret.replace('0x', ''), 'hex');

                // Get the token mint address (USDC or SOL NATIVE_MINT)
                const isBuyNativeSol = !order.buyToken?.address || order.buyToken.address === 'So11111111111111111111111111111111111111112';
                const tokenAddress = isBuyNativeSol ? 'So11111111111111111111111111111111111111112' : order.buyToken.address;
                const tokenMint = new PublicKey(tokenAddress!);

                let escrowPda: PublicKey;
                if ((claimD as any).solanaEscrowPda) {
                    escrowPda = new PublicKey((claimD as any).solanaEscrowPda);
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

            } else if (direction === 'BCH_TO_MOV' || direction === 'SOL_TO_MOV') {
                // User claims on Movement (destination) — applies to both BCH→MOV and SOL→MOV
                setSwapStep('Claiming on Movement...');
                const currentWdk = wdkRef.current;
                if (!currentWdk.movementAddress || !currentWdk.movementAccount) {
                    throw new Error('Connect your WDK wallet first — Movement account unavailable');
                }

                const escrowIdStr = order.claimData?.movementEscrowId;
                if (!escrowIdStr) {
                    throw new Error('Movement Escrow ID not available yet. Please wait a few seconds for the relayer to lock funds.');
                }
                const escrowId = parseInt(escrowIdStr);
                if (isNaN(escrowId)) {
                    throw new Error(`Invalid Movement Escrow ID: ${escrowIdStr}`);
                }

                console.log(`[Claim] Claiming Movement Escrow ID ${escrowId} with secret...`);
                const MOVEMENT_HTLC_ADDR = '0x485ca1c12b5dfa01c282b9c7ef09fdfebbf877ed729bf999ce61a8ec5c5e69bd';
                const secretBytes = Array.from(Buffer.from(secret.replace('0x', ''), 'hex'));

                let coinType = '0x1::aptos_coin::AptosCoin';
                if (order.buyToken.address && order.buyToken.address.includes('::')) {
                    coinType = order.buyToken.address;
                } else if (order.buyToken.type && order.buyToken.type.includes('::')) {
                    coinType = order.buyToken.type;
                } else if (order.buyToken.symbol?.includes('ETH') || order.buyToken.symbol?.includes('WETH')) {
                    coinType = '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::WETH';
                }

                try {
                    const { Aptos, AptosConfig, Network } = await import('@aptos-labs/ts-sdk');
                    const aptosClient = new Aptos(new AptosConfig({
                        network: Network.CUSTOM,
                        fullnode: 'https://testnet.movementnetwork.xyz/v1',
                    }));

                    const rawTx = await aptosClient.transaction.build.simple({
                        sender: currentWdk.movementAccount.accountAddress,
                        data: {
                            function: `${MOVEMENT_HTLC_ADDR}::htlc_escrow::claim`,
                            typeArguments: [coinType],
                            functionArguments: [
                                MOVEMENT_HTLC_ADDR,
                                escrowId,
                                secretBytes,
                            ],
                        },
                    });

                    const pendingTx = await aptosClient.signAndSubmitTransaction({
                        signer: currentWdk.movementAccount,
                        transaction: rawTx,
                    });
                    claimTxid = pendingTx.hash;
                    console.log('[Claim] Movement claim submitted:', claimTxid);

                    setSwapStep('Waiting for confirmation...');
                    await aptosClient.waitForTransaction({ transactionHash: claimTxid });
                    console.log('[Claim] Movement claim confirmed!');

                    // Notify relayer so it completes the BCH claim side immediately
                    try {
                        await axios.post(`${BCH_SOLANA_RELAYER_URL}/claim`, {
                            intentId: order.intentId || orderId,
                            secret,
                        });
                    } catch { }

                } catch (claimErr: any) {
                    const msg = claimErr?.message || '';
                    if (msg.includes('ALREADY_CLAIMED') || msg.includes('already claimed')) {
                        console.log('[Claim] Movement escrow was already claimed on-chain!');
                        claimTxid = order.fillTxid || 'already-claimed';
                    } else if (msg.includes('ETIMELOCK_EXPIRED') || msg.includes('0x8') || msg.includes('Timelock has expired')) {
                        console.warn('[Claim] Escrow timelock expired on Movement:', msg);
                        order.status = 'expired';
                        localStorage.setItem(claimKey, JSON.stringify(all));
                        const split = splitOrders(all);
                        setPendingOrders(split.pending);
                        setCompletedOrders(split.completed);
                        toast.error('Escrow timelock expired', {
                            description: 'The claim window has passed. You can refund your locked BCH.',
                            action: {
                                label: '⚡ Refund Now',
                                onClick: () => requestRefund(order.id),
                            },
                            duration: 20000,
                        });
                        return;
                    } else {
                        throw claimErr;
                    }
                }

            } else if (direction === 'SOL_TO_BCH' || direction === 'MOV_TO_BCH' || direction === 'ETH_TO_BCH') {
                // User claims on BCH (destination) — SOL→BCH, MOV→BCH, ETH→BCH
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

                let relayerBchAddress = '';
                if (direction === 'ETH_TO_BCH') {
                    try {
                        const solverInfo = await getSolverInfo(wdkRef.current.bchNetwork === 'mainnet');
                        relayerBchAddress = solverInfo.wallets?.bch?.address || '';
                    } catch { }
                    if (!relayerBchAddress || !relayerBchAddress.includes(':')) relayerBchAddress = 'bchtest:qzufsn0wtcmc4lhc3s3trhl0nxn6dgkpmgvzngkxl7';
                } else {
                    try {
                        const healthRes = await axios.get(`${BCH_SOLANA_RELAYER_URL}/health`);
                        relayerBchAddress = healthRes.data?.pubkeys?.bch
                            || healthRes.data?.wallets?.bch?.address
                            || healthRes.data?.bch?.address
                            || '';
                    } catch { }
                    if (!relayerBchAddress || !relayerBchAddress.includes(':')) {
                        relayerBchAddress = 'bchtest:qzufsn0wtcmc4lhc3s3trhl0nxn6dgkpmgvzngkxl7';
                    }
                }

                const makerPkh = derivePkh(relayerBchAddress);
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
                    throw new Error(`Contract address mismatch (got ${contractAddress}, expected ${order.claimData.bchContractAddress})`);
                }

                const utxos = await provider.getUtxos(contractAddress);
                if (utxos.length === 0) {
                    console.log('[Claim] BCH HTLC contract has already been claimed on-chain!');
                    claimTxid = order.fillTxid || 'already-claimed';
                } else {
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
                }

                // Best effort notify relayer so it completes the EVM/SOL claim side immediately
                try {
                    if (direction === 'ETH_TO_BCH') {
                        await postClaim(order.intentId || orderId, secret, undefined, wdkRef.current.bchNetwork === 'mainnet');
                    } else {
                        await axios.post(`${BCH_SOLANA_RELAYER_URL}/claim`, {
                            intentId: orderId,
                            secret,
                        });
                    }
                } catch { }

            } else if (direction === 'BCH_TO_ETH') {
                setSwapStep('Claiming tokens on EVM (Sepolia)...');
                const isMainnet = wdkRef.current.bchNetwork === 'mainnet';
                const currentWdk = wdkRef.current;
                let evmSigner: any = currentWdk.evmSigner;
                if (!evmSigner && currentWdk.seedPhrase) {
                    const { HDNodeWallet } = await import('ethers');
                    evmSigner = HDNodeWallet.fromPhrase(currentWdk.seedPhrase, undefined, "m/44'/60'/0'/0/0");
                }

                if (!evmSigner) {
                    throw new Error('EVM signer not available. Please ensure your wallet is connected.');
                }

                const escrowId = order.claimData?.evmEscrowId || (order as any).evmEscrowId;
                if (!escrowId) {
                    throw new Error('Sepolia Escrow ID missing from order. Cannot claim.');
                }

                const { claimHTLCEscrow } = await import('@/lib/intentHTLC');
                console.log(`[Claim] Claiming Sepolia Escrow ID ${escrowId} with secret...`);
                try {
                    claimTxid = await claimHTLCEscrow(evmSigner, escrowId.toString(), secret, isMainnet);
                    console.log('[Claim] Sepolia claim successful! TX:', claimTxid);
                } catch (claimErr: any) {
                    const errMsg = claimErr?.data || claimErr?.message || '';
                    if (errMsg.includes('0x646cf558') || errMsg.includes('AlreadyClaimed') || claimErr?.info?.error?.data === '0x646cf558') {
                        console.log('[Claim] Sepolia escrow was already claimed on-chain!');
                        claimTxid = order.fillTxid || 'already-claimed';
                    } else {
                        throw claimErr;
                    }
                }

                // Notify relayer
                try {
                    await postClaim(order.intentId || orderId, secret, undefined, isMainnet);
                } catch { }
            }

            // Update order status to filled (settled) and move to History
            order.status = 'filled';
            if (claimTxid && claimTxid !== 'auto-claim-pending' && claimTxid !== 'relayer-claim-submitted' && claimTxid !== 'already-claimed') {
                const destChain = (order.swapType === 'bch-to-eth')
                    ? (order.buyToken.chain || 'ethereum')
                    : (order.swapType === 'bch-to-mov' || order.swapType === 'sol-to-mov') ? 'movement'
                    : (order.swapType === 'bch-to-sol' || order.swapType === 'mov-to-sol') ? 'solana'
                    : 'bch';
                order.destExplorerUrl = buildExplorerUrl(claimTxid, destChain);
                order.fillTxid = claimTxid;
            } else if (!order.destExplorerUrl && order.fillTxid) {
                const destChain = (order.swapType === 'bch-to-eth')
                    ? (order.buyToken.chain || 'ethereum')
                    : (order.swapType === 'bch-to-mov' || order.swapType === 'sol-to-mov') ? 'movement'
                    : (order.swapType === 'bch-to-sol' || order.swapType === 'mov-to-sol') ? 'solana'
                    : 'bch';
                order.destExplorerUrl = buildExplorerUrl(order.fillTxid, destChain);
            }

            localStorage.setItem(claimKey, JSON.stringify(all));
            {
                const split = splitOrders(all);
                setPendingOrders(split.pending);
                setCompletedOrders(split.completed);
            }

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

            const isMainnet = wdkRef.current.bchNetwork === 'mainnet';

            let refundTxid: string | undefined;
            let refundExplorerUrl: string | undefined;

            if (order.swapType === 'bch-to-eth') {
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
            } else if (order.swapType === 'eth-to-bch') {
                // ── EVM→BCH: user calls IntentHTLC.refund(escrowId) directly on EVM ──
                const currentWdk = wdkRef.current;
                let evmSigner: any = currentWdk.evmSigner;
                if (!evmSigner) {
                    if (!currentWdk.seedPhrase) throw new Error('Connect your EVM wallet to refund');
                    const { HDNodeWallet } = await import('ethers');
                    evmSigner = HDNodeWallet.fromPhrase(currentWdk.seedPhrase, undefined, "m/44'/60'/0'/0/0");
                }

                const escrowId = order.claimData?.evmEscrowId || (order as any).evmEscrowId;
                if (!escrowId) throw new Error('Escrow ID not found — cannot refund');

                const sellChain = order.sellToken.chain || 'ethereum';
                const chainCfg = getEVMChainConfig(sellChain, isMainnet);
                const explorer = chainCfg?.explorer || 'https://sepolia.etherscan.io';

                setSwapStep(`Submitting on-chain refund on ${chainCfg?.name || 'EVM'}...`);
                const { refundHTLCEscrow } = await import('@/lib/intentHTLC');
                try {
                    const txHash = await refundHTLCEscrow(evmSigner, escrowId.toString(), isMainnet);
                    refundTxid = txHash;
                    refundExplorerUrl = `${explorer}/tx/${txHash}`;
                } catch (e: any) {
                    const msg = e?.reason ?? e?.message ?? String(e);
                    throw new Error(`Refund transaction failed: ${msg}`);
                }

            } else if (order.swapType === 'bch-to-mov' || order.swapType === 'bch-to-sol') {
                // ── BCH→Movement / BCH→Solana refund: recover locked BCH from Chipnet covenant ──
                const currentBchWallet = bchWalletRef.current;
                if (!currentBchWallet.address) throw new Error('Connect your BCH wallet to claim the refund');
                const wif = currentBchWallet.getWIF();
                if (!wif) throw new Error('WIF not available — reconnect your BCH wallet');

                // Try relayer manual refund first (triggers relayer to mark refund or refund movement escrow)
                if (order.intentId) {
                    try {
                        const relayerRes = await axios.post(`${BCH_SOLANA_RELAYER_URL}/refund/${order.intentId}`);
                        if (relayerRes.data?.refundTx) {
                            refundTxid = relayerRes.data.refundTx;
                            refundExplorerUrl = isMainnet
                                ? `https://blockchair.com/bitcoin-cash/transaction/${refundTxid}`
                                : `https://chipnet.chaingraph.cash/tx/${refundTxid}`;
                        }
                    } catch { }
                }

                if (!refundTxid) {
                    setSwapStep('Refunding BCH from covenant...');
                    const { Contract, ElectrumNetworkProvider, SignatureTemplate } = await getCashScript();
                    const artifactModule = await import('@/lib/CrossChainHTLC.json');
                    const artifact = artifactModule.default || artifactModule;
                    const { cashAddressToLockingBytecode, decodePrivateKeyWif, secp256k1 } = await import('@bitauth/libauth');

                    const derivePkh = (address: string): Uint8Array => {
                        const result = cashAddressToLockingBytecode(address);
                        if (typeof result === 'string') throw new Error(`Invalid BCH address: ${result}`);
                        const bytecode = result.bytecode;
                        if (bytecode.length === 25 && bytecode[0] === 0x76 && bytecode[1] === 0xa9 && bytecode[2] === 0x14) {
                            return bytecode.slice(3, 23);
                        }
                        throw new Error('Not a standard P2PKH address');
                    };

                    const userPkh = derivePkh(currentBchWallet.address);
                    let relayerBchAddress = 'bchtest:qzufsn0wtcmc4lhc3s3trhl0nxn6dgkpmgvzngkxl7';
                    try {
                        const healthRes = await axios.get(`${BCH_SOLANA_RELAYER_URL}/health`);
                        relayerBchAddress = healthRes.data?.pubkeys?.bch || relayerBchAddress;
                    } catch { }
                    const relayerPkh = derivePkh(relayerBchAddress);

                    const hashlockHex = order.claimData?.hashlock || (order as any).hashlock || '';
                    const hashlockArray = Array.from(Buffer.from(hashlockHex.replace('0x', ''), 'hex'));
                    const timelock = BigInt(order.sourceTimelock || (order.claimData as any)?.sourceTimelock || (Math.floor(order.createdAt / 1000) + 7200));

                    const bchNet = wdkRef.current.bchNetwork === 'mainnet' ? 'mainnet' : 'chipnet';
                    const provider = new ElectrumNetworkProvider(bchNet);
                    const contract = new Contract(artifact, [userPkh, relayerPkh, hashlockArray, timelock], { provider });

                    const wifDecoded = decodePrivateKeyWif(wif);
                    if (typeof wifDecoded === 'string') throw new Error('Invalid WIF');
                    const sigTemplate = new SignatureTemplate(wifDecoded.privateKey);
                    const pubKey = secp256k1.derivePublicKeyCompressed(wifDecoded.privateKey);

                    const utxos = await contract.getUtxos();
                    if (!utxos || utxos.length === 0) {
                        // If contract has no UTXOs, it was already refunded/claimed
                        refundTxid = order.fillTxid || order.txid || 'refund-processed';
                        refundExplorerUrl = isMainnet
                            ? `https://blockchair.com/bitcoin-cash/address/${contract.address}`
                            : `https://chipnet.chaingraph.cash/address/${contract.address}`;
                    } else {
                        const totalSats = utxos.reduce((sum: bigint, u: { satoshis: bigint }) => sum + u.satoshis, 0n);
                        const fee = 1000n;
                        if (totalSats <= fee) throw new Error('Insufficient covenant balance for refund fee');

                        const txDetails = await contract.functions
                            .refund(pubKey, sigTemplate)
                            .to(currentBchWallet.address, totalSats - fee)
                            .send();

                        refundTxid = txDetails.txid;
                        refundExplorerUrl = isMainnet
                            ? `https://blockchair.com/bitcoin-cash/transaction/${refundTxid}`
                            : `https://chipnet.chaingraph.cash/tx/${refundTxid}`;
                    }
                }

            } else if (order.swapType === 'mov-to-bch') {
                // ── Movement→BCH refund: user recovers locked MOVE from Movement escrow ──
                const currentWdk = wdkRef.current;
                if (!currentWdk.movementAddress || !currentWdk.movementAccount) {
                    throw new Error('Connect your WDK wallet first — Movement account not available');
                }

                const escrowIdStr = order.claimData?.movementEscrowId || (order as any).sourceEscrowId || (order as any).movementEscrowId;
                if (!escrowIdStr) throw new Error('Movement Escrow ID missing — cannot refund');
                const escrowId = parseInt(String(escrowIdStr));
                if (isNaN(escrowId)) throw new Error(`Invalid Movement Escrow ID: ${escrowIdStr}`);

                let coinType = '0x1::aptos_coin::AptosCoin';
                if (order.sellToken?.address && order.sellToken.address.includes('::')) {
                    coinType = order.sellToken.address;
                } else if (order.sellToken?.symbol?.includes('ETH') || order.sellToken?.symbol?.includes('WETH')) {
                    coinType = '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::WETH';
                }

                setSwapStep('Submitting refund on Movement...');
                const { Aptos, AptosConfig, Network } = await import('@aptos-labs/ts-sdk');
                const aptosClient = new Aptos(new AptosConfig({
                    network: Network.CUSTOM,
                    fullnode: 'https://testnet.movementnetwork.xyz/v1',
                }));

                const MOVEMENT_HTLC_ADDR = '0x485ca1c12b5dfa01c282b9c7ef09fdfebbf877ed729bf999ce61a8ec5c5e69bd';
                const rawTx = await aptosClient.transaction.build.simple({
                    sender: currentWdk.movementAccount.accountAddress,
                    data: {
                        function: `${MOVEMENT_HTLC_ADDR}::htlc_escrow::refund`,
                        typeArguments: [coinType],
                        functionArguments: [
                            MOVEMENT_HTLC_ADDR,
                            escrowId,
                        ],
                    },
                });

                const pendingTx = await aptosClient.signAndSubmitTransaction({
                    signer: currentWdk.movementAccount,
                    transaction: rawTx,
                });
                const executedTx = await aptosClient.waitForTransaction({ transactionHash: pendingTx.hash });
                refundTxid = executedTx.hash;
                refundExplorerUrl = `https://explorer.movementnetwork.xyz/txn/${refundTxid}?network=testnet`;

            } else if (order.swapType === 'sol-to-mov' || order.swapType === 'sol-to-bch') {
                // ── SOL→MOV / SOL→BCH refund: recover locked SOL/token from Solana Anchor escrow ──
                const sw = solanaWalletRef.current;
                if (!sw?.publicKey) throw new Error('Connect your Solana wallet to refund');

                const claimD = order.claimData ?? {};
                const hashlockHex = (claimD as any).hashlock || '';
                const hashlockBytes = Buffer.from(hashlockHex.replace('0x', ''), 'hex');

                const { PublicKey } = await import('@solana/web3.js');
                const { getAssociatedTokenAddress, NATIVE_MINT } = await import('@solana/spl-token');
                const anchor = await import('@coral-xyz/anchor');

                const programId = new PublicKey(SOLANA_PROGRAM_ID);

                let escrowPda: typeof PublicKey.prototype;
                if ((claimD as any).solanaEscrowPda) {
                    escrowPda = new PublicKey((claimD as any).solanaEscrowPda);
                } else {
                    [escrowPda] = PublicKey.findProgramAddressSync(
                        [Buffer.from('escrow'), sw.publicKey.toBuffer(), hashlockBytes],
                        programId
                    );
                }

                const [vaultPda] = PublicKey.findProgramAddressSync(
                    [Buffer.from('vault'), escrowPda.toBuffer()],
                    programId
                );

                const isNativeSol = !order.sellToken?.address || order.sellToken.address === 'So11111111111111111111111111111111111111112';
                const tokenMint = isNativeSol ? NATIVE_MINT : new PublicKey(order.sellToken.address!);
                const makerTokenAccount = await getAssociatedTokenAddress(tokenMint, sw.publicKey);

                const REFUND_DISCRIMINATOR = Buffer.from([2, 96, 183, 251, 63, 208, 46, 46]);

                const ix = new anchor.web3.TransactionInstruction({
                    programId,
                    keys: [
                        { pubkey: sw.publicKey, isSigner: true, isWritable: true },
                        { pubkey: escrowPda, isSigner: false, isWritable: true },
                        { pubkey: vaultPda, isSigner: false, isWritable: true },
                        { pubkey: makerTokenAccount, isSigner: false, isWritable: true },
                        { pubkey: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'), isSigner: false, isWritable: false },
                    ],
                    data: REFUND_DISCRIMINATOR,
                });

                const { blockhash, lastValidBlockHeight } = await solanaConnection.getLatestBlockhash();
                const tx = new anchor.web3.Transaction().add(ix);
                tx.recentBlockhash = blockhash;
                tx.feePayer = sw.publicKey;

                setSwapStep('Sign the refund in your Solana wallet...');
                const sig = await sw.sendTransaction(tx, solanaConnection);
                await solanaConnection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
                refundTxid = sig;
                refundExplorerUrl = `https://explorer.solana.com/tx/${sig}?cluster=devnet`;

            } else if (order.swapType === 'mov-to-sol') {
                // ── MOV→SOL refund: recover locked MOVE/token from Movement HTLC escrow ──
                const currentWdk = wdkRef.current;
                if (!currentWdk.movementAddress || !currentWdk.movementAccount) {
                    throw new Error('Connect your WDK wallet first — Movement account not available');
                }

                const escrowIdStr = order.claimData?.movementEscrowId || (order as any).sourceEscrowId || (order as any).movementEscrowId;
                if (!escrowIdStr) throw new Error('Movement Escrow ID missing — cannot refund');
                const escrowId = parseInt(String(escrowIdStr));
                if (isNaN(escrowId)) throw new Error(`Invalid Movement Escrow ID: ${escrowIdStr}`);

                let coinType = '0x1::aptos_coin::AptosCoin';
                if (order.sellToken?.address && order.sellToken.address.includes('::')) {
                    coinType = order.sellToken.address;
                } else if (order.sellToken?.symbol?.includes('ETH') || order.sellToken?.symbol?.includes('WETH')) {
                    coinType = '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::WETH';
                }

                setSwapStep('Submitting refund on Movement...');
                const { Aptos: Aptos2, AptosConfig: AptosConfig2, Network: Network2 } = await import('@aptos-labs/ts-sdk');
                const aptosClient2 = new Aptos2(new AptosConfig2({
                    network: Network2.CUSTOM,
                    fullnode: 'https://testnet.movementnetwork.xyz/v1',
                }));

                const MOVEMENT_HTLC_ADDR = '0x485ca1c12b5dfa01c282b9c7ef09fdfebbf877ed729bf999ce61a8ec5c5e69bd';
                const rawTx2 = await aptosClient2.transaction.build.simple({
                    sender: currentWdk.movementAccount.accountAddress,
                    data: {
                        function: `${MOVEMENT_HTLC_ADDR}::htlc_escrow::refund`,
                        typeArguments: [coinType],
                        functionArguments: [MOVEMENT_HTLC_ADDR, escrowId],
                    },
                });

                const pendingTx2 = await aptosClient2.signAndSubmitTransaction({
                    signer: currentWdk.movementAccount,
                    transaction: rawTx2,
                });
                const executedTx2 = await aptosClient2.waitForTransaction({ transactionHash: pendingTx2.hash });
                refundTxid = executedTx2.hash;
                refundExplorerUrl = `https://explorer.movementnetwork.xyz/txn/${refundTxid}?network=testnet`;

            } else {
                throw new Error(`Refund not available for swap type: ${order.swapType}`);
            }

            if (refundTxid) {
                order.status = 'refunded';
                order.fillTxid = refundTxid;
                order.destExplorerUrl = refundExplorerUrl;
                localStorage.setItem(key, JSON.stringify(all));
                {
                    const split = splitOrders(all);
                    setPendingOrders(split.pending);
                    setCompletedOrders(split.completed);
                }

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
                case 'sol-to-mov':
                    await executeSolanaToMovement(params, recipientAddress);
                    break;
                case 'mov-to-sol':
                    await executeMovementToSolana(params, recipientAddress);
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
                cancelSameChainOrder,
                refreshOrders,
                detectSwapType,
                relayerLive,
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
