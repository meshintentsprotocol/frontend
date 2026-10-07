import { sanityQuery, type SanityConfig } from '@/shared/sanity';
import type { Site, SiteSettings } from '@/shared/seo';

const projectId = import.meta.env.VITE_SANITY_PROJECT_ID as string | undefined;

/** Undefined until a Sanity project is configured; /kb and /docs then read the bundled markdown. */
export const sanityConfig: SanityConfig | undefined = projectId
    ? { projectId, dataset: (import.meta.env.VITE_SANITY_DATASET as string | undefined) || 'production' }
    : undefined;

export function cmsQuery<T>(query: string, params?: Record<string, unknown>): Promise<T> {
    if (!sanityConfig) throw new Error('Sanity is not configured');
    return sanityQuery<T>(sanityConfig, query, params);
}

/** Content changes rarely within a visit; refetch in the background after this long. */
export const CMS_STALE_TIME = 5 * 60 * 1000;

export function siteOf(settings?: SiteSettings | null): Site {
    const url = ((import.meta.env.VITE_SITE_URL as string | undefined) || window.location.origin).replace(/\/+$/, '');
    return { url, settings };
}
