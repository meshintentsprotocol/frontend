export type Timeframe = '7D' | '1M' | '3M' | '6M' | 'All';

export interface LeaderboardProvider {
  rank: number;
  rankDelta: number; // e.g. +1, -1, 0
  isNew?: boolean;
  address: string;
  shortAddress: string;
  avatarSeed: string;
  volumeUsd: number;
  sharedLiquidityUsd: number;
  putableLiquidityUsd: number;
  feesUsd: number;
  apyPct: number;
  positionsCount: number;
  network?: string;
  // History points for chart
  history: {
    date: string;
    volumeUsd: number;
    feesUsd: number;
    apyPct: number;
    sharedLiquidityUsd: number;
  }[];
}

export interface LeaderboardSwap {
  id: string;
  txid: string;
  providerAddress: string;
  timestamp: string;
  timeAgo: string;
  pair: string;
  tokenInSymbol: string;
  tokenInAmount: number;
  tokenInUsd: number;
  tokenOutSymbol: string;
  tokenOutAmount: number;
  tokenOutUsd: number;
  totalUsd: number;
  feeEarnedUsd: number;
}

export interface NetworkVolumeDistribution {
  network: string;
  volumeUsd: number;
  percentage: number;
  color: string;
}

export interface LeaderboardGlobalStats {
  totalVolumeUsd: number;
  totalPutableLiquidityUsd: number;
  totalSharedLiquidityUsd: number;
  liquidityProvidersCount: number;
  topApyPct: number;
}

