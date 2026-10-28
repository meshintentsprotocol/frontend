/**
 * The pair row of a create flow: a fixed BCH chip and a token button that
 * opens the token list (with balances). Pegged pairs use two token buttons.
 */
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TokenAvatar, type TokenInfo } from '@/components/mesh/pools/shared';
import { CHIPNET_DEFAULT_TOKENS, NATIVE_BCH_TOKEN, TokenSelectModal, type MeshToken } from '@/components/mesh/TokenSelectModal';
import { shortHex } from '@/lib/mesh/format';

export function TokenButton({ value, info, onPick, label, className, size = 'md' }: {
  value: string;
  info: TokenInfo | null;
  onPick: (category: string) => void;
  /** what the list is for ("Choose the token") */
  label: string;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={info ? `${label}: ${info.symbol}` : label}
        className={cn(
          'inline-flex min-w-0 items-center gap-2 rounded-full border border-white/10 bg-zinc-900 pl-1.5 pr-3 font-semibold text-white outline-none transition hover:border-white/25 focus-visible:ring-2 focus-visible:ring-emerald-400',
          size === 'sm' ? 'h-10 text-sm' : 'h-12 text-[15px]',
          className,
        )}
      >
        {info && value ? <TokenAvatar info={info} size={size === 'sm' ? 26 : 32} /> : <span className="h-8 w-8 rounded-full border border-dashed border-white/20" aria-hidden />}
        <span className="truncate">{info && value ? info.symbol : 'Choose a token'}</span>
        {info && value && !info.known && <span className="hidden font-mono text-[10px] font-normal text-zinc-500 sm:inline">{shortHex(value, 6, 4)}</span>}
        <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
      </button>
      <TokenSelectModal
        open={open}
        onOpenChange={setOpen}
        title={label}
        selectedToken={CHIPNET_DEFAULT_TOKENS.find(t => t.categoryId === value)}
        otherSelectedToken={NATIVE_BCH_TOKEN}
        onSelect={(t: MeshToken) => {
          if (!t.isNativeBch && t.categoryId) onPick(t.categoryId.toLowerCase());
          setOpen(false);
        }}
      />
    </>
  );
}

/** "BCH / [token ▾]" */
export function PairPicker({ token, info, onPick, className }: {
  token: string;
  info: TokenInfo | null;
  onPick: (category: string) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className="inline-flex h-12 items-center gap-2 rounded-full border border-white/10 bg-zinc-900/60 pl-1.5 pr-4 text-[15px] font-semibold text-white">
        <TokenAvatar info="BCH" size={32} />BCH
      </span>
      <span className="text-zinc-500" aria-hidden>/</span>
      <TokenButton value={token} info={info} onPick={onPick} label="Choose the token to pair with BCH" />
    </div>
  );
}
