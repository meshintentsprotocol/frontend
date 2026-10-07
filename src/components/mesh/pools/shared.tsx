/**
 * Shared building blocks for the Mesh pool pages (V2 fixed-price pools).
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useWDK } from '@/context/WDKProvider';
import { useTokenMetadataMany } from '@/hooks/useTokenMetadata';
import { resolveTokenIconUri } from '@/lib/tokenIcons';
import { cn } from '@/lib/utils';
import type { Pool, PoolStatus } from '@/lib/mesh/meshApi';
import type { PoolSide } from '@/lib/mesh/pool';
import { formatUnits, formatSatsCompact, formatUsd, satsToUsd, shortHex } from '@/lib/mesh/format';
import { PUSD_CHIPNET, PUSD_MAINNET, pusdToken } from '@/lib/pusd';

export const BCH_ICON = '/logos/bitcoin-cash-bch-logo.svg';

/**
 * Says so when a pool is priced on the wrong side of the market: it pays more
 * for a token than the market does, or sells its token for less. Anyone can
 * take the difference, so the reserve drains at that price. Renders nothing
 * when no active pool is flagged.
 */
export function ThroughMarketNote({ pools, owner = false, className }: { pools: Pool[]; owner?: boolean; className?: string }) {
  const hit = pools.filter(p => p.status === 'active' && p.throughMarket?.length);
  if (!hit.length) return null;
  const worst = hit.flatMap(p => p.throughMarket!).reduce((a, b) => (b.bps > a.bps ? b : a));
  const pct = `${(worst.bps / 100).toFixed(worst.bps < 1000 ? 1 : 0)}%`;
  const what = worst.side === 'buys-above-market' ? 'pays more for a token than the market does' : 'sells its token for less than the market pays';
  return (
    <div role="alert" className={cn('flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-500/[0.06] px-4 py-3', className)}>
      <AlertTriangle className="w-4 h-4 text-amber-300 mt-0.5 shrink-0" aria-hidden />
      <div className="text-xs leading-relaxed">
        <p className="font-semibold text-amber-200">{pools.length > 1 ? `${hit.length} of ${pools.length} pools are priced through the market` : 'This pool is priced through the market'}</p>
        <p className="mt-0.5 text-amber-100/70">
          {hit.length > 1 ? 'The furthest' : 'It'} {what}: {pct} past the Cauldron price, after its fee. Anyone can take that difference until the reserve is gone.
          {owner && ' Reprice or withdraw it.'}
        </p>
      </div>
    </div>
  );
}

export interface TokenInfo { category: string; symbol: string; name: string; decimals: number; icon: string | null; known: boolean }

/** Symbol / decimals / icon for token categories (BCMR), with safe fallbacks. */
export function useTokenInfo(categories: Array<string | undefined>) {
  const { bchNetwork } = useWDK();
  const cats = useMemo(() => [...new Set(categories.filter((c): c is string => !!c && c !== '0x'))], [categories.join(',')]);
  const { data, isLoading } = useTokenMetadataMany(cats, bchNetwork === 'mainnet');
  const get = (category: string | undefined): TokenInfo => {
    const c = (category ?? '').toLowerCase();
    const m = data?.[c];
    if (m) return { category: c, symbol: m.symbol || c.slice(0, 6).toUpperCase(), name: m.name || m.symbol, decimals: m.decimals ?? 0, icon: m.icon, known: true };
    // pUSD is the default pair everywhere: keep its name and decimals even when BCMR has no entry
    if (c === PUSD_MAINNET || c === PUSD_CHIPNET) {
      const t = pusdToken(c === PUSD_MAINNET);
      return { category: c, symbol: t.symbol, name: t.name, decimals: t.decimals, icon: t.icon, known: true };
    }
    return { category: c, symbol: c.slice(0, 6).toUpperCase(), name: c, decimals: 0, icon: null, known: false };
  };
  return { get, loading: isLoading };
}

