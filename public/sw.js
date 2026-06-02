// BCH Intents Protocol — Service Worker
// Strategy:
//   - HTML navigation: network-first (always get latest shell)
//   - CSS / fonts / images: cache-first, long TTL
//   - JS chunks: network-first (chunks are hashed; stale ones 404 anyway)
//   - API / price oracle calls: network-only (never cache financial data)

const CACHE_VERSION = 'bch-intents-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const FONT_CACHE   = `${CACHE_VERSION}-fonts`;

const STATIC_TYPES = ['image/png','image/jpeg','image/svg+xml','image/webp',
                      'text/css','font/woff2','font/woff'];

// ── Install: take control immediately ────────────────────────────────────────
self.addEventListener('install', () => self.skipWaiting());

// ── Activate: clean up old caches ────────────────────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(k => k.startsWith('bch-intents-') && k !== STATIC_CACHE && k !== FONT_CACHE)
                    .map(k => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Never intercept: non-GET, cross-origin API / RPC calls
    if (request.method !== 'GET') return;
    if (url.origin !== self.location.origin &&
        !url.hostname.match(/fonts\.(googleapis|gstatic)\.com$/)) return;

    // Fonts — cache-first, 1 year TTL
    if (url.hostname.match(/fonts\.(googleapis|gstatic)\.com$/)) {
        event.respondWith(cacheFirst(request, FONT_CACHE, 365));
        return;
    }

    // Static assets (images, CSS) — cache-first, 30 day TTL
    const acceptHeader = request.headers.get('Accept') || '';
    const isStaticAsset = url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|css|woff2?|ttf)$/i);
    if (isStaticAsset) {
        event.respondWith(cacheFirst(request, STATIC_CACHE, 30));
        return;
    }

    // HTML navigation — network-first, fall back to cached index.html
    if (acceptHeader.includes('text/html') || request.mode === 'navigate') {
        event.respondWith(networkFirstHTML(request));
        return;
    }

    // Everything else (JS chunks, etc.) — network-first, no persistent cache
    // (JS chunks are content-hashed; stale refs 404 — handled by vite:preloadError listener)
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName, maxAgeDays) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) {
        const date = cached.headers.get('sw-cached-at');
        if (date && Date.now() - Number(date) < maxAgeDays * 86400_000) {
            return cached;
        }
    }
    try {
        const response = await fetch(request);
        if (response.ok) {
            const headers = new Headers(response.headers);
            headers.set('sw-cached-at', String(Date.now()));
            const cloned = new Response(await response.clone().arrayBuffer(), {
                status: response.status,
                headers,
            });
            cache.put(request, cloned);
        }
        return response;
    } catch {
        return cached || new Response('Offline', { status: 503 });
    }
}

async function networkFirstHTML(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(request) || await cache.match('/index.html');
        return cached || new Response('<h1>Offline</h1>', {
            status: 503,
            headers: { 'Content-Type': 'text/html' },
        });
    }
}

// Listen for SKIP_WAITING message from PWAUpdatePrompt
self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
