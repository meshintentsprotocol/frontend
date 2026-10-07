// /sitemap.xml — app routes plus every indexable knowledge base and docs URL,
// read live from Sanity so a published page is listed without a deploy.

import { sanityQuery } from '../src/shared/sanity.js';
import { escapeHtml } from '../src/shared/seo.js';
import { originOf, sanityFromEnv, send, type Req, type Res } from './_content.js';

/** Public app pages worth indexing. Wallet, portfolio and admin screens are left out. */
const STATIC_ROUTES = ['/', '/trade', '/twap', '/mesh', '/orderbook', '/integrate', '/ecosystem', '/kb', '/docs'];

interface Entry {
    path: string;
    lastmod?: string;
}

const CONTENT_QUERY = `{
    "articles": *[_type == "kbArticle" && defined(category) && seo.noindex != true]{"path": "/kb/" + category->slug.current + "/" + slug.current, "lastmod": _updatedAt},
    "categories": *[_type == "kbCategory" && seo.noindex != true]{"path": "/kb/" + slug.current, "lastmod": _updatedAt},
    "tags": *[_type == "tag" && seo.noindex != true && count(*[_type in ["kbArticle", "docsPage"] && references(^._id)]) > 0]{"path": "/kb/tag/" + slug.current, "lastmod": _updatedAt},
    "docs": *[_type == "docsPage" && status != "planned" && defined(body) && seo.noindex != true]{"path": "/docs/" + slug.current, "lastmod": _updatedAt}
}`;

export function toXml(origin: string, entries: Entry[]): string {
    const urls = entries.map(e =>
        `  <url><loc>${escapeHtml(origin + e.path)}</loc>${e.lastmod ? `<lastmod>${e.lastmod.slice(0, 10)}</lastmod>` : ''}</url>`,
    );
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

export default async function handler(req: Req, res: Res) {
    const origin = originOf(req);
    const entries: Entry[] = STATIC_ROUTES.map(path => ({ path }));

    const cfg = sanityFromEnv();
    if (cfg) {
        try {
            const data = await sanityQuery<Record<'articles' | 'categories' | 'tags' | 'docs', Entry[]>>(cfg, CONTENT_QUERY);
            entries.push(...data.categories, ...data.articles, ...data.tags, ...data.docs);
        } catch (e) {
            // Still serve the static routes: a partial sitemap beats an error.
            console.error('[api/sitemap]', e);
        }
    }

    send(res, 200, 'application/xml; charset=utf-8', toXml(origin, entries), 'public, s-maxage=600, stale-while-revalidate=3600');
}
