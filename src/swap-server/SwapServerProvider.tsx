/**
 * Everything the app knows about the swap server, in one place: its config, the connected wallet's history, and
 * the transfer this page is signing right now.
 *
 * The server is the source of truth. History is whatever GET /activity answers for the in-app wallet's addresses,
 * so a reload or another device shows the same rows. The only things kept in the browser are the signing journal
 * (flows.ts) and which records have already been announced.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Keypair } from '@solana/web3.js';
import { useWDK } from '@/context/WDKProvider';
import { notifyToast } from '@/lib/notify-toast';
import { ActivityService } from '@/lib/activity';
import { describeError, swapServerApiFor, swapServerConfigured, type SwapServerApi } from './api';
import { SwapServerContext, type HistoryView, type SwapOperation, type SwapServerContextValue } from './context';
import { runSolanaSwap } from './solana';
import { BurnNotReported, FeeNotSent, flushJournal, payFee, resumeBridge, selfMint as selfMintFlow, startBridge, type BridgeDeps, type BridgeProgress } from './flows';
import { createJournal } from './journal';
import { evmProvider, evmSignerFor, toBase64 } from './signers';
import type { BchOperation, Operation } from './steps';
import type { ActivityItem, BchSwapRecord, CctpChain, SolanaSwap, Transfer } from './types';

const KEY = ['swap-server'] as const;
const NOTIFIED_KEY = 'swap_server_notified_v1';

function readNotified(): string[] {
    try { const v = JSON.parse(localStorage.getItem(NOTIFIED_KEY) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
function markNotified(id: string) {
    try { localStorage.setItem(NOTIFIED_KEY, JSON.stringify([id, ...readNotified().filter(x => x !== id)].slice(0, 100))); } catch { /* private window */ }
}

/** One toast and one wallet-activity record when a transfer or swap reaches its end. */
function announce(i: ActivityItem) {
    const what = i.kind === 'transfer' ? 'Bridge' : 'Swap';
    const route = i.kind === 'transfer' ? `${i.sell.chainName} → ${i.buy.chainName}` : `${i.sell.symbol ?? '?'} → ${i.buy.symbol ?? '?'}`;
    const got = `${i.buy.display ?? '?'} ${i.buy.symbol ?? ''}`.trim();
    if (i.phase === 'completed') {
        notifyToast.success(i.kind === 'transfer' ? `${got} arrived on ${i.buy.chainName}` : `Swapped to ${got}`, { description: route });
    } else if (i.phase === 'failed') {
        notifyToast.error(`${what} failed`, { description: i.failReason ? `${route}: ${i.failReason}` : route });
    } else {
        return;   // an expired record never moved anything: nothing to announce
    }
    ActivityService.addActivity({
        type: i.kind === 'transfer' ? 'bridge' : 'swap',
        assetIn: i.sell.symbol, assetOut: i.buy.symbol,
        amountIn: Number(i.sell.display ?? 0), amountOut: Number(i.buy.display ?? 0),
        valueUsd: i.usdValue,
        txHash: i.transfer?.mintTxHash ?? i.swap?.signature ?? i.transfer?.burnTxHash ?? i.id,
        network: i.kind === 'transfer' ? route : 'Solana',
        explorerUrl: i.links.destination ?? i.links.source,
        description: `${what}: ${i.sell.display ?? '?'} ${i.sell.symbol ?? ''} → ${got} (${route})`,
        status: i.phase === 'completed' ? 'confirmed' : 'failed',
        metadata: { swapServerId: i.id, product: i.product, network: i.network },
    });
}

