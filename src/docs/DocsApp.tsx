// ============================================================================
// Developer docs (/docs/*)
// ============================================================================
// Self-contained subtree: header tabs + sidebar + article + TOC.
// Structure lives in nav.ts, content in content/**/*.md, embeds in embeds.tsx.
// Authoring guide: src/docs/README.md

import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { findSection, firstPageOf } from './nav';
import { getPage } from './lib/content';
import { DocsHeader } from './components/DocsHeader';
import { DocsSidebar } from './components/DocsSidebar';
import { DocsSearch } from './components/DocsSearch';
import { DocsPage } from './pages/DocsPage';
import { DocsHome } from './pages/DocsHome';

export default function DocsApp() {
    const params = useParams();
    const slug = (params['*'] ?? '').replace(/\/+$/, '');
    const [searchOpen, setSearchOpen] = useState(false);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
            if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
                e.preventDefault();
                setSearchOpen(o => !o);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const page = slug ? getPage(slug) : undefined;

    // /docs/<section-id> → first page of that section; unknown slugs → docs home.
    if (slug && !page) {
        const section = findSection(slug.split('/')[0]);
        return <Navigate to={section ? `/docs/${firstPageOf(section).slug}` : '/docs'} replace />;
    }

    const section = page?.nav.section;

    return (
        <div className="min-h-screen bg-[#050505] text-zinc-300 antialiased">
            <DocsHeader activeSection={section} activeSlug={page?.slug} onSearch={() => setSearchOpen(true)} />
            <DocsSearch open={searchOpen} onOpenChange={setSearchOpen} />
            {page && section ? (
                <div className="mx-auto flex max-w-[1560px] gap-10 px-4 lg:px-6">
                    <aside className="hidden w-[264px] shrink-0 lg:block">
                        <div className="sticky top-16 max-h-[calc(100vh-4rem)] overflow-y-auto border-r border-white/[0.05] pb-16 pr-4 pt-10">
                            <DocsSidebar section={section} activeSlug={page.slug} />
                        </div>
                    </aside>
                    <main className="min-w-0 flex-1">
                        <DocsPage key={page.slug} page={page} />
                    </main>
                </div>
            ) : (
                <DocsHome onSearch={() => setSearchOpen(true)} />
            )}
        </div>
    );
}
