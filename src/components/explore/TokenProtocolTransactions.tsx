import { Loader2, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProtocolTransactions } from '@/hooks/useProtocolTransactions';
import type { ProtocolTx } from '@/lib/relayers';

interface TokenProtocolTransactionsProps {
    tokenId: string;
    isCashToken: boolean;
    isMainnet: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatAmount(amount: string, decimals = 4): string {
    const n = parseFloat(amount);
    if (isNaN(n)) return amount;
    if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
    if (n >= 1) return n.toFixed(decimals);
    return n.toFixed(6);
}

function formatTime(sec: number): { date: string; time: string } {
    const d = new Date(sec * 1000);
    const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return { date, time };
}

function truncateAddr(addr: string): string {
    if (!addr || addr.length < 12) return addr || '—';
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function explorerLink(tx: ProtocolTx): string | undefined {
    const txid = tx.fillTxid;
    if (!txid) return tx.explorerUrl;
    if (tx.source === 'cashtoken' || tx.source === 'bsc-bch')
        return `https://blockchair.com/bitcoin-cash/transaction/${txid}`;
    return `https://solscan.io/tx/${txid}`;
}

// Determine if user was buying or selling the featured token
function txType(tx: ProtocolTx, tokenId: string, isCashToken: boolean): 'buy' | 'sell' {
    if (isCashToken) {
        return tx.buyTokenRaw === tokenId ? 'buy' : 'sell';
    }
    const sym = tokenId.toUpperCase();
    return tx.buyToken === sym ? 'buy' : 'sell';
}

// Amount of the featured token in this tx
function featuredAmount(tx: ProtocolTx, tokenId: string, isCashToken: boolean): string {
    const type = txType(tx, tokenId, isCashToken);
    return type === 'buy' ? tx.buyAmount : tx.sellAmount;
}

// The other side of the trade
function otherSide(tx: ProtocolTx, tokenId: string, isCashToken: boolean): { symbol: string; amount: string } {
    const type = txType(tx, tokenId, isCashToken);
    return type === 'buy'
        ? { symbol: tx.sellToken, amount: tx.sellAmount }
        : { symbol: tx.buyToken, amount: tx.buyAmount };
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function TxRow({ tx, tokenId, isCashToken, symbol }: {
    tx: ProtocolTx;
    tokenId: string;
    isCashToken: boolean;
    symbol: string;
}) {
    const type = txType(tx, tokenId, isCashToken);
    const fAmount = featuredAmount(tx, tokenId, isCashToken);
    const other = otherSide(tx, tokenId, isCashToken);
    const { date, time } = formatTime(tx.createdAt);
    const href = explorerLink(tx);

    return (
        <tr className="hover:bg-white/[0.02] transition-colors group">
            {/* Time */}
            <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex flex-col">
                    <span className="font-medium text-foreground text-sm">{time}</span>
                    <span className="text-xs text-muted-foreground mt-0.5">{date}</span>
                </div>
            </td>

            {/* Type */}
            <td className="px-6 py-4 whitespace-nowrap">
                <span className={cn(
                    'text-xs font-semibold px-2 py-1 rounded-full border',
                    type === 'buy'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                )}>
                    {type === 'buy' ? 'Buy' : 'Sell'}
                </span>
            </td>

            {/* $(token) — featured token amount */}
            <td className="px-6 py-4 whitespace-nowrap text-right">
                <div className="flex flex-col items-end">
                    <span className="font-medium text-foreground font-mono text-sm">
                        {formatAmount(fAmount)}
                    </span>
                    <span className="text-xs text-muted-foreground mt-0.5">{symbol}</span>
                </div>
            </td>

            {/* For — other side */}
            <td className="px-6 py-4 whitespace-nowrap text-right">
                <div className="flex flex-col items-end">
                    <span className="font-medium text-foreground font-mono text-sm">
                        {formatAmount(other.amount)}
                    </span>
                    <span className="text-xs text-muted-foreground mt-0.5">{other.symbol}</span>
                </div>
            </td>

            {/* USD — placeholder */}
            <td className="px-6 py-4 whitespace-nowrap text-right hidden lg:table-cell">
                <span className="text-sm text-muted-foreground">—</span>
            </td>

            {/* Wallet */}
            <td className="px-6 py-4 whitespace-nowrap text-right hidden md:table-cell">
                <div className="flex items-center justify-end gap-1.5">
                    <span className="font-mono text-xs text-muted-foreground">
                        {truncateAddr(tx.makerAddress)}
                    </span>
                    {href && (
                        <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                            onClick={e => e.stopPropagation()}
                        >
                            <ArrowUpRight className="h-3 w-3" />
                        </a>
                    )}
                </div>
            </td>
        </tr>
    );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TokenProtocolTransactions({ tokenId, isCashToken, isMainnet }: TokenProtocolTransactionsProps) {
    const { data: txs, isLoading } = useProtocolTransactions(tokenId, isCashToken, isMainnet);

    const completed = (txs ?? []).filter(tx => tx.status === 'COMPLETED').slice(0, 25);

    // Derive display symbol for the featured token
    const symbol = isCashToken
        ? `CT:${tokenId.slice(0, 6)}…`
        : tokenId.toUpperCase();

    return (
        <div className="w-full">
            <div className="mb-4">
                <h2 className="text-xl font-semibold text-foreground">Transactions</h2>
                <p className="text-sm text-muted-foreground mt-1">
                    {isLoading
                        ? 'Loading…'
                        : `${completed.length} completed swap${completed.length !== 1 ? 's' : ''} via protocol`}
                </p>
            </div>

            {isLoading ? (
                <div className="rounded-2xl border border-white/[0.08] bg-black/40 backdrop-blur-md flex items-center justify-center h-24">
                    <Loader2 className="h-5 w-5 animate-spin text-white/20" />
                </div>
            ) : completed.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground bg-white/[0.02] rounded-2xl border border-white/[0.05]">
                    No completed protocol swaps found for this token yet.
                </div>
            ) : (
                <div className="rounded-2xl border border-white/[0.08] bg-black/40 backdrop-blur-md overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                    <div className="overflow-x-auto relative">
                        <table className="w-full text-sm text-left">
                            <thead className="text-muted-foreground bg-white/[0.02] border-b border-white/[0.06]">
                                <tr>
                                    <th className="px-6 py-4 font-medium">Time</th>
                                    <th className="px-6 py-4 font-medium">Type</th>
                                    <th className="px-6 py-4 font-medium text-right">${symbol}</th>
                                    <th className="px-6 py-4 font-medium text-right">For</th>
                                    <th className="px-6 py-4 font-medium text-right hidden lg:table-cell">USD</th>
                                    <th className="px-6 py-4 font-medium text-right hidden md:table-cell">Wallet</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.04]">
                                {completed.map(tx => (
                                    <TxRow
                                        key={`${tx.source}-${tx.id}`}
                                        tx={tx}
                                        tokenId={tokenId}
                                        isCashToken={isCashToken}
                                        symbol={isCashToken ? `CT:${tokenId.slice(0, 6)}…` : tokenId.toUpperCase()}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
