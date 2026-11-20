import { cn } from '@/lib/utils';
import type { TokenDetail } from '@/hooks/useTokenDetail';

interface TokenStatsProps {
    detail: TokenDetail;
}

function formatUsd(v: number | null): string {
    if (v == null) return '—';
    if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
    if (v >= 1e3) return `$${(v / 1e3).toFixed(2)}K`;
    if (v >= 1) return `$${v.toFixed(2)}`;
    if (v >= 0.01) return `$${v.toFixed(4)}`;
    return `$${v.toFixed(8)}`;
}

function formatSupply(v: number | null): string {
    if (v == null) return '—';
    if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
    if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(2)}K`;
    return v.toLocaleString();
}

interface StatItemProps {
    label: string;
    value: string;
    accent?: boolean | null;
    sub?: string;
}

function StatItem({ label, value, accent, sub }: StatItemProps) {
    return (
        <div className="flex min-w-0 flex-col gap-0.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
            <span className="text-[10px] font-medium text-white/35 uppercase tracking-wider">{label}</span>
            <span className={cn(
                'break-words font-semibold text-sm [overflow-wrap:anywhere]',
                accent === true && 'text-emerald-400',
                accent === false && 'text-red-400',
                accent == null && 'text-white',
            )}>
                {value}
            </span>
            {sub && <span className="text-[10px] text-white/25">{sub}</span>}
        </div>
    );
}

export function TokenStats({ detail }: TokenStatsProps) {
    return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <StatItem label="Market Cap" value={formatUsd(detail.marketCap)} />
            <StatItem
                label={detail.isCashToken ? 'TVL (Pool)' : (detail.fdv ? 'FDV' : 'TVL')}
                value={formatUsd(detail.isCashToken ? detail.tvlUsd : (detail.fdv ?? detail.tvlUsd))}
            />
            <StatItem label="Volume 24h" value={formatUsd(detail.volume24h)} />
            <StatItem label="ATH" value={formatUsd(detail.ath)} />
            <StatItem label="ATL" value={formatUsd(detail.atl)} />
            <StatItem
                label={detail.isCashToken ? 'Pool Tokens' : 'Circulating Supply'}
                value={formatSupply(detail.isCashToken ? detail.totalSupply : detail.circulatingSupply)}
                sub={!detail.isCashToken && detail.totalSupply != null
                    ? `of ${formatSupply(detail.totalSupply)}`
                    : undefined}
            />
        </div>
    );
}
