/**
 * The seed of a new position: a plain wallet output at index 0, spent at
 * input 0 of the genesis (its txid becomes the NFT category). If the wallet
 * has none, it pays itself once and the new output #0 is used unconfirmed.
 */
import type { Utxo } from 'cashscript';
import { sendPoolTx } from '../poolTx';
import type { MeshSigner } from '../signer';
import { buildSeed, findSeed } from './v4Tx';

export async function ensureSeed(signer: MeshSigner, onStatus: (s: string) => void = () => undefined): Promise<Utxo> {
  const have = findSeed(await signer.getUtxos());
  if (have) return have;
  onStatus(signer.kind === 'external' ? 'Approve a small self-payment (the position seed) in your wallet…' : 'Preparing the position seed…');
  const txid = await sendPoolTx(signer, await buildSeed(signer), 'Mesh V4: prepare the seed output for a new position (pays yourself)');
  for (let i = 0; i < 20; i++) {
    const u = (await signer.getUtxos()).find(x => x.txid === txid && x.vout === 0);
    if (u) return u;
    await new Promise(r => setTimeout(r, 1500));
  }
  throw new Error('the seed output did not show up in the wallet; try again in a moment');
}
