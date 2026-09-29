import type { ReactNode } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link } from 'react-router-dom';
import { Link2 } from 'lucide-react';
import { remarkCallouts, remarkHeadingIds, type CalloutType } from '../lib/remark';
import { CHARTS, DIAGRAMS } from '../embeds';
import { Callout } from './Callout';
import { CodeBlock, CodeGroup, parseCodeGroup, parseTitle } from './CodeBlock';
import { ApiEndpoint, type EndpointSpec } from './ApiEndpoint';
import { Cards, type CardItem } from './Cards';
import { Mermaid } from './Mermaid';
import { Screenshot, type ScreenshotProps } from './Screenshot';

// ── Fenced-block dispatch ────────────────────────────────────────────────────
// ```lang meta
//   mermaid            → Mermaid diagram (meta: title="caption")
//   diagram <name>     → registered React diagram (embeds.tsx)
//   chart <name>       → registered interactive chart (embeds.tsx)
//   endpoint           → JSON EndpointSpec → API reference block
//   cards              → JSON CardItem[] → link card grid
//   screenshot         → JSON ScreenshotProps → framed app screenshot
//   codegroup          → "@@ label | lang" sections → tabbed code
//   anything else      → highlighted code block (meta: title="file.ts" {1,3-5})

interface HastNode {
    type: string;
    tagName?: string;
    value?: string;
    properties?: Record<string, unknown>;
    children?: HastNode[];
    data?: { meta?: string };
}

const hastText = (n?: HastNode): string => (!n ? '' : n.type === 'text' ? n.value ?? '' : (n.children ?? []).map(hastText).join(''));

function Invalid({ what, error }: { what: string; error: string }) {
    return <p className="my-4 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs text-rose-300">Invalid {what}: {error}</p>;
}

function parseJson<T>(src: string, what: string): T | ReactNode {
    try {
        return JSON.parse(src) as T;
    } catch (e) {
        return <Invalid what={what} error={(e as Error).message} />;
    }
}

function FencedBlock({ node }: { node?: HastNode }) {
    const code = node?.children?.[0];
    if (!code || code.tagName !== 'code') return <pre>{hastText(node)}</pre>;
    const cls = (code.properties?.className as string[] | undefined)?.find(c => c.startsWith('language-'));
    const lang = cls?.slice('language-'.length);
    const meta = code.data?.meta?.trim();
    const src = hastText(code).replace(/\n$/, '');
    const name = meta?.split(/\s+/)[0] ?? '';

    switch (lang) {
        case 'mermaid':
            return <Mermaid chart={src} caption={parseTitle(meta)} />;
        case 'diagram': {
            const D = DIAGRAMS[name];
            return D ? <D /> : <Invalid what="diagram" error={`"${name}" is not registered in embeds.tsx`} />;
        }
        case 'chart': {
            const C = CHARTS[name];
            return C ? <C /> : <Invalid what="chart" error={`"${name}" is not registered in embeds.tsx`} />;
        }
        case 'endpoint': {
            const spec = parseJson<EndpointSpec>(src, 'endpoint');
            return spec && typeof spec === 'object' && 'method' in (spec as object) ? <ApiEndpoint spec={spec as EndpointSpec} /> : <>{spec}</>;
        }
        case 'cards': {
            const items = parseJson<CardItem[]>(src, 'cards');
            return Array.isArray(items) ? <Cards items={items} cols={meta?.includes('cols=3') ? 3 : 2} /> : <>{items}</>;
        }
        case 'screenshot': {
            const shot = parseJson<ScreenshotProps>(src, 'screenshot');
            return shot && typeof shot === 'object' && 'src' in (shot as object) ? <Screenshot {...(shot as ScreenshotProps)} /> : <>{shot}</>;
        }
        case 'codegroup':
            return <CodeGroup tabs={parseCodeGroup(src)} />;
        default:
            return <CodeBlock code={src} lang={lang} meta={meta} />;
    }
}

function Heading({ level, id, children }: { level: 2 | 3 | 4; id?: string; children: ReactNode }) {
    const Tag = `h${level}` as const;
    const styles = {
        2: 'mt-14 mb-4 text-[26px] font-semibold tracking-tight text-white scroll-mt-24',
        3: 'mt-10 mb-3 text-[19px] font-semibold tracking-tight text-zinc-100 scroll-mt-24',
        4: 'mt-8 mb-2 text-[16px] font-semibold text-zinc-200 scroll-mt-24',
    }[level];
    return (
        <Tag id={id} className={`group relative ${styles}`}>
            {children}
            {id && (
                <a href={`#${id}`} aria-label="Link to this section" className="ml-2 inline-flex align-middle text-zinc-600 opacity-0 transition-opacity hover:text-emerald-400 group-hover:opacity-100">
                    <Link2 className="h-4 w-4" />
                </a>
            )}
        </Tag>
    );
}

