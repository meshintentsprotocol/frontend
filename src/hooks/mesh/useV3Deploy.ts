/**
 * Deploy (or rebalance into) a V3 strategy, moved unchanged out of
 * StrategyBuilder so the old builder and the new create flow sign the same
 * transaction:
 *
 *   form params → server preview (400 ms debounce) → every pool rebuilt here
 *   (address and owner must match) → one transaction funds every pool (with
 *   `replaces`: closes the old strategy's pools in the same transaction) →
 *   pending registration saved → registered with retry → old pools synced.
 *
 * `progress` drives the shared SigningModal; `busy` keeps the old text.
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { toast } from 'sonner';
import { meshApi, useInvalidateMesh, useMeshHealth, type MeshSignerState } from '@/hooks/useMesh';
import { useDebounced } from './useDebounced';
import type { StrategyInput, StrategyPreview } from '@/lib/mesh/meshApi';
import { v3ContractFor } from '@/lib/mesh/v3/v3Pool';
import { buildDeployV3, buildRebalanceV3, type ClosePool, type V3Deposit } from '@/lib/mesh/v3/v3Tx';
import { sendPoolTx, type BuiltTx } from '@/lib/mesh/poolTx';
import { addPending, registerWithRetry, removePending } from '@/lib/mesh/pendingRegistrations';
import { shortHex } from '@/lib/mesh/format';
import type { SignProgress } from '@/components/mesh/kit/SigningModal';

export interface Balances { sats: bigint; tokens: Record<string, bigint> }

export interface V3Review { built: BuiltTx; input: StrategyInput; preview: StrategyPreview }

export interface UseV3Deploy {
  preview: UseQueryResult<StrategyPreview, Error>;
  /** every previewed pool rebuilt from its params in this browser */
  verified: { ok: true; deposits: V3Deposit[] } | { ok: false; error: string } | null;
  acceptCross: boolean;
  setAcceptCross: (v: boolean) => void;
  /** why the LP can't continue yet, in words; null when ready */
  validation: string | null;
  review: V3Review | null;
  openReview: () => Promise<void>;
  closeReview: () => void;
  confirm: () => Promise<string | null>;
  busy: string | null;
  error: string | null;
  progress: SignProgress;
}

