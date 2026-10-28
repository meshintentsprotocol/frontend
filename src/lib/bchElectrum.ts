/**
 * One Electrum connection per BCH network, shared by everything that reads the
 * chain by address: wallet balances, the pool signer, contract funding.
 *
 * Balances are read here, from the same UTXO set transactions are built from,
 * so what a wallet shows is what it can spend.
 */
import { ElectrumNetworkProvider, type Utxo } from 'cashscript';

export type BchNetwork = 'chipnet' | 'mainnet';

type Params = Parameters<ElectrumNetworkProvider['performRequest']>[1][];
type Response = Awaited<ReturnType<ElectrumNetworkProvider['performRequest']>>;

/**
 * Electrum servers. cashscript's chipnet default (chipnet.bch.ninja) stopped
 * answering (2026-10-28); chipnet.imaginary.cash is the one the Mesh server
 * uses. Mainnet keeps cashscript's default. Both can be set in the env.
 */
const env = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {});
export const ELECTRUM_HOSTS: Record<BchNetwork, string | undefined> = {
    chipnet: env.VITE_BCH_ELECTRUM_CHIPNET || 'chipnet.imaginary.cash',
    mainnet: env.VITE_BCH_ELECTRUM_MAINNET || undefined,
};

const REQUEST_TIMEOUT_MS = 30_000;
const UNREACHABLE = 'Could not reach the Bitcoin Cash server. Try again in a moment.';

/** Errors that mean the socket, not the request, failed (a failed connect rejects with no error at all). */
const CONNECTION_ERROR = /socket|disconnected server|connection|timed out|did not answer/i;
const messageOf = (e: unknown) => (e instanceof Error ? e.message : typeof e === 'string' ? e : '');
const isConnectionError = (e: unknown) => { const m = messageOf(e); return !m || CONNECTION_ERROR.test(m); };
const readable = (e: unknown) => (messageOf(e) ? e : new Error(UNREACHABLE));

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('The Bitcoin Cash server did not answer in time.')), ms);
        p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
    });
}

/**
 * cashscript's provider connects before and disconnects after every request.
 * When requests overlap (a balance refresh while a transaction is being built)
 * one can try to open the socket while another is reconnecting ("Cannot initiate
 * a new socket connection when an existing connection exists"), and a failed
 * request leaves its count behind, so the shared client can stay wedged.
 *
 * This provider runs the requests one at a time with a time limit and, after a
 * connection error, starts over with a fresh client and tries the request once
 * more (never a broadcast: it may have reached the server).
 */
export class SerialElectrumProvider extends ElectrumNetworkProvider {
    private queue: Promise<unknown> = Promise.resolve();
    private readonly hostname?: string;
    private readonly newClient?: () => unknown;
    private readonly timeoutMs: number;

    constructor(network: BchNetwork, opts: { hostname?: string; newClient?: () => unknown; timeoutMs?: number } = {}) {
        super(network, opts.newClient ? { electrum: opts.newClient() as never } : opts.hostname ? { hostname: opts.hostname } : {});
        this.hostname = opts.hostname;
        this.newClient = opts.newClient;
        this.timeoutMs = opts.timeoutMs ?? REQUEST_TIMEOUT_MS;
    }

    override performRequest(name: string, ...parameters: Params): Promise<Response> {
        const once = () => withTimeout(super.performRequest(name, ...parameters), this.timeoutMs);
        const run = async (): Promise<Response> => {
            try {
                return await once();
            } catch (e) {
                if (!isConnectionError(e)) throw e;
                await this.reset();
                if (name === 'blockchain.transaction.broadcast') throw readable(e);
                try {
                    return await once();
                } catch (e2) {
                    if (isConnectionError(e2)) await this.reset();
                    throw readable(e2);
                }
            }
        };
        const p = this.queue.then(run, run);
        this.queue = p.catch(() => undefined);
        return p;
    }

    /** Drop the current client (and its request count) for a new one. */
    private async reset(): Promise<void> {
        const self = this as unknown as { electrum: { disconnect: (force?: boolean) => Promise<unknown> }; concurrentRequests: number; instantiateElectrumClient: (n: string, o: object) => unknown };
        try { await withTimeout(self.electrum.disconnect(true), 5_000); } catch { /* already gone */ }
        self.electrum = (this.newClient ? this.newClient() : self.instantiateElectrumClient(this.network, this.hostname ? { hostname: this.hostname } : {})) as typeof self.electrum;
        self.concurrentRequests = 0;
    }
}

const providers = new Map<BchNetwork, ElectrumNetworkProvider>();

export function electrumProviderFor(network: BchNetwork): ElectrumNetworkProvider {
    let p = providers.get(network);
    if (!p) { p = new SerialElectrumProvider(network, { hostname: ELECTRUM_HOSTS[network] }); providers.set(network, p); }
    return p;
}

/** UTXOs of an address. Rejects after `timeoutMs` so a dead server shows as an error, not an endless spinner. */
export function getAddressUtxos(address: string, network: BchNetwork, timeoutMs = 20_000): Promise<Utxo[]> {
    return Promise.race([
        electrumProviderFor(network).getUtxos(address),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('The Bitcoin Cash server did not answer in time.')), timeoutMs)),
    ]);
}
