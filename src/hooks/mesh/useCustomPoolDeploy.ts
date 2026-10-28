/**
 * Create one hand-built MeshPoolV3 pool, moved unchanged out of
 * CreatePoolV3Form:
 *
 *   params → the covenant computed here → the server's preview must give the
 *   same address and artifact hash → review → one funding transaction →
 *   pending saved → registered with retry → pool page.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { meshApi, useInvalidateMesh, type MeshSignerState } from '@/hooks/useMesh';
import { buildV3Contract, v3ArtifactHash, v3ToJson, type V3Params } from '@/lib/mesh/v3/v3Pool';
import { buildDeployV3 } from '@/lib/mesh/v3/v3Tx';
import { sendPoolTx, type BuiltTx } from '@/lib/mesh/poolTx';
import { addPending, registerWithRetry, removePending } from '@/lib/mesh/pendingRegistrations';
import { shortHex } from '@/lib/mesh/format';
import type { SignProgress } from '@/components/mesh/kit/SigningModal';
import type { Balances } from './useV3Deploy';

export function useCustomPoolDeploy({
  wallet, balances, params, paramsError, amount, reserveIsBch, reserve, reserveSymbol, pairName, onDone,
}: {
  wallet: MeshSignerState;
  balances?: Balances;
  params?: V3Params;
  paramsError?: string;
  /** the deposit in the reserve's base units; -1 when it doesn't parse */
  amount: bigint;
  reserveIsBch: boolean;
  /** the reserve category ('0x' for BCH) */
  reserve: string;
  reserveSymbol: string;
  pairName: string;
  onDone?: (address: string) => void;
}) {
  const invalidate = useInvalidateMesh();
  const [review, setReview] = useState<BuiltTx | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<SignProgress>({ phase: 'review' });

  const contract = useMemo(() => (params && wallet.signer ? buildV3Contract(params, wallet.signer.provider) : null), [params, wallet.signer]);
  const preview = useQuery({
    queryKey: ['mesh', 'preview-v3', params ? v3ToJson(params) : null],
    enabled: !!params,
    queryFn: () => meshApi.previewV3(v3ToJson(params!)),
    retry: false,
  });
  /** the server computes the same covenant: address and artifact hash */
  const previewOk = !!preview.data && !!contract && preview.data.address === contract.address && preview.data.artifactHash === v3ArtifactHash();

  const validation = (() => {
    if (!wallet.signer) return wallet.unavailable ?? 'Connect a wallet';
    if (paramsError) return paramsError;
    if (amount < 0n) return 'Invalid deposit';
    if (reserveIsBch ? amount <= 1000n : amount < 2n) return reserveIsBch ? 'Deposit more than 0.00001 BCH' : `Deposit at least 2 base units of ${reserveSymbol}`;
    if (balances && (reserveIsBch ? amount > balances.sats : amount > (balances.tokens[reserve] ?? 0n))) return `Not enough ${reserveSymbol} in the wallet`;
    if (preview.isError) return (preview.error as Error).message;
    return null;
  })();

  /** build the funding transaction and show it for review; nothing is signed yet */
  async function openReview() {
    if (!wallet.signer || !params || validation || !previewOk) return;
    setError(null);
    setBusy('Building transaction…');
    setProgress({ phase: 'building' });
    try {
      setReview(await buildDeployV3(wallet.signer, [{ params, sats: reserveIsBch ? amount : 1000n, tokens: reserveIsBch ? 0n : amount }]));
      setProgress({ phase: 'review' });
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setError(msg);
      setProgress({ phase: 'review', failed: { phase: 'building', message: msg } });
    } finally { setBusy(null); }
  }

  async function confirm(): Promise<string | null> {
    if (!wallet.signer || !params || !review) return null;
    setError(null);
    let txid: string | null = null;
    try {
      setBusy(wallet.kind === 'external' ? 'Approve the transaction in your wallet…' : 'Signing and broadcasting…');
      setProgress({ phase: 'signing' });
      txid = await sendPoolTx(wallet.signer, review, 'Create a Mesh V3 pool');
      const item = { v3: v3ToJson(params), txid, vout: 0, pairName };
      addPending({ txid, v3Items: [item], createdAt: Date.now() });
      setBusy('Listing with Mesh…');
      setProgress({ phase: 'listing', txid });
      const res = await registerWithRetry(() => meshApi.registerV3([item]));
      if (!res.success) throw new Error(res.error ?? 'registration failed');
      removePending(txid);
      invalidate();
      setReview(null);
      setProgress({ phase: 'done', txid });
      toast.success('Pool created', { description: `Funded and checked on chain · ${shortHex(txid)}` });
      const address = res.pools[0]!.address;
      onDone?.(address);
      return address;
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      toast.error(txid ? 'Funded, registration pending' : 'Transaction not sent', { description: txid ? `${msg}. Retry from My positions.` : msg });
      setError(msg);
      setProgress({ phase: txid ? 'listing' : 'signing', failed: { phase: txid ? 'listing' : 'signing', message: msg }, txid: txid ?? undefined });
      return null;
    } finally { setBusy(null); }
  }

  return {
    contract, preview, previewOk, validation, review, openReview,
    closeReview: () => { if (!busy) { setReview(null); setProgress({ phase: 'review' }); } },
    confirm, busy, error, progress,
  };
}
