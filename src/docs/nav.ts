// ============================================================================
// Developer docs — information architecture
// ============================================================================
// This file is the single source of truth for the docs site structure:
// header tabs (sections) → sidebar groups (nestable subtrees) → pages.
//
// To add a page:
//   1. Add a leaf here: { slug: 'section/.../page', title: 'Sidebar label' }
//   2. Create src/docs/content/<slug>.md with frontmatter (see docs README).
// A leaf without a markdown file renders as a "planned" page automatically.

import type { LucideIcon } from 'lucide-react';
import { Rocket, Zap, Network, FileCode2, Package, Server, Bot } from 'lucide-react';

export type NavBadge = 'new' | 'beta' | 'soon';
export type HttpMethod = 'GET' | 'POST' | 'WS';

export interface NavLeaf {
    slug: string;
    title: string;
    badge?: NavBadge;
    /** API pages show an HTTP method pill in the sidebar. */
    method?: HttpMethod;
}

export interface NavGroup {
    title: string;
    items: NavNode[];
    /** Start collapsed in the sidebar (unless it contains the active page). */
    collapsed?: boolean;
}

export type NavNode = NavLeaf | NavGroup;

export interface NavSection {
    id: string;
    title: string;
    tagline: string;
    icon: LucideIcon;
    groups: NavGroup[];
}

export const isGroup = (n: NavNode): n is NavGroup => (n as NavGroup).items !== undefined;

