/**
 * /borrow — the lending area. One shell for both modes:
 *
 *   /borrow                      Simple · Borrow
 *   /borrow/portfolio            Simple · Portfolio
 *   /borrow/loan/:ref            one loan
 *   /borrow/advanced             Advanced · Supply
 *   /borrow/advanced/borrow      Advanced · Borrow
 *   /borrow/advanced/portfolio   Advanced · Portfolio
 *
 * The shell holds the Simple/Advanced switch, the tabs of the current mode, and the Demo toggle.
 */
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { LendProvider, useLend } from './LendProvider';
import { DemoBanner, DemoToggle, Notice, Segmented } from './components/parts';
import { AdvancedBorrowPage, AdvancedPortfolioPage, AdvancedSupplyPage } from './pages/AdvancedPages';
import { BorrowPage, LoanDetailPage, PortfolioPage } from './pages/SimplePages';
import './lend.css';

const UNAVAILABLE: Record<string, string> = {
    'not-configured': 'real loans are not set up in this build',
    testnet: 'real loans are on mainnet only',
};

function Shell() {
    const { demo, setDemo, realUnavailable, marketsError, demoProvider, refresh } = useLend();
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const advanced = pathname.startsWith('/borrow/advanced');
    const tab = advanced
        ? (pathname.endsWith('/borrow') ? 'adv-borrow' : pathname.endsWith('/portfolio') ? 'adv-portfolio' : 'adv-supply')
        : (pathname.startsWith('/borrow/portfolio') || pathname.startsWith('/borrow/loan') ? 'portfolio' : 'borrow');
    const go: Record<string, string> = {
        borrow: '/borrow', portfolio: '/borrow/portfolio', 'adv-supply': '/borrow/advanced', 'adv-borrow': '/borrow/advanced/borrow', 'adv-portfolio': '/borrow/advanced/portfolio',
    };

    return (
        <div className="mx-auto w-full max-w-[480px] px-4 pb-28 text-white">
            {demo ? (
                <DemoBanner
                    onExit={realUnavailable ? undefined : () => setDemo(false)}
                    onReset={() => {
                        demoProvider?.reset();
                        void refresh();
                    }}
                    reason={realUnavailable ? UNAVAILABLE[realUnavailable] : undefined}
                />
            ) : null}

            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <Segmented
                    label={advanced ? 'Advanced pages' : 'Simple pages'} value={tab} onChange={v => navigate(go[v])}
                    options={advanced
                        ? [{ value: 'adv-supply', label: 'Supply' }, { value: 'adv-borrow', label: 'Borrow' }, { value: 'adv-portfolio', label: 'Portfolio' }]
                        : [{ value: 'borrow', label: 'Borrow' }, { value: 'portfolio', label: 'Portfolio' }]}
                />
                <Segmented label="Mode" value={advanced ? 'advanced' : 'simple'} onChange={v => navigate(v === 'advanced' ? '/borrow/advanced' : '/borrow')} options={[{ value: 'simple', label: 'Simple' }, { value: 'advanced', label: 'Advanced' }]} />
            </div>

            {marketsError && !demo ? <div className="mb-4"><Notice tone="error">{marketsError} You can still explore in demo mode.</Notice></div> : null}

            <Routes>
                <Route index element={<BorrowPage />} />
                <Route path="portfolio" element={<PortfolioPage />} />
                <Route path="loan/:ref" element={<LoanDetailPage />} />
                <Route path="advanced" element={<AdvancedSupplyPage />} />
                <Route path="advanced/borrow" element={<AdvancedBorrowPage />} />
                <Route path="advanced/portfolio" element={<AdvancedPortfolioPage />} />
                <Route path="*" element={<Navigate to="/borrow" replace />} />
            </Routes>

            <div className="fixed bottom-5 left-5 z-40">
                <DemoToggle on={demo} onChange={setDemo} locked={realUnavailable !== null} />
            </div>
        </div>
    );
}

export default function LendRoot() {
    return <LendProvider><Shell /></LendProvider>;
}
