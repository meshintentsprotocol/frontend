// OLD — retired 2026-10-19, kept until the clean-up. Not part of the live app. See devrel-agent-context/walletuidocs/connect/old-code.md.
import { useBCHWallet } from '@/context/BCHWalletProvider';
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wallet, Copy, ExternalLink, Loader2, RefreshCw, Shield, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { notifyToast as toast } from '@/lib/notify-toast';
// ============================================================================
// BCH Wallet Panel — Dual-mode BCH wallet + Solana wallet status
// ============================================================================

export function BCHWalletPanel() {
    const bch = useBCHWallet();
    const solana = useSolanaWallet();

    const copyAddress = (address: string, label: string) => {
        navigator.clipboard.writeText(address);
        toast.success(`${label} address copied!`);
    };

    const formatAddress = (addr: string) => {
        if (addr.length <= 16) return addr;
        return `${addr.slice(0, 12)}...${addr.slice(-6)}`;
    };

    const formatBalance = (sats: number) => {
        return (sats / 1e8).toFixed(6);
    };

    return (
        <Card className="border-muted">
            <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    Wallets
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* BCH Wallet */}
                <div className="rounded-lg bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-400" />
                            <span className="text-xs font-semibold uppercase tracking-wide">Bitcoin Cash</span>
                            {bch.walletMode && (
                                <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                                    {bch.walletMode === 'cashonize' ? '🔗 Cashonize' : '🌐 Browser'}
                                </Badge>
                            )}
                        </div>
                        {bch.connected && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs text-muted-foreground"
                                onClick={bch.disconnect}
                            >
                                Disconnect
                            </Button>
                        )}
                    </div>

                    {bch.connected && bch.address ? (
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs font-mono text-muted-foreground">{formatAddress(bch.address)}</span>
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyAddress(bch.address!, 'BCH')}>
                                    <Copy className="h-3 w-3" />
                                </Button>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold">{formatBalance(bch.balance)} BCH</span>
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={bch.refreshBalance}>
                                    <RefreshCw className="h-3 w-3" />
                                </Button>
                            </div>
                            <a
                                href="https://tbch4.googol.cash/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
                            >
                                <ExternalLink className="h-3 w-3" />
                                Get Chipnet BCH (Faucet)
                            </a>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {/* Cashonize — WalletConnect */}
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full h-9 text-xs justify-start gap-2"
                                onClick={bch.connectCashonize}
                                disabled={bch.connecting}
                            >
                                <Shield className="h-3.5 w-3.5 text-emerald-400" />
                                <div className="flex flex-col items-start">
                                    <span className="font-medium">Connect Cashonize</span>
                                    <span className="text-[10px] text-muted-foreground">via WalletConnect</span>
                                </div>
                            </Button>

                            {/* Browser Wallet — mainnet-js */}
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full h-9 text-xs justify-start gap-2"
                                onClick={bch.connectBrowserWallet}
                                disabled={bch.connecting}
                            >
                                {bch.connecting ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Globe className="h-3.5 w-3.5 text-blue-400" />
                                )}
                                <div className="flex flex-col items-start">
                                    <span className="font-medium">Browser Wallet</span>
                                    <span className="text-[10px] text-muted-foreground">Chipnet test wallet</span>
                                </div>
                            </Button>
                        </div>
                    )}
                </div>

                {/* Solana Wallet */}
                <div className="rounded-lg bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-purple-400" />
                            <span className="text-xs font-semibold uppercase tracking-wide">Solana</span>
                        </div>
                    </div>

                    {solana.connected && solana.publicKey ? (
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs font-mono text-muted-foreground">
                                    {formatAddress(solana.publicKey.toBase58())}
                                </span>
                                <Button variant="ghost" size="icon" className="h-5 w-5"
                                    onClick={() => copyAddress(solana.publicKey!.toBase58(), 'Solana')}>
                                    <Copy className="h-3 w-3" />
                                </Button>
                            </div>
                            <div className="text-sm font-semibold text-green-400">Connected</div>
                        </div>
                    ) : (
                        <div className="flex justify-center">
                            <WalletMultiButton style={{
                                height: '36px',
                                fontSize: '12px',
                                padding: '0 12px',
                                borderRadius: '8px',
                                width: '100%',
                                justifyContent: 'center'
                            }} />
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
