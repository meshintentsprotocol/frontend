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
    /** Active Liquidium profile ID, if registered. */
    profileId: string | null;
    profileLoading: boolean;
    login: (chain?: 'ETH' | 'BTC') => Promise<string>;
    logout: () => void;
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

    const [profileId, setProfileId] = useState<string | null>(() => {
        try { return localStorage.getItem('liquidium_profile_id_v1') || null; } catch { return null; }
    });
    const [profileLoading, setProfileLoading] = useState(false);

    // Auto-resolve profile when connected
    useEffect(() => {
        let active = true;
        async function resolve() {
            if (demo || !realProvider.advanced?.getProfileId) return;
            // If the user manually logged out during this session, do not force auto-login
            if (sessionStorage.getItem('liquidium_manual_logout') === '1') return;

            const eth = wdk.evmAddress;
            const btc = wdk.btcAddress;
            if (!eth && !btc) return;
            setProfileLoading(true);
            try {
                if (eth) {
                    const pid = await realProvider.advanced.getProfileId(eth);
                    if (active && pid) {
                        setProfileId(pid);
                        try { localStorage.setItem('liquidium_profile_id_v1', pid); } catch {}
                        return;
                    }
                }
                if (btc) {
                    const pid = await realProvider.advanced.getProfileId(btc);
                    if (active && pid) {
                        setProfileId(pid);
                        try { localStorage.setItem('liquidium_profile_id_v1', pid); } catch {}
                        return;
                    }
                }
            } catch {
                // Ignore resolution error
            } finally {
                if (active) setProfileLoading(false);
            }
        }
        resolve();
        return () => { active = false; };
    }, [demo, realProvider, wdk.evmAddress, wdk.btcAddress]);

    const login = useCallback(async (chain: 'ETH' | 'BTC' = 'ETH') => {
        const account = chain === 'ETH' ? wdk.evmAddress : wdk.btcAddress;
        if (!account) {
            throw new Error(`Please connect your ${chain} wallet first.`);
        }
        setProfileLoading(true);
        try {
            // Check if profile already exists for this wallet address
            if (realProvider.advanced?.getProfileId) {
                const existing = await realProvider.advanced.getProfileId(account).catch(() => null);
                if (existing) {
                    setProfileId(existing);
                    try { localStorage.setItem('liquidium_profile_id_v1', existing); } catch {}
                    try { sessionStorage.removeItem('liquidium_manual_logout'); } catch {}
                    return existing;
                }
            }

            if (!realProvider.advanced?.prepareCreateProfile || !realProvider.advanced?.createProfile) {
                throw new Error('Advanced profile creation is not supported by provider');
            }

            const prep = await realProvider.advanced.prepareCreateProfile(account);
            let signature = '';
            if (chain === 'ETH') {
                if (!wdk.evmSigner?.signMessage) throw new Error('EVM signer is not available to sign profile message');
                signature = await wdk.evmSigner.signMessage(prep.message);
            } else {
                if (wdk.btcAccount?.sign) {
                    signature = await wdk.btcAccount.sign(prep.message);
                } else if (wdk.evmSigner?.signMessage) {
                    signature = await wdk.evmSigner.signMessage(prep.message);
                } else {
                    throw new Error('Wallet signer is not available');
                }
            }
            const res = await realProvider.advanced.createProfile({
                account,
                chain,
                signature,
                expiryTimestamp: prep.expiryTimestamp,
            });
            setProfileId(res.profileId);
            try { localStorage.setItem('liquidium_profile_id_v1', res.profileId); } catch {}
            try { sessionStorage.removeItem('liquidium_manual_logout'); } catch {}
            return res.profileId;
        } catch (err: any) {
            const msg = err?.message ?? String(err);
            const m = msg.match(/already linked to profile ([a-z0-9\-]+)/i);
            if (m && m[1]) {
                const pid = m[1];
                setProfileId(pid);
                try { localStorage.setItem('liquidium_profile_id_v1', pid); } catch {}
                try { sessionStorage.removeItem('liquidium_manual_logout'); } catch {}
                return pid;
            }
            throw err;
        } finally {
            setProfileLoading(false);
        }
    }, [realProvider, wdk.evmAddress, wdk.btcAddress, wdk.evmSigner, wdk.btcAccount]);

    const logout = useCallback(() => {
        setProfileId(null);
        try { localStorage.removeItem('liquidium_profile_id_v1'); } catch {}
        try { sessionStorage.setItem('liquidium_manual_logout', '1'); } catch {}
    }, []);

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
        market: asset => markets.find(m => m.asset === asset), addresses, profileId, profileLoading, login, logout, upsert, forget,
    }), [provider, demoProvider, demo, setDemo, realUnavailable, markets, marketsError, loans, loansLoading, refresh, addresses, profileId, profileLoading, login, logout, upsert, forget]);

    return <LendContext.Provider value={value}>{children}</LendContext.Provider>;
}
