// GAA Match Tracker — Service Worker
// Cache-first strategy: serve instantly from cache, update in background.

const CACHE = 'gaa-tracker-1784719790';
const ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png?v=1784707586',
  './icon-512.png?v=1784707586',
  './icon-192-maskable.png?v=1784707586',
  './icon-512-maskable.png?v=1784707586'
];

// Install: pre-cache all app assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: delete old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first, background network update
self.addEventListener('fetch', e => {
  // Only handle GET requests for our own origin
  if(e.request.method !== 'GET') return;

  const isImage = /\.(png|jpg|jpeg|svg|webp)(\?|$)/i.test(e.request.url);

  e.respondWith(
    caches.open(CACHE).then(async cache => {
      // Icons/images: network-first so a freshly deployed logo always wins over a stale cache.
      if(isImage){
        try{
          const net = await fetch(e.request);
          if(net && net.status === 200) cache.put(e.request, net.clone());
          return net;
        }catch(err){
          const c = await cache.match(e.request);
          if(c) return c;
        }
      }
      const cached = await cache.match(e.request);

      // Fetch from network in background to keep cache fresh
      const networkFetch = fetch(e.request)
        .then(response => {
          if(response && response.status === 200 && response.type === 'basic'){
            cache.put(e.request, response.clone());
          }
          return response;
        })
        .catch(() => null);

      // Return cached immediately if available, otherwise wait for network
      return cached || networkFetch;
    })
  );
});
