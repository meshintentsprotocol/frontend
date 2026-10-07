// ============================================================================
// /kb/** and /docs/** — HTML with real head tags and content
// ============================================================================
// The app is a client-rendered SPA, so without this every URL would answer with
// the same generic <title> and an empty body. vercel.json rewrites the content
// routes here: the function loads the document from Sanity, writes its head
// (title, description, canonical, social tags, JSON-LD) and a plain rendering of
// the body into the app shell, and returns that. The app then boots as usual
// and replaces the body, showing the same content.
//
// Anything unexpected (Sanity not configured, Sanity down) falls back to the
// untouched shell, so the worst case is exactly the old behaviour.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Marked, type Tokens } from 'marked';
import { sanityQuery, SEO_PROJECTION, SETTINGS_QUERY, type SanityConfig } from '../src/shared/sanity.js';
import {
    buildSeo, docsHomeSeo, docsPageSeo, escapeHtml, kbArticleSeo, kbCategorySeo, kbIndexSeo, kbTagSeo, renderHead,
    type SeoFields, type SeoHead, type Site, type SiteSettings,
} from '../src/shared/seo.js';
import { sanityFromEnv, selfOrigin, send, siteOf, type Req, type Res } from './_content.js';

const CACHE_OK = 'public, s-maxage=60, stale-while-revalidate=600';
const CACHE_MISS = 'public, s-maxage=30';
const CACHE_SHELL = 'public, s-maxage=30';

interface Rendered {
    status: number;
    head: SeoHead;
    /** Body HTML placed inside #root until the app boots. */
    body: string;
}

// ── App shell ────────────────────────────────────────────────────────────────

let shellCache: string | undefined;

async function loadShell(req: Req): Promise<string> {
    if (shellCache) return shellCache;
    try {
        // Bundled with the function through `includeFiles` in vercel.json.
        shellCache = await readFile(join(process.cwd(), 'dist', 'index.html'), 'utf8');
    } catch {
        const res = await fetch(`${selfOrigin(req)}/index.html`);
        if (!res.ok) throw new Error(`could not load the app shell (${res.status})`);
        shellCache = await res.text();
    }
    return shellCache;
}

/** Swaps the shell's generic head tags for the page's own and fills #root. */
export function compose(shell: string, page: Rendered): string {
    const stripped = shell
        .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
        .replace(/<meta\s+name="(?:description|robots)"[^>]*>\s*/gi, '')
        .replace(/<meta\s+(?:property|name)="(?:og|twitter|article):[^"]*"[^>]*>\s*/gi, '')
        .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, '');
    return stripped
        .replace(/<\/head>/i, `  ${renderHead(page.head)}\n</head>`)
        .replace(/<div id="root">\s*<\/div>/i, `<div id="root">${page.body}</div>`);
}

// ── Markdown → plain HTML ────────────────────────────────────────────────────

const FENCE = /^```(\w+)[^\n]*\n([\s\S]*?)^```[ \t]*$/gm;

/** Rewrites the docs' custom fenced blocks into ordinary markdown. */
function flattenDocsBlocks(md: string): string {
    return md.replace(FENCE, (all, lang: string, src: string) => {
        try {
            switch (lang) {
                case 'endpoint': {
                    const e = JSON.parse(src) as { method: string; path: string; summary?: string; params?: { name: string; in?: string; type?: string; required?: boolean; description?: string }[] };
                    const rows = (e.params ?? []).map(p => `| \`${p.name}\` | ${p.in ?? ''} | ${p.type ?? ''} | ${p.required ? 'yes' : 'no'} | ${p.description ?? ''} |`);
                    return [
                        `**${e.method}** \`${e.path}\``,
                        e.summary ?? '',
                        rows.length ? ['| Parameter | In | Type | Required | Description |', '| --- | --- | --- | --- | --- |', ...rows].join('\n') : '',
                    ].filter(Boolean).join('\n\n');
                }
                case 'cards': {
                    const cards = JSON.parse(src) as { title: string; description?: string; href?: string }[];
                    return cards.map(c => `- [${c.title}](${c.href ?? '#'})${c.description ? `: ${c.description}` : ''}`).join('\n');
                }
                case 'screenshot': {
                    const s = JSON.parse(src) as { src: string; caption?: string };
                    return `![${s.caption ?? ''}](${s.src})`;
                }
                case 'codegroup':
                    return src.split(/^@@\s*/m).filter(Boolean).map(part => {
                        const [label, ...code] = part.split('\n');
                        const [title, l] = label.split('|').map(x => x.trim());
                        return `**${title}**\n\n\`\`\`${l ?? ''}\n${code.join('\n').trimEnd()}\n\`\`\``;
                    }).join('\n\n');
                // Rendered client-side only; nothing readable to show.
                case 'diagram':
                case 'chart':
                case 'mermaid':
                    return '';
                default:
                    return all;
            }
        } catch {
            return '';
        }
    });
}

