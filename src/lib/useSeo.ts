import { useEffect } from 'react';
import { SEO_ATTR, type SeoHead } from '@/shared/seo';

function upsertMeta(attr: 'name' | 'property', key: string, value: string) {
    let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
    if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
    }
    el.setAttribute('content', value);
    el.setAttribute(SEO_ATTR, '');
}

/**
 * Applies a page's head (title, description, canonical, social tags, JSON-LD)
 * to the live document. api/page.ts writes the same head into the HTML served
 * for the URL, so this mostly matters for in-app navigation.
 */
export function useSeo(head: SeoHead | null | undefined) {
    const key = head ? JSON.stringify(head) : '';
    useEffect(() => {
        if (!head) return;
        document.title = head.title;
        upsertMeta('name', 'description', head.description);
        upsertMeta('name', 'robots', head.robots);

        let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
        if (!link) {
            link = document.createElement('link');
            link.rel = 'canonical';
            document.head.appendChild(link);
        }
        link.href = head.canonical;

        // Social tags that only some pages set (article:*) must not leak to the next page.
        const keep = new Set(head.meta.map(m => `${m.attr}:${m.key}`));
        document.head.querySelectorAll<HTMLMetaElement>(`meta[${SEO_ATTR}]`).forEach(el => {
            const prop = el.getAttribute('property');
            if (prop && !keep.has(`property:${prop}`)) el.remove();
        });
        document.head.querySelectorAll(`meta[property="article:tag"]`).forEach(el => el.remove());
        for (const m of head.meta) {
            if (m.key === 'article:tag') {
                const el = document.createElement('meta');
                el.setAttribute('property', m.key);
                el.setAttribute('content', m.value);
                el.setAttribute(SEO_ATTR, '');
                document.head.appendChild(el);
            } else {
                upsertMeta(m.attr, m.key, m.value);
            }
        }

        document.head.querySelectorAll(`script[type="application/ld+json"][${SEO_ATTR}]`).forEach(el => el.remove());
        for (const j of head.jsonLd) {
            const el = document.createElement('script');
            el.type = 'application/ld+json';
            el.setAttribute(SEO_ATTR, '');
            el.textContent = JSON.stringify(j);
            document.head.appendChild(el);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);
}
