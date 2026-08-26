import { createContext, useContext, useState, ReactNode } from 'react';
import { useWallet as useAptosWallet } from '@/context/wallet-provider';
import { useWallet as useSolanaWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, Keypair } from "@solana/web3.js";
import { signAndSubmitTransaction } from "@/lib/wallet/adapter";
import { Aptos, AptosConfig, Network, AccountAddress } from '@aptos-labs/ts-sdk';
import axios from 'axios';
import { CROSS_CHAIN_RELAYER_URL } from '../lib/config';
import { DEFAULT_NETWORK } from '../lib/wallet/networks';
import * as anchor from '@coral-xyz/anchor';
import { notifyToast as toast } from '@/lib/notify-toast';
import { createCloseAccountInstruction, getAssociatedTokenAddress, NATIVE_MINT } from '@solana/spl-token';
import { useWDK } from '@/context/WDKProvider';

interface CrossChainContextType {
    isLoading: boolean;
    relayerUrl: string;
    createMovementToSolanaSwap: (
        sellAmount: string,
        buyAmount: string, // SOL amount to receive
        userSolanaAddress: string
    ) => Promise<void>;
    createSolanaToMovementSwap: (
        sellAmount: string, // SOL amount to send
        buyAmount: string,  // MOVE amount to receive (octas)
        userMovementAddress: string
    ) => Promise<void>;
    unwrapWSOL: () => Promise<void>;
}

const CrossChainContext = createContext<CrossChainContextType | undefined>(undefined);