export function TokenAvatar({ info, size = 24, className }: { info?: TokenInfo | 'BCH'; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const isBch = info === 'BCH';
  const src = isBch ? BCH_ICON : info?.icon ? resolveTokenIconUri(info.icon, info.category) : null;
  const label = isBch ? 'BCH' : info?.symbol ?? '?';
  return src && !failed ? (
    <img src={src} alt={label} width={size} height={size} onError={() => setFailed(true)}
      className={cn('rounded-full bg-zinc-900 object-cover shrink-0 border border-white/10', className)} style={{ width: size, height: size }} />
  ) : (
    <div className={cn('rounded-full bg-zinc-800 border border-white/10 text-[10px] font-bold text-zinc-300 flex items-center justify-center shrink-0', className)}
      style={{ width: size, height: size }}>{label.slice(0, 3)}</div>
  );
}

/** "BCH / pUSD" with icons; the side badge says which asset the pool sells. */
export function PoolPairLabel({ token, side, size = 26, showSide = true }: { token: TokenInfo; side?: PoolSide; size?: number; showSide?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="flex -space-x-2 shrink-0">
        <TokenAvatar info="BCH" size={size} />
        <TokenAvatar info={token} size={size} />
      </div>
      <div className="min-w-0">
        <div className="font-bold text-white text-sm truncate">BCH / {token.symbol}</div>
        {showSide && side && <PoolSideBadge side={side} token={token} />}
      </div>
    </div>
  );
}

export function PoolSideBadge({ side, token, className }: { side: PoolSide; token: TokenInfo; className?: string }) {
  return (
    <span className={cn('inline-flex items-center text-[10px] font-semibold uppercase tracking-wide', side === 'SELL_BCH' ? 'text-emerald-400' : 'text-cyan-400', className)}>
      {side === 'SELL_BCH' ? `Sells BCH · buys ${token.symbol}` : `Sells ${token.symbol} · buys BCH`}
    </span>
  );
}

const STATUS_STYLE: Record<PoolStatus, string> = {
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  exhausted: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
  closed: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
};
const STATUS_LABEL: Record<PoolStatus, string> = { active: 'Active', exhausted: 'Needs withdraw', closed: 'Closed' };

export function PoolStatusBadge({ status, className }: { status: PoolStatus; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border', STATUS_STYLE[status], className)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', status === 'active' ? 'bg-emerald-400' : status === 'exhausted' ? 'bg-amber-400' : 'bg-zinc-500')} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function StatTile({ label, value, sub, accent, className }: { label: string; value: React.ReactNode; sub?: React.ReactNode; accent?: string; className?: string }) {
  return (
    <div className={cn('p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-1 min-w-0', className)}>
      <div className="text-[11px] font-medium text-zinc-500">{label}</div>
      <div className={cn('text-lg font-bold font-mono truncate', accent ?? 'text-white')}>{value}</div>
      {sub !== undefined && <div className="text-[11px] text-zinc-500 truncate">{sub}</div>}
    </div>
  );
}

export function Panel({ title, action, children, className }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('p-5 sm:p-6 bg-[#0c0c10] border border-white/[0.08] rounded-3xl shadow-2xl space-y-4', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3">
          {title && <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

/** Tab switcher for a Panel title: one panel, several views. */
export function PanelTabs<K extends string>({ tabs, value, onChange }: { tabs: ReadonlyArray<readonly [K, string]>; value: K; onChange: (k: K) => void }) {
  return (
    <span className="flex items-center gap-1 p-1 -m-1 rounded-xl bg-black/40 border border-white/[0.06]">
      {tabs.map(([k, label]) => (
        <button key={k} type="button" onClick={() => onChange(k)}
          className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold', value === k ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300')}>{label}</button>
      ))}
    </span>
  );
}

export function EmptyState({ icon, title, children }: { icon?: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="py-12 text-center space-y-3">
      {icon && <div className="mx-auto w-fit text-zinc-600">{icon}</div>}
      <div className="text-sm font-semibold text-zinc-300">{title}</div>
      {children && <div className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">{children}</div>}
    </div>
  );
}

/** Sats with USD underneath when a BCH/USD rate is known. */
export function SatsValue({ sats, bchUsd, className }: { sats: string | bigint; bchUsd?: number | null; className?: string }) {
  const usd = satsToUsd(sats, bchUsd);
  return (
    <div className={cn('font-mono', className)}>
      <div>{formatSatsCompact(sats)}</div>
      {usd !== null && <div className="text-[11px] text-zinc-500">{formatUsd(usd)}</div>}
    </div>
  );
}

export function tokenAmount(units: string | bigint, info: TokenInfo, maxFrac?: number): string {
  return `${formatUnits(units, info.decimals, maxFrac)} ${info.symbol}`;
}

export function AddressLink({ address, to, className }: { address: string; to?: string; className?: string }) {
  const text = shortHex(address, 8, 6);
  return to
    ? <Link to={to} className={cn('font-mono text-xs text-zinc-300 hover:text-white underline-offset-2 hover:underline', className)}>{text}</Link>
    : <span className={cn('font-mono text-xs text-zinc-300', className)}>{text}</span>;
}

export const poolUrl = (p: Pick<Pool, 'address'> | string) => `/mesh/pool/${encodeURIComponent(typeof p === 'string' ? p : p.address)}`;
export const lpUrl = (pkhOrAddress: string) => `/mesh/provider/${encodeURIComponent(pkhOrAddress)}`;
