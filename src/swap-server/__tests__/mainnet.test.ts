import { describe, it, expect } from 'vitest';
import { ethers } from 'ethers';
import { Keypair, SystemProgram, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { SwapServerError } from '../api';
import { cctpInMode, localChain } from '../cctpChains';
import { canSelfMint, SELF_MINT_AFTER_MS, selfMint, startBridge, type BridgeDeps } from '../flows';
import { createJournal } from '../journal';
import { resolveRoute } from '../routing';
import { mintTx, toBase64 } from '../signers';
import { jupiterToken, withJupiterTokens } from '../solana';
import { pairAfterSelect, withCctpTokens } from '../tokens';
import { gasVerdict } from '../useSwapServerCard';
import type { Token } from '@/types';
import type { CctpChain, SolanaBuiltTx, SwapServerConfig, Transfer } from '../types';
import testnet from './fixtures.json';
import mainnet from './fixtures.mainnet.json';

/**
 * Cross-chain USDC on mainnet, the gas check and the manual delivery. The mainnet config and quote were recorded
 * from a server running with CCTP_NETWORK=mainnet; nothing here touches a network.
 */
const config = mainnet.config as unknown as SwapServerConfig;
const testnetConfig = testnet.config as unknown as SwapServerConfig;
const chain = (key: string) => config.cctp.chains.find(c => c.key === key) as CctpChain;
const BASE = chain('base'), ARB = chain('arbitrum'), SOLANA = chain('solana'), ARC = chain('arc');
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

// The static list as the card has it in Mainnet mode: BCH, the testnet USDC row on Ethereum, the placeholders.
const BCH: Token = { symbol: 'BCH', name: 'Bitcoin Cash', icon: '', decimals: 8, type: 'native', chain: 'bch' };
const SEPOLIA_USDC: Token = { symbol: 'USDC', name: 'USD Coin (Sepolia)', icon: '', decimals: 6, type: 'erc20', chain: 'ethereum', address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' };
const BASE_SOON: Token = { symbol: 'USDC', name: 'USD Coin (Base)', icon: '', decimals: 6, type: 'erc20', chain: 'base', disabled: true, comingSoon: true };
const SOL: Token = { symbol: 'SOL', name: 'Solana', icon: '', decimals: 9, type: '11111111111111111111111111111111', chain: 'solana', address: config.solana.nativeMint };
const STATIC = [BCH, SEPOLIA_USDC, BASE_SOON, SOL];
const JUP_USDC = { mint: USDC_MINT, symbol: 'USDC', name: 'USD Coin', decimals: 6, verified: true, suspicious: false, tags: [], isStock: false, usdPrice: 1 };

describe('the recorded mainnet config', () => {
    it('is mainnet, and every chain is one this app can sign for', () => {
        expect(config.cctp.network).toBe('mainnet');
        expect(config.cctp.chains.map(c => c.key).sort()).toEqual(['arbitrum', 'arc', 'base', 'ethereum', 'optimism', 'solana']);
        for (const c of config.cctp.chains) expect(localChain(c.key), c.key).toBeDefined();
        expect(config.cctp.chains.find(c => c.key === 'ethereum')!.chainId).toBe(1);
        expect(BASE.chainId).toBe(8453);
        expect(SOLANA.usdc).toBe(USDC_MINT);
    });

    it('a server is used for cross-chain USDC only in the mode of its network', () => {
        expect(cctpInMode(config, true)).toBe(true);
        expect(cctpInMode(config, false)).toBe(false);
        expect(cctpInMode(testnetConfig, true)).toBe(false);
        expect(cctpInMode(undefined, true)).toBe(false);
    });
});

describe('the selector in Mainnet mode', () => {
    const list = withCctpTokens(withJupiterTokens(STATIC, [JUP_USDC], true), config, true);
    const on = (c: string) => list.filter(t => t.chain === c && t.symbol === 'USDC');

    it('real USDC joins next to the testnet row on Ethereum instead of being mistaken for it', () => {
        expect(on('ethereum').map(t => t.address)).toEqual([SEPOLIA_USDC.address, chain('ethereum').usdc]);
        expect(on('ethereum')[1].swapServer).toEqual({ product: 'cctp', chainKey: 'ethereum' });
    });
    it('a placeholder is replaced and Arc is added', () => {
        expect(on('base')).toHaveLength(1);
        expect(on('base')[0]).toMatchObject({ address: BASE.usdc, swapServer: { product: 'cctp', chainKey: 'base' } });
        expect(on('base')[0].disabled).toBeUndefined();
        expect(on('arc')).toHaveLength(1);
    });
    it('Jupiter\'s USDC is the one Solana USDC row: it swaps and it bridges', () => {
        expect(on('solana')).toHaveLength(1);
        expect(on('solana')[0].swapServer?.product).toBe('jupiter');
    });
    it('nothing is added from a testnet server in Mainnet mode, or from a mainnet server in Testnet mode', () => {
        expect(withCctpTokens(STATIC, testnetConfig, true)).toEqual(STATIC);
        expect(withCctpTokens(STATIC, config, false)).toEqual(STATIC);
    });
    it('picking a bridge-only row pairs it with USDC on another chain', () => {
        const baseUsdc = on('base')[0];
        const fix = pairAfterSelect(baseUsdc, BCH, { tokens: list, config, isMainnet: true });
        expect(fix.other?.symbol).toBe('USDC');
        expect(fix.other?.chain).not.toBe('base');
        expect(fix.other?.address).not.toBe(SEPOLIA_USDC.address);
    });
});

describe('routing in Mainnet mode with a mainnet server', () => {
    const list = withCctpTokens(withJupiterTokens(STATIC, [JUP_USDC], true), config, true);
    const usdc = (c: string) => list.find(t => t.chain === c && t.symbol === 'USDC' && !!t.swapServer)!;
    const ctx = { isMainnet: true, config };

    it('USDC on two chains is a transfer', () => {
        expect(resolveRoute(usdc('base'), usdc('arbitrum'), ctx)).toEqual({ kind: 'usdc-cctp', src: BASE, dst: ARB });
    });
    it('Solana USDC to an EVM chain is a transfer; Solana USDC to SOL is a swap', () => {
        expect(resolveRoute(usdc('solana'), usdc('base'), ctx)).toEqual({ kind: 'usdc-cctp', src: SOLANA, dst: BASE });
        expect(resolveRoute(usdc('solana'), SOL, ctx)).toEqual({ kind: 'sol-jupiter', inputMint: USDC_MINT, outputMint: config.solana.nativeMint });
    });
    it('the testnet USDC row is never bridged as real USDC', () => {
        expect(resolveRoute(SEPOLIA_USDC, usdc('base'), ctx)).toMatchObject({ kind: 'unsupported' });
    });
    it('a bridge-only row against anything else says what it can do', () => {
        expect(resolveRoute(usdc('base'), BCH, ctx)).toEqual({ kind: 'unsupported', reason: 'USDC on Base can only be sent to USDC on another chain.' });
    });
    it('the same chain twice is refused; BCH pairs are left to the existing flows', () => {
        expect(resolveRoute(usdc('base'), usdc('base'), ctx)).toMatchObject({ kind: 'unsupported' });
        expect(resolveRoute(BCH, SOL, ctx)).toBeNull();
    });
    it('with only a testnet server, Mainnet mode still says where cross-chain USDC is', () => {
        const row: Token = { ...usdc('base') };
        expect(resolveRoute(row, usdc('arbitrum'), { isMainnet: true, config: testnetConfig })).toEqual({ kind: 'unsupported', reason: 'Cross-chain USDC is available in Testnet mode.' });
    });
    it('a Jupiter row built before the list loaded still routes by its mint', () => {
        expect(resolveRoute(jupiterToken(JUP_USDC), SOL, ctx)).toMatchObject({ kind: 'sol-jupiter', inputMint: USDC_MINT });
    });
});

describe('the gas check', () => {
    it('compares what the wallet holds with what the transfer needs', () => {
        expect(gasVerdict(0n, 320_000n * 2_000_000_000n, 18, 'ETH')).toEqual({ symbol: 'ETH', have: '0', need: '0.00064', enough: false });
        expect(gasVerdict(10n ** 16n, 320_000n * 2_000_000_000n, 18, 'ETH').enough).toBe(true);
        expect(gasVerdict(5_999_999n, 6_000_000n, 9, 'SOL').enough).toBe(false);
        expect(gasVerdict(6_000_000n, 6_000_000n, 9, 'SOL')).toMatchObject({ have: '0.006', need: '0.006', enough: true });
    });
});

// ── manual delivery ──

const attested = (over: Partial<Transfer> = {}): Transfer => ({
    ...(testnet.completedTransfer as unknown as Transfer), src: 'solana', dst: 'base', status: 'ATTESTED', mintTxHash: undefined, updatedAt: 1_000_000,
    selfMint: { chain: 'base', contract: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64', method: 'receiveMessage(bytes message, bytes attestation)', message: '0x1234', attestation: '0xabcd' },
    ...over,
});

describe('when the manual delivery is offered', () => {
    const late = { relayEnabled: true, now: 1_000_000 + SELF_MINT_AFTER_MS + 1 };
    it('not while the bridge is simply on its way', () => {
        expect(canSelfMint(attested(), BASE, { relayEnabled: true, now: 1_000_000 + 30_000 })).toBe(false);
    });
    it('once the bridge has taken too long, or at once when its delivery is switched off', () => {
        expect(canSelfMint(attested(), BASE, late)).toBe(true);
        expect(canSelfMint(attested(), BASE, { relayEnabled: false, now: 1_000_001 })).toBe(true);
    });
    it('never for Solana, never without an attestation, never after it is delivered', () => {
        expect(canSelfMint(attested(), SOLANA, late)).toBe(false);
        expect(canSelfMint(attested({ selfMint: undefined }), BASE, late)).toBe(false);
        expect(canSelfMint(attested({ status: 'COMPLETED' }), BASE, late)).toBe(false);
        expect(canSelfMint(attested({ status: 'BURN_CONFIRMED' }), BASE, late)).toBe(false);
    });
});

describe('the manual delivery', () => {
    function world(opts: { estimateFails?: boolean; after?: Partial<Transfer> } = {}) {
        const log: string[] = [];
        let record = attested();
        const provider = {
            estimateGas: async () => { if (opts.estimateFails) { record = { ...record, ...opts.after }; throw new Error('execution reverted: Nonce already used'); } return 150_000n; },
            getTransactionCount: async () => 0,
            getFeeData: async () => ({ maxFeePerGas: 2_000_000_000n, maxPriorityFeePerGas: 1_000_000_000n, gasPrice: null }),
            broadcastTransaction: async (signed: string) => {
                const t = ethers.Transaction.from(signed);
                log.push(`broadcast to=${t.to} chain=${t.chainId} data=${t.data.slice(0, 10)}`);
                record = { ...record, status: 'COMPLETED_EXTERNAL', mintTxHash: t.hash! };
                return {};
            },
            waitForTransaction: async () => ({ status: 1 }),
        };
        const wallet = ethers.Wallet.createRandom().connect(provider as unknown as ethers.Provider);
        const deps = { api: { getTransfer: async () => record } as unknown as BridgeDeps['api'], evmSigner: () => wallet };
        return { log, deps };
    }

    it('calls receiveMessage on the destination\'s message transmitter with the attested message', () => {
        const tx = mintTx(BASE, attested().selfMint!);
        expect(tx.to).toBe('0x81D40F21F12A8F0E3252Bccb954D722d4c464B64');
        expect(tx.chainId).toBe(8453);
        const [message, attestation] = new ethers.Interface(['function receiveMessage(bytes message, bytes attestation)']).decodeFunctionData('receiveMessage', tx.data);
        expect([message, attestation]).toEqual(['0x1234', '0xabcd']);
        expect(mintTx(ARC, attested().selfMint!).minMaxFeePerGasGwei).toBe(20);
    });

    it('sends it from the wallet on the destination chain', async () => {
        const w = world();
        const done = await selfMint('id', BASE, w.deps);
        expect(w.log).toEqual(['broadcast to=0x81D40F21F12A8F0E3252Bccb954D722d4c464B64 chain=8453 data=0x57ecfd28']);
        expect(done.transfer.status).toBe('COMPLETED_EXTERNAL');
    });

    it('if the bridge delivered first, nothing is sent and the delivered record comes back', async () => {
        const w = world({ estimateFails: true, after: { status: 'COMPLETED', mintTxHash: '0xbridge' } });
        const done = await selfMint('id', BASE, w.deps);
        expect(w.log).toEqual([]);
        expect(done).toMatchObject({ hash: '0xbridge', transfer: { status: 'COMPLETED' } });
    });

    it('a real refusal is the error', async () => {
        const w = world({ estimateFails: true });
        await expect(selfMint('id', BASE, w.deps)).rejects.toThrow(/reverted/);
    });
});

// ── a Solana burn sent through the server ──

describe('a Solana burn the server refused to send', () => {
    const owner = Keypair.generate();
    const created = testnet.createdFromSolana as unknown as { transfer: Transfer };
    const tx = (): SolanaBuiltTx => {
        const msg = new TransactionMessage({
            payerKey: owner.publicKey, recentBlockhash: '11111111111111111111111111111111',
            instructions: [SystemProgram.transfer({ fromPubkey: owner.publicKey, toPubkey: Keypair.generate().publicKey, lamports: 1 })],
        }).compileToV0Message();
        return { kind: 'burn', chain: 'solana', serializedTx: toBase64(new VersionedTransaction(msg).serialize()), eventAccount: 'x', lastValidBlockHeight: 1 };
    };
    function world(send: (n: number) => Promise<string>) {
        const store = new Map<string, string>();
        const journal = createJournal({ getItem: k => store.get(k) ?? null, setItem: (k, v) => { store.set(k, v); } }, () => 1);
        const log: string[] = [];
        let n = 0;
        const transfer = { ...created.transfer, sender: owner.publicKey.toBase58() };
        const api = {
            createTransfer: async () => ({ transfer, quote: {} as never, txs: [tx()] }),
            rebuildTransfer: async () => { log.push('rebuild'); return { transfer, txs: [tx()] }; },
            submitBurn: async (_id: string, hash: string) => { log.push(`burn ${hash}`); return { ...transfer, status: 'BURN_SUBMITTED' as const, burnTxHash: hash }; },
        } as unknown as BridgeDeps['api'];
        const deps: BridgeDeps = { api, journal, retryDelayMs: 0, solana: { keypair: owner, send: (_raw, id) => { log.push(`send ${id === transfer.id}`); return send(n++); } } };
        return { deps, journal, log, transfer };
    }
    const input = (t: Transfer) => ({ src: chain('solana'), dst: BASE, amount: '1', sender: t.sender, recipient: '0x2222222222222222222222222222222222222222' });

    it('too old: the transfer is rebuilt and signed once more', async () => {
        const w = world(async n => { if (n === 0) throw new SwapServerError(409, 'EXPIRED', 'this transaction is too old to send'); return 'sig'; });
        const { transfer } = await startBridge(input(w.transfer), w.deps);
        expect(w.log).toEqual(['send true', 'rebuild', 'send true', 'burn sig']);
        expect(transfer.burnTxHash).toBe('sig');
    });

    it('rejected: nothing went out, so nothing is left in the journal to block a retry', async () => {
        const w = world(async () => { throw new SwapServerError(400, 'TX_REJECTED', 'Solana refused the transaction'); });
        await expect(startBridge(input(w.transfer), w.deps)).rejects.toMatchObject({ code: 'TX_REJECTED' });
        expect(w.journal.get(w.transfer.id)).toBeUndefined();
    });

    it('no answer: it may have gone out, so the journal keeps the signature', async () => {
        const w = world(async () => { throw new SwapServerError(0, 'UNREACHABLE', 'no answer'); });
        await expect(startBridge(input(w.transfer), w.deps)).rejects.toMatchObject({ code: 'UNREACHABLE' });
        expect(w.journal.get(w.transfer.id)?.burn).toBeTruthy();
    });

    it('already sent (409, not expired): the journal keeps the signature', async () => {
        const w = world(async () => { throw new SwapServerError(409, 'WRONG_STATE', 'transfer is already BURN_SUBMITTED'); });
        await expect(startBridge(input(w.transfer), w.deps)).rejects.toMatchObject({ code: 'WRONG_STATE' });
        expect(w.journal.get(w.transfer.id)?.burn).toBeTruthy();
    });
});
