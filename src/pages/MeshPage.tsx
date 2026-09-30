import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { MeshMyPools } from '@/components/mesh/pools/MeshMyPools';
import { MeshPoolsOverview } from '@/components/mesh/pools/MeshPoolsOverview';
import { MeshLeaderboard } from '@/components/mesh/pools/MeshLeaderboard';
import { StrategyGallery } from '@/components/mesh/strategies/StrategyGallery';
import { StrategyBuilder } from '@/components/mesh/strategies/StrategyBuilder';
import { CreatePoolV3Form } from '@/components/mesh/strategies/CreatePoolV3Form';

type Tab = 'positions' | 'pools' | 'leaderboard' | 'create';

export function MeshPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab: Tab = rawTab === 'pools' || rawTab === 'create' || rawTab === 'leaderboard' ? rawTab : 'positions';
  const template = searchParams.get('template') ?? undefined;
  const replaces = searchParams.get('replaces') ?? undefined;

  const go = (tab: Tab, extra?: Record<string, string>) => setSearchParams({ tab, ...(extra ?? {}) });

  return (
    <div className="container mx-auto py-4 sm:py-6 px-4 md:px-8 max-w-[1200px] space-y-6">
      {activeTab === 'positions' && <MeshMyPools onCreateNew={() => go('create')} />}
      {activeTab === 'pools' && <MeshPoolsOverview onTab={(tab, token) => go(tab as Tab, token ? { token } : undefined)} />}
      {activeTab === 'leaderboard' && <MeshLeaderboard />}
      {activeTab === 'create' && (
        !template ? <StrategyGallery onPick={id => go('create', { template: id })} />
          : template === 'custom' ? <CreatePoolV3Form onBack={() => go('create')} />
            : <StrategyBuilder key={`${template}-${replaces ?? ''}`} templateId={template} replaces={replaces} onBack={() => go('create')} />
      )}
    </div>
  );
}

export default MeshPage;