// Deterministic mock / live provider generator
export const MOCK_LEADERBOARD_PROVIDERS: LeaderboardProvider[] = [
  {
    rank: 1,
    rankDelta: 1,
    address: '0x5510b64c12564293f9c647b93839215ef82bf4f8',
    shortAddress: '0x5510...f4f8',
    avatarSeed: 'alpha',
    volumeUsd: 288412185.68,
    sharedLiquidityUsd: 0,
    putableLiquidityUsd: 0,
    feesUsd: 3161.11,
    apyPct: 88.38,
    positionsCount: 4,
    network: 'BCH Chipnet',
    history: [
      { date: 'Aug 23', volumeUsd: 8500000, feesUsd: 120, apyPct: 45.2, sharedLiquidityUsd: 120000 },
      { date: 'Aug 26', volumeUsd: 14200000, feesUsd: 210, apyPct: 52.8, sharedLiquidityUsd: 180000 },
      { date: 'Aug 30', volumeUsd: 42300000, feesUsd: 480, apyPct: 68.4, sharedLiquidityUsd: 250000 },
      { date: 'Sep 2', volumeUsd: 28100000, feesUsd: 350, apyPct: 71.0, sharedLiquidityUsd: 290000 },
      { date: 'Sep 6', volumeUsd: 78900000, feesUsd: 920, apyPct: 82.5, sharedLiquidityUsd: 310000 },
      { date: 'Sep 9', volumeUsd: 51200000, feesUsd: 610, apyPct: 84.1, sharedLiquidityUsd: 310000 },
      { date: 'Sep 13', volumeUsd: 89600000, feesUsd: 1100, apyPct: 91.2, sharedLiquidityUsd: 340000 },
      { date: 'Sep 16', volumeUsd: 102400000, feesUsd: 1320, apyPct: 96.5, sharedLiquidityUsd: 350000 },
    ],
  },
  {
    rank: 2,
    rankDelta: -1,
    address: '0x01cb592398418abdf450123549ef0129a67a6e7a',
    shortAddress: '0x01cb...a67e',
    avatarSeed: 'beta',
    volumeUsd: 267018723.82,
    sharedLiquidityUsd: 0,
    putableLiquidityUsd: 1250000,
    feesUsd: 2840.45,
    apyPct: 74.2,
    positionsCount: 6,
    network: 'BCH Chipnet',
    history: [
      { date: 'Aug 23', volumeUsd: 12000000, feesUsd: 180, apyPct: 50.1, sharedLiquidityUsd: 210000 },
      { date: 'Aug 30', volumeUsd: 55000000, feesUsd: 620, apyPct: 69.4, sharedLiquidityUsd: 320000 },
      { date: 'Sep 6', volumeUsd: 91000000, feesUsd: 1050, apyPct: 78.9, sharedLiquidityUsd: 410000 },
      { date: 'Sep 13', volumeUsd: 98000000, feesUsd: 1150, apyPct: 81.3, sharedLiquidityUsd: 430000 },
    ],
  },
  {
    rank: 3,
    rankDelta: 0,
    address: '0xec7a98bcefa45129384756201948572019284890',
    shortAddress: '0xec7a...4890',
    avatarSeed: 'gamma',
    volumeUsd: 155788712.90,
    sharedLiquidityUsd: 1.14,
    putableLiquidityUsd: 450000,
    feesUsd: 1980.20,
    apyPct: 124.5,
    positionsCount: 3,
    network: 'CashTokens',
    history: [
      { date: 'Aug 23', volumeUsd: 5000000, feesUsd: 90, apyPct: 60.0, sharedLiquidityUsd: 100000 },
      { date: 'Aug 30', volumeUsd: 35000000, feesUsd: 410, apyPct: 98.2, sharedLiquidityUsd: 200000 },
      { date: 'Sep 6', volumeUsd: 62000000, feesUsd: 820, apyPct: 118.0, sharedLiquidityUsd: 260000 },
      { date: 'Sep 13', volumeUsd: 74000000, feesUsd: 950, apyPct: 125.0, sharedLiquidityUsd: 280000 },
    ],
  },
  {
    rank: 4,
    rankDelta: 1,
    address: '0x29124810294729184710928471928471092849cb',
    shortAddress: '0x2912...49cb',
    avatarSeed: 'delta',
    volumeUsd: 146559013.37,
    sharedLiquidityUsd: 0,
    putableLiquidityUsd: 820000,
    feesUsd: 1640.80,
    apyPct: 62.1,
    positionsCount: 5,
    network: 'BCH Chipnet',
    history: [],
  },
  {
    rank: 5,
    rankDelta: 1,
    address: '0x49bc120938471029384710293847102938476008',
    shortAddress: '0x49bc...6008',
    avatarSeed: 'epsilon',
    volumeUsd: 139300839.28,
    sharedLiquidityUsd: 0,
    putableLiquidityUsd: 690000,
    feesUsd: 1490.50,
    apyPct: 58.7,
    positionsCount: 2,
    network: 'BCH Chipnet',
    history: [],
  },
  {
    rank: 6,
    rankDelta: 1,
    address: '0x4e7819284710293847102938471029384710cc88',
    shortAddress: '0x4e78...cc88',
    avatarSeed: 'zeta',
    volumeUsd: 127387988.14,
    sharedLiquidityUsd: 0,
    putableLiquidityUsd: 310000,
    feesUsd: 1320.10,
    apyPct: 52.4,
    positionsCount: 3,
    network: 'CashTokens',
    history: [],
  },
  {
    rank: 7,
    rankDelta: 0,
    address: '0x1b92192847102938471029384710293847108d70',
    shortAddress: '0x1b92...8d70',
    avatarSeed: 'eta',
    volumeUsd: 112617299.92,
    sharedLiquidityUsd: 0.03,
    putableLiquidityUsd: 540000,
    feesUsd: 1190.00,
    apyPct: 49.8,
    positionsCount: 4,
    network: 'BCH Chipnet',
    history: [],
  },
  {
    rank: 8,
    rankDelta: 0,
    address: '0x0e2319284710293847102938471029384710bf7b',
    shortAddress: '0x0e23...bf7b',
    avatarSeed: 'theta',
    volumeUsd: 97841134.79,
    sharedLiquidityUsd: 0.08,
    putableLiquidityUsd: 410000,
    feesUsd: 980.50,
    apyPct: 44.2,
    positionsCount: 2,
    network: 'CashTokens',
    history: [],
  },
  {
    rank: 9,
    rankDelta: 0,
    address: '0x5e9419284710293847102938471029384710b534',
    shortAddress: '0x5e94...b534',
    avatarSeed: 'iota',
    volumeUsd: 80175067.70,
    sharedLiquidityUsd: 0,
    putableLiquidityUsd: 390000,
    feesUsd: 840.20,
    apyPct: 39.5,
    positionsCount: 1,
    network: 'BCH Chipnet',
    history: [],
  },
  {
    rank: 10,
    rankDelta: 0,
    address: '0x0b0c192847102938471029384710293847109b81',
    shortAddress: '0x0b0c...9b81',
    avatarSeed: 'kappa',
    volumeUsd: 65761846.15,
    sharedLiquidityUsd: 0.01,
    putableLiquidityUsd: 280000,
    feesUsd: 710.00,
    apyPct: 36.8,
    positionsCount: 2,
    network: 'BCH Chipnet',
    history: [],
  },
  {
    rank: 11,
    rankDelta: 0,
    address: '0xec2419284710293847102938471029384710a3cf',
    shortAddress: '0xec24...a3cf',
    avatarSeed: 'lambda',
    volumeUsd: 50447968.28,
    sharedLiquidityUsd: 0,
    putableLiquidityUsd: 220000,
    feesUsd: 550.00,
    apyPct: 34.1,
    positionsCount: 2,
    network: 'CashTokens',
    history: [],
  },
  {
    rank: 12,
    rankDelta: 0,
    address: '0xd52519284710293847102938471029384710cc91',
    shortAddress: '0xd525...cc91',
    avatarSeed: 'mu',
    volumeUsd: 43846970.48,
    sharedLiquidityUsd: 0,
    putableLiquidityUsd: 190000,
    feesUsd: 480.00,
    apyPct: 31.9,
    positionsCount: 1,
    network: 'BCH Chipnet',
    history: [],
  },
  {
    rank: 13,
    rankDelta: 0,
    address: '0x4cbc192847102938471029384710293847102819',
    shortAddress: '0x4cbc...2819',
    avatarSeed: 'nu',
    volumeUsd: 39091269.37,
    sharedLiquidityUsd: 0,
    putableLiquidityUsd: 160000,
    feesUsd: 420.00,
    apyPct: 29.5,
    positionsCount: 1,
    network: 'BCH Chipnet',
    history: [],
  },
  {
    rank: 14,
    rankDelta: 0,
    isNew: true,
    address: '0xd21219284710293847102938471029384710b377',
    shortAddress: '0xd212...b377',
    avatarSeed: 'xi',
    volumeUsd: 27442110.06,
    sharedLiquidityUsd: 8.19,
    putableLiquidityUsd: 140000,
    feesUsd: 310.00,
    apyPct: 1649.0, // Top APY
    positionsCount: 3,
    network: 'CashTokens',
    history: [],
  },
  {
    rank: 15,
    rankDelta: 1,
    address: '0x04ed19284710293847102938471029384710d9e5',
    shortAddress: '0x04ed...d9e5',
    avatarSeed: 'omicron',
    volumeUsd: 24422731.02,
    sharedLiquidityUsd: 0,
    putableLiquidityUsd: 110000,
    feesUsd: 280.00,
    apyPct: 26.4,
    positionsCount: 1,
    network: 'BCH Chipnet',
    history: [],
  },
  {
    rank: 16,
    rankDelta: 1,
    address: '0x03aa1928471029384710293847102938471037ec',
    shortAddress: '0x03aa...37ec',
    avatarSeed: 'pi',
    volumeUsd: 20602439.33,
    sharedLiquidityUsd: 0,
    putableLiquidityUsd: 95000,
    feesUsd: 230.00,
    apyPct: 24.1,
    positionsCount: 1,
    network: 'BCH Chipnet',
    history: [],
  },
];

