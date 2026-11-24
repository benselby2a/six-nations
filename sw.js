// Service worker (generated into sw.js by dev/build.sh: do not edit sw.js, edit dev/sw.template.js).
// Lets the app open with no signal. Reads only: the database is never cached here (see js/connectivity.js for the saved
// scores) and writes are never queued.
const VERSION = 'c89604c4';
const CACHE = 'six-nations-' + VERSION;
const CORE = ["./", "index.html", "dist/app.min.js?v=c89604c4", "dist/app.min.css?v=c89604c4", "manifest.json", "icons/icon-192.png", "icons/apple-touch-icon.png", "favicon.ico"];
const CDN_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE)
            .then(cache => Promise.all(CORE.map(url => fetch(url, { cache: 'reload' }).then(r => { if (r.ok) return cache.put(url, r); }).catch(() => {}))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            // keep the previous version's saved copy too: if the new one cannot start, the page falls back to it (?fallback=1)
            .then(keys => { const mine = keys.filter(k => k.startsWith('six-nations-')); const i = mine.indexOf(CACHE); const keep = i > 0 ? mine[i - 1] : null; return Promise.all(mine.filter(k => k !== CACHE && k !== keep).map(k => caches.delete(k))); })
            .then(() => self.clients.claim())
    );
});

// The page first: from the network (so updates arrive), but a slow or missing connection falls back to the saved copy quickly
function networkFirst(request, timeoutMs) {
    return new Promise((resolve) => {
        let settled = false;
        const fallback = () => caches.match(request, { ignoreSearch: true }).then(hit => hit || caches.match('index.html'));
        const timer = setTimeout(() => { fallback().then(hit => { if (hit && !settled) { settled = true; resolve(hit); } }); }, timeoutMs);
        fetch(request).then(response => {
            clearTimeout(timer);
            if (settled) return;
            settled = true;
            if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(c => c.put('index.html', copy)); }
            resolve(response);
        }).catch(() => {
            clearTimeout(timer);
            if (settled) return;
            fallback().then(hit => { settled = true; resolve(hit || Response.error()); });
        });
    });
}

// The new version could not start within a few seconds: serve the previous version's page from its saved copy (its scripts are in the same saved copy)
function previousVersionPage(request) {
    return caches.keys().then(keys => {
        const mine = keys.filter(k => k.startsWith('six-nations-'));
        const i = mine.indexOf(CACHE);
        const prev = i > 0 ? mine[i - 1] : null;
        return prev ? caches.open(prev).then(c => c.match('index.html')) : null;
    }).then(hit => hit || networkFirst(request, 4000));
}

function cacheFirst(request) {
    return caches.match(request).then(hit => hit || fetch(request).then(response => {
        if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(c => c.put(request, copy)); }
        return response;
    }));
}

function staleWhileRevalidate(request) {
    return caches.open(CACHE).then(cache => cache.match(request).then(hit => {
        const network = fetch(request).then(response => { if (response.ok || response.type === 'opaque') cache.put(request, response.clone()); return response; }).catch(() => hit);
        return hit || network;
    }));
}

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin === self.location.origin) {
        if (url.searchParams.has('_')) return;   // the new-version check must always reach the network
        const isPage = request.mode === 'navigate' || /\/(index\.html)?$/.test(url.pathname);
        if (isPage && url.searchParams.has('fallback')) { event.respondWith(previousVersionPage(request)); return; }
        if (isPage) { event.respondWith(networkFirst(request, 4000)); return; }
        if (/\/(dist|tour-images|icons)\//.test(url.pathname) || /manifest\.json$|favicon\.ico$/.test(url.pathname)) { event.respondWith(cacheFirst(request)); return; }
        return;
    }
    if (CDN_HOSTS.includes(url.hostname)) event.respondWith(staleWhileRevalidate(request));
});
