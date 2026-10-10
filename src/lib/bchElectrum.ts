/**
 * One Electrum connection per BCH network, shared by everything that reads the
 * chain by address: wallet balances, the pool signer, contract funding.
 *
 * Balances are read here, from the same UTXO set transactions are built from,
 * so what a wallet shows is what it can spend.
 */
import { ElectrumNetworkProvider, type Utxo } from 'cashscript';

export type BchNetwork = 'chipnet' | 'mainnet';

const providers = new Map<BchNetwork, ElectrumNetworkProvider>();

export function electrumProviderFor(network: BchNetwork): ElectrumNetworkProvider {
    let p = providers.get(network);
    if (!p) { p = new ElectrumNetworkProvider(network); providers.set(network, p); }
    return p;
}

/** UTXOs of an address. Rejects after `timeoutMs` so a dead server shows as an error, not an endless spinner. */
export function getAddressUtxos(address: string, network: BchNetwork, timeoutMs = 20_000): Promise<Utxo[]> {
    return Promise.race([
        electrumProviderFor(network).getUtxos(address),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('The Bitcoin Cash server did not answer in time.')), timeoutMs)),
    ]);
}
