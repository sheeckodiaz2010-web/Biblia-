/* Biblia RVR1960 · caché offline y actualizaciones seguras */
const CACHE_NAME = 'biblia-rvr1960-2026-10-30-17';
const CORE_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './biblia.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(CORE_FILES.map(async path => {
      try {
        const url = new URL(path, self.registration.scope);
        const response = await fetch(url, { cache: 'reload' });
        if (response.ok) await cache.put(url, response);
      } catch (error) {
        // Un recurso opcional ausente no debe cancelar la instalación completa.
        // Si biblia.json no se pudo descargar, la app avisará al intentar leer offline.
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith('biblia-') && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.includes('/api/')) return;
  // Las comprobaciones de versión deben consultar el servidor, no la caché.
  if (url.searchParams.has('v') || url.searchParams.has('u')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          await cache.put(new URL('./index.html', self.registration.scope), response.clone());
        }
        return response;
      } catch (error) {
        return (await cache.match(request)) ||
          (await cache.match(new URL('./index.html', self.registration.scope))) ||
          (await cache.match(new URL('./', self.registration.scope)));
      }
    })());
    return;
  }

  if (url.pathname.endsWith('/biblia.json') || url.pathname === new URL('./biblia.json', self.registration.scope).pathname) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response && response.ok) await cache.put(request, response.clone());
        return response;
      } catch (error) {
        return new Response('{"error":"Biblia no disponible sin conexión"}', {
          status: 503, headers: {'Content-Type':'application/json; charset=utf-8'}
        });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    const network = fetch(request).then(response => {
      if (response && response.ok) cache.put(request, response.clone()).catch(() => {});
      return response;
    }).catch(() => null);
    return cached || await network || Response.error();
  })());
});
