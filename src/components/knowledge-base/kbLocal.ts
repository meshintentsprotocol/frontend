// Bundled knowledge base: data/articles/*.md + data/categories.json. Loaded (as
// its own chunk) only when no Sanity project is configured; see kbService.ts.

import categories from './data/categories.json';
import type { KBArticle, KBData } from './kbService';
import { parseArticle, tagSlug } from './kbParse';

// Load all articles eagerly using Vite's glob import as raw strings
const articleModules = import.meta.glob('./data/articles/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export function loadLocalKb(): KBData {
    const articles: KBArticle[] = [];
    for (const raw of Object.values(articleModules)) {
        try {
            const a = parseArticle(raw);
            articles.push({ ...a, tags: a.tags.map(title => ({ slug: tagSlug(title), title })) });
        } catch (e) {
            console.error('Failed to parse article:', e);
        }
    }
    return {
        categories: categories.map(({ id, title, description, icon }) => ({ id, title, description, icon })),
        articles,
        tags: [],
        settings: null,
    };
}
