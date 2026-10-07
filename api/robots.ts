// /robots.txt — generated so the Sitemap line always carries this deployment's origin.

import { originOf, send, type Req, type Res } from './_content.js';

export default function handler(req: Req, res: Res) {
    const body = [
        'User-agent: *',
        'Allow: /',
        'Disallow: /api/',
        'Disallow: /admin',
        'Disallow: /kb/search',
        '',
        `Sitemap: ${originOf(req)}/sitemap.xml`,
        '',
    ].join('\n');
    send(res, 200, 'text/plain; charset=utf-8', body, 'public, s-maxage=3600');
}
