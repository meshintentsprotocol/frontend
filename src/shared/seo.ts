// ============================================================================
// SEO head model
// ============================================================================
// One place decides the title, description, canonical, social tags and
// structured data of a content URL. The app applies the result to the live
// document (src/lib/useSeo.ts) and the Vercel function writes the same result
// into the HTML it serves (api/page.ts), so crawlers and users always agree.
// Keep this file free of Vite, React and Node-only imports.

export interface SeoFields {
    metaTitle?: string;
    metaDescription?: string;
    /** Absolute image URL. */
    ogImage?: string;
    canonical?: string;
    noindex?: boolean;
}

export interface SiteSettings {
    siteName?: string;
    description?: string;
    ogImage?: string;
    twitterHandle?: string;
    sameAs?: string[];
}

export interface Site {
    /** Origin without a trailing slash, e.g. https://example.com */
    url: string;
    settings?: SiteSettings | null;
}

export const SITE_DEFAULTS = {
    siteName: 'BCH Intents',
    description: 'Intent-based cross-chain swaps on Bitcoin Cash. Trustless, instant, non-custodial.',
    ogImage: '/assets/pwa-512x512.png',
    logo: '/assets/logo.svg',
};

export interface Crumb {
    name: string;
    /** Site-relative path. */
    path: string;
}

export interface SeoInput {
    /** Site-relative path of the page, e.g. /kb/bchmesh/intro */
    path: string;
    title: string;
    /** Appended after the title unless `seo.metaTitle` is set. */
    titleSuffix?: string;
    description?: string;
    image?: string;
    imageAlt?: string;
    type?: 'website' | 'article';
    seo?: SeoFields | null;
    /** Forces noindex regardless of the document's own setting. */
    noindex?: boolean;
    published?: string;
    modified?: string;
    author?: { name: string; url?: string; sameAs?: string[] } | null;
    section?: string;
    tags?: string[];
    breadcrumbs?: Crumb[];
    /** Schema.org type for article pages. */
    schemaType?: 'Article' | 'TechArticle';
    /** Extra JSON-LD nodes. */
    jsonLd?: Record<string, unknown>[];
}

export interface SeoHead {
    title: string;
    description: string;
    canonical: string;
    robots: string;
    /** `property` → content for og:* and `name` → content for twitter:*. */
    meta: { key: string; value: string; attr: 'name' | 'property' }[];
    jsonLd: Record<string, unknown>[];
}

const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);

const abs = (site: Site, pathOrUrl: string) => (/^https?:/.test(pathOrUrl) ? pathOrUrl : `${site.url}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`);

/** Sanity image → 1200×630 share card; other URLs pass through. */
function shareImage(url: string): string {
    return url.includes('cdn.sanity.io') ? `${url.split('?')[0]}?w=1200&h=630&fit=crop&auto=format` : url;
}

export function organizationLd(site: Site): Record<string, unknown> {
    const s = site.settings ?? {};
    return {
        '@type': 'Organization',
        '@id': `${site.url}/#organization`,
        name: s.siteName || SITE_DEFAULTS.siteName,
        url: site.url,
        logo: abs(site, SITE_DEFAULTS.logo),
        ...(s.sameAs?.length ? { sameAs: s.sameAs } : {}),
    };
}

export function websiteLd(site: Site): Record<string, unknown> {
    const s = site.settings ?? {};
    return {
        '@type': 'WebSite',
        '@id': `${site.url}/#website`,
        name: s.siteName || SITE_DEFAULTS.siteName,
        url: site.url,
        description: s.description || SITE_DEFAULTS.description,
        publisher: { '@id': `${site.url}/#organization` },
    };
}

function breadcrumbLd(site: Site, crumbs: Crumb[]): Record<string, unknown> {
    return {
        '@type': 'BreadcrumbList',
        itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: abs(site, c.path) })),
    };
}

