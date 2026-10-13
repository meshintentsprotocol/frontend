/**
 * Bitcoin Cash (BCH) cross-chain swap operations via NEAR Intents 1Click API.
 * Includes swaps list, individual audit detail inspector, cross-chain matrix for all 38 chains,
 * and live quote simulator operator tools.
 */
import { useState, useMemo } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeftRight, Check, Coins, Copy, ExternalLink, Globe, Loader2, Play, RefreshCw,
  Search, ShieldCheck, Zap, AlertCircle, Sparkles, Filter, ChevronRight, Layers, ArrowUpRight
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ActionButton, ConfirmAction, DataTable, EmptyBlock, Hash, KeyValue, KpiTile, PageHeader, Pager, Pill,
  QueryState, SearchBox, Section, Segmented, TimeAgo, useUrlState,
  type Column, type Tone
} from '../kit';
import { useBchSwap, useBchSwaps, useBchTokens, useProfits, useSwapAction, useSwapAdmin, useSwapOverview } from './SwapAdminContext';
import { PauseControl } from './SwapOverviewPages';
import { AlertList, BchStatusBadge, bchStatusLabel, swapUrl, trimAmount, usd } from './swapKit';
import type { BchSwapRecord, BchToken } from '@/swap-server/types';

const blockchairTx = (tx: string) => `https://blockchair.com/bitcoin-cash/transaction/${tx}`;
const blockchairAddr = (addr: string) => `https://blockchair.com/bitcoin-cash/address/${addr}`;

export const CHAIN_METAS: Record<string, { name: string; icon?: string; tone?: Tone }> = {
  bch: { name: 'Bitcoin Cash', icon: '/logos/bitcoin-cash-bch-logo.svg', tone: 'emerald' },
  near: { name: 'NEAR Protocol', icon: '/logos/near.svg', tone: 'emerald' },
  eth: { name: 'Ethereum', icon: '/logos/ethereum-eth-logo.svg', tone: 'sky' },
  sol: { name: 'Solana', icon: '/logos/solana.svg', tone: 'violet' },
  base: { name: 'Base', icon: '/logos/Base_square_blue.svg', tone: 'sky' },
  arb: { name: 'Arbitrum', icon: '/logos/arbitrum-arb-logo.svg', tone: 'sky' },
  bsc: { name: 'BNB Chain', icon: '/logos/bnb-bnb-logo.svg', tone: 'amber' },
  op: { name: 'Optimism', icon: '/logos/optimism.svg', tone: 'rose' },
  pol: { name: 'Polygon', icon: '/logos/polygon-matic-logo.svg', tone: 'violet' },
  avax: { name: 'Avalanche', icon: '/logos/avalanche-avax-logo.svg', tone: 'rose' },
  aptos: { name: 'Aptos', tone: 'zinc' },
  sui: { name: 'Sui', tone: 'sky' },
  btc: { name: 'Bitcoin', icon: '/logos/bitcoin-btc-logo.svg', tone: 'amber' },
  doge: { name: 'Dogecoin', tone: 'amber' },
  tron: { name: 'Tron', tone: 'rose' },
  ton: { name: 'TON', tone: 'sky' },
  gnosis: { name: 'Gnosis', tone: 'emerald' },
  movement: { name: 'Movement', icon: '/logos/movement.svg', tone: 'amber' },
  monero: { name: 'Monero', icon: '/logos/monero.svg', tone: 'amber' },
  cardano: { name: 'Cardano', tone: 'sky' },
  stellar: { name: 'Stellar', tone: 'zinc' },
  starknet: { name: 'Starknet', tone: 'violet' },
  monad: { name: 'Monad', tone: 'violet' },
  xlayer: { name: 'X Layer', tone: 'zinc' },
  plasma: { name: 'Plasma', tone: 'sky' },
  bera: { name: 'Berachain', tone: 'amber' },
  aleo: { name: 'Aleo', tone: 'zinc' },
  dash: { name: 'Dash', tone: 'sky' },
  ltc: { name: 'Litecoin', tone: 'zinc' },
  xrp: { name: 'XRP', tone: 'zinc' },
  zec: { name: 'Zcash', tone: 'amber' },
};

