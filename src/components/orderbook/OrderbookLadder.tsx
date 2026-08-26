import React, { useState, useEffect } from 'react';
import { Layers, Activity, Info, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useMeshServer, type OrderbookDepthData } from '@/hooks/useMeshServer';

export interface OrderbookRow {
  price: string;       // e.g. "310" (sats/pUSD) or "1.0150"
  sizeBch: string;     // e.g. "0.000150" BCH
  totalPusd: string;   // e.g. "1,000.00" pUSD
  utxoCount: number;
  depthPct: number;
  utxoIds: string[];
  ownerLabel?: string;
}

// Fallback / initial competitive pool depth from Chipnet benchmark
const PLANET_BIDS: OrderbookRow[] = [
  { price: '310', sizeBch: '0.000150', totalPusd: '1,000.00', utxoCount: 1, depthPct: 100, utxoIds: ['924aa5af7145a8d03e5029791df5360158b552024b89e35129bd73e266d8c061:0'], ownerLabel: 'Mercury (Best Bid 🏆)' },
  { price: '300', sizeBch: '0.000150', totalPusd: '1,000.00', utxoCount: 1, depthPct: 65,  utxoIds: ['0aa1249c71495f479f3cdf329b731893faef88cd63e5651b05c058db5cbf3e6c:0'], ownerLabel: 'Venus (Mid Bid)' },
  { price: '280', sizeBch: '0.000150', totalPusd: '1,000.00', utxoCount: 1, depthPct: 35,  utxoIds: ['921b06f54f09d00d91ac41f12d057ff8212e29092970793b938702c47cd259f1:0'], ownerLabel: 'Earth (Low Bid)' },
];

const PLANET_ASKS: OrderbookRow[] = [
  { price: '330', sizeBch: '0.000010', totalPusd: '10.00', utxoCount: 1, depthPct: 40, utxoIds: ['03f9778a91ec44a28a917d4d8a333854eed80c44a30d129668a70ebd71301c07:0'], ownerLabel: 'Mars (Dutch Decay)' },
  { price: '325', sizeBch: '0.000010', totalPusd: '10.00', utxoCount: 1, depthPct: 20, utxoIds: ['bb5d607b46fea967c460681e60a35fa9d92240d845dbb78bda40d53eec2f875c:0'], ownerLabel: 'Jupiter (Limit Order)' },
];