export function buildSeo(input: SeoInput, site: Site): SeoHead {
    const s = site.settings ?? {};
    const siteName = s.siteName || SITE_DEFAULTS.siteName;
    const seo = input.seo ?? {};

    const title = seo.metaTitle || (input.titleSuffix ? `${input.title} · ${input.titleSuffix}` : input.title);
    const description = clip((seo.metaDescription || input.description || s.description || SITE_DEFAULTS.description).replace(/\s+/g, ' ').trim(), 200);
    const canonical = seo.canonical || abs(site, input.path);
    const noindex = input.noindex || !!seo.noindex;
    const image = shareImage(abs(site, seo.ogImage || input.image || s.ogImage || SITE_DEFAULTS.ogImage));
    const type = input.type ?? 'website';

    const meta: SeoHead['meta'] = [
        { attr: 'property', key: 'og:site_name', value: siteName },
        { attr: 'property', key: 'og:type', value: type },
        { attr: 'property', key: 'og:title', value: title },
        { attr: 'property', key: 'og:description', value: description },
        { attr: 'property', key: 'og:url', value: canonical },
        { attr: 'property', key: 'og:image', value: image },
        { attr: 'name', key: 'twitter:card', value: 'summary_large_image' },
        { attr: 'name', key: 'twitter:title', value: title },
        { attr: 'name', key: 'twitter:description', value: description },
        { attr: 'name', key: 'twitter:image', value: image },
    ];
    if (input.imageAlt) meta.push({ attr: 'property', key: 'og:image:alt', value: input.imageAlt });
    if (s.twitterHandle) meta.push({ attr: 'name', key: 'twitter:site', value: s.twitterHandle });
    if (type === 'article') {
        if (input.published) meta.push({ attr: 'property', key: 'article:published_time', value: input.published });
        if (input.modified) meta.push({ attr: 'property', key: 'article:modified_time', value: input.modified });
        if (input.section) meta.push({ attr: 'property', key: 'article:section', value: input.section });
        for (const t of input.tags ?? []) meta.push({ attr: 'property', key: 'article:tag', value: t });
    }

    const graph: Record<string, unknown>[] = [organizationLd(site)];
    if (type === 'article') {
        graph.push({
            '@type': input.schemaType ?? 'Article',
            '@id': `${canonical}#article`,
            headline: clip(input.title, 110),
            description,
            image: [image],
            url: canonical,
            mainEntityOfPage: canonical,
            ...(input.published ? { datePublished: input.published } : {}),
            ...(input.modified || input.published ? { dateModified: input.modified || input.published } : {}),
            ...(input.section ? { articleSection: input.section } : {}),
            ...(input.tags?.length ? { keywords: input.tags.join(', ') } : {}),
            author: input.author
                ? { '@type': 'Person', name: input.author.name, ...(input.author.url ? { url: input.author.url } : {}), ...(input.author.sameAs?.length ? { sameAs: input.author.sameAs } : {}) }
                : { '@id': `${site.url}/#organization` },
            publisher: { '@id': `${site.url}/#organization` },
        });
    }
    if (input.breadcrumbs?.length) graph.push(breadcrumbLd(site, input.breadcrumbs));
    if (input.jsonLd) graph.push(...input.jsonLd);

    return {
        title,
        description,
        canonical,
        robots: noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large',
        meta,
        jsonLd: [{ '@context': 'https://schema.org', '@graph': graph }],
    };
}

// ── Server rendering ─────────────────────────────────────────────────────────

export const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Marker attribute on every tag this module owns, so they can be replaced as a set. */
export const SEO_ATTR = 'data-seo';

export function renderHead(head: SeoHead): string {
    const lines = [
        `<title>${escapeHtml(head.title)}</title>`,
        `<meta name="description" content="${escapeHtml(head.description)}" ${SEO_ATTR} />`,
        `<meta name="robots" content="${head.robots}" ${SEO_ATTR} />`,
        `<link rel="canonical" href="${escapeHtml(head.canonical)}" ${SEO_ATTR} />`,
        ...head.meta.map(m => `<meta ${m.attr}="${m.key}" content="${escapeHtml(m.value)}" ${SEO_ATTR} />`),
        // "<" is escaped so a title or body string can never close the script element.
        ...head.jsonLd.map(j => `<script type="application/ld+json" ${SEO_ATTR}>${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`),
    ];
    return lines.join('\n  ');
}

// ── Page builders ────────────────────────────────────────────────────────────
// Plain-data inputs so the app and the function build identical heads.

export interface KbArticleSeoData {
    id: string;
    categoryId: string;
    title: string;
    summary: string;
    published?: string;
    modified?: string;
    cover?: string;
    coverAlt?: string;
    tags: { title: string }[];
    author?: { name: string; links?: string[] } | null;
    seo?: SeoFields | null;
}

