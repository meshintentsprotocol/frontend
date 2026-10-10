/**
 * The state every borrow and supply page shares: which provider is in use (demo or real), the markets, and the
 * user's loans, kept fresh while a page is open.
 *
 * Demo mode is a switch the user controls, remembered between visits. When the build has no lending service,
 * or the wallet is on testnet (the protocol is mainnet only), demo is the only mode and the pages say why.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useWDK } from '@/context/WDKProvider';
import { notifyLoanChange } from './notify';
import type { LendProvider as Provider } from './provider';
import { createDemoProvider, type DemoProvider } from './providers/demo';
import { createLiquidiumProvider, liquidiumConfigured } from './providers/liquidium';
import { OPEN_PHASES, type LoanView, type Market } from './types';

const DEMO_KEY = 'lend_demo_mode_v1';
const REFRESH_MS = 20_000;
const DEMO_REFRESH_MS = 2_500;

interface LendValue {
    provider: Provider;
    /** Set in demo mode: the demo wallet and activity. */
    demoProvider: DemoProvider | null;
    demo: boolean;
    setDemo: (on: boolean) => void;
    /** Why real loans are unavailable, when they are. */
    realUnavailable: 'not-configured' | 'testnet' | null;
    markets: Market[];
    marketsError: string;
    loans: LoanView[];
    loansLoading: boolean;
    refresh: () => Promise<void>;
    market: (asset: string) => Market | undefined;
    /** The wallet's own addresses, used as the default destinations of a real loan. */
    addresses: { btc: string | null; evm: string | null };
    /** Put a loan the page just created or changed into the list without waiting for the next refresh. */
    upsert: (loan: LoanView) => void;
    forget: (ref: string) => void;
}

const LendContext = createContext<LendValue | null>(null);

export function useLend(): LendValue {
    const value = useContext(LendContext);
    if (!value) throw new Error('useLend is used outside LendProvider');
    return value;
}

export function LendProvider({ children }: { children: ReactNode }) {
    const wdk = useWDK();
    const realUnavailable: LendValue['realUnavailable'] = !liquidiumConfigured() ? 'not-configured' : wdk.bchNetwork !== 'mainnet' ? 'testnet' : null;

    const [wantDemo, setWantDemo] = useState<boolean>(() => {
        try { return localStorage.getItem(DEMO_KEY) === '1'; } catch { return false; }
    });
    const demo = wantDemo || realUnavailable !== null;
    const setDemo = useCallback((on: boolean) => {
        setWantDemo(on);
        try { localStorage.setItem(DEMO_KEY, on ? '1' : '0'); } catch { /* remembered for this visit only */ }
    }, []);

    const demoProvider = useMemo(() => createDemoProvider(), []);
    const realProvider = useMemo(() => createLiquidiumProvider(), []);
    const provider: Provider = demo ? demoProvider : realProvider;

    const [markets, setMarkets] = useState<Market[]>([]);
    const [marketsError, setMarketsError] = useState('');
    const [loans, setLoans] = useState<LoanView[]>([]);
    const [loansLoading, setLoansLoading] = useState(true);
    const addresses = useMemo(() => ({ btc: wdk.btcAddress ?? null, evm: wdk.evmAddress ?? null }), [wdk.btcAddress, wdk.evmAddress]);

    // Which provider a running load belongs to: an answer for the other one is dropped.
    const generation = useRef(0);
    const known = useRef(new Map<string, LoanView>());

    const load = useCallback(async (gen: number, quiet: boolean) => {
        if (!quiet) setLoansLoading(true);
        const [m, l] = await Promise.allSettled([
            provider.listMarkets(),
            provider.myLoans([addresses.evm, addresses.btc].filter((a): a is string => !!a)),
        ]);
        if (gen !== generation.current) return;
        if (m.status === 'fulfilled') { setMarkets(m.value); setMarketsError(''); }
        else setMarketsError((m.reason as Error)?.message ?? 'The markets could not be loaded.');
        if (l.status === 'fulfilled') {
            for (const loan of l.value) {
                const prev = known.current.get(loan.ref);
                if (prev) notifyLoanChange(prev, loan);
                known.current.set(loan.ref, loan);
            }
            setLoans(l.value);
        }
        setLoansLoading(false);
    }, [provider, addresses.evm, addresses.btc]);

    useEffect(() => {
        const gen = ++generation.current;
        known.current = new Map();
        setLoans([]);
        setMarkets([]);
        load(gen, false);
    }, [load]);

    const refresh = useCallback(() => load(generation.current, true), [load]);

    // Follow loans that are still moving. Demo loans move in seconds, real ones in minutes.
    const moving = loans.some(l => OPEN_PHASES.includes(l.phase) && l.phase !== 'active');
    useEffect(() => {
        const every = demo ? (moving ? DEMO_REFRESH_MS : 15_000) : (moving ? REFRESH_MS : 60_000);
        const id = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, every);
        return () => clearInterval(id);
    }, [demo, moving, refresh]);

    const upsert = useCallback((loan: LoanView) => {
        const prev = known.current.get(loan.ref);
        if (prev) notifyLoanChange(prev, loan);
        known.current.set(loan.ref, loan);
        setLoans(list => (list.some(l => l.ref === loan.ref) ? list.map(l => (l.ref === loan.ref ? loan : l)) : [loan, ...list]));
    }, []);

    const forget = useCallback((ref: string) => {
        provider.forgetLoan(ref);
        known.current.delete(ref);
        setLoans(list => list.filter(l => l.ref !== ref));
    }, [provider]);

    const value = useMemo<LendValue>(() => ({
        provider, demoProvider: demo ? demoProvider : null, demo, setDemo, realUnavailable, markets, marketsError, loans, loansLoading, refresh,
        market: asset => markets.find(m => m.asset === asset), addresses, upsert, forget,
    }), [provider, demoProvider, demo, setDemo, realUnavailable, markets, marketsError, loans, loansLoading, refresh, addresses, upsert, forget]);

    return <LendContext.Provider value={value}>{children}</LendContext.Provider>;
}
