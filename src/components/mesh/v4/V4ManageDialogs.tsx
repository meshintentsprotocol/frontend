/**
 * Managing a V4 position from the wallet that holds its NFT:
 *   Withdraw: the server plans owner(k) spends of the chosen bins; the plan is
 *             verified against the position's bins rebuilt locally; the holder
 *             signs only the NFT input; the fee comes out of the bins.
 *   Transfer: the NFT (and with it the position) goes to another address.
 */
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Send, ShieldCheck, TriangleAlert, Wallet } from 'lucide-react';
import { binToHex } from '@bitauth/libauth';
import type { Utxo } from 'cashscript';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { meshApi, useInvalidateMesh, useMeshSigner } from '@/hooks/useMesh';
import { formatSatsCompact, formatUnits, shortHex } from '@/lib/mesh/format';
import { lockingBytecodeOf, sendPoolTx, type BuiltTx } from '@/lib/mesh/poolTx';
import { normCategory } from '@/lib/mesh/pool';
import { paramsOfView, verifyWithdrawPlan } from '@/lib/mesh/v4/verify';
import { buildTransferV4, buildWithdrawV4 } from '@/lib/mesh/v4/v4Tx';
import type { V4PositionView, V4WithdrawPlan } from '@/lib/mesh/v4/types';
import { cn } from '@/lib/utils';

interface Common { open: boolean; onOpenChange: (o: boolean) => void; view: V4PositionView; symbol: string; decimals: number; onDone?: () => void }

