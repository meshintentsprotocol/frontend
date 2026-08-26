import { Contract, ElectrumNetworkProvider, TransactionBuilder, SignatureTemplate } from 'cashscript';
import { sha256, ripemd160, hexToBin, binToHex, cashAddressToLockingBytecode, decodeTransaction } from '@bitauth/libauth';

import StrategyCovenantArtifact from './artifacts/StrategyCovenant.json';
import OracleStrategyCovenantArtifact from './artifacts/OracleStrategyCovenant.json';
import DutchDecayStrategyCovenantArtifact from './artifacts/DutchDecayStrategyCovenant.json';
import MultiPairRecyclingCovenantArtifact from './artifacts/MultiPairRecyclingCovenant.json';
import type { MeshPosition } from '@/hooks/useMeshServer';

// ── Helpers ───────────────────────────────────────────────────────────────────

export const reverseHex = (hex: string): string => {
  const clean = typeof hex === 'string' && hex.startsWith('0x') ? hex.slice(2) : String(hex || '');
  if (!clean || clean.length === 0) return '';
  const match = clean.match(/.{2}/g);
  return match ? match.reverse().join('') : clean;
};

export function toHex(input: string | Uint8Array | Buffer): string {
  if (typeof input === 'string') {
    return input.startsWith('0x') ? input.slice(2) : input;
  }
  if (input instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(input))) {
    return binToHex(new Uint8Array(input));
  }
  if (input && typeof input === 'object') {
    return binToHex(new Uint8Array(Object.values(input)));
  }
  return String(input || '');
}

export function toBytes(input: string | Uint8Array | Buffer): Uint8Array {
  if (typeof input === 'string') {
    const clean = input.startsWith('0x') ? input.slice(2) : input;
    return hexToBin(clean);
  }
  if (input instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(input))) {
    return new Uint8Array(input);
  }
  if (input && typeof input === 'object') {
    return new Uint8Array(Object.values(input));
  }
  return new Uint8Array(0);
}

export function derivePkh(pubKey: string | Uint8Array | Buffer): Uint8Array {
  const pkBytes = toBytes(pubKey);
  return ripemd160.hash(sha256.hash(pkBytes));
}

export function contractLockingHex(address: string): string {
  const result = cashAddressToLockingBytecode(address);
  if (typeof result === 'string') throw new Error(result);
  return binToHex(result.bytecode);
}

// ── Contract Instantiation ────────────────────────────────────────────────────

export function getElectrumProvider(network: 'chipnet' | 'mainnet' = 'chipnet'): ElectrumNetworkProvider {
  return new ElectrumNetworkProvider(network);
}

export interface StrategyDeploymentParams {
  strategyType: 'straight' | 'oracle' | 'dutch';
  ownerPkHex: string | Uint8Array | Buffer;
  tokenCategoryIn: string;   // Token to receive ('0x' for BCH, or 64-char hex)
  tokenCategoryOut: string;  // Token in reserve ('0x' for BCH, or 64-char hex)
  priceNum: bigint;
  priceDen: bigint;
  feeBps: bigint;
  reserveSats: bigint;
  reserveTokenAmount?: bigint;
  // Dutch specific
  startTime?: number;
  duration?: number;
  floorPriceNum?: bigint;
  // Oracle specific
  oraclePkHex?: string | Uint8Array;
  pairId?: bigint;
  spreadBps?: bigint;
  network?: 'chipnet' | 'mainnet';
}

export interface DeploymentResult {
  txid: string;
  contractAddress: string;
  contractType: string;
  reserveSats: string;
  ownerPkh: string;
}