export const MOCK_LEADERBOARD_SWAPS: LeaderboardSwap[] = [
  {
    id: 's-1',
    txid: 'c4e3f8901234abcd5678ef901234abcd5678ef901234abcd5678ef901234abcd',
    providerAddress: '0x5510b64c12564293f9c647b93839215ef82bf4f8',
    timestamp: '2026-09-16T15:21:00Z',
    timeAgo: '2m ago',
    pair: '1INCH / AAVE',
    tokenInSymbol: '1INCH',
    tokenInAmount: 556559,
    tokenInUsd: 50970,
    tokenOutSymbol: 'AAVE',
    tokenOutAmount: 410.135,
    tokenOutUsd: 52530,
    totalUsd: 52530,
    feeEarnedUsd: 0.50,
  },
  {
    id: 's-2',
    txid: 'e9b2a18471029384710293847102938471029384710293847102938471029384',
    providerAddress: '0x5510b64c12564293f9c647b93839215ef82bf4f8',
    timestamp: '2026-09-16T15:21:00Z',
    timeAgo: '2m ago',
    pair: 'AAVE / 1INCH',
    tokenInSymbol: 'AAVE',
    tokenInAmount: 410.135,
    tokenInUsd: 52530,
    tokenOutSymbol: '1INCH',
    tokenOutAmount: 556572,
    tokenOutUsd: 50970,
    totalUsd: 52530,
    feeEarnedUsd: 0.52,
  },
  {
    id: 's-3',
    txid: '3f7a8b1928471029384710293847102938471029384710293847102938471029',
    providerAddress: '0x01cb592398418abdf450123549ef0129a67a6e7a',
    timestamp: '2026-09-16T15:21:00Z',
    timeAgo: '2m ago',
    pair: '1INCH / AAVE',
    tokenInSymbol: '1INCH',
    tokenInAmount: 556559,
    tokenInUsd: 50970,
    tokenOutSymbol: 'AAVE',
    tokenOutAmount: 410.135,
    tokenOutUsd: 52530,
    totalUsd: 52530,
    feeEarnedUsd: 0.50,
  },
  {
    id: 's-4',
    txid: 'a98c219284710293847102938471029384710293847102938471029384710293',
    providerAddress: '0x5510b64c12564293f9c647b93839215ef82bf4f8',
    timestamp: '2026-09-16T15:21:00Z',
    timeAgo: '2m ago',
    pair: '1INCH / AAVE',
    tokenInSymbol: '1INCH',
    tokenInAmount: 556559,
    tokenInUsd: 50970,
    tokenOutSymbol: 'AAVE',
    tokenOutAmount: 410.135,
    tokenOutUsd: 52530,
    totalUsd: 52530,
    feeEarnedUsd: 0.50,
  },
  {
    id: 's-5',
    txid: '7b6d192847102938471029384710293847102938471029384710293847102938',
    providerAddress: '0x5510b64c12564293f9c647b93839215ef82bf4f8',
    timestamp: '2026-09-16T15:21:00Z',
    timeAgo: '2m ago',
    pair: '1INCH / AAVE',
    tokenInSymbol: '1INCH',
    tokenInAmount: 556559,
    tokenInUsd: 50970,
    tokenOutSymbol: 'AAVE',
    tokenOutAmount: 410.135,
    tokenOutUsd: 52530,
    totalUsd: 52530,
    feeEarnedUsd: 0.50,
  },
];

