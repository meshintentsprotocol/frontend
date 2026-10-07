// Frontmatter of a bundled docs page. Pure, so studio/scripts/import.ts can use it too.

import type { PageSource } from './content';

export function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
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

export function toPageSource(raw: string): PageSource {
    const { meta, body } = parseFrontmatter(raw);
    return {
        title: meta.title,
        description: meta.description,
        status: meta.status,
        updated: meta.updated,
        sources: meta.sources ? meta.sources.split(',').map(s => s.trim()).filter(Boolean) : [],
        body,
    };
}
