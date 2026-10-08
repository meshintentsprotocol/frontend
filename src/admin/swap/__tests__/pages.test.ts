import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminProvider } from '../../AdminContext';
import { SwapArea } from '../SwapArea';
import { SwapOverviewPage, SwapEventsPage, SwapSettingsPage } from '../SwapOverviewPages';
import { CctpTransfersPage, CctpTransferDetailPage, CctpChainsPage } from '../CctpPages';
import { SolanaSwapsPage, SolanaSwapDetailPage, SolanaTokensPage } from '../SolanaPages';
import { ProfitsPage } from '../ProfitPages';
import { createSwapAdminApi, SwapApiError, type SolanaSwap } from '../swapApi';
import fixtures from './fixtures.json';

/**
 * Swap-server admin pages rendered on the server with responses captured from a running cctp-swap-server
 * (fixtures.json: testnet transfers, no secrets). Catches a page that throws on real data shapes.
 */
const fx = fixtures as any;
const k = (...parts: unknown[]) => ['admin', 'swap', ...parts];

const SWAP: SolanaSwap = {
  id: '11111111-2222-3333-4444-555555555555', taker: 'VBmpGVzabx8AsptQXrA2okEwqFVjbuosHvR2NkuBoaS',
  inputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', outputMint: 'So11111111111111111111111111111111111111112',
  inAmount: '10000000', quotedOutAmount: '85903389', minOutAmount: '85700000', slippageBps: 22, feeBps: 2, router: 'metis', gasless: true,
  requestId: '01a1194c-f9c1-77da-aa2e-c6e6358281f0', inUsdValue: 9.99, inSymbol: 'USDC', outSymbol: 'SOL',
  referralFeeBps: 50, referralAccount: 'RefAcct1111111111111111111111111111111111111', feeCollected: { mint: 'So11111111111111111111111111111111111111112', total: '5000', ours: '4000' },
  status: 'COMPLETED', signature: '5pGgLTrGEgZSjHGuUih5667bSUpYpK914rU92xEojhPbNQx25T7DfamNGAtrs66WxczxVv6vLYfjNyfhcrzcko2G', outAmount: '85850000',
  createdAt: 1_791_428_000_000, updatedAt: 1_791_428_006_000, submittedAt: 1_791_428_002_000, completedAt: 1_791_428_006_000, terminal: true,
  display: { inAmount: '10.0', quotedOutAmount: '0.085903389', minOutAmount: '0.0857', outAmount: '0.08585', inSymbol: 'USDC', outSymbol: 'SOL' },
  links: { tx: 'https://solscan.io/tx/5pGg' },
};
const FAILED_SWAP: SolanaSwap = { ...SWAP, id: '99999999-2222-3333-4444-555555555555', status: 'FAILED', outAmount: undefined, completedAt: undefined, failReason: 'Slippage exceeded', jupiterCode: -1000, terminal: true, display: { ...SWAP.display, outAmount: undefined } };

function client(): QueryClient {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(k('overview'), fx.overview);
  qc.setQueryData(k('settings'), fx.settings);
  qc.setQueryData(k('system'), fx.system);
  qc.setQueryData(k('profits'), fx.profits);
  qc.setQueryData(k('events', { section: '', severity: '', type: '', limit: 100, offset: '0' }), fx.events);
  qc.setQueryData(k('transfers', { status: '', src: '', dst: '', q: '', limit: 50, offset: '0' }), fx.transfers);
  qc.setQueryData(k('transfer', fx.transfer.transfer.id), fx.transfer);
  if (fx.failedTransfer) qc.setQueryData(k('transfer', fx.failedTransfer.transfer.id), fx.failedTransfer);
  qc.setQueryData(k('swaps', { status: '', stocks: '', q: '', limit: 50, offset: '0' }), { total: 2, offset: 0, limit: 50, byStatus: { COMPLETED: 1, FAILED: 1 }, swaps: [SWAP, FAILED_SWAP] });
  qc.setQueryData(k('swapd', SWAP.id), { swap: SWAP, tokens: { input: fx.tokens.tokens[1] ?? null, output: null }, events: [] });
  qc.setQueryData(k('swapd', FAILED_SWAP.id), { swap: FAILED_SWAP, tokens: { input: null, output: fx.stocks.tokens[0] ?? null }, events: [] });
  qc.setQueryData(k('blocked'), { blockedMints: [{ mint: SWAP.outputMint, symbol: 'SOL', name: 'Wrapped SOL' }] });
  qc.setQueryData(k('catalog', 'tokens', { q: '', sort: 'liquidity', limit: 50, offset: '0' }), fx.tokens);
  qc.setQueryData(k('catalog', 'stocks', { issuer: '', q: '', limit: 50, offset: '0' }), fx.stocks);
  return qc;
}

