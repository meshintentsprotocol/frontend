import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Copy,
  Check,
  ExternalLink,
  Layers,
  Sparkles,
  ShieldCheck,
  Globe,
  ArrowRightLeft,
  Share2,
  TrendingUp,
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

  // Linked Shared Multi-Market Routes
  const sharedRoutes = [
    {
      symbol: 'pUSD',
      name: 'Pegged USD',
      catId: 'dfe50223c8d5cba8dcef8dff6d92b61deb88a8ba44947367f2b746487b56039b',
      spread: '+0.00%',
      active: tokenOutName === 'pUSD',
    },
    {
      symbol: 'mUSD',
      name: 'Mesh USD',
      catId: '900224217ff7510b642ec3a42eb651c6e1d528eb38e9c933923c6c0e862c954e',
      spread: '+0.30%',
      active: tokenOutName === 'mUSD',
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      catId: 'c74f5192070f80bc247c4deffc6c74d61998471b69335ef00ffc7e96b9ef2825',
      spread: '+0.50%',
      active: tokenOutName === 'USDT',
    },
  ];

  return (
    <div className="p-6 bg-[#0c0c10] border border-white/[0.08] rounded-3xl space-y-6 shadow-2xl backdrop-blur-xl">
      <div className="space-y-4">
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
                    href={`https://chipnet.chaingraph.cash/token/${position.tokenCategoryOut}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                    title="View Token on Explorer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </>
              ) : (
                <span className="text-[11px] text-zinc-500 font-sans">Pure Native BCH</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Mode 4: Shared Multi-Market Routes Sharing Unilateral Balance ─── */}
      <div className="space-y-3 pt-3 border-t border-white/5">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>Shared Multi-Market Pool Routes</span>
          </h4>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Mode 4 Shared
          </span>
        </div>
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          These pairs co-hedge and draw liquidity from the same unilateral BCH capital reserve with zero inventory fragmentation.
        </p>

        <div className="space-y-2">
          {sharedRoutes.map((rt) => (
            <div
              key={rt.symbol}
              className={cn(
                'p-2.5 rounded-xl border flex items-center justify-between text-xs transition-colors',
                rt.active
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-white'
                  : 'bg-white/[0.02] border-white/5 text-zinc-400 hover:border-white/15'
              )}
            >
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-[9px] flex items-center justify-center font-bold">
                  {rt.symbol.slice(0, 2)}
                </div>
                <div>
                  <div className="font-bold text-white">BCH / {rt.symbol}</div>
                  <div className="text-[10px] font-mono text-zinc-500">{rt.catId.slice(0, 8)}…{rt.catId.slice(-6)}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-emerald-400 text-[11px] font-bold">
                  {rt.spread}
                </span>
                {rt.active ? (
                  <span className="px-2 py-0.5 rounded bg-emerald-400/20 text-emerald-300 font-mono text-[9px] font-bold">
                    Active View
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-zinc-500">Co-Hedged</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default MeshPoolLinksCard;
