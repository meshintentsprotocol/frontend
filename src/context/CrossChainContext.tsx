import { createContext, useContext, useState, ReactNode } from 'react';
import { useWallet as useAptosWallet } from '@/context/wallet-provider';
import { useWallet as useSolanaWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { signAndSubmitTransaction } from "@/lib/wallet/adapter";
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import axios from 'axios';
import { CROSS_CHAIN_RELAYER_URL } from '../lib/config';
import { DEFAULT_NETWORK } from '../lib/wallet/networks';
import * as anchor from '@coral-xyz/anchor';
import { notifyToast as toast } from '@/lib/notify-toast';
import { createCloseAccountInstruction, getAssociatedTokenAddress, NATIVE_MINT } from '@solana/spl-token';

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

        return { secretHex, hashlockHex, hashlockBytes: hashlockArray }; // Return array for move calls
    };

    const savePendingSwap = (hashlockHex: string, data: any) => {
        const stored = localStorage.getItem('cross_chain_pending');
        const pending = stored ? JSON.parse(stored) : {};
        pending[hashlockHex] = data;
        localStorage.setItem('cross_chain_pending', JSON.stringify(pending));
    };

    const createMovementToSolanaSwap = async (sellAmount: string, buyAmount: string, userSolanaAddress: string) => {
        if (!aptos.account || !aptos.wallet) throw new Error("Movement wallet not connected");
        setIsLoading(true);

        try {
            // 1. Generate Hashlock
            const { secretHex, hashlockHex, hashlockBytes } = await generateHashlock();
            const amountOctas = parseFloat(sellAmount) * 1e8; // MOVE has 8 decimals

            console.log("Generated Hashlock:", hashlockHex);
            // Store pending state
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
                relayerAddress = healthRes.data.movement.address;
            } catch (e) {
                console.error("Relayer health check failed", e);
                throw new Error("Relayer unavailable");
            }

            // Init Client for time & stats
            const aptosClient = new Aptos(new AptosConfig({
                network: Network.CUSTOM,
                fullnode: DEFAULT_NETWORK.url // Use consistent network
            }));

            // Fetch ledger info to ensure expiration is valid (User clock is 3h behind)
            const ledgerInfo = await aptosClient.getLedgerInfo();
            const chainTime = Math.floor(parseInt(ledgerInfo.ledger_timestamp) / 1000000);
            const expireTimestamp = chainTime + 600; // 10 minutes from CHAIN time

            // 2. GET PREDICTED ESCROW ID (Registry Stats) - BEFORE creating escrow
            //    The contract doesn't emit NewEscrowEvent, so we must predict the ID.
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

            // 3. Submit Transaction
            console.log("Creating Escrow on Movement...");

            // 4. Create Escrow on Movement
            const response = await signAndSubmitTransaction(aptos.wallet, {
                function: `${MOVEMENT_HTLC_ADDR}::htlc_escrow::create_escrow`,
                typeArguments: ["0x1::aptos_coin::AptosCoin"],
                functionArguments: [
                    MOVEMENT_HTLC_ADDR,
                    hashlockBytes, // Pass as number[] (u8 vector) to avoid string ambiguity
                    relayerAddress,
                    amountOctas.toString(),
                    3600 // timelock 1hr (Duration) - Tested working
                ],
                options: {
                    expireTimestamp: expireTimestamp
                }
            });
            console.log("Movement Lock Tx:", response);

            // Check if transaction was rejected or failed
            if (!response || response.status === 'Rejected' || !response.hash) {
                throw new Error("Transaction rejected by wallet. Please ensure you have sufficient MOVE balance for the deposit and gas fees.");
            }

            // 5. Wait for confirmation and use predicted ID
            let sourceEscrowId = predictedEscrowId;
            try {
                const pendingTx = await aptosClient.waitForTransaction({ transactionHash: response.hash });
                console.log("Transaction confirmed:", (pendingTx as any).success ? "SUCCESS" : "FAILED");

                // Try to find NewEscrowEvent (in case contract is updated later)
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
                sellToken: new PublicKey("11111111111111111111111111111111"), // Placeholder logic from existing code
                buyToken: new PublicKey("11111111111111111111111111111111"),
                sellAmount: new anchor.BN((parseFloat(buyAmount) * 1e9).toString()),
                startAmount: new anchor.BN((parseFloat(buyAmount) * 1e9).toString()),
                endAmount: new anchor.BN((parseFloat(buyAmount) * 1e9).toString()),
                startTime: new anchor.BN(now - 60),
                endTime: new anchor.BN(now + 3600),
                nonce: new anchor.BN(Date.now())
            };

            // Manual intent serialization (Borsh layout)

            let encodedIntent;
            try {
                // Encode Intent for Signing MANUALLY
                // Anchor's coder failed to find "Intent" type for some reason.
                // We can manually serialize the struct (Borsh/Layout equivalent).
                // IDL Layout:
                // maker (32), sell_token (32), buy_token (32)
                // sell_amount (8), start_amount (8), end_amount (8)
                // start_time (8), end_time (8), nonce (8)
                // Total: 144 bytes

                const buffer = Buffer.alloc(144);
                let offset = 0;

                // 1. maker (Pubkey)
                const makerBuf = intent.maker.toBuffer();
                makerBuf.copy(buffer, offset);
                offset += 32;

                // 2. sell_token (Pubkey)
                const sellTokenBuf = intent.sellToken.toBuffer();
                sellTokenBuf.copy(buffer, offset);
                offset += 32;

                // 3. buy_token (Pubkey)
                const buyTokenBuf = intent.buyToken.toBuffer();
                buyTokenBuf.copy(buffer, offset);
                offset += 32;

                // 4. sell_amount (u64)
                const sellAmountBuf = intent.sellAmount.toArrayLike(Buffer, 'le', 8);
                sellAmountBuf.copy(buffer, offset);
                offset += 8;

                // 5. start_amount (u64)
                const startAmountBuf = intent.startAmount.toArrayLike(Buffer, 'le', 8);
                startAmountBuf.copy(buffer, offset);
                offset += 8;

                // 6. end_amount (u64)
                const endAmountBuf = intent.endAmount.toArrayLike(Buffer, 'le', 8);
                endAmountBuf.copy(buffer, offset);
                offset += 8;

                // 7. start_time (i64)
                const startTimeBuf = intent.startTime.toArrayLike(Buffer, 'le', 8);
                startTimeBuf.copy(buffer, offset);
                offset += 8;

                // 8. end_time (i64)
                const endTimeBuf = intent.endTime.toArrayLike(Buffer, 'le', 8);
                endTimeBuf.copy(buffer, offset);
                offset += 8;

                // 9. nonce (u64)
                const nonceBuf = intent.nonce.toArrayLike(Buffer, 'le', 8);
                nonceBuf.copy(buffer, offset);
                offset += 8;

                encodedIntent = buffer;
                console.log("Serialized Intent (Manual):", encodedIntent.toString('hex'));

            } catch (e) {
                console.error("Manual encoding failed", e);
                throw new Error("Failed to encode Intent data for signing");
            }

            if (!solana.signMessage) throw new Error("Wallet does not support signMessage");

            // MATCHING REFERENCE IMPLEMENTATION (cross-chain-telegram/src/bot/commands.ts)
            // The signature is expected to be over a Text Message containing the Intent Hex.
            // This avoids "WalletSignMessageError" for binary data and matches the Relayer/Program expectations.

            const intentHex = encodedIntent.toString('hex');
            const messageText = `Intent Protocol Swap\n\nIntent (hex): ${intentHex}`;
            const messageToSign = new TextEncoder().encode(messageText);

            console.log("Signing Message Text:", messageText);

            const signatureBytes = await solana.signMessage(messageToSign);
            const signature = "0x" + Buffer.from(signatureBytes).toString('hex');

            console.log("Solana Signature:", signature);


            // 4. Send to Relayer
            await axios.post(`${CROSS_CHAIN_RELAYER_URL}/swap/movement-to-solana`, {
                makerAddress: aptos.account.address,
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
        // Logic for SOL -> MOV
        if (!solana.publicKey) throw new Error("Solana wallet not connected");
        setIsLoading(true);

        try {
            const { secretHex, hashlockHex } = await generateHashlock();

            // Store pending
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

            // 1. Get Relayer SOL address
            // Ideally fetch from relayer health, but hardcoded fallback for now in case of issues, or use what was in existing code
            const RELAYER_SOL_ADDR = new PublicKey("Crgx1n8HxZe8fq3d3vYhYrLDuKJ3pJZN4gfeSKuNarub");

            // 2. Transfer SOL (Lock)
            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: solana.publicKey,
                    toPubkey: RELAYER_SOL_ADDR,
                    lamports: amountLamports,
                })
            );

            const { blockhash, lastValidBlockHeight } = await solanaConnection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = solana.publicKey;

            if (!solana.signTransaction) throw new Error("Wallet does not support signTransaction");

            const signedTransaction = await solana.signTransaction(transaction);
            const signature = await solanaConnection.sendRawTransaction(signedTransaction.serialize());

            console.log("Solana Lock Tx:", signature);
            await solanaConnection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");

            // 3. Call Relayer
            await axios.post(`${CROSS_CHAIN_RELAYER_URL}/swap/solana-to-movement`, {
                makerAddress: solana.publicKey.toString(),
                recipientAddress: userMovementAddress,
                sellAmount: amountLamports.toString(),
                buyAmount: (parseFloat(buyAmount) * 1e8).toString(), // MOVE octas
                hashlock: hashlockHex,
                sourceEscrowPda: signature // Use tx signature as ID
            });

            // Update storage
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
        if (!solana.publicKey || !solana.signTransaction) {
            toast.error("Solana wallet not connected");
            return;
        }
        setIsLoading(true);
        try {
            // 1. Get WSOL Address
            const wsolAddress = await getAssociatedTokenAddress(NATIVE_MINT, solana.publicKey);

            // 2. Check if account exists
            const accountInfo = await solanaConnection.getAccountInfo(wsolAddress);
            if (!accountInfo) {
                toast.info("No WSOL account found to unwrap.");
                return;
            }

            toast.info("Unwrapping WSOL...");

            // 3. Create Close Account Instruction
            const tx = new Transaction().add(
                createCloseAccountInstruction(
                    wsolAddress,       // Account to close
                    solana.publicKey,  // Destination for lamports
                    solana.publicKey   // Owner
                )
            );

            const { blockhash } = await solanaConnection.getLatestBlockhash();
            tx.recentBlockhash = blockhash;
            tx.feePayer = solana.publicKey;

            const signedTx = await solana.signTransaction(tx);
            const signature = await solanaConnection.sendRawTransaction(signedTx.serialize());

            await solanaConnection.confirmTransaction(signature);
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
