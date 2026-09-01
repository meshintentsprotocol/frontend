import React, { useState } from 'react';
import {
  Copy,
  Check,
  ExternalLink,
  Layers,
  Sparkles,
  ShieldCheck,
  Globe,
} from 'lucide-react';
import { type MeshPosition } from '@/hooks/useMeshServer';
import { tokenSymbol, getTokenMetadata } from '@/lib/meshContracts';
import { notifyToast as toast } from '@/lib/notify-toast';
import { cn } from '@/lib/utils';

interface MeshPoolLinksCardProps {
  position: MeshPosition;
}

export function MeshPoolLinksCard({ position }: MeshPoolLinksCardProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const tokenOutName = tokenSymbol(position.tokenCategoryOut);
  const baseMeta = getTokenMetadata('BCH');
  const quoteMeta = getTokenMetadata(tokenOutName);

  const pairLabel = `BCH / ${tokenOutName}`;
  const addressShort = `${position.address.slice(0, 6)}...${position.address.slice(-4)}`;
  const quoteIdShort =
    position.tokenCategoryOut && position.tokenCategoryOut !== '0x'
      ? `${position.tokenCategoryOut.slice(0, 6)}...${position.tokenCategoryOut.slice(-4)}`
      : 'Native UTXO';

  const copyToClipboard = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`Copied ${label} to clipboard`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="p-6 bg-[#0c0c10] border border-white/[0.08] rounded-3xl space-y-4 shadow-2xl backdrop-blur-xl">
      <h3 className="text-base font-bold text-white tracking-tight">Links</h3>

      <div className="space-y-2.5">
        {/* Link 1: Pair Covenant Address */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Dual mini token circle */}
            <div className="flex -space-x-1 shrink-0">
              <img
                src={baseMeta.icon || '/logos/bitcoin-cash-bch-logo.svg'}
                alt="BCH"
                className="w-4 h-4 rounded-full border border-black"
              />
              <div className="w-4 h-4 rounded-full bg-cyan-500/30 border border-black flex items-center justify-center text-[7px] font-bold text-cyan-300">
                {tokenOutName.slice(0, 1)}
              </div>
            </div>
            <span className="text-xs font-bold text-white truncate">{pairLabel}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
            <button
              onClick={() => copyToClipboard(position.address, 'pair', 'Pair address')}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white flex items-center gap-1.5 transition-all text-[11px]"
            >
              <span>{addressShort}</span>
              {copiedKey === 'pair' ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3 text-zinc-500" />
              )}
            </button>
            <a
              href={`https://chipnet.chaingraph.cash/address/${position.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              title="View on Chaingraph Explorer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Link 2: Base Token (BCH) */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={baseMeta.icon || '/logos/bitcoin-cash-bch-logo.svg'}
              alt="BCH"
              className="w-4 h-4 rounded-full"
            />
            <span className="text-xs font-bold text-white">BCH (Bitcoin Cash)</span>
          </div>

          <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
            <span className="text-[11px] text-zinc-500 font-sans">Layer-1 Base</span>
            <a
              href="https://bitcoincash.org"
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              title="Bitcoin Cash protocol"
            >
              <Globe className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Link 3: Quote Token (CashToken) */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-4 h-4 rounded-full bg-cyan-500/20 flex items-center justify-center text-[8px] font-bold text-cyan-300">
              {tokenOutName.slice(0, 1)}
            </div>
            <span className="text-xs font-bold text-white truncate">{tokenOutName}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
            {position.tokenCategoryOut && position.tokenCategoryOut !== '0x' ? (
              <>
                <button
                  onClick={() =>
                    copyToClipboard(
                      position.tokenCategoryOut,
                      'quote',
                      `${tokenOutName} Category ID`
                    )
                  }
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white flex items-center gap-1.5 transition-all text-[11px]"
                >
                  <span>{quoteIdShort}</span>
                  {copiedKey === 'quote' ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-zinc-500" />
                  )}
                </button>
                <a
                  href={`https://chipnet.chaingraph.cash/tx/${position.tokenCategoryOut}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                  title="View CashToken Category on Explorer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </>
            ) : (
              <span className="text-[11px] text-zinc-500">Native Asset</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MeshPoolLinksCard;