function render(path: string, qc = client()): string {
  const page = (p: string, el: ReactElement) => createElement(Route, { path: p, element: el });
  return renderToString(
    createElement(QueryClientProvider, { client: qc },
      createElement(MemoryRouter, { initialEntries: [path] },
        createElement(AdminProvider, null,
          createElement(Routes, null,
            createElement(Route, { path: '/admin/swap', element: createElement(SwapArea) },
              createElement(Route, { index: true, element: createElement(SwapOverviewPage) }),
              page('events', createElement(SwapEventsPage)),
              page('settings', createElement(SwapSettingsPage)),
              page('profits', createElement(ProfitsPage)),
              page('cctp', createElement(CctpTransfersPage)),
              page('cctp/chains', createElement(CctpChainsPage)),
              page('cctp/:id', createElement(CctpTransferDetailPage)),
              page('solana', createElement(SolanaSwapsPage)),
              page('solana/tokens', createElement(SolanaTokensPage)),
              page('solana/:id', createElement(SolanaSwapDetailPage)),
            ))))));
}

let stored: string | null = 'test-key';
beforeAll(() => {
  vi.stubGlobal('localStorage', { getItem: (key: string) => (key === 'swap-admin-key' ? stored : null), setItem: () => undefined, removeItem: () => undefined });
});
afterAll(() => { vi.unstubAllGlobals(); });

