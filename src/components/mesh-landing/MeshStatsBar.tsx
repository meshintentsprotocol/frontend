import {
  Activity,
  Layers,
  Zap,
  Clock,
  Shield,
  Coins,
  Cpu,
  BarChart2,
} from 'lucide-react';
import { useMeshHealth, useMeshStats } from '@/hooks/useMesh';

interface TickerItem {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}

const TICKER_ITEMS = (stats: {
  tvl: string;
  activePools: number | string;
  totalVolume: string;
  avgLatency: string;
  feeRange: string;
  settlement: string;
  modelType: string;
}): TickerItem[] => [
    { icon: <Activity className="w-3.5 h-3.5 text-emerald-400" />, label: 'Active TVL', value: stats.tvl, accent: 'text-emerald-400' },
    { icon: <Layers className="w-3.5 h-3.5 text-cyan-400" />, label: 'Mesh Pools', value: String(stats.activePools), accent: 'text-cyan-400' },
    { icon: <Zap className="w-3.5 h-3.5 text-amber-400" />, label: 'Volume (24h)', value: stats.totalVolume, accent: 'text-amber-400' },
    { icon: <Clock className="w-3.5 h-3.5 text-emerald-400" />, label: 'Avg Settlement', value: stats.avgLatency, accent: 'text-emerald-400' },
    { icon: <Coins className="w-3.5 h-3.5 text-violet-400" />, label: 'Fee Tiers', value: stats.feeRange, accent: 'text-violet-400' },
    { icon: <Cpu className="w-3.5 h-3.5 text-cyan-400" />, label: 'Covenant Engine', value: stats.modelType, accent: 'text-cyan-400' },
    { icon: <Shield className="w-3.5 h-3.5 text-emerald-400" />, label: 'Settlement L1', value: stats.settlement, accent: 'text-emerald-400' },
    { icon: <BarChart2 className="w-3.5 h-3.5 text-teal-400" />, label: 'Rebalance Gas', value: '< $0.01 / fill', accent: 'text-teal-400' },
  ];

export function MeshStatsBar() {
  const health = useMeshHealth();
  const { data } = useMeshStats();

  const stats = {
    tvl: data?.totalTvlBch != null ? `${data.totalTvlBch.toFixed(1)} BCH` : '—',
    activePools: data?.activePoolCount ?? '—',
    totalVolume: data?.volume24hBch != null ? `${data.volume24hBch.toFixed(1)} BCH` : '—',
    avgLatency: data?.avgFillLatencySec != null ? `${data.avgFillLatencySec}s` : '—',
    feeRange: '1–1000 bps (DLMM & V3)',
    settlement: health.data ? `BCH ${health.data.network}` : '—',
    modelType: 'DLMM Bins + Proceeds-Separation',
  };

  const items = TICKER_ITEMS(stats);
  const doubled = [...items, ...items];

  return (
    <div className="relative overflow-hidden border-y border-white/5 bg-[#0a0a0f]">
      {/* Live badge */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 hidden sm:flex items-center gap-1.5 pr-4">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
        </span>
        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.15em]">Live Grid</span>
      </div>

      {/* Left fade */}
      <div className="absolute left-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-r from-[#0a0a0f] to-transparent pointer-events-none" />
      {/* Right fade */}
      <div className="absolute right-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-l from-[#0a0a0f] to-transparent pointer-events-none" />

      {/* Marquee track */}
      <div className="flex py-3.5 overflow-hidden">
        <div
          className="flex items-center gap-10 whitespace-nowrap"
          style={{
            animation: 'mesh-marquee 32s linear infinite',
          }}
        >
          {doubled.map((item, i) => (
            <div key={i} className="flex items-center gap-2 pl-2">
              {item.icon}
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">{item.label}:</span>
              <span className={`text-xs font-black font-mono ${item.accent}`}>{item.value}</span>
              <span className="ml-6 text-white/15 text-lg leading-none select-none">·</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes mesh-marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
