import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { notifyToast as toast } from '@/lib/notify-toast';
import { useBCHWallet } from './BCHWalletProvider';
import { useWallet as useSolanaWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { BCHSwapParams, BCHSwapType, BCHOrder } from '@/types';
import { BCH_SOLANA_RELAYER_URL, CASHTOKEN_RELAYER_URL } from '@/lib/config';
import axios from 'axios';
import * as anchor from '@coral-xyz/anchor';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAccount } from '@solana/spl-token';
import idl from '@/lib/intent_swap_idl.json';

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
const BCH_ORDERS_KEY = 'bch_orders';
const SOLANA_PROGRAM_ID = '5JAWumq5L4B8WrpF3CFox36SZ2bJF4xQvskLksmHRgs2';

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
    refreshOrders: () => Promise<void>;
    detectSwapType: (sellChain?: string, buyChain?: string) => BCHSwapType;
}

export const BCHSwapContext = createContext<BCHSwapContextType | undefined>(undefined);

// ============================================================================
// Provider
// ============================================================================
export function BCHSwapProvider({ children }: { children: ReactNode }) {
    const bchWallet = useBCHWallet();
    const solanaWallet = useSolanaWallet();
    const { connection: solanaConnection } = useConnection();
    const [isLoading, setIsLoading] = useState(false);
    const [swapStep, setSwapStep] = useState('');
    const [pendingOrders, setPendingOrders] = useState<BCHOrder[]>([]);
    const [completedOrders, setCompletedOrders] = useState<BCHOrder[]>([]);

    // Load orders from localStorage on init
    useEffect(() => {
        try {
            const saved = localStorage.getItem(BCH_ORDERS_KEY);
            if (saved) {
                const all: BCHOrder[] = JSON.parse(saved);
                setPendingOrders(all.filter(o => o.status === 'pending' || o.status === 'claimable'));
                setCompletedOrders(all.filter(o => o.status !== 'pending' && o.status !== 'claimable'));
            }
        } catch { /* ignore */ }
    }, []);

    // =========================================================================
    // Helpers
    // =========================================================================
    const saveOrder = (order: BCHOrder) => {
        try {
            const saved = localStorage.getItem(BCH_ORDERS_KEY);
            const all: BCHOrder[] = saved ? JSON.parse(saved) : [];
            all.unshift(order);
            if (all.length > 50) all.pop();
            localStorage.setItem(BCH_ORDERS_KEY, JSON.stringify(all));
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
        return 'same-chain';
    }, []);

    // =========================================================================
    // BCH → Solana: Deploy CrossChainHTLC covenant on BCH, notify relayer
    // =========================================================================
    const executeBCHToSolana = async (params: BCHSwapParams, recipientSolAddress: string) => {
        if (!bchWallet.connected || !bchWallet.address) {
            throw new Error('Connect your BCH wallet first');
        }
        if (!recipientSolAddress) {
            throw new Error('Solana recipient address required');
        }

        setSwapStep('Generating hashlock...');
        const { secretHex, hashlockHex, hashlockArray } = await generateHashlock();
        localStorage.setItem(`bch_secret_${hashlockHex}`, secretHex);

        // 1. Get relayer's BCH address from /health or /orders
        setSwapStep('Connecting to relayer...');
        let relayerBCHAddress = '';
        try {
            const ordersRes = await axios.get(`${BCH_SOLANA_RELAYER_URL}/orders`);
            const anyIntent = [...(ordersRes.data.active || []), ...(ordersRes.data.completed || [])];

            // Look through all intents for a valid BCH cashaddr
            // takerAddress in BCH_TO_SOL is a Solana pubkey, NOT what we need.
            // makerAddress in BCH_TO_SOL would be a BCH address.
            // takerAddress in SOL_TO_BCH would be a BCH address.
            for (const intent of anyIntent) {
                // Check takerAddress and makerAddress for BCH format (contains ':')
                const candidates = [intent.takerAddress, intent.makerAddress, intent.recipientAddress].filter(Boolean);
                const bchAddr = candidates.find((addr: string) => addr.includes(':') && (addr.startsWith('bchtest:') || addr.startsWith('bitcoincash:')));
                if (bchAddr && bchAddr !== bchWallet.address) {
                    relayerBCHAddress = bchAddr;
                    console.log('[BCH→SOL] Found relayer BCH address from orders:', relayerBCHAddress);
                    break;
                }
            }

            if (!relayerBCHAddress) {
                console.log('[BCH→SOL] No relayer BCH address found in orders, using self as recipient placeholder');
                toast.info('Relayer BCH address not found. Using direct transfer mode.');
            }
        } catch (e) {
            console.error('Failed to reach relayer:', e);
            throw new Error('BCH-Solana relayer is unreachable');
        }

        // 2. Deploy CrossChainHTLC covenant on BCH
        setSwapStep('Deploying HTLC covenant on BCH...');
        let contractAddress: string;
        let fundTxId: string;
        let timelock: bigint;

        try {
            console.log('[BCH→SOL] Step 2a: Loading CashScript...');
            const { Contract, ElectrumNetworkProvider, SignatureTemplate } = await getCashScript();
            console.log('[BCH→SOL] Step 2b: Loading HTLC artifact...');
            const artifact = (await import('@/lib/CrossChainHTLC.json')).default;
            console.log('[BCH→SOL] Artifact loaded:', artifact.contractName);

            // Get user's PKH (20 bytes from address)
            console.log('[BCH→SOL] Step 2c: Loading libauth...');
            const { cashAddressToLockingBytecode } = await import('@bitauth/libauth');

            const derivePkh = (address: string): Uint8Array => {
                console.log('[BCH→SOL] derivePkh for:', address);
                const result = cashAddressToLockingBytecode(address);
                if (typeof result === 'string') throw new Error(result);
                const bytecode = result.bytecode;
                console.log('[BCH→SOL] Locking bytecode length:', bytecode.length, 'bytes:', Array.from(bytecode.slice(0, 5)).map(b => b.toString(16)));
                // P2PKH: 76 a9 14 <20-byte-hash> 88 ac
                if (bytecode.length === 25 && bytecode[0] === 0x76 && bytecode[1] === 0xa9 && bytecode[2] === 0x14) {
                    return bytecode.slice(3, 23);
                }
                throw new Error(`Not a standard P2PKH address (bytecode length=${bytecode.length}, prefix=${bytecode[0]?.toString(16)})`);
            };

            console.log('[BCH→SOL] Step 2d: Deriving user PKH from:', bchWallet.address);
            const userPkh = derivePkh(bchWallet.address);
            console.log('[BCH→SOL] User PKH:', Array.from(userPkh).map(b => b.toString(16).padStart(2, '0')).join(''));

            let recipientPkh: Uint8Array;
            if (relayerBCHAddress) {
                console.log('[BCH→SOL] Deriving relayer PKH from:', relayerBCHAddress);
                recipientPkh = derivePkh(relayerBCHAddress);
            } else {
                console.log('[BCH→SOL] No relayer address, using user PKH as recipient');
                recipientPkh = userPkh;
            }

            timelock = BigInt(Math.floor(Date.now() / 1000) + 7200);
            console.log('[BCH→SOL] Step 2e: Instantiating contract with timelock:', timelock.toString());

            const provider = new ElectrumNetworkProvider('chipnet');
            const contract = new Contract(
                artifact,
                [userPkh, recipientPkh, hashlockArray, timelock],
                { provider }
            );

            contractAddress = contract.address;
            console.log('[BCH→SOL] ✅ CrossChainHTLC address:', contractAddress);

            // 3. Fund the contract from browser wallet
            setSwapStep('Signing BCH transaction...');
            const wif = bchWallet.getWIF();
            console.log('[BCH→SOL] Step 3: WIF available:', !!wif);
            if (!wif) {
                throw new Error('Cannot sign: WIF not available (Cashonize signing not yet supported for HTLC deployment)');
            }

            const { TestNetWallet } = await import('mainnet-js');
            const wallet = await TestNetWallet.fromWIF(wif);
            console.log('[BCH→SOL] Browser wallet address:', (wallet as any).cashaddr);

            const amountSats = Math.floor(params.sellAmount * 1e8);
            console.log('[BCH→SOL] Sending', amountSats, 'sats to HTLC...');

            setSwapStep(`Sending ${params.sellAmount} BCH to HTLC...`);
            const tx = await wallet.send([{
                cashaddr: contractAddress,
                value: amountSats,
                unit: 'sat'
            } as any]);

            fundTxId = tx.txId as string;
            console.log('[BCH→SOL] ✅ HTLC funded:', fundTxId);
            toast.success('BCH locked in HTLC covenant!', {
                description: `Tx: ${fundTxId.slice(0, 16)}...`
            });

        } catch (e: any) {
            console.error('[BCH→SOL] ❌ HTLC deployment failed:');
            console.error('[BCH→SOL] Error message:', e.message);
            console.error('[BCH→SOL] Error stack:', e.stack);
            console.error('[BCH→SOL] Full error:', e);
            throw new Error(`Failed to deploy BCH HTLC: ${e.message}`);
        }

        // 4. Notify relayer
        setSwapStep('Notifying relayer...');
        try {
            const isBuyNativeSol = !params.buyToken.address || params.buyToken.address === 'So11111111111111111111111111111111111111112';
            const buyBaseUnits = Math.floor(params.buyAmount * Math.pow(10, params.buyToken.decimals || 9));

            const response = await axios.post(`${BCH_SOLANA_RELAYER_URL}/swap/bch-to-solana`, {
                makerAddress: bchWallet.address,
                recipientAddress: recipientSolAddress,
                sellAmount: Math.floor(params.sellAmount * 1e8).toString(), // satoshis
                buyToken: isBuyNativeSol ? undefined : params.buyToken.address,
                buyAmount: buyBaseUnits.toString(), // base units (lamports or USDC micros)
                hashlock: hashlockHex,
                sourceTimelock: Number(timelock),
                bchContractAddress: contractAddress,
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
                contractAddress: contractAddress,
                txid: fundTxId,
                intentId: intent?.id,
                explorerUrl: `https://chipnet.chaingraph.cash/tx/${fundTxId}`,
                createdAt: Date.now(),
                claimData: {
                    hashlock: hashlockHex,
                    secret: secretHex,
                    bchContractAddress: contractAddress,
                    solanaEscrowPda: intent?.solanaEscrowPda,
                    direction: 'BCH_TO_SOL',
                },
            };

            saveOrder(order);
            setSwapStep('');
            toast.success('Cross-chain swap initiated!', {
                description: 'The relayer will fill your order on Solana.'
            });

        } catch (e: any) {
            console.error('Relayer notification failed:', e);
            throw new Error(`Relayer error: ${e.response?.data?.error || e.message}`);
        }
    };

    // =========================================================================
    // Solana → BCH: Create Solana escrow via Anchor, notify relayer
    // =========================================================================
    const executeSolanaToBCH = async (params: BCHSwapParams, recipientBCHAddress: string) => {
        if (!solanaWallet.publicKey || !solanaWallet.signTransaction) {
            throw new Error('Connect your Solana wallet first');
        }
        if (!recipientBCHAddress) {
            throw new Error('BCH recipient address required');
        }

        setSwapStep('Generating hashlock...');
        const { secretHex, hashlockHex, hashlockArray } = await generateHashlock();
        localStorage.setItem(`bch_secret_${hashlockHex}`, secretHex);

        // 1. Get relayer's Solana address
        setSwapStep('Connecting to relayer...');
        let relayerSolAddress = '';
        try {
            const healthRes = await axios.get(`${BCH_SOLANA_RELAYER_URL}/health`);
            if (healthRes.data?.pubkeys?.solana) {
                relayerSolAddress = healthRes.data.pubkeys.solana;
                console.log('[SOL→BCH] Got relayer Solana address from /health:', relayerSolAddress);
            }

            if (!relayerSolAddress) {
                console.log('[SOL→BCH] No relayer Solana address in /health, falling back to self');
                toast.info('Using direct SOL transfer to relayer');
            }
        } catch (e) {
            console.error('Failed to reach relayer health:', e);
            throw new Error('BCH-Solana relayer is unreachable');
        }

        const isNativeSol = !params.sellToken.address || params.sellToken.address === 'So11111111111111111111111111111111111111112';
        const tokenMintPubkey = new PublicKey(isNativeSol ? 'So11111111111111111111111111111111111111112' : params.sellToken.address!);
        const amountBaseUnits = Math.floor(params.sellAmount * Math.pow(10, params.sellToken.decimals || 9));

        const programId = new PublicKey(SOLANA_PROGRAM_ID);
        const hashBuf = Buffer.from(hashlockArray);

        // 2. Derive escrow PDA
        // Seeds: ["escrow", maker, hashlock]
        const [escrowPda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("escrow"),
                solanaWallet.publicKey.toBuffer(),
                hashBuf
            ],
            programId
        );

        // Derive vault PDA
        const [vaultPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("vault"), escrowPda.toBuffer()],
            programId
        );

        // 3. Create Solana escrow via Anchor
        setSwapStep('Creating Solana escrow...');
        let escrowTx: string;

        try {
            console.log('[SOL→BCH] Step 3a: Loading spl-token...');
            const {
                getAssociatedTokenAddress,
                createSyncNativeInstruction,
                createAssociatedTokenAccountIdempotentInstruction,
            } = await import('@solana/spl-token');

            console.log('[SOL→BCH] Step 3b: Loading IDL...');
            const idl = (await import('@/lib/intent_swap_idl.json')).default;
            console.log('[SOL→BCH] IDL loaded, program:', (idl as any).address || (idl as any).metadata?.name);

            console.log('[SOL→BCH] Step 3c: Creating Anchor provider...');
            console.log('[SOL→BCH]   Solana publicKey:', solanaWallet.publicKey.toBase58());
            console.log('[SOL→BCH]   signTransaction:', typeof solanaWallet.signTransaction);
            console.log('[SOL→BCH]   RPC endpoint:', (solanaConnection as any)?.rpcEndpoint || 'unknown');

            const provider = new anchor.AnchorProvider(
                solanaConnection as any,
                {
                    publicKey: solanaWallet.publicKey,
                    signTransaction: solanaWallet.signTransaction,
                    signAllTransactions: solanaWallet.signAllTransactions!,
                } as any,
                { preflightCommitment: 'confirmed' }
            );

            const program = new anchor.Program(idl as any, provider);
            console.log('[SOL→BCH] Program ID:', program.programId.toBase58());

            console.log('[SOL→BCH] Step 3d: Getting Token account for mint:', tokenMintPubkey.toBase58());
            const makerTokenAccount = await getAssociatedTokenAddress(
                tokenMintPubkey,
                solanaWallet.publicKey
            );
            console.log('[SOL→BCH] Maker ATA:', makerTokenAccount.toBase58());

            const takerPubkey = relayerSolAddress
                ? new PublicKey(relayerSolAddress)
                : solanaWallet.publicKey;
            console.log('[SOL→BCH] Taker (relayer):', takerPubkey.toBase58());

            const timelock = new anchor.BN(Math.floor(Date.now() / 1000) + 7200);
            const amount = new anchor.BN(amountBaseUnits);
            console.log('[SOL→BCH] Amount:', amountBaseUnits, 'base units, Timelock:', timelock.toString());
            console.log('[SOL→BCH] Escrow PDA:', escrowPda.toBase58());
            console.log('[SOL→BCH] Vault PDA:', vaultPda.toBase58());
            console.log('[SOL→BCH] Hashlock (hex):', hashlockHex);

            let wrapIxs: any[] = [];

            if (isNativeSol) {
                setSwapStep('Wrapping SOL and signing transaction...');
                const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
                    solanaWallet.publicKey,   // payer
                    makerTokenAccount,        // ATA address
                    solanaWallet.publicKey,   // owner
                    tokenMintPubkey,          // mint (WSOL)
                );
                wrapIxs = [
                    createAtaIx,
                    SystemProgram.transfer({
                        fromPubkey: solanaWallet.publicKey,
                        toPubkey: makerTokenAccount,
                        lamports: BigInt(amountBaseUnits),
                    }),
                    createSyncNativeInstruction(makerTokenAccount),
                ];
                console.log('[SOL→BCH] Step 3e: Creating WSOL ATA + wrapping SOL...');
            } else {
                setSwapStep('Approving token and signing transaction...');
                console.log('[SOL→BCH] Step 3e: Using existing SPL token ATA...');
            }

            const programAny: any = program;
            escrowTx = await programAny.methods
                .initialize(
                    [...hashBuf],
                    timelock,
                    amount
                )
                .preInstructions(wrapIxs)
                .accounts({
                    maker: solanaWallet.publicKey,
                    taker: takerPubkey,
                    tokenMint: tokenMintPubkey,
                    escrow: escrowPda,
                    makerTokenAccount: makerTokenAccount,
                    vault: vaultPda,
                    systemProgram: SystemProgram.programId,
                    tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
                    rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                })
                .rpc();

            console.log('[SOL→BCH] ✅ Solana escrow created:', escrowTx);
            toast.success('SOL locked in escrow!', {
                description: `Tx: ${escrowTx.slice(0, 16)}...`
            });

        } catch (e: any) {
            console.error('[SOL→BCH] ❌ Solana escrow creation failed:');
            console.error('[SOL→BCH] Error message:', e.message);
            console.error('[SOL→BCH] Error stack:', e.stack);
            if (e.logs) console.error('[SOL→BCH] Program logs:', e.logs);
            if (e.error) console.error('[SOL→BCH] Inner error:', e.error);
            console.error('[SOL→BCH] Full error:', e);
            throw new Error(`Failed to create Solana escrow: ${e.message}`);
        }

        // 4. Notify relayer
        setSwapStep('Notifying relayer...');
        try {
            const response = await axios.post(`${BCH_SOLANA_RELAYER_URL}/swap/solana-to-bch`, {
                makerAddress: solanaWallet.publicKey.toBase58(),
                recipientAddress: recipientBCHAddress,
                sellToken: isNativeSol ? undefined : tokenMintPubkey.toBase58(),
                sellAmount: amountBaseUnits.toString(),
                buyAmount: Math.floor(params.buyAmount * 1e8).toString(), // BCH satoshis
                hashlock: hashlockHex,
                solanaEscrowPda: escrowPda.toBase58(),
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
                txid: escrowTx,
                intentId: intent?.id,
                explorerUrl: `https://explorer.solana.com/tx/${escrowTx}?cluster=devnet`,
                createdAt: Date.now(),
                claimData: {
                    hashlock: hashlockHex,
                    secret: secretHex,
                    solanaEscrowPda: escrowPda.toBase58(),
                    bchContractAddress: intent?.bchContractAddress,
                    destTimelock: intent?.destTimelock,
                    direction: 'SOL_TO_BCH',
                },
            };

            saveOrder(order);
            setSwapStep('');
            toast.success('Cross-chain swap initiated!', {
                description: 'The relayer will fill your order on BCH.'
            });

        } catch (e: any) {
            console.error('Relayer notification failed:', e);
            throw new Error(`Relayer error: ${e.response?.data?.error || e.message}`);
        }
    };

    // =========================================================================
    // Same-chain BCH swap — Deploy CashToken covenant via relayer API
    // =========================================================================
    const executeSameChainSwap = async (params: BCHSwapParams) => {
        if (!bchWallet.connected || !bchWallet.address) {
            throw new Error('Connect your BCH wallet first');
        }

        setSwapStep('Creating intent on CashToken relayer...');

        // Determine token category IDs
        const sellCategoryId = params.sellToken.categoryId || (params.sellToken.chain === 'bch' && params.sellToken.symbol !== 'BCH' ? params.sellToken.categoryId : 'BCH');
        const buyCategoryId = params.buyToken.categoryId || (params.buyToken.chain === 'bch' && params.buyToken.symbol !== 'BCH' ? params.buyToken.categoryId : 'BCH');

        // Convert amounts to satoshis / token base units
        const sellBaseUnits = Math.floor(params.sellAmount * Math.pow(10, params.sellToken.decimals || 0));
        const buyBaseUnits = Math.floor(params.buyAmount * Math.pow(10, params.buyToken.decimals || 0));

        try {
            const response = await axios.post(`${CASHTOKEN_RELAYER_URL}/intent/create`, {
                makerAddress: bchWallet.address,
                sellToken: sellCategoryId || 'BCH',
                buyToken: buyCategoryId || 'BCH',
                sellAmount: sellBaseUnits.toString(),
                buyAmount: buyBaseUnits.toString(),
                orderType: params.orderType === 'limit' ? 'limit' : 'market',
                duration: params.duration || 3600,
                expiryTime: params.expiryTime || Math.floor(Date.now() / 1000) + 3600,
            });

            const data = response.data;

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
                explorerUrl: data.explorerUrl,
                createdAt: Date.now(),
            };

            saveOrder(order);
            setSwapStep('');
            toast.success(
                params.orderType === 'limit' ? 'Limit order created!' : 'Dutch auction created!',
                {
                    description: `Contract: ${data.contractAddress?.slice(0, 24)}...`,
                    action: data.explorerUrl ? {
                        label: 'View on Explorer',
                        onClick: () => window.open(data.explorerUrl, '_blank'),
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
        if (!bchWallet.connected || !bchWallet.address) {
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

        const userPkh = derivePkh(bchWallet.address);
        const relayerPkh = derivePkh(relayerBchAddress);
        const timelock = BigInt(Math.floor(Date.now() / 1000) + 7200);

        const provider = new ElectrumNetworkProvider('chipnet');
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
            const wif = bchWallet.getWIF();
            if (!wif) throw new Error('WIF not available — please reconnect your BCH wallet');

            const { TestNetWallet } = await import('mainnet-js');
            const wallet = await TestNetWallet.fromWIF(wif);

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
                makerAddress: bchWallet.address,
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
        switch (chain) {
            case 'bch': return `https://chipnet.chaingraph.cash/tx/${txid}`;
            case 'solana': return `https://explorer.solana.com/tx/${txid}?cluster=devnet`;
            case 'movement': return `https://explorer.movementnetwork.xyz/txn/${txid}?network=testnet`;
            default: return `https://chipnet.chaingraph.cash/tx/${txid}`;
        }
    };

    const refreshOrders = useCallback(async () => {
        setIsLoading(true);
        try {
            const saved = localStorage.getItem(BCH_ORDERS_KEY);
            if (!saved) return;

            const all: BCHOrder[] = JSON.parse(saved);
            let updated = false;

            for (const order of all) {
                if (!order.intentId) continue;
                // Skip terminal states
                if (['filled', 'cancelled', 'expired'].includes(order.status)) continue;

                try {
                    if (order.swapType === 'same-chain') {
                        // Poll CashToken relayer
                        if (order.status !== 'pending') continue;
                        const res = await axios.get(`${CASHTOKEN_RELAYER_URL}/intent/${order.intentId}`);
                        const intent = res.data;
                        if (intent) {
                            if (intent.status === 'filled') {
                                order.status = 'filled';
                                order.fillTxid = intent.fillTxid;
                                order.explorerUrl = intent.explorerUrl || `https://chipnet.chaingraph.cash/tx/${intent.fillTxid}`;
                                updated = true;
                            } else if (intent.status === 'cancelled' || intent.status === 'expired') {
                                order.status = intent.status;
                                updated = true;
                            }
                        }
                    } else {
                        // Poll cross-chain relayer
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
                                // Build destination explorer URL
                                const destChain = order.swapType === 'bch-to-sol' ? 'solana' : 'bch';
                                if (intent.destFillTx) {
                                    order.destExplorerUrl = buildExplorerUrl(intent.destFillTx, destChain);
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
                                        const destChain = order.swapType === 'bch-to-sol' ? 'solana' : 'bch';
                                        order.destExplorerUrl = buildExplorerUrl(intent.destClaimTx, destChain);
                                    }
                                    updated = true;
                                }
                            }

                            if (intent.status === 'REFUNDED' || intent.status === 'FAILED') {
                                order.status = 'cancelled';
                                updated = true;
                            }
                        }
                    }
                } catch (err: any) {
                    // If relayer returns 404, the intent doesn't exist anymore — mark as expired
                    if (err?.response?.status === 404 && order.swapType !== 'same-chain') {
                        order.status = 'expired';
                        updated = true;
                    }
                    /* skip other errors */
                }
            }

            if (updated) {
                localStorage.setItem(BCH_ORDERS_KEY, JSON.stringify(all));
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
            const saved = localStorage.getItem(BCH_ORDERS_KEY);
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

                if (!solanaWallet.publicKey || !solanaWallet.signTransaction) {
                    throw new Error('Solana wallet not connected');
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

                const takerTokenAccount = await getAssociatedTokenAddress(tokenMint, solanaWallet.publicKey!);

                // Fetch intent from Relayer to confirm Taker identity
                console.log('[Claim] Fetching intent data to verify Taker identity...');
                const intentRes = await axios.get(`${BCH_SOLANA_RELAYER_URL}/intents/${order.intentId}`);
                const expectedTaker = intentRes.data?.intent?.recipientAddress;

                console.log('[Claim] Expected Token/Mint:', tokenMint.toBase58());
                console.log('[Claim] Expected Taker:', expectedTaker);
                console.log('[Claim] Connected Taker (Signing Wallet):', solanaWallet.publicKey!.toBase58());

                if (expectedTaker && expectedTaker !== solanaWallet.publicKey!.toBase58()) {
                    throw new Error(`Wallet Mismatch! You connected ${solanaWallet.publicKey!.toBase58().slice(0, 6)}... but the escrow requires ${expectedTaker.slice(0, 6)}... to claim it.`);
                }

                // Check if user has an ATA, if not, create it first
                const accountInfo = await solanaConnection.getAccountInfo(takerTokenAccount);
                if (!accountInfo) {
                    console.log('[Claim] ATA does not exist, creating it now:', takerTokenAccount.toBase58());
                    setSwapStep('Creating Token Account (Transaction 1 of 2)...');

                    const ataTx = new anchor.web3.Transaction().add(
                        createAssociatedTokenAccountInstruction(
                            solanaWallet.publicKey!, // Payer
                            takerTokenAccount,      // ATA
                            solanaWallet.publicKey!, // Owner
                            tokenMint               // Mint
                        )
                    );

                    ataTx.recentBlockhash = (await solanaConnection.getLatestBlockhash()).blockhash;
                    ataTx.feePayer = solanaWallet.publicKey!;

                    const ataSignature = await solanaWallet.sendTransaction(ataTx, solanaConnection);
                    await solanaConnection.confirmTransaction(ataSignature, 'processed');
                    console.log('[Claim] ATA Created successfully.');
                }

                const transaction = new anchor.web3.Transaction();

                // Manually build instruction to avoid Anchor version mismatch IDL parsing errors
                // The discriminator for `claim` from the IDL is [62, 198, 214, 193, 213, 159, 108, 210]
                const CLAIM_DISCRIMINATOR = Buffer.from([62, 198, 214, 193, 213, 159, 108, 210]);
                const data = Buffer.concat([CLAIM_DISCRIMINATOR, secretBuf]);

                const ix = new anchor.web3.TransactionInstruction({
                    programId: new PublicKey(SOLANA_PROGRAM_ID),
                    keys: [
                        { pubkey: solanaWallet.publicKey!, isSigner: true, isWritable: true },
                        { pubkey: escrowPda, isSigner: false, isWritable: true },
                        { pubkey: vaultPda, isSigner: false, isWritable: true },
                        { pubkey: takerTokenAccount, isSigner: false, isWritable: true },
                        { pubkey: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'), isSigner: false, isWritable: false }
                    ],
                    data
                });

                transaction.add(ix);

                try {
                    // Pre-flight simulation to catch exact errors (wallets often swallow RPC errors)
                    // Wallets typically run their own simulation, so we just set up the transaction config
                    transaction.recentBlockhash = (await solanaConnection.getLatestBlockhash()).blockhash;
                    transaction.feePayer = solanaWallet.publicKey!;

                    // Adjust step message depending on if ATA was just created
                    setSwapStep(accountInfo ? 'Please sign the transaction in your wallet...' : 'Please sign the claim transaction (Transaction 2 of 2)...');

                    // User signs and sends transaction
                    const signature = await solanaWallet.sendTransaction(transaction, solanaConnection);
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

                const provider = new ElectrumNetworkProvider('chipnet');
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

            localStorage.setItem(BCH_ORDERS_KEY, JSON.stringify(all));
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
    }, [bchWallet.connected, solanaWallet.publicKey, solanaWallet.signTransaction]);

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