export function buildStrategyContract(params: StrategyDeploymentParams, provider: ElectrumNetworkProvider): Contract {
  const ownerPkh = derivePkh(params.ownerPkHex);

  const tokenInLE = params.tokenCategoryIn === '0x' || !params.tokenCategoryIn
    ? '0x'
    : `0x${reverseHex(params.tokenCategoryIn)}`;

  const tokenOutLE = params.tokenCategoryOut === '0x' || !params.tokenCategoryOut
    ? '0x'
    : `0x${reverseHex(params.tokenCategoryOut)}`;

  if (params.strategyType === 'oracle') {
    const oraclePk = toBytes(params.oraclePkHex || '02'.repeat(33));
    return new Contract(
      OracleStrategyCovenantArtifact as any,
      [
        ownerPkh,
        oraclePk,
        params.pairId ?? 1n,
        params.spreadBps ?? 50n,
        params.feeBps,
        tokenInLE,
        tokenOutLE,
      ],
      { provider }
    );
  }

  if (params.strategyType === 'dutch') {
    const sTime = BigInt(Math.round(Number(params.startTime ?? Math.floor(Date.now() / 1000))));
    const dur = BigInt(Math.round(Number(params.duration ?? 3600)));
    const flPrice = params.floorPriceNum !== undefined
      ? BigInt(Math.round(Number(params.floorPriceNum)))
      : (params.priceNum / 2n);

    return new Contract(
      DutchDecayStrategyCovenantArtifact as any,
      [
        ownerPkh,
        tokenInLE,
        tokenOutLE,
        params.priceNum,
        flPrice,
        params.priceDen,
        sTime,
        dur,
        params.feeBps,
      ],
      { provider }
    );
  }

  // Default: Fixed-rate straight StrategyCovenant
  return new Contract(
    StrategyCovenantArtifact as any,
    [
      ownerPkh,
      tokenInLE,
      tokenOutLE,
      params.priceNum,
      params.priceDen,
      params.feeBps,
    ],
    { provider }
  );
}

// ── Deploy Strategy ("Ship" Pool) ─────────────────────────────────────────────

export async function deployStrategyPosition(
  bchWallet: any,
  params: StrategyDeploymentParams
): Promise<DeploymentResult> {
  if (!bchWallet) throw new Error('BCH Wallet not connected');

  const provider = getElectrumProvider(params.network ?? 'chipnet');
  const contract = buildStrategyContract(params, provider);
  const ownerPkhHex = binToHex(derivePkh(params.ownerPkHex));

  const contractType =
    params.strategyType === 'oracle' ? 'OracleStrategyCovenant'
    : params.strategyType === 'dutch' ? 'DutchDecayStrategyCovenant'
    : 'StrategyCovenant';

  let txid = '';

  if (params.reserveTokenAmount && params.tokenCategoryOut && params.tokenCategoryOut !== '0x') {
    // Deploy CashToken reserve
    const res = await bchWallet.send([
      {
        cashaddr: contract.address,
        value: Number(params.reserveSats > 1000n ? params.reserveSats : 1000n),
        unit: 'sat',
        token: {
          category: params.tokenCategoryOut,
          amount: params.reserveTokenAmount,
        },
      },
    ]);
    txid = res.txId || res.txid;
  } else {
    // Deploy pure BCH reserve
    const res = await bchWallet.send([
      {
        cashaddr: contract.address,
        value: Number(params.reserveSats),
        unit: 'sat',
      },
    ]);
    txid = res.txId || res.txid;
  }

  if (!txid) throw new Error('Funding transaction failed — no TXID returned');

  return {
    txid,
    contractAddress: contract.address,
    contractType,
    reserveSats: params.reserveSats.toString(),
    ownerPkh: ownerPkhHex,
  };
}

// ── Live Pool Balance & Token Query ──────────────────────────────────────────

export interface LivePoolBalance {
  satoshis: bigint;
  bchAmount: number;
  tokenAmount: bigint;
  tokenCategory?: string;
  utxoCount: number;
  utxos: any[];
}

export function tokenSymbol(categoryHex?: string): string {
  if (!categoryHex || categoryHex === '0x' || categoryHex === '') return 'BCH';
  const clean = categoryHex.toLowerCase().replace(/^0x/, '');
  if (clean.startsWith('dfe50223') || clean.includes('dfe50223c8d5cba8dcef8dff6d92b61deb88a8ba44947367f2b746487b56039b')) {
    return 'pUSD';
  }
  return `CT-${clean.slice(0, 4)}…${clean.slice(-4)}`;
}

