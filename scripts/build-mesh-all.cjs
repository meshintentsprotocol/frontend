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
  console.log('✓ Successfully wrote ' + relPath);
}

// 1. meshApi.ts
writeFile('src/lib/meshApi.ts', `
export interface MeshStats {
  bchUsd: number;
  tvlSats: string;
  volume24hSats: string;
  fees24hSats: string;
  poolCount: number;
  strategyCount: number;
  activeIntentsCount: number;
}

export interface MeshPool {
  address: string;
  reserve: string;
  reserveSymbol: string;
  targetToken: string;
  targetSymbol: string;
  tvlSats: number;
  tvlUsd: number;
  volume24hUsd: number;
  feeBps: number;
  apyPct: number;
  status: 'optimal' | 'rebalancing' | 'active';
  mode: 'mirror' | 'dock';
  priceTokensPerBch: number;
}

export interface StrategyArchetype {
  id: string;
  name: string;
  category: 'Range' | 'Market making' | 'Limit' | 'Directional' | 'Stable' | 'Multi-asset';
  summary: string;
  deposit: string;
  earns: string;
  risk: string;
  recycles: boolean;
  estApy: string;
}

export const ARCHETYPES: StrategyArchetype[] = [
  {
    id: 'recycling-pair',
    name: 'Recycling Pair',
    category: 'Range',
    summary: 'Autonomous buy-low, sell-high loop. Filled orders immediately fund reverse mirror covenant pools.',
    deposit: 'BCH or CashTokens',
    earns: 'Spread + Pool fee on every round-trip cycle',
    risk: 'Low to Moderate',
    recycles: true,
    estApy: '28.4%',
  },
  {
    id: 'grid',
    name: 'Multi-Rung Grid',
    category: 'Range',
    summary: '2 to 10 laddered rungs across a custom price range with automated cross-rung recycling.',
    deposit: 'BCH',
    earns: 'Accumulates spread across price oscillations',
    risk: 'Moderate',
    recycles: true,
    estApy: '34.2%',
  },
  {
    id: 'spread',
    name: 'Spread Market Maker',
    category: 'Market making',
    summary: 'Quotes a simultaneous bid below and ask above the market mid to capture two-sided flow.',
    deposit: 'BCH and CashTokens',
    earns: 'The full bid-ask spread plus trading fees',
    risk: 'Moderate',
    recycles: true,
    estApy: '22.8%',
  },
  {
    id: 'stable-pair',
    name: 'Stable Peg Anchor',
    category: 'Stable',
    summary: 'Concentrated liquidity around a 1:1 or pegged ratio with minimal spread and near-zero IL.',
    deposit: 'Either or both tokens',
    earns: 'High-volume swap fees between pegged assets',
    risk: 'Minimal',
    recycles: false,
    estApy: '14.6%',
  },
  {
    id: 'multi-pair',
    name: 'Multi-Pair BCH Indexer',
    category: 'Multi-asset',
    summary: 'One BCH reserve quotes buy bids for 2 to 3 CashTokens simultaneously from the same balance.',
    deposit: 'BCH once',
    earns: 'Captures volatility across multiple token pairs',
    risk: 'Moderate',
    recycles: false,
    estApy: '26.1%',
  },
  {
    id: 'accumulate',
    name: 'Accumulate Ladder',
    category: 'Directional',
    summary: 'Executes laddered DCA buys into a CashToken as price dips, saving slippage vs market orders.',
    deposit: 'BCH',
    earns: 'Lower cost-basis on entry + maker fee capture',
    risk: 'Directional (Asset exposure)',
    recycles: false,
    estApy: '18.5%',
  },
  {
    id: 'take-profit',
    name: 'Take-Profit Ladder',
    category: 'Directional',
    summary: 'Automated laddered token exit as price ascends, securing BCH at favorable steps.',
    deposit: 'CashTokens',
    earns: 'Disciplined profit realization in BCH',
    risk: 'Directional (Token exit)',
    recycles: false,
    estApy: '19.2%',
  },
  {
    id: 'fixed',
    name: 'Fixed Price Limit Order',
    category: 'Limit',
    summary: 'Sovereign on-chain limit order at an exact price with zero custodian counterparty risk.',
    deposit: 'BCH or CashTokens',
    earns: 'Exact execution at your targeted limit level',
    risk: 'Low',
    recycles: false,
    estApy: '12.0%',
  },
];

export const MOCK_POOLS: MeshPool[] = [
  {
    address: 'bchtest:qp3wjpa...89f1',
    reserve: '0x',
    reserveSymbol: 'BCH',
    targetToken: 'pusd',
    targetSymbol: 'pUSD',
    tvlSats: 48200000000,
    tvlUsd: 172400,
    volume24hUsd: 58200,
    feeBps: 30,
    apyPct: 24.8,
    status: 'optimal',
    mode: 'mirror',
    priceTokensPerBch: 357.25,
  },
  {
    address: 'bchtest:qz7vlkp...42c8',
    reserve: '0x',
    reserveSymbol: 'BCH',
    targetToken: 'musd',
    targetSymbol: 'mUSD',
    tvlSats: 29500000000,
    tvlUsd: 105600,
    volume24hUsd: 31400,
    feeBps: 30,
    apyPct: 21.2,
    status: 'optimal',
    mode: 'mirror',
    priceTokensPerBch: 358.10,
  },
  {
    address: 'bchtest:qr9kmzq...17e3',
    reserve: 'pusd',
    reserveSymbol: 'pUSD',
    targetToken: 'musd',
    targetSymbol: 'mUSD',
    tvlSats: 62000000000,
    tvlUsd: 221800,
    volume24hUsd: 94100,
    feeBps: 5,
    apyPct: 15.4,
    status: 'optimal',
    mode: 'mirror',
    priceTokensPerBch: 1.002,
  },
  {
    address: 'bchtest:qp5xxam...93b4',
    reserve: '0x',
    reserveSymbol: 'BCH',
    targetToken: 'mesh',
    targetSymbol: 'MESH',
    tvlSats: 18400000000,
    tvlUsd: 65800,
    volume24hUsd: 18900,
    feeBps: 50,
    apyPct: 38.6,
    status: 'rebalancing',
    mode: 'mirror',
    priceTokensPerBch: 1240.0,
  },
];
`);

