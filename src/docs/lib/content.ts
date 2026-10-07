// ============================================================================
// Docs content model
// ============================================================================
// buildDocs() turns a nav tree plus page sources into everything the docs UI
// reads: pages in reading order, lookups, TOC headings and the search index.
// Where the nav and sources come from (Sanity or the bundled markdown) is
// decided in source.ts.

import { flatten, type FlatPage, type NavSection } from '../nav';
// Relative, not "@/": studio/scripts/import.ts loads this file outside the app's path aliases.
import type { SeoFields } from '../../shared/seo';

export type DocStatus = 'ready' | 'draft' | 'planned';

export interface DocHeading {
    depth: number;
    text: string;
    id: string;
}

export interface DocTag {
    slug: string;
    title: string;
}

/** One page as authored: every field but the body is optional. */
export interface PageSource {
    title?: string;
    description?: string;
    status?: string;
    updated?: string;
    sources?: string[];
    tags?: DocTag[];
    seo?: SeoFields;
    /** ISO timestamp of the last edit, when the source knows it. */
    modified?: string;
    body: string;
}

export interface DocPage {
    slug: string;
    nav: FlatPage;
    title: string;
    description: string;
    status: DocStatus;
    /** Code files and spec documents this page is written from. */
    sources: string[];
    tags: DocTag[];
    seo?: SeoFields;
    updated?: string;
    modified?: string;
    body: string;
    headings: DocHeading[];
    /** True when the page has no body yet (auto "planned" page). */
    missing: boolean;
}

// ── Headings & slugs ─────────────────────────────────────────────────────────
// The TOC is extracted from raw markdown here, and heading ids are assigned
// by a remark plugin at render time. Both go through createSlugger() in
// document order so ids always agree.

export function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, '')
        .trim()
        .replace(/\s+/g, '-');
}

export function createSlugger() {
    const seen = new Map<string, number>();
    return (text: string) => {
        const base = slugify(text) || 'section';
        const n = seen.get(base) ?? 0;
        seen.set(base, n + 1);
        return n === 0 ? base : `${base}-${n}`;
    };
}

/** Plain text of an inline markdown heading (drops code ticks, emphasis, link urls). */
function inlineText(md: string): string {
    return md
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/`([^`]*)`/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .trim();
}

/** Heading depths that receive anchor ids. The TOC shows depth 2–3. */
export const ANCHOR_DEPTHS = [2, 3, 4];

function extractHeadings(body: string): DocHeading[] {
    const slug = createSlugger();
    const out: DocHeading[] = [];
    let fence: string | null = null;
    for (const line of body.split('\n')) {
        const f = /^\s*(```+|~~~+)/.exec(line);
        if (f) {
            if (!fence) fence = f[1];
            else if (line.trim().startsWith(fence)) fence = null;
            continue;
        }
        if (fence) continue;
        const h = /^(#{2,4})\s+(.+?)\s*#*\s*$/.exec(line);
        if (!h) continue;
        const text = inlineText(h[2]);
        out.push({ depth: h[1].length, text, id: slug(text) });
    }
    return out;
}

// ── Pages ────────────────────────────────────────────────────────────────────

function buildPage(nav: FlatPage, src: PageSource | undefined): DocPage {
    if (!src || !src.body.trim()) {
        return {
            slug: nav.slug, nav, title: src?.title || nav.title, description: src?.description ?? '', status: 'planned',
            sources: src?.sources ?? [], tags: src?.tags ?? [], seo: src?.seo, modified: src?.modified,
            body: '', headings: [], missing: true,
        };
    }
    const status = (['ready', 'draft', 'planned'].includes(src.status ?? '') ? src.status : 'draft') as DocStatus;
    return {
        slug: nav.slug,
        nav,
        title: src.title || nav.title,
        description: src.description || '',
        status,
        sources: src.sources ?? [],
        tags: src.tags ?? [],
        seo: src.seo,
        updated: src.updated,
        modified: src.modified,
        body: src.body,
        headings: extractHeadings(src.body),
        missing: false,
    };
}

// ── Search ───────────────────────────────────────────────────────────────────

export interface SearchHit {
    page: DocPage;
    heading?: DocHeading;
    score: number;
}

function plain(body: string): string {
    return body
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/[#>*_`|[\]()-]/g, ' ')
        .replace(/\s+/g, ' ')
        .toLowerCase();
}

// ── Docs ─────────────────────────────────────────────────────────────────────

export interface Docs {
    nav: NavSection[];
    /** Every page in reading order. */
    pages: DocPage[];
    getPage(slug: string): DocPage | undefined;
    neighbours(slug: string): { prev?: DocPage; next?: DocPage };
    sectionStats(sectionId: string): { total: number; ready: number; draft: number; planned: number };
    findSection(id: string): NavSection | undefined;
    firstPageOf(section: NavSection): FlatPage;
    search(query: string, limit?: number): SearchHit[];
}

/** `files` maps a page slug to its source. Sections without pages are dropped. */
export function buildDocs(sections: NavSection[], files: Record<string, PageSource>): Docs {
    const flat = flatten(sections);
    const nav = sections.filter(s => flat.some(p => p.section.id === s.id));
    const pages = flat.map(p => buildPage(p, files[p.slug]));
    const bySlug = new Map(pages.map(p => [p.slug, p]));

    const index = pages.map(p => ({
        page: p,
        title: p.title.toLowerCase(),
        description: p.description.toLowerCase(),
        section: p.nav.section.title.toLowerCase(),
        tags: p.tags.map(t => t.title.toLowerCase()).join(' '),
        text: plain(p.body),
    }));

    function search(query: string, limit = 12): SearchHit[] {
        const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
        if (!terms.length) return [];
        const hits: SearchHit[] = [];

        for (const e of index) {
            let score = 0;
            for (const t of terms) {
                if (e.title.includes(t)) score += 10;
                else if (e.tags.includes(t)) score += 6;
                else if (e.description.includes(t)) score += 4;
                else if (e.section.includes(t)) score += 2;
                else if (e.text.includes(t)) score += 1;
                else { score = 0; break; } // every term must match somewhere
            }
            if (score > 0) hits.push({ page: e.page, score: score + (e.page.status === 'ready' ? 1 : 0) });

            for (const h of e.page.headings) {
                const ht = h.text.toLowerCase();
                if (terms.every(t => ht.includes(t))) hits.push({ page: e.page, heading: h, score: 6 + terms.length });
            }
        }
        return hits.sort((a, b) => b.score - a.score).slice(0, limit);
    }

    return {
        nav,
        pages,
        getPage: slug => bySlug.get(slug),
        neighbours: slug => {
            const i = pages.findIndex(p => p.slug === slug);
            return i < 0 ? {} : { prev: pages[i - 1], next: pages[i + 1] };
        },
        sectionStats: sectionId => {
            const own = pages.filter(p => p.nav.section.id === sectionId);
            return {
                total: own.length,
                ready: own.filter(p => p.status === 'ready').length,
                draft: own.filter(p => p.status === 'draft').length,
                planned: own.filter(p => p.status === 'planned').length,
            };
        },
        findSection: id => nav.find(s => s.id === id),
        firstPageOf: section => flat.find(p => p.section.id === section.id)!,
        search,
    };
}
