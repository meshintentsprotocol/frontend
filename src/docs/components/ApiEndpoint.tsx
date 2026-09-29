import { Fragment, useState } from 'react';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CodeGroup, CopyButton, HighlightedCode } from './CodeBlock';

// ```endpoint
// { "method": "POST", "path": "/api/v1/quote", "params": [...], "body": {...}, "responses": [...] }
// ```

export interface EndpointParam {
    name: string;
    in: 'path' | 'query' | 'body' | 'header';
    type: string;
    required?: boolean;
    description?: string;
    example?: string | number;
}

export interface EndpointResponse {
    status: number;
    description?: string;
    body?: unknown;
}

export interface EndpointSpec {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path: string;
    summary?: string;
    auth?: 'none' | 'admin';
    /** Shell/env name used for the base URL in generated snippets. */
    base?: string;
    params?: EndpointParam[];
    body?: unknown;
    responses?: EndpointResponse[];
}

export const METHOD_STYLES: Record<string, string> = {
    GET: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25',
    POST: 'text-sky-300 bg-sky-500/10 border-sky-500/25',
    PUT: 'text-amber-300 bg-amber-500/10 border-amber-500/25',
    DELETE: 'text-rose-300 bg-rose-500/10 border-rose-500/25',
    WS: 'text-violet-300 bg-violet-500/10 border-violet-500/25',
};

export function MethodPill({ method, size = 'md' }: { method: string; size?: 'sm' | 'md' }) {
    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center justify-center rounded border font-mono font-semibold',
                size === 'sm' ? 'h-4 min-w-[30px] px-1 text-[9px]' : 'h-6 min-w-[46px] px-1.5 text-[11px]',
                METHOD_STYLES[method] ?? METHOD_STYLES.GET,
            )}
        >
            {method}
        </span>
    );
}

function PathLabel({ path }: { path: string }) {
    return (
        <span className="font-mono text-[13.5px] text-zinc-200">
            {path.split(/(:[A-Za-z]+)/g).map((part, i) =>
                part.startsWith(':') ? <span key={i} className="text-emerald-300">{part}</span> : <Fragment key={i}>{part}</Fragment>,
            )}
        </span>
    );
}

function resolvePath(spec: EndpointSpec) {
    return spec.path.replace(/:([A-Za-z]+)/g, (_, name) => {
        const p = spec.params?.find(x => x.in === 'path' && x.name === name);
        return p?.example !== undefined ? String(p.example) : `<${name}>`;
    });
}

function query(spec: EndpointSpec) {
    const q = (spec.params ?? []).filter(p => p.in === 'query' && p.example !== undefined);
    return q.length ? '?' + q.map(p => `${p.name}=${encodeURIComponent(String(p.example))}`).join('&') : '';
}

function curlSnippet(spec: EndpointSpec) {
    const base = spec.base ?? 'MESH_URL';
    const lines = [`curl -X ${spec.method} "$${base}${resolvePath(spec)}${query(spec)}"`];
    if (spec.auth === 'admin') lines.push(`  -H "x-admin-key: $ADMIN_KEY"`);
    if (spec.body !== undefined) {
        lines.push(`  -H "Content-Type: application/json"`);
        lines.push(`  -d '${JSON.stringify(spec.body, null, 2).replace(/\n/g, '\n  ')}'`);
    }
    return lines.join(' \\\n');
}

function tsSnippet(spec: EndpointSpec) {
    const base = spec.base ?? 'MESH_URL';
    const headers: string[] = [];
    if (spec.body !== undefined) headers.push(`'Content-Type': 'application/json'`);
    if (spec.auth === 'admin') headers.push(`'x-admin-key': ADMIN_KEY`);
    const opts: string[] = [`  method: '${spec.method}',`];
    if (headers.length) opts.push(`  headers: { ${headers.join(', ')} },`);
    if (spec.body !== undefined) opts.push(`  body: JSON.stringify(${JSON.stringify(spec.body, null, 2).replace(/\n/g, '\n  ')}),`);
    return [
        `const res = await fetch(\`\${${base}}${resolvePath(spec)}${query(spec)}\`, {`,
        ...opts,
        `});`,
        `if (!res.ok) throw new Error((await res.json()).error);`,
        `const data = await res.json();`,
    ].join('\n');
}

