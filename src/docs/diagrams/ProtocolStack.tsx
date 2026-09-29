import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Figure, TONE, type Tone } from './primitives';

interface Item { name: string; note?: string; href?: string; soon?: boolean }
interface Layer { label: string; role: string; tone: Tone; items: Item[] }

const LAYERS: Layer[] = [
    {
        label: 'Applications', role: 'Where intents originate', tone: 'zinc',
        items: [
            { name: 'BCH Intents app', href: '/trade' },
            { name: 'Wallets', href: 'sdk/guides/embedded-swaps' },
            { name: 'Integrator frontends', href: 'sdk/guides/frontend-fees' },
            { name: 'Agents & bots' },
        ],
    },
    {
        label: 'SDKs', role: 'TypeScript building blocks', tone: 'zinc',
        items: [
            { name: '@bch-intents/sdk', href: 'sdk/intents/overview' },
            { name: 'Mesh SDK', href: 'sdk/mesh/overview', soon: true },
            { name: 'Solver SDK', href: 'sdk/solver/overview', soon: true },
        ],
    },
    {
        label: 'APIs', role: 'Quote, create, track', tone: 'blue',
        items: [
            { name: 'Mesh Server REST', note: '/api/v1', href: 'api/overview' },
            { name: 'WebSocket stream', note: '/ws', href: 'api/websocket' },
            { name: 'ZK relayers', note: 'SOL · BSC', href: 'api/zk/sol-bch' },
        ],
    },
    {
        label: 'Execution', role: 'Off-chain, untrusted', tone: 'violet',
        items: [
            { name: 'Scanner / indexer', href: 'intents/lifecycle' },
            { name: 'Matcher', href: 'solvers/matching' },
            { name: 'Fill executor', href: 'intents/settlement/fill-transaction' },
            { name: 'Refund engine', href: 'intents/settlement/refunds' },
        ],
    },
    {
        label: 'Liquidity', role: 'Where fills are sourced', tone: 'blue',
        items: [
            { name: 'Mesh strategy pools', href: 'mesh/overview' },
            { name: 'Cauldron AMM pools', href: 'mesh/routing/cauldron' },
            { name: 'Solver inventory', href: 'solvers/inventory' },
        ],
    },
    {
        label: 'Settlement', role: 'On-chain rules on BCH', tone: 'emerald',
        items: [
            { name: 'LimitOrderSwapV2', href: 'contracts/limit-order-swap-v2' },
            { name: 'DutchAuctionSwapV2', href: 'contracts/dutch-auction-swap-v2' },
            { name: 'StrategyCovenantV2', href: 'contracts/strategy-covenant-v2' },
            { name: 'StarkVerifierFRI', href: 'contracts/stark-verifier' },
        ],
    },
    {
        label: 'Chains', role: 'BCH hub, external spokes', tone: 'zinc',
        items: [
            { name: 'Bitcoin Cash', note: 'hub' },
            { name: 'Solana', note: 'spoke' },
            { name: 'BSC / EVM', note: 'spoke' },
            { name: 'Monero', note: 'research' },
        ],
    },
];

function Chip({ item, tone }: { item: Item; tone: Tone }) {
    const t = TONE[tone];
    const cls = cn(
        'group inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] transition-colors',
        t.border, t.bg, item.href && 'hover:border-emerald-400/50 hover:text-white',
        item.soon ? 'border-dashed text-zinc-500' : 'text-zinc-200',
    );
    const body = (
        <>
            <span className={cn('h-1.5 w-1.5 rounded-full', item.soon ? 'bg-zinc-600' : t.dot)} />
            {item.name}
            {item.note && <span className="font-mono text-[10.5px] text-zinc-500">{item.note}</span>}
            {item.soon && <span className="text-[10px] uppercase tracking-wide text-zinc-600">soon</span>}
        </>
    );
    if (!item.href) return <span className={cls}>{body}</span>;
    const to = item.href.startsWith('/') ? item.href : `/docs/${item.href}`;
    return <Link to={to} className={cls}>{body}</Link>;
}

export function ProtocolStack() {
    return (
        <Figure
            title="BCH Intents protocol stack"
            caption="Everything above Settlement is replaceable and untrusted. Covenants on BCH enforce every payout, so a buggy or malicious server can fail to fill an order but cannot take funds."
        >
            <div className="space-y-2">
                {LAYERS.map((layer, i) => (
                    <div key={layer.label}>
                        <div
                            className={cn(
                                'grid gap-3 rounded-xl border p-3 sm:grid-cols-[150px_1fr] sm:items-center',
                                layer.label === 'Settlement' ? 'border-emerald-500/25 bg-emerald-500/[0.03]' : 'border-white/[0.05] bg-white/[0.01]',
                            )}
                        >
                            <div>
                                <p className={cn('text-[13px] font-semibold', layer.label === 'Settlement' ? 'text-emerald-300' : 'text-zinc-100')}>{layer.label}</p>
                                <p className="text-[11.5px] text-zinc-500">{layer.role}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {layer.items.map(item => <Chip key={item.name} item={item} tone={layer.tone} />)}
                            </div>
                        </div>
                        {i === 3 && (
                            <div className="my-2 flex items-center gap-3 px-1" aria-hidden>
                                <span className="h-px flex-1 border-t border-dashed border-amber-500/30" />
                                <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-amber-300/80">trust boundary</span>
                                <span className="h-px flex-1 border-t border-dashed border-amber-500/30" />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </Figure>
    );
}