export function useV3Deploy({
  wallet, balances, input, inputError, replaces, enabled = true, symbolOf, title, onDone,
}: {
  wallet: MeshSignerState;
  balances?: Balances;
  input?: StrategyInput;
  inputError?: string;
  replaces?: string;
  /** false while another engine (V4) is chosen: no V3 preview is asked for */
  enabled?: boolean;
  symbolOf: (category: string) => string;
  /** the strategy's display name, for the wallet prompt */
  title: string;
  onDone?: (strategyId: string) => void;
}): UseV3Deploy {
  const invalidate = useInvalidateMesh();
  const health = useMeshHealth();
  const [review, setReview] = useState<V3Review | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<SignProgress>({ phase: 'review' });
  /** the LP saw the through-market warnings and wants to deploy anyway */
  const [acceptCross, setAcceptCross] = useState(false);

  const debounced = useDebounced(input);
  const preview = useQuery({
    queryKey: ['mesh', 'strategy-preview', debounced],
    enabled: !!debounced && enabled,
    queryFn: () => meshApi.previewStrategy(debounced!),
    retry: false,
  });

  // an override applies to the warnings the LP saw: new warnings need a new tick
  const warningKey = preview.data?.warnings?.join('|') ?? '';
  useEffect(() => { setAcceptCross(false); }, [warningKey]);

  // every pool recomputed locally: address must match, owner must be this wallet
  const verified = useMemo((): UseV3Deploy['verified'] => {
    if (!preview.data || !wallet.signer || !wallet.pkh) return null;
    try {
      const deposits: V3Deposit[] = preview.data.pools.map(p => {
        const { params } = v3ContractFor(p.v3, p.address, wallet.signer!.provider);
        if (params.ownerPkh !== wallet.pkh) throw new Error(`pool ${p.role} is not owned by this wallet`);
        return { params, sats: BigInt(p.deposit.sats), tokens: BigInt(p.deposit.token?.amount ?? '0') };
      });
      return { ok: true, deposits };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? String(e) };
    }
  }, [preview.data, wallet.signer, wallet.pkh]);

  const networkMismatch = !!(health.data && wallet.signer && health.data.network !== wallet.network);

  const validation = useMemo(() => {
    if (!wallet.signer) return wallet.unavailable ?? 'Connect a wallet';
    if (networkMismatch) return `The Mesh server runs on ${health.data!.network}; switch your wallet to ${health.data!.network}`;
    if (inputError) return inputError;
    if (preview.isError) return (preview.error as Error).message;
    if (verified && !verified.ok) return `Refusing to deploy: ${verified.error}`;
    if (preview.data?.warnings?.length && !acceptCross) {
      return 'Some pools are priced through the market and would be taken by arbitrage as soon as they are funded. Change the prices, or tick “Deploy anyway”.';
    }
    const t = preview.data?.totals;
    if (t && balances && !replaces) {
      if (BigInt(t.sats) > balances.sats) return 'Not enough BCH in the wallet';
      for (const [cat, amt] of Object.entries(t.tokens)) {
        if (BigInt(amt) > (balances.tokens[cat] ?? 0n)) return `Not enough ${symbolOf(cat)} in the wallet`;
      }
    }
    return null;
  }, [wallet, networkMismatch, inputError, preview.isError, preview.error, preview.data, verified, balances, health.data, acceptCross, replaces]); // eslint-disable-line react-hooks/exhaustive-deps

  /** live UTXOs of the strategy being replaced */
  async function closeCurrent(id: string): Promise<ClosePool[]> {
    const cur = await meshApi.strategy(id);
    if (cur.strategy.ownerPkh !== wallet.pkh) throw new Error('You do not own the strategy being rebalanced');
    const out: ClosePool[] = [];
    for (const p of cur.pools) {
      if (!p.v3) continue;
      const utxos = await wallet.signer!.provider.getUtxos(p.address);
      if (utxos.length) out.push({ contract: v3ContractFor(p.v3, p.address, wallet.signer!.provider).contract, utxos });
    }
    return out;
  }

  async function openReview() {
    setError(null);
    if (!wallet.signer || !verified?.ok || !input || !preview.data) return;
    setBusy('Building transaction…');
    setProgress({ phase: 'building' });
    try {
      const built = replaces
        ? await buildRebalanceV3(wallet.signer, await closeCurrent(replaces), verified.deposits)
        : await buildDeployV3(wallet.signer, verified.deposits);
      setReview({ built, input, preview: preview.data });
      setProgress({ phase: 'review' });
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setError(msg);
      setProgress({ phase: 'review', failed: { phase: 'building', message: msg } });
    } finally {
      setBusy(null);
    }
  }

  async function confirm(): Promise<string | null> {
    if (!review || !wallet.signer) return null;
    setBusy(wallet.kind === 'external' ? 'Approve the transaction in your wallet…' : 'Signing and broadcasting…');
    setProgress({ phase: 'signing' });
    let txid: string | null = null;
    try {
      const n = review.preview.pools.length;
      txid = await sendPoolTx(wallet.signer, review.built, `${replaces ? 'Rebalance into' : 'Deploy'} ${title} (${n} Mesh pool${n > 1 ? 's' : ''})`);
      addPending({ txid, strategy: { ...review.input, replaces }, createdAt: Date.now() });
      setBusy('Listing with Mesh…');
      setProgress({ phase: 'listing', txid });
      const r = await registerWithRetry(() => meshApi.registerStrategy({ ...review.input, txid: txid!, replaces }));
      if (replaces) {
        const old = await meshApi.strategy(replaces).catch(() => null);
        for (const p of old?.pools ?? []) await meshApi.sync(p.address).catch(() => undefined);
      }
      removePending(txid);
      invalidate();
      toast.success(replaces ? 'Strategy rebalanced' : 'Strategy created', {
        description: `${n} pool${n > 1 ? 's' : ''} checked on chain · ${shortHex(txid)}`,
      });
      setProgress({ phase: 'done', txid });
      setReview(null);
      onDone?.(r.strategy.id);
      return r.strategy.id;
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      toast.error(txid ? 'Funded, registration pending' : 'Transaction not sent', {
        description: txid ? `${msg}. Your funds are in the pools; retry from My positions.` : msg,
        duration: 12_000,
      });
      setError(msg);
      setProgress({ phase: txid ? 'listing' : 'signing', failed: { phase: txid ? 'listing' : 'signing', message: msg }, txid: txid ?? undefined });
      return null;
    } finally {
      setBusy(null);
    }
  }

  return {
    preview, verified, acceptCross, setAcceptCross, validation, review,
    openReview, closeReview: () => { if (!busy) { setReview(null); setProgress({ phase: 'review' }); } },
    confirm, busy, error, progress,
  };
}
