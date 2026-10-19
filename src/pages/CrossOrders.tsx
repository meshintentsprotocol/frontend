// OLD — retired 2026-10-19, kept until the clean-up. Not part of the live app. See devrel-agent-context/walletuidocs/connect/old-code.md.
import { CROSS_CHAIN_RELAYER_URL } from '../lib/config';
import { useState, useEffect } from 'react';
import { useWallet } from '@/context/wallet-provider'; // Aptos
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react'; // Solana
import { Button } from '@/components/ui/button';
import { ArrowRight, ExternalLink, RefreshCw, CheckCircle, Clock, Link as LinkIcon, LogOut, ArrowLeftRight, Coins } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import axios from 'axios';
import { notifyToast as toast } from '@/lib/notify-toast';
import { signAndSubmitTransaction } from "@/lib/wallet/adapter";
import { useCrossChain } from "@/context/CrossChainContext";


interface CrossChainIntent {
    id: string;
    direction: 'MOV_TO_SOL' | 'SOL_TO_MOV';
    makerAddress: string;
    recipientAddress: string;
    sellAmount: string; // amount in lowest unit
    buyAmount: string;
    hashlock: string;
    status: 'PENDING' | 'SOURCE_LOCKED' | 'DEST_FILLED' | 'DEST_CLAIMED' | 'SOURCE_CLAIMED' | 'COMPLETED' | 'REFUNDED' | 'FAILED';
    createdAt: number;
    sourceLockTx?: string;
    destFillTx?: string;
    sourceClaimTx?: string;
    destClaimTx?: string;
    destEscrowId?: string;
    sourceEscrowId?: string;
}

