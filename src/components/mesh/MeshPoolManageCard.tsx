import React, { useState } from 'react';
import {
  ArrowDownToLine,
  PlusCircle,
  Sliders,
} from 'lucide-react';
import { type MeshPosition } from '@/hooks/useMeshServer';
import { cn } from '@/lib/utils';

// Isolated tab components
import { ManageTopUpTab } from '@/components/mesh/manage/ManageTopUpTab';
import { ManageWithdrawTab } from '@/components/mesh/manage/ManageWithdrawTab';
import { ManageRebalanceTab } from '@/components/mesh/manage/ManageRebalanceTab';

interface MeshPoolManageCardProps {
  position: MeshPosition;
  isConnected: boolean;
  isDrained: boolean;
  effectiveReserveSats: bigint;
  effectiveTokenAmount: bigint;
  liveBchPrice: number;
  isDocking: boolean;
  isToppingUp: boolean;
  isRebalancing?: boolean;
  initialTab?: 'topup' | 'dock' | 'rebalance';
  onDock: (percent: number) => Promise<void>;
  onTopUp: (amountBch: string) => Promise<void>;
  onRebalance?: (params: {
    rangeLow?: number;
    rangeHigh?: number;
    spreadBps?: number;
    feeBps?: number;
  }) => Promise<void>;
}

export function MeshPoolManageCard({
  position,
  isConnected,
  isDrained,
  effectiveReserveSats,
  effectiveTokenAmount,
  liveBchPrice,
  isDocking,
  isToppingUp,
  isRebalancing = false,
  initialTab = 'topup',
  onDock,
  onTopUp,
  onRebalance,
}: MeshPoolManageCardProps) {
  const [activeTab, setActiveTab] = useState<'topup' | 'dock' | 'rebalance'>(initialTab);

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  return (
    <div className="p-4 sm:p-6 bg-[#0c0c10] border border-white/[0.08] rounded-3xl space-y-5 shadow-2xl backdrop-blur-xl">
      {/* ─── Top Tabs Switcher (Topup | Withdraw | Rebalance) ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
        <div className="flex items-center gap-1 p-1 bg-white/[0.03] border border-white/5 rounded-2xl w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('topup')}
            className={cn(
              'flex-1 sm:flex-initial px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5',
              activeTab === 'topup'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-md'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Top-up</span>
          </button>

          <button
            onClick={() => setActiveTab('dock')}
            className={cn(
              'flex-1 sm:flex-initial px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5',
              activeTab === 'dock'
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-md'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            <span>Withdraw</span>
          </button>

          <button
            onClick={() => setActiveTab('rebalance')}
            className={cn(
              'flex-1 sm:flex-initial px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5',
              activeTab === 'rebalance'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-md'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Rebalance</span>
          </button>
        </div>

        <span className="hidden sm:inline text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 border border-white/5 whitespace-nowrap">
          {activeTab === 'topup' ? 'Add Reserve' : activeTab === 'dock' ? 'Unilateral Exit' : '< $0.01 Rebalance'}
        </span>
      </div>

      {/* ─── Tab Content (Each is a self-contained isolated component) ─── */}
      {activeTab === 'topup' && (
        <ManageTopUpTab
          position={position}
          isConnected={isConnected}
          liveBchPrice={liveBchPrice}
          isToppingUp={isToppingUp}
          onTopUp={onTopUp}
        />
      )}

      {activeTab === 'dock' && (
        <ManageWithdrawTab
          position={position}
          isConnected={isConnected}
          isDrained={isDrained}
          effectiveReserveSats={effectiveReserveSats}
          effectiveTokenAmount={effectiveTokenAmount}
          liveBchPrice={liveBchPrice}
          isDocking={isDocking}
          onDock={onDock}
        />
      )}

      {activeTab === 'rebalance' && (
        <ManageRebalanceTab
          position={position}
          isConnected={isConnected}
          isDrained={isDrained}
          liveBchPrice={liveBchPrice}
          isRebalancing={isRebalancing}
          onRebalance={onRebalance}
        />
      )}
    </div>
  );
}

export default MeshPoolManageCard;
