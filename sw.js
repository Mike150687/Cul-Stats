// Cúl Stats — Service Worker
//
// The app document is fetched NETWORK-FIRST. Cache-first was serving a stale
// index.html on every launch, so a freshly deployed build only appeared the time
// after next — which looked exactly like "I deployed it and nothing changed".
// The cache is still there as an offline fallback.

const CACHE = 'gaa-tracker-1787581891';
const ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-192-maskable.png',
  './icon-512-maskable.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS).catch(()=>{})));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if(e.request.method !== 'GET') return;

  const url = e.request.url;
  const isDoc   = e.request.mode === 'navigate' || /\.html(\?|$)/i.test(url) || /\/$/.test(new URL(url).pathname);
  const isImage = /\.(png|jpg|jpeg|svg|webp)(\?|$)/i.test(url);
  const isMeta  = /manifest\.json(\?|$)/i.test(url);

  // The document, the manifest and images always come from the network when we can
  // reach it, so a new deploy is live immediately. Cache is the offline fallback.
  if(isDoc || isImage || isMeta){
    e.respondWith((async () => {
      try {
        const net = await fetch(e.request, { cache: 'no-store' });
        if(net && net.status === 200){
          const cache = await caches.open(CACHE);
          cache.put(e.request, net.clone());
        }
        return net;
      } catch(err){
        const cached = await caches.match(e.request);
        if(cached) return cached;
        const fallback = await caches.match('./index.html');
        if(isDoc && fallback) return fallback;
        throw err;
      }
    })());
    return;
  }

  // Anything else: cache first, refreshed in the background.
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(e.request);
    const net = fetch(e.request).then(r => {
      if(r && r.status === 200 && r.type === 'basic') cache.put(e.request, r.clone());
      return r;
    }).catch(() => null);
    return cached || net;
  })());
});