/** Internal links: "/docs/..." and relative slugs stay in-app; http(s) opens a new tab. */
function DocLink({ href = '', children }: { href?: string; children: ReactNode }) {
    const cls = 'font-medium text-emerald-400 underline decoration-emerald-400/30 underline-offset-4 transition-colors hover:decoration-emerald-400';
    if (/^https?:/.test(href)) return <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{children}</a>;
    if (href.startsWith('#')) return <a href={href} className={cls}>{children}</a>;
    const to = href.startsWith('/') ? href : `/docs/${href}`;
    return <Link to={to} className={cls}>{children}</Link>;
}

const components: Components = {
    h1: ({ children }) => <h2 className="mt-12 mb-4 text-3xl font-semibold text-white">{children}</h2>,
    h2: ({ id, children }) => <Heading level={2} id={id}>{children}</Heading>,
    h3: ({ id, children }) => <Heading level={3} id={id}>{children}</Heading>,
    h4: ({ id, children }) => <Heading level={4} id={id}>{children}</Heading>,
    // A paragraph holding only an image renders as a figure, which can't live inside <p>.
    p: ({ node, children }) => {
        const kids = (node as unknown as HastNode | undefined)?.children ?? [];
        if (kids.length === 1 && kids[0].tagName === 'img') return <>{children}</>;
        return <p className="my-5 text-[15.5px] leading-[1.8] text-zinc-400">{children}</p>;
    },
    a: ({ href, children }) => <DocLink href={href}>{children}</DocLink>,
    strong: ({ children }) => <strong className="font-semibold text-zinc-100">{children}</strong>,
    ul: ({ children }) => <ul className="my-5 ml-5 list-disc space-y-2 text-[15.5px] leading-[1.75] text-zinc-400 marker:text-zinc-600">{children}</ul>,
    ol: ({ children }) => <ol className="my-5 ml-5 list-decimal space-y-2 text-[15.5px] leading-[1.75] text-zinc-400 marker:font-mono marker:text-[13px] marker:text-emerald-400/80">{children}</ol>,
    li: ({ children }) => <li className="pl-1.5 [&>p]:my-1">{children}</li>,
    hr: () => <hr className="my-12 border-white/[0.06]" />,
    blockquote: ({ children }) => <blockquote className="my-6 border-l-2 border-zinc-700 pl-4 text-zinc-400 [&>p]:my-2">{children}</blockquote>,
    aside: (props) => {
        const p = props as unknown as { 'data-callout'?: CalloutType; 'data-title'?: string; children: ReactNode };
        return <Callout type={p['data-callout']} title={p['data-title']}>{p.children}</Callout>;
    },
    pre: ({ node }) => <FencedBlock node={node as unknown as HastNode} />,
    code: ({ children }) => (
        <code className="rounded-md border border-white/[0.06] bg-white/[0.04] px-[5px] py-px font-mono text-[0.86em] text-zinc-200">{children}</code>
    ),
    table: ({ children }) => (
        <div className="my-6 overflow-x-auto rounded-xl border border-white/[0.06]">
            <table className="w-full border-collapse text-left text-[14px]">{children}</table>
        </div>
    ),
    thead: ({ children }) => <thead className="bg-white/[0.02]">{children}</thead>,
    th: ({ children, style }) => (
        <th style={style} className="border-b border-white/[0.06] px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wider text-zinc-500">{children}</th>
    ),
    td: ({ children, style }) => (
        <td style={style} className="border-b border-white/[0.04] px-4 py-2.5 align-top leading-6 text-zinc-400 [tr:last-child>&]:border-b-0">{children}</td>
    ),
    img: ({ src, alt, title }) => <Screenshot src={String(src ?? '')} alt={alt} caption={title ?? alt} />,
};

export function DocsMarkdown({ source }: { source: string }) {
    return (
        <div className="docs-prose">
            <Markdown remarkPlugins={[remarkGfm, remarkHeadingIds, remarkCallouts]} components={components}>
                {source}
            </Markdown>
        </div>
    );
}
