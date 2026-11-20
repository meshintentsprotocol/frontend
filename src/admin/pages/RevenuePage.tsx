import { useState } from 'react';
import { Coins } from 'lucide-react';
import { useRevenue } from '../hooks';
import { PageHeader, Section, QueryState, KpiTile, Segmented } from '../kit';
import { AssetMapList } from '../assets';
import { formatSatsCompact } from '@/lib/mesh/format';

export function RevenuePage() {
 const [window, setWindow] = useState('h24');
 const q = useRevenue();
 return <>
  <PageHeader title="Revenue & execution costs" icon={<Coins className="w-5 h-5 text-emerald-300" />} description="Recorded receipts by asset, fill costs and Balancer gains. Compare observed activity with the business model." />
  <Segmented label="Period" value={window} onChange={setWindow} options={[{value:'h24',label:'24h'},{value:'d7',label:'7d'},{value:'d30',label:'30d'},{value:'all',label:'All retained history'}]} />
  <QueryState q={q} rows={8}>{d => {
   const r=d.windows[window as keyof typeof d.windows];
   return <div className="space-y-5 mt-5">
    <div className="grid gap-3 md:grid-cols-4">
     <KpiTile label="Filled orders / slices" value={r.fills} sub={`${r.transactions} fill transactions · ${r.activeTraders} traders`} />
     <KpiTile label="BCH-side volume" value={formatSatsCompact(r.bchSideVolumeSats)} sub="Token-to-token volume excluded" />
     <KpiTile label="Recorded fill fees" value={formatSatsCompact(r.recordedFillFeeSats)} sub="BCH cost, from persisted fill records" />
     <KpiTile label="BCH receipts less fill fees" value={formatSatsCompact(r.comparable.marginSats)} sub={`${r.comparable.fills} BCH-output fills, excluding inventory`} />
    </div>
    <Section title="Collection wallets">
     <p className="text-sm break-all">Protocol treasury PKH: {d.treasuryPkh || 'Not configured — surplus stays with solver'}</p>
     <p className="text-xs text-zinc-400 mt-2">Solver: {d.solverAddress || 'Not initialized'}</p>
     <p className="text-xs text-zinc-400 mt-2">Balancer: {d.balancerAddress || 'No wallet heartbeat'}</p>
    </Section>
    <div className="grid gap-4 md:grid-cols-3">
     <Section title="Treasury receipts"><AssetMapList map={r.treasury} /></Section>
     <Section title="Retained by solver"><AssetMapList map={r.retained} /></Section>
     <Section title="Partner payouts"><AssetMapList map={r.partners} /></Section>
    </div>
    <Section title="Balancer: pending versus confirmed">
     <div className="grid gap-3 md:grid-cols-2">
      <KpiTile label="Confirmed net gain" value={formatSatsCompact(r.balancer.confirmedNetSats)} sub={`${r.balancer.confirmedTrades} trades; transaction costs already included`} />
      <KpiTile label="Pending net gain" value={formatSatsCompact(r.balancer.pendingNetSats)} sub={`${r.balancer.pendingTrades} trades awaiting confirmation`} />
     </div>
     <p className="text-xs text-zinc-400 mt-3">{r.balancer.rejected} rejected · {r.balancer.dryRun} dry-run records · Bot {d.balancerOnline ? 'online' : 'offline'} · {d.balancerDryRun ? 'dry run' : 'live execution'}</p>
    </Section>
    <Section title="Coverage and interpretation">
     <p className="text-sm">These figures are recorded execution contributions, not total operating profit. Refunds, consolidation, infrastructure, inventory basis and subscription/service revenue are not included. Token quantities are never added to BCH.</p>
     <p className="text-xs text-zinc-400 mt-3">{r.coverage.unknownReceiptFills} fills with unknown receipts · {r.coverage.missingFeeFills} with missing fee records · {r.coverage.inventoryFills} inventory fills · {r.coverage.unknownTimestampFills} without timestamps.</p>
     <p className="text-xs text-zinc-400 mt-3">Intent receipts are not independently confirmation-reconciled here. Balancer history covers {d.retainedBalancerTrades} retained records. BCH margin excludes token-output and inventory fills; it is not a wallet-balance reconciliation. LP earnings belong to LPs and are shown on the liquidity pages.</p>
     <p className="text-xs text-zinc-400 mt-3">Limit: {r.kinds.limit || 0} · Dutch: {r.kinds.dutch || 0} · TWAP slices: {r.kinds.twap || 0}. Proposed volume fees and subscriptions are not counted as collected revenue.</p>
    </Section>
   </div>;
  }}</QueryState>
 </>;
}
