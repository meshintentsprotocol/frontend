import { useEffect, useState } from 'react';
import { Activity, Clock, Zap, Database, TrendingUp } from 'lucide-react';

interface MeshStats {
  activePools: number;
  totalFills: number;
  avgLatency: string;
  feeRange: string;
  settlement: string;
}

const MOCK_STATS: MeshStats = {
  activePools: 12,
  totalFills: 3847,
  avgLatency: '< 30 sec',
  feeRange: '10–100 bps',
  settlement: 'BCH Mainnet + Chipnet',
};

const TICKER_ITEMS = (stats: MeshStats) => [
  { icon: <Database className="w-3.5 h-3.5 text-emerald-400 shrink-0" />, label: 'Active Covenant Pools', value: stats.activePools.toString(), accent: 'text-emerald-400' },
  { icon: <Zap className="w-3.5 h-3.5 text-teal-400 shrink-0" />, label: 'Protocol Fills', value: stats.totalFills.toLocaleString(), accent: 'text-teal-400' },
  { icon: <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />, label: 'Avg Fill Latency', value: stats.avgLatency, accent: 'text-cyan-400' },
  { icon: <TrendingUp className="w-3.5 h-3.5 text-emerald-300 shrink-0" />, label: 'LP Fee Capture', value: stats.feeRange, accent: 'text-emerald-300' },
  { icon: <Activity className="w-3.5 h-3.5 text-teal-300 shrink-0" />, label: 'Settlement', value: stats.settlement, accent: 'text-teal-300' },
];

export function MeshStatsBar() {
  const [stats, setStats] = useState<MeshStats>(MOCK_STATS);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/v1/stats', { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const data = await res.json();
          setStats({
            activePools: data.activePools ?? MOCK_STATS.activePools,
            totalFills: data.totalFills ?? MOCK_STATS.totalFills,
            avgLatency: data.avgLatency ?? MOCK_STATS.avgLatency,
            feeRange: MOCK_STATS.feeRange,
            settlement: MOCK_STATS.settlement,
          });
        }
      } catch {
        // Silently fall back to mock data
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 15_000);
    return () => clearInterval(interval);
  }, []);

  const items = TICKER_ITEMS(stats);
  // Duplicate for seamless loop
  const doubled = [...items, ...items];

  return (
    <div className="relative overflow-hidden border-y border-white/5 bg-[#070709]">
      {/* Emerald glow strip top */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />

      {/* Live badge */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 hidden sm:flex items-center gap-1.5 pr-4">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
        </span>
        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.15em]">Live</span>
      </div>

      {/* Left fade */}
      <div className="absolute left-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-r from-[#070709] to-transparent pointer-events-none" />
      {/* Right fade */}
      <div className="absolute right-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-l from-[#070709] to-transparent pointer-events-none" />

      {/* Marquee track */}
      <div className="flex py-3 overflow-hidden">
        <div
          className="flex items-center gap-10 whitespace-nowrap"
          style={{
            animation: 'mesh-marquee 32s linear infinite',
          }}
        >
          {doubled.map((item, i) => (
            <div key={i} className="flex items-center gap-2 pl-2">
              {item.icon}
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">{item.label}:</span>
              <span className={`text-xs font-black font-mono ${item.accent}`}>{item.value}</span>
              {/* Divider dot */}
              <span className="ml-6 text-white/10 text-lg leading-none select-none">·</span>
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
