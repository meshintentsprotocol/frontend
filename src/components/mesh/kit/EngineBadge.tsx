/**
 * Which engine holds a position: V4 bins (owned by an NFT) or V3 pools (owned
 * by the wallet key). Users pick a strategy, not an engine; the badge and one
 * line about ownership are all the engine needs on screen.
 */
import { Gem } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Engine = 'v4' | 'v3';

export function EngineBadge({ engine, className }: { engine: Engine; className?: string }) {
  return (
    <span className={cn(
      'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
      engine === 'v4' ? 'border-violet-500/30 bg-violet-500/10 text-violet-300' : 'border-neutral-700 bg-neutral-800/60 text-neutral-400',
      className,
    )}>
      {engine === 'v4' ? <><Gem className="h-3 w-3" aria-hidden />V4 bins</> : 'V3 pools'}
    </span>
  );
}

export const ownershipLine = (engine: Engine) => (engine === 'v4' ? 'Owned by an NFT in your wallet' : "Owned by this wallet's key");

/** Badge plus the ownership line. */
export function EngineLine({ engine, className }: { engine: Engine; className?: string }) {
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-2 text-xs text-zinc-300', className)}>
      <EngineBadge engine={engine} />
      <span>{ownershipLine(engine)}</span>
    </span>
  );
}
