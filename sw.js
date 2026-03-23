const VERSION_URL = './version.json';
let CACHE_NAME = 'pwa-cache-2026.03.23.1156';

async function getVersion(){
  try {
    const res = await fetch(VERSION_URL, { cache: 'no-store' });
    const v = await res.json();
    return v.version || '2026.03.23.1156';
  } catch {
    return '2026.03.23.1156';
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const v = await getVersion();
    CACHE_NAME = 'pwa-cache-' + v;
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll([
      './','./index.html','./manifest.webmanifest','./assets/css/app.css',
      './js/app.js','./js/db.js','./js/utils.js','./js/catalogs.js','./js/schema_engine.js','./js/export.js',
      './data/choices.json','./data/schemas.json','./version.json'
    ]);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const v = await getVersion();
    const desired = 'pwa-cache-' + v;
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k.startsWith('pwa-cache-') && k !== desired) ? caches.delete(k) : Promise.resolve()));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (url.pathname.endsWith('/version.json') || url.pathname.endsWith('/data/choices.json') || url.pathname.endsWith('/data/schemas.json')) {
    event.respondWith((async () => {
      try {
        const net = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, net.clone());
        return net;
      } catch {
        return (await caches.match(req)) || (await caches.match('./index.html'));
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const net = await fetch(req);
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, net.clone());
      return net;
    } catch {
      return await caches.match('./index.html');
    }
  })());
});