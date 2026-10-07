// ============================================================================
// Knowledge base data
// ============================================================================
// Articles, categories and tags are authored in Sanity Studio (studio/) and
// loaded with one query. Without a configured Sanity project the bundled
// markdown in data/ is used instead (kbLocal.ts).

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CMS_STALE_TIME, cmsQuery, sanityConfig, siteOf } from '@/lib/sanity';
import { KB_QUERY } from '@/shared/sanity';
import type { SeoFields, Site, SiteSettings } from '@/shared/seo';

export interface KBTag {
    slug: string;
    title: string;
    description?: string;
    seo?: SeoFields;
}

export interface KBArticle {
    id: string;
    categoryId: string;
    title: string;
    summary: string;
    content: string; // Markdown content
    /** Display date, e.g. "Feb 25, 2026". */
    date: string;
    /** ISO publication date and last edit, when known. */
    published?: string;
    modified?: string;
    author: string;
    authorLinks?: string[];
    readTime: string;
    tags: KBTag[];
    /** Cover image URL; cards fall back to the stock image. */
    cover?: string;
    coverAlt?: string;
    featured?: boolean;
    seo?: SeoFields;
}

export interface KBCategory {
    id: string;
    title: string;
    description: string;
    articleCount: number;
    icon: string;
    seo?: SeoFields;
}

/** What a source (Sanity or the bundled files) hands over. */
export interface KBData {
    categories: Omit<KBCategory, 'articleCount'>[];
    articles: KBArticle[];
    tags: KBTag[];
    settings: SiteSettings | null;
}

export const KB_FALLBACK_COVER = '/images/kb/sample_article.png';

export function formatDate(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
        ? iso
        : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export const estimateReadTime = (markdown: string) =>
    `${Math.max(1, Math.round(markdown.split(/\s+/).filter(Boolean).length / 220))} min read`;

// ── Sanity ───────────────────────────────────────────────────────────────────

interface CmsArticle {
    id: string;
    categoryId: string;
    title: string;
    summary?: string;
    content?: string;
    publishedAt?: string;
    readTime?: string;
    featured?: boolean;
    tags: KBTag[];
    seo?: SeoFields;
    author?: { name: string; links?: string[] } | null;
    cover?: string;
    coverAlt?: string;
    modified?: string;
}

interface CmsKb {
    categories: { id: string; title: string; description?: string; icon?: string; seo?: SeoFields }[];
    articles: CmsArticle[];
    tags: KBTag[];
    settings: SiteSettings | null;
}

function fromCms(data: CmsKb): KBData {
    return {
        categories: data.categories.map(c => ({ id: c.id, title: c.title, description: c.description ?? '', icon: c.icon ?? 'book-open', seo: c.seo })),
        articles: data.articles.map(a => ({
            id: a.id,
            categoryId: a.categoryId,
            title: a.title,
            summary: a.summary ?? '',
            content: a.content ?? '',
            date: a.publishedAt ? formatDate(a.publishedAt) : '',
            published: a.publishedAt,
            modified: a.modified,
            author: a.author?.name ?? 'BCH Intents',
            authorLinks: a.author?.links,
            readTime: a.readTime || estimateReadTime(a.content ?? ''),
            tags: a.tags,
            cover: a.cover,
            coverAlt: a.coverAlt,
            featured: a.featured,
            seo: a.seo,
        })),
        tags: data.tags,
        settings: data.settings,
    };
}

async function loadKb(): Promise<KBData> {
    if (!sanityConfig) return (await import('./kbLocal')).loadLocalKb();
    return fromCms(await cmsQuery<CmsKb>(KB_QUERY));
}

// ── Service ──────────────────────────────────────────────────────────────────

export function buildKb(data: KBData) {
    const { articles } = data;
    const categories: KBCategory[] = data.categories.map(c => ({
        ...c,
        articleCount: articles.filter(a => a.categoryId === c.id).length,
    }));
    // Tags in use, plus tags defined in the CMS that no article carries yet.
    const tags = new Map<string, KBTag>(data.tags.map(t => [t.slug, t]));
    for (const a of articles) for (const t of a.tags) if (!tags.has(t.slug)) tags.set(t.slug, t);

    return {
        getCategories: (): KBCategory[] => categories,

        getCategory: (id: string): KBCategory | undefined => categories.find(c => c.id === id),

        getAllArticles: (): KBArticle[] => articles,

        getArticlesByCategory: (categoryId: string): KBArticle[] => articles.filter(a => a.categoryId === categoryId),

        getArticleById: (id: string): KBArticle | undefined => articles.find(a => a.id === id),

        getTags: (): KBTag[] => [...tags.values()],

        getTag: (slug: string): KBTag | undefined => tags.get(slug),

        getArticlesByTag: (slug: string): KBArticle[] => articles.filter(a => a.tags.some(t => t.slug === slug)),

        /** Other articles ranked by shared tags, then by sharing the category. */
        getRelated: (article: KBArticle, limit = 3): KBArticle[] => {
            const own = new Set(article.tags.map(t => t.slug));
            return articles
                .filter(a => a.id !== article.id)
                .map(a => ({ a, score: a.tags.filter(t => own.has(t.slug)).length * 2 + (a.categoryId === article.categoryId ? 1 : 0) }))
                .filter(x => x.score > 0)
                .sort((x, y) => y.score - x.score)
                .slice(0, limit)
                .map(x => x.a);
        },

        searchArticles: (query: string): KBArticle[] => {
            const lowerQuery = query.toLowerCase();
            return articles.filter(a =>
                a.title.toLowerCase().includes(lowerQuery) ||
                a.summary.toLowerCase().includes(lowerQuery) ||
                a.tags.some(t => t.title.toLowerCase().includes(lowerQuery)) ||
                a.content.toLowerCase().includes(lowerQuery)
            );
        },
    };
}

const EMPTY: KBData = { categories: [], articles: [], tags: [], settings: null };

export interface KbService extends ReturnType<typeof buildKb> {
    /** True until the first load finishes; every getter returns nothing meanwhile. */
    loading: boolean;
    /** True when the content could not be loaded. */
    failed: boolean;
    retry: () => void;
    site: Site;
}

export function useKb(): KbService {
    const { data, isPending, isError, refetch } = useQuery({ queryKey: ['cms', 'kb'], queryFn: loadKb, staleTime: CMS_STALE_TIME });
    return useMemo(
        () => ({ ...buildKb(data ?? EMPTY), loading: isPending, failed: isError, retry: () => { void refetch(); }, site: siteOf(data?.settings) }),
        [data, isPending, isError, refetch],
    );
}
