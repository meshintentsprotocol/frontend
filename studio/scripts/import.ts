// ============================================================================
// Import the bundled /kb and /docs content into Sanity
// ============================================================================
//   npm run import                    create every document that does not exist yet
//   npm run import -- --overwrite     replace existing documents with the files' content
//   npm run import -- --dry-run       print what would be written, touch nothing
//   npm run import -- <file.md> …     push only these files (docs pages or KB articles),
//                                     updating their content fields in place
//
// Without --overwrite a re-run never changes a document that already exists, so
// edits made in Studio are safe. Needs SANITY_STUDIO_PROJECT_ID and
// SANITY_WRITE_TOKEN in studio/.env (see .env.example).

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, type SanityClient } from '@sanity/client';
import { config } from 'dotenv';
import { ICONS, LOCAL_NAV, flatten, isGroup, type NavGroup, type NavNode } from '../../src/docs/nav';
import { toPageSource } from '../../src/docs/lib/frontmatter';
import { parseArticle, tagSlug } from '../../src/components/knowledge-base/kbParse';

const HERE = dirname(fileURLToPath(import.meta.url));
const FRONTEND = resolve(HERE, '../..');
const DOCS_DIR = join(FRONTEND, 'src/docs/content');
const KB_DIR = join(FRONTEND, 'src/components/knowledge-base/data');

config({ path: join(HERE, '../.env') });

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const OVERWRITE = args.includes('--overwrite');
const FILES = args.filter(a => !a.startsWith('--')).map(a => resolve(a));

type Doc = { _id: string; _type: string } & Record<string, unknown>;

// ── Helpers ──────────────────────────────────────────────────────────────────

const ref = (_ref: string, key?: string) => ({ _type: 'reference', _ref, ...(key ? { _key: key } : {}) });
const slug = (current: string) => ({ _type: 'slug', current });
// Dots in a document id make it private to authenticated readers, so ids use "_" for "/".
const docsPageId = (pageSlug: string) => `docsPage-${pageSlug.replace(/\//g, '_')}`;
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap(name => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? walk(path) : path.endsWith('.md') ? [path] : [];
    });
}

