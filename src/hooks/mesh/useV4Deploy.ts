/**
 * Open a V4 position (in-place bins owned by an NFT), moved unchanged out of
 * V4DeployPanel so the old builder and the new create flow sign the same
 * genesis:
 *
 *   range params → server plan (/v4/positions/preview) → every bin, the NFT and
 *   the metadata output checked here → seed output #0 (made first if the wallet
 *   has none) → genesis transaction → metadata pinned (best effort) → pending
 *   saved → registered with retry → position page.
 */
import { useMemo, useState } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { toast } from 'sonner';
import { binToHex } from '@bitauth/libauth';
import type { Utxo } from 'cashscript';
import { meshApi, useInvalidateMesh, type MeshSignerState } from '@/hooks/useMesh';
import { MeshApiError } from '@/lib/mesh/meshApi';
import { shortHex } from '@/lib/mesh/format';
import { sendPoolTx, type BuiltTx } from '@/lib/mesh/poolTx';
import { registerWithRetry } from '@/lib/mesh/pendingRegistrations';
import { v4Levels } from '@/lib/mesh/v4/position';
import { verifyPlan, type PlanExpect } from '@/lib/mesh/v4/verify';
import { buildGenesis, findSeed } from '@/lib/mesh/v4/v4Tx';
import { ensureSeed } from '@/lib/mesh/v4/seed';
import { addPendingV4, removePendingV4 } from '@/lib/mesh/v4/display';
import type { V4Plan, V4PreviewInput, V4Shape, V4Strength } from '@/lib/mesh/v4/types';
import type { SignProgress } from '@/components/mesh/kit/SigningModal';
import type { Balances } from './useV3Deploy';

/** Shown while the wallet has no seed yet: any txid works for a preview (the category changes, nothing else). */
export const PREVIEW_SEED = '00'.repeat(31) + '01';
/** carrier sats each ask bin holds on top of its tokens */
export const ASK_CARRIER = 1000n;

export interface V4Request {
  step: number;
  lowIndex: number;
  highIndex: number;
  marketIndex: number;
  depositSats: bigint;
  depositTokens: bigint;
  shape: V4Shape;
  strength?: V4Strength;
  /** the most the bins may take from the wallet */
  maxSats: bigint;
}

/** The range template's server params as a V4 request (grid levels), or null when incomplete. */
export function v4RequestOf(params: Record<string, unknown> | undefined): V4Request | null {
  if (!params) return null;
  const step = Number(params.binStepBps ?? 100);
  const low = Number(params.lowSatsPerToken), high = Number(params.highSatsPerToken), center = Number(params.centerSatsPerToken);
  if (!(low > 0 && high > low && center > 0)) return null;
  const lv = v4Levels(low, high, center, step);
  const depositSats = BigInt(String(params.depositSats ?? '0'));
  const depositTokens = BigInt(String(params.depositTokens ?? '0'));
  const askLevels = Math.max(0, lv.highIndex - Math.max(lv.marketIndex, lv.lowIndex - 1));
  return {
    step, ...lv, depositSats, depositTokens,
    shape: String(params.shape ?? 'spot') as V4Shape, strength: params.strength as V4Strength | undefined,
    maxSats: depositSats + BigInt(askLevels) * ASK_CARRIER,
  };
}

export interface V4Review { plan: V4Plan; built: BuiltTx; seed: Utxo }

export interface UseV4Deploy {
  req: V4Request | null;
  preview: UseQueryResult<V4Plan, Error>;
  verified: { ok: true } | { ok: false; error: string } | null;
  /** the server has V4 paused or not configured (503) */
  notEnabled: boolean;
  /** the wallet has no output #0 yet: it pays itself once before the genesis */
  needsSeed: boolean;
  validation: string | null;
  review: V4Review | null;
  openReview: () => Promise<void>;
  closeReview: () => void;
  confirm: () => Promise<string | null>;
  busy: string | null;
  error: string | null;
  progress: SignProgress;
}

