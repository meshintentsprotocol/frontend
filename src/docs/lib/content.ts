// ============================================================================
// Docs content loader
// ============================================================================
// Every src/docs/content/**/*.md file is bundled as raw text. The file path
// (minus extension) is the page slug and must match a leaf in nav.ts.

import { FLAT_PAGES, type FlatPage } from '../nav';

export type DocStatus = 'ready' | 'draft' | 'planned';

export interface DocHeading {
    depth: number;
    text: string;
    id: string;
}

export interface DocPage {
    slug: string;
    nav: FlatPage;
    title: string;
    description: string;
    status: DocStatus;
    /** devrel-agent-context documents this page is written from. */
    sources: string[];
    updated?: string;
    body: string;
    headings: DocHeading[];
    /** True when the page has no markdown file yet (auto "planned" page). */
    missing: boolean;
}

const RAW = import.meta.glob('../content/**/*.md', {
    query: '?raw',
    import: 'default',
    eager: true,
}) as Record<string, string>;

const FILES: Record<string, string> = Object.fromEntries(
    Object.entries(RAW).map(([path, text]) => [path.replace('../content/', '').replace(/\.md$/, ''), text]),
);

// ── Frontmatter ──────────────────────────────────────────────────────────────

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
    const text = raw.replace(/\r\n/g, '\n');
    const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
    if (!m) return { meta: {}, body: text };
    const meta: Record<string, string> = {};
    for (const line of m[1].split('\n')) {
        const i = line.indexOf(':');
        if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
    return { meta, body: text.slice(m[0].length) };
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

function buildPage(nav: FlatPage): DocPage {
    const raw = FILES[nav.slug];
    if (raw === undefined) {
        return {
            slug: nav.slug, nav, title: nav.title, description: '', status: 'planned',
            sources: [], body: '', headings: [], missing: true,
        };
    }
    const { meta, body } = parseFrontmatter(raw);
    const status = (['ready', 'draft', 'planned'].includes(meta.status) ? meta.status : 'draft') as DocStatus;
    return {
        slug: nav.slug,
        nav,
        title: meta.title || nav.title,
        description: meta.description || '',
        status,
        sources: meta.sources ? meta.sources.split(',').map(s => s.trim()).filter(Boolean) : [],
        updated: meta.updated,
        body,
        headings: extractHeadings(body),
        missing: false,
    };
}

export const PAGES: DocPage[] = FLAT_PAGES.map(buildPage);

const BY_SLUG = new Map(PAGES.map(p => [p.slug, p]));

export const getPage = (slug: string) => BY_SLUG.get(slug);

export function neighbours(slug: string): { prev?: DocPage; next?: DocPage } {
    const i = PAGES.findIndex(p => p.slug === slug);
    if (i < 0) return {};
    return { prev: PAGES[i - 1], next: PAGES[i + 1] };
}

export function sectionStats(sectionId: string) {
    const pages = PAGES.filter(p => p.nav.section.id === sectionId);
    return {
        total: pages.length,
        ready: pages.filter(p => p.status === 'ready').length,
        draft: pages.filter(p => p.status === 'draft').length,
        planned: pages.filter(p => p.status === 'planned').length,
    };
}

if (import.meta.env.DEV) {
    const known = new Set(FLAT_PAGES.map(p => p.slug));
    const orphans = Object.keys(FILES).filter(s => !known.has(s));
    if (orphans.length) console.warn('[docs] markdown files missing from nav.ts:', orphans);
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

const INDEX = PAGES.map(p => ({
    page: p,
    title: p.title.toLowerCase(),
    description: p.description.toLowerCase(),
    section: p.nav.section.title.toLowerCase(),
    text: plain(p.body),
}));

export function search(query: string, limit = 12): SearchHit[] {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    const hits: SearchHit[] = [];

    for (const e of INDEX) {
        let score = 0;
        for (const t of terms) {
            if (e.title.includes(t)) score += 10;
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