export default function CrossOrders() {
    const { connected: aptosConnected, account: aptosAccount, wallet: aptosWallet, connect: connectAptos, disconnect: disconnectAptos } = useWallet();
    const { connected: solanaConnected, publicKey: solanaPublicKey, connect: connectSolana, disconnect: disconnectSolana, select: selectSolanaWallet, wallets: solanaWallets } = useSolanaWallet();
    const { unwrapWSOL } = useCrossChain();

    const [orders, setOrders] = useState<CrossChainIntent[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const [relayerHealth, setRelayerHealth] = useState({ movement: false, solana: false });
    const [isHealthLoading, setIsHealthLoading] = useState(true);

    // --- Wallet Sync Logic ---
    useEffect(() => {
        if (aptosConnected || solanaConnected) {
            loadOrders();
        }
        checkRelayerHealth();
    }, [aptosConnected, solanaConnected]);

    const loadOrders = async () => {
        setIsLoading(true);
        try {
            const res = await axios.get(`${CROSS_CHAIN_RELAYER_URL}/orders`);
            const { active, completed } = res.data;
            const allOrders: CrossChainIntent[] = [...active, ...completed];

            // Filter by connected wallets
            const filtered = allOrders.filter(o => {
                const isMakerAptos = aptosAccount && o.makerAddress === aptosAccount.address.toString();
                const isRecipientAptos = aptosAccount && o.recipientAddress === aptosAccount.address.toString();
                const isMakerSol = solanaPublicKey && o.makerAddress === solanaPublicKey.toString();
                const isRecipientSol = solanaPublicKey && o.recipientAddress === solanaPublicKey.toString();

                return isMakerAptos || isRecipientAptos || isMakerSol || isRecipientSol;
            });

            // Sort by createdAt desc
            filtered.sort((a, b) => b.createdAt - a.createdAt);
            setOrders(filtered);
        } catch (e) {
            console.error("Failed to load orders", e);
        } finally {
            setIsLoading(false);
        }
    };

    const checkRelayerHealth = async () => {
        setIsHealthLoading(true);
        try {
            const res = await fetch(`${CROSS_CHAIN_RELAYER_URL}/health`).catch(() => ({ ok: false, json: async () => ({}) }));
            const data = await (res as any).json();

            setRelayerHealth({
                movement: data.movement?.connected || false,
                solana: data.solana?.connected || false
            });
        } catch (e) {
            toast.warning("Relayer Unreachable");
        } finally {
            setTimeout(() => setIsHealthLoading(false), 800); // 800ms min delay for UX
        }
    };

    const getExplorerLink = (hash: string | undefined, chain: 'MOVE' | 'SOL') => {
        if (!hash) return '#';
        if (chain === 'MOVE') return `https://explorer.movementlabs.xyz/txn/${hash}?network=testnet`;
        if (chain === 'SOL') return `https://solscan.io/tx/${hash}?cluster=devnet`;
        return '#';
    };

    const handleSolanaConnect = () => {
        const phantom = solanaWallets.find(w => w.adapter.name === 'Phantom');
        if (phantom) {
            selectSolanaWallet(phantom.adapter.name);
            connectSolana();
        } else {
            alert("Please install Phantom wallet!");
        }
    };

    const handleClaim = async (order: CrossChainIntent) => {
        try {
            const hashlock = order.hashlock;

            // 1. Retrieve Secret from LocalStorage
            const stored = localStorage.getItem('cross_chain_pending');
            const pending = stored ? JSON.parse(stored) : {};
            // Look for matching hashlock
            const swapData = pending[hashlock];

            if (!swapData || !swapData.secret) {
                toast.error("Secret not found!", { description: "This order was not initiated from this browser or storage was cleared." });
                return;
            }

            const secret = swapData.secret;

            if (order.direction === 'MOV_TO_SOL') {
                // MOVE -> SOL: User needs to Reveal Secret to Relayer to get paid (Trusted Mode)
                toast.info("Revealing secret to Relayer...");

                try {
                    await axios.post(`${CROSS_CHAIN_RELAYER_URL}/reveal-secret`, {
                        intentId: order.id,
                        secret: secret
                    });
                    toast.success("Secret Revealed! Funds should arrive in your Solana wallet shortly.");
                } catch (revealError: any) {
                    const errorMsg = revealError.response?.data?.error || revealError.message;
                    if (errorMsg.includes('not found')) {
                        toast.error("Order not found on relayer", {
                            description: "This order may have expired or the relayer was restarted. Please contact support with your order ID."
                        });
                    } else {
                        toast.error("Failed to reveal secret", { description: errorMsg });
                    }
                    throw new Error(errorMsg);
                }


            } else {
                // SOL -> MOVE: User claims on Movement Chain
                if (!aptosConnected || !aptosAccount) {
                    toast.error("Please connect movement wallet first");
                    return;
                }

                toast.info("Claiming on Movement...");
                const MOVEMENT_HTLC_ADDR = "0x485ca1c12b5dfa01c282b9c7ef09fdfebbf877ed729bf999ce61a8ec5c5e69bd";

                // Use destEscrowId from order
                const escrowId = order.destEscrowId;
                if (escrowId === undefined) {
                    throw new Error("Relayer has not provided Destination Escrow ID yet.");
                }

                // Convert secret hex to byte array
                const secretBytes = new Uint8Array(secret.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16)));

                if (!aptosWallet) {
                    toast.error("Wallet not connected");
                    return;
                }

                const response = await signAndSubmitTransaction(aptosWallet, {
                    function: `${MOVEMENT_HTLC_ADDR}::htlc_escrow::claim`,
                    typeArguments: ["0x1::aptos_coin::AptosCoin"],
                    functionArguments: [
                        MOVEMENT_HTLC_ADDR,
                        escrowId,
                        Array.from(secretBytes)
                    ]
                });

                console.log("Claim Tx:", response);
                toast.success("Claimed Successfully on Movement!");

                // Notify Relayer
                await axios.post(`${CROSS_CHAIN_RELAYER_URL}/reveal-secret`, {
                    intentId: order.id,
                    secret: secret
                });
            }

            setTimeout(loadOrders, 2000);

        } catch (e: any) {
            console.error(e);
            const errorMsg = e.message || 'Unknown error';

            // Check for specific Move abort errors
            if (errorMsg.includes('EESCROW_NOT_FOUND') || errorMsg.includes('Escrow ID not found')) {
                toast.error("Escrow Not Found", {
                    description: "This order's escrow was never created or has already been claimed/refunded. The relayer may have restarted during the swap process."
                });
            } else if (errorMsg.includes('Intent') && errorMsg.includes('not found')) {
                toast.error("Order Not Found", {
                    description: "This order may have expired or the relayer was restarted. Please contact support."
                });
            } else {
                toast.error("Claim Failed", { description: errorMsg });
            }
        }
    };

    return (
        <div className="container mx-auto py-10 max-w-6xl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-orange-600">
                        Cross-Chain Swaps
                    </h1>
                    <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <img src="https://raw.githubusercontent.com/kitelabs-io/mvmt-tokens/main/logos/MOVE.png" className="w-5 h-5 rounded-full" alt="Movement" />
                            <span>Movement</span>
                            <ArrowLeftRight className="h-4 w-4 mx-1" />
                            <img src="/assets/solanaLogo.png" className="w-5 h-5" alt="Solana" />
                            <span>Solana</span>
                        </div>
                        {/* Health Badges */}
                        <div className="flex gap-2 text-[10px] font-mono">
                            <Badge variant={relayerHealth.movement ? "outline" : "secondary"} className={relayerHealth.movement ? "text-green-500 border-green-500/30" : "text-yellow-500 border-yellow-500/30"}>
                                RELAYER: {isHealthLoading ? 'CHECKING...' : (relayerHealth.movement ? 'ONLINE' : 'OFFLINE')}
                            </Badge>
                            <Badge variant={relayerHealth.solana ? "outline" : "secondary"} className={relayerHealth.solana ? "text-green-500 border-green-500/30" : "text-yellow-500 border-yellow-500/30"}>
                                SOL-WORKER: {isHealthLoading ? 'CHECKING...' : (relayerHealth.solana ? 'ONLINE' : 'OFFLINE')}
                            </Badge>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={unwrapWSOL} className="border-yellow-500/30 text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10">
                        <Coins className="mr-2 h-4 w-4" />
                        Unwrap WSOL
                    </Button>
                    <Button variant="outline" onClick={loadOrders} disabled={isLoading}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Wallet Status Area */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {/* Movement Wallet */}
                <Card className={`border-l-4 ${aptosConnected ? 'border-l-green-500' : 'border-l-red-500'} bg-card/50`}>
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-medium text-yellow-500">Movement Wallet</CardTitle>
                        {aptosConnected ? (
                            <Button variant="ghost" size="sm" onClick={() => disconnectAptos()} className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500">
                                <LogOut className="h-3 w-3" />
                            </Button>
                        ) : (
                            <Button variant="outline" size="sm" onClick={connectAptos} className="h-7 text-xs">
                                Connect
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${aptosConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                            <span className="font-mono text-xs">
                                {aptosConnected ? aptosAccount?.address.toString().slice(0, 15) + '...' : 'Not Connected'}
                            </span>
                        </div>
                    </CardContent>
                </Card>

                {/* Solana Wallet */}
                <Card className={`border-l-4 ${solanaConnected ? 'border-l-green-500' : 'border-l-red-500'} bg-card/50`}>
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-medium text-purple-500">Solana Wallet</CardTitle>
                        {solanaConnected ? (
                            <Button variant="ghost" size="sm" onClick={() => disconnectSolana()} className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500">
                                <LogOut className="h-3 w-3" />
                            </Button>
                        ) : (
                            <Button variant="outline" size="sm" onClick={handleSolanaConnect} className="h-7 text-xs">
                                Connect Phantom
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${solanaConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                            <span className="font-mono text-xs">
                                {solanaConnected ? solanaPublicKey?.toString().slice(0, 15) + '...' : 'Not Connected'}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Orders List */}
            <div className="space-y-4">
                {orders.length === 0 ? (
                    <div className="text-center py-20 bg-muted/30 rounded-lg">
                        <p className="text-muted-foreground">No cross-chain swaps found for connected wallets.</p>
                        {(!aptosConnected || !solanaConnected) && <p className="text-xs text-yellow-500 mt-2">Make sure both wallets are connected.</p>}
                    </div>
                ) : (
                    orders.map((order) => {
                        const isMoveToSol = order.direction === 'MOV_TO_SOL';
                        const sourceChain = isMoveToSol ? 'MOVE' : 'SOL';
                        const destChain = isMoveToSol ? 'SOL' : 'MOVE';

                        // Status Logic
                        const isSourceLocked = order.status !== 'PENDING' && order.status !== 'FAILED';
                        const isDestFilled = order.status === 'DEST_FILLED' || order.status === 'DEST_CLAIMED' || order.status === 'COMPLETED'; // Relayer filled.
                        const isClaimed = order.status === 'DEST_CLAIMED' || order.status === 'COMPLETED' || order.status === 'SOURCE_CLAIMED';

                        return (
                            <Card key={order.id} className="overflow-hidden border-border/50 transition-all hover:border-yellow-500/50">
                                <div className="p-6">
                                    <div className="flex flex-col md:flex-row justify-between gap-6">
                                        {/* Header Info */}
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <Badge variant="outline" className={`text-xs ${isMoveToSol ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : 'bg-purple-500/10 text-purple-500 border-purple-500/20'}`}>
                                                    {isMoveToSol ? 'MOVE → SOL' : 'SOL → MOVE'}
                                                </Badge>
                                                <span className="text-xs text-muted-foreground">
                                                    {new Date(order.createdAt).toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4 text-xl font-bold">
                                                <span>{parseInt(order.sellAmount) / (isMoveToSol ? 1e8 : 1e9)} {isMoveToSol ? 'MOVE' : 'SOL'}</span>
                                                <ArrowRight className="text-muted-foreground h-5 w-5" />
                                                <span>{parseInt(order.buyAmount) / (isMoveToSol ? 1e9 : 1e8)} {isMoveToSol ? 'SOL' : 'MOVE'}</span>
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-2 font-mono truncate max-w-[300px]">
                                                ID: {order.id}
                                            </div>
                                        </div>

                                        {/* Visual Stepper */}
                                        <div className="flex-1 flex items-center justify-center gap-2 min-w-[300px]">
                                            {/* Step 1: Lock */}
                                            <div className="flex flex-col items-center">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 ${isSourceLocked ? 'bg-green-500/20 text-green-500' : 'bg-muted/20 text-muted-foreground'}`}>
                                                    <CheckCircle className="h-5 w-5" />
                                                </div>
                                                <span className="text-[10px] font-mono text-muted-foreground">LOCKED</span>
                                            </div>
                                            <div className={`h-[2px] w-12 ${isSourceLocked ? 'bg-green-500/50' : 'bg-muted'}`} />

                                            {/* Step 2: Relayer Fill */}
                                            <div className="flex flex-col items-center">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 ${isDestFilled ? 'bg-green-500/20 text-green-500' : (isSourceLocked ? 'bg-yellow-500/20 text-yellow-500 animate-pulse' : 'bg-muted/20 text-muted-foreground')}`}>
                                                    {isDestFilled ? <CheckCircle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                                                </div>
                                                <span className="text-[10px] font-mono text-muted-foreground">RELAYER OK</span>
                                            </div>
                                            <div className={`h-[2px] w-12 ${isDestFilled ? 'bg-green-500/50' : 'bg-muted'}`} />

                                            {/* Step 3: Claim */}
                                            <div className="flex flex-col items-center">
                                                {/* Show Claim button if DEST_FILLED, else Status */}
                                                {(order.status === 'DEST_FILLED') ? (
                                                    <Button size="sm" variant="default" className="h-8 rounded-full px-4 bg-green-600 hover:bg-green-700 animate-pulse" onClick={() => handleClaim(order)}>
                                                        CLAIM
                                                    </Button>
                                                ) : (
                                                    <>
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 ${isClaimed ? 'bg-green-500/20 text-green-500' : 'bg-muted/20 text-muted-foreground'}`}>
                                                            <CheckCircle className="h-5 w-5" />
                                                        </div>
                                                        <span className="text-[10px] font-mono text-muted-foreground">SETTLED</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Links */}
                                        <div className="flex flex-col gap-2 justify-center min-w-[150px]">
                                            <a
                                                href={getExplorerLink(order.sourceLockTx || order.sourceEscrowId, sourceChain)}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex items-center gap-2 text-xs text-yellow-500 hover:text-yellow-400"
                                            >
                                                <LinkIcon className="h-3 w-3" />
                                                Lock Tx
                                            </a>
                                            {order.destFillTx && (
                                                <a
                                                    href={getExplorerLink(order.destFillTx, destChain)}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="flex items-center gap-2 text-xs text-purple-500 hover:text-purple-400"
                                                >
                                                    <ExternalLink className="h-3 w-3" />
                                                    Fill Tx
                                                </a>
                                            )}
                                            {order.destClaimTx && (
                                                <a
                                                    href={getExplorerLink(order.destClaimTx, destChain)}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="flex items-center gap-2 text-xs text-green-500 hover:text-green-400"
                                                >
                                                    <ExternalLink className="h-3 w-3" />
                                                    Claim Tx
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        );
                    })
                )}
            </div>
        </div>
    );
}