// 2. MeshAppContext.tsx
writeFile('src/context/MeshAppContext.tsx', `
import React, { createContext, useContext, useState, useEffect } from 'react';
import { MOCK_POOLS, type MeshPool } from '@/lib/meshApi';

export type AppSubTab = 'pools' | 'liquidity' | 'strategies' | 'portfolio' | 'intents' | 'inspector';

export interface PositionItem {
  id: string;
  name: string;
  template: string;
  pair: string;
  depositBch: number;
  depositTokens: number;
  tokenSymbol: string;
  valueUsd: number;
  pnlUsd: number;
  feesEarnedSats: number;
  status: 'optimal' | 'rebalancing' | 'out-of-range';
  minPrice: number;
  maxPrice: number;
  currentPrice: number;
  recyclesCount: number;
  createdAt: number;
}

interface MeshAppContextType {
  subTab: AppSubTab;
  setSubTab: (t: AppSubTab) => void;
  isDemoMode: boolean;
  toggleDemoMode: () => void;
  walletConnected: boolean;
  walletAddress: string | null;
  connectWallet: (type?: string) => void;
  disconnectWallet: () => void;
  bchBalance: number;
  tokenBalances: Record<string, number>;
  positions: PositionItem[];
  addPosition: (pos: Omit<PositionItem, 'id' | 'createdAt' | 'recyclesCount' | 'feesEarnedSats' | 'pnlUsd'>) => void;
  dockPosition: (id: string) => void;
  claimFees: (id: string) => void;
  selectedPool: MeshPool | null;
  setSelectedPool: (p: MeshPool | null) => void;
  selectedTemplate: string | null;
  setSelectedTemplate: (t: string | null) => void;
  network: 'chipnet' | 'mainnet' | 'demo';
  setNetwork: (n: 'chipnet' | 'mainnet' | 'demo') => void;
}

const MeshAppContext = createContext<MeshAppContextType | undefined>(undefined);

export function MeshAppProvider({ children }: { children: React.ReactNode }) {
  const [subTab, setSubTab] = useState<AppSubTab>('pools');
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true);
  const [network, setNetwork] = useState<'chipnet' | 'mainnet' | 'demo'>('chipnet');
  const [walletConnected, setWalletConnected] = useState<boolean>(true);
  const [walletAddress, setWalletAddress] = useState<string | null>('bchtest:qp8z4demo...72a9');

  const [bchBalance, setBchBalance] = useState<number>(12.50);
  const [tokenBalances, setTokenBalances] = useState<Record<string, number>>({
    pUSD: 45000,
    mUSD: 12000,
    MESH: 3250,
  });

  const [selectedPool, setSelectedPool] = useState<MeshPool | null>(MOCK_POOLS[0]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>('recycling-pair');

  const [positions, setPositions] = useState<PositionItem[]>([
    {
      id: 'stg-alpha-01',
      name: 'BCH/pUSD High Yield Recycler',
      template: 'recycling-pair',
      pair: 'BCH / pUSD',
      depositBch: 2.50,
      depositTokens: 893.12,
      tokenSymbol: 'pUSD',
      valueUsd: 1786.25,
      pnlUsd: 64.30,
      feesEarnedSats: 14200,
      status: 'optimal',
      minPrice: 345.0,
      maxPrice: 370.0,
      currentPrice: 357.25,
      recyclesCount: 18,
      createdAt: Date.now() - 86400000 * 3,
    },
    {
      id: 'stg-alpha-02',
      name: 'pUSD/mUSD Stable Anchor',
      template: 'stable-pair',
      pair: 'pUSD / mUSD',
      depositBch: 0.10,
      depositTokens: 5000,
      tokenSymbol: 'mUSD',
      valueUsd: 5035.0,
      pnlUsd: 28.50,
      feesEarnedSats: 7900,
      status: 'optimal',
      minPrice: 0.996,
      maxPrice: 1.004,
      currentPrice: 1.002,
      recyclesCount: 42,
      createdAt: Date.now() - 86400000 * 7,
    },
    {
      id: 'stg-alpha-03',
      name: 'BCH/MESH Volatility Harvester',
      template: 'grid',
      pair: 'BCH / MESH',
      depositBch: 1.80,
      depositTokens: 2232,
      tokenSymbol: 'MESH',
      valueUsd: 1286.0,
      pnlUsd: 91.20,
      feesEarnedSats: 25400,
      status: 'rebalancing',
      minPrice: 1180.0,
      maxPrice: 1320.0,
      currentPrice: 1240.0,
      recyclesCount: 9,
      createdAt: Date.now() - 86400000 * 1,
    },
  ]);

  useEffect(() => {
    if (!isDemoMode) return;
    const interval = setInterval(() => {
      setPositions(prev =>
        prev.map(p => ({
          ...p,
          feesEarnedSats: p.feesEarnedSats + Math.floor(Math.random() * 80 + 20),
          pnlUsd: +(p.pnlUsd + Math.random() * 0.15).toFixed(2),
        }))
      );
    }, 10000);
    return () => clearInterval(interval);
  }, [isDemoMode]);

  const toggleDemoMode = () => setIsDemoMode(v => !v);
  const connectWallet = () => {
    setWalletConnected(true);
    setWalletAddress('bchtest:qp8z4demo...72a9');
  };
  const disconnectWallet = () => {
    setWalletConnected(false);
    setWalletAddress(null);
  };

  const addPosition = (pos: Omit<PositionItem, 'id' | 'createdAt' | 'recyclesCount' | 'feesEarnedSats' | 'pnlUsd'>) => {
    const newPos: PositionItem = {
      ...pos,
      id: 'stg-' + Math.random().toString(36).substring(2, 9),
      recyclesCount: 0,
      feesEarnedSats: 0,
      pnlUsd: 0,
      createdAt: Date.now(),
    };
    setPositions(prev => [newPos, ...prev]);
    setBchBalance(b => Math.max(0, +(b - pos.depositBch).toFixed(4)));
    if (pos.depositTokens > 0) {
      setTokenBalances(tb => ({
        ...tb,
        [pos.tokenSymbol]: Math.max(0, +((tb[pos.tokenSymbol] ?? 0) - pos.depositTokens).toFixed(2)),
      }));
    }
  };

  const dockPosition = (id: string) => {
    const pos = positions.find(p => p.id === id);
    if (pos) {
      setBchBalance(b => +(b + pos.depositBch).toFixed(4));
      setPositions(prev => prev.filter(p => p.id !== id));
    }
  };

  const claimFees = (id: string) => {
    setPositions(prev =>
      prev.map(p => {
        if (p.id === id) {
          const sats = p.feesEarnedSats;
          setBchBalance(b => +(b + sats / 1e8).toFixed(6));
          return { ...p, feesEarnedSats: 0 };
        }
        return p;
      })
    );
  };

  return (
    <MeshAppContext.Provider
      value={{
        subTab,
        setSubTab,
        isDemoMode,
        toggleDemoMode,
        walletConnected,
        walletAddress,
        connectWallet,
        disconnectWallet,
        bchBalance,
        tokenBalances,
        positions,
        addPosition,
        dockPosition,
        claimFees,
        selectedPool,
        setSelectedPool,
        selectedTemplate,
        setSelectedTemplate,
        network,
        setNetwork,
      }}
    >
      {children}
    </MeshAppContext.Provider>
  );
}

export function useMeshApp() {
  const ctx = useContext(MeshAppContext);
  if (!ctx) throw new Error('useMeshApp must be used within MeshAppProvider');
  return ctx;
}
`);

// 3. MeshWalletModal.tsx
writeFile('src/components/app/MeshWalletModal.tsx', `
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
          <button onClick={onClose} className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer">
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
              className="w-full py-2.5 rounded-xl border border-rose-500/40 text-rose-300 hover:bg-rose-950/20 text-xs font-semibold cursor-pointer"
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
                className="w-full p-3 rounded-2xl border border-neutral-800 hover:border-neutral-600 bg-neutral-900/60 hover:bg-neutral-900 transition-all flex items-center justify-between group text-left cursor-pointer"
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
`);

console.log('✓ All core support files written cleanly.');
