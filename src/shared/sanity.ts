// ============================================================================
// Sanity read access
// ============================================================================
// Shared by the app (src/lib/sanity.ts) and the Vercel functions (api/), so it
// must stay free of Vite, React and Node-only imports. Reads go to Sanity's
// query CDN with no token: only published documents are visible.

export interface SanityConfig {
    projectId: string;
    dataset: string;
}

const API_VERSION = 'v2025-02-19';

export async function sanityQuery<T>(cfg: SanityConfig, query: string, params: Record<string, unknown> = {}): Promise<T> {
    const qs = new URLSearchParams({ query });
    for (const [k, v] of Object.entries(params)) qs.set(`$${k}`, JSON.stringify(v));
    const res = await fetch(`https://${cfg.projectId}.apicdn.sanity.io/${API_VERSION}/data/query/${cfg.dataset}?${qs}`);
    if (!res.ok) throw new Error(`Sanity query failed (${res.status})`);
    return ((await res.json()) as { result: T }).result;
}

/** Sized, auto-format variant of a Sanity image asset URL. */
export function imageUrl(url: string | undefined | null, opts: { w?: number; h?: number } = {}): string | undefined {
    if (!url) return undefined;
    if (!url.includes('cdn.sanity.io')) return url;
    const qs = new URLSearchParams({ auto: 'format', fit: 'crop' });
    if (opts.w) qs.set('w', String(opts.w));
    if (opts.h) qs.set('h', String(opts.h));
    return `${url.split('?')[0]}?${qs}`;
}

// ── Projections ──────────────────────────────────────────────────────────────

export const SEO_PROJECTION = `seo{metaTitle, metaDescription, canonical, noindex, "ogImage": ogImage.asset->url}`;

export const SETTINGS_QUERY = `*[_id == "siteSettings"][0]{siteName, description, twitterHandle, sameAs, "ogImage": ogImage.asset->url}`;

const TAGS = `"tags": coalesce(tags[]->{"slug": slug.current, title}, [])`;

export const KB_QUERY = `{
    "categories": *[_type == "kbCategory"] | order(order asc, title asc){
        "id": slug.current, title, description, icon, ${SEO_PROJECTION}
    },
    "articles": *[_type == "kbArticle" && defined(category)] | order(featured desc, publishedAt desc){
        "id": slug.current, "categoryId": category->slug.current, title, summary, "content": body,
        publishedAt, readTime, featured, ${TAGS}, ${SEO_PROJECTION},
        "author": author->{name, "slug": slug.current, bio, links, "avatar": avatar.asset->url},
        "cover": coverImage.asset->url, "coverAlt": coverImage.alt, "modified": _updatedAt
    },
    "tags": *[_type == "tag"] | order(title asc){"slug": slug.current, title, description, ${SEO_PROJECTION}},
    "settings": ${SETTINGS_QUERY}
}`;

export const DOCS_QUERY = `{
    "sections": *[_type == "docsSection"] | order(order asc){"id": slug.current, title, tagline, icon, groups},
    "pages": *[_type == "docsPage"]{
        _id, "slug": slug.current, title, navTitle, description, status, badge, method, updated, sources,
        body, ${TAGS}, ${SEO_PROJECTION}, "modified": _updatedAt
    },
    "settings": ${SETTINGS_QUERY}
}`;