export function getChainDisplayName(chainKey: string): string {
  const meta = CHAIN_METAS[chainKey.toLowerCase()];
  return meta?.name || chainKey.toUpperCase();
}

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

// ============================================================================
// 1. BCH Swaps List Page
// ============================================================================

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
        actions={
          <div className="flex items-center gap-2">
            <Link
              to={swapUrl.bchChains}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-xs font-medium text-white transition-colors"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              Cross-Chain Matrix
            </Link>
            {o.data && <PauseControl section="bch" paused={o.data.bch?.settings?.paused ?? false} />}
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <KpiTile label="Total Swaps" value={bchStats?.totalSwaps ?? allSwaps.length} sub="All time recorded" />
        <KpiTile label="Settled Swaps" value={bchStats?.successfulSwaps ?? allSwaps.filter(s => s.status === 'SUCCESS').length} tone="emerald" sub="Successfully delivered" />
        <KpiTile label="Est. Total Volume" value={usd(totalVolume)} sub="Across all chains" />
        <KpiTile label="Net App Profit" value={usd(totalProfit)} tone="emerald" sub="Settled fee revenue (25 bps)" />
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

// ============================================================================
// 2. BCH Swap Detail & Operator Audit Page
// ============================================================================

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
          <div className="flex items-center gap-2">
            <ActionButton
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              label="Poll 1Click Status"
              onClick={() => void q.refetch()}
            />
          </div>
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
                <KeyValue label="Origin Network" value={getChainDisplayName(swap.fromToken.chain)} />
                <KeyValue label="Amount to Send" value={`${swap.amountInFormatted} ${swap.fromToken.symbol}`} />
                <KeyValue
                  label="Single-Use Deposit Address"
                  value={
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs select-all break-all">{swap.depositAddress}</span>
                      <button
                        onClick={() => { navigator.clipboard.writeText(swap.depositAddress); toast.success('Address copied'); }}
                        className="text-zinc-400 hover:text-white"
                        title="Copy deposit address"
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
                <KeyValue label="Target Network" value={getChainDisplayName(swap.toToken.chain)} />
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
            <Section title="Operator Tools & Manual Intervention">
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                <p className="text-xs text-zinc-400">
                  If the user deposited directly but background block indexing hasn't registered the hash, manually submit the origin transaction hash below to force 1Click verification.
                </p>
                <div className="flex gap-2 max-w-lg">
                  <input
                    type="text"
                    placeholder="Enter deposit tx hash (0x... or bch txid)"
                    value={txInput}
                    onChange={e => setTxInput(e.target.value)}
                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 font-mono"
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

// ============================================================================
// 3. Live Quote Simulator Component (Operator Action Tool)
// ============================================================================

export function BchQuoteSimulator({ initialToken, defaultAmount = '1' }: { initialToken?: BchToken; defaultAmount?: string }) {
  const { api } = useSwapAdmin();
  const qTokens = useBchTokens();
  const tokens = qTokens.data?.tokens ?? [];

  const [direction, setDirection] = useState<'bch-to-token' | 'token-to-bch'>('bch-to-token');
  const [selectedAssetId, setSelectedAssetId] = useState<string>(initialToken?.assetId || 'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near');
  const [amount, setAmount] = useState<string>(defaultAmount);
  const [loading, setLoading] = useState(false);
  const [quoteResult, setQuoteResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const targetToken = useMemo(() => tokens.find(t => t.assetId === selectedAssetId), [tokens, selectedAssetId]);
  const bchToken = useMemo(() => tokens.find(t => t.symbol === 'BCH') || {
    assetId: 'nep141:bch.omft.near',
    symbol: 'BCH',
    decimals: 8,
    chain: 'bch'
  }, [tokens]);

  const handleSimulate = async () => {
    if (!amount || Number(amount) <= 0) return;
    setLoading(true);
    setError(null);
    setQuoteResult(null);

    try {
      const fromToken = direction === 'bch-to-token' ? bchToken : targetToken;
      const toToken = direction === 'bch-to-token' ? targetToken : bchToken;

      if (!fromToken || !toToken) {
        throw new Error('Please select valid tokens for the quote.');
      }

      // Convert amount to integer atomic units based on decimals
      const rawMultiplier = BigInt(10) ** BigInt(fromToken.decimals || 8);
      const rawUnits = (BigInt(Math.floor(Number(amount) * 10000)) * rawMultiplier / 10000n).toString();

      const res = await api.bchQuote({
        fromAsset: fromToken.assetId,
        toAsset: toToken.assetId,
        amount: rawUnits,
        fromChain: fromToken.chain,
        toChain: toToken.chain,
      });

      setQuoteResult(res);
      toast.success('Quote generated successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to fetch quote');
      toast.error('Quote failed: ' + (err.message || 'Check liquidity'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.07] space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-emerald-400" />
          <h4 className="text-sm font-semibold text-white">Live 1Click Rate & Liquidity Simulator</h4>
        </div>
        <button
          onClick={() => setDirection(d => d === 'bch-to-token' ? 'token-to-bch' : 'bch-to-token')}
          className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20"
        >
          <ArrowLeftRight className="w-3 h-3" />
          Flip Direction: {direction === 'bch-to-token' ? 'BCH → Token' : 'Token → BCH'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-[11px] text-zinc-400 block mb-1">
            {direction === 'bch-to-token' ? 'Target Destination Token' : 'Source Origin Token'}
          </label>
          <select
            value={selectedAssetId}
            onChange={e => setSelectedAssetId(e.target.value)}
            className="w-full h-8 px-2 rounded-lg bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-emerald-500"
          >
            {tokens.filter(t => t.symbol !== 'BCH').map(t => (
              <option key={t.assetId} value={t.assetId} className="bg-zinc-900">
                {t.symbol} — {t.name} ({getChainDisplayName(t.chain)})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] text-zinc-400 block mb-1">
            Amount In ({direction === 'bch-to-token' ? 'BCH' : targetToken?.symbol || 'Token'})
          </label>
          <input
            type="number"
            step="any"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="e.g. 1.0"
            className="w-full h-8 px-2.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
          />
        </div>

        <div className="flex items-end">
          <button
            onClick={handleSimulate}
            disabled={loading || !amount}
            className="w-full h-8 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors shadow-sm"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            Simulate 1Click Rate
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {quoteResult && (
        <div className="p-3.5 rounded-lg bg-emerald-500/[0.05] border border-emerald-500/20 space-y-3 animate-in fade-in">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <div className="text-[10px] text-zinc-500 uppercase font-semibold">Expected Return</div>
              <div className="font-mono font-medium text-emerald-300 tabular-nums">
                {quoteResult.amountOutFormatted} {quoteResult.toToken?.symbol}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 uppercase font-semibold">Min Guaranteed</div>
              <div className="font-mono text-zinc-200 tabular-nums">
                {quoteResult.minAmountOutFormatted} {quoteResult.toToken?.symbol}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 uppercase font-semibold">Est. Delivery Time</div>
              <div className="font-mono text-sky-300">
                ~{quoteResult.timeEstimateSec} seconds
              </div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 uppercase font-semibold">Integrator Fee</div>
              <div className="font-mono text-zinc-300">
                {quoteResult.ourFeeBps} bps (0.25%)
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-white/[0.06]">
            <span className="text-[11px] text-zinc-400">
              Pricing: 1 {quoteResult.fromToken?.symbol} ≈ {(Number(quoteResult.amountOutFormatted) / Number(quoteResult.amountInFormatted)).toFixed(6)} {quoteResult.toToken?.symbol}
            </span>
            <button
              onClick={() => setShowRaw(s => !s)}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 underline font-mono"
            >
              {showRaw ? 'Hide JSON payload' : 'Inspect raw 1Click signature & payload'}
            </button>
          </div>

          {showRaw && (
            <pre className="p-2.5 rounded bg-black/60 text-[10px] font-mono text-zinc-400 overflow-x-auto max-h-48 border border-white/10">
              {JSON.stringify(quoteResult, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 4. BCH Cross-Chain Matrix Page (All 38 Chains & Routes)
// ============================================================================

export function BchChainsPage() {
  const q = useBchTokens();
  const tokens = q.data?.tokens ?? [];
  const [selectedChainForSim, setSelectedChainForSim] = useState<BchToken | undefined>(undefined);

  // Dynamically compute chain breakdown from 1Click catalog
  const chainsData = useMemo(() => {
    const map = new Map<string, { key: string; name: string; count: number; tokens: BchToken[]; sampleSymbols: string[] }>();

    for (const t of tokens) {
      const k = t.chain || 'near';
      const entry = map.get(k) || {
        key: k,
        name: getChainDisplayName(k),
        count: 0,
        tokens: [],
        sampleSymbols: [],
      };
      entry.count++;
      entry.tokens.push(t);
      if (entry.sampleSymbols.length < 5 && !entry.sampleSymbols.includes(t.symbol)) {
        entry.sampleSymbols.push(t.symbol);
      }
      map.set(k, entry);
    }

    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [tokens]);

  const columns: Column<{ key: string; name: string; count: number; tokens: BchToken[]; sampleSymbols: string[] }>[] = [
    {
      key: 'chain', header: 'Blockchain Network',
      cell: c => {
        const meta = CHAIN_METAS[c.key.toLowerCase()];
        return (
          <div className="flex items-center gap-2.5">
            {meta?.icon ? (
              <img src={meta.icon} alt="" className="w-5 h-5 rounded-full object-contain" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px] font-bold text-emerald-400">
                {c.key.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <div className="text-xs font-semibold text-white">{c.name}</div>
              <div className="text-[10px] text-zinc-500 font-mono">id: {c.key}</div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'tokens', header: 'Compatible Assets', align: 'right',
      cell: c => (
        <span className="font-mono text-xs tabular-nums text-zinc-200">
          {c.count} {c.count === 1 ? 'asset' : 'assets'}
        </span>
      ),
    },
    {
      key: 'samples', header: 'Sample Supported Tokens', hideBelow: 'md',
      cell: c => (
        <div className="flex flex-wrap gap-1">
          {c.sampleSymbols.map(s => (
            <span key={s} className="px-1.5 py-0.5 rounded bg-white/[0.04] text-[10px] font-mono text-zinc-300">
              {s}
            </span>
          ))}
          {c.count > 5 && <span className="text-[10px] text-zinc-500">+{c.count - 5} more</span>}
        </div>
      ),
    },
    {
      key: 'routing', header: '1Click Solver Route',
      cell: c => (
        <Pill tone={c.key === 'bch' ? 'emerald' : 'sky'}>
          {c.key === 'bch' ? 'Native UTXO Settlement' : `BCH ↔ ${c.name} (Active)`}
        </Pill>
      ),
    },
    {
      key: 'actions', header: '', align: 'right',
      cell: c => (
        <div className="flex items-center justify-end gap-2">
          <Link
            to={`/admin/swap/bch/tokens?chain=${c.key}`}
            className="text-xs text-zinc-400 hover:text-white font-medium"
          >
            Browse →
          </Link>
          <button
            onClick={() => setSelectedChainForSim(c.tokens[0])}
            className="px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 text-[11px] font-medium"
          >
            Simulate
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="BCH Cross-Chain Route Matrix"
        icon={<Globe className="w-5 h-5 text-emerald-400" aria-hidden />}
        crumbs={[
          { label: 'Swap server', to: swapUrl.home },
          { label: 'BCH Cross-Chain', to: swapUrl.bchSwaps },
          { label: 'Route Matrix' },
        ]}
        description="All 38 blockchains connected to Bitcoin Cash via NEAR Intents 1Click solver network with instant non-custodial settlement."
        actions={
          <div className="flex items-center gap-2">
            <ActionButton
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              label="Refresh Matrix"
              onClick={() => void q.refetch()}
            />
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <KpiTile label="Supported Blockchains" value={chainsData.length || 38} tone="emerald" sub="Live connected chains" />
        <KpiTile label="Cross-Chain Assets" value={tokens.length || 207} sub="Indexed tokens in catalog" />
        <KpiTile label="Solver Mechanism" value="NEAR 1Click" sub="Non-custodial RFQ intents" />
        <KpiTile label="Settlement Base" value="Bitcoin Cash" tone="emerald" sub="P2PKH & CashTokens" />
      </div>

      {/* Operator Live Quote Simulator */}
      <BchQuoteSimulator initialToken={selectedChainForSim} />

      <Section
        title={`All Connected Blockchains (${chainsData.length})`}
        description="Every destination chain can directly swap with Bitcoin Cash in either direction without wrapping or bridge lockups."
      >
        <QueryState q={q}>
          {() => (
            <DataTable
              rowKey={c => c.key}
              rows={chainsData}
              columns={columns}
            />
          )}
        </QueryState>
      </Section>
    </>
  );
}

// ============================================================================
// 5. BCH Tokens Catalog Page
// ============================================================================

export function BchTokensPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const chainParam = searchParams.get('chain') || '';
  const [chain, setChain] = useState<string>(chainParam);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [simToken, setSimToken] = useState<BchToken | undefined>(undefined);
  const [showSim, setShowSim] = useState(false);

  const q = useBchTokens();
  const allTokens = q.data?.tokens ?? [];

  // Extract all unique chains from token list
  const availableChains = useMemo(() => {
    const set = new Set<string>();
    for (const t of allTokens) {
      if (t.chain) set.add(t.chain.toLowerCase());
    }
    return Array.from(set).sort();
  }, [allTokens]);

  const filteredTokens = useMemo(() => {
    return allTokens.filter(t => {
      if (chain && t.chain?.toLowerCase() !== chain.toLowerCase()) return false;
      if (searchQuery) {
        const ql = searchQuery.toLowerCase().trim();
        const mSym = t.symbol.toLowerCase().includes(ql);
        const mName = t.name?.toLowerCase().includes(ql);
        const mId = t.assetId.toLowerCase().includes(ql);
        const mAddr = t.contractAddress?.toLowerCase().includes(ql);
        if (!mSym && !mName && !mId && !mAddr) return false;
      }
      return true;
    });
  }, [allTokens, chain, searchQuery]);

  const handleChainChange = (newChain: string) => {
    setChain(newChain);
    if (newChain) {
      searchParams.set('chain', newChain);
    } else {
      searchParams.delete('chain');
    }
    setSearchParams(searchParams);
  };

  const columns: Column<BchToken>[] = [
    {
      key: 'token', header: 'Token Asset',
      cell: t => (
        <div className="flex items-center gap-2.5">
          {t.icon ? (
            <img src={t.icon} alt="" className="w-6 h-6 rounded-full object-contain" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px] font-bold text-emerald-400">
              {t.symbol.slice(0, 2)}
            </div>
          )}
          <div>
            <div className="text-xs font-semibold text-white">{t.symbol}</div>
            <div className="text-[10px] text-zinc-500 truncate max-w-[140px]">{t.name || t.symbol}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'chain', header: 'Source Blockchain',
      cell: t => (
        <Pill tone={t.chain === 'bch' ? 'emerald' : 'sky'}>
          {getChainDisplayName(t.chain)}
        </Pill>
      ),
    },
    {
      key: 'decimals', header: 'Decimals', align: 'right',
      cell: t => <span className="font-mono text-xs tabular-nums text-zinc-300">{t.decimals}</span>,
    },
    {
      key: 'price', header: 'Oracle Price', align: 'right',
      cell: t => <span className="font-mono text-xs tabular-nums text-zinc-100">{t.price ? usd(t.price) : '—'}</span>,
    },
    {
      key: 'assetId', header: '1Click Canonical Identifier', hideBelow: 'md',
      cell: t => (
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] text-zinc-400 break-all select-all">{t.assetId}</span>
          <button
            onClick={() => { navigator.clipboard.writeText(t.assetId); toast.success('Asset ID copied'); }}
            className="text-zinc-500 hover:text-white"
            title="Copy 1Click Asset ID"
          >
            <Copy className="w-3 h-3" />
          </button>
        </div>
      ),
    },
    {
      key: 'actions', header: '', align: 'right',
      cell: t => (
        <button
          onClick={() => {
            setSimToken(t);
            setShowSim(true);
          }}
          className="px-2.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 text-xs font-medium whitespace-nowrap"
        >
          Test Quote
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="1Click Multi-Chain Token Catalog"
        icon={<Coins className="w-5 h-5 text-emerald-400" aria-hidden />}
        crumbs={[
          { label: 'Swap server', to: swapUrl.home },
          { label: 'BCH Cross-Chain', to: swapUrl.bchSwaps },
          { label: 'Tokens' },
        ]}
        description="All 207 tokens across 38 blockchains supported for instant swaps with Bitcoin Cash."
        actions={
          <div className="flex items-center gap-2">
            <Link
              to={swapUrl.bchChains}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-xs font-medium text-white transition-colors"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              View 38 Chains Matrix
            </Link>
            <ActionButton
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              label="Refresh Catalog"
              onClick={() => void q.refetch()}
            />
          </div>
        }
      />

      {/* Operator Live Quote Simulator Toggle */}
      {showSim && simToken && (
        <div className="mb-4">
          <BchQuoteSimulator initialToken={simToken} />
        </div>
      )}

      {/* Quick Chain Filter Chips */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between pb-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => handleChainChange('')}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              !chain
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-white/[0.03] text-zinc-400 border-white/[0.06] hover:text-white'
            }`}
          >
            All ({allTokens.length})
          </button>
          {['bch', 'near', 'eth', 'sol', 'base', 'arb', 'bsc', 'op', 'pol', 'avax', 'aptos'].map(ck => (
            <button
              key={ck}
              onClick={() => handleChainChange(ck)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                chain === ck
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-white/[0.03] text-zinc-400 border-white/[0.06] hover:text-white'
              }`}
            >
              {getChainDisplayName(ck)}
            </button>
          ))}
          {/* Dropdown for remaining chains */}
          <select
            value={chain}
            onChange={e => handleChainChange(e.target.value)}
            className="h-7 px-2 rounded-full bg-white/[0.03] border border-white/[0.06] text-xs text-zinc-300 focus:outline-none"
          >
            <option value="" className="bg-zinc-900">All 38 Chains…</option>
            {availableChains.map(ck => (
              <option key={ck} value={ck} className="bg-zinc-900">
                {getChainDisplayName(ck)} ({allTokens.filter(t => t.chain === ck).length})
              </option>
            ))}
          </select>
        </div>

        <div className="w-full sm:w-64">
          <SearchBox
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search symbol, name, id…"
          />
        </div>
      </div>

      <QueryState q={q}>
        {() => (
          <DataTable
            rowKey={t => t.assetId}
            rows={filteredTokens}
            columns={columns}
          />
        )}
      </QueryState>
    </>
  );
}
