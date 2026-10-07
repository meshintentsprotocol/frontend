// ============================================================================
// Docs source
// ============================================================================
// Docs are authored in Sanity Studio (studio/). One query loads the sidebar
// tree and every page; buildDocs() does the rest. Without a configured Sanity
// project the bundled markdown is used instead.

import { BookOpen } from 'lucide-react';
import { cmsQuery, sanityConfig } from '@/lib/sanity';
import { DOCS_QUERY } from '@/shared/sanity';
import type { SeoFields, SiteSettings } from '@/shared/seo';
import { ICONS, type HttpMethod, type NavBadge, type NavGroup, type NavNode, type NavSection } from '../nav';
import { buildDocs, type DocTag, type Docs, type PageSource } from './content';

interface CmsGroup {
    _type: 'navGroup';
    title: string;
    collapsed?: boolean;
    items?: CmsItem[];
}
type CmsItem = CmsGroup | { _type: 'reference'; _ref: string };

interface CmsPage {
    _id: string;
    slug: string;
    title: string;
    navTitle?: string;
    description?: string;
    status?: string;
    badge?: NavBadge;
    method?: HttpMethod;
    updated?: string;
    sources?: string[];
    body?: string;
    tags: DocTag[];
    seo?: SeoFields;
    modified?: string;
}

interface CmsDocs {
    sections: { id: string; title: string; tagline?: string; icon?: string; groups?: CmsGroup[] }[];
    pages: CmsPage[];
    settings: SiteSettings | null;
}

export interface LoadedDocs {
    docs: Docs;
    settings: SiteSettings | null;
}

export function fromCms(data: CmsDocs): Docs {
    const byId = new Map(data.pages.map(p => [p._id, p]));

    // A reference to a page that is not published yet resolves to nothing and is skipped.
    const toNode = (item: CmsItem): NavNode | null => {
        if (item._type === 'navGroup') return toGroup(item);
        const page = byId.get(item._ref);
        return page ? { slug: page.slug, title: page.navTitle || page.title, badge: page.badge, method: page.method } : null;
    };
    const toGroup = (g: CmsGroup): NavGroup => ({
        title: g.title,
        collapsed: g.collapsed,
        items: (g.items ?? []).map(toNode).filter((n): n is NavNode => n !== null),
    });

    const nav: NavSection[] = data.sections.map(s => ({
        id: s.id,
        title: s.title,
        tagline: s.tagline ?? '',
        icon: ICONS[s.icon ?? ''] ?? BookOpen,
        groups: (s.groups ?? []).map(toGroup),
    }));

    const files: Record<string, PageSource> = Object.fromEntries(
        data.pages.map(p => [p.slug, {
            title: p.title,
            description: p.description,
            status: p.status,
            updated: p.updated,
            sources: p.sources ?? [],
            tags: p.tags,
            seo: p.seo,
            modified: p.modified,
            body: p.body ?? '',
        }]),
    );
    return buildDocs(nav, files);
}

export async function loadDocs(): Promise<LoadedDocs> {
    if (!sanityConfig) {
        const { loadLocalDocs } = await import('./local');
        return { docs: loadLocalDocs(), settings: null };
    }
    const data = await cmsQuery<CmsDocs>(DOCS_QUERY);
    return { docs: fromCms(data), settings: data.settings };
}
