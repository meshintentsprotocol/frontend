// Shared by api/page.ts and api/sitemap.ts. Files starting with "_" are not
// deployed as functions.

import type { SanityConfig } from '../src/shared/sanity.js';
import type { Site, SiteSettings } from '../src/shared/seo.js';

export interface Req {
    url?: string;
    headers: Record<string, string | string[] | undefined>;
    query?: Record<string, string | string[] | undefined>;
}

export interface Res {
    statusCode: number;
    setHeader(name: string, value: string): void;
    end(body?: string): void;
}

const header = (req: Req, name: string) => {
    const v = req.headers[name];
    return Array.isArray(v) ? v[0] : v;
};

export function sanityFromEnv(): SanityConfig | undefined {
    const projectId = process.env.SANITY_PROJECT_ID || process.env.VITE_SANITY_PROJECT_ID;
    if (!projectId) return undefined;
    return { projectId, dataset: process.env.SANITY_DATASET || process.env.VITE_SANITY_DATASET || 'production' };
}

/** Public origin of the site: SITE_URL when set, otherwise the request's own host. */
export function originOf(req: Req): string {
    const fixed = process.env.SITE_URL || process.env.VITE_SITE_URL;
    if (fixed) return fixed.replace(/\/+$/, '');
    const proto = header(req, 'x-forwarded-proto') || 'https';
    const host = header(req, 'x-forwarded-host') || header(req, 'host');
    return `${proto}://${host}`;
}

export const siteOf = (req: Req, settings?: SiteSettings | null): Site => ({ url: originOf(req), settings });

/** Origin to fetch this deployment's own static files from. */
export function selfOrigin(req: Req): string {
    const proto = header(req, 'x-forwarded-proto') || 'https';
    return `${proto}://${header(req, 'x-forwarded-host') || header(req, 'host')}`;
}

export function send(res: Res, status: number, type: string, body: string, cache: string) {
    res.statusCode = status;
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', cache);
    res.end(body);
}