export function SwapServerProvider({ children, api: fixedApi }: { children: ReactNode; api?: SwapServerApi }) {
    const wdk = useWDK();
    const queryClient = useQueryClient();
    const isMainnet = wdk.bchNetwork === 'mainnet';
    // Each mode has its server (see swapServerApiFor). What was fetched from one is never shown for the other.
    const api = fixedApi ?? swapServerApiFor(isMainnet);
    const lastApi = useRef(api);
    useEffect(() => {
        if (lastApi.current === api) return;
        lastApi.current = api;
        void queryClient.resetQueries({ queryKey: KEY });
    }, [api, queryClient]);
    const journal = useMemo(() => createJournal(), []);

    // The provider wraps the whole app, but only the trade page shows its data. Nothing is fetched until a
    // component that needs it mounts, or a dead page left hashes behind that still have to be reported.
    const [active, setActive] = useState(() => Object.keys(journal.all()).length > 0);
    const activate = useCallback(() => setActive(true), []);
    const on = active && swapServerConfigured;

    // ── config ──
    const configQuery = useQuery({
        queryKey: [...KEY, 'config', api.baseUrl],
        queryFn: ({ signal }) => api.getConfig({ signal }),
        enabled: on,
        staleTime: 30_000, refetchInterval: 60_000, retry: 1,
    });
    const config = configQuery.data;
    const chain = useCallback((key: string) => config?.cctp.chains.find(c => c.key === key), [config]);

    // ── the signing flow's view of the wallet ──
    const solanaSecret: Uint8Array | undefined = wdk.solanaSigner?.secretKey;
    const keypair = useMemo(() => {
        try { return solanaSecret ? Keypair.fromSecretKey(solanaSecret) : undefined; } catch { return undefined; }
    }, [solanaSecret]);
    const evmWallet = wdk.evmSigner;

    const deps = useMemo((): BridgeDeps => ({
        api, journal,
        evmSigner: evmWallet ? c => evmSignerFor(c, evmWallet) : undefined,
        // Solana goes through the server on both networks: its public mainnet RPC refuses browsers. The server
        // sends the burn and registers it in one step; the flow's own report after it is then a no-op.
        solana: keypair ? { keypair, send: async (raw, id) => (await api.broadcastBurn(id, toBase64(raw))).burnTxHash! } : undefined,
        chainKnows: async (c, hash) => (c.kind === 'evm' ? (await evmProvider(c).getTransaction(hash)) !== null : api.chainKnowsTx(c.key, hash)),
    }), [api, journal, evmWallet, keypair]);

    // ── history ──
    const addresses = useMemo(() => [wdk.evmAddress, wdk.solanaAddress].filter((a): a is string => !!a), [wdk.evmAddress, wdk.solanaAddress]);
    const [operation, setOperation] = useState<Operation | null>(null);
    const opRef = useRef<Operation | null>(null);
    opRef.current = operation;
    const [swapOperation, setSwapOperation] = useState<SwapOperation | null>(null);
    const swapRef = useRef<SwapOperation | null>(null);
    swapRef.current = swapOperation;

    const activityQuery = useQuery({
        queryKey: [...KEY, 'activity', api.baseUrl, addresses],
        queryFn: async ({ signal }) => ({ ...(await api.getActivity(addresses, { limit: 50 }, { signal })), receivedAt: Date.now() }),
        enabled: on && addresses.length > 0,
        // Fast while something is moving, slow otherwise. The query client already pauses polling in a hidden tab.
        refetchInterval: q => (opRef.current?.busy || swapRef.current?.busy || q.state.data?.items.some(i => !i.terminal) ? 5_000 : 30_000),
        staleTime: 2_000, retry: 1,
    });
    const activity = activityQuery.data?.items;
    const network = isMainnet ? 'mainnet' : 'testnet';
    const rows = useMemo(() => (activity ?? []).filter(i => i.network === network), [activity, network]);
    const openCount = useMemo(() => rows.filter(i => !i.terminal).length, [rows]);
    const activeCount = useMemo(() => rows.filter(i => i.phase === 'processing' || i.phase === 'action_needed').length, [rows]);
    const refresh = useCallback(() => { void queryClient.invalidateQueries({ queryKey: [...KEY, 'activity'] }); }, [queryClient]);
    const refreshBalances = useCallback(() => { void queryClient.invalidateQueries({ queryKey: [...KEY, 'usdc-balance'] }); }, [queryClient]);

    // ── announce a record once, when this session watched it reach its end ──
    const watched = useRef(new Set<string>());
    useEffect(() => {
        if (!activity) return;
        let finished = false;
        for (const i of activity) {
            if (!i.terminal) { watched.current.add(i.id); continue; }
            if (!watched.current.has(i.id)) continue;
            watched.current.delete(i.id);
            finished = true;
            if (readNotified().includes(i.id)) continue;
            markNotified(i.id);
            announce(i);
        }
        if (finished) refreshBalances();
    }, [activity, refreshBalances]);

    // ── the journal: report hashes a dead page left behind ──
    useEffect(() => {
        if (!config) return;
        let stopped = false;
        const run = async () => {
            if (stopped || Object.keys(journal.all()).length === 0 || opRef.current?.busy) return;
            const n = await flushJournal({ api, journal, chainKnows: deps.chainKnows }, chain).catch(() => 0);
            if (n > 0) refresh();
        };
        void run();
        const timer = setInterval(run, 15_000);
        return () => { stopped = true; clearInterval(timer); };
    }, [config, api, journal, deps.chainKnows, chain, refresh]);

    // ── the dialog ──
    const [dialog, setDialog] = useState<{ open: boolean; id: string | null; kind: 'transfer' | 'swap' | 'bch' }>({ open: false, id: null, kind: 'transfer' });
    const showDialog = useCallback((id: string | null = null, kind: 'transfer' | 'swap' | 'bch' = 'transfer') => setDialog({ open: true, id, kind }), []);
    const hideDialog = useCallback(() => setDialog(d => ({ ...d, open: false })), []);

    // ── signing ──
    /** Put a record the signing flow got back into the dialog's cache, unless the dialog already has a newer one. */
    const remember = useCallback((t: Transfer) => {
        queryClient.setQueryData<Transfer>([...KEY, 'transfer', t.id], old => (!old || t.updatedAt >= old.updatedAt ? t : old));
    }, [queryClient]);
    const track = useCallback((p: BridgeProgress) => {
        setOperation(o => o && {
            ...o, id: p.transfer?.id ?? o.id, steps: p.steps.length > 1 || o.steps.length <= 1 ? p.steps : o.steps, step: p.step,
            done: p.state === 'done' && !o.done.includes(p.step) ? [...o.done, p.step] : o.done,
        });
        if (p.transfer) {
            watched.current.add(p.transfer.id);
            // The dialog polls this record every few seconds; hand it each fresh copy at once, so it never shows
            // "waiting for your signature" for a burn that has just been reported.
            remember(p.transfer);
        }
    }, [remember]);

    /** Run one signing flow. Only one at a time: two would fight over the wallet's nonce. */
    const sign = useCallback(async (start: Operation, flow: (d: BridgeDeps) => Promise<Transfer>): Promise<Transfer | undefined> => {
        if (opRef.current?.busy) return undefined;
        opRef.current = start;
        setOperation(start);
        setDialog({ open: true, id: null, kind: 'transfer' });
        try {
            const transfer = await flow({ ...deps, onProgress: track });
            remember(transfer);
            setOperation(o => o && { ...o, id: transfer.id, busy: false });
            return transfer;
        } catch (e) {
            const id = e instanceof BurnNotReported || e instanceof FeeNotSent ? e.transferId : undefined;
            const message = e instanceof BurnNotReported || e instanceof FeeNotSent ? e.message : describeError(e);
            setOperation(o => o && { ...o, id: id ?? o.id, busy: false, error: message });
            notifyToast.error(e instanceof FeeNotSent ? 'Service fee not sent' : e instanceof BurnNotReported ? 'Transfer sent, not yet tracked' : 'Transfer not sent', { description: message });
            return undefined;
        } finally {
            refresh();
            refreshBalances();
        }
    }, [deps, track, refresh, refreshBalances, remember]);

    const bridge = useCallback(async ({ src, dst, amount }: { src: CctpChain; dst: CctpChain; amount: string }) => {
        const sender = src.kind === 'evm' ? wdk.evmAddress : wdk.solanaAddress;
        const recipient = dst.kind === 'evm' ? wdk.evmAddress : wdk.solanaAddress;
        if (!sender || !recipient) { notifyToast.error('Connect your wallet first'); return undefined; }
        return sign(
            { src: src.key, dst: dst.key, amount, steps: ['create'], step: 'create', done: [], busy: true, startedAt: Date.now() },
            async d => (await startBridge({ src, dst, amount, sender, recipient }, d)).transfer,
        );
    }, [wdk.evmAddress, wdk.solanaAddress, sign]);

    // ── Solana swaps ──
    const swap = useCallback(async (input: { inputMint: string; outputMint: string; amount: string; slippageBps?: number; sell: SwapOperation['sell']; buy: SwapOperation['buy'] }): Promise<SolanaSwap | undefined> => {
        if (swapRef.current?.busy || opRef.current?.busy) return undefined;
        if (!keypair || !wdk.solanaAddress) { notifyToast.error('Connect your wallet first'); return undefined; }
        const start: SwapOperation = { stage: 'create', busy: true, sell: input.sell, buy: input.buy };
        swapRef.current = start;
        setSwapOperation(start);
        setDialog({ open: true, id: null, kind: 'swap' });
        try {
            const result = await runSolanaSwap(
                { inputMint: input.inputMint, outputMint: input.outputMint, amount: input.amount, taker: wdk.solanaAddress, slippageBps: input.slippageBps },
                { api, keypair, onStage: (stage, s) => { if (s) watched.current.add(s.id); setSwapOperation(o => o && { ...o, stage, id: s?.id ?? o.id }); } },
            );
            const failed = result.status === 'FAILED' || result.status === 'EXPIRED';
            setSwapOperation(o => o && { ...o, id: result.id, busy: false, stage: failed ? 'failed' : 'done', result, error: failed ? (result.failReason ?? 'The swap did not go through') : undefined });
            return failed ? undefined : result;
        } catch (e) {
            const message = describeError(e);
            setSwapOperation(o => o && { ...o, busy: false, stage: 'failed', error: message });
            notifyToast.error('Swap not sent', { description: message });
            return undefined;
        } finally {
            refresh();
            void queryClient.invalidateQueries({ queryKey: [...KEY, 'sol-balances'] });
        }
    }, [api, keypair, wdk.solanaAddress, refresh, queryClient]);

    // ── Bitcoin Cash cross-chain swaps (1Click NEAR Intents) ──
    const [bchOperation, setBchOperation] = useState<BchOperation | null>(null);
    const executeBchSwap = useCallback(async (input: {
        fromAsset: string;
        toAsset: string;
        fromChain?: string;
        toChain?: string;
        amount: string;
        recipient: string;
        refundTo: string;
        slippageBps?: number;
        sell: { symbol: string; display: string };
        buy: { symbol: string; display: string };
    }): Promise<BchSwapRecord | undefined> => {
        setBchOperation({
            stage: 'init',
            busy: true,
            sell: input.sell,
            buy: input.buy,
        });
        setDialog({ open: true, id: null, kind: 'bch' });
        try {
            const swapRecord = await api.createBchSwap({
                fromAsset: input.fromAsset,
                toAsset: input.toAsset,
                fromChain: input.fromChain,
                toChain: input.toChain,
                amount: input.amount,
                recipient: input.recipient,
                refundTo: input.refundTo,
                slippageBps: input.slippageBps,
            });
            setBchOperation({
                id: swapRecord.id,
                stage: 'deposit',
                busy: false,
                sell: input.sell,
                buy: input.buy,
                result: swapRecord,
            });
            setDialog({ open: true, id: swapRecord.id, kind: 'bch' });
            refresh();
            return swapRecord;
        } catch (e) {
            const message = describeError(e);
            setBchOperation(prev => ({
                stage: 'failed',
                busy: false,
                error: message,
                sell: input.sell,
                buy: input.buy,
                id: prev?.id,
            }));
            notifyToast.error('Swap creation failed', { description: message });
            return undefined;
        }
    }, [api, refresh]);

    const rowChain = useCallback((id: string): { row: ActivityItem; src: CctpChain } | undefined => {
        const row = activity?.find(i => i.id === id);
        const src = row?.transfer ? chain(row.transfer.src) : undefined;
        return row && src ? { row, src } : undefined;
    }, [activity, chain]);

    const resume = useCallback(async (id: string) => {
        const found = rowChain(id);
        if (!found) return;
        await sign(
            { id, src: found.src.key, dst: found.row.transfer!.dst, amount: found.row.sell.display ?? '', steps: ['burn'], step: 'burn', done: [], busy: true, startedAt: Date.now() },
            d => resumeBridge(id, found.src, d),
        );
    }, [rowChain, sign]);

    const sendFee = useCallback(async (id: string) => {
        const found = rowChain(id);
        if (!found) return;
        await sign(
            { id, src: found.src.key, dst: found.row.transfer!.dst, amount: found.row.sell.display ?? '', steps: ['fee'], step: 'fee', done: [], busy: true, startedAt: Date.now() },
            d => payFee(id, found.src, d),
        );
    }, [rowChain, sign]);

    // ── delivering an attested transfer from the user's own wallet ──
    const [minting, setMinting] = useState<{ id: string; busy: boolean; error?: string } | null>(null);
    const mintRef = useRef(false);
    const selfMint = useCallback(async (id: string) => {
        const t = queryClient.getQueryData<Transfer>([...KEY, 'transfer', id]) ?? await api.getTransfer(id).catch(() => undefined);
        const dst = t ? chain(t.dst) : undefined;
        if (!dst || mintRef.current || opRef.current?.busy) return;
        mintRef.current = true;
        setMinting({ id, busy: true });
        try {
            const done = await selfMintFlow(id, dst, deps);
            remember(done.transfer);
            setMinting(null);
            notifyToast.success('Delivery sent', { description: `Your USDC is arriving on ${dst.name}.` });
        } catch (e) {
            const message = describeError(e);
            setMinting({ id, busy: false, error: message });
            notifyToast.error('Delivery not sent', { description: message });
        } finally {
            mintRef.current = false;
            refresh();
            refreshBalances();
        }
    }, [api, chain, deps, queryClient, remember, refresh, refreshBalances]);

    // ── which history the trade page shows ──
    const [historyView, setHistoryView] = useState<HistoryView>('auto');
    const [pairRouted, setPairRouted] = useState(false);
    // A choice made with the pills holds until the pair changes sides, or a new transfer starts.
    const signingNow = !!operation?.busy || !!swapOperation?.busy || !!bchOperation?.busy;
    useEffect(() => { setHistoryView('auto'); }, [pairRouted, signingNow]);
    // Left alone, the page shows ours while the card's pair is ours or a transfer is moving, and then keeps
    // showing it: the row someone was watching must not vanish the moment it completes. It goes back to the
    // order history when the card moves off one of our pairs.
    const wantsOurs = pairRouted || signingNow || activeCount > 0;
    const [stayOurs, setStayOurs] = useState(false);
    useEffect(() => { if (wantsOurs) setStayOurs(true); }, [wantsOurs]);
    const wasRouted = useRef(pairRouted);
    useEffect(() => {
        if (wasRouted.current && !pairRouted) setStayOurs(false);
        wasRouted.current = pairRouted;
    }, [pairRouted]);
    const historyOurs = historyView === 'swap-server' || (historyView === 'auto' && (wantsOurs || stayOurs));

    const value = useMemo((): SwapServerContextValue => ({
        api, activate, isMainnet, config,
        configLoading: on && configQuery.isLoading,
        configError: !swapServerConfigured ? 'This build is not connected to the swap service.' : configQuery.error ? describeError(configQuery.error) : undefined,
        chain,
        evmAddress: wdk.evmAddress, solanaAddress: wdk.solanaAddress,
        rows, rowsReceivedAt: activityQuery.data?.receivedAt ?? 0, rowsLoading: activityQuery.isLoading, openCount, activeCount, refresh,
        operation, bridge, resume, sendFee, swapOperation, swap, bchOperation, executeBchSwap, selfMint, minting, signing: signingNow,
        dialog, showDialog, hideDialog,
        historyView, setHistoryView, historyOurs, pairRouted, setPairRouted,
    }), [api, activate, on, isMainnet, config, configQuery.isLoading, configQuery.error, chain, wdk.evmAddress, wdk.solanaAddress, rows, activityQuery.data?.receivedAt,
        activityQuery.isLoading, openCount, activeCount, refresh, operation, bridge, resume, sendFee, swapOperation, swap, bchOperation, executeBchSwap, selfMint, minting, signingNow, dialog, showDialog, hideDialog, historyView, historyOurs, pairRouted]);

    return <SwapServerContext.Provider value={value}>{children}</SwapServerContext.Provider>;
}
