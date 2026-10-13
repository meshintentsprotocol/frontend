import { describe, it, expect } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { TransferProgress } from '../ProcessingDialog';
import { ActivityRow } from '../SwapServerHistory';
import { SwapServerButton, SwapServerDetails } from '../SwapServerCardParts';
import { SwapServerContext, type SwapServerContextValue } from '../context';
import { amountProblem, normalizeAmount, type SwapServerCardState } from '../useSwapServerCard';
import { createSwapServerApi } from '../api';
import type { ActivityItem, CctpChain, CctpQuote, SwapServerConfig, Transfer } from '../types';
import fixtures from './fixtures.json';

/**
 * The new components rendered on the server with answers recorded from a running swap server. Catches a
 * component that throws on a real data shape, and pins the words a user reads at each point.
 */
const config = fixtures.config as unknown as SwapServerConfig;
const chain = (key: string) => config.cctp.chains.find(c => c.key === key) as CctpChain;
const items = fixtures.activity.items as unknown as ActivityItem[];
const created = fixtures.created.transfer as unknown as Transfer;
const completed = fixtures.completedTransfer as unknown as Transfer;
const quote = fixtures.quote as unknown as CctpQuote;

/** Text as a reader sees it: tags and React's comment markers out, entities back. */
const text = (el: ReactElement) => renderToString(el).replace(/<!--.*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const html = (el: ReactElement) => renderToString(el);

const ctxValue = (over: Partial<SwapServerContextValue> = {}): SwapServerContextValue => ({
    api: createSwapServerApi('http://swap.test'), activate: () => undefined, isMainnet: false, config, configLoading: false,
    chain, evmAddress: '0x318a63dEd371020d25670edeeCeD1E193E8D947E', solanaAddress: 'VBmpGVzabx8AsptQXrA2okEwqFVjbuosHvR2NkuBoaS',
    rows: items, rowsReceivedAt: 0, rowsLoading: false, openCount: 0, activeCount: 0, refresh: () => undefined,
    operation: null, bridge: async () => undefined, resume: async () => undefined, sendFee: async () => undefined,
    swapOperation: null, swap: async () => undefined, signing: false, selfMint: async () => undefined, minting: null,
    dialog: { open: false, id: null, kind: 'transfer' }, showDialog: () => undefined, hideDialog: () => undefined,
    historyView: 'auto', setHistoryView: () => undefined, historyOurs: false, pairRouted: false, setPairRouted: () => undefined,
    ...over,
});
const within = (el: ReactElement, over?: Partial<SwapServerContextValue>) => createElement(SwapServerContext.Provider, { value: ctxValue(over) }, el);

const state = (over: Partial<SwapServerCardState>): SwapServerCardState => ({
    route: { kind: 'usdc-cctp', src: chain('base-sepolia'), dst: chain('arc-testnet') }, active: true, blocked: null,
    buyAmount: quote.display!.expectedReceive, quote, quoting: false, problem: null, notice: null, canSubmit: true, busy: false, sellBalance: 5,
    actionLabel: 'Bridge USDC · Base Sepolia → Arc Testnet', execute: async () => true, tokens: b => b, pair: () => ({}),
    ...over,
});

describe('history rows', () => {
    it('every recorded row renders with its amounts, route and status', () => {
        expect(items.length).toBeGreaterThanOrEqual(4);
        for (const item of items) {
            const out = text(createElement(ActivityRow, { item }));
            expect(out).toContain(`${item.sell.display} USDC`);
            expect(out).toContain(`${item.buy.display} USDC`);
            expect(out).toContain(`${item.sell.chainName} → ${item.buy.chainName}`);
            expect(out).toContain('Bridge');
        }
    });

    it('an unsigned row offers Sign and counts down; an estimate is marked as one', () => {
        const item = items.find(i => i.phase === 'awaiting_signature')!;
        const out = text(createElement(ActivityRow, { item, left: 125, onSign: () => undefined }));
        expect(out).toContain('Needs signature');
        expect(out).toContain('sign within 2:05');
        expect(out).toContain('Sign');
        expect(out).toContain(`≈ ${item.buy.display} USDC`);
    });

    it('once the time has run out the Sign button is gone', () => {
        const item = items.find(i => i.phase === 'awaiting_signature')!;
        const out = text(createElement(ActivityRow, { item, left: 0, onSign: () => undefined }));
        expect(out).toContain('time ran out');
        expect(out).not.toMatch(/\bSign\b(?! within)/);
    });

    it('a row held for its fee offers to pay it', () => {
        const base = items.find(i => i.phase === 'completed' && i.fee)!;
        const item: ActivityItem = { ...base, status: 'ATTESTED', phase: 'action_needed', terminal: false, fee: { ...base.fee!, status: 'awaiting' }, buy: { ...base.buy, estimated: true } };
        const out = text(createElement(ActivityRow, { item, onPayFee: () => undefined }));
        expect(out).toContain('Fee needed');
        expect(out).toContain('Pay fee');
        expect(out).toContain('not received');
    });

    it('a completed row shows what arrived, the fee, and links to the delivery', () => {
        const item = items.find(i => i.phase === 'completed' && i.fee)!;
        expect(text(createElement(ActivityRow, { item }))).toContain(`fee ${item.fee!.display} USDC`);
        expect(text(createElement(ActivityRow, { item }))).not.toContain('≈');
        expect(html(createElement(ActivityRow, { item }))).toContain(`href="${item.links.destination}"`);
    });

    it('a failed row says why', () => {
        const item = items.find(i => i.phase === 'failed');
        if (!item) return;
        const out = text(createElement(ActivityRow, { item }));
        expect(out).toContain('Failed');
        if (item.failReason) expect(out).toContain(item.failReason);
    });

    it('a Solana swap row renders from its mint, symbol and icon', () => {
        const swap: ActivityItem = {
            id: 's1', kind: 'swap', product: 'jupiter', network: 'mainnet', status: 'COMPLETED', phase: 'completed', terminal: true, createdAt: 1, updatedAt: 2,
            owner: 'VBmp', recipient: 'VBmp',
            sell: { symbol: 'USDC', decimals: 6, amount: '10000000', display: '10.0', chain: 'solana', chainName: 'Solana', token: 'EPjF', icon: 'https://img/usdc.png' },
            buy: { symbol: 'SOL', decimals: 9, amount: '85850000', display: '0.08585', chain: 'solana', chainName: 'Solana', token: 'So11', estimated: false },
            links: { source: 'https://solscan.io/tx/5pGg' }, swap: { inputMint: 'EPjF', outputMint: 'So11', slippageBps: 50, gasless: false },
        };
        const out = text(createElement(ActivityRow, { item: swap }));
        expect(out).toContain('10.0 USDC');
        expect(out).toContain('0.08585 SOL');
        expect(out).toContain('Swap');
    });
});

describe('the processing dialog body', () => {
    it('an unsigned transfer: what will be sent and received, and that it waits for a signature', () => {
        const out = text(createElement(TransferProgress, { transfer: created, src: chain(created.src), dst: chain(created.dst), secondsLeft: 3000 }));
        expect(out).toContain(`${created.display.grossAmount} USDC`);
        expect(out).toContain(`≈ ${created.display.expectedReceive} USDC`);
        expect(out).toContain('Base Sepolia');
        expect(out).toContain('Arc Testnet');
        expect(out).toContain('Waiting for your signature');
        expect(out).toContain('can be signed for another 50:00');
        expect(out).toContain('Circle attestation');
    });

    it('a delivered transfer: the amount that arrived, both explorer links, the fee paid', () => {
        const out = html(createElement(TransferProgress, { transfer: completed, src: chain(completed.src), dst: chain(completed.dst) }));
        expect(out).toContain(`${completed.display.received} USDC arrived`);
        expect(out).toContain(`href="${completed.links.burn}"`);
        expect(out).toContain(`href="${completed.links.mint}"`);
        expect(text(createElement(TransferProgress, { transfer: completed, src: chain(completed.src), dst: chain(completed.dst) }))).toContain(`Service fee ${completed.display.protocolFee} USDC, paid`);
    });

    it('while signing, before there is a record', () => {
        const op = { src: 'base-sepolia', dst: 'arc-testnet', amount: '2.5', steps: ['create' as const], step: 'create' as const, done: [], busy: true, startedAt: 0 };
        const out = text(createElement(TransferProgress, { op, src: chain('base-sepolia'), dst: chain('arc-testnet') }));
        expect(out).toContain('2.5 USDC');
        expect(out).toContain('Preparing the transfer');
    });
});

describe('the card\'s button', () => {
    const button = (over: Partial<SwapServerCardState>) => text(createElement(SwapServerButton, { state: state(over), onClick: () => undefined }));

    it('ready: names the route', () => {
        expect(button({})).toBe('Bridge USDC · Base Sepolia → Arc Testnet');
    });
    it('a pair with no flow: the reason, and a button that cannot be pressed', () => {
        const out = html(createElement(SwapServerButton, { state: state({ active: false, blocked: 'USDC on Arc Testnet can only be sent to USDC on another chain.', canSubmit: false }), onClick: () => undefined }));
        expect(out).toContain('USDC on Arc Testnet can only be sent to USDC on another chain.');
        expect(out).toContain('Not available');
        expect(out).toContain('disabled');
        // with nothing more to say than that, the button says it once
        expect(button({ active: false, blocked: 'This pair is not available.', canSubmit: false })).toBe('This pair is not available');
    });
    it('a problem is the label of a disabled button', () => {
        expect(button({ problem: 'Minimum is 1 USDC', canSubmit: false })).toBe('Minimum is 1 USDC');
        expect(button({ problem: 'Getting quote…', canSubmit: false, quote: undefined })).toBe('Getting quote…');
    });
    it('paused: the reason above the button', () => {
        expect(button({ problem: 'Bridge paused', notice: 'Cross-chain USDC is paused: maintenance', canSubmit: false })).toBe('Cross-chain USDC is paused: maintenance Bridge paused');
    });
    it('while the wallet signs', () => {
        expect(button({ busy: true, canSubmit: false })).toBe('Signing…');
    });
});

describe('the quote details', () => {
    it('two fee lines, what arrives, where, and how long', () => {
        const out = text(within(createElement(SwapServerDetails, { state: state({}) })));
        expect(out).toContain('USDC bridge');
        expect(out).toContain('Circle CCTP · Testnet');
        expect(out).toContain(`You send · Base Sepolia ${quote.display!.amount} USDC`);
        expect(out).toContain(`Service fee ${quote.display!.protocolFee} USDC`);
        expect(out).toContain(`Network fee · Circle ${quote.display!.expectedFee} USDC`);
        expect(out).toContain(`You receive · Arc Testnet ${quote.display!.expectedReceive} USDC`);
        expect(out).toContain('0x318a…947E');
        expect(out).toMatch(/Fast · about \d+ seconds|Standard · about \d+ (seconds|minutes)/);
    });
    it('no fee reads as None, not as 0', () => {
        const free = { ...quote, protocolFee: '0', expectedFee: '0', display: { ...quote.display!, protocolFee: '0', expectedFee: '0' } };
        const out = text(within(createElement(SwapServerDetails, { state: state({ quote: free }) })));
        expect(out).toContain('Service fee None');
        expect(out).toContain('Network fee · Circle None');
    });
    it('every warning of the quote is shown', () => {
        const q = fixtures.quoteToEthereum as unknown as CctpQuote;
        const s = state({ quote: { ...q, warnings: ['Standard transfers from Ethereum Sepolia take about 17 minutes.', 'The recipient USDC token account is created automatically if it does not exist.'] } });
        const out = text(within(createElement(SwapServerDetails, { state: s })));
        expect(out).toContain('take about 17 minutes');
        expect(out).toContain('created automatically');
    });
    it('a Solana destination shows the Solana wallet', () => {
        const s = state({ route: { kind: 'usdc-cctp', src: chain('base-sepolia'), dst: chain('solana-devnet') } });
        expect(text(within(createElement(SwapServerDetails, { state: s })))).toContain('VBmpGV…BoaS');
    });
    it('renders nothing for a pair that is not a bridge', () => {
        expect(html(within(createElement(SwapServerDetails, { state: state({ route: { kind: 'unsupported', reason: 'x' }, active: false }) })))).toBe('');
    });
});

describe('amounts', () => {
    it('what the server is sent', () => {
        expect(normalizeAmount(' 1. ')).toBe('1');
        expect(normalizeAmount('.5')).toBe('0.5');
        expect(normalizeAmount('2.50')).toBe('2.50');
    });
    it('problems found from /config, without asking the server', () => {
        expect(amountProblem('', config)).toBe('Enter an amount');
        expect(amountProblem('0', config)).toBe('Enter an amount');
        expect(amountProblem('1e3', config)).toBe('Enter an amount');
        expect(amountProblem('-1', config)).toBe('Enter an amount');
        expect(amountProblem('1.1234567', config)).toBe('USDC has 6 decimals at most');
        expect(amountProblem(String(config.cctp.minTransferUsdc / 2), config)).toBe(`Minimum is ${config.cctp.minTransferUsdc} USDC`);
        expect(amountProblem(String(config.cctp.maxTransferUsdc + 1), config)).toBe(`Maximum is ${config.cctp.maxTransferUsdc} USDC`);
        expect(amountProblem(String(config.cctp.minTransferUsdc), config)).toBeNull();
        expect(amountProblem('1.123456', config)).toBeNull();
    });
});
