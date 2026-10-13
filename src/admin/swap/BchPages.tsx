/**
 * Bitcoin Cash (BCH) cross-chain swap operations via NEAR Intents 1Click API.
 * Includes swaps list, individual audit detail inspector, and 1Click multi-chain token catalog.
 */
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftRight, Check, Coins, Copy, ExternalLink, Loader2, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
  ActionButton, DataTable, EmptyBlock, Hash, KeyValue, KpiTile, PageHeader, Pager, Pill, QueryState, SearchBox, Section, Segmented, TimeAgo, useUrlState,
  type Column,
} from '../kit';
import { useBchSwap, useBchSwaps, useBchTokens, useProfits, useSwapAction, useSwapAdmin, useSwapOverview } from './SwapAdminContext';
import { PauseControl } from './SwapOverviewPages';
import { AlertList, BchStatusBadge, bchStatusLabel, swapUrl, trimAmount, usd } from './swapKit';
import type { BchSwapRecord, BchToken } from '@/swap-server/types';

const blockchairTx = (tx: string) => `https://blockchair.com/bitcoin-cash/transaction/${tx}`;
const blockchairAddr = (addr: string) => `https://blockchair.com/bitcoin-cash/address/${addr}`;

function FlowBadge({ s }: { s: BchSwapRecord }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-zinc-100 whitespace-nowrap">
      <span className="font-medium text-emerald-400">{s.fromToken.symbol}</span>
      <span className="text-zinc-500 text-[10px]">({s.fromToken.chain})</span>
      <span className="text-zinc-500">→</span>
      <span className="font-medium text-sky-400">{s.toToken.symbol}</span>
      <span className="text-zinc-500 text-[10px]">({s.toToken.chain})</span>
    </div>
  );
}

export function BchSwapsPage() {
  const [f, setF] = useUrlState({ status: '', q: '' });
  const q = useBchSwaps({ limit: 50 });
  const p = useProfits();
  const o = useSwapOverview();
  const nav = useNavigate();

  const allSwaps = q.data?.swaps ?? [];
  const bchStats = p.data?.bchStats;

  // Local filtering by search query & status chip
  const filtered = allSwaps.filter(s => {
    if (f.status && s.status !== f.status) return false;
    if (f.q) {
      const query = f.q.toLowerCase();
      const matchId = s.id.toLowerCase().includes(query);
      const matchDep = s.depositAddress.toLowerCase().includes(query);
      const matchRec = s.recipient.toLowerCase().includes(query);
      const matchTx = (s.depositTxHash || '').toLowerCase().includes(query) || (s.settleTxHash || '').toLowerCase().includes(query);
      if (!matchId && !matchDep && !matchRec && !matchTx) return false;
    }
    return true;
  });

  const columns: Column<BchSwapRecord>[] = [
    { key: 'when', header: 'Created', cell: s => <TimeAgo at={s.createdAt} unit="ms" /> },
    { key: 'flow', header: 'Swap Flow', cell: s => <FlowBadge s={s} /> },
    {
      key: 'in', header: 'Deposit Amount', align: 'right',
      cell: s => (
        <span className="font-mono text-xs tabular-nums text-zinc-100">
          {trimAmount(s.amountInFormatted)} {s.fromToken.symbol}
        </span>
      ),
    },
    {
      key: 'out', header: 'Expected Receive', align: 'right',
      cell: s => (
        <span className="font-mono text-xs tabular-nums">
          <span className={s.status === 'SUCCESS' ? 'text-emerald-300' : 'text-zinc-400'}>
            {trimAmount(s.expectedOutFormatted)} {s.toToken.symbol}
          </span>
        </span>
      ),
    },
    { key: 'status', header: 'Status', cell: s => <BchStatusBadge status={s.status} /> },
    {
      key: 'dep', header: 'Deposit Address', hideBelow: 'md',
      cell: s => (
        <Hash
          value={s.depositAddress}
          head={6} tail={4}
          href={s.fromToken.chain === 'bch' ? blockchairAddr(s.depositAddress) : undefined}
          copy={true}
        />
      ),
    },
    {
      key: 'recipient', header: 'Recipient', hideBelow: 'lg',
      cell: s => <Hash value={s.recipient} head={5} tail={4} copy={true} />,
    },
    {
      key: 'actions', header: '', align: 'right',
      cell: s => (
        <Link
          to={swapUrl.bchSwap(s.id)}
          className="text-xs text-emerald-400 hover:text-emerald-300 font-medium whitespace-nowrap"
        >
          Audit →
        </Link>
      ),
    },
  ];

  const totalVolume = bchStats?.totalVolumeUsd ?? allSwaps.reduce((acc, s) => acc + (s.fromToken.price ? Number(s.amountInFormatted) * s.fromToken.price : 0), 0);
  const totalProfit = bchStats?.totalProfitUsd ?? (totalVolume * 0.0025);

  return (
    <>
      <PageHeader
        title="Bitcoin Cash Swaps"
        icon={<ArrowLeftRight className="w-5 h-5 text-emerald-400" aria-hidden />}
        crumbs={[{ label: 'Swap server', to: swapUrl.home }, { label: 'BCH Cross-Chain' }]}
        description="Bidirectional cross-chain Bitcoin Cash swaps powered by NEAR Intents 1Click. Zero bridge custodial risk."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <KpiTile label="Total Swaps" value={bchStats?.totalSwaps ?? allSwaps.length} sub="All time recorded" />
        <KpiTile label="Settled Swaps" value={bchStats?.successfulSwaps ?? allSwaps.filter(s => s.status === 'SUCCESS').length} tone="emerald" sub="Successfully delivered" />
        <KpiTile label="Est. Total Volume" value={usd(totalVolume)} sub="Across all chains" />
        <KpiTile label="Net App Profit" value={usd(totalProfit)} tone="emerald" sub="Settled fee revenue" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between pt-2">
        <Segmented
          value={f.status}
          onChange={status => setF({ status })}
          options={[
            { value: '', label: 'All' },
            { value: 'PENDING_DEPOSIT', label: 'Pending Deposit' },
            { value: 'KNOWN_DEPOSIT_TX', label: 'Deposit Seen' },
            { value: 'PROCESSING', label: 'Processing' },
            { value: 'SUCCESS', label: 'Success' },
            { value: 'REFUNDED', label: 'Refunded' },
          ]}
        />
        <div className="w-full sm:w-72">
          <SearchBox
            value={f.q}
            onChange={q => setF({ q })}
            placeholder="Search by ID, address, tx…"
          />
        </div>
      </div>

      <QueryState q={q}>
        {() => (
          filtered.length === 0 ? (
            <EmptyBlock title="No Bitcoin Cash swaps found" description="When users initiate cross-chain swaps involving BCH, they appear here in real time." />
          ) : (
            <DataTable
              rowKey={s => s.id}
              rows={filtered}
              columns={columns}
              onRowClick={s => nav(swapUrl.bchSwap(s.id))}
            />
          )
        )}
      </QueryState>
    </>
  );
}