/** "Feb 25, 2026" → "2026-02-25". */
function isoDate(display: string): string | undefined {
    const d = new Date(`${display} UTC`);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

// ── Docs ─────────────────────────────────────────────────────────────────────

const FLAT = flatten(LOCAL_NAV);

function docsPage(pageSlug: string, file: string | undefined): Doc {
    const leaf = FLAT.find(p => p.slug === pageSlug);
    const src = file ? toPageSource(readFileSync(file, 'utf8')) : undefined;
    const title = src?.title || leaf?.title || pageSlug;
    return {
        _id: docsPageId(pageSlug),
        _type: 'docsPage',
        title,
        slug: slug(pageSlug),
        ...(src?.description ? { description: src.description } : {}),
        status: src ? (['ready', 'draft', 'planned'].includes(src.status ?? '') ? src.status : 'draft') : 'planned',
        ...(leaf && leaf.title !== title ? { navTitle: leaf.title } : {}),
        ...(leaf?.badge ? { badge: leaf.badge } : {}),
        ...(leaf?.method ? { method: leaf.method } : {}),
        ...(src?.updated && /^\d{4}-\d{2}-\d{2}$/.test(src.updated) ? { updated: src.updated } : {}),
        ...(src?.sources?.length ? { sources: src.sources } : {}),
        ...(src ? { body: src.body.trim() } : {}),
    };
}

function docsDocs(): Doc[] {
    const files = new Map(walk(DOCS_DIR).map(f => [relative(DOCS_DIR, f).replace(/\\/g, '/').replace(/\.md$/, ''), f]));
    const inNav = new Set(FLAT.map(p => p.slug));
    for (const s of files.keys()) if (!inNav.has(s)) console.warn(`  ! ${s}.md is not in nav.ts: imported, but not linked from any sidebar`);

    const pages = [...new Set([...inNav, ...files.keys()])].map(s => docsPage(s, files.get(s)));

    const toItem = (n: NavNode): Record<string, unknown> =>
        isGroup(n) ? toGroup(n) : ref(docsPageId(n.slug), key(n.slug));
    const toGroup = (g: NavGroup): Record<string, unknown> => ({
        _type: 'navGroup',
        _key: key(g.title),
        title: g.title,
        ...(g.collapsed ? { collapsed: true } : {}),
        items: g.items.map(toItem),
    });

    const sections = LOCAL_NAV.map((s, i): Doc => ({
        _id: `docsSection-${s.id}`,
        _type: 'docsSection',
        title: s.title,
        slug: slug(s.id),
        tagline: s.tagline,
        icon: Object.entries(ICONS).find(([, icon]) => icon === s.icon)?.[0] ?? 'book-open',
        order: (i + 1) * 10,
        groups: s.groups.map(toGroup),
    }));

    return [...pages, ...sections];
}

// ── Knowledge base ───────────────────────────────────────────────────────────

function kbArticle(file: string): { article: Doc; tags: Doc[]; author: Doc } {
    const a = parseArticle(readFileSync(file, 'utf8'));
    const tags = a.tags.map((title): Doc => ({ _id: `tag-${tagSlug(title)}`, _type: 'tag', title, slug: slug(tagSlug(title)) }));
    const author: Doc = { _id: `author-${tagSlug(a.author)}`, _type: 'author', name: a.author, slug: slug(tagSlug(a.author)) };
    const published = isoDate(a.date);
    return {
        tags,
        author,
        article: {
            _id: `kbArticle-${a.id}`,
            _type: 'kbArticle',
            title: a.title,
            slug: slug(a.id),
            summary: a.summary,
            body: a.content,
            category: ref(`kbCategory-${a.categoryId}`),
            tags: tags.map(t => ref(t._id, t._id)),
            author: ref(author._id),
            ...(published ? { publishedAt: published } : {}),
            readTime: a.readTime,
        },
    };
}

function kbDocs(): { content: Doc[]; taxonomy: Doc[] } {
    const categories = (JSON.parse(readFileSync(join(KB_DIR, 'categories.json'), 'utf8')) as { id: string; title: string; description: string; icon: string }[])
        .map((c, i): Doc => ({ _id: `kbCategory-${c.id}`, _type: 'kbCategory', title: c.title, slug: slug(c.id), description: c.description, icon: c.icon, order: (i + 1) * 10 }));
    const parsed = walk(join(KB_DIR, 'articles')).map(kbArticle);
    const taxonomy = new Map<string, Doc>();
    for (const p of parsed) for (const d of [...p.tags, p.author]) taxonomy.set(d._id, d);
    return { content: [...categories, ...parsed.map(p => p.article)], taxonomy: [...taxonomy.values()] };
}

const SETTINGS: Doc = {
    _id: 'siteSettings',
    _type: 'siteSettings',
    siteName: 'BCH Intents',
    description: 'Intent-based cross-chain swaps on Bitcoin Cash. Trustless, instant, non-custodial.',
};

// ── Write ────────────────────────────────────────────────────────────────────

function summarise(docs: Doc[]) {
    const counts = new Map<string, number>();
    for (const d of docs) counts.set(d._type, (counts.get(d._type) ?? 0) + 1);
    for (const [type, n] of [...counts].sort()) console.log(`  ${String(n).padStart(4)}  ${type}`);
}

async function commit(client: SanityClient, docs: Doc[], mode: 'create' | 'replace' | 'patch') {
    for (let i = 0; i < docs.length; i += 50) {
        const tx = client.transaction();
        for (const d of docs.slice(i, i + 50)) {
            if (mode === 'replace') tx.createOrReplace(d);
            else if (mode === 'create') tx.createIfNotExists(d);
            else {
                // Update what the file owns; leave SEO, tags and other Studio-only fields alone.
                const { _id, _type, ...fields } = d;
                tx.createIfNotExists({ _id, _type }).patch(_id, p => p.set(fields));
            }
        }
        await tx.commit();
    }
}

async function main() {
    let content: Doc[];
    let taxonomy: Doc[] = [];
    let mode: 'create' | 'replace' | 'patch';

    if (FILES.length) {
        mode = 'patch';
        content = [];
        for (const file of FILES) {
            if (file.startsWith(DOCS_DIR)) {
                content.push(docsPage(relative(DOCS_DIR, file).replace(/\\/g, '/').replace(/\.md$/, ''), file));
            } else if (file.startsWith(KB_DIR)) {
                const { article, tags, author } = kbArticle(file);
                content.push(article);
                taxonomy.push(...tags, author);
            } else {
                throw new Error(`${file} is not under src/docs/content or the knowledge base articles folder`);
            }
        }
    } else {
        mode = OVERWRITE ? 'replace' : 'create';
        const kb = kbDocs();
        content = [...docsDocs(), ...kb.content];
        taxonomy = [...kb.taxonomy, SETTINGS];
    }

    console.log(`${DRY ? 'Would write' : 'Writing'} (${mode === 'create' ? 'only documents that do not exist yet' : mode === 'replace' ? 'replacing existing documents' : 'updating content fields'}):`);
    summarise([...content, ...taxonomy]);
    if (DRY) return;

    const projectId = process.env.SANITY_STUDIO_PROJECT_ID;
    const token = process.env.SANITY_WRITE_TOKEN;
    if (!projectId || !token) throw new Error('Set SANITY_STUDIO_PROJECT_ID and SANITY_WRITE_TOKEN in studio/.env');
    const client = createClient({ projectId, dataset: process.env.SANITY_STUDIO_DATASET || 'production', token, apiVersion: '2025-02-19', useCdn: false });

    // Tags, authors and settings are only ever created: their descriptions and links are edited in Studio.
    await commit(client, taxonomy, 'create');
    await commit(client, content, mode);
    console.log('Done.');
}

main().catch(e => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
});