export function useV4Deploy({
  wallet, balances, params, paramsError, token, symbol, enabled = true, onDone,
}: {
  wallet: MeshSignerState;
  balances?: Balances;
  /** the range template's server params (prices in sats per token unit) */
  params?: Record<string, unknown>;
  paramsError?: string;
  token: string;
  symbol: string;
  enabled?: boolean;
  onDone?: (category: string) => void;
}): UseV4Deploy {
  const invalidate = useInvalidateMesh();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<V4Review | null>(null);
  const [progress, setProgress] = useState<SignProgress>({ phase: 'review' });

  const req = useMemo(() => v4RequestOf(params), [params]);

  const seedQ = useQuery({
    queryKey: ['mesh', 'v4-seed', wallet.signer?.address ?? ''],
    enabled: !!wallet.signer && enabled,
    queryFn: async () => findSeed(await wallet.signer!.getUtxos()),
    staleTime: 30_000,
  });

  const input = useMemo((): V4PreviewInput | null => {
    if (!req || !wallet.signer) return null;
    return {
      tokenCat: token, binStepBps: req.step, lowIndex: req.lowIndex, highIndex: req.highIndex, marketIndex: req.marketIndex,
      depositSats: req.depositSats.toString(), depositTokens: req.depositTokens.toString(), shape: req.shape, strength: req.strength,
      seedTxid: seedQ.data?.txid ?? PREVIEW_SEED, owner: wallet.signer.tokenAddress,
    };
  }, [req, wallet.signer, token, seedQ.data]);

  const preview = useQuery({
    queryKey: ['mesh', 'v4-preview', input],
    enabled: !!input && enabled,
    queryFn: () => meshApi.v4Preview(input!),
    retry: false,
  });

  const expectOf = (category: string): PlanExpect | null => (req && wallet.signer ? {
    category, tokenCat: token, ownerLock: binToHex(wallet.signer.lockingBytecode), binStepBps: req.step,
    maxSats: req.maxSats, maxTokens: req.depositTokens, lowIndex: req.lowIndex, highIndex: req.highIndex,
  } : null);

  const verified = useMemo((): UseV4Deploy['verified'] => {
    if (!preview.data || !input) return null;
    try {
      verifyPlan(preview.data, expectOf(input.seedTxid)!);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? String(e) };
    }
  }, [preview.data, input]); // eslint-disable-line react-hooks/exhaustive-deps

  const notEnabled = preview.error instanceof MeshApiError && preview.error.status === 503;

  const validation = (() => {
    if (!wallet.signer) return wallet.unavailable ?? 'Connect a wallet';
    if (paramsError) return paramsError;
    if (!req) return 'Set the low, high and market prices';
    if (notEnabled) return 'V4 positions are not enabled on this Mesh server yet.';
    if (preview.isError) return (preview.error as Error).message;
    if (verified && !verified.ok) return `Refusing to deploy: ${verified.error}`;
    const t = preview.data?.totals;
    if (balances && t) {
      if (BigInt(t.sats) + 2_000n > balances.sats) return 'Not enough BCH in the wallet (the bins, the NFT and the fee)';
      if (BigInt(t.tokens) > (balances.tokens[token] ?? 0n)) return `Not enough ${symbol} in the wallet`;
    }
    return null;
  })();

  async function openReview() {
    if (!wallet.signer || !input) return;
    setError(null);
    setProgress({ phase: 'building' });
    try {
      const seed = await ensureSeed(wallet.signer, setBusy);
      if (seed.txid !== seedQ.data?.txid) void seedQ.refetch();
      setBusy('Planning the position…');
      const plan = await meshApi.v4Preview({ ...input, seedTxid: seed.txid });
      setProgress({ phase: 'checking' });
      verifyPlan(plan, expectOf(seed.txid)!);
      setBusy('Building the transaction…');
      const built = await buildGenesis(wallet.signer, plan, seed);
      setReview({ plan, built, seed });
      setProgress({ phase: 'review' });
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setError(msg);
      setProgress(p => ({ phase: 'review', failed: { phase: p.phase === 'checking' ? 'checking' : 'building', message: msg } }));
    } finally {
      setBusy(null);
    }
  }

  async function confirm(): Promise<string | null> {
    if (!review || !wallet.signer) return null;
    const { plan, built } = review;
    let txid: string | null = null;
    try {
      // pin first: a 503 (no pinning key on the server) still leaves the https copy
      setBusy('Publishing the NFT metadata…');
      setProgress({ phase: 'publishing' });
      await meshApi.v4PinMetadata(plan.category).catch(() => undefined);
      setBusy(wallet.kind === 'external' ? 'Approve the transaction in your wallet…' : 'Signing and broadcasting…');
      setProgress({ phase: 'signing' });
      txid = await sendPoolTx(wallet.signer, built, `Mesh V4: open a position (${plan.bins.length} bins) and mint its NFT`, { raw: true });
      const pairName = `BCH/${symbol}`;
      addPendingV4({ category: plan.category, genesisTxid: txid, bins: plan.register.body.bins, pairName, createdAt: Date.now() });
      setBusy('Registering with Mesh…');
      setProgress({ phase: 'listing', txid });
      await registerWithRetry(() => meshApi.v4Register({ genesisTxid: txid!, bins: plan.register.body.bins, pairName }));
      removePendingV4(plan.category);
      invalidate();
      toast.success('Position created', { description: `${plan.bins.length} bins · NFT ${shortHex(plan.category)} in your wallet · ${shortHex(txid)}` });
      setProgress({ phase: 'done', txid });
      setReview(null);
      onDone?.(plan.category);
      return plan.category;
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      toast.error(txid ? 'Funded, registration pending' : 'Transaction not sent', {
        description: txid ? `${msg}. The NFT and the bins are on chain; the position page retries the registration.` : msg,
        duration: 12_000,
      });
      setError(msg);
      setProgress({ phase: txid ? 'listing' : 'signing', failed: { phase: txid ? 'listing' : 'signing', message: msg }, txid: txid ?? undefined });
      // the bins and the NFT are on chain: the position page retries the registration
      if (txid) { setReview(null); onDone?.(plan.category); }
      return txid ? plan.category : null;
    } finally {
      setBusy(null);
    }
  }

  return {
    req, preview, verified, notEnabled, needsSeed: !!wallet.signer && !seedQ.data && !!preview.data,
    validation, review, openReview, closeReview: () => { if (!busy) { setReview(null); setProgress({ phase: 'review' }); } },
    confirm, busy, error, progress,
  };
}