const IN_LABEL: Record<EndpointParam['in'], string> = {
    path: 'Path parameters', query: 'Query parameters', body: 'Body', header: 'Headers',
};

function ParamTable({ params }: { params: EndpointParam[] }) {
    const groups = (['path', 'query', 'header', 'body'] as const)
        .map(k => [k, params.filter(p => p.in === k)] as const)
        .filter(([, ps]) => ps.length);
    return (
        <div className="space-y-5 px-5 py-5">
            {groups.map(([k, ps]) => (
                <div key={k}>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{IN_LABEL[k]}</p>
                    <div className="divide-y divide-white/[0.05] rounded-lg border border-white/[0.05]">
                        {ps.map(p => (
                            <div key={p.name} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,200px)_1fr] sm:gap-4">
                                <div className="flex flex-wrap items-center gap-2">
                                    <code className="font-mono text-[13px] text-zinc-100">{p.name}</code>
                                    {p.required && (
                                        <span className="rounded bg-rose-500/10 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-rose-300">
                                            required
                                        </span>
                                    )}
                                </div>
                                <div className="text-[13.5px] leading-6 text-zinc-400">
                                    <span className="mr-2 font-mono text-[12px] text-zinc-500">{p.type}</span>
                                    {p.description}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

function statusTone(status: number) {
    if (status < 300) return 'text-emerald-300';
    if (status < 500) return 'text-amber-300';
    return 'text-rose-300';
}

function Responses({ responses }: { responses: EndpointResponse[] }) {
    const [active, setActive] = useState(0);
    const r = responses[active];
    const json = r?.body !== undefined ? JSON.stringify(r.body, null, 2) : '';
    return (
        <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#0b0b0d]">
            <div className="flex h-10 items-center justify-between border-b border-white/[0.06] bg-white/[0.015] pr-2">
                <div role="tablist" className="flex h-full items-center overflow-x-auto scrollbar-none">
                    <span className="px-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Response</span>
                    {responses.map((x, i) => (
                        <button
                            key={x.status + String(i)}
                            role="tab"
                            aria-selected={i === active}
                            onClick={() => setActive(i)}
                            className={cn(
                                'relative h-full px-3 font-mono text-xs transition-colors',
                                i === active ? statusTone(x.status) : 'text-zinc-500 hover:text-zinc-300',
                            )}
                        >
                            {x.status}
                            {i === active && <span className="absolute inset-x-2 bottom-0 h-px bg-current" />}
                        </button>
                    ))}
                </div>
                {json && <CopyButton text={json} />}
            </div>
            {r?.description && <p className="border-b border-white/[0.04] px-5 py-2.5 text-[13px] text-zinc-400">{r.description}</p>}
            {json && <HighlightedCode code={json} lang="json" />}
        </div>
    );
}

export function ApiEndpoint({ spec }: { spec: EndpointSpec }) {
    const url = `${resolvePath(spec)}`;
    return (
        <div className="not-prose my-8 space-y-4">
            <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.015]">
                <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] px-5 py-3.5">
                    <MethodPill method={spec.method} />
                    <PathLabel path={spec.path} />
                    <CopyButton text={url} className="-ml-1" />
                    <span className="ml-auto flex items-center gap-1.5 text-[11px] text-zinc-500">
                        {spec.auth === 'admin' ? (
                            <><Lock className="h-3 w-3 text-amber-300" /> <code className="font-mono text-amber-200/80">x-admin-key</code></>
                        ) : (
                            'Public'
                        )}
                    </span>
                </div>
                {spec.summary && <p className="px-5 pt-4 text-[14px] leading-6 text-zinc-400">{spec.summary}</p>}
                {spec.params && spec.params.length > 0 ? (
                    <ParamTable params={spec.params} />
                ) : (
                    <p className="px-5 py-4 text-[13px] text-zinc-500">No parameters.</p>
                )}
            </div>
            <CodeGroup
                tabs={[
                    { label: 'cURL', lang: 'bash', code: curlSnippet(spec) },
                    { label: 'TypeScript', lang: 'typescript', code: tsSnippet(spec) },
                ]}
            />
            {spec.responses && spec.responses.length > 0 && <Responses responses={spec.responses} />}
        </div>
    );
}