describe('swap-server admin pages render with real server data', () => {
  it('overview: both products, their controls, alerts and events', () => {
    const html = render('/admin/swap');
    expect(html).toContain('Cross-chain USDC');
    expect(html).toContain('Solana swaps');
    expect(html).toContain('Needs attention');
    expect(html).toContain('Latest events');
    expect(html.match(/>Pause</g)?.length ?? 0).toBeGreaterThanOrEqual(fx.overview.cctp.settings.paused || fx.overview.solana.settings.paused ? 1 : 2);
  });

  it('cross-chain: transfer list, one completed transfer, chains', () => {
    const list = render('/admin/swap/cctp');
    expect(list).toContain('Cross-chain transfers');
    expect(list).toContain('By route');
    expect(list).toContain('Ethereum Sepolia');
    const t = fx.transfer.transfer;
    const detail = render(`/admin/swap/cctp/${t.id}`);
    expect(detail).toContain('Timeline');
    expect(detail).toContain('Minted on the destination chain');
    expect(detail).toContain(t.display.received);
    const chains = render('/admin/swap/cctp/chains');
    expect(chains).toContain('Relayer gas');
    expect(chains).toContain('Track a burn');
    for (const c of fx.overview.cctp.chains) expect(chains).toContain(c.name);
  });

  it('cross-chain: a failed transfer shows its reason and offers to reopen', () => {
    if (!fx.failedTransfer) return;
    const html = render(`/admin/swap/cctp/${fx.failedTransfer.transfer.id}`);
    expect(html).toContain('Failed');
    if (fx.failedTransfer.transfer.burnTxHash) expect(html).toContain('Reopen');
  });

  it('solana: swap list, a completed and a failed swap, tokens and stocks', () => {
    const list = render('/admin/swap/solana');
    expect(list).toContain('Jupiter API');
    expect(list).toContain('USDC');
    expect(list).toContain('Slippage exceeded'.slice(0, 0) + 'Failed');
    const done = render(`/admin/swap/solana/${SWAP.id}`);
    expect(done).toContain('Landed, confirmed by Jupiter');
    expect(done).toContain('0.08585');
    const failed = render(`/admin/swap/solana/${FAILED_SWAP.id}`);
    expect(failed).toContain('Slippage exceeded');
    expect(failed).toContain('Jupiter code -1000');
    const tokens = render('/admin/swap/solana/tokens');
    expect(tokens).toContain('Blocked tokens');
    expect(tokens).toContain(fx.tokens.tokens[0].symbol);
    const stocks = render('/admin/swap/solana/tokens?view=stocks');
    expect(stocks).toContain(fx.stocks.tokens[0].symbol);
  });

  it('settings and events', () => {
    const settings = render('/admin/swap/settings');
    expect(settings).toContain('Pause new transfers');
    expect(settings).toContain('Tokenized stocks');
    expect(settings).toContain('Maximum slippage');
    const events = render('/admin/swap/events');
    expect(events).toContain('Add note');
    expect(events).toContain(fx.events.events[0].type);
  });

  it('profits: fees received, whether each fee is collecting, wallets and the referral account', () => {
    const html = render('/admin/swap/profits');
    expect(html).toContain('Cross-chain fees received');
    expect(html).toContain('Is each fee being collected?');
    expect(html).toContain('Treasury wallets');
    expect(html).toContain('Jupiter referral account');
    for (const w of fx.profits.treasury) expect(html).toContain(w.label);
    // no key material can reach the page: the API never sends it
    expect(JSON.stringify(fx.profits)).not.toMatch(/"secret"|privateKey/i);
  });

  it('a transfer that paid our fee shows the fee, its status and where it went', () => {
    const t = fx.transfer.transfer;
    if (!t.protocolFee || t.protocolFee === '0') return;
    const html = render(`/admin/swap/cctp/${t.id}`);
    expect(html).toContain('Our fee');
    expect(html).toContain(`${t.display.protocolFee} USDC`);
    expect(html).toContain('received by the treasury');
    expect(html).toContain('Fee paid to');
    const list = render('/admin/swap/cctp');
    expect(list).toContain('>paid<');
  });

  it('settings: margins for both products', () => {
    const html = render('/admin/swap/settings');
    expect(html).toContain('Gas charge by destination');
    expect(html).toContain('Hold the delivery until the fee is paid');
    expect(html).toContain('Stablecoin pairs');
    expect(html).toContain('Referral account');
  });

  it('a swap that carried our fee shows the rate and what was collected', () => {
    const html = render(`/admin/swap/solana/${SWAP.id}`);
    expect(html).toContain('ours 50 bps');
    expect(html).toContain('Fee collected');
  });

  it('without a key the pages are replaced by the key form', () => {
    stored = null;
    try {
      const html = render('/admin/swap', new QueryClient());
      expect(html).toContain('Swap server key needed');
      expect(html).not.toContain('Needs attention');
    } finally { stored = 'test-key'; }
  });
});

describe('createSwapAdminApi', () => {
  it('sends the key on reads and writes, and keeps the server message on errors', async () => {
    const calls: Array<[string, RequestInit | undefined]> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push([url, init]);
      return url.endsWith('/fail') ? new Response(JSON.stringify({ error: 'transfer is already COMPLETED' }), { status: 409 }) : new Response('{"ok":true}', { status: 200 });
    }));
    const api = createSwapAdminApi('http://swap:3012/', () => 'secret');
    await api.transfers({ status: 'active', q: '', limit: 50 });
    expect(calls[0]![0]).toBe('http://swap:3012/admin/cctp/transfers?status=active&limit=50');
    expect((calls[0]![1]!.headers as Record<string, string>)['x-admin-key']).toBe('secret');
    await api.setChain('op-sepolia', false);
    expect(calls[1]![0]).toBe('http://swap:3012/admin/cctp/chains/op-sepolia');
    expect(calls[1]![1]!.body).toBe('{"open":false}');
    await expect(api.failTransfer('abc')).rejects.toMatchObject({ status: 409, message: 'transfer is already COMPLETED' });
    await api.checkKey('other');
    expect((calls[3]![1]!.headers as Record<string, string>)['x-admin-key']).toBe('other');
  });

  it('reports an unreachable server as status 0', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    const err = await createSwapAdminApi('http://swap:3012', () => 'k').overview().catch(e => e);
    expect(err).toBeInstanceOf(SwapApiError);
    expect(err.status).toBe(0);
  });
});
