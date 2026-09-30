import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { MeshMyPools } from '@/components/mesh/pools/MeshMyPools';
import { MeshPoolsOverview } from '@/components/mesh/pools/MeshPoolsOverview';
import { MeshLeaderboard } from '@/components/mesh/pools/MeshLeaderboard';
import { CreatePoolForm } from '@/components/mesh/pools/CreatePoolForm';

type Tab = 'positions' | 'pools' | 'leaderboard' | 'create';

export function MeshPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab: Tab = rawTab === 'pools' || rawTab === 'create' || rawTab === 'leaderboard' ? rawTab : 'positions';
  const token = searchParams.get('token') ?? undefined;

  const go = (tab: Tab, tokenCategory?: string) => setSearchParams(tokenCategory ? { tab, token: tokenCategory } : { tab });

  return (
    <div className="container mx-auto py-4 sm:py-6 px-4 md:px-8 max-w-[1200px] space-y-6">
      {activeTab === 'positions' && <MeshMyPools onCreateNew={() => go('create')} />}
      {activeTab === 'pools' && <MeshPoolsOverview onTab={go} />}
      {activeTab === 'leaderboard' && <MeshLeaderboard />}
      {activeTab === 'create' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">New pool</h1>
            <p className="text-xs text-zinc-400 mt-1">Fixed-price liquidity: you set the price, the covenant enforces it on every fill, and only you can withdraw.</p>
          </div>
          <CreatePoolForm key={token ?? 'default'} initialToken={token} />
        </div>
      )}
    </div>
  );
}

export default MeshPage;
