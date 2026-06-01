import { useNavigate } from 'react-router-dom';
import { PortfolioToken } from '@/hooks/usePortfolio';
import { formatCurrency, formatCompactNumber } from '@/lib/coingecko';
import { cn } from '@/lib/utils';
import { TokenChainIcon } from '@/components/common/TokenChainIcon';

function tokenSlug(token: PortfolioToken): string {
    if (token.category) return `ct-${token.category}`;
    // Strip parenthetical network labels like " (SOL)" or " (Sepolia)"
    const base = token.symbol.replace(/\s*\(.*\)$/, '').toUpperCase();
    return base;
}

interface PortfolioTokensProps {
    tokens: PortfolioToken[];
}

export function PortfolioTokens({ tokens }: PortfolioTokensProps) {
    const navigate = useNavigate();
    if (tokens.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground bg-white/[0.02] rounded-2xl border border-white/[0.05]">
                No tokens found in your portfolio. Connect a wallet to view balances.
            </div>
        );
    }

    return (
        <div className="w-full">
            <div className="mb-4">
                <h2 className="text-xl font-semibold text-foreground">Tokens</h2>
                <p className="text-sm text-muted-foreground mt-1">{tokens.length} assets</p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-black/40 backdrop-blur-md overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                <div className="overflow-x-auto relative">
                    <table className="w-full text-sm text-left">
                        <thead className="text-muted-foreground bg-white/[0.02] border-b border-white/[0.06]">
                            <tr>
                                <th className="px-6 py-4 font-medium">Token</th>
                                <th className="px-6 py-4 font-medium text-right">Price</th>
                                <th className="px-6 py-4 font-medium text-right">Balance</th>
                                <th className="px-6 py-4 font-medium text-right">Value</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                            {tokens.map((token) => (
                                <tr
                                    key={token.category ?? token.symbol}
                                    className="hover:bg-white/[0.02] transition-colors group cursor-pointer"
                                    onClick={() => navigate(`/explore/tokens/${tokenSlug(token)}`)}
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <TokenChainIcon tokenIcon={token.icon} tokenName={token.name} chain={token.chain} size="lg" />
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-foreground">{token.name}</span>
                                                <span className="text-xs text-muted-foreground">{token.symbol}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="font-medium text-foreground">{formatCurrency(token.price)}</span>
                                            <span className={cn(
                                                "text-xs mt-0.5",
                                                token.change24h >= 0 ? "text-emerald-500" : "text-rose-500"
                                            )}>
                                                {token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(2)}%
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="font-medium text-foreground">{formatCompactNumber(token.balance)}</span>
                                            <span className="text-xs text-muted-foreground mt-0.5">{token.symbol}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <span className="font-medium text-foreground">{formatCurrency(token.valueUsd)}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* View all button mock */}
            <div className="mt-4 flex justify-center sm:justify-start">
                <button className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors">
                    View all tokens <span>→</span>
                </button>
            </div>
        </div>
    );
}
