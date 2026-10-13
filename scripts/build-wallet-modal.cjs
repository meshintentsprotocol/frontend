const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../../meshprotocol');

function writeFile(relPath, content) {
  const fullPath = path.join(rootDir, relPath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, content.trim() + '\n', 'utf8');
  console.log('Generated: ' + relPath);
}

// -----------------------------------------------------------------------------
// 1. MeshWalletModal.tsx
// -----------------------------------------------------------------------------
const walletModal = `
import React from 'react';
import { useMeshApp } from '@/context/MeshAppContext';
import { CornerCrosshair } from '@/components/common/MeshWireframeBox';
import { Wallet, ShieldCheck, CheckCircle2, X, ExternalLink, Zap } from 'lucide-react';

export function MeshWalletModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { connectWallet, walletConnected, walletAddress, disconnectWallet } = useMeshApp();

  if (!open) return null;

  const WALLETS = [
    { id: 'cham', name: 'Cham Wallet', desc: 'Native CashTokens & Intent Swarm Web3 Extension', popular: true, icon: '🦎' },
    { id: 'cashonize', name: 'Cashonize', desc: 'Popular open-source web wallet for BCH & tokens', popular: false, icon: '🪙' },
    { id: 'paytaca', name: 'Paytaca', desc: 'Mobile-first BCH CashTokens wallet with WalletConnect', popular: false, icon: '📱' },
    { id: 'electron', name: 'Electron Cash', desc: 'Hardware wallet & multisig desktop integration', popular: false, icon: '⚡' },
    { id: 'demo', name: 'Interactive Demo Wallet', desc: 'Pre-loaded 12.50 BCH & 45k pUSD simulation sandbox', popular: true, icon: '🧪' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in-50">
      <div className="relative w-full max-w-md bg-[#0e0e12] border border-neutral-800 rounded-3xl p-6 text-neutral-100 shadow-2xl">
        <CornerCrosshair className="-left-2 -top-2" />
        <CornerCrosshair className="-right-2 -top-2" />
        <CornerCrosshair className="-left-2 -bottom-2" />
        <CornerCrosshair className="-right-2 -bottom-2" />

        <div className="flex items-center justify-between pb-4 border-b border-neutral-800 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-neutral-900 border border-neutral-700 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Connect BCH Wallet</h3>
              <p className="text-[11px] text-neutral-400 font-mono">Mesh Finance V3 · Sovereign Web3</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {walletConnected ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-neutral-900/90 border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">Status</span>
                <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                </span>
              </div>
              <div className="font-mono text-xs text-white truncate bg-black/40 p-2 rounded-lg border border-neutral-800">
                {walletAddress}
              </div>
            </div>
            <button
              onClick={() => { disconnectWallet(); onClose(); }}
              className="w-full py-2.5 rounded-xl border border-rose-500/40 text-rose-300 hover:bg-rose-950/20 text-xs font-semibold"
            >
              Disconnect Wallet
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {WALLETS.map(w => (
              <button
                key={w.id}
                onClick={() => { connectWallet(w.name); onClose(); }}
                className="w-full p-3 rounded-2xl border border-neutral-800 hover:border-neutral-600 bg-neutral-900/60 hover:bg-neutral-900 transition-all flex items-center justify-between group text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{w.icon}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">{w.name}</span>
                      {w.popular && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-neutral-400">{w.desc}</p>
                  </div>
                </div>
                <Zap className="w-3.5 h-3.5 text-neutral-500 group-hover:text-emerald-400 transition-colors" />
              </button>
            ))}
          </div>
        )}

        <div className="mt-5 pt-3 border-t border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-500">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Non-Custodial Protocol
          </span>
          <a href="/docs" target="_blank" className="hover:text-neutral-300 flex items-center gap-1">
            Documentation <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
`;

writeFile('src/components/app/MeshWalletModal.tsx', walletModal);
console.log('Wallet modal created.');
`;

writeFile('scripts/build-wallet-modal.cjs', walletModal);
