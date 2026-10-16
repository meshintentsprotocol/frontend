/**
 * MeshSigner — one interface for the two ways an LP signs pool transactions.
 *
 *   LocalWifSigner     built-in wallet (WDK / mainnet-js seed): signs in the page
 *   ExternalWcSigner   Paytaca / Cashonize over WalletConnect or WizardConnect:
 *                      the tx is built with placeholders and the wallet signs
 *                      (and broadcasts) it via bch_signTransaction
 *
 * The owner key hash is always the hash of the wallet's P2PKH address (the
 * compressed public key), so a pool created in one wallet shows as "mine" in
 * any wallet holding the same key.
 */
import {
  SignatureTemplate, TransactionBuilder, placeholderP2PKHUnlocker, placeholderPublicKey, placeholderSignature,
  type Contract, type NetworkProvider, type Unlocker, type Utxo,
} from 'cashscript';
import {
  binToHex, cashAddressToLockingBytecode, decodePrivateKeyWif, encodeCashAddress, hash160, lockingBytecodeToCashAddress,
  secp256k1, stringify,
} from '@bitauth/libauth';

export type BchNetwork = 'chipnet' | 'mainnet';

export interface MeshSigner {
  kind: 'local' | 'external';
  network: BchNetwork;
  provider: NetworkProvider;
  /** P2PKH cashaddr (non-token form) — BCH change goes here. */
  address: string;
  /** Token-aware form of the same address — token outputs go here. */
  tokenAddress: string;
  /** Locking bytecode of the address (for outputs that bypass address checks). */
  lockingBytecode: Uint8Array;
  /** hash160 of the wallet's compressed public key, hex. */
  pkh: string;
  getUtxos(): Promise<Utxo[]>;
  p2pkhUnlocker(): Unlocker;
  /** StrategyCovenantV2.dock(ownerPk, ownerSig) unlocker for `contract`. */
  dockUnlocker(contract: Contract): Unlocker;
  /**
   * Sign and broadcast; resolves to the txid. `raw` skips cashscript's local
   * debug pass (its libauth VM predates the 2026 rules and refuses NFT
   * commitments over 40 bytes, e.g. a V4 position NFT): the node validates.
   */
  send(builder: TransactionBuilder, userPrompt: string, opts?: SendOpts): Promise<string>;
  /** Bytes the signer adds per unsigned P2PKH input when the tx is built with placeholders. */
  unsignedInputPadding: number;
}

export interface SendOpts { raw?: boolean }

const prefixOf = (network: BchNetwork) => (network === 'mainnet' ? 'bitcoincash' : 'bchtest');

function lockingOf(address: string): Uint8Array {
  const r = cashAddressToLockingBytecode(address);
  if (typeof r === 'string') throw new Error(`invalid address ${address}: ${r}`);
  return r.bytecode;
}

/** 20-byte pkh hex of a P2PKH address. */
export function pkhOfAddress(address: string): string {
  const b = lockingOf(address);
  if (b.length !== 25 || b[0] !== 0x76 || b[1] !== 0xa9 || b[2] !== 0x14) throw new Error('not a P2PKH address');
  return binToHex(b.slice(3, 23));
}

export function tokenAddressOf(address: string, network: BchNetwork): string {
  const r = lockingBytecodeToCashAddress({ bytecode: lockingOf(address), prefix: prefixOf(network), tokenSupport: true });
  if (typeof r === 'string') throw new Error(r);
  return r.address;
}

/** Built-in wallet: signs locally with the WIF. */
export class LocalWifSigner implements MeshSigner {
  readonly kind = 'local' as const;
  readonly address: string;
  readonly tokenAddress: string;
  readonly lockingBytecode: Uint8Array;
  readonly pkh: string;
  readonly publicKey: Uint8Array;
  readonly unsignedInputPadding = 0;
  private sig: SignatureTemplate;

  constructor(wif: string, readonly network: BchNetwork, readonly provider: NetworkProvider) {
    const decoded = decodePrivateKeyWif(wif);
    if (typeof decoded === 'string') throw new Error(`invalid WIF: ${decoded}`);
    const pub = secp256k1.derivePublicKeyCompressed(decoded.privateKey);
    if (typeof pub === 'string') throw new Error(pub);
    this.publicKey = pub;
    const pkh = hash160(pub);
    this.pkh = binToHex(pkh);
    this.address = encodeCashAddress({ prefix: prefixOf(network), type: 'p2pkh', payload: pkh }).address;
    this.tokenAddress = encodeCashAddress({ prefix: prefixOf(network), type: 'p2pkhWithTokens', payload: pkh }).address;
    this.lockingBytecode = lockingOf(this.address);
    this.sig = new SignatureTemplate(wif);
  }

  getUtxos(): Promise<Utxo[]> { return this.provider.getUtxos(this.address); }
  p2pkhUnlocker(): Unlocker { return this.sig.unlockP2PKH(); }
  dockUnlocker(contract: Contract): Unlocker { return contract.unlock.dock(this.publicKey, this.sig); }
  async send(builder: TransactionBuilder, _prompt?: string, opts?: SendOpts): Promise<string> {
    if (opts?.raw) return this.provider.sendRawTransaction(builder.build());
    const r = await builder.send();
    return r.txid;
  }
}

/** Payload sent to bch_signTransaction (libauth extended JSON, JSON-safe). */
export type WcSignRequest = Record<string, unknown>;
export type WcSignFn = (payload: WcSignRequest) => Promise<{ signedTransactionHash: string }>;

/** External wallet: builds with placeholders; the wallet signs and broadcasts. */
export class ExternalWcSigner implements MeshSigner {
  readonly kind = 'external' as const;
  readonly tokenAddress: string;
  readonly lockingBytecode: Uint8Array;
  readonly pkh: string;
  // P2PKH unlocking bytecode (65-byte schnorr sig + 33-byte pubkey + pushes) the wallet fills in
  readonly unsignedInputPadding = 100;

  constructor(readonly address: string, readonly network: BchNetwork, readonly provider: NetworkProvider, private sign: WcSignFn) {
    this.pkh = pkhOfAddress(address);
    this.tokenAddress = tokenAddressOf(address, network);
    this.lockingBytecode = lockingOf(address);
  }

  getUtxos(): Promise<Utxo[]> { return this.provider.getUtxos(this.address); }
  p2pkhUnlocker(): Unlocker { return placeholderP2PKHUnlocker(this.address) as unknown as Unlocker; }
  dockUnlocker(contract: Contract): Unlocker { return contract.unlock.dock(placeholderPublicKey(), placeholderSignature()); }
  async send(builder: TransactionBuilder, userPrompt: string): Promise<string> {
    const wcObject = builder.generateWcTransactionObject({ broadcast: true, userPrompt });
    const payload = JSON.parse(stringify(wcObject)) as WcSignRequest;
    const r = await this.sign(payload);
    if (!r?.signedTransactionHash) throw new Error('wallet did not return a transaction hash');
    return r.signedTransactionHash;
  }
}