export const NAV: NavSection[] = [
    {
        id: 'get-started',
        title: 'Get Started',
        tagline: 'What BCH Intents is, how the pieces fit together, and where to point your code.',
        icon: Rocket,
        groups: [
            {
                title: 'Introduction',
                items: [
                    { slug: 'get-started/introduction', title: 'Introduction' },
                    { slug: 'get-started/architecture', title: 'Architecture' },
                    { slug: 'get-started/how-a-swap-works', title: 'How a swap works' },
                ],
            },
            {
                title: 'Build',
                items: [
                    { slug: 'get-started/choose-your-path', title: 'Choose your path' },
                    { slug: 'get-started/quickstart', title: '5-minute quickstart' },
                    { slug: 'get-started/networks', title: 'Networks & endpoints' },
                ],
            },
            {
                title: 'Reference',
                items: [
                    { slug: 'get-started/glossary', title: 'Glossary' },
                    { slug: 'get-started/status', title: 'Status & roadmap' },
                ],
            },
        ],
    },
    {
        id: 'intents',
        title: 'Intents',
        tagline: 'Swap orders locked in BCH covenants and filled atomically by solvers.',
        icon: Zap,
        groups: [
            {
                title: 'Concepts',
                items: [
                    { slug: 'intents/overview', title: 'What is an intent' },
                    { slug: 'intents/lifecycle', title: 'Intent lifecycle' },
                    { slug: 'intents/status', title: 'Status reference' },
                ],
            },
            {
                title: 'Order types',
                items: [
                    { slug: 'intents/order-types/limit', title: 'Limit orders' },
                    { slug: 'intents/order-types/dutch', title: 'Dutch auctions' },
                    { slug: 'intents/order-types/twap', title: 'TWAP orders' },
                    { slug: 'intents/order-types/market', title: 'Market orders' },
                ],
            },
            {
                title: 'Settlement',
                items: [
                    { slug: 'intents/settlement/fill-transaction', title: 'The atomic fill' },
                    { slug: 'intents/settlement/refunds', title: 'Refunds & cancellation' },
                    { slug: 'intents/settlement/surplus', title: 'Surplus & frontend fees' },
                    { slug: 'intents/settlement/chain-time', title: 'Chain time (MTP)' },
                ],
            },
            {
                title: 'Cross-chain',
                items: [
                    { slug: 'intents/cross-chain/overview', title: 'Cross-chain overview' },
                    { slug: 'intents/cross-chain/zk-stark', title: 'ZK-STARK settlement', badge: 'beta' },
                    {
                        title: 'Routes',
                        collapsed: true,
                        items: [
                            { slug: 'intents/cross-chain/sol-bch', title: 'Solana ↔ BCH', badge: 'beta' },
                            { slug: 'intents/cross-chain/bsc-bch', title: 'BSC ↔ BCH', badge: 'beta' },
                            { slug: 'intents/cross-chain/htlc', title: 'HTLC swaps (legacy)' },
                            { slug: 'intents/cross-chain/xmr', title: 'Monero adaptor swaps', badge: 'soon' },
                        ],
                    },
                ],
            },
        ],
    },
    {
        id: 'mesh',
        title: 'Mesh',
        tagline: 'Isolated, non-custodial LP pools that solvers route intents through.',
        icon: Network,
        groups: [
            {
                title: 'Concepts',
                items: [
                    { slug: 'mesh/overview', title: 'Mesh overview' },
                    { slug: 'mesh/vs-amms', title: 'Mesh vs pooled AMMs' },
                ],
            },
            {
                title: 'V3 pools & strategies',
                items: [
                    { slug: 'mesh/v3/meshpool-v3', title: 'MeshPoolV3 pools', badge: 'new' },
                    { slug: 'mesh/strategies/overview', title: 'How strategies work', badge: 'new' },
                    { slug: 'mesh/pools/recycling', title: 'Recycling', badge: 'new' },
                    {
                        title: 'Strategy templates',
                        items: [
                            { slug: 'mesh/strategies/fixed', title: 'Fixed price' },
                            { slug: 'mesh/strategies/spread', title: 'Spread market' },
                            { slug: 'mesh/strategies/multi-pair', title: 'Multi-pair quote' },
                            { slug: 'mesh/strategies/stable-pair', title: 'Stable pair' },
                            { slug: 'mesh/strategies/recycling-pair', title: 'Recycling pair' },
                            { slug: 'mesh/strategies/grid', title: 'Grid' },
                            { slug: 'mesh/strategies/take-profit', title: 'Take-profit ladder' },
                            { slug: 'mesh/strategies/accumulate', title: 'Accumulate ladder' },
                        ],
                    },
                    { slug: 'mesh/pools/oracle', title: 'Oracle strategies', badge: 'soon' },
                ],
            },
            {
                title: 'V2 pools (retired)',
                collapsed: true,
                items: [
                    { slug: 'mesh/pools/strategy-pools', title: 'Strategy pools (V2)' },
                    { slug: 'mesh/pools/lifecycle', title: 'Pool lifecycle' },
                    { slug: 'mesh/pools/pricing', title: 'Pricing math' },
                    { slug: 'mesh/pools/bulk-reconfiguration', title: 'Bulk reconfiguration' },
                    { slug: 'mesh/pools/dutch-decay', title: 'Dutch-decay strategies', badge: 'soon' },
                ],
            },
            {
                title: 'Routing',
                items: [
                    { slug: 'mesh/routing/tri-route', title: 'Tri-route engine' },
                    { slug: 'mesh/routing/cauldron', title: 'Cauldron integration' },
                    { slug: 'mesh/routing/controls', title: 'Route controls' },
                ],
            },
            {
                title: 'Security',
                items: [{ slug: 'mesh/security', title: 'Security model' }],
            },
        ],
    },
    {
        id: 'contracts',
        title: 'Contracts',
        tagline: 'CashScript covenants: constructor arguments, spend paths and invariants.',
        icon: FileCode2,
        groups: [
            {
                title: 'Overview',
                items: [
                    { slug: 'contracts/overview', title: 'Contracts overview' },
                    { slug: 'contracts/deployments', title: 'Deployments & artifacts' },
                ],
            },
            {
                title: 'Intent covenants',
                items: [
                    { slug: 'contracts/limit-order-swap-v2', title: 'LimitOrderSwapV2' },
                    { slug: 'contracts/dutch-auction-swap-v2', title: 'DutchAuctionSwapV2' },
                ],
            },
            {
                title: 'Liquidity covenants',
                items: [{ slug: 'contracts/strategy-covenant-v2', title: 'StrategyCovenantV2' }],
            },
            {
                title: 'Cross-chain covenants',
                items: [
                    { slug: 'contracts/cross-chain-htlc', title: 'CrossChainHTLC' },
                    { slug: 'contracts/stark-verifier', title: 'StarkVerifierFRI', badge: 'beta' },
                ],
            },
        ],
    },
    {
        id: 'sdk',
        title: 'SDKs',
        tagline: 'TypeScript packages for creating intents, running pools and building solvers.',
        icon: Package,
        groups: [
            {
                title: 'Intents SDK',
                items: [
                    { slug: 'sdk/intents/overview', title: 'Overview & packages' },
                    { slug: 'sdk/intents/installation', title: 'Installation' },
                    { slug: 'sdk/intents/intent-builder', title: 'IntentBuilder' },
                    { slug: 'sdk/intents/wallet-adapter', title: 'Wallet adapter' },
                    { slug: 'sdk/intents/order-book', title: 'Order book client' },
                    { slug: 'sdk/intents/cross-chain', title: 'Cross-chain' },
                    { slug: 'sdk/intents/errors', title: 'Errors' },
                ],
            },
            {
                title: 'Mesh SDK',
                items: [
                    { slug: 'sdk/mesh/overview', title: 'Overview', badge: 'soon' },
                    { slug: 'sdk/mesh/create-pool', title: 'Create a pool', badge: 'soon' },
                    { slug: 'sdk/mesh/dock', title: 'Dock & exit', badge: 'soon' },
                ],
            },
            {
                title: 'Solver SDK',
                items: [
                    { slug: 'sdk/solver/overview', title: 'Overview', badge: 'soon' },
                    { slug: 'sdk/solver/quickstart', title: 'Build a solver bot', badge: 'soon' },
                ],
            },
            {
                title: 'Guides',
                items: [
                    { slug: 'sdk/guides/embedded-swaps', title: 'Embed swaps in a wallet' },
                    { slug: 'sdk/guides/frontend-fees', title: 'Earn with frontend fees' },
                ],
            },
        ],
    },
    {
        id: 'api',
        title: 'APIs',
        tagline: 'REST and WebSocket interfaces for quotes, intents, pools and solvers.',
        icon: Server,
        groups: [
            {
                title: 'Overview',
                items: [
                    { slug: 'api/overview', title: 'API overview' },
                    { slug: 'api/auth', title: 'Authentication' },
                    { slug: 'api/errors', title: 'Errors' },
                ],
            },
            {
                title: 'Trading',
                items: [
                    { slug: 'api/quote', title: 'Get a quote', method: 'POST' },
                    { slug: 'api/intents/create', title: 'Create an intent', method: 'POST' },
                    { slug: 'api/intents/get', title: 'Get an intent', method: 'GET' },
                    { slug: 'api/intents/list', title: 'List intents', method: 'GET' },
                    { slug: 'api/intents/cancel', title: 'Cancel an intent', method: 'POST' },
                    { slug: 'api/intents/refund', title: 'Request a refund', method: 'POST' },
                    { slug: 'api/twap', title: 'TWAP orders', method: 'POST' },
                ],
            },
            {
                title: 'Liquidity',
                items: [
                    { slug: 'api/pools', title: 'Pools', method: 'GET' },
                    { slug: 'api/strategies', title: 'Strategies', method: 'POST', badge: 'new' },
                    { slug: 'api/recycle', title: 'Recycle', method: 'POST', badge: 'new' },
                    { slug: 'api/positions', title: 'Positions', method: 'GET' },
                    { slug: 'api/orderbook', title: 'Orderbook', method: 'GET' },
                    { slug: 'api/rebalance', title: 'Rebalance quote', method: 'POST' },
                ],
            },
            {
                title: 'Data',
                items: [
                    { slug: 'api/tokens', title: 'Tokens & BCMR', method: 'GET' },
                    { slug: 'api/oracle', title: 'Oracle prices', method: 'GET' },
                ],
            },
            {
                title: 'Streams',
                items: [{ slug: 'api/websocket', title: 'WebSocket stream', method: 'WS' }],
            },
            {
                title: 'Operators',
                items: [{ slug: 'api/admin', title: 'Admin & route controls', method: 'POST' }],
            },
            {
                title: 'ZK relayers',
                collapsed: true,
                items: [
                    { slug: 'api/zk/sol-bch', title: 'SOL ↔ BCH relayer', badge: 'beta' },
                    { slug: 'api/zk/bsc-bch', title: 'BSC ↔ BCH relayer', badge: 'beta' },
                ],
            },
        ],
    },
    {
        id: 'solvers',
        title: 'Solvers',
        tagline: 'Fill intents, capture surplus and keep the network liquid.',
        icon: Bot,
        groups: [
            {
                title: 'Concepts',
                items: [
                    { slug: 'solvers/overview', title: 'Why solvers' },
                    { slug: 'solvers/matching', title: 'Matching & route selection' },
                    { slug: 'solvers/zero-inventory', title: 'Zero-inventory fills' },
                ],
            },
            {
                title: 'Operate',
                items: [
                    { slug: 'solvers/run', title: 'Run a solver' },
                    { slug: 'solvers/inventory', title: 'Inventory & RFQ' },
                    { slug: 'solvers/economics', title: 'Economics & surplus' },
                    { slug: 'solvers/runbook', title: 'Operational runbook' },
                ],
            },
        ],
    },
];

// ── Derived lookups ──────────────────────────────────────────────────────────

export interface FlatPage extends NavLeaf {
    section: NavSection;
    /** Group titles from the section root down to the page. */
    trail: string[];
}

function flatten(): FlatPage[] {
    const out: FlatPage[] = [];
    const walk = (nodes: NavNode[], section: NavSection, trail: string[]) => {
        for (const n of nodes) {
            if (isGroup(n)) walk(n.items, section, [...trail, n.title]);
            else out.push({ ...n, section, trail });
        }
    };
    for (const s of NAV) walk(s.groups, s, []);
    return out;
}

/** Every page in reading order — drives prev/next and search. */
export const FLAT_PAGES: FlatPage[] = flatten();

export const findPage = (slug: string) => FLAT_PAGES.find(p => p.slug === slug);

export const findSection = (id: string) => NAV.find(s => s.id === id);

export const firstPageOf = (section: NavSection) => FLAT_PAGES.find(p => p.section.id === section.id)!;