// The app never renders raw HTML from content, so neither does this.
const safeHtml = { html: ({ text }: { text: string }) => escapeHtml(text) };

const kbMarkdown = new Marked({ gfm: true, renderer: safeHtml });

const docsMarkdown = new Marked({
    gfm: true,
    renderer: safeHtml,
    walkTokens: token => {
        // Docs links are written relative to /docs (see DocsMarkdown.tsx).
        if (token.type === 'link') {
            const link = token as Tokens.Link;
            if (!/^(https?:|mailto:|\/|#)/.test(link.href)) link.href = `/docs/${link.href}`;
        }
    },
});

function toHtml(md: string, area: 'kb' | 'docs'): string {
    const src = md.replace(/^>\s*\[!(\w+)\]\s*/gm, (_, type: string) => `> **${type[0]}${type.slice(1).toLowerCase()}:** `);
    return area === 'docs'
        ? docsMarkdown.parse(flattenDocsBlocks(src), { async: false })
        : kbMarkdown.parse(src, { async: false });
}

const STYLE = 'max-width:780px;margin:0 auto;padding:112px 20px 64px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.7;color:#d4d4d8';

function article(opts: { crumbs: { name: string; path: string }[]; title: string; lead?: string; meta?: string; html: string }): string {
    const crumbs = opts.crumbs.map(c => `<a href="${escapeHtml(c.path)}" style="color:#a1a1aa">${escapeHtml(c.name)}</a>`).join(' › ');
    return `<main data-prerender style="${STYLE}">` +
        `<nav aria-label="Breadcrumb" style="font-size:13px">${crumbs}</nav>` +
        `<h1 style="color:#fff;line-height:1.2">${escapeHtml(opts.title)}</h1>` +
        (opts.lead ? `<p style="font-size:18px">${escapeHtml(opts.lead)}</p>` : '') +
        (opts.meta ? `<p style="font-size:13px;color:#a1a1aa">${opts.meta}</p>` : '') +
        opts.html +
        `</main>`;
}

const links = (items: { href: string; title: string; text?: string }[]) =>
    `<ul>${items.map(i => `<li><a href="${escapeHtml(i.href)}" style="color:#34d399">${escapeHtml(i.title)}</a>${i.text ? `: ${escapeHtml(i.text)}` : ''}</li>`).join('')}</ul>`;

// ── Routes ───────────────────────────────────────────────────────────────────

interface Tag { slug: string; title: string }

const notFound = (site: Site, path: string, what: string): Rendered => ({
    status: 404,
    head: buildSeo({ path, title: `${what} not found`, titleSuffix: 'BCH Intents', noindex: true }, site),
    body: '',
});

async function renderKb(cfg: SanityConfig, parts: string[], settings: SiteSettings | null, req: Req): Promise<Rendered> {
    const site = siteOf(req, settings);
    const path = `/${['kb', ...parts].join('/')}`;
    const KB = { name: 'Knowledge Base', path: '/kb' };

    if (parts.length === 0) {
        const data = await sanityQuery<{ categories: { id: string; title: string; description?: string }[]; articles: { id: string; categoryId: string; title: string; summary?: string }[] }>(cfg, `{
            "categories": *[_type == "kbCategory"] | order(order asc){"id": slug.current, title, description},
            "articles": *[_type == "kbArticle" && defined(category)] | order(publishedAt desc){"id": slug.current, "categoryId": category->slug.current, title, summary}
        }`);
        return {
            status: 200,
            head: kbIndexSeo(site),
            body: article({
                crumbs: [KB],
                title: 'Knowledge Base',
                html: `<h2>Categories</h2>${links(data.categories.map(c => ({ href: `/kb/${c.id}`, title: c.title, text: c.description })))}` +
                    `<h2>Articles</h2>${links(data.articles.map(a => ({ href: `/kb/${a.categoryId}/${a.id}`, title: a.title, text: a.summary })))}`,
            }),
        };
    }

    if (parts[0] === 'search') {
        return { status: 200, head: buildSeo({ path: '/kb/search', title: 'Search', titleSuffix: 'BCH Intents Knowledge Base', noindex: true }, site), body: '' };
    }

    if (parts[0] === 'tag' && parts.length === 2) {
        const data = await sanityQuery<{ tag: (Tag & { description?: string; seo?: SeoFields }) | null; articles: { id: string; categoryId: string; title: string; summary?: string }[]; docs: { slug: string; title: string; description?: string }[] }>(cfg, `{
            "tag": *[_type == "tag" && slug.current == $slug][0]{"slug": slug.current, title, description, ${SEO_PROJECTION}},
            "articles": *[_type == "kbArticle" && defined(category) && $slug in tags[]->slug.current] | order(publishedAt desc){"id": slug.current, "categoryId": category->slug.current, title, summary},
            "docs": *[_type == "docsPage" && status != "planned" && $slug in tags[]->slug.current] | order(title asc){"slug": slug.current, title, description}
        }`, { slug: parts[1] });
        if (!data.tag) return notFound(site, path, 'Tag');
        return {
            status: 200,
            head: kbTagSeo(data.tag, data.articles.length + data.docs.length, site),
            body: article({
                crumbs: [KB, { name: data.tag.title, path }],
                title: data.tag.title,
                lead: data.tag.description,
                html: links(data.articles.map(a => ({ href: `/kb/${a.categoryId}/${a.id}`, title: a.title, text: a.summary }))) +
                    (data.docs.length ? `<h2>In the developer docs</h2>${links(data.docs.map(d => ({ href: `/docs/${d.slug}`, title: d.title, text: d.description })))}` : ''),
            }),
        };
    }

    if (parts.length === 1) {
        const data = await sanityQuery<{ category: { id: string; title: string; description?: string; seo?: SeoFields } | null; articles: { id: string; title: string; summary?: string }[] }>(cfg, `{
            "category": *[_type == "kbCategory" && slug.current == $id][0]{"id": slug.current, title, description, ${SEO_PROJECTION}},
            "articles": *[_type == "kbArticle" && category->slug.current == $id] | order(publishedAt desc){"id": slug.current, title, summary}
        }`, { id: parts[0] });
        if (!data.category) return notFound(site, path, 'Category');
        return {
            status: 200,
            head: kbCategorySeo(data.category, site),
            body: article({
                crumbs: [KB, { name: data.category.title, path }],
                title: data.category.title,
                lead: data.category.description,
                html: links(data.articles.map(a => ({ href: `/kb/${parts[0]}/${a.id}`, title: a.title, text: a.summary }))),
            }),
        };
    }

    if (parts.length === 2) {
        const a = await sanityQuery<{
            id: string; categoryId: string; categoryTitle?: string; title: string; summary?: string; content?: string; publishedAt?: string; modified?: string;
            cover?: string; coverAlt?: string; tags: Tag[]; author?: { name: string; links?: string[] } | null; seo?: SeoFields;
        } | null>(cfg, `*[_type == "kbArticle" && slug.current == $id][0]{
            "id": slug.current, "categoryId": category->slug.current, "categoryTitle": category->title, title, summary, "content": body,
            publishedAt, "modified": _updatedAt, "cover": coverImage.asset->url, "coverAlt": coverImage.alt,
            "tags": coalesce(tags[]->{"slug": slug.current, title}, []), "author": author->{name, links}, ${SEO_PROJECTION}
        }`, { id: parts[1] });
        if (!a) return notFound(site, path, 'Article');
        // Same fallback the app uses when an article has no author document.
        const author = a.author ?? { name: 'BCH Intents' };
        return {
            status: 200,
            head: kbArticleSeo({ ...a, summary: a.summary ?? '', published: a.publishedAt, author }, a.categoryTitle, site),
            body: article({
                crumbs: [KB, ...(a.categoryTitle ? [{ name: a.categoryTitle, path: `/kb/${a.categoryId}` }] : []), { name: a.title, path }],
                title: a.title,
                lead: a.summary,
                meta: [escapeHtml(author.name), a.publishedAt ? `<time datetime="${escapeHtml(a.publishedAt)}">${escapeHtml(a.publishedAt)}</time>` : '']
                    .filter(Boolean).join(' · '),
                html: toHtml(a.content ?? '', 'kb') +
                    (a.tags.length ? `<h2>Topics</h2>${links(a.tags.map(t => ({ href: `/kb/tag/${t.slug}`, title: t.title })))}` : ''),
            }),
        };
    }

    return notFound(site, path, 'Page');
}

interface NavItem { _type: string; _ref?: string; title?: string; items?: NavItem[] }

/** Group titles from the section root down to the page, or null when the page is not in the tree. */
function trailTo(items: NavItem[], id: string, trail: string[] = []): string[] | null {
    for (const item of items) {
        if (item._ref === id) return trail;
        if (item.items) {
            const found = trailTo(item.items, id, [...trail, item.title ?? '']);
            if (found) return found;
        }
    }
    return null;
}

async function renderDocs(cfg: SanityConfig, parts: string[], settings: SiteSettings | null, req: Req): Promise<Rendered> {
    const site = siteOf(req, settings);
    const DOCS = { name: 'Docs', path: '/docs' };

    if (parts.length === 0) {
        const data = await sanityQuery<{ sections: { id: string; title: string; tagline?: string }[]; pages: { slug: string; title: string; description?: string }[] }>(cfg, `{
            "sections": *[_type == "docsSection"] | order(order asc){"id": slug.current, title, tagline},
            "pages": *[_type == "docsPage" && status != "planned"] | order(slug.current asc){"slug": slug.current, title, description}
        }`);
        return {
            status: 200,
            head: docsHomeSeo(site),
            body: article({
                crumbs: [DOCS],
                title: 'BCH Intents Developer Docs',
                html: data.sections.map(s =>
                    `<h2>${escapeHtml(s.title)}</h2>${s.tagline ? `<p>${escapeHtml(s.tagline)}</p>` : ''}` +
                    links(data.pages.filter(p => p.slug.startsWith(`${s.id}/`)).map(p => ({ href: `/docs/${p.slug}`, title: p.title, text: p.description }))),
                ).join(''),
            }),
        };
    }

    const slug = parts.join('/');
    const path = `/docs/${slug}`;
    const data = await sanityQuery<{
        page: { _id: string; slug: string; title: string; description?: string; status?: string; updated?: string; modified?: string; body?: string; tags: Tag[]; seo?: SeoFields } | null;
        section: { id: string; title: string; groups?: NavItem[] } | null;
    }>(cfg, `{
        "page": *[_type == "docsPage" && slug.current == $slug][0]{
            _id, "slug": slug.current, title, description, status, updated, "modified": _updatedAt, body,
            "tags": coalesce(tags[]->{"slug": slug.current, title}, []), ${SEO_PROJECTION}
        },
        "section": *[_type == "docsSection" && slug.current == $section][0]{"id": slug.current, title, groups}
    }`, { slug, section: parts[0] });

    if (!data.page) {
        // /docs/<section-id> is a client-side redirect to the section's first page.
        if (data.section && parts.length === 1) {
            return { status: 200, head: buildSeo({ path, title: data.section.title, titleSuffix: 'BCH Intents Docs', noindex: true }, site), body: '' };
        }
        return notFound(site, path, 'Page');
    }

    const p = data.page;
    // Mirrors buildPage() in src/docs/lib/content.ts: no body means planned.
    const status = !p.body?.trim() ? 'planned' : p.status ?? 'draft';
    const sectionTitle = data.section?.title ?? 'Docs';
    const trail = trailTo(data.section?.groups ?? [], p._id) ?? [];
    return {
        status: 200,
        head: docsPageSeo({ slug: p.slug, title: p.title, description: p.description, status, sectionTitle, trail, updated: p.updated, modified: p.modified, tags: p.tags, seo: p.seo }, site),
        body: article({
            crumbs: [DOCS, { name: sectionTitle, path: `/docs/${parts[0]}` }, { name: p.title, path }],
            title: p.title,
            lead: p.description,
            html: toHtml(p.body ?? '', 'docs'),
        }),
    };
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function render(cfg: SanityConfig, pathname: string, req: Req): Promise<Rendered | null> {
    const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const area = parts.shift();
    if (area !== 'kb' && area !== 'docs') return null;
    const settings = await sanityQuery<SiteSettings | null>(cfg, SETTINGS_QUERY);
    return area === 'kb' ? renderKb(cfg, parts, settings, req) : renderDocs(cfg, parts, settings, req);
}

export default async function handler(req: Req, res: Res) {
    let shell: string;
    try {
        shell = await loadShell(req);
    } catch (e) {
        return send(res, 500, 'text/plain; charset=utf-8', `Could not load the app: ${(e as Error).message}`, 'no-store');
    }

    // vercel.json passes the original path as ?p=; req.url is the fallback for local runs.
    const p = req.query?.p;
    const pathname = typeof p === 'string' ? p : new URL(req.url ?? '/', 'http://x').pathname;

    const cfg = sanityFromEnv();
    if (!cfg) return send(res, 200, 'text/html; charset=utf-8', shell, CACHE_SHELL);

    try {
        const page = await render(cfg, pathname, req);
        if (!page) return send(res, 200, 'text/html; charset=utf-8', shell, CACHE_SHELL);
        return send(res, page.status, 'text/html; charset=utf-8', compose(shell, page), page.status === 200 ? CACHE_OK : CACHE_MISS);
    } catch (e) {
        console.error('[api/page]', pathname, e);
        return send(res, 200, 'text/html; charset=utf-8', shell, CACHE_SHELL);
    }
}
