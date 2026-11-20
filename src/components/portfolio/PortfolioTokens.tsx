import { getChainMeta } from '@/lib/chains';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PortfolioToken } from '@/hooks/usePortfolio';
import { formatCurrency } from '@/lib/marketData';
import { cn } from '@/lib/utils';
import { TokenChainIcon } from '@/components/common/TokenChainIcon';

function tokenSlug(token: PortfolioToken): string {
    if (token.category) return `ct-${token.category}`;
    // Strip parenthetical network labels like " (SOL)" or " (Sepolia)"
    const base = token.symbol.replace(/\s*\(.*\)$/, '').toUpperCase();
    return base;
}

// Short label + logo for each chain the portfolio reports.
const CHAIN_CHIP: Record<string, { label: string; icon?: string }> = {
    'Bitcoin Cash': { label: 'BCH', icon: '/logos/bitcoin-cash-bch-logo.svg' },
    'Bitcoin': { label: 'BTC', icon: '/logos/bitcoin-btc-logo.svg' },
    'Ethereum': { label: 'ETH', icon: '/logos/ethereum-eth-logo.svg' },
    'BSC': { label: 'BNB', icon: '/logos/bnb-bnb-logo.svg' },
    'Solana': { label: 'Solana', icon: '/assets/solanaLogo.png' },
    'Movement': { label: 'Movement', icon: '/logos/movement.svg' },
};

const ALL = 'all';

function formatTokenBalance(balance: number): string {
    if (!Number.isFinite(balance)) return '\u2014';
    const magnitude = Math.abs(balance);
    return new Intl.NumberFormat(undefined, {
        notation: magnitude > 0 && magnitude < 0.000001 ? 'scientific' : magnitude >= 1_000_000 ? 'compact' : 'standard',
        maximumSignificantDigits: 6,
    }).format(balance);
}

interface PortfolioTokensProps {
    tokens: PortfolioToken[];
}

export function PortfolioTokens({ tokens }: PortfolioTokensProps) {
    const navigate = useNavigate();
    const [chain, setChain] = useState<string>(ALL);

    const chains = useMemo(() => [...new Set(tokens.map(t => t.chain))], [tokens]);
    const activeChain = chain === ALL || chains.includes(chain) ? chain : ALL;
    const shown = activeChain === ALL ? tokens : tokens.filter(t => t.chain === activeChain);

    if (tokens.length === 0) {
        return (
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] py-12 text-center text-muted-foreground">
                No tokens found in your portfolio. Connect a wallet to view balances.
            </div>
        );
    }

    const chip = (selected: boolean) => cn(
        'flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold transition-colors',
        selected ? 'border-primary/40 bg-primary/15 text-primary' : 'border-white/[0.07] bg-white/[0.02] text-white/55 hover:bg-white/[0.06] hover:text-white',
    );

    return (
        <div className="w-full min-w-0">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="text-xl font-semibold text-foreground">Tokens</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{shown.length} of {tokens.length} assets</p>
                </div>
                {/* Network filter */}
                {chains.length > 1 && (
                    <div className="flex flex-wrap gap-1.5">
                        <button type="button" onClick={() => setChain(ALL)} className={chip(activeChain === ALL)}>All</button>
                        {chains.map(c => {
                            const meta = CHAIN_CHIP[c] ?? { label: c, icon: getChainMeta(c)?.logo };
                            return (
                                <button key={c} type="button" onClick={() => setChain(c)} className={chip(activeChain === c)}>
                                    {meta?.icon && <img src={meta.icon} alt="" className="h-3.5 w-3.5 object-contain" />}
                                    {meta?.label ?? c}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Desktop / tablet: table */}
            <div className="hidden overflow-hidden rounded-2xl border border-white/[0.08] bg-black/40 backdrop-blur-md sm:block">
                <table className="w-full table-fixed text-left text-sm">
                    <colgroup><col className="w-[40%]" /><col className="w-[20%]" /><col className="w-[22%]" /><col className="w-[18%]" /></colgroup>
                    <thead className="border-b border-white/[0.06] bg-white/[0.02] text-muted-foreground">
                        <tr>
                            <th className="px-3 py-4 font-medium">Token</th>
                            <th className="px-3 py-4 text-right font-medium">Price</th>
                            <th className="px-3 py-4 text-right font-medium">Balance</th>
                            <th className="px-3 py-4 text-right font-medium">Value</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                        {shown.map(token => (
                            <tr key={token.category ?? `${token.chain}:${token.symbol}`}
                                className="group cursor-pointer transition-colors hover:bg-white/[0.02]"
                                onClick={() => navigate(`/explore/tokens/${tokenSlug(token)}`)}>
                                <td className="min-w-0 px-3 py-4">
                                    <div className="flex min-w-0 items-center gap-2.5">
                                        <TokenChainIcon tokenIcon={token.icon} tokenName={token.name} chain={token.chain} size="lg" />
                                        <div className="flex min-w-0 flex-1 flex-col">
                                            <span className="truncate font-semibold text-foreground" title={token.name}>{token.name}</span>
                                            <span className="truncate text-xs text-muted-foreground" title={token.symbol}>{token.symbol}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-right">
                                    <div className="flex flex-col items-end">
                                        <span className="font-medium text-foreground">{formatCurrency(token.price)}</span>
                                        <span className={cn('mt-0.5 text-xs', token.change24h >= 0 ? 'text-emerald-500' : 'text-rose-500')}>
                                            {token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(2)}%
                                        </span>
                                    </div>
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-right">
                                    <div className="flex flex-col items-end">
                                        <span className="font-medium text-foreground">{formatTokenBalance(token.balance)}</span>
                                        <span className="mt-0.5 max-w-full truncate text-xs text-muted-foreground">{token.symbol}</span>
                                    </div>
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-right">
                                    <span className="font-medium text-foreground">{formatCurrency(token.valueUsd)}</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile: cards, so nothing spills off the side */}
            <div className="space-y-2 sm:hidden">
                {shown.map(token => (
                    <button key={token.category ?? `${token.chain}:${token.symbol}`}
                        onClick={() => navigate(`/explore/tokens/${tokenSlug(token)}`)}
                        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-black/40 p-3.5 text-left transition-colors hover:bg-white/[0.03]">
                        <div className="flex min-w-0 items-center gap-3">
                            <TokenChainIcon tokenIcon={token.icon} tokenName={token.name} chain={token.chain} size="md" />
                            <div className="min-w-0">
                                <div className="truncate font-semibold text-foreground">{token.name}</div>
                                <div className="text-xs text-muted-foreground">
                                    {formatCurrency(token.price)}
                                    <span className={cn('ml-1.5', token.change24h >= 0 ? 'text-emerald-500' : 'text-rose-500')}>
                                        {token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(2)}%
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="min-w-0 max-w-[45%] shrink-0 text-right">
                            <div className="font-medium text-foreground">{formatCurrency(token.valueUsd)}</div>
                            <div className="truncate text-xs text-muted-foreground">{formatTokenBalance(token.balance)} {token.symbol}</div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