export function CrossChainProvider({ children }: { children: ReactNode }) {
    const aptos = useAptosWallet();
    const solana = useSolanaWallet();
    const wdk = useWDK();
    const { connection: solanaConnection } = useConnection();
    const [isLoading, setIsLoading] = useState(false);

    // Helper to generate hashlock
    const generateHashlock = async () => {
        const secretBytes = new Uint8Array(32);
        crypto.getRandomValues(secretBytes);
        const secretHex = Array.from(secretBytes).map(b => b.toString(16).padStart(2, '0')).join('');

        const hashlockBuffer = await crypto.subtle.digest("SHA-256", secretBytes);
        const hashlockArray = Array.from(new Uint8Array(hashlockBuffer));
        const hashlockHex = "0x" + hashlockArray.map(b => b.toString(16).padStart(2, '0')).join('');

        return { secretHex, hashlockHex, hashlockBytes: hashlockArray };
    };

    const savePendingSwap = (hashlockHex: string, data: any) => {
        const stored = localStorage.getItem('cross_chain_pending');
        const pending = stored ? JSON.parse(stored) : {};
        pending[hashlockHex] = data;
        localStorage.setItem('cross_chain_pending', JSON.stringify(pending));
    };

    const createMovementToSolanaSwap = async (sellAmount: string, buyAmount: string, userSolanaAddress: string) => {
        const isWdkMovement = !!wdk.movementAccount;
        if (!isWdkMovement && (!aptos.account || !aptos.wallet)) {
            throw new Error("Movement wallet not connected");
        }
        setIsLoading(true);

        try {
            // 1. Generate Hashlock
            const { secretHex, hashlockHex, hashlockBytes } = await generateHashlock();
            const amountOctas = parseFloat(sellAmount) * 1e8; // MOVE has 8 decimals

            console.log("Generated Hashlock:", hashlockHex);
            const pendingSwap = {
                secret: secretHex,
                hashlock: hashlockHex,
                direction: 'MOV_TO_SOL',
                amount: sellAmount,
                timestamp: Date.now(),
                status: 'PENDING_LOCK'
            };
            savePendingSwap(hashlockHex, pendingSwap);

            const MOVEMENT_HTLC_ADDR = "0x485ca1c12b5dfa01c282b9c7ef09fdfebbf877ed729bf999ce61a8ec5c5e69bd";

            // 1. Fetch Relayer Address from /health
            let relayerAddress = "";
            try {
                const healthRes = await axios.get(`${CROSS_CHAIN_RELAYER_URL}/health`);
                relayerAddress = healthRes.data.movement?.address || healthRes.data.wallets?.movement?.address || healthRes.data.pubkeys?.movement || "";
            } catch (e) {
                console.error("Relayer health check failed", e);
                throw new Error("Relayer unavailable");
            }

            // Init Client for time & stats
            const aptosClient = new Aptos(new AptosConfig({
                network: Network.CUSTOM,
                fullnode: DEFAULT_NETWORK.url
            }));

            const ledgerInfo = await aptosClient.getLedgerInfo();
            const chainTime = Math.floor(parseInt(ledgerInfo.ledger_timestamp) / 1000000);
            const expireTimestamp = chainTime + 600;

            let predictedEscrowId = 0;
            try {
                const registryStats = await aptosClient.view({
                    payload: {
                        function: `${MOVEMENT_HTLC_ADDR}::htlc_escrow::get_registry_stats`,
                        typeArguments: ["0x1::aptos_coin::AptosCoin"],
                        functionArguments: [MOVEMENT_HTLC_ADDR]
                    }
                });
                predictedEscrowId = parseInt(registryStats[0] as string);
                console.log("Predicted Escrow ID from registry:", predictedEscrowId);
            } catch (e) {
                console.error("Failed to get registry stats:", e);
                toast.error("Failed to prepare escrow. Please try again.");
                throw new Error("Could not get registry stats");
            }

            console.log("Creating Escrow on Movement...");
            let txHash = '';

            if (isWdkMovement) {
                const rawTx = await aptosClient.transaction.build.simple({
                    sender: wdk.movementAccount.accountAddress,
                    data: {
                        function: `${MOVEMENT_HTLC_ADDR}::htlc_escrow::create_escrow`,
                        typeArguments: ["0x1::aptos_coin::AptosCoin"],
                        functionArguments: [
                            MOVEMENT_HTLC_ADDR,
                            hashlockBytes,
                            relayerAddress,
                            amountOctas.toString(),
                            3600
                        ],
                    },
                    options: { expireTimestamp }
                });
                const pendingTx = await aptosClient.signAndSubmitTransaction({
                    signer: wdk.movementAccount,
                    transaction: rawTx,
                });
                txHash = pendingTx.hash;
            } else {
                const response = await signAndSubmitTransaction(aptos.wallet!, {
                    function: `${MOVEMENT_HTLC_ADDR}::htlc_escrow::create_escrow`,
                    typeArguments: ["0x1::aptos_coin::AptosCoin"],
                    functionArguments: [
                        MOVEMENT_HTLC_ADDR,
                        hashlockBytes,
                        relayerAddress,
                        amountOctas.toString(),
                        3600
                    ],
                    options: {
                        expireTimestamp: expireTimestamp
                    }
                });
                if (!response || response.status === 'Rejected' || !response.hash) {
                    throw new Error("Transaction rejected by wallet.");
                }
                txHash = response.hash;
            }

            let sourceEscrowId = predictedEscrowId;
            try {
                const pendingTx = await aptosClient.waitForTransaction({ transactionHash: txHash });
                console.log("Transaction confirmed:", (pendingTx as any).success ? "SUCCESS" : "FAILED");

                if ('events' in pendingTx) {
                    const events = pendingTx.events;
                    const escrowEvent = events.find((e: any) => e.type.includes("::htlc_escrow::NewEscrowEvent"));
                    if (escrowEvent && escrowEvent.data?.escrow_id !== undefined) {
                        sourceEscrowId = Number(escrowEvent.data.escrow_id);
                        console.log("✅ Confirmed On-Chain Escrow ID from event:", sourceEscrowId);
                    } else {
                        console.log("Using predicted Escrow ID:", sourceEscrowId);
                    }
                }
            } catch (e) {
                console.error("Failed to confirm transaction", e);
                throw new Error("Transaction may have failed. Please check your wallet.");
            }

            console.log("✅ Final Escrow ID:", sourceEscrowId);

            const now = Math.floor(Date.now() / 1000);
            const intent = {
                maker: new PublicKey(userSolanaAddress),
                sellToken: new PublicKey("11111111111111111111111111111111"), // Native SOL
                buyToken: new PublicKey("11111111111111111111111111111111"),
                sellAmount: new anchor.BN(amountOctas),
                startAmount: new anchor.BN(parseFloat(buyAmount) * 1e9),
                endAmount: new anchor.BN(parseFloat(buyAmount) * 1e9),
                startTime: new anchor.BN(now),
                endTime: new anchor.BN(now + 3600),
                nonce: new anchor.BN(now),
            };

            let encodedIntent: Buffer;
            try {
                const buffer = Buffer.alloc(32 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 8);
                let offset = 0;

                const makerBuf = intent.maker.toBuffer();
                makerBuf.copy(buffer, offset);
                offset += 32;

                const sellTokenBuf = intent.sellToken.toBuffer();
                sellTokenBuf.copy(buffer, offset);
                offset += 32;

                const buyTokenBuf = intent.buyToken.toBuffer();
                buyTokenBuf.copy(buffer, offset);
                offset += 32;

                const sellAmountBuf = intent.sellAmount.toArrayLike(Buffer, 'le', 8);
                sellAmountBuf.copy(buffer, offset);
                offset += 8;

                const startAmountBuf = intent.startAmount.toArrayLike(Buffer, 'le', 8);
                startAmountBuf.copy(buffer, offset);
                offset += 8;

                const endAmountBuf = intent.endAmount.toArrayLike(Buffer, 'le', 8);
                endAmountBuf.copy(buffer, offset);
                offset += 8;

                const startTimeBuf = intent.startTime.toArrayLike(Buffer, 'le', 8);
                startTimeBuf.copy(buffer, offset);
                offset += 8;

                const endTimeBuf = intent.endTime.toArrayLike(Buffer, 'le', 8);
                endTimeBuf.copy(buffer, offset);
                offset += 8;

                const nonceBuf = intent.nonce.toArrayLike(Buffer, 'le', 8);
                nonceBuf.copy(buffer, offset);
                offset += 8;

                encodedIntent = buffer;
            } catch (e) {
                console.error("Manual encoding failed", e);
                throw new Error("Failed to encode Intent data for signing");
            }

            const intentHex = encodedIntent.toString('hex');
            const messageText = `Intent Protocol Swap\n\nIntent (hex): ${intentHex}`;
            const messageToSign = new TextEncoder().encode(messageText);

            let signature = "";
            if (wdk.solanaSigner?.secretKey) {
                const keypair = Keypair.fromSecretKey(wdk.solanaSigner.secretKey);
                const nacl = await import('tweetnacl');
                const sig = nacl.default.sign.detached(messageToSign, keypair.secretKey);
                signature = "0x" + Buffer.from(sig).toString('hex');
            } else if (solana.signMessage) {
                const signatureBytes = await solana.signMessage(messageToSign);
                signature = "0x" + Buffer.from(signatureBytes).toString('hex');
            }

            const userMovAddress = isWdkMovement ? wdk.movementAddress : aptos.account?.address;

            // Send to Relayer
            await axios.post(`${CROSS_CHAIN_RELAYER_URL}/swap/movement-to-solana`, {
                makerAddress: userMovAddress,
                recipientAddress: userSolanaAddress,
                sellAmount: amountOctas.toString(),
                buyAmount: (parseFloat(buyAmount) * 1e9).toString(), // Lamports
                hashlock: hashlockHex,
                sourceEscrowId: sourceEscrowId,
                signature: signature,
                intent: {
                    ...intent,
                    maker: intent.maker.toBase58(),
                    sell_token: intent.sellToken.toBase58(),
                    buy_token: intent.buyToken.toBase58(),
                    sell_amount: intent.sellAmount.toString(),
                    start_amount: intent.startAmount.toString(),
                    end_amount: intent.endAmount.toString(),
                    start_time: intent.startTime.toString(),
                    end_time: intent.endTime.toString(),
                    nonce: intent.nonce.toString()
                }
            });

            // Update storage
            pendingSwap.status = 'LOCKED_ON_SOURCE';
            (pendingSwap as any).sourceEscrowId = sourceEscrowId;
            savePendingSwap(hashlockHex, pendingSwap);

            toast.success("Cross-Chain Swap Initiated!");

        } catch (e: any) {
            console.error("Swap Error:", e);
            throw e;
        } finally {
            setIsLoading(false);
        }
    };

    const createSolanaToMovementSwap = async (sellAmount: string, buyAmount: string, userMovementAddress: string) => {
        const isWdkSolana = !!wdk.solanaSigner?.secretKey;
        if (!isWdkSolana && !solana.publicKey) throw new Error("Solana wallet not connected");
        setIsLoading(true);

        try {
            const { secretHex, hashlockHex } = await generateHashlock();

            const pendingSwap = {
                secret: secretHex,
                hashlock: hashlockHex,
                direction: 'SOL_TO_MOV',
                amount: sellAmount,
                timestamp: Date.now(),
                status: 'PENDING_LOCK'
            };
            savePendingSwap(hashlockHex, pendingSwap);

            const amountLamports = Math.floor(parseFloat(sellAmount) * LAMPORTS_PER_SOL);
            const RELAYER_SOL_ADDR = new PublicKey("Crgx1n8HxZe8fq3d3vYhYrLDuKJ3pJZN4gfeSKuNarub");

            let userSolPubkey: PublicKey;
            let signature = '';

            if (isWdkSolana) {
                const keypair = Keypair.fromSecretKey(wdk.solanaSigner.secretKey);
                userSolPubkey = keypair.publicKey;
                const transaction = new Transaction().add(
                    SystemProgram.transfer({
                        fromPubkey: keypair.publicKey,
                        toPubkey: RELAYER_SOL_ADDR,
                        lamports: amountLamports,
                    })
                );
                const { blockhash } = await solanaConnection.getLatestBlockhash();
                transaction.recentBlockhash = blockhash;
                transaction.feePayer = keypair.publicKey;
                signature = await solanaConnection.sendTransaction(transaction, [keypair]);
                await solanaConnection.confirmTransaction(signature, "confirmed");
            } else {
                userSolPubkey = solana.publicKey!;
                const transaction = new Transaction().add(
                    SystemProgram.transfer({
                        fromPubkey: solana.publicKey!,
                        toPubkey: RELAYER_SOL_ADDR,
                        lamports: amountLamports,
                    })
                );
                const { blockhash, lastValidBlockHeight } = await solanaConnection.getLatestBlockhash();
                transaction.recentBlockhash = blockhash;
                transaction.feePayer = solana.publicKey!;

                if (!solana.signTransaction) throw new Error("Wallet does not support signTransaction");
                const signedTransaction = await solana.signTransaction(transaction);
                signature = await solanaConnection.sendRawTransaction(signedTransaction.serialize());
                await solanaConnection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
            }

            console.log("Solana Lock Tx:", signature);

            await axios.post(`${CROSS_CHAIN_RELAYER_URL}/swap/solana-to-movement`, {
                makerAddress: userSolPubkey.toString(),
                recipientAddress: userMovementAddress,
                sellAmount: amountLamports.toString(),
                buyAmount: (parseFloat(buyAmount) * 1e8).toString(),
                hashlock: hashlockHex,
                sourceEscrowPda: signature
            });

            pendingSwap.status = 'LOCKED_ON_SOURCE';
            savePendingSwap(hashlockHex, pendingSwap);

            toast.success("Cross-Chain Swap Initiated!");

        } catch (e: any) {
            console.error("Swap Error:", e);
            throw e;
        } finally {
            setIsLoading(false);
        }
    };

    const unwrapWSOL = async () => {
        const solPubkey = wdk.solanaSigner ? new PublicKey(wdk.solanaAddress!) : solana.publicKey;
        if (!solPubkey) {
            toast.error("Solana wallet not connected");
            return;
        }
        setIsLoading(true);
        try {
            const wsolAddress = await getAssociatedTokenAddress(NATIVE_MINT, solPubkey);
            const accountInfo = await solanaConnection.getAccountInfo(wsolAddress);
            if (!accountInfo) {
                toast.info("No WSOL account found to unwrap.");
                return;
            }

            toast.info("Unwrapping WSOL...");

            const tx = new Transaction().add(
                createCloseAccountInstruction(
                    wsolAddress,
                    solPubkey,
                    solPubkey
                )
            );

            const { blockhash } = await solanaConnection.getLatestBlockhash();
            tx.recentBlockhash = blockhash;
            tx.feePayer = solPubkey;

            let signature = '';
            if (wdk.solanaSigner?.secretKey) {
                const keypair = Keypair.fromSecretKey(wdk.solanaSigner.secretKey);
                signature = await solanaConnection.sendTransaction(tx, [keypair]);
                await solanaConnection.confirmTransaction(signature);
            } else if (solana.signTransaction) {
                const signedTx = await solana.signTransaction(tx);
                signature = await solanaConnection.sendRawTransaction(signedTx.serialize());
                await solanaConnection.confirmTransaction(signature);
            }

            toast.success("Unwrapped WSOL successfully!");
        } catch (e: any) {
            console.error("Unwrap failed", e);
            toast.error("Failed to unwrap WSOL: " + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <CrossChainContext.Provider value={{
            isLoading,
            relayerUrl: CROSS_CHAIN_RELAYER_URL,
            createMovementToSolanaSwap,
            createSolanaToMovementSwap,
            unwrapWSOL
        }}>
            {children}
        </CrossChainContext.Provider>
    );
}

export const useCrossChain = () => {
    const context = useContext(CrossChainContext);
    if (context === undefined) {
        throw new Error('useCrossChain must be used within a CrossChainProvider');
    }
    return context;
};