export function BchSwapDetailPage() {
  const { id } = useParams<{ id: string }>();
  const q = useBchSwap(id || '');
  const { api } = useSwapAdmin();
  const swap = q.data;

  const [txInput, setTxInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitTx = async () => {
    if (!id || !txInput.trim() || submitting) return;
    setSubmitting(true);
    try {
      await api.submitBchDepositTx(id, txInput.trim());
      toast.success('Deposit transaction submitted for monitoring');
      setTxInput('');
      void q.refetch();
    } catch (err: any) {
      toast.error('Failed to submit transaction: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        title={`BCH Swap: ${id?.slice(0, 8)}…`}
        icon={<ArrowLeftRight className="w-5 h-5 text-emerald-400" aria-hidden />}
        crumbs={[
          { label: 'Swap server', to: swapUrl.home },
          { label: 'BCH Cross-Chain', to: swapUrl.bchSwaps },
          { label: id || 'Detail' },
        ]}
        actions={
          <ActionButton
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            label="Refresh"
            onClick={() => void q.refetch()}
          />
        }
      />

      <QueryState q={q}>
        {swap => (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="flex items-center gap-3">
                <FlowBadge s={swap} />
                <BchStatusBadge status={swap.status} />
              </div>
              <div className="text-xs text-zinc-400">
                Created: <TimeAgo at={swap.createdAt} unit="ms" /> · Updated: <TimeAgo at={swap.updatedAt} unit="ms" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Origin Deposit Details */}
              <Section title="Deposit & Origin Leg">
                <KeyValue label="Origin Asset" value={`${swap.fromToken.name} (${swap.fromToken.symbol})`} />
                <KeyValue label="Origin Network" value={swap.fromToken.chain.toUpperCase()} />
                <KeyValue label="Amount to Send" value={`${swap.amountInFormatted} ${swap.fromToken.symbol}`} />
                <KeyValue
                  label="Single-Use Deposit Address"
                  value={
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs select-all break-all">{swap.depositAddress}</span>
                      <button
                        onClick={() => { navigator.clipboard.writeText(swap.depositAddress); toast.success('Address copied'); }}
                        className="text-zinc-400 hover:text-white"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  }
                />
                {swap.depositMemo && <KeyValue label="Required Memo" value={swap.depositMemo} />}
                <KeyValue
                  label="Deposit Tx Hash"
                  value={
                    swap.depositTxHash ? (
                      <Hash
                        value={swap.depositTxHash}
                        href={swap.depositExplorerUrl || (swap.fromToken.chain === 'bch' ? blockchairTx(swap.depositTxHash) : undefined)}
                        head={8} tail={6}
                      />
                    ) : (
                      <span className="text-amber-400">Awaiting broadcast</span>
                    )
                  }
                />
              </Section>

              {/* Destination Settlement Details */}
              <Section title="Settlement & Destination Leg">
                <KeyValue label="Target Asset" value={`${swap.toToken.name} (${swap.toToken.symbol})`} />
                <KeyValue label="Target Network" value={swap.toToken.chain.toUpperCase()} />
                <KeyValue label="Expected Receive" value={`${swap.expectedOutFormatted} ${swap.toToken.symbol}`} />
                <KeyValue label="Guaranteed Minimum" value={`${swap.minAmountOutFormatted || swap.minAmountOut} ${swap.toToken.symbol}`} />
                <KeyValue
                  label="Recipient Address"
                  value={<Hash value={swap.recipient} head={8} tail={6} />}
                />
                <KeyValue
                  label="Refund Destination"
                  value={<Hash value={swap.refundTo} head={8} tail={6} />}
                />
                <KeyValue
                  label="Settlement Tx Hash"
                  value={
                    swap.settleTxHash ? (
                      <Hash
                        value={swap.settleTxHash}
                        href={swap.settleExplorerUrl}
                        head={8} tail={6}
                      />
                    ) : (
                      <span className="text-zinc-500">—</span>
                    )
                  }
                />
              </Section>
            </div>

            {/* Operator Actions / Manual Hash Registration */}
            <Section title="Operator Tools">
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                <p className="text-xs text-zinc-400">
                  If the user deposited directly but network monitoring did not automatically register the hash, you can manually submit the origin transaction hash below.
                </p>
                <div className="flex gap-2 max-w-lg">
                  <input
                    type="text"
                    placeholder="Enter deposit tx hash (0x... or bch txid)"
                    value={txInput}
                    onChange={e => setTxInput(e.target.value)}
                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    disabled={!txInput.trim() || submitting}
                    onClick={handleSubmitTx}
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium flex items-center gap-1.5"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Register Hash
                  </button>
                </div>
              </div>
            </Section>
          </div>
        )}
      </QueryState>
    </>
  );
}

export function BchTokensPage() {
  const [chain, setChain] = useState<string>('');
  const q = useBchTokens(chain || undefined);

  const tokens = q.data?.tokens ?? [];

  const columns: Column<BchToken>[] = [
    {
      key: 'token', header: 'Token',
      cell: t => (
        <div className="flex items-center gap-2">
          {t.icon ? <img src={t.icon} alt="" className="w-5 h-5 rounded-full" /> : <div className="w-5 h-5 rounded-full bg-emerald-500/20" />}
          <div>
            <div className="text-xs font-medium text-white">{t.symbol}</div>
            <div className="text-[10px] text-zinc-500">{t.name}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'chain', header: 'Chain',
      cell: t => <Pill tone={t.chain === 'bch' ? 'emerald' : 'sky'}>{t.chain.toUpperCase()}</Pill>,
    },
    { key: 'decimals', header: 'Decimals', align: 'right', cell: t => <span className="font-mono text-xs">{t.decimals}</span> },
    {
      key: 'price', header: 'Price (USD)', align: 'right',
      cell: t => <span className="font-mono text-xs text-zinc-300">{t.price ? usd(t.price) : '—'}</span>,
    },
    {
      key: 'assetId', header: '1Click Asset ID', hideBelow: 'md',
      cell: t => <span className="font-mono text-[11px] text-zinc-400 break-all select-all">{t.assetId}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="1Click Multi-Chain Catalog"
        icon={<Coins className="w-5 h-5 text-emerald-400" aria-hidden />}
        crumbs={[
          { label: 'Swap server', to: swapUrl.home },
          { label: 'BCH Cross-Chain', to: swapUrl.bchSwaps },
          { label: 'Tokens' },
        ]}
        description="All tokens supported by NEAR Intents 1Click solvers for swapping into or out of Bitcoin Cash."
      />

      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <Segmented
          value={chain}
          onChange={setChain}
          options={[
            { value: '', label: 'All Chains' },
            { value: 'bch', label: 'Bitcoin Cash' },
            { value: 'base', label: 'Base' },
            { value: 'arbitrum', label: 'Arbitrum' },
            { value: 'solana', label: 'Solana' },
            { value: 'eth', label: 'Ethereum' },
          ]}
        />
      </div>

      <QueryState q={q}>
        {() => (
          <DataTable
            rowKey={t => t.assetId}
            rows={tokens}
            columns={columns}
          />
        )}
      </QueryState>
    </>
  );
}