export function OrderbookLadder() {
  const { positions, health, loading, refresh, bchUsdPrice, fetchOrderbook } = useMeshServer(10_000);
  const [selectedUtxo, setSelectedUtxo] = useState<OrderbookRow | null>(null);
  const [pair, setPair]                 = useState<string>('BCH-pUSD');
  const [obData, setObData]             = useState<OrderbookDepthData | null>(null);

  // Fetch live server orderbook when pair or server health changes
  useEffect(() => {
    let isMounted = true;
    void fetchOrderbook(pair).then(data => {
      if (isMounted && data) setObData(data);
    });
    return () => { isMounted = false; };
  }, [pair, health.ok, fetchOrderbook]);

  // Derived bids and asks (prefer live server data if available, fallback to indexed positions or planet benchmark)
  const bids: OrderbookRow[] = (obData && obData.bids.length > 0)
    ? obData.bids.map((b, i) => ({
        price:     b.price,
        sizeBch:   (Number(b.amountBch) / 1e8).toFixed(6),
        totalPusd: (Number(b.amountBch) * Number(b.price) / 1e8).toFixed(2),
        utxoCount: b.utxoCount,
        depthPct:  Math.min(100, 30 + i * 35),
        utxoIds:   b.utxoIds,
      }))
    : PLANET_BIDS;

  const asks: OrderbookRow[] = (obData && obData.asks.length > 0)
    ? obData.asks.map((a, i) => ({
        price:     a.price,
        sizeBch:   (Number(a.amountBch) / 1e8).toFixed(6),
        totalPusd: (Number(a.amountBch) * Number(a.price) / 1e8).toFixed(2),
        utxoCount: a.utxoCount,
        depthPct:  Math.min(100, 30 + i * 35),
        utxoIds:   a.utxoIds,
      }))
    : PLANET_ASKS;

  const bestBid = bids[0]?.price ?? '310';
  const bestAsk = asks[0]?.price ?? '325';
  const spreadSats = Math.max(0, Number(bestAsk) - Number(bestBid));
  const spreadBps  = Number(bestBid) > 0 ? Math.round((spreadSats / Number(bestBid)) * 10000) : 0;
  const liveSpotUsd = bchUsdPrice() || 300;

  return (
    <div className="w-full max-w-[1100px] mx-auto space-y-6">

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0D0D0E]/80 backdrop-blur-xl border border-white/10 p-5 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-xl text-white">
              CLOB Order Book — {pair}
            </h2>
            <div className="text-xs text-zinc-400 flex items-center gap-2 mt-0.5 font-sans">
              <span>Backed by P2SH32 Strategy Covenant UTXOs</span>
              {health.ok ? (
                <span className="px-2 py-0.5 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Connected to MeshServer ({health.latency}ms)
                </span>
              ) : (
                <span className="text-amber-400 text-[11px]">MeshServer Offline — Offline Mode</span>
              )}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Pair Selector */}
          <div className="flex items-center p-1 bg-white/[0.04] border border-white/10 rounded-xl">
            {['BCH-pUSD', 'BCH-mUSD', 'pUSD-mUSD'].map((p) => (
              <button
                key={p}
                onClick={() => setPair(p)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  pair === p
                    ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            onClick={() => { void refresh(); }}
            className="p-2 text-zinc-400 hover:text-white transition-colors bg-white/5 rounded-xl border border-white/10"
            title="Refresh orderbook"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* CLOB Table */}
      <div className="bg-[#0D0D0E]/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-5 px-6 py-3 bg-white/[0.02] border-b border-white/10 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          <span>Rate (sats/pUSD)</span>
          <span className="text-right">Reserve (BCH)</span>
          <span className="text-right">Total Depth (pUSD)</span>
          <span className="text-center">UTXOs / Pool</span>
          <span className="text-right">Visual Depth</span>
        </div>

        {/* ASKs (Offers to SELL token for BCH) */}
        <div className="divide-y divide-white/5 font-mono text-xs">
          {asks.map((row) => (
            <div
              key={row.price}
              onClick={() => setSelectedUtxo(row)}
              className="grid grid-cols-5 px-6 py-3.5 hover:bg-white/[0.04] cursor-pointer transition-colors relative items-center"
            >
              <div
                className="absolute top-0 bottom-0 right-0 bg-red-500/10 transition-all pointer-events-none"
                style={{ width: `${row.depthPct}%` }}
              />
              <span className="font-bold text-red-400 relative z-10">{row.price} sats</span>
              <span className="text-right text-zinc-200 relative z-10">{row.sizeBch} BCH</span>
              <span className="text-right text-zinc-400 relative z-10">{row.totalPusd} pUSD</span>
              <div className="text-center relative z-10">
                <span className="px-2 py-0.5 text-[11px] font-sans font-bold bg-white/10 text-zinc-300 rounded border border-white/10">
                  {row.ownerLabel ?? `${row.utxoCount} UTXO`}
                </span>
              </div>
              <div className="flex justify-end items-center relative z-10">
                <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500/70" style={{ width: `${row.depthPct}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Middle Spread Banner */}
        <div className="px-6 py-3 bg-white/[0.04] border-y border-white/10 flex justify-between items-center text-xs font-bold font-mono">
          <div className="flex items-center gap-2 text-emerald-400">
            <Activity className="w-4 h-4" />
            <span>SPREAD: {spreadSats} sats ({spreadBps} bps)</span>
          </div>
          <div className="text-zinc-300">
            SPOT: <span className="text-white">${liveSpotUsd.toFixed(2)} USD</span>
            {positions.length > 0 && <span className="ml-3 text-emerald-400 text-xs font-sans font-normal">({positions.length} active strategy UTXOs indexed)</span>}
          </div>
        </div>

        {/* BIDs (Offers to BUY token with BCH) */}
        <div className="divide-y divide-white/5 font-mono text-xs">
          {bids.map((row) => (
            <div
              key={row.price}
              onClick={() => setSelectedUtxo(row)}
              className="grid grid-cols-5 px-6 py-3.5 hover:bg-white/[0.04] cursor-pointer transition-colors relative items-center"
            >
              <div
                className="absolute top-0 bottom-0 right-0 bg-emerald-500/10 transition-all pointer-events-none"
                style={{ width: `${row.depthPct}%` }}
              />
              <span className="font-bold text-emerald-400 relative z-10">{row.price} sats</span>
              <span className="text-right text-zinc-200 relative z-10">{row.sizeBch} BCH</span>
              <span className="text-right text-zinc-400 relative z-10">{row.totalPusd} pUSD</span>
              <div className="text-center relative z-10">
                <span className="px-2 py-0.5 text-[11px] font-sans font-bold bg-white/10 text-zinc-300 rounded border border-white/10">
                  {row.ownerLabel ?? `${row.utxoCount} UTXO`}
                </span>
              </div>
              <div className="flex justify-end items-center relative z-10">
                <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500/70" style={{ width: `${row.depthPct}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Inspector Drawer */}
      {selectedUtxo && (
        <div className="p-6 bg-[#0D0D0E] border border-emerald-500/40 rounded-2xl space-y-4 shadow-2xl relative font-sans">
          <div className="flex justify-between items-center pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Info className="w-5 h-5 text-emerald-400" />
              <span className="font-bold text-white text-base">
                Strategy UTXO Inspector — Price Tier {selectedUtxo.price} sats/pUSD
              </span>
            </div>
            <button
              onClick={() => setSelectedUtxo(null)}
              className="text-xs font-semibold text-zinc-400 hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div className="space-y-1 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
              <span className="text-zinc-500 text-[11px]">Backing UTXO Outpoints</span>
              <div className="text-emerald-400 font-bold break-all space-y-0.5">
                {selectedUtxo.utxoIds.map(id => (
                  <div key={id}>
                    <a
                      href={`https://chipnet.imaginary.cash/tx/${id.split(':')[0]}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline flex items-center gap-1"
                    >
                      {id} ↗
                    </a>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-1 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
              <span className="text-zinc-500 text-[11px]">Covenant Specification</span>
              <div className="text-zinc-300">
                Type: StrategyCovenant (P2SH32)<br/>
                Fee: 30 bps (0.30%)<br/>
                Rate: {selectedUtxo.price}/1 sats per pUSD
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