export function kbArticleSeo(a: KbArticleSeoData, categoryTitle: string | undefined, site: Site): SeoHead {
    return buildSeo({
        path: `/kb/${a.categoryId}/${a.id}`,
        title: a.title,
        titleSuffix: 'BCH Intents Knowledge Base',
        description: a.summary,
        image: a.cover,
        imageAlt: a.coverAlt || a.title,
        type: 'article',
        schemaType: 'Article',
        seo: a.seo,
        published: a.published,
        modified: a.modified,
        author: a.author ? { name: a.author.name, sameAs: a.author.links } : null,
        section: categoryTitle,
        tags: a.tags.map(t => t.title),
        breadcrumbs: [
            { name: 'Knowledge Base', path: '/kb' },
            ...(categoryTitle ? [{ name: categoryTitle, path: `/kb/${a.categoryId}` }] : []),
            { name: a.title, path: `/kb/${a.categoryId}/${a.id}` },
        ],
    }, site);
}

export function kbIndexSeo(site: Site): SeoHead {
    return buildSeo({
        path: '/kb',
        title: 'Knowledge Base',
        titleSuffix: 'BCH Intents',
        description: 'Guides and explainers on intent-based swaps, BCHMesh liquidity, cross-chain settlement and building on Bitcoin Cash.',
        breadcrumbs: [{ name: 'Knowledge Base', path: '/kb' }],
        jsonLd: [websiteLd(site)],
    }, site);
}

export function kbCategorySeo(c: { id: string; title: string; description?: string; seo?: SeoFields | null }, site: Site): SeoHead {
    return buildSeo({
        path: `/kb/${c.id}`,
        title: c.title,
        titleSuffix: 'BCH Intents Knowledge Base',
        description: c.description,
        seo: c.seo,
        breadcrumbs: [{ name: 'Knowledge Base', path: '/kb' }, { name: c.title, path: `/kb/${c.id}` }],
    }, site);
}

export function kbTagSeo(t: { slug: string; title: string; description?: string; seo?: SeoFields | null }, count: number, site: Site): SeoHead {
    return buildSeo({
        path: `/kb/tag/${t.slug}`,
        title: `${t.title}: articles and guides`,
        titleSuffix: 'BCH Intents',
        description: t.description || `Articles and developer docs about ${t.title} on BCH Intents.`,
        seo: t.seo,
        // A tag with nothing in it is a thin page.
        noindex: count === 0,
        breadcrumbs: [{ name: 'Knowledge Base', path: '/kb' }, { name: t.title, path: `/kb/tag/${t.slug}` }],
    }, site);
}

export interface DocsPageSeoData {
    slug: string;
    title: string;
    description?: string;
    status: string;
    sectionTitle: string;
    trail: string[];
    updated?: string;
    modified?: string;
    tags: { title: string }[];
    seo?: SeoFields | null;
}

export function docsPageSeo(p: DocsPageSeoData, site: Site): SeoHead {
    return buildSeo({
        path: `/docs/${p.slug}`,
        title: p.title,
        titleSuffix: 'BCH Intents Docs',
        description: p.description,
        type: 'article',
        schemaType: 'TechArticle',
        seo: p.seo,
        // Planned pages have no body yet: keep them out of the index.
        noindex: p.status === 'planned',
        modified: p.modified || p.updated,
        published: p.updated,
        section: p.sectionTitle,
        tags: p.tags.map(t => t.title),
        breadcrumbs: [
            { name: 'Docs', path: '/docs' },
            { name: p.sectionTitle, path: `/docs/${p.slug.split('/')[0]}` },
            { name: p.title, path: `/docs/${p.slug}` },
        ],
    }, site);
}

export function docsHomeSeo(site: Site): SeoHead {
    return buildSeo({
        path: '/docs',
        title: 'BCH Intents Developer Docs',
        description: 'Developer documentation for BCH Intents: intents, Mesh pools, covenants, SDKs, the Mesh Server API and running solvers.',
        breadcrumbs: [{ name: 'Docs', path: '/docs' }],
    }, site);
}

// ── MCP ──────────────────────────────────────────────────────────────────────

export function mcpSeo(site: Site): SeoHead {
    return buildSeo({
        path: '/mcp',
        title: 'MCP Server for AI Agents',
        titleSuffix: 'BCH Intents',
        description: 'Connect Claude, Cursor, ChatGPT or any MCP client to BCH Intents and BCHMesh: quote swaps, prepare orders, read pools and strategies. Non-custodial: your wallet signs.',
        breadcrumbs: [{ name: 'MCP', path: '/mcp' }],
        jsonLd: [websiteLd(site)],
    }, site);
}

/** A funding link is one order's page: nothing to index. */
export function fundSeo(site: Site): SeoHead {
    return buildSeo({ path: '/fund', title: 'Fund your order', titleSuffix: 'BCH Intents', noindex: true }, site);
}