export function WithdrawV4Dialog({ open, onOpenChange, view, symbol, decimals, onDone }: Common) {
  const wallet = useMeshSigner();
  const invalidate = useInvalidateMesh();
  const funded = useMemo(() => view.bins.filter(b => b.utxos.length > 0), [view]);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [prepared, setPrepared] = useState<{ plan: V4WithdrawPlan; built: BuiltTx } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (open) { setChosen(new Set(funded.map(b => b.index))); setPrepared(null); setError(null); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = funded.filter(b => chosen.has(b.index));
  const sats = pick.reduce((a, b) => a + BigInt(b.sats), 0n);
  const tokens = pick.reduce((a, b) => a + BigInt(b.tokens), 0n);
  const all = pick.length === funded.length;

  async function prepare() {
    if (!wallet.signer) return;
    setError(null); setPrepared(null);
    setBusy('Planning the withdrawal…');
    try {
      const plan = await meshApi.v4WithdrawPlan(view.category, { holder: wallet.signer.tokenAddress, ...(all ? {} : { bins: pick.map(b => b.index) }) });
      verifyWithdrawPlan(plan, paramsOfView(view), { category: view.category, holderLock: binToHex(wallet.signer.lockingBytecode) });
      setPrepared({ plan, built: buildWithdrawV4(wallet.signer, plan) });
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally { setBusy(null); }
  }

  async function confirm() {
    if (!prepared || !wallet.signer) return;
    setBusy(wallet.kind === 'external' ? 'Approve in your wallet…' : 'Signing and broadcasting…');
    try {
      const txid = await sendPoolTx(wallet.signer, prepared.built, `Mesh V4: withdraw ${prepared.plan.inputs.length - 1} bin(s) of position ${shortHex(view.category)}`);
      toast.success('Withdrawn', { description: `${formatSatsCompact(prepared.plan.outputs.find(o => o.role === 'bch')?.valueSatoshis ?? '0')} + ${formatUnits(tokens, decimals)} ${symbol} to your wallet · ${shortHex(txid)}` });
      invalidate();
      onOpenChange(false);
      onDone?.();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally { setBusy(null); }
  }

  const out = prepared?.plan.outputs;
  return (
    <Dialog open={open} onOpenChange={o => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Withdraw from the position</DialogTitle>
          <DialogDescription>The bins pay out to this wallet. The NFT stays with you, so the position remains yours (empty bins can be funded again).</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">{pick.length} of {funded.length} funded bins</span>
            <button type="button" className="text-emerald-400 hover:underline text-[11px] font-semibold" onClick={() => { setChosen(new Set(all ? [] : funded.map(b => b.index))); setPrepared(null); }}>
              {all ? 'Clear' : 'Select all'}
            </button>
          </div>
          <div className="max-h-48 overflow-auto rounded-xl border border-white/[0.06] divide-y divide-white/[0.04]">
            {funded.map(b => (
              <label key={b.index} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-white/[0.02]">
                <input type="checkbox" checked={chosen.has(b.index)} onChange={e => { const n = new Set(chosen); if (e.target.checked) n.add(b.index); else n.delete(b.index); setChosen(n); setPrepared(null); }} />
                <span className="font-mono text-zinc-300 w-10">#{b.index}</span>
                <span className="font-mono text-zinc-400 flex-1 text-right">{formatSatsCompact(b.sats)}{BigInt(b.tokens) > 0n ? ` + ${formatUnits(b.tokens, decimals)} ${symbol}` : ''}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-between font-mono text-zinc-300 px-1"><span>Selected</span><span>{formatSatsCompact(sats)}{tokens > 0n ? ` + ${formatUnits(tokens, decimals)} ${symbol}` : ''}</span></div>

          {prepared && out && (
            <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-800/40 space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold"><ShieldCheck className="w-4 h-4" />Checked against the position's bins</div>
              <div className="flex justify-between font-mono"><span className="text-zinc-400">You receive</span><span className="text-white">{formatSatsCompact(out.find(o => o.role === 'bch')!.valueSatoshis)}{out.find(o => o.role === 'tokens') ? ` + ${formatUnits(out.find(o => o.role === 'tokens')!.token!.amount, decimals)} ${symbol}` : ''}</span></div>
              <div className="flex justify-between font-mono"><span className="text-zinc-400">Network fee (from the bins)</span><span className="text-white">{prepared.built.fee.toString()} sats</span></div>
              <div className="flex justify-between font-mono"><span className="text-zinc-400">NFT</span><span className="text-white">comes back to you unchanged</span></div>
            </div>
          )}

          {error && <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-200 flex gap-2"><TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span></div>}

          {!prepared ? (
            <Button className="w-full h-11 rounded-xl font-bold" disabled={!pick.length || !!busy || !wallet.signer} onClick={prepare}>
              {busy ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />{busy}</> : <><Wallet className="w-4 h-4 mr-2" />Prepare withdrawal</>}
            </Button>
          ) : (
            <Button className="w-full h-11 rounded-xl font-bold bg-white text-neutral-900 hover:bg-neutral-200" disabled={!!busy} onClick={confirm}>
              {busy ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />{busy}</> : 'Sign and withdraw'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** A P2PKH (or P2PKH-with-tokens) address: the only kind a position NFT is sent to from here. */
function p2pkhLock(address: string): Uint8Array | null {
  try {
    const b = lockingBytecodeOf(address.trim());
    return b.length === 25 && b[0] === 0x76 && b[1] === 0xa9 && b[2] === 0x14 && b[23] === 0x88 && b[24] === 0xac ? b : null;
  } catch { return null; }
}

export function TransferV4Dialog({ open, onOpenChange, view, onDone }: Common) {
  const wallet = useMeshSigner();
  const invalidate = useInvalidateMesh();
  const [to, setTo] = useState('');
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setTo(''); setAck(false); setError(null); } }, [open]);

  const lock = p2pkhLock(to);
  const self = lock && wallet.signer ? binToHex(lock) === binToHex(wallet.signer.lockingBytecode) : false;
  const problem = !to.trim() ? null : !lock ? 'Enter a wallet address (cashaddr, P2PKH). Contract addresses could lock the NFT for good.' : self ? 'That is this wallet.' : null;

  async function send() {
    if (!wallet.signer || !lock) return;
    setError(null);
    setBusy('Finding the NFT…');
    try {
      const nft: Utxo | undefined = (await wallet.signer.getUtxos()).find(u => u.token?.nft && normCategory(u.token.category) === view.category);
      if (!nft) throw new Error('This wallet does not hold the position NFT');
      setBusy('Building…');
      const built = await buildTransferV4(wallet.signer, nft, to.trim());
      setBusy(wallet.kind === 'external' ? 'Approve in your wallet…' : 'Signing and broadcasting…');
      const txid = await sendPoolTx(wallet.signer, built, `Mesh V4: send position ${shortHex(view.category)} (its NFT) to ${shortHex(to.trim(), 12, 6)}`);
      toast.success('Position sent', { description: `The NFT is now held by ${shortHex(to.trim(), 12, 6)} · ${shortHex(txid)}` });
      invalidate();
      onOpenChange(false);
      onDone?.();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally { setBusy(null); }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send the position</DialogTitle>
          <DialogDescription>The position is its NFT. Whoever receives it controls every bin: they can withdraw everything, and you no longer can.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-xs">
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex justify-between font-mono">
            <span className="text-zinc-400">Value at the bins' bids</span>
            <span className="text-white">{formatSatsCompact(view.totals.valueAtBidSats)}</span>
          </div>
          <Input value={to} onChange={e => setTo(e.target.value)} placeholder="bitcoincash:z… or bchtest:z…" className={cn('font-mono text-xs', problem && 'border-amber-500/50')} aria-label="Recipient address" />
          {problem && <p className="text-[11px] text-amber-300">{problem}</p>}
          <label className="flex items-start gap-2 text-[11px] text-zinc-300 cursor-pointer">
            <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} className="mt-0.5" />
            I understand that the position and everything in its bins go with the NFT.
          </label>
          {error && <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-200 flex gap-2"><TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span></div>}
          <Button className="w-full h-11 rounded-xl font-bold bg-white text-neutral-900 hover:bg-neutral-200" disabled={!lock || self || !ack || !!busy || !wallet.signer} onClick={send}>
            {busy ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />{busy}</> : <><Send className="w-4 h-4 mr-2" />Send the NFT</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
