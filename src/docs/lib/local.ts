// ============================================================================
// Bundled docs source
// ============================================================================
// The markdown under content/ plus LOCAL_NAV. Loaded (as its own chunk) only
// when no Sanity project is configured; see source.ts.

import { LOCAL_NAV } from '../nav';
import { buildDocs, type Docs, type PageSource } from './content';
import { toPageSource } from './frontmatter';

const RAW = import.meta.glob('../content/**/*.md', {
    query: '?raw',
    import: 'default',
    eager: true,
}) as Record<string, string>;

export function loadLocalDocs(): Docs {
    const files: Record<string, PageSource> = Object.fromEntries(
        Object.entries(RAW).map(([path, text]) => [path.replace('../content/', '').replace(/\.md$/, ''), toPageSource(text)]),
    );
    return buildDocs(LOCAL_NAV, files);
}
