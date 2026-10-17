/**
 * Admin · V4 positions (v4plan 04 §2.10): the position registry, the engine
 * split (V3 pools vs V4 bins), the one-UTXO-per-bin invariant, and how much
 * value sits on each engine (V3 → V4 migration).
 */
import { Gem, HeartPulse, AlertTriangle, ArrowRightLeft } from 'lucide-react';
import { useV4Positions, useV4Health, useV4Migration } from '../hooks';
import {
  PageHeader, Section, KpiTile, QueryState, DataTable, Hash, Pill, SplitBar, TimeAgo,
} from '../kit';
import { formatSatsCompact, formatNumber } from '@/lib/mesh/format';
import type { V4AdminPosition } from '../api';


export function V4PositionsPage() {
  const positions = useV4Positions();
  const health = useV4Health();
  const migration = useV4Migration();

  return (
    <>
      <PageHeader title="V4 positions" icon={<Gem className="w-5 h-5 text-violet-300" />}
        description="Positions are bins owned by an NFT; ownership follows the NFT, so holders aren't stored. This is the registry, the engine split against V3 pools, and the one-UTXO-per-bin invariant (a V4 bin recreates itself in place on every fill, so each bin address should hold exactly one live UTXO)." />

      {/* KPIs + engine split */}
      <QueryState q={health} rows={2}>
        {h => (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
              <KpiTile label="Positions" value={h.engines.v4.positions} icon={<Gem className="w-4 h-4" />} />
              <KpiTile label="V4 bins" value={h.engines.v4.bins} sub={`${formatSatsCompact(h.engines.v4.sats)} + ${h.engines.v4.tokens} tok`} />
              <KpiTile label="V3 pools" value={h.engines.v3.pools} sub={formatSatsCompact(h.engines.v3.sats)} />
              <KpiTile label="One UTXO per bin" value={h.invariant.ok ? 'OK' : `${h.invariant.violations.length} bad`}
                tone={h.invariant.ok ? 'emerald' : 'rose'} sub={h.invariant.ok ? 'no fragments' : 'fragmented bins'} />
              {migration.data && <KpiTile label="V4 share of grid sats" value={`${migration.data.shareOfSats.v4}%`} sub={`V3 ${migration.data.shareOfSats.v3}%`} />}
              {positions.data && <KpiTile label="Funded bins" value={`${positions.data.totals.fundedBins}/${positions.data.totals.bins}`} sub={formatSatsCompact(positions.data.totals.valueAtBidSats) + ' at bids'} />}
            </div>

            <div className="grid gap-5 xl:grid-cols-3 mt-5">
              <Section title="Liquidity by engine" icon={<HeartPulse className="w-4 h-4 text-emerald-300" />} description="BCH held on the shared grid (token value not converted).">
                <SplitBar parts={[
                  { label: 'V3 pools', value: Number(h.engines.v3.sats), color: '#6b7280' },
                  { label: 'V4 bins', value: Number(h.engines.v4.sats), color: '#8b5cf6' },
                ]} />
              </Section>
              <Section title="One UTXO per bin" icon={<AlertTriangle className="w-4 h-4 text-amber-300" />} className="xl:col-span-2"
                description="A V4 fill spends a bin and recreates it in place, so each bin address should hold exactly one live UTXO. More than one is a stuck fragment.">
                {h.invariant.ok ? (
                  <p className="text-sm text-emerald-300">Every bin holds exactly one live UTXO.</p>
                ) : (
                  <DataTable
                    rows={h.invariant.violations}
                    rowKey={v => `${v.category}-${v.bin}`}
                    columns={[
                      { key: 'cat', header: 'Position', cell: v => <Hash value={v.category} to={`/mesh/position/${v.category}`} /> },
                      { key: 'bin', header: 'Bin', cell: v => <span className="font-mono">#{v.bin}</span> },
                      { key: 'addr', header: 'Address', cell: v => <Hash value={v.address} /> },
                      { key: 'n', header: 'UTXOs', align: 'right', cell: v => <Pill tone="rose">{v.utxos}</Pill> },
                    ]}
                  />
                )}
              </Section>
            </div>
          </>
        )}
      </QueryState>

      {/* The registry */}
      <Section title="Registry" icon={<Gem className="w-4 h-4 text-violet-300" />} className="mt-5"
        description={positions.data ? `${positions.data.count} position(s).` : undefined}
        actions={migration.data && <span className="text-[11px] text-zinc-500 inline-flex items-center gap-1.5"><ArrowRightLeft className="w-3.5 h-3.5" />V4 holds {migration.data.shareOfSats.v4}% of grid BCH</span>}>
        <QueryState q={positions} rows={6}>
          {d => (
            <DataTable<V4AdminPosition>
              rows={d.positions}
              rowKey={p => p.category}
              onRowClick={p => window.open(`/mesh/position/${p.category}`, '_blank')}
              columns={[
                { key: 'cat', header: 'Position', cell: p => <div className="flex flex-col"><Hash value={p.category} to={`/mesh/position/${p.category}`} /><span className="text-[10px] text-zinc-500">{p.pairName ?? '—'}</span></div> },
                { key: 'range', header: 'Range (sats/unit)', cell: p => <span className="font-mono text-xs">{formatNumber(p.lowSatsPerUnit, 2)}–{formatNumber(p.highSatsPerUnit, 2)}</span>, hideBelow: 'sm' },
                { key: 'step', header: 'Step', align: 'right', cell: p => <span className="font-mono text-xs">{(p.binStepBps / 100).toFixed(2)}%</span>, hideBelow: 'md' },
                { key: 'bins', header: 'Bins', align: 'right', cell: p => <span className="font-mono">{p.fundedBins}/{p.bins}</span> },
                { key: 'val', header: 'Value', align: 'right', cell: p => <span className="font-mono">{formatSatsCompact(p.valueAtBidSats)}</span> },
                { key: 'tok', header: 'Holds', align: 'right', cell: p => <span className="font-mono text-xs">{formatSatsCompact(p.sats)}{p.tokens !== '0' ? ` + ${p.tokens}` : ''}</span>, hideBelow: 'md' },
                { key: 'var', header: 'Variant', cell: p => <div className="flex gap-1">{p.variant !== 'default' && <Pill tone="amber">{p.variant}</Pill>}{p.hasManager && <Pill tone="violet">keeper</Pill>}{p.variant === 'default' && !p.hasManager && <span className="text-zinc-600 text-xs">—</span>}</div>, hideBelow: 'lg' },
                { key: 'meta', header: 'Metadata', cell: p => p.metadataPinned ? <Pill tone="emerald">pinned</Pill> : p.metadataUri ? <Pill tone="zinc">on-chain</Pill> : <span className="text-zinc-600 text-xs">—</span>, hideBelow: 'lg' },
                { key: 'age', header: 'Created', align: 'right', cell: p => <span className="text-xs text-zinc-500">{new Date(p.registeredAt).toLocaleDateString()}</span>, hideBelow: 'xl' },
              ]}
            />
          )}
        </QueryState>
      </Section>
    </>
  );
}
