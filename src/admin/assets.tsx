/**
 * Token metadata for the admin console. Components register the categories
 * they show; one BCMR query resolves them all for the server's network.
 * Amounts are rendered from base units with the token's decimals.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useTokenMetadataMany } from '@/hooks/useTokenMetadata';
import { PUSD_CHIPNET, PUSD_MAINNET, pusdToken } from '@/lib/pusd';
import { formatUnits } from '@/lib/mesh/format';
import { TokenAvatar, type TokenInfo } from '@/components/mesh/pools/shared';
import { cn } from '@/lib/utils';

export const isBch = (a: string | undefined | null) => !a || a === '0x' || a === 'BCH';

interface AssetState { get: (category: string) => TokenInfo; register: (categories: string[]) => void }
const Ctx = createContext<AssetState | null>(null);

export function AssetProvider({ network, children }: { network: 'chipnet' | 'mainnet'; children: ReactNode }) {
  const [cats, setCats] = useState<string[]>([]);
  const register = useCallback((xs: string[]) => {
    const add = xs.map(x => x.toLowerCase()).filter(x => !isBch(x) && /^[0-9a-f]{64}$/.test(x));
    setCats(prev => (add.every(x => prev.includes(x)) ? prev : [...new Set([...prev, ...add])].sort()));
  }, []);
  const { data } = useTokenMetadataMany(cats, network === 'mainnet');
  const get = useCallback((category: string): TokenInfo => {
    const c = category.toLowerCase();
    const m = data?.[c];
    if (m) return { category: c, symbol: m.symbol || c.slice(0, 6).toUpperCase(), name: m.name || m.symbol, decimals: m.decimals ?? 0, icon: m.icon, known: true };
    if (c === PUSD_MAINNET || c === PUSD_CHIPNET) {
      const t = pusdToken(c === PUSD_MAINNET);
      return { category: c, symbol: t.symbol, name: t.name, decimals: t.decimals, icon: t.icon, known: true };
    }
    return { category: c, symbol: c.slice(0, 6).toUpperCase(), name: c, decimals: 0, icon: null, known: false };
  }, [data]);
  return <Ctx.Provider value={{ get, register }}>{children}</Ctx.Provider>;
}

/** Token info for the given categories ('0x' / 'BCH' entries are ignored). */
export function useAssets(categories: Array<string | undefined | null> = []) {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAssets outside AssetProvider');
  const key = categories.filter(Boolean).join(',');
  useEffect(() => { if (key) ctx.register(key.split(',')); }, [key, ctx]);
  return ctx;
}

export function symbolOf(get: AssetState['get'], asset: string): string {
  return isBch(asset) ? 'BCH' : get(asset).symbol;
}

/** "0.0123 BCH" or "12.5 pUSD" from base units. */
export function formatAsset(get: AssetState['get'], asset: string, value: string | bigint, maxFrac?: number): string {
  if (isBch(asset)) return `${formatUnits(value, 8, maxFrac ?? 8)} BCH`;
  const t = get(asset);
  return `${formatUnits(value, t.decimals, maxFrac ?? t.decimals)} ${t.symbol}`;
}

export function Amount({ asset, value, className, icon, muted }: { asset: string; value: string | bigint | null | undefined; className?: string; icon?: boolean; muted?: boolean }) {
  const { get } = useAssets([asset]);
  if (value === null || value === undefined || value === '') return <span className="text-zinc-600">—</span>;
  const bch = isBch(asset);
  const t = bch ? null : get(asset);
  const num = bch ? formatUnits(value, 8) : formatUnits(value, t!.decimals);
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-mono tabular-nums whitespace-nowrap', muted ? 'text-zinc-400' : 'text-zinc-100', className)}>
      {icon && <TokenAvatar info={bch ? 'BCH' : t!} size={14} />}
      {num}
      <span className="text-zinc-500 font-sans text-[11px]">{bch ? 'BCH' : t!.symbol}</span>
    </span>
  );
}

/** Several assets ({ asset: amount }) on one line each. */
export function AssetMapList({ map, empty = '—', className }: { map: Record<string, string> | null | undefined; empty?: string; className?: string }) {
  const entries = Object.entries(map ?? {}).filter(([, v]) => v && v !== '0');
  if (!entries.length) return <span className="text-zinc-600 text-xs">{empty}</span>;
  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      {entries.map(([a, v]) => <Amount key={a} asset={a} value={v} />)}
    </div>
  );
}

export function AssetPair({ sell, buy, size = 18 }: { sell: string; buy: string; size?: number }) {
  const { get } = useAssets([sell, buy]);
  const info = (a: string) => (isBch(a) ? 'BCH' as const : get(a));
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="flex -space-x-1.5">
        <TokenAvatar info={info(sell)} size={size} />
        <TokenAvatar info={info(buy)} size={size} />
      </span>
      <span className="text-xs font-semibold text-zinc-200">{symbolOf(get, sell)}</span>
      <span className="text-zinc-600 text-xs" aria-hidden>→</span>
      <span className="text-xs font-semibold text-zinc-200">{symbolOf(get, buy)}</span>
    </span>
  );
}
