/**
 * JSON shapes of the Mesh V4 API (meshserver src/api/routes/v4.ts; reference:
 * src/docs/content/api/v4.md). Integers that can exceed 2^53 are decimal strings.
 */
import type { BinV4Json } from './binV4';
import type { PositionCommitment } from './position';

export type V4Shape = 'spot' | 'curve' | 'bidask';
export type V4Strength = 'gentle' | 'standard' | 'aggressive';

export interface V4PreviewInput {
  tokenCat: string;
  binStepBps: number;
  lowIndex: number;
  highIndex: number;
  marketIndex: number;
  depositSats: string;
  depositTokens: string;
  shape: V4Shape;
  strength?: V4Strength;
  /** txid whose output #0 the wallet spends at input 0: the new category */
  seedTxid: string;
  /** where the position NFT goes (token-aware cashaddr) */
  owner: string;
  name?: string;
  height?: number;
}

export interface V4TokenJson { category: string; amount: string; nft?: { capability: 'none' | 'mutable' | 'minting'; commitment: string } }

export interface V4PlanBin {
  index: number;
  level: number;
  side: 'bid' | 'ask';
  address: string;
  lockingBytecode: string;
  sats: string;
  tokens: string;
  bidSatsPerUnit: number;
  askSatsPerUnit: number;
  params: BinV4Json;
}

export interface V4PlanOutput {
  role: 'identity' | 'nft' | 'bin' | 'metadata';
  binIndex?: number;
  lockingBytecode: string;
  valueSatoshis: string;
  token?: V4TokenJson;
}

export interface V4Plan {
  category: string;
  commitment: PositionCommitment;
  commitmentHex: string;
  bins: V4PlanBin[];
  outputs: V4PlanOutput[];
  metadata: { sha256: string; cid: string; uri: string; registry: unknown; pinProvider?: string | null; pinPath?: string; httpsCopy?: string };
  totals: { sats: string; tokens: string; bidBins: number; askBins: number; outputSats: string };
  estimatedBytes: number;
  warnings: string[];
  genesis?: { input0: { txid: string; vout: number; note?: string }; note: string };
  register: { method: 'POST'; path: string; body: { genesisTxid: string; bins: BinV4Json[] } };
}

export interface V4BinView {
  index: number;
  address: string;
  lockingBytecode: string;
  variant: string;
  bid: { num: string; den: string; satsPerUnit: number };
  ask: { num: string; den: string; satsPerUnit: number };
  utxos: Array<{ txid: string; vout: number; sats: string; tokens: string }>;
  sats: string;
  tokens: string;
  canBuyTokensForSats: string;
  canSellTokens: string;
}

export interface V4PositionView {
  category: string;
  genesisTxid: string;
  nftOutput: number;
  pairName: string | null;
  commitment: PositionCommitment;
  metadata: { sha256: string; uri: string; uris?: string[] } | null;
  holder: { address?: string; lockingBytecode: string } | null;
  totals: { sats: string; tokens: string; valueAtBidSats: string; bins: number; binsWithTokens: number };
  bins: V4BinView[];
  registeredAt: string;
  /** set by the holder listing */
  nft?: { txid: string; vout: number; commitment: string; capability: string };
}

export type V4ActivityKind = 'deposit' | 'buy' | 'sell' | 'top-up' | 'withdraw';
export interface V4ActivityEvent {
  txid: string;
  height: number;
  bin: number;
  kind: V4ActivityKind;
  dSats: string;
  dTokens: string;
  satsPerUnit: number | null;
}

export interface V4PlanInput {
  role: 'bin' | 'nft';
  binIndex?: number;
  txid: string;
  vout: number;
  satoshis: string;
  token?: V4TokenJson;
  lockingBytecode: string;
  unlockingBytecode: string | null;
  sign?: boolean;
}

export interface V4WithdrawPlan {
  category: string;
  nftInputIndex: number;
  inputs: V4PlanInput[];
  outputs: Array<{ role: 'bch' | 'tokens' | 'nft'; lockingBytecode: string; valueSatoshis: string; token?: V4TokenJson }>;
  feeSats: string;
  estimatedBytes: number;
  note: string;
}

export interface V4CloseItem {
  address: string;
  contractName: string;
  constructorArgs?: unknown;
  utxos: Array<{ txid: string; vout: number; sats: string; tokens: string; category: string | null }>;
}

export interface V4MigratePlan {
  strategy: string;
  close: V4CloseItem[];
  available: { sats: string; tokens: string };
  v4: V4Plan;
  leftSats: string;
  note: string;
}
