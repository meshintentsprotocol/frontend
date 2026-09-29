/**
 * Token Icon & IPFS Multi-Gateway Resolver
 * Provides reliable token logo resolution across multiple IPFS gateways
 * and generates deterministic fallbacks so images never glitch or break.
 */

// Ordered by measured reliability (Sept 2026). BCH-community gateways first:
// ipfs.io / dweb.link aggressively 429 browser bursts, pinata is slow (4-6s),
// and cloudflare-ipfs.com no longer resolves at all.
const IPFS_GATEWAYS = [
    'https://ipfs.tapswap.cash/ipfs/',
    'https://ipfs.pat.mn/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://dweb.link/ipfs/',
    'https://gateway.pinata.cloud/ipfs/',
];

// Public gateways that are dead, rate-limited, or just redirect to one — an
// icon URL on these is rewritten onto our ordered list instead of tried as-is.
// (Dedicated gateways such as <project>.mypinata.cloud are still tried first.)
export const PUBLIC_GATEWAY_HOSTS = /(^|\.)(cloudflare-ipfs\.com|nftstorage\.link|w3s\.link|ipfs\.io|dweb\.link|gateway\.pinata\.cloud)$/i;

const CID_RE = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|baf[0-9a-z]{56,})/i;

function identicon(seed: string): string {
    return `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(seed)}`;
}

/**
 * Extracts IPFS CID or path from various formats:
 * - ipfs://bafy...
 * - ipfs://ipfs/bafy...
 * - /ipfs/bafy...
 * - bafy... or Qm...
 * - https://<gateway>/ipfs/bafy...
 * - https://bafy....ipfs.<gateway>/path  (subdomain gateways)
 */
export function extractIpfsPath(uri: string): string | null {
    if (!uri) return null;
    const trimmed = uri.trim();
    if (trimmed.startsWith('ipfs://')) {
        return trimmed.replace(/^ipfs:\/\/(ipfs\/)?/, '') || null;
    }
    if (trimmed.startsWith('/ipfs/')) {
        return trimmed.slice('/ipfs/'.length) || null;
    }
    if (CID_RE.test(trimmed)) {
        return trimmed;
    }
    if (/^https?:\/\//i.test(trimmed)) {
        try {
            const url = new URL(trimmed);
            const sub = url.hostname.match(/^([a-z0-9]+)\.ipfs\./i);
            if (sub && CID_RE.test(sub[1])) {
                const rest = url.pathname === '/' ? '' : url.pathname;
                return `${sub[1]}${rest}`;
            }
            const pathMatch = url.pathname.match(/\/ipfs\/(.+)$/);
            if (pathMatch && CID_RE.test(pathMatch[1])) {
                return pathMatch[1];
            }
        } catch {
            return null;
        }
    }
    return null;
}

/**
 * Returns an array of URLs to try in order for a given icon URI.
 * The last entry is always a deterministic identicon unless the URI is local/data.
 */
export function getIconFallbackUrls(uri?: string | null, seed?: string): string[] {
    const trimmed = (uri ?? '').trim();
    if (!trimmed) return [identicon(seed || 'token')];

    // Data URIs (inline svg/png) and local static assets never need fallbacks
    if (trimmed.startsWith('data:image/') || (trimmed.startsWith('/') && !trimmed.startsWith('/ipfs/'))) {
        return [trimmed];
    }

    const ipfsPath = extractIpfsPath(trimmed);
    if (ipfsPath) {
        const gatewayUrls = IPFS_GATEWAYS.map(g => `${g}${ipfsPath}`);
        const isHttp = /^https?:\/\//i.test(trimmed);
        let host = '';
        try { host = isHttp ? new URL(trimmed).hostname : ''; } catch { /* ignore */ }
        // A dedicated gateway (e.g. a project's own *.mypinata.cloud) is tried
        // first; public gateway URLs collapse onto our ordered list.
        const original = isHttp && !PUBLIC_GATEWAY_HOSTS.test(host) ? [trimmed] : [];
        return [...new Set([...original, ...gatewayUrls]), identicon(seed || ipfsPath)];
    }

    if (/^https?:\/\//i.test(trimmed)) {
        return [trimmed, identicon(seed || trimmed)];
    }

    return [identicon(seed || trimmed)];
}

/**
 * Single primary URL resolver — the most reliable first candidate.
 * Use for plain <img> tags that have no retry logic.
 */
export function resolveTokenIconUri(uri?: string | null, seed?: string): string {
    return getIconFallbackUrls(uri, seed)[0];
}

// URLs that already failed to load this session — shared across every
// TokenChainIcon so a remount (e.g. list → detail page) skips dead gateways
// instead of flickering through them again.
const failedIconUrls = new Set<string>();

export function markIconUrlFailed(url: string): void {
    failedIconUrls.add(url);
}

export function isIconUrlFailed(url: string): boolean {
    return failedIconUrls.has(url);
}