export async function fetchLivePoolBalance(
  covenantAddress: string,
  network: 'chipnet' | 'mainnet' = 'chipnet'
): Promise<LivePoolBalance> {
  if (!covenantAddress) {
    return { satoshis: 0n, bchAmount: 0, tokenAmount: 0n, utxoCount: 0, utxos: [] };
  }
  try {
    const provider = getElectrumProvider(network);
    const utxos = await provider.getUtxos(covenantAddress);
    let totalSats = 0n;
    let totalToken = 0n;
    let tokenCategory: string | undefined;

    for (const u of utxos) {
      totalSats += BigInt(u.satoshis);
      if (u.token) {
        totalToken += BigInt(u.token.amount);
        if (!tokenCategory) tokenCategory = u.token.category;
      }
    }

    return {
      satoshis: totalSats,
      bchAmount: Number(totalSats) / 1e8,
      tokenAmount: totalToken,
      tokenCategory,
      utxoCount: utxos.length,
      utxos,
    };
  } catch (err) {
    console.warn(`[Mesh] Failed to fetch live pool balance for ${covenantAddress}:`, err);
    return { satoshis: 0n, bchAmount: 0, tokenAmount: 0n, utxoCount: 0, utxos: [] };
  }
}

// ── Top-up Strategy Pool Capital ─────────────────────────────────────────────

export async function executeTopUpPosition(
  bchWallet: any,
  pos: MeshPosition,
  amountBch: number,
  tokenAmount: bigint = 0n
): Promise<string> {
  if (!bchWallet) throw new Error('BCH Wallet not connected');
  if (amountBch <= 0 && tokenAmount <= 0n) throw new Error('Enter a valid deposit amount');

  const covenantAddress = pos.address;
  if (!covenantAddress) throw new Error('Invalid covenant address');

  const sats = Math.max(1000, Math.round(amountBch * 1e8));

  if (tokenAmount > 0n && pos.tokenCategoryOut && pos.tokenCategoryOut !== '0x') {
    const res = await bchWallet.send([
      {
        cashaddr: covenantAddress,
        value: sats,
        unit: 'sat',
        token: {
          category: pos.tokenCategoryOut,
          amount: tokenAmount,
        },
      },
    ]);
    return res.txId || res.txid;
  }

  const res = await bchWallet.send([
    {
      cashaddr: covenantAddress,
      value: sats,
      unit: 'sat',
    },
  ]);
  return res.txId || res.txid;
}

// ── Local Position Metadata Cache ─────────────────────────────────────────────

const LOCAL_POS_KEY = 'bch_mesh_user_positions';

export function saveLocalPositionParams(txid: string, params: any): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const raw = localStorage.getItem(LOCAL_POS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[txid] = { ...params, savedAt: Date.now() };
    localStorage.setItem(LOCAL_POS_KEY, JSON.stringify(map));
  } catch {}
}

export function getLocalPositionParams(txid: string): any | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = localStorage.getItem(LOCAL_POS_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw);
    return map[txid] ?? null;
  } catch {
    return null;
  }
}

// ── Dock Strategy (Unilateral Exit / Partial Withdrawal) ──────────────────────

export interface DockOptions {
  percentToDock?: number; // 1 to 100 (default: 100 = full withdrawal)
  network?: 'chipnet' | 'mainnet';
}

export interface DockResult {
  txid: string;
  dockedSats: string;
  remainSats: string;
  dockedTokens?: string;
  remainTokens?: string;
  isPartial: boolean;
  newVout?: number;
}

