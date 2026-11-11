/**
 * Position Manage Panel (MeshDocs/meshv3v4flow/09 §3.3, canvas D1).
 * Unified action panel with capability checks across V4 discrete bins,
 * V3 strategies, and standalone pools.
 */
import { ArrowLeftRight, Download, Gem, Layers, MinusCircle, PlusCircle, Recycle, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ManageCapabilities {
  canAddLiquidity?: boolean;
  canRemoveLiquidity?: boolean;
  canRebalance?: boolean;
  canRecycleIdle?: boolean;
  canMoveToV4?: boolean;
  canSendNft?: boolean;
  canClose?: boolean;
}

export interface ManageActions {
  onAddLiquidity?: () => void;
  onRemoveLiquidity?: () => void;
  onRebalance?: () => void;
  onRecycleIdle?: () => void;
  onMoveToV4?: () => void;
  onSendNft?: () => void;
  onClose?: () => void;
}

export function ManagePanel({
  engine,
  isOwner,
  capabilities = {},
  actions = {},
  className,
}: {
  engine: 'v4' | 'v3';
  isOwner: boolean;
  capabilities?: ManageCapabilities;
  actions?: ManageActions;
  className?: string;
}) {
  if (!isOwner) {
    return (
      <div className={cn('rounded-3xl border border-white/[0.08] bg-[#0c0c10] p-5 space-y-3', className)}>
        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Manage</div>
        <p className="text-xs text-zinc-400">
          {engine === 'v4'
            ? 'Only the wallet holding this position NFT can manage bins or withdraw.'
            : 'Only the covenant owner can manage or withdraw from this position.'}
        </p>
      </div>
    );
  }

  return (
    <div className={cn('rounded-3xl border border-white/[0.08] bg-[#0c0c10] p-5 space-y-4', className)}>
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Actions</div>
        <span className="text-[11px] font-mono text-emerald-400">Owner access</span>
      </div>

      <div className="space-y-2">
        {/* Add Liquidity */}
        {capabilities.canAddLiquidity && (
          <button
            type="button"
            onClick={actions.onAddLiquidity}
            className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-left hover:border-white/20 hover:bg-white/[0.04] transition"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <PlusCircle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-white">Add liquidity</div>
              <div className="text-[11px] text-zinc-400">Deposit more assets into position</div>
            </div>
          </button>
        )}

        {/* Remove Liquidity / Withdraw */}
        {capabilities.canRemoveLiquidity && (
          <button
            type="button"
            onClick={actions.onRemoveLiquidity}
            className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-left hover:border-white/20 hover:bg-white/[0.04] transition"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">
              <Download className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-white">Withdraw liquidity</div>
              <div className="text-[11px] text-zinc-400">
                {engine === 'v4' ? 'Withdraw from selected bins' : 'Partial or full withdrawal'}
              </div>
            </div>
          </button>
        )}

        {/* Rebalance */}
        {capabilities.canRebalance && (
          <button
            type="button"
            onClick={actions.onRebalance}
            className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-left hover:border-white/20 hover:bg-white/[0.04] transition"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
              <ArrowLeftRight className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-white">Rebalance position</div>
              <div className="text-[11px] text-zinc-400">Re-centre range around current market</div>
            </div>
          </button>
        )}

        {/* Recycle Idle Funds */}
        {capabilities.canRecycleIdle && (
          <button
            type="button"
            onClick={actions.onRecycleIdle}
            className="flex w-full items-center gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-3 text-left hover:border-amber-500/40 transition"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
              <Recycle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-amber-200">Recycle idle funds</div>
              <div className="text-[11px] text-amber-100/70">Reopen orders with filled proceeds</div>
            </div>
          </button>
        )}

        {/* Move to V4 */}
        {capabilities.canMoveToV4 && (
          <button
            type="button"
            onClick={actions.onMoveToV4}
            className="flex w-full items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3 text-left hover:border-emerald-500/40 transition"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <Gem className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-emerald-200">Migrate to V4</div>
              <div className="text-[11px] text-emerald-100/70">Move covenants into NFT-owned bins</div>
            </div>
          </button>
        )}

        {/* Send Position NFT (V4 only) */}
        {capabilities.canSendNft && (
          <button
            type="button"
            onClick={actions.onSendNft}
            className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-left hover:border-white/20 hover:bg-white/[0.04] transition"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
              <Send className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-white">Transfer position NFT</div>
              <div className="text-[11px] text-zinc-400">Send custody of all bins to another wallet</div>
            </div>
          </button>
        )}

        {/* Close Position */}
        {capabilities.canClose && (
          <button
            type="button"
            onClick={actions.onClose}
            className="flex w-full items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] p-3 text-left hover:border-rose-500/40 transition"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">
              <Trash2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-rose-300">Close position</div>
              <div className="text-[11px] text-rose-200/70">Withdraw all assets and close</div>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}

