/**
 * Fund several covenant outputs in ONE transaction from the active BCH wallet.
 *
 * Used for orders the server splits into several intents (TWAP slices): the
 * server returns a funding list `{ to, satoshis, token? }`, and every entry
 * becomes one output here. Token outputs take fungible tokens of their
 * category; BCH comes from plain (token-free) UTXOs only, so the wallet's other
 * tokens are never touched.
 *
 *   main wallet      signs locally with its WIF and broadcasts
 *   external wallet  builds the unsigned tx and asks the wallet to sign and
 *                    broadcast it (WalletConnect bch_signTransaction)
 */
import type { WC2SignTransactionPayload } from '@/lib/wc2Serialize';

export interface FundingOutput {
  to: string;
  satoshis: string;
  token?: { category: string; amount: string };
}

export interface FundingWallet {
  network: 'mainnet' | 'chipnet';
  /** P2PKH cashaddr that holds the funds (and receives BCH change). */
  address: string;
  /** Token-aware cashaddr for token change (defaults to `address`). */
  tokenAddress?: string;
  /** Main wallet: sign locally. */
  wif?: string;
  /** External wallet: sign and broadcast through the wallet. */
  signExternal?: (payload: WC2SignTransactionPayload) => Promise<{ signedTransactionHash: string }>;
  /** Optional multi-address supplier for HD wallets */
  addressSet?: () => Promise<string[]>;
}

// Same size heuristic as the single-intent funding path: 2 sat/byte,
// ~180 bytes per (token) P2PKH input, ~50 per output, 10 overhead.
const feeFor = (inputs: number, outputs: number) => BigInt(Math.ceil((inputs * 180 + outputs * 50 + 10) * 2));
const TOKEN_CHANGE_SATS = 1000n;
const DUST = 546n;

export async function fundCovenants(wallet: FundingWallet, outputs: FundingOutput[], prompt: string): Promise<string> {
  if (!outputs.length) throw new Error('nothing to fund');
  if (!wallet.wif && !wallet.signExternal) throw new Error('no signer for the active wallet');
  const { TransactionBuilder, ElectrumNetworkProvider, SignatureTemplate } = await import('cashscript');
  const provider = new ElectrumNetworkProvider(wallet.network);

  const getUtxos = async () => {
    if (wallet.addressSet) {
      const addresses = await wallet.addressSet();
      const all = await Promise.all(addresses.map(async addr => {
        const uList = await provider.getUtxos(addr);
        return uList.map((u: any) => ({ ...u, address: addr }));
      }));
      return all.flat();
    }
    const uList = await provider.getUtxos(wallet.address);
    return uList.map((u: any) => ({ ...u, address: wallet.address }));
  };
  const utxos: any[] = (await getUtxos()).filter((u: any) => !u.token?.nft);

  // Tokens needed per category, and the token UTXOs that cover them.
  const needTok = new Map<string, bigint>();
  for (const o of outputs) if (o.token) needTok.set(o.token.category, (needTok.get(o.token.category) ?? 0n) + BigInt(o.token.amount));
  const inputs: any[] = [];
  const tokenChange: Array<{ category: string; amount: bigint }> = [];
  for (const [category, need] of needTok) {
    let got = 0n;
    for (const u of utxos.filter(x => x.token?.category === category).sort((a, b) => Number(BigInt(b.token.amount) - BigInt(a.token.amount)))) {
      if (got >= need) break;
      inputs.push(u); got += BigInt(u.token.amount);
    }
    if (got < need) throw new Error(`Insufficient token balance: have ${got}, need ${need}`);
    if (got > need) tokenChange.push({ category, amount: got - need });
  }

  // Plain BCH for the outputs, token change carriers and the fee.
  const outSats = outputs.reduce((a, o) => a + BigInt(o.satoshis), 0n) + BigInt(tokenChange.length) * TOKEN_CHANGE_SATS;
  const plain = utxos.filter(u => !u.token).sort((a, b) => Number(BigInt(b.satoshis) - BigInt(a.satoshis)));
  let inSats = inputs.reduce((a, u) => a + BigInt(u.satoshis), 0n);
  const nOut = () => outputs.length + tokenChange.length + 1;
  while (inSats < outSats + feeFor(inputs.length, nOut())) {
    const u = plain.shift();
    if (!u) throw new Error('Insufficient BCH balance for the outputs and the network fee');
    inputs.push(u); inSats += BigInt(u.satoshis);
  }
  const fee = feeFor(inputs.length, nOut());
  const change = inSats - outSats - fee;

  const { getDummyUnlocker } = await import('@/lib/wc2Serialize');
  const dummyMap = new Map<string, any>();
  const builder = new TransactionBuilder({ provider });
  for (const u of inputs) {
    const inputAddr = u.address || wallet.address;
    let inputUnlocker;
    if (wallet.wif) {
      inputUnlocker = new SignatureTemplate(wallet.wif).unlockP2PKH();
    } else {
      if (!dummyMap.has(inputAddr)) {
        dummyMap.set(inputAddr, await getDummyUnlocker(inputAddr));
      }
      inputUnlocker = dummyMap.get(inputAddr);
    }
    builder.addInput(u, inputUnlocker);
  }

  for (const o of outputs) {
    builder.addOutput(o.token
      ? { to: o.to, amount: BigInt(o.satoshis), token: { category: o.token.category, amount: BigInt(o.token.amount) } }
      : { to: o.to, amount: BigInt(o.satoshis) });
  }
  for (const t of tokenChange) builder.addOutput({ to: wallet.tokenAddress || wallet.address, amount: TOKEN_CHANGE_SATS, token: t });
  if (change >= DUST) builder.addOutput({ to: wallet.address, amount: change });

  if (wallet.wif) return (await builder.send()).txid;

  const { buildWC2SourceOutputs, buildWC2Payload } = await import('@/lib/wc2Serialize');
  const sourceOutputs = await buildWC2SourceOutputs(inputs, inputs.map((_, i) => i), wallet.address);
  const result = await wallet.signExternal!(buildWC2Payload(builder.build(), sourceOutputs, prompt));
  return result.signedTransactionHash;
}