export async function executeDockPosition(
  bchWallet: any,
  pos: MeshPosition,
  options: DockOptions | 'chipnet' | 'mainnet' = 'chipnet'
): Promise<DockResult> {
  if (!bchWallet) throw new Error('BCH Wallet not connected');

  const network = typeof options === 'string' ? options : (options.network ?? 'chipnet');
  const percentToDock = typeof options === 'object' && options.percentToDock !== undefined
    ? Math.min(100, Math.max(1, options.percentToDock))
    : 100;

  const userAddr = bchWallet.cashaddr || (await bchWallet.getDepositAddress());
  const ownerPkRaw = await bchWallet.getPublicKey();
  const ownerPkBytes = toBytes(ownerPkRaw);
  const wif = bchWallet.privateKeyWif || (await bchWallet.getPrivateKeyWif?.());

  if (!wif) throw new Error('Wallet WIF is required for signing dock transaction');

  const provider = getElectrumProvider(network);
  const sigTemplate = new SignatureTemplate(wif);

  // Retrieve exact original constructor parameters
  const localParams = getLocalPositionParams(pos.txid);
  console.log('[Mesh] Dock: pos.address =', pos.address, '| localParams =', localParams, '| pos.txid =', pos.txid, '| pos.vout =', pos.vout);

  const startTime = Math.round(Number(pos.startTime ?? localParams?.startTime ?? Math.floor(Date.now() / 1000)));
  const duration = Math.round(Number(pos.duration ?? localParams?.duration ?? 3600));
  const rawFloor = pos.floorPriceNum ?? localParams?.floorPriceNum ?? (pos.priceNum > 0 ? (pos.priceNum * 80) / 100 : 1);
  const floorPriceNum = Math.max(1, Math.round(Number(rawFloor)));
  const oraclePkHex = pos.oraclePkHex ?? localParams?.oraclePkHex ?? ('02' + '00'.repeat(32));
  const pairId = Math.round(Number(pos.pairId ?? localParams?.pairId ?? 1));
  const spreadBps = Math.round(Number(pos.spreadBps ?? localParams?.spreadBps ?? 50));

  const priceNumSafe = BigInt(Math.max(1, Math.round(Number(pos.priceNum || 1))));
  const priceDenSafe = BigInt(Math.max(1, Math.round(Number(pos.priceDen || 1))));
  const feeBpsSafe = BigInt(Math.max(0, Math.round(Number(pos.feeBps || 30))));
  const reserveSatsSafe = BigInt(Math.max(546, Math.round(Number(pos.reserveSats) || 10000)));

  // Re-instantiate the covenant to get ABI unlock functions with identical bytecode
  const contract = buildStrategyContract(
    {
      strategyType: pos.contractType === 'OracleStrategyCovenant' ? 'oracle' : pos.contractType === 'DutchDecayStrategyCovenant' ? 'dutch' : 'straight',
      ownerPkHex: ownerPkBytes,
      tokenCategoryIn: pos.tokenCategoryIn,
      tokenCategoryOut: pos.tokenCategoryOut,
      priceNum: priceNumSafe,
      priceDen: priceDenSafe,
      feeBps: feeBpsSafe,
      reserveSats: reserveSatsSafe,
      startTime,
      duration,
      floorPriceNum: BigInt(floorPriceNum),
      oraclePkHex,
      pairId: BigInt(pairId),
      spreadBps: BigInt(spreadBps),
      network,
    },
    provider
  );

  // ── Verify UTXO exists on-chain (prevent "Missing inputs" when docking) ──────
  const posAddr      = pos.address || '';
  const contractAddr = contract.address;
  console.log(`[Mesh] Dock: stored pos.address="${posAddr}" | derived contract.address="${contractAddr}" | match=${posAddr === contractAddr}`);
  const addrsToTry   = [...new Set([posAddr, contractAddr].filter(Boolean))];

  let onChainUtxo: Awaited<ReturnType<typeof provider.getUtxos>>[number] | undefined;
  let resolvedAddr = contractAddr;

  for (const addr of addrsToTry) {
    try {
      const utxos = await provider.getUtxos(addr);
      // First try exact txid:vout match
      let found = utxos.find(u => u.txid === pos.txid && u.vout === pos.vout);
      // If not found by exact txid:vout, pick the largest UTXO available at the covenant address
      // (This handles successive partial docking and fills seamlessly!)
      if (!found && utxos.length > 0) {
        found = [...utxos].sort((a, b) => Number(b.satoshis - a.satoshis))[0];
      }
      if (found) {
        onChainUtxo  = found;
        resolvedAddr = addr;
        break;
      }
    } catch {
      // address may be invalid — skip
    }
  }

  if (!onChainUtxo) {
    const tried = addrsToTry.map(a => a.slice(0, 24) + '…').join(' / ');
    throw new Error(
      `No spendable UTXO found on-chain at ${tried}.\n` +
      `The position may already be fully docked/drained, or its funds were consumed by taker swaps.\n` +
      `Please refresh your positions.`
    );
  }

  // Use actual on-chain satoshi value
  const actualSatoshis = BigInt(onChainUtxo.satoshis);
  const utxoToken = onChainUtxo.token ? {
    category: onChainUtxo.token.category,
    amount: BigInt(onChainUtxo.token.amount),
  } : undefined;

  const contractUtxo = {
    txid: onChainUtxo.txid,
    vout: onChainUtxo.vout,
    satoshis: actualSatoshis,
    token: onChainUtxo.token,
  };

  const dockBuilder = new TransactionBuilder({ provider });
  dockBuilder.addInput(contractUtxo, contract.unlock.dock(ownerPkBytes, sigTemplate));

  const DOCK_FEE = 1000n;
  const isPartial = percentToDock < 100;
  let dockedSats = 0n;
  let remainSats = 0n;
  let dockedTokens = 0n;
  let remainTokens = 0n;

  if (!isPartial) {
    // 100% Full Docking
    dockedSats = contractUtxo.satoshis > DOCK_FEE ? contractUtxo.satoshis - DOCK_FEE : contractUtxo.satoshis;
    remainSats = 0n;
    if (utxoToken) {
      dockedTokens = utxoToken.amount;
      remainTokens = 0n;
    }

    if (contractUtxo.satoshis > (546n + DOCK_FEE)) {
      if (utxoToken && utxoToken.amount > 0n) {
        dockBuilder.addOutput({
          to: userAddr,
          amount: contractUtxo.satoshis - DOCK_FEE,
          token: { category: utxoToken.category, amount: utxoToken.amount }
        });
      } else {
        dockBuilder.addOutput({ to: userAddr, amount: contractUtxo.satoshis - DOCK_FEE });
      }
    } else {
      // Need auxiliary fee UTXO
      const bchUtxos = await provider.getUtxos(userAddr);
      const feeUtxo = bchUtxos.find(u => !u.token && u.satoshis > 3000n);
      if (feeUtxo) {
        dockBuilder.addInput(feeUtxo, sigTemplate.unlockP2PKH());
        const totalOut = contractUtxo.satoshis + BigInt(feeUtxo.satoshis) - DOCK_FEE;
        if (utxoToken && utxoToken.amount > 0n) {
          dockBuilder.addOutput({
            to: userAddr,
            amount: totalOut,
            token: { category: utxoToken.category, amount: utxoToken.amount }
          });
        } else {
          dockBuilder.addOutput({ to: userAddr, amount: totalOut });
        }
      } else {
        dockBuilder.addOutput({ to: userAddr, amount: contractUtxo.satoshis - DOCK_FEE });
      }
    }
  } else {
    // Partial Docking (% withdrawal)
    const pct = BigInt(percentToDock);
    dockedSats = (contractUtxo.satoshis * pct) / 100n;
    remainSats = contractUtxo.satoshis - dockedSats;

    const userAmount = dockedSats > DOCK_FEE ? dockedSats - DOCK_FEE : dockedSats;

    if (utxoToken && utxoToken.amount > 0n) {
      dockedTokens = (utxoToken.amount * pct) / 100n;
      remainTokens = utxoToken.amount - dockedTokens;

      dockBuilder.addOutput({
        to: userAddr,
        amount: userAmount > 546n ? userAmount : 546n,
        token: dockedTokens > 0n ? { category: utxoToken.category, amount: dockedTokens } : undefined,
      });

      dockBuilder.addOutput({
        to: contract.address,
        amount: remainSats > 546n ? remainSats : 546n,
        token: remainTokens > 0n ? { category: utxoToken.category, amount: remainTokens } : undefined,
      });
    } else {
      dockBuilder.addOutput({ to: userAddr, amount: userAmount > 546n ? userAmount : 546n });
      dockBuilder.addOutput({ to: contract.address, amount: remainSats > 546n ? remainSats : 546n });
    }
  }

  const tx = await dockBuilder.send();
  const txid = tx.txid || (tx as any).txId;

  // Cache updated UTXO metadata so subsequent partial docks continue seamlessly!
  if (isPartial && txid) {
    const updatedParams = {
      ...localParams,
      txid,
      vout: 1, // remainder output is output 1
      address: contract.address,
      contractType: pos.contractType,
      reserveSats: remainSats.toString(),
      tokenAmountOut: remainTokens > 0n ? remainTokens.toString() : pos.tokenAmountOut,
      priceNum: pos.priceNum,
      priceDen: pos.priceDen,
      feeBps: pos.feeBps,
      startTime,
      duration,
      floorPriceNum,
      oraclePkHex,
      pairId,
      spreadBps,
    };
    saveLocalPositionParams(txid, updatedParams);
    // Also save under original txid pointer
    if (pos.txid !== txid) {
      saveLocalPositionParams(pos.txid, updatedParams);
    }
  }

  return {
    txid,
    dockedSats: dockedSats.toString(),
    remainSats: remainSats.toString(),
    dockedTokens: dockedTokens > 0n ? dockedTokens.toString() : undefined,
    remainTokens: remainTokens > 0n ? remainTokens.toString() : undefined,
    isPartial,
    newVout: isPartial ? 1 : undefined,
  };
}

