/**
 * /mcp — the MCP server for AI agents: what it is, how to connect a client,
 * what the tools do and what it will never do.
 *
 * The tool catalog comes from src/mcp/manifest.json (generated from the server),
 * the endpoint from VITE_MCP_URL.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ArrowLeftRight, ArrowRight, BookOpen, Bot, Check, Copy, Droplets, Gauge, KeyRound, LineChart, Lock, ScanLine,
    ShieldCheck, TriangleAlert, Wallet,
} from 'lucide-react';
import { Footer } from '@/components/common/Footer';
import { Header } from '@/components/common/Header';
import { Button } from '@/components/ui/button';
import { BCH_MESH_SERVER_URL, MCP_SERVER_IS_HOSTED, MCP_SERVER_URL } from '@/lib/config';
import { siteOf } from '@/lib/sanity';
import { useSeo } from '@/lib/useSeo';
import { cn } from '@/lib/utils';
import { CodeBlock } from '@/mcp/CodeBlock';
import { clientSetups, EXAMPLE_PROMPTS, MCP_NPM_PACKAGE } from '@/mcp/clients';
import { MANIFEST } from '@/mcp/manifest';
import { McpToolCatalog } from '@/mcp/McpToolCatalog';
import { mcpSeo } from '@/shared/seo';

const CAPABILITIES = [
    {
        icon: ArrowLeftRight,
        title: 'Trade',
        body: 'Quote any pair, then prepare a market, limit or Dutch order, or a TWAP split over time. Follow it to the fill, or ask for the refund once it has expired.',
        tools: ['get_quote', 'create_swap_order', 'create_twap_order', 'get_order'],
    },
    {
        icon: Droplets,
        title: 'Provide liquidity',
        body: 'Browse the strategy templates, get parameters suggested around the market price, and preview every pool a strategy would open. Find liquidity that has gone idle and plan how to put it back to work.',
        tools: ['list_strategy_templates', 'preview_strategy', 'find_idle_liquidity', 'plan_recycle'],
    },
    {
        icon: LineChart,
        title: 'Read the market',
        body: 'Tokens and prices, orderbook depth, every Mesh pool with its price, fee and reserves, pool activity, and the LP leaderboard.',
        tools: ['search_tokens', 'get_orderbook', 'list_pools', 'list_liquidity_providers'],
    },
];

const FLOW: Array<{ who: 'you' | 'agent' | 'chain'; title: string; body: string }> = [
    { who: 'you', title: 'You ask', body: '“Swap 0.5 BCH for PUSD.” In plain words, in the client you already use.' },
    { who: 'agent', title: 'The agent quotes', body: 'It finds the token, asks for a live quote and tells you what you would receive and by which route.' },
    { who: 'agent', title: 'It prepares the order', body: 'You confirm. The server computes a covenant for exactly that order and returns a funding link. Nothing has moved.' },
    { who: 'you', title: 'You fund it', body: 'The link opens this app. You see the order again and approve one transaction in your own wallet.' },
    { who: 'chain', title: 'A solver fills it', body: 'The covenant only releases your coins to a fill that pays you at least the minimum, or back to you after the deadline.' },
];

const WHO: Record<(typeof FLOW)[number]['who'], { label: string; cls: string }> = {
    you: { label: 'You', cls: 'border-amber-500/40 bg-amber-500/10 text-amber-300' },
    agent: { label: 'Agent', cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
    chain: { label: 'On chain', cls: 'border-sky-500/40 bg-sky-500/10 text-sky-300' },
};

const SAFETY = [
    { icon: KeyRound, title: 'No keys, no signing', body: 'The server has no wallet. It computes orders and reads data. It has no way to move funds.' },
    { icon: Wallet, title: 'You fund every order', body: 'A prepared order is only an address until you fund it from your own wallet, on a page that shows the order again.' },
    { icon: Lock, title: 'The covenant decides', body: 'Funded coins can go two ways: to a fill that pays you at least the stated minimum, or back to you after the deadline.' },
    { icon: Gauge, title: 'Price guard', body: 'An order whose minimum sits more than 5% below the live quote is refused until you confirm the price.' },
    { icon: ScanLine, title: 'Address checks', body: 'Addresses are checksum-verified and must belong to the network of the order. A covenant address is never accepted as yours.' },
    { icon: ShieldCheck, title: 'No admin surface', body: 'Operator routes, solver controls and fill records are not exposed. Order creation is limited per caller.' },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
    return <span className="mb-3 inline-block text-xs font-semibold uppercase tracking-widest text-emerald-400">{children}</span>;
}

function SectionHead({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
    return (
        <div className="mx-auto mb-12 max-w-3xl text-center">
            <Eyebrow>{eyebrow}</Eyebrow>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h2>
            {children && <p className="mt-4 text-base leading-relaxed text-zinc-400 sm:text-lg">{children}</p>}
        </div>
    );
}

function CopyPill({ value }: { value: string }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        void navigator.clipboard?.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };
    return (
        <button
            type="button"
            onClick={copy}
            aria-label="Copy the MCP endpoint"
            className="group inline-flex max-w-full items-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-3 transition-all hover:border-emerald-500/40 hover:bg-white/[0.08]"
        >
            <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-zinc-500">Endpoint</span>
            <span className="truncate font-mono text-sm text-zinc-100">{value}</span>
            {copied ? <Check className="h-4 w-4 shrink-0 text-emerald-400" /> : <Copy className="h-4 w-4 shrink-0 text-zinc-500 transition-colors group-hover:text-zinc-300" />}
        </button>
    );
}

function PromptCard({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        void navigator.clipboard?.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };
    return (
        <button
            type="button"
            onClick={copy}
            className="group flex w-full items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition-colors hover:border-white/20 hover:bg-white/[0.05]"
        >
            <span className="text-sm leading-relaxed text-zinc-200">{text}</span>
            {copied ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> : <Copy className="mt-0.5 h-4 w-4 shrink-0 text-zinc-600 transition-colors group-hover:text-zinc-300" />}
        </button>
    );
}

export default function McpPage() {
    useSeo(mcpSeo(siteOf()));
    const setups = useMemo(() => clientSetups(MCP_SERVER_URL, BCH_MESH_SERVER_URL), []);
    const [clientId, setClientId] = useState(setups[0]!.id);
    const client = setups.find(s => s.id === clientId) ?? setups[0]!;
    const promptGroups = useMemo(() => [...new Set(EXAMPLE_PROMPTS.map(p => p.group))], []);
    const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

    return (
        <div className="flex min-h-screen flex-col overflow-x-hidden bg-[#050505] text-foreground selection:bg-primary/30">
            <Header />

            <main className="flex-1">
                {/* ── Hero ───────────────────────────────────────────────────── */}
                <section className="relative overflow-hidden pb-20 pt-32 md:pb-24">
                    <div className="pointer-events-none absolute inset-0">
                        <div className="absolute left-[15%] top-[8%] h-[40vw] w-[40vw] rounded-full bg-emerald-500/10 blur-[140px]" />
                        <div className="absolute right-[10%] top-[30%] h-[30vw] w-[30vw] rounded-full bg-cyan-500/[0.07] blur-[160px]" />
                        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-20 mix-blend-overlay" />
                    </div>

                    <div className="container relative z-10 mx-auto max-w-4xl px-4 text-center">
                        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }} className="space-y-7">
                            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 backdrop-blur-md">
                                <Bot className="h-4 w-4 text-emerald-300" />
                                <span className="text-xs font-semibold text-emerald-300 md:text-sm">MCP server · Beta · Non-custodial</span>
                            </div>

                            <h1 className="text-4xl font-black leading-[1.08] tracking-tight text-white sm:text-6xl md:text-7xl">
                                Bitcoin Cash swaps for{' '}
                                <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">your AI agent</span>
                            </h1>

                            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-zinc-400 sm:text-xl">
                                Connect Claude, Cursor, ChatGPT or any MCP client to BCH Intents and Mesh. Your agent quotes swaps, prepares orders and reads the pools.
                                <span className="text-zinc-200"> Your wallet signs. The server never holds a key.</span>
                            </p>

                            <div className="flex justify-center px-2"><CopyPill value={MCP_SERVER_URL} /></div>

                            <div className="flex flex-col items-center justify-center gap-3 pt-1 sm:flex-row">
                                <Button size="lg" className="group h-14 w-full rounded-full bg-emerald-400 px-8 text-base font-bold text-black shadow-lg shadow-emerald-500/20 hover:bg-emerald-300 sm:w-auto" onClick={() => scrollTo('connect')}>
                                    Connect a client
                                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                                </Button>
                                <Button asChild size="lg" variant="outline" className="h-14 w-full rounded-full border-white/20 bg-white/5 px-8 text-base font-bold text-white backdrop-blur-md hover:bg-white/10 sm:w-auto">
                                    <Link to="/docs/api/mcp/overview"><BookOpen className="mr-2 h-4 w-4 text-zinc-400" />Read the docs</Link>
                                </Button>
                            </div>
                        </motion.div>

                        <dl className="mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-3 md:grid-cols-4">
                            {[
                                { k: 'Tools', v: String(MANIFEST.tools.length) },
                                { k: 'Keys held', v: '0' },
                                { k: 'Sign-in', v: 'None' },
                                { k: 'BCH networks', v: '2' },
                            ].map(s => (
                                <div key={s.k} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-md">
                                    <dd className="text-lg font-black text-white md:text-xl">{s.v}</dd>
                                    <dt className="mt-1 text-xs font-medium text-zinc-500">{s.k}</dt>
                                </div>
                            ))}
                        </dl>
                    </div>
                </section>

                {/* ── Connect ────────────────────────────────────────────────── */}
                <section id="connect" className="scroll-mt-24 border-t border-white/5 bg-zinc-950/80 py-20 md:py-24">
                    <div className="container mx-auto px-4">
                        <SectionHead eyebrow="Connect" title="Add it to your client">
                            One URL, no account. Pick your client; every snippet is ready to paste.
                        </SectionHead>

                        <div className="mx-auto max-w-3xl">
                            {!MCP_SERVER_IS_HOSTED && (
                                <div className="mb-6 flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] p-4 text-sm leading-relaxed text-amber-100">
                                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                                    <p>This build points at a local server. Start it with <code className="font-mono text-amber-200">npm run dev</code> in <code className="font-mono text-amber-200">bch-intents-mcp</code>, or set <code className="font-mono text-amber-200">VITE_MCP_URL</code> to the hosted endpoint.</p>
                                </div>
                            )}

                            <div role="tablist" aria-label="MCP client" className="mb-5 flex flex-wrap justify-center gap-2">
                                {setups.map(s => (
                                    <button
                                        key={s.id}
                                        role="tab"
                                        id={`tab-${s.id}`}
                                        aria-selected={s.id === client.id}
                                        aria-controls="client-panel"
                                        onClick={() => setClientId(s.id)}
                                        className={cn(
                                            'rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200 sm:text-sm',
                                            s.id === client.id ? 'bg-emerald-400 text-black shadow-lg shadow-emerald-500/20' : 'border border-white/5 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white',
                                        )}
                                    >
                                        {s.label}
                                    </button>
                                ))}
                            </div>

                            <div id="client-panel" role="tabpanel" aria-labelledby={`tab-${client.id}`} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-7">
                                <ol className="space-y-2.5">
                                    {client.steps.map((step, i) => (
                                        <li key={step} className="flex gap-3 text-sm leading-relaxed text-zinc-200">
                                            {client.steps.length > 1 && (
                                                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 font-mono text-[11px] font-bold text-emerald-300">{i + 1}</span>
                                            )}
                                            <span>{step}</span>
                                        </li>
                                    ))}
                                </ol>
                                <div className="mt-5 space-y-3">
                                    {client.snippets.map(sn => <CodeBlock key={sn.label ?? sn.code} code={sn.code} label={sn.label} />)}
                                </div>
                                {client.note && <p className="mt-4 text-xs leading-relaxed text-zinc-500">{client.note}</p>}
                                {client.remoteOnly && !MCP_SERVER_IS_HOSTED && (
                                    <p className="mt-3 text-xs leading-relaxed text-amber-300">This client connects from its own servers, so it cannot reach a server on your machine. It needs the hosted endpoint.</p>
                                )}
                            </div>

                            <p className="mt-5 text-center text-sm text-zinc-500">
                                Connected? Ask it: <span className="text-zinc-300">“Which networks is BCH Intents up on?”</span>
                            </p>
                        </div>
                    </div>
                </section>

                {/* ── What agents can do ─────────────────────────────────────── */}
                <section className="bg-[#050505] py-20 md:py-24">
                    <div className="container mx-auto px-4">
                        <SectionHead eyebrow="What it does" title="What your agent can do">
                            {MANIFEST.tools.length} tools over the same API this app uses.
                        </SectionHead>
                        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-3">
                            {CAPABILITIES.map(c => (
                                <div key={c.title} className="flex flex-col rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.01] p-7">
                                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10">
                                        <c.icon className="h-6 w-6 text-emerald-400" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white">{c.title}</h3>
                                    <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-400">{c.body}</p>
                                    <ul className="mt-5 flex flex-wrap gap-1.5 border-t border-white/5 pt-4">
                                        {c.tools.map(t => <li key={t} className="rounded-md bg-white/5 px-2 py-1 font-mono text-[11px] text-zinc-300">{t}</li>)}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── How a swap works ───────────────────────────────────────── */}
                <section className="border-y border-white/5 bg-zinc-950/80 py-20 md:py-24">
                    <div className="container mx-auto px-4">
                        <SectionHead eyebrow="How it works" title="The agent prepares. You sign.">
                            An agent can get an order ready in seconds. Only you can put money behind it.
                        </SectionHead>
                        <ol className="mx-auto grid max-w-6xl grid-cols-1 gap-4 md:grid-cols-5">
                            {FLOW.map((s, i) => (
                                <li key={s.title} className={cn('relative flex flex-col rounded-3xl border p-5', s.who === 'you' ? 'border-amber-500/25 bg-amber-500/[0.04]' : 'border-white/[0.08] bg-white/[0.03]')}>
                                    <div className="mb-4 flex items-center justify-between">
                                        <span className="font-mono text-2xl font-black text-white/20">{String(i + 1).padStart(2, '0')}</span>
                                        <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold', WHO[s.who].cls)}>{WHO[s.who].label}</span>
                                    </div>
                                    <h3 className="text-base font-bold text-white">{s.title}</h3>
                                    <p className="mt-2 text-sm leading-relaxed text-zinc-400">{s.body}</p>
                                </li>
                            ))}
                        </ol>
                    </div>
                </section>

                {/* ── Tools ──────────────────────────────────────────────────── */}
                <section id="tools" className="scroll-mt-24 bg-[#050505] py-20 md:py-24">
                    <div className="container mx-auto px-4">
                        <SectionHead eyebrow="Tools" title="Every tool, and what it can touch">
                            Most tools only read. Four change something on the server, and none of them can move your funds.
                        </SectionHead>
                        <div className="mx-auto max-w-4xl"><McpToolCatalog /></div>
                    </div>
                </section>

                {/* ── Prompts ────────────────────────────────────────────────── */}
                <section className="border-y border-white/5 bg-zinc-950/80 py-20 md:py-24">
                    <div className="container mx-auto px-4">
                        <SectionHead eyebrow="Try it" title="Things to ask">
                            Click one to copy it. Replace the address with your own.
                        </SectionHead>
                        <div className="mx-auto max-w-5xl space-y-8">
                            {promptGroups.map(g => (
                                <div key={g}>
                                    <h3 className="mb-3 text-sm font-bold text-white">{g}</h3>
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                        {EXAMPLE_PROMPTS.filter(p => p.group === g).map(p => <PromptCard key={p.text} text={p.text} />)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── Safety ─────────────────────────────────────────────────── */}
                <section id="safety" className="scroll-mt-24 bg-[#050505] py-20 md:py-24">
                    <div className="container mx-auto px-4">
                        <SectionHead eyebrow="Safety model" title="What it will never do">
                            The server is built so that the worst an agent can do is prepare an order you decline to fund.
                        </SectionHead>
                        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                            {SAFETY.map(s => (
                                <div key={s.title} className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-6">
                                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10">
                                        <s.icon className="h-5 w-5 text-emerald-400" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white">{s.title}</h3>
                                    <p className="mt-2 text-sm leading-relaxed text-zinc-400">{s.body}</p>
                                </div>
                            ))}
                        </div>
                        <div className="mx-auto mt-6 flex max-w-6xl gap-3 rounded-3xl border border-amber-500/25 bg-amber-500/[0.05] p-6 text-sm leading-relaxed text-amber-100">
                            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                            <div className="space-y-2">
                                <p className="font-semibold text-white">What stays with you</p>
                                <p>An agent can misread an amount or a token. The funding page shows the order in full before your wallet asks: read it there. This is beta software; start on chipnet, the BCH test network, where coins have no value.</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── Developers ─────────────────────────────────────────────── */}
                <section className="border-t border-white/5 bg-zinc-950/80 py-20 md:py-24">
                    <div className="container mx-auto px-4">
                        <SectionHead eyebrow="For developers" title="Run your own">
                            The server is a thin client of the Mesh REST API: no chain access and no wallet libraries. It speaks MCP revision 2026-07-28 over stdio and Streamable HTTP, and serves older clients from the same endpoint.
                        </SectionHead>
                        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5 lg:grid-cols-2">
                            <CodeBlock label="stdio, from npm" code={`MESH_URL=${BCH_MESH_SERVER_URL} NETWORK=chipnet \\\n  npx -y ${MCP_NPM_PACKAGE}`} />
                            <CodeBlock label="HTTP server" code={`MESH_URL_CHIPNET=${BCH_MESH_SERVER_URL} \\\nAPP_URL=${typeof window === 'undefined' ? '' : window.location.origin} \\\n  node dist/http.js   # → :8787/mcp`} />
                        </div>
                        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                            <Button asChild className="h-12 rounded-full bg-emerald-400 px-6 font-bold text-black hover:bg-emerald-300">
                                <Link to="/docs/api/mcp/tools">Tool reference <ArrowRight className="ml-2 h-4 w-4" /></Link>
                            </Button>
                            <Button asChild variant="outline" className="h-12 rounded-full border-white/20 bg-white/5 px-6 font-bold text-white hover:bg-white/10">
                                <Link to="/docs/api/mcp/self-host">Self-hosting guide</Link>
                            </Button>
                            <Button asChild variant="outline" className="h-12 rounded-full border-white/20 bg-white/5 px-6 font-bold text-white hover:bg-white/10">
                                <Link to="/docs/api/overview">Mesh REST API</Link>
                            </Button>
                        </div>
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
}