export const MOCK_TOP_MOVERS = [
  { address: '0x0eb23...6c0d', fullAddress: '0x0eb2319284710293847102938471029384716c0d', volumeUsd: 914200, rankDelta: 103 },
  { address: '0xe59a...4809', fullAddress: '0xe59a192847102938471029384710293847104809', volumeUsd: 715200, rankDelta: 47 },
  { address: '0x5825...d723', fullAddress: '0x582519284710293847102938471029384710d723', volumeUsd: 510900, rankDelta: 40 },
];

export const MOCK_NETWORK_DISTRIBUTION: NetworkVolumeDistribution[] = [
  { network: 'Bitcoin Cash Chipnet', volumeUsd: 1888460643.16, percentage: 100, color: '#10b981' },
  { network: 'Other (CashTokens / Solana)', volumeUsd: 0, percentage: 0, color: '#6366f1' },
];

export const MOCK_GLOBAL_STATS: LeaderboardGlobalStats = {
  totalVolumeUsd: 1888460643.16,
  totalPutableLiquidityUsd: 7643720.80,
  totalSharedLiquidityUsd: 15675489.63,
  liquidityProvidersCount: 653,
  topApyPct: 1649,
};

// Generates an avatar gradient deterministically from address
export function getAvatarGradient(address: string): string {
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = address.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue1 = Math.abs(hash % 360);
  const hue2 = Math.abs((hash * 7) % 360);
  return `linear-gradient(135deg, hsl(${hue1}, 80%, 55%), hsl(${hue2}, 90%, 45%))`;
}

// Formats large numbers compactly or with full commas
export function formatUsd(num: number, decimals = 2): string {
  return `$${num.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatCompactUsd(num: number): string {
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
  return `$${num.toFixed(2)}`;
}
