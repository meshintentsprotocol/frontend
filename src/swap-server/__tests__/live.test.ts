import { describe, it, expect } from 'vitest';
import { ethers } from 'ethers';
import { Connection, Keypair } from '@solana/web3.js';
import { createSwapServerApi } from '../api';
import { startBridge, type BridgeDeps } from '../flows';
import { createJournal } from '../journal';
import { evmProvider, evmSignerFor, evmUsdcBalance } from '../signers';
import { localChain } from '../cctpChains';
import type { ActivityItem, CctpChain } from '../types';

/**
 * Real transfers on testnet through this module's own client, signers and flow, against a running swap server.
 * Skipped unless asked for, because it spends testnet USDC and takes a minute:
 *
 *   SWAP_SERVER_LIVE=1 E2E_EVM_KEY=0x… [E2E_SOLANA_KEY=…] npx vitest run src/swap-server/__tests__/live.test.ts
 *
 * The keys are the test wallets of arc-cctp/cctp-swap-server/.env. SWAP_SERVER_URL defaults to localhost:3012.
 */
const live = process.env.SWAP_SERVER_LIVE === '1';
const api = createSwapServerApi(process.env.SWAP_SERVER_URL || 'http://localhost:3012');
const memory = () => { const m = new Map<string, string>(); return createJournal({ getItem: k => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); } }); };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Follow one record through /activity the way the UI does, until it is final. */
async function follow(id: string, addresses: string[], timeoutMs = 150_000): Promise<{ row: ActivityItem; phases: string[]; statuses: string[] }> {
    const phases: string[] = [], statuses: string[] = [];
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        const row = (await api.getActivity(addresses, { limit: 20 })).items.find(i => i.id === id);
        if (row) {
            if (phases.at(-1) !== row.phase) phases.push(row.phase);
            if (statuses.at(-1) !== row.status) statuses.push(row.status);
            if (row.terminal) return { row, phases, statuses };
        }
        if (Date.now() > deadline) throw new Error(`not final after ${timeoutMs / 1000}s: ${statuses.join(' → ')}`);
        await sleep(1500);
    }
}

describe.skipIf(!live)('live: cross-chain USDC through the frontend module', () => {
    it('Arc → Base Sepolia from the EVM test wallet: three signatures, followed to delivery', async () => {
        const key = process.env.E2E_EVM_KEY;
        if (!key) throw new Error('E2E_EVM_KEY is not set');
        const wallet = new ethers.Wallet(key);
        const config = await api.getConfig();
        const chain = (k: string) => config.cctp.chains.find(c => c.key === k) as CctpChain;
        const src = chain('arc-testnet'), dst = chain('base-sepolia');

        const have = await evmUsdcBalance(src, wallet.address);
        expect(have, `the test wallet needs about 1.5 USDC on ${src.name} (USDC is also the gas there)`).toBeGreaterThan(1_500_000n);
        const before = await evmUsdcBalance(dst, wallet.address);

        const journal = memory();
        const seen: string[] = [];
        const deps: BridgeDeps = {
            api, journal,
            evmSigner: c => evmSignerFor(c, wallet),
            chainKnows: async (c, hash) => (await evmProvider(c).getTransaction(hash)) !== null,
            onProgress: p => seen.push(`${p.step}:${p.state}`),
        };
        const { transfer, quote } = await startBridge({ src, dst, amount: '1', sender: wallet.address, recipient: wallet.address }, deps);

        expect(seen[0]).toBe('create:active');
        expect(seen).toContain('burn:done');
        expect(transfer.burnTxHash).toMatch(/^0x[0-9a-f]{64}$/);
        expect(journal.all()).toEqual({});                                 // every hash reached the server
        const feeCharged = BigInt(quote.protocolFee) > 0n;
        if (feeCharged) expect(seen).toContain('fee:done');

        const { row, phases, statuses } = await follow(transfer.id, [wallet.address]);
        console.log(`  ${src.name} → ${dst.name}: ${statuses.join(' → ')} | signed steps: ${seen.filter(s => s.endsWith(':done')).join(', ')}`);
        expect(row.phase).toBe('completed');
        expect(phases).toContain('processing');
        expect(row.buy.estimated).toBe(false);
        expect(row.links.source).toContain(transfer.burnTxHash);
        expect(row.links.destination).toMatch(/^https:\/\//);
        if (feeCharged) expect(row.fee).toMatchObject({ amount: quote.protocolFee, status: 'paid' });

        // what the row says arrived is what arrived
        let after = before;
        for (let i = 0; i < 10 && after === before; i++) { await sleep(1500); after = await evmUsdcBalance(dst, wallet.address); }
        expect(after - before).toBe(BigInt(row.buy.amount));
    }, 240_000);

    it.skipIf(!process.env.E2E_SOLANA_KEY)('Solana devnet → Arc from the Solana test wallet: one signature on the server-built burn', async () => {
        const raw = process.env.E2E_SOLANA_KEY!;
        const secret = raw.trim().startsWith('[') ? Uint8Array.from(JSON.parse(raw)) : ethers.getBytes(ethers.toBeHex(ethers.decodeBase58(raw.trim()), 64));
        const keypair = Keypair.fromSecretKey(secret);
        const evm = new ethers.Wallet(process.env.E2E_EVM_KEY!);
        const config = await api.getConfig();
        const chain = (k: string) => config.cctp.chains.find(c => c.key === k) as CctpChain;
        const src = chain('solana-devnet'), dst = chain('arc-testnet');
        const connection = new Connection(process.env.SOLANA_DEVNET_RPC || localChain(src.key)!.rpc, 'confirmed');
        const before = await evmUsdcBalance(dst, evm.address);

        const journal = memory();
        const { transfer } = await startBridge({ src, dst, amount: '1', sender: keypair.publicKey.toBase58(), recipient: evm.address }, {
            api, journal,
            solana: { keypair, send: rawTx => connection.sendRawTransaction(rawTx) },
        });
        expect(transfer.burnTxHash).toBeTruthy();
        expect(journal.all()).toEqual({});

        const { row, statuses } = await follow(transfer.id, [keypair.publicKey.toBase58(), evm.address]);
        console.log(`  ${src.name} → ${dst.name}: ${statuses.join(' → ')}`);
        expect(row.phase).toBe('completed');
        expect(row.owner).toBe(keypair.publicKey.toBase58());
        let after = before;
        for (let i = 0; i < 10 && after === before; i++) { await sleep(1500); after = await evmUsdcBalance(dst, evm.address); }
        // Arc pays gas in USDC, but the recipient pays none for a mint: the difference is the delivered amount.
        expect(after - before).toBe(BigInt(row.buy.amount));
    }, 240_000);
});
