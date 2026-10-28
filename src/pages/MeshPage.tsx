import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { MeshMyPools, type PositionsView } from '@/components/mesh/pools/MeshMyPools';
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
  // /mesh?tab=positions shows strategies; &view=pools shows the standalone pools
  const positionsView: PositionsView = searchParams.get('view') === 'pools' ? 'pools' : 'strategies';
  const template = searchParams.get('template') ?? undefined;
  const replaces = searchParams.get('replaces') ?? undefined;
  // the token the LP came with ("Provide liquidity" on a pair): kept through the gallery into the builder
  const rawToken = searchParams.get('token');
  const token = rawToken && /^[0-9a-f]{64}$/i.test(rawToken) ? rawToken.toLowerCase() : undefined;

  const go = (tab: Tab, extra?: Record<string, string>) => setSearchParams({ tab, ...(extra ?? {}) });
  const withToken = (extra: Record<string, string>) => (token ? { ...extra, token } : extra);

  return (
    <div className="container mx-auto py-4 sm:py-6 px-4 md:px-8 max-w-[1200px] space-y-6">
      {activeTab === 'positions' && (
        <MeshMyPools view={positionsView} onView={v => go('positions', v === 'pools' ? { view: v } : undefined)} onCreateNew={() => go('create')} />
      )}
      {activeTab === 'pools' && <MeshPoolsOverview onTab={(tab, token) => go(tab as Tab, token ? { token } : undefined)} />}
      {activeTab === 'leaderboard' && <MeshLeaderboard />}
      {activeTab === 'create' && (
        !template ? <StrategyGallery onPick={id => go('create', withToken({ template: id }))} />
          : template === 'custom' ? <CreatePoolV3Form key={token ?? ''} initialToken={token} onBack={() => go('create', withToken({}))} />
            : <StrategyBuilder key={`${template}-${replaces ?? ''}-${token ?? ''}`} templateId={template} replaces={replaces} initialToken={token} onBack={() => go('create', withToken({}))} />
      )}
    </div>
  );
}

export default MeshPage;
